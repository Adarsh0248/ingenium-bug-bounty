import assert from "node:assert/strict";
import { standingsParity } from "./standings-parity.js";
import { randomBytes, randomUUID } from "node:crypto";
import type { TestContext } from "node:test";
import type { participantJudgingChecks } from "./participant-judging.checks.js";
import { AccessError } from "../../src/access/transaction.js";
import { createCompetitionService } from "../../src/competition/service.js";
import { createStaffService } from "../../src/access/staff-service.js";
import { parseProof, sha256 } from "../../src/access/credentials.js";
import { buildApp } from "../../src/app.js";
import { browserPolicy } from "../../src/access/browser-policy.js";
import type { CompetitionCommand } from "../../src/competition/service.js";
import { resultsExportBrowserChecks } from "./results-export-browser.checks.js";
import { createLiveService } from "../../src/live/service.js";

type Arena = Awaited<
  ReturnType<Parameters<typeof participantJudgingChecks>[1]["newRound"]>
>;
export async function resultsExportChecks(
  t: TestContext,
  c: Parameters<typeof participantJudgingChecks>[1] & {
    newStaff(
      role?: string,
    ): Promise<{ id: string; code: string; sessionCookie: string }>;
    startRace(round: string): Promise<Arena>;
  },
) {
  const liveService = createLiveService(c.api, c.clock, c.delivery);
  const query = async (sql: string, args: unknown[] = []) =>
      (await c.owner.query(sql, args)).rows,
    actor = await c.newStaff(),
    organiser = await c.newStaff("ORGANISER"),
    admin = await c.newStaff("SUPER_ADMIN"),
    first = await c.newRound(),
    read = (cookie = actor.sessionCookie, round = first.round) =>
      c.service.results(cookie, round),
    denied = (code: string) => (e: unknown) =>
      e instanceof AccessError && e.code === code;
  async function assertLive(round: string, final: boolean) {
    const view = await liveService.guarded(
      { audience: "STAFF", cookie: actor.sessionCookie, roundId: round },
      liveService.snapshot,
    );
    const original = (
      await query(
        "SELECT COALESCE((SELECT standings FROM round_results WHERE round_id=$1),competition_standings($1)) AS standings",
        [round],
      )
    )[0].standings as Record<string, unknown>[];
    assert.equal(view.final, final);
    assert.deepEqual(
      view.standings,
      original.map(({ wallet: _wallet, ...row }) => row),
    );
  }
  async function control(
    round: string,
    action: CompetitionCommand["action"],
    payload = {},
  ) {
    await c.budgets();
    return c.service.command(c.staff.sessionCookie, {
      action,
      roundId: round,
      payload,
      requestKey: randomUUID(),
      expectedRevision: (
        await query("SELECT revision FROM rounds WHERE id=$1", [round])
      )[0].revision,
      reason: "Synthetic result export lifecycle",
      ownCode: c.staff.code,
    });
  }
  await t.test(
    "results export refuses running, paused and closing rounds before finalisation",
    async () => {
      await assertLive(first.round, false);
      await assert.rejects(read(), denied("ACCESS_UNAVAILABLE"));
      await control(first.round, "PAUSE", { scope: "GLOBAL", target: null });
      await assert.rejects(read(), denied("ACCESS_UNAVAILABLE"));
      await control(first.round, "RESUME", { scope: "GLOBAL", target: null });
      await control(first.round, "CLOSE");
      await assert.rejects(read(), denied("ACCESS_UNAVAILABLE"));
      await control(first.round, "FINALISE");
      await assertLive(first.round, true);
    },
  );
  const pending = await read(),
    original = (
      await query("SELECT * FROM round_results WHERE round_id=$1", [
        first.round,
      ])
    )[0];
  await t.test(
    "all normal staff roles export an exact safe frozen snapshot with tied ranks and pending qualification",
    async () => {
      assert.equal(pending.result_id, original.id);
      assert.equal(pending.finalised_at, original.finalised_at.toISOString());
      assert.equal(
        pending.standings_sha256,
        sha256(
          JSON.stringify(
            pending.standings.map(({ qualified: _decision, ...s }) => s),
          ),
        ).toString("hex"),
      );
      assert.notEqual(
        pending.standings_sha256,
        original.digest.toString("hex"),
      );
      assert.ok(
        !JSON.stringify(pending).includes(original.digest.toString("hex")),
      );
      assert.ok(
        !JSON.stringify(pending).includes(
          original.config_digest.toString("hex"),
        ),
      );
      assert.equal(pending.qualification_status, "PENDING");
      assert.deepEqual(
        pending.standings.map((s) => s.rank),
        [1, 1],
      );
      assert.ok(pending.standings.every((s) => s.qualified === null));
      for (const { wallet: _private, ...s } of original.standings)
        assert.deepEqual(
          pending.standings.find(
            (row) => row.team_round_id === s.team_round_id,
          ),
          { ...s, qualified: null },
        );
      const before =
        await query(`SELECT (SELECT jsonb_agg(to_jsonb(s) ORDER BY id) FROM staff_sessions s) sessions,
      (SELECT jsonb_agg(to_jsonb(r) ORDER BY id) FROM rounds r) rounds,(SELECT count(*) FROM competition_outcomes) receipts,
      (SELECT count(*) FROM wallet_entries) wallets,(SELECT count(*) FROM execution_capacity_slots) slots`);
      for (const cookie of [
        actor.sessionCookie,
        organiser.sessionCookie,
        admin.sessionCookie,
      ])
        assert.deepEqual(await read(cookie), pending);
      assert.deepEqual(
        await query(`SELECT (SELECT jsonb_agg(to_jsonb(s) ORDER BY id) FROM staff_sessions s) sessions,
      (SELECT jsonb_agg(to_jsonb(r) ORDER BY id) FROM rounds r) rounds,(SELECT count(*) FROM competition_outcomes) receipts,
      (SELECT count(*) FROM wallet_entries) wallets,(SELECT count(*) FROM execution_capacity_slots) slots`),
        before,
      );
      assert.doesNotMatch(
        JSON.stringify(pending),
        /wallet|member_name|source|hint|verifier|credential|stdout|expected_output/,
      );
    },
  );
  await t.test(
    "locked qualification is reported separately from ranks without rewriting frozen results",
    async () => {
      await control(first.round, "QUALIFY");
      await assertLive(first.round, true);
      const locked = await read(),
        selected = (
          await query(
            "SELECT selected FROM qualification_decisions WHERE result_id=$1",
            [original.id],
          )
        )[0].selected as string[];
      assert.equal(locked.qualification_status, "LOCKED");
      for (const s of locked.standings)
        assert.equal(s.qualified, selected.includes(s.team_round_id));
      assert.deepEqual(
        locked.standings.map((s) => s.rank),
        [1, 1],
      );
      assert.equal(locked.standings_sha256, pending.standings_sha256);
      assert.equal(locked.finalised_at, pending.finalised_at);
      assert.deepEqual(
        (
          await query("SELECT * FROM round_results WHERE id=$1", [original.id])
        )[0],
        original,
      );
    },
  );
  const next = await c.newRound();
  async function solve(cookie: string, round: string, bounty: string) {
    await c.budgets();
    const response = await c.service.submit(
        cookie,
        round,
        bounty,
        "Synthetic safe export fixture source",
        randomUUID(),
      ),
      id = response.result.submission_id as string;
    assert.equal(response.result.status, "ADMITTED");
    c.answers.set(id, "PASSED");
    await c.judge.claim();
    for (
      let n = 0;
      n < 100 &&
      !(
        await query(
          "SELECT completed_at FROM participant_judging WHERE id=$1",
          [id],
        )
      )[0].completed_at;
      n++
    )
      await c.judge.tick();
    assert.equal(
      (
        await query(
          "SELECT verdict FROM competition_assessments WHERE submission_id=$1",
          [id],
        )
      )[0]?.verdict,
      "PASSED",
    );
  }
  await solve(next.aa, next.round, next.x);
  await c.budgets();
  await c.service.buyHint(next.ab, next.round, next.y, 1, randomUUID());
  const race = await c.startRace(next.round);
  await solve(race.ba, race.round, race.x);
  await control(race.round, "CLOSE");
  await control(race.round, "FINALISE");
  const final = await c.service.results(actor.sessionCookie, race.round);
  await t.test(
    "earned points, hint debits and both-round ranking times match canonical results without exposing balances",
    async () => {
      const r1 = await c.service.results(actor.sessionCookie, next.round),
        snapshot = (
          await query("SELECT standings FROM round_results WHERE round_id=$1", [
            next.round,
          ])
        )[0].standings;
      for (const { wallet: _private, ...s } of snapshot)
        assert.deepEqual(
          r1.standings.find((row) => row.team_round_id === s.team_round_id),
          { ...s, qualified: true },
        );
      assert.ok(
        r1.standings.some(
          (s) =>
            s.points > 0 &&
            s.difficulties.length === 1 &&
            s.effective_time_ms === s.solve_time_ms + s.penalty_ms,
        ),
      );
      assert.ok(
        final.standings.some(
          (s) => s.points > 0 && s.difficulties.length === 1,
        ),
      );
      assert.ok(final.standings.some((s) => s.points === 0));
    },
  );
  const live = await c.newRound();
  await t.test(
    "round two has no qualification claim and older exports remain scoped after a new arena starts",
    async () => {
      assert.equal(final.round_kind, 2);
      assert.equal(final.qualification_status, "NOT_APPLICABLE");
      assert.ok(final.standings.every((s) => s.qualified === null));
      assert.notEqual(final.arena_id, pending.arena_id);
      assert.deepEqual(
        await c.service.results(actor.sessionCookie, race.round),
        final,
      );
      assert.equal((await read()).round_id, first.round);
      await assert.rejects(read(first.aa));
      await assert.rejects(read("invalid"));
      await assert.rejects(read(actor.sessionCookie, randomUUID()));
      const badClock = {
        ...c.clock,
        assertHealthy() {
          throw new AccessError("CLOCK_UNTRUSTED");
        },
      };
      await assert.rejects(
        createCompetitionService(c.api, badClock, c.delivery).results(
          actor.sessionCookie,
          first.round,
        ),
        denied("CLOCK_UNTRUSTED"),
      );
    },
  );
  await t.test(
    "cancelling and cancelled rounds have no competitive final export",
    async () => {
      const arena = (
        await query("SELECT arena_instance_id FROM rounds WHERE id=$1", [
          live.round,
        ])
      )[0].arena_instance_id;
      const cancellation = await control(live.round, "CANCEL_ROUND", {
        arena_id: arena,
        confirmed_round_id: live.round,
        incident_ref: "EXPORT-CANCEL-TEST",
      });
      await assert.rejects(
        read(actor.sessionCookie, live.round),
        denied("ACCESS_UNAVAILABLE"),
      );
      await control(live.round, "FINISH_CANCEL", {
        arena_id: arena,
        cancellation_id: cancellation.result.cancellation_id,
      });
      assert.equal(
        (await query("SELECT state FROM rounds WHERE id=$1", [live.round]))[0]
          .state,
        "CANCELLED",
      );
      await assert.rejects(
        read(actor.sessionCookie, live.round),
        denied("ACCESS_UNAVAILABLE"),
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
        competition: c.deps,
      },
    });
  await app.ready();
  try {
    await t.test(
      "results HTTP is staff-only, strict, bounded and no-store with no HEAD or public export alias",
      async () => {
        await c.budgets();
        const url = `/api/v1/staff/competition/rounds/${race.round}/results`,
          headers = {
            cookie: `${policy.names.staff}=${organiser.sessionCookie}`,
          };
        assert.equal(
          (await app.inject({ method: "GET", url })).statusCode,
          401,
        );
        const response = await app.inject({ method: "GET", url, headers });
        assert.equal(response.statusCode, 200, response.body);
        assert.deepEqual(response.json().data, final);
        assert.equal(response.headers["cache-control"], "no-store");
        assert.ok(Buffer.byteLength(response.body) < 270336);
        for (const suffix of [
          "?include_source=true",
          "?team_id=" + randomUUID(),
          "?format=csv",
        ])
          assert.equal(
            (await app.inject({ method: "GET", url: url + suffix, headers }))
              .statusCode,
            400,
          );
        assert.equal(
          (await app.inject({ method: "HEAD", url, headers })).statusCode,
          404,
        );
        assert.equal(
          app.hasRoute({
            method: "POST",
            url: "/api/v1/staff/competition/rounds/:round_id/results",
          }),
          false,
        );
        assert.equal(
          (await app.inject({ method: "POST", url, headers })).statusCode,
          403,
        );
        assert.equal(
          (
            await app.inject({
              method: "GET",
              url: url.replace("/staff/competition", "/competition"),
              headers,
            })
          ).statusCode,
          404,
        );
        assert.equal(
          (
            await app.inject({
              method: "GET",
              url,
              headers: { cookie: `${policy.names.participant}=${first.aa}` },
            })
          ).statusCode,
          401,
        );
      },
    );
  } finally {
    await app.close();
  }
  if (
    !process.env.INGENIUM_TEST_SUITE ||
    process.env.INGENIUM_TEST_SUITE === "results-browser"
  )
    await t.test(
      "browser exports both historical rounds, refuses stale replies, retries reads and handles revoked authority",
      async () => {
        await resultsExportBrowserChecks(c, {
          actor: organiser,
          first: next.round,
          final,
        });
      },
    );
  await t.test(
    "logout removes export authority without mutating locked results",
    async () => {
      await c.budgets();
      await createStaffService(c.api, c.clock, c.delivery).logout(
        actor.sessionCookie,
      );
      await assert.rejects(read(), denied("INVALID_SESSION"));
      assert.equal(
        (await c.service.results(admin.sessionCookie, race.round)).result_id,
        final.result_id,
      );
      assert.equal(
        (
          await query(
            "SELECT revoked_at IS NOT NULL revoked FROM staff_sessions WHERE id=$1",
            [parseProof(actor.sessionCookie)!.id],
          )
        )[0].revoked,
        true,
      );
    },
  );
  await t.test(
    "aggregate standings preserve the exact historical awards, hint debits and second-round rankings",
    async () => {
      await standingsParity(c.owner);
    },
  );
  await t.test(
    "fixture transitions finalise an active second round normally instead of discarding its live instance",
    async () => {
      const first = await c.newRound(),
        second = await c.startRace(first.round),
        locked = await c.service.results(c.staff.sessionCookie, first.round);
      await assert.rejects(
        control(first.round, "DISCARD"),
        /Live instance cannot be discarded/,
      );
      const next = await c.newRound();
      assert.notEqual(next.round, second.round);
      assert.deepEqual(
        await c.service.results(c.staff.sessionCookie, first.round),
        locked,
      );
      const [old] = await query(
        "SELECT r.state,a.status FROM rounds r JOIN arena_instances a ON a.id=r.arena_instance_id WHERE r.id=$1",
        [second.round],
      );
      assert.equal(old.state, "CLOSED");
      assert.equal(old.status, "COMPLETED");
      assert.equal(
        (await query("SELECT state FROM rounds WHERE id=$1", [next.round]))[0]
          .state,
        "RUNNING",
      );
    },
  );
}
