import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { TestContext } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { liveLoadDriver } from "./live-load-driver.js";
import { remoteLiveDriver } from "./live-load-bridge.js";
import type { participantJudgingChecks } from "./participant-judging.checks.js";
import { createArenaService } from "../../src/access/arena-service.js";
import { createEntryService } from "../../src/access/entry-service.js";
import { LANGUAGES } from "../../src/access/credentials.js";
import { buildApp } from "../../src/app.js";
import { browserPolicy } from "../../src/access/browser-policy.js";

async function mapLimit<T, R>(
  values: T[],
  parallel: number,
  work: (value: T, index: number) => Promise<R>,
) {
  const results = new Array<R>(values.length);
  let index = 0;
  const settled = await Promise.allSettled(
    Array.from({ length: Math.min(parallel, values.length) }, async () => {
      for (;;) {
        const i = index++;
        if (i >= values.length) return;
        results[i] = await work(values[i]!, i);
      }
    }),
  );
  const failed = settled.find((v) => v.status === "rejected");
  if (failed?.status === "rejected") throw failed.reason;
  return results;
}
function percentile(values: number[], fraction: number) {
  assert.ok(values.length > 0);
  const sorted = [...values].sort((a, b) => a - b);
  return Math.round(sorted[Math.ceil(sorted.length * fraction) - 1]!);
}
export async function loadChecks(
  t: TestContext,
  c: Parameters<typeof participantJudgingChecks>[1] & {
    newTeam(): Promise<{ id: string; code: string; members: string[] }>;
    answers: Map<string, string>;
  },
) {
  const query = async (sql: string, args: unknown[] = []) =>
    (await c.owner.query(sql, args)).rows;
  const old = await c.newRound(),
    snapshots = (
      await query(
        "SELECT snapshot_id FROM bounties WHERE round_id=$1 ORDER BY position",
        [old.round],
      )
    ).map((r) => r.snapshot_id);
  async function control(
    action:
      | "CONFIGURE"
      | "READY"
      | "START"
      | "CLOSE"
      | "FINALISE"
      | "DISCARD"
      | "PAUSE"
      | "RESUME",
    roundId: string,
    payload = {},
  ) {
    await c.budgets();
    return c.service.command(c.staff.sessionCookie, {
      action,
      roundId,
      requestKey: randomUUID(),
      expectedRevision: (
        await query("SELECT revision FROM rounds WHERE id=$1", [roundId])
      )[0].revision,
      reason: "Synthetic local capacity rehearsal",
      ownCode: c.staff.code,
      payload,
    });
  }
  await control("CLOSE", old.round);
  await control("FINALISE", old.round);
  await control("DISCARD", old.round);
  const teams = await mapLimit(
    Array.from({ length: 100 }, (_, i) => i),
    2,
    () => c.newTeam(),
  );
  const created = await createArenaService(c.api, c.clock, c.delivery).command(
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
      reason: "Synthetic 100-team local rehearsal",
    },
  );
  const round = created.round_id!;
  await control("CONFIGURE", round, { snapshots });
  await control("READY", round);
  await c.judge.claim();
  await control("START", round);
  const bounty = (
    await query("SELECT id FROM bounties WHERE round_id=$1 ORDER BY position", [
      round,
    ])
  )[0].id;
  await c.budgets();
  const entry = createEntryService(c.api, c.clock, c.delivery);
  const members = await mapLimit(
    teams.flatMap((team) =>
      team.members.map((memberId, member) => ({ team, memberId, member })),
    ),
    4,
    async (v, i) => {
      const flow = await entry.begin(v.team.code, {
        ip: "127.0.0.2",
        browserId: randomUUID(),
      });
      const language = LANGUAGES[i % 5]!;
      const result = await entry.activate(flow.proofCookie, {
        memberId: v.memberId,
        language,
        requestKey: randomUUID(),
      });
      assert.equal(result.status, "ACTIVATED");
      if (result.status !== "ACTIVATED")
        throw new Error("Synthetic enrolment refused");
      return { ...v, language, cookie: result.sessionCookie };
    },
  );
  const settings = {
      mode: "loopback" as const,
      origin: "http://127.0.0.1:5174",
      cookieKey: randomBytes(32),
      csrfKey: randomBytes(32),
    },
    policy = browserPolicy(settings);
  const app = buildApp({
    database: { async check() {}, async close() {} },
    entry: {
      pool: c.api,
      clock: c.clock,
      delivery: c.delivery,
      browser: settings,
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
  type Session = (typeof members)[number] & {
    csrf: string;
    jar: Map<string, string>;
  };
  const report: Record<string, unknown> = {
    schema_version: 1,
    run_id: randomUUID(),
    state: "INCOMPLETE",
    environment: "DISPOSABLE_LOCAL_HTTP",
    execution_platform: process.platform,
    teams: 100,
    members: 200,
    languages: [...LANGUAGES],
    database_cpu_limit: 1,
    api_pool_limit: 12,
    clock_trust: "SYNTHETIC_FIXTURE",
    request_parallelism: 16,
    real_judge_execution: false,
    production_tls: false,
    live_socket_load: false,
    event_launch_authorised: false,
    clients_share_api_cpu: !process.env.INGENIUM_LOAD_GENERATOR,
    generator_cpu_limit: process.env.INGENIUM_LOAD_GENERATOR ? 1 : null,
    api_cpu_limit: process.platform === "linux" ? 1 : null,
  };
  const measurements: Record<string, unknown>[] = [];
  const live = process.env.INGENIUM_LOAD_GENERATOR ? remoteLiveDriver(process.env.INGENIUM_LOAD_GENERATOR) : liveLoadDriver();
  const failures = new Map<string, number>();
  const output = fileURLToPath(new URL("../../test-results/", import.meta.url));
  assert.equal(
    c.api.options.max,
    12,
    "Use the event server's actual bounded pool, not the four-connection foundation preview.",
  );
  await mkdir(output, { recursive: true });
  await writeFile(
    `${output}/local-load.json`,
    JSON.stringify(report, null, 2) + "\n",
  );
  async function request(
    s: Pick<Session, "jar" | "csrf">,
    path: string,
    body?: unknown,
  ) {
    const response = await fetch(`${address}${path}`, {
      method: body === undefined ? "GET" : "POST",
      redirect: "error",
      signal: AbortSignal.timeout(15000),
      headers: {
        Origin: settings.origin,
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
      const label = `${path.split("/").at(-1)}:${response.status}:${value.error?.code ?? "UNKNOWN"}`;
      failures.set(label, (failures.get(label) ?? 0) + 1);
    }
    return { status: response.status, value };
  }
  const path = `/api/v1/competition/rounds/${round}/bounties/${bounty}`;
  try {
    await c.budgets();
    const sessions: Session[] = await mapLimit(members, 4, async (m) => {
      const jar = new Map<string, string>(),
        context = { jar, csrf: "" };
      assert.equal(
        (await request(context, "/api/v1/bootstrap?audience=ANONYMOUS")).status,
        200,
      );
      jar.set(policy.names.participant, m.cookie);
      const response = await request(
        context,
        "/api/v1/bootstrap?audience=PARTICIPANT",
      );
      assert.equal(response.status, 200);
      return { ...m, jar, csrf: response.value.data.csrf_token };
    });
    const enrolled = new Map(
      (
        await query(
          "SELECT id,member_id,team_round_id FROM member_rounds WHERE round_id=$1",
          [round],
        )
      ).map((row) => [row.member_id, row]),
    );
    await t.test(
      "100 teams enroll exactly two current members with independent locked five-language choices",
      async () => {
        assert.equal(
          (
            await query(
              "SELECT count(*)::int n FROM member_rounds WHERE round_id=$1 AND enrolled_at IS NOT NULL",
              [round],
            )
          )[0].n,
          200,
        );
        assert.deepEqual(
          (
            await query(
              "SELECT language,count(*)::int n FROM member_rounds WHERE round_id=$1 GROUP BY language ORDER BY language",
              [round],
            )
          ).map((r) => r.n),
          [40, 40, 40, 40, 40],
        );
        assert.equal(new Set(sessions.map((s) => s.cookie)).size, 200);
      },
    );
    await t.test(
      "25/50/100-team metadata ramps retain identity privacy with bounded real HTTP responses",
      async () => {
        for (const count of [50, 100, 200]) {
          await c.budgets();
          const latency: number[] = [],
            started = performance.now();
          await mapLimit(sessions.slice(0, count), 16, async (s) => {
            const begin = performance.now(),
              response = await request(s, path);
            latency.push(performance.now() - begin);
            assert.equal(response.status, 200);
            assert.equal(response.value.data.language, s.language);
            assert.doesNotMatch(
              JSON.stringify(response.value),
              /reference_code|expected_output|secret_verifier/,
            );
          });
          latency.sort((a, b) => a - b);
          measurements.push({
            operation: "METADATA",
            members: count,
            requests: count,
            elapsed_ms: Math.round(performance.now() - started),
            p95_ms: Math.round(latency[Math.ceil(count * 0.95) - 1]!),
            p99_ms: Math.round(latency[Math.ceil(count * 0.99) - 1]!),
            refused: 0,
          });
        }
      },
    );
    await t.test(
      "600 real sockets preserve 200 member grants, refuse a fourth tab and recover a simultaneous disconnect",
      async () => {
        await c.budgets(); const start = performance.now();
        try {
          const initial = await live.initialise({ address, origin: settings.origin, round, bounty,
            sessions: sessions.map(s => ({ csrf: s.csrf, cookies: [...s.jar], language: s.language,
              memberRound: enrolled.get(s.memberId).id, teamRound: enrolled.get(s.memberId).team_round_id })) });
          assert.equal(await live.fourth(), true);
          report.initial_live_connections = { ...initial, fourth_tab_refused: true };
          const reconnectMs = await live.reconnect();
          assert.equal((await query("SELECT count(*)::int n FROM member_rounds WHERE round_id=$1 AND enrolled_at IS NOT NULL", [round]))[0].n, 200);
          await live.phase("PAUSE");
          await control("PAUSE", round, { scope: "GLOBAL", target: null });
          try { await live.projection("PAUSED"); }
          finally {
            await live.phase("RESUME");
            await control("RESUME", round, { scope: "GLOBAL", target: null });
          }
          await live.projection("RUNNING");
          const { pause, resume, ...result } = await live.finish();
          measurements.push({ operation: "LIVE_SOCKETS", ...result, simultaneous_reconnect_ms: reconnectMs,
            elapsed_ms: Math.round(performance.now() - start), all_private_scopes: true, global_pause_resume: true,
            control_request_to_projection_pause_p95_ms: percentile(pause, 0.95),
            control_request_to_projection_pause_p99_ms: percentile(pause, 0.99),
            control_request_to_projection_resume_p95_ms: percentile(resume, 0.95),
            control_request_to_projection_resume_p99_ms: percentile(resume, 0.99) });
          report.live_socket_load = true;
        } catch (error) {
          report.live_failure = await live.state();
          await live.close();
          if ((await query("SELECT state FROM rounds WHERE id=$1", [round]))[0].state === "PAUSED")
            await control("RESUME", round, { scope: "GLOBAL", target: null });
          throw error;
        }
      },
    );
    const sources = sessions.map((_, i) => {
      const prefix = `// PRIVATE-LOAD-DRAFT-${i}\n`;
      return prefix + "x".repeat(131072 - Buffer.byteLength(prefix));
    });
    await t.test(
      "200 maximum-sized autosaves persist exact private bytes and original-key receipts",
      async () => {
        await c.budgets();
        const start = performance.now();
        await mapLimit(sessions, 16, async (s, i) => {
          const key = randomUUID(),
            response = await request(s, `${path}/draft`, {
              request_key: key,
              base_revision: "0",
              source: sources[i],
            });
          assert.equal(response.status, 200);
          assert.equal(response.value.data.outcome, "SAVED");
          const outcome = await request(s, `${path}/draft/outcomes/${key}`);
          assert.equal(outcome.status, 200);
          assert.equal(
            outcome.value.data.outcome.outcome_id,
            response.value.data.outcome_id,
          );
        });
        measurements.push({
          operation: "AUTOSAVE",
          members: 200,
          source_bytes: 131072,
          elapsed_ms: Math.round(performance.now() - start),
        });
        const rows = await query(
          "SELECT member_round_id,encode(sha256(source_code),'hex') digest,octet_length(source_code)::int bytes FROM code_drafts WHERE round_id=$1",
          [round],
        );
        assert.equal(rows.length, 200);
        assert.ok(rows.every((r) => r.bytes === 131072));
        await c.budgets();
        await mapLimit(sessions, 16, async (s, i) => {
          const response = await request(s, `${path}/draft`);
          assert.equal(response.status, 200);
          assert.equal(response.value.data.source, sources[i]);
        });
      },
    );
    await t.test(
      "a 200-member official burst keeps one pending intent per team/bug and cannot lose an admitted receipt",
      async () => {
        await c.judge.claim();
        await c.budgets();
        const started = performance.now(),
          accepted: string[] = [],
          refused: number[] = [],
          latency: number[] = [];
        await mapLimit(sessions, 16, async (s) => {
          const begin = performance.now(),
            key = randomUUID(),
            response = await request(s, `${path}/submissions`, {
              request_key: key,
              source: "// Synthetic queued load source\n",
            });
          latency.push(performance.now() - begin);
          if (
            response.status === 200 &&
            response.value.data.result.status === "ADMITTED"
          )
            accepted.push(response.value.data.result.submission_id);
          else {
            assert.ok(
              [200, 429, 503].includes(response.status),
              String(response.status),
            );
            refused.push(response.status);
          }
        });
        const rows = await query(
          "SELECT id,receipt_order FROM competition_submissions WHERE round_id=$1 ORDER BY receipt_order",
          [round],
        );
        assert.equal(rows.length, accepted.length);
        assert.equal(
          accepted.length,
          100,
          "Every team must retain exactly one admitted receipt in this bounded burst.",
        );
        assert.equal(refused.length, 100);
        assert.equal(new Set(accepted).size, accepted.length);
        assert.deepEqual(new Set(rows.map((r) => r.id)), new Set(accepted));
        assert.equal(
          (
            await query(
              "SELECT count(*)::int n FROM (SELECT team_round_id,bounty_id,count(*) FROM participant_judging WHERE round_id=$1 AND lane='OFFICIAL' GROUP BY team_round_id,bounty_id HAVING count(*)>1) x",
              [round],
            )
          )[0].n,
          0,
        );
        assert.equal(
          (
            await query(
              "SELECT count(*)::int n FROM wrong_submission_penalties p JOIN competition_submissions s ON s.id=p.submission_id WHERE s.round_id=$1",
              [round],
            )
          )[0].n,
          0,
        );
        measurements.push({
          operation: "OFFICIAL_ADMISSION",
          members: 200,
          admitted: accepted.length,
          refused: refused.length,
          elapsed_ms: Math.round(performance.now() - started),
          admission_p95_ms: percentile(latency, 0.95),
          admission_p99_ms: percentile(latency, 0.99),
          judged: 0,
        });
      },
    );
    if (process.env.INGENIUM_TEST_SUITE === "load-soak") {
      assert.equal(measurements.length, 6, "Do not start the hour-long phase after a failed capacity prerequisite.");
      await t.test("one actual hour preserves 600 sockets while metadata, drafts and sample judgments continue", { timeout: 3900000 }, async () => {
        const contention = new Map<string, number>();
        const settle = async (ids: string[]) => {
          for (const id of ids) c.answers.set(id, "PASSED");
          const end = performance.now() + 300000;
          while ((await query("SELECT count(*)::int n FROM participant_judging WHERE id=ANY($1::uuid[]) AND completed_at IS NULL", [ids]))[0].n) {
            assert.ok(performance.now() < end, "Synthetic coordinator did not settle admitted work.");
            try {
              assert.equal(await c.judge.claim(), true);
              if (await c.judge.tick() === "IDLE") await delay(100);
            } catch (error) {
              const code = (error as { code?: string }).code;
              if (!code || !["57014", "55P03", "40001", "40P01"].includes(code)) throw error;
              // The production coordinator retries durable lookup after a rolled-back database turn too.
              contention.set(code, (contention.get(code) ?? 0) + 1); await delay(250);
            }
          }
          assert.equal((await query("SELECT count(*)::int n FROM participant_judging WHERE id=ANY($1::uuid[]) AND result='PASSED'", [ids]))[0].n, ids.length);
        };
        const official = (await query("SELECT id FROM participant_judging WHERE round_id=$1 AND lane='OFFICIAL'", [round])).map(row => row.id);
        await settle(official);
        assert.equal((await query("SELECT count(*)::int n FROM bounty_awards a JOIN bounties b ON b.id=a.bounty_id WHERE b.round_id=$1", [round]))[0].n, 100);
        const editable = (await query("SELECT id FROM bounties WHERE round_id=$1 AND id<>$2 ORDER BY position LIMIT 1", [round, bounty]))[0].id;
        const editPath = `/api/v1/competition/rounds/${round}/bounties/${editable}`;
        const began = performance.now(), utc = Date.now(), latency: number[] = [];
        let cycles = 0, samples = 0, drafts = 0, peakRss = process.memoryUsage().rss;
        do {
          await mapLimit(sessions, 4, async s => {
            const at = performance.now(), response = await request(s, path);
            assert.equal(response.status, 200); latency.push(performance.now() - at);
          });
          for (let offset = 0; offset < 4; offset++) {
            const s = sessions[(cycles * 4 + offset) % sessions.length]!, current = await request(s, `${editPath}/draft`);
            assert.equal(current.status, 200);
            const saved = await request(s, `${editPath}/draft`, { request_key: randomUUID(), base_revision: current.value.data.revision, source: `// PRIVATE-LOAD-DRAFT-soak-${cycles}-${offset}\n` });
            assert.equal(saved.status, 200); assert.equal(saved.value.data.outcome, "SAVED"); drafts++;
          }
          const sample = await request(sessions[cycles % sessions.length]!, `${editPath}/runs`, { request_key: randomUUID(), source: "// Synthetic hour-long sample\n" });
          assert.equal(sample.status, 200); assert.equal(sample.value.data.result.status, "ADMITTED");
          await settle([sample.value.data.result.run_id]); samples++;
          const state = await live.state(); report.soak_live_state = state; assert.equal(state.assertion_failed, false); assert.equal(state.states.READY, 600);
          peakRss = Math.max(peakRss, process.memoryUsage().rss); cycles++;
          if (cycles % 6 === 0) console.log(`SOAK: ${cycles} cycles, ${samples} samples, 600 sockets; ${Math.round((performance.now() - began) / 1000)} seconds`);
          await delay(10000);
        } while (performance.now() - began < 3600000);
        assert.ok(Date.now() - utc >= 3600000);
        measurements.push({ operation: "ONE_HOUR_MIXED_APP_SOAK", elapsed_ms: Math.round(performance.now() - began), cycles, members: 200, sockets: 600,
          metadata_reads: latency.length, metadata_p95_ms: percentile(latency, .95), metadata_p99_ms: percentile(latency, .99), drafts, samples,
          official_burst_settled: official.length, peak_rss: peakRss, real_compilation: false, quota_resets_during_soak: 0, worker_database_contention: Object.fromEntries(contention) });
      });
    }
    assert.equal(
      measurements.length,
      process.env.INGENIUM_TEST_SUITE === "load-soak" ? 7 : 6,
      "A failed subcheck cannot produce a PASSED load report.",
    );
    report.state = "PASSED";
  } finally {
    let cleanupError: unknown;
    try { await live.close(); } catch (error) { cleanupError = error; report.state = "INCOMPLETE"; }
    await app.close();
    report.measurements = measurements;
    report.warnings = Object.fromEntries(warnings);
    report.refused_reads = Object.fromEntries(failures);
    report.database_functions = await query(
      "SELECT funcname,calls::text,total_time,self_time FROM pg_stat_user_functions ORDER BY total_time DESC,funcname LIMIT 12",
    );
    await writeFile(
      `${output}/local-load.json`,
      JSON.stringify(report, null, 2) + "\n",
    );
    if (cleanupError) throw cleanupError;
  }
}
