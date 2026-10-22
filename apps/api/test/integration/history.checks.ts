import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import type { TestContext } from "node:test";
import { createHistoryService } from "../../src/workbench/history.js";
import { createWorkbenchService } from "../../src/workbench/service.js";
import { createEntryService } from "../../src/access/entry-service.js";
import { parseProof } from "../../src/access/credentials.js";
import { AccessError } from "../../src/access/transaction.js";
import { buildApp } from "../../src/app.js";
import { browserPolicy } from "../../src/access/browser-policy.js";
import type { workbenchChecks } from "./workbench.checks.js";
import { historyBrowserChecks } from "./history-browser.checks.js";

type Context = Parameters<typeof workbenchChecks>[1];
export async function historyChecks(t: TestContext, c: Context) {
  const a = await c.newRound(),
    query = async (sql: string, args: unknown[] = []) =>
      (await c.owner.query(sql, args)).rows;
  let healthy = true;
  const clock = {
      ...c.clock,
      assertHealthy() {
        if (!healthy) throw new AccessError("CLOCK_UNTRUSTED");
        c.clock.assertHealthy();
      },
    },
    history = createHistoryService(c.api, clock),
    workbench = createWorkbenchService(c.api, clock);
  async function complete(id: string) {
    c.answers.set(id, "PASSED");
    await c.judge.claim();
    const end = Date.now() + 15000;
    while (
      !(
        await query(
          "SELECT completed_at FROM participant_judging WHERE id=$1",
          [id],
        )
      )[0].completed_at
    ) {
      assert.ok(Date.now() < end);
      await c.judge.tick();
      await delay(10);
    }
  }
  async function command(
    round: string,
    action: "PAUSE" | "RESUME" | "CLOSE" | "FINALISE",
    payload: Record<string, unknown> = {},
  ) {
    await c.budgets();
    return c.service.command(c.staff.sessionCookie, {
      roundId: round,
      action,
      requestKey: randomUUID(),
      expectedRevision: (
        await query("SELECT revision FROM rounds WHERE id=$1", [round])
      )[0].revision,
      payload,
      reason: "Synthetic history check",
      ownCode: c.staff.code,
    });
  }
  async function unchanged() {
    return query(`SELECT (SELECT jsonb_agg(jsonb_build_array(id,last_activity_at) ORDER BY id) FROM participant_sessions) AS sessions,
      (SELECT count(*) FROM wallet_entries) AS wallet,(SELECT count(*) FROM competition_outcomes) AS outcomes,
      (SELECT count(*) FROM participant_judging) AS jobs,(SELECT count(*) FROM bounty_awards) AS awards,(SELECT count(*) FROM draft_save_outcomes) AS saves`);
  }
  let ownRun = "",
    teammateRun = "",
    official = "",
    rival = "";
  await t.test(
    "history scopes own runs, team submissions, purchased hints and immutable source without renewing activity",
    async () => {
      await c.budgets();
      ownRun = (
        await c.service.run(
          a.aa,
          a.round,
          a.x,
          "original private sample",
          randomUUID(),
        )
      ).result.run_id as string;
      teammateRun = (
        await c.service.run(
          a.ab,
          a.round,
          a.x,
          "teammate private sample",
          randomUUID(),
        )
      ).result.run_id as string;
      official = (
        await c.service.submit(
          a.ab,
          a.round,
          a.x,
          "team official source",
          randomUUID(),
        )
      ).result.submission_id as string;
      rival = (
        await c.service.submit(
          a.ba,
          a.round,
          a.y,
          "opponent source",
          randomUUID(),
        )
      ).result.submission_id as string;
      await workbench.save(a.aa, {
        roundId: a.round,
        bountyId: a.x,
        requestKey: randomUUID(),
        baseRevision: "0",
        source: "newer private draft",
      });
      await workbench.save(a.ab, {
        roundId: a.round,
        bountyId: a.x,
        requestKey: randomUUID(),
        baseRevision: "0",
        source: "teammate draft secret",
      });
      for (const id of [ownRun, teammateRun, official, rival])
        c.answers.set(id, "PASSED");
      for (const id of [ownRun, teammateRun, official, rival])
        await complete(id);
      await c.budgets();
      await c.service.buyHint(a.aa, a.round, a.y, 1, randomUUID());
      await c.budgets();
      const before = await unchanged(),
        rows = await history.attempts(a.aa, a.round);
      assert.deepEqual(
        rows.items.map((r) => r.id).sort(),
        [ownRun, official].sort(),
      );
      assert.equal(
        (await history.execution(a.aa, a.round, ownRun)).source,
        "original private sample",
      );
      assert.equal(
        (await history.execution(a.aa, a.round, official)).source,
        "team official source",
      );
      assert.deepEqual(
        (await history.execution(a.aa, a.round, official)).samples,
        [],
      );
      assert.equal(
        (await history.execution(a.aa, a.round, ownRun)).samples.length,
        1,
      );
      for (const id of [teammateRun, rival, randomUUID()])
        await assert.rejects(history.execution(a.aa, a.round, id));
      const overview = await history.overview(a.aa, a.round);
      assert.equal(overview.final, false);
      assert.equal(overview.cancelled, false);
      assert.equal(overview.wallet, 920);
      assert.equal(
        overview.bounties.find((b) => b.bounty_id === a.x)?.awarded_points,
        1000,
      );
      assert.ok(
        overview.bounties.find((b) => b.bounty_id === a.x)?.draft_saved,
      );
      assert.ok(overview.standings.every((s) => !Object.hasOwn(s, "wallet")));
      assert.deepEqual(
        (await history.wallet(a.aa, a.round)).items.map((w) => w.amount),
        [1000, -80],
      );
      assert.equal(
        (await history.hints(a.ab, a.round, a.y))[0].content,
        "Synthetic protected hint 1",
      );
      assert.deepEqual(await history.hints(a.ba, a.round, a.y), []);
      assert.deepEqual(await unchanged(), before);
    },
  );
  await t.test(
    "attempt pagination uses a scoped stable time/ID cursor and rejects foreign or malformed anchors",
    async () => {
      // Real admissions and the synthetic judge exercise the same constraints as event attempts.
      for (let i = 0; i < 49; i++) {
        const latest = (
          await query(
            "SELECT max(created_at) AS at FROM participant_judging WHERE member_round_id=(SELECT member_round_id FROM participant_sessions WHERE id=$1) AND lane='SAMPLE'",
            [parseProof(a.aa)!.id],
          )
        )[0].at as Date;
        await delay(Math.max(0, latest.getTime() + 3010 - Date.now()));
        await c.budgets();
        const admitted = await c.service.run(
          a.aa,
          a.round,
          a.y,
          `page sample ${i}`,
          randomUUID(),
        );
        await complete(admitted.result.run_id as string);
      }
      await c.budgets();
      const first = await history.attempts(a.aa, a.round);
      assert.equal(first.items.length, 50);
      assert.ok(first.next_after);
      const second = await history.attempts(a.aa, a.round, first.next_after!);
      assert.equal(second.items.length, 1);
      assert.equal(second.next_after, null);
      assert.equal(
        new Set([...first.items, ...second.items].map((row) => row.id)).size,
        51,
      );
      assert.deepEqual(
        await history.attempts(a.aa, a.round, first.next_after!),
        second,
      );
      for (const cursor of [teammateRun, rival, randomUUID(), "bad"])
        await assert.rejects(history.attempts(a.aa, a.round, cursor));
      const foreignWallet = (await history.wallet(a.ba, a.round)).items[0].id;
      await assert.rejects(history.wallet(a.aa, a.round, foreignWallet));
      const wallet = await history.wallet(a.aa, a.round);
      assert.equal(
        (await history.wallet(a.aa, a.round, wallet.items[0].id)).items.length,
        1,
      );
    },
  );
  await t.test(
    "paused and closing histories stay readable; closing stays provisional until the final lock",
    async () => {
      await command(a.round, "PAUSE", { scope: "GLOBAL", target: null });
      await c.budgets();
      const before = await unchanged();
      assert.equal(
        (await history.overview(a.aa, a.round)).round.state,
        "PAUSED",
      );
      assert.equal(
        (await history.execution(a.aa, a.round, official)).source,
        "team official source",
      );
      assert.deepEqual(await unchanged(), before);
      await command(a.round, "RESUME", { scope: "GLOBAL", target: null });
    },
  );
  await t.test(
    "history HTTP uses explicit bounded private DTOs, no-store and strict query ownership",
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
          clock,
          delivery: c.delivery,
          competition: c.deps,
          browser,
        },
      });
      const get = async (url: string, cookie = a.aa) => {
        await c.budgets();
        return app.inject({
          method: "GET",
          url,
          headers: { cookie: `${policy.names.participant}=${cookie}` },
        });
      };
      try {
        const base = `/api/v1/competition/rounds/${a.round}/history`;
        for (const suffix of [
          "",
          "/attempts",
          "/wallet",
          `/judging/${ownRun}`,
          `/judging/${official}`,
          `/hints/${a.y}`,
        ]) {
          const response = await get(`${base}${suffix}`);
          assert.equal(response.statusCode, 200, response.body);
          assert.equal(response.headers["cache-control"], "no-store");
          assert.ok(Buffer.byteLength(response.body) <= 1048576);
          for (const field of [
            "provider_token",
            "expected_output",
            "reference_solution",
            "opponent source",
            "teammate private sample",
            "defect_description",
          ])
            assert.equal(response.body.includes(field), false);
        }
        for (const suffix of [
          "?team_id=" + c.teams[1]!.id,
          "/attempts?limit=100",
          "/wallet?after=bad",
          "/attempts?after=" + teammateRun,
        ])
          assert.ok((await get(base + suffix)).statusCode >= 400);
        assert.equal((await get(base, "invalid")).statusCode, 401);
        assert.equal(
          (await get(base + `/judging/${teammateRun}`)).statusCode,
          403,
        );
      } finally {
        await app.close();
      }
    },
  );
  const race = await c.startRace(a.round);
  await t.test(
    "only a valid R2 grant reads the same member/team R1 history, without reviving retired credentials or writes",
    async () => {
      await c.budgets();
      const before = await unchanged();
      assert.deepEqual(
        (await history.rounds(race.aa)).map((r) => r.round_id),
        [a.round, race.round],
      );
      assert.equal((await history.overview(race.aa, a.round)).final, true);
      assert.equal(
        (await history.execution(race.aa, a.round, ownRun)).source,
        "original private sample",
      );
      assert.equal(
        (await history.execution(race.ab, a.round, official)).source,
        "team official source",
      );
      await assert.rejects(history.execution(race.ab, a.round, ownRun));
      assert.equal(
        (await workbench.draft(race.aa, a.round, a.x)).source,
        "newer private draft",
      );
      assert.equal(
        (await workbench.draft(race.ab, a.round, a.x)).source,
        "teammate draft secret",
      );
      assert.equal(
        (await history.wallet(race.aa, race.round)).items[0].kind,
        "CARRYOVER",
      );
      for (const old of [a.aa, a.ab, a.ba])
        await assert.rejects(history.overview(old, a.round));
      await assert.rejects(history.overview(race.aa, randomUUID()));
      assert.deepEqual(await unchanged(), before);
      await assert.rejects(
        workbench.save(race.aa, {
          roundId: a.round,
          bountyId: a.x,
          requestKey: randomUUID(),
          baseRevision: "1",
          source: "historical overwrite",
        }),
      );
      await assert.rejects(
        c.service.run(race.aa, a.round, a.y, "historical run", randomUUID()),
      );
    },
  );
  if (process.env.INGENIUM_TEST_SUITE === "history-browser") {
    await t.test(
      "real browser history covers rounds, read-only source, wallet and finalising updates without gameplay writes",
      async () => {
        await historyBrowserChecks(
          c,
          { ...race, previous: a.round, ownRun, official, draftBounty: a.x },
          () => command(race.round, "CLOSE"),
          () => command(race.round, "FINALISE"),
        );
      },
    );
  }
  await t.test(
    "clock faults, current member blocks and logout refuse both current and historical protected reads",
    async () => {
      await c.budgets();
      healthy = false;
      await assert.rejects(history.rounds(race.aa));
      healthy = true;
      const arena = (
        await query("SELECT arena_instance_id FROM rounds WHERE id=$1", [
          race.round,
        ])
      )[0].arena_instance_id;
      const staff = (
        await query("SELECT staff_id FROM staff_sessions WHERE id=$1", [
          parseProof(c.staff.sessionCookie)!.id,
        ])
      )[0].staff_id;
      await c.owner.query(
        "INSERT INTO access_blocks(id,arena_instance_id,member_id,created_by,reason,created_at) VALUES($1,$2,$3,$4,'Synthetic history block',date_trunc('milliseconds',clock_timestamp()))",
        [randomUUID(), arena, c.teams[1]!.members[0], staff],
      );
      await assert.rejects(history.overview(race.ba, a.round));
      await assert.rejects(history.attempts(race.ba, race.round));
      const entry = createEntryService(c.api, c.clock, c.delivery);
      await c.budgets();
      await entry.logout(race.ab, {
        sessionId: parseProof(race.ab)!.id,
        requestKey: randomUUID(),
      });
      await assert.rejects(history.overview(race.ab, a.round));
      await assert.rejects(history.rounds(race.ab));
    },
  );
  const state = (
    await query("SELECT state FROM rounds WHERE id=$1", [race.round])
  )[0].state;
  if (state !== "CLOSED") {
    await command(race.round, "CLOSE");
    await command(race.round, "FINALISE");
  }
  await t.test(
    "cancelled round history keeps terminal attempts and null ranks without granting cross-instance access",
    async () => {
      const next = await c.newRound();
      await c.budgets();
      await assert.rejects(history.overview(next.aa, a.round));
      const pending = await c.service.submit(
        next.aa,
        next.round,
        next.x,
        "cancelled retained source",
        randomUUID(),
      );
      const row = (
        await query(
          "SELECT arena_instance_id,revision FROM rounds WHERE id=$1",
          [next.round],
        )
      )[0];
      await c.budgets();
      const receipt = await c.service.command(c.staff.sessionCookie, {
        action: "CANCEL_ROUND",
        roundId: next.round,
        requestKey: randomUUID(),
        expectedRevision: row.revision,
        reason: "Synthetic history cancellation",
        ownCode: c.staff.code,
        payload: {
          arena_id: row.arena_instance_id,
          confirmed_round_id: next.round,
          incident_ref: "HISTORY-TEST",
        },
      });
      for (let i = 0; i < 5; i++) await c.judge.tick();
      await c.budgets();
      const view = await history.overview(next.aa, next.round);
      assert.equal(view.cancelled, true);
      assert.equal(view.final, false);
      assert.ok(view.standings.every((s) => s.rank === null));
      const execution = await history.execution(
        next.ab,
        next.round,
        pending.result.submission_id as string,
      );
      assert.equal(execution.status, "CANCELLED");
      assert.equal(execution.result, null);
      assert.equal(execution.source, "cancelled retained source");
      await c.budgets();
      await c.service.command(c.staff.sessionCookie, {
        action: "FINISH_CANCEL",
        roundId: next.round,
        requestKey: randomUUID(),
        expectedRevision: (
          await query("SELECT revision FROM rounds WHERE id=$1", [next.round])
        )[0].revision,
        reason: "Synthetic history cancellation complete",
        ownCode: c.staff.code,
        payload: {
          arena_id: row.arena_instance_id,
          cancellation_id: receipt.result.cancellation_id,
        },
      });
    },
  );
}
