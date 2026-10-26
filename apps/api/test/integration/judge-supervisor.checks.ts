import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import type { TestContext } from "node:test";
import type { Pool } from "pg";
import { openSupervisorSession, startJudgeSupervisor } from "../../src/judge/supervisor.js";
import { assertJudgeDatabaseRole } from "../../src/judge/database-role.js";
import { createJudgeQueue } from "../../src/judge/queue.js";
import type { TrustedProtectedExecutor } from "../../src/judge/executor.js";
import type { judgeQueueChecks } from "./judge-queue.checks.js";
import { judgeReply } from "../fixtures/judge.js";
import { createTestRedis } from "../fixtures/redis.js";

export async function judgeSupervisorChecks(t: TestContext, context: Parameters<typeof judgeQueueChecks>[1] & { runner: Pool; ingress: Pool }) {
  const { owner, runner, ingress, publisherPool, config, registry, supervisor, publisher, fresh, payload } = context;
  const proof = Buffer.alloc(32, 0x55); // Synthetic orchestration fixture, never installed-host evidence.
  const until = async (done: () => Promise<boolean>) => {
    const end = performance.now() + 10000;
    while (!(await done())) { assert.ok(performance.now() < end, "Supervisor fixture deadline"); await delay(25); }
  };
  await t.test("only a restricted singleton supervisor session can renew or withdraw this host's readiness", async () => {
    const roles = [[runner, "supervisor"], [ingress, "gateway"], [publisherPool, "publisher"]] as const;
    for (const [pool, role] of roles) {
      await assertJudgeDatabaseRole(pool, role);
      for (const [, other] of roles) if (other !== role) await assert.rejects(assertJudgeDatabaseRole(pool, other));
      await assert.rejects(assertJudgeDatabaseRole(owner, role));
    }
    for (const pool of [owner, ingress, publisherPool]) await assert.rejects(openSupervisorSession(pool, config));
    await owner.query("GRANT SELECT ON ingenium_judge.control TO ingenium_judge_supervisor");
    try { await assert.rejects(openSupervisorSession(runner, config), /restricted judge service/); }
    finally { await owner.query("REVOKE SELECT ON ingenium_judge.control FROM ingenium_judge_supervisor"); }
    const session = await openSupervisorSession(runner, config);
    try {
      assert.equal(await registry.ready(), false);
      await assert.rejects(openSupervisorSession(runner, config), /Another supervisor/);
      await assert.rejects(runner.query("SELECT ingenium_judge.service_heartbeat($1,$2,$3)", [config.hostEpochId, config.bootId, proof]), { code: "P0001" });
      await assert.rejects(session.heartbeat(Buffer.alloc(31), new AbortController().signal));
      await session.heartbeat(proof, new AbortController().signal);
      assert.equal(await registry.ready(), true);
      const p = payload(), token = (await registry.admit(p, randomUUID())).value.provider_token!;
      await session.close(); assert.equal(await registry.ready(), false);
      await assert.rejects(supervisor.claim(p.attemptId, token, randomUUID()), { code: "55000" });
      // Finish only this synthetic fixture through the original normal permit/start/seal path.
      await fresh(); const permit = randomUUID(); assert.ok(await supervisor.claim(p.attemptId, token, permit));
      assert.ok(await supervisor.beginLaunch(p.attemptId, token, permit));
      await supervisor.seal(p, token, permit, judgeReply(p, randomUUID(), Buffer.from("12\n"), token).evidence);
      await publisher.published(p.attemptId);
    } finally { await session.close(); }
    for (const pool of [ingress, publisherPool]) {
      await assert.rejects(pool.query("SELECT ingenium_judge.held_executions($1,$2)", [config.hostEpochId, config.bootId]), { code: "42501" });
      await assert.rejects(pool.query("SELECT ingenium_judge.service_withdraw($1,$2)", [config.hostEpochId, config.bootId]), { code: "42501" });
    }
  });
  await t.test("a lost supervisor database session cannot withdraw a replacement's verified lease", async () => {
    const original = await openSupervisorSession(runner, config);
    await original.heartbeat(proof, new AbortController().signal);
    const rows = (await owner.query(`SELECT pid FROM pg_locks WHERE locktype='advisory' AND classid=1768843123::oid
      AND objid=hashtext($1::text)::oid AND objsubid=2 AND granted AND database=(SELECT oid FROM pg_database WHERE datname=current_database())`, [config.hostEpochId])).rows;
    assert.equal(rows.length, 1);
    await owner.query("SELECT pg_terminate_backend($1)", [rows[0].pid]);
    await until(async () => original.signal.aborted);
    const replacement = await openSupervisorSession(runner, config);
    try {
      await replacement.heartbeat(proof, new AbortController().signal);
      await assert.rejects(original.close(), /session lost/);
      assert.equal(await registry.ready(), true);
    } finally { await replacement.close(); }
    assert.equal(await registry.ready(), false);
  });
  const redis = await createTestRedis();
  let service: Awaited<ReturnType<typeof startJudgeSupervisor>> | undefined;
  const queues: ReturnType<typeof createJudgeQueue>[] = [];
  const queue = () => { const value = createJudgeQueue({ ...config, ...redis.settings }); queues.push(value); return value; };
  try {
    await t.test("the running service publishes and completes four real registry jobs with two bounded workers and no manual ticks", async () => {
      await fresh(); const jobs: ReturnType<typeof payload>[] = [];
      for (let i = 0; i < 4; i++) { const p = payload(); jobs.push(p); await registry.admit(p, randomUUID()); }
      let active = 0, maximum = 0, readinessCalls = 0;
      const calls: string[] = [];
      const executor = (): TrustedProtectedExecutor => ({ ...config, async assertReady(signal) { signal.throwIfAborted(); }, async exchange(request, signal) {
        assert.equal(request.operation, "EXECUTE"); calls.push(request.payload.attempt_id);
        const claim = await supervisor.execution(request.payload.attempt_id); assert.ok(claim);
        assert.ok(await supervisor.beginLaunch(claim.payload.attemptId, claim.providerToken, claim.owner));
        maximum = Math.max(maximum, ++active);
        try {
          await delay(calls.length <= 2 ? 5500 : 400, undefined, { signal });
          return { protocol: request.protocol, operation: request.operation, request_id: request.request_id, host_epoch_id: request.host_epoch_id,
            boot_id: request.boot_id, permit_owner: request.permit_owner, reply: judgeReply(claim.payload, request.request_id, Buffer.from("12\n"), claim.providerToken) };
        } finally { active--; }
      } });
      const session = await openSupervisorSession(runner, config);
      service = await startJudgeSupervisor({ store: supervisor, publisher, session, signal: new AbortController().signal,
        queues: [queue(), queue(), queue()], executors: [executor(), executor()],
        readiness: { ...config, async readiness(signal) { signal.throwIfAborted(); readinessCalls++; return proof; } } });
      await until(async () => (await owner.query("SELECT count(*)::int n FROM ingenium_judge.attempts WHERE attempt_id=ANY($1::uuid[]) AND drain IS NOT NULL", [jobs.map(p => p.attemptId)])).rows[0].n === 4);
      await until(async () => Number(await redis.control.sendCommand(["XLEN", `ingenium:authoring:${config.hostEpochId}:${config.bootId}`])) === 0);
      assert.equal(maximum, 2); assert.equal(active, 0); assert.equal(calls.length, 4); assert.equal(new Set(calls).size, 4);
      assert.ok(readinessCalls >= 2, "Readiness must renew while both execution workers are busy");
      assert.deepEqual(await service.close(), { failed: false }); service = undefined;
      assert.equal(await registry.ready(), false); assert.deepEqual(await supervisor.held(), []);
    });
    await t.test("a restarted service observes an old consumed permit without executing it again or releasing its physical hold", async () => {
      await fresh(); const p = payload(), token = (await registry.admit(p, randomUUID())).value.provider_token!, permit = randomUUID();
      assert.ok(await supervisor.claim(p.attemptId, token, permit));
      const before = await supervisor.execution(p.attemptId), calls: string[] = [];
      const executor = (): TrustedProtectedExecutor => ({ ...config, async assertReady(signal) { signal.throwIfAborted(); }, async exchange(request) {
        calls.push(request.operation); assert.equal(request.operation, "RECOVER"); assert.equal(request.payload.attempt_id, p.attemptId);
        return { protocol: request.protocol, operation: request.operation, request_id: request.request_id, host_epoch_id: request.host_epoch_id,
          boot_id: request.boot_id, permit_owner: request.permit_owner, reply: null };
      } });
      const session = await openSupervisorSession(runner, config);
      service = await startJudgeSupervisor({ store: supervisor, publisher, session, signal: new AbortController().signal,
        queues: [queue(), queue(), queue()], executors: [executor(), executor()], readiness: { ...config, async readiness() { return proof; } } });
      await until(async () => calls.length > 0);
      assert.deepEqual(await supervisor.execution(p.attemptId), before);
      assert.deepEqual(await supervisor.held(), [p.attemptId]); assert.ok(calls.every(value => value === "RECOVER"));
      assert.deepEqual(await service.close(), { failed: false }); service = undefined;
      assert.equal(await registry.ready(), false);
      await fresh(); assert.ok(await supervisor.beginLaunch(p.attemptId, token, permit));
      await supervisor.seal(p, token, permit, judgeReply(p, randomUUID(), Buffer.from("12\n"), token).evidence);
      await publisher.published(p.attemptId);
    });
  } finally {
    await service?.close(); for (const q of queues) q.close(); await redis.close();
  }
}
