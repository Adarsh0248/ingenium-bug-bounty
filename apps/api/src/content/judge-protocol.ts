import { LANGUAGES, language, sha256, uuid } from "../access/credentials.js";
import type { Language } from "../access/credentials.js";
import { authoringPayloadDigest } from "./execution-policy.js";
import type { AuthoringPayload } from "./execution-policy.js";

export const JUDGE_PROTOCOL = "ingenium-authoring-v1";
export const JUDGE_BODY_LIMIT = 2 * 1024 * 1024;
export type JudgeRuntimes = ReadonlyMap<Language, { key: string; digest: string }>;
const bad = (): never => { throw new Error("Unusable judge protocol."); };
const hex = /^[0-9a-f]{64}$/;
function object(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return bad();
  const row = value as Record<string, unknown>;
  if (Object.keys(row).length !== keys.length || keys.some(k => !Object.hasOwn(row, k))) return bad();
  return row;
}
function digest(value: unknown): string { if (typeof value !== "string" || !hex.test(value)) return bad(); return value; }
function integer(value: unknown, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max) return bad();
  return value;
}
function counter(value: unknown): string {
  if (typeof value !== "string" || !/^(0|[1-9][0-9]{0,18})$/.test(value) || BigInt(value) > 9223372036854775807n) return bad();
  return value;
}
function bool(value: unknown): boolean { if (typeof value !== "boolean") return bad(); return value; }
function base64(value: unknown, limit: number): Buffer {
  if (typeof value !== "string" || value.length > 4 * Math.ceil(limit / 3)) return bad();
  const raw = Buffer.from(value, "base64");
  if (raw.length > limit || raw.toString("base64") !== value) return bad();
  return raw;
}
// Canonical ASCII wire JSON also rejects duplicate keys and alternate numeric/string spellings.
export function judgeJson(value: unknown, depth = 0): string {
  if (depth > 16) return bad();
  if (value === null || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") { if (!Number.isSafeInteger(value)) return bad(); return JSON.stringify(value); }
  if (typeof value === "string") { if (!value.isWellFormed() || /[^\x20-\x7e]/.test(value)) return bad(); return JSON.stringify(value); }
  if (!value || typeof value !== "object" || Array.isArray(value)) return bad();
  const row = value as Record<string, unknown>, keys = Object.keys(row).sort();
  if (keys.length > 64 || keys.some(k => !/^[a-z][a-z0-9_]*$/.test(k))) return bad();
  return `{${keys.map(k => `${JSON.stringify(k)}:${judgeJson(row[k], depth + 1)}`).join(",")}}`;
}
export function readJudgeJson(raw: Buffer): unknown {
  if (raw.length > JUDGE_BODY_LIMIT) return bad();
  try {
    const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(raw), value: unknown = JSON.parse(text);
    if (judgeJson(value) !== text) return bad();
    return value;
  } catch { return bad(); }
}
export function runtimeRecord(runtimes: JudgeRuntimes) {
  if (runtimes.size !== LANGUAGES.length) return bad();
  return Object.fromEntries(LANGUAGES.map(language => {
    const runtime = runtimes.get(language);
    if (!runtime || !/^[a-z0-9][a-z0-9._-]{0,63}$/.test(runtime.key)) return bad();
    return [language, { key: runtime.key, digest: digest(runtime.digest) }];
  }));
}
export function authoringRequest(p: AuthoringPayload, requestId: string, runtimes: JudgeRuntimes) {
  for (const id of [p.attemptId, p.hostEpochId, p.runId, p.checkId, requestId]) uuid(id);
  const runtime = runtimes.get(p.language), compiled = p.language === "c" || p.language === "cpp";
  if (!runtime || runtime.key !== p.runtimeKey || runtime.digest !== p.runtimeDigest || !Buffer.isBuffer(p.source) || !Buffer.isBuffer(p.stdin)
    || p.source.length > 131072 || p.stdin.length > 1048576 || !["REFERENCE", "STARTER", "OFFICIAL", "SAMPLE"].includes(p.sourceRole)
    || ["OFFICIAL", "SAMPLE"].includes(p.sourceRole) && p.checkType !== "TEST_CASE"
    || !["TEST_CASE", "COMPILATION"].includes(p.checkType) || (p.checkType === "COMPILATION" && (!compiled && p.language !== "java" || p.stdin.length !== 0))) return bad();
  integer(p.cpuMs, 1, compiled ? 2000 : 4000); integer(p.wallMs, p.cpuMs, compiled ? 10000 : 15000); integer(p.memoryKb, 1, 524288);
  return { protocol: JUDGE_PROTOCOL, request_id: requestId, host_epoch_id: p.hostEpochId, attempt_id: p.attemptId, run_id: p.runId, check_id: p.checkId,
    payload_digest: authoringPayloadDigest(p).toString("hex"), runtime_key: p.runtimeKey, runtime_digest: digest(p.runtimeDigest), language: p.language,
    source_role: p.sourceRole, check_type: p.checkType, source_b64: p.source.toString("base64"), stdin_b64: p.stdin.toString("base64"),
    cpu_ms: p.cpuMs, wall_ms: p.wallMs, memory_kb: p.memoryKb, number_of_runs: 1, enable_network: false };
}
export function readAuthoringRequest(value: unknown, requestId: string, hostEpochId: string, attemptId: string, payloadDigest: string, runtimes: JudgeRuntimes): AuthoringPayload {
  const row = object(value, ["protocol", "request_id", "host_epoch_id", "attempt_id", "run_id", "check_id", "payload_digest", "runtime_key", "runtime_digest", "language",
    "source_role", "check_type", "source_b64", "stdin_b64", "cpu_ms", "wall_ms", "memory_kb", "number_of_runs", "enable_network"]);
  const p: AuthoringPayload = { hostEpochId: uuid(row.host_epoch_id), attemptId: uuid(row.attempt_id), runId: uuid(row.run_id), checkId: uuid(row.check_id),
    runtimeKey: row.runtime_key as string, runtimeDigest: row.runtime_digest as string, language: language(row.language), sourceRole: row.source_role as AuthoringPayload["sourceRole"],
    checkType: row.check_type as AuthoringPayload["checkType"], source: base64(row.source_b64, 131072), stdin: base64(row.stdin_b64, 1048576),
    cpuMs: row.cpu_ms as number, wallMs: row.wall_ms as number, memoryKb: row.memory_kb as number };
  if (p.hostEpochId !== hostEpochId || p.attemptId !== attemptId || row.payload_digest !== digest(payloadDigest)
    || judgeJson(authoringRequest(p, requestId, runtimes)) !== judgeJson(row)) return bad();
  return p;
}
export function acceptJudgeReady(value: unknown, requestId: string, hostEpochId: string, runtimes: JudgeRuntimes): void {
  const row = object(value, ["protocol", "request_id", "host_epoch_id", "ready", "runtimes"]);
  if (row.protocol !== JUDGE_PROTOCOL || row.request_id !== requestId || row.host_epoch_id !== hostEpochId || row.ready !== true
    || judgeJson(row.runtimes) !== judgeJson(runtimeRecord(runtimes))) return bad();
}
function capture(value: unknown, raw: Buffer, diagnostic: boolean) {
  const row = object(value, ["bytes", "sha256", diagnostic ? "truncated" : "complete"]);
  if (integer(row.bytes, 0, diagnostic ? 65536 : 1048577) !== raw.length || digest(row.sha256) !== sha256(raw).toString("hex")) return bad();
  bool(row[diagnostic ? "truncated" : "complete"]);
  return row;
}
export function validateJudgePhase(value: unknown, limits: { cpu_ms: number; wall_ms: number; memory_kb: number }) {
  const row = object(value, ["limits", "identity_verified", "tree_accounted", "exit_code", "exit_signal", "cpu_limited", "wall_limited", "memory_limited",
    "output_limited", "infrastructure_error", "failure_attribution", "cpu_ns", "peak_bytes"]);
  if (judgeJson(row.limits) !== judgeJson(limits) || row.identity_verified !== true || row.tree_accounted !== true) return bad();
  for (const k of ["cpu_limited", "wall_limited", "memory_limited", "output_limited", "infrastructure_error"]) bool(row[k]);
  if (row.exit_code !== null) integer(row.exit_code, 0, 255);
  if (row.exit_signal !== null) integer(row.exit_signal, 1, 64);
  if (row.exit_code !== null && row.exit_signal !== null || ![null, "PARTICIPANT", "INFRASTRUCTURE"].includes(row.failure_attribution as string | null)) return bad();
  counter(row.cpu_ns); counter(row.peak_bytes);
  return row;
}
function failed(row: Record<string, unknown>): boolean {
  return row.exit_code !== 0 || row.exit_signal !== null || ["cpu_limited", "wall_limited", "memory_limited", "output_limited", "infrastructure_error"].some(k => row[k] === true);
}
export function classifyRunEvidence(run: Record<string, unknown>, complete: boolean, stdoutBytes: number): string {
  if (run.infrastructure_error || run.failure_attribution === "INFRASTRUCTURE") return "INFRA_ERROR";
  if (run.output_limited) { if (stdoutBytes !== 1048577) return bad(); return "OUTPUT_LIMIT_EXCEEDED"; }
  if (stdoutBytes > 1048576) return bad();
  if (run.memory_limited) return "MEMORY_LIMIT_EXCEEDED";
  if (run.cpu_limited || run.wall_limited) return "TIME_LIMIT_EXCEEDED";
  // SIGKILL/SIGTERM/SIGXFSZ alone do not attribute a participant failure.
  if (run.exit_code === null && (run.exit_signal === null || [9, 15, 25].includes(run.exit_signal as number))) return "INFRA_ERROR";
  if (failed(run)) return run.failure_attribution === "PARTICIPANT" ? "RUNTIME_ERROR" : "INFRA_ERROR";
  if (!complete || run.failure_attribution !== null) return bad();
  return "NORMAL";
}
export function acceptJudgeReply(value: unknown, p: AuthoringPayload, requestId: string, status: number) {
  const row = object(value, ["protocol", "request_id", "host_epoch_id", "attempt_id", "payload_digest", "state", "provider_token", "execution_generation", "evidence"]);
  if (row.protocol !== JUDGE_PROTOCOL || row.request_id !== requestId || row.host_epoch_id !== p.hostEpochId || row.attempt_id !== p.attemptId
    || row.payload_digest !== authoringPayloadDigest(p).toString("hex")) return bad();
  if (row.state === "ABSENT") {
    if (status !== 404 || row.provider_token !== null || row.execution_generation !== null || row.evidence !== null) return bad();
    return { state: "PENDING" };
  }
  if (![200, 201, 202].includes(status)) return bad();
  uuid(row.provider_token);
  if (row.execution_generation !== "1") return bad();
  if (row.state === "PENDING") { if (row.evidence !== null) return bad(); return { state: "PENDING" }; }
  if (row.state !== "FINISHED") return bad();
  const evidence = object(row.evidence, ["metadata", "stdout_b64", "stderr_b64", "compiler_output_b64"]);
  if (Buffer.byteLength(judgeJson(evidence.metadata)) > 32768) return bad();
  const meta = object(evidence.metadata, ["runtime_digest", "source_sha256", "stdin_sha256", "compile", "run", "captures", "drain"]);
  if (meta.runtime_digest !== p.runtimeDigest || meta.source_sha256 !== sha256(p.source).toString("hex") || meta.stdin_sha256 !== sha256(p.stdin).toString("hex")) return bad();
  const stdout = base64(evidence.stdout_b64, 1048577), stderr = base64(evidence.stderr_b64, 65536), compiler = base64(evidence.compiler_output_b64, 65536);
  const captures = object(meta.captures, ["stdout", "stderr", "compiler"]), out = capture(captures.stdout, stdout, false), err = capture(captures.stderr, stderr, true), comp = capture(captures.compiler, compiler, true);
  const compiled = ["c", "cpp", "java"].includes(p.language);
  const compilation = compiled ? validateJudgePhase(meta.compile, { cpu_ms: 15000, wall_ms: 30000, memory_kb: 1048576 }) : null;
  if (!compiled && (meta.compile !== null || compiler.length !== 0 || comp.truncated)) return bad();
  let result: string, accounting: Record<string, unknown>;
  if (compilation && failed(compilation)) {
    if (meta.run !== null || stdout.length !== 0 || stderr.length !== 0 || out.complete !== true || err.truncated) return bad();
    result = !compilation.infrastructure_error && compilation.failure_attribution === "PARTICIPANT" ? "COMPILATION_ERROR" : "INFRA_ERROR";
    accounting = compilation;
  } else if (p.checkType === "COMPILATION") {
    if (!compilation || compilation.failure_attribution !== null || meta.run !== null || stdout.length || stderr.length || out.complete !== true || err.truncated) return bad();
    result = "NORMAL"; accounting = compilation;
  } else {
    if (compilation && compilation.failure_attribution !== null) return bad();
    const run = validateJudgePhase(meta.run, { cpu_ms: p.cpuMs, wall_ms: p.wallMs, memory_kb: p.memoryKb });
    result = classifyRunEvidence(run, out.complete as boolean, stdout.length); accounting = run;
  }
  if (meta.drain !== null) {
    const drain = object(meta.drain, ["cannot_start", "processes_stopped", "workspace_removed", "proof_digest"]);
    if (drain.cannot_start !== true || drain.processes_stopped !== true || drain.workspace_removed !== true) return bad();
    digest(drain.proof_digest);
  }
  // A later drain proof must not change already sealed result evidence.
  const { drain: _drain, ...resultMetadata } = meta;
  const supporting = { protocol: JUDGE_PROTOCOL, host_epoch_id: p.hostEpochId, attempt_id: p.attemptId, payload_digest: row.payload_digest,
    provider_token: row.provider_token, execution_generation: row.execution_generation, metadata: resultMetadata };
  if (Buffer.byteLength(judgeJson(supporting)) > 32768) return bad();
  return { state: "FINISHED", attempt_id: p.attemptId, host_epoch_id: p.hostEpochId, payload_digest: row.payload_digest, runtime_digest: p.runtimeDigest,
    source_sha256: meta.source_sha256, stdin_sha256: meta.stdin_sha256, evidence_digest: sha256(judgeJson(supporting)).toString("hex"), execution_result: result,
    stdout, stdout_complete: out.complete, stderr, stderr_truncated: err.truncated, compiler_output: compiler, compiler_output_truncated: comp.truncated,
    cpu_ns: accounting.cpu_ns, peak_bytes: accounting.peak_bytes, drain: meta.drain, supervisor_evidence: supporting };
}
