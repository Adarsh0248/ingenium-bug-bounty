import { LANGUAGES, uuid } from "../access/credentials.js";
import { AccessError } from "../access/transaction.js";

export const CHECKER_VERSION = "ingenium-text-v1";
export const ACTIONS = ["CREATE", "NEW_VERSION", "METADATA", "VARIANT", "CASE", "DELETE_CASE", "WITNESSES", "HINT", "REORDER_CASES"] as const;
export type ContentAction = typeof ACTIONS[number];
const invalid = (): never => { throw new AccessError("INVALID_CONTEXT"); };
function record(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid();
  const row = value as Record<string, unknown>;
  if (Object.keys(row).length !== keys.length || keys.some(k => !Object.hasOwn(row, k))) return invalid();
  return row;
}
export function contentText(value: unknown, max: number, prose = false, nonblank = false): string {
  if (typeof value !== "string" || !value.isWellFormed() || Buffer.byteLength(value) > max || (prose && value.includes("\0")) || (nonblank && !value.trim())) return invalid();
  return value;
}
function integer(value: unknown, max: number): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1 || value > max) return invalid();
  return value;
}
function identifier(value: unknown): string { try { return uuid(value); } catch { return invalid(); } }
function language(value: unknown): string { if (!(LANGUAGES as readonly unknown[]).includes(value)) return invalid(); return value as string; }
function choice(value: unknown, choices: string[]): string { if (typeof value !== "string" || !choices.includes(value)) return invalid(); return value; }
const source = (value: unknown) => Buffer.from(contentText(value, 131072), "utf8").toString("base64");
const io = (value: unknown) => Buffer.from(contentText(value, 1048576), "utf8").toString("base64");

// The internal payload uses Base64 so valid UTF-8 NUL bytes never pass through PostgreSQL text/jsonb.
export function prepareContent(action: ContentAction, value: unknown): Record<string, unknown> {
  if (action === "CREATE" || action === "NEW_VERSION" || action === "METADATA") {
    const row = record(value, [...(action === "CREATE" ? ["round_type"] : []), "title", "statement", "difficulty", "checker_mode"]);
    return { ...(action === "CREATE" ? { round_type: integer(row.round_type, 2) } : {}), title: contentText(row.title, 160, true, true),
      statement: contentText(row.statement, 65536, true), difficulty: integer(row.difficulty, 100), checker_mode: choice(row.checker_mode, ["TOKENS", "EXACT_TEXT"]) };
  }
  if (action === "VARIANT") {
    const row = record(value, ["language", "starter_code", "reference_solution_code", "defect_description", "runtime_key", "cpu_time_limit_ms", "wall_time_limit_ms", "memory_limit_kb"]);
    const lang = language(row.language), compiled = ["c", "cpp"].includes(lang);
    let runtime: Record<string, unknown>;
    if (row.runtime_key === null) {
      if ([row.cpu_time_limit_ms, row.wall_time_limit_ms, row.memory_limit_kb].some(v => v !== null)) return invalid();
      runtime = { runtime_key: null, cpu_time_limit_ms: null, wall_time_limit_ms: null, memory_limit_kb: null };
    } else {
      if (typeof row.runtime_key !== "string" || !/^[a-z0-9][a-z0-9._-]{0,63}$/.test(row.runtime_key)) return invalid();
      const cpu = integer(row.cpu_time_limit_ms, compiled ? 2000 : 4000), wall = integer(row.wall_time_limit_ms, compiled ? 10000 : 15000);
      if (wall < cpu) return invalid();
      runtime = { runtime_key: row.runtime_key, cpu_time_limit_ms: cpu, wall_time_limit_ms: wall, memory_limit_kb: integer(row.memory_limit_kb, 524288) };
    }
    return { language: lang, starter_b64: source(row.starter_code), reference_b64: source(row.reference_solution_code),
      defect_description: contentText(row.defect_description, 16384, true), ...runtime };
  }
  if (action === "CASE") {
    const row = record(value, ["case_id", "position", "visibility", "input_data", "expected_output"]);
    return { case_id: row.case_id === null ? null : identifier(row.case_id), position: integer(row.position, 20),
      visibility: choice(row.visibility, ["SAMPLE", "HIDDEN"]), input_b64: io(row.input_data), expected_b64: io(row.expected_output) };
  }
  if (action === "DELETE_CASE") { const row = record(value, ["case_id"]); return { case_id: identifier(row.case_id) }; }
  if (action === "HINT") {
    const row = record(value, ["level", "content"]); return { level: integer(row.level, 3), content: contentText(row.content, 16384, true) };
  }
  if (action === "REORDER_CASES") {
    const row = record(value, ["case_ids"]);
    if (!Array.isArray(row.case_ids) || row.case_ids.length > 20) return invalid();
    const ids = row.case_ids.map(identifier); if (new Set(ids).size !== ids.length) return invalid();
    return { case_ids: ids };
  }
  if (action === "WITNESSES") {
    const row = record(value, ["language", "witnesses"]), lang = language(row.language);
    if (!Array.isArray(row.witnesses) || row.witnesses.length > 3) return invalid();
    const witnesses = row.witnesses.map(value => {
      const w = record(value, ["check_type", "test_case_id", "expected_failure"]);
      const kind = choice(w.check_type, ["COMPILATION", "TEST_CASE"]);
      if (kind === "COMPILATION") {
        if (!["c", "cpp", "java"].includes(lang) || w.test_case_id !== null || w.expected_failure !== "COMPILATION_ERROR") return invalid();
        return { check_type: kind, test_case_id: null, expected_failure: "COMPILATION_ERROR" };
      }
      const failure = choice(w.expected_failure, ["WRONG_OUTPUT", "RUNTIME_ERROR", "TIME_LIMIT_EXCEEDED", "MEMORY_LIMIT_EXCEEDED"]);
      return { check_type: kind, test_case_id: identifier(w.test_case_id), expected_failure: failure === "WRONG_OUTPUT" ? "WRONG_ANSWER" : failure };
    });
    if (new Set(witnesses.map(w => w.test_case_id ?? "COMPILATION")).size !== witnesses.length) return invalid();
    return { language: lang, witnesses };
  }
  return invalid();
}

// Call only with complete stdout after reliable successful execution, never a clipped/uncertain capture.
export function checkText(mode: "TOKENS" | "EXACT_TEXT", stdout: Uint8Array, expected: Uint8Array): boolean {
  if (mode !== "TOKENS" && mode !== "EXACT_TEXT") throw new Error("Unsupported checker mode.");
  const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
  let actual: string, answer: string;
  try { actual = decoder.decode(stdout); answer = decoder.decode(expected); } catch { return false; }
  if (mode === "EXACT_TEXT") return actual === answer;
  const tokens = (s: string) => s.split(/[ \t\n\r\f\v]+/).filter(t => t.length > 0);
  const a = tokens(actual), b = tokens(answer);
  return a.length === b.length && a.every((token, i) => token === b[i]);
}
