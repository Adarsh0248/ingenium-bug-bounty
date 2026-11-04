import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { captureStorage, linuxDevice, mountRecords, retainedStorage, storageRecord, storageAcknowledgement, temporaryMounts } from "../src/judge/capsule-storage.js";
import { checkMountReferences, checkProcessGroups, checkReference, verifyNoCapsuleReferences, retryTransientTaskScan } from "../src/judge/capsule-residue.js";
import { CAPSULE_TMPFS } from "../src/judge/docker-capsule.js";
import { createExecutionPlan } from "../src/judge/execution-plan.js";
import { judgeJson, readJudgeJson } from "../src/content/judge-protocol.js";
import { judgePayload, judgeRuntimes } from "./fixtures/judge.js";
import { waitForStorageAcknowledgement } from "../src/judge/capsule-cli.js";
import type { ExecutionCheckpoints } from "../src/judge/checkpoints.js";

const physical = { container_id: "a".repeat(64), cgroup_parent: `/ingenium-exec-${"b".repeat(32)}`,
  pid_namespace: "pid:[1234]", mount_namespace: "mnt:[1235]", network_namespace: "net:[1236]", ipc_namespace: "ipc:[1237]" };
const table = () => Object.keys(CAPSULE_TMPFS).map((path, i) => `${100 + i} 99 0:${200 + i} / ${path} rw,nosuid,nodev - tmpfs tmpfs rw\n`).join("");
function fixture() {
  const claim = { payload: judgePayload(), owner: randomUUID(), providerToken: randomUUID() }, plan = createExecutionPlan(claim, judgeRuntimes()), boot = randomUUID();
  return { plan, boot, saved: storageRecord(plan, boot, physical, table()) };
}
const devices = new Set(["0:200", "0:201", "0:202", "0:203"]);

test("exiting-task mountinfo races restart a complete census without accepting a partial pass or weakening failures", async () => {
  const race = Object.assign(new Error("task exited"), { code: "EINVAL", syscall: "open", path: "/proc/self/fd/18/mountinfo" });
  let scans = 0;
  await retryTransientTaskScan(async () => { if (++scans === 1) throw race; }, AbortSignal.timeout(1000));
  assert.equal(scans, 2);
  scans = 0;
  await assert.rejects(retryTransientTaskScan(async () => { scans++; throw race; }, AbortSignal.timeout(1000)), error => error === race);
  assert.equal(scans, 3);
  for (const code of ["EMOUNTEMPTY", "EMOUNTTAIL"]) {
    const changed = Object.assign(new Error("task mount table changed"), { code, syscall: "read", path: "/proc/self/fd/18/mountinfo" });
    scans = 0;
    await retryTransientTaskScan(async () => { if (++scans === 1) throw changed; }, AbortSignal.timeout(1000));
    assert.equal(scans, 2);
    scans = 0;
    await assert.rejects(retryTransientTaskScan(async () => { scans++; throw changed; }, AbortSignal.timeout(1000)), error => error === changed);
    assert.equal(scans, 3);
  }
  for (const fault of [new Error("capsule reference remains"), { ...race, code: "EACCES" }, { ...race, syscall: "read" },
    { ...race, path: "/other/mountinfo" }, { ...race, path: "/proc/self/fd/18/cgroup" }]) {
    scans = 0;
    await assert.rejects(retryTransientTaskScan(async () => { scans++; throw fault; }, AbortSignal.timeout(1000)), error => error === fault);
    assert.equal(scans, 1);
  }
  const permission = Object.assign(new Error("proc permissions changed"), { code: "EACCES", syscall: "stat", path: "/proc/self/fd/18/exe" });
  scans = 0;
  await retryTransientTaskScan(async () => { if (++scans === 1) throw permission; }, AbortSignal.timeout(1000));
  assert.equal(scans, 2);
  scans = 0;
  await assert.rejects(retryTransientTaskScan(async () => { scans++; throw permission; }, AbortSignal.timeout(1000)), error => error === permission);
  assert.equal(scans, 3);
  for (const fault of [{ ...permission, path: "/private/exe" }, { ...permission, syscall: "open" }, { ...permission, path: "/proc/self/fd/18/mountinfo" }]) {
    scans = 0;
    await assert.rejects(retryTransientTaskScan(async () => { scans++; throw fault; }, AbortSignal.timeout(1000)), error => error === fault);
    assert.equal(scans, 1);
  }
  scans = 0;
  const remaining = new Error("original namespace still referenced");
  await assert.rejects(retryTransientTaskScan(async () => { if (++scans === 1) throw race; throw remaining; }, AbortSignal.timeout(1000)), error => error === remaining);
  assert.equal(scans, 2);
  const cancelled = new AbortController(); cancelled.abort();
  await assert.rejects(retryTransientTaskScan(async () => { assert.fail("cancelled scan ran"); }, cancelled.signal));
});

test("host storage acknowledgement binds the original physical storage without authorising a verdict or drain",()=>{
  const {plan,boot,saved}=fixture(),ack=storageAcknowledgement(plan,boot,physical,saved);
  assert.equal(ack.attempt_id,plan.attemptId);assert.equal(ack.boot_id,boot);assert.equal(ack.container_id,physical.container_id);
  assert.match(ack.storage_sha256,/^[0-9a-f]{64}$/);assert.doesNotMatch(JSON.stringify(ack),/source|stdin|stdout|drain|PASSED/);
  assert.deepEqual(storageAcknowledgement(plan,boot,physical,structuredClone(saved)),ack);
  assert.throws(()=>storageAcknowledgement({...plan,attemptId:randomUUID()},boot,physical,saved));
  assert.throws(()=>storageAcknowledgement(plan,randomUUID(),physical,saved));
  assert.throws(()=>storageAcknowledgement(plan,boot,{...physical,container_id:"f".repeat(64)},saved));
  assert.throws(()=>storageAcknowledgement(plan,boot,physical,null));
});

test("capsule exit waits for its exact host acknowledgement and rejects cancellation or foreign receipts",async()=>{
  const {plan,boot,saved}=fixture(),ack=storageAcknowledgement(plan,boot,physical,saved);let reads=0;
  const store={bootId:boot,async physical(){return physical;},async readCapsuleRecord(_plan:unknown,name:string){return name==="storage"?saved:++reads<3?null:ack;}} as unknown as ExecutionCheckpoints;
  await waitForStorageAcknowledgement(store,plan,AbortSignal.timeout(1000));assert.equal(reads,3);
  for(const wrong of [{...ack,boot_id:randomUUID()},{...ack,attempt_id:randomUUID()},{...ack,storage_sha256:"f".repeat(64)},{...ack,extra:true}]){
    await assert.rejects(waitForStorageAcknowledgement({...store,async readCapsuleRecord(_p,name){return name==="storage"?saved:wrong;}},plan,AbortSignal.timeout(1000)));
  }
  await assert.rejects(waitForStorageAcknowledgement({...store,async readCapsuleRecord(_p,name){return name==="storage"?saved:null;}},plan,AbortSignal.timeout(10)));
  const cancelled=new AbortController();cancelled.abort();
  await assert.rejects(waitForStorageAcknowledgement({} as ExecutionCheckpoints,plan,cancelled.signal));
});

test("storage records bind all four distinct temporary filesystems to the original plan, boot and physical capsule without source", () => {
  const { plan, boot, saved } = fixture();
  const mounts = retainedStorage(plan, boot, physical, saved); assert.deepEqual(mounts, temporaryMounts(table()));
  assert.deepEqual(readJudgeJson(Buffer.from(judgeJson(saved))), saved);
  assert.equal(Object.keys(mounts).length, 4); assert.doesNotMatch(JSON.stringify(saved), /source_b64|stdin_b64|stdout|synthetic fixture/);
  mounts.m3!.device = "9:9"; assert.equal(saved.mounts.m3!.device, "0:203");
});
test("storage recovery refuses foreign attempts, boots, physical namespaces, extra fields, partial mounts and aliased devices", () => {
  const { plan, boot, saved } = fixture();
  for (const changed of [{ ...saved, attempt_id: randomUUID() }, { ...saved, boot_id: randomUUID() }, { ...saved, physical_sha256: "c".repeat(64) },
    { ...saved, extra: true }, { ...saved, mounts: { ...saved.mounts, extra: saved.mounts.m3 } }, { ...saved, mounts: {} },
    { ...saved, mounts: { ...saved.mounts, m3: { ...saved.mounts.m1 } } }]) assert.throws(() => retainedStorage(plan, boot, physical, changed));
  assert.throws(() => retainedStorage(plan, boot, { ...physical, mount_namespace: "mnt:[9999]" }, saved));
  assert.throws(() => retainedStorage({ ...plan, attemptId: randomUUID() }, boot, physical, saved));
});
test("mount snapshots reject malformed or ambiguous kernel records, bind mounts and missing protections rather than guessing paths", () => {
  for (const value of ["", table().trimEnd(), table() + table(), table().replace("100 99", "0100 99"), table().replace("0:200", "0:4294967296"),
    table().replace("0:200", "00:200"), table().replace("/ /run/ingenium/workspace", "/child /run/ingenium/workspace"), table().replaceAll("0:203", "0:200"),
    table().replace("rw,nosuid,nodev", "rw,nodev"), table().replace("- tmpfs", "- ext4"), table().replace("0:200", "0:0"), table().replace("rw\n", "rw\0\n")]) assert.throws(() => temporaryMounts(value));
  assert.throws(() => mountRecords("x".repeat(1048577) + "\n"));
});
test("Linux device decoding preserves high major/minor bits without floating-point conversion", () => {
  for (const [major, minor] of [[0n, 0n], [0n, 255n], [8n, 1n], [259n, 12345n], [4294967295n, 4294967295n]] as const) {
    const dev = (minor & 0xffn) | (major & 0xfffn) << 8n | (minor & 0xffffff00n) << 12n | (major & 0xfffff000n) << 32n;
    assert.equal(linuxDevice(dev), `${major}:${minor}`);
  }
  assert.throws(() => linuxDevice(-1n)); assert.throws(() => linuxDevice(1n << 64n));
});
test("each original namespace and a renamed or deleted file on any original temporary device blocks retirement", () => {
  for (const target of [physical.pid_namespace, physical.mount_namespace, physical.network_namespace, physical.ipc_namespace]) assert.throws(() => checkReference(physical, devices, target));
  for (const device of devices) assert.throws(() => checkReference(physical, devices, "/unrelated/path (deleted)", device));
  assert.equal(checkReference(physical, devices, "pid:[9999]", "0:999"), undefined);
  assert.equal(checkReference(physical, devices, "socket:[1234]", "0:999"), undefined);
});
test("an aliased temporary mount or owned cgroup bind mount blocks retirement regardless of its visible path", () => {
  assert.throws(() => checkMountReferences(physical, devices, "1 2 0:200 / /renamed rw - tmpfs tmpfs rw\n"));
  for (const root of [physical.cgroup_parent, `${physical.cgroup_parent}/jobs/box-0`, `${physical.cgroup_parent}/docker/child`]) {
    assert.throws(() => checkMountReferences(physical, devices, `1 2 0:999 ${root} /elsewhere rw - cgroup cgroup rw,memory\n`));
  }
  assert.equal(checkMountReferences(physical, devices, `1 2 0:999 ${physical.cgroup_parent}0 /elsewhere rw - cgroup cgroup rw,memory\n`), undefined);
});

test("real namespace mounts are parsed and retained capsule namespace handles still block retirement", () => {
  const record = (root: string, fs = "nsfs") => `459 442 0:4 ${root} /run/example.mnt rw - ${fs} nsfs rw\n`;
  assert.equal(checkMountReferences(physical, devices, record("mnt:[9999]")), undefined);
  for (const root of [physical.pid_namespace, physical.mount_namespace, physical.network_namespace, physical.ipc_namespace]) {
    assert.throws(() => checkMountReferences(physical, devices, record(root)));
  }
  for (const root of ["mnt:[0]", "mnt:[01]", "unknown:[1234]", "relative"]) assert.throws(() => mountRecords(record(root)));
  assert.throws(() => mountRecords(record("mnt:[9999]", "cgroup")));
});
test("all original cgroup descendants are refused without substring false positives or accepting malformed membership", () => {
  for (const path of [physical.cgroup_parent, `${physical.cgroup_parent}/docker/x`, `${physical.cgroup_parent}/jobs/box-0`]) {
    assert.throws(() => checkProcessGroups(physical, `4:memory:${path}\n`));
  }
  for (const value of ["", "bad\n", "4:memory:/ok", "4:memory:/ok\n4:memory:/other\n", "4:memory:/ok\0\n", "x".repeat(16385) + "\n"]) assert.throws(() => checkProcessGroups(physical, value));
  assert.equal(checkProcessGroups(physical, `4:memory:${physical.cgroup_parent}0\n0::/\n`), undefined);
});
test("changed mount identifiers, devices, unknown fields and noncanonical values cannot become retained storage evidence", () => {
  const { plan, boot, saved } = fixture();
  for (const mount of [{ mount_id: "1", device: "0:4294967296" }, { mount_id: "01", device: "0:999" }, { mount_id: "1", device: "0:0" },
    { mount_id: "1", device: "0:999", extra: true }, { mount_id: 1, device: "0:999" }, { mount_id: "1", device: "0:999\n" }]) {
    assert.throws(() => retainedStorage(plan, boot, physical, { ...saved, mounts: { ...saved.mounts, m3: mount } }));
  }
});
test("cancelled residue verification cannot access native resources or invent cleanup evidence", async () => {
  const { plan, boot, saved } = fixture(), cancel = new AbortController(); cancel.abort();
  await assert.rejects(verifyNoCapsuleReferences(plan, boot, physical, saved, cancel.signal));
  await assert.rejects(captureStorage(plan, boot, physical, cancel.signal));
});
test("missing storage or malformed physical identities refuse before a native observation", async () => {
  const { plan, boot, saved } = fixture(), signal = AbortSignal.timeout(1000);
  await assert.rejects(verifyNoCapsuleReferences(plan, boot, physical, null, signal));
  await assert.rejects(verifyNoCapsuleReferences(plan, boot, { ...physical, cgroup_parent: "/" }, saved, signal));
});
