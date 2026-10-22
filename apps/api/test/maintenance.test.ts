import assert from "node:assert/strict";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { maintenanceLoop } from "../src/maintenance/loop.js";

test("maintenance never overlaps, and shutdown waits for the active batch without another tick", async () => {
  let calls = 0,
    stopped = false;
  let release!: () => void;
  const blocked = new Promise<void>((resolve) => {
    release = resolve;
  });
  const close = maintenanceLoop(
    async () => {
      calls++;
      await blocked;
    },
    1,
    () => assert.fail("Unexpected task failure"),
  );
  await delay(20);
  assert.equal(calls, 1);
  const closing = close().then(() => {
    stopped = true;
  });
  await delay(10);
  assert.equal(stopped, false);
  release();
  await closing;
  await close();
  await delay(10);
  assert.equal(calls, 1);
});

test("a failed maintenance batch is reported and retried without an unhandled rejection", async () => {
  let calls = 0,
    failures = 0;
  let ready!: () => void;
  const resumed = new Promise<void>((resolve) => {
    ready = resolve;
  });
  const close = maintenanceLoop(
    async () => {
      if (++calls === 1) throw new Error("Private diagnostic");
      ready();
    },
    1,
    () => {
      failures++;
    },
  );
  try {
    await Promise.race([
      resumed,
      delay(1000).then(() => assert.fail("No retry")),
    ]);
  } finally {
    await close();
  }
  assert.equal(failures, 1);
  assert.ok(calls >= 2);
});
