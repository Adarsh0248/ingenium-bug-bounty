import assert from "node:assert/strict";
import { test } from "node:test";
import { operationsStatus } from "../src/maintenance/operations.js";

const observation = () => ({
  observed_at: new Date().toISOString(),
  quarantined: false,
  clock_state: "HEALTHY",
  clock_fault: false,
  clock_running: true,
  database_bytes: "1024",
  connections: "1",
  connection_limit: "100",
  waiting_locks: "0",
  official_pending: "0",
  sample_pending: "0",
  official_age_ms: "0",
  validation_pending: "0",
  physical_holds: "0",
  physical_slots: "2",
  quarantined_epochs: "0",
  outbox_rows: "0",
  outbox_reserved: "0",
  outbox_unpublished: "0",
  outbox_age_ms: "0",
  participant_accounted_bytes: "0",
  quota_keys: "0",
  retention_age_ms: "0",
});
test("operations preserves unknown external checks rather than reporting an unproved all-clear", () => {
  const value = operationsStatus(observation());
  assert.equal(value.state, "UNKNOWN");
  assert.equal(value.metrics.length, 15);
  assert.equal(value.unverified.length, 5);
  assert.ok(value.metrics.every((m) => m.state === "OK"));
  assert.equal(
    operationsStatus({ ...observation(), quarantined: true }).state,
    "CRITICAL",
  );
  assert.equal(
    operationsStatus({ ...observation(), clock_fault: true }).state,
    "CRITICAL",
  );
  assert.equal(
    operationsStatus({
      ...observation(),
      clock_state: "STOPPED",
      clock_running: false,
    }).state,
    "WARNING",
  );
});
test("operations uses exact thresholds and counts committed plus reserved outbox obligations", () => {
  for (const [field, low, high] of [
    ["connections", "69", "70"],
    ["outbox_age_ms", "2000", "2001"],
    ["official_age_ms", "299999", "300000"],
    ["retention_age_ms", "180000", "180001"],
  ]) {
    assert.equal(
      operationsStatus({ ...observation(), [field!]: low }).state,
      "UNKNOWN",
    );
    assert.equal(
      operationsStatus({ ...observation(), [field!]: high }).state,
      "WARNING",
    );
  }
  const value = operationsStatus({
    ...observation(),
    outbox_rows: "100000",
    outbox_reserved: "140000",
  });
  assert.equal(value.state, "CRITICAL");
  assert.equal(
    value.metrics.find((m) => m.id === "OUTBOX_ACCOUNTED_ROWS")!.value,
    "240000",
  );
  assert.equal(
    operationsStatus({ ...observation(), retention_age_ms: null }).metrics.at(
      -1,
    )!.state,
    "UNKNOWN",
  );
});
test("operations rejects missing, negative, malformed and oversized measurements without coercion", () => {
  for (const bad of [
    null,
    {},
    { ...observation(), observed_at: "invalid" },
    { ...observation(), clock_state: "READY" },
    ...["-1", 1, "01", "1.2", "1e6", "9".repeat(20), undefined].map(
      (official_age_ms) => ({ ...observation(), official_age_ms }),
    ),
  ])
    assert.throws(() => operationsStatus(bad));
});
