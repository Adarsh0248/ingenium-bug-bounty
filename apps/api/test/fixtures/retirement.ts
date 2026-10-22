import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { sha256 } from "../../src/access/credentials.js";
import { judgeJson } from "../../src/content/judge-protocol.js";
import { capsuleReference } from "../../src/judge/capsule-lifecycle.js";
import type { CapsuleDriver } from "../../src/judge/capsule-lifecycle.js";
import type { ExecutionCheckpoints } from "../../src/judge/checkpoints.js";
import { storageRecord } from "../../src/judge/capsule-storage.js";
import { CAPSULE_TMPFS } from "../../src/judge/docker-capsule.js";
import { checkedExecutionEvidence, createExecutionPlan } from "../../src/judge/execution-plan.js";
import type { ExecutionClaim } from "../../src/judge/executor.js";
import { phaseInitialisation, phaseResourceRecord } from "../../src/judge/phase-resources.js";
import type { TrustedHostRetirementAuthority } from "../../src/judge/capsule-retirement.js";
import { judgePayload, judgeReply, judgeRuntimes } from "./judge.js";

// Protocol/ordering fixtures only. All resource identities and host observations are synthetic, never real cleanup proof.
export function retirementFixture(claim: ExecutionClaim = { payload: judgePayload(), owner: randomUUID(), providerToken: randomUUID() }, boot: string = randomUUID()) {
  const plan = createExecutionPlan(claim, judgeRuntimes()), events: string[] = [], release = { imageId: `sha256:${"a".repeat(64)}`, digest: "b".repeat(64) };
  const intent = { version: 1 as const, nonce: randomUUID(), image_id: release.imageId, release_sha256: release.digest }, ref = capsuleReference(plan, intent);
  const physical = { container_id: "c".repeat(64), cgroup_parent: ref.parent, pid_namespace: "pid:[1]", mount_namespace: "mnt:[2]", network_namespace: "net:[3]", ipc_namespace: "ipc:[4]" };
  const hash = (value: unknown) => sha256(judgeJson(value)).toString("hex");
  const resourceIntent = { version: 1, boot_id: boot, configuration_sha256: "d".repeat(64), roots: { synthetic: true } };
  const resources = { intent_sha256: hash(resourceIntent), configuration: { synthetic: true }, groups: { synthetic: true } };
  const removal = { version: 1, boot_id: boot, container_id: physical.container_id, resources_sha256: hash(resources) };
  const rows: Record<string, unknown> = { intent, container: { id: physical.container_id }, start: { id: physical.container_id }, stopped: { id: physical.container_id },
    remove: { id: physical.container_id }, removed: { id: physical.container_id }, resource_intent: resourceIntent, resources, resource_remove: removal, resource_removed: removal,
    compile_init: null, compile_groups: null, run_init: null, run_groups: null, retirement: null };
  for (const phase of ["compile", "run"] as const) if (plan[phase]) {
    const init = phaseInitialisation(plan, phase, boot, physical, (phase === "compile" ? "e" : "f").repeat(64));
    rows[`${phase}_init`] = init; rows[`${phase}_groups`] = phaseResourceRecord(init, { memory: { device: "11", inode: "12" }, cpuacct: { device: "21", inode: "22" } });
  }
  const table = Object.keys(CAPSULE_TMPFS).map((path, i) => `${100 + i} 99 0:${200 + i} / ${path} rw,nosuid,nodev - tmpfs tmpfs rw\n`).join("");
  rows.storage = storageRecord(plan, boot, physical, table);
  const original = judgeReply(claim.payload, claim.owner, undefined, claim.providerToken).evidence; original.metadata.drain = null;
  let value = structuredClone(original);
  const store = { hostEpochId: plan.hostEpochId, bootId: boot,
    async capsule() { return structuredClone(rows); }, async physical() { return structuredClone(physical); },
    async read() { return { begun: true, evidence: structuredClone(value) }; },
    async saveCapsule(_p: unknown, name: string, saved: unknown) { events.push(name); if (rows[name] !== null) assert.deepEqual(rows[name], saved); else rows[name] = structuredClone(saved); },
    async save(p: typeof plan, saved: unknown) {
      const checked = checkedExecutionEvidence(p, saved), base = structuredClone(checked); base.metadata.drain = null;
      assert.deepEqual(base, original); if (value.metadata.drain !== null) assert.deepEqual(checked.metadata.drain, value.metadata.drain);
      value = checked as typeof value; events.push("drain"); return structuredClone(value);
    },
  } as unknown as ExecutionCheckpoints;
  const forbidden = async (): Promise<never> => { throw new Error("Synthetic retirement cannot create, start or stop any execution"); };
  const driver: CapsuleDriver = { create: forbidden, inspect: forbidden, find: async () => null, start: forbidden, stop: forbidden, remove: forbidden,
    async assertAbsent(_ref, id, signal) { signal.throwIfAborted(); assert.equal(id, physical.container_id); events.push("absent"); } };
  const authority: TrustedHostRetirementAuthority = { hostEpochId: plan.hostEpochId, bootId: boot, releaseSha256: release.digest,
    async prove(request, signal) { signal.throwIfAborted(); events.push("prove"); return { request_sha256: hash(request), observation_sha256: hash({ synthetic: true }) }; } };
  return { claim, boot, plan, release, rows, physical, original, store, driver, authority, events, evidence: () => structuredClone(value) };
}
