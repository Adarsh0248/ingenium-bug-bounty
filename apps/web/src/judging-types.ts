import type { Language } from "./types";
export interface JudgeParent {
  id: string;
  lane: "OFFICIAL" | "SAMPLE";
  bounty_id: string;
  title: string;
  team_id: string;
  team_name: string;
  language: Language;
  status: string;
  result: string | null;
  created_at: string;
  completed_at: string | null;
}
export interface JudgeQueue {
  parents: (JudgeParent & {
    jobs: {
      id: string;
      status: string;
      dispatches: number;
      physically_held: boolean;
    }[];
  })[];
  next_after: string | null;
  summary: {
    total: number;
    unfinished: number;
    attention: number;
    completed: number;
    physically_held: number;
  };
  round_state: string;
  server_time: string;
}
export interface JudgeDetail {
  parent: JudgeParent & {
    started_at: string | null;
    receipt_order: string | null;
  };
  role: string;
  round_state: string;
  server_time: string;
  jobs: {
    id: string;
    status: string;
    result: string | null;
    available_at: string;
    completed_at: string | null;
    extra_authorised: boolean;
    retry_allowed: boolean;
    retry_reason: string;
    attempts: {
      id: string;
      number: number;
      send_state: string;
      prepared_at: string;
      send_started_at: string | null;
      result: string | null;
      resolved_at: string | null;
      released_at: string | null;
      next_poll_at: string;
    }[];
  }[];
}
export interface RecoveryAudit {
  items: {
    id: string;
    actor_name: string;
    reason: string;
    recorded_at: string;
    decision: string;
    reason_code: string | null;
  }[];
  next_after: string | null;
}
