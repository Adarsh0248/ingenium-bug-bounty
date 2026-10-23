import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { TestContext } from "node:test";
import type { participantJudgingChecks } from "./participant-judging.checks.js";
import { createEntryService } from "../../src/access/entry-service.js";
import { createReplacementService } from "../../src/access/replacement-service.js";
import { createStaffService } from "../../src/access/staff-service.js";
import {
  AccessError,
  accessTransaction,
} from "../../src/access/transaction.js";
import { createWorkbenchService } from "../../src/workbench/service.js";
import { createClockMonitor } from "../../src/clock/monitor.js";
import { createWorkerClock } from "../../src/clock/worker-consumer.js";
import { parseProof } from "../../src/access/credentials.js";
import type { createValidationWorker } from "../../src/content/validation-worker.js";
import { randomBytes } from "node:crypto";
import { buildApp } from "../../src/app.js";
import {
  quarantineRestoredDatabase,
  restoreStatus,
  inspectRestoredDatabase,
} from "../../src/maintenance/restore.js";
import { readOperations } from "../../src/maintenance/operations.js";

export async function restoreChecks(
  t: TestContext,
  c: Parameters<typeof participantJudgingChecks>[1] & {
    teams: { id: string; code: string; members: string[] }[];
    validationWorker: ReturnType<typeof createValidationWorker>;
  },
) {
  const query = async (sql: string, args: unknown[] = []) =>
    (await c.owner.query(sql, args)).rows;
  const entry = createEntryService(c.api, c.clock, c.delivery),
    staff = createStaffService(c.api, c.clock, c.delivery),
    replacement = createReplacementService(c.api, c.clock, c.delivery),
    workbench = createWorkbenchService(c.api, c.clock),
    a = await c.newRound();
  const intent = {
    requestKey: randomUUID(),
    backupRef: "synthetic-backup/exact-target-lsn",
    operator: "Synthetic recovery operator",
    osUser: "fixture",
    reason: "Isolated synthetic restore quarantine",
  };
  await c.budgets();
  await workbench.save(a.ab, {
    roundId: a.round,
    bountyId: a.y,
    requestKey: randomUUID(),
    baseRevision: "0",
    source: "// Synthetic retained editor draft\n",
  });
  const won = (
    await c.service.submit(
      a.aa,
      a.round,
      a.x,
      "// Synthetic award source\n",
      randomUUID(),
    )
  ).result.submission_id as string;
  c.answers.set(won, "PASSED");
  await c.judge.claim();
  for (
    let n = 0;
    n < 150 &&
    !(
      await query("SELECT completed_at FROM participant_judging WHERE id=$1", [
        won,
      ])
    )[0].completed_at;
    n++
  )
    await c.judge.tick();
  assert.ok(
    (
      await query("SELECT completed_at FROM participant_judging WHERE id=$1", [
        won,
      ])
    )[0].completed_at,
  );
  await c.budgets();
  await c.service.buyHint(a.ab, a.round, a.y, 1, randomUUID());
  const held = (
    await c.service.submit(
      a.ab,
      a.round,
      a.y,
      "// Synthetic held attempt\n",
      randomUUID(),
    )
  ).result.submission_id as string;
  c.answers.set(held, "PASSED");
  c.held.add(held);
  for (
    let n = 0;
    n < 20 &&
    !(
      await query(
        "SELECT 1 FROM execution_capacity_slots WHERE participant_attempt_id IS NOT NULL",
      )
    ).length;
    n++
  )
    await c.judge.tick();
  assert.ok(
    (
      await query(
        "SELECT 1 FROM execution_capacity_slots WHERE participant_attempt_id IS NOT NULL",
      )
    ).length,
  );
  async function handoff(team: number, member: number) {
    await c.budgets();
    const flow = await entry.begin(c.teams[team]!.code, {
      ip: "127.0.0.1",
      browserId: randomUUID(),
    });
    return replacement.request(flow.proofCookie, {
      memberId: c.teams[team]!.members[member]!,
      requestKey: randomUUID(),
    });
  }
  const pending = await handoff(0, 1),
    approved = await handoff(1, 0);
  assert.equal(pending.status, "REQUESTED");
  assert.equal(approved.status, "REQUESTED");
  if (pending.status !== "REQUESTED" || approved.status !== "REQUESTED")
    throw new Error("Fixture handoff unavailable");
  const revision = (
    await query(
      "SELECT expected_slot_revision FROM replacement_requests WHERE flow_id=$1",
      [approved.request.request_id],
    )
  )[0].expected_slot_revision;
  await c.budgets();
  assert.equal(
    (
      await replacement.decide(c.staff.sessionCookie, {
        flowId: approved.request.request_id,
        requestKey: randomUUID(),
        action: "APPROVE",
        expectedRevision: revision,
        reason: "Synthetic unconsumed approval",
      })
    ).outcome,
    "APPLIED",
  );
  await c.budgets();
  const staffFlow = await entry.begin(c.staff.code, {
    ip: "127.0.0.1",
    browserId: randomUUID(),
  });
  const source = {
    bootId: randomUUID(),
    resolutionNs: 0n,
    nowNs: () => 100000000000n,
    async sample() {
      throw new Error("No probe needed by this stopped-runtime test");
    },
  };
  const monitor = createClockMonitor(c.api, source);
  const tables = [
    "teams",
    "team_members",
    "access_credentials",
    "member_rounds",
    "rounds",
    "arena_instances",
    "arena_control",
    "round_results",
    "qualification_decisions",
    "bounties",
    "bounty_awards",
    "hint_purchases",
    "wallet_entries",
    "competition_submissions",
    "competition_outcomes",
    "competition_assessments",
    "participant_judging",
    "participant_jobs",
    "participant_attempts",
    "participant_retry_permissions",
    "execution_capacity_slots",
    "judge_control",
    "validation_runs",
    "authoring_attempts",
    "code_drafts",
    "entry_outcomes",
    "replacement_decisions",
  ];
  async function fingerprints(names = tables) {
    const rows: Record<string, string> = {};
    for (const table of names)
      rows[table] = (
        await query(
          `SELECT encode(sha256(convert_to(COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb)::text,'UTF8')),'hex') AS hash FROM public.${table} t`,
        )
      )[0].hash;
    return rows;
  }
  const denied = (e: unknown) =>
    e instanceof AccessError && e.code === "RESTORE_QUARANTINED";
  await t.test(
    "restore quarantine refuses runtime roles and a running primary monitor without changing state",
    async () => {
      for (const pool of [c.api, c.judgePool]) {
        await assert.rejects(quarantineRestoredDatabase(pool, intent), {
          code: "42501",
        });
        await assert.rejects(restoreStatus(pool, intent.requestKey), {
          code: "42501",
        });
      }
      await monitor.start();
      try {
        await assert.rejects(quarantineRestoredDatabase(c.owner, intent), {
          code: "55000",
        });
      } finally {
        await monitor.stop();
      }
      assert.equal(
        (await restoreStatus(c.owner, intent.requestKey)).status,
        "NOT_OBSERVED",
      );
      assert.equal(
        (
          await query(
            "SELECT revoked_at FROM participant_sessions WHERE id=$1",
            [parseProof(a.ab)!.id],
          )
        )[0].revoked_at,
        null,
      );
    },
  );
  const allMutable = [
    ...tables,
    "participant_sessions",
    "staff_sessions",
    "entry_flows",
    "staff_entry_flows",
    "replacement_requests",
    "session_deliveries",
    "staff_session_deliveries",
    "member_session_slots",
    "staff_session_slots",
    "judge_host_epochs",
    "security_control",
    "restore_quarantine",
  ];
  await t.test(
    "a failed receipt rolls back every revocation and epoch change atomically",
    async () => {
      const before = await fingerprints(allMutable);
      await query(
        "CREATE FUNCTION restore_test_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Synthetic restore receipt failure'; END $$",
      );
      await query(
        "CREATE TRIGGER restore_test_failure BEFORE INSERT ON restore_quarantine FOR EACH ROW EXECUTE FUNCTION restore_test_failure()",
      );
      try {
        await assert.rejects(
          quarantineRestoredDatabase(c.owner, intent),
          /Synthetic restore receipt failure/,
        );
      } finally {
        await query("DROP TRIGGER restore_test_failure ON restore_quarantine");
        await query("DROP FUNCTION restore_test_failure()");
      }
      assert.deepEqual(await fingerprints(allMutable), before);
    },
  );
  const before = await fingerprints();
  const securityBefore = (
    await query("SELECT revision FROM security_control WHERE id=1")
  )[0].revision;
  let outcome: any;
  await t.test(
    "one offline commit invalidates old access and handoffs, purges capsules and quarantines epochs",
    async () => {
      const replies = await Promise.all([
        quarantineRestoredDatabase(c.owner, intent),
        quarantineRestoredDatabase(c.owner, intent),
      ]);
      assert.deepEqual(replies[0], replies[1]);
      outcome = replies[0];
      assert.equal(outcome.state, "QUARANTINED");
      assert.equal(outcome.admission_authorised, false);
      for (const key of [
        "participant_sessions",
        "staff_sessions",
        "entry_flows",
        "staff_entry_flows",
        "replacement_requests",
        "session_deliveries",
        "staff_session_deliveries",
        "member_slots",
        "staff_slots",
        "judge_epochs",
      ])
        assert.ok(outcome.effects[key] > 0, key);
      for (const table of ["participant_sessions", "staff_sessions"])
        assert.equal(
          (
            await query(
              `SELECT count(*)::int n FROM ${table} WHERE revoked_at IS NULL`,
            )
          )[0].n,
          0,
        );
      for (const table of ["entry_flows", "staff_entry_flows"])
        assert.equal(
          (
            await query(
              `SELECT count(*)::int n FROM ${table} WHERE state IN ('OPEN','ACTIVATED')`,
            )
          )[0].n,
          0,
        );
      for (const table of ["session_deliveries", "staff_session_deliveries"])
        assert.equal(
          (
            await query(
              `SELECT count(*)::int n FROM ${table} WHERE ciphertext IS NOT NULL`,
            )
          )[0].n,
          0,
        );
      assert.equal(
        (
          await query(
            "SELECT count(*)::int n FROM replacement_requests WHERE proof_ciphertext IS NOT NULL OR state IN ('PENDING','APPROVED','ACTIVATED')",
          )
        )[0].n,
        0,
      );
      assert.equal(
        (
          await query(
            "SELECT count(*)::int n FROM member_session_slots WHERE session_id IS NOT NULL OR reservation_flow_id IS NOT NULL",
          )
        )[0].n,
        0,
      );
      assert.equal(
        (
          await query(
            "SELECT count(*)::int n FROM staff_session_slots WHERE session_id IS NOT NULL",
          )
        )[0].n,
        0,
      );
      assert.equal(
        (
          await query(
            "SELECT count(*)::int n FROM judge_host_epochs WHERE state='ACTIVE'",
          )
        )[0].n,
        0,
      );
      assert.equal(
        BigInt(
          (await query("SELECT revision FROM security_control WHERE id=1"))[0]
            .revision,
        ),
        BigInt(securityBefore) + 1n,
      );
      assert.equal(
        (await restoreStatus(c.owner, intent.requestKey)).status,
        "RECORDED",
      );
      assert.deepEqual(await fingerprints(), before);
    },
  );
  await t.test(
    "lost replies reconcile to the same immutable receipt; changed intent and replacement keys cannot repeat recovery",
    async () => {
      const after = await fingerprints(allMutable);
      assert.deepEqual(
        await quarantineRestoredDatabase(c.owner, intent),
        outcome,
      );
      for (const patch of [
        { reason: "Changed intent" },
        { requestKey: randomUUID() },
        { backupRef: "Another target" },
      ])
        await assert.rejects(
          quarantineRestoredDatabase(c.owner, { ...intent, ...patch }),
          { code: "P0002" },
        );
      await assert.rejects(
        c.owner.query("DELETE FROM restore_quarantine"),
        /immutable/,
      );
      await assert.rejects(
        c.owner.query("UPDATE restore_quarantine SET reason='Changed'"),
        /immutable/,
      );
      assert.deepEqual(await fingerprints(allMutable), after);
    },
  );
  await t.test(
    "old sessions, proof cookies, fresh entries and workers stay blocked even with a healthy synthetic guard",
    async () => {
      await assert.rejects(entry.inspect(a.ab), denied);
      await assert.rejects(staff.inspect(c.staff.sessionCookie), denied);
      await assert.rejects(
        staff.activate(staffFlow.proofCookie, randomUUID()),
        denied,
      );
      await assert.rejects(replacement.describe(pending.proofCookie), denied);
      await assert.rejects(
        replacement.activate(approved.proofCookie, randomUUID()),
        denied,
      );
      await assert.rejects(
        entry.begin(c.teams[0]!.code, {
          ip: "127.0.0.1",
          browserId: randomUUID(),
        }),
        denied,
      );
      await assert.rejects(workbench.draft(a.ab, a.round, a.y), denied);
      for (const security of ["SHARED", "EXCLUSIVE", "QUOTA"] as const)
        await assert.rejects(
          accessTransaction(
            c.api,
            c.clock,
            async () => {
              throw new Error("Protected work must not run");
            },
            security,
          ),
          denied,
        );
      await assert.rejects(c.judge.claim(), denied);
      await assert.rejects(c.validationWorker.tick(), denied);
      await assert.rejects(
        c.api.query("SELECT * FROM lock_arena_control(true)"),
        { code: "55000" },
      );
      await assert.rejects(
        c.judgePool.query("SELECT * FROM lock_arena_control(true)"),
        { code: "42501" },
      );
      assert.deepEqual(await fingerprints(), before);
    },
  );
  await t.test(
    "normal restart, clock recovery and direct clock writes cannot lift the independent restore gate",
    async () => {
      await assert.rejects(createClockMonitor(c.api, source).start(), denied);
      await assert.rejects(
        createClockMonitor(c.api, source).start(true),
        denied,
      );
      await assert.rejects(
        createWorkerClock(c.judgePool, source).pollOnce(),
        denied,
      );
      await assert.rejects(
        c.owner.query("UPDATE clock_health SET running=true WHERE id=1"),
        { code: "55000" },
      );
      await assert.rejects(
        c.api.query(
          "INSERT INTO restore_quarantine SELECT * FROM restore_quarantine",
        ),
        { code: "42501" },
      );
      assert.equal(
        (await query("SELECT restore_is_quarantined() q"))[0].q,
        true,
      );
      assert.deepEqual(await fingerprints(), before);
    },
  );
  await t.test(
    "HTTP readiness and browser bootstrap refuse restored admission without exposing operator metadata",
    async () => {
      const app = buildApp({
        database: { async check() {}, async close() {} },
        entry: {
          pool: c.api,
          clock: c.clock,
          recoveryClock: c.clock,
          delivery: c.delivery,
          browser: {
            mode: "loopback",
            origin: "http://127.0.0.1:5174",
            cookieKey: randomBytes(32),
            csrfKey: randomBytes(32),
          },
        },
      });
      try {
        assert.equal(
          (await app.inject({ method: "GET", url: "/health" })).statusCode,
          200,
        );
        assert.equal(
          (await app.inject({ method: "GET", url: "/ready" })).statusCode,
          503,
        );
        const reply = await app.inject({
          method: "GET",
          url: "/api/v1/bootstrap?audience=ANONYMOUS",
        });
        assert.equal(reply.statusCode, 503);
        assert.equal(reply.json().error.code, "RESTORE_QUARANTINED");
        assert.equal(reply.headers["cache-control"], "no-store");
        assert.doesNotMatch(
          reply.body,
          /Synthetic|backup-ref|fixture|effects|fingerprint/,
        );
      } finally {
        await app.close();
      }
    },
  );
  await t.test(
    "offline recovery inventory cannot invent external proof or authorise admission",
    async () => {
      const report = await inspectRestoredDatabase(c.owner, intent.requestKey);
      assert.equal(report.admission_authorised, false);
      assert.equal(report.recovery_gates.access_invalidated, true);
      assert.equal(
        report.recovery_gates.old_epochs_logically_quarantined,
        true,
      );
      assert.equal(
        report.recovery_gates.physical_old_host_fencing,
        "UNVERIFIED",
      );
      assert.ok(report.inventory.physical_holds > 0);
      assert.ok(report.inventory.unreleased_attempts > 0);
      assert.ok(report.inventory.reserved_arenas > 0);
      await assert.rejects(inspectRestoredDatabase(c.api, intent.requestKey), {
        code: "42501",
      });
      await assert.rejects(inspectRestoredDatabase(c.owner, randomUUID()));
      assert.equal((await readOperations(c.api)).state, "CRITICAL");
      assert.deepEqual(await fingerprints(), before);
    },
  );
}
