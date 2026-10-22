import type { Bounty, Feedback, Language, Standing } from "./types";
export interface HistoryRound {
  round_id: string;
  kind: number;
  state: string;
}
export interface HistoryOverview {
  round: HistoryRound & { language: Language };
  final: boolean;
  cancelled: boolean;
  wallet: number;
  standings: Standing[];
  bounties: (Bounty & {
    draft_saved: boolean;
    awarded_points: number | null;
  })[];
}
export interface HistoryAttempt {
  id: string;
  bounty_id: string;
  title: string;
  member_round_id: string;
  language: Language;
  lane: "SAMPLE" | "OFFICIAL";
  status: string;
  result: string | null;
  created_at: string;
  completed_at: string | null;
  award_id: string | null;
}
export interface WalletEntry {
  id: string;
  kind: "AWARD" | "HINT" | "CARRYOVER";
  title: string | null;
  amount: number;
  hint_level: number | null;
  awarded_points: number | null;
  recorded_at: string;
}
export interface HistoryPage<T> {
  items: T[];
  next_after: string | null;
}
export interface HistoryExecution extends Feedback {
  bounty_id: string;
  language: Language;
  source: string;
  created_at: string;
  completed_at: string | null;
}
