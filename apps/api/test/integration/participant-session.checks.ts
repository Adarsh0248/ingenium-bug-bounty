import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { TestContext } from "node:test";
import type { Pool } from "pg";
import { commandFingerprint, newProof } from "../../src/access/credentials.js";
import type { SessionDelivery } from "../../src/access/credentials.js";
import { createEntryService } from "../../src/access/entry-service.js";
import { AccessError } from "../../src/access/transaction.js";

interface Team { id: string; first: string; second: string; code: string; credentialId: string; }

export async function participantSessionChecks(t: TestContext, owner: Pool, api: Pool, codec: SessionDelivery, fixture: () => Promise<Team>) {
  let healthy = true;
  const clock = { assertHealthy() { if (!healthy) throw new AccessError("CLOCK_UNTRUSTED"); }, async verify() {}, fault() {} };
  const create = () => createEntryService(api, clock, codec);
  const service = create();
  const denied = (code: string) => (error: unknown) => error instanceof AccessError && error.code === code;
  async function enter(team: Team, memberId = team.first) {
    const flow = await service.begin(team.code, { ip: "127.0.0.1", browserId: randomUUID() });
    if (flow.audience !== "TEAM") throw new Error("Synthetic team routing failed.");
    const active = await service.activate(flow.proofCookie, { memberId, language: "cpp", requestKey: randomUUID() });
    if (active.status !== "ACTIVATED") throw new Error("Synthetic entry failed.");
    return { ...active, flow };
  }
  const inputFor = (active: Awaited<ReturnType<typeof enter>>) => ({ sessionId: active.session.sessionId, requestKey: randomUUID() });
  const state = async (id: string) => (await owner.query("SELECT last_activity_at,absolute_expires_at,revoked_at,revocation_reason FROM participant_sessions WHERE id=$1", [id])).rows[0];

  // Materialise past authorised history with all normal constraints still enabled.
  async function historical(team: Team, ageMs: number, activityAfterMs?: number) {
    const session = newProof(), flow = newProof(), requestKey = randomUUID();
    const client = await owner.connect();
    try {
      await client.query("BEGIN");
      const mr = (await client.query("SELECT * FROM member_rounds WHERE member_id=$1", [team.first])).rows[0];
      const created = (await client.query("SELECT date_trunc('milliseconds',clock_timestamp())-($1::bigint*interval '1 millisecond') AS time", [ageMs])).rows[0].time as Date;
      const expires = new Date(created.getTime() + 600000), absolute = new Date(created.getTime() + 28800000);
      const ciphertext = await codec.encrypt({ flowId: flow.id, sessionId: session.id, memberRoundId: mr.id, credentialId: team.credentialId, credentialVersion: "1", expiresAt: expires.toISOString() }, session.cookie);
      await client.query(`INSERT INTO entry_flows(id,team_id,credential_id,credential_version,proof_verifier,round_id,state,created_at,expires_at)
        VALUES($1,$2,$3,1,$4,$5,'OPEN',$6,$7)`, [flow.id, team.id, team.credentialId, flow.verifier, mr.round_id, created, expires]);
      await client.query("UPDATE member_rounds SET language='cpp',enrolled_at=$2,first_entry_flow_id=$3 WHERE id=$1", [mr.id, created, flow.id]);
      await client.query(`INSERT INTO participant_sessions(id,member_round_id,member_id,team_id,round_id,entry_flow_id,credential_id,credential_version,secret_verifier,created_at,absolute_expires_at,last_activity_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,1,$8,$9,$10,$9)`, [session.id, mr.id, team.first, team.id, mr.round_id, flow.id, team.credentialId, session.verifier, created, absolute]);
      await client.query("UPDATE member_session_slots SET session_id=$2,revision=revision+1 WHERE member_id=$1", [team.first, session.id]);
      await client.query("UPDATE entry_flows SET state='ACTIVATED',activated_session_id=$2,activated_at=$3 WHERE id=$1", [flow.id, session.id, created]);
      await client.query("INSERT INTO session_deliveries(flow_id,session_id,key_id,ciphertext,expires_at) VALUES($1,$2,$3,$4,$5)", [flow.id, session.id, codec.keyId, ciphertext, expires]);
      await client.query(`INSERT INTO entry_outcomes(flow_id,request_key,fingerprint,member_id,language,outcome,session_id,recorded_at)
        VALUES($1,$2,$3,$4,'cpp','ACTIVATED',$5,$6)`, [flow.id, requestKey, Buffer.alloc(32, 1), team.first, session.id, created]);
      if (activityAfterMs !== undefined) {
        let elapsed = 0;
        while (elapsed < activityAfterMs) {
          elapsed = Math.min(elapsed + 3600000, activityAfterMs);
          const activity = new Date(created.getTime() + elapsed);
          await client.query(`INSERT INTO participant_session_outcomes(session_id,request_key,action,fingerprint,recorded_at,expires_at)
            VALUES($1,$2,'KEEP_ALIVE',$3,$4,$5)`, [session.id, randomUUID(), commandFingerprint(["PARTICIPANT_SESSION_V1", "KEEP_ALIVE", session.id]), activity, new Date(Math.min(absolute.getTime(), activity.getTime() + 7200000))]);
          await client.query("UPDATE participant_sessions SET last_activity_at=$2 WHERE id=$1", [session.id, activity]);
        }
      }
      await client.query("COMMIT");
      return { sessionId: session.id, cookie: session.cookie, roundId: mr.round_id as string, absolute };
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  }

  await t.test("participant keep-alive commits once across retries/restart, and outcome reads never count as activity", async () => {
    const team = await fixture(), active = await enter(team), input = inputFor(active);
    const before = await state(input.sessionId);
    assert.deepEqual(await service.sessionOutcome(active.sessionCookie, input), { status: "NOT_OBSERVED", receipt: null });
    const [a, b] = await Promise.all([service.keepAlive(active.sessionCookie, input), service.keepAlive(active.sessionCookie, input)]);
    assert.deepEqual(a, b);
    const after = await state(input.sessionId);
    assert.ok(after.last_activity_at >= before.last_activity_at);
    assert.deepEqual(after.absolute_expires_at, before.absolute_expires_at);
    assert.equal(a.session.warningAt, new Date(new Date(a.session.expiresAt).getTime() - 300000).toISOString());
    assert.deepEqual(await create().keepAlive(active.sessionCookie, input), a);
    assert.deepEqual(await service.sessionOutcome(active.sessionCookie, input), { status: "OBSERVED", receipt: a.receipt });
    await service.inspect(active.sessionCookie);
    assert.deepEqual(await state(input.sessionId), after);
    assert.equal((await owner.query("SELECT count(*)::integer AS n FROM participant_session_outcomes WHERE session_id=$1", [input.sessionId])).rows[0].n, 1);
    await assert.rejects(service.logout(active.sessionCookie, input), denied("INTENT_CONFLICT"));
  });

  await t.test("logout revokes only that member, purges delivery, preserves enrolment and reconciles its lost reply", async () => {
    const team = await fixture(), active = await enter(team), teammate = await enter(team, team.second), input = inputFor(active);
    const member = (await owner.query("SELECT * FROM member_rounds WHERE member_id=$1", [team.first])).rows;
    const [a, b] = await Promise.all([service.logout(active.sessionCookie, input), service.logout(active.sessionCookie, input)]);
    assert.deepEqual(a, b);
    assert.deepEqual(await create().logout(active.sessionCookie, input), a);
    assert.deepEqual(await service.sessionOutcome(active.sessionCookie, input), { status: "OBSERVED", receipt: a.receipt });
    await assert.rejects(service.inspect(active.sessionCookie), denied("INVALID_SESSION"));
    await assert.rejects(service.recover(active.flow.proofCookie), denied("INVALID_FLOW"));
    await assert.rejects(service.keepAlive(active.sessionCookie, { ...input, requestKey: randomUUID() }), denied("INVALID_SESSION"));
    await assert.rejects(service.logout(active.sessionCookie, { ...input, requestKey: randomUUID() }), denied("INVALID_SESSION"));
    assert.equal((await service.inspect(teammate.sessionCookie)).memberId, team.second);
    assert.equal((await owner.query("SELECT session_id FROM member_session_slots WHERE member_id=$1", [team.first])).rows[0].session_id, null);
    assert.equal((await owner.query("SELECT ciphertext FROM session_deliveries WHERE session_id=$1", [input.sessionId])).rows[0].ciphertext, null);
    assert.deepEqual((await owner.query("SELECT * FROM member_rounds WHERE member_id=$1", [team.first])).rows, member);
    const other = await service.begin(team.code, { ip: "127.0.0.1", browserId: randomUUID() });
    if (other.audience !== "TEAM") throw new Error("Synthetic team routing failed.");
    assert.deepEqual(await service.activate(other.proofCookie, { memberId: team.first, language: "java", requestKey: randomUUID() }), { status: "REJECTED", reason: "ALREADY_ENROLLED" });
  });

  await t.test("foreign targets, unknown receipts and forged cookies cannot authorise a session command", async () => {
    const team = await fixture(), active = await enter(team), teammate = await enter(team, team.second), input = inputFor(active);
    const before = await state(input.sessionId);
    for (const cookie of [newProof().cookie, teammate.sessionCookie]) {
      await assert.rejects(service.keepAlive(cookie, input), denied("INVALID_SESSION"));
      await assert.rejects(service.logout(cookie, input), denied("INVALID_SESSION"));
      await assert.rejects(service.sessionOutcome(cookie, input), denied("INVALID_SESSION"));
    }
    await assert.rejects(service.logout(active.sessionCookie, { ...input, sessionId: teammate.session.sessionId }), denied("INVALID_SESSION"));
    assert.deepEqual(await state(input.sessionId), before);
  });

  await t.test("expired sessions cannot be renewed or logged out; absolute expiry bounds an otherwise valid keep-alive", async () => {
    for (const age of [7201000, 28801000]) {
      const team = await fixture(), old = await historical(team, age), input = { sessionId: old.sessionId, requestKey: randomUUID() };
      const before = await state(old.sessionId);
      await assert.rejects(service.inspect(old.cookie), denied("INVALID_SESSION"));
      await assert.rejects(service.keepAlive(old.cookie, input), denied("INVALID_SESSION"));
      await assert.rejects(service.logout(old.cookie, input), denied("INVALID_SESSION"));
      assert.deepEqual(await state(old.sessionId), before);
      assert.equal((await owner.query("SELECT count(*)::integer AS n FROM participant_session_outcomes WHERE session_id=$1", [old.sessionId])).rows[0].n, 0);
    }
    const team = await fixture(), old = await historical(team, 27000000, 26940000);
    const renewed = await service.keepAlive(old.cookie, { sessionId: old.sessionId, requestKey: randomUUID() });
    assert.equal(renewed.session.expiresAt, old.absolute.toISOString());
    assert.equal(renewed.session.absoluteExpiresAt, old.absolute.toISOString());
    assert.equal(renewed.receipt.expiresAt, old.absolute.toISOString());
  });

  await t.test("pause permits deliberate keep-alive without changing contest deadlines, and clock faults admit nothing", async () => {
    const team = await fixture(), active = await enter(team), input = inputFor(active);
    await owner.query("UPDATE rounds SET state='PAUSED' WHERE id=$1", [active.session.roundId]);
    const round = (await owner.query("SELECT closes_at,duration_ms,started_at FROM rounds WHERE id=$1", [active.session.roundId])).rows;
    try {
      assert.equal((await service.keepAlive(active.sessionCookie, input)).session.roundState, "PAUSED");
      const before = await state(input.sessionId);
      healthy = false;
      await assert.rejects(service.keepAlive(active.sessionCookie, { ...input, requestKey: randomUUID() }), denied("CLOCK_UNTRUSTED"));
      await assert.rejects(service.logout(active.sessionCookie, { ...input, requestKey: randomUUID() }), denied("CLOCK_UNTRUSTED"));
      assert.deepEqual(await state(input.sessionId), before);
      assert.deepEqual((await owner.query("SELECT closes_at,duration_ms,started_at FROM rounds WHERE id=$1", [active.session.roundId])).rows, round);
    } finally { healthy = true; await owner.query("UPDATE rounds SET state='RUNNING' WHERE id=$1", [active.session.roundId]); }
  });

  await t.test("keep-alive racing logout cannot revive the revoked grant or create an extra session", async () => {
    const team = await fixture(), active = await enter(team);
    const results = await Promise.allSettled([service.keepAlive(active.sessionCookie, inputFor(active)), service.logout(active.sessionCookie, inputFor(active))]);
    assert.equal(results[1]!.status, "fulfilled");
    if (results[0]!.status === "rejected") assert.equal(denied("INVALID_SESSION")(results[0]!.reason), true);
    await assert.rejects(service.inspect(active.sessionCookie), denied("INVALID_SESSION"));
    assert.equal((await state(active.session.sessionId)).revocation_reason, "LOGOUT");
    assert.equal((await owner.query("SELECT count(*)::integer AS n FROM participant_sessions WHERE member_id=$1", [team.first])).rows[0].n, 1);
  });

  await t.test("session command receipts and effects cannot be rewritten or committed separately", async () => {
    const team = await fixture(), active = await enter(team), input = inputFor(active);
    await assert.rejects(api.query("UPDATE participant_sessions SET last_activity_at=last_activity_at+interval '1 second' WHERE id=$1", [input.sessionId]), { code: "P0001" });
    await assert.rejects(api.query("UPDATE participant_sessions SET revoked_at=date_trunc('milliseconds',clock_timestamp()),revocation_reason='LOGOUT' WHERE id=$1", [input.sessionId]), { code: "P0001" });
    for (const action of ["KEEP_ALIVE", "LOGOUT"]) await assert.rejects(api.query(`INSERT INTO participant_session_outcomes(session_id,request_key,action,fingerprint,recorded_at,expires_at)
      VALUES($1,$2,$3,$4,date_trunc('milliseconds',clock_timestamp())+interval '1 second',date_trunc('milliseconds',clock_timestamp())+interval '2 hours')`,
    [input.sessionId, randomUUID(), action, Buffer.alloc(32, 1)]), { code: "P0001" });
    const late = await api.connect();
    try {
      await late.query("BEGIN");
      await late.query(`INSERT INTO participant_session_outcomes(session_id,request_key,action,fingerprint,recorded_at,expires_at)
        SELECT id,$2,'KEEP_ALIVE',$3,last_activity_at+interval '2 hours',last_activity_at+interval '4 hours' FROM participant_sessions WHERE id=$1`,
      [input.sessionId, randomUUID(), commandFingerprint(["PARTICIPANT_SESSION_V1", "KEEP_ALIVE", input.sessionId])]);
      await assert.rejects(late.query("UPDATE participant_sessions SET last_activity_at=last_activity_at+interval '2 hours' WHERE id=$1", [input.sessionId]), { code: "P0001" });
    } finally { await late.query("ROLLBACK"); late.release(); }
    assert.equal((await owner.query("SELECT count(*)::integer AS n FROM participant_session_outcomes WHERE session_id=$1", [input.sessionId])).rows[0].n, 0);
    await service.keepAlive(active.sessionCookie, input);
    await assert.rejects(owner.query("UPDATE participant_session_outcomes SET action='LOGOUT' WHERE session_id=$1", [input.sessionId]), { code: "P0001" });
    await assert.rejects(owner.query("DELETE FROM participant_session_outcomes WHERE session_id=$1", [input.sessionId]), { code: "P0001" });
    await assert.rejects(api.query("DELETE FROM participant_session_outcomes WHERE session_id=$1", [input.sessionId]), { code: "42501" });
  });

  await t.test("participant commands share the six-command burst by member-round across service restarts", async () => {
    const team = await fixture(), active = await enter(team);
    const results = await Promise.allSettled(Array.from({ length: 7 }, () => create().keepAlive(active.sessionCookie, inputFor(active))));
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 6);
    const failure = results.find((result) => result.status === "rejected");
    assert.ok(failure?.status === "rejected" && denied("RATE_LIMITED")(failure.reason));
    assert.equal((await owner.query("SELECT count(*)::integer AS n FROM participant_session_outcomes WHERE session_id=$1", [active.session.sessionId])).rows[0].n, 6);
  });

  await t.test("current blocks and code revocation fence commands and even limited logout receipt recovery", async () => {
    const team = await fixture(), active = await enter(team), input = inputFor(active), block = randomUUID();
    const staff = (await owner.query("SELECT created_by FROM arena_instances a JOIN rounds r ON r.arena_instance_id=a.id WHERE r.id=$1", [active.session.roundId])).rows[0].created_by;
    const arena = (await owner.query("SELECT arena_instance_id FROM rounds WHERE id=$1", [active.session.roundId])).rows[0].arena_instance_id;
    await owner.query(`INSERT INTO access_blocks(id,arena_instance_id,member_id,created_by,reason,created_at)
      VALUES($1,$2,$3,$4,'Synthetic session control block',date_trunc('milliseconds',clock_timestamp()))`, [block, arena, team.first, staff]);
    await assert.rejects(service.keepAlive(active.sessionCookie, input), denied("INVALID_SESSION"));
    await assert.rejects(service.logout(active.sessionCookie, input), denied("INVALID_SESSION"));
    await owner.query("UPDATE access_blocks SET cleared_at=date_trunc('milliseconds',clock_timestamp()) WHERE id=$1", [block]);
    await service.logout(active.sessionCookie, input);
    await owner.query("UPDATE access_credentials SET revoked_at=date_trunc('milliseconds',clock_timestamp()) WHERE id=$1", [team.credentialId]);
    await assert.rejects(service.logout(active.sessionCookie, input), denied("INVALID_SESSION"));
    await assert.rejects(service.sessionOutcome(active.sessionCookie, input), denied("INVALID_SESSION"));
  });
}
