import { constants } from "node:fs";
import { link, lstat, mkdir, open, readFile, realpath, statfs, unlink } from "node:fs/promises";
import type { FileHandle } from "node:fs/promises";
import { dirname } from "node:path";
import { sha256, uuid } from "../access/credentials.js";
import { judgeJson, JUDGE_BODY_LIMIT, readJudgeJson } from "../content/judge-protocol.js";
import { checkedExecutionEvidence, EXECUTION_PLAN_SHA256 } from "./execution-plan.js";
import type { ExecutionPlan } from "./execution-plan.js";

export const CHECKPOINT_DIRECTORY = "/var/lib/ingenium/judge-executor/checkpoints";
const capsuleRecords = { intent: 4096, container: 4096, start: 4096, stopped: 4096, remove: 4096, removed: 4096,
  resource_intent: 32768, resources: 32768, resource_remove: 4096, resource_removed: 4096,
  compile_init: 4096, compile_groups: 4096, run_init: 4096, run_groups: 4096, storage: 4096, storage_ack: 4096, retirement: 4096 } as const;
const fail = (): never => { throw new Error("Protected checkpoint unavailable or inconsistent; retain the execution reservation."); };
const missing = (error: unknown) => (error as NodeJS.ErrnoException)?.code === "ENOENT";
const descriptor = (file: FileHandle) => `/proc/self/fd/${file.fd}`;
export interface PhysicalExecutionIdentity {
  container_id: string; cgroup_parent: string; pid_namespace: string; mount_namespace: string; network_namespace: string; ipc_namespace: string;
}
export function physicalIdentity(value: unknown): PhysicalExecutionIdentity {
  const row = record(Buffer.from(judgeJson(value)), ["container_id", "cgroup_parent", "pid_namespace", "mount_namespace", "network_namespace", "ipc_namespace"]);
  if (typeof row.container_id !== "string" || !/^[0-9a-f]{64}$/.test(row.container_id)
    || typeof row.cgroup_parent !== "string" || !/^\/ingenium-exec-[0-9a-f]{32}$/.test(row.cgroup_parent)) return fail();
  for (const [key, namespace] of [["pid_namespace", "pid"], ["mount_namespace", "mnt"], ["network_namespace", "net"], ["ipc_namespace", "ipc"]]) {
    if (typeof row[key!] !== "string" || !new RegExp(`^${namespace}:\\[[1-9][0-9]{0,18}\\]$`).test(row[key!] as string)) return fail();
  }
  return row as unknown as PhysicalExecutionIdentity;
}
function record(raw: Buffer, keys: string[]) {
  const value = readJudgeJson(raw);
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length !== keys.length || keys.some(k => !Object.hasOwn(value, k))) return fail();
  return value as Record<string, unknown>;
}
function planBinding(plan: ExecutionPlan, bootId: string) {
  for (const id of [plan.hostEpochId, plan.attemptId, plan.owner, plan.providerToken]) uuid(id);
  if (plan.policySha256 !== EXECUTION_PLAN_SHA256) return fail();
  return { version: 1, host_epoch_id: plan.hostEpochId, boot_id: bootId, attempt_id: plan.attemptId, permit_owner: plan.owner,
    provider_token: plan.providerToken, plan_sha256: sha256(JSON.stringify({ ...plan,
      source: sha256(plan.source).toString("hex"), stdin: sha256(plan.stdin).toString("hex") })).toString("hex") };
}
async function directory(path: string, mode: number) {
  const handle = await open(path, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
  try {
    const info = await handle.stat();
    if (!info.isDirectory() || info.uid !== 0 || info.gid !== 0 || (info.mode & 0o7777) !== mode) return fail();
    return handle;
  } catch (error) { await handle.close(); throw error; }
}
async function readRecord(folder: FileHandle, name: string, limit: number): Promise<Buffer | null> {
  let file: FileHandle;
  try { file = await open(`${descriptor(folder)}/${name}.json`, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK); }
  catch (error) { if (missing(error)) return null; throw error; }
  try {
    const info = await file.stat();
    // A crash after link() can leave the same protected inode under its pending name too.
    if (!info.isFile() || info.uid !== 0 || info.gid !== 0 || (info.mode & 0o7777) !== 0o400 || info.nlink < 1 || info.nlink > 2 || info.size > limit) return fail();
    const data = Buffer.alloc(limit + 1); let length = 0;
    while (length <= limit) {
      const { bytesRead } = await file.read(data, length, data.length - length, length);
      if (!bytesRead) return data.subarray(0, length);
      length += bytesRead;
    }
    return fail();
  } finally { await file.close(); }
}
async function putOnce(folder: FileHandle, name: string, value: unknown, limit: number) {
  const bytes = Buffer.from(judgeJson(value)); if (bytes.length > limit) return fail();
  const existing = await readRecord(folder, name, limit);
  if (existing) { if (!existing.equals(bytes)) return fail(); await folder.sync(); return; }
  const pending = `${descriptor(folder)}/.${name}.pending`, target = `${descriptor(folder)}/${name}.json`;
  let file: FileHandle;
  try { file = await open(pending, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600); }
  catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "EEXIST") {
      const concurrent = await readRecord(folder, name, limit);
      if (concurrent?.equals(bytes)) { await folder.sync(); return; }
    }
    throw error;
  }
  try { await file.writeFile(bytes); await file.chmod(0o400); await file.sync(); }
  finally { await file.close(); }
  // Publishing never replaces an original record. Keep incomplete writes private for inspection.
  await link(pending, target); await folder.sync();
  await unlink(pending); await folder.sync();
}

export async function openExecutionCheckpoints(hostEpochId: string, bootId: string) {
  if (process.platform !== "linux" || process.getuid?.() !== 0) return fail();
  const epoch = uuid(hostEpochId), boot = uuid(bootId);
  if (await realpath(CHECKPOINT_DIRECTORY) !== CHECKPOINT_DIRECTORY) return fail();
  for (let path = dirname(CHECKPOINT_DIRECTORY); ; path = dirname(path)) {
    const info = await lstat(path);
    if (!info.isDirectory() || info.isSymbolicLink() || info.uid !== 0 || info.mode & 0o022) return fail();
    if (path === "/") break;
  }
  const root = await directory(CHECKPOINT_DIRECTORY, 0o700);
  let closed = false;
  async function available() {
    if (closed) return fail();
    const info = await lstat(CHECKPOINT_DIRECTORY), pinned = await root.stat();
    if (info.dev !== pinned.dev || info.ino !== pinned.ino || info.isSymbolicLink() || info.uid !== 0 || info.gid !== 0 || (info.mode & 0o7777) !== 0o700) return fail();
  }
  function binding(plan: ExecutionPlan) {
    if (plan.hostEpochId !== epoch) return fail();
    return planBinding(plan, boot);
  }
  const bindingDigest = (plan: ExecutionPlan) => sha256(judgeJson(binding(plan))).toString("hex");
  const pathFor = (plan: ExecutionPlan, capsule = false) => `${descriptor(root)}/${capsule ? "capsule-" : ""}${epoch}-${uuid(plan.attemptId)}`;
  async function entry(plan: ExecutionPlan, capsule = false) {
    const expected = Buffer.from(judgeJson(binding(plan)));
    await available(); let folder: FileHandle;
    try { folder = await directory(pathFor(plan, capsule), 0o700); }
    catch (error) { if (missing(error)) return null; throw error; }
    try {
      const saved = await readRecord(folder, "binding", 4096);
      if (!saved) { await folder.close(); return null; }
      if (!saved.equals(expected)) return fail();
      return folder;
    } catch (error) { await folder.close(); throw error; }
  }
  async function read(plan: ExecutionPlan) {
    const folder = await entry(plan); if (!folder) return { begun: false, evidence: null };
    try {
      const result = await readRecord(folder, "result", JUDGE_BODY_LIMIT), drain = await readRecord(folder, "drain", 1024);
      if (!result) { if (drain) return fail(); return { begun: true, evidence: null }; }
      const saved = record(result, ["binding_sha256", "evidence_sha256", "evidence"]);
      if (saved.binding_sha256 !== bindingDigest(plan) || saved.evidence_sha256 !== sha256(judgeJson(saved.evidence)).toString("hex")) return fail();
      const evidence = checkedExecutionEvidence(plan, saved.evidence);
      if (evidence.metadata.drain !== null) return fail();
      if (drain) {
        const proof = record(drain, ["binding_sha256", "evidence_sha256", "proof"]);
        if (proof.binding_sha256 !== saved.binding_sha256 || proof.evidence_sha256 !== saved.evidence_sha256) return fail();
        evidence.metadata.drain = proof.proof;
      }
      return { begun: true, evidence: checkedExecutionEvidence(plan, evidence) };
    } finally { await folder.close(); }
  }
  return {
    get hostEpochId() { return epoch; },
    get bootId() { return boot; },
    async assertReady() {
      if (closed || (await readFile("/proc/sys/kernel/random/boot_id", "ascii")).trim() !== boot) return fail();
      await available();
      const fs = await statfs(descriptor(root));
      // Only persistent local ext4/XFS; tmpfs, overlay and network filesystems are not durability evidence.
      // shortcut: per-record bounds are not a volume quota; enforce bounded storage before real-host activation.
      if (![0xef53, 0x58465342].includes(fs.type) || fs.bavail * fs.bsize < 2 * JUDGE_BODY_LIMIT || fs.ffree < 8) return fail();
      await root.sync();
    },
    async begin(plan: ExecutionPlan, signal: AbortSignal) {
      signal.throwIfAborted(); const record = binding(plan);
      await this.assertReady(); signal.throwIfAborted();
      // The directory is a permanent once-only start receipt, even if binding persistence later fails.
      await mkdir(pathFor(plan), { mode: 0o700 }); await root.sync();
      const folder = await directory(pathFor(plan), 0o700);
      try { await putOnce(folder, "binding", record, 4096); } finally { await folder.close(); }
    },
    read,
    async reserveCapsule(plan: ExecutionPlan, intent: unknown, signal: AbortSignal) {
      signal.throwIfAborted(); const bound = binding(plan);
      await this.assertReady(); signal.throwIfAborted();
      // Separate from the in-capsule start: reserve before any external Docker create request.
      await mkdir(pathFor(plan, true), { mode: 0o700 }); await root.sync();
      const folder = await directory(pathFor(plan, true), 0o700);
      try { await putOnce(folder, "binding", bound, 4096); await putOnce(folder, "intent", intent, 4096); }
      finally { await folder.close(); }
    },
    async capsule(plan: ExecutionPlan) {
      const folder = await entry(plan, true); if (!folder) return null;
      try {
        const rows = {} as Record<keyof typeof capsuleRecords, unknown | null>;
        for (const name of Object.keys(capsuleRecords) as (keyof typeof capsuleRecords)[]) {
          const bytes = await readRecord(folder, name, capsuleRecords[name]); rows[name] = bytes === null ? null : readJudgeJson(bytes);
        }
        return rows;
      } finally { await folder.close(); }
    },
    async readCapsuleRecord(plan: ExecutionPlan, name: keyof typeof capsuleRecords) {
      if (!Object.hasOwn(capsuleRecords, name)) return fail();
      const folder = await entry(plan, true); if (!folder) return null;
      try {
        const bytes = await readRecord(folder, name, capsuleRecords[name]);
        return bytes === null ? null : readJudgeJson(bytes);
      } finally { await folder.close(); }
    },
    async saveCapsule(plan: ExecutionPlan, name: Exclude<keyof typeof capsuleRecords, "intent">, value: unknown) {
      if ((name as string) === "intent" || !Object.hasOwn(capsuleRecords, name)) return fail();
      const folder = await entry(plan, true); if (!folder) return fail();
      try { if (!(await readRecord(folder, "intent", 4096))) return fail(); await putOnce(folder, name, value, capsuleRecords[name]); }
      finally { await folder.close(); }
    },
    async bindPhysical(plan: ExecutionPlan, value: PhysicalExecutionIdentity) {
      const physical = physicalIdentity(value), folder = await entry(plan); if (!folder) return fail();
      try { await putOnce(folder, "physical", { binding_sha256: bindingDigest(plan), physical }, 4096); }
      finally { await folder.close(); }
    },
    async physical(plan: ExecutionPlan): Promise<PhysicalExecutionIdentity | null> {
      const folder = await entry(plan); if (!folder) return null;
      try {
        const bytes = await readRecord(folder, "physical", 4096); if (!bytes) return null;
        const row = record(bytes, ["binding_sha256", "physical"]); if (row.binding_sha256 !== bindingDigest(plan)) return fail();
        return physicalIdentity(row.physical);
      } finally { await folder.close(); }
    },
    async save(plan: ExecutionPlan, value: unknown) {
      const evidence = checkedExecutionEvidence(plan, value), drain = evidence.metadata.drain;
      evidence.metadata.drain = null;
      const folder = await entry(plan); if (!folder) return fail();
      try {
        const bound = { binding_sha256: bindingDigest(plan), evidence_sha256: sha256(judgeJson(evidence)).toString("hex") };
        await putOnce(folder, "result", { ...bound, evidence }, JUDGE_BODY_LIMIT);
        if (drain !== null) await putOnce(folder, "drain", { ...bound, proof: drain }, 1024);
      } finally { await folder.close(); }
      const saved = await read(plan); if (!saved.evidence) return fail(); return saved.evidence;
    },
    async close() { closed = true; await root.close(); },
  };
}
export type ExecutionCheckpoints = Awaited<ReturnType<typeof openExecutionCheckpoints>>;
