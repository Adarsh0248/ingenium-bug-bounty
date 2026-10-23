import assert from "node:assert/strict";
import { standingsParity } from "./standings-parity.js";
import { randomBytes, randomUUID } from "node:crypto";
import type { TestContext } from "node:test";
import type { Pool } from "pg";
import { createDisciplineService } from "../../src/access/discipline.js";
import type { DisciplineCommand } from "../../src/access/discipline.js";
import { createEntryService } from "../../src/access/entry-service.js";
import { createReplacementService } from "../../src/access/replacement-service.js";
import { AccessError } from "../../src/access/transaction.js";
import type { ClockGuard } from "../../src/access/transaction.js";
import type { SessionDelivery } from "../../src/access/credentials.js";
import type {
  createCompetitionService,
  CompetitionDependencies,
} from "../../src/competition/service.js";
import { buildApp } from "../../src/app.js";
import { browserPolicy } from "../../src/access/browser-policy.js";
import { createLiveService } from "../../src/live/service.js";

interface Context {
  owner: Pool;
  api: Pool;
  clock: ClockGuard;
  delivery: SessionDelivery;
  deps: CompetitionDependencies;
  staff: { sessionCookie: string; code: string };
  organiser: { sessionCookie: string; code: string };
  teams: { id: string; members: string[]; code: string }[];
  service: ReturnType<typeof createCompetitionService>;
  budgets(): Promise<void>;
  judge: { tick(): Promise<string> };
  answers: Map<string, string>;
  newRound(): Promise<{
    round: string;
    aa: string;
    ab: string;
    ba: string;
    x: string;
  }>;
  startRace(round: string): Promise<{ round: string; aa: string; x: string }>;
}
export async function disciplineChecks(t: TestContext, c: Context) {
  const raw = createDisciplineService(c.api, c.clock, c.delivery),
    entry = createEntryService(c.api, c.clock, c.delivery);
  const live = createLiveService(c.api, c.clock, c.delivery);
  const query = async (sql: string, p: unknown[] = []) =>
    (await c.owner.query(sql, p)).rows;
  const team = c.teams[0]!;
  async function input(
    round: string,
    patch: Partial<DisciplineCommand> = {},
  ): Promise<DisciplineCommand> {
    const r = (await query("SELECT * FROM rounds WHERE id=$1", [round]))[0];
    return {
      action: "PENALISE",
      arenaId: r.arena_instance_id,
      teamId: team.id,
      memberId: null,
      roundId: round,
      blockId: null,
      originalId: null,
      minutes: 7,
      expectedRevision: r.revision,
      requestKey: randomUUID(),
      reason: "Synthetic discipline evidence",
      ownCode: c.staff.code,
      ...patch,
    };
  }
  const command = async (p: DisciplineCommand) => {
    await c.budgets();
    return raw.command(c.staff.sessionCookie, p);
  };
  const standing = async (r: string) => {
    const rows = (
      await query("SELECT competition_standings($1) AS rows", [r])
    )[0].rows as Record<string, any>[];
    const view = await live.guarded(
      { audience: "STAFF", cookie: c.staff.sessionCookie, roundId: r },
      live.snapshot,
    );
    assert.deepEqual(
      view.standings,
      rows.map(({ wallet: _wallet, ...row }) => row),
    );
    return rows;
  };
  const control = async (
    round: string,
    action: "PAUSE" | "CLOSE" | "FINALISE",
    payload: Record<string, unknown> = {},
  ) => {
    await c.budgets();
    return c.service.command(c.staff.sessionCookie, {
      action,
      roundId: round,
      requestKey: randomUUID(),
      expectedRevision: (
        await query("SELECT revision FROM rounds WHERE id=$1", [round])
      )[0].revision,
      reason: "Synthetic discipline lifecycle",
      ownCode: c.staff.code,
      payload,
    });
  };
  await t.test(
    "manual time is once-only, source-bound, capped, reversible and changes only time-based rankings",
    async () => {
      const a = await c.newRound(),
        before = await standing(a.round),
        p = await input(a.round, { minutes: 300 });
      await c.budgets();
      const [one, two] = await Promise.all([
        raw.command(c.staff.sessionCookie, p),
        raw.command(c.staff.sessionCookie, p),
      ]);
      assert.deepEqual(one, two);
      assert.equal(one.outcome.outcome, "APPLIED");
      const after = await standing(a.round),
        ours = after.find((v) => v.team_id === team.id)!;
      assert.equal(ours.penalty_ms, 18000000);
      assert.equal(ours.rank, 2);
      for (const r of after) {
        const old = before.find((v) => v.team_id === r.team_id)!;
        for (const k of ["points", "wallet", "solve_time_ms", "difficulties"])
          assert.deepEqual(r[k], old[k]);
      }
      assert.equal(
        (await command(await input(a.round, { minutes: 1 }))).outcome.reason,
        "PENALTY_CAP",
      );
      const reverse = await input(a.round, {
        action: "REVERSE",
        minutes: null,
        originalId: one.outcome.outcome_id,
      });
      const r = await command(reverse);
      assert.equal(r.outcome.outcome, "APPLIED");
      assert.deepEqual(await command(reverse), r);
      assert.equal(
        (
          await command(
            await input(a.round, {
              action: "REVERSE",
              minutes: null,
              originalId: one.outcome.outcome_id,
            }),
          )
        ).outcome.reason,
        "ALREADY_REVERSED",
      );
      assert.deepEqual(await standing(a.round), before);
      await assert.rejects(command({ ...p, reason: "Changed payload" }), {
        code: "P0002",
      });
      assert.deepEqual(
        (await raw.outcome(c.staff.sessionCookie, p.requestKey)).outcome,
        one.outcome,
      );
      assert.equal(
        (
          await raw
            .outcome(c.organiser.sessionCookie, p.requestKey)
            .catch((e) => e)
        ).code,
        "ACCESS_UNAVAILABLE",
      );
    },
  );
  await t.test(
    "member and team blocks overlap, revoke only their scope and clearing never revives a grant",
    async () => {
      const a = await c.newRound(),
        base = await input(a.round, {
          action: "BLOCK",
          roundId: null,
          minutes: null,
          memberId: team.members[0]!,
        });
      base.expectedRevision = (
        await query("SELECT revision FROM security_control WHERE id=1")
      )[0].revision;
      const one = await command(base);
      assert.equal(one.outcome.outcome, "APPLIED");
      await assert.rejects(
        entry.inspect(a.aa),
        (e: unknown) =>
          e instanceof AccessError && e.code === "INVALID_SESSION",
      );
      await entry.inspect(a.ab);
      await entry.inspect(a.ba);
      const frozen = await query(
        "SELECT id,language,enrolled_at FROM member_rounds WHERE round_id=$1 ORDER BY id",
        [a.round],
      );
      const teamBlock = {
        ...base,
        memberId: null,
        requestKey: randomUUID(),
        expectedRevision: (
          await query("SELECT revision FROM security_control WHERE id=1")
        )[0].revision,
      };
      const two = await command(teamBlock);
      await assert.rejects(entry.inspect(a.ab));
      await entry.inspect(a.ba);
      const clear = {
        ...teamBlock,
        action: "UNBLOCK" as const,
        blockId: two.outcome.block_id,
        requestKey: randomUUID(),
        expectedRevision: (
          await query("SELECT revision FROM security_control WHERE id=1")
        )[0].revision,
      };
      assert.equal((await command(clear)).outcome.outcome, "APPLIED");
      let data = await raw.inspect(
        c.staff.sessionCookie,
        base.arenaId,
        team.id,
        a.round,
      );
      assert.equal(data.blocks.length, 1);
      assert.equal(data.blocks[0]!.member_id, team.members[0]);
      await assert.rejects(entry.inspect(a.ab));
      await assert.rejects(entry.inspect(a.aa));
      await command({
        ...clear,
        memberId: base.memberId,
        blockId: one.outcome.block_id,
        requestKey: randomUUID(),
        expectedRevision: data.security_revision,
      });
      data = await raw.inspect(
        c.staff.sessionCookie,
        base.arenaId,
        team.id,
        a.round,
      );
      assert.equal(data.blocks.length, 0);
      assert.deepEqual(
        await query(
          "SELECT id,language,enrolled_at FROM member_rounds WHERE round_id=$1 ORDER BY id",
          [a.round],
        ),
        frozen,
      );
      assert.equal(
        (
          await query(
            "SELECT count(*)::int n FROM session_deliveries d JOIN participant_sessions s ON s.id=d.session_id WHERE s.team_id=$1 AND s.round_id=$2 AND d.ciphertext IS NOT NULL",
            [team.id, a.round],
          )
        )[0].n,
        0,
      );
      assert.equal(
        (
          await query(
            "SELECT count(*)::int n FROM member_session_slots WHERE member_id=ANY($1::uuid[]) AND (session_id IS NOT NULL OR reservation_flow_id IS NOT NULL)",
            [team.members],
          )
        )[0].n,
        0,
      );
    },
  );
  await t.test(
    "team blocking retires pending and approved handoffs and their encrypted proofs without restoring slots",
    async () => {
      const a = await c.newRound(),
        replacements = createReplacementService(c.api, c.clock, c.delivery),
        requests = [];
      for (const memberId of team.members) {
        await c.budgets();
        const flow = await entry.begin(team.code, {
          ip: "127.0.0.1",
          browserId: randomUUID(),
        });
        if (flow.audience !== "TEAM") throw Error("Synthetic team flow");
        const r = await replacements.request(flow.proofCookie, {
          memberId,
          requestKey: randomUUID(),
        });
        if (r.status !== "REQUESTED")
          throw Error("Synthetic replacement request");
        requests.push(r);
      }
      const approved = requests[1]!,
        row = (await replacements.list(c.staff.sessionCookie)).items.find(
          (r) => r.request_id === approved.request.request_id,
        )!;
      await c.budgets();
      await replacements.decide(c.staff.sessionCookie, {
        flowId: row.request_id,
        requestKey: randomUUID(),
        action: "APPROVE",
        expectedRevision: row.expected_revision,
        reason: "Synthetic approved handoff",
      });
      const p = await input(a.round, {
        action: "BLOCK",
        roundId: null,
        minutes: null,
      });
      p.expectedRevision = (
        await query("SELECT revision FROM security_control WHERE id=1")
      )[0].revision;
      const blocked = await command(p);
      assert.equal(blocked.outcome.outcome, "APPLIED");
      const sources = await query(
        "SELECT state,proof_ciphertext,proof_purged_at FROM replacement_requests WHERE flow_id=ANY($1::uuid[])",
        [requests.map((r) => r.request.request_id)],
      );
      assert.equal(sources.length, 2);
      for (const r of sources) {
        assert.equal(r.state, "SUPERSEDED");
        assert.equal(r.proof_ciphertext, null);
        assert.ok(r.proof_purged_at);
      }
      assert.equal(
        (
          await query(
            "SELECT count(*)::int n FROM member_session_slots WHERE member_id=ANY($1::uuid[]) AND (session_id IS NOT NULL OR reservation_flow_id IS NOT NULL)",
            [team.members],
          )
        )[0].n,
        0,
      );
      for (const r of requests)
        await assert.rejects(
          replacements.activate(r.proofCookie, randomUUID()),
        );
      await command({
        ...p,
        action: "UNBLOCK",
        blockId: blocked.outcome.block_id,
        requestKey: randomUUID(),
        expectedRevision: (
          await query("SELECT revision FROM security_control WHERE id=1")
        )[0].revision,
      });
      for (const r of requests)
        await assert.rejects(
          replacements.activate(r.proofCookie, randomUUID()),
        );
      await assert.rejects(entry.inspect(a.aa));
    },
  );
  await t.test(
    "blocking does not cancel admitted judging or change results, funding or another team's access",
    async () => {
      const a = await c.newRound();
      await c.budgets();
      const admitted = await c.service.submit(
          a.aa,
          a.round,
          a.x,
          "Synthetic correct code",
          randomUUID(),
        ),
        id = admitted.result.submission_id as string;
      c.answers.set(id, "PASSED");
      const p = await input(a.round, {
        action: "BLOCK",
        roundId: null,
        minutes: null,
      });
      p.expectedRevision = (
        await query("SELECT revision FROM security_control WHERE id=1")
      )[0].revision;
      const receipt = await command(p);
      assert.equal(receipt.outcome.outcome, "APPLIED");
      for (
        let i = 0;
        i < 40 &&
        !(
          await query(
            "SELECT completed_at FROM participant_judging WHERE id=$1",
            [id],
          )
        )[0].completed_at;
        i++
      )
        await c.judge.tick();
      const parent = (
        await query(
          "SELECT status,result FROM participant_judging WHERE id=$1",
          [id],
        )
      )[0];
      assert.equal(parent.status, "COMPLETED");
      assert.equal(parent.result, "PASSED");
      assert.equal(
        (
          await query(
            "SELECT count(*)::int n FROM bounty_awards WHERE submission_id=$1",
            [id],
          )
        )[0].n,
        1,
      );
      await entry.inspect(a.ba);
      await assert.rejects(c.service.judging(a.aa, a.round, id));
      const events = JSON.stringify(
        await query(
          "SELECT patch FROM live_deliveries WHERE patch::text LIKE '%Synthetic discipline evidence%'",
        ),
      );
      assert.equal(events, "[]");
    },
  );
  await t.test(
    "roles, confirmation, stale versions, scope and database write boundaries are enforced",
    async () => {
      const a = await c.newRound(),
        p = await input(a.round);
      await c.budgets();
      await assert.rejects(
        raw.command(c.organiser.sessionCookie, {
          ...p,
          ownCode: c.organiser.code,
        }),
        (e: unknown) =>
          e instanceof AccessError && e.code === "ACCESS_UNAVAILABLE",
      );
      await assert.rejects(
        command({ ...p, ownCode: c.organiser.code }),
        (e: unknown) =>
          e instanceof AccessError && e.code === "STAFF_CONFIRMATION_REQUIRED",
      );
      assert.equal(
        (await command({ ...p, expectedRevision: "0" })).outcome.reason,
        "STALE_VERSION",
      );
      for (const minutes of [0, -1, 301, 1.5])
        await assert.rejects(command({ ...p, minutes }));
      await assert.rejects(
        command({
          ...p,
          action: "REVERSE",
          minutes: null,
          originalId: randomUUID(),
        }),
      );
      await assert.rejects(
        command({
          ...p,
          action: "BLOCK",
          roundId: null,
          minutes: null,
          memberId: c.teams[1]!.members[0]!,
        }),
      );
      await assert.rejects(
        c.api.query("INSERT INTO discipline_outcomes(id) VALUES($1)", [
          randomUUID(),
        ]),
        { code: "42501" },
      );
      await assert.rejects(
        c.api.query("UPDATE discipline_outcomes SET reason='rewrite'"),
        { code: "42501" },
      );
      await assert.rejects(
        c.owner.query(
          "UPDATE discipline_outcomes SET reason='rewrite' WHERE id=(SELECT id FROM discipline_outcomes LIMIT 1)",
        ),
      );
    },
  );
  await t.test(
    "penalties work while paused and closing, race finalisation safely, and cannot edit locked results",
    async () => {
      const a = await c.newRound();
      await control(a.round, "PAUSE", {
        scope: "TEAM",
        target: (
          await query(
            "SELECT id FROM team_rounds WHERE round_id=$1 AND team_id=$2",
            [a.round, team.id],
          )
        )[0].id,
      });
      const added = await command(await input(a.round));
      assert.equal(added.outcome.outcome, "APPLIED");
      await control(a.round, "CLOSE");
      assert.equal(
        (await command(await input(a.round))).outcome.outcome,
        "APPLIED",
      );
      const p = await input(a.round),
        rev = p.expectedRevision;
      await c.budgets();
      const [penalty, final] = await Promise.all([
        raw.command(c.staff.sessionCookie, p),
        c.service.command(c.staff.sessionCookie, {
          action: "FINALISE",
          roundId: a.round,
          requestKey: randomUUID(),
          expectedRevision: rev,
          reason: "Synthetic lock race",
          ownCode: c.staff.code,
          payload: {},
        }),
      ]);
      assert.ok(
        penalty.outcome.outcome === "APPLIED" ||
          final.result.status === "APPLIED",
      );
      if (final.result.status !== "APPLIED") await control(a.round, "FINALISE");
      const locked = await query(
        "SELECT standings FROM round_results WHERE round_id=$1",
        [a.round],
      );
      assert.equal(
        (await command(await input(a.round))).outcome.reason,
        "ROUND_UNAVAILABLE",
      );
      assert.equal(
        (
          await command(
            await input(a.round, {
              action: "REVERSE",
              minutes: null,
              originalId: added.outcome.outcome_id,
            }),
          )
        ).outcome.reason,
        "ROUND_UNAVAILABLE",
      );
      assert.deepEqual(
        await query("SELECT standings FROM round_results WHERE round_id=$1", [
          a.round,
        ]),
        locked,
      );
    },
  );
  await t.test(
    "Round 2 has independent manual time and preserves locked Round 1 standings",
    async () => {
      const a = await c.newRound();
      await command(await input(a.round, { minutes: 12 }));
      const b = await c.startRace(a.round),
        prior = await query(
          "SELECT standings FROM round_results WHERE round_id=$1",
          [a.round],
        );
      assert.equal(
        (await standing(b.round)).find((v) => v.team_id === team.id)!
          .penalty_ms,
        0,
      );
      assert.equal(
        (await command(await input(b.round, { minutes: 9 }))).outcome.outcome,
        "APPLIED",
      );
      assert.equal(
        (await standing(b.round)).find((v) => v.team_id === team.id)!
          .penalty_ms,
        540000,
      );
      assert.deepEqual(
        await query("SELECT standings FROM round_results WHERE round_id=$1", [
          a.round,
        ]),
        prior,
      );
      await control(b.round, "CLOSE");
      await control(b.round, "FINALISE");
    },
  );
  await t.test(
    "HTTP discipline commands require current staff, exact origin, CSRF and private response schemas",
    async () => {
      const a = await c.newRound(),
        p = await input(a.round),
        browser = {
          mode: "production" as const,
          origin: "https://discipline.test",
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
        const anonymous = await app.inject({
          url: "/api/v1/bootstrap?audience=ANONYMOUS",
        });
        const cookies = [
          `${policy.names.staff}=${c.staff.sessionCookie}`,
          ...anonymous.cookies.map(
            (v) => `${v.name}=${encodeURIComponent(v.value)}`,
          ),
        ].join("; ");
        const bootstrap = await app.inject({
          url: "/api/v1/bootstrap?audience=STAFF",
          headers: { cookie: cookies },
        });
        assert.equal(bootstrap.statusCode, 200, bootstrap.body);
        const jar = [
          cookies,
          ...bootstrap.cookies.map(
            (v) => `${v.name}=${encodeURIComponent(v.value)}`,
          ),
        ].join("; ");
        const body = {
          action: p.action,
          arena_id: p.arenaId,
          team_id: p.teamId,
          member_id: null,
          round_id: p.roundId,
          block_id: null,
          original_id: null,
          minutes: 7,
          request_key: p.requestKey,
          expected_revision: p.expectedRevision,
          own_code: p.ownCode,
          reason: p.reason,
        };
        assert.equal(
          (
            await app.inject({
              method: "POST",
              url: "/api/v1/staff/discipline",
              headers: { origin: browser.origin, cookie: jar },
              payload: body,
            })
          ).statusCode,
          403,
        );
        await c.budgets();
        const res = await app.inject({
          method: "POST",
          url: "/api/v1/staff/discipline",
          headers: {
            origin: browser.origin,
            cookie: jar,
            "x-csrf-token": bootstrap.json().data.csrf_token,
          },
          payload: body,
        });
        assert.equal(res.statusCode, 200, res.body);
        assert.equal(res.json().data.outcome.outcome, "APPLIED");
        assert.equal(res.body.includes(p.reason), false);
        assert.match(res.headers["cache-control"] as string, /no-store/);
        const read = await app.inject({
          url: `/api/v1/staff/discipline?arena_id=${p.arenaId}&team_id=${team.id}&round_id=${a.round}`,
          headers: { cookie: jar },
        });
        assert.equal(read.statusCode, 200, read.body);
        assert.equal(read.json().data.manual_minutes, 7);
      } finally {
        await app.close();
      }
    },
  );
  await t.test(
    "aggregate standings preserve all manual penalties/reversals and both-round sporting fields",
    () => standingsParity(c.owner),
  );
}
