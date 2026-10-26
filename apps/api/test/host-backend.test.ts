import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { checkedRetirementRequest } from "../src/judge/host-backend.js";

test("full-host retirement cannot certify a foreign attempt, boot, release, context or evidence", () => {
  const common = { version: 1 as const, host_epoch_id: randomUUID(), boot_id: randomUUID(), attempt_id: randomUUID(), plan_sha256: "a".repeat(64),
    container_id: "b".repeat(64), cgroup_parent: `/ingenium-exec-${"c".repeat(32)}`, release_sha256: "d".repeat(64), context_sha256: "e".repeat(64), evidence_sha256: "f".repeat(64) };
  const request = { ...common, nonce: randomUUID() };
  assert.equal(checkedRetirementRequest(request, common), request);
  for (const key of Object.keys(common)) assert.throws(() => checkedRetirementRequest({ ...request, [key]: "other" }, common));
  assert.throws(() => checkedRetirementRequest({ ...request, nonce: "invalid" }, common));
  assert.throws(() => checkedRetirementRequest({ ...request, extra: true } as typeof request, common));
});
