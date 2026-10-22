import test from "node:test";
import assert from "node:assert/strict";
import { judgingPending } from "../src/types.js";
test("cancelled work is terminal without inventing a judging result", () => {
  for (const s of [
    "QUEUED",
    "JUDGING",
    "PROCESSING",
    "RECOVERING",
    "NEEDS_ATTENTION",
  ])
    assert.equal(judgingPending(s), true);
  for (const s of ["COMPLETED", "CANCELLED"])
    assert.equal(judgingPending(s), false);
});
