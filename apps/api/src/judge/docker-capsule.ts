import { sha256 } from "../access/credentials.js";
import { JUDGE_BODY_LIMIT } from "../content/judge-protocol.js";
import { exchangeProtectedProcess } from "./executor.js";
import type { CapsuleDriver, CapsuleReference, CapsuleState } from "./capsule-lifecycle.js";

const fail = (): never => { throw new Error("Original Docker capsule cannot be verified; retain its reservation."); };
export type DockerCommand = (args: readonly string[], input: Buffer, signal: AbortSignal) => Promise<Buffer>;
export const CAPSULE_CAPABILITIES = ["CHOWN", "DAC_OVERRIDE", "KILL", "SETGID", "SETUID", "SYS_CHROOT", "SYS_PTRACE", "SYS_ADMIN"] as const;
export const CAPSULE_APPARMOR = "ingenium-isolate-executor-v1";
export const CAPSULE_ENTRY = "/opt/ingenium/judge-executor/app/judge/capsule-cli.js";
export const CAPSULE_SECCOMP = "/opt/ingenium/judge-executor/security/seccomp.json";
const root = "/var/lib/ingenium/judge-executor";
export function capsuleMounts(ref: CapsuleReference) {
  const working = `${root}/capsules/${ref.intent.nonce}`;
  return [
    { source: `${working}/capsule.json`, target: "/opt/ingenium/judge-executor/capsule.json", readonly: true },
    { source: "/opt/ingenium/judge-executor/security/isolate", target: "/usr/local/etc/isolate", readonly: true },
    { source: `${root}/checkpoints`, target: `${root}/checkpoints`, readonly: false },
    ...[["memory", "memory"], ["cpu,cpuacct", "cpuacct"], ["pids", "pids"]].map(([host, guest]) =>
      ({ source: `/sys/fs/cgroup/${host}${ref.parent}`, target: `/run/ingenium/parent/${guest}`, readonly: true })),
    ...[["memory", "memory"], ["cpu,cpuacct", "cpuacct"]].map(([host, guest]) =>
      ({ source: `/sys/fs/cgroup/${host}${ref.parent}/jobs`, target: `/run/ingenium/cgroups/${guest}`, readonly: false })),
  ];
}
export const CAPSULE_TMPFS = {
  "/run/ingenium/workspace": "rw,nosuid,nodev,exec,size=64m,nr_inodes=4096,mode=0755",
  "/run/ingenium/control": "rw,nosuid,nodev,noexec,size=16m,nr_inodes=256,mode=0700",
  "/var/local/lib/isolate": "rw,nosuid,nodev,exec,size=16m,nr_inodes=256,mode=0755",
  "/tmp": "rw,nosuid,nodev,noexec,size=16m,nr_inodes=256,mode=0700",
} as const;
export function capsuleCreateArguments(ref: CapsuleReference) {
  // Docker parses --mount as CSV; combined controller names contain commas.
  return ["create", "--pull=never", "--name", ref.name, ...Object.entries(ref.labels).flatMap(([key, value]) => ["--label", `${key}=${value}`]),
    "--restart", "no", "--network", "none", "--read-only", "--user", "0:0", "--cap-drop", "ALL",
    ...CAPSULE_CAPABILITIES.flatMap(capability => ["--cap-add", capability]), "--security-opt", "no-new-privileges=true",
    "--security-opt", `apparmor=${CAPSULE_APPARMOR}`, "--security-opt", `seccomp=${CAPSULE_SECCOMP}`, "--cgroupns", "host", "--cgroup-parent", `${ref.parent}/docker`,
    "--memory", "1536m", "--memory-swap", "1536m", "--cpu-period", "100000", "--cpu-quota", "75000", "--pids-limit", "128",
    "--ulimit", "nofile=1024:1024", "--ulimit", "core=0:0", "--ipc", "private", "--init=false", "--no-healthcheck", "--stop-timeout", "2", "--log-driver", "none",
    "--interactive", "--attach", "stdin", "--attach", "stdout", "--attach", "stderr",
    ...Object.entries(CAPSULE_TMPFS).flatMap(([path, options]) => ["--tmpfs", `${path}:${options}`]),
    ...capsuleMounts(ref).flatMap(mount => ["--mount", `type=bind,"src=${mount.source}",dst=${mount.target}${mount.readonly ? ",readonly" : ""}`]),
    "--entrypoint", "/usr/local/bin/node", ref.intent.image_id, CAPSULE_ENTRY];
}
function same(a: unknown, b: unknown) { if (JSON.stringify(a) !== JSON.stringify(b)) return fail(); }
function set(a: unknown, expected: readonly string[]) {
  if (!Array.isArray(a) || a.some(value => typeof value !== "string") || new Set(a).size !== expected.length) return fail();
  same([...a].sort(), [...expected].sort());
}
export function inspectDockerCapsule(raw: Buffer, ref: CapsuleReference, seccompSha256: string): CapsuleState {
  if (raw.length > JUDGE_BODY_LIMIT || !/^[0-9a-f]{64}$/.test(seccompSha256)) return fail();
  const value = JSON.parse(raw.toString("utf8")); if (!Array.isArray(value) || value.length !== 1) return fail();
  const row = value[0], config = row?.Config, host = row?.HostConfig, state = row?.State;
  if (!/^[0-9a-f]{64}$/.test(row?.Id ?? "") || row.Name !== `/${ref.name}` || row.Image !== ref.intent.image_id || config?.Image !== ref.intent.image_id
    || config.User !== "0:0" || config.Tty !== false || config.OpenStdin !== true || config.StdinOnce !== true || config.AttachStdin !== true
    || config.AttachStdout !== true || config.AttachStderr !== true || host?.Privileged !== false || host.ReadonlyRootfs !== true
    || host.NetworkMode !== "none" || host.CgroupnsMode !== "host" || host.CgroupParent !== `${ref.parent}/docker` || host.PidMode !== ""
    || host.IpcMode !== "private" || host.UsernsMode !== "" || host.AutoRemove !== false || host.PublishAllPorts !== false
    || host.Memory !== 1610612736 || host.MemorySwap !== 1610612736 || host.CpuPeriod !== 100000 || host.CpuQuota !== 75000 || host.PidsLimit !== 128
    || host.Init !== false || host.LogConfig?.Type !== "none" || row.RestartCount !== 0 || state?.Restarting !== false || state.Dead !== false
    || !["created", "running", "exited"].includes(state.Status) || typeof state.Running !== "boolean" || !Number.isSafeInteger(state.Pid) || state.Pid < 0
    || state.Running !== (state.Status === "running") || state.Running !== (state.Pid > 0) || state.Paused !== false) return fail();
  same(config.Entrypoint, ["/usr/local/bin/node"]); same(config.Cmd, [CAPSULE_ENTRY]); same(config.Healthcheck?.Test, ["NONE"]);
  same(Object.keys(config.Labels ?? {}).sort(), Object.keys(ref.labels).sort());
  for (const [key, value] of Object.entries(ref.labels)) if (config.Labels[key] !== value) return fail();
  if (host.RestartPolicy?.Name !== "no" || host.RestartPolicy.MaximumRetryCount !== 0) return fail();
  set(host.CapAdd?.map((value: string) => value.replace(/^CAP_/, "")), CAPSULE_CAPABILITIES); set(host.CapDrop, ["ALL"]);
  const limits = [...(host.Ulimits ?? [])].sort((a, b) => a.Name.localeCompare(b.Name));
  same(limits.map(value => [value.Name, value.Soft, value.Hard]), [["core", 0, 0], ["nofile", 1024, 1024]]);
  for (const values of [host.Binds, host.VolumesFrom, host.Devices, host.DeviceRequests, host.Links]) if (values !== null && (!Array.isArray(values) || values.length !== 0)) return fail();
  if (host.PortBindings !== null && Object.keys(host.PortBindings).length !== 0 || Object.keys(row.NetworkSettings?.Ports ?? {}).length !== 0) return fail();
  same(Object.keys(host.Tmpfs ?? {}).sort(), Object.keys(CAPSULE_TMPFS).sort());
  for (const [path, options] of Object.entries(CAPSULE_TMPFS)) set(host.Tmpfs[path].split(","), options.split(","));
  if (!Array.isArray(host.SecurityOpt) || host.SecurityOpt.length !== 3) return fail();
  const security = host.SecurityOpt as string[];
  if (!security.includes("no-new-privileges=true") && !security.includes("no-new-privileges") || !security.includes(`apparmor=${CAPSULE_APPARMOR}`)) return fail();
  const seccomp = security.find(value => value.startsWith("seccomp="));
  if (!seccomp || sha256(JSON.stringify(JSON.parse(seccomp.slice(8)))).toString("hex") !== seccompSha256) return fail();
  const expected = capsuleMounts(ref), mounts = row.Mounts;
  if (!Array.isArray(mounts) || mounts.length !== expected.length) return fail();
  for (const mount of expected) {
    const found = mounts.filter(value => value.Destination === mount.target);
    if (found.length !== 1 || found[0].Type !== "bind" || found[0].Source !== mount.source || found[0].RW !== !mount.readonly || found[0].Propagation !== "rprivate") return fail();
  }
  if (typeof state.StartedAt !== "string" || !Number.isFinite(Date.parse(state.StartedAt))) return fail();
  const starts = state.StartedAt === "0001-01-01T00:00:00Z" ? 0 : 1;
  if (state.Status === "created" && starts !== 0 || state.Status !== "created" && starts !== 1) return fail();
  return { id: row.Id, status: state.Status, running: state.Running, pid: state.Pid, starts };
}

// The caller pins all three executable descriptors; the native wrapper fixes the endpoint/config and watches its kernel peer.
export function localDockerCommand(fileDescriptor: number, daemonDescriptor: number, peerDescriptor: number): DockerCommand {
  const descriptors = [peerDescriptor, fileDescriptor, daemonDescriptor];
  if (process.platform !== "linux" || process.getuid?.() !== 0 || descriptors.some(fd => !Number.isSafeInteger(fd) || fd < 3) || new Set(descriptors).size !== 3) return fail();
  return (args, input, signal) => exchangeProtectedProcess({ file: "/proc/self/fd/3", inheritedFds: descriptors, args }, input, signal);
}
export async function assertDockerCapsuleAbsent(command: DockerCommand, ref: CapsuleReference, id: string, signal: AbortSignal) {
  if (!/^[0-9a-f]{64}$/.test(id)) return fail();
  // Check ID separately from name: renaming must never turn a retained original into apparent absence.
  for (const filter of [`id=${id}`, `name=^/${ref.name}$`]) {
    signal.throwIfAborted();
    if ((await command(["container", "ls", "--all", "--no-trunc", "--filter", filter, "--format", "{{.ID}}"], Buffer.alloc(0), signal)).length !== 0) return fail();
  }
}
// Preparations are an internal host authority, not a readiness flag: it must verify immutable config/image/security and owned real cgroup-v1 parents.
export function createDockerCapsuleDriver(command: DockerCommand, seccompSha256: string,
  prepared: (reference: CapsuleReference, signal: AbortSignal) => Promise<void>): CapsuleDriver {
  const call = (args: readonly string[], signal: AbortSignal, input: Buffer = Buffer.alloc(0)) => command(args, input, signal);
  const identity = (value: Buffer) => { const id = value.toString("ascii"); return /^[0-9a-f]{64}\n$/.test(id) ? id.slice(0, -1) : fail(); };
  async function inspect(ref: CapsuleReference, id: string, signal: AbortSignal) {
    if (!/^[0-9a-f]{64}$/.test(id)) return fail();
    const state = inspectDockerCapsule(await call(["inspect", "--type", "container", id], signal), ref, seccompSha256);
    if (state.id !== id) return fail(); return state;
  }
  return {
    async create(ref, signal) { await prepared(ref, signal); signal.throwIfAborted(); return identity(await call(capsuleCreateArguments(ref), signal)); },
    inspect,
    async find(ref, signal) {
      const output = await call(["container", "ls", "--all", "--no-trunc", "--filter", `name=^/${ref.name}$`, "--format", "{{.ID}}"], signal);
      return output.length === 0 ? null : inspect(ref, identity(output), signal);
    },
    async start(ref, id, input, signal) {
      await prepared(ref, signal); const state = await inspect(ref, id, signal); if (state.status !== "created") return fail();
      // The durable result is read from the checkpoint; stdout loss is never a reason to attach the source again.
      await call(["start", "--attach", "--interactive", id], signal, input);
    },
    async stop(ref, id, signal) { await inspect(ref, id, signal); if (identity(await call(["stop", "--timeout", "2", id], signal)) !== id) return fail(); },
    async remove(ref, id, signal) { const state = await inspect(ref, id, signal); if (state.running || state.pid !== 0) return fail(); if (identity(await call(["rm", id], signal)) !== id) return fail(); },
    assertAbsent: (ref, id, signal) => assertDockerCapsuleAbsent(command, ref, id, signal),
  };
}
