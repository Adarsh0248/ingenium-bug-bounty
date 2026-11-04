import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { test } from "node:test";
import type { Pool } from "pg";
import { createJudgeSupervisorStore } from "../src/judge/registry.js";
import { judgeRuntimes } from "./fixtures/judge.js";

test("two retirement lanes bound concurrent scans and release the original session after refusal", async () => {
  const locks = new Set<number>(); let released = 0, active = 0, maximum = 0;
  const pool = { async connect() {
    let owned: number | null = null;
    return { on() {}, removeListener() {},
      async query(_sql: string, args: number[]) {
        const key = args[1]!; if (locks.has(key)) return { rows: [{ locked: false }] };
        locks.add(key); owned = key; return { rows: [{ locked: true }] };
      },
      release(destroy: boolean) { assert.equal(destroy, true); if (owned !== null) locks.delete(owned); released++; },
    };
  } } as unknown as Pool;
  const store = createJudgeSupervisorStore(pool, { hostEpochId: randomUUID(), bootId: randomUUID(), runtimes: judgeRuntimes() });
  const scan = async () => { active++; maximum = Math.max(maximum, active); await delay(10); active--; };
  await Promise.all(Array.from({ length: 8 }, (_, i) => store.withRetirementInspection(AbortSignal.timeout(2000), scan, i % 2)));
  assert.equal(maximum, 2); assert.equal(released, 8); assert.equal(locks.size, 0);
  await assert.rejects(store.withRetirementInspection(AbortSignal.timeout(2000), async () => { throw new Error("Inspection refused"); }, 1), /Inspection refused/);
  assert.equal(locks.size, 0); assert.equal(released, 9);
  await assert.rejects(store.withRetirementInspection(AbortSignal.timeout(2000), scan, 2), /Unknown/);
  const stop = new AbortController(); stop.abort();
  await assert.rejects(store.withRetirementInspection(stop.signal, scan)); assert.equal(released, 9);
});
