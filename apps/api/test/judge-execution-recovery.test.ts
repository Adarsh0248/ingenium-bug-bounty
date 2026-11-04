import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { createJudgeExecutionWorker } from "../src/judge/execution-worker.js";
import type { createJudgeSupervisorStore } from "../src/judge/registry.js";
import type { createJudgeQueue } from "../src/judge/queue.js";
import { judgePayload, judgeReply, judgeRuntimes } from "./fixtures/judge.js";

test("a lost launcher acknowledgement reconciles only the exact already-sealed positive drain", async () => {
  const payload = judgePayload(), bootId = randomUUID(), owner = randomUUID(), providerToken = randomUUID(), runtimes = judgeRuntimes();
  const original = { payload, owner, providerToken, started: true, evidence: null };
  const evidence = judgeReply(payload, randomUUID(), Buffer.from("12\n"), providerToken).evidence;
  for (const fault of ["none", "undrained", "unstarted", "owner", "token", "source", "absent", "database"]) {
    let reads = 0, exchanges = 0;
    const saved = { ...original, evidence: structuredClone(evidence) };
    if (fault === "undrained") saved.evidence.metadata.drain = null;
    if (fault === "unstarted") saved.started = false;
    if (fault === "owner") saved.owner = randomUUID();
    if (fault === "token") saved.providerToken = randomUUID();
    if (fault === "source") saved.payload = { ...payload, source: Buffer.from("changed") };
    const store = { hostEpochId: payload.hostEpochId, bootId, runtimes,
      async execution() { if (++reads === 1) return original; if (fault === "database") throw new Error("Database unavailable"); return fault === "absent" ? null : saved; },
      async seal() { assert.fail("Sealed evidence must not be rewritten"); },
    } as unknown as ReturnType<typeof createJudgeSupervisorStore>;
    const queue = { hostEpochId: payload.hostEpochId, bootId } as ReturnType<typeof createJudgeQueue>;
    const executor = { hostEpochId: payload.hostEpochId, bootId, runtimes,
      async assertReady() { assert.fail("Recovery must not admit work"); },
      async exchange() { exchanges++; throw new Error("Lost launcher acknowledgement"); },
    };
    const worker = createJudgeExecutionWorker(store, queue, executor);
    if (fault === "none") assert.deepEqual(await worker.recover(payload.attemptId, AbortSignal.timeout(2000)), { state: "SEALED", attemptId: payload.attemptId });
    else await assert.rejects(worker.recover(payload.attemptId, AbortSignal.timeout(2000)), /Lost launcher acknowledgement/);
    assert.equal(reads, 2); assert.equal(exchanges, 1);
  }
});
