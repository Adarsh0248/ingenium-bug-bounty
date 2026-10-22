import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import type { TestContext } from "node:test";
import { buildApp } from "../../src/app.js";
import { browserPolicy } from "../../src/access/browser-policy.js";
import { createStaffManagement } from "../../src/access/staff-management.js";
import { createStaffService } from "../../src/access/staff-service.js";
import { createEntryService } from "../../src/access/entry-service.js";
import { parseProof, sha256 } from "../../src/access/credentials.js";
import { AccessError } from "../../src/access/transaction.js";
import { createSubmissionReviewService } from "../../src/competition/submission-review.js";
import type { participantJudgingChecks } from "./participant-judging.checks.js";
import { submissionReviewBrowserChecks } from "./submission-review-browser.checks.js";

type Context = Parameters<typeof participantJudgingChecks>[1] & {
  newStaff(
    role?: string,
  ): Promise<{ id: string; code: string; sessionCookie: string }>;
};
export async function submissionReviewChecks(t: TestContext, c: Context) {
  const a = await c.newRound(),
    review = createSubmissionReviewService(c.api, c.clock, c.delivery);
  const query = async (sql: string, args: unknown[] = []) =>
    (await c.owner.query(sql, args)).rows;
  const source =
    "\uFEFF// immutable submitted program\r\n<script>window.privateReviewExecuted = true</script>\r\n";
  const maxSource = "//" + "x".repeat(131070);
  const parent = (
    await c.service.submit(a.aa, a.round, a.x, source, randomUUID())
  ).result.submission_id as string;
  const maximum = (
    await c.service.submit(a.ba, a.round, a.y, maxSource, randomUUID())
  ).result.submission_id as string;
  const pending = (
    await c.service.run(
      a.ab,
      a.round,
      a.x,
      "PRIVATE-PENDING-SAMPLE",
      randomUUID(),
    )
  ).result.run_id as string;
  c.answers.set(parent, "COMPILATION_ERROR");
  c.answers.set(maximum, "WRONG_ANSWER");
  const originalSubmit = c.driver.submit.bind(c.driver),
    originalObserve = c.driver.observe.bind(c.driver);
  function decorate(payload: { runId: string }, raw: unknown) {
    const value = raw as Record<string, unknown>;
    if (
      value.state !== "FINISHED" ||
      ![parent, maximum].includes(payload.runId)
    )
      return raw;
    return {
      ...value,
      ...(payload.runId === maximum
        ? { stdout: Buffer.alloc(1048576, 120) }
        : {}),
      stderr:
        payload.runId === maximum
          ? Buffer.alloc(65536, 115)
          : Buffer.from([
              0,
              255,
              ...Buffer.from(
                "<img src=x onerror=window.privateReviewExecuted=true> runtime detail",
              ),
            ]),
      compiler_output:
        payload.runId === maximum
          ? Buffer.alloc(65536, 99)
          : Buffer.from(
              "Private compiler diagnostic <script>not executable</script>",
            ),
      stderr_truncated: true,
      compiler_output_truncated: true,
    };
  }
  c.driver.submit = async (p, signal) =>
    decorate(p, await originalSubmit(p, signal));
  c.driver.observe = async (p, signal) =>
    decorate(p, await originalObserve(p, signal));
  async function complete(id: string) {
    const end = Date.now() + 20000;
    while (
      !(
        await query(
          `SELECT p.completed_at IS NOT NULL AND NOT EXISTS(SELECT 1 FROM participant_attempts a JOIN participant_jobs j ON j.id=a.job_id
      WHERE j.parent_id=p.id AND a.released_at IS NULL) AS done FROM participant_judging p WHERE p.id=$1`,
          [id],
        )
      )[0].done
    ) {
      assert.ok(Date.now() < end, "Synthetic review fixture did not settle");
      await c.judge.tick();
      await delay(20);
    }
  }
  let attempt = "",
    foreignAttempt = "";
  const input = (attemptId: string | null = null) => ({
    requestKey: randomUUID(),
    confirmParentId: parent,
    attemptId,
    reason: "Synthetic private incident review",
  });
  const count = async () =>
    (
      await query("SELECT count(*)::integer AS n FROM submission_review_audits")
    )[0].n;
  const snapshot = async () =>
    (
      await query(`SELECT jsonb_build_object(
    'wallet',(SELECT jsonb_agg(to_jsonb(w) ORDER BY id) FROM wallet_entries w),
    'awards',(SELECT jsonb_agg(to_jsonb(w) ORDER BY id) FROM bounty_awards w),
    'rounds',(SELECT jsonb_agg(to_jsonb(w) ORDER BY id) FROM rounds w),
    'attempts',(SELECT jsonb_agg(to_jsonb(w) ORDER BY id) FROM participant_attempts w),
    'sessions',(SELECT jsonb_agg(jsonb_build_array(id,last_activity_at,absolute_expires_at) ORDER BY id) FROM staff_sessions)) AS value`)
    )[0].value;
  try {
    await complete(parent);
    await complete(maximum);
    attempt = (
      await query(
        "SELECT id FROM participant_attempts WHERE job_id IN (SELECT id FROM participant_jobs WHERE parent_id=$1) AND resolved_at IS NOT NULL ORDER BY prepared_at,id LIMIT 1",
        [parent],
      )
    )[0].id;
    foreignAttempt = (
      await query(
        "SELECT id FROM participant_attempts WHERE job_id IN (SELECT id FROM participant_jobs WHERE parent_id=$1) AND resolved_at IS NOT NULL LIMIT 1",
        [maximum],
      )
    )[0].id;
    await t.test(
      "private review returns exact admitted source and one sealed diagnostic without provider or hidden-case metadata",
      async () => {
        await c.budgets();
        const before = await snapshot();
        const value = await review.open(
          c.staff.sessionCookie,
          a.round,
          parent,
          input(attempt),
        );
        assert.equal(
          Buffer.from(value.source_b64, "base64").toString("utf8"),
          source,
        );
        assert.equal(
          value.source_sha256,
          sha256(Buffer.from(source)).toString("hex"),
        );
        assert.equal(value.diagnostic?.attempt_id, attempt);
        assert.equal(value.diagnostic?.result, "COMPILATION_ERROR");
        assert.match(
          Buffer.from(
            value.diagnostic!.compiler_output_b64,
            "base64",
          ).toString(),
          /Private compiler diagnostic/,
        );
        assert.equal(value.diagnostic?.stderr_truncated, true);
        assert.doesNotMatch(
          JSON.stringify(value),
          /host_epoch|runtime_digest|worker_id|provider|payload_digest|stdin|expected_output|case_id|supervisor_evidence|proof_digest/,
        );
        assert.deepEqual(await snapshot(), before);
        const publicDetail = await c.service.judging(a.aa, a.round, parent);
        assert.deepEqual(publicDetail.samples, []);
        assert.doesNotMatch(
          JSON.stringify(
            await c.service.judgeDetail(
              c.organiser.sessionCookie,
              a.round,
              parent,
            ),
          ),
          /PRIVATE|source|stderr|compiler_output/,
        );
      },
    );
    await t.test(
      "concurrent same-key review and original-key recovery create one immutable audit and never expand a source-only grant",
      async () => {
        await c.budgets();
        const intent = input(),
          before = await count();
        const values = await Promise.all([
          review.open(c.staff.sessionCookie, a.round, parent, intent),
          review.open(c.staff.sessionCookie, a.round, parent, intent),
        ]);
        assert.deepEqual(values[0], values[1]);
        assert.equal(values[0].diagnostic, null);
        assert.equal(await count(), before + 1);
        const recovered = await review.outcome(
          c.staff.sessionCookie,
          a.round,
          parent,
          intent.requestKey,
        );
        assert.equal(recovered.status, "OBSERVED");
        assert.deepEqual(recovered.receipt, values[0]);
        assert.equal(await count(), before + 1);
        for (const patch of [
          { reason: "Changed purpose" },
          { attemptId: attempt },
        ])
          await assert.rejects(
            review.open(c.staff.sessionCookie, a.round, parent, {
              ...intent,
              ...patch,
            }),
            (e) => e instanceof AccessError && e.code === "INTENT_CONFLICT",
          );
        const other = await c.newStaff();
        await c.budgets();
        assert.equal(
          (
            await review.outcome(
              other.sessionCookie,
              a.round,
              parent,
              intent.requestKey,
            )
          ).status,
          "NOT_OBSERVED",
        );
        const audit = (
          await query("SELECT * FROM submission_review_audits WHERE id=$1", [
            values[0].audit_id,
          ])
        )[0];
        assert.equal(audit.reason, intent.reason);
        assert.equal(
          audit.source_digest.toString("hex"),
          values[0].source_sha256,
        );
        assert.doesNotMatch(
          JSON.stringify(audit),
          /immutable submitted|compiler diagnostic|access_code|ciphertext/,
        );
        await assert.rejects(
          c.owner.query(
            "UPDATE submission_review_audits SET reason='overwrite' WHERE id=$1",
            [values[0].audit_id],
          ),
          { code: "P0001" },
        );
        await assert.rejects(
          c.owner.query("DELETE FROM submission_review_audits WHERE id=$1", [
            values[0].audit_id,
          ]),
          { code: "P0001" },
        );
      },
    );
    await t.test(
      "a replacement staff browser needs a new reviewed purpose rather than replaying an older session's private grant",
      async () => {
        await c.budgets();
        const actor = await c.newStaff("OWNER"),
          intent = input(attempt);
        const original = await review.open(
          actor.sessionCookie,
          a.round,
          parent,
          intent,
        );
        const flow = await createEntryService(c.api, c.clock, c.delivery).begin(
          actor.code,
          { ip: "127.0.0.1", browserId: randomUUID() },
        );
        assert.equal(flow.audience, "STAFF");
        if (flow.audience !== "STAFF")
          throw new Error("Synthetic replacement staff routing failed");
        const next = await createStaffService(
          c.api,
          c.clock,
          c.delivery,
        ).activate(flow.proofCookie, randomUUID());
        await assert.rejects(
          review.outcome(
            actor.sessionCookie,
            a.round,
            parent,
            original.request_key,
          ),
        );
        assert.equal(
          (
            await review.outcome(
              next.sessionCookie,
              a.round,
              parent,
              original.request_key,
            )
          ).status,
          "NOT_OBSERVED",
        );
        await assert.rejects(
          review.open(next.sessionCookie, a.round, parent, intent),
        );
        const fresh = await review.open(
          next.sessionCookie,
          a.round,
          parent,
          input(attempt),
        );
        assert.notEqual(fresh.audit_id, original.audit_id);
        assert.equal(fresh.source_sha256, original.source_sha256);
      },
    );
    await t.test(
      "Organisers, participants, foreign parents/attempts and unresolved dispatches cannot obtain private review",
      async () => {
        await c.budgets();
        const before = await count();
        for (const cookie of [c.organiser.sessionCookie, a.aa]) {
          await assert.rejects(
            review.open(cookie, a.round, parent, input(attempt)),
          );
          await assert.rejects(review.history(cookie, a.round, parent));
          await assert.rejects(
            review.outcome(cookie, a.round, parent, randomUUID()),
          );
        }
        await assert.rejects(
          review.open(
            c.staff.sessionCookie,
            a.round,
            parent,
            input(foreignAttempt),
          ),
        );
        await assert.rejects(
          review.open(
            c.staff.sessionCookie,
            a.round,
            parent,
            input(randomUUID()),
          ),
        );
        await assert.rejects(
          review.open(c.staff.sessionCookie, randomUUID(), parent, input()),
        );
        await assert.rejects(
          review.open(c.staff.sessionCookie, a.round, randomUUID(), input()),
        );
        const unresolved = (
          await query(
            "SELECT a.id FROM participant_attempts a JOIN participant_jobs j ON j.id=a.job_id WHERE j.parent_id=$1 AND a.resolved_at IS NULL LIMIT 1",
            [pending],
          )
        )[0];
        if (unresolved)
          await assert.rejects(
            review.open(c.staff.sessionCookie, a.round, pending, {
              ...input(unresolved.id),
              confirmParentId: pending,
            }),
          );
        assert.equal(await count(), before);
        const sourceOnly = await review.open(
          c.staff.sessionCookie,
          a.round,
          pending,
          { ...input(), confirmParentId: pending },
        );
        assert.equal(sourceOnly.diagnostic, null);
      },
    );
    await t.test(
      "database review binding refuses foreign source/digests and forged Organiser authority",
      async () => {
        await c.budgets();
        const value = await review.open(
          c.staff.sessionCookie,
          a.round,
          parent,
          input(attempt),
        );
        const copy = async (actorSession: string, wrongDigest: boolean) =>
          c.api.query(
            `INSERT INTO submission_review_audits(id,parent_id,round_id,actor_id,session_id,credential_id,credential_version,request_key,fingerprint,reason,source_digest,attempt_id,result_digest,recorded_at)
        SELECT $1,a.parent_id,a.round_id,s.staff_id,s.id,s.credential_id,s.credential_version,$2,a.fingerprint,a.reason,
        CASE WHEN $4 THEN decode(repeat('00',32),'hex') ELSE a.source_digest END,a.attempt_id,a.result_digest,date_trunc('milliseconds',clock_timestamp())
        FROM submission_review_audits a CROSS JOIN staff_sessions s WHERE a.id=$3 AND s.id=$5`,
            [
              randomUUID(),
              randomUUID(),
              value.audit_id,
              wrongDigest,
              actorSession,
            ],
          );
        await assert.rejects(
          copy(parseProof(c.organiser.sessionCookie)!.id, false),
          { code: "P0001" },
        );
        await assert.rejects(
          copy(parseProof(c.staff.sessionCookie)!.id, true),
          { code: "P0001" },
        );
        const blockedClock = {
          ...c.clock,
          assertHealthy() {
            throw new AccessError("CLOCK_UNTRUSTED");
          },
        };
        await assert.rejects(
          createSubmissionReviewService(
            c.api,
            blockedClock,
            c.delivery,
          ).outcome(c.staff.sessionCookie, a.round, parent, value.request_key),
        );
      },
    );
    await t.test(
      "private access history is bounded, stable and contains metadata only; a foreign cursor is refused",
      async () => {
        for (let i = 0; i < 42; i++) {
          if (i % 8 === 0) await c.budgets();
          await review.open(c.staff.sessionCookie, a.round, parent, {
            ...input(),
            reason: `Synthetic paged review ${i}`,
          });
        }
        await c.budgets();
        const page = await review.history(
          c.staff.sessionCookie,
          a.round,
          parent,
        );
        assert.equal(page.items.length, 40);
        assert.ok(page.next_after);
        const next = await review.history(
          c.staff.sessionCookie,
          a.round,
          parent,
          page.next_after!,
        );
        assert.ok(next.items.length > 0);
        assert.equal(
          new Set([...page.items, ...next.items].map((i) => i.id)).size,
          page.items.length + next.items.length,
        );
        assert.doesNotMatch(
          JSON.stringify(page),
          /source_b64|source_sha256|stderr|compiler_output|credential|session_id|request_key/,
        );
        const other = await review.open(
          c.staff.sessionCookie,
          a.round,
          maximum,
          { ...input(), confirmParentId: maximum },
        );
        await assert.rejects(
          review.history(
            c.staff.sessionCookie,
            a.round,
            parent,
            other.audit_id,
          ),
        );
      },
    );
    await t.test(
      "real HTTP review enforces CSRF/origin/strict input, safely returns maximum bounded bytes and disables HEAD",
      async () => {
        const settings = {
            mode: "production" as const,
            origin: "https://ingenium.test",
            cookieKey: randomBytes(32),
            csrfKey: randomBytes(32),
          },
          policy = browserPolicy(settings);
        const app = await buildApp({
          database: { async check() {}, async close() {} },
          entry: {
            pool: c.api,
            clock: c.clock,
            delivery: c.delivery,
            browser: settings,
            competition: c.deps,
          },
        });
        const cookies = new Map<string, string>();
        async function send(
          url: string,
          body?: unknown,
          token?: string,
          origin = settings.origin,
          method = body === undefined ? "GET" : "POST",
        ) {
          const response = await app.inject({
            method: method as "GET" | "POST" | "HEAD",
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
              at = pair.indexOf("=");
            cookies.set(pair.slice(0, at), pair.slice(at + 1));
          }
          return response;
        }
        try {
          await c.budgets();
          await send("/api/v1/bootstrap?audience=ANONYMOUS");
          cookies.set(policy.names.staff, c.staff.sessionCookie);
          const boot = await send("/api/v1/bootstrap?audience=STAFF");
          assert.equal(boot.statusCode, 200);
          const token = boot.json().data.csrf_token;
          const path = `/api/v1/staff/competition/rounds/${a.round}/judging/${maximum}/reviews`,
            body = {
              request_key: randomUUID(),
              confirm_parent_id: maximum,
              attempt_id: foreignAttempt,
              reason: "Synthetic maximum private response",
            };
          assert.equal((await send(path, body)).statusCode, 403);
          assert.equal(
            (await send(path, body, token, "https://foreign.test")).statusCode,
            403,
          );
          assert.equal(
            (await send(path, { ...body, draft_id: randomUUID() }, token))
              .statusCode,
            400,
          );
          const response = await send(path, body, token);
          assert.equal(response.statusCode, 200);
          assert.match(String(response.headers["cache-control"]), /no-store/);
          assert.ok(Buffer.byteLength(response.body) < 1048576);
          const value = response.json().data;
          assert.equal(Buffer.from(value.source_b64, "base64").length, 131072);
          assert.equal(
            Buffer.from(value.diagnostic.stdout_b64, "base64").length,
            16384,
          );
          assert.equal(
            Buffer.from(value.diagnostic.stderr_b64, "base64").length,
            65536,
          );
          assert.equal(
            Buffer.from(value.diagnostic.compiler_output_b64, "base64").length,
            65536,
          );
          assert.equal(value.diagnostic.stdout_truncated, true);
          assert.equal(
            (await send(`${path}/${body.request_key}`)).json().data.receipt
              .audit_id,
            value.audit_id,
          );
          assert.equal(
            (
              await send(
                `${path}/${body.request_key}`,
                undefined,
                undefined,
                settings.origin,
                "HEAD",
              )
            ).statusCode,
            404,
          );
        } finally {
          await app.close();
        }
      },
    );
    if (process.env.INGENIUM_TEST_SUITE === "review-browser")
      await t.test(
        "browser private review preserves once-only audit, redaction and responsive read-only presentation",
        async () => {
          await submissionReviewBrowserChecks(c, {
            round: a.round,
            parent,
            attempt,
            source,
          });
        },
      );
    await t.test(
      "role changes and revocation fence old reviews and history without altering submitted evidence",
      async () => {
        await c.budgets();
        const admin = await c.newStaff("SUPER_ADMIN"),
          target = await c.newStaff("OWNER");
        const value = await review.open(
          target.sessionCookie,
          a.round,
          parent,
          input(attempt),
        );
        await c.budgets();
        const identity = (
          await query(
            "SELECT i.* FROM staff_identities i JOIN staff_sessions s ON s.staff_id=i.id WHERE s.id=$1",
            [parseProof(target.sessionCookie)!.id],
          )
        )[0];
        await createStaffManagement(c.api, c.clock, c.delivery).command(
          admin.sessionCookie,
          {
            action: "UPDATE",
            targetId: identity.id,
            requestKey: randomUUID(),
            expectedRevision: identity.revision,
            ownCode: admin.code,
            reason: "Synthetic private-review revocation",
            displayName: identity.display_name,
            role: "ORGANISER",
            enabled: true,
          },
        );
        await assert.rejects(
          review.outcome(
            target.sessionCookie,
            a.round,
            parent,
            value.request_key,
          ),
        );
        await assert.rejects(
          review.history(target.sessionCookie, a.round, parent),
        );
        assert.equal(
          (
            await query(
              "SELECT encode(sha256(source),'hex') AS digest FROM participant_judging WHERE id=$1",
              [parent],
            )
          )[0].digest,
          value.source_sha256,
        );
      },
    );
    await t.test(
      "post-final review remains read-only and cannot reopen judging or change final standings",
      async () => {
        c.answers.set(pending, "PASSED");
        await complete(pending);
        for (const action of ["CLOSE", "FINALISE"] as const) {
          await c.budgets();
          const row = (
            await query("SELECT revision FROM rounds WHERE id=$1", [a.round])
          )[0];
          const closed = await c.service.command(c.staff.sessionCookie, {
            roundId: a.round,
            action,
            expectedRevision: row.revision,
            requestKey: randomUUID(),
            reason: "Synthetic closed-round review",
            payload: {},
            ownCode: c.staff.code,
          });
          assert.equal(closed.result.status, "APPLIED");
        }
        const before = await query(
          "SELECT * FROM round_results WHERE round_id=$1",
          [a.round],
        );
        await c.budgets();
        const value = await review.open(
          c.staff.sessionCookie,
          a.round,
          parent,
          input(attempt),
        );
        assert.equal(value.parent_id, parent);
        assert.deepEqual(
          await query("SELECT * FROM round_results WHERE round_id=$1", [
            a.round,
          ]),
          before,
        );
        assert.equal(
          (await query("SELECT state FROM rounds WHERE id=$1", [a.round]))[0]
            .state,
          "CLOSED",
        );
      },
    );
  } finally {
    c.driver.submit = originalSubmit;
    c.driver.observe = originalObserve;
    c.answers.set(pending, "PASSED");
    await complete(pending);
  }
}
