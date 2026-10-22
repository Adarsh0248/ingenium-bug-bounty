import { checkedExecutionEvidence, EXECUTION_PLAN_SHA256 } from "./execution-plan.js";
import type { ExecutionPlan } from "./execution-plan.js";
import type { ExecutionCheckpoints } from "./checkpoints.js";
import type { TrustedSandboxBackend } from "./launcher.js";

export function createCheckpointedBackend(checkpoints: ExecutionCheckpoints, backend: TrustedSandboxBackend): TrustedSandboxBackend {
  if (backend.policySha256 !== EXECUTION_PLAN_SHA256) throw new Error("Unreviewed sandbox checkpoint policy.");
  const snapshot = (p: ExecutionPlan) => Object.freeze({ ...p, source: Buffer.from(p.source), stdin: Buffer.from(p.stdin) });
  return {
    policySha256: EXECUTION_PLAN_SHA256,
    async assertReady(signal) { signal.throwIfAborted(); await checkpoints.assertReady(); return backend.assertReady(signal); },
    async execute(plan, signal) {
      const frozen = snapshot(plan);
      await checkpoints.begin(frozen, signal); signal.throwIfAborted();
      // Persist a completed result even after cancellation; that is reconciliation, never another launch.
      const evidence = checkedExecutionEvidence(frozen, await backend.execute(snapshot(frozen), signal));
      return checkpoints.save(frozen, evidence);
    },
    async recover(plan, signal) {
      signal.throwIfAborted(); const frozen = snapshot(plan), saved = await checkpoints.read(frozen);
      if (!saved.begun || saved.evidence?.metadata.drain) return saved.evidence;
      let retained: unknown;
      try { retained = await backend.recover(snapshot(frozen), signal); }
      catch (error) { if (saved.evidence) return saved.evidence; throw error; }
      if (retained === null) return saved.evidence;
      return checkpoints.save(frozen, checkedExecutionEvidence(frozen, retained));
    },
  };
}
