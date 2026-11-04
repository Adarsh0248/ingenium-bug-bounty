import { constants, createReadStream } from "node:fs";
import { lstat, open, readFile, readdir, readlink, realpath, statfs } from "node:fs/promises";
import { dirname } from "node:path";
import { createHash } from "node:crypto";
import { sha256, uuid } from "../access/credentials.js";
import { runtimeRecord } from "../content/judge-protocol.js";
import type { JudgeRuntimes } from "../content/judge-protocol.js";

export const ISOLATE_CONFIGURATION = "box_root = /var/local/lib/isolate\ncg_root = /run/ingenium/cgroups\nfirst_uid = 60000\nfirst_gid = 60000\nnum_boxes = 1\n";
export const ISOLATE_BINARIES = ["/usr/local/bin/isolate", "/usr/local/bin/ingenium-phase-exec", "/usr/local/bin/gcc", "/usr/local/bin/g++",
  "/usr/local/bin/python3.14", "/usr/local/bin/node", "/usr/local/java/bin/java", "/usr/local/java/bin/javac"] as const;
export interface IsolateSettings { hostEpochId: string; bootId: string; runtimes: JudgeRuntimes; binaries: Readonly<Record<typeof ISOLATE_BINARIES[number], string>>;
  batch?:{batchId:string;digest:string;raw:Buffer}; }
const bad = (): never => { throw new Error("Verified private Isolate capsule required; retain the execution reservation."); };
export async function protectedLinuxFile(path: string, limit: number) {
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const info = await file.stat();
    if (!info.isFile() || info.uid !== 0 || info.gid !== 0 || info.nlink !== 1 || info.mode & 0o022 || info.size > limit) return bad();
    const bytes = Buffer.alloc(limit + 1); let length = 0;
    while (length < bytes.length) {
      const result = await file.read(bytes, length, bytes.length - length, length);
      if (!result.bytesRead) return bytes.subarray(0, length);
      length += result.bytesRead;
    }
    return bad();
  } finally { await file.close(); }
}
export async function protectedDirectory(path: string) {
  if (await realpath(path) !== path) return bad();
  for (let parent = path; ; parent = dirname(parent)) {
    const info = await lstat(parent);
    if (!info.isDirectory() || info.isSymbolicLink() || info.uid !== 0 || info.gid !== 0 || info.mode & 0o022) return bad();
    if (parent === "/") break;
  }
}
export function checkCapsuleProcess(status: string, selfCgroup: string, apparmor: string) {
  const capabilities = (1n << 0n | 1n << 1n | 1n << 5n | 1n << 6n | 1n << 7n | 1n << 18n | 1n << 19n | 1n << 21n).toString(16).padStart(16, "0");
  for (const field of ["Uid", "Gid"]) if (!new RegExp(`^${field}:\\s+0\\s+0\\s+0\\s+0$`, "m").test(status)) return bad();
  for (const field of ["CapPrm", "CapEff", "CapBnd"]) if (!new RegExp(`^${field}:\\s+${capabilities}$`, "m").test(status)) return bad();
  for (const field of ["CapInh", "CapAmb"]) if (!new RegExp(`^${field}:\\s+0000000000000000$`, "m").test(status)) return bad();
  if (!/^NoNewPrivs:\s+1$/m.test(status) || !/^Seccomp:\s+2$/m.test(status) || apparmor !== "ingenium-isolate-executor-v1 (enforce)\n") return bad();
  const controllers = new Map<string, string>();
  for (const row of selfCgroup.trimEnd().split("\n")) {
    const match = /^(0|[1-9][0-9]*):([a-z_,]*|name=systemd):(\/[^\s:]*)$/.exec(row); if (!match) return bad();
    for (const controller of match[2]!.split(",")) {
      if (controllers.has(controller)) return bad(); controllers.set(controller, match[3]!);
    }
  }
  const memory = controllers.get("memory");
  const match = /^(\/ingenium-exec-[0-9a-f]{32})\/docker\/([0-9a-f]{64})$/.exec(memory ?? "");
  if (!match || ["cpu", "cpuacct", "pids"].some(key => controllers.get(key) !== memory)) return bad();
  return { parent: match[1]!, container: match[2]! };
}
export function checkCapsuleMounts(table: string, parent: string) {
  if (table.length > 1048576 || !/^\/ingenium-exec-[0-9a-f]{32}$/.test(parent)) return bad();
  const records = table.trimEnd().split("\n").map(row => {
    const parts = row.split(" - "); if (parts.length !== 2) return bad();
    const before = parts[0]!.split(" "), after = parts[1]!.split(" ");
    if (before.length < 6 || after.length < 3) return bad();
    return { root: before[3], path: before[4], flags: new Set(before[5]!.split(",")), fs: after[0], controllers: new Set(after[2]!.split(",")) };
  });
  function one(path: string) { const matches = records.filter(row => row.path === path); if (matches.length !== 1) return bad(); return matches[0]!; }
  if (!one("/").flags.has("ro")) return bad();
  if (records.some(row => row.path !== "/usr/local/etc/isolate" && ["/usr", "/lib", "/lib64"].some(root => row.path === root || row.path?.startsWith(`${root}/`)))) return bad();
  for (const controller of ["memory", "cpuacct", "pids"]) {
    const record = one(`/run/ingenium/parent/${controller}`);
    if (record.root !== parent || record.fs !== "cgroup" || !record.flags.has("ro") || !record.controllers.has(controller)) return bad();
  }
  for (const controller of ["memory", "cpuacct"]) {
    const record = one(`/run/ingenium/cgroups/${controller}`);
    if (record.root !== `${parent}/jobs` || record.fs !== "cgroup" || !record.flags.has("rw") || !record.controllers.has(controller)) return bad();
  }
}
export async function verifyCapsule(settings: IsolateSettings, signal: AbortSignal) {
  signal.throwIfAborted();
  if (process.platform !== "linux" || process.getuid?.() !== 0 || process.pid !== 1 || (await statfs("/proc")).type !== 0x9fa0) return bad();
  uuid(settings.hostEpochId); uuid(settings.bootId); runtimeRecord(settings.runtimes);
  if ((await readFile("/proc/sys/kernel/random/boot_id", "ascii")).trim() !== settings.bootId) return bad();
  const identity = checkCapsuleProcess(await readFile("/proc/self/status", "ascii"), await readFile("/proc/self/cgroup", "ascii"), await readFile("/proc/self/attr/current", "ascii"));
  const table = await readFile("/proc/self/mountinfo", "ascii"); checkCapsuleMounts(table, identity.parent);
  if ((await readdir("/sys/class/net")).join(",") !== "lo") return bad();
  for (const [path, mode] of [["/run/ingenium/workspace", 0o755], ["/run/ingenium/control", 0o700]] as const) {
    await protectedDirectory(path); const info = await lstat(path);
    if ((info.mode & 0o7777) !== mode || (await readdir(path)).length !== 0) return bad();
  }
  await protectedDirectory("/var/local/lib/isolate");
  const isolationFs = await statfs("/var/local/lib/isolate");
  if (isolationFs.type !== 0x01021994 || isolationFs.bsize * isolationFs.blocks !== 16777216 || isolationFs.files !== 256) return bad();
  await protectedDirectory("/usr/local/etc");
  if (!(await protectedLinuxFile("/usr/local/etc/isolate", 4096)).equals(Buffer.from(ISOLATE_CONFIGURATION))) return bad();
  if (Object.keys(settings.binaries).length !== ISOLATE_BINARIES.length) return bad();
  for (const path of ISOLATE_BINARIES) {
    signal.throwIfAborted(); const expected = settings.binaries[path];
    if (!/^[0-9a-f]{64}$/.test(expected ?? "")) return bad();
    await protectedDirectory(dirname(path));
    const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      const info = await file.stat();
      if (!info.isFile() || info.uid !== 0 || info.gid !== 0 || info.nlink !== 1 || info.mode & 0o7022 || !(info.mode & 0o111)
        || info.size < 1 || info.size > 268435456 || path === ISOLATE_BINARIES[0] && (info.mode & 0o7777) !== 0o555) return bad();
      const hash = createHash("sha256"); let size = 0;
      for await (const bytes of createReadStream("", { fd: file.fd, autoClose: false, start: 0, highWaterMark: 65536 })) {
        signal.throwIfAborted(); size += bytes.length; if (size > 268435456) return bad(); hash.update(bytes);
      }
      if (size !== info.size || hash.digest("hex") !== expected) return bad();
    } finally { await file.close(); }
  }
  for (const controller of ["memory", "cpuacct", "pids"]) {
    const path = `/run/ingenium/parent/${controller}`; await protectedDirectory(path);
    if ((await statfs(path)).type !== 0x27e0eb) return bad();
  }
  await verifyParentBudget(); signal.throwIfAborted();
  const namespaces = Object.fromEntries(await Promise.all(["pid", "mnt", "net", "ipc"].map(async key => [key, await readlink(`/proc/self/ns/${key}`)])));
  return sha256(JSON.stringify({ ...identity, boot: settings.bootId, epoch: settings.hostEpochId, namespaces, binaries: settings.binaries, runtimes: runtimeRecord(settings.runtimes) }));
}
export async function capsuleIdentity() {
  const identity = checkCapsuleProcess(await readFile("/proc/self/status", "ascii"), await readFile("/proc/self/cgroup", "ascii"), await readFile("/proc/self/attr/current", "ascii"));
  return { container_id: identity.container, cgroup_parent: identity.parent, pid_namespace: await readlink("/proc/self/ns/pid"),
    mount_namespace: await readlink("/proc/self/ns/mnt"), network_namespace: await readlink("/proc/self/ns/net"), ipc_namespace: await readlink("/proc/self/ns/ipc") };
}
export async function verifyParentBudget() {
  const expected = {
    "memory/memory.limit_in_bytes": "1610612736\n", "memory/memory.memsw.limit_in_bytes": "1610612736\n", "memory/memory.use_hierarchy": "1\n",
    "memory/memory.failcnt": "0\n", "memory/memory.memsw.failcnt": "0\n", "memory/memory.oom_control": "oom_kill_disable 0\nunder_oom 0\noom_kill 0\n",
    "cpuacct/cpu.cfs_period_us": "100000\n", "cpuacct/cpu.cfs_quota_us": "75000\n", "pids/pids.max": "64\n", "pids/pids.events": "max 0\n",
  };
  for (const [name, value] of Object.entries(expected)) if ((await protectedLinuxFile(`/run/ingenium/parent/${name}`, 4096)).toString("ascii") !== value) return bad();
}
