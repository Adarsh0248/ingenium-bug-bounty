import { constants } from "node:fs";
import { lstat, mkdir, open, readdir, readFile, rmdir, statfs } from "node:fs/promises";
import type { FileHandle } from "node:fs/promises";
import { judgeJson } from "../content/judge-protocol.js";
import { inodeIdentity } from "./capsule-configuration.js";
import type { InodeIdentity } from "./capsule-configuration.js";
import { protectedDirectory, protectedLinuxFile } from "./isolate-context.js";

export interface CgroupRoot extends InodeIdentity { path: string; mount_id: string; cpus: string; mems: string; }
export interface CgroupAllocation { root: CgroupRoot; parent: InodeIdentity; docker: InodeIdentity; jobs: InodeIdentity | null; }
const fail = (): never => { throw new Error("Original host cgroups unavailable, occupied or changed; retain all resources."); };
const fd = (file: FileHandle) => `/proc/self/fd/${file.fd}`;
const absent = (error: unknown) => (error as NodeJS.ErrnoException)?.code === "ENOENT";
export function cgroupMounts(table: string) {
  if (table.length > 1048576 || !table.endsWith("\n")) return fail();
  const roots: { path: string; mount_id: string }[] = [];
  for (const line of table.trimEnd().split("\n")) {
    const parts = line.split(" - "); if (parts.length !== 2) return fail();
    const left = parts[0]!.split(" "), right = parts[1]!.split(" ");
    if (left.length < 6 || right.length < 3) return fail();
    if (right[0] !== "cgroup") continue;
    const path = left[4]!;
    if (left[3] !== "/" || !/^\/sys\/fs\/cgroup\/[a-z_]+(?:,[a-z_]+)*$/.test(path)
      || !left[5]!.split(",").includes("rw") || !/^[1-9][0-9]{0,9}$/.test(left[0]!)) return fail();
    if (roots.some(root => root.path === path || root.mount_id === left[0])) return fail();
    const controllers = path.slice(path.lastIndexOf("/") + 1).split(",");
    if (controllers.some(controller => !right[2]!.split(",").includes(controller) && !right[2]!.split(",").includes(`name=${controller}`))) return fail();
    roots.push({ path, mount_id: left[0]! });
  }
  if (roots.length < 4 || roots.length > 16 || !["memory", "cpu,cpuacct", "pids", "cpuset"].every(name => roots.some(root => root.path === `/sys/fs/cgroup/${name}`))) return fail();
  const names = roots.flatMap(root => root.path.slice(root.path.lastIndexOf("/") + 1).split(","));
  if (new Set(names).size !== names.length) return fail();
  return roots.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
}
export function cpusetRange(value: string) {
  if (value.length > 4096 || !/^(?:0|[1-9][0-9]*)(?:-(?:0|[1-9][0-9]*))?(?:,(?:0|[1-9][0-9]*)(?:-(?:0|[1-9][0-9]*))?)*\n$/.test(value)) return fail();
  let last = -1;
  for (const part of value.trimEnd().split(",")) {
    const [a, b = a] = part.split("-").map(Number);
    if (a === undefined || b === undefined || !Number.isSafeInteger(a) || !Number.isSafeInteger(b) || a <= last || b < a || b > 1048575) return fail(); last = b;
  }
  return value;
}
async function directory(path: string, expected?: InodeIdentity) {
  const handle = await open(path, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
  try {
    const info = await handle.stat(), fs = await statfs(fd(handle));
    if (info.uid !== 0 || info.gid !== 0 || info.mode & 0o022 || fs.type !== 0x27e0eb) return fail();
    if (expected && judgeJson(await inodeIdentity(handle)) !== judgeJson(expected)) return fail(); return handle;
  } catch (error) { await handle.close(); throw error; }
}
async function control(folder: FileHandle, name: string, expected?: string) {
  const path = `${fd(folder)}/${name}`;
  if (expected !== undefined) {
    const handle = await open(path, constants.O_WRONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try { const info = await handle.stat(); if (!info.isFile() || info.uid !== 0 || info.gid !== 0) return fail(); await handle.writeFile(expected); }
    finally { await handle.close(); }
  }
  const value = (await protectedLinuxFile(path, 8192)).toString("ascii"); if (expected !== undefined && value !== expected) return fail(); return value;
}
async function empty(folder: FileHandle, children: string[]) {
  if (await control(folder, "tasks") !== "" || await control(folder, "cgroup.procs") !== "") return fail();
  const entries = await readdir(fd(folder), { withFileTypes: true });
  const actual: string[] = [];
  for (const entry of entries) { if (entry.isSymbolicLink()) return fail(); if (entry.isDirectory()) actual.push(entry.name); else if (!entry.isFile()) return fail(); }
  if (JSON.stringify(actual.sort()) !== JSON.stringify([...children].sort())) return fail();
}
function parentName(parent: string) { if (!/^\/ingenium-exec-[0-9a-f]{32}$/.test(parent)) return fail(); return parent.slice(1); }
function jobs(root: CgroupRoot) { return ["/sys/fs/cgroup/memory", "/sys/fs/cgroup/cpu,cpuacct"].includes(root.path); }
async function openRoot(root: CgroupRoot) {
  const mounts = cgroupMounts(await readFile("/proc/self/mountinfo", "ascii"));
  if (!mounts.some(row => row.path === root.path && row.mount_id === root.mount_id)) return fail();
  await protectedDirectory(root.path); return directory(root.path, { device: root.device, inode: root.inode });
}
export async function assertHostCgroupAbsent(root: CgroupRoot, parent: string) {
  const name = parentName(parent), top = await openRoot(root);
  try {
    try { await lstat(`${fd(top)}/${name}`); } catch (error) { if (absent(error)) return; throw error; }
    return fail();
  } finally { await top.close(); }
}
export async function inspectHostCgroups(bootId: string): Promise<Record<string, CgroupRoot>> {
  if (process.platform !== "linux" || process.getuid?.() !== 0 || (await readFile("/proc/sys/kernel/random/boot_id", "ascii")).trim() !== bootId) return fail();
  const roots: Record<string, CgroupRoot> = {};
  for (const [i, mount] of cgroupMounts(await readFile("/proc/self/mountinfo", "ascii")).entries()) {
    await protectedDirectory(mount.path); const handle = await directory(mount.path);
    try {
      if (mount.path.endsWith("/memory") && await control(handle, "memory.use_hierarchy") !== "1\n") return fail();
      const cpuset = mount.path.endsWith("/cpuset");
      roots[`h${i}`] = { ...mount, ...await inodeIdentity(handle), cpus: cpuset ? cpusetRange(await control(handle, "cpuset.cpus")).trimEnd() : "",
        mems: cpuset ? cpusetRange(await control(handle, "cpuset.mems")).trimEnd() : "" };
    } finally { await handle.close(); }
  }
  return roots;
}
export async function prepareHostCgroup(root: CgroupRoot, parent: string): Promise<CgroupAllocation> {
  const name = parentName(parent), top = await openRoot(root); let group: FileHandle | undefined, docker: FileHandle | undefined, work: FileHandle | undefined;
  try {
    await mkdir(`${fd(top)}/${name}`, { mode: 0o755 }); group = await directory(`${fd(top)}/${name}`); await empty(group, []);
    if (root.path.endsWith("/memory")) {
      if (await control(group, "memory.use_hierarchy") !== "1\n" || await control(group, "memory.failcnt") !== "0\n" || await control(group, "memory.memsw.failcnt") !== "0\n") return fail();
      await control(group, "memory.limit_in_bytes", "1610612736\n"); await control(group, "memory.memsw.limit_in_bytes", "1610612736\n");
    }
    if (root.path.endsWith("/cpu,cpuacct")) {
      if (await control(group, "cpuacct.usage") !== "0\n") return fail();
      await control(group, "cpu.cfs_period_us", "100000\n"); await control(group, "cpu.cfs_quota_us", "75000\n");
    }
    if (root.path.endsWith("/pids")) await control(group, "pids.max", "64\n");
    if (root.cpus) { await control(group, "cpuset.cpus", cpusetRange(`${root.cpus}\n`)); await control(group, "cpuset.mems", cpusetRange(`${root.mems}\n`)); }
    await mkdir(`${fd(group)}/docker`, { mode: 0o755 }); docker = await directory(`${fd(group)}/docker`); await empty(docker, []);
    if (root.cpus) { await control(docker, "cpuset.cpus", `${root.cpus}\n`); await control(docker, "cpuset.mems", `${root.mems}\n`); }
    if (jobs(root)) { await mkdir(`${fd(group)}/jobs`, { mode: 0o755 }); work = await directory(`${fd(group)}/jobs`); await empty(work, []); }
    return { root, parent: await inodeIdentity(group), docker: await inodeIdentity(docker), jobs: work ? await inodeIdentity(work) : null };
  } finally { await work?.close(); await docker?.close(); await group?.close(); await top.close(); }
}
async function budget(group: FileHandle, root: CgroupRoot) {
  const values = root.path.endsWith("/memory") ? { "memory.limit_in_bytes": "1610612736\n", "memory.memsw.limit_in_bytes": "1610612736\n", "memory.use_hierarchy": "1\n",
    "memory.failcnt": "0\n", "memory.memsw.failcnt": "0\n", "memory.oom_control": "oom_kill_disable 0\nunder_oom 0\noom_kill 0\n" }
    : root.path.endsWith("/cpu,cpuacct") ? { "cpu.cfs_period_us": "100000\n", "cpu.cfs_quota_us": "75000\n", "cpuacct.usage": "0\n" }
      : root.path.endsWith("/pids") ? { "pids.max": "64\n", "pids.events": "max 0\n" }
        : root.cpus ? { "cpuset.cpus": `${root.cpus}\n`, "cpuset.mems": `${root.mems}\n` } : {};
  for (const [key, value] of Object.entries(values)) if (await control(group, key) !== value) return fail();
}
export async function verifyHostCgroup(allocation: CgroupAllocation, parent: string) {
  const top = await openRoot(allocation.root); let group: FileHandle | undefined;
  try {
    group = await directory(`${fd(top)}/${parentName(parent)}`, allocation.parent); await empty(group, jobs(allocation.root) ? ["docker", "jobs"] : ["docker"]);
    await budget(group, allocation.root);
    for (const [name, identity] of [["docker", allocation.docker], ["jobs", allocation.jobs]] as const) if (identity) {
      const child = await directory(`${fd(group)}/${name}`, identity); try { await empty(child, []); } finally { await child.close(); }
    }
  } finally { await group?.close(); await top.close(); }
}
// No recursion, task migration, counter reset or guessed PID killing. Only a recorded empty Isolate child can be reclaimed.
export async function removeHostCgroup(allocation: CgroupAllocation, parent: string, phaseChild: InodeIdentity | null) {
  const top = await openRoot(allocation.root), name = parentName(parent); let group: FileHandle | undefined;
  try {
    try { group = await directory(`${fd(top)}/${name}`, allocation.parent); } catch (error) { if (!absent(error)) throw error; return; }
    const children = (await readdir(fd(group), { withFileTypes: true })).filter(row => row.isDirectory()).map(row => row.name);
    if (children.some(child => !["docker", ...(jobs(allocation.root) ? ["jobs"] : [])].includes(child))) return fail();
    await empty(group, children);
    for (const [childName, identity] of [["docker", allocation.docker], ["jobs", allocation.jobs]] as const) if (identity) {
      let child: FileHandle;
      try { child = await directory(`${fd(group)}/${childName}`, identity); } catch (error) { if (!absent(error)) throw error; continue; }
      try {
        if (childName === "jobs") {
          const descendants = (await readdir(fd(child), { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name);
          if (descendants.length > 1 || descendants.some(name => name !== "box-0") || descendants.length && phaseChild === null) return fail();
          await empty(child, descendants);
          if (descendants.length) {
            const box = await directory(`${fd(child)}/box-0`, phaseChild!);
            try { await empty(box, []); await originalName(`${fd(child)}/box-0`, box); await rmdir(`${fd(child)}/box-0`); } finally { await box.close(); }
          }
        }
        await empty(child, []); await originalName(`${fd(group)}/${childName}`, child); await rmdir(`${fd(group)}/${childName}`);
      } finally { await child.close(); }
    }
    await empty(group, []); await originalName(`${fd(top)}/${name}`, group); await rmdir(`${fd(top)}/${name}`);
  } finally { await group?.close(); await top.close(); }
}
async function originalName(path: string, handle: FileHandle) {
  const current = await lstat(path, { bigint: true }), expected = await inodeIdentity(handle);
  if (!current.isDirectory() || current.isSymbolicLink() || current.dev.toString() !== expected.device || current.ino.toString() !== expected.inode) return fail();
}
