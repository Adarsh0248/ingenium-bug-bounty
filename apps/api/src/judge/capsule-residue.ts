import { constants, openSync, readSync, closeSync, readlinkSync, statSync, statfsSync } from "node:fs";
import { open, opendir, readFile, statfs } from "node:fs/promises";
import { setImmediate as yieldObservation } from "node:timers/promises";
import type { FileHandle } from "node:fs/promises";
import { uuid } from "../access/credentials.js";
import { physicalIdentity } from "./checkpoints.js";
import type { PhysicalExecutionIdentity } from "./checkpoints.js";
import { linuxDevice, mountRecords, retainedStorage } from "./capsule-storage.js";
import type { ExecutionPlan } from "./execution-plan.js";
import type { OwnedNamespaceReference } from "./host-storage-pins.js";

const fail = (): never => { throw new Error("Capsule references remain or cannot be inspected; retain its reservation."); };
const fd = (handle: FileHandle) => `/proc/self/fd/${handle.fd}`;
const gone = (error: unknown) => ["ENOENT", "ESRCH"].includes((error as NodeJS.ErrnoException)?.code ?? "");
export const CAPSULE_REFERENCE_BUDGET_MS=5000;
export function checkReference(physical: PhysicalExecutionIdentity, devices: ReadonlySet<string>, target: string, device?: string) {
  if ([physical.pid_namespace, physical.mount_namespace, physical.network_namespace, physical.ipc_namespace].includes(target)
    || device !== undefined && devices.has(device)) return fail();
}
export function checkMountReferences(physical: PhysicalExecutionIdentity, devices: ReadonlySet<string>, table: string) {
  for (const row of mountRecords(table)) {
    checkReference(physical, devices, row.root, row.device);
    if (row.fs === "cgroup" && (row.root === physical.cgroup_parent || row.root.startsWith(`${physical.cgroup_parent}/`))) return fail();
  }
}
export function checkProcessGroups(physical: PhysicalExecutionIdentity, table: string) {
  if (!table.endsWith("\n") || table.length > 16384 || /[^\x20-\x7e\n]/.test(table)) return fail();
  const controllers = new Set<string>();
  for (const row of table.trimEnd().split("\n")) {
    const parts = /^(0|[1-9][0-9]*):([a-z_=,]*):(\/[^\s:]*)$/.exec(row); if (!parts || controllers.has(parts[2]!)) return fail();
    controllers.add(parts[2]!);
    if (parts[3] === physical.cgroup_parent || parts[3]!.startsWith(`${physical.cgroup_parent}/`)) return fail();
  }
}
function bounded(path: string, limit: number, turn: () => void) {
  turn();
  const file = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const bytes = Buffer.alloc(limit + 1); let length = 0;
    while (length < bytes.length) {
      turn();
      const size = readSync(file, bytes, length, bytes.length - length, length);
      if (!size) { if (bytes.subarray(0, length).some(byte => byte > 127 || byte === 0)) return fail(); return bytes.subarray(0, length).toString("ascii"); }
      length += size;
    }
    return fail();
  } finally { closeSync(file); }
}
// A bounded read-only observation, not host visibility/containment certification or a positive drain authority.
export async function verifyNoCapsuleReferences(plan: ExecutionPlan, boot: string, identity: PhysicalExecutionIdentity, storage: unknown, signal: AbortSignal,
  owned?: ReadonlyMap<number, OwnedNamespaceReference>) {
  signal.throwIfAborted(); const physical = physicalIdentity(identity), mounts = retainedStorage(plan, uuid(boot), physical, storage);
  if (process.platform !== "linux" || process.getuid?.() !== 0 || (await statfs("/proc")).type !== 0x9fa0) return fail();
  const devices = new Set(Object.values(mounts).map(row => row.device)), deadline = process.hrtime.bigint() + BigInt(CAPSULE_REFERENCE_BUDGET_MS)*1000000n;
  const self = String(process.pid), pins = new Map([...(owned ?? [])].map(([number, value]) => [number, { ...value }]));
  if (pins.size && (pins.size !== 4 || new Set([...pins.values()].map(value => value.target)).size !== 4
    || [...pins].some(([number, value]) => !Number.isSafeInteger(number) || number < 3 || number > 2147483647
      || Object.keys(value).sort().join(",") !== "device,inode,target" || !/^[1-9][0-9]{0,19}$/.test(value.inode)
      || typeof value.device !== "string" || !/^(0|[1-9][0-9]{0,9}):(0|[1-9][0-9]{0,9})$/.test(value.device)
      || ![physical.pid_namespace, physical.mount_namespace, physical.network_namespace, physical.ipc_namespace].includes(value.target)))) return fail();
  const root = await open("/proc", constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
  let processes = 0, tasks = 0, descriptors = 0;
  function turn() { signal.throwIfAborted(); if (process.hrtime.bigint() >= deadline) throw new Error("Capsule reference inspection exceeded its deadline; retain its reservation."); }
  async function sameBoot() { turn(); if ((await readFile(`${fd(root)}/sys/kernel/random/boot_id`, "ascii")).trim() !== boot) return fail(); }
  function reference(path: string, pin?: OwnedNamespaceReference) {
    turn();
    try {
      // This isolated host CLI checks thousands of proc FDs; avoid a thread-pool round trip for each metadata syscall.
      const target = readlinkSync(path), info = statSync(path, { bigint: true });
      if (pin && target === pin.target && info.ino.toString() === pin.inode && linuxDevice(info.dev) === pin.device
        && info.isFile() && info.uid === 0n && info.gid === 0n && !(info.mode & 0o022n) && statfsSync(path).type === 0x6e736673) return;
      checkReference(physical, devices, target, linuxDevice(info.dev));
    }
    catch (error) { if (!gone(error)) throw error; }
  }
  try {
    await sameBoot();
    const list = await opendir(fd(root));
    for await (const entry of list) {
      turn(); if (!/^[1-9][0-9]*$/.test(entry.name)) continue; if (++processes > 16384 || !entry.isDirectory()) return fail();
      let process: FileHandle | undefined;
      try {
        process = await open(`${fd(root)}/${entry.name}`, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
        const threads = await opendir(`${fd(process)}/task`);
        for await (const thread of threads) {
          turn(); if (!/^[1-9][0-9]*$/.test(thread.name) || !thread.isDirectory() || ++tasks > 32768) return fail();
          if (tasks % 16 === 0) { await yieldObservation(); turn(); }
          let task: FileHandle | undefined;
          try {
            task = await open(`${fd(process)}/task/${thread.name}`, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
            const path = fd(task);
            checkProcessGroups(physical, bounded(`${path}/cgroup`, 16384, turn));
            for (const name of ["pid", "mnt", "net", "ipc"]) { turn(); checkReference(physical, devices, readlinkSync(`${path}/ns/${name}`)); }
            checkMountReferences(physical, devices, bounded(`${path}/mountinfo`, 1048576, turn));
            for (const name of ["cwd", "root", "exe"]) reference(`${path}/${name}`);
            const files = await opendir(`${path}/fd`, { bufferSize: 256 });
            for await (const file of files) {
              if (!/^(0|[1-9][0-9]*)$/.test(file.name) || ++descriptors > 131072) return fail();
              // Only these four verified handles in this process are closed by the retirement authority itself.
              reference(`${path}/fd/${file.name}`, entry.name === self ? pins.get(Number(file.name)) : undefined);
              if (descriptors % 64 === 0) { await yieldObservation(); turn(); }
            }
          } catch (error) { if (!gone(error)) throw error; }
          finally { await task?.close(); }
        }
      } catch (error) { if (!gone(error)) throw error; }
      finally { await process?.close(); }
    }
    await sameBoot();
  } finally { await root.close(); }
}
