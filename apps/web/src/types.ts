export type Language = "c" | "cpp" | "java" | "python" | "javascript";
export const judgingPending = (status: string) => status !== "COMPLETED" && status !== "CANCELLED";
export const languages: Record<Language, string> = {
  c: "C",
  cpp: "C++",
  java: "Java",
  python: "Python",
  javascript: "JavaScript",
};
export type Audience =
  | "ANONYMOUS"
  | "ENTRY"
  | "PARTICIPANT"
  | "REPLACEMENT"
  | "STAFF_ENTRY"
  | "STAFF"
  | "STAFF_RECOVERY_ENTRY"
  | "STAFF_RECOVERY";
export interface Session {
  session_id: string;
  member_id: string;
  member_round_id: string;
  team_id: string;
  round_id: string;
  language: Language;
  member_name: string;
  team_name: string;
  round_state: string;
  expires_at: string;
  warning_at: string;
  absolute_expires_at: string;
}
export interface StaffSession {
  session_id: string;
  staff_id: string;
  display_name: string;
  role: string;
  mode: string;
  expires_at: string;
  warning_at: string;
}
export interface Flow {
  flow_id: string;
  state: string;
  expires_at: string;
  team_name: string;
  members: { id: string; name: string }[];
  round_id: string | null;
}
export interface Bounty {
  bounty_id: string;
  title: string;
  difficulty: number;
  base_bounty: number;
  claimed: boolean;
  hint_tier: number;
}
export interface Termination {
  awardId: string;
  bountyId: string;
}
export interface Standing {
  team_round_id: string;
  team_id: string;
  team_name: string;
  points: number;
  rank: number | null;
  effective_time_ms: number;
  penalty_ms: number;
  difficulties: number[];
}
export interface Snapshot {
  sync_id: string;
  schema_version: number;
  server_time: string;
  actor: {
    session_id: string;
    round_id: string;
    member_round_id: string;
    team_round_id: string;
    language: Language;
    name: string;
    team_name: string;
    expires_at: string;
  };
  round: {
    round_id: string;
    kind: number;
    state: string;
    duration_ms: string;
    started_at: string | null;
    closes_at: string | null;
    current: boolean;
    arena_status: string;
  } | null;
  bounties: Bounty[];
  pauses: {
    scope: string;
    member_round_id: string | null;
    team_round_id: string | null;
    started_at: string;
  }[];
  hud: { wallet: number; standing: Standing | null } | null;
  standings: Standing[];
  final: boolean;
  judging: {
    parent_id: string;
    bounty_id: string;
    lane: string;
    member_round_id: string;
    status: string;
    result: string | null;
    created_at: string;
  }[];
  drafts: { bounty_id: string; revision: string; updated_at: string }[];
  announcement_head: string | null;
}
export interface Metadata extends Bounty {
  round_id: string;
  member_round_id: string;
  language: Language;
  writable: boolean;
  reason: string | null;
  historical: boolean;
  cpu_ms: number;
  wall_ms: number;
  memory_kb: number;
  official_pending: boolean;
  unfinished_runs: number;
  samples: {
    sample_number: number;
    input_bytes: number;
    output_bytes: number;
  }[];
}
export interface Receipt {
  outcome_id: string;
  round_id: string;
  request_key: string;
  action: string;
  recorded_at: string;
  result: {
    status: string;
    reason?: string;
    submission_id?: string;
    run_id?: string;
    hint_tier?: number;
  };
}
export interface Feedback {
  id: string;
  lane: string;
  status: string;
  result: string | null;
  samples: {
    sample: number;
    result: string | null;
    stdout_b64: string | null;
    stderr_b64: string | null;
    compiler_output_b64: string | null;
    stdout_truncated: boolean | null;
    stderr_truncated: boolean | null;
    compiler_output_truncated: boolean | null;
  }[];
}
export interface Presence {
  bounty_id: string;
  member_id?: string;
  member_round_id: string;
  name?: string;
  member_name?: string;
  tabs: number;
  paused: boolean;
}
export const bugPath = (round: string, bounty: string) =>
  `/api/v1/competition/rounds/${round}/bounties/${bounty}`;
export function timeText(ms: number) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return [
    Math.floor(seconds / 3600),
    Math.floor(seconds / 60) % 60,
    seconds % 60,
  ]
    .map((v) => String(v).padStart(2, "0"))
    .join(":");
}
export const label = (text: string) => text.toLowerCase().replaceAll("_", " ");
