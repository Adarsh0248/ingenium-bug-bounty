import assert from "node:assert/strict";
import { test } from "node:test";
import { teamSearch } from "../src/access/team-management.js";

test("private team search accepts literal bounded text and rejects malformed or oversized terms", () => {
  for (const value of [
    "",
    "   ",
    " Team Alpha ",
    "%_\\",
    "\u00e9".repeat(60),
    "' OR true --",
  ])
    assert.equal(teamSearch(value), value.trim());
  for (const value of [
    null,
    {},
    [],
    1,
    "x".repeat(121),
    "\u00e9".repeat(61),
    "\0",
    "\ud800",
  ])
    assert.throws(() => teamSearch(value));
});
