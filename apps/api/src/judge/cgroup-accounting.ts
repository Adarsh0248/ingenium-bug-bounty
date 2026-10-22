import { constants } from "node:fs";
import { lstat, open, readdir, readlink, realpath, statfs } from "node:fs/promises";
import type { FileHandle } from "node:fs/promises";
import { dirname } from "node:path";
import { reviewedExecutionPlan } from "./execution-plan.js";
import type { ExecutionPlan } from "./execution-plan.js";

const ROOT = "/run/ingenium/cgroups";
const fail = (): never => { throw new Error("Job accounting unavailable or inconsistent; retain the execution reservation."); };
const fd = (file: FileHandle) => `/proc/self/fd/${file.fd}`;
export type CgroupCounterFiles = {
  cpu: string; peak: string; combinedPeak: string; memoryLimit: string; combinedLimit: string; hierarchy: string;
  memoryHits: string; combinedHits: string; oom: string; memoryTasks: string; cpuTasks: string;
};
function integer(value: string) {
  if (!/^(0|[1-9][0-9]{0,18})\n$/.test(value)) return fail();
  const number = BigInt(value.trimEnd()); if (number > 9223372036854775807n) return fail();
  return number;
}

// Decoding counters alone does not verify their origin, containment, exit cause or full-tree drain.
export function decodeCgroupCounters(raw: CgroupCounterFiles, memoryKb: number) {
  if (!Number.isSafeInteger(memoryKb) || memoryKb < 1 || memoryKb > 1048576 || raw.hierarchy !== "1\n"
    || raw.memoryTasks !== "" || raw.cpuTasks !== "") return fail();
  const limit = BigInt(memoryKb) * 1024n;
  if (integer(raw.memoryLimit) !== limit || integer(raw.combinedLimit) !== limit) return fail();
  const oom = /^oom_kill_disable 0\nunder_oom 0\noom_kill (0|[1-9][0-9]{0,18})\n$/.exec(raw.oom);
  if (!oom) return fail();
  const ramPeak = integer(raw.peak), combinedPeak = integer(raw.combinedPeak), peak = ramPeak > combinedPeak ? ramPeak : combinedPeak;
  if (peak > limit) return fail();
  return Object.freeze({ cpuNs: integer(raw.cpu).toString(), peakBytes: peak.toString(), memoryHits: integer(raw.memoryHits).toString(),
    combinedHits: integer(raw.combinedHits).toString(), oomKills: integer(`${oom[1]}\n`).toString() });
}

async function counter(folder: FileHandle, name: string, owner: number | readonly number[] = 0) {
  const file = await open(`${fd(folder)}/${name}`, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const info = await file.stat();
    const owners = typeof owner === "number" ? [owner] : owner;
    if (!info.isFile() || !owners.includes(info.uid) || !owners.includes(info.gid) || info.mode & 0o022) return fail();
    const buffer = Buffer.alloc(4097); let size = 0;
    while (size < buffer.length) {
      const { bytesRead } = await file.read(buffer, size, buffer.length - size, size);
      if (!bytesRead) {
        if (buffer.subarray(0, size).some(byte => byte > 127)) return fail();
        return buffer.subarray(0, size).toString("ascii");
      }
      size += bytesRead;
    }
    return fail();
  } finally { await file.close(); }
}

// Read-only cgroup-v1 observer. The kernel backend must create/contain the original job and prevent future launches.
async function phaseAccounting(plan: ExecutionPlan, phase: "compile" | "run", prepare: boolean) {
  if (process.platform !== "linux" || process.getuid?.() !== 0 || !["compile", "run"].includes(phase)) return fail();
  const stage = reviewedExecutionPlan(plan)[phase]; if (!stage) return fail();
  const groups: { file: FileHandle; path: string; dev: number; ino: number }[] = [];
  let target: FileHandle | undefined;
  try {
    for (const controller of ["memory", "cpuacct"]) {
      const path = `${ROOT}/${controller}/box-0`;
      if (await realpath(path) !== path) return fail();
      for (let parent = path; ; parent = dirname(parent)) {
        const info = await lstat(parent);
        if (!info.isDirectory() || info.isSymbolicLink() || info.uid !== 0 || info.gid !== 0 || info.mode & 0o022) return fail();
        if (parent === "/") break;
      }
      const file = await open(path, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
      const info = await file.stat(); groups.push({ file, path, dev: info.dev, ino: info.ino });
      if ((await statfs(fd(file))).type !== 0x27e0eb) return fail();
    }
    let closed = false;
    async function checkGroups() {
      if (closed) return fail();
      for (const group of groups) {
        const current = await lstat(group.path), original = await group.file.stat();
        if (current.isSymbolicLink() || current.dev !== group.dev || current.ino !== group.ino || original.dev !== group.dev || original.ino !== group.ino
          || current.uid !== 0 || current.gid !== 0 || current.mode & 0o022 || (await statfs(fd(group.file))).type !== 0x27e0eb
          || (await readdir(fd(group.file), { withFileTypes: true })).some(entry => entry.isDirectory() || entry.isSymbolicLink())) return fail();
      }
    }
    async function read() {
      await checkGroups(); const memory = groups[0]!.file, cpu = groups[1]!.file;
      const result = decodeCgroupCounters({ cpu: await counter(cpu, "cpuacct.usage"), peak: await counter(memory, "memory.max_usage_in_bytes"),
        combinedPeak: await counter(memory, "memory.memsw.max_usage_in_bytes"),
        memoryLimit: await counter(memory, "memory.limit_in_bytes"), combinedLimit: await counter(memory, "memory.memsw.limit_in_bytes"),
        hierarchy: await counter(memory, "memory.use_hierarchy"), memoryHits: await counter(memory, "memory.failcnt"),
        combinedHits: await counter(memory, "memory.memsw.failcnt"), oom: await counter(memory, "memory.oom_control"),
        memoryTasks: await counter(memory, "tasks"), cpuTasks: await counter(cpu, "tasks") }, stage!.limits.memoryKb);
      return result;
    }
    if (prepare) {
      await checkGroups(); const memory = groups[0]!.file, cpu = groups[1]!.file;
      for (const name of ["memory.max_usage_in_bytes", "memory.memsw.max_usage_in_bytes", "memory.failcnt", "memory.memsw.failcnt"]) if (await counter(memory, name) !== "0\n") return fail();
      if (await counter(cpu, "cpuacct.usage") !== "0\n" || await counter(cpu, "tasks") !== "" || await counter(memory, "tasks") !== ""
        || await counter(memory, "memory.oom_control") !== "oom_kill_disable 0\nunder_oom 0\noom_kill 0\n") return fail();
      // Set limits only on these new empty groups; never reset usage, failures, membership or a consumed permission.
      for (const name of ["memory.limit_in_bytes", "memory.memsw.limit_in_bytes"]) {
        const file = await open(`${fd(memory)}/${name}`, constants.O_WRONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
        try {
          const info = await file.stat(); if (!info.isFile() || info.uid !== 0 || info.gid !== 0 || info.mode & 0o022) return fail();
          await file.writeFile(`${stage.limits.memoryKb * 1024}\n`);
        } finally { await file.close(); }
      }
    }
    const initial = await read();
    if (Object.values(initial).some(value => value !== "0")) return fail();
    let previous = initial;
    return {
      async originalGroups() {
        const fresh = await read(); if (Object.values(fresh).some(value => value !== "0")) return fail();
        const values: { device: string; inode: string }[] = [];
        for (const group of groups) { const info = await group.file.stat({ bigint: true }); values.push({ device: info.dev.toString(), inode: info.ino.toString() }); }
        return { memory: values[0]!, cpuacct: values[1]! };
      },
      async observeTarget() {
        await checkGroups();
        if (!target) {
          const path = stage!.argv[0] === "/box/main" ? "/run/ingenium/workspace/main" : stage!.argv[0]!;
          target = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
          const info = await target.stat();
          if (!info.isFile() || info.size < 1 || info.size > 268435456 || info.mode & 0o7022 || !(info.mode & 0o111)
            || info.uid !== (path === "/run/ingenium/workspace/main" ? 60000 : 0)) return fail();
        }
        const expected = await target.stat(), memoryTasks = await counter(groups[0]!.file, "tasks"), cpuTasks = await counter(groups[1]!.file, "tasks");
        const ids = memoryTasks === "" ? [] : memoryTasks.trimEnd().split("\n");
        if (ids.length > 64 || ids.some(pid => !/^[1-9][0-9]{0,9}$/.test(pid))) return fail();
        for (const pid of ids) {
          if (!cpuTasks.split("\n").includes(pid)) continue;
          let process: FileHandle | undefined, executable: FileHandle | undefined;
          try {
            process = await open(`/proc/${pid}`, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
            executable = await open(`${fd(process)}/exe`, constants.O_RDONLY | constants.O_NONBLOCK);
            const actual = await executable.stat(); if (actual.dev !== expected.dev || actual.ino !== expected.ino) continue;
            const status = await counter(process, "status", [0, 60000]), limits = await counter(process, "limits", [0, 60000]);
            for (const field of ["Uid", "Gid"]) if (!new RegExp(`^${field}:\\s+60000\\s+60000\\s+60000\\s+60000$`, "m").test(status)) return fail();
            for (const field of ["CapPrm", "CapEff", "CapInh", "CapAmb"]) if (!new RegExp(`^${field}:\\s+0000000000000000$`, "m").test(status)) return fail();
            if (!/^NoNewPrivs:\s+1$/m.test(status) || !/^Seccomp:\s+2$/m.test(status)
              || !/^Max open files\s+256\s+256\s+files\s*$/m.test(limits) || !/^Max core file size\s+0\s+0\s+bytes\s*$/m.test(limits)) return fail();
            for (const namespace of ["pid", "mnt", "net", "ipc"]) if (await readlink(`${fd(process)}/ns/${namespace}`) === await readlink(`/proc/self/ns/${namespace}`)) return fail();
            if ((await counter(groups[0]!.file, "tasks")).split("\n").includes(pid) && (await counter(groups[1]!.file, "tasks")).split("\n").includes(pid)) return true;
          } catch (error) {
            if (!["ENOENT", "ESRCH", "EACCES", "EPERM"].includes((error as NodeJS.ErrnoException).code ?? "")) throw error;
          } finally { await executable?.close(); await process?.close(); }
        }
        return false;
      },
      async readStoppedCounters() {
        const current = await read();
        for (const key of Object.keys(previous) as (keyof typeof previous)[]) if (BigInt(current[key]) < BigInt(previous[key])) return fail();
        previous = current; return current;
      },
      async close() { if (!closed) { closed = true; await target?.close(); for (const group of groups) await group.file.close(); } },
    };
  } catch (error) { await target?.close(); for (const group of groups) await group.file.close(); throw error; }
}
export const openPhaseAccounting = (plan: ExecutionPlan, phase: "compile" | "run") => phaseAccounting(plan, phase, false);
export const preparePhaseAccounting = (plan: ExecutionPlan, phase: "compile" | "run") => phaseAccounting(plan, phase, true);
