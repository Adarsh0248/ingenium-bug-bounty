import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { validateDiagnostic } from "../src/content/validation-diagnostics.js";

test("validation diagnostic intent binds the exact run, one dispatch and bounded UTF-8 reason", () => {
  const run = randomUUID(),
    input = {
      requestKey: randomUUID(),
      confirmRunId: run,
      attemptId: randomUUID(),
      reason: "Synthetic diagnostic investigation",
    };
  validateDiagnostic(run, input);
  validateDiagnostic(run, {
    ...input,
    reason: String.fromCodePoint(0xe9).repeat(512),
  });
  for (const patch of [
    { confirmRunId: randomUUID() },
    { requestKey: "bad" },
    { attemptId: "bad" },
    { reason: " " },
    { reason: "x".repeat(1025) },
    { reason: "\ud800" },
    { reason: "bad\0reason" },
  ])
    assert.throws(() => validateDiagnostic(run, { ...input, ...patch }));
});
