import { bugAppearance, bugSpecies } from "../src/bug-art";
import { regions } from "../src/regions";

export const definitions = [
  { category: "ARRAYS", title: "The silent overflow", difficulty: 35 },
  { category: "ARRAYS", title: "Off by one", difficulty: 20 },
  { category: "SYSTEMS", title: "A tangled reference", difficulty: 64 },
  { category: "LOGIC", title: "Race condition", difficulty: 88 },
  { category: "LOGIC", title: "The missing return", difficulty: 12 },
  { category: "GRAPHS", title: "Ghost in the loop", difficulty: 51 },
] as const;

function previewBug(
  n: number,
  category: string,
  title: string,
  difficulty: number,
) {
  return {
    bounty_id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    category,
    title,
    difficulty,
    base_bounty: difficulty * 10,
    captured: false,
    claimed: false,
    hint_tier: 0,
  };
}

export function previewBugs() {
  const bugs = definitions.map((b, i) =>
    previewBug(100 + i, b.category, b.title, b.difficulty),
  );
  for (const [index, region] of regions.entries()) {
    const local = bugs.filter((b) => b.category === region.category),
      present = new Set(
        local.map(
          (b) =>
            bugAppearance(b.bounty_id, b.difficulty, region.category).motion,
        ),
      ),
      missing = bugSpecies.map((b) => b.motion).filter((m) => !present.has(m));
    for (
      let candidate = 0;
      local.length < 10 && candidate < 1000;
      candidate++
    ) {
      const bounty = [100, 250, 400, 550, 700, 850, 950, 1000, 160, 640][
          local.length
        ],
        bug = previewBug(
          3000 + index * 1000 + candidate,
          region.category,
          `Dummy ${region.name} ${local.length + 1}`,
          bounty / 10,
        );
      // Match the actual ID-based appearance so every rendered family is present.
      if (
        missing.length &&
        bugAppearance(bug.bounty_id, bug.difficulty, region.category).motion !==
          missing[0]
      )
        continue;
      missing.shift();
      local.push(bug);
      bugs.push(bug);
    }
    if (local.length !== 10 || missing.length)
      throw new Error(`Incomplete demo region: ${region.id}`);
  }
  return bugs;
}
