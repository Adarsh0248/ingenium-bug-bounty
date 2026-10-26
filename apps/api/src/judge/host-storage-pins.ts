import { constants } from "node:fs";
import { open, readlink, stat, statfs } from "node:fs/promises";
import type { FileHandle } from "node:fs/promises";
import { physicalIdentity } from "./checkpoints.js";
import type { PhysicalExecutionIdentity } from "./checkpoints.js";
import { CAPSULE_TMPFS } from "./docker-capsule.js";
import { linuxDevice, retainedStorage } from "./capsule-storage.js";
import { protectedLinuxFile } from "./isolate-context.js";
import type { ExecutionPlan } from "./execution-plan.js";

export interface OwnedNamespaceReference { target: string; device: string; inode: string; }
const bad = (): never => { throw new Error("Original capsule namespace handles unverified; retain its reservation."); };
const spaces = [["pid", "pid_namespace"], ["mnt", "mount_namespace"], ["net", "network_namespace"], ["ipc", "ipc_namespace"]] as const;

// Keeping the mount namespace alive prevents its temporary-filesystem IDs being reused before retirement.
export async function openCapsuleNamespacePins(plan: ExecutionPlan, boot: string, value: PhysicalExecutionIdentity, storage: unknown, pid: number, signal: AbortSignal) {
  signal.throwIfAborted();
  if (process.platform !== "linux" || process.getuid?.() !== 0 || !Number.isSafeInteger(pid) || pid < 1 || pid > 2147483647) return bad();
  const physical = physicalIdentity(value), mounts = retainedStorage(plan, boot, physical, storage);
  const files: { file: FileHandle; reference: OwnedNamespaceReference }[] = [];
  const processDirectory = await open(`/proc/${pid}`, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
  const path = `/proc/self/fd/${processDirectory.fd}`;
  let retained = false;
  try {
    if ((await statfs(path)).type !== 0x9fa0 || (await processDirectory.stat()).uid !== 0) return bad();
    for (const [name, key] of spaces) {
      signal.throwIfAborted(); const expected = physical[key];
      if (await readlink(`${path}/ns/${name}`) !== expected) return bad();
      // Deliberately follow only the kernel's procfs namespace link, then verify the resulting nsfs inode.
      const file = await open(`${path}/ns/${name}`, constants.O_RDONLY);
      files.push({ file, reference: { target: expected, device: "", inode: "" } });
      const info = await file.stat({ bigint: true });
      files.at(-1)!.reference = Object.freeze({ target: expected, device: linuxDevice(info.dev), inode: info.ino.toString() });
    }
    async function references(current: AbortSignal) {
      current.throwIfAborted(); if (closed) return bad();
      const found = new Map<number, OwnedNamespaceReference>();
      for (const { file, reference } of files) {
        current.throwIfAborted(); const descriptor = `/proc/self/fd/${file.fd}`, info = await file.stat({ bigint: true });
        const flags = /^flags:\s+([0-7]+)$/m.exec((await protectedLinuxFile(`/proc/self/fdinfo/${file.fd}`, 4096)).toString("ascii"));
        if (!info.isFile() || info.uid !== 0n || info.gid !== 0n || info.mode & 0o022n
          || linuxDevice(info.dev) !== reference.device || info.ino.toString() !== reference.inode
          || `${reference.target.slice(0, reference.target.indexOf(":"))}:[${info.ino}]` !== reference.target
          || (await statfs(descriptor)).type !== 0x6e736673 || await readlink(descriptor) !== reference.target
          || !flags || !(BigInt(`0o${flags[1]}`) & 0o2000000n)) return bad();
        found.set(file.fd, reference);
      }
      current.throwIfAborted(); if (found.size !== 4) return bad(); return found;
    }
    let closed = false;
    await references(signal);
    for (const [i, target] of Object.keys(CAPSULE_TMPFS).entries()) {
      signal.throwIfAborted(); const root = `${path}/root${target}`, info = await stat(root, { bigint: true });
      // Workspace preparation deliberately transfers only this mount to the sandbox identity.
      const preparedWorkspace = target === "/run/ingenium/workspace" && info.uid === 60000n && info.gid === 60000n && (info.mode & 0o7777n) === 0o700n;
      if (!info.isDirectory() || !preparedWorkspace && (info.uid !== 0n || info.gid !== 0n || info.mode & 0o022n)
        || linuxDevice(info.dev) !== mounts[`m${i}`]!.device || (await statfs(root)).type !== 0x01021994) return bad();
    }
    for (const [name, key] of spaces) if (await readlink(`${path}/ns/${name}`) !== physical[key]) return bad();
    signal.throwIfAborted(); retained = true;
    return { references, async close() {
      if (closed) return; closed = true;
      const results = await Promise.allSettled(files.map(({ file }) => file.close()));
      if (results.some(result => result.status === "rejected")) return bad();
    } };
  } finally {
    await processDirectory.close();
    if (!retained) await Promise.allSettled(files.map(({ file }) => file.close()));
  }
}
