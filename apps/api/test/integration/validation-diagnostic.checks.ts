import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import type { TestContext } from "node:test";
import type { Pool } from "pg";
import { AccessError } from "../../src/access/transaction.js";
import type { ClockGuard } from "../../src/access/transaction.js";
import type { SessionDelivery } from "../../src/access/credentials.js";
import { createValidationDiagnosticService } from "../../src/content/validation-diagnostics.js";
import { createValidationRunService } from "../../src/content/validation-runs.js";
import { buildApp } from "../../src/app.js";
import { browserPolicy } from "../../src/access/browser-policy.js";
import { createStaffService } from "../../src/access/staff-service.js";
import { createEntryService } from "../../src/access/entry-service.js";
import { createStaffManagement } from "../../src/access/staff-management.js";
import { validationDiagnosticBrowserChecks } from "./validation-diagnostic-browser.checks.js";

interface Person {
  id: string;
  code: string;
  sessionCookie: string;
  session: { session_id: string };
}
export async function validationDiagnosticChecks(
  t: TestContext,
  c: {
    owner: Pool;
    api: Pool;
    clock: ClockGuard;
    delivery: SessionDelivery;
    person: (role?: string) => Promise<Person>;
    run: string;
    version: string;
    pendingRun: string;
    pendingAttempt: string;
  },
) {
  const service = createValidationDiagnosticService(c.api, c.clock, c.delivery),
    actor = await c.person(),
    run = c.run,
    attempt = (
      await c.owner.query(
        "SELECT a.* FROM authoring_attempts a JOIN authoring_checks c ON c.id=a.check_id WHERE c.run_id=$1 ORDER BY a.id LIMIT 1",
        [run],
      )
    ).rows[0],
    denied = (code: string) => (e: unknown) =>
      e instanceof AccessError && e.code === code,
    input = () => ({
      requestKey: randomUUID(),
      confirmRunId: run,
      attemptId: attempt.id as string,
      reason: "Investigate synthetic authoring diagnostics",
    }),
    budgets = async () => {
      await c.owner.query(
        "UPDATE quota_buckets SET credits=burst::bigint*60000",
      );
    };
  let key = "";
  async function state() {
    return (
      await c.owner.query(
        `SELECT (SELECT jsonb_agg(to_jsonb(r) ORDER BY id) FROM validation_runs r) AS runs,
    (SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM authoring_attempts a) AS attempts,
    (SELECT jsonb_agg(to_jsonb(s) ORDER BY id) FROM execution_capacity_slots s) AS slots,
    (SELECT jsonb_agg(to_jsonb(v) ORDER BY id) FROM bug_versions v) AS versions,
    (SELECT last_activity_at FROM staff_sessions WHERE id=$1) AS activity`,
        [actor.session.session_id],
      )
    ).rows;
  }
  await t.test(
    "one private authoring dispatch is audited once and recovered without exposing raw supervisor, source or hidden-test records",
    async () => {
      const before = await state(),
        command = input();
      key = command.requestKey;
      const [a, b] = await Promise.all([
        service.open(actor.sessionCookie, run, command),
        service.open(actor.sessionCookie, run, command),
      ]);
      assert.deepEqual(a, b);
      assert.equal(a.result, attempt.result);
      assert.deepEqual(
        Buffer.from(a.stdout_b64, "base64"),
        attempt.stdout_prefix,
      );
      assert.deepEqual(Buffer.from(a.stderr_b64, "base64"), attempt.stderr);
      assert.deepEqual(
        Buffer.from(a.compiler_output_b64, "base64"),
        attempt.compiler_output,
      );
      assert.equal(a.stdout_truncated, true);
      assert.equal(a.stderr_truncated, true);
      assert.equal(a.compiler_output_truncated, true);
      assert.equal(a.cpu_ns, attempt.evidence.cpu_ns);
      assert.equal(a.peak_bytes, attempt.evidence.peak_bytes);
      assert.equal(Buffer.from(a.stdout_b64, "base64").length, 16384);
      assert.equal(Buffer.from(a.stderr_b64, "base64").length, 65536);
      assert.equal(Buffer.from(a.compiler_output_b64, "base64").length, 65536);
      assert.deepEqual(
        (
          await createValidationDiagnosticService(
            c.api,
            c.clock,
            c.delivery,
          ).outcome(actor.sessionCookie, run, key)
        ).receipt,
        a,
      );
      assert.doesNotMatch(
        JSON.stringify(a),
        /supervisor_evidence|host_epoch_id|input_data|expected_output|reference_code|starter_code|payload_digest|result_digest/,
      );
      assert.deepEqual(await state(), before);
      assert.equal(
        (
          await c.owner.query(
            "SELECT count(*)::int n FROM validation_diagnostic_audits WHERE request_key=$1",
            [key],
          )
        ).rows[0].n,
        1,
      );
      await assert.rejects(
        service.open(actor.sessionCookie, run, {
          ...command,
          reason: "Changed purpose",
        }),
        denied("INTENT_CONFLICT"),
      );
      assert.equal(
        (await service.outcome(actor.sessionCookie, run, randomUUID())).status,
        "NOT_OBSERVED",
      );
    },
  );
  await t.test(
    "diagnostic reviews allow normal staff and reject foreign/unresolved attempts, wrong confirmation and expired sessions",
    async () => {
      const organiser = await c.person("ORGANISER"),
        other = await c.person(),
        command = input();
      assert.ok(await service.open(organiser.sessionCookie, run, command));
      assert.equal((await service.outcome(organiser.sessionCookie, run, key)).status,"NOT_OBSERVED");
      assert.ok(await service.history(organiser.sessionCookie, run));
      assert.equal(
        (await service.outcome(other.sessionCookie, run, key)).status,
        "NOT_OBSERVED",
      );
      await assert.rejects(
        service.open(actor.sessionCookie, run, {
          ...command,
          attemptId: c.pendingAttempt,
        }),
        denied("CONTENT_UNAVAILABLE"),
      );
      await assert.rejects(
        service.open(actor.sessionCookie, c.pendingRun, {
          ...command,
          confirmRunId: c.pendingRun,
          attemptId: c.pendingAttempt,
        }),
        denied("CONTENT_UNAVAILABLE"),
      );
      await assert.rejects(
        service.open(actor.sessionCookie, run, {
          ...command,
          confirmRunId: randomUUID(),
        }),
        denied("INVALID_CONTEXT"),
      );
      const future = new Proxy(c.api, {
        get(target, key) {
          if (key !== "connect") return Reflect.get(target, key, target);
          return async () => {
            const client = await c.api.connect();
            return new Proxy(client, {
              get(target, key) {
                if (key !== "query") return Reflect.get(target, key, target);
                return async (text: string, values?: unknown[]) => {
                  const result = await client.query(text, values);
                  if (
                    text ===
                    "SELECT date_trunc('milliseconds', clock_timestamp()) AS now"
                  )
                    result.rows[0].now = new Date(Date.now() + 16 * 60000);
                  return result;
                };
              },
            });
          };
        },
      });
      await assert.rejects(
        createValidationDiagnosticService(future, c.clock, c.delivery).open(
          other.sessionCookie,
          run,
          command,
        ),
        denied("INVALID_SESSION"),
      );
      const failed = {
        ...c.clock,
        assertHealthy() {
          throw new AccessError("CLOCK_UNTRUSTED");
        },
      };
      await assert.rejects(
        createValidationDiagnosticService(c.api, failed, c.delivery).outcome(
          actor.sessionCookie,
          run,
          key,
        ),
        denied("CLOCK_UNTRUSTED"),
      );
      await assert.rejects(
        service.open("invalid", run, command),
        denied("INVALID_SESSION"),
      );
    },
  );
  await t.test(
    "private diagnostic history is immutable and database triggers refuse forged scope, digest or actor binding",
    async () => {
      const organiser = await c.person("ORGANISER");
      const auth = (
        await c.owner.query("SELECT * FROM staff_sessions WHERE id=$1", [
          organiser.session.session_id,
        ])
      ).rows[0];
      const row = (
        await c.owner.query(
          "SELECT * FROM validation_diagnostic_audits WHERE request_key=$1",
          [key],
        )
      ).rows[0];
      for (const patch of [
        { run_id: c.pendingRun },
        { result_digest: Buffer.alloc(32) },
        {
          actor_id: auth.staff_id,
        },
      ]) {
        const r = { ...row, ...patch };
        await assert.rejects(
          c.api.query(
            `INSERT INTO validation_diagnostic_audits(id,run_id,attempt_id,actor_id,session_id,credential_id,credential_version,request_key,fingerprint,reason,result_digest,recorded_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,date_trunc('milliseconds',clock_timestamp()))`,
            [
              randomUUID(),
              r.run_id,
              r.attempt_id,
              r.actor_id,
              r.session_id,
              r.credential_id,
              r.credential_version,
              randomUUID(),
              r.fingerprint,
              r.reason,
              r.result_digest,
            ],
          ),
          { code: "P0001" },
        );
      }
      await assert.rejects(
        c.owner.query(
          "UPDATE validation_diagnostic_audits SET reason='Changed'",
        ),
        { code: "P0001" },
      );
      await assert.rejects(
        c.owner.query("DELETE FROM validation_diagnostic_audits"),
        { code: "P0001" },
      );
      await assert.rejects(
        c.api.query("DELETE FROM validation_diagnostic_audits"),
        { code: "42501" },
      );
      // A replacement browser needs a new review, not redemption of an old session's private payload.
      const entry = createEntryService(c.api, c.clock, c.delivery),
        staff = createStaffService(c.api, c.clock, c.delivery);
      const flow = await entry.begin(actor.code, {
        ip: "127.0.0.1",
        browserId: randomUUID(),
      });
      if (flow.audience !== "STAFF")
        throw new Error("Synthetic staff re-entry failed");
      const activated = await staff.activate(flow.proofCookie, randomUUID());
      await assert.rejects(
        service.outcome(actor.sessionCookie, run, key),
        denied("INVALID_SESSION"),
      );
      assert.equal(
        (await service.outcome(activated.sessionCookie, run, key)).status,
        "NOT_OBSERVED",
      );
      const command = { ...input(), requestKey: key };
      await assert.rejects(
        service.open(activated.sessionCookie, run, command),
        denied("ACCESS_UNAVAILABLE"),
      );
      await service.open(activated.sessionCookie, run, input());
    },
  );
  await t.test(
    "diagnostic access pages are stable, bounded, run-scoped metadata only",
    async () => {
      const actor = await c.person("SUPER_ADMIN");
      for (let i = 0; i < 42; i++) {
        await budgets();
        await service.open(actor.sessionCookie, run, {
          ...input(),
          reason: `Synthetic paged review ${i}`,
        });
      }
      const first = await service.history(actor.sessionCookie, run);
      assert.equal(first.items.length, 40);
      assert.ok(first.next_after);
      const second = await service.history(
        actor.sessionCookie,
        run,
        first.next_after!,
      );
      assert.equal(second.items.length, 5);
      assert.equal(
        new Set([...first.items, ...second.items].map((r) => r.id)).size,
        45,
      );
      assert.doesNotMatch(
        JSON.stringify(first),
        /stdout|stderr|compiler_output|session_id|credential|request_key|digest/,
      );
      await assert.rejects(
        service.history(actor.sessionCookie, c.pendingRun, first.next_after!),
        denied("CONTENT_UNAVAILABLE"),
      );
      await assert.rejects(
        service.history(actor.sessionCookie, run, randomUUID()),
        denied("CONTENT_UNAVAILABLE"),
      );
    },
  );
  const settings = {
      mode: "production" as const,
      origin: "https://ingenium.test",
      cookieKey: randomBytes(32),
      csrfKey: randomBytes(32),
    },
    policy = browserPolicy(settings),
    app = buildApp({
      database: { async check() {}, async close() {} },
      entry: {
        pool: c.api,
        clock: c.clock,
        delivery: c.delivery,
        browser: settings,
      },
    });
  await app.ready();
  try {
    await t.test(
      "private diagnostic HTTP uses exact bodies, Origin/CSRF, no-store and GET-only own-session receipt recovery",
      async () => {
        const actor = await c.person(),
          cookies = new Map<string, string>();
        async function send(
          url: string,
          body?: unknown,
          token?: string,
          origin = settings.origin,
          method?: "HEAD",
        ) {
          const response = await app.inject({
            method: method ?? (body === undefined ? "GET" : "POST"),
            url,
            headers: {
              origin,
              cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join(";"),
              ...(body === undefined
                ? {}
                : { "content-type": "application/json" }),
              ...(token ? { "x-csrf-token": token } : {}),
            },
            ...(body === undefined ? {} : { payload: JSON.stringify(body) }),
          });
          const lines = response.headers["set-cookie"];
          for (const line of typeof lines === "string"
            ? [lines]
            : (lines ?? [])) {
            const pair = line.split(";")[0]!,
              i = pair.indexOf("=");
            cookies.set(pair.slice(0, i), pair.slice(i + 1));
          }
          return response;
        }
        await send("/api/v1/bootstrap?audience=ANONYMOUS");
        cookies.set(policy.names.staff, actor.sessionCookie);
        const bootstrap = await send("/api/v1/bootstrap?audience=STAFF"),
          token = bootstrap.json().data.csrf_token;
        const url = `/api/v1/staff/content/validation-runs/${run}/diagnostics`,
          body = {
            request_key: randomUUID(),
            confirm_run_id: run,
            attempt_id: attempt.id,
            reason: "Synthetic HTTP review",
          };
        assert.equal((await send(url, body)).statusCode, 403);
        assert.equal(
          (await send(url, body, token, "https://untrusted.test")).statusCode,
          403,
        );
        assert.equal(
          (await send(url, { ...body, force_pass: true }, token)).statusCode,
          400,
        );
        const response = await send(url, body, token);
        assert.equal(response.statusCode, 200, response.body);
        assert.equal(response.headers["cache-control"], "no-store");
        assert.ok(Buffer.byteLength(response.body) < 262144);
        assert.deepEqual(
          (await send(`${url}/${body.request_key}`)).json().data.receipt,
          response.json().data,
        );
        assert.equal(
          (await send(url, undefined, undefined, settings.origin, "HEAD"))
            .statusCode,
          404,
        );
        const report = await createValidationRunService(
          c.api,
          c.clock,
          c.delivery,
        ).report(actor.sessionCookie, run);
        assert.ok(
          report.checks.every(
            (check) => check.dispatches.length === check.attempts,
          ),
        );
        assert.doesNotMatch(
          JSON.stringify(report),
          /stdout_b64|stderr_b64|compiler_output|supervisor_evidence/,
        );
        const org = await c.person("ORGANISER");
        cookies.set(policy.names.staff, org.sessionCookie);
        assert.equal(
          (await send(`${url}/${body.request_key}`)).statusCode,
          200,
        );
        cookies.set(policy.names.staff, actor.sessionCookie);
        const admin = await c.person("SUPER_ADMIN"),
          identity = (
            await c.owner.query("SELECT * FROM staff_identities WHERE id=$1", [
              actor.id,
            ])
          ).rows[0];
        await createStaffManagement(c.api, c.clock, c.delivery).command(
          admin.sessionCookie,
          {
            action: "UPDATE",
            targetId: actor.id,
            requestKey: randomUUID(),
            expectedRevision: identity.revision,
            ownCode: admin.code,
            reason: "Synthetic diagnostic access removal",
            displayName: identity.display_name,
            role: "ORGANISER",
            enabled: true,
          },
        );
        assert.equal(
          (await send(`${url}/${body.request_key}`)).statusCode,
          401,
        );
      },
    );
  } finally {
    await app.close();
  }
  if (
    !process.env.INGENIUM_TEST_SUITE ||
    process.env.INGENIUM_TEST_SUITE === "diagnostics-browser"
  )
    await t.test(
      "real browser diagnostic review recovers lost replies, hides stale private data, rejects revoked access and fits mobile",
      async () => {
        await budgets();
        await validationDiagnosticBrowserChecks({
          ...c,
          budgets,
          attempt: attempt.id,
        });
      },
    );
}
