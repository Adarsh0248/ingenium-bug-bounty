import { sha256 } from "../access/credentials.js";
import { JUDGE_BODY_LIMIT } from "../content/judge-protocol.js";
import type { DockerCommand } from "./docker-capsule.js";

const fail = (): never => { throw new Error("Reviewed Docker reports unavailable or changed; judging remains unavailable."); };
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fail(); return value as Record<string, unknown>;
}
function canonical(value: unknown, depth = 0): unknown {
  if (depth > 16) return fail();
  if (value === null || typeof value === "boolean" || typeof value === "number" && Number.isSafeInteger(value)) return value;
  if (typeof value === "string") { if (!value.isWellFormed()) return fail(); return value; }
  if (Array.isArray(value)) { if (value.length > 1024) return fail(); return value.map(item => canonical(item, depth + 1)); }
  const row = object(value), keys = Object.keys(row).sort(); if (keys.length > 128) return fail();
  return Object.fromEntries(keys.map(key => [key, canonical(row[key], depth + 1)]));
}
function hash(value: unknown) { return sha256(JSON.stringify(canonical(value))).toString("hex"); }
function report(raw: Buffer) {
  if (!Buffer.isBuffer(raw) || raw.length === 0 || raw.length > JUDGE_BODY_LIMIT) return fail();
  try { return object(JSON.parse(new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(raw))); } catch { return fail(); }
}
function text(value: unknown, pattern = /^[A-Za-z0-9][A-Za-z0-9._:+-]{0,127}$/): string {
  if (typeof value !== "string" || !pattern.test(value)) return fail(); return value;
}
export interface DockerReportPins { daemon_sha256: string; image_config_sha256: string; }

// These are reported configuration digests, not daemon authentication, loaded-policy proof or a drain authority.
export function dockerDaemonDigest(raw: Buffer) {
  const row = report(raw), security = row.SecurityOptions;
  if (row.OSType !== "linux" || row.Architecture !== "x86_64" || row.CgroupVersion !== "1" || row.CgroupDriver !== "cgroupfs"
    || !["overlay2", "overlayfs"].includes(row.Driver as string) || row.DockerRootDir !== "/var/lib/docker" || row.DefaultRuntime !== "runc"
    || row.ExperimentalBuild !== false || row.LiveRestoreEnabled !== false || object(row.Swarm).LocalNodeState !== "inactive"
    || ["MemoryLimit", "SwapLimit", "CpuCfsPeriod", "CpuCfsQuota", "PidsLimit"].some(key => row[key] !== true)
    || !Array.isArray(security) || security.length < 2 || security.length > 3 || new Set(security).size !== security.length
    || security.some(value => !["name=apparmor", "name=apparmor,profile=default", "name=seccomp,profile=builtin", "name=cgroupns"].includes(value))
    || security.filter(value => value === "name=apparmor" || value === "name=apparmor,profile=default").length !== 1
    || !security.includes("name=seccomp,profile=builtin") || row.Warnings !== null && (!Array.isArray(row.Warnings) || row.Warnings.length !== 0)) return fail();
  const runtimes = object(row.Runtimes);
  if (!Object.hasOwn(runtimes, "runc") || Object.keys(runtimes).some(key => !["runc", "io.containerd.runc.v2"].includes(key))) return fail();
  for (const value of Object.values(runtimes)) object(value);
  const commits = Object.fromEntries(["ContainerdCommit", "RuncCommit", "InitCommit"].map(key => [key, text(object(row[key]).ID)]));
  return hash({ id: text(row.ID), name: text(row.Name), version: text(row.ServerVersion), kernel: text(row.KernelVersion),
    os: row.OSType, architecture: row.Architecture, cgroup_version: row.CgroupVersion, cgroup_driver: row.CgroupDriver,
    driver: row.Driver, root: row.DockerRootDir, default_runtime: row.DefaultRuntime, init_binary: text(row.InitBinary),
    security: [...security].sort(), runtimes, commits });
}

export function dockerImageConfigDigest(raw: Buffer, imageId: string) {
  const row = report(raw), config = object(row.Config), root = object(row.RootFS);
  if (!/^sha256:[0-9a-f]{64}$/.test(imageId) || row.Id !== imageId || row.Os !== "linux" || row.Architecture !== "amd64"
    || row.Variant !== undefined && row.Variant !== "" || root.Type !== "layers" || !Array.isArray(root.Layers) || root.Layers.length === 0 || root.Layers.length > 128
    || root.Layers.some(value => typeof value !== "string" || !/^sha256:[0-9a-f]{64}$/.test(value))
    || config.Volumes !== null && config.Volumes !== undefined && Object.keys(object(config.Volumes)).length !== 0) return fail();
  // Every config field is pinned, including inherited environment, entrypoint, health checks and future fields.
  return hash({ image_id: imageId, os: row.Os, architecture: row.Architecture, config, rootfs: { type: root.Type, layers: root.Layers } });
}

export async function verifyDockerReports(command: DockerCommand, imageId: string, pins: DockerReportPins, signal: AbortSignal) {
  signal.throwIfAborted();
  const expected = { daemon: pins.daemon_sha256, image: pins.image_config_sha256 };
  if (!/^sha256:[0-9a-f]{64}$/.test(imageId) || Object.values(expected).some(value => typeof value !== "string" || !/^[0-9a-f]{64}$/.test(value))) return fail();
  const info = async () => {
    signal.throwIfAborted(); const actual = dockerDaemonDigest(await command(["info", "--format", "{{json .}}"], Buffer.alloc(0), signal));
    signal.throwIfAborted(); if (actual !== expected.daemon) return fail(); return actual;
  };
  await info(); signal.throwIfAborted();
  const image = dockerImageConfigDigest(await command(["image", "inspect", "--format", "{{json .}}", imageId], Buffer.alloc(0), signal), imageId);
  signal.throwIfAborted(); if (image !== expected.image) return fail();
  await info(); signal.throwIfAborted();
}
