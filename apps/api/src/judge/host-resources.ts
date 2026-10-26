import { readFile } from "node:fs/promises";
import { sha256, uuid } from "../access/credentials.js";
import { judgeJson, runtimeRecord } from "../content/judge-protocol.js";
import type { ExecutionCheckpoints } from "./checkpoints.js";
import { capsuleReference } from "./capsule-lifecycle.js";
import type { CapsuleReference, CapsuleResources } from "./capsule-lifecycle.js";
import { assertCapsuleConfigurationAbsent, capsuleConfiguration, prepareCapsuleConfiguration, removeCapsuleConfiguration, verifyCapsuleConfiguration } from "./capsule-configuration.js";
import type { ConfigurationIdentity, InodeIdentity } from "./capsule-configuration.js";
import type { ExecutionPlan } from "./execution-plan.js";
import { assertHostCgroupAbsent, inspectHostCgroups, prepareHostCgroup, removeHostCgroup, verifyHostCgroup, cpusetRange } from "./host-cgroups.js";
import type { CgroupAllocation, CgroupRoot } from "./host-cgroups.js";
import type { IsolateSettings } from "./isolate-context.js";
import { retainedPhaseGroups } from "./phase-resources.js";
import { verifyNoCapsuleReferences } from "./capsule-residue.js";
import { retainedStorage } from "./capsule-storage.js";

const fail = (): never => { throw new Error("Host resource state incomplete or changed; retain original resources and reservation."); };
const hash = (value: unknown) => sha256(judgeJson(value)).toString("hex");
function object(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))) return fail();
  return value as Record<string, unknown>;
}
function identity(value: unknown): InodeIdentity {
  const row = object(value, ["device", "inode"]);
  if ([row.device, row.inode].some(value => typeof value !== "string" || !/^(0|[1-9][0-9]{0,19})$/.test(value))) return fail();
  return row as unknown as InodeIdentity;
}
function roots(value: unknown): Record<string, CgroupRoot> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fail();
  const entries = Object.entries(value); if (entries.length < 4 || entries.length > 16) return fail();
  const found: Record<string, CgroupRoot> = {};
  for (const [key, v] of entries) {
    if (!/^h(?:[0-9]|1[0-5])$/.test(key)) return fail();
    const row = object(v, ["path", "mount_id", "device", "inode", "cpus", "mems"]);
    identity({ device: row.device, inode: row.inode });
    if (typeof row.path !== "string" || !/^\/sys\/fs\/cgroup\/[a-z_]+(?:,[a-z_]+)*$/.test(row.path)
      || typeof row.mount_id !== "string" || !/^[1-9][0-9]{0,9}$/.test(row.mount_id) || typeof row.cpus !== "string" || typeof row.mems !== "string") return fail();
    if (row.path.endsWith("/cpuset")) { cpusetRange(`${row.cpus}\n`); cpusetRange(`${row.mems}\n`); } else if (row.cpus !== "" || row.mems !== "") return fail();
    found[key] = row as unknown as CgroupRoot;
  }
  return found;
}
function allocated(value: unknown, expected: Record<string, CgroupRoot>) {
  const row = object(value, Object.keys(expected)), found: Record<string, CgroupAllocation> = {};
  for (const [key, root] of Object.entries(expected)) {
    const group = object(row[key], ["root", "parent", "docker", "jobs"]);
    if (judgeJson(group.root) !== judgeJson(root)) return fail();
    const hasJobs = ["/sys/fs/cgroup/memory", "/sys/fs/cgroup/cpu,cpuacct"].includes(root.path);
    if (hasJobs !== (group.jobs !== null)) return fail();
    found[key] = { root, parent: identity(group.parent), docker: identity(group.docker), jobs: group.jobs === null ? null : identity(group.jobs) };
  }
  return found;
}
export function createHostCapsuleResources(checkpoints: ExecutionCheckpoints, settings: IsolateSettings,
  observeReferences: typeof verifyNoCapsuleReferences = verifyNoCapsuleReferences): CapsuleResources & {
  assertRetired(plan: ExecutionPlan, reference: CapsuleReference, signal: AbortSignal): Promise<void>;
} {
  const copied: IsolateSettings = { hostEpochId: uuid(settings.hostEpochId), bootId: uuid(settings.bootId), binaries: { ...settings.binaries },
    runtimes: new Map([...settings.runtimes].map(([key, value]) => [key, { ...value }])) };
  runtimeRecord(copied.runtimes);
  if (copied.hostEpochId !== checkpoints.hostEpochId || copied.bootId !== checkpoints.bootId) return fail();
  async function state(plan: ExecutionPlan, reference: CapsuleReference, signal: AbortSignal) {
    signal.throwIfAborted();
    if (process.platform !== "linux" || process.getuid?.() !== 0 || (await readFile("/proc/sys/kernel/random/boot_id", "ascii")).trim() !== copied.bootId) return fail();
    const ref = capsuleReference(plan, reference.intent), row = await checkpoints.capsule(plan);
    if (!row || judgeJson(row.intent) !== judgeJson(ref.intent) || JSON.stringify(ref) !== JSON.stringify(reference)) return fail();
    const configuration = capsuleConfiguration(copied, plan, ref);
    return { row, ref, configuration };
  }
  function manifest(row: NonNullable<Awaited<ReturnType<ExecutionCheckpoints["capsule"]>>>, configuration: Buffer) {
    const intent = object(row.resource_intent, ["version", "boot_id", "configuration_sha256", "roots"]);
    if (intent.version !== 1 || intent.boot_id !== copied.bootId || intent.configuration_sha256 !== sha256(configuration).toString("hex")) return fail();
    const topology = roots(intent.roots), saved = object(row.resources, ["intent_sha256", "configuration", "groups"]);
    if (saved.intent_sha256 !== hash(intent)) return fail();
    const config = object(saved.configuration, ["directory", "file", "sha256"]);
    if (config.sha256 !== intent.configuration_sha256) return fail();
    const configIdentity: ConfigurationIdentity = { directory: identity(config.directory), file: identity(config.file), sha256: config.sha256 as string };
    const groups = allocated(saved.groups, topology);
    return { config: configIdentity, groups, digest: hash(saved) };
  }
  async function verify(plan: ExecutionPlan, reference: CapsuleReference, signal: AbortSignal) {
    const { row, ref, configuration } = await state(plan, reference, signal);
    if (row.resource_remove !== null || row.resource_removed !== null) return fail();
    const saved = manifest(row, configuration), current = await inspectHostCgroups(copied.bootId);
    if (judgeJson(current) !== judgeJson(Object.fromEntries(Object.entries(saved.groups).map(([key, value]) => [key, value.root])))) return fail();
    await verifyCapsuleConfiguration(ref, configuration, saved.config);
    for (const group of Object.values(saved.groups)) { signal.throwIfAborted(); await verifyHostCgroup(group, ref.parent); }
  }
  return {
    async assertRetired(plan, reference, signal) {
      const { row, ref, configuration } = await state(plan, reference, signal);
      const saved = manifest(row, configuration), physical = await checkpoints.physical(plan);
      if (!physical || physical.cgroup_parent !== ref.parent) return fail();
      const receipt = { version: 1, boot_id: copied.bootId, container_id: physical.container_id, resources_sha256: saved.digest };
      if (judgeJson(row.resource_remove) !== judgeJson(receipt) || judgeJson(row.resource_removed) !== judgeJson(receipt)) return fail();
      retainedPhaseGroups(plan, copied.bootId, physical, row); retainedStorage(plan, copied.bootId, physical, row.storage);
      if (judgeJson(await inspectHostCgroups(copied.bootId)) !== judgeJson(Object.fromEntries(Object.entries(saved.groups).map(([key, value]) => [key, value.root])))) return fail();
      for (const group of Object.values(saved.groups)) { signal.throwIfAborted(); await assertHostCgroupAbsent(group.root, ref.parent); }
      await assertCapsuleConfigurationAbsent(ref);
      await observeReferences(plan, copied.bootId, physical, row.storage, signal);
      signal.throwIfAborted();
    },
    async prepare(plan, reference, signal) {
      const { row, ref, configuration } = await state(plan, reference, signal);
      if (row.resource_intent !== null) { if (row.resources === null) return fail(); await verify(plan, ref, signal); return; }
      if (row.resources !== null || row.resource_remove !== null || row.resource_removed !== null || row.container !== null || row.start !== null) return fail();
      const topology = await inspectHostCgroups(copied.bootId);
      const intent = { version: 1, boot_id: copied.bootId, configuration_sha256: sha256(configuration).toString("hex"), roots: topology };
      await checkpoints.saveCapsule(plan, "resource_intent", intent); signal.throwIfAborted();
      const config = await prepareCapsuleConfiguration(ref, configuration), groups: Record<string, CgroupAllocation> = {};
      for (const [key, root] of Object.entries(topology)) { signal.throwIfAborted(); groups[key] = await prepareHostCgroup(root, ref.parent); }
      await checkpoints.saveCapsule(plan, "resources", { intent_sha256: hash(intent), configuration: config, groups });
      await verify(plan, ref, signal);
    },
    verify,
    async retire(plan, reference, signal) {
      const { row, ref, configuration } = await state(plan, reference, signal);
      const container = object(row.container, ["id"]);
      if (typeof container.id !== "string" || !/^[0-9a-f]{64}$/.test(container.id)) return fail();
      for (const key of ["stopped", "remove", "removed"] as const) if (object(row[key], ["id"]).id !== container.id) return fail();
      const physical = await checkpoints.physical(plan);
      if (physical !== null && (physical.container_id !== container.id || physical.cgroup_parent !== ref.parent)) return fail();
      const phase = retainedPhaseGroups(plan, copied.bootId, { container_id: container.id, cgroup_parent: ref.parent }, row);
      if (physical === null && (phase.phase !== null || row.storage !== null)) return fail();
      if (physical !== null) retainedStorage(plan, copied.bootId, physical, row.storage);
      const saved = manifest(row, configuration), receipt = { version: 1, boot_id: copied.bootId, container_id: container.id, resources_sha256: saved.digest };
      if (judgeJson(await inspectHostCgroups(copied.bootId)) !== judgeJson(Object.fromEntries(Object.entries(saved.groups).map(([key, value]) => [key, value.root])))) return fail();
      if (row.resource_remove !== null && judgeJson(row.resource_remove) !== judgeJson(receipt)
        || row.resource_removed !== null && (row.resource_remove === null || judgeJson(row.resource_removed) !== judgeJson(receipt))) return fail();
      await checkpoints.saveCapsule(plan, "resource_remove", receipt);
      for (const group of Object.values(saved.groups)) {
        signal.throwIfAborted(); const child = group.root.path.endsWith("/memory") ? phase.groups?.memory : group.root.path.endsWith("/cpu,cpuacct") ? phase.groups?.cpuacct : null;
        await removeHostCgroup(group, ref.parent, child ?? null);
      }
      signal.throwIfAborted(); await removeCapsuleConfiguration(ref, configuration, saved.config);
      if (physical !== null) await observeReferences(plan, copied.bootId, physical, row.storage, signal);
      await checkpoints.saveCapsule(plan, "resource_removed", receipt);
      // This receipt covers only owned groups/config, not namespace/image/whole-host readiness or a participant drain verdict.
    },
  };
}
