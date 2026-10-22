import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import type { TestContext } from "node:test";
import type { Pool } from "pg";
import {
  createCompetitionService,
  type CompetitionCommand,
  type CompetitionDependencies,
} from "../../src/competition/service.js";
import type { ClockGuard } from "../../src/access/transaction.js";
import { AccessError } from "../../src/access/transaction.js";
import type { SessionDelivery } from "../../src/access/credentials.js";
import { createEntryService } from "../../src/access/entry-service.js";
import { createArenaService } from "../../src/access/arena-service.js";
import { newAccessCode } from "../../src/access/credentials.js";
import { buildApp } from "../../src/app.js";
import { browserPolicy } from "../../src/access/browser-policy.js";
interface Arena {
  round: string;
  aa: string;
  ab: string;
  ba: string;
  x: string;
  y: string;
}
interface Context {
  owner: Pool;
  api: Pool;
  service: ReturnType<typeof createCompetitionService>;
  clock: ClockGuard;
  delivery: SessionDelivery;
  deps: CompetitionDependencies;
  staff: { sessionCookie: string; code: string };
  organiser: { sessionCookie: string; code: string };
  budgets(): Promise<void>;
  newRound(): Promise<Arena>;
  startRace(round: string): Promise<Arena>;
  judge: { tick(): Promise<string> };
  held: Set<string>;
  answers: Map<string, string>;
  sent: Map<string, number>;
}
export async function cancellationChecks(t: TestContext, c: Context) {
  const query = async (sql: string, p: unknown[] = []) =>
    (await c.owner.query(sql, p)).rows;
  async function intent(
    a: Arena,
    action: CompetitionCommand["action"] = "CANCEL_ROUND",
    patch: Partial<CompetitionCommand> = {},
  ): Promise<CompetitionCommand> {
    const r = (await query("SELECT * FROM rounds WHERE id=$1", [a.round]))[0];
    const record = (
      await query("SELECT id FROM round_cancellations WHERE round_id=$1", [
        a.round,
      ])
    )[0];
    return {
      action,
      roundId: a.round,
      requestKey: randomUUID(),
      expectedRevision: r.revision,
      reason: "Synthetic last-resort incident",
      ownCode: c.staff.code,
      payload:
        action === "CANCEL_ROUND"
          ? {
              arena_id: r.arena_instance_id,
              confirmed_round_id: a.round,
              incident_ref: "OPS-TEST-01",
            }
          : action === "FINISH_CANCEL"
            ? { arena_id: r.arena_instance_id, cancellation_id: record?.id }
            : {},
      ...patch,
    };
  }
  async function command(
    a: Arena,
    action: CompetitionCommand["action"] = "CANCEL_ROUND",
    patch: Partial<CompetitionCommand> = {},
  ) {
    await c.budgets();
    return c.service.command(
      c.staff.sessionCookie,
      await intent(a, action, patch),
    );
  }
  async function settle(done: () => Promise<boolean>) {
    const deadline = Date.now() + 20000;
    while (!(await done())) {
      assert.ok(
        Date.now() < deadline,
        "Synthetic retained execution did not settle",
      );
      await c.judge.tick();
      await delay(60);
    }
  }
  async function admit(
    a: Arena,
    lane: "run" | "submit",
    cookie = a.aa,
    bounty = a.x,
  ) {
    await c.budgets();
    const r = await c.service[lane](
      cookie,
      a.round,
      bounty,
      "synthetic preserved program\r\n",
      randomUUID(),
    );
    assert.equal(r.result.status, "ADMITTED");
    return (r.result.submission_id ?? r.result.run_id) as string;
  }
  await t.test(
    "confirmed cancellation is once-only, non-verdict, private and preserves all immutable source/history",
    async () => {
      const a = await c.newRound(),
        official = await admit(a, "submit"),
        sample = await admit(a, "run", a.ab),
        p = await intent(a);
      const prior = await query(
        "SELECT id,source,received_at,receipt_order FROM competition_submissions WHERE round_id=$1",
        [a.round],
      );
      await c.budgets();
      const [one, two] = await Promise.all([
        c.service.command(c.staff.sessionCookie, p),
        c.service.command(c.staff.sessionCookie, p),
      ]);
      assert.deepEqual(one, two);
      assert.equal(one.result.status, "APPLIED");
      assert.equal(
        (await query("SELECT state FROM rounds WHERE id=$1", [a.round]))[0]
          .state,
        "CANCELLING",
      );
      const parents = await query(
        "SELECT id,status,result,completed_at,cancellation_id FROM participant_judging WHERE id=ANY($1::uuid[])",
        [[official, sample]],
      );
      for (const row of parents) {
        assert.equal(row.status, "CANCELLED");
        assert.equal(row.result, null);
        assert.equal(row.completed_at, null);
        assert.equal(row.cancellation_id, one.result.cancellation_id);
      }
      assert.deepEqual(
        await query(
          "SELECT id,source,received_at,receipt_order FROM competition_submissions WHERE round_id=$1",
          [a.round],
        ),
        prior,
      );
      assert.equal(
        (
          await query(
            "SELECT count(*)::int n FROM participant_attempts a JOIN participant_jobs j ON j.id=a.job_id JOIN participant_judging p ON p.id=j.parent_id WHERE p.round_id=$1",
            [a.round],
          )
        )[0].n,
        0,
      );
      const standings = await c.service.standings(a.aa, a.round, "PARTICIPANT");
      assert.equal(standings.final, false);
      assert.equal(standings.cancelled, true);
      assert.ok(standings.standings.every((s) => s.rank === null));
      assert.equal(
        (await c.service.judging(a.ab, a.round, sample)).status,
        "CANCELLED",
      );
      for (const lane of ["run", "submit"] as const) {
        await c.budgets();
        const rejected = await c.service[lane](
          a.aa,
          a.round,
          a.y,
          "int main() {}",
          randomUUID(),
        );
        assert.equal(rejected.result.status, "REJECTED");
      }
      await c.budgets();
      assert.equal(
        (await c.service.buyHint(a.aa, a.round, a.y, 1, randomUUID())).result
          .status,
        "REJECTED",
      );
      await assert.rejects(
        c.service.command(c.staff.sessionCookie, {
          ...p,
          reason: "Changed incident",
        }),
        { code: "P0002" },
      );
      await assert.rejects(
        c.api.query("INSERT INTO round_cancellations(id) VALUES($1)", [
          randomUUID(),
        ]),
        { code: "42501" },
      );
      await assert.rejects(
        c.owner.query(
          "UPDATE round_cancellations SET incident_ref='rewrite' WHERE round_id=$1",
          [a.round],
        ),
      );
      assert.equal(
        (
          await query(
            "SELECT count(*)::int n FROM live_deliveries WHERE patch::text LIKE '%OPS-TEST-01%' OR patch::text LIKE '%Synthetic last-resort incident%'",
          )
        )[0].n,
        0,
      );
      assert.equal(
        (await command(a, "FINISH_CANCEL")).result.status,
        "APPLIED",
      );
      assert.equal(
        (
          await query(
            "SELECT current_instance_id FROM arena_control WHERE id=1",
          )
        )[0].current_instance_id,
        null,
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
    "paused cancellation never resumes or settles deferred awards and preserves completed evidence",
    async () => {
      const a = await c.newRound(),
        id = await admit(a, "submit");
      await command(a, "PAUSE", { payload: { scope: "GLOBAL", target: null } });
      c.answers.set(id, "PASSED");
      await settle(
        async () =>
          (
            await query(
              "SELECT completed_at FROM participant_judging WHERE id=$1",
              [id],
            )
          )[0].completed_at !== null,
      );
      const evidence = await query(
        "SELECT * FROM competition_assessments WHERE submission_id=$1",
        [id],
      );
      assert.equal(
        (
          await query(
            "SELECT count(*)::int n FROM bounty_awards WHERE submission_id=$1",
            [id],
          )
        )[0].n,
        0,
      );
      // Work admitted before a technical break may finish code judging while effects remain deferred.
      const before = (
        await query("SELECT closes_at FROM rounds WHERE id=$1", [a.round])
      )[0].closes_at;
      const p = await command(a);
      assert.equal(p.result.status, "APPLIED");
      assert.deepEqual(
        await query(
          "SELECT * FROM competition_assessments WHERE submission_id=$1",
          [id],
        ),
        evidence,
      );
      assert.equal(
        (
          await query(
            "SELECT count(*)::int n FROM bounty_awards WHERE submission_id=$1",
            [id],
          )
        )[0].n,
        0,
      );
      assert.equal(
        (
          await query("SELECT closes_at FROM rounds WHERE id=$1", [a.round])
        )[0].closes_at.getTime(),
        before.getTime(),
      );
      assert.equal(
        (
          await query(
            "SELECT ended_at,end_source_id FROM competition_pauses WHERE round_id=$1 AND scope='GLOBAL'",
            [a.round],
          )
        )[0].ended_at,
        null,
      );
      for (const action of [
        "RESUME",
        "FINALISE",
        "QUALIFY",
        "SETUP_R2",
      ] as const)
        await assert.rejects(
          command(
            a,
            action,
            action === "RESUME"
              ? { payload: { scope: "GLOBAL", target: null } }
              : {},
          ),
        );
      assert.equal(
        (await command(a, "FINISH_CANCEL")).result.status,
        "APPLIED",
      );
    },
  );
  await t.test(
    "held execution prevents archive; late evidence drains once without restoring cancelled jobs, awards or physical permits",
    async () => {
      const a = await c.newRound(),
        id = await admit(a, "submit");
      c.answers.set(id, "PASSED");
      c.held.add(id);
      await settle(
        async () =>
          (
            await query(
              "SELECT count(*)::int n FROM participant_attempts a JOIN participant_jobs j ON j.id=a.job_id WHERE j.parent_id=$1 AND a.result IS NOT NULL",
              [id],
            )
          )[0].n > 0,
      );
      const attempts = await query(
        "SELECT a.id,a.result,a.released_at FROM participant_attempts a JOIN participant_jobs j ON j.id=a.job_id WHERE j.parent_id=$1",
        [id],
      );
      const started = (
        await query("SELECT started_at FROM participant_judging WHERE id=$1", [
          id,
        ])
      )[0].started_at;
      assert.equal((await command(a)).result.status, "APPLIED");
      const denial = await intent(a, "FINISH_CANCEL");
      await c.budgets();
      assert.equal(
        (await c.service.command(c.staff.sessionCookie, denial)).result.reason,
        "DRAIN_PENDING",
      );
      assert.ok(
        (await c.service.cancellation(c.staff.sessionCookie, a.round))
          .held_executions > 0,
      );
      assert.equal(
        (
          await query(
            "SELECT count(*)::int n FROM execution_capacity_slots WHERE participant_attempt_id=ANY($1::uuid[])",
            [attempts.map((v) => v.id)],
          )
        )[0].n,
        attempts.length,
      );
      await assert.rejects(command(a, "DISCARD"));
      await assert.rejects(command(a, "FINALISE"));
      c.held.delete(id);
      await settle(
        async () =>
          (
            await query(
              "SELECT count(*)::int n FROM participant_attempts a JOIN participant_jobs j ON j.id=a.job_id WHERE j.parent_id=$1 AND a.released_at IS NULL",
              [id],
            )
          )[0].n === 0,
      );
      const parent = (
        await query("SELECT * FROM participant_judging WHERE id=$1", [id])
      )[0];
      assert.equal(parent.status, "CANCELLED");
      assert.equal(parent.result, null);
      assert.equal(parent.completed_at, null);
      assert.equal(parent.started_at.getTime(), started.getTime());
      assert.equal(
        (
          await query(
            "SELECT count(*)::int n FROM bounty_awards WHERE submission_id=$1",
            [id],
          )
        )[0].n,
        0,
      );
      for (const a of attempts) assert.equal(c.sent.get(a.id), 1);
      assert.equal(
        (
          await query(
            "SELECT count(*)::int n FROM participant_attempts a JOIN participant_jobs j ON j.id=a.job_id WHERE j.parent_id=$1",
            [id],
          )
        )[0].n,
        attempts.length,
      );
      await c.budgets();
      assert.equal(
        (await c.service.command(c.staff.sessionCookie, denial)).result.reason,
        "DRAIN_PENDING",
      );
      assert.equal(
        (await command(a, "FINISH_CANCEL")).result.status,
        "APPLIED",
      );
      await assert.rejects(
        c.owner.query(
          "UPDATE participant_judging SET status='QUEUED',cancellation_id=NULL WHERE id=$1",
          [id],
        ),
      );
      const next = await c.newRound();
      assert.notEqual(next.round, a.round);
      const rows = await c.service.standings(
        next.aa,
        next.round,
        "PARTICIPANT",
      );
      assert.equal(rows.cancelled, false);
      assert.ok(rows.standings.every((s) => (s as any).points === 0));
      await command(next);
      await command(next, "FINISH_CANCEL");
    },
  );
  await t.test(
    "Round 2 cancellation preserves locked Round 1 and does not permit a Round 2-only replay",
    async () => {
      const a = await c.newRound(),
        b = await c.startRace(a.round),
        before = await query("SELECT * FROM round_results WHERE round_id=$1", [
          a.round,
        ]);
      assert.equal((await command(b)).result.status, "APPLIED");
      await command(b, "FINISH_CANCEL");
      assert.deepEqual(
        await query("SELECT * FROM round_results WHERE round_id=$1", [a.round]),
        before,
      );
      assert.equal(
        (
          await query(
            "SELECT count(*)::int n FROM round_results WHERE round_id=$1",
            [b.round],
          )
        )[0].n,
        0,
      );
      assert.equal(
        await command(a, "SETUP_R2", {
          payload: { teams: [], duration_ms: 1000 },
        }).catch(() => null),
        null,
      );
      const next = await c.newRound();
      assert.equal(
        (await query("SELECT kind FROM rounds WHERE id=$1", [next.round]))[0]
          .kind,
        1,
      );
      await command(next);
      await command(next, "FINISH_CANCEL");
    },
  );
  await t.test(
    "cancellation enforces owner confirmation, exact target, trusted time and stale versions",
    async () => {
      const a = await c.newRound(),
        p = await intent(a);
      const untrusted = createCompetitionService(
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
      await assert.rejects(
        untrusted.command(c.staff.sessionCookie, p),
        (e: unknown) =>
          e instanceof AccessError && e.code === "CLOCK_UNTRUSTED",
      );
      await c.budgets();
      await assert.rejects(
        c.service.command(c.organiser.sessionCookie, {
          ...p,
          ownCode: c.organiser.code,
        }),
        (e: unknown) =>
          e instanceof AccessError && e.code === "ACCESS_UNAVAILABLE",
      );
      await assert.rejects(
        command(a, "CANCEL_ROUND", { ownCode: c.organiser.code }),
        (e: unknown) =>
          e instanceof AccessError && e.code === "STAFF_CONFIRMATION_REQUIRED",
      );
      await assert.rejects(
        command(a, "CANCEL_ROUND", {
          payload: { ...p.payload, confirmed_round_id: randomUUID() },
        }),
      );
      await assert.rejects(
        command(a, "CANCEL_ROUND", {
          payload: { ...p.payload, arena_id: randomUUID() },
        }),
      );
      assert.equal(
        (await command(a, "CANCEL_ROUND", { expectedRevision: "0" })).result
          .reason,
        "STALE_VERSION",
      );
      for (const incident_ref of ["", " ", "A".repeat(121), "bad\0ref"])
        await assert.rejects(
          command(a, "CANCEL_ROUND", {
            payload: { ...p.payload, incident_ref },
          }),
        );
      assert.equal(
        (await query("SELECT state FROM rounds WHERE id=$1", [a.round]))[0]
          .state,
        "RUNNING",
      );
      assert.equal((await command(a)).result.status, "APPLIED");
      await command(a, "FINISH_CANCEL");
    },
  );
  await t.test(
    "HTTP cancellation uses existing staff CSRF and GET-only original outcomes with explicit cancelled standings",
    async () => {
      const a = await c.newRound(),
        p = await intent(a),
        browser = {
          mode: "production" as const,
          origin: "https://cancel.test",
          cookieKey: randomBytes(32),
          csrfKey: randomBytes(32),
        },
        policy = browserPolicy(browser);
      const app = buildApp({
        database: { check: async () => {}, close: async () => {} },
        entry: {
          pool: c.api,
          clock: c.clock,
          delivery: c.delivery,
          browser,
          competition: c.deps,
        },
      });
      try {
        const anon = await app.inject({
            url: "/api/v1/bootstrap?audience=ANONYMOUS",
          }),
          cookies = new Map<string, string>();
        for (const v of anon.cookies)
          cookies.set(v.name, encodeURIComponent(v.value));
        cookies.set(policy.names.staff, c.staff.sessionCookie);
        const jar = () => [...cookies].map(([k, v]) => `${k}=${v}`).join("; ");
        const boot = await app.inject({
          url: "/api/v1/bootstrap?audience=STAFF",
          headers: { cookie: jar() },
        });
        for (const v of boot.cookies)
          cookies.set(v.name, encodeURIComponent(v.value));
        const url = `/api/v1/staff/competition/rounds/${a.round}/commands`,
          body = {
            action: p.action,
            expected_revision: p.expectedRevision,
            request_key: p.requestKey,
            own_code: p.ownCode,
            reason: p.reason,
            payload: p.payload,
          };
        assert.equal(
          (
            await app.inject({
              method: "POST",
              url,
              headers: { origin: browser.origin, cookie: jar() },
              payload: body,
            })
          ).statusCode,
          403,
        );
        await c.budgets();
        const reply = await app.inject({
          method: "POST",
          url,
          headers: {
            origin: browser.origin,
            cookie: jar(),
            "x-csrf-token": boot.json().data.csrf_token,
          },
          payload: body,
        });
        assert.equal(reply.statusCode, 200, reply.body);
        assert.equal(reply.json().data.result.status, "APPLIED");
        assert.ok(reply.json().data.result.cancellation_id);
        assert.match(reply.headers["cache-control"] as string, /no-store/);
        const recovered = await app.inject({
          url: `/api/v1/staff/competition/rounds/${a.round}/outcomes/${p.requestKey}`,
          headers: { cookie: jar() },
        });
        assert.deepEqual(recovered.json().data.outcome, reply.json().data);
        const metadata = await app.inject({
          url: `/api/v1/staff/competition/rounds/${a.round}/cancellation`,
          headers: { cookie: jar() },
        });
        assert.equal(metadata.statusCode, 200, metadata.body);
        assert.equal(
          metadata.json().data.cancellation.incident_ref,
          "OPS-TEST-01",
        );
        await command(a, "FINISH_CANCEL");
      } finally {
        await app.close();
      }
    },
  );
  await t.test(
    "emergency fencing is atomic while a larger logical backlog drains in bounded batches without executing code",
    async () => {
      const old = await c.newRound(),
        snapshot = (
          await query(
            "SELECT snapshot_id FROM bounties WHERE round_id=$1 ORDER BY position LIMIT 1",
            [old.round],
          )
        )[0].snapshot_id;
      await command(old);
      await command(old, "FINISH_CANCEL");
      const teams = [];
      for (let i = 0; i < 25; i++) {
        const id = randomUUID(),
          member = randomUUID(),
          code = newAccessCode();
        await c.owner.query(
          "INSERT INTO teams(id,display_name) VALUES($1,$2)",
          [id, `Synthetic cancellation team ${i}`],
        );
        await c.owner.query(
          "INSERT INTO team_members(id,team_id,position,display_name) VALUES($1,$2,1,'First'),($3,$2,2,'Second')",
          [member, id, randomUUID()],
        );
        await c.owner.query(
          "INSERT INTO access_credentials(id,team_id,verifier,version,issued_at) VALUES($1,$2,$3,1,date_trunc('milliseconds',clock_timestamp()))",
          [randomUUID(), id, code.verifier],
        );
        teams.push({ id, member, code: code.code });
      }
      await c.budgets();
      const made = await createArenaService(c.api, c.clock, c.delivery).command(
        c.staff.sessionCookie,
        {
          action: "CREATE",
          roundId: null,
          requestKey: randomUUID(),
          expectedRevision: (
            await query("SELECT revision FROM arena_control WHERE id=1")
          )[0].revision,
          durationMs: 18000000,
          teamIds: teams.map((v) => v.id),
          reason: "Synthetic bounded cancellation batch",
        },
      );
      const a = { ...old, round: made.round_id! };
      await command(a, "CONFIGURE", { payload: { snapshots: [snapshot] } });
      await command(a, "READY");
      await command(a, "START");
      a.x = (
        await query("SELECT id FROM bounties WHERE round_id=$1", [a.round])
      )[0].id;
      const entry = createEntryService(c.api, c.clock, c.delivery);
      for (const team of teams) {
        await c.budgets();
        const f = await entry.begin(team.code, {
          ip: "127.0.0.1",
          browserId: randomUUID(),
        });
        if (f.audience !== "TEAM") throw Error("Synthetic team entry");
        const s = await entry.activate(f.proofCookie, {
          memberId: team.member,
          language: "cpp",
          requestKey: randomUUID(),
        });
        if (s.status !== "ACTIVATED") throw Error("Synthetic activation");
        await admit(a, "submit", s.sessionCookie);
        await admit(a, "run", s.sessionCookie);
      }
      const sends = [...c.sent.entries()];
      await command(a);
      assert.equal(
        (
          await query(
            "SELECT count(*)::int n FROM participant_judging WHERE round_id=$1 AND status='CANCELLED'",
            [a.round],
          )
        )[0].n,
        20,
      );
      assert.equal(
        (await query("SELECT state FROM rounds WHERE id=$1", [a.round]))[0]
          .state,
        "CANCELLING",
      );
      const first = await c.service.cancellation(
        c.staff.sessionCookie,
        a.round,
      );
      assert.equal(first.pending_work, 10);
      const second = await c.service.cancellation(
        c.staff.sessionCookie,
        a.round,
      );
      assert.equal(second.pending_work, 0);
      assert.equal(second.cancelled_work, 50);
      assert.deepEqual([...c.sent.entries()], sends);
      assert.equal(
        (await command(a, "FINISH_CANCEL")).result.status,
        "APPLIED",
      );
    },
  );
}
