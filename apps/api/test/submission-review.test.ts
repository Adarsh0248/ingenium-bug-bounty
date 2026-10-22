import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { validateSubmissionReview } from "../src/competition/submission-review.js";

test("private submission review binds its exact target, selected dispatch and bounded UTF-8 purpose", () => {
  const parent = randomUUID(),
    input = {
      requestKey: randomUUID(),
      confirmParentId: parent,
      attemptId: null,
      reason: "Synthetic incident review",
    };
  validateSubmissionReview(parent, input);
  validateSubmissionReview(parent, {
    ...input,
    attemptId: randomUUID(),
    reason: String.fromCodePoint(0xe9).repeat(512),
  });
  for (const patch of [
    { confirmParentId: randomUUID() },
    { confirmParentId: "1" },
    { requestKey: "bad" },
    { attemptId: "bad" },
    { reason: " " },
    { reason: "x".repeat(1025) },
    { reason: "\ud800" },
    { reason: "unsafe\0reason" },
  ])
    assert.throws(() =>
      validateSubmissionReview(parent, { ...input, ...patch }),
    );
});
