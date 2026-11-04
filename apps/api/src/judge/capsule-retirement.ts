import { randomUUID } from "node:crypto";
import { sha256, uuid } from "../access/credentials.js";
import { judgeJson } from "../content/judge-protocol.js";
import { capsuleReference } from "./capsule-lifecycle.js";
import type { CapsuleDriver, CapsuleRelease } from "./capsule-lifecycle.js";
import { physicalIdentity } from "./checkpoints.js";
import type { ExecutionCheckpoints } from "./checkpoints.js";
import { retainedStorage } from "./capsule-storage.js";
import { checkedExecutionEvidence, reviewedExecutionPlan } from "./execution-plan.js";
import type { ExecutionPlan } from "./execution-plan.js";
import { retainedPhaseGroups, retainedBatchPhaseGroups } from "./phase-resources.js";
import type { ParticipantBatchCase } from '../content/batch-protocol.js';

export interface RetirementRequest {
  version: 1; host_epoch_id: string; boot_id: string; attempt_id: string; plan_sha256: string;
  container_id: string; cgroup_parent: string; release_sha256: string; context_sha256: string; evidence_sha256: string; nonce: string;
}
// Read-only, trusted host code only: it must prove full visibility, containment and irreversible no-future-start.
// Receipts or caller flags cannot replace live host observations and the original consumed permit.
export interface TrustedHostRetirementAuthority {
  readonly hostEpochId: string; readonly bootId: string; readonly releaseSha256: string;
  readonly batchCases?: readonly ParticipantBatchCase[];
  prove(request: Readonly<RetirementRequest>, signal: AbortSignal): Promise<unknown>;
}
const fail = (): never => { throw new Error("Complete host retirement unproved; retain the original slot and evidence."); };
const digest = (value: unknown) => sha256(judgeJson(value)).toString("hex");
function object(value: unknown, keys: readonly string[]) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))) return fail();
  return value as Record<string, unknown>;
}
function hex(value: unknown): string { if (typeof value !== "string" || !/^[0-9a-f]{64}$/.test(value)) return fail(); return value; }

export async function retirementContext(checkpoints: ExecutionCheckpoints, release: CapsuleRelease, plan: ExecutionPlan, batchCases?: readonly ParticipantBatchCase[]) {
  const row = await checkpoints.capsule(plan, batchCases !== undefined); if (!row) return fail();
  const ref = capsuleReference(plan, row.intent);
  if (ref.intent.image_id !== release.imageId || ref.intent.release_sha256 !== release.digest) return fail();
  const physical = physicalIdentity(await checkpoints.physical(plan));
  if (physical.cgroup_parent !== ref.parent) return fail();
  for (const name of ["container", "start", "stopped", "remove", "removed"] as const) if (object(row[name], ["id"]).id !== physical.container_id) return fail();
  if (row.resource_intent === null || row.resources === null) return fail();
  const resources = object(row.resources, ["intent_sha256", "configuration", "groups"]);
  if (resources.intent_sha256 !== digest(row.resource_intent)) return fail();
  const removal = { version: 1, boot_id: checkpoints.bootId, container_id: physical.container_id, resources_sha256: digest(row.resources) };
  if (judgeJson(row.resource_remove) !== judgeJson(removal) || judgeJson(row.resource_removed) !== judgeJson(removal)) return fail();
  const phase = batchCases ? retainedBatchPhaseGroups(plan, batchCases, checkpoints.bootId, physical, row) : retainedPhaseGroups(plan, checkpoints.bootId, physical, row);
  if (phase.groups === null) return fail();
  retainedStorage(plan, checkpoints.bootId, physical, row.storage);
  const saved = await checkpoints.read(plan); if (!saved.begun || !saved.evidence) return fail();
  const evidence = checkedExecutionEvidence(plan, saved.evidence), originalDrain = evidence.metadata.drain;
  evidence.metadata.drain = null;
  const { retirement, ...allRecords } = row;
  const records: Record<string, unknown> = {}, batch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(allRecords)) {
    // Optional batch records must not change legacy certificates or exceed the wire object's 64-key bound.
    if (key.startsWith('batch_') || /^b[01][0-9]_(init|groups|result)$/.test(key)) {
      if (value !== null) batch[key] = value;
    } else records[key] = value;
  }
  if (Object.keys(batch).length) records.batch = batch;
  const common = { version: 1 as const, host_epoch_id: checkpoints.hostEpochId, boot_id: checkpoints.bootId, attempt_id: plan.attemptId,
    plan_sha256: ref.labels["ingenium.executor.plan"]!, container_id: physical.container_id, cgroup_parent: ref.parent,
    release_sha256: release.digest, context_sha256: digest({ records, physical }), evidence_sha256: digest(evidence) };
  return { ref, common, evidence, originalDrain, retirement };
}

export function createCapsuleRetirement(checkpoints: ExecutionCheckpoints, driver: CapsuleDriver, release: CapsuleRelease, authority: TrustedHostRetirementAuthority) {
  const pinned = { imageId: release.imageId, digest: hex(release.digest), epoch: uuid(authority.hostEpochId), boot: uuid(authority.bootId) };
  const prove = authority.prove.bind(authority);
  if (pinned.epoch !== checkpoints.hostEpochId || pinned.boot !== checkpoints.bootId || authority.releaseSha256 !== pinned.digest
    || !/^sha256:[0-9a-f]{64}$/.test(pinned.imageId)) return fail();
  const context = (plan: ExecutionPlan) => retirementContext(checkpoints, pinned, plan, authority.batchCases);
  function receipt(value: unknown, common: Omit<RetirementRequest, "nonce">) {
    const row = object(value, ["request", "observation_sha256"]), request = object(row.request, [...Object.keys(common), "nonce"]);
    const expected: RetirementRequest = { ...common, nonce: uuid(request.nonce) };
    if (judgeJson(request) !== judgeJson(expected)) return fail();
    return { request: expected, observation_sha256: hex(row.observation_sha256) };
  }
  return {
    async seal(plan: ExecutionPlan, signal: AbortSignal) {
      signal.throwIfAborted(); const safe = reviewedExecutionPlan(plan);
      if (safe.hostEpochId !== pinned.epoch) return fail();
      let current = await context(safe);
      if (current.retirement === null) {
        if (current.originalDrain !== null) return fail();
        await driver.assertAbsent(current.ref, current.common.container_id, signal);
        const request: RetirementRequest = Object.freeze({ ...current.common, nonce: randomUUID() });
        const answer = object(await prove(request, signal), ["request_sha256", "observation_sha256"]);
        signal.throwIfAborted();
        if (answer.request_sha256 !== digest(request)) return fail();
        const proof = { request, observation_sha256: hex(answer.observation_sha256) };
        await driver.assertAbsent(current.ref, current.common.container_id, signal);
        const fresh = await context(safe);
        if (judgeJson(fresh.common) !== judgeJson(current.common) || fresh.originalDrain !== null) return fail();
        await checkpoints.saveCapsule(safe, "retirement", proof);
        current = await context(safe);
      }
      // Recover a completed immutable certificate after a lost acknowledgement; never rerun its host probe or source.
      const certificate = receipt(current.retirement, current.common);
      const proof = { cannot_start: true, processes_stopped: true, workspace_removed: true, proof_digest: digest(certificate) };
      if (current.originalDrain !== null && judgeJson(current.originalDrain) !== judgeJson(proof)) return fail();
      signal.throwIfAborted();
      return checkpoints.save(safe, { ...current.evidence, metadata: { ...current.evidence.metadata, drain: proof } });
    },
  };
}
