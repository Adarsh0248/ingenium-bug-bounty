import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { TestContext } from "node:test";
import { fileURLToPath } from "node:url";
import { authoringPayloadDigest, acceptAuthoringObservation } from "../../src/content/execution-policy.js";
import { acceptJudgeReply, judgeJson, readJudgeJson } from "../../src/content/judge-protocol.js";
import { createJudgeExecutionWorker } from "../../src/judge/execution-worker.js";
import { exchangeProtectedProcess } from "../../src/judge/executor.js";
import type { TrustedProtectedExecutor } from "../../src/judge/executor.js";
import { createJudgeQueue, publishJudgeTurn } from "../../src/judge/queue.js";
import type { judgeQueueChecks } from "./judge-queue.checks.js";
import { createTestRedis } from "../fixtures/redis.js";

export async function judgeExecutionChecks(t: TestContext, context: Parameters<typeof judgeQueueChecks>[1]) {
  const { owner, publisherPool, registry, supervisor, publisher, fresh, payload, config } = context;
  const redis = await createTestRedis(), queue = createJudgeQueue({ ...redis.settings, hostEpochId: config.hostEpochId, bootId: config.bootId });
  const signal = () => AbortSignal.timeout(15000), calls: string[] = [];
  const retained = new Map<string, ReturnType<typeof JSON.parse>>();
  const fixture = fileURLToPath(new URL("../fixtures/executor-child.cjs", import.meta.url));
  const executor: TrustedProtectedExecutor = {
    hostEpochId: config.hostEpochId, bootId: config.bootId, runtimes: config.runtimes,
    async assertReady() { /* Synthetic environment only; no real sandbox is installed. */ },
    async exchange(request, stopped) {
      calls.push(request.operation);
      const row = await supervisor.execution(request.payload.attempt_id);
      assert.ok(row); assert.equal(row.owner, request.permit_owner); assert.equal(row.providerToken, request.provider_token);
      if (request.operation === "RECOVER") return { protocol: request.protocol, operation: request.operation, request_id: request.request_id,
        host_epoch_id: request.host_epoch_id, boot_id: request.boot_id, permit_owner: request.permit_owner,
        reply: retained.has(request.payload.attempt_id) ? { ...retained.get(request.payload.attempt_id), request_id: request.request_id } : null };
      assert.equal(row.evidence, null);
      assert.ok(await supervisor.beginLaunch(row.payload.attemptId, row.providerToken, row.owner));
      const result = readJudgeJson(await exchangeProtectedProcess({ file: process.execPath, args: [fixture, "reply"] }, Buffer.from(judgeJson(request)), stopped)) as { reply: unknown };
      retained.set(request.payload.attempt_id, JSON.parse(judgeJson(result.reply))); return result;
    },
  };
  const worker = (driver = executor, store = supervisor) => createJudgeExecutionWorker(store, queue, driver);
  async function register(language: ReturnType<typeof payload>["language"] = "cpp") {
    await fresh(); const p = { ...payload(), language, runtimeKey: config.runtimes.get(language)!.key, runtimeDigest: config.runtimes.get(language)!.digest };
    const token = (await registry.admit(p, randomUUID())).value.provider_token!;
    await publishJudgeTurn(publisher, queue, signal()); return { p, token };
  }
  async function observed(p: ReturnType<typeof payload>) {
    const nonce = randomUUID(), result = await registry.observe(p.attemptId, authoringPayloadDigest(p).toString("hex"), nonce);
    return acceptJudgeReply(result.value, p, nonce, result.status);
  }
  try {
    await t.test("execution worker consumes one committed permit, crosses real pipes and seals five-language results for the backend checker", async () => {
      const before = calls.length;
      for (const language of ["c", "cpp", "java", "python", "javascript"] as const) {
        const { p, token } = await register(language);
        assert.deepEqual(await worker().run(signal()), { state: "SEALED", attemptId: p.attemptId });
        const result = acceptAuthoringObservation(p, await observed(p), Buffer.from("12\n"), "EXACT_TEXT")!;
        assert.equal(result.result, "PASSED"); assert.ok(result.release);
        const row = await supervisor.execution(p.attemptId); assert.ok(row); assert.equal(row.providerToken, token);
        assert.equal(await supervisor.claim(p.attemptId, token, randomUUID()), null);
      }
      assert.deepEqual(calls.slice(before), Array(5).fill("EXECUTE"));
    });
    await t.test("failed launcher preflight consumes no permit, and unknown/unclaimed recovery cannot launch anything", async () => {
      const { p } = await register(), before = calls.length;
      assert.deepEqual(await worker().recover(randomUUID(), signal()), { state: "NO_EXECUTION" });
      assert.deepEqual(await worker().recover(p.attemptId, signal()), { state: "NO_EXECUTION" });
      const failed = worker({ ...executor, async assertReady() { throw new Error("Synthetic unavailable launcher"); } });
      await assert.rejects(failed.run(signal())); assert.equal(await supervisor.execution(p.attemptId), null); assert.equal(calls.length, before);
      assert.deepEqual(await worker().run(signal()), { state: "SEALED", attemptId: p.attemptId });
    });
    await t.test("lost launcher response holds its original owner; replacement recovers retained evidence without readiness or a second launch", async () => {
      const { p } = await register(), before = calls.length;
      const lost = worker({ ...executor, async exchange(request, stopped) { await executor.exchange(request, stopped); throw new Error("Lost fixed launcher response"); } });
      await assert.rejects(lost.run(signal())); const held = await supervisor.execution(p.attemptId); assert.ok(held); assert.equal(held.evidence, null);
      assert.deepEqual(await worker().run(signal()), { state: "DUPLICATE" });
      await owner.query("UPDATE ingenium_judge.control SET ready_until='-infinity'");
      const replacement = worker({ ...executor, async assertReady() { throw new Error("Recovery must not request new execution readiness"); } });
      assert.deepEqual(await replacement.recover(p.attemptId, signal()), { state: "SEALED", attemptId: p.attemptId });
      const after = await supervisor.execution(p.attemptId); assert.equal(after!.owner, held.owner); assert.ok(after!.evidence.metadata.drain);
      assert.deepEqual(calls.slice(before), ["EXECUTE", "RECOVER"]); await fresh();
    });
    await t.test("lost seal commit acknowledgement resolves from PostgreSQL without even invoking the retained-result reader", async () => {
      const { p } = await register(), before = calls.length;
      const lostStore = { ...supervisor, async seal(...args: Parameters<typeof supervisor.seal>) { await supervisor.seal(...args); throw new Error("Lost fixed seal acknowledgement"); } };
      await assert.rejects(worker(executor, lostStore).run(signal())); assert.ok((await supervisor.execution(p.attemptId))!.evidence.metadata.drain);
      const forbidden = { ...executor, async assertReady() { throw new Error("No preflight"); }, async exchange() { throw new Error("No launcher call"); } };
      assert.deepEqual(await worker(forbidden).recover(p.attemptId, signal()), { state: "SEALED", attemptId: p.attemptId });
      assert.deepEqual(calls.slice(before), ["EXECUTE"]);
    });
    await t.test("foreign or malformed protected replies cannot seal a result or release a physical slot, but the original retained evidence can", async () => {
      for (const fault of ["boot", "owner", "challenge", "token", "bytes", "runtime", "unknown"]) {
        const { p } = await register();
        const bad = { ...executor, async exchange(request: Parameters<typeof executor.exchange>[0], stopped: AbortSignal) {
          const response = JSON.parse(judgeJson(await executor.exchange(request, stopped)));
          if (fault === "boot") response.boot_id = randomUUID();
          if (fault === "owner") response.permit_owner = randomUUID();
          if (fault === "challenge") response.request_id = randomUUID();
          if (fault === "token") response.reply.provider_token = randomUUID();
          if (fault === "bytes") response.reply.evidence.stdout_b64 = Buffer.from("changed").toString("base64");
          if (fault === "runtime") response.reply.evidence.metadata.runtime_digest = "0".repeat(64);
          if (fault === "unknown") response.extra = true;
          return response;
        } };
        await assert.rejects(worker(bad).run(signal())); const row = await supervisor.execution(p.attemptId); assert.ok(row); assert.equal(row.evidence, null);
        assert.equal((await owner.query("SELECT drain FROM ingenium_judge.attempts WHERE attempt_id=$1", [p.attemptId])).rows[0].drain, null);
        assert.deepEqual(await worker().recover(p.attemptId, signal()), { state: "SEALED", attemptId: p.attemptId });
      }
    });
    await t.test("a missing retained checkpoint leaves uncertainty held until the same original result becomes available", async () => {
      const { p } = await register(), before = calls.length;
      await assert.rejects(worker({ ...executor, async exchange(request, stopped) { await executor.exchange(request, stopped); throw new Error("Lost fixed result"); } }).run(signal()));
      const evidence = retained.get(p.attemptId); retained.delete(p.attemptId);
      assert.deepEqual(await worker().recover(p.attemptId, signal()), { state: "RECOVERY_REQUIRED", attemptId: p.attemptId });
      assert.equal((await supervisor.execution(p.attemptId))!.evidence, null);
      retained.set(p.attemptId, evidence);
      assert.deepEqual(await worker().recover(p.attemptId, signal()), { state: "SEALED", attemptId: p.attemptId });
      assert.deepEqual(calls.slice(before), ["EXECUTE", "RECOVER", "RECOVER"]);
    });
    await t.test("late positive cleanup preserves sealed bytes and result digest instead of rerunning or rewriting the result", async () => {
      const { p } = await register(), before = calls.length;
      const undrained = { ...executor, async exchange(request: Parameters<typeof executor.exchange>[0], stopped: AbortSignal) {
        const value = JSON.parse(judgeJson(await executor.exchange(request, stopped))); value.reply.evidence.metadata.drain = null; return value;
      } };
      await worker(undrained).run(signal()); const held = acceptAuthoringObservation(p, await observed(p), Buffer.from("12\n"), "EXACT_TEXT")!; assert.equal(held.release, null);
      await worker().recover(p.attemptId, signal()); const complete = acceptAuthoringObservation(p, await observed(p), Buffer.from("12\n"), "EXACT_TEXT")!;
      assert.deepEqual(complete.metadata, held.metadata); assert.ok(complete.release); assert.deepEqual(calls.slice(before), ["EXECUTE", "RECOVER"]);
    });
    await t.test("an overlapping turn is refused and a second worker cannot turn the first owner's running permit into a new launch", async () => {
      const { p } = await register(), before = calls.length; let release = () => {}; let entered = () => {};
      const gate = new Promise<void>(resolve => { release = resolve; }), ready = new Promise<void>(resolve => { entered = resolve; });
      const slow = worker({ ...executor, async exchange(request, stopped) { entered(); await gate; return executor.exchange(request, stopped); } });
      const running = slow.run(signal());
      try {
        await ready; await assert.rejects(slow.run(signal()), /busy/);
        assert.deepEqual(await worker().run(signal()), { state: "DUPLICATE" });
      } finally { release(); }
      assert.deepEqual(await running, { state: "SEALED", attemptId: p.attemptId }); assert.deepEqual(calls.slice(before), ["EXECUTE"]);
    });
    await t.test("recovery lookup is supervisor-only and cannot cross immutable boot/runtime bindings", async () => {
      await assert.rejects(publisherPool.query("SELECT ingenium_judge.execution($1,$2,$3)", [config.hostEpochId, config.bootId, randomUUID()]), { code: "42501" });
      await assert.rejects(owner.query("SELECT ingenium_judge.execution($1,$2,$3)", [config.hostEpochId, randomUUID(), randomUUID()]));
      assert.throws(() => worker({ ...executor, bootId: randomUUID() }), /registered host/);
      assert.throws(() => worker({ ...executor, hostEpochId: randomUUID() }), /registered host/);
      const runtimes = new Map(config.runtimes); runtimes.set("cpp", { key: "changed", digest: "0".repeat(64) });
      assert.throws(() => worker({ ...executor, runtimes }), /registered host/);
    });
    await publishJudgeTurn(publisher, queue, signal()); assert.deepEqual(await queue.entries(signal()), []);
  } finally { queue.close(); await redis.close(); }
}
