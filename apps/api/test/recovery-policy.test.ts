import assert from "node:assert/strict";
import test from "node:test";
import { recoveryReason } from "../src/competition/recovery-policy.js";
const safe = {
  role: "OWNER",
  roundState: "RUNNING",
  lane: "OFFICIAL",
  parentCompleted: false,
  jobStatus: "NEEDS_ATTENTION",
  jobResult: null,
  extraAuthorised: false,
  attempts: Array.from({ length: 3 }, () => ({
    result: "INFRA_ERROR",
    released_at: "verified-release",
  })),
};
test("extra recovery eligibility is advisory and requires three safely drained infrastructure failures", () => {
  for (const role of ["OWNER", "SUPER_ADMIN"])
    for (const roundState of ["RUNNING", "PAUSED", "CLOSING"])
      assert.equal(recoveryReason({ ...safe, role, roundState }), "ELIGIBLE");
  assert.equal(recoveryReason({ ...safe, role: "ORGANISER" }), "ROLE_REQUIRED");
  assert.equal(recoveryReason({ ...safe, role: "unknown" }), "ROLE_REQUIRED");
  assert.equal(recoveryReason({ ...safe, lane: "SAMPLE" }), "SAMPLE_RUN");
  for (const roundState of [
    "CLOSED",
    "CANCELLING",
    "CANCELLED",
    "DRAFT",
    "READY",
  ])
    assert.equal(recoveryReason({ ...safe, roundState }), "ROUND_CLOSED");
  assert.equal(recoveryReason({ ...safe, parentCompleted: true }), "SETTLED");
  assert.equal(
    recoveryReason({ ...safe, jobResult: "WRONG_ANSWER" }),
    "SETTLED",
  );
  assert.equal(
    recoveryReason({
      ...safe,
      attempts: [...safe.attempts, { result: null, released_at: null }],
    }),
    "PHYSICAL_HOLD",
  );
  assert.equal(
    recoveryReason({ ...safe, extraAuthorised: true }),
    "EXTRA_DISPATCH_USED",
  );
  assert.equal(
    recoveryReason({
      ...safe,
      attempts: [...safe.attempts, safe.attempts[0]!],
    }),
    "EXTRA_DISPATCH_USED",
  );
  assert.equal(
    recoveryReason({ ...safe, attempts: safe.attempts.slice(0, 2) }),
    "AUTOMATIC_RECOVERY",
  );
  assert.equal(
    recoveryReason({
      ...safe,
      attempts: [
        { result: "WRONG_ANSWER", released_at: "verified-release" },
        ...safe.attempts.slice(1),
      ],
    }),
    "NOT_INFRASTRUCTURE",
  );
});
