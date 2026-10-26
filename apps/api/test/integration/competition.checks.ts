import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import type { TestContext } from "node:test";
import { Client, Pool } from "pg";
import { LANGUAGES, newAccessCode, parseProof, sessionDelivery, sha256 } from "../../src/access/credentials.js";
import { createEntryService } from "../../src/access/entry-service.js";
import { createStaffService } from "../../src/access/staff-service.js";
import { createArenaService } from "../../src/access/arena-service.js";
import { AccessError } from "../../src/access/transaction.js";
import { createContentService } from "../../src/content/service.js";
import { createPublicationService } from "../../src/content/publication-service.js";
import type { ContentCommand } from "../../src/content/service.js";
import { createValidationService } from "../../src/content/validation-service.js";
import { createValidationRunService } from "../../src/content/validation-runs.js";
import { createValidationWorker } from "../../src/content/validation-worker.js";
import { authoringPayloadDigest } from "../../src/content/execution-policy.js";
import type { TrustedAuthoringDriver } from "../../src/content/execution-policy.js";
import { createCompetitionService } from "../../src/competition/service.js";
import type { CompetitionCommand } from "../../src/competition/service.js";
import { createDrawCipher, createDrawPlan, drawCommitment, qualifiers } from "../../src/competition/policy.js";
import { migrateDatabase } from "../../src/db/migrate.js";
import { buildApp } from "../../src/app.js";
import { createDatabase } from "../../src/database.js";
import { browserPolicy } from "../../src/access/browser-policy.js";
import { createParticipantJudgeWorker } from "../../src/competition/judging-worker.js";
import { setTimeout as delay } from "node:timers/promises";
import { participantJudgingChecks } from "./participant-judging.checks.js";
import { realtimeChecks } from "./realtime.checks.js";
import {workbenchChecks} from "./workbench.checks.js";
import type { BackupFixture } from "./backup-fixture.js";

export async function competitionChecks(t: TestContext, ownerConnection: string, apiConnection: string, backup?: { fixture: BackupFixture; container: string }) {
  const name = `ingenium_competition_${randomUUID().replaceAll("-", "")}`, bootstrap = new Client({ connectionString: ownerConnection });
  await bootstrap.connect(); try { await bootstrap.query(`CREATE DATABASE "${name}"`); } finally { await bootstrap.end(); }
  const ownerUrl = new URL(ownerConnection), apiUrl = new URL(apiConnection); ownerUrl.pathname = apiUrl.pathname = `/${name}`;
  await migrateDatabase(ownerUrl.toString());
  const owner = new Pool({ connectionString: ownerUrl.toString(), max: 2 }), api = ["load", "load-soak", "race-load"].includes(process.env.INGENIUM_TEST_SUITE ?? "")
    ? createDatabase(apiUrl.toString(), () => { healthy = false; }, 12).pool
    : new Pool({ connectionString: apiUrl.toString(), max: 4 });
  let healthy = true;
  const clock = { assertHealthy() { if (!healthy) throw new AccessError("CLOCK_UNTRUSTED"); }, async verify() {}, fault() {} };
  const delivery = sessionDelivery("synthetic-competition", randomBytes(32)), entry = createEntryService(api, clock, delivery), staff = createStaffService(api, clock, delivery);
  const arena = createArenaService(api, clock, delivery), content = createContentService(api, clock, delivery), validation = createValidationService(api, clock, delivery);
  const drawCipher = createDrawCipher(randomBytes(32));
  const deps = { drawCipher, async assertReady() {} }; // Synthetic readiness is confined to this disposable test database.
  const baseService = createCompetitionService(api, clock, delivery, deps);
  const service = { ...baseService, async submit(...args: Parameters<typeof baseService.submit>) {
    // Existing economics workflows intentionally wait through the real cooldown; the pipeline checks exercise refusal separately.
    const last = (await owner.query(`SELECT max(p.created_at) AS at FROM participant_judging p JOIN participant_sessions s ON s.member_round_id=p.member_round_id WHERE s.id=$1 AND p.lane='OFFICIAL'`, [parseProof(args[0])?.id ?? null])).rows[0]?.at as Date | null;
    if (last) await delay(Math.max(0, last.getTime() + 5010 - Date.now()));
    return baseService.submit(...args);
  } };
  const hostEpochId = randomUUID(), workerId = randomUUID();
  async function person(role = "OWNER") {
    const id = randomUUID(), code = newAccessCode();
    await owner.query("INSERT INTO staff_identities(id,display_name,role) VALUES($1,'Synthetic competition staff',$2)", [id, role]);
    await owner.query("INSERT INTO access_credentials(id,staff_id,verifier,version,issued_at) VALUES($1,$2,$3,1,date_trunc('milliseconds',clock_timestamp()))", [randomUUID(), id, code.verifier]);
    const flow = await entry.begin(code.code, { ip: "127.0.0.1", browserId: randomUUID() });
    if (flow.audience !== "STAFF") throw new Error("Synthetic staff routing failed");
    return { id, code: code.code, ...await staff.activate(flow.proofCookie, randomUUID()) };
  }
  type Person = Awaited<ReturnType<typeof person>>;
  async function team() {
    const id = randomUUID(), code = newAccessCode(), members = [randomUUID(), randomUUID()];
    await owner.query("INSERT INTO teams(id,display_name) VALUES($1,'Synthetic competition team')", [id]);
    await owner.query("INSERT INTO team_members(id,team_id,position,display_name) VALUES($1,$3,1,'First'),($2,$3,2,'Second')", [...members, id]);
    await owner.query("INSERT INTO access_credentials(id,team_id,verifier,version,issued_at) VALUES($1,$2,$3,1,date_trunc('milliseconds',clock_timestamp()))", [randomUUID(), id, code.verifier]);
    return { id, code: code.code, members };
  }
  // Quota behaviour has its own integration suite. These owner-only fixture resets keep long workflows bounded in test time.
  async function budgets() { await owner.query("DELETE FROM quota_buckets"); }
  async function command(actor: Person, action: CompetitionCommand["action"], roundId: string, payload: Record<string, unknown> = {}, patch: Partial<CompetitionCommand> = {}) {
    await budgets();
    const revision = (await owner.query("SELECT revision FROM rounds WHERE id=$1", [roundId])).rows[0].revision;
    return service.command(actor.sessionCookie, { action, roundId, requestKey: randomUUID(), expectedRevision: revision, reason: "Synthetic competition control", payload, ownCode: actor.code, ...patch });
  }
  let editor: Person, editCount = 0;
  async function edit(action: ContentCommand["action"], targetId: string | null, payload: unknown) {
    if (!editor || editCount++ % 8 === 0) editor = await person();
    const revision = action === "CREATE" ? (await owner.query("SELECT revision FROM catalogue_control WHERE id=1")).rows[0].revision
      : (await owner.query("SELECT content_revision FROM bug_versions WHERE id=$1", [targetId])).rows[0].content_revision;
    return content.command(editor.sessionCookie, { action, targetId, expectedRevision: revision, payload, requestKey: randomUUID(), reason: "Synthetic competition content" });
  }
  const answers = new Map<string, string>();
  const sent = new Map<string, number>();
  const trace: Parameters<TrustedAuthoringDriver["submit"]>[0][] = [];
  const lost = new Set<string>(), held = new Set<string>(), malformed = new Set<string>();
  async function observation(p: Parameters<TrustedAuthoringDriver["submit"]>[0]) {
      if (["OFFICIAL", "SAMPLE"].includes(p.sourceRole) && !answers.has(p.runId)) return { state: "PENDING" };
      const answer = answers.get(p.runId) ?? "PASSED";
      const first = (await owner.query("SELECT position=(SELECT min(position) FROM participant_jobs WHERE parent_id=$2) first FROM participant_jobs WHERE id=$1", [p.checkId, p.runId])).rows[0]?.first;
      const execution = first && answer !== "PASSED" && answer !== "WRONG_ANSWER" ? answer : "NORMAL";
      return { state: "FINISHED", attempt_id: p.attemptId, host_epoch_id: p.hostEpochId, payload_digest: authoringPayloadDigest(p).toString("hex"), runtime_digest: p.runtimeDigest,
        source_sha256: sha256(p.source).toString("hex"), stdin_sha256: sha256(p.stdin).toString("hex"), evidence_digest: sha256(p.attemptId).toString("hex"), execution_result: execution,
        stdout: Buffer.from(p.sourceRole === "STARTER" || first && answer === "WRONG_ANSWER" ? "wrong\n" : "12\n"), stdout_complete: true, stderr: Buffer.alloc(0), compiler_output: Buffer.alloc(0), stderr_truncated: false,
        compiler_output_truncated: false, cpu_ns: "10000", peak_bytes: "4096", drain: held.has(p.runId) ? null : { cannot_start: true, processes_stopped: true, workspace_removed: true, proof_digest: sha256(`synthetic:${p.attemptId}`).toString("hex") } };
  }
  const driver: TrustedAuthoringDriver = {
    hostEpochId, endpointRef: "synthetic-competition-only", runtimes: new Map(), async assertReady() {},
    async submit(p) {
      sent.set(p.attemptId, (sent.get(p.attemptId) ?? 0) + 1); trace.push(p);
      const value = await observation(p);
      if (lost.delete(p.runId)) throw new Error("Synthetic lost create reply after provider acceptance");
      return malformed.has(p.runId) ? { ...value, source_sha256: "0".repeat(64) } : value;
    }, async observe(p) { const value = await observation(p); return malformed.has(p.runId) ? { ...value, source_sha256: "0".repeat(64) } : value; },
  };
  let worker: ReturnType<typeof createValidationWorker>;
  let judge: ReturnType<typeof createParticipantJudgeWorker>;
  const judgePool = new Pool({ connectionString: ownerUrl.toString(), options: "-c role=ingenium_competition_worker", max: 2 });
  async function published(actor: Person, kind: number, difficulty: number) {
    const version = (await edit("CREATE", null, { round_type: kind, title: "Synthetic competition bounty", statement: "Synthetic statement", difficulty, checker_mode: "TOKENS" })).version_id!;
    for (const language of LANGUAGES) await edit("VARIANT", version, { language, starter_code: "synthetic wrong", reference_solution_code: "synthetic reference", defect_description: "Synthetic defect",
      runtime_key: `competition-${language}`, cpu_time_limit_ms: 1000, wall_time_limit_ms: 5000, memory_limit_kb: 262144 });
    const sample = (await edit("CASE", version, { case_id: null, position: 1, visibility: "SAMPLE", input_data: "7 5\n", expected_output: "12\n" })).case_id!;
    const hidden = (await edit("CASE", version, { case_id: null, position: 2, visibility: "HIDDEN", input_data: "5 7\n", expected_output: "12\n" })).case_id!;
    for (const level of [1, 2, 3]) await edit("HINT", version, { level, content: `Synthetic protected hint ${level}` });
    for (const language of LANGUAGES) await edit("WITNESSES", version, { language, witnesses: [{ check_type: "TEST_CASE", test_case_id: hidden, expected_failure: "WRONG_OUTPUT" }] });
    await budgets();
    const revision = (await owner.query("SELECT content_revision FROM bug_versions WHERE id=$1", [version])).rows[0].content_revision;
    const snapshot = (await validation.prepare(actor.sessionCookie, { versionId: version, requestKey: randomUUID(), expectedRevision: revision, reason: "Synthetic frozen competition input" })).snapshot_id!;
    assert.ok(snapshot);
    const run = (await createValidationRunService(api, clock, delivery).admit(actor.sessionCookie, { snapshotId: snapshot, requestKey: randomUUID(), expectedRevision: revision, reason: "Synthetic trusted test validation" })).run_id!;
    for (let i = 0; i < 80 && (await owner.query("SELECT status FROM validation_runs WHERE id=$1", [run])).rows[0].status !== "PASSED"; i++) await worker.tick();
    assert.equal((await owner.query("SELECT status FROM validation_runs WHERE id=$1", [run])).rows[0].status, "PASSED");
    await createPublicationService(api,clock,delivery).publish(actor.sessionCookie,{snapshotId:snapshot,runId:run,requestKey:randomUUID(),expectedRevision:revision,review:"Synthetic reviewed five-language content",ownCode:actor.code});
    return { snapshot, version, cases: [sample, hidden] };
  }
  async function join(a: Awaited<ReturnType<typeof team>>, member: number, language = "cpp") {
    const flow = await entry.begin(a.code, { ip: "127.0.0.1", browserId: randomUUID() });
    if (flow.audience !== "TEAM") throw new Error("Synthetic team routing failed");
    const activated = await entry.activate(flow.proofCookie, { memberId: a.members[member]!, language: language as "cpp", requestKey: randomUUID() });
    if (activated.status !== "ACTIVATED") throw new Error("Synthetic member activation failed");
    return activated;
  }
  async function assess(submission: string, verdict = "PASSED") {
    if (verdict !== "INFRA_ERROR") {
      answers.set(submission, verdict); assert.equal(await judge.claim(), true);
      for (let i = 0; i < 150; i++) {
        const row = (await owner.query("SELECT verdict FROM competition_assessments WHERE submission_id=$1", [submission])).rows[0];
        if (row) { assert.equal(row.verdict, verdict); return row; }
        const result = await judge.tick(); if (result === "IDLE") await delay(100);
        assert.ok(["IDLE", "OBSERVED", "PENDING"].includes(result), result);
      }
      throw new Error("Synthetic participant pipeline did not settle");
    }
    const source = (await owner.query("SELECT source FROM competition_submissions WHERE id=$1", [submission])).rows[0].source;
    const cases = (await owner.query(`SELECT c.case_id FROM competition_submissions s JOIN bounties b ON b.id=s.bounty_id
      JOIN validation_snapshot_cases c ON c.snapshot_id=b.snapshot_id WHERE s.id=$1 ORDER BY c.position`, [submission])).rows;
    const results = cases.map((c, i) => ({ case_id: c.case_id, verdict: i === 0 ? verdict : "PASSED", evidence_digest: sha256(`synthetic-only:${submission}:${i}:${verdict}`).toString("hex") }));
    const client = await owner.connect();
    try {
      await client.query("BEGIN; SET LOCAL ROLE ingenium_competition_worker");
      const value = await client.query("SELECT competition_assess($1,$2,$3::jsonb) AS value", [submission, sha256(source), JSON.stringify(results)]);
      await client.query("COMMIT"); return value.rows[0].value;
    } catch (e) { await client.query("ROLLBACK"); throw e; } finally { client.release(); }
  }
  try {
    const actor = await person(), organiser = await person("ORGANISER"), a = await team(), b = await team();
    await t.test("SQL qualification and commitment match the published 48-plus-three cutoff rule and preserve all sporting ties", async () => {
      const ids: string[] = Array.from({ length: 51 }, () => randomUUID()), plan = createDrawPlan(randomUUID(), ids);
      const standings = ids.map((id, i) => ({ team_round_id: id, points: i < 48 ? 100 : 0, effective_time_ms: 0, difficulties: [], rank: i < 48 ? 1 : 49 }));
      const sql = (await owner.query("SELECT competition_draw_commitment($1::jsonb) commitment,competition_qualifiers($2::jsonb,$1::jsonb) selected", [JSON.stringify(plan), JSON.stringify(standings)])).rows[0];
      assert.equal(sql.commitment, drawCommitment(plan)); assert.deepEqual([...sql.selected].sort(), qualifiers(standings, plan).sort());
      assert.deepEqual(sql.selected.slice(48), plan.permutation.filter(id => ids.slice(48).includes(id)).slice(0, 2));
      await assert.rejects(owner.query("SELECT competition_qualifiers($1::jsonb,$2::jsonb)", [JSON.stringify(standings), JSON.stringify({ ...plan, permutation: [...plan.permutation.slice(1), plan.permutation[1]] })]));
    });
    await owner.query("INSERT INTO judge_host_epochs(id,state,endpoint_ref,created_at) VALUES($1,'ACTIVE','synthetic-competition-only',date_trunc('milliseconds',clock_timestamp()))", [hostEpochId]);
    for (const language of LANGUAGES) {
      const row = (await owner.query(`INSERT INTO runtime_manifests(key,language,manifest,digest,created_at)
        SELECT $1,$2,$3::jsonb,sha256(convert_to($3::jsonb::text,'UTF8')),date_trunc('milliseconds',clock_timestamp()) RETURNING digest`, [`competition-${language}`, language, JSON.stringify({ synthetic_only: true })])).rows[0];
      (driver.runtimes as Map<string, { key: string; digest: string }>).set(language, { key: `competition-${language}`, digest: row.digest.toString("hex") });
      await owner.query("INSERT INTO judge_host_runtimes VALUES($1,$2,$3)", [hostEpochId, language, `competition-${language}`]);
    }
    worker = createValidationWorker(api, clock, driver); assert.equal(await worker.claim(), true);
    judge = createParticipantJudgeWorker(judgePool, clock, driver, worker.workerId);
    const one = await published(actor, 1, 100), two = await published(actor, 1, 80), race = await published(actor, 2, 95), race2 = await published(actor, 2, 80);
    await budgets();
    const created = await arena.command(actor.sessionCookie, { action: "CREATE", roundId: null, requestKey: randomUUID(), expectedRevision: "0", durationMs: 18000000, teamIds: [a.id, b.id], reason: "Synthetic competition instance" });
    const r1 = created.round_id!;
    await t.test("competition selection requires matching reviewed publications; starts need current readiness and sensitive owner confirmation", async () => {
      await assert.rejects(command(actor, "CONFIGURE", r1, { snapshots: [race.snapshot] }));
      await assert.rejects(command(organiser, "CONFIGURE", r1, { snapshots: [one.snapshot] }));
      assert.equal((await command(actor, "CONFIGURE", r1, { snapshots: [one.snapshot, two.snapshot] })).result.status, "APPLIED");
      assert.equal((await command(actor, "READY", r1)).result.status, "APPLIED");
      await assert.rejects(command(actor, "START", r1, {}, { ownCode: newAccessCode().code }));
      const revision = (await owner.query("SELECT revision FROM rounds WHERE id=$1", [r1])).rows[0].revision;
      await assert.rejects(createCompetitionService(api, clock, delivery).command(actor.sessionCookie, { action: "START", roundId: r1, requestKey: randomUUID(), expectedRevision: revision, reason: "Not installed", payload: {}, ownCode: actor.code }));
      await worker.claim();
      const key = randomUUID(), start = await command(actor, "START", r1, {}, { requestKey: key });
      assert.equal(start.result.status, "APPLIED");
      const repeated = await service.command(actor.sessionCookie, { action: "START", roundId: r1, requestKey: key, expectedRevision: revision, reason: "Synthetic competition control", payload: {}, ownCode: actor.code });
      assert.deepEqual(repeated, start);
      assert.equal((await owner.query("SELECT count(*)::integer n FROM team_rounds WHERE round_id=$1", [r1])).rows[0].n, 2);
      await assert.rejects(command(actor, "CONFIGURE", r1, { snapshots: [one.snapshot] }));
      await assert.rejects(command(actor, "SETUP_R2", r1, { teams: [a.id], duration_ms: 1000 }));
    });
    const aa = await join(a, 0), ab = await join(a, 1, "python"), ba = await join(b, 0);
    const selected = (await owner.query("SELECT b.id,b.snapshot_id FROM bounties b WHERE b.round_id=$1 ORDER BY position", [r1])).rows;
    const x = selected[0].id as string, y = selected[1].id as string;
    async function pipeline() {
      let current = r1, count = 0;
      const context={ owner, api, clock, delivery, deps, service: baseService, judge, validationWorker:worker, driver, judgePool, answers, sent, trace, lost, held, malformed,
        staff: actor, organiser, budgets, newStaff:person, newTeam:team, teams:[a,b], assess, raceSnapshots:[race.snapshot,race2.snapshot], async startRace(round:string) {
          await budgets();await command(actor,"CLOSE",round);await command(actor,"FINALISE",round);await command(actor,"QUALIFY",round);
          const next=(await command(actor,"SETUP_R2",round,{teams:[a.id,b.id],duration_ms:18000000})).result.round_id as string;
          await command(actor,"CONFIGURE",next,{snapshots:[race.snapshot,race2.snapshot]});await command(actor,"READY",next);await judge.claim();await command(actor,"START",next);
          const aa=await join(a,0),ab=await join(a,1,"python"),ba=await join(b,0,"java"),bb=await join(b,1,"javascript");
          const bugs=(await owner.query("SELECT id FROM bounties WHERE round_id=$1 ORDER BY position",[next])).rows;
          return {round:next,aa:aa.sessionCookie,ab:ab.sessionCookie,ba:ba.sessionCookie,bb:bb.sessionCookie,x:bugs[0].id as string,y:bugs[1].id as string};
        }, async newRound(durationMs = 18000000) {
          const row = (await owner.query(`SELECT r.* FROM rounds r JOIN arena_control c ON c.current_instance_id=r.arena_instance_id
            WHERE r.kind=1 OR r.state NOT IN ('DRAFT','READY') ORDER BY r.kind DESC LIMIT 1`)).rows[0];
          if (row) {
            if (row.state === "PAUSED") await command(actor, "RESUME", row.id, {scope:"GLOBAL",target:null});
            if (["RUNNING","PAUSED"].includes(row.state)) await command(actor, "CLOSE", row.id);
            if (["RUNNING","PAUSED","CLOSING"].includes(row.state)) await command(actor, "FINALISE", row.id);
            // Final R2 closes its own instance; only an R1-only instance may be discarded.
            if (row.kind === 1) await command(actor, "DISCARD", row.id);
          }
          await budgets(); await judge.claim();
          const made = await arena.command(actor.sessionCookie, { action: "CREATE", roundId: null, requestKey: randomUUID(), expectedRevision: (await owner.query("SELECT revision FROM arena_control WHERE id=1")).rows[0].revision,
            durationMs, teamIds: [a.id, b.id], reason: "Synthetic participant pipeline" });
          current = made.round_id!;
          await command(actor, "CONFIGURE", current, { snapshots: [one.snapshot, two.snapshot] }); await command(actor, "READY", current); await command(actor, "START", current);
          const aa = await join(a, 0, count++ % 2 ? "c" : "cpp"), ab = await join(a, 1, "python"), ba = await join(b, 0, "java"), bb = await join(b, 1, "javascript");
          const bugs = (await owner.query("SELECT id FROM bounties WHERE round_id=$1 ORDER BY position", [current])).rows;
          return { round: current, aa: aa.sessionCookie, ab: ab.sessionCookie, ba: ba.sessionCookie, bb: bb.sessionCookie, x: bugs[0].id as string, y: bugs[1].id as string };
        } };
      if(["load","load-soak"].includes(process.env.INGENIUM_TEST_SUITE??"")){const {loadChecks}=await import("./load.checks.js");await loadChecks(t,context);return;}
      if(process.env.INGENIUM_TEST_SUITE==="race-load"){const {raceLoadChecks}=await import("./race-load.checks.js");await raceLoadChecks(t,context);return;}
      if(["operations","operations-browser"].includes(process.env.INGENIUM_TEST_SUITE??"")){const {operationsChecks}=await import("./operations.checks.js");await operationsChecks(t,context);return;}
      if(process.env.INGENIUM_TEST_SUITE==="restore"){const {restoreChecks}=await import("./restore.checks.js");await restoreChecks(t,context);return;}
      if(process.env.INGENIUM_TEST_SUITE==="backup"){assert.ok(backup);const {backupChecks}=await import("./backup.checks.js");await backupChecks(t,context,backup);return;}
      if(process.env.INGENIUM_TEST_SUITE==="https"){const {httpsChecks}=await import("./https.checks.js");await httpsChecks(t,context);return;}
      if(process.env.INGENIUM_TEST_SUITE==="worker"){const {workerRuntimeChecks}=await import("./worker-runtime.checks.js");await workerRuntimeChecks(t,context);return;}
      if(process.env.INGENIUM_TEST_SUITE==="maintenance"){const {maintenanceChecks}=await import("./maintenance.checks.js");await maintenanceChecks(t,context);return;}
      if(process.env.INGENIUM_TEST_SUITE==="discipline"){const {disciplineChecks}=await import("./discipline.checks.js");await disciplineChecks(t,context);return;}
      if(process.env.INGENIUM_TEST_SUITE==="cancellation"){const {cancellationChecks}=await import("./cancellation.checks.js");await cancellationChecks(t,context);return;}
      if(["history","history-browser"].includes(process.env.INGENIUM_TEST_SUITE??"")){const {historyChecks}=await import("./history.checks.js");await historyChecks(t,context);return;}
      if(["judging","judging-browser"].includes(process.env.INGENIUM_TEST_SUITE??"")){const {staffJudgingChecks}=await import("./staff-judging.checks.js");await staffJudgingChecks(t,context);return;}
      if(["review","review-browser"].includes(process.env.INGENIUM_TEST_SUITE??"")){const {submissionReviewChecks}=await import("./submission-review.checks.js");await submissionReviewChecks(t,context);return;}
      if(["audit","audit-browser"].includes(process.env.INGENIUM_TEST_SUITE??"")){const {staffAuditChecks}=await import("./staff-audit.checks.js");await staffAuditChecks(t,context);return;}
      if(["announcements","announcements-browser"].includes(process.env.INGENIUM_TEST_SUITE??"")){const {announcementChecks}=await import("./announcements.checks.js");await announcementChecks(t,context);return;}
      if(["team-access","team-access-browser"].includes(process.env.INGENIUM_TEST_SUITE??"")){const {teamAccessChecks}=await import("./team-access.checks.js");await teamAccessChecks(t,context);return;}
      if(["results","results-browser"].includes(process.env.INGENIUM_TEST_SUITE??"")){const {resultsExportChecks}=await import("./results-export.checks.js");await resultsExportChecks(t,context);return;}
      if(process.env.INGENIUM_TEST_SUITE==="retention"){const {retentionChecks}=await import("./retention.checks.js");await retentionChecks(t,context);return;}
      if(["browser","registration-browser","discipline-browser","cancellation-browser"].includes(process.env.INGENIUM_TEST_SUITE??"")){const {participantBrowserChecks}=await import("./frontend-browser.checks.js");await participantBrowserChecks(t,context);return;}
      if(!process.env.INGENIUM_TEST_SUITE || process.env.INGENIUM_TEST_SUITE==="competition") { const {disciplineChecks}=await import("./discipline.checks.js");await disciplineChecks(t,context); }
      if(!process.env.INGENIUM_TEST_SUITE || process.env.INGENIUM_TEST_SUITE==="competition") { const {cancellationChecks}=await import("./cancellation.checks.js");await cancellationChecks(t,context); }
      if(!["live","workbench"].includes(process.env.INGENIUM_TEST_SUITE??""))await participantJudgingChecks(t,context);
      if(!["live","participant"].includes(process.env.INGENIUM_TEST_SUITE??""))await workbenchChecks(t,context);
      if(!process.env.INGENIUM_TEST_SUITE || process.env.INGENIUM_TEST_SUITE==="competition"){const {historyChecks}=await import("./history.checks.js");await historyChecks(t,context);}
      if(!process.env.INGENIUM_TEST_SUITE || process.env.INGENIUM_TEST_SUITE==="competition"){const {staffJudgingChecks}=await import("./staff-judging.checks.js");await staffJudgingChecks(t,context);}
      if(!process.env.INGENIUM_TEST_SUITE || process.env.INGENIUM_TEST_SUITE==="competition"){const {submissionReviewChecks}=await import("./submission-review.checks.js");await submissionReviewChecks(t,context);}
      if(!process.env.INGENIUM_TEST_SUITE || process.env.INGENIUM_TEST_SUITE==="competition"){const {staffAuditChecks}=await import("./staff-audit.checks.js");await staffAuditChecks(t,context);}
      if(!process.env.INGENIUM_TEST_SUITE || process.env.INGENIUM_TEST_SUITE==="competition"){const {announcementChecks}=await import("./announcements.checks.js");await announcementChecks(t,context);}
      if(!["participant","workbench"].includes(process.env.INGENIUM_TEST_SUITE??""))await realtimeChecks(t,context);
      if(!process.env.INGENIUM_TEST_SUITE || process.env.INGENIUM_TEST_SUITE==="competition"){const {teamAccessChecks}=await import("./team-access.checks.js");await teamAccessChecks(t,context);}
      if(!process.env.INGENIUM_TEST_SUITE || process.env.INGENIUM_TEST_SUITE==="competition"){const {resultsExportChecks}=await import("./results-export.checks.js");await resultsExportChecks(t,context);}
      if(!process.env.INGENIUM_TEST_SUITE || process.env.INGENIUM_TEST_SUITE==="competition"){const {retentionChecks}=await import("./retention.checks.js");await retentionChecks(t,context);}
    }
    if (["load","load-soak","race-load","operations","operations-browser","restore","backup","https","worker","maintenance","participant","live","workbench","history","history-browser","judging","judging-browser","review","review-browser","audit","audit-browser","announcements","announcements-browser","team-access","team-access-browser","results","results-browser","retention","browser","registration-browser","discipline","discipline-browser","cancellation","cancellation-browser"].includes(process.env.INGENIUM_TEST_SUITE??"")) { await pipeline(); return; }
    let emptyWalletKey: string, emptyWalletReceipt: unknown;
    await t.test("an unaffordable hint rejection is durable and malformed or unconfigured submissions allocate no receipt or priority", async () => {
      await budgets(); emptyWalletKey = randomUUID();
      emptyWalletReceipt = await service.buyHint(aa.sessionCookie, r1, y, 1, emptyWalletKey);
      assert.equal((emptyWalletReceipt as { result: { reason: string } }).result.reason, "INSUFFICIENT_FUNDS");
      const before = (await owner.query("SELECT next_receipt FROM competition_configs WHERE round_id=$1", [r1])).rows;
      for (const source of ["", "   ", "\ud800", "x".repeat(131073)]) await assert.rejects(service.submit(aa.sessionCookie, r1, y, source, randomUUID()));
      await assert.rejects(createCompetitionService(api, clock, delivery).submit(aa.sessionCookie, r1, y, "valid code", randomUUID()));
      assert.deepEqual((await owner.query("SELECT next_receipt FROM competition_configs WHERE round_id=$1", [r1])).rows, before);
    });
    await t.test("R1 correct submissions credit independent teams once and reject a second pending team/bounty submission", async () => {
      await budgets(); await worker.claim();
      const wrong = await service.submit(ba.sessionCookie, r1, y, "synthetic R1 wrong", randomUUID());
      await assess(wrong.result.submission_id as string, "WRONG_ANSWER");
      assert.equal((await owner.query("SELECT count(*)::integer n FROM wrong_submission_penalties")).rows[0].n, 0);
      const first = await service.submit(aa.sessionCookie, r1, x, "synthetic source", randomUUID());
      const duplicate = await service.submit(ab.sessionCookie, r1, x, "other source", randomUUID());
      assert.equal(duplicate.result.reason, "OFFICIAL_PENDING");
      const other = await service.submit(ba.sessionCookie, r1, x, "source from other team", randomUUID());
      assert.equal(first.result.status, "ADMITTED"); assert.equal(other.result.status, "ADMITTED");
      await assess(other.result.submission_id as string); await assess(first.result.submission_id as string);
      assert.equal((await owner.query("SELECT count(*)::integer n FROM bounty_awards WHERE bounty_id=$1", [x])).rows[0].n, 2);
      assert.equal((await service.submit(ab.sessionCookie, r1, x, "another answer", randomUUID())).result.reason, "BOUNTY_UNAVAILABLE");
      assert.deepEqual(await service.buyHint(aa.sessionCookie, r1, y, 1, emptyWalletKey!), emptyWalletReceipt);
    });
    await t.test("parallel teammates buy one shared sequential hint, retain no-charge receipts and spend exact committed funds", async () => {
      await budgets(); const key = randomUUID();
      const replies = await Promise.all([service.buyHint(aa.sessionCookie, r1, y, 1, key), service.buyHint(ab.sessionCookie, r1, y, 1, randomUUID())]);
      assert.deepEqual(replies.map(r => r.result.status).sort(), ["ALREADY_OWNED", "PURCHASED"]);
      assert.deepEqual(await service.buyHint(aa.sessionCookie, r1, y, 1, key), replies[0]);
      assert.equal((await service.buyHint(aa.sessionCookie, r1, y, 3, randomUUID())).result.reason, "HINT_LOCKED");
      const lockedKey = randomUUID(), rejection = await service.buyHint(aa.sessionCookie, r1, y, 3, lockedKey);
      await service.buyHint(ab.sessionCookie, r1, y, 2, randomUUID());
      assert.deepEqual(await service.buyHint(aa.sessionCookie, r1, y, 3, lockedKey), rejection);
      assert.equal((await service.hints(ab.sessionCookie, r1, y)).length, 2);
      const row = (await owner.query("SELECT competition_standings($1) value", [r1])).rows[0].value.find((s: { team_id: string }) => s.team_id === a.id);
      assert.equal(row.wallet, 680); assert.equal(row.points, 680);
      assert.equal((await owner.query("SELECT count(*)::integer n FROM wallet_entries WHERE purchase_id IS NOT NULL")).rows[0].n, 2);
    });
    await t.test("competition HTTP keeps writes CSRF-bound, receipts private and opponent wallets, hidden tests and locked hints out of read projections", async () => {
      await budgets();
      const browser = { mode: "production" as const, origin: "https://ingenium.test", cookieKey: randomBytes(32), csrfKey: randomBytes(32) }, policy = browserPolicy(browser);
      const app = buildApp({ database: { check: async () => {}, close: async () => {} }, entry: { pool: api, clock, delivery, browser, competition: deps } });
      await app.ready(); const cookies = new Map<string, string>();
      async function send(url: string, body?: unknown, token?: string, origin = browser.origin) {
        const response = await app.inject({ method: body === undefined ? "GET" : "POST", url, headers: { origin,
          cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join("; "), ...(token ? { "x-csrf-token": token } : {}) }, ...(body === undefined ? {} : { payload: body as never }) });
        const lines = response.headers["set-cookie"];
        for (const line of typeof lines === "string" ? [lines] : lines ?? []) { const pair = line.split(";")[0]!, at = pair.indexOf("="); cookies.set(pair.slice(0, at), pair.slice(at + 1)); }
        return response;
      }
      try {
        const anonymous = await send("/api/v1/bootstrap?audience=ANONYMOUS"); cookies.set(policy.names.participant, aa.sessionCookie);
        const boot = await send("/api/v1/bootstrap?audience=PARTICIPANT"), token = boot.json().data.csrf_token;
        const path = `/api/v1/competition/rounds/${r1}/bounties/${y}/hints`, body = { request_key: randomUUID(), level: 1 };
        assert.equal((await send(path, body, anonymous.json().data.csrf_token)).statusCode, 403);
        assert.equal((await send(path, body, token, "https://foreign.test")).statusCode, 403);
        assert.equal((await send(path, { ...body, price: 0 }, token)).statusCode, 400);
        const reply = await send(path, body, token); assert.equal(reply.statusCode, 200, reply.body); assert.equal(reply.json().data.result.status, "ALREADY_OWNED");
        const recovered = await send(`/api/v1/competition/rounds/${r1}/outcomes/${body.request_key}`);
        assert.deepEqual(recovered.json().data.outcome, reply.json().data);
        const changed = await send(path, { ...body, level: 2 }, token); assert.equal(changed.statusCode, 409);
        const standings = await send(`/api/v1/competition/rounds/${r1}/standings`); assert.equal(standings.statusCode, 200, standings.body);
        assert.ok(standings.json().data.standings.every((s: object) => !Object.hasOwn(s, "wallet")));
        const state = await send(`/api/v1/competition/rounds/${r1}`); assert.equal(state.statusCode, 200, state.body); assert.equal(state.json().data.wallet, 680);
        assert.doesNotMatch(state.body, /ciphertext|reference_code|source_b64|expected_output|verifier/);
        const unlocked = await send(path); assert.equal(unlocked.statusCode, 200); assert.equal(unlocked.json().data.length, 2); assert.doesNotMatch(unlocked.body, /hint 3/);
        assert.equal((await send(`/api/v1/staff/competition/rounds/${r1}`)).statusCode, 401);
        assert.equal((await send(`/api/v1/competition/rounds/${r1}/bounties/${y}/submissions`, { request_key: randomUUID(), source: " " }, token)).statusCode, 400);
        assert.equal(reply.headers["cache-control"], "no-store");
      } finally { await app.close(); }
    });
    await t.test("team and member pauses restrict only their scope; member pauses never discount the shared team's solve clock", async () => {
      const mr = (await owner.query("SELECT id,team_round_id FROM member_rounds WHERE round_id=$1 AND member_id=$2", [r1, a.members[0]])).rows[0];
      const closes = (await owner.query("SELECT closes_at FROM rounds WHERE id=$1", [r1])).rows[0].closes_at;
      await command(actor, "PAUSE", r1, { scope: "TEAM", target: mr.team_round_id });
      assert.equal((await service.buyHint(ab.sessionCookie, r1, y, 3, randomUUID())).result.status, "REJECTED");
      await command(actor, "PAUSE", r1, { scope: "MEMBER", target: mr.id });
      await command(actor, "RESUME", r1, { scope: "TEAM", target: mr.team_round_id });
      assert.equal((await service.buyHint(aa.sessionCookie, r1, y, 3, randomUUID())).result.status, "REJECTED");
      const times = (await owner.query(`WITH point AS MATERIALIZED(SELECT date_trunc('milliseconds',clock_timestamp()) n)
        SELECT competition_elapsed($1,$2,$3,n) AS member,competition_elapsed($1,$2,$4,n) AS teammate FROM point`, [r1, mr.team_round_id, mr.id, ab.session.memberRoundId])).rows[0];
      assert.equal(times.member, times.teammate);
      await command(actor, "RESUME", r1, { scope: "MEMBER", target: mr.id });
      assert.deepEqual((await owner.query("SELECT closes_at FROM rounds WHERE id=$1", [r1])).rows[0].closes_at, closes);
    });
    await t.test("global pause defers awards; resume extends only the common deadline and does not rewrite original receipt or hint tier", async () => {
      await budgets(); await worker.claim();
      const pending = await service.submit(aa.sessionCookie, r1, y, "frozen receipt source", randomUUID());
      await service.buyHint(ab.sessionCookie, r1, y, 3, randomUUID());
      const before = (await owner.query("SELECT closes_at FROM rounds WHERE id=$1", [r1])).rows[0].closes_at;
      await command(actor, "PAUSE", r1, { scope: "GLOBAL", target: null });
      assert.equal((await service.buyHint(ab.sessionCookie, r1, y, 1, randomUUID())).result.status, "ALREADY_OWNED");
      await assess(pending.result.submission_id as string);
      assert.equal((await owner.query("SELECT count(*)::integer n FROM bounty_awards WHERE bounty_id=$1", [y])).rows[0].n, 0);
      assert.equal((await service.buyHint(ba.sessionCookie, r1, y, 1, randomUUID())).result.status, "REJECTED");
      await assert.rejects(command(actor, "CLOSE", r1));
      await command(actor, "RESUME", r1, { scope: "GLOBAL", target: null });
      const after = (await owner.query("SELECT closes_at FROM rounds WHERE id=$1", [r1])).rows[0].closes_at;
      assert.ok(after > before);
      const awarded = (await owner.query("SELECT a.points,a.base_bounty,s.hint_tier FROM bounty_awards a JOIN competition_submissions s ON s.id=a.submission_id WHERE a.bounty_id=$1", [y])).rows[0];
      assert.deepEqual(awarded, { points: 800, base_bounty: 800, hint_tier: 2 });
    });
    let r2: string;
    await t.test("final R1 remains reserved, qualification reveals the original committed plan and R2 starts with zero score and one fixed carryover", async () => {
      await command(actor, "CLOSE", r1); await command(actor, "FINALISE", r1);
      assert.equal((await owner.query("SELECT current_instance_id FROM arena_control WHERE id=1")).rows[0].current_instance_id, created.instance_id);
      const qualification = await command(actor, "QUALIFY", r1); assert.equal(qualification.result.status, "APPLIED");
      const decision = (await owner.query("SELECT d.*,r.standings FROM qualification_decisions d JOIN round_results r ON r.id=d.result_id")).rows[0];
      assert.deepEqual([...decision.selected].sort(), qualifiers(decision.standings, decision.reveal).sort());
      r2 = (await command(actor, "SETUP_R2", r1, { teams: [a.id, b.id], duration_ms: 18000000 })).result.round_id as string;
      assert.equal((await command(actor, "SETUP_R2", r1, { teams: [a.id, b.id], duration_ms: 3600000 })).result.round_id, r2);
      await command(actor, "CONFIGURE", r2, { snapshots: [race.snapshot, race2.snapshot] }); await command(actor, "READY", r2); await worker.claim(); await command(actor, "START", r2);
      const rows = (await owner.query("SELECT competition_standings($1) value", [r2])).rows[0].value;
      assert.ok(rows.every((s: { points: number }) => s.points === 0));
      const original = decision.standings.find((s: { team_id: string }) => s.team_id === a.id);
      assert.equal(rows.find((s: { team_id: string }) => s.team_id === a.id).wallet, original.wallet);
      assert.equal((await owner.query("SELECT count(*)::integer n FROM round_carryovers")).rows[0].n, 2);
      await assert.rejects(command(actor, "START", r2));
    });
    const a2 = await join(a, 0), a22 = await join(a, 1, "javascript"), b2 = await join(b, 0);
    const r2b = (await owner.query("SELECT id FROM bounties WHERE round_id=$1 ORDER BY position", [r2!])).rows.map(r => r.id as string);
    await t.test("a later correct R2 receipt waits for an earlier unresolved one, then wins only when that earlier receipt is reliably wrong", async () => {
      await budgets(); await worker.claim();
      await service.buyHint(a2.sessionCookie, r2!, r2b[0]!, 1, randomUUID());
      await service.buyHint(a22.sessionCookie, r2!, r2b[0]!, 2, randomUUID());
      const earlier = await service.submit(b2.sessionCookie, r2!, r2b[0]!, "earlier wrong", randomUUID());
      const later = await service.submit(a2.sessionCookie, r2!, r2b[0]!, "later correct", randomUUID());
      const spending = await Promise.all([service.buyHint(a22.sessionCookie, r2!, r2b[0]!, 3, randomUUID()), service.buyHint(a2.sessionCookie, r2!, r2b[1]!, 1, randomUUID())]);
      assert.deepEqual(spending.map(r => r.result.status).sort(), ["PURCHASED", "REJECTED"]);
      await assess(later.result.submission_id as string);
      assert.equal((await owner.query("SELECT count(*)::integer n FROM bounty_awards WHERE bounty_id=$1", [r2b[0]])).rows[0].n, 0);
      await assess(earlier.result.submission_id as string, "WRONG_ANSWER");
      await assess(earlier.result.submission_id as string, "WRONG_ANSWER");
      const win = (await owner.query("SELECT points,base_bounty FROM bounty_awards WHERE bounty_id=$1", [r2b[0]])).rows[0];
      assert.deepEqual(win, { points: 665, base_bounty: 950 });
      assert.equal((await owner.query("SELECT count(*)::integer n FROM wrong_submission_penalties")).rows[0].n, 1);
      assert.equal((await service.buyHint(b2.sessionCookie, r2!, r2b[0]!, 1, randomUUID())).result.reason, "BOUNTY_UNAVAILABLE");
    });
    await t.test("finalisation refuses unresolved official work and completes the singleton only after every reliable result and effect settles", async () => {
      await budgets(); await worker.claim();
      for (const verdict of ["WRONG_ANSWER", "COMPILATION_ERROR", "RUNTIME_ERROR", "TIME_LIMIT_EXCEEDED", "MEMORY_LIMIT_EXCEEDED", "OUTPUT_LIMIT_EXCEEDED"]) {
        await budgets();
        const wrong = await service.submit(b2.sessionCookie, r2!, r2b[1]!, `synthetic ${verdict}`, randomUUID());
        if (verdict === "COMPILATION_ERROR") {
          const before = (await owner.query("SELECT count(*)::integer n FROM wrong_submission_penalties")).rows[0].n;
          await assert.rejects(assess(wrong.result.submission_id as string, "INFRA_ERROR"));
          assert.equal((await owner.query("SELECT count(*)::integer n FROM wrong_submission_penalties")).rows[0].n, before);
        }
        await assess(wrong.result.submission_id as string, verdict); await assess(wrong.result.submission_id as string, verdict);
      }
      assert.equal((await owner.query("SELECT count(*)::integer n FROM wrong_submission_penalties")).rows[0].n, 7);
      const probe = await owner.connect();
      try {
        await probe.query("BEGIN");
        await probe.query("SELECT competition_close_due(id,closes_at-interval '1 millisecond') FROM rounds WHERE id=$1", [r2]);
        assert.equal((await probe.query("SELECT state FROM rounds WHERE id=$1", [r2])).rows[0].state, "RUNNING");
        await probe.query("SELECT competition_close_due(id,closes_at) FROM rounds WHERE id=$1", [r2]);
        assert.equal((await probe.query("SELECT state FROM rounds WHERE id=$1", [r2])).rows[0].state, "CLOSING");
      } finally { await probe.query("ROLLBACK"); probe.release(); }
      const pending = await service.submit(b2.sessionCookie, r2!, r2b[1]!, "pending correct", randomUUID());
      await command(actor, "CLOSE", r2!);
      await assert.rejects(command(actor, "FINALISE", r2!));
      await assess(pending.result.submission_id as string);
      await command(actor, "FINALISE", r2!);
      assert.equal((await owner.query("SELECT current_instance_id FROM arena_control WHERE id=1")).rows[0].current_instance_id, null);
      assert.equal((await owner.query("SELECT status FROM arena_instances WHERE id=$1", [created.instance_id])).rows[0].status, "COMPLETED");
      await assert.rejects(api.query("SELECT competition_assess($1,$2,'[]')", [pending.result.submission_id, sha256("source")] ), { code: "42501" });
      for (const table of ["wallet_entries", "bounty_awards", "round_results", "competition_submissions"]) await assert.rejects(api.query(`DELETE FROM ${table}`), { code: "42501" });
      await assert.rejects(owner.query("UPDATE round_results SET standings='[]' WHERE round_id=$1", [r2]), { code: "P0001" });
      healthy = false; await assert.rejects(service.hints(a2.sessionCookie, r2!, r2b[0]!)); healthy = true;
    });
    await pipeline();
  } finally { await judgePool.end(); await api.end(); await owner.end(); }
}
