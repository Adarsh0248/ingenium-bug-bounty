import assert from "node:assert/strict";
import { randomBytes, randomUUID, X509Certificate } from "node:crypto";
import { readFile } from "node:fs/promises";
import { request } from "node:https";
import { join } from "node:path";
import type { TestContext } from "node:test";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { LANGUAGES, sha256 } from "../../src/access/credentials.js";
import { authoringPayloadDigest, acceptAuthoringObservation } from "../../src/content/execution-policy.js";
import type { AuthoringPayload } from "../../src/content/execution-policy.js";
import { createAuthoringJudgeDriver } from "../../src/content/judge-driver.js";
import { acceptJudgeReply, authoringRequest } from "../../src/content/judge-protocol.js";
import { buildJudgeGateway } from "../../src/judge/gateway.js";
import { createJudgePublisherStore, createJudgeRegistry, createJudgeSupervisorStore } from "../../src/judge/registry.js";
import { JUDGE_DATABASE_POOLS } from "../../src/judge/database-role.js";
import { judgeQueueChecks } from "./judge-queue.checks.js";
import { judgeExecutionChecks } from "./judge-execution.checks.js";
import { judgeLauncherChecks } from "./judge-launcher.checks.js";
import { judgeSupervisorChecks } from "./judge-supervisor.checks.js";
import { judgePayload, judgeReply, judgeRuntimes } from "../fixtures/judge.js";
import { createTestTls } from "../fixtures/tls.js";

export async function judgeGatewayChecks(t: TestContext, ownerUrl: string) {
  const parent = new Pool({ connectionString: ownerUrl, max: 1 });
  try { await parent.query("CREATE DATABASE ingenium_gateway_test"); } finally { await parent.end(); }
  const target = new URL(ownerUrl); target.pathname = "/ingenium_gateway_test";
  const owner = new Pool({ connectionString: target.toString(), max: 2, connectionTimeoutMillis: 2000 });
  let ingress: Pool | undefined, runner: Pool | undefined, publisherPool: Pool | undefined;
  try {
    // Structural fixture only; tests do not load the real Judge0 engine or execute source.
    await owner.query(`CREATE TABLE public.languages(id serial PRIMARY KEY,name text,compile_cmd text,run_cmd text,source_file text,is_archived boolean DEFAULT false);
      CREATE TABLE public.submissions(id serial PRIMARY KEY,source_code text,language_id integer,stdin text,expected_output text,status_id integer,created_at timestamp,
        token text,number_of_runs integer,cpu_time_limit numeric,cpu_extra_time numeric,wall_time_limit numeric,memory_limit integer,stack_limit integer,max_processes_and_or_threads integer,
        enable_per_process_and_thread_time_limit boolean,enable_per_process_and_thread_memory_limit boolean,max_file_size integer,redirect_stderr_to_stdout boolean,enable_network boolean);
      INSERT INTO public.submissions(source_code,token) VALUES('untouched pre-existing synthetic record','pre-existing');`);
    await owner.query(await readFile(fileURLToPath(new URL("../../../../infra/judge-gateway/001_registry.sql", import.meta.url)), "utf8"));
    await owner.query(await readFile(fileURLToPath(new URL("../../../../infra/judge-gateway/002_queue.sql", import.meta.url)), "utf8"));
    await owner.query(await readFile(fileURLToPath(new URL("../../../../infra/judge-gateway/003_execution_lookup.sql", import.meta.url)), "utf8"));
    await owner.query(await readFile(fileURLToPath(new URL("../../../../infra/judge-gateway/004_launch_gate.sql", import.meta.url)), "utf8"));
    await owner.query(await readFile(fileURLToPath(new URL("../../../../infra/judge-gateway/005_participant_payloads.sql", import.meta.url)), "utf8"));
    await owner.query(await readFile(fileURLToPath(new URL("../../../../infra/judge-gateway/006_supervisor_service.sql", import.meta.url)), "utf8"));
    const accounts = [];
    for (const [name, role] of [["ingenium_gateway_test_ingress", "ingenium_judge_gateway"], ["ingenium_gateway_test_runner", "ingenium_judge_supervisor"], ["ingenium_gateway_test_publisher", "ingenium_judge_publisher"]]) {
      const password = randomBytes(24).toString("hex");
      const statement = (await owner.query("SELECT format('CREATE ROLE %I LOGIN PASSWORD %L IN ROLE %I', $1::text,$2::text,$3::text) AS sql", [name, password, role])).rows[0].sql;
      await owner.query(statement); const url = new URL(target); url.username = name!; url.password = password;
      const max = role === "ingenium_judge_gateway" ? JUDGE_DATABASE_POOLS.gateway : role === "ingenium_judge_supervisor" ? JUDGE_DATABASE_POOLS.supervisor : JUDGE_DATABASE_POOLS.publisher;
      accounts.push(new Pool({ connectionString: url.toString(), max, connectionTimeoutMillis: 2000 }));
    }
    [ingress, runner, publisherPool] = accounts; assert.ok(ingress && runner && publisherPool);
    const config = { hostEpochId: randomUUID(), bootId: randomUUID(), runtimes: judgeRuntimes() };
    await owner.query("INSERT INTO ingenium_judge.control(id,epoch,boot_id,state) VALUES(1,$1,$2,'ACTIVE')", [config.hostEpochId, config.bootId]);
    for (const language of LANGUAGES) {
      const id = (await owner.query("INSERT INTO public.languages(name,compile_cmd,run_cmd,source_file) VALUES($1,'fixed compile','fixed run','fixed file') RETURNING id", [language])).rows[0].id;
      await owner.query("INSERT INTO ingenium_judge.runtimes SELECT $1,$2,$3,id,ingenium_judge.language_fingerprint(l) FROM public.languages l WHERE id=$4", [language, config.runtimes.get(language)!.key, config.runtimes.get(language)!.digest, id]);
    }
    const registry = createJudgeRegistry(ingress, config), supervisor = createJudgeSupervisorStore(runner, config);
    const fresh = () => supervisor.heartbeat(sha256("synthetic test readiness, no executor installed"));
    const payload = (language: AuthoringPayload["language"] = "cpp") => ({ ...judgePayload(language), hostEpochId: config.hostEpochId });
    const register = async (p: AuthoringPayload) => (await registry.admit(p, randomUUID())).value.provider_token!;
    const envelope = (p: AuthoringPayload) => { const { request_id: _id, ...value } = authoringRequest(p, randomUUID(), config.runtimes); return value; };
    let first: AuthoringPayload, firstToken: string, firstOwner: string;
    await t.test("whole-host retirement inspections serialize without a permit change and release on failure or cancellation",async()=>{
      let active=0,maximum=0,completed=0;
      const signal=AbortSignal.timeout(10000);
      await Promise.all(Array.from({length:8},()=>supervisor.withRetirementInspection(signal,async current=>{
        current.throwIfAborted();active++;maximum=Math.max(maximum,active);
        await new Promise(resolve=>setTimeout(resolve,25));active--;completed++;
      })));
      assert.equal(maximum,1);assert.equal(completed,8);
      await assert.rejects(supervisor.withRetirementInspection(signal,async()=>{throw new Error("Fixed inspection refusal");}),/Fixed inspection refusal/);
      const cancelled=new AbortController();cancelled.abort();
      await assert.rejects(supervisor.withRetirementInspection(cancelled.signal,async()=>{assert.fail("Cancelled inspection entered");}));
      let enter!:()=>void,release!:()=>void;
      const entered=new Promise<void>(resolve=>{enter=resolve;}),held=new Promise<void>(resolve=>{release=resolve;});
      const firstInspection=supervisor.withRetirementInspection(signal,async()=>{enter();await held;});
      await entered;
      const waiting=new AbortController(),blocked=supervisor.withRetirementInspection(waiting.signal,async()=>{assert.fail("Interrupted waiter entered");});
      await new Promise(resolve=>setTimeout(resolve,40));waiting.abort();
      await assert.rejects(blocked);release();await firstInspection;
      await assert.rejects(supervisor.withRetirementInspection(signal,async current=>{
        const holders=(await owner.query("SELECT pid FROM pg_catalog.pg_locks WHERE locktype='advisory' AND classid=$1::oid AND objid=$2::oid AND objsubid=2 AND granted AND database=(SELECT oid FROM pg_catalog.pg_database WHERE datname=current_database())",[0x494e4745,0x52455449])).rows;
        assert.equal(holders.length,1);
        assert.equal((await owner.query("SELECT pg_catalog.pg_terminate_backend($1) stopped",[holders[0].pid])).rows[0].stopped,true);
        const deadline=performance.now()+2000;while(!current.aborted){assert.ok(performance.now()<deadline);await new Promise(resolve=>setTimeout(resolve,5));}
        current.throwIfAborted();
      }));
      await supervisor.withRetirementInspection(signal,async current=>current.throwIfAborted());
      assert.equal((await owner.query("SELECT count(*)::int n FROM public.submissions")).rows[0].n,1);
    });
    await t.test("judge registry starts unavailable, with no host supplied by migration and no provider or outbox side effect", async () => {
      assert.equal(await registry.ready(), false);
      await assert.rejects(register(payload()), { code: "55000" });
      assert.equal((await owner.query("SELECT count(*)::integer AS n FROM public.submissions")).rows[0].n, 1);
      assert.equal((await owner.query("SELECT count(*)::integer AS n FROM ingenium_judge.outbox")).rows[0].n, 0);
      await fresh(); assert.equal(await registry.ready(), true);
    });
    await judgeSupervisorChecks(t, { owner, runner, ingress, publisherPool, registry, supervisor, publisher: createJudgePublisherStore(publisherPool, config), fresh, payload, config });
    await judgeQueueChecks(t, { owner, publisherPool, registry, supervisor, publisher: createJudgePublisherStore(publisherPool, config), fresh, payload, config });
    await judgeExecutionChecks(t, { owner, publisherPool, registry, supervisor, publisher: createJudgePublisherStore(publisherPool, config), fresh, payload, config });
    await t.test("SQL and application payload digests agree across five languages, exact Base64 bytes and fractional provider envelopes", async () => {
      await fresh();
      for (const language of LANGUAGES) {
        const p = payload(language); p.cpuMs = 123; p.wallMs = 500;
        const encoded = envelope(p);
        assert.deepEqual((await owner.query("SELECT ingenium_judge.payload_digest($1::jsonb) AS digest", [JSON.stringify(encoded)])).rows[0].digest, authoringPayloadDigest(p));
        const token = await register(p);
        const row = (await owner.query("SELECT * FROM public.submissions WHERE token=$1", [token])).rows[0];
        assert.deepEqual(Buffer.from(row.source_code, "base64"), p.source); assert.deepEqual(Buffer.from(row.stdin, "base64"), p.stdin);
        assert.equal(Number(row.cpu_time_limit), 0.123); assert.equal(Number(row.wall_time_limit), 1);
        assert.equal(row.number_of_runs, 1); assert.equal(row.enable_network, false); assert.equal(row.expected_output, null);
      }
    });
    await t.test("SQL participant payload validation keeps sample and official provenance distinct from authoring without admitting code", async () => {
      const before = (await owner.query("SELECT count(*) n FROM public.submissions")).rows[0].n;
      for (const language of LANGUAGES) for (const sourceRole of ["OFFICIAL", "SAMPLE"] as const) {
        const p = { ...payload(language), sourceRole }, encoded = envelope(p);
        await owner.query("SELECT ingenium_judge.validate_payload($1::jsonb,$2)", [JSON.stringify(encoded), config.hostEpochId]);
        assert.deepEqual((await owner.query("SELECT ingenium_judge.payload_digest($1::jsonb) digest", [JSON.stringify(encoded)])).rows[0].digest, authoringPayloadDigest(p));
        await assert.rejects(owner.query("SELECT ingenium_judge.validate_payload($1::jsonb,$2)", [JSON.stringify({ ...encoded, check_type: "COMPILATION" }), config.hostEpochId]));
      }
      assert.equal((await owner.query("SELECT count(*) n FROM public.submissions")).rows[0].n, before);
    });
    await t.test("concurrent duplicate admission commits one provider, association and outbox; a fresh registry recovers it", async () => {
      await fresh(); first = payload();
      const values = await Promise.all(Array.from({ length: 8 }, () => registry.admit(first, randomUUID())));
      firstToken = values[0]!.value.provider_token!; assert.ok(values.every(v => v.value.provider_token === firstToken));
      const other = createJudgeRegistry(ingress!, config);
      const observed = await other.observe(first.attemptId, authoringPayloadDigest(first).toString("hex"), randomUUID());
      assert.equal(observed.value.provider_token, firstToken); assert.equal(observed.value.state, "PENDING");
      assert.equal((await owner.query("SELECT count(*)::integer AS n FROM ingenium_judge.attempts WHERE attempt_id=$1", [first.attemptId])).rows[0].n, 1);
      assert.equal((await owner.query("SELECT count(*)::integer AS n FROM public.submissions WHERE token=$1", [firstToken])).rows[0].n, 1);
      await assert.rejects(register({ ...first, stdin: Buffer.from("changed") }), { code: "22023" });
    });
    await t.test("gateway-role SQL cannot bypass strict payload validation, runtime identity or byte bounds", async () => {
      await fresh(); const p = payload(), original = envelope(p);
      for (const changed of [{ protocol: null }, { source_role: null }, { enable_network: null }, { cpu_ms: null }, { memory_kb: 524289 }, { source_b64: null },
        { stdin_b64: "MA==\n" }, { extra: true }, { number_of_runs: 2 }, { runtime_digest: "0".repeat(64) }, { payload_digest: "0".repeat(64) }, { source_b64: Buffer.alloc(131073).toString("base64") }]) {
        await assert.rejects(ingress!.query("SELECT ingenium_judge.admit($1,$2,$3::jsonb)", [config.hostEpochId, config.bootId, JSON.stringify({ ...original, ...changed })]));
      }
      assert.equal((await owner.query("SELECT count(*)::integer AS n FROM ingenium_judge.attempts WHERE attempt_id=$1", [p.attemptId])).rows[0].n, 0);
    });
    await t.test("outbox acknowledgement loss is harmless and duplicate deliveries consume exactly one launch permission", async () => {
      await fresh(); assert.ok((await supervisor.deliveries()).some(v => v.attempt_id === first.attemptId));
      await supervisor.published(first.attemptId); await supervisor.published(first.attemptId);
      assert.ok(!(await supervisor.deliveries()).some(v => v.attempt_id === first.attemptId));
      const owners = Array.from({ length: 5 }, () => randomUUID());
      const claims = await Promise.all(owners.map(owner => supervisor.claim(first.attemptId, firstToken, owner)));
      assert.equal(claims.filter(Boolean).length, 1); const index = claims.findIndex(Boolean); firstOwner = owners[index]!;
      assert.deepEqual(claims[index], first);
      assert.equal(await createJudgeSupervisorStore(runner!, config).claim(first.attemptId, firstToken, firstOwner), null);
      await assert.rejects(owner.query("UPDATE ingenium_judge.attempts SET permit_owner=NULL,started_at=NULL WHERE attempt_id=$1", [first.attemptId]), { code: "P0001" });
    });
    await t.test("result sealing is owner-bound and immutable, while later positive drain leaves the original result digest unchanged", async () => {
      const evidence = judgeReply(first, randomUUID(), Buffer.from("12\n"), firstToken).evidence;
      const proof = evidence.metadata.drain; evidence.metadata.drain = null;
      await assert.rejects(supervisor.seal(first, firstToken, randomUUID(), evidence), { code: "P0001" });
      assert.ok(await supervisor.beginLaunch(first.attemptId, firstToken, firstOwner));
      await supervisor.seal(first, firstToken, firstOwner, evidence);
      const nonce = randomUUID(), held = await registry.observe(first.attemptId, authoringPayloadDigest(first).toString("hex"), nonce);
      const before = acceptAuthoringObservation(first, acceptJudgeReply(held.value, first, nonce, 200), Buffer.from("12\n"), "EXACT_TEXT")!;
      assert.equal(before.release, null);
      evidence.metadata.drain = proof; await supervisor.seal(first, firstToken, firstOwner, evidence);
      const afterNonce = randomUUID(), after = await registry.observe(first.attemptId, authoringPayloadDigest(first).toString("hex"), afterNonce);
      const checked = acceptAuthoringObservation(first, acceptJudgeReply(after.value, first, afterNonce, 200), Buffer.from("12\n"), "EXACT_TEXT")!;
      assert.deepEqual(checked.metadata, before.metadata); assert.ok(checked.release);
      await supervisor.seal(first, firstToken, firstOwner, evidence);
      evidence.stdout_b64 = Buffer.from("changed").toString("base64"); await assert.rejects(supervisor.seal(first, firstToken, firstOwner, evidence));
    });
    await t.test("two potential executions is a physical limit and a restarted supervisor cannot reclaim a consumed permit", async () => {
      await fresh(); const jobs = [];
      for (let i = 0; i < 3; i++) { const p = payload(), token = await register(p), owner = randomUUID(); jobs.push({ p, token, owner }); }
      const [a, b, c] = jobs; assert.ok(a && b && c);
      assert.ok(await supervisor.claim(a.p.attemptId, a.token, a.owner)); assert.ok(await supervisor.claim(b.p.attemptId, b.token, b.owner));
      assert.equal(await supervisor.claim(c.p.attemptId, c.token, c.owner), null);
      assert.equal(await createJudgeSupervisorStore(runner!, config).claim(b.p.attemptId, b.token, randomUUID()), null);
      assert.ok(await supervisor.beginLaunch(a.p.attemptId, a.token, a.owner));
      await supervisor.seal(a.p, a.token, a.owner, judgeReply(a.p, randomUUID(), Buffer.from("12\n"), a.token).evidence);
      assert.ok(await supervisor.claim(c.p.attemptId, c.token, c.owner));
      assert.ok(await supervisor.beginLaunch(c.p.attemptId, c.token, c.owner));
      await supervisor.seal(c.p, c.token, c.owner, judgeReply(c.p, randomUUID(), Buffer.from("12\n"), c.token).evidence);
      // b deliberately remains physically uncertain; no launch or fake verdict was performed.
    });
    await t.test("gateway and supervisor database roles cannot edit history, expose code, mint credentials or cross their function privileges", async () => {
      for (const pool of [ingress!, runner!]) for (const table of ["ingenium_judge.attempts", "ingenium_judge.control", "ingenium_judge.outbox", "public.submissions"]) {
        await assert.rejects(pool.query(`SELECT * FROM ${table}`), { code: "42501" }); await assert.rejects(pool.query(`DELETE FROM ${table}`), { code: "42501" });
      }
      await assert.rejects(ingress!.query("SELECT ingenium_judge.heartbeat($1,$2,$3)", [config.hostEpochId, config.bootId, Buffer.alloc(32)]), { code: "42501" });
      await assert.rejects(ingress!.query("SELECT ingenium_judge.observe($1,$2,$3,NULL)", [config.hostEpochId, config.bootId, first.attemptId]), { code: "22023" });
      await assert.rejects(runner!.query("SELECT ingenium_judge.admit($1,$2,$3::jsonb)", [config.hostEpochId, config.bootId, JSON.stringify(envelope(payload()))]), { code: "42501" });
    });
    await t.test("runtime drift and foreign boots cannot reuse readiness or register work; retained payload accounting is exact", async () => {
      await fresh(); const other = createJudgeRegistry(ingress!, { ...config, bootId: randomUUID() });
      assert.equal(await other.ready(), false); await assert.rejects(other.admit(payload(), randomUUID()));
      await owner.query("UPDATE public.languages SET is_archived=true WHERE name='cpp'");
      assert.equal(await registry.ready(), false); await assert.rejects(register(payload()), { code: "55000" }); await assert.rejects(fresh());
      await owner.query("UPDATE public.languages SET is_archived=false WHERE name='cpp'"); await fresh();
      const state = (await owner.query("SELECT retained_bytes=(SELECT sum(accounted_bytes) FROM ingenium_judge.attempts) AS exact FROM ingenium_judge.control")).rows[0]; assert.equal(state.exact, true);
      const saved = (await owner.query("SELECT retained_bytes FROM ingenium_judge.control")).rows[0].retained_bytes;
      await owner.query("UPDATE ingenium_judge.control SET retained_bytes=4294967296");
      try { await assert.rejects(register(payload()), { code: "54000" }); assert.equal((await registry.admit(first, randomUUID())).value.provider_token, firstToken); }
      finally { await owner.query("UPDATE ingenium_judge.control SET retained_bytes=$1", [saved]); }
    });
    await t.test("real mutual-TLS gateway/client uses real registry transactions and rejects foreign clients, malformed bodies and private-data leaks", async () => {
      await fresh(); const tls = await createTestTls(t);
      const gateway = buildJudgeGateway({ registry, serverName: "judge.test", workerAddress: "127.0.0.1", workerCertificateSha256: sha256(new X509Certificate(tls.clientCert).raw).toString("hex"),
        ca: tls.ca, certificate: tls.cert, privateKey: tls.key });
      await gateway.listen({ host: "127.0.0.1", port: 0 });
      try {
        const address = gateway.server.address(); assert.ok(address && typeof address !== "string");
        const port = address.port;
        const settings = { hostEpochId: config.hostEpochId, endpointRef: "synthetic-registry", runtimes: config.runtimes, address: "127.0.0.1", port: address.port, serverName: "judge.test",
          ca: tls.ca, certificate: tls.clientCert, privateKey: tls.clientKey, serverCertificateSha256: sha256(new X509Certificate(tls.cert).raw).toString("hex") };
        const driver = createAuthoringJudgeDriver(settings), signal = () => AbortSignal.timeout(10000), p = payload();
        await driver.assertReady(signal()); assert.deepEqual(await driver.submit(p, signal()), { state: "PENDING" });
        const token = (await registry.observe(p.attemptId, authoringPayloadDigest(p).toString("hex"), randomUUID())).value.provider_token!;
        const worker = randomUUID(); assert.ok(await supervisor.claim(p.attemptId, token, worker));
        assert.ok(await supervisor.beginLaunch(p.attemptId, token, worker));
        await supervisor.seal(p, token, worker, judgeReply(p, randomUUID(), Buffer.from([0, 255, 10]), token).evidence);
        const observation = await createAuthoringJudgeDriver(settings).observe(p, signal());
        assert.equal(acceptAuthoringObservation(p, observation, Buffer.alloc(0), "TOKENS")!.result, "WRONG_ANSWER");
        await assert.rejects(createAuthoringJudgeDriver({ ...settings, certificate: await readFile(join(tls.directory, "other.pem")), privateKey: await readFile(join(tls.directory, "other.key")) }).assertReady(signal()));
        async function raw(body: string, extra: Record<string, string> = {}) {
          const nonce = randomUUID(); return new Promise<{ status: number; text: string }>((resolve, reject) => {
              const req = request({ host: "127.0.0.1", port, servername: "judge.test", ca: tls.ca, cert: tls.clientCert, key: tls.clientKey,
              method: "POST", path: `/ingenium/v1/authoring/attempts/${p.attemptId}`, agent: false, signal: signal(), headers: { Host: "judge.test", "Content-Type": "application/json",
                "X-Ingenium-Request-Id": nonce, "X-Ingenium-Host-Epoch": config.hostEpochId, "X-Ingenium-Payload-Digest": authoringPayloadDigest(p).toString("hex"), ...extra } }, res => {
              const chunks: Buffer[] = []; res.on("data", chunk => chunks.push(chunk)); res.on("end", () => resolve({ status: res.statusCode!, text: Buffer.concat(chunks).toString() }));
            }); req.on("error", reject); req.end(body);
          });
        }
        for (const [body, headers] of [["{\"x\":1,\"x\":2}", {}], ["{}", {}], ["{}", { Origin: "https://untrusted.test" }], ["{}", { "X-Ingenium-Host-Epoch": randomUUID() }]] as const) {
          const response = await raw(body, headers); assert.ok(response.status >= 400 && response.status < 500, response.text);
          assert.doesNotMatch(response.text, /source_b64|stdin_b64|postgres|synthetic fixture/);
        }
        const max = payload(); max.source = Buffer.alloc(131072, 65); max.stdin = Buffer.alloc(1048576, 66);
        assert.deepEqual(await driver.submit(max, signal()), { state: "PENDING" });
      } finally { await gateway.close(); }
    });
    await judgeLauncherChecks(t, { owner, publisherPool, registry, supervisor, publisher: createJudgePublisherStore(publisherPool, config), fresh, payload, config });
    await t.test("eight-slot migration preserves old holds and atomically refuses a ninth potential execution",async()=>{
      const before=(await owner.query("SELECT to_jsonb(a) row FROM ingenium_judge.attempts a ORDER BY attempt_id")).rows;
      await owner.query(await readFile(fileURLToPath(new URL("../../../../infra/judge-gateway/007_eight_slots.sql",import.meta.url)),"utf8"));
      assert.deepEqual((await owner.query("SELECT to_jsonb(a) row FROM ingenium_judge.attempts a ORDER BY attempt_id")).rows,before);
      const held=await supervisor.held(),jobs=[];
      await fresh();
      for(let i=0;i<9-held.length;i++){const p=payload();jobs.push({p,token:await register(p),owner:randomUUID()});}
      const claims=await Promise.all(jobs.map(j=>supervisor.claim(j.p.attemptId,j.token,j.owner)));
      assert.equal(claims.filter(Boolean).length,8-held.length);assert.equal((await supervisor.held()).length,8);
      for(let i=0;i<jobs.length;i++)if(claims[i]){const j=jobs[i]!;assert.ok(await supervisor.beginLaunch(j.p.attemptId,j.token,j.owner));await supervisor.seal(j.p,j.token,j.owner,judgeReply(j.p,randomUUID(),Buffer.from("12\n"),j.token).evidence);}
      assert.deepEqual(new Set(await supervisor.held()),new Set(held));
    });
    await t.test("authoring queue refuses its 121st unresolved record atomically and fencing cannot be undone or imply cleanup", async () => {
      await fresh(); const current = (await owner.query("SELECT count(*)::integer AS n FROM ingenium_judge.attempts WHERE drain IS NULL")).rows[0].n;
      for (let i = current; i < 120; i++) await register(payload());
      const before = (await owner.query("SELECT count(*)::integer AS n FROM public.submissions")).rows[0].n;
      await assert.rejects(register(payload()), { code: "54000" });
      assert.equal((await owner.query("SELECT count(*)::integer AS n FROM public.submissions")).rows[0].n, before);
      await owner.query("UPDATE ingenium_judge.control SET state='FENCED'");
      assert.equal(await registry.ready(), false); await assert.rejects(fresh()); await assert.rejects(register(payload()), { code: "55000" });
      assert.deepEqual(await supervisor.deliveries(), []);
      assert.equal((await registry.observe(first.attemptId, authoringPayloadDigest(first).toString("hex"), randomUUID())).value.state, "FINISHED");
      await assert.rejects(owner.query("UPDATE ingenium_judge.control SET state='ACTIVE'"), { code: "P0001" });
      assert.equal((await owner.query("SELECT source_code FROM public.submissions WHERE token='pre-existing'")).rows[0].source_code, "untouched pre-existing synthetic record");
      assert.ok((await owner.query("SELECT count(*)::integer AS n FROM ingenium_judge.attempts WHERE permit_owner IS NOT NULL AND drain IS NULL")).rows[0].n > 0);
    });
  } finally { await ingress?.end(); await runner?.end(); await publisherPool?.end(); await owner.end(); }
}
