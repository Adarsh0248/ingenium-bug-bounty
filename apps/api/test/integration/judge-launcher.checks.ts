import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { TestContext } from "node:test";
import { sha256 } from "../../src/access/credentials.js";
import { authoringPayloadDigest } from "../../src/content/execution-policy.js";
import { judgeJson, readJudgeJson, runtimeRecord } from "../../src/content/judge-protocol.js";
import { acceptExecutionReply, EXECUTOR_PROTOCOL, executionRequest } from "../../src/judge/executor.js";
import { EXECUTION_PLAN_SHA256 } from "../../src/judge/execution-plan.js";
import { createGuardedLauncher } from "../../src/judge/launcher.js";
import type { TrustedSandboxBackend } from "../../src/judge/launcher.js";
import type { ExecutionClaim } from "../../src/judge/executor.js";
import type { judgeQueueChecks } from "./judge-queue.checks.js";
import { judgeReply } from "../fixtures/judge.js";
import { retirementFixture } from "../fixtures/retirement.js";
import { createCapsuleRetirement } from "../../src/judge/capsule-retirement.js";

export async function judgeLauncherChecks(t: TestContext, context: Parameters<typeof judgeQueueChecks>[1]) {
  const { owner, publisherPool, registry, supervisor, fresh, payload, config } = context;
  const signal = () => AbortSignal.timeout(15000);
  const retained = new Map<string, unknown>(); let executions = 0, recoveries = 0, readiness = 0;
  const backend: TrustedSandboxBackend = {
    policySha256: EXECUTION_PLAN_SHA256,
    async assertReady() { readiness++; return sha256("Synthetic launcher test, not a certified kernel backend"); },
    async execute(plan) {
      executions++;
      const saved = await supervisor.execution(plan.attemptId); assert.ok(saved?.started);
      assert.deepEqual(saved.payload.source, plan.source); assert.deepEqual(saved.payload.stdin, plan.stdin);
      assert.equal(saved.owner, plan.owner); assert.equal(saved.providerToken, plan.providerToken);
      // A backend call must not inherit an open database transaction/row lock.
      assert.equal((await owner.query("SELECT id FROM ingenium_judge.control WHERE id=1 FOR UPDATE NOWAIT")).rows[0].id, 1);
      const evidence = judgeReply(saved.payload, randomUUID(), undefined, saved.providerToken).evidence;
      retained.set(plan.attemptId, JSON.parse(judgeJson(evidence))); return evidence;
    },
    async recover(plan) { recoveries++; return retained.get(plan.attemptId) ?? null; },
  };
  const launcher = (engine = backend, store = supervisor) => createGuardedLauncher(store, engine);
  async function register(): Promise<ExecutionClaim> {
    await fresh(); const p = payload(), token = (await registry.admit(p, randomUUID())).value.provider_token!, worker = randomUUID();
    assert.deepEqual(await supervisor.claim(p.attemptId, token, worker), p); return { payload: p, owner: worker, providerToken: token };
  }
  async function handle(c: ExecutionClaim, operation: "EXECUTE" | "RECOVER", service = launcher(), stopped = signal()) {
    const request = executionRequest(c, config.bootId, config.runtimes, operation);
    const result = readJudgeJson(await service.handle(Buffer.from(judgeJson(request)), operation, stopped));
    return acceptExecutionReply(result, c, request);
  }
  await t.test("general launcher READY is challenge/runtime-bound and cannot mint the independent registry readiness lease", async () => {
    const request = { protocol: EXECUTOR_PROTOCOL, operation: "READY", request_id: randomUUID(), host_epoch_id: config.hostEpochId, boot_id: config.bootId, runtimes: runtimeRecord(config.runtimes) };
    const before = (await owner.query("SELECT ready_until,readiness_proof FROM ingenium_judge.control")).rows[0];
    const response = readJudgeJson(await launcher().handle(Buffer.from(judgeJson(request)), "READY", signal())) as Record<string, unknown>;
    assert.equal(response.ready, true); assert.equal(response.request_id, request.request_id); assert.match(response.proof_digest as string, /^[0-9a-f]{64}$/);
    assert.deepEqual((await owner.query("SELECT ready_until,readiness_proof FROM ingenium_judge.control")).rows[0], before);
    for (const changed of [{ boot_id: randomUUID() }, { host_epoch_id: randomUUID() }, { extra: true }, { runtimes: {} }]) {
      await assert.rejects(launcher().handle(Buffer.from(judgeJson({ ...request, ...changed })), "READY", signal()));
    }
    await assert.rejects(launcher().handle(Buffer.from(judgeJson(request)), "EXECUTE", signal()));
    await assert.rejects(launcher({ ...backend, async assertReady() { return Buffer.alloc(0); } }).handle(Buffer.from(judgeJson(request)), "READY", signal()));
    assert.throws(() => launcher({ ...backend, policySha256: "0".repeat(64) }), /policy/);
  });
  await t.test("an owned worker claim alone cannot seal evidence; only a committed launcher start opens that gate", async () => {
    const c = await register(), before = (await owner.query("SELECT retained_bytes FROM ingenium_judge.control")).rows[0].retained_bytes;
    await assert.rejects(supervisor.seal(c.payload, c.providerToken, c.owner, judgeReply(c.payload, randomUUID(), undefined, c.providerToken).evidence), { code: "23514" });
    assert.equal((await supervisor.execution(c.payload.attemptId))!.started, false);
    assert.equal((await supervisor.execution(c.payload.attemptId))!.evidence, null);
    assert.equal((await owner.query("SELECT retained_bytes FROM ingenium_judge.control")).rows[0].retained_bytes, before);
    assert.ok(await handle(c, "EXECUTE")); assert.equal((await supervisor.execution(c.payload.attemptId))!.started, true);
  });
  await t.test("overlapping independent launcher calls commit one backend start; later calls return the sealed original result", async () => {
    const c = await register(), before = executions;
    const replies = await Promise.allSettled(Array.from({ length: 8 }, () => handle(c, "EXECUTE", launcher())));
    assert.ok(replies.some(reply => reply.status === "fulfilled")); assert.equal(executions, before + 1);
    const saved = await supervisor.execution(c.payload.attemptId); assert.ok(saved?.started && saved.evidence);
    assert.equal(await supervisor.beginLaunch(c.payload.attemptId, c.providerToken, c.owner), null);
    assert.ok(await handle(c, "EXECUTE")); assert.equal(executions, before + 1);
    await assert.rejects(owner.query("UPDATE ingenium_judge.attempts SET launch_started_at=NULL WHERE attempt_id=$1", [c.payload.attemptId]), { code: "P0001" });
    await assert.rejects(owner.query("UPDATE ingenium_judge.attempts SET launch_started_at=clock_timestamp() WHERE attempt_id=$1", [c.payload.attemptId]), { code: "P0001" });
  });
  await t.test("wrong owner, token, valid-but-changed source or options cannot start or rewrite the registered payload", async () => {
    const c = await register(), before = executions;
    for (const changed of [{ ...c, owner: randomUUID() }, { ...c, providerToken: randomUUID() }, { ...c, payload: { ...c.payload, source: Buffer.from("changed, but valid new digest") } }]) {
      await assert.rejects(handle(changed, "EXECUTE"));
    }
    const request = executionRequest(c, config.bootId, config.runtimes, "EXECUTE");
    await assert.rejects(launcher().handle(Buffer.from(judgeJson({ ...request, command: "/bin/sh" })), "EXECUTE", signal()));
    assert.equal(executions, before); assert.equal((await supervisor.execution(c.payload.attemptId))!.started, false);
    assert.ok(await handle(c, "EXECUTE"));
  });
  await t.test("producer persists checked evidence before reply, so lost output and an expired lease recover without a backend call", async () => {
    const c = await register(), before = executions, seen = recoveries;
    await handle(c, "EXECUTE"); // Discard the acknowledged body as if the caller never received it.
    await owner.query("UPDATE ingenium_judge.control SET ready_until='-infinity'");
    const forbidden = launcher({ ...backend, async assertReady() { throw new Error("No new readiness"); }, async execute() { throw new Error("No new launch"); }, async recover() { throw new Error("No checkpoint read"); } });
    assert.ok(await handle(c, "RECOVER", forbidden)); assert.ok(await handle(c, "EXECUTE", forbidden));
    assert.equal(executions, before + 1); assert.equal(recoveries, seen); await fresh();
  });
  await t.test("invalid backend evidence stays held, and late cleanup can only extend the same sealed result", async () => {
    const c = await register(), before = executions;
    const invalid = launcher({ ...backend, async execute(plan, stopped) {
      const value = await backend.execute(plan, stopped) as { stdout_b64: string }; value.stdout_b64 = "Y2hhbmdlZA=="; return value;
    } });
    await assert.rejects(handle(c, "EXECUTE", invalid)); assert.equal((await supervisor.execution(c.payload.attemptId))!.evidence, null);
    const partial = launcher({ ...backend, async recover(plan, stopped) {
      const value = JSON.parse(judgeJson(await backend.recover(plan, stopped))); value.metadata.drain = null; return value;
    } });
    assert.ok(await handle(c, "RECOVER", partial)); const held = (await supervisor.execution(c.payload.attemptId))!;
    assert.equal(held.evidence.metadata.drain, null);
    assert.ok(await handle(c, "RECOVER")); const complete = (await supervisor.execution(c.payload.attemptId))!;
    const { drain: _proof, ...metadata } = complete.evidence.metadata;
    const { drain: _none, ...old } = held.evidence.metadata;
    assert.deepEqual(metadata, old); assert.ok(complete.evidence.metadata.drain); assert.equal(executions, before + 1);
  });
  await t.test("launcher start is supervisor-only and read-only recovery of a claimed-but-unstarted job does not contact the backend", async () => {
    const c = await register(), before = recoveries;
    assert.equal(await handle(c, "RECOVER"), null); assert.equal(recoveries, before);
    await assert.rejects(publisherPool.query("SELECT ingenium_judge.begin_launch($1,$2,$3,$4,$5)", [config.hostEpochId, config.bootId, c.payload.attemptId, c.providerToken, c.owner]), { code: "42501" });
    assert.equal((await owner.query("SELECT has_function_privilege('ingenium_judge_gateway','ingenium_judge.begin_launch(uuid,uuid,uuid,uuid,uuid)','EXECUTE') AS allowed")).rows[0].allowed, false);
    await assert.rejects(supervisor.beginLaunch(c.payload.attemptId, c.providerToken, randomUUID()), { code: "22023" });
    assert.ok(await handle(c, "EXECUTE"));
  });
  await t.test("certified retirement frees exactly the original physical slot through normal recovery, while duplicate proofs preserve all other holds", async () => {
    const previous = (await owner.query("SELECT attempt_id,permit_owner,evidence,drain FROM ingenium_judge.attempts WHERE permit_owner IS NOT NULL AND drain IS NULL ORDER BY attempt_id")).rows;
    assert.equal(previous.length, 1); // The earlier crash fixture deliberately retains its unknown execution; never clear it.
    const c = await register(), waiting = payload(), token = (await registry.admit(waiting, randomUUID())).value.provider_token!, nextOwner = randomUUID();
    assert.equal(await supervisor.claim(waiting.attemptId, token, nextOwner), null);
    assert.ok(await supervisor.beginLaunch(c.payload.attemptId, c.providerToken, c.owner));
    const h = retirementFixture(c, config.bootId); await supervisor.seal(c.payload, c.providerToken, c.owner, h.original);
    const before = (await owner.query("SELECT evidence FROM ingenium_judge.attempts WHERE attempt_id=$1", [c.payload.attemptId])).rows[0].evidence;
    assert.equal(await supervisor.claim(waiting.attemptId, token, nextOwner), null);
    const completed = await createCapsuleRetirement(h.store, h.driver, h.release, h.authority).seal(h.plan, signal());
    const engine = { ...backend, async execute(): Promise<never> { throw new Error("Retirement cannot launch code"); }, async recover() { return completed; } };
    assert.ok((await handle(c, "RECOVER", launcher(engine)) as typeof h.original).metadata.drain);
    const after = (await owner.query("SELECT evidence,drain FROM ingenium_judge.attempts WHERE attempt_id=$1", [c.payload.attemptId])).rows[0];
    assert.deepEqual(after.evidence, before); assert.ok(after.drain);
    assert.deepEqual((await owner.query("SELECT attempt_id,permit_owner,evidence,drain FROM ingenium_judge.attempts WHERE attempt_id=$1", [previous[0].attempt_id])).rows, previous);
    assert.deepEqual(await supervisor.claim(waiting.attemptId, token, nextOwner), waiting);
    const retained = (await owner.query("SELECT retained_bytes FROM ingenium_judge.control")).rows[0].retained_bytes;
    await Promise.all(Array.from({ length: 8 }, () => handle(c, "RECOVER", launcher(engine))));
    assert.equal((await owner.query("SELECT retained_bytes FROM ingenium_judge.control")).rows[0].retained_bytes, retained);
    assert.equal((await owner.query("SELECT count(*)::integer AS n FROM ingenium_judge.attempts WHERE permit_owner IS NOT NULL AND drain IS NULL")).rows[0].n, 2);
    assert.equal(await supervisor.claim(c.payload.attemptId, c.providerToken, randomUUID()), null);
    assert.equal(await supervisor.beginLaunch(c.payload.attemptId, c.providerToken, c.owner), null);
    assert.ok(await supervisor.beginLaunch(waiting.attemptId, token, nextOwner));
    await supervisor.seal(waiting, token, nextOwner, judgeReply(waiting, randomUUID(), undefined, token).evidence);
  });
  await t.test("lost database acknowledgement after certified retirement recovers the same durable release without another host probe", async () => {
    const c = await register(), h = retirementFixture(c, config.bootId);
    assert.ok(await supervisor.beginLaunch(c.payload.attemptId, c.providerToken, c.owner));
    await supervisor.seal(c.payload, c.providerToken, c.owner, h.original);
    const completed = await createCapsuleRetirement(h.store, h.driver, h.release, h.authority).seal(h.plan, signal());
    const lost = { ...supervisor, async seal(...args: Parameters<typeof supervisor.seal>) { await supervisor.seal(...args); throw new Error("Lost certified release acknowledgement"); } };
    await assert.rejects(handle(c, "RECOVER", launcher({ ...backend, async recover() { return completed; } }, lost)));
    const retained = (await owner.query("SELECT retained_bytes FROM ingenium_judge.control")).rows[0].retained_bytes;
    const forbidden = async (): Promise<never> => { throw new Error("No additional readiness, launch or probe"); };
    const result = await handle(c, "RECOVER", launcher({ ...backend, assertReady: forbidden, execute: forbidden, recover: forbidden })) as typeof h.original;
    assert.deepEqual(result.metadata.drain, completed.metadata.drain); assert.equal(h.events.filter(event => event === "prove").length, 1);
    assert.equal((await owner.query("SELECT retained_bytes FROM ingenium_judge.control")).rows[0].retained_bytes, retained);
  });
  await t.test("lost committed start acknowledgement with cancellation holds the reservation and never authorises a replacement launch", async () => {
    const c = await register(), before = executions, controller = new AbortController();
    const lost = { ...supervisor, async beginLaunch(...args: Parameters<typeof supervisor.beginLaunch>) {
      assert.ok(await supervisor.beginLaunch(...args)); controller.abort(); throw new Error("Lost fixed start acknowledgement");
    } };
    await assert.rejects(handle(c, "EXECUTE", launcher(backend, lost), controller.signal));
    const held = (await supervisor.execution(c.payload.attemptId))!; assert.ok(held.started); assert.equal(held.evidence, null);
    assert.equal(executions, before); await assert.rejects(handle(c, "EXECUTE")); assert.equal(await handle(c, "RECOVER"), null);
    assert.equal(await supervisor.beginLaunch(c.payload.attemptId, c.providerToken, c.owner), null);
    assert.equal(await supervisor.claim(c.payload.attemptId, c.providerToken, randomUUID()), null);
    assert.equal(authoringPayloadDigest((await supervisor.execution(c.payload.attemptId))!.payload).toString("hex"), authoringPayloadDigest(c.payload).toString("hex"));
    // Deliberately retain this uncertainty; no execution/cleanup proof exists and no fake verdict is invented.
  });
  assert.ok(readiness > 0);
}
