import { authoringRequest, judgeJson, readJudgeJson, runtimeRecord } from "../content/judge-protocol.js";
import { uuid } from "../access/credentials.js";
import { authoringPayloadDigest } from "../content/execution-policy.js";
import { acceptExecutionReply, executionRequest } from "./executor.js";
import type { ExecutionClaim, TrustedProtectedExecutor } from "./executor.js";
import { claimJudgeDelivery } from "./queue.js";
import type { createJudgeQueue } from "./queue.js";
import type { createJudgeSupervisorStore } from "./registry.js";

export function createJudgeExecutionWorker(store: ReturnType<typeof createJudgeSupervisorStore>, queue: ReturnType<typeof createJudgeQueue>, executor: TrustedProtectedExecutor) {
  const epoch = store.hostEpochId, boot = store.bootId, runtimes = store.runtimes;
  if (queue.hostEpochId !== epoch || executor.hostEpochId !== epoch || queue.bootId !== boot || executor.bootId !== boot
    || judgeJson(runtimeRecord(executor.runtimes)) !== judgeJson(runtimeRecord(runtimes))) throw new Error("Executor does not match the registered host.");
  let busy = false, activeAttempt: string | null = null;
  async function turn<T>(signal: AbortSignal, work: () => Promise<T>): Promise<T> {
    signal.throwIfAborted(); if (busy) throw new Error("Execution worker is busy."); busy = true;
    try { return await work(); } finally { busy = false; activeAttempt = null; }
  }
  async function execute(claim: ExecutionClaim, operation: "EXECUTE" | "RECOVER", signal: AbortSignal) {
    activeAttempt = claim.payload.attemptId;
    const request = executionRequest(claim, boot, runtimes, operation), bytes = Buffer.from(judgeJson(request));
    // The executor receives its own copy; asynchronous mutation cannot alter our result binding.
    let reply: unknown;
    try { reply = await executor.exchange(readJudgeJson(bytes) as typeof request, signal); }
    catch (error) {
      // A lost launcher acknowledgement must not cancel other jobs when this exact result is already fully drained.
      const saved = await store.execution(claim.payload.attemptId).catch(() => null);
      if (saved?.started && saved.evidence?.metadata.drain && saved.owner === claim.owner && saved.providerToken === claim.providerToken
        && authoringPayloadDigest(saved.payload).equals(authoringPayloadDigest(claim.payload)))
        return { state: "SEALED", attemptId: claim.payload.attemptId } as const;
      throw error;
    }
    const evidence = acceptExecutionReply(reply, claim, request);
    if (evidence === null) return { state: "RECOVERY_REQUIRED", attemptId: claim.payload.attemptId } as const;
    // Saving a completed trusted result is reconciliation, not a fresh execution, even if cancellation arrived meanwhile.
    await store.seal(claim.payload, claim.providerToken, claim.owner, evidence);
    return { state: "SEALED", attemptId: claim.payload.attemptId } as const;
  }
  return {
    get activeAttempt() { return activeAttempt; },
    run: (signal: AbortSignal) => turn(signal, async () => {
      await executor.assertReady(signal); signal.throwIfAborted();
      // Other workers must not recover this permit during the claim's commit/response gap.
      const claim = await claimJudgeDelivery(store, queue, signal, attempt=>{activeAttempt=attempt;});
      if (claim.state !== "CLAIMED") return claim;
      // Revalidate before the only fresh launch call; failed/unknown launches are never retried here.
      authoringRequest(claim.payload, uuid(claim.owner), runtimes);
      signal.throwIfAborted(); return execute(claim, "EXECUTE", signal);
    }),
    recover: (attempt: string, signal: AbortSignal) => turn(signal, async () => {
      activeAttempt=uuid(attempt);
      const claim = await store.execution(activeAttempt);
      if (!claim) return { state: "NO_EXECUTION" } as const;
      if (claim.evidence?.metadata.drain) return { state: "SEALED", attemptId: attempt } as const;
      signal.throwIfAborted(); return execute(claim, "RECOVER", signal);
    }),
  };
}
