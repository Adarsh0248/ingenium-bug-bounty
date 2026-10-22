import { lstat, readFile, readlink, statfs } from "node:fs/promises";
import { sha256, uuid } from "../access/credentials.js";
import { judgeJson } from "../content/judge-protocol.js";
import { physicalIdentity } from "./checkpoints.js";
import type { PhysicalExecutionIdentity } from "./checkpoints.js";
import { CAPSULE_TMPFS } from "./docker-capsule.js";
import { reviewedExecutionPlan } from "./execution-plan.js";
import type { ExecutionPlan } from "./execution-plan.js";

export interface TemporaryMount { mount_id: string; device: string; }
const paths = Object.keys(CAPSULE_TMPFS);
const fail = (): never => { throw new Error("Original capsule storage unproved; retain its reservation."); };
function object(value: unknown, keys: string[]) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))) return fail();
  return value as Record<string, unknown>;
}
export function linuxDevice(value: bigint) {
  if (value < 0n || value > 18446744073709551615n) return fail();
  return `${(value >> 8n & 0xfffn) | (value >> 32n & 0xfffff000n)}:${(value & 0xffn) | (value >> 12n & 0xffffff00n)}`;
}
export function mountRecords(table: string) {
  if (!table.endsWith("\n") || table.length > 1048576 || /[^\x20-\x7e\n]/.test(table)) return fail();
  const ids = new Set<string>();
  return table.trimEnd().split("\n").map(line => {
    const parts = line.split(" - "); if (parts.length !== 2) return fail();
    const before = parts[0]!.split(" "), after = parts[1]!.split(" ");
    if (before.length < 6 || after.length !== 3 || before.some(value => value === "") || after.some(value => value === "")
      || !/^[1-9][0-9]{0,18}$/.test(before[0]!) || ids.has(before[0]!) || !/^[1-9][0-9]{0,18}$/.test(before[1]!)
      || !before[3]!.startsWith("/") || !before[4]!.startsWith("/")) return fail();
    const device = before[2]!.split(":");
    if (device.length !== 2 || device.some(value => !/^(0|[1-9][0-9]{0,9})$/.test(value) || BigInt(value) > 4294967295n)) return fail();
    ids.add(before[0]!);
    return { mount_id: before[0]!, device: before[2]!, root: before[3]!, path: before[4]!, flags: before[5]!.split(","), fs: after[0]! };
  });
}
export function temporaryMounts(table: string): Record<string, TemporaryMount> {
  const all = mountRecords(table), found: Record<string, TemporaryMount> = {};
  for (const [i, path] of paths.entries()) {
    const rows = all.filter(row => row.path === path), row = rows[0];
    if (rows.length !== 1 || !row || row.root !== "/" || row.fs !== "tmpfs" || !["rw", "nosuid", "nodev"].every(flag => row.flags.includes(flag))
      || row.device === "0:0" || Object.values(found).some(value => value.device === row.device)) return fail();
    found[`m${i}`] = { mount_id: row.mount_id, device: row.device };
  }
  return found;
}
function binding(plan: ExecutionPlan, boot: string, physical: PhysicalExecutionIdentity) {
  const safe = reviewedExecutionPlan(plan);
  return { version: 1, host_epoch_id: safe.hostEpochId, attempt_id: safe.attemptId, boot_id: uuid(boot),
    physical_sha256: sha256(judgeJson(physicalIdentity(physical))).toString("hex") };
}
export function storageRecord(plan: ExecutionPlan, boot: string, physical: PhysicalExecutionIdentity, table: string) {
  return { ...binding(plan, boot, physical), mounts: temporaryMounts(table) };
}
export function retainedStorage(plan: ExecutionPlan, boot: string, physical: PhysicalExecutionIdentity, value: unknown): Record<string, TemporaryMount> {
  const expected = binding(plan, boot, physical), row = object(value, [...Object.keys(expected), "mounts"]), keys = paths.map((_path, i) => `m${i}`), raw = object(row.mounts, keys);
  const mounts: Record<string, TemporaryMount> = {};
  for (const [key, value] of Object.entries(expected)) if (row[key] !== value) return fail();
  for (const key of keys) {
    const mount = object(raw[key], ["mount_id", "device"]);
    if (typeof mount.mount_id !== "string" || !/^[1-9][0-9]{0,18}$/.test(mount.mount_id) || typeof mount.device !== "string") return fail();
    const parts = mount.device.split(":");
    if (parts.length !== 2 || parts.some(value => !/^(0|[1-9][0-9]{0,9})$/.test(value) || BigInt(value) > 4294967295n) || mount.device === "0:0"
      || Object.values(mounts).some(value => value.device === mount.device || value.mount_id === mount.mount_id)) return fail();
    mounts[key] = { mount_id: mount.mount_id, device: mount.device };
  }
  return mounts;
}
// Called only inside the already verified fresh capsule, before workspace writes or source execution.
export async function captureStorage(plan: ExecutionPlan, boot: string, physical: PhysicalExecutionIdentity, signal: AbortSignal) {
  signal.throwIfAborted();
  if (process.platform !== "linux" || process.getuid?.() !== 0 || process.pid !== 1) return fail();
  const table = await readFile("/proc/self/mountinfo", "ascii"), record = storageRecord(plan, boot, physical, table);
  for (const [key, name] of [["pid_namespace", "pid"], ["mount_namespace", "mnt"], ["network_namespace", "net"], ["ipc_namespace", "ipc"]] as const) {
    if (await readlink(`/proc/self/ns/${name}`) !== physical[key]) return fail();
  }
  for (const [i, path] of paths.entries()) {
    const mount = record.mounts[`m${i}`]!;
    signal.throwIfAborted(); const info = await lstat(path, { bigint: true }), fs = await statfs(path);
    if (!info.isDirectory() || info.isSymbolicLink() || info.uid !== 0n || info.gid !== 0n || info.mode & 0o022n || fs.type !== 0x01021994
      || linuxDevice(info.dev) !== mount.device) return fail();
  }
  if ((await readFile("/proc/sys/kernel/random/boot_id", "ascii")).trim() !== boot || await readFile("/proc/self/mountinfo", "ascii") !== table) return fail();
  signal.throwIfAborted(); return record;
}
