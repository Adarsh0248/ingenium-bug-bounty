import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { acceptReadinessReply, readinessRequest } from "../src/judge/executor.js";
import { parseSupervisorRuntime } from "../src/judge/supervisor-config.js";
import { parseGatewayRuntime } from "../src/judge/gateway-config.js";
import { startJudgeSupervisor } from "../src/judge/supervisor.js";
import { runtimeRecord } from "../src/content/judge-protocol.js";
import { judgeRuntimes } from "./fixtures/judge.js";

test("readiness evidence is accepted only for the exact fresh launcher request and runtime set", () => {
  const request = readinessRequest({ hostEpochId: randomUUID(), bootId: randomUUID(), runtimes: judgeRuntimes() });
  const value = { ...request, ready: true, proof_digest: "a".repeat(64) };
  assert.deepEqual(acceptReadinessReply(value, request), Buffer.alloc(32, 0xaa));
  for (const patch of [{ ready: false }, { proof_digest: "true" }, { proof_digest: "A".repeat(64) }, { request_id: randomUUID() },
    { host_epoch_id: randomUUID() }, { boot_id: randomUUID() }, { protocol: "other" }, { operation: "EXECUTE" }, { runtimes: [] }, { extra: true }]) {
    assert.throws(() => acceptReadinessReply({ ...value, ...patch }, request));
  }
  assert.throws(() => acceptReadinessReply({ ...value, runtimes: { ...value.runtimes, c: { key: "different", digest: "a".repeat(64) } } }, request));
  assert.notEqual(readinessRequest({ hostEpochId: request.host_epoch_id, bootId: request.boot_id, runtimes: judgeRuntimes() }).request_id, request.request_id);
});

function runtime() {
  return { schema_version: 1, supervisor_database_url: "postgres://judge_runner:synthetic@127.0.0.1/judge_test",
    publisher_database_url: "postgres://judge_publisher:synthetic@127.0.0.1/judge_test", host_epoch_id: randomUUID(), boot_id: randomUUID(),
    runtimes: runtimeRecord(judgeRuntimes()), launcher_sha256: "a".repeat(64), redis: { address: "127.0.0.1", port: 6379, password: "b".repeat(64) } };
}
test("supervisor configuration fixes five runtimes, separate loopback roles and bounded private queue identity", () => {
  const value = runtime(), parsed = parseSupervisorRuntime(value);
  assert.equal(parsed.runtimes.size, 5); assert.equal(parsed.redis.port, 6379);
  for (const patch of [{ extra: true }, { schema_version: 2 }, { launcher_sha256: "latest" }, { host_epoch_id: "not-a-uuid" }, { boot_id: randomUUID().toUpperCase() },
    { runtimes: {} }, { supervisor_database_url: "postgres://runner:secret@8.8.8.8/test" }, { supervisor_database_url: "postgres://runner@127.0.0.1/test" },
    { publisher_database_url: value.supervisor_database_url }, { publisher_database_url: "postgres://publisher:secret@127.0.0.1/other" },
    { publisher_database_url: value.publisher_database_url + "?options=-c%20role%3Downer" },
    { redis: { ...value.redis, address: "8.8.8.8" } }, { redis: { ...value.redis, port: 0 } }, { redis: { ...value.redis, password: "guess" } }])
    assert.throws(() => parseSupervisorRuntime({ ...value, ...patch }));
});

test("gateway configuration permits only a private bounded listener, loopback database and exact pinned TLS peer", () => {
  const base = runtime(), value = { schema_version: 1, database_url: base.supervisor_database_url, host_epoch_id: base.host_epoch_id, boot_id: base.boot_id,
    runtimes: base.runtimes, listen_address: "10.42.0.3", port: 2359,
    tls: { server_name: "judge.ingenium.internal", worker_address: "10.42.0.4", worker_certificate_sha256: "a".repeat(64), ca_pem: "synthetic ca", certificate_pem: "synthetic cert", private_key_pem: "synthetic private key" } };
  assert.equal(parseGatewayRuntime(value).runtimes.size, 5);
  for (const patch of [{ extra: true }, { port: 443 }, { listen_address: "0.0.0.0" }, { listen_address: "8.8.8.8" },
    { database_url: "postgres://runner:secret@8.8.8.8/test" }, { database_url: value.database_url + "?options=-crole=owner" },
    { tls: { ...value.tls, worker_address: "metadata.google.internal" } }, { tls: { ...value.tls, worker_certificate_sha256: "latest" } },
    { tls: { ...value.tls, server_name: "judge.internal/other" } }, { tls: { ...value.tls, private_key_pem: "x".repeat(32769) } }])
    assert.throws(() => parseGatewayRuntime({ ...value, ...patch }));
});

// These fixtures exercise orchestration only and cannot verify a host or execute submitted code.
function fixture() {
  const binding = { hostEpochId: randomUUID(), bootId: randomUUID() }, events: string[] = [], controller = new AbortController(), lost = new AbortController();
  let healthy = true, closed = 0;
  const session = { ...binding, signal: lost.signal, async heartbeat(proof: Buffer, signal: AbortSignal) {
    signal.throwIfAborted(); assert.equal(proof.length, 32); events.push("heartbeat");
  }, async close() { closed++; events.push("withdraw"); } };
  const q = () => ({ ...binding, async entries() { return []; }, async receive() { events.push("receive"); return null; }, close() { events.push("close-queue"); } });
  const executor = () => ({ ...binding, runtimes: judgeRuntimes(), async assertReady(signal: AbortSignal) { signal.throwIfAborted(); events.push("worker-ready"); },
    async exchange(): Promise<never> { throw new Error("Fixture cannot run code"); } });
  const queues = [q(), q(), q()], executors = [executor(), executor()];
  const settings = { store: { ...binding, runtimes: judgeRuntimes(), async held() { return []; } },
    publisher: { ...binding, async candidates() { events.push("publish"); return []; } }, queues, executors, session, signal: controller.signal,
    readiness: { ...binding, async readiness(signal: AbortSignal) { signal.throwIfAborted(); events.push("verify"); if (!healthy) throw new Error("Unverified host"); return Buffer.alloc(32, 1); } } };
  return { settings: settings as unknown as Parameters<typeof startJudgeSupervisor>[0], events, controller, lost, queues, executors,
    fault() { healthy = false; }, closed: () => closed };
}
const flush = async () => { for (let i = 0; i < 80; i++) await Promise.resolve(); };
test("the service verifies before heartbeat or work, renews independently, and shutdown withdraws without new dispatch", async () => {
  const f = fixture(), service = await startJudgeSupervisor(f.settings);
  try {
    await flush(); assert.deepEqual(f.events.slice(0, 2), ["verify", "heartbeat"]);
    assert.equal(f.events.filter(e => e === "receive").length, 0);
    assert.ok(f.events.includes("publish") && !f.events.includes("worker-ready"));
    await delay(5200);
    assert.equal(f.events.filter(e => e === "heartbeat").length, 2);
    assert.deepEqual(await service.close(), { failed: false });
    const count = f.events.length; await delay(25);
    assert.equal(f.events.length, count); assert.equal(f.closed(), 1);
    assert.equal(f.events.filter(e => e === "close-queue").length, 3);
  } finally { await service.close(); }
});
for (const cause of ["readiness", "session", "publisher", "worker"] as const) test(`a ${cause} fault stops all new work and never grants replacement readiness`, async () => {
  const f = fixture();
  if (cause === "publisher") f.settings.publisher.candidates = async () => { throw new Error("Private test fault"); };
  if (cause === "worker") f.queues[1]!.entries = async () => { throw new Error("Private worker test fault"); };
  const service = await startJudgeSupervisor(f.settings);
  if (cause === "readiness") f.fault();
  else if (cause === "session") f.lost.abort();
  await flush(); const result = await service.completion;
  assert.equal(result.failed, true); const count = f.events.length;
  assert.equal(service.failureStage, cause === "worker" ? "worker-1" : cause);
  if(cause==="worker")assert.equal((service.failureCause as Error).message,"Private worker test fault");
  await delay(25); assert.equal(f.events.length, count); assert.equal(f.closed(), 1);
});
test("failed initial verification closes admission and queues without receiving a job", async () => {
  const f = fixture(); f.fault();
  await assert.rejects(startJudgeSupervisor(f.settings), /Unverified host/);
  assert.ok(!f.events.includes("heartbeat") && !f.events.includes("receive")); assert.equal(f.closed(), 1);
});
test("failed readiness withdrawal still closes every owned queue and reports an uncertain shutdown", async () => {
  for (const startup of [true, false]) {
    const f = fixture(); f.settings.session.close = async () => { throw new Error("Withdrawal not acknowledged"); };
    if (startup) {
      f.fault(); await assert.rejects(startJudgeSupervisor(f.settings), /Withdrawal not acknowledged/);
    } else {
      const service = await startJudgeSupervisor(f.settings);
      assert.deepEqual(await service.close(), { failed: true });
    }
    assert.equal(f.events.filter(e => e === "close-queue").length, 3);
  }
});
test("an already interrupted startup cannot renew readiness", async () => {
  const f = fixture(); f.controller.abort(); await assert.rejects(startJudgeSupervisor(f.settings));
  assert.ok(!f.events.includes("heartbeat")); assert.equal(f.closed(), 1);
});
test("shared queues, executors and foreign host resources are refused before readiness", async () => {
  for (const kind of ["queue", "executor", "epoch"] as const) {
    const f = fixture();
    if (kind === "queue") f.queues[1] = f.queues[0]!;
    else if (kind === "executor") f.executors[1] = f.executors[0]!;
    else f.settings.readiness.hostEpochId = randomUUID();
    await assert.rejects(startJudgeSupervisor(f.settings), /Independent/); assert.deepEqual(f.events, []);
  }
});

test("eight independent workers own nine queues and close every resource without changing readiness rules",async()=>{
  const f=fixture();
  while(f.queues.length<9)f.queues.push({...f.queues[0]!});
  while(f.executors.length<8)f.executors.push({...f.executors[0]!});
  const service=await startJudgeSupervisor(f.settings);
  assert.deepEqual(await service.close(),{failed:false});
  assert.equal(f.closed(),1);assert.equal(f.events.filter(e=>e==="close-queue").length,9);
  for(const count of [0,1,3,7,9]){
    const bad=fixture();bad.settings.executors=Array.from({length:count},()=>({...bad.executors[0]!}));
    await assert.rejects(startJudgeSupervisor(bad.settings),/Independent/);assert.deepEqual(bad.events,[]);
  }
});

test("four independent workers apply backpressure without changing the registry permit ceiling",async()=>{
  const f=fixture();while(f.queues.length<5)f.queues.push({...f.queues[0]!});while(f.executors.length<4)f.executors.push({...f.executors[0]!});
  const service=await startJudgeSupervisor(f.settings);
  assert.deepEqual(await service.close(),{failed:false});
  assert.equal(f.closed(),1);assert.equal(f.events.filter(e=>e==="close-queue").length,5);
});

test("sixteen workers share two actual pre-claim observations without renewing freshness from cache hits",async()=>{
  const f=fixture();while(f.queues.length<17)f.queues.push({...f.queues[0]!});while(f.executors.length<16)f.executors.push({...f.executors[0]!});
  let active=0,maximum=0,checks=0;
  for(const executor of f.executors)executor.assertReady=async signal=>{signal.throwIfAborted();active++;maximum=Math.max(maximum,active);await delay(20);active--;checks++;};
  for(const queue of f.queues.slice(1))Object.assign(queue,{async entries(){return[{id:"1-0",attempt_id:randomUUID(),provider_token:randomUUID()}];}});
  const service=await startJudgeSupervisor(f.settings);
  try{
    await delay(200);assert.equal(maximum,2);assert.equal(checks,2);
    await delay(5000);const end=performance.now()+1000;while(checks<4){assert.ok(performance.now()<end);await delay(10);}
    assert.equal(checks,4);assert.ok(f.events.includes('receive'));
  }finally{await service.close();}
});

test("a slow pre-claim reply cannot grant a fresh claim after its original five-second window",async()=>{
  const f=fixture();
  for(const executor of f.executors)executor.assertReady=async()=>{await delay(5100);};
  for(const queue of f.queues.slice(1))Object.assign(queue,{async entries(){return[{id:"1-0",attempt_id:randomUUID(),provider_token:randomUUID()}];}});
  const service=await startJudgeSupervisor(f.settings);
  try{assert.equal((await service.completion).failed,true);assert.match(service.failureStage!,/^worker-/);assert.ok(!f.events.includes('receive'));}
  finally{await service.close();}
});
