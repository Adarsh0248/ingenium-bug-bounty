import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import type { TestContext } from "node:test";
import type { Pool } from "pg";
import { createCompetitionService } from "../../src/competition/service.js";
import type { CompetitionDependencies } from "../../src/competition/service.js";
import { createParticipantJudgeWorker } from "../../src/competition/judging-worker.js";
import type { AuthoringPayload, TrustedAuthoringDriver } from "../../src/content/execution-policy.js";
import { buildApp } from "../../src/app.js";
import { browserPolicy } from "../../src/access/browser-policy.js";
import type { ClockGuard } from "../../src/access/transaction.js";
import type { SessionDelivery } from "../../src/access/credentials.js";

type Arena = { round: string; aa: string; ab: string; ba: string; bb: string; x: string; y: string };
interface Context {
  owner: Pool; api: Pool; judgePool: Pool; service: ReturnType<typeof createCompetitionService>; judge: ReturnType<typeof createParticipantJudgeWorker>; driver: TrustedAuthoringDriver;
  clock: ClockGuard; delivery: SessionDelivery; deps: CompetitionDependencies;
  answers: Map<string, string>; sent: Map<string, number>; trace: AuthoringPayload[]; lost: Set<string>; held: Set<string>; malformed: Set<string>;
  staff: { sessionCookie: string; code: string }; organiser: { sessionCookie: string; code: string }; budgets(): Promise<void>; newRound(): Promise<Arena>;
}
export async function participantJudgingChecks(t: TestContext, c: Context) {
  const { owner, api, service, answers, trace } = c;
  const query = async (text: string, values: unknown[] = []) => (await owner.query(text, values)).rows;
  const parent = async (id: string) => (await query("SELECT * FROM participant_judging WHERE id=$1", [id]))[0];
  const admit = async (a: Arena, cookie: string, lane: "run" | "submit", bug = a.x, source = "synthetic exact source\r\n") => {
    await c.budgets(); const value = await service[lane](cookie, a.round, bug, source, randomUUID());
    assert.equal(value.result.status, "ADMITTED"); return (value.result.run_id ?? value.result.submission_id) as string;
  };
  async function until(done: () => Promise<boolean>, milliseconds = 20000) {
    const deadline = Date.now() + milliseconds;
    while (!await done()) {
      assert.ok(Date.now() < deadline, "Synthetic pipeline exceeded its bounded test wait");
      const state = await c.judge.tick(); if (state === "IDLE" || state === "PENDING") await delay(100);
    }
  }
  const complete = (id: string) => until(async () => (await parent(id)).completed_at !== null);
  async function control(a: Arena, action: "PAUSE" | "RESUME" | "CLOSE", payload: Record<string, unknown> = {}) {
    await c.budgets();
    return service.command(c.staff.sessionCookie, { action, roundId: a.round, requestKey: randomUUID(), expectedRevision: (await query("SELECT revision FROM rounds WHERE id=$1", [a.round]))[0].revision,
      payload, reason: "Synthetic Run availability", ownCode: c.staff.code });
  }
  await t.test("sample admission preserves exact bytes, independent cooldowns and two durable allowances per member", async () => {
    const a = await c.newRound(), key = randomUUID(), source = "first program\r\n";
    await c.budgets();
    const first = await service.run(a.aa, a.round, a.x, source, key), id = first.result.run_id as string;
    const reserved = BigInt((await parent(id)).reserved_bytes);
    assert.deepEqual(await service.run(a.aa, a.round, a.x, source, key), first);
    await assert.rejects(service.run(a.aa, a.round, a.x, "changed", key), { code: "P0002" });
    await assert.rejects(service.run(a.aa, a.round, a.y, source, randomUUID()), { code: "P0003" });
    assert.deepEqual((await parent(id)).source, Buffer.from(source));
    assert.equal((await query("SELECT count(*)::integer n FROM participant_jobs WHERE parent_id=$1", [id]))[0].n, 1);
    await delay(3010); const second = await admit(a, a.aa, "run", a.y);
    const teammate = await admit(a, a.ab, "run", a.y);
    await delay(3010); await c.budgets();
    const before = (await query("SELECT count(*) n FROM competition_outcomes"))[0].n;
    await assert.rejects(service.run(a.aa, a.round, a.x, source, randomUUID()), { code: "54000" });
    assert.equal((await query("SELECT count(*) n FROM competition_outcomes"))[0].n, before);
    await assert.rejects(service.judging(a.ab, a.round, id)); await assert.rejects(service.judging(a.ba, a.round, id));
    const official = await admit(a, a.aa, "submit", a.y);
    assert.equal((await parent(official)).lane, "OFFICIAL");
    assert.equal((await query("SELECT count(*)::integer n FROM participant_jobs WHERE parent_id=$1", [official]))[0].n, 2);
    for (const value of [id, second, teammate, official]) answers.set(value, "PASSED");
    await complete(official); for (const value of [id, second, teammate]) await complete(value);
    await c.budgets(); const view = await service.judging(a.aa, a.round, id);
    assert.ok(BigInt((await parent(id)).reserved_bytes) < reserved);
    assert.equal(view.result, "PASSED"); assert.equal(view.samples.length, 1); assert.equal(Buffer.from(view.samples[0].stdout_b64, "base64").toString(), "12\n");
    const teamView = await service.judging(a.ab, a.round, official); assert.deepEqual(teamView.samples, []);
    assert.equal(teamView.source, "synthetic exact source\r\n");
    assert.doesNotMatch(JSON.stringify(teamView), /case_id|stdin|expected|evidence|cpu_ns|stdout|stderr|token/);
    assert.equal((await query("SELECT count(*)::integer n FROM bounty_awards WHERE submission_id=$1", [official]))[0].n, 1);
  });
  await t.test("scheduler uses three official case turns to one sample turn, rotates teams and borrows an empty lane", async () => {
    const a = await c.newRound();
    const parents = [await admit(a, a.aa, "submit", a.x), await admit(a, a.ba, "submit", a.x), await admit(a, a.ab, "submit", a.y), await admit(a, a.bb, "run", a.y)];
    for (const id of parents) answers.set(id, "PASSED");
    await owner.query("UPDATE participant_scheduler SET turn=0,last_official_team=NULL,last_sample_team=NULL WHERE id=1");
    const start = trace.length;
    for (let i = 0; i < 4; i++) assert.equal(await c.judge.tick(), "OBSERVED");
    assert.deepEqual(trace.slice(start).map(p => p.sourceRole), ["OFFICIAL", "OFFICIAL", "OFFICIAL", "SAMPLE"]);
    const teams = await query("SELECT id,team_round_id FROM participant_judging WHERE id=ANY($1::uuid[])", [parents]);
    const team = (id: string) => teams.find(p => p.id === id)!.team_round_id;
    assert.notEqual(team(trace[start]!.runId), team(trace[start + 1]!.runId));
    for (const id of parents) await complete(id);
    assert.equal((await query("SELECT count(*)::integer n FROM execution_capacity_slots WHERE participant_attempt_id IS NOT NULL"))[0].n, 0);
    assert.ok([...c.sent.values()].every(n => n === 1));
  });
  await t.test("lost creation replies and invalid evidence hold original physical reservations; successors observe without another POST", async () => {
    const a = await c.newRound(), id = await admit(a, a.aa, "submit"), other = await admit(a, a.ab, "submit", a.y);
    answers.set(id, "PASSED"); c.lost.add(id); answers.set(other, "PASSED"); c.malformed.add(other);
    assert.equal(await c.judge.tick(), "UNCERTAIN");
    assert.equal(await c.judge.tick(), "UNUSABLE_EVIDENCE");
    assert.equal((await query("SELECT count(*)::integer n FROM execution_capacity_slots WHERE participant_attempt_id IS NOT NULL"))[0].n, 2);
    assert.equal((await parent(id)).status, "NEEDS_ATTENTION"); assert.equal((await parent(other)).result, null);
    await c.budgets(); const monitored = await service.judgeQueue(c.organiser.sessionCookie, a.round);
    assert.equal(monitored.parents.length, 2); assert.ok(monitored.parents.every(p => p.jobs.some((j: { physically_held: boolean }) => j.physically_held)));
    assert.doesNotMatch(JSON.stringify(monitored), /source|stdout|stderr|evidence|token|runtime_digest|case_id/);
    await assert.rejects(api.query("SELECT participant_prepare($1,1,$2,$3,$4)", [randomUUID(), randomUUID(), randomUUID(), randomBytes(32)]), { code: "42501" });
    const replacement = createParticipantJudgeWorker(c.judgePool, { assertHealthy() {}, async verify() {}, fault() {} }, c.driver);
    assert.equal(await replacement.claim(), false);
    await owner.query("UPDATE judge_control SET lease_until=date_trunc('milliseconds',clock_timestamp())-interval '1 millisecond' WHERE id=1");
    assert.equal(await replacement.claim(), true);
    await assert.rejects(c.judge.tick(), { code: "55000" });
    c.malformed.delete(other);
    for (let i = 0; i < 80 && (!(await parent(id)).completed_at || !(await parent(other)).completed_at); i++) { await replacement.tick(); await delay(100); }
    assert.equal((await parent(id)).result, "PASSED"); assert.equal((await parent(other)).result, "PASSED");
    assert.ok([...c.sent.values()].every(n => n === 1));
    await owner.query("UPDATE judge_control SET lease_until=date_trunc('milliseconds',clock_timestamp())-interval '1 millisecond' WHERE id=1"); assert.equal(await c.judge.claim(), true);
  });
  await t.test("an exhausted safely drained official job permits exactly one confirmed owner-authorised extra dispatch", async () => {
    const a = await c.newRound(), id = await admit(a, a.aa, "submit"); answers.set(id, "INFRA_ERROR");
    const job = (await query("SELECT id FROM participant_jobs WHERE parent_id=$1 ORDER BY position LIMIT 1", [id]))[0].id as string;
    await until(async () => (await query("SELECT count(*)::integer n FROM participant_attempts WHERE job_id=$1", [job]))[0].n === 3);
    assert.equal((await parent(id)).status, "NEEDS_ATTENTION"); assert.equal((await parent(id)).result, null);
    assert.equal((await query("SELECT count(*)::integer n FROM competition_assessments WHERE submission_id=$1", [id]))[0].n, 0);
    const attempts = await query("SELECT prepared_at,resolved_at FROM participant_attempts WHERE job_id=$1 ORDER BY number", [job]);
    assert.ok(attempts[1].prepared_at - attempts[0].resolved_at >= 2000); assert.ok(attempts[2].prepared_at - attempts[1].resolved_at >= 5000);
    await c.budgets();
    await assert.rejects(service.retryJob(c.organiser.sessionCookie, a.round, job, randomUUID(), "Synthetic recovery", c.organiser.code));
    await assert.rejects(service.retryJob(c.staff.sessionCookie, a.round, job, randomUUID(), "Synthetic recovery", "wrong"));
    const key = randomUUID(), granted = await service.retryJob(c.staff.sessionCookie, a.round, job, key, "Synthetic recovery", c.staff.code);
    assert.equal(granted.result.status, "APPLIED");
    await c.budgets(); assert.deepEqual(await service.retryJob(c.staff.sessionCookie, a.round, job, key, "Synthetic recovery", c.staff.code), granted);
    const twice = await service.retryJob(c.staff.sessionCookie, a.round, job, randomUUID(), "Synthetic recovery", c.staff.code); assert.equal(twice.result.status, "REJECTED");
    answers.set(id, "PASSED"); await complete(id);
    assert.equal((await query("SELECT count(*)::integer n FROM participant_attempts WHERE job_id=$1", [job]))[0].n, 4);
    assert.equal((await parent(id)).result, "PASSED");
  });
  await t.test("logical sample completion does not release its physical reservation until positive normal cleanup arrives", async () => {
    const a = await c.newRound(), id = await admit(a, a.aa, "run"); answers.set(id, "PASSED"); c.held.add(id);
    assert.equal(await c.judge.tick(), "OBSERVED"); assert.equal((await parent(id)).result, "PASSED");
    const before = (await parent(id)).completed_at.getTime();
    assert.equal((await query("SELECT count(*)::integer n FROM execution_capacity_slots WHERE participant_attempt_id IS NOT NULL"))[0].n, 1);
    const job = (await query("SELECT id FROM participant_jobs WHERE parent_id=$1", [id]))[0].id as string;
    await c.budgets();
    assert.equal((await service.retryJob(c.staff.sessionCookie, a.round, job, randomUUID(), "No rerun of a reliable sample", c.staff.code)).result.status, "REJECTED");
    c.held.delete(id);
    await until(async () => (await query("SELECT count(*)::integer n FROM execution_capacity_slots WHERE participant_attempt_id IS NOT NULL"))[0].n === 0);
    assert.equal((await parent(id)).completed_at.getTime(), before);
    assert.equal((await query("SELECT count(*)::integer n FROM bounty_awards WHERE bounty_id=$1", [a.x]))[0].n, 0);
  });
  await t.test("queue waiting cannot expire samples; the policy remains immutable and legacy expiry is preserved", async () => {
    const a = await c.newRound(), id = await admit(a, a.aa, "run");
    const client = await owner.connect();
    try {
      await client.query("BEGIN");
      const created = (await parent(id)).created_at as Date;
      const future = new Date(created.getTime() + 600000);
      await client.query("SELECT participant_refresh($1)", [future]);
      assert.equal((await client.query("SELECT result FROM participant_judging WHERE id=$1", [id])).rows[0].result, null);
      assert.equal((await client.query("SELECT sample_run_expired(p,$2) AS expired FROM participant_judging p WHERE id=$1", [id, future])).rows[0].expired, false);
      assert.equal((await client.query("SELECT sample_run_expired(jsonb_populate_record(NULL::participant_judging,to_jsonb(p)||jsonb_build_object('sample_expiry_policy',1)),$2) AS expired FROM participant_judging p WHERE id=$1", [id, future])).rows[0].expired, true);
    } finally { await client.query("ROLLBACK"); client.release(); }
    await assert.rejects(owner.query("UPDATE participant_judging SET sample_expiry_policy=1 WHERE id=$1", [id]), { code: "P0001" });
    answers.set(id, "PASSED"); await complete(id);
  });
  await t.test("sample inactivity deadline equality releases logical capacity, never physical uncertainty or official receipt priority", async () => {
    const a = await c.newRound(), sample = await admit(a, a.aa, "run"), official = await admit(a, a.ab, "submit");
    // No answer is installed yet: both synthetic providers remain pending with occupied physical slots.
    for (let i = 0; i < 2; i++) assert.equal(await c.judge.tick(), "PENDING");
    const client = await owner.connect();
    try {
      await client.query("BEGIN");
      const created = (await client.query("SELECT max(prepared_at) AS created_at FROM participant_attempts WHERE job_id IN (SELECT id FROM participant_jobs WHERE parent_id=$1)", [sample])).rows[0].created_at as Date;
      await client.query("SELECT participant_refresh($1)", [new Date(created.getTime() + 119999)]);
      assert.equal((await client.query("SELECT result FROM participant_judging WHERE id=$1", [sample])).rows[0].result, null);
      await client.query("SELECT participant_refresh($1)", [new Date(created.getTime() + 120000)]);
      assert.equal((await client.query("SELECT result FROM participant_judging WHERE id=$1", [sample])).rows[0].result, "INFRA_ERROR");
      assert.equal((await client.query("SELECT count(*)::integer n FROM execution_capacity_slots WHERE participant_attempt_id IS NOT NULL")).rows[0].n, 2);
      const officialCreated = (await client.query("SELECT created_at FROM participant_judging WHERE id=$1", [official])).rows[0].created_at as Date;
      await client.query("SELECT participant_refresh($1)", [new Date(officialCreated.getTime() + 300000)]);
      assert.equal((await client.query("SELECT status FROM participant_judging WHERE id=$1", [official])).rows[0].status, "NEEDS_ATTENTION");
      assert.equal((await client.query("SELECT count(*)::integer n FROM wrong_submission_penalties w JOIN competition_submissions s ON s.id=w.submission_id WHERE s.round_id=$1", [a.round])).rows[0].n, 0);
    } finally { await client.query("ROLLBACK"); client.release(); }
    answers.set(sample, "PASSED"); answers.set(official, "PASSED"); await complete(sample); await complete(official);
  });
  await t.test("new Runs respect every pause, claims and closing while already-admitted samples keep their original lifetime", async () => {
    const a = await c.newRound(), key = randomUUID(); await c.budgets();
    const first = await service.run(a.aa, a.round, a.x, "paused original", key), id = first.result.run_id as string;
    await control(a, "PAUSE", { scope: "GLOBAL", target: null });
    assert.deepEqual(await service.run(a.aa, a.round, a.x, "paused original", key), first);
    assert.equal((await service.run(a.ab, a.round, a.x, "new", randomUUID())).result.reason, "ROUND_UNAVAILABLE");
    answers.set(id, "PASSED"); await complete(id);
    await control(a, "RESUME", { scope: "GLOBAL", target: null });
    const member = (await parent(id)).member_round_id, team = (await parent(id)).team_round_id;
    await control(a, "PAUSE", { scope: "MEMBER", target: member });
    assert.equal((await service.run(a.aa, a.round, a.y, "new", randomUUID())).result.reason, "ROUND_UNAVAILABLE");
    const teammate = await admit(a, a.ab, "run", a.y);
    await control(a, "PAUSE", { scope: "TEAM", target: team });
    assert.equal((await service.run(a.ab, a.round, a.x, "new", randomUUID())).result.reason, "ROUND_UNAVAILABLE");
    const opponent = await admit(a, a.ba, "run", a.x);
    await control(a, "RESUME", { scope: "TEAM", target: team }); await control(a, "RESUME", { scope: "MEMBER", target: member });
    const official = await admit(a, a.aa, "submit", a.x); answers.set(official, "PASSED"); answers.set(teammate, "PASSED"); answers.set(opponent, "PASSED");
    await complete(official);
    assert.equal((await service.run(a.ab, a.round, a.x, "after own award", randomUUID())).result.reason, "BOUNTY_UNAVAILABLE");
    await control(a, "CLOSE");
    assert.equal((await service.run(a.bb, a.round, a.y, "closed", randomUUID())).result.reason, "ROUND_UNAVAILABLE");
    await complete(teammate); await complete(opponent);
    assert.equal((await service.judging(a.ab, a.round, teammate)).result, "PASSED");
  });
  await t.test("participant Run and judging HTTP is CSRF-bound, excludes hidden feedback and keeps sample results member-private", async () => {
    const a = await c.newRound();
    const browser = { mode: "production" as const, origin: "https://ingenium.test", cookieKey: randomBytes(32), csrfKey: randomBytes(32) }, policy = browserPolicy(browser);
    const app = buildApp({ database: { check: async () => {}, close: async () => {} }, entry: { pool: api, clock: c.clock, delivery: c.delivery, browser, competition: c.deps } });
    await app.ready(); const cookies = new Map<string, string>();
    async function send(url: string, payload?: unknown, token?: string) {
      const response = await app.inject({ method: payload === undefined ? "GET" : "POST", url, headers: { origin: browser.origin,
        cookie: [...cookies].map(([key, value]) => `${key}=${value}`).join("; "), ...(token ? { "x-csrf-token": token } : {}) }, ...(payload === undefined ? {} : { payload: payload as never }) });
      const lines = response.headers["set-cookie"];
      for (const line of typeof lines === "string" ? [lines] : lines ?? []) { const pair = line.split(";")[0]!, at = pair.indexOf("="); cookies.set(pair.slice(0, at), pair.slice(at + 1)); }
      return response;
    }
    try {
      await send("/api/v1/bootstrap?audience=ANONYMOUS"); cookies.set(policy.names.participant, a.aa);
      const token = (await send("/api/v1/bootstrap?audience=PARTICIPANT")).json().data.csrf_token;
      const path = `/api/v1/competition/rounds/${a.round}/bounties/${a.x}/runs`, body = { request_key: randomUUID(), source: "unchanged\r\nsource" };
      assert.equal((await send(path, body)).statusCode, 403);
      assert.equal((await send(path, { ...body, language: "javascript" }, token)).statusCode, 400);
      await c.budgets(); const accepted = await send(path, body, token); assert.equal(accepted.statusCode, 200, accepted.body);
      const id = accepted.json().data.result.run_id as string; answers.set(id, "PASSED"); await complete(id);
      const result = await send(`/api/v1/competition/rounds/${a.round}/judging/${id}`); assert.equal(result.statusCode, 200, result.body);
      assert.equal(result.json().data.samples.length, 1); assert.equal(result.json().data.samples[0].stdout_truncated, false);
      assert.equal(result.json().data.source, body.source); assert.doesNotMatch(result.body, /evidence_digest|provider_token|expected_output|stdin|case_id/);
      cookies.set(policy.names.participant, a.ab);
      assert.equal((await send(`/api/v1/competition/rounds/${a.round}/judging/${id}`)).statusCode, 403);
      const official = await admit(a, a.ab, "submit"), poll = `/api/v1/competition/rounds/${a.round}/judging/${official}`;
      answers.set(official, "PASSED"); await complete(official);
      const visible = await send(poll); assert.equal(visible.statusCode, 200, visible.body); assert.deepEqual(visible.json().data.samples, []);
      assert.doesNotMatch(visible.body, /stdout|stderr|compiler|cpu_ns|peak_bytes|case_id|expected|stdin/);
      cookies.set(policy.names.participant, a.ba); assert.equal((await send(poll)).statusCode, 403);
    } finally { await app.close(); }
  });
  assert.ok([...c.sent.values()].every(n => n === 1));
  const polled = (await query("SELECT id FROM participant_attempts WHERE poll_count>0 LIMIT 1"))[0];
  assert.ok(polled);
  await assert.rejects(owner.query("UPDATE participant_attempts SET poll_count=0 WHERE id=$1", [polled.id]), { code: "P0001" });
  assert.deepEqual(new Set(trace.filter(p => p.sourceRole === "OFFICIAL").map(p => p.language)), new Set(["c", "cpp", "python", "java"]));
  assert.deepEqual(new Set(trace.filter(p => ["OFFICIAL", "SAMPLE"].includes(p.sourceRole)).map(p => p.language)), new Set(["c", "cpp", "python", "java"]));
}
