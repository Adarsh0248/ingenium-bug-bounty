import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import type { TestContext } from "node:test";
import { buildApp } from "../../src/app.js";
import { browserPolicy } from "../../src/access/browser-policy.js";
import { createCompetitionService } from "../../src/competition/service.js";
import { createStaffManagement } from "../../src/access/staff-management.js";
import { parseProof } from "../../src/access/credentials.js";
import { AccessError } from "../../src/access/transaction.js";
import type { participantJudgingChecks } from "./participant-judging.checks.js";
import { staffJudgingBrowserChecks } from "./staff-judging-browser.checks.js";

type Context = Parameters<typeof participantJudgingChecks>[1] & {
  newStaff(role?: string): Promise<{ sessionCookie: string; code: string }>;
};
export async function staffJudgingChecks(t: TestContext, c: Context) {
  const a = await c.newRound(),
    query = async (sql: string, args: unknown[] = []) =>
      (await c.owner.query(sql, args)).rows;
  async function until(done: () => Promise<boolean>) {
    const end = Date.now() + 20000;
    while (!(await done())) {
      assert.ok(
        Date.now() < end,
        "Synthetic judging check exceeded its test wait",
      );
      await c.judge.tick();
      await delay(50);
    }
  }
  const complete = (id: string) =>
    until(
      async () =>
        (
          await query(
            "SELECT completed_at FROM participant_judging WHERE id=$1",
            [id],
          )
        )[0].completed_at !== null,
    );
  let failed = "",
    sample = "",
    held = "",
    recovery = "",
    job = "",
    heldJob = "",
    key = "";
  await t.test(
    "staff judging filters and stable queue cursors expose only safe monitoring metadata without renewing sessions",
    async () => {
      await c.budgets();
      failed = (
        await c.service.submit(
          a.aa,
          a.round,
          a.x,
          "PRIVATE-OFFICIAL-SOURCE",
          randomUUID(),
        )
      ).result.submission_id as string;
      sample = (
        await c.service.run(
          a.ab,
          a.round,
          a.y,
          "PRIVATE-SAMPLE-SOURCE",
          randomUUID(),
        )
      ).result.run_id as string;
      held = (
        await c.service.submit(
          a.bb,
          a.round,
          a.y,
          "PRIVATE-HELD-SOURCE",
          randomUUID(),
        )
      ).result.submission_id as string;
      c.answers.set(failed, "WRONG_ANSWER");
      c.answers.set(sample, "PASSED");
      c.answers.set(held, "PASSED");
      c.malformed.add(held);
      await complete(failed);
      await complete(sample);
      await until(
        async () =>
          (
            await query(
              "SELECT count(*)::integer n FROM participant_attempts x JOIN participant_jobs j ON j.id=x.job_id WHERE j.parent_id=$1 AND x.released_at IS NULL",
              [held],
            )
          )[0].n > 0,
      );
      const before = await query(
        "SELECT id,last_activity_at FROM staff_sessions ORDER BY id",
      );
      await c.budgets();
      const all = await c.service.judgeQueue(
        c.organiser.sessionCookie,
        a.round,
        undefined,
        { view: "ALL" },
      );
      assert.deepEqual(
        all.parents.map((p) => p.id),
        [failed, sample, held],
      );
      assert.equal(all.summary?.total, 3);
      assert.ok(Number(all.summary?.physically_held) > 0);
      const page = await c.service.judgeQueue(
        c.organiser.sessionCookie,
        a.round,
        failed,
        { view: "ALL" },
      );
      assert.deepEqual(
        page.parents.map((p) => p.id),
        [sample, held],
      );
      assert.deepEqual(
        (
          await c.service.judgeQueue(
            c.staff.sessionCookie,
            a.round,
            undefined,
            { lane: "SAMPLE" },
          )
        ).parents,
        [],
      );
      const samples = await c.service.judgeQueue(
        c.organiser.sessionCookie,
        a.round,
        undefined,
        { view: "ALL", lane: "SAMPLE" },
      );
      assert.deepEqual(
        samples.parents.map((p) => p.id),
        [sample],
      );
      const ownTeam = all.parents.find((p) => p.id === failed)!.team_id;
      assert.deepEqual(
        (
          await c.service.judgeQueue(
            c.organiser.sessionCookie,
            a.round,
            undefined,
            { view: "ALL", team_id: ownTeam },
          )
        ).parents.map((p) => p.id),
        [failed, sample],
      );
      await assert.rejects(
        c.service.judgeQueue(c.staff.sessionCookie, a.round, randomUUID()),
      );
      const detail = await c.service.judgeDetail(
        c.organiser.sessionCookie,
        a.round,
        held,
      );
      heldJob = detail.jobs.find((j) =>
        j.attempts.some(
          (attempt: { released_at: unknown }) => attempt.released_at === null,
        ),
      )!.id;
      assert.ok(
        detail.jobs.every(
          (j) => !j.retry_allowed && j.retry_reason === "ROLE_REQUIRED",
        ),
      );
      assert.equal(
        (
          await c.service.judgeDetail(c.staff.sessionCookie, a.round, held)
        ).jobs.find((j) => j.id === heldJob)?.retry_reason,
        "PHYSICAL_HOLD",
      );
      for (const value of [all, detail])
        assert.doesNotMatch(
          JSON.stringify(value),
          /PRIVATE-|source|stdout|stderr|compiler_output|evidence|token|runtime_digest|case_id|expected_output/,
        );
      assert.deepEqual(
        await query(
          "SELECT id,last_activity_at FROM staff_sessions ORDER BY id",
        ),
        before,
      );
      await assert.rejects(c.service.judgeDetail(a.aa, a.round, failed));
    },
  );
  await t.test(
    "unsafe physical holds and reliable code failures cannot authorise a new dispatch",
    async () => {
      const before = await query(
        "SELECT id FROM participant_attempts ORDER BY id",
      );
      await c.budgets();
      const denied = await c.service.retryJob(
        c.staff.sessionCookie,
        a.round,
        heldJob,
        randomUUID(),
        "Cannot release an uncertain physical execution",
        c.staff.code,
      );
      assert.equal(denied.result.status, "REJECTED");
      const completedJob = (
        await c.service.judgeDetail(c.staff.sessionCookie, a.round, failed)
      ).jobs[0]!.id;
      assert.equal(
        (
          await c.service.retryJob(
            c.staff.sessionCookie,
            a.round,
            completedJob,
            randomUUID(),
            "Cannot rejudge a trustworthy wrong answer",
            c.staff.code,
          )
        ).result.status,
        "REJECTED",
      );
      assert.deepEqual(
        await query("SELECT id FROM participant_attempts ORDER BY id"),
        before,
      );
      assert.ok([...c.sent.values()].every((n) => n === 1));
    },
  );
  await t.test(
    "monitoring reports exhausted safe infrastructure recovery without allocating another execution",
    async () => {
      await c.budgets();
      recovery = (
        await c.service.submit(
          a.ab,
          a.round,
          a.x,
          "ORIGINAL-RECOVERY-SOURCE",
          randomUUID(),
        )
      ).result.submission_id as string;
      c.answers.set(recovery, "INFRA_ERROR");
      job = (
        await query(
          "SELECT id FROM participant_jobs WHERE parent_id=$1 ORDER BY position LIMIT 1",
          [recovery],
        )
      )[0].id;
      await until(
        async () =>
          (
            await query(
              "SELECT count(*)::integer n FROM participant_attempts WHERE job_id=$1 AND released_at IS NOT NULL",
              [job],
            )
          )[0].n === 3,
      );
      await c.budgets();
      const view = await c.service.judgeDetail(
          c.staff.sessionCookie,
          a.round,
          recovery,
        ),
        selected = view.jobs.find((j) => j.id === job)!;
      assert.equal(selected.retry_allowed, true);
      assert.equal(selected.retry_reason, "ELIGIBLE");
      assert.equal(selected.attempts.length, 3);
      assert.equal(view.parent.result, null);
      assert.equal(view.parent.status, "NEEDS_ATTENTION");
      assert.equal(
        (await c.service.recoveryAudit(c.staff.sessionCookie, a.round, job))
          .items.length,
        0,
      );
      await assert.rejects(
        c.service.recoveryAudit(c.organiser.sessionCookie, a.round, job),
      );
      await assert.rejects(
        c.service.retryJob(
          c.organiser.sessionCookie,
          a.round,
          job,
          randomUUID(),
          "Organiser cannot repair",
          c.organiser.code,
        ),
      );
      await assert.rejects(
        c.service.retryJob(
          c.staff.sessionCookie,
          a.round,
          job,
          randomUUID(),
          "Wrong confirmation",
          "wrong",
        ),
      );
      assert.equal(
        (
          await query(
            "SELECT count(*)::integer n FROM participant_attempts WHERE job_id=$1",
            [job],
          )
        )[0].n,
        3,
      );
    },
  );
  await t.test(
    "monitor HTTP is private, bounded and schema-strict; participant cookies cannot access staff diagnostics",
    async () => {
      const browser = {
          mode: "loopback" as const,
          origin: "http://127.0.0.1:3000",
          cookieKey: randomBytes(32),
          csrfKey: randomBytes(32),
        },
        policy = browserPolicy(browser);
      const app = buildApp({
        database: { async check() {}, async close() {} },
        entry: {
          pool: c.api,
          clock: c.clock,
          delivery: c.delivery,
          competition: c.deps,
          browser,
        },
      });
      async function get(
        url: string,
        cookie = c.staff.sessionCookie,
        cookieName = policy.names.staff,
      ) {
        await c.budgets();
        return app.inject({
          method: "GET",
          url,
          headers: { cookie: `${cookieName}=${cookie}` },
        });
      }
      try {
        const base = `/api/v1/staff/competition/rounds/${a.round}`;
        for (const suffix of [
          "/judging?view=ALL",
          `/judging/${recovery}`,
          `/jobs/${job}/recovery-history`,
        ]) {
          const response = await get(base + suffix);
          assert.equal(response.statusCode, 200, response.body);
          assert.equal(response.headers["cache-control"], "no-store");
          assert.ok(Buffer.byteLength(response.body) <= 1048576);
          assert.doesNotMatch(
            response.body,
            /PRIVATE-|ORIGINAL-RECOVERY-SOURCE|stdout|stderr|case_id|payload_digest|worker_id|runtime_key/,
          );
        }
        for (const suffix of [
          "/judging?view=invalid",
          "/judging?lane=java",
          "/judging?limit=100",
          `/jobs/${job}/recovery-history?after=bad`,
        ])
          assert.equal((await get(base + suffix)).statusCode, 400);
        assert.equal(
          (
            await get(
              `${base}/judging/${recovery}`,
              a.aa,
              policy.names.participant,
            )
          ).statusCode,
          401,
        );
        assert.equal(
          (
            await get(
              `${base}/jobs/${job}/recovery-history`,
              c.organiser.sessionCookie,
            )
          ).statusCode,
          403,
        );
        const bootstrap = await get("/api/v1/bootstrap?audience=ANONYMOUS");
        const cookies = bootstrap.headers["set-cookie"];
        const browserCookies = (
          Array.isArray(cookies) ? cookies : cookies ? [cookies] : []
        ).map((line) => line.split(";")[0]);
        assert.equal(
          (
            await app.inject({
              method: "POST",
              url: `${base}/jobs/${job}/retry`,
              payload: {
                request_key: randomUUID(),
                reason: "CSRF absent",
                own_code: c.staff.code,
              },
              headers: {
                cookie: [
                  `${policy.names.staff}=${c.staff.sessionCookie}`,
                  ...browserCookies,
                ].join("; "),
                origin: browser.origin,
              },
            })
          ).statusCode,
          403,
        );
      } finally {
        await app.close();
      }
    },
  );
  await t.test(
    "confirmed extra-dispatch recovery survives a lost reply, keeps the original receipt and is never an execution command",
    async () => {
      await c.budgets();
      const before = (
        await query("SELECT * FROM competition_submissions WHERE id=$1", [
          recovery,
        ])
      )[0];
      if (process.env.INGENIUM_TEST_SUITE === "judging-browser")
        key = await staffJudgingBrowserChecks(c, {
          round: a.round,
          parent: recovery,
          job,
          heldParent: held,
          heldJob,
        });
      else {
        key = randomUUID();
        await c.service.retryJob(
          c.staff.sessionCookie,
          a.round,
          job,
          key,
          "Synthetic confirmed recovery",
          c.staff.code,
        );
      }
      await c.budgets();
      const observed = await c.service.outcome(
        c.staff.sessionCookie,
        a.round,
        key,
        "STAFF",
      );
      assert.equal(observed.status, "OBSERVED");
      assert.equal(observed.outcome!.result.status, "APPLIED");
      assert.equal(
        (
          await query(
            "SELECT count(*)::integer n FROM participant_attempts WHERE job_id=$1",
            [job],
          )
        )[0].n,
        3,
      );
      assert.equal(
        (
          await c.service.judgeDetail(c.staff.sessionCookie, a.round, recovery)
        ).jobs.find((j) => j.id === job)?.retry_reason,
        "EXTRA_DISPATCH_USED",
      );
      assert.deepEqual(
        (
          await query("SELECT * FROM competition_submissions WHERE id=$1", [
            recovery,
          ])
        )[0],
        before,
      );
      const extraOwner = await c.newStaff("SUPER_ADMIN");
      await c.budgets();
      assert.equal(
        (
          await c.service.outcome(
            extraOwner.sessionCookie,
            a.round,
            key,
            "STAFF",
          )
        ).status,
        "NOT_OBSERVED",
      );
    },
  );
  await t.test(
    "recovery audit binds applied and rejected receipts to exactly one job and pages without resetting its allowance",
    async () => {
      for (let i = 0; i < 41; i++) {
        await c.budgets();
        assert.equal(
          (
            await c.service.retryJob(
              c.staff.sessionCookie,
              a.round,
              job,
              randomUUID(),
              `Synthetic additional authorisation refused ${i}`,
              c.staff.code,
            )
          ).result.status,
          "REJECTED",
        );
      }
      await c.budgets();
      const first = await c.service.recoveryAudit(
        c.staff.sessionCookie,
        a.round,
        job,
      );
      assert.equal(first.items.length, 40);
      assert.ok(first.next_after);
      const second = await c.service.recoveryAudit(
        c.staff.sessionCookie,
        a.round,
        job,
        first.next_after!,
      );
      assert.equal(second.items.length, 2);
      assert.equal(
        new Set([...first.items, ...second.items].map((i) => i.id)).size,
        42,
      );
      assert.equal(
        first.items.filter((i) => i.decision === "APPLIED").length,
        1,
      );
      const foreign = (
        await c.service.recoveryAudit(c.staff.sessionCookie, a.round, heldJob)
      ).items[0]!.id;
      await assert.rejects(
        c.service.recoveryAudit(c.staff.sessionCookie, a.round, job, foreign),
      );
      assert.equal(
        (
          await query(
            "SELECT count(*)::integer n FROM participant_retry_permissions WHERE job_id=$1",
            [job],
          )
        )[0].n,
        1,
      );
      c.answers.set(recovery, "PASSED");
      c.malformed.delete(held);
      await complete(held);
      await complete(recovery);
      assert.equal(
        (
          await query(
            "SELECT count(*)::integer n FROM participant_attempts WHERE job_id=$1",
            [job],
          )
        )[0].n,
        4,
      );
    },
  );
  await t.test(
    "current clock health and role authority are rechecked for every monitoring request",
    async () => {
      const blocked = createCompetitionService(
        c.api,
        {
          ...c.clock,
          assertHealthy() {
            throw new AccessError("CLOCK_UNTRUSTED");
          },
        },
        c.delivery,
        c.deps,
      );
      await assert.rejects(blocked.judgeQueue(c.staff.sessionCookie, a.round));
      await assert.rejects(
        blocked.judgeDetail(c.staff.sessionCookie, a.round, recovery),
      );
      await c.budgets();
      const overview = await c.service.judgeQueue(
        c.staff.sessionCookie,
        a.round,
        undefined,
        { view: "COMPLETED" },
      );
      assert.ok(
        overview.parents.some(
          (p) => p.id === recovery && p.result === "PASSED",
        ),
      );
      assert.equal(
        (
          await c.service.judgeDetail(c.staff.sessionCookie, a.round, recovery)
        ).jobs.find((j) => j.id === job)?.retry_reason,
        "SETTLED",
      );
      const manager = await c.newStaff("SUPER_ADMIN"),
        target = await c.newStaff("OWNER");
      await c.budgets();
      assert.equal(
        (await c.service.judgeDetail(manager.sessionCookie, a.round, recovery))
          .role,
        "SUPER_ADMIN",
      );
      assert.ok(
        (await c.service.recoveryAudit(target.sessionCookie, a.round, job))
          .items.length > 0,
      );
      const identity = (
        await query(
          "SELECT i.id,i.display_name,i.revision FROM staff_identities i JOIN staff_sessions s ON s.staff_id=i.id WHERE s.id=$1",
          [parseProof(target.sessionCookie)!.id],
        )
      )[0];
      await c.budgets();
      const change = await createStaffManagement(
        c.api,
        c.clock,
        c.delivery,
      ).command(manager.sessionCookie, {
        action: "UPDATE",
        targetId: identity.id,
        requestKey: randomUUID(),
        expectedRevision: identity.revision,
        ownCode: manager.code,
        reason: "Synthetic judging access revocation",
        displayName: identity.display_name,
        role: "ORGANISER",
        enabled: true,
      });
      assert.equal(change.outcome.outcome, "APPLIED");
      await assert.rejects(c.service.judgeQueue(target.sessionCookie, a.round));
      await assert.rejects(
        c.service.recoveryAudit(target.sessionCookie, a.round, job),
      );
    },
  );
}
