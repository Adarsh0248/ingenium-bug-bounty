import { uuid } from "../access/credentials.js";
import { runtimeRecord } from "../content/judge-protocol.js";
import type { JudgeRuntimes } from "../content/judge-protocol.js";
import type { ExecutionCheckpoints } from "./checkpoints.js";
import { createCapsuleLifecycle } from "./capsule-lifecycle.js";
import type { CapsuleDriver, CapsuleRelease, CapsuleResources } from "./capsule-lifecycle.js";
import { checkedExecutionEvidence, EXECUTION_PLAN_SHA256, reviewedExecutionPlan } from "./execution-plan.js";
import type { ExecutionPlan } from "./execution-plan.js";
import { executionRequest } from "./executor.js";
import { judgeJson } from "../content/judge-protocol.js";
import type { TrustedSandboxBackend } from "./launcher.js";
import { createCapsuleRetirement } from "./capsule-retirement.js";
import type { TrustedHostRetirementAuthority } from "./capsule-retirement.js";

// Only a separately verified host authority may supply readiness and prepared capsule resources. No runtime wiring enables this yet.
export function createCapsuleBackend(checkpoints: ExecutionCheckpoints, driver: CapsuleDriver, release: CapsuleRelease,
  runtimes: JudgeRuntimes, hostReadiness: (signal: AbortSignal) => Promise<Buffer>, resources: CapsuleResources,
  retirementAuthority?: TrustedHostRetirementAuthority): TrustedSandboxBackend & { retire(plan: ExecutionPlan, signal: AbortSignal): Promise<unknown | null> } {
  const pinned = new Map([...runtimes].map(([key, value]) => [key, { ...value }])); runtimeRecord(pinned);
  const lifecycle = createCapsuleLifecycle(checkpoints, driver, release, resources); let busy = false;
  const retirement = retirementAuthority ? createCapsuleRetirement(checkpoints, driver, release, retirementAuthority) : null;
  function bound(plan: ExecutionPlan) {
    const safe = reviewedExecutionPlan(plan), runtime = pinned.get(safe.language);
    if (safe.hostEpochId !== checkpoints.hostEpochId || !runtime || runtime.key !== safe.runtimeKey || runtime.digest !== safe.runtimeDigest) throw new Error("Foreign capsule execution.");
    return safe;
  }
  async function retained(plan: ExecutionPlan) {
    const binding = await lifecycle.binding(plan);
    const result = await checkpoints.read(plan); if (!result.evidence) return null;
    const physical = await checkpoints.physical(plan);
    if (!binding.started || !physical || physical.container_id !== binding.containerId || physical.cgroup_parent !== binding.reference.parent) throw new Error("Unbound physical execution evidence.");
    // Recovery checks journal/physical bindings but never invokes source, Docker start or readiness.
    const evidence = checkedExecutionEvidence(plan, result.evidence);
    return evidence;
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
        const evidence = await retained(safe); if (!evidence) throw new Error("No saved capsule result; recover the original attempt.");
        await lifecycle.stopAndRemove(safe, signal);
        return retirement ? await retirement.seal(safe, signal) : evidence;
      } finally { busy = false; }
    },
    async recover(plan, signal) {
      signal.throwIfAborted(); const safe = bound(plan);
      const row = await checkpoints.capsule(safe); if (!row) return null;
      // Do not call lifecycle.recover here: read-only verdict recovery must not reconcile Docker removal receipts.
      return retained(safe);
    },
    async retire(plan, signal) {
      signal.throwIfAborted(); if (busy) throw new Error("Capsule backend is busy."); busy = true;
      try {
        const safe = bound(plan); await lifecycle.stopAndRemove(safe, signal);
        const evidence = await retained(safe);
        // An absent result stays absent; only a separately supplied full host authority can certify a saved result.
        return retirement && evidence ? await retirement.seal(safe, signal) : evidence;
      } finally { busy = false; }
    },
  };
}
