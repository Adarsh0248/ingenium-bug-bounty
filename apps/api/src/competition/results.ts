export interface FinalResults {
  format_version: 1;
  state: "FINAL";
  arena_id: string;
  round_id: string;
  round_kind: 1 | 2;
  result_id: string;
  result_version: number;
  finalised_at: string;
  standings_sha256: string;
  qualification_status: "PENDING" | "LOCKED" | "NOT_APPLICABLE";
  standings: {
    team_round_id: string;
    team_id: string;
    team_name: string;
    rank: number;
    points: number;
    solve_time_ms: number;
    penalty_ms: number;
    effective_time_ms: number;
    difficulties: number[];
    qualified: boolean | null;
  }[];
}
