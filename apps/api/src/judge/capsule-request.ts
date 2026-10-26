import { LANGUAGES, uuid } from "../access/credentials.js";
import { judgeJson, readAuthoringRequest, readJudgeJson, runtimeRecord } from "../content/judge-protocol.js";
import type { JudgeRuntimes } from "../content/judge-protocol.js";
import { EXECUTOR_PROTOCOL } from "./executor.js";
import type { executionRequest } from "./executor.js";
import { EXECUTION_PLAN_SHA256 } from "./execution-plan.js";
import { ISOLATE_BINARIES } from "./isolate-context.js";

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
