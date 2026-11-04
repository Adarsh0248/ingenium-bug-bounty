import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { chmod, link, lstat, mkdir, readdir, readFile, rename, statfs, symlink, unlink, writeFile } from "node:fs/promises";
import { test } from "node:test";
import { CHECKPOINT_DIRECTORY, openExecutionCheckpoints } from "/workspace/apps/api/dist/judge/checkpoints.js";
import { createCheckpointedBackend } from "/workspace/apps/api/dist/judge/checkpoint-backend.js";
import { createIsolateBackend } from "/workspace/apps/api/dist/judge/isolate-backend.js";
import { createCapsuleLifecycle } from "/workspace/apps/api/dist/judge/capsule-lifecycle.js";
import { capsuleReference } from "/workspace/apps/api/dist/judge/capsule-lifecycle.js";
import { createCapsuleBackend } from "/workspace/apps/api/dist/judge/capsule-backend.js";
import { CAPSULE_DIRECTORY, capsuleConfiguration, prepareCapsuleConfiguration, verifyCapsuleConfiguration, removeCapsuleConfiguration } from "/workspace/apps/api/dist/judge/capsule-configuration.js";
import { createHostCapsuleResources } from "/workspace/apps/api/dist/judge/host-resources.js";
import { retainedPhaseGroups } from "/workspace/apps/api/dist/judge/phase-resources.js";
import { retainedStorage } from "/workspace/apps/api/dist/judge/capsule-storage.js";
import { createCapsuleRetirement } from "/workspace/apps/api/dist/judge/capsule-retirement.js";
import { capsuleReply } from "/workspace/apps/api/dist/judge/capsule-cli.js";
import { ISOLATE_BINARIES } from "/workspace/apps/api/dist/judge/isolate-context.js";
import { EXECUTION_PLAN_SHA256 } from "/workspace/apps/api/dist/judge/execution-plan.js";
import { acceptExecutionReply, executionRequest } from "/workspace/apps/api/dist/judge/executor.js";
import { createGuardedLauncher } from "/workspace/apps/api/dist/judge/launcher.js";
import { judgeJson, readJudgeJson, runtimeRecord } from "/workspace/apps/api/dist/content/judge-protocol.js";
import { boot, runtimes, signal, claim, planFor, evidence, engine, syntheticPhysical, syntheticResources, syntheticRetirement } from "/run/checkpoint-fixture.mjs";

await chmod(CHECKPOINT_DIRECTORY, 0o700);
const entry = p => `${CHECKPOINT_DIRECTORY}/${p.hostEpochId}-${p.attemptId}`;
const storeFor = c => openExecutionCheckpoints(c.payload.hostEpochId, boot);
async function killed(c, mode) {
  const child = spawn("/usr/local/bin/node", ["/run/checkpoint-fixture.mjs", mode], { env: { PATH: "/usr/local/bin:/usr/bin:/bin", LANG: "C.UTF-8" }, stdio: ["pipe", "pipe", "pipe"] });
  const ended = once(child, "close"); let diagnostic = "", observed = "";
  child.stderr.on("data", b => { diagnostic += b; });
  const ready = new Promise((resolve, reject) => {
    child.stdout.on("data", b => { observed += b; if (observed === (mode === "--persist" ? "saved" : "started")) resolve(); });
    child.on("error", reject); child.on("close", () => reject(new Error(`Checkpoint child ended before handoff: ${diagnostic}`)));
  });
  child.stdin.end(judgeJson(executionRequest(c, boot, runtimes, "EXECUTE")));
  try { await Promise.race([ready, new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error(`Child handoff timeout; observed=${observed}; diagnostic=${diagnostic}`)), 10000); timer.unref(); })]); }
  finally { child.kill("SIGKILL"); const [code, cause] = await ended; assert.equal(cause, "SIGKILL", `Child exit=${code}; observed=${observed}; diagnostic=${diagnostic}`); }
  assert.equal(diagnostic, "");
}

test("real Linux checkpoints survive a killed producer and reopen without backend readiness, a database or another execution", async () => {
  const c = claim(), p = planFor(c); await killed(c, "--persist");
  const store = await storeFor(c);
  try {
    const forbidden = () => { throw new Error("Must recover from disk only"); };
    const backend = createCheckpointedBackend(store, engine({ assertReady: forbidden, execute: forbidden, recover: forbidden }));
    const saved = await backend.recover(p, signal()); assert.equal(saved.stdout_b64, "MTIK"); assert.ok(saved.metadata.drain);
    await assert.rejects(backend.execute(p, signal()));
    const names = await readdir(entry(p)); assert.deepEqual(names.sort(), ["binding.json", "drain.json", "result.json"]);
    const binding = await readFile(`${entry(p)}/binding.json`, "ascii"); assert.doesNotMatch(binding, /synthetic fixture|source_b64|stdin_b64/);
    for (const name of names) assert.equal((await lstat(`${entry(p)}/${name}`)).mode & 0o7777, 0o400);
  } finally { await store.close(); }
});
test("a failed database seal recovers the disk result through a fresh launcher without contacting the execution backend", async () => {
  const c = claim(), store = await storeFor(c); let executions = 0, started = false, failSeal = true, retained = null;
  const registry = { hostEpochId: c.payload.hostEpochId, bootId: boot, runtimes,
    async execution() { return { ...c, started, evidence: retained }; },
    async beginLaunch() { assert.equal(started, false); started = true; return c.payload; },
    async seal(_payload, _token, _owner, value) { if (failSeal) throw new Error("Synthetic database outage after result capture"); retained = value; },
  };
  try {
    const backend = createCheckpointedBackend(store, engine({ async execute(plan) { executions++; return evidence(plan); } }));
    const request = executionRequest(c, boot, runtimes, "EXECUTE");
    await assert.rejects(createGuardedLauncher(registry, backend).handle(Buffer.from(judgeJson(request)), "EXECUTE", signal()));
    assert.equal(executions, 1); assert.equal(started, true); assert.equal(retained, null);
    failSeal = false;
    const forbidden = () => { throw new Error("No physical backend call permitted"); };
    const recovery = createGuardedLauncher(registry, createCheckpointedBackend(store, engine({ assertReady: forbidden, execute: forbidden, recover: forbidden })));
    const original = executionRequest(c, boot, runtimes, "RECOVER");
    const response = readJudgeJson(await recovery.handle(Buffer.from(judgeJson(original)), "RECOVER", signal()));
    assert.equal(acceptExecutionReply(response, c, original).stdout_b64, "MTIK"); assert.ok(retained.metadata.drain); assert.equal(executions, 1);
  } finally { await store.close(); }
});
test("eight independent checkpoint producers compete for one permanent start receipt and only one backend call", async () => {
  const c = claim(), p = planFor(c), stores = await Promise.all(Array.from({ length: 8 }, () => storeFor(c))); let starts = 0;
  try {
    const backend = engine({ async execute(plan) { starts++; return evidence(plan); } });
    const replies = await Promise.allSettled(stores.map(s => createCheckpointedBackend(s, backend).execute(p, signal())));
    assert.equal(replies.filter(r => r.status === "fulfilled").length, 1); assert.equal(starts, 1);
    assert.ok((await stores[0].read(p)).evidence.metadata.drain);
  } finally { for (const store of stores) await store.close(); }
});
test("a killed producer's incomplete execution remains held; recovery and replacements never launch it again", async () => {
  const c = claim(), p = planFor(c); await killed(c, "--unfinished");
  const store = await storeFor(c); let recoveries = 0;
  try {
    const backend = createCheckpointedBackend(store, engine({ execute() { throw new Error("Second execution forbidden"); }, async recover() { recoveries++; return null; } }));
    assert.deepEqual(await store.read(p), { begun: true, evidence: null });
    assert.equal(await backend.recover(p, signal()), null); assert.equal(recoveries, 1);
    await assert.rejects(backend.execute(p, signal()));
    assert.deepEqual((await readdir(entry(p))).sort(), ["binding.json"]);
  } finally { await store.close(); }
});
test("physical capsule identities survive a killed synthetic producer and cannot be rebound, forged or copied to another attempt", async () => {
  const c = claim(), p = planFor(c); await killed(c, "--physical-unfinished");
  const store = await storeFor(c);
  try {
    assert.deepEqual(await store.physical(p), syntheticPhysical); await store.bindPhysical(p, syntheticPhysical);
    await assert.rejects(store.bindPhysical(p, { ...syntheticPhysical, container_id: "c".repeat(64) }));
    await assert.rejects(store.bindPhysical(p, { ...syntheticPhysical, cgroup_parent: "/docker" }));
    await assert.rejects(store.bindPhysical(p, { ...syntheticPhysical, pid_namespace: "pid:[0]" }));
    await assert.rejects(store.physical({ ...p, owner: randomUUID() }));
    const other = planFor(claim(c.payload.hostEpochId)); await store.begin(other, signal());
    await writeFile(`${entry(other)}/physical.json`, await readFile(`${entry(p)}/physical.json`), { flag: "wx", mode: 0o400 });
    await assert.rejects(store.physical(other)); assert.deepEqual(await store.read(p), { begun: true, evidence: null });
    await assert.rejects(store.begin(p, signal()));
  } finally { await store.close(); }
});

test("outer launch intent and start receipts survive an actual killed synthetic controller; recovery cannot launch code or infer drain", async () => {
  const c = claim(), p = planFor(c); await killed(c, "--capsule-start"); const store = await storeFor(c);
  const id = "c".repeat(64); let removed = false, inspections = 0;
  const driver = { async create() { throw new Error("no creation"); }, async start() { throw new Error("no execution"); },
    async find() { return removed ? null : this.inspect(); }, async inspect() { inspections++; return { id, status: "created", starts: 0, running: false, pid: 0 }; },
    async stop() { throw new Error("not running"); }, async remove() { removed = true; }, async assertAbsent() { assert.equal(removed, true); } };
  try {
    const lifecycle = createCapsuleLifecycle(store, driver, { imageId: `sha256:${"a".repeat(64)}`, digest: "b".repeat(64) }, syntheticResources);
    assert.equal((await lifecycle.recover(p, signal())).state.status, "created"); assert.ok(inspections);
    const result = await lifecycle.stopAndRemove(p, signal()); assert.equal(result.removed, true); assert.equal(Object.hasOwn(result, "drain"), false);
    assert.deepEqual(await store.read(p), { begun: false, evidence: null });
    await assert.rejects(store.reserveCapsule(p, (await store.capsule(p)).intent, signal()));
    const folder = `${CHECKPOINT_DIRECTORY}/capsule-${p.hostEpochId}-${p.attemptId}`;
    assert.deepEqual((await readdir(folder)).sort(), ["binding.json", "container.json", "intent.json", "remove.json", "removed.json", "start.json", "stopped.json"]);
    for (const name of await readdir(folder)) assert.equal((await lstat(`${folder}/${name}`)).mode & 0o7777, 0o400);
    assert.doesNotMatch(await readFile(`${folder}/intent.json`, "ascii"), /source_b64|stdin_b64/);
  } finally { await store.close(); }
});
test("eight real journal allocations compete for one intent without consuming the separate per-capsule source start", async () => {
  const c = claim(), p = planFor(c), stores = await Promise.all(Array.from({ length: 8 }, () => storeFor(c)));
  const intent = { version: 1, nonce: randomUUID(), image_id: `sha256:${"a".repeat(64)}`, release_sha256: "b".repeat(64) };
  try {
    const replies = await Promise.allSettled(stores.map(s => s.reserveCapsule(p, intent, signal())));
    assert.equal(replies.filter(value => value.status === "fulfilled").length, 1);
    assert.equal((await stores[0].capsule(p)).intent.nonce, intent.nonce);
    assert.deepEqual(await stores[0].read(p), { begun: false, evidence: null });
    await stores[0].begin(p, signal()); assert.equal((await stores[0].read(p)).begun, true);
  } finally { for (const store of stores) await store.close(); }
});
test("the outer backend recovers all five real disk checkpoints without Docker, readiness, source execution or filesystem mutation", async () => {
  for (const language of ["c", "cpp", "java", "python", "javascript"]) {
    const c = claim(randomUUID(), language), p = planFor(c), store = await storeFor(c);
    try {
      const intent = { version: 1, nonce: randomUUID(), image_id: `sha256:${"a".repeat(64)}`, release_sha256: "b".repeat(64) };
      const ref = capsuleReference(p, intent), id = "c".repeat(64);
      await store.reserveCapsule(p, intent, signal()); await store.saveCapsule(p, "container", { id }); await store.saveCapsule(p, "start", { id });
      await store.begin(p, signal()); await store.bindPhysical(p, { ...syntheticPhysical, container_id: id, cgroup_parent: ref.parent });
      const value = await evidence(p); value.metadata.drain = null; await store.save(p, value);
      const original = JSON.stringify(await store.capsule(p)), bytes = await readFile(`${entry(p)}/result.json`);
      const forbidden = async () => { throw new Error("no physical/readiness operation during retained verdict recovery"); };
      const driver = { create: forbidden, find: forbidden, inspect: forbidden, start: forbidden, stop: forbidden, remove: forbidden, assertAbsent: forbidden };
      const backend = createCapsuleBackend(store, driver, { imageId: intent.image_id, digest: intent.release_sha256 }, runtimes, forbidden,
        { prepare: forbidden, verify: forbidden, retire: forbidden });
      assert.deepEqual(await backend.recover(p, signal()), value); assert.equal(JSON.stringify(await store.capsule(p)), original);
      assert.deepEqual(await readFile(`${entry(p)}/result.json`), bytes); assert.equal((await store.read(p)).evidence.metadata.drain, null);
    } finally { await store.close(); }
  }
});
test("batch case records retain durable original hardlinks and recover without overwriting evidence",async()=>{
  const c=claim(),p=planFor(c),store=await storeFor(c),intent={version:1,nonce:randomUUID(),image_id:`sha256:${"a".repeat(64)}`,release_sha256:"b".repeat(64)};
  const folder=`${CHECKPOINT_DIRECTORY}/capsule-${p.hostEpochId}-${p.attemptId}`;
  try{
    await store.reserveCapsule(p,intent,signal());const original={phase:"original"};
    await store.saveCapsule(p,"b00_init",original);
    const target=await lstat(folder+"/b00_init.json"),pending=await lstat(folder+"/.b00_init.pending");
    assert.equal(target.ino,pending.ino);assert.equal(target.nlink,2);assert.equal(target.mode&0o7777,0o400);
    await store.saveCapsule(p,"b00_init",original);assert.deepEqual(await store.readCapsuleRecord(p,"b00_init"),original);
    await assert.rejects(store.saveCapsule(p,"b00_init",{phase:"different"}));
    await unlink(folder+"/b00_init.json");await store.saveCapsule(p,"b00_init",original);
    assert.deepEqual(await store.readCapsuleRecord(p,"b00_init"),original);assert.equal((await lstat(folder+"/b00_init.json")).ino,target.ino);
  }finally{await store.close();}
});

test("capsule journal records cannot be overwritten, copied to another binding or treated as safe after incomplete/writable writes", async () => {
  const c = claim(), p = planFor(c), store = await storeFor(c);
  const intent = { version: 1, nonce: randomUUID(), image_id: `sha256:${"a".repeat(64)}`, release_sha256: "b".repeat(64) };
  try {
    await store.reserveCapsule(p, intent, signal()); await store.saveCapsule(p, "container", { id: "c".repeat(64) });
    assert.equal(await store.readCapsuleRecord(p, "storage_ack"), null);
    await store.saveCapsule(p, "storage_ack", { receipt: "original" });
    assert.deepEqual(await store.readCapsuleRecord(p, "storage_ack"), { receipt: "original" });
    await assert.rejects(store.readCapsuleRecord(p, "../binding"));
    await assert.rejects(store.readCapsuleRecord({ ...p, owner: randomUUID() }, "storage_ack"));
    await assert.rejects(store.saveCapsule(p, "storage_ack", { receipt: "replacement" }));
    await assert.rejects(store.saveCapsule(p, "container", { id: "d".repeat(64) }));
    await assert.rejects(store.capsule({ ...p, owner: randomUUID() }));
    const folder = `${CHECKPOINT_DIRECTORY}/capsule-${p.hostEpochId}-${p.attemptId}`;
    await chmod(`${folder}/container.json`, 0o600); await assert.rejects(store.capsule(p)); await chmod(`${folder}/container.json`, 0o400);
    await writeFile(`${folder}/.start.pending`, "unfinished", { mode: 0o400, flag: "wx" });
    assert.equal((await store.capsule(p)).start, null); await assert.rejects(store.saveCapsule(p, "start", { id: "c".repeat(64) }));
    assert.equal(await readFile(`${folder}/.start.pending`, "ascii"), "unfinished");
    const original = { id: "c".repeat(64) }, pending = `${folder}/.removed.pending`;
    await writeFile(pending, judgeJson(original), { mode: 0o600, flag: "wx" });
    await assert.rejects(store.saveCapsule(p, "removed", original));
    await chmod(pending, 0o400);
    await assert.rejects(store.saveCapsule(p, "removed", { id: "d".repeat(64) }));
    await store.saveCapsule(p, "removed", original);
    assert.deepEqual(await store.readCapsuleRecord(p, "removed"), original);
    assert.equal((await lstat(pending)).ino, (await lstat(`${folder}/removed.json`)).ino);
    await store.saveCapsule(p, "removed", original);
    await assert.rejects(store.reserveCapsule(p, intent, signal()));
    const other = planFor(claim(p.hostEpochId)); await store.reserveCapsule(other, intent, signal());
    const otherFolder = `${CHECKPOINT_DIRECTORY}/capsule-${other.hostEpochId}-${other.attemptId}`;
    await chmod(`${otherFolder}/binding.json`, 0o600); await writeFile(`${otherFolder}/binding.json`, await readFile(`${folder}/binding.json`)); await chmod(`${otherFolder}/binding.json`, 0o400);
    await assert.rejects(store.capsule(other));
  } finally { await store.close(); }
});

function privateConfiguration(language = "cpp") {
  const c = claim(randomUUID(), language), p = planFor(c);
  const settings = { hostEpochId: p.hostEpochId, bootId: boot, runtimes, binaries: Object.fromEntries(ISOLATE_BINARIES.map(path => [path, "a".repeat(64)])) };
  const intent = { version: 1, nonce: randomUUID(), image_id: `sha256:${"b".repeat(64)}`, release_sha256: "c".repeat(64) }, ref = capsuleReference(p, intent);
  return { c, p, settings, intent, ref, bytes: capsuleConfiguration(settings, p, ref), folder: `${CAPSULE_DIRECTORY}/${intent.nonce}` };
}
test("private host configuration persists exact source-free bytes for all five profiles on the owned real durable Linux volume", async () => {
  for (const language of ["c", "cpp", "java", "python", "javascript"]) {
    const f = privateConfiguration(language), identity = await prepareCapsuleConfiguration(f.ref, f.bytes);
    await verifyCapsuleConfiguration(f.ref, f.bytes, identity); assert.deepEqual(await readFile(`${f.folder}/capsule.json`), f.bytes);
    assert.equal((await lstat(f.folder)).mode & 0o7777, 0o700); assert.equal((await lstat(`${f.folder}/capsule.json`)).mode & 0o7777, 0o400);
    assert.doesNotMatch(f.bytes.toString(), /source_b64|stdin_b64|synthetic fixture/);
    await assert.rejects(prepareCapsuleConfiguration(f.ref, f.bytes));
    await removeCapsuleConfiguration(f.ref, f.bytes, identity);
  }
});
test("host configuration verification rejects writable, swapped, linked or wrong-inode files and never replaces the original", async () => {
  const f = privateConfiguration(), identity = await prepareCapsuleConfiguration(f.ref, f.bytes), path = `${f.folder}/capsule.json`;
  await chmod(path, 0o600); await assert.rejects(verifyCapsuleConfiguration(f.ref, f.bytes, identity)); await chmod(path, 0o400);
  await assert.rejects(verifyCapsuleConfiguration(f.ref, f.bytes, { ...identity, file: { ...identity.file, inode: "1" } }));
  await rename(path, `${path}.old`); await symlink(`${path}.old`, path);
  await assert.rejects(verifyCapsuleConfiguration(f.ref, f.bytes, identity)); await unlink(path); await rename(`${path}.old`, path);
  await verifyCapsuleConfiguration(f.ref, f.bytes, identity); await removeCapsuleConfiguration(f.ref, f.bytes, identity);
});
test("configuration retirement refuses unknown files and corruption without recursive deletion or any claimed drain", async () => {
  const f = privateConfiguration(), identity = await prepareCapsuleConfiguration(f.ref, f.bytes), unknown = `${f.folder}/unrecognised`;
  await writeFile(unknown, "owned test fixture", { mode: 0o400, flag: "wx" });
  await assert.rejects(removeCapsuleConfiguration(f.ref, f.bytes, identity)); assert.deepEqual(await readFile(`${f.folder}/capsule.json`), f.bytes);
  await unlink(unknown); await removeCapsuleConfiguration(f.ref, f.bytes, identity); await removeCapsuleConfiguration(f.ref, f.bytes, identity);
  await assert.rejects(lstat(f.folder), error => error.code === "ENOENT");
  await assert.rejects(prepareCapsuleConfiguration({ ...f.ref, intent: { ...f.intent, nonce: "../escape" } }, f.bytes));
});
test("a deliberately interrupted configuration removal resumes only its original empty directory without recreating it", async () => {
  const f = privateConfiguration(), identity = await prepareCapsuleConfiguration(f.ref, f.bytes);
  await unlink(`${f.folder}/capsule.json`); await removeCapsuleConfiguration(f.ref, f.bytes, identity);
  await removeCapsuleConfiguration(f.ref, f.bytes, identity); await assert.rejects(lstat(f.folder), error => error.code === "ENOENT");
});
test("the real host authority refuses local cgroup v2 before creating configuration, allocation receipts or any controller group", async () => {
  const f = privateConfiguration(), store = await storeFor(f.c);
  try {
    await store.reserveCapsule(f.p, f.intent, signal());
    const before = JSON.stringify(await store.capsule(f.p)), names = await readdir(CAPSULE_DIRECTORY);
    const authority = createHostCapsuleResources(store, f.settings);
    await assert.rejects(authority.prepare(f.p, f.ref, signal()));
    assert.equal(JSON.stringify(await store.capsule(f.p)), before); assert.deepEqual(await readdir(CAPSULE_DIRECTORY), names);
    assert.equal((await store.capsule(f.p)).resource_intent, null);
  } finally { await store.close(); }
});
test("resource journal records have a separate bounded durable allowance and remain immutable without increasing ordinary receipt limits", async () => {
  const f = privateConfiguration(), store = await storeFor(f.c);
  try {
    await store.reserveCapsule(f.p, f.intent, signal()); const value = { fixture: "a".repeat(8192) };
    await store.saveCapsule(f.p, "resource_intent", value); assert.deepEqual((await store.capsule(f.p)).resource_intent, value);
    await assert.rejects(store.saveCapsule(f.p, "resource_intent", { fixture: "b".repeat(8192) }));
    await assert.rejects(store.saveCapsule(f.p, "resources", { fixture: "a".repeat(32768) }));
    await assert.rejects(store.saveCapsule(f.p, "container", value)); assert.equal((await store.capsule(f.p)).container, null);
  } finally { await store.close(); }
});
test("synthetic phase identities survive an actual killed controller without another launch or invented execution result", async () => {
  const c = claim(), p = planFor(c); await killed(c, "--phase-groups-recorded"); const store = await storeFor(c);
  try {
    const row = await store.capsule(p), physical = await store.physical(p), result = retainedPhaseGroups(p, boot, physical, row);
    assert.equal(result.phase, "compile"); assert.deepEqual(result.groups, { memory: { device: "11", inode: "12" }, cpuacct: { device: "21", inode: "22" } });
    assert.equal(row.run_init, null); assert.equal(row.run_groups, null); assert.equal((await store.read(p)).evidence, null);
    await assert.rejects(store.reserveCapsule(p, row.intent, signal()));
    await assert.rejects(store.saveCapsule(p, "compile_groups", { ...row.compile_groups, init_sha256: "a".repeat(64) }));
    const folder = `${CHECKPOINT_DIRECTORY}/capsule-${p.hostEpochId}-${p.attemptId}`;
    for (const name of ["compile_init", "compile_groups"]) assert.equal((await lstat(`${folder}/${name}.json`)).mode & 0o7777, 0o400);
  } finally { await store.close(); }
});
test("a durable newer init without group evidence survives a killed controller and never falls back to the compiler identity", async () => {
  const c = claim(), p = planFor(c); await killed(c, "--phase-init-uncertain"); const store = await storeFor(c);
  try {
    const row = await store.capsule(p), before = JSON.stringify(row);
    assert.ok(row.compile_groups); assert.ok(row.run_init); assert.equal(row.run_groups, null);
    assert.deepEqual(retainedPhaseGroups(p, boot, await store.physical(p), row), { phase: "run", groups: null });
    assert.equal(JSON.stringify(await store.capsule(p)), before); assert.equal((await store.read(p)).evidence, null);
    await assert.rejects(store.begin(p, signal()));
  } finally { await store.close(); }
});
test("synthetic storage identities survive an actual killed controller and remain immutable without creating result or drain evidence", async () => {
  const c = claim(), p = planFor(c); await killed(c, "--storage-recorded"); const store = await storeFor(c);
  try {
    const row = await store.capsule(p), physical = await store.physical(p), mounts = retainedStorage(p, boot, physical, row.storage);
    assert.equal(Object.keys(mounts).length, 4); assert.equal(mounts.m3.device, "0:203");
    assert.equal(row.compile_init, null); assert.equal((await store.read(p)).evidence, null);
    await assert.rejects(store.reserveCapsule(p, row.intent, signal()));
    await assert.rejects(store.saveCapsule(p, "storage", { ...row.storage, boot_id: randomUUID() }));
    const folder = `${CHECKPOINT_DIRECTORY}/capsule-${p.hostEpochId}-${p.attemptId}`;
    assert.equal((await lstat(`${folder}/storage.json`)).mode & 0o7777, 0o400);
  } finally { await store.close(); }
});

test("a real killed controller leaves its synthetic retirement certificate durable before drain and recovers without another host probe", async () => {
  const c = claim(), p = planFor(c); await killed(c, "--retirement-certificate"); const store = await storeFor(c);
  const forbidden = async () => { throw new Error("Saved certificate must not invoke any host probe or execution"); };
  try {
    const row = await store.capsule(p), resultBytes = await readFile(`${entry(p)}/result.json`);
    assert.ok(row.retirement); assert.equal((await store.read(p)).evidence.metadata.drain, null);
    const release = { imageId: row.intent.image_id, digest: row.intent.release_sha256 }, authority = { hostEpochId: p.hostEpochId, bootId: boot, releaseSha256: release.digest, prove: forbidden };
    const driver = { create: forbidden, inspect: forbidden, find: forbidden, start: forbidden, stop: forbidden, remove: forbidden, assertAbsent: forbidden };
    const recovered = await createCapsuleRetirement(store, driver, release, authority).seal(p, signal()); assert.ok(recovered.metadata.drain);
    assert.deepEqual(await readFile(`${entry(p)}/result.json`), resultBytes);
    const folder = `${CHECKPOINT_DIRECTORY}/capsule-${p.hostEpochId}-${p.attemptId}`;
    assert.equal((await lstat(`${folder}/retirement.json`)).mode & 0o7777, 0o400); assert.equal((await lstat(`${entry(p)}/drain.json`)).mode & 0o7777, 0o400);
    const before = await readFile(`${entry(p)}/drain.json`);
    assert.deepEqual(await createCapsuleRetirement(store, driver, release, authority).seal(p, signal()), recovered);
    assert.deepEqual(await readFile(`${entry(p)}/drain.json`), before); await assert.rejects(store.begin(p, signal()));
  } finally { await store.close(); }
});
test("lost real drain persistence acknowledgement recovers the same synthetic certificate without changing original result or drain files", async () => {
  const c = claim(), p = planFor(c), store = await storeFor(c);
  try {
    const f = await syntheticRetirement(store, p), resultBytes = await readFile(`${entry(p)}/result.json`);
    const lost = { ...store, async save(...args) { await store.save(...args); throw new Error("Lost completed drain persistence reply"); } };
    await assert.rejects(createCapsuleRetirement(lost, f.driver, f.release, f.authority).seal(p, signal()));
    const original = await store.read(p); assert.ok(original.evidence.metadata.drain); const drain = await readFile(`${entry(p)}/drain.json`);
    f.authority.prove = async () => { throw new Error("No new host probe after committed drain"); };
    assert.deepEqual(await createCapsuleRetirement(store, f.driver, f.release, f.authority).seal(p, signal()), original.evidence);
    assert.deepEqual(await readFile(`${entry(p)}/result.json`), resultBytes); assert.deepEqual(await readFile(`${entry(p)}/drain.json`), drain);
  } finally { await store.close(); }
});

test("the real per-capsule backend recovers five saved results without native readiness, init, execution or automatic drain", async () => {
  for (const language of ["c", "cpp", "java", "python", "javascript"]) {
    const c = claim(randomUUID(), language), p = planFor(c), store = await storeFor(c);
    try {
      await store.begin(p, signal()); await store.bindPhysical(p, syntheticPhysical);
      const original = await evidence(p); original.metadata.drain = null; await store.save(p, original);
      const backend = createIsolateBackend({ hostEpochId: p.hostEpochId, bootId: boot, runtimes,
        binaries: Object.fromEntries(ISOLATE_BINARIES.map(path => [path, "0".repeat(64)])) }, store);
      await assert.rejects(backend.assertReady(signal()));
      assert.deepEqual(await backend.recover(p, signal()), original); await assert.rejects(backend.execute(p, signal()));
      const configuration = Buffer.from(judgeJson({ schema_version: 1, policy_sha256: EXECUTION_PLAN_SHA256, host_epoch_id: p.hostEpochId, boot_id: boot,
        attempt_id: p.attemptId, permit_owner: p.owner, provider_token: p.providerToken, payload_digest: executionRequest(c, boot, runtimes, "RECOVER").payload.payload_digest,
        runtimes: runtimeRecord(runtimes), executables: Object.fromEntries(["isolate", "phase_exec", "gcc", "gpp", "python", "node", "java", "javac"].map(tag => [tag, "0".repeat(64)])) }));
      const request = executionRequest(c, boot, runtimes, "RECOVER");
      const reply = readJudgeJson(await capsuleReply(configuration, Buffer.from(judgeJson(request)), signal()));
      assert.deepEqual(acceptExecutionReply(reply, c, request), original); assert.equal(Object.hasOwn(reply.reply, "source_b64"), false);
      assert.deepEqual(await store.physical(p), syntheticPhysical); assert.deepEqual((await store.read(p)).evidence, original);
    } finally { await store.close(); }
  }
});
test("partial results survive recovery failure and cleanup only appends proof without rewriting original bytes", async () => {
  const c = claim(), p = planFor(c), store = await storeFor(c), full = await evidence(p), partial = structuredClone(full); partial.metadata.drain = null;
  try {
    const backend = createCheckpointedBackend(store, engine({ async execute() { return partial; }, async recover() { throw new Error("Physical backend unavailable"); } }));
    assert.equal((await backend.execute(p, signal())).metadata.drain, null);
    const original = await readFile(`${entry(p)}/result.json`);
    assert.equal((await backend.recover(p, signal())).metadata.drain, null);
    const changed = structuredClone(full); changed.metadata.run.cpu_ns = "10001";
    await assert.rejects(store.save(p, changed)); assert.deepEqual(await readFile(`${entry(p)}/result.json`), original);
    assert.ok((await store.save(p, full)).metadata.drain);
    assert.deepEqual(await readFile(`${entry(p)}/result.json`), original);
    const old = await readFile(`${entry(p)}/drain.json`); full.metadata.drain.proof_digest = "d".repeat(64);
    await assert.rejects(store.save(p, full)); assert.deepEqual(await readFile(`${entry(p)}/drain.json`), old);
  } finally { await store.close(); }
});
test("a write failure after backend completion retains uncertainty; cancellation and recovery cannot repeat execution", async () => {
  const c = claim(), p = planFor(c), store = await storeFor(c), completed = await evidence(p), controller = new AbortController(); let starts = 0;
  try {
    const backend = createCheckpointedBackend(store, engine({
      async execute() { starts++; controller.abort(); await chmod(entry(p), 0o500); return completed; },
      async recover() { return completed; },
    }));
    await assert.rejects(backend.execute(p, controller.signal)); assert.equal(starts, 1);
    await chmod(entry(p), 0o700); assert.deepEqual(await store.read(p), { begun: true, evidence: null });
    await assert.rejects(backend.execute(p, signal())); assert.equal(starts, 1);
    assert.equal((await backend.recover(p, signal())).stdout_b64, "MTIK"); assert.equal(starts, 1);
    assert.ok((await store.read(p)).evidence.metadata.drain);
  } finally { await chmod(entry(p), 0o700); await store.close(); }
});
test("foreign owner, provider, source, budget, epoch and policy cannot read or append another execution's checkpoint", async () => {
  const c = claim(), p = planFor(c), store = await storeFor(c);
  try {
    await createCheckpointedBackend(store, engine()).execute(p, signal());
    for (const wrong of [{ ...p, owner: randomUUID() }, { ...p, providerToken: randomUUID() }, { ...p, source: Buffer.from("different") },
      { ...p, payloadLimits: { ...p.payloadLimits, cpuMs: 1 } }, { ...p, hostEpochId: randomUUID() }, { ...p, policySha256: "0".repeat(64) }]) {
      await assert.rejects(store.read(wrong)); await assert.rejects(store.save(wrong, await evidence(p)));
    }
    assert.throws(() => createCheckpointedBackend(store, engine({ policySha256: "0".repeat(64) })));
    const invalid = await evidence(p); invalid.stdout_b64 = "Y2hhbmdlZA==";
    await assert.rejects(store.save(p, invalid)); assert.ok((await store.read(p)).evidence.metadata.drain);
    const other = planFor(claim(c.payload.hostEpochId)); await createCheckpointedBackend(store, engine()).execute(other, signal());
    for (const name of ["result.json", "drain.json"]) {
      const target = `${entry(other)}/${name}`, original = await readFile(target);
      await chmod(target, 0o600); await writeFile(target, await readFile(`${entry(p)}/${name}`)); await chmod(target, 0o400);
      await assert.rejects(store.read(other));
      await chmod(target, 0o600); await writeFile(target, original); await chmod(target, 0o400);
    }
    assert.equal(p.policySha256, EXECUTION_PLAN_SHA256);
  } finally { await store.close(); }
});
test("private interrupted writes are never interpreted as results, overwritten, deleted or used to authorise another start", async () => {
  const c = claim(), p = planFor(c), store = await storeFor(c);
  try {
    await store.begin(p, signal());
    const pending = `${entry(p)}/.result.pending`; await writeFile(pending, "{\"unfinished\":", { mode: 0o400 });
    assert.deepEqual(await store.read(p), { begun: true, evidence: null });
    await assert.rejects(store.save(p, await evidence(p))); await assert.rejects(store.begin(p, signal()));
    assert.equal(await readFile(pending, "ascii"), "{\"unfinished\":");
    const other = claim(c.payload.hostEpochId), plan = planFor(other); await store.begin(plan, signal());
    const full = await evidence(plan); await store.save(plan, full);
    // Reproduce link-published-but-unlinked-pending: the protected final inode is still usable.
    await link(`${entry(plan)}/result.json`, `${entry(plan)}/.result.pending`);
    assert.ok((await store.read(plan)).evidence.metadata.drain);
  } finally { await store.close(); }
});
test("linked, writable, oversized or corrupt final files fail closed instead of returning a participant result", async () => {
  const c = claim(), p = planFor(c), store = await storeFor(c);
  try {
    await createCheckpointedBackend(store, engine()).execute(p, signal());
    const path = `${entry(p)}/result.json`, original = await readFile(path);
    await chmod(path, 0o600); await assert.rejects(store.read(p)); await chmod(path, 0o400);
    await rename(path, `${path}.old`); await symlink(`${path}.old`, path);
    await assert.rejects(store.read(p)); await unlink(path); await rename(`${path}.old`, path);
    await chmod(path, 0o600); await writeFile(path, Buffer.alloc(2097153)); await chmod(path, 0o400); await assert.rejects(store.read(p));
    await chmod(path, 0o600); await writeFile(path, "{}"); await chmod(path, 0o400); await assert.rejects(store.read(p));
    const corrupt = JSON.parse(original); corrupt.evidence.metadata.run.cpu_ns = "10001";
    await chmod(path, 0o600); await writeFile(path, judgeJson(corrupt)); await chmod(path, 0o400); await assert.rejects(store.read(p));
    await chmod(path, 0o600); await writeFile(path, original); await chmod(path, 0o400);
    assert.ok((await store.read(p)).evidence.metadata.drain);
  } finally { await store.close(); }
});
test("checkpoint installation and boot gates reject unsafe stores, while unknown recovery performs no filesystem mutation", async () => {
  const c = claim(), p = planFor(c), store = await storeFor(c);
  try {
    await store.assertReady(); assert.ok([0xef53, 0x58465342].includes((await statfs(CHECKPOINT_DIRECTORY)).type));
    const before = await readdir(CHECKPOINT_DIRECTORY); assert.deepEqual(await store.read(p), { begun: false, evidence: null });
    assert.deepEqual(await readdir(CHECKPOINT_DIRECTORY), before);
    const old = await openExecutionCheckpoints(c.payload.hostEpochId, randomUUID());
    try { await assert.rejects(old.assertReady()); await assert.rejects(old.begin(p, signal())); assert.equal((await old.read(p)).begun, false); }
    finally { await old.close(); }
    await chmod(CHECKPOINT_DIRECTORY, 0o777);
    try { await assert.rejects(store.assertReady()); await assert.rejects(store.read(p)); await assert.rejects(storeFor(c)); }
    finally { await chmod(CHECKPOINT_DIRECTORY, 0o700); }
    await mkdir(entry(p), { mode: 0o700 }); assert.equal((await store.read(p)).begun, false); await assert.rejects(store.begin(p, signal()));
  } finally { await store.close(); }
  await assert.rejects(store.read(p));
});
