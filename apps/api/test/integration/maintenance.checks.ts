import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import type { TestContext } from "node:test";
import { AccessError } from "../../src/access/transaction.js";
import { createEntryService } from "../../src/access/entry-service.js";
import { createStaffService } from "../../src/access/staff-service.js";
import { createReplacementService } from "../../src/access/replacement-service.js";
import { parseProof, sha256 } from "../../src/access/credentials.js";
import { maintenanceTasks } from "../../src/maintenance/tasks.js";
import { startEventMaintenance } from "../../src/maintenance/runtime.js";
import type { participantJudgingChecks } from "./participant-judging.checks.js";

type Context = Omit<
  Parameters<typeof participantJudgingChecks>[1],
  "newRound"
> & {
  teams: { id: string; code: string; members: string[] }[];
  newRound(
    durationMs?: number,
  ): ReturnType<Parameters<typeof participantJudgingChecks>[1]["newRound"]>;
};
export async function maintenanceChecks(t: TestContext, c: Context) {
  const query = async (sql: string, values: unknown[] = []) =>
    (await c.owner.query(sql, values)).rows;
  const tasks = maintenanceTasks(c.api, c.clock);
  const a = await c.newRound(4000);
  let trustworthy = false;
  const guard = {
    ...c.clock,
    assertHealthy() {
      if (!trustworthy) throw new AccessError("CLOCK_UNTRUSTED");
      c.clock.assertHealthy();
    },
  };
  const reports: string[] = [];
  const runtime = startEventMaintenance(c.api, guard, (task) =>
    reports.push(task),
  );
  const state = async () =>
    (
      await query(
        "SELECT state,revision,closes_at,trusted_time_at FROM rounds WHERE id=$1",
        [a.round],
      )
    )[0];
  async function waitFor(done: () => Promise<boolean>, timeout = 5000) {
    const end = Date.now() + timeout;
    while (!(await done())) {
      assert.ok(Date.now() < end, "Bounded maintenance check timed out");
      await delay(50);
    }
  }
  async function command(
    action: "PAUSE" | "RESUME" | "FINALISE" | "CANCEL_ROUND",
    payload: Record<string, unknown> = {},
  ) {
    await c.budgets();
    return c.service.command(c.staff.sessionCookie, {
      action,
      roundId: a.round,
      requestKey: randomUUID(),
      expectedRevision: (await state()).revision,
      reason: "Synthetic automatic maintenance",
      payload,
      ownCode: c.staff.code,
    });
  }
  let replacement = "";
  let official = "",
    sample = "",
    sampleTime: Date,
    original: unknown;
  try {
    await t.test(
      "all maintenance waits for trusted time, logs only task labels and retries rather than skipping clock checks",
      async () => {
        const before = await state();
        await waitFor(async () => reports.length === 6);
        assert.deepEqual([...reports].sort(), [
          "deliveries",
          "payloads",
          "quotas",
          "rounds",
          "validation",
          "verifiers",
        ]);
        assert.deepEqual(await state(), before);
        for (const task of Object.values(maintenanceTasks(c.api, guard)))
          await assert.rejects(task(), { code: "CLOCK_UNTRUSTED" });
      },
    );
    await t.test(
      "a global pause prevents timer closure and resume extends the shared deadline; admitted work remains frozen",
      async () => {
        await c.budgets();
        sample = (
          await c.service.run(
            a.ab,
            a.round,
            a.y,
            "preserved sample source",
            randomUUID(),
          )
        ).result.run_id as string;
        await c.judge.claim();
        await c.judge.tick();
        official = (
          await c.service.submit(
            a.aa,
            a.round,
            a.x,
            "preserved official source",
            randomUUID(),
          )
        ).result.submission_id as string;
        assert.ok(official && sample);
        sampleTime = (
          await query(
            "SELECT created_at FROM participant_judging WHERE id=$1",
            [sample],
          )
        )[0].created_at;
        original = await query(
          "SELECT id,source,received_at,receipt_order FROM competition_submissions WHERE round_id=$1",
          [a.round],
        );
        await waitFor(async () => {
          await c.judge.tick();
          return (
            (
              await query(
                `SELECT count(DISTINCT j.parent_id)::int n FROM participant_attempts x JOIN participant_jobs j ON j.id=x.job_id WHERE j.parent_id=ANY($1::uuid[]) AND x.released_at IS NULL`,
                [[official, sample]],
              )
            )[0].n === 2
          );
        }, 15000);
        const before = await state();
        await command("PAUSE", { scope: "GLOBAL", target: null });
        await c.budgets();
        const flow = await createEntryService(c.api, c.clock, c.delivery).begin(
          c.teams[1]!.code,
          { ip: "127.0.0.1", browserId: randomUUID() },
        );
        const request = await createReplacementService(
          c.api,
          c.clock,
          c.delivery,
        ).request(flow.proofCookie, {
          memberId: c.teams[1]!.members[0]!,
          requestKey: randomUUID(),
        });
        assert.equal(request.status, "REQUESTED");
        if (request.status !== "REQUESTED")
          throw new Error("Synthetic replacement was not created");
        replacement = request.request.request_id;
        trustworthy = true;
        await delay(Math.max(0, before.closes_at.getTime() - Date.now() + 100));
        await tasks.rounds();
        assert.equal((await state()).state, "PAUSED");
        await command("RESUME", { scope: "GLOBAL", target: null });
        assert.ok((await state()).closes_at > before.closes_at);
        await waitFor(async () => (await state()).state === "CLOSING", 8000);
        const closed = await state();
        await Promise.all([tasks.rounds(), tasks.rounds()]);
        assert.equal((await state()).revision, closed.revision);
        assert.deepEqual(
          await query(
            "SELECT id,source,received_at,receipt_order FROM competition_submissions WHERE round_id=$1",
            [a.round],
          ),
          original,
        );
        assert.equal(
          (
            await query(
              "SELECT count(*)::int n FROM round_results WHERE round_id=$1",
              [a.round],
            )
          )[0].n,
          0,
        );
        await assert.rejects(command("FINALISE"));
      },
    );
    await t.test(
      "bounded delivery cleanup purges unusable encrypted handoffs but preserves live sessions, receipts and valid handoffs",
      async () => {
        const entry = createEntryService(c.api, c.clock, c.delivery),
          staff = createStaffService(c.api, c.clock, c.delivery);
        const participant = parseProof(a.aa)!.id,
          admin = parseProof(c.staff.sessionCookie)!.id;
        const before = await query(
          "SELECT id,last_activity_at,revoked_at FROM participant_sessions WHERE id=$1",
          [participant],
        );
        const staffBefore = await query(
          "SELECT id,last_activity_at,revoked_at FROM staff_sessions WHERE id=$1",
          [admin],
        );
        const originalDelivery = await query(
          "SELECT ciphertext FROM session_deliveries WHERE session_id=$1",
          [participant],
        );
        const proof = await query(
          "SELECT proof_ciphertext FROM replacement_requests WHERE flow_id=$1",
          [replacement],
        );
        await tasks.deliveries();
        assert.ok(proof[0].proof_ciphertext);
        assert.deepEqual(
          await query(
            "SELECT proof_ciphertext FROM replacement_requests WHERE flow_id=$1",
            [replacement],
          ),
          proof,
        );
        assert.deepEqual(
          await query(
            "SELECT ciphertext FROM session_deliveries WHERE session_id=$1",
            [participant],
          ),
          originalDelivery,
        );
        // Invalidate only the synthetic handoff; the still-valid login must remain usable.
        await query(
          "UPDATE entry_flows SET state='SUPERSEDED' WHERE activated_session_id=$1",
          [participant],
        );
        await query(
          "UPDATE staff_entry_flows SET state='SUPERSEDED' WHERE session_id=$1",
          [admin],
        );
        await query(
          "UPDATE access_credentials SET revoked_at=date_trunc('milliseconds',clock_timestamp()) WHERE team_id=$1 AND revoked_at IS NULL",
          [c.teams[1]!.id],
        );
        const slots = await query(
          "SELECT * FROM member_session_slots ORDER BY member_id",
        );
        await Promise.all([tasks.deliveries(), tasks.deliveries()]);
        assert.equal(
          (
            await query(
              "SELECT proof_ciphertext FROM replacement_requests WHERE flow_id=$1",
              [replacement],
            )
          )[0].proof_ciphertext,
          null,
        );
        assert.deepEqual(
          await query("SELECT * FROM member_session_slots ORDER BY member_id"),
          slots,
        );
        assert.deepEqual(
          await query(
            "SELECT id,last_activity_at,revoked_at FROM participant_sessions WHERE id=$1",
            [participant],
          ),
          before,
        );
        assert.deepEqual(
          await query(
            "SELECT id,last_activity_at,revoked_at FROM staff_sessions WHERE id=$1",
            [admin],
          ),
          staffBefore,
        );
        assert.equal(
          (
            await query(
              "SELECT ciphertext FROM session_deliveries WHERE session_id=$1",
              [participant],
            )
          )[0].ciphertext,
          null,
        );
        assert.equal(
          (
            await query(
              "SELECT ciphertext FROM staff_session_deliveries WHERE session_id=$1",
              [admin],
            )
          )[0].ciphertext,
          null,
        );
        await c.budgets();
        await entry.inspect(a.aa);
        await staff.inspect(c.staff.sessionCookie);
        assert.equal(
          (
            await query(
              "SELECT count(*)::int n FROM entry_outcomes WHERE session_id=$1",
              [participant],
            )
          )[0].n,
          1,
        );
      },
    );
    await t.test(
      "quota cleanup is bounded, uses actual refill and never resets a recent or still-empty bucket",
      async () => {
        await c.budgets();
        for (let i = 0; i < 205; i++)
          await query(
            `INSERT INTO quota_buckets(kind,key_hash,rate,burst,credits,refilled_at,seen_at)
        VALUES('AUTH_BROWSER',$1,20,5,0,clock_timestamp()-interval '16 minutes',clock_timestamp()-interval '16 minutes')`,
            [sha256(`old-${i}`)],
          );
        const empty = sha256("still-empty"),
          recent = sha256("recent");
        await query(
          `INSERT INTO quota_buckets(kind,key_hash,rate,burst,credits,refilled_at,seen_at) VALUES
        ('AUTH_BROWSER',$1,1,1000,0,clock_timestamp()-interval '16 minutes',clock_timestamp()-interval '16 minutes'),
        ('AUTH_BROWSER',$2,20,5,0,clock_timestamp(),clock_timestamp())`,
          [empty, recent],
        );
        assert.equal(await tasks.quotas(), 200);
        assert.equal(await tasks.quotas(), 5);
        assert.deepEqual(
          (
            await query(
              "SELECT key_hash,credits FROM quota_buckets ORDER BY key_hash",
            )
          ).map((r) => r.credits),
          ["0", "0"],
        );
        assert.equal(await tasks.quotas(), 0);
      },
    );
    await t.test(
      "automatic sample expiry without a browser read keeps physical holds and official uncertainty intact",
      async () => {
        await waitFor(
          async () =>
            (
              await query(
                "SELECT status FROM participant_judging WHERE id=$1",
                [sample],
              )
            )[0].status === "COMPLETED",
          Math.max(5000, sampleTime!.getTime() + 123000 - Date.now()),
        );
        assert.equal(
          (
            await query("SELECT result FROM participant_judging WHERE id=$1", [
              sample,
            ])
          )[0].result,
          "INFRA_ERROR",
        );
        assert.equal(
          (
            await query(
              "SELECT completed_at FROM participant_judging WHERE id=$1",
              [official],
            )
          )[0].completed_at,
          null,
        );
        const held = await query(
          "SELECT participant_attempt_id FROM execution_capacity_slots WHERE participant_attempt_id IS NOT NULL ORDER BY id",
        );
        assert.equal(held.length, 2);
        await tasks.rounds();
        assert.deepEqual(
          await query(
            "SELECT participant_attempt_id FROM execution_capacity_slots WHERE participant_attempt_id IS NOT NULL ORDER BY id",
          ),
          held,
        );
        assert.equal(
          (
            await query(
              "SELECT count(*)::int n FROM wrong_submission_penalties WHERE submission_id=$1",
              [official],
            )
          )[0].n,
          0,
        );
      },
    );
    await t.test(
      "cancellation maintenance never invents a physical release, final results or a completed incident",
      async () => {
        const arena = (
          await query("SELECT arena_instance_id FROM rounds WHERE id=$1", [
            a.round,
          ])
        )[0].arena_instance_id;
        assert.equal(
          (
            await command("CANCEL_ROUND", {
              arena_id: arena,
              confirmed_round_id: a.round,
              incident_ref: "OPS-MAINTENANCE",
            })
          ).result.status,
          "APPLIED",
        );
        await tasks.rounds();
        assert.equal((await state()).state, "CANCELLING");
        assert.equal(
          (
            await query(
              "SELECT status,result FROM participant_judging WHERE id=$1",
              [official],
            )
          )[0].status,
          "CANCELLED",
        );
        assert.equal(
          (
            await query(
              "SELECT current_instance_id FROM arena_control WHERE id=1",
            )
          )[0].current_instance_id,
          arena,
        );
        assert.equal(
          (
            await query(
              "SELECT count(*)::int n FROM execution_capacity_slots WHERE participant_attempt_id IS NOT NULL",
            )
          )[0].n,
          2,
        );
        assert.equal(
          (
            await query(
              "SELECT count(*)::int n FROM round_results WHERE round_id=$1",
              [a.round],
            )
          )[0].n,
          0,
        );
      },
    );
    await t.test(
      "restart reconstructs maintenance from stored state without new source receipts, executions or awards",
      async () => {
        await runtime.close();
        const before =
          await query(`SELECT (SELECT count(*) FROM competition_outcomes)::int receipts,
        (SELECT count(*) FROM participant_attempts)::int attempts,(SELECT count(*) FROM bounty_awards)::int awards,
        (SELECT current_instance_id FROM arena_control WHERE id=1) arena`);
        let verifications = 0;
        const restarted = startEventMaintenance(
          c.api,
          {
            ...c.clock,
            async verify(client) {
              verifications++;
              await c.clock.verify(client);
            },
          },
          () => assert.fail("Unexpected restart maintenance failure"),
        );
        try {
          await waitFor(async () => verifications >= 5);
        } finally {
          await restarted.close();
        }
        assert.deepEqual(
          await query(`SELECT (SELECT count(*) FROM competition_outcomes)::int receipts,
        (SELECT count(*) FROM participant_attempts)::int attempts,(SELECT count(*) FROM bounty_awards)::int awards,
        (SELECT current_instance_id FROM arena_control WHERE id=1) arena`),
          before,
        );
      },
    );
  } finally {
    await runtime.close();
  }
}
