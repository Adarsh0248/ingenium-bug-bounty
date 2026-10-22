import { writeSync } from "node:fs";
import { lstat } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { LANGUAGES, uuid } from "../access/credentials.js";
import { judgeJson, JUDGE_BODY_LIMIT, JUDGE_PROTOCOL, readAuthoringRequest, readJudgeJson, runtimeRecord } from "../content/judge-protocol.js";
import type { JudgeRuntimes } from "../content/judge-protocol.js";
import { acceptExecutionReply, EXECUTOR_PROTOCOL } from "./executor.js";
import type { executionRequest } from "./executor.js";
import { createExecutionPlan, EXECUTION_PLAN_SHA256 } from "./execution-plan.js";
import { openExecutionCheckpoints } from "./checkpoints.js";
import { createIsolateBackend } from "./isolate-backend.js";
import { ISOLATE_BINARIES, protectedDirectory, protectedLinuxFile } from "./isolate-context.js";

const CONFIG = "/opt/ingenium/judge-executor/capsule.json";
const tags = ["isolate", "phase_exec", "gcc", "gpp", "python", "node", "java", "javac"] as const;
const fail = (): never => { throw new Error("Unusable private capsule request."); };
function exact(value: unknown, keys: string[]): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))) fail();
}
export function readCapsuleRequest(configuration: Buffer, request: Buffer) {
  const config = readJudgeJson(configuration), row = readJudgeJson(request);
  exact(config, ["schema_version", "policy_sha256", "host_epoch_id", "boot_id", "attempt_id", "permit_owner", "provider_token", "payload_digest", "runtimes", "executables"]);
  if (config.schema_version !== 1 || config.policy_sha256 !== EXECUTION_PLAN_SHA256) return fail();
  exact(config.runtimes, [...LANGUAGES]); exact(config.executables, [...tags]);
  const runtimes: JudgeRuntimes = new Map(LANGUAGES.map(language => {
    const value = (config.runtimes as Record<string, unknown>)[language]; exact(value, ["key", "digest"]);
    return [language, { key: value.key as string, digest: value.digest as string }];
  }));
  if (judgeJson(runtimeRecord(runtimes)) !== judgeJson(config.runtimes)) return fail();
  const executables = config.executables;
  const binaries = Object.fromEntries(ISOLATE_BINARIES.map((path, index) => {
    const value = executables[tags[index]!]; if (typeof value !== "string" || !/^[0-9a-f]{64}$/.test(value)) return fail(); return [path, value];
  })) as Record<typeof ISOLATE_BINARIES[number], string>;
  const settings = { hostEpochId: uuid(config.host_epoch_id), bootId: uuid(config.boot_id), runtimes, binaries };
  const owner = uuid(config.permit_owner), token = uuid(config.provider_token), attempt = uuid(config.attempt_id);
  if (typeof config.payload_digest !== "string" || !/^[0-9a-f]{64}$/.test(config.payload_digest)) return fail();
  exact(row, ["protocol", "operation", "request_id", "host_epoch_id", "boot_id", "permit_owner", "provider_token", "payload"]);
  if (row.protocol !== EXECUTOR_PROTOCOL || !["EXECUTE", "RECOVER"].includes(row.operation as string) || row.host_epoch_id !== settings.hostEpochId
    || row.boot_id !== settings.bootId || row.permit_owner !== owner || row.provider_token !== token) return fail();
  const payload = readAuthoringRequest(row.payload, uuid(row.request_id), settings.hostEpochId, attempt, config.payload_digest, runtimes);
  return { settings, claim: { payload, owner, providerToken: token }, request: row as unknown as ReturnType<typeof executionRequest> };
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
  const response = await capsuleReply(configuration, input.subarray(0, size), AbortSignal.timeout(75000));
  await new Promise<void>((done, reject) => process.stdout.write(response, error => error ? reject(error) : done()));
  process.exit(0);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => { try { writeSync(2, "Protected capsule unavailable; retain its original reservation.\n"); } finally { process.exit(125); } });
}
