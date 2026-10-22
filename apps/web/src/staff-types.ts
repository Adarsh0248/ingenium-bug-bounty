import type { Bounty, Snapshot, Standing } from "./types";
export interface PublishedBug {
  snapshot_id: string;
  definition_id: string;
  title: string;
  difficulty: number;
  base_bounty: number;
  round_type: number;
}
export interface StaffTeam {
  team_id: string;
  team_name: string;
  team_round_id: string | null;
  members: {
    member_id: string;
    member_name: string;
    position: number;
    member_round_id: string | null;
    language: string | null;
  }[];
}
export interface ControlRound {
  round_id: string;
  kind: number;
  state: string;
  duration_ms: string;
  revision: string;
  configuration_revision: string;
  selected: PublishedBug[];
  teams: StaffTeam[];
}
export interface ControlRoom {
  server_time: string;
  session_id: string;
  role: string;
  control_revision: string;
  instance: { instance_id: string; status: string; current: boolean } | null;
  rounds: ControlRound[];
  qualified_team_ids: string[] | null;
}
export interface StaffLive {
  server_time: string;
  actor: {
    session_id: string;
    staff_id: string;
    role: string;
    expires_at: string;
  };
  arena: { current_instance_id: string | null };
  round: (NonNullable<Snapshot["round"]> & { revision: string }) | null;
  pauses: Snapshot["pauses"];
  standings: Standing[];
  bounties: Bounty[];
  judging: Snapshot["judging"];
  final: boolean;
}
export interface Page<T> {
  items: T[];
  next_after: string | null;
}
export interface StaffIdentity {
  staff_id: string;
  display_name: string;
  role: "SUPER_ADMIN" | "OWNER" | "ORGANISER";
  enabled: boolean;
  revision: string;
  code_version: string;
  has_active_code: boolean;
}
export interface ReplacementRequest {
  request_id: string;
  member_name: string;
  team_name: string;
  state: "PENDING" | "APPROVED";
  expected_revision: string;
  created_at: string;
  expires_at: string;
}
