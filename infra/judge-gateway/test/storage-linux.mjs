import assert from "node:assert/strict";
import { open, readFile, readlink, stat } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { captureStorage, linuxDevice, retainedStorage, storageRecord } from "/workspace/apps/api/dist/judge/capsule-storage.js";
import { checkReference, verifyNoCapsuleReferences } from "/workspace/apps/api/dist/judge/capsule-residue.js";
import { CAPSULE_TMPFS } from "/workspace/apps/api/dist/judge/docker-capsule.js";
import { createExecutionPlan } from "/workspace/apps/api/dist/judge/execution-plan.js";

const hash = "a".repeat(64), boot = (await readFile("/proc/sys/kernel/random/boot_id", "ascii")).trim();
const runtimes = new Map(["c", "cpp", "java", "python", "javascript"].map(key => [key, { key: `synthetic-${key}`, digest: hash }]));
const claim = { payload: { hostEpochId: randomUUID(), attemptId: randomUUID(), runId: randomUUID(), checkId: randomUUID(), language: "cpp",
  runtimeKey: "synthetic-cpp", runtimeDigest: hash, sourceRole: "REFERENCE", checkType: "TEST_CASE", source: Buffer.from("not executable"),
  stdin: Buffer.alloc(0), cpuMs: 1000, wallMs: 5000, memoryKb: 262144 }, owner: randomUUID(), providerToken: randomUUID() };
const plan = createExecutionPlan(claim, runtimes), signal = () => AbortSignal.timeout(10000);
// Synthetic original identity, except namespace observations taken from this real fixture. No real host release is certified.
const physical = { container_id: hash, cgroup_parent: `/ingenium-exec-${"b".repeat(32)}`,
  pid_namespace: await readlink("/proc/self/ns/pid"), mount_namespace: await readlink("/proc/self/ns/mnt"),
  network_namespace: await readlink("/proc/self/ns/net"), ipc_namespace: await readlink("/proc/self/ns/ipc") };
const foreign = { ...physical, pid_namespace: "pid:[1]", mount_namespace: "mnt:[2]", network_namespace: "net:[3]", ipc_namespace: "ipc:[4]" };
const fakeTable = Object.keys(CAPSULE_TMPFS).map((path, i) => `${100 + i} 99 4294967295:${4294967290 + i} / ${path} rw,nosuid,nodev - tmpfs tmpfs rw\n`).join("");
const synthetic = storageRecord(plan, boot, foreign, fakeTable);
assert.equal(process.pid, 1);

test("PID-1 records four real distinct temporary filesystem devices before any source/workspace write", async () => {
  const saved = await captureStorage(plan, boot, physical, signal()), mounts = retainedStorage(plan, boot, physical, saved);
  for (const [i, path] of Object.keys(CAPSULE_TMPFS).entries()) assert.equal(mounts[`m${i}`].device, linuxDevice((await stat(path, { bigint: true })).dev));
  assert.equal(Object.keys(mounts).length, 4); assert.equal(Object.hasOwn(saved, "drain"), false);
});
test("a real namespace still used by the fixture cannot pass the read-only residue check", async () => {
  const saved = storageRecord(plan, boot, physical, fakeTable);
  await assert.rejects(verifyNoCapsuleReferences(plan, boot, physical, saved, signal()), /references remain/);
});
test("real temporary mounts block retirement even with deliberately synthetic unmatched namespace IDs", async () => {
  const saved = storageRecord(plan, boot, foreign, await readFile("/proc/self/mountinfo", "ascii"));
  await assert.rejects(verifyNoCapsuleReferences(plan, boot, foreign, saved, signal()), /references remain/);
});
test("the bounded real proc observer can inspect fixture tasks and FDs without changes or a fabricated drain", async () => {
  const before = await readFile("/proc/self/mountinfo", "ascii");
  assert.equal(await verifyNoCapsuleReferences(plan, boot, foreign, synthetic, signal()), undefined);
  assert.equal(await readFile("/proc/self/mountinfo", "ascii"), before); assert.equal(Object.hasOwn(synthetic, "drain"), false);
});
test("an open real namespace descriptor is recognized without closing or signalling another process", async () => {
  const handle = await open("/proc/self/ns/mnt");
  try { const target = await readlink(`/proc/self/fd/${handle.fd}`); assert.throws(() => checkReference(physical, new Set(), target)); assert.ok((await handle.stat()).ino); }
  finally { await handle.close(); }
});
test("wrong boot, incomplete storage and cancellation cannot pass a native observation", async () => {
  const wrong = randomUUID(); await assert.rejects(verifyNoCapsuleReferences(plan, wrong, foreign, storageRecord(plan, wrong, foreign, fakeTable), signal()));
  await assert.rejects(verifyNoCapsuleReferences(plan, boot, foreign, null, signal()));
  await assert.rejects(captureStorage(plan, boot, foreign, signal()));
  const cancel = new AbortController(); cancel.abort(); await assert.rejects(verifyNoCapsuleReferences(plan, boot, foreign, synthetic, cancel.signal));
});
