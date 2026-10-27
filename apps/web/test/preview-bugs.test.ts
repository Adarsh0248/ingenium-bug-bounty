import assert from "node:assert/strict";
import test from "node:test";
import { bugAppearance, bugSpecies } from "../src/bug-art";
import { regions } from "../src/regions";
import { definitions, previewBugs } from "./preview-bugs";

test("the default demo has ten bugs per region, every family and all bounty tiers", () => {
  const bugs = previewBugs();
  assert.equal(bugs.length, 40);
  assert.equal(new Set(bugs.map((b) => b.bounty_id)).size, 40);
  for (const region of regions) {
    const local = bugs.filter((b) => b.category === region.category),
      art = local.map((b) =>
        bugAppearance(
          b.bounty_id,
          b.difficulty,
          region.category,
          b.base_bounty,
        ),
      );
    assert.equal(local.length, 10, region.name);
    assert.deepEqual(
      new Set(art.map((b) => b.motion)),
      new Set(bugSpecies.map((b) => b.motion)),
    );
    assert.deepEqual(
      new Set(art.map((b) => b.rank.label)),
      new Set(["Common", "Rare", "Elite", "Apex"]),
    );
    if (region.id === "foundry")
      assert.deepEqual(
        new Set(art.map((b) => b.weapon)),
        new Set(["none", "pulse", "siege"]),
      );
    assert.ok(
      local.every(
        (b) => b.title && b.base_bounty >= 10 && b.base_bounty <= 1000,
      ),
    );
  }
  for (const [i, original] of definitions.entries()) {
    assert.equal(
      bugs[i].bounty_id,
      `00000000-0000-4000-8000-${String(100 + i).padStart(12, "0")}`,
    );
    assert.equal(bugs[i].title, original.title);
    assert.equal(bugs[i].base_bounty, original.difficulty * 10);
  }
});

test("demo sessions get deterministic bugs with independent capture state", () => {
  const first = previewBugs(),
    second = previewBugs();
  assert.deepEqual(first, second);
  first[0].captured = true;
  first[39].claimed = true;
  assert.ok(
    second.every((b) => !b.captured && !b.claimed && b.hint_tier === 0),
  );
});
