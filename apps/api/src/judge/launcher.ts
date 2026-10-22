import { authoringPayloadDigest } from "../content/execution-policy.js";
import { judgeJson, JUDGE_PROTOCOL, readAuthoringRequest, readJudgeJson, runtimeRecord } from "../content/judge-protocol.js";
import { uuid } from "../access/credentials.js";
import { EXECUTOR_PROTOCOL } from "./executor.js";
import { createExecutionPlan, EXECUTION_PLAN_SHA256 } from "./execution-plan.js";
import type { ExecutionPlan } from "./execution-plan.js";
import type { createJudgeSupervisorStore } from "./registry.js";

// Only a separately reviewed kernel-backed producer may implement this internal boundary.
export interface TrustedSandboxBackend {
  readonly policySha256: string;
  assertReady(signal: AbortSignal): Promise<Buffer>;
  execute(plan: ExecutionPlan, signal: AbortSignal): Promise<unknown>;
  recover(plan: ExecutionPlan, signal: AbortSignal): Promise<unknown | null>;
}
function keys(row: unknown, expected: string[]): asserts row is Record<string, unknown> {
  if (!row || typeof row !== "object" || Array.isArray(row) || Object.keys(row).length !== expected.length || expected.some(key => !Object.hasOwn(row, key))) throw new Error("Invalid launcher request.");
}
export function createGuardedLauncher(store: ReturnType<typeof createJudgeSupervisorStore>, backend: TrustedSandboxBackend) {
  if (backend.policySha256 !== EXECUTION_PLAN_SHA256) throw new Error("Sandbox policy does not match the reviewed execution plan.");
  const epoch = store.hostEpochId, boot = store.bootId, runtimes = store.runtimes;
  async function ready(signal: AbortSignal) {
    const proof = await backend.assertReady(signal);
    if (!Buffer.isBuffer(proof) || proof.length !== 32) throw new Error("Missing verified sandbox readiness.");
    return proof.toString("hex");
  }
  return {
    async handle(raw: Buffer, operation: "READY" | "EXECUTE" | "RECOVER", signal: AbortSignal): Promise<Buffer> {
      if (!["READY", "EXECUTE", "RECOVER"].includes(operation)) throw new Error("Invalid launcher operation.");
      signal.throwIfAborted(); const request = readJudgeJson(raw);
      keys(request, operation === "READY" ? ["protocol", "operation", "request_id", "host_epoch_id", "boot_id", "runtimes"]
        : ["protocol", "operation", "request_id", "host_epoch_id", "boot_id", "permit_owner", "provider_token", "payload"]);
      if (request.protocol !== EXECUTOR_PROTOCOL || request.operation !== operation || request.host_epoch_id !== epoch || request.boot_id !== boot) throw new Error("Wrong launcher binding.");
      const nonce = uuid(request.request_id);
      if (operation === "READY") {
        if (judgeJson(request.runtimes) !== judgeJson(runtimeRecord(runtimes))) throw new Error("Wrong runtime bindings.");
        return Buffer.from(judgeJson({ ...request, ready: true, proof_digest: await ready(signal) }));
      }
      const owner = uuid(request.permit_owner), token = uuid(request.provider_token);
      keys(request.payload, ["protocol", "request_id", "host_epoch_id", "attempt_id", "run_id", "check_id", "payload_digest", "runtime_key", "runtime_digest", "language",
        "source_role", "check_type", "source_b64", "stdin_b64", "cpu_ms", "wall_ms", "memory_kb", "number_of_runs", "enable_network"]);
      const p = readAuthoringRequest(request.payload, nonce, epoch, uuid(request.payload.attempt_id), request.payload.payload_digest as string, runtimes);
      const saved = await store.execution(p.attemptId);
      if (!saved || saved.owner !== owner || saved.providerToken !== token || !authoringPayloadDigest(saved.payload).equals(authoringPayloadDigest(p))) throw new Error("No matching claimed execution.");
      const frame = (evidence: unknown) => Buffer.from(judgeJson({ protocol: EXECUTOR_PROTOCOL, operation, request_id: nonce, host_epoch_id: epoch, boot_id: boot, permit_owner: owner,
        reply: evidence === null ? null : { protocol: JUDGE_PROTOCOL, request_id: nonce, host_epoch_id: epoch, attempt_id: p.attemptId,
          payload_digest: authoringPayloadDigest(p).toString("hex"), state: "FINISHED", provider_token: token, execution_generation: "1", evidence } }));
      async function seal(evidence: unknown) {
        const frozen = readJudgeJson(Buffer.from(judgeJson(evidence)));
        await store.seal(saved!.payload, token, owner, frozen); return frame(frozen);
      }
      if (saved.evidence?.metadata.drain || operation === "EXECUTE" && saved.evidence) return frame(saved.evidence);
      const claim = { payload: saved.payload, owner, providerToken: token };
      if (operation === "RECOVER") {
        if (!saved.started) return frame(null);
        const evidence = await backend.recover(createExecutionPlan(claim, runtimes), signal);
        if (evidence === null) return frame(saved.evidence);
        return seal(evidence);
      }
      if (saved.started) throw new Error("Execution already started; recover the original result.");
      await ready(signal); signal.throwIfAborted();
      const launch = await store.beginLaunch(p.attemptId, token, owner);
      if (!launch) throw new Error("Execution already started; recover the original result.");
      signal.throwIfAborted();
      const evidence = await backend.execute(createExecutionPlan({ ...claim, payload: launch }, runtimes), signal);
      // Seal before replying: a lost stdout/worker acknowledgement can then reconcile directly from PostgreSQL.
      return seal(evidence);
    },
  };
}
