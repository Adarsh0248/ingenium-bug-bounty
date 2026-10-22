import { constants } from "node:fs";
import { lstat, open, readdir, realpath, statfs } from "node:fs/promises";
import type { FileHandle } from "node:fs/promises";
import { dirname } from "node:path";
import { sha256 } from "../access/credentials.js";
import { reviewedExecutionPlan } from "./execution-plan.js";
import type { ExecutionPlan } from "./execution-plan.js";

const WORKSPACE = "/run/ingenium/workspace", CONTROL = "/run/ingenium/control";
const bad = (): never => { throw new Error("Private workspace unavailable or changed; retain the execution reservation."); };
const fd = (file: FileHandle) => `/proc/self/fd/${file.fd}`;
async function bytes(file: FileHandle, limit: number) {
  const data = Buffer.alloc(limit + 1); let length = 0;
  while (length <= limit) {
    const { bytesRead } = await file.read(data, length, data.length - length, length);
    if (!bytesRead) return data.subarray(0, length);
    length += bytesRead;
  }
  return bad();
}
async function proc(path: string, limit: number) {
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try { return (await bytes(file, limit)).toString("ascii"); } finally { await file.close(); }
}
async function mount(file: FileHandle, path: string, size: number, inodes: number, executable: boolean) {
  const id = /^mnt_id:\s+([1-9][0-9]*)$/m.exec(await proc(`/proc/self/fdinfo/${file.fd}`, 4096))?.[1];
  if (!id) return bad();
  const rows = (await proc("/proc/self/mountinfo", 1048576)).trimEnd().split("\n").filter(row => row.startsWith(`${id} `));
  if (rows.length !== 1) return bad();
  const parts = rows[0]!.split(" - "); if (parts.length !== 2) return bad();
  const left = parts[0]!.split(" "), right = parts[1]!.split(" ");
  const flags = new Set(left[5]?.split(",")), fs = await statfs(fd(file));
  if (left[3] !== "/" || left[4] !== path || right[0] !== "tmpfs" || fs.type !== 0x01021994
    || !flags.has("rw") || !flags.has("nosuid") || !flags.has("nodev") || flags.has("noexec") === executable
    || fs.bsize * fs.blocks !== size || fs.files !== inodes) return bad();
  return id;
}
async function directory(path: string) {
  if (await realpath(path) !== path) return bad();
  const handle = await open(path, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
  try {
    const info = await handle.stat();
    const mode = path === WORKSPACE ? 0o755 : 0o700;
    if (info.uid !== 0 || info.gid !== 0 || (info.mode & 0o7777) !== mode || !info.isDirectory()) return bad();
    return handle;
  } catch (error) { await handle.close(); throw error; }
}
async function put(folder: FileHandle, name: string, data: Buffer) {
  const file = await open(`${fd(folder)}/${name}`, constants.O_RDWR | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
  try { await file.writeFile(data); await file.chmod(0o400); await file.sync(); } finally { await file.close(); }
}

// Only in a newly verified private execution container with no active sandbox; this does not authorise a launch.
export async function prepareExecutionWorkspace(plan: ExecutionPlan, signal: AbortSignal) {
  signal.throwIfAborted();
  if (process.platform !== "linux" || process.getuid?.() !== 0) return bad();
  const safe = reviewedExecutionPlan(plan);
  for (let path = dirname(WORKSPACE); ; path = dirname(path)) {
    const info = await lstat(path);
    if (!info.isDirectory() || info.isSymbolicLink() || info.uid !== 0 || info.mode & 0o022) return bad();
    if (path === "/") break;
  }
  const control = await directory(CONTROL); let workspace: FileHandle | undefined, source: FileHandle | undefined, closed = false;
  try {
    workspace = await directory(WORKSPACE);
    const workspaceInfo = await workspace.stat(), controlInfo = await control.stat();
    const workspaceMount = await mount(workspace, WORKSPACE, safe.restrictions.workspaceBytes, safe.restrictions.workspaceInodes, true);
    const controlMount = await mount(control, CONTROL, 16777216, 256, false);
    if (workspaceMount === controlMount || workspaceInfo.dev === controlInfo.dev
      || (await readdir(fd(workspace))).length || (await readdir(fd(control))).length) return bad();
    const free = await statfs(fd(workspace));
    if (free.bavail * free.bsize !== safe.restrictions.workspaceBytes || free.ffree !== safe.restrictions.workspaceInodes - 1) return bad();
    signal.throwIfAborted();
    const binding = Buffer.from(JSON.stringify({ version: 1, plan_sha256: sha256(JSON.stringify({ ...safe,
      source: sha256(safe.source).toString("hex"), stdin: sha256(safe.stdin).toString("hex") })).toString("hex"),
      workspace: { dev: workspaceInfo.dev, ino: workspaceInfo.ino, mount: workspaceMount },
      control: { dev: controlInfo.dev, ino: controlInfo.ino, mount: controlMount } }));
    // An interrupted preparation is deliberately not reusable, even if no source was written yet.
    await put(control, "preparing.json", binding);
    source = await open(`${fd(workspace)}/${safe.sourceFile}`, constants.O_RDWR | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    await source.writeFile(safe.source); await source.chmod(0o444); await source.sync();
    const sourceInfo = await source.stat();
    await workspace.chmod(0o700); await workspace.chown(60000, 60000);
    await workspace.sync(); signal.throwIfAborted();
    await put(control, "ready.json", binding); await control.sync();
    const pinnedWorkspace = workspace, pinnedSource = source;
    async function verifyBeforeFirstPhase() {
      if (closed) return bad();
      signal.throwIfAborted();
      for (const [path, file, original, uid, mode] of [[WORKSPACE, pinnedWorkspace, workspaceInfo, 60000, 0o700], [CONTROL, control, controlInfo, 0, 0o700]] as const) {
        const current = await lstat(path), pinned = await file.stat();
        if (current.isSymbolicLink() || current.dev !== original.dev || current.ino !== original.ino || pinned.dev !== original.dev || pinned.ino !== original.ino
          || current.uid !== uid || current.gid !== uid || (current.mode & 0o7777) !== mode) return bad();
      }
      if (await mount(pinnedWorkspace, WORKSPACE, safe.restrictions.workspaceBytes, safe.restrictions.workspaceInodes, true) !== workspaceMount
        || await mount(control, CONTROL, 16777216, 256, false) !== controlMount) return bad();
      const names = await readdir(fd(pinnedWorkspace));
      if (names.length !== 1 || names[0] !== safe.sourceFile) return bad();
      const pathInfo = await lstat(`${fd(pinnedWorkspace)}/${safe.sourceFile}`), info = await pinnedSource.stat();
      if (!info.isFile() || info.uid !== 0 || info.gid !== 0 || info.nlink !== 1 || (info.mode & 0o7777) !== 0o444 || info.size !== safe.source.length
        || pathInfo.isSymbolicLink() || pathInfo.dev !== sourceInfo.dev || pathInfo.ino !== sourceInfo.ino || info.dev !== sourceInfo.dev || info.ino !== sourceInfo.ino
        || !(await bytes(pinnedSource, 131072)).equals(safe.source)) return bad();
      for (const name of ["preparing.json", "ready.json"]) {
        const file = await open(`${fd(control)}/${name}`, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
        try {
          const info = await file.stat();
          if (!info.isFile() || info.uid !== 0 || info.gid !== 0 || (info.mode & 0o7777) !== 0o400 || info.nlink !== 1 || info.size !== binding.length
            || !(await bytes(file, 4096)).equals(binding)) return bad();
        } finally { await file.close(); }
      }
    }
    await verifyBeforeFirstPhase();
    return { sourceSha256: sha256(safe.source).toString("hex"), sourceBytes: safe.source.length, verifyBeforeFirstPhase,
      async close() { if (!closed) { closed = true; await pinnedSource.close(); await pinnedWorkspace.close(); await control.close(); } } };
  } catch (error) { await source?.close(); await workspace?.close(); await control.close(); throw error; }
}
