import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { test } from "node:test";
import type { Pool, PoolClient } from "pg";
import { createWorkerClock } from "../src/clock/worker-consumer.js";
import { SECOND } from "../src/clock/policy.js";

function fixture() {
  let current = 100n * SECOND,
    fail = false,
    quarantined = false,
    loseAck = false,
    sequence = 0;
  const boot = randomUUID(),
    runtime = randomUUID(),
    faults: unknown[][] = [];
  let row: Record<string, unknown>;
  const client = {
    on() {},
    removeListener() {},
    release() {},
    async query(sql: string, args?: unknown[]) {
      if (fail) throw new Error("Private database failure");
      if (sql.includes("restore_is_quarantined"))
        return { rows: [{ quarantined }], rowCount: 1 };
      if (sql.includes("FROM clock_health"))
        return { rows: [structuredClone(row)], rowCount: 1 };
      if (sql.includes("record_worker_clock_fault")) faults.push(args!);
      if (sql === "COMMIT" && loseAck) {
        loseAck = false;
        throw new Error("Synthetic lost commit acknowledgement");
      }
      return { rows: [], rowCount: 1 };
    },
  } as unknown as PoolClient;
  const pool = {
    async connect() {
      return client;
    },
  } as unknown as Pool;
  function sample() {
    row = {
      runtime_id: runtime,
      boot_id: boot,
      running: true,
      fault_latched: false,
      fault_generation: "0",
      state: "HEALTHY",
      sequence: String(++sequence),
      received_ns: current.toString(),
      healthy_count: 7,
      report: {
        policy: 1,
        boot_id: boot,
        nonce: randomBytes(32).toString("base64url"),
        sequence: String(sequence),
        boottime_before_ns: current.toString(),
        boottime_after_ns: current.toString(),
        realtime_ns: (10000n * SECOND + current).toString(),
        system_offset_ns: "0",
        root_delay_ns: "0",
        root_dispersion_ns: "0",
        synchronised: true,
        source_ok: true,
      },
    };
  }
  sample();
  const clock = createWorkerClock(pool, {
    bootId: boot,
    nowNs: () => current,
    resolutionNs: 0n,
  });
  async function establish() {
    for (let i = 0; i < 7; i++) {
      if (i) {
        current += 5n * SECOND;
        sample();
      }
      await clock.pollOnce();
      if (i < 6) assert.throws(() => clock.guard.assertHealthy());
    }
    clock.guard.assertHealthy();
  }
  return {
    clock,
    client,
    faults,
    establish,
    sample,
    row: () => row,
    advance(ns: bigint) {
      current += ns;
    },
    fail(value: boolean) {
      fail = value;
    },
    quarantine() {
      quarantined = true;
    },
    loseAck() {
      loseAck = true;
    },
  };
}
test("restore quarantine discards cached worker clock trust without clearing the independent gate", async () => {
  const f = fixture();
  await f.establish();
  f.quarantine();
  await assert.rejects(
    f.clock.pollOnce(),
    (error: any) => error.code === "RESTORE_QUARANTINED",
  );
  assert.throws(() => f.clock.guard.assertHealthy());
  assert.equal(
    f.faults.length,
    0,
    "Restore quarantine is not an invented clock incident.",
  );
});
test("worker clock establishes its own seven fresh observations and cannot renew freshness from duplicate database reports", async () => {
  const f = fixture();
  assert.throws(() => f.clock.guard.assertHealthy());
  await f.establish();
  await f.clock.guard.verify(f.client);
  f.advance(14n * SECOND);
  await f.clock.pollOnce();
  f.clock.guard.assertHealthy();
  f.advance(SECOND);
  assert.throws(() => f.clock.guard.assertHealthy());
  await f.clock.flush();
  assert.equal(f.faults[0]![3], "STALE_REPORT");
});
test("worker clock rejects altered, future, foreign-boot and regressed reports instead of accepting stored HEALTHY alone", async () => {
  for (const corrupt of [
    (r: Record<string, unknown>) => {
      r.boot_id = randomUUID();
    },
    (r: Record<string, unknown>) => {
      r.received_ns = "900000000000000";
    },
    (r: Record<string, unknown>) => {
      (r.report as Record<string, unknown>).source_ok = false;
    },
    (r: Record<string, unknown>) => {
      (r.report as Record<string, unknown>).nonce = "bad";
    },
    (r: Record<string, unknown>) => {
      r.sequence = "0";
    },
  ]) {
    const f = fixture();
    await f.establish();
    corrupt(f.row());
    await assert.rejects(f.clock.pollOnce());
    assert.throws(() => f.clock.guard.assertHealthy());
    await f.clock.flush();
    assert.equal(f.faults.length, 1);
  }
});
test("worker clock binds each transaction to the same current runtime/generation and never becomes a recovery grant", async () => {
  const f = fixture();
  await f.establish();
  f.row().fault_generation = "1";
  f.row().fault_latched = true;
  f.row().state = "FAULT";
  await assert.rejects(f.clock.guard.verify(f.client));
  assert.throws(() => f.clock.guard.assertHealthy());
  await f.clock.pollOnce();
  assert.throws(() => f.clock.guard.assertHealthy());
});
test("consumer faults preserve one original durable incident key across a lost acknowledgement and monotonic reversal", async () => {
  const f = fixture();
  await f.establish();
  f.clock.guard.fault("CLOCK_REVERSED");
  f.fail(true);
  await assert.rejects(f.clock.flush());
  f.fail(false);
  f.loseAck();
  await assert.rejects(f.clock.flush());
  await f.clock.flush();
  await f.clock.flush();
  assert.equal(f.faults.length, 2);
  assert.equal(f.faults[0]![2], f.faults[1]![2]);
  assert.equal(f.faults[0]![3], "CLOCK_REVERSED");
  const other = fixture();
  await other.establish();
  other.advance(-SECOND);
  assert.throws(() => other.clock.guard.assertHealthy());
  await other.clock.flush();
  assert.equal(other.faults[0]![3], "MONOTONIC_REVERSED");
});
