import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { TestContext } from "node:test";
import type { Pool } from "pg";
import type { AuthoringPayload } from "../../src/content/execution-policy.js";
import { claimJudgeDelivery, createJudgeQueue, publishJudgeTurn } from "../../src/judge/queue.js";
import type { createJudgePublisherStore, createJudgeRegistry, createJudgeSupervisorStore, RegistrySettings } from "../../src/judge/registry.js";
import { judgeReply } from "../fixtures/judge.js";
import { createTestRedis } from "../fixtures/redis.js";

export async function judgeQueueChecks(t: TestContext, context: {
  owner: Pool; publisherPool: Pool; registry: ReturnType<typeof createJudgeRegistry>; supervisor: ReturnType<typeof createJudgeSupervisorStore>;
  publisher: ReturnType<typeof createJudgePublisherStore>; fresh(): Promise<void>; payload(): AuthoringPayload; config: RegistrySettings;
}) {
  const { owner, publisherPool, registry, supervisor, publisher, fresh, payload, config } = context;
  const redis = await createTestRedis(), queues: ReturnType<typeof createJudgeQueue>[] = [];
  const signal = () => AbortSignal.timeout(15000);
  const key = (boot = config.bootId) => `ingenium:authoring:${config.hostEpochId}:${boot}`;
  const queue = (boot = config.bootId) => { const value = createJudgeQueue({ ...redis.settings, hostEpochId: config.hostEpochId, bootId: boot }); queues.push(value); return value; };
  let q = queue();
  async function register() {
    await fresh(); const p = payload(), token = (await registry.admit(p, randomUUID())).value.provider_token!;
    return { p, token, owner: "" };
  }
  async function finish(job: Awaited<ReturnType<typeof register>>) {
    await fresh();
    if (!job.owner) { job.owner = randomUUID(); assert.ok(await supervisor.claim(job.p.attemptId, job.token, job.owner)); }
    if (!(await supervisor.execution(job.p.attemptId))!.started) assert.ok(await supervisor.beginLaunch(job.p.attemptId, job.token, job.owner));
    await supervisor.seal(job.p, job.token, job.owner, judgeReply(job.p, randomUUID(), Buffer.from("12\n"), job.token).evidence);
  }
  try {
    await t.test("private Redis publication carries identities only and concurrent publishers deduplicate all unclaimed outbox records", async () => {
      const job = await register(), other = queue();
      const before = (await owner.query("SELECT count(*)::integer AS n FROM public.submissions")).rows[0].n;
      await Promise.all([publishJudgeTurn(publisher, q, signal()), publishJudgeTurn(publisher, other, signal())]);
      const entries = await q.entries(signal()); assert.equal(entries.length, 1); assert.equal(entries[0]!.attempt_id, job.p.attemptId);
      assert.deepEqual(Object.keys(entries[0]!).sort(), ["attempt_id", "id", "provider_token"]);
      const raw = JSON.stringify(await redis.control.sendCommand(["XRANGE", key(), "-", "+"]));
      assert.doesNotMatch(raw, /source|stdin|expected|runtime|REFERENCE/); assert.ok(raw.length < 256);
      assert.equal((await owner.query("SELECT count(*)::integer AS n FROM public.submissions")).rows[0].n, before);
      assert.equal((await supervisor.deliveries()).length, 0); assert.equal((await publisher.candidates()).length, 1);
      await finish(job); await publishJudgeTurn(publisher, q, signal()); assert.deepEqual(await q.entries(signal()), []);
    });
    await t.test("lost Redis publish reply and lost committed outbox acknowledgement reconcile without another provider or delivery", async () => {
      for (const failure of ["redis", "postgres"]) {
        const job = await register();
        const lostQueue = { ...q, async publish(...args: Parameters<typeof q.publish>) { await q.publish(...args); throw new Error("Lost fixed Redis reply"); } };
        const lostStore = { ...publisher, async published(attempt: string) { await publisher.published(attempt); throw new Error("Lost fixed PostgreSQL acknowledgement"); } };
        await assert.rejects(publishJudgeTurn(failure === "postgres" ? lostStore : publisher, failure === "redis" ? lostQueue : q, signal()));
        assert.equal((await q.entries(signal())).length, 1);
        await publishJudgeTurn(publisher, q, signal()); assert.equal((await q.entries(signal())).length, 1);
        assert.equal((await owner.query("SELECT count(*)::integer AS n FROM ingenium_judge.attempts WHERE attempt_id=$1", [job.p.attemptId])).rows[0].n, 1);
        await finish(job); await publishJudgeTurn(publisher, q, signal());
      }
    });
    await t.test("reconciliation includes the full admitted backlog, not only the first sixteen unpublished rows", async () => {
      const jobs = []; for (let i = 0; i < 17; i++) jobs.push(await register());
      assert.equal((await publisher.candidates()).length, 17);
      await publishJudgeTurn(publisher, q, signal());
      assert.equal((await q.entries(signal())).length, 17); assert.equal((await supervisor.deliveries()).length, 0);
      await publishJudgeTurn(publisher, q, signal()); assert.equal((await q.entries(signal())).length, 17);
      for (const job of jobs) await finish(job); await publishJudgeTurn(publisher, q, signal());
      assert.deepEqual(await q.entries(signal()), []);
    });
    await t.test("a cold Redis restart reconstructs acknowledged unclaimed work from PostgreSQL without resetting permits", async () => {
      const job = await register(); await publishJudgeTurn(publisher, q, signal());
      assert.equal((await supervisor.deliveries()).length, 0);
      const disconnected = q; await redis.restart();
      await assert.rejects(disconnected.entries(signal()), /unavailable|reconcile/); q = queue();
      assert.deepEqual(await q.entries(signal()), []); await publishJudgeTurn(publisher, q, signal());
      const entries = await q.entries(signal()); assert.equal(entries.length, 1); assert.equal(entries[0]!.provider_token, job.token);
      await finish(job); await publishJudgeTurn(publisher, q, signal());
    });
    await t.test("pending delivery survives a receiver restart and overlapping receivers get only one committed launch permission", async () => {
      const job = await register(); await publishJudgeTurn(publisher, q, signal());
      const lost = await q.receive(signal()); assert.equal(lost!.attempt_id, job.p.attemptId); q.close(); q = queue();
      assert.deepEqual(await q.receive(signal()), lost);
      const other = queue(), values = await Promise.all([claimJudgeDelivery(supervisor, q, signal()), claimJudgeDelivery(supervisor, other, signal())]);
      const claimed = values.filter(value => value.state === "CLAIMED"); assert.equal(claimed.length, 1);
      assert.deepEqual(claimed[0]!.payload, job.p); job.owner = claimed[0]!.owner;
      assert.equal(await supervisor.claim(job.p.attemptId, job.token, job.owner), null);
      await finish(job); await publishJudgeTurn(publisher, q, signal());
      assert.deepEqual(await claimJudgeDelivery(supervisor, q, signal()), { state: "EMPTY" });
    });
    await t.test("lost claim response removes only duplicate delivery, never frees or reissues its unsealed physical reservation", async () => {
      const job = await register(); await publishJudgeTurn(publisher, q, signal());
      const lostStore = { ...supervisor, async claim(...args: Parameters<typeof supervisor.claim>) {
        const result = await supervisor.claim(...args); assert.ok(result); job.owner = args[2]; throw new Error("Lost fixed commit reply");
      } };
      await assert.rejects(claimJudgeDelivery(lostStore, q, signal()), /Lost fixed commit reply/);
      await publishJudgeTurn(publisher, q, signal()); assert.deepEqual(await q.entries(signal()), []);
      assert.deepEqual(await publisher.candidates(), []);
      assert.equal(await supervisor.claim(job.p.attemptId, job.token, randomUUID()), null);
      const row = (await owner.query("SELECT permit_owner,evidence,drain FROM ingenium_judge.attempts WHERE attempt_id=$1", [job.p.attemptId])).rows[0];
      assert.equal(row.permit_owner, job.owner); assert.equal(row.evidence, null); assert.equal(row.drain, null);
      await finish(job);
    });
    await t.test("full physical slots leave a message pending until proven drain makes room, not until a delivery timeout", async () => {
      const jobs = [await register(), await register(), await register()]; await publishJudgeTurn(publisher, q, signal());
      const byAttempt = new Map(jobs.map(job => [job.p.attemptId, job]));
      for (let i = 0; i < 4; i++) {
        const result = await claimJudgeDelivery(supervisor, q, signal());
        if (result.state === "CLAIMED") byAttempt.get(result.payload.attemptId)!.owner = result.owner;
      }
      assert.equal(jobs.filter(job => job.owner).length, 2);
      assert.deepEqual(await claimJudgeDelivery(supervisor, q, signal()), { state: "HELD" });
      await finish(jobs.find(job => job.owner)!);
      const resumed = await claimJudgeDelivery(supervisor, q, signal()); assert.equal(resumed.state, "CLAIMED");
      byAttempt.get(resumed.payload.attemptId)!.owner = resumed.owner;
      for (const job of jobs) await finish(job);
      await publishJudgeTurn(publisher, q, signal());
    });
    await t.test("publisher privilege cannot read payloads, mint readiness, consume a permit or inject a result", async () => {
      for (const table of ["ingenium_judge.attempts", "ingenium_judge.outbox", "public.submissions"]) await assert.rejects(publisherPool.query(`SELECT * FROM ${table}`), { code: "42501" });
      for (const name of ["heartbeat(uuid,uuid,bytea)", "claim(uuid,uuid,uuid,uuid,uuid)", "seal(uuid,uuid,uuid,uuid,uuid,jsonb,jsonb)", "admit(uuid,uuid,jsonb)", "observe(uuid,uuid,uuid,bytea)"]) {
        assert.equal((await publisherPool.query("SELECT has_function_privilege(current_user,$1,'EXECUTE') AS allowed", [`ingenium_judge.${name}`])).rows[0].allowed, false);
      }
      assert.equal((await publisherPool.query("SELECT has_function_privilege(current_user,'ingenium_judge.queue_candidates(uuid,uuid)','EXECUTE') AS allowed")).rows[0].allowed, true);
    });
    await t.test("readiness expiry prevents publication and claim; wrong epoch or token cannot acknowledge a registered job", async () => {
      const job = await register();
      await owner.query("UPDATE ingenium_judge.control SET ready_until='-infinity'");
      assert.deepEqual(await publishJudgeTurn(publisher, q, signal()), { removed: 0, published: 0 });
      assert.equal(await q.publish({ attempt_id: job.p.attemptId, provider_token: job.token }, signal()) !== null, true);
      await assert.rejects(claimJudgeDelivery(supervisor, q, signal()), { code: "55000" });
      await assert.rejects(publishJudgeTurn(publisher, queue(randomUUID()), signal()), /another host/);
      await assert.rejects(publisher.deliveryState({ attempt_id: job.p.attemptId, provider_token: randomUUID() }), { code: "22023" });
      const entry = (await q.entries(signal()))[0]!;
      await assert.rejects(q.acknowledge({ ...entry, provider_token: randomUUID() }, signal())); q = queue();
      assert.equal((await q.entries(signal())).length, 1); await finish(job); await publishJudgeTurn(publisher, q, signal());
    });
    await t.test("unknown queue identities remain held for inspection and cannot be purged or granted a launch", async () => {
      await q.publish({ attempt_id: randomUUID(), provider_token: randomUUID() }, signal());
      await assert.rejects(publishJudgeTurn(publisher, q, signal()), { code: "22023" });
      await assert.rejects(claimJudgeDelivery(supervisor, q, signal()), { code: "22023" });
      assert.equal((await q.entries(signal())).length, 1);
      q.close(); await redis.restart(); q = queue();
    });
    await t.test("bounded stream refuses its 121st identity, preserves all 120, and deduplicates even when full", async () => {
      const isolated = queue(randomUUID()), first = { attempt_id: randomUUID(), provider_token: randomUUID() };
      const id = await isolated.publish(first, signal()); assert.ok(id);
      for (let i = 1; i < 120; i++) assert.ok(await isolated.publish({ attempt_id: randomUUID(), provider_token: randomUUID() }, signal()));
      assert.equal(await isolated.publish({ attempt_id: randomUUID(), provider_token: randomUUID() }, signal()), null);
      assert.equal(await isolated.publish(first, signal()), id); assert.equal((await isolated.entries(signal())).length, 120);
      const entry = await isolated.receive(signal()); assert.ok(entry); await isolated.acknowledge(entry, signal()); await isolated.acknowledge(entry, signal());
      assert.equal((await isolated.entries(signal())).length, 119);
    });
    await t.test("malformed or conflicting Redis identities fail closed without trimming or mutating the retained message", async () => {
      const boot = randomUUID(), isolated = queue(boot), delivery = { attempt_id: randomUUID(), provider_token: randomUUID() };
      await isolated.publish(delivery, signal());
      await assert.rejects(isolated.publish({ ...delivery, provider_token: randomUUID() }, signal()));
      const corrupt = queue(boot);
      await redis.control.sendCommand(["XADD", key(boot), "*", "attempt", randomUUID(), "token", randomUUID(), "source", "must-not-be-returned"]);
      await assert.rejects(corrupt.entries(signal())); assert.equal(await redis.control.sendCommand(["XLEN", key(boot)]), 2);
      const wrongBoot = randomUUID(), wrongType = queue(wrongBoot); await redis.control.set(key(wrongBoot), "retained");
      await assert.rejects(wrongType.publish(delivery, signal())); assert.equal(await redis.control.get(key(wrongBoot)), "retained");
    });
  } finally { for (const client of queues) client.close(); await redis.close(); }
}
