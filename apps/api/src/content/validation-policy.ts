import { EVENT_LANGUAGES, LANGUAGES, sha256 } from "../access/credentials.js";
import type { Language } from "../access/credentials.js";
import { CHECKER_VERSION } from "./policy.js";

export interface ValidationVersion {
  id: string; definition_id: string; content_revision: string; round_type: number; title: string; statement: string; difficulty: number;
  base_bounty: number; submission_format: string; checker_mode: string; checker_version: string; publication_status: string;
}
export interface ValidationVariant {
  id: string; language: Language; starter_code: Buffer; reference_code: Buffer; defect_description: string;
  runtime_key: string | null; cpu_ms: number | null; wall_ms: number | null; memory_kb: number | null; manifest_digest: Buffer | null;
}
export interface ValidationCase { id: string; position: number; visibility: "SAMPLE" | "HIDDEN"; input_data: Buffer; expected_output: Buffer; }
export interface ValidationWitness { variant_id: string; position: number; check_type: "COMPILATION" | "TEST_CASE"; test_case_id: string | null; expected_failure: CodeResult; }
export interface ValidationHint { id: string; level: number; content: string; }
export interface ValidationCapture { version: ValidationVersion; variants: ValidationVariant[]; cases: ValidationCase[]; witnesses: ValidationWitness[]; hints: ValidationHint[]; manifest_text: string; }
export const CODE_RESULTS = ["PASSED", "WRONG_ANSWER", "COMPILATION_ERROR", "RUNTIME_ERROR", "TIME_LIMIT_EXCEEDED", "MEMORY_LIMIT_EXCEEDED", "OUTPUT_LIMIT_EXCEEDED"] as const;
export type CodeResult = typeof CODE_RESULTS[number];
export interface ValidationIssue { code: string; language: Language | null; case_id: string | null; hint_level: number | null; }
export interface PlannedCheck {
  variant_id: string; language: Language; source_role: "REFERENCE" | "STARTER"; check_type: "TEST_CASE" | "COMPILATION";
  test_case_id: string | null; witness_position: number | null; expected_result: CodeResult;
}
const decoder = () => new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
function validUtf8(bytes: Buffer): boolean { try { decoder().decode(bytes); return true; } catch { return false; } }
function nonblankSource(bytes: Buffer): boolean { try { return decoder().decode(bytes).trim().length > 0; } catch { return false; } }

export function planValidation(capture: ValidationCapture): { issues: ValidationIssue[]; checks: PlannedCheck[]; fingerprint: Buffer } {
  const issues: ValidationIssue[] = [], checks: PlannedCheck[] = [], v = capture.version;
  const issue = (code: string, language: Language | null = null, caseId: string | null = null, level: number | null = null) => {
    if (issues.length < 128) issues.push({ code, language, case_id: caseId, hint_level: level });
  };
  if (v.publication_status !== "DRAFT") issue("CONTENT_LOCKED");
  if (!v.title.trim() || !v.statement.trim()) issue("STATEMENT_INCOMPLETE");
  if (!Number.isInteger(v.difficulty) || v.difficulty < 1 || v.difficulty > 100 || (v.base_bounty !== v.difficulty * 10 && !(v.round_type === 1 && v.base_bounty === v.difficulty * 50))) issue("REWARD_INVALID");
  if (v.submission_format !== "FULL_PROGRAM" || !["TOKENS", "EXACT_TEXT"].includes(v.checker_mode) || v.checker_version !== CHECKER_VERSION) issue("CHECKER_UNSUPPORTED");
  if (!capture.cases.some(c => c.visibility === "SAMPLE")) issue("SAMPLE_REQUIRED");
  if (!capture.cases.some(c => c.visibility === "HIDDEN")) issue("HIDDEN_REQUIRED");
  const caseIds = new Set(capture.cases.map(c => c.id));
  if (capture.cases.length > 20 || capture.cases.filter(c => c.visibility === "SAMPLE").length > 3 || caseIds.size !== capture.cases.length
    || new Set(capture.cases.map(c => c.position)).size !== capture.cases.length
    || capture.cases.reduce((n, c) => n + c.input_data.length + c.expected_output.length, 0) > 16777216) issue("SUITE_LIMIT_EXCEEDED");
  for (const c of capture.cases) {
    if (c.position < 1 || c.position > 20 || c.input_data.length > 1048576 || c.expected_output.length > 1048576) issue("CASE_LIMIT_EXCEEDED", null, c.id);
    if (!validUtf8(c.input_data) || !validUtf8(c.expected_output)) issue("CASE_INVALID_UTF8", null, c.id);
  }
  for (const level of [1, 2, 3]) {
    const hints = capture.hints.filter(h => h.level === level);
    if (hints.length !== 1 || !hints[0]!.content.trim()) issue("HINT_REQUIRED", null, null, level);
  }
  if (capture.hints.length !== 3) issue("HINT_SET_INVALID");
  const required = capture.variants.some(v => v.language === "javascript") ? LANGUAGES : EVENT_LANGUAGES;
  if (capture.variants.length !== required.length) issue("LANGUAGE_SET_INCOMPLETE");
  for (const lang of required) {
    const variants = capture.variants.filter(x => x.language === lang);
    if (variants.length !== 1) { issue("LANGUAGE_REQUIRED", lang); continue; }
    const variant = variants[0]!;
    if (!variant.runtime_key || !variant.manifest_digest || variant.manifest_digest.length !== 32
      || variant.cpu_ms === null || variant.wall_ms === null || variant.memory_kb === null) issue("RUNTIME_REQUIRED", lang);
    else if (!Number.isInteger(variant.cpu_ms) || !Number.isInteger(variant.wall_ms) || !Number.isInteger(variant.memory_kb)
      || variant.cpu_ms < 1 || variant.cpu_ms > (["c", "cpp"].includes(lang) ? 2000 : 4000)
      || variant.wall_ms < variant.cpu_ms || variant.wall_ms > (["c", "cpp"].includes(lang) ? 10000 : 15000)
      || variant.memory_kb < 1 || variant.memory_kb > 524288) issue("RUNTIME_LIMIT_INVALID", lang);
    if (variant.starter_code.length > 131072 || !nonblankSource(variant.starter_code)) issue("STARTER_INCOMPLETE", lang);
    if (variant.reference_code.length > 131072 || !nonblankSource(variant.reference_code)) issue("REFERENCE_INCOMPLETE", lang);
    if (!variant.defect_description.trim()) issue("DEFECT_DESCRIPTION_REQUIRED", lang);
    const witnesses = capture.witnesses.filter(w => w.variant_id === variant.id);
    if (!witnesses.length || witnesses.length > 3 || new Set(witnesses.map(w => w.position)).size !== witnesses.length) issue("WITNESS_REQUIRED", lang);
    for (const c of capture.cases) checks.push({ variant_id: variant.id, language: lang, source_role: "REFERENCE", check_type: "TEST_CASE", test_case_id: c.id, witness_position: null, expected_result: "PASSED" });
    const seen = new Set<string>();
    for (const w of witnesses) {
      const compilation = w.check_type === "COMPILATION", target = w.test_case_id ?? "COMPILATION";
      if (w.position < 1 || w.position > 3 || seen.has(target)
        || (compilation ? !["c", "cpp", "java"].includes(lang) || w.test_case_id !== null || w.expected_failure !== "COMPILATION_ERROR"
          : w.check_type !== "TEST_CASE" || !w.test_case_id || !caseIds.has(w.test_case_id) || !["WRONG_ANSWER", "RUNTIME_ERROR", "TIME_LIMIT_EXCEEDED", "MEMORY_LIMIT_EXCEEDED"].includes(w.expected_failure))) issue("WITNESS_INVALID", lang, w.test_case_id);
      seen.add(target);
      checks.push({ variant_id: variant.id, language: lang, source_role: "STARTER", check_type: w.check_type, test_case_id: w.test_case_id, witness_position: w.position, expected_result: w.expected_failure });
    }
  }
  if (capture.witnesses.some(w => !capture.variants.some(v => v.id === w.variant_id))) issue("WITNESS_INVALID");
  if (checks.length > 115 || checks.length === 0) issue("PLAN_LIMIT_EXCEEDED");
  return { issues, checks: issues.length ? [] : checks, fingerprint: sha256(capture.manifest_text) };
}

export function aggregateValidation(checks: (PlannedCheck & { id: string })[], results: ReadonlyMap<string, CodeResult | "INFRA_ERROR">) {
  const required = checks.some(c => c.language === "javascript") ? LANGUAGES : EVENT_LANGUAGES;
  const ids = new Set(checks.map(c => c.id));
  const references = checks.filter(c => c.source_role === "REFERENCE"), starters = checks.filter(c => c.source_role === "STARTER");
  const caseSet = new Set(references.map(c => c.test_case_id));
  if (!checks.length || checks.length > 115 || ids.size !== checks.length || caseSet.size < 2 || caseSet.size > 20
    || required.some(lang => {
      const refs = references.filter(c => c.language === lang), defects = starters.filter(c => c.language === lang);
      return refs.length !== caseSet.size || new Set(refs.map(c => c.test_case_id)).size !== caseSet.size
        || defects.length < 1 || defects.length > 3 || new Set(defects.map(c => c.witness_position)).size !== defects.length
        || new Set([...refs, ...defects].map(c => c.variant_id)).size !== 1;
    })
    || new Set(checks.map(c => c.variant_id)).size !== required.length
    || checks.some(c => !LANGUAGES.includes(c.language) || (c.source_role === "REFERENCE"
      ? c.check_type !== "TEST_CASE" || !c.test_case_id || c.witness_position !== null || c.expected_result !== "PASSED"
      : c.source_role !== "STARTER" || c.witness_position === null || c.witness_position < 1 || c.witness_position > 3
        || (c.check_type === "COMPILATION" ? !["c", "cpp", "java"].includes(c.language) || c.test_case_id !== null || c.expected_result !== "COMPILATION_ERROR"
          : c.check_type !== "TEST_CASE" || !caseSet.has(c.test_case_id) || !["WRONG_ANSWER", "RUNTIME_ERROR", "TIME_LIMIT_EXCEEDED", "MEMORY_LIMIT_EXCEEDED"].includes(c.expected_result))))
    || [...results].some(([id, result]) => !ids.has(id) || ![...CODE_RESULTS, "INFRA_ERROR"].includes(result))) throw new Error("Invalid validation result set.");
  const referenceFailures = checks.filter(c => c.source_role === "REFERENCE" && results.has(c.id) && results.get(c.id) !== "PASSED" && results.get(c.id) !== "INFRA_ERROR").length;
  const infrastructureFailures = checks.filter(c => results.get(c.id) === "INFRA_ERROR").length;
  const unmatchedLanguages = required.filter(lang => !checks.some(c => c.language === lang && c.source_role === "STARTER" && results.get(c.id) === c.expected_result));
  const status = results.size < checks.length ? "PENDING" : infrastructureFailures ? "INFRA_ERROR" : referenceFailures || unmatchedLanguages.length ? "FAILED" : "PASSED";
  return { status, reference_failures: referenceFailures, infrastructure_failures: infrastructureFailures, unmatched_languages: unmatchedLanguages,
    completed_checks: results.size, total_checks: checks.length };
}
