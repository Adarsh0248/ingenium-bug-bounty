import { writeSync } from "node:fs";
import { lstat } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { judgeJson, JUDGE_BODY_LIMIT, JUDGE_PROTOCOL } from "../content/judge-protocol.js";
import { acceptExecutionReply, EXECUTOR_PROTOCOL } from "./executor.js";
import { createExecutionPlan } from "./execution-plan.js";
import { openExecutionCheckpoints } from "./checkpoints.js";
import type { ExecutionCheckpoints } from "./checkpoints.js";
import type { ExecutionPlan } from "./execution-plan.js";
import { storageAcknowledgement } from "./capsule-storage.js";
import { createIsolateBackend } from "./isolate-backend.js";
import { protectedDirectory, protectedLinuxFile } from "./isolate-context.js";
import { readCapsuleRequest } from "./capsule-request.js";

const CONFIG = "/opt/ingenium/judge-executor/capsule.json";
const fail = (): never => { throw new Error("Unusable private capsule request."); };

export async function waitForStorageAcknowledgement(checkpoints: ExecutionCheckpoints, plan: ExecutionPlan, signal: AbortSignal) {
  signal.throwIfAborted();
  const physical = await checkpoints.physical(plan), storage = await checkpoints.readCapsuleRecord(plan, "storage");
  if (!physical || !storage) return fail();
  const expected = judgeJson(storageAcknowledgement(plan, checkpoints.bootId, physical, storage));
  while (true) {
    signal.throwIfAborted(); const ack = await checkpoints.readCapsuleRecord(plan, "storage_ack");
    if (ack !== null) { if (judgeJson(ack) !== expected) return fail(); signal.throwIfAborted(); return; }
    await delay(50, undefined, { signal });
  }
}

// Private one-job IPC. The host must supply this root-only config after its original committed launch decision.
export async function capsuleReply(configuration: Buffer, raw: Buffer, signal: AbortSignal) {
  signal.throwIfAborted(); const { settings, claim, request } = readCapsuleRequest(configuration, raw);
  const checkpoints = await openExecutionCheckpoints(settings.hostEpochId, settings.bootId);
  try {
    const backend = createIsolateBackend(settings, checkpoints), plan = createExecutionPlan(claim, settings.runtimes);
    const evidence = request.operation === "EXECUTE" ? await backend.execute(plan, signal) : await backend.recover(plan, signal);
    const response = { protocol: EXECUTOR_PROTOCOL, operation: request.operation, request_id: request.request_id, host_epoch_id: settings.hostEpochId,
      boot_id: settings.bootId, permit_owner: claim.owner, reply: evidence === null ? null : { protocol: JUDGE_PROTOCOL,
        request_id: request.request_id, host_epoch_id: settings.hostEpochId, attempt_id: claim.payload.attemptId, payload_digest: request.payload.payload_digest,
        state: "FINISHED", provider_token: claim.providerToken, execution_generation: "1", evidence } };
    acceptExecutionReply(response, claim, request); const bytes = Buffer.from(judgeJson(response)); if (bytes.length > JUDGE_BODY_LIMIT) return fail(); return bytes;
  } finally { await checkpoints.close(); }
}
async function main() {
  if (process.platform !== "linux" || process.getuid?.() !== 0 || process.pid !== 1) return fail();
  process.umask(0o077);
  // This process is the capsule's namespace init; exiting also stops its remaining descendants, never the host supervisor.
  const deadline = setTimeout(() => process.exit(125), 80000); deadline.unref();
  await protectedDirectory("/opt/ingenium/judge-executor");
  const info = await lstat(CONFIG); if ((info.mode & 0o7777) !== 0o400) return fail();
  const configuration = await protectedLinuxFile(CONFIG, 32768), input = Buffer.alloc(JUDGE_BODY_LIMIT); let size = 0;
  for await (const piece of process.stdin) { const bytes = Buffer.from(piece); if (bytes.length > input.length - size) return fail(); bytes.copy(input, size); size += bytes.length; }
  const signal = AbortSignal.timeout(75000), raw = input.subarray(0, size), response = await capsuleReply(configuration, raw, signal);
  const { settings, claim, request } = readCapsuleRequest(configuration, raw);
  if (request.operation === "EXECUTE") {
    // Stay alive until the host owns real namespace handles; device numbers alone can be reused immediately on exit.
    const checkpoints = await openExecutionCheckpoints(settings.hostEpochId, settings.bootId);
    try { await waitForStorageAcknowledgement(checkpoints, createExecutionPlan(claim, settings.runtimes), signal); }
    finally { await checkpoints.close(); }
  }
  await new Promise<void>((done, reject) => process.stdout.write(response, error => error ? reject(error) : done()));
  process.exit(0);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => { try { writeSync(2, "Protected capsule unavailable; retain its original reservation.\n"); } finally { process.exit(125); } });
}
