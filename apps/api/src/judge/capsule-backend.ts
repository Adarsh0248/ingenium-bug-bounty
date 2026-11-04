import { uuid } from "../access/credentials.js";
import { runtimeRecord } from "../content/judge-protocol.js";
import type { JudgeRuntimes } from "../content/judge-protocol.js";
import type { ExecutionCheckpoints } from "./checkpoints.js";
import { createCapsuleLifecycle, readCapsuleJournal } from "./capsule-lifecycle.js";
import type { CapsuleDriver, CapsuleRelease, CapsuleResources } from "./capsule-lifecycle.js";
import { checkedExecutionEvidence, EXECUTION_PLAN_SHA256, reviewedExecutionPlan } from "./execution-plan.js";
import type { ExecutionPlan } from "./execution-plan.js";
import { executionRequest } from "./executor.js";
import { judgeJson } from "../content/judge-protocol.js";
import type { TrustedSandboxBackend } from "./launcher.js";
import { createCapsuleRetirement } from "./capsule-retirement.js";
import type { TrustedHostRetirementAuthority } from "./capsule-retirement.js";

export function createCapsuleRecovery(checkpoints: ExecutionCheckpoints, release: CapsuleRelease, runtimes: JudgeRuntimes): TrustedSandboxBackend {
  const pinned = new Map([...runtimes].map(([key, value]) => [key, { ...value }])), bundle = { ...release }; runtimeRecord(pinned);
  const refuse = async (): Promise<never> => { throw new Error("Read-only recovery cannot admit, execute or clean up work."); };
  return {
    policySha256: EXECUTION_PLAN_SHA256, assertReady: refuse, execute: refuse,
    async recover(plan, signal) {
      signal.throwIfAborted(); const safe = reviewedExecutionPlan(plan), runtime = pinned.get(safe.language);
      if (safe.hostEpochId !== checkpoints.hostEpochId || !runtime || runtime.key !== safe.runtimeKey || runtime.digest !== safe.runtimeDigest) throw new Error("Foreign capsule execution.");
      if (!await checkpoints.capsule(safe)) return null;
      const binding = await readCapsuleJournal(checkpoints, bundle, safe), result = await checkpoints.read(safe);
      if (!result.evidence) return null;
      const physical = await checkpoints.physical(safe);
      if (!binding.row.start || !physical || physical.container_id !== binding.id || physical.cgroup_parent !== binding.ref.parent) throw new Error("Unbound physical execution evidence.");
      return checkedExecutionEvidence(safe, result.evidence);
    },
  };
}

// Only a separately verified host authority may supply readiness and prepared capsule resources.
export function createCapsuleBackend(checkpoints: ExecutionCheckpoints, driver: CapsuleDriver, release: CapsuleRelease,
  runtimes: JudgeRuntimes, hostReadiness: (signal: AbortSignal) => Promise<Buffer>, resources: CapsuleResources,
  retirementAuthority?: TrustedHostRetirementAuthority,
  recordResult?: (plan: ExecutionPlan, evidence: unknown) => Promise<void>): TrustedSandboxBackend & { retire(plan: ExecutionPlan, signal: AbortSignal): Promise<unknown | null> } {
  const pinned = new Map([...runtimes].map(([key, value]) => [key, { ...value }])); runtimeRecord(pinned);
  const lifecycle = createCapsuleLifecycle(checkpoints, driver, release, resources); let busy = false;
  const recovery = createCapsuleRecovery(checkpoints, release, pinned);
  const retirement = retirementAuthority ? createCapsuleRetirement(checkpoints, driver, release, retirementAuthority) : null;
  function bound(plan: ExecutionPlan) {
    const safe = reviewedExecutionPlan(plan), runtime = pinned.get(safe.language);
    if (safe.hostEpochId !== checkpoints.hostEpochId || !runtime || runtime.key !== safe.runtimeKey || runtime.digest !== safe.runtimeDigest) throw new Error("Foreign capsule execution.");
    return safe;
  }
  async function retained(plan: ExecutionPlan, signal: AbortSignal) {
    return recovery.recover(plan, signal);
  }
  return {
    policySha256: EXECUTION_PLAN_SHA256,
    async assertReady(signal) { signal.throwIfAborted(); await checkpoints.assertReady(); const proof = await hostReadiness(signal);
      if (!Buffer.isBuffer(proof) || proof.length !== 32) throw new Error("Unverified host readiness."); signal.throwIfAborted(); return Buffer.from(proof); },
    async execute(plan, signal) {
      signal.throwIfAborted(); if (busy) throw new Error("Capsule backend is busy."); busy = true;
      try {
        const safe = bound(plan), claim = { payload: { ...safe, ...safe.payloadLimits }, owner: uuid(safe.owner), providerToken: uuid(safe.providerToken) };
        await this.assertReady(signal);
        await lifecycle.execute(safe, Buffer.from(judgeJson(executionRequest(claim, checkpoints.bootId, pinned, "EXECUTE"))), signal);
        const evidence = await retained(safe, signal); if (!evidence) throw new Error("No saved capsule result; recover the original attempt.");
        // Publish genuine completed output while cleanup continues; only positive retirement releases its permit.
        if (recordResult) await recordResult(safe, evidence);
        await lifecycle.stopAndRemove(safe, signal);
        return retirement ? await retirement.seal(safe, signal) : evidence;
      } finally { busy = false; }
    },
    async recover(plan, signal) {
      signal.throwIfAborted(); const safe = bound(plan);
      const row = await checkpoints.capsule(safe); if (!row) return null;
      // Do not call lifecycle.recover here: read-only verdict recovery must not reconcile Docker removal receipts.
      return retained(safe, signal);
    },
    async retire(plan, signal) {
      signal.throwIfAborted(); if (busy) throw new Error("Capsule backend is busy."); busy = true;
      try {
        const safe = bound(plan); await lifecycle.stopAndRemove(safe, signal);
        const evidence = await retained(safe, signal);
        // An absent result stays absent; only a separately supplied full host authority can certify a saved result.
        return retirement && evidence ? await retirement.seal(safe, signal) : evidence;
      } finally { busy = false; }
    },
  };
}
