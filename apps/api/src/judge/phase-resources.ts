import { sha256, uuid } from "../access/credentials.js";
import { judgeJson } from "../content/judge-protocol.js";
import type { PhysicalExecutionIdentity } from "./checkpoints.js";
import { reviewedExecutionPlan } from "./execution-plan.js";
import type { ExecutionPlan } from "./execution-plan.js";
import type { InodeIdentity } from "./capsule-configuration.js";

export interface PhaseGroups { memory: InodeIdentity; cpuacct: InodeIdentity; }
const fail = (): never => { throw new Error("Original phase resources unproved; retain the execution reservation."); };
function record(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))) return fail();
  return value as Record<string, unknown>;
}
function inode(value: unknown): InodeIdentity {
  const row = record(value, ["device", "inode"]);
  for (const value of Object.values(row)) if (typeof value !== "string" || !/^(0|[1-9][0-9]{0,19})$/.test(value) || BigInt(value) > 18446744073709551615n) return fail();
  return { device: row.device as string, inode: row.inode as string };
}
export function phaseInitialisation(plan: ExecutionPlan, phase: "compile" | "run", boot: string,
  physical: Pick<PhysicalExecutionIdentity, "container_id" | "cgroup_parent">, nonce: string) {
  const safe = reviewedExecutionPlan(plan);
  if (!["compile", "run"].includes(phase) || !safe[phase] || !/^[0-9a-f]{64}$/.test(physical.container_id)
    || !/^\/ingenium-exec-[0-9a-f]{32}$/.test(physical.cgroup_parent) || !/^[0-9a-f]{64}$/.test(nonce)) return fail();
  return { version: 1, phase, host_epoch_id: safe.hostEpochId, attempt_id: safe.attemptId, boot_id: uuid(boot),
    container_id: physical.container_id, cgroup_parent: physical.cgroup_parent, nonce };
}
export function phaseResourceRecord(initialisation: ReturnType<typeof phaseInitialisation>, groups: PhaseGroups) {
  return { init_sha256: sha256(judgeJson(initialisation)).toString("hex"), groups: { memory: inode(groups.memory), cpuacct: inode(groups.cpuacct) } };
}
export function retainedPhaseGroups(plan: ExecutionPlan, boot: string, physical: Pick<PhysicalExecutionIdentity, "container_id" | "cgroup_parent">,
  rows: Record<"compile_init" | "compile_groups" | "run_init" | "run_groups", unknown | null>): { phase: "compile" | "run" | null; groups: PhaseGroups | null } {
  let latest: { phase: "compile" | "run" | null; groups: PhaseGroups | null } = { phase: null, groups: null };
  let compiled = false;
  for (const kind of ["compile", "run"] as const) {
    const init = rows[`${kind}_init`], saved = rows[`${kind}_groups`];
    if (init === null) { if (saved !== null) return fail(); continue; }
    const row = record(init, ["version", "phase", "host_epoch_id", "attempt_id", "boot_id", "container_id", "cgroup_parent", "nonce"]);
    if (typeof row.nonce !== "string") return fail();
    const expected = phaseInitialisation(plan, kind, boot, physical, row.nonce);
    if (judgeJson(row) !== judgeJson(expected) || kind === "run" && plan.compile !== null && !compiled) return fail();
    latest = { phase: kind, groups: null };
    // The latest init intent fences an older box-0 identity, including a crash before new identities were saved.
    if (saved !== null) {
      const evidence = record(saved, ["init_sha256", "groups"]), groups = record(evidence.groups, ["memory", "cpuacct"]);
      const checked = phaseResourceRecord(expected, { memory: inode(groups.memory), cpuacct: inode(groups.cpuacct) });
      if (judgeJson(evidence) !== judgeJson(checked)) return fail();
      latest.groups = checked.groups; if (kind === "compile") compiled = true;
    }
  }
  return latest;
}
