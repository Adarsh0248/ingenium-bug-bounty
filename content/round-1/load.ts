import { readFileSync } from "node:fs";

export type RoundOneLanguage = "c" | "cpp" | "java" | "python";
export interface RoundOneQuestion {
  id: string;
  slug: string;
  title: string;
  round_type: 1;
  category: "ARRAYS" | "SYSTEMS" | "GRAPHS" | "LOGIC";
  region: string;
  difficulty: number;
  base_bounty: number;
  submission_format: "FULL_PROGRAM";
  checker_mode: "TOKENS";
  statement: string;
  hints: { level: number; content: string }[];
  variants: Record<
    RoundOneLanguage,
    {
      starter_code: string;
      reference_solution_code: string;
      defect_description: string;
      witness_case_position: number;
    }
  >;
  cases: {
    position: number;
    visibility: "SAMPLE" | "HIDDEN";
    input_data: string;
    expected_output: string;
  }[];
}
export const roundOnePack = JSON.parse(
  readFileSync(new URL("./pack.json", import.meta.url), "utf8"),
) as {
  title: string;
  round_type: 1;
  languages: RoundOneLanguage[];
  questions: RoundOneQuestion[];
};
export function roundOneBugs() {
  return roundOnePack.questions.map((q) => ({
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
