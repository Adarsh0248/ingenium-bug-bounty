import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import type { TestContext } from "node:test";
import { fileURLToPath } from "node:url";
import { io } from "socket.io-client";
import { createArenaService } from "../../src/access/arena-service.js";
import { browserPolicy } from "../../src/access/browser-policy.js";
import { LANGUAGES } from "../../src/access/credentials.js";
import { createEntryService } from "../../src/access/entry-service.js";
import { buildApp } from "../../src/app.js";
import type { CompetitionCommand } from "../../src/competition/service.js";
import { connectLive } from "../../src/live/client.js";
import type { participantJudgingChecks } from "./participant-judging.checks.js";

export async function raceLoadChecks(
  t: TestContext,
  c: Parameters<typeof participantJudgingChecks>[1] & {
    newTeam(): Promise<{ id: string; code: string; members: string[] }>;
    raceSnapshots: string[];
    assess(id: string, verdict?: string): Promise<unknown>;
  },
) {
  const query = async (sql: string, args: unknown[] = []) =>
    (await c.owner.query(sql, args)).rows;
  async function control(
    roundId: string,
    action: CompetitionCommand["action"],
    payload = {},
  ) {
    await c.budgets();
    const reply = await c.service.command(c.staff.sessionCookie, {
      roundId,
      action,
      payload,
      requestKey: randomUUID(),
      expectedRevision: (
        await query("SELECT revision FROM rounds WHERE id=$1", [roundId])
      )[0].revision,
      reason: "Synthetic fifty-team shared race",
      ownCode: c.staff.code,
    });
    assert.equal(reply.result.status, "APPLIED");
    return reply;
  }
  const old = await c.newRound();
  const snapshots = (
    await query(
      "SELECT snapshot_id FROM bounties WHERE round_id=$1 ORDER BY position",
      [old.round],
    )
  ).map((r) => r.snapshot_id);
  await control(old.round, "CLOSE");
  await control(old.round, "FINALISE");
  await control(old.round, "DISCARD");
  const teams: Awaited<ReturnType<typeof c.newTeam>>[] = [];
  for (let i = 0; i < 50; i++) teams.push(await c.newTeam());
  await c.budgets();
  const created = await createArenaService(c.api, c.clock, c.delivery).command(
    c.staff.sessionCookie,
    {
      action: "CREATE",
      roundId: null,
      requestKey: randomUUID(),
      durationMs: 18000000,
      expectedRevision: (
        await query("SELECT revision FROM arena_control WHERE id=1")
      )[0].revision,
      teamIds: teams.map((team) => team.id),
      reason: "Synthetic fifty-team qualification",
    },
  );
  const r1 = created.round_id!;
  await control(r1, "CONFIGURE", { snapshots });
  await control(r1, "READY");
  await c.judge.claim();
  await control(r1, "START");
  await control(r1, "CLOSE");
  await control(r1, "FINALISE");
  const originalR1 = (
    await query("SELECT * FROM round_results WHERE round_id=$1", [r1])
  )[0];
  await control(r1, "QUALIFY");
  const round = (
    await control(r1, "SETUP_R2", {
      teams: teams.map((team) => team.id),
      duration_ms: 18000000,
    })
  ).result.round_id as string;
  await control(round, "CONFIGURE", { snapshots: c.raceSnapshots });
  await control(round, "READY");
  await c.judge.claim();
  await control(round, "START");
  const bounty = (
    await query("SELECT id FROM bounties WHERE round_id=$1 ORDER BY position", [
      round,
    ])
  )[0].id as string;
  const browser = {
    mode: "loopback" as const,
    origin: "http://127.0.0.1:5174",
    cookieKey: randomBytes(32),
    csrfKey: randomBytes(32),
  };
  const policy = browserPolicy(browser),
    entry = createEntryService(c.api, c.clock, c.delivery);
  const app = buildApp({
    database: { async check() {}, async close() {} },
    entry: {
      pool: c.api,
      clock: c.clock,
      delivery: c.delivery,
      browser,
      competition: c.deps,
    },
  });
  const warnings = new Map<string, number>();
  const warn = app.log.warn.bind(app.log);
  app.log.warn = ((
    value: { event?: string; code?: string },
    ...args: unknown[]
  ) => {
    const key = `${value.event ?? "OTHER"}:${value.code ?? "UNKNOWN"}`;
    warnings.set(key, (warnings.get(key) ?? 0) + 1);
    (warn as Function)(value, ...args);
  }) as typeof app.log.warn;
  const address = await app.listen({ host: "127.0.0.1", port: 0 });
  const clients: ReturnType<typeof connectLive>[] = [];
  const report: Record<string, unknown> = {
    schema_version: 1,
    run_id: randomUUID(),
    state: "INCOMPLETE",
    teams: 50,
    members: 100,
    api_pool_limit: c.api.options.max,
    execution_platform: process.platform,
    clock_trust: "SYNTHETIC_FIXTURE",
    real_judge_execution: false,
    production_tls: false,
    event_launch_authorised: false,
  };
  const output = fileURLToPath(
    new URL("../../test-results/race-load.json", import.meta.url),
  );
  await mkdir(fileURLToPath(new URL("../../test-results/", import.meta.url)), {
    recursive: true,
  });
  await writeFile(output, JSON.stringify(report, null, 2) + "\n");
  type Session = {
    teamId: string;
    member: number;
    cookie: string;
    language: string;
    jar: Map<string, string>;
    csrf: string;
  };
  const sessions: Session[] = [],
    views = new Map<number, any>(),
    states = new Map<number, string>();
  const claims = new Set<number>(),
    animations = new Map<number, number>(),
    refusals = new Map<string, number>();
  let passed = 0,
    opened = 0;
  const prefix = `/api/v1/competition/rounds/${round}/bounties/${bounty}`;
  async function request(
    s: Pick<Session, "jar" | "csrf">,
    path: string,
    body?: unknown,
  ) {
    const response = await fetch(`${address}${path}`, {
      method: body === undefined ? "GET" : "POST",
      signal: AbortSignal.timeout(15000),
      redirect: "error",
      headers: {
        Origin: browser.origin,
        Cookie: [...s.jar].map(([k, v]) => `${k}=${v}`).join("; "),
        ...(body === undefined
          ? {}
          : { "Content-Type": "application/json", "X-CSRF-Token": s.csrf }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    for (const line of response.headers.getSetCookie()) {
      const pair = line.split(";")[0]!,
        split = pair.indexOf("=");
      s.jar.set(pair.slice(0, split), pair.slice(split + 1));
    }
    const text = await response.text();
    assert.ok(Buffer.byteLength(text) <= 1048576);
    const value = JSON.parse(text);
    if (response.status !== 200) {
      const key = `${response.status}:${value.error?.code ?? "UNKNOWN"}`;
      refusals.set(key, (refusals.get(key) ?? 0) + 1);
    }
    return { status: response.status, value };
  }
  async function until(done: () => boolean, limit = 20000) {
    const end = performance.now() + limit;
    while (!done()) {
      assert.ok(
        performance.now() < end,
        "Fifty-team live race exceeded its bounded wait",
      );
      await delay(100);
    }
  }
  try {
    assert.equal(c.api.options.max, 12);
    await t.test(
      "fifty actual R1 qualifiers start R2 at zero without changing the frozen first result",
      async () => {
        const standings = (
          await query("SELECT competition_standings($1) value", [round])
        )[0].value;
        assert.equal(standings.length, 50);
        assert.ok(
          standings.every((s: any) => s.points === 0 && s.wallet === 0),
        );
        assert.equal(
          (
            await query(
              "SELECT count(*)::int n FROM round_carryovers c JOIN team_rounds t ON t.id=c.team_round_id WHERE t.round_id=$1",
              [round],
            )
          )[0].n,
          50,
        );
        assert.deepEqual(
          (
            await query("SELECT * FROM round_results WHERE round_id=$1", [r1])
          )[0],
          originalR1,
        );
        passed++;
      },
    );
    assert.equal(
      passed,
      1,
      "Stop before enrolling participants after a failed qualification check.",
    );
    await c.budgets();
    for (const team of teams)
      for (const member of [0, 1]) {
        const language = LANGUAGES[sessions.length % LANGUAGES.length]!;
        const flow = await entry.begin(team.code, {
          ip: "127.0.0.2",
          browserId: randomUUID(),
        });
        const active = await entry.activate(flow.proofCookie, {
          memberId: team.members[member]!,
          language,
          requestKey: randomUUID(),
        });
        assert.equal(active.status, "ACTIVATED");
        if (active.status !== "ACTIVATED")
          throw new Error("Synthetic race entry refused");
        const s: Session = {
          teamId: team.id,
          member,
          language,
          cookie: active.sessionCookie,
          jar: new Map(),
          csrf: "",
        };
        assert.equal(
          (await request(s, "/api/v1/bootstrap?audience=ANONYMOUS")).status,
          200,
        );
        s.jar.set(policy.names.participant, s.cookie);
        const bootstrap = await request(
          s,
          "/api/v1/bootstrap?audience=PARTICIPANT",
        );
        assert.equal(bootstrap.status, 200);
        s.csrf = bootstrap.value.data.csrf_token;
        sessions.push(s);
      }
    await t.test(
      "one hundred distinct members keep independent locked languages and authenticated live views",
      async () => {
        assert.equal(new Set(sessions.map((s) => s.cookie)).size, 100);
        assert.deepEqual(
          (
            await query(
              "SELECT language,count(*)::int n FROM member_rounds WHERE round_id=$1 GROUP BY language ORDER BY language",
              [round],
            )
          ).map((r) => r.n),
          [20, 20, 20, 20, 20],
        );
        await c.budgets();
        for (let i = 0; i < sessions.length; i += 2)
          await Promise.all(
            sessions.slice(i, i + 2).map(async (s, offset) => {
              const index = i + offset;
              const client = connectLive("PARTICIPANT", null, {
                now: () => performance.now(),
                post: async (path, body) => {
                  const reply = await request(s, path, body);
                  if (reply.status !== 200)
                    throw Object.assign(
                      new Error("Synthetic live race refusal"),
                      { status: reply.status, code: reply.value.error?.code },
                    );
                  return reply.value.data;
                },
                transport: (ticket) => {
                  assert.ok(++opened <= 200, "Unbounded live race reconnects");
                  const socket = io(`${address}/live`, {
                    path: "/api/v1/live/socket",
                    autoConnect: false,
                    forceNew: true,
                    reconnection: false,
                    transports: ["websocket"],
                    auth: { ticket },
                    extraHeaders: {
                      Origin: browser.origin,
                      Cookie: [...s.jar]
                        .map(([k, v]) => `${k}=${v}`)
                        .join("; "),
                    },
                  });
                  socket.on("event", (event) => {
                    if (
                      event.patch.type === "CLAIM" &&
                      event.patch.bounty_id === bounty
                    )
                      claims.add(index);
                  });
                  return socket;
                },
                install: (snapshot: any) => {
                  assert.equal(snapshot.actor.round_id, round);
                  assert.equal(snapshot.actor.language, s.language);
                  assert.doesNotMatch(
                    JSON.stringify(snapshot),
                    /PRIVATE-RACE-SOURCE|source_code|reference_code|expected_output|proof_verifier/,
                  );
                  views.set(index, snapshot);
                },
                invalidate() {},
                presence() {},
                award: () =>
                  animations.set(index, (animations.get(index) ?? 0) + 1),
                state: (state) => states.set(index, state),
              });
              clients.push(client);
              await until(() => states.get(index) === "READY");
              client.edit(bounty);
            }),
          );
        await until(
          () =>
            states.size === 100 &&
            [...states.values()].every((s) => s === "READY"),
        );
        passed++;
      },
    );
    assert.equal(
      passed,
      2,
      "Stop before admission after failed live synchronisation.",
    );
    const admitted = new Map<
      string,
      { session: Session; key: string; receipt: any }
    >();
    let ordered: any[] = [];
    await t.test(
      "fifty competing teams retain one ordered HTTP receipt each in a simultaneous shared-bounty burst",
      async () => {
        await c.judge.claim();
        await c.budgets();
        const contenders = sessions.filter((s) => s.member === 0);
        for (let i = 0; i < contenders.length; i += 16)
          await Promise.all(
            contenders.slice(i, i + 16).map(async (s) => {
              const key = randomUUID(),
                reply = await request(s, `${prefix}/submissions`, {
                  request_key: key,
                  source: `// PRIVATE-RACE-SOURCE-${s.teamId}\n`,
                });
              assert.equal(reply.status, 200);
              assert.equal(reply.value.data.result.status, "ADMITTED");
              admitted.set(reply.value.data.result.submission_id, {
                session: s,
                key,
                receipt: reply.value.data,
              });
            }),
          );
        ordered = await query(
          "SELECT id,receipt_order,team_round_id FROM competition_submissions WHERE round_id=$1 ORDER BY receipt_order",
          [round],
        );
        assert.equal(ordered.length, 50);
        assert.equal(admitted.size, 50);
        assert.deepEqual(
          new Set(ordered.map((r) => r.id)),
          new Set(admitted.keys()),
        );
        assert.equal(
          (
            await query(
              "SELECT count(*)::int n FROM bounty_awards WHERE bounty_id=$1",
              [bounty],
            )
          )[0].n,
          0,
        );
        passed++;
      },
    );
    assert.equal(
      passed,
      3,
      "Stop before judging after a failed admission burst.",
    );
    await t.test(
      "a later correct result waits for the earlier wrong receipt; every rival receives the single shared claim",
      async () => {
        // Only the oldest result is held; unrelated fixtures must not occupy every synthetic execution slot forever.
        for (const row of ordered.slice(1)) c.answers.set(row.id, "PASSED");
        await c.assess(ordered[1].id);
        assert.equal(
          (
            await query(
              "SELECT count(*)::int n FROM bounty_awards WHERE bounty_id=$1",
              [bounty],
            )
          )[0].n,
          0,
        );
        assert.equal(claims.size, 0);
        const started = performance.now();
        await c.assess(ordered[0].id, "WRONG_ANSWER");
        const winner = (
          await query("SELECT * FROM bounty_awards WHERE bounty_id=$1", [
            bounty,
          ])
        )[0];
        assert.equal(winner.submission_id, ordered[1].id);
        await until(
          () =>
            claims.size === 100 &&
            [...views.values()].filter((v) =>
              v.bounties.some((b: any) => b.bounty_id === bounty && b.claimed),
            ).length === 100,
        );
        report.assessment_request_to_all_claim_projections_ms = Math.round(
          performance.now() - started,
        );
        report.claim_recipients = claims.size;
        assert.deepEqual(
          [...animations.keys()].sort((a, b) => a - b),
          sessions.flatMap((s, i) =>
            s.teamId === admitted.get(ordered[1].id)!.session.teamId ? [i] : [],
          ),
        );
        assert.ok([...animations.values()].every((n) => n === 1));
        assert.equal(
          (
            await query(
              "SELECT count(*)::int n FROM wrong_submission_penalties WHERE team_round_id IN (SELECT id FROM team_rounds WHERE round_id=$1)",
              [round],
            )
          )[0].n,
          1,
        );
        passed++;
      },
    );
    assert.equal(
      passed,
      4,
      "Stop before more commands after failed claim delivery.",
    );
    await t.test(
      "claimed-bounty writes are refused while original-key retries preserve the admitted receipt",
      async () => {
        await c.budgets();
        const first = admitted.get(ordered[0].id)!;
        const repeat = await request(first.session, `${prefix}/submissions`, {
          request_key: first.key,
          source: `// PRIVATE-RACE-SOURCE-${first.session.teamId}\n`,
        });
        assert.equal(repeat.status, 200);
        assert.deepEqual(repeat.value.data, first.receipt);
        const teammate = sessions.find(
          (s) => s.teamId === first.session.teamId && s.member === 1,
        )!;
        const refused = await request(teammate, `${prefix}/submissions`, {
          request_key: randomUUID(),
          source: "// Not a new claim\n",
        });
        assert.equal(refused.status, 200);
        assert.equal(refused.value.data.result.reason, "BOUNTY_UNAVAILABLE");
        assert.equal(
          (
            await query(
              "SELECT count(*)::int n FROM competition_submissions WHERE round_id=$1",
              [round],
            )
          )[0].n,
          50,
        );
        passed++;
      },
    );
    for (const client of clients) client.close();
    await t.test(
      "all admitted work drains without a second award and both frozen round results remain independently inspectable",
      async () => {
        await control(round, "CLOSE");
        for (const row of ordered.slice(2)) await c.assess(row.id);
        assert.equal(
          (
            await query(
              "SELECT count(*)::int n FROM competition_assessments WHERE submission_id=ANY($1::uuid[])",
              [ordered.map((r) => r.id)],
            )
          )[0].n,
          50,
        );
        assert.equal(
          (
            await query(
              "SELECT count(*)::int n FROM bounty_awards WHERE bounty_id=$1",
              [bounty],
            )
          )[0].n,
          1,
        );
        await control(round, "FINALISE");
        assert.deepEqual(
          (
            await query("SELECT * FROM round_results WHERE round_id=$1", [r1])
          )[0],
          originalR1,
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
              "SELECT count(*)::int n FROM participant_attempts a JOIN participant_jobs j ON j.id=a.job_id JOIN participant_judging p ON p.id=j.parent_id WHERE p.round_id=$1 AND a.released_at IS NULL",
              [round],
            )
          )[0].n,
          0,
        );
        assert.equal(
          (
            await query(
              "SELECT count(*)::int n FROM execution_capacity_slots WHERE participant_attempt_id IS NOT NULL",
            )
          )[0].n,
          0,
        );
        passed++;
      },
    );
    assert.equal(
      passed,
      6,
      "A failed subcheck must not produce a PASSED race report.",
    );
    report.state = "PASSED";
  } finally {
    for (const client of clients) client.close();
    await app.close();
    report.completed_checks = passed;
    report.opened_connections = opened;
    report.http_refusals = Object.fromEntries(refusals);
    report.warnings = Object.fromEntries(warnings);
    await writeFile(output, JSON.stringify(report, null, 2) + "\n");
  }
}
