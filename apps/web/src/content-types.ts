import type { Language } from "./types";

export interface ContentSummary {
  version_id: string;
  definition_id: string;
  version_number: number;
  title: string;
  difficulty: number;
  base_bounty: number;
  publication_status: "DRAFT" | "PUBLISHED";
  content_revision: string;
  definition_revision: string;
  round_type: 1 | 2;
}
export interface ContentDetail extends ContentSummary {
  statement: string;
  checker_mode: "TOKENS" | "EXACT_TEXT";
  variants: {
    language: Language;
    runtime_key: string | null;
    starter_bytes: number;
    reference_bytes: number;
  }[];
  cases: {
    case_id: string;
    position: number;
    visibility: "SAMPLE" | "HIDDEN";
    input_bytes: number;
    expected_bytes: number;
  }[];
  hints: { hint_id: string; level: number; content_bytes: number }[];
}
export type ContentAction =
  | "CREATE"
  | "NEW_VERSION"
  | "METADATA"
  | "VARIANT"
  | "CASE"
  | "DELETE_CASE"
  | "REORDER_CASES"
  | "HINT"
  | "WITNESSES"
  | "PREPARE";
export type Witness = {
  check_type: "COMPILATION" | "TEST_CASE";
  test_case_id: string | null;
  expected_failure: string;
};
export type ContentPayload = Record<string, any>;
export interface Preparation {
  outcome: string;
  reason: string | null;
  snapshot_id: string | null;
  issues: {
    code: string;
    language: Language | null;
    case_id: string | null;
    hint_level: number | null;
  }[];
}
export interface SnapshotPlan {
  snapshot_id: string;
  content_revision: string;
  fingerprint: string;
  planned_checks: number;
  checks: {
    check_id: string;
    language: Language;
    source_role: string;
    check_type: string;
    case_id: string | null;
    expected_result: string;
  }[];
}
export interface ValidationSnapshot {
  snapshot_id: string;
  content_revision: string;
  fingerprint: string;
  created_at: string;
}
export interface ValidationRunSummary {
  run_id: string;
  status: "QUEUED" | "RUNNING" | "PASSED" | "FAILED" | "INFRA_ERROR";
  created_at: string;
  deadline_at: string;
  finished_at: string | null;
  physical_pending: boolean;
}
export interface ValidationReport extends ValidationRunSummary {
  snapshot_id: string;
  configuration_fingerprint: string;
  checks: {
    check_id: string;
    language: Language;
    source_role: string;
    check_type: string;
    case_id: string | null;
    witness_position: number | null;
    expected_result: string;
    result: string | null;
    attempts: number;
    physical_pending: boolean;
    dispatches: {
      id: string;
      number: number;
      result: string | null;
      resolved_at: string | null;
      physical_pending: boolean;
    }[];
  }[];
}
