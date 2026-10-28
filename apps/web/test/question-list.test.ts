import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultQuestionFilters, questionList } from "../src/question-list";
import type { Bounty } from "../src/types";

const bugs: Bounty[] = [
  {
    bounty_id: "a",
    title: "Signal",
    category: "ARRAYS",
    difficulty: 40,
    captured: false,
    claimed: false,
    base_bounty: 400,
    hint_tier: 0,
  },
  {
    bounty_id: "b",
    title: "Lost pointer",
    category: "SYSTEMS",
    difficulty: 10,
    captured: true,
    claimed: false,
    base_bounty: 100,
    hint_tier: 0,
  },
  {
    bounty_id: "c",
    title: "Branches",
    category: "GRAPHS",
    difficulty: 40,
    captured: true,
    claimed: true,
    base_bounty: 400,
    hint_tier: 0,
  },
  {
    bounty_id: "d",
    title: "Unknown",
    category: null,
    difficulty: 5,
    captured: false,
    claimed: false,
    base_bounty: 50,
    hint_tier: 0,
  },
];
test("question search matches titles and public topic tags without changing map order or data", () => {
  const original = structuredClone(bugs);
  assert.deepEqual(
    questionList(bugs, defaultQuestionFilters).map((r) => r.index),
    [0, 1, 2, 3],
  );
  assert.deepEqual(
    questionList(bugs, { ...defaultQuestionFilters, search: "  POINTER " }).map(
      (r) => r.bug.bounty_id,
    ),
    ["b"],
  );
  assert.deepEqual(
    questionList(bugs, { ...defaultQuestionFilters, search: "strings" }).map(
      (r) => r.bug.bounty_id,
    ),
    ["a"],
  );
  assert.equal(
    questionList(bugs, { ...defaultQuestionFilters, search: "no such title" })
      .length,
    0,
  );
  assert.deepEqual(bugs, original);
});
test("multiple tags use OR while search and availability combine with AND; captured closed questions stay closed", () => {
  const filters = {
    ...defaultQuestionFilters,
    tags: ["ARRAYS", "SYSTEMS"] as const,
  };
  assert.deepEqual(
    questionList(bugs, { ...filters, tags: [...filters.tags] }).map(
      (r) => r.bug.bounty_id,
    ),
    ["a", "b"],
  );
  assert.deepEqual(
    questionList(bugs, { ...defaultQuestionFilters, status: "captured" }).map(
      (r) => r.bug.bounty_id,
    ),
    ["b"],
  );
  assert.deepEqual(
    questionList(bugs, { ...defaultQuestionFilters, status: "closed" }).map(
      (r) => r.bug.bounty_id,
    ),
    ["c"],
  );
  assert.deepEqual(
    questionList(bugs, { ...defaultQuestionFilters, status: "available" }).map(
      (r) => r.bug.bounty_id,
    ),
    ["a", "b", "d"],
  );
  assert.equal(
    questionList(bugs, {
      ...defaultQuestionFilters,
      tags: ["ARRAYS"],
      search: "pointer",
    }).length,
    0,
  );
});
test("difficulty sorting is numeric and stable, retaining original question numbers", () => {
  assert.deepEqual(
    questionList(bugs, { ...defaultQuestionFilters, sort: "easiest" }).map(
      (r) => r.index,
    ),
    [3, 1, 0, 2],
  );
  assert.deepEqual(
    questionList(bugs, { ...defaultQuestionFilters, sort: "hardest" }).map(
      (r) => r.index,
    ),
    [0, 2, 1, 3],
  );
  assert.deepEqual(questionList([], defaultQuestionFilters), []);
  assert.deepEqual(
    bugs.map((b) => b.bounty_id),
    ["a", "b", "c", "d"],
  );
});
