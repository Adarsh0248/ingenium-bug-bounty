import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import type { TestContext } from "node:test";
import { AUDIT_FAMILIES } from "../../src/access/audit-policy.js";
import { createStaffAuditService } from "../../src/access/audit-service.js";
import { createContentService } from "../../src/content/service.js";
import { createStaffManagement } from "../../src/access/staff-management.js";
import { createTeamManagement } from "../../src/access/team-management.js";
import { createValidationRunService } from "../../src/content/validation-runs.js";
import { createValidationDiagnosticService } from "../../src/content/validation-diagnostics.js";
import { AccessError } from "../../src/access/transaction.js";
import { parseProof } from "../../src/access/credentials.js";
import { buildApp } from "../../src/app.js";
import { browserPolicy } from "../../src/access/browser-policy.js";
import type { participantJudgingChecks } from "./participant-judging.checks.js";
import { staffAuditBrowserChecks } from "./staff-audit-browser.checks.js";

export async function staffAuditChecks(
  t: TestContext,
  c: Parameters<typeof participantJudgingChecks>[1] & {
    newStaff(
      role?: string,
    ): Promise<{ id: string; code: string; sessionCookie: string }>;
  },
) {
  const service = createStaffAuditService(c.api, c.clock, c.delivery),
    query = async (sql: string, p: unknown[] = []) =>
      (await c.owner.query(sql, p)).rows,
    actor = await c.newStaff("OWNER"),
    admin = await c.newStaff("SUPER_ADMIN"),
    first = await c.newRound(),
    arena = (
      await query("SELECT arena_instance_id id FROM rounds WHERE id=$1", [
        first.round,
      ])
    )[0].id as string,
    denied = (code: string) => (e: unknown) =>
      e instanceof AccessError && e.code === code;
  const version = (
      await query("SELECT version_id FROM validation_snapshots LIMIT 1")
    )[0].version_id,
    content = createContentService(c.api, c.clock, c.delivery);
  await c.budgets();
  const language = (
    await query(
      "SELECT language FROM language_variants WHERE version_id=$1 LIMIT 1",
      [version],
    )
  )[0].language;
  await content.privateRead(actor.sessionCookie, version, "VARIANTS", language);
  const read = (
    await query(
      "SELECT * FROM content_read_audits WHERE actor_id=$1 ORDER BY recorded_at DESC LIMIT 1",
      [actor.id],
    )
  )[0];
  // Equal timestamps deliberately exercise the UUID part of the immutable cursor.
  await c.owner.query(
    `INSERT INTO content_read_audits(id,version_id,actor_id,session_id,section,variant_id,case_id,recorded_at)
    SELECT gen_random_uuid(),version_id,actor_id,session_id,section,variant_id,case_id,date_trunc('milliseconds',statement_timestamp()) FROM content_read_audits CROSS JOIN generate_series(1,44) WHERE id=$1`,
    [read.id],
  );
  const managed = await c.newStaff("ORGANISER");
  const management = await createStaffManagement(
    c.api,
    c.clock,
    c.delivery,
  ).command(admin.sessionCookie, {
    action: "ROTATE",
    targetId: managed.id,
    requestKey: randomUUID(),
    expectedRevision: (
      await query("SELECT revision FROM staff_identities WHERE id=$1", [
        managed.id,
      ])
    )[0].revision,
    ownCode: admin.code,
    reason: "Synthetic audit-only staff rotation",
    displayName: null,
    role: null,
    enabled: null,
  });
  assert.ok(management.issued_code);
  await c.budgets();
  const issued = await createTeamManagement(c.api, c.clock, c.delivery).command(
    actor.sessionCookie,
    {
      action: "CREATE",
      targetId: null,
      requestKey: randomUUID(),
      expectedRevision: (
        await query("SELECT revision FROM security_control WHERE id=1")
      )[0].revision,
      teamName: "Synthetic audited team",
      memberOne: "Dummy one",
      memberTwo: "Dummy two",
      reason:
        "<script>window.auditExecuted=true</script>\r\n" + "x".repeat(850),
      ownCode: actor.code,
    },
  );
  assert.ok(issued.issued_code);
  const run = (
      await query(
        "SELECT id FROM validation_runs WHERE status='PASSED' LIMIT 1",
      )
    )[0].id,
    attempt = (
      await query(
        "SELECT a.id FROM authoring_attempts a JOIN authoring_checks c ON c.id=a.check_id WHERE c.run_id=$1 LIMIT 1",
        [run],
      )
    )[0].id;
  await createValidationRunService(c.api, c.clock, c.delivery).report(
    actor.sessionCookie,
    run,
  );
  await createValidationDiagnosticService(c.api, c.clock, c.delivery).open(
    actor.sessionCookie,
    run,
    {
      requestKey: randomUUID(),
      confirmRunId: run,
      attemptId: attempt,
      reason: "Synthetic private diagnostic audit metadata",
    },
  );
  await t.test(
    "all fixed audit projections return bounded metadata while normal staff cannot read account-management records",
    async () => {
      for (const key of Object.keys(AUDIT_FAMILIES)) {
        await c.budgets();
        const value = await service.list(admin.sessionCookie, key);
        assert.equal(value.family, key);
        assert.ok(value.items.length <= 40);
        for (const item of value.items)
          assert.deepEqual(
            Object.keys(item).sort(),
            [
              "id",
              "recorded_at",
              "actor_id",
              "actor_name",
              "action",
              "outcome",
              "denial_reason",
              "reason",
              "target_id",
              "arena_id",
              "round_id",
            ].sort(),
          );
        assert.doesNotMatch(
          JSON.stringify(value),
          /issued_code|request_key|credential_id|verifier|fingerprint|ciphertext|source_b64|compiler_output|stdout|expected_output|reference_code|before_state|after_state/,
        );
        assert.ok(!JSON.stringify(value).includes(management.issued_code!));
        assert.ok(!JSON.stringify(value).includes(issued.issued_code!));
      }
      await assert.rejects(
        service.list(actor.sessionCookie, "STAFF"),
        denied("ACCESS_UNAVAILABLE"),
      );
      assert.ok(
        (await service.list(admin.sessionCookie, "STAFF")).items.some(
          (item) => item.id === management.outcome.outcome_id,
        ),
      );
    },
  );
  await t.test(
    "audit pages use equal-time UUID ordering, exclude later inserts and reject cross-category cursors",
    async () => {
      await c.budgets();
      const one = await service.list(actor.sessionCookie, "CONTENT_READS");
      assert.equal(one.items.length, 40);
      assert.ok(one.next_after);
      await content.privateRead(
        actor.sessionCookie,
        version,
        "VARIANTS",
        language,
      );
      const two = await service.list(
        actor.sessionCookie,
        "CONTENT_READS",
        undefined,
        one.next_after!,
      );
      assert.equal(two.items.length, 5);
      assert.equal(
        new Set([...one.items, ...two.items].map((r) => r.id)).size,
        45,
      );
      const combined = [...one.items, ...two.items];
      for (let i = 1; i < combined.length; i++)
        assert.ok(
          combined[i - 1]!.recorded_at > combined[i]!.recorded_at ||
            (combined[i - 1]!.recorded_at === combined[i]!.recorded_at &&
              combined[i - 1]!.id > combined[i]!.id),
        );
      await assert.rejects(
        service.list(actor.sessionCookie, "ROUND", arena, one.next_after!),
        denied("INVALID_CONTEXT"),
      );
      await assert.rejects(
        service.list(
          actor.sessionCookie,
          "CONTENT_READS",
          undefined,
          randomUUID(),
        ),
        denied("INVALID_CONTEXT"),
      );
    },
  );
  let second: Awaited<ReturnType<typeof c.newRound>>;
  await t.test(
    "selected historical arena scope cannot inherit another instance's cursor or participant command receipts",
    async () => {
      await c.budgets();
      await c.service.buyHint(first.aa, first.round, first.x, 1, randomUUID());
      const before = await service.list(actor.sessionCookie, "ROUND", arena);
      assert.ok(before.items.length);
      assert.ok(
        before.items.every(
          (item) => item.arena_id === arena && item.action !== "HINT",
        ),
      );
      second = await c.newRound();
      const next = (
        await query("SELECT arena_instance_id id FROM rounds WHERE id=$1", [
          second.round,
        ])
      )[0].id;
      const old = await service.list(actor.sessionCookie, "ROUND", arena),
        fresh = await service.list(actor.sessionCookie, "ROUND", next);
      assert.ok(old.items.every((item) => item.arena_id === arena));
      assert.ok(fresh.items.every((item) => item.arena_id === next));
      await assert.rejects(
        service.list(actor.sessionCookie, "ROUND", next, old.items[0]!.id),
        denied("INVALID_CONTEXT"),
      );
      await assert.rejects(
        service.list(actor.sessionCookie, "ROUND", randomUUID()),
        denied("ACCESS_UNAVAILABLE"),
      );
      await assert.rejects(
        service.list(actor.sessionCookie, "CONTENT", next),
        denied("INVALID_CONTEXT"),
      );
      assert.ok(
        (await service.list(actor.sessionCookie, "ARENA", arena)).items.every(
          (item) => item.arena_id === arena,
        ),
      );
    },
  );
  await t.test(
    "audit reads do not renew staff expiry, mutate outcomes, affect clocks, release work or change economy",
    async () => {
      await c.budgets();
      const state = async () =>
        await query(`SELECT (SELECT jsonb_agg(to_jsonb(r) ORDER BY id) FROM rounds r) AS rounds,
      (SELECT jsonb_agg(to_jsonb(r) ORDER BY id) FROM competition_outcomes r) AS outcomes,(SELECT jsonb_agg(to_jsonb(r) ORDER BY id) FROM wallet_entries r) AS wallets,
      (SELECT jsonb_agg(to_jsonb(r) ORDER BY id) FROM execution_capacity_slots r) AS slots,(SELECT jsonb_agg(to_jsonb(r) ORDER BY id) FROM staff_sessions r) AS sessions`);
      const before = await state();
      await service.list(actor.sessionCookie, "ROUND", arena);
      await service.list(actor.sessionCookie, "CONTENT_READS");
      assert.deepEqual(await state(), before);
      for (const cookie of [c.organiser.sessionCookie, first.aa, "invalid"])
        await assert.rejects(service.list(cookie, "CONTENT"));
      const failed = {
        ...c.clock,
        assertHealthy() {
          throw new AccessError("CLOCK_UNTRUSTED");
        },
      };
      await assert.rejects(
        createStaffAuditService(c.api, failed, c.delivery).list(
          actor.sessionCookie,
          "ROUND",
        ),
        denied("CLOCK_UNTRUSTED"),
      );
      const session = (
        await query("SELECT * FROM staff_sessions WHERE id=$1", [
          parseProof(actor.sessionCookie)!.id,
        ])
      )[0];
      assert.ok(session.last_activity_at);
      const indexes = await query(
        "SELECT indexname FROM pg_indexes WHERE indexname LIKE 'audit_nav_%'",
      );
      assert.equal(indexes.length, 17);
      const client = await c.owner.connect();
      try {
        await client.query("BEGIN; SET LOCAL enable_seqscan=off");
        const plan = await client.query(
          "EXPLAIN (FORMAT JSON) SELECT id,recorded_at FROM content_read_audits ORDER BY recorded_at DESC,id DESC LIMIT 41",
        );
        assert.match(JSON.stringify(plan.rows), /audit_nav_content_read/);
      } finally {
        await client.query("ROLLBACK");
        client.release();
      }
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
        competition: c.deps,
      },
    });
  await app.ready();
  try {
    await t.test(
      "audit HTTP is strict, authenticated, source-free, no-store and HEAD-disabled",
      async () => {
        const url = "/api/v1/staff/audit?family=TEAMS";
        assert.equal(
          (await app.inject({ method: "GET", url })).statusCode,
          401,
        );
        const headers = {
          cookie: `${policy.names.staff}=${actor.sessionCookie}`,
        };
        const response = await app.inject({ method: "GET", url, headers });
        assert.equal(response.statusCode, 200, response.body);
        assert.equal(response.headers["cache-control"], "no-store");
        assert.ok(
          response
            .json()
            .data.items.some(
              (item: { id: string }) => item.id === issued.outcome.outcome_id,
            ),
        );
        assert.ok(Buffer.byteLength(response.body) < 262144);
        for (const query of [
          "family=unknown",
          "family=toString",
          "family=ROUND&after=invalid",
          "family=CONTENT&arena_id=" + arena,
          "family=ROUND&include_source=true",
          "family=ROUND&family=CONTENT",
        ])
          assert.equal(
            (
              await app.inject({
                method: "GET",
                url: `/api/v1/staff/audit?${query}`,
                headers,
              })
            ).statusCode,
            400,
          );
        assert.equal(
          (await app.inject({ method: "HEAD", url, headers })).statusCode,
          404,
        );
        assert.equal(
          (
            await app.inject({
              method: "GET",
              url: "/api/v1/staff/audit?family=STAFF",
              headers,
            })
          ).statusCode,
          403,
        );
        assert.equal(
          (
            await app.inject({
              method: "GET",
              url,
              headers: {
                cookie: `${policy.names.staff}=${c.organiser.sessionCookie}`,
              },
            })
          ).statusCode,
          403,
        );
      },
    );
  } finally {
    await app.close();
  }
  if (
    !process.env.INGENIUM_TEST_SUITE ||
    process.env.INGENIUM_TEST_SUITE === "audit-browser"
  )
    await t.test(
      "real audit browser supports filtering, paging, stale-response refusal, safe text, historical scope and revocation",
      async () => {
        await staffAuditBrowserChecks(c, {
          arena,
          teamOutcome: issued.outcome.outcome_id,
        });
      },
    );
  await t.test(
    "downgrading an audit reader revokes its old authority without deleting source history",
    async () => {
      const identity = (
        await query("SELECT * FROM staff_identities WHERE id=$1", [actor.id])
      )[0];
      await c.budgets();
      await createStaffManagement(c.api, c.clock, c.delivery).command(
        admin.sessionCookie,
        {
          action: "UPDATE",
          targetId: actor.id,
          requestKey: randomUUID(),
          expectedRevision: identity.revision,
          ownCode: admin.code,
          displayName: identity.display_name,
          role: "ORGANISER",
          enabled: true,
          reason: "Synthetic audit authority removal",
        },
      );
      await assert.rejects(
        service.list(actor.sessionCookie, "ROUND"),
        denied("INVALID_SESSION"),
      );
      assert.equal(
        (
          await query(
            "SELECT count(*)::int n FROM content_read_audits WHERE actor_id=$1",
            [actor.id],
          )
        )[0].n,
        46,
      );
    },
  );
}
