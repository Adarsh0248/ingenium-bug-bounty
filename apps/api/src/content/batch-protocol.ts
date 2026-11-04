import { EVENT_LANGUAGES, sha256, uuid } from "../access/credentials.js";
import { authoringRequest, judgeJson, readJudgeJson } from "./judge-protocol.js";
import type { JudgeRuntimes } from "./judge-protocol.js";
import type { AuthoringPayload } from "./execution-policy.js";

export const PARTICIPANT_BATCH_PROTOCOL = "ingenium-participant-batch-v1";
export const PARTICIPANT_BATCH_LIMIT=16384;
export interface ParticipantBatchCase {
  caseId: string;
  position: number;
  payload: AuthoringPayload;
  expected: Buffer;
  checker: "TOKENS" | "EXACT_TEXT";
}
const bad = (): never => { throw new Error("Unusable participant batch; retain original work."); };
function exact(value: unknown, keys: readonly string[]) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return bad();
  const row = value as Record<string, unknown>;
  if (Object.keys(row).length !== keys.length || keys.some(key => !Object.hasOwn(row, key))) return bad();
  return row;
}
function bytes(value: unknown, limit: number) {
  if (typeof value !== "string" || value.length > Math.ceil(limit / 3) * 4) return bad();
  const result = Buffer.from(value, "base64");
  if (result.length > limit || result.toString("base64") !== value) return bad();
  return result;
}
function common(p: AuthoringPayload) {
  return { host_epoch_id: p.hostEpochId, run_id: p.runId, runtime_key: p.runtimeKey, runtime_digest: p.runtimeDigest,
    language: p.language, source_role: p.sourceRole, source_b64: p.source.toString("base64") };
}

// Hidden expected output belongs only on the authenticated worker-to-judge channel, never in the program's stdin.
export function readParticipantBatch(raw: Buffer, identity: { batchId: string; hostEpochId: string; digest: string }, runtimes: JudgeRuntimes) {
  if (!Buffer.isBuffer(raw) || raw.length > PARTICIPANT_BATCH_LIMIT || !/^[0-9a-f]{64}$/.test(identity.digest)
    || sha256(raw).toString("hex") !== identity.digest) return bad();
  const row = exact(readJudgeJson(raw), ["protocol", "batch_id", "host_epoch_id", "run_id", "runtime_key", "runtime_digest", "language", "source_role", "source_b64", "cases"]);
  if (row.protocol !== PARTICIPANT_BATCH_PROTOCOL || row.batch_id !== uuid(identity.batchId)
    || row.host_epoch_id !== uuid(identity.hostEpochId) || uuid(row.run_id) === row.batch_id
    || !EVENT_LANGUAGES.includes(row.language as typeof EVENT_LANGUAGES[number])
    || !["OFFICIAL", "SAMPLE"].includes(row.source_role as string)) return bad();
  const source = bytes(row.source_b64, 131072);
  if (!source.length || !row.cases || typeof row.cases !== "object" || Array.isArray(row.cases)) return bad();
  const records = row.cases as Record<string, unknown>, keys = Object.keys(records).sort(),
    maximum = row.source_role === "SAMPLE" ? 3 : 8;
  if (!keys.length || keys.length > maximum) return bad();
  const attempts = new Set<string>(), checks = new Set<string>(), cases = new Set<string>();
  let previousPosition = 0, totalBytes = 0;
  const result = keys.map((key, index): ParticipantBatchCase => {
    if (key !== `c${String(index).padStart(2, "0")}`) return bad();
    const c = exact(records[key], ["position", "case_id", "attempt_id", "check_id", "stdin_b64", "expected_b64", "checker_mode", "cpu_ms", "wall_ms", "memory_kb"]);
    const attempt = uuid(c.attempt_id), check = uuid(c.check_id), caseId = uuid(c.case_id), position = c.position;
    if (attempt === row.batch_id || attempts.has(attempt) || checks.has(check) || cases.has(caseId)
      || typeof position !== "number" || !Number.isSafeInteger(position) || position <= previousPosition || position > 20
      || !["TOKENS", "EXACT_TEXT"].includes(c.checker_mode as string)) return bad();
    attempts.add(attempt); checks.add(check); cases.add(caseId); previousPosition = position;
    const stdin = bytes(c.stdin_b64, 1048576), expected = bytes(c.expected_b64, 1048576);
    totalBytes += stdin.length + expected.length;
    if (totalBytes > 1048576) return bad();
    const payload: AuthoringPayload = { attemptId: attempt, hostEpochId: row.host_epoch_id as string, runId: row.run_id as string,
      checkId: check, runtimeKey: row.runtime_key as string, runtimeDigest: row.runtime_digest as string,
      language: row.language as AuthoringPayload["language"], sourceRole: row.source_role as AuthoringPayload["sourceRole"],
      checkType: "TEST_CASE", source: Buffer.from(source), stdin, cpuMs: c.cpu_ms as number, wallMs: c.wall_ms as number, memoryKb: c.memory_kb as number };
    authoringRequest(payload, identity.batchId, runtimes);
    return { caseId, position, payload, expected, checker: c.checker_mode as ParticipantBatchCase["checker"] };
  });
  return { batchId: identity.batchId, hostEpochId: identity.hostEpochId, runId: row.run_id as string, cases: result };
}

export function createParticipantBatch(batchId: string, cases: readonly ParticipantBatchCase[], runtimes: JudgeRuntimes) {
  uuid(batchId);
  if (!cases.length || cases.length > 8) return bad();
  const shared = common(cases[0]!.payload);
  const records = Object.fromEntries(cases.map((c, index) => {
    authoringRequest(c.payload, batchId, runtimes);
    if (c.payload.checkType !== "TEST_CASE" || judgeJson(common(c.payload)) !== judgeJson(shared) || !Buffer.isBuffer(c.expected)) return bad();
    return [`c${String(index).padStart(2, "0")}`, { position: c.position, case_id: c.caseId,
      attempt_id: c.payload.attemptId, check_id: c.payload.checkId, stdin_b64: c.payload.stdin.toString("base64"),
      expected_b64: c.expected.toString("base64"), checker_mode: c.checker, cpu_ms: c.payload.cpuMs,
      wall_ms: c.payload.wallMs, memory_kb: c.payload.memoryKb }];
  }));
  const raw = Buffer.from(judgeJson({ protocol: PARTICIPANT_BATCH_PROTOCOL, batch_id: batchId, ...shared, cases: records })),
    digest = sha256(raw).toString("hex");
  readParticipantBatch(raw, { batchId, hostEpochId: cases[0]!.payload.hostEpochId, digest }, runtimes);
  return { raw, digest };
}

export function participantBatchWallBudget(cases:readonly ParticipantBatchCase[]){
  if(cases.length<1||cases.length>8) return bad();
  const total=40000+cases.reduce((n,c)=>{
    if(!Number.isSafeInteger(c.payload.wallMs)||c.payload.wallMs<1||c.payload.wallMs>15000)return bad();
    return n+c.payload.wallMs+10000;
  },0);
  if(total>240000)return bad();return total;
}
