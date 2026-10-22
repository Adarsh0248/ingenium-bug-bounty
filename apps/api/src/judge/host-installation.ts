import { createHash } from "node:crypto";
import { constants } from "node:fs";
import type { BigIntStats } from "node:fs";
import { lstat, open, opendir, realpath, statfs } from "node:fs/promises";
import type { FileHandle } from "node:fs/promises";
import { sha256 } from "../access/credentials.js";
import { createDockerCapsuleDriver, localDockerCommand } from "./docker-capsule.js";
import type { DockerCommand } from "./docker-capsule.js";
import type { CapsuleReference, CapsuleRelease } from "./capsule-lifecycle.js";
import { verifyDockerReports } from "./docker-host.js";
import type { DockerReportPins } from "./docker-host.js";
import { ISOLATE_CONFIGURATION, protectedDirectory } from "./isolate-context.js";

export const HOST_INSTALLATION = "/opt/ingenium/judge-executor";
export interface HostReleaseManifest extends DockerReportPins {
  version: 3; image_id: string;
  files: readonly { path: string; size: number; mode: 0o444 | 0o555; sha256: string }[];
}
const executableNames = ["docker", "dockerd", "peer-exec"] as const;
type ExecutableName = typeof executableNames[number];
const required = ["app/judge/capsule-cli.js", "docker", "docker-client/config.json", "dockerd", "launch", "node", "peer-exec", "security/apparmor", "security/isolate", "security/seccomp.json"];
const fail = (): never => { throw new Error("Protected release installation changed or incomplete; judging remains unavailable."); };
const fd = (file: FileHandle) => `/proc/self/fd/${file.fd}`;
const stamp = (info: BigIntStats) => [info.dev, info.ino, info.size, info.mode, info.uid, info.gid, info.nlink, info.mtimeNs, info.ctimeNs].join(":");
function object(value: unknown, keys: string[]) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))) return fail();
  return value as Record<string, unknown>;
}
// The release digest comes from trusted host configuration, never the request being judged.
export function reviewedHostRelease(value: unknown, release: CapsuleRelease): HostReleaseManifest {
  const row = object(value, ["version", "image_id", "daemon_sha256", "image_config_sha256", "files"]);
  if (row.version !== 3 || row.image_id !== release.imageId || !/^sha256:[0-9a-f]{64}$/.test(release.imageId)
    || [row.daemon_sha256, row.image_config_sha256].some(value => typeof value !== "string" || !/^[0-9a-f]{64}$/.test(value))
    || !/^[0-9a-f]{64}$/.test(release.digest) || !Array.isArray(row.files) || row.files.length < required.length || row.files.length > 32768) return fail();
  let previous = "", bytes = 0;
  const files = row.files.map(value => {
    const file = object(value, ["path", "size", "mode", "sha256"]);
    if (typeof file.path !== "string" || file.path.length > 512 || !/^[A-Za-z0-9_@+-][A-Za-z0-9_@+./-]*$/.test(file.path)
      || file.path.split("/").some(part => !part || part === "." || part === "..") || file.path <= previous
      || !Number.isSafeInteger(file.size) || (file.size as number) < 0 || (file.size as number) > 268435456
      || ![0o444, 0o555].includes(file.mode as number) || typeof file.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(file.sha256)) return fail();
    if (file.path.startsWith("docker-client/") && file.path !== "docker-client/config.json") return fail();
    previous = file.path; bytes += file.size as number; if (bytes > 536870912) return fail();
    return Object.freeze({ path: file.path, size: file.size as number, mode: file.mode as 0o444 | 0o555, sha256: file.sha256 });
  });
  for (const path of required) {
    const file = files.find(file => file.path === path);
    if (!file || file.size < 1 || file.mode !== ([...executableNames, "launch", "node"].includes(path) ? 0o555 : 0o444)) return fail();
  }
  const names = new Set(files.map(file => file.path)), directories = new Set([""]);
  for (const file of files) {
    const parts = file.path.split("/"); parts.pop();
    while (parts.length) {
      const parent = parts.join("/"); if (names.has(parent)) return fail();
      directories.add(parent); if (directories.size > 32768) return fail(); parts.pop();
    }
  }
  const manifest: HostReleaseManifest = { version: 3, image_id: release.imageId, daemon_sha256: row.daemon_sha256 as string,
    image_config_sha256: row.image_config_sha256 as string, files: Object.freeze(files) };
  // This format contains an ordered array; judgeJson deliberately does not accept arrays.
  if (sha256(JSON.stringify(manifest)).toString("hex") !== release.digest) return fail();
  return Object.freeze(manifest);
}

async function socketIdentity() {
  await protectedDirectory("/run");
  if (await realpath("/var/run/docker.sock") !== "/run/docker.sock") return fail();
  const info = await lstat("/run/docker.sock", { bigint: true });
  if (!info.isSocket() || info.uid !== 0n || info.gid !== 0n || info.nlink !== 1n || (info.mode & 0o7777n) !== 0o600n) return fail();
  return stamp(info);
}

async function inspectInstallation(manifest: HostReleaseManifest, signal: AbortSignal) {
  signal.throwIfAborted();
  await protectedDirectory(HOST_INSTALLATION);
  if (![0xef53, 0x58465342].includes((await statfs(HOST_INSTALLATION)).type)) return fail();
  const directories = new Map<string, Set<string>>([["", new Set()]]);
  for (const file of manifest.files) {
    let parent = "";
    for (const part of file.path.split("/")) {
      if (!directories.has(parent)) { if (directories.size >= 32768) return fail(); directories.set(parent, new Set()); }
      directories.get(parent)!.add(part); parent = parent ? `${parent}/${part}` : part;
    }
  }
  async function entries(file: FileHandle) {
    const names: string[] = [], directory = await opendir(fd(file));
    for await (const entry of directory) { signal.throwIfAborted(); if (names.length >= 32768) return fail(); names.push(entry.name); }
    return JSON.stringify(names.sort());
  }
  const verified = new Map<string, string>(), directoryStamps = new Map<string, string>();
  const retained = new Map<ExecutableName, FileHandle>(); let seccompSha256 = "";
  const root = await open(HOST_INSTALLATION, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
  async function directory(path: string) {
    let current = await open(`${fd(root)}/.`, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
    try {
      for (const part of path ? path.split("/") : []) {
        signal.throwIfAborted();
        const next = await open(`${fd(current)}/${part}`, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
        await current.close(); current = next;
        const info = await current.stat();
        if (info.uid !== 0 || info.gid !== 0 || (info.mode & 0o7777) !== 0o555) return fail();
      }
      return current;
    } catch (error) { await current.close(); throw error; }
  }
  try {
    for (const [path, names] of directories) {
      signal.throwIfAborted();
      const handle = await directory(path);
      try {
        const info = await handle.stat({ bigint: true }); directoryStamps.set(path, stamp(info));
        if (!info.isDirectory() || info.uid !== 0n || info.gid !== 0n || (info.mode & 0o7777n) !== 0o555n
          || await entries(handle) !== JSON.stringify([...names].sort())) return fail();
      } finally { await handle.close(); }
    }
    for (const expected of manifest.files) {
      signal.throwIfAborted();
      const split = expected.path.lastIndexOf("/"), parent = split < 0 ? "" : expected.path.slice(0, split), name = expected.path.slice(split + 1);
      const handle = await directory(parent);
      let file: FileHandle;
      try { file = await open(`${fd(handle)}/${name}`, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK); }
      finally { await handle.close(); }
      let keep = false;
      try {
        const before = await file.stat({ bigint: true });
        if (!before.isFile() || before.uid !== 0n || before.gid !== 0n || before.nlink !== 1n || (before.mode & 0o7777n) !== BigInt(expected.mode)
          || before.size !== BigInt(expected.size)) return fail();
        const policy = ["security/isolate", "security/seccomp.json", "docker-client/config.json"].includes(expected.path);
        if (policy && before.size > 1048576n) return fail();
        const hash = createHash("sha256"), chunks: Buffer[] = [], buffer = Buffer.alloc(65536); let size = 0;
        while (true) {
          signal.throwIfAborted();
          const result = await file.read(buffer, 0, buffer.length, size); if (!result.bytesRead) break;
          size += result.bytesRead; if (size > expected.size) return fail();
          hash.update(buffer.subarray(0, result.bytesRead)); if (policy) chunks.push(Buffer.from(buffer.subarray(0, result.bytesRead)));
        }
        if (size !== expected.size || hash.digest("hex") !== expected.sha256 || stamp(before) !== stamp(await file.stat({ bigint: true }))) return fail();
        verified.set(expected.path, stamp(before));
        const bytes = Buffer.concat(chunks);
        if (expected.path === "security/isolate" && !bytes.equals(Buffer.from(ISOLATE_CONFIGURATION))
          || expected.path === "docker-client/config.json" && !bytes.equals(Buffer.from("{}\n"))) return fail();
        if (expected.path === "security/seccomp.json") {
          const parsed: unknown = JSON.parse(bytes.toString("utf8"));
          if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return fail();
          seccompSha256 = sha256(JSON.stringify(parsed)).toString("hex");
        }
        if ([...executableNames, "node"].includes(expected.path)) {
          const header = Buffer.alloc(4); await file.read(header, 0, 4, 0);
          if (!header.equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46]))) return fail();
        }
        if ((executableNames as readonly string[]).includes(expected.path)) { retained.set(expected.path as ExecutableName, file); keep = true; }
      } finally { if (!keep) await file.close(); }
    }
    for (const [path, original] of directoryStamps) {
      signal.throwIfAborted();
      const handle = await directory(path);
      try {
        const current = await lstat(path ? `${HOST_INSTALLATION}/${path}` : HOST_INSTALLATION, { bigint: true });
        if (stamp(current) !== original || stamp(current) !== stamp(await handle.stat({ bigint: true }))
          || await entries(handle) !== JSON.stringify([...directories.get(path)!].sort())) return fail();
      } finally { await handle.close(); }
    }
    for (const [path, original] of verified) {
      signal.throwIfAborted(); if (original !== stamp(await lstat(`${HOST_INSTALLATION}/${path}`, { bigint: true }))) return fail();
    }
    if (retained.size !== executableNames.length || !seccompSha256) return fail();
    return { executables: retained, seccompSha256 };
  } catch (error) { for (const file of retained.values()) await file.close(); throw error; }
  finally { await root.close(); }
}

// The peer wrapper adds kernel listener checks, not loaded-policy/initial-host visibility or drain certification.
export async function openHostInstallation(value: unknown, release: CapsuleRelease, signal: AbortSignal) {
  const manifest = reviewedHostRelease(value, release), pinned = { imageId: release.imageId, digest: release.digest };
  signal.throwIfAborted(); if (process.platform !== "linux" || process.getuid?.() !== 0) return fail();
  const socket = await socketIdentity(), installed = await inspectInstallation(manifest, signal);
  const closeFiles = async (files: Map<ExecutableName, FileHandle>) => { for (const file of files.values()) await file.close(); };
  const stamps = async (files: Map<ExecutableName, FileHandle>) => {
    const values: string[] = []; for (const name of executableNames) values.push(stamp(await files.get(name)!.stat({ bigint: true })));
    return values.join("|");
  };
  let closed = false, active = 0;
  let original: string, command: DockerCommand;
  try {
    signal.throwIfAborted(); if (socket !== await socketIdentity()) return fail();
    original = await stamps(installed.executables);
    command = localDockerCommand(installed.executables.get("docker")!.fd, installed.executables.get("dockerd")!.fd, installed.executables.get("peer-exec")!.fd);
    await verifyDockerReports(command, pinned.imageId, manifest, signal);
    signal.throwIfAborted(); if (socket !== await socketIdentity() || original !== await stamps(installed.executables)) return fail();
  } catch (error) { await closeFiles(installed.executables); throw error; }
  async function bound(signal: AbortSignal) {
    signal.throwIfAborted();
    if (closed || socket !== await socketIdentity() || original !== await stamps(installed.executables)) return fail();
  }
  async function verify(signal: AbortSignal) {
    active++;
    try {
      await bound(signal); const current = await inspectInstallation(manifest, signal);
      try { if (original !== await stamps(current.executables) || current.seccompSha256 !== installed.seccompSha256) return fail(); }
      finally { await closeFiles(current.executables); }
      await verifyDockerReports(command, pinned.imageId, manifest, signal);
      await bound(signal);
    } finally { active--; }
  }
  const checkedCommand: DockerCommand = async (args, input, signal) => {
    active++;
    try {
      await bound(signal); await verifyDockerReports(command, pinned.imageId, manifest, signal); await bound(signal);
      const output = await command(args, input, signal);
      await verifyDockerReports(command, pinned.imageId, manifest, signal); await bound(signal); return output;
    }
    finally { active--; }
  };
  return {
    verify,
    driver(prepared: (reference: CapsuleReference, signal: AbortSignal) => Promise<void>) {
      return createDockerCapsuleDriver(checkedCommand, installed.seccompSha256, async (ref, signal) => {
        if (ref.intent.image_id !== pinned.imageId || ref.intent.release_sha256 !== pinned.digest) return fail();
        // Report pins do not replace actual peer/image/MAC/cgroup verification and genuine host readiness.
        await verify(signal); await prepared(ref, signal); await verify(signal);
      });
    },
    async close() {
      if (active) return fail();
      if (!closed) { closed = true; await closeFiles(installed.executables); }
    },
  };
}
