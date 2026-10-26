import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { validateScore } from "../src/competition/reports.js";

test("final corrections accept signed whole points and reject invalid amounts, notes and scope", () => {
  const input = {
    requestKey: randomUUID(),
    teamRoundId: randomUUID(),
    reportId: null,
    delta: 125,
    reason: "Confirmed judge glitch",
    expectedRevision: "7",
    ownCode: "test-only",
  };
  validateScore(input);
  validateScore({ ...input, delta: -125 });
  for (const delta of [0, 0.5, NaN, Infinity, 1000001, -1000001])
    assert.throws(() => validateScore({ ...input, delta }));
  assert.throws(() => validateScore({ ...input, reason: " " }));
  assert.throws(() => validateScore({ ...input, reportId: "another-team" }));
  assert.throws(() => validateScore({ ...input, expectedRevision: "-1" }));
});
