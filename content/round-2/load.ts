import { readFileSync } from "node:fs";
import type { RoundOneQuestion, RoundOneLanguage } from "../round-1/load";

export type RoundTwoQuestion = Omit<RoundOneQuestion, "round_type"> & {
  round_type: 2;
  paid_intel: {
    probe: { input_data: string; expected_output: string };
    scanner: Record<
      RoundOneLanguage,
      { label: string; from_line: number; to_line: number }
    >;
  };
};
export const roundTwoPack = JSON.parse(
  readFileSync(new URL("./pack.json", import.meta.url), "utf8"),
) as {
  title: string;
  round_type: 2;
  languages: RoundOneLanguage[];
  questions: RoundTwoQuestion[];
};
export function roundTwoBugs() {
  return roundTwoPack.questions.map((q) => ({
    bounty_id: q.id,
    category: q.category,
    title: q.title,
    difficulty: q.difficulty,
    base_bounty: q.base_bounty,
    captured: false,
    claimed: false,
    hint_tier: 0,
  }));
}
export const roundTwoQuestion = (id: string) =>
  roundTwoPack.questions.find((q) => q.id === id);
