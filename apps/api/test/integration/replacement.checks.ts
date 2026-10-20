import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { TestContext } from "node:test";
import type { Pool } from "pg";
import { commandFingerprint, newAccessCode, newProof } from "../../src/access/credentials.js";
import type { SessionDelivery } from "../../src/access/credentials.js";
import { createEntryService } from "../../src/access/entry-service.js";
import { createReplacementService } from "../../src/access/replacement-service.js";
import { createStaffService } from "../../src/access/staff-service.js";
import { AccessError } from "../../src/access/transaction.js";

interface Team { id: string; first: string; second: string; code: string; credentialId: string; }

export async function replacementChecks(t: TestContext, owner: Pool, api: Pool, delivery: SessionDelivery, fixture: () => Promise<Team>) {
  let healthy = true;
  const clock = { assertHealthy() { if (!healthy) throw new AccessError("CLOCK_UNTRUSTED"); }, async verify() {}, fault() {} };
  const entry = createEntryService(api, clock, delivery), staff = createStaffService(api, clock, delivery);
  const create = () => createReplacementService(api, clock, delivery), service = create();
  const context = () => ({ ip: "127.0.0.1", browserId: randomUUID() });
  const denied = (code: string) => (error: unknown) => error instanceof AccessError && error.code === code;
  async function flow(team: Team) {
    const f = await entry.begin(team.code, context());
    if (f.audience !== "TEAM") throw new Error("Synthetic team routing failed."); return f;
  }
  async function setup() {
    const team = await fixture(), first = await flow(team);
    const active = await entry.activate(first.proofCookie, { memberId: team.first, language: "cpp", requestKey: randomUUID() });
    if (active.status !== "ACTIVATED") throw new Error("Synthetic entry failed.");
    return { team, active, parent: await flow(team) };
  }
  async function actor(role = "ORGANISER") {
    const id = randomUUID(), credential = newAccessCode();
    await owner.query("INSERT INTO staff_identities(id,display_name,role) VALUES($1,'Synthetic replacement staff',$2)", [id, role]);
    await owner.query("INSERT INTO access_credentials(id,staff_id,verifier,version,issued_at) VALUES($1,$2,$3,1,date_trunc('milliseconds',clock_timestamp()))", [randomUUID(), id, credential.verifier]);
    const f = await entry.begin(credential.code, context());
    if (f.audience !== "STAFF") throw new Error("Synthetic staff routing failed.");
    return { id, ...await staff.activate(f.proofCookie, randomUUID()) };
  }
  async function request(set: Awaited<ReturnType<typeof setup>>, key = randomUUID()) {
    const r = await service.request(set.parent.proofCookie, { memberId: set.team.first, requestKey: key });
    if (r.status !== "REQUESTED") throw new Error("Synthetic replacement request failed."); return r;
  }
  async function decision(flowId: string, person: Awaited<ReturnType<typeof actor>>, action: "APPROVE" | "REJECT" = "APPROVE", requestKey = randomUUID()) {
    const revision = (await owner.query("SELECT expected_slot_revision FROM replacement_requests WHERE flow_id=$1", [flowId])).rows[0].expected_slot_revision as string;
    const input = { flowId, requestKey, expectedRevision: revision, action, reason: "Synthetic in-person verification" };
    return { input, receipt: await service.decide(person.sessionCookie, input) };
  }

  async function expired(approved: boolean) {
    const client = await owner.connect();
    const team = randomUUID(), member = randomUUID(), teammate = randomUUID(), teamRound = randomUUID(), memberRound = randomUUID(), credentialId = randomUUID();
    const credential = newAccessCode(), parent = newProof(), old = newProof(), proof = newProof();
    try {
      await client.query("BEGIN");
      const row = (await client.query("SELECT id,date_trunc('milliseconds',clock_timestamp()) AS time FROM rounds WHERE state='RUNNING'")).rows[0];
      const at = (minutes: number) => new Date((row.time as Date).getTime() - minutes * 60000);
      await client.query("INSERT INTO teams(id,display_name,created_at) VALUES($1,'Synthetic historical team',$2)", [team, at(30)]);
      await client.query("INSERT INTO team_members(id,team_id,position,display_name,created_at) VALUES($1,$3,1,'Historical member',$4),($2,$3,2,'Historical teammate',$4)", [member, teammate, team, at(30)]);
      await client.query("INSERT INTO team_rounds(id,team_id,round_id,display_name) VALUES($1,$2,$3,'Historical team')", [teamRound, team, row.id]);
      await client.query("INSERT INTO member_rounds(id,team_round_id,team_id,member_id,round_id,display_name) VALUES($1,$2,$3,$4,$5,'Historical member')", [memberRound, teamRound, team, member, row.id]);
      await client.query("INSERT INTO access_credentials(id,team_id,verifier,version,issued_at) VALUES($1,$2,$3,1,$4)", [credentialId, team, credential.verifier, at(25)]);
      await client.query(`INSERT INTO entry_flows(id,team_id,credential_id,credential_version,proof_verifier,round_id,state,created_at,expires_at)
        VALUES($1,$2,$3,1,$4,$5,'OPEN',$6,$7)`, [parent.id, team, credentialId, parent.verifier, row.id, at(20), at(10)]);
      await client.query("UPDATE member_rounds SET language='cpp',enrolled_at=$2,first_entry_flow_id=$3 WHERE id=$1", [memberRound, at(20), parent.id]);
      await client.query(`INSERT INTO participant_sessions(id,member_round_id,member_id,team_id,round_id,entry_flow_id,credential_id,credential_version,secret_verifier,created_at,absolute_expires_at,last_activity_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,1,$8,$9,$10,$9)`, [old.id, memberRound, member, team, row.id, parent.id, credentialId, old.verifier, at(20), new Date(at(20).getTime() + 28800000)]);
      await client.query("UPDATE member_session_slots SET session_id=$2,revision=revision+1 WHERE member_id=$1", [member, old.id]);
      await client.query("UPDATE entry_flows SET state='ACTIVATED',activated_session_id=$2,activated_at=$3 WHERE id=$1", [parent.id, old.id, at(20)]);
      const saved = await delivery.encrypt({ flowId: parent.id, sessionId: old.id, memberRoundId: memberRound, credentialId, credentialVersion: "1", expiresAt: at(10).toISOString() }, old.cookie);
      await client.query("INSERT INTO session_deliveries(flow_id,session_id,key_id,ciphertext,expires_at) VALUES($1,$2,$3,$4,$5)", [parent.id, old.id, delivery.keyId, saved, at(10)]);
      await client.query(`INSERT INTO entry_outcomes(flow_id,request_key,fingerprint,member_id,language,outcome,session_id,recorded_at)
        VALUES($1,$2,$3,$4,'cpp','ACTIVATED',$5,$6)`, [parent.id, randomUUID(), commandFingerprint(["Synthetic historical entry"]), member, old.id, at(20)]);
      await client.query(`INSERT INTO entry_flows(id,team_id,credential_id,credential_version,purpose,proof_verifier,round_id,state,created_at,expires_at)
        VALUES($1,$2,$3,1,'REPLACEMENT',$4,$5,'OPEN',$6,$7)`, [proof.id, team, credentialId, proof.verifier, row.id, at(11), at(1)]);
      const capsule = await delivery.encrypt({ flowId: proof.id, sessionId: proof.id, memberRoundId: memberRound, handoff: "REQUEST", credentialId, credentialVersion: "1", expiresAt: at(1).toISOString() }, proof.cookie);
      await client.query(`INSERT INTO replacement_requests(flow_id,parent_flow_id,request_key,fingerprint,member_round_id,member_id,team_id,round_id,expected_session_id,expected_slot_revision,state,proof_key_id,proof_ciphertext)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,1,'PENDING',$10,$11)`, [proof.id, parent.id, randomUUID(), commandFingerprint(["Synthetic historical request"]), memberRound, member, team, row.id, old.id, delivery.keyId, capsule]);
      if (approved) {
        const staffId = randomUUID(), codeId = randomUUID(), staffCode = newAccessCode(), staffFlow = newProof(), staffGrant = newProof();
        await client.query("INSERT INTO staff_identities(id,display_name,role) VALUES($1,'Historical approving staff','ORGANISER')", [staffId]);
        await client.query("INSERT INTO access_credentials(id,staff_id,verifier,version,issued_at) VALUES($1,$2,$3,1,$4)", [codeId, staffId, staffCode.verifier, at(25)]);
        await client.query(`INSERT INTO staff_entry_flows(id,staff_id,credential_id,credential_version,proof_verifier,mode,generation,state,created_at,expires_at)
          VALUES($1,$2,$3,1,$4,'NORMAL',0,'OPEN',$5,$6)`, [staffFlow.id, staffId, codeId, staffFlow.verifier, at(14), at(4)]);
        await client.query(`INSERT INTO staff_sessions(id,staff_id,flow_id,credential_id,credential_version,secret_verifier,mode,generation,created_at,absolute_expires_at,last_activity_at)
          VALUES($1,$2,$3,$4,1,$5,'NORMAL',0,$6,$7,$6)`, [staffGrant.id, staffId, staffFlow.id, codeId, staffGrant.verifier, at(14), new Date(at(14).getTime() + 28800000)]);
        await client.query("UPDATE staff_session_slots SET session_id=$2,revision=revision+1 WHERE staff_id=$1", [staffId, staffGrant.id]);
        await client.query("UPDATE staff_entry_flows SET state='ACTIVATED',session_id=$2,activated_at=$3 WHERE id=$1", [staffFlow.id, staffGrant.id, at(14)]);
        const staffCapsule = await delivery.encrypt({ flowId: staffFlow.id, sessionId: staffGrant.id, staffId, mode: "NORMAL", generation: "0", credentialId: codeId, credentialVersion: "1", expiresAt: at(4).toISOString() }, staffGrant.cookie);
        await client.query("INSERT INTO staff_session_deliveries(flow_id,session_id,key_id,ciphertext,expires_at) VALUES($1,$2,$3,$4,$5)", [staffFlow.id, staffGrant.id, delivery.keyId, staffCapsule, at(4)]);
        await client.query("INSERT INTO staff_entry_outcomes(flow_id,request_key,fingerprint,session_id,recorded_at) VALUES($1,$2,$3,$4,$5)", [staffFlow.id, randomUUID(), commandFingerprint(["Synthetic historical staff entry"]), staffGrant.id, at(14)]);
        await client.query(`INSERT INTO replacement_decisions(id,flow_id,actor_id,session_id,credential_id,credential_version,request_key,fingerprint,action,expected_revision,reason,outcome,recorded_at)
          VALUES($1,$2,$3,$4,$5,1,$6,$7,'APPROVE',1,'Synthetic historical approval','APPLIED',$8)`, [randomUUID(), proof.id, staffId, staffGrant.id, codeId, randomUUID(), commandFingerprint(["Synthetic historical approval"]), at(10)]);
        await client.query("UPDATE participant_sessions SET revoked_at=$2,revocation_reason='REPLACED' WHERE id=$1", [old.id, at(10)]);
        await client.query("UPDATE session_deliveries SET ciphertext=NULL,purged_at=$2 WHERE session_id=$1", [old.id, at(10)]);
        await client.query("UPDATE entry_flows SET state='SUPERSEDED' WHERE id=$1", [parent.id]);
        await client.query("UPDATE replacement_requests SET state='APPROVED' WHERE flow_id=$1", [proof.id]);
        await client.query("UPDATE member_session_slots SET session_id=NULL,reservation_flow_id=$2,revision=revision+1 WHERE member_id=$1", [member, proof.id]);
        await client.query("UPDATE staff_sessions SET last_activity_at=$2 WHERE id=$1", [staffGrant.id, at(10)]);
      }
      await client.query("COMMIT");
      return { team: { id: team, first: member, second: teammate, code: credential.code, credentialId }, proof, old };
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  }

  await t.test("replacement creation is browser-bound, duplicate/restart-safe and does not revoke the old session", async () => {
    const set = await setup(), key = randomUUID(), a = await request(set, key);
    const b = await create().request(set.parent.proofCookie, { memberId: set.team.first, requestKey: key });
    assert.deepEqual(b, a);
    assert.deepEqual(Object.keys(await service.describe(a.proofCookie)).sort(), ["expires_at", "request_id", "state"]);
    assert.equal((await entry.inspect(set.active.sessionCookie)).sessionId, set.active.session.sessionId);
    await assert.rejects(service.activate(a.proofCookie, randomUUID()), denied("HANDOFF_NOT_READY"));
    await assert.rejects(service.describe(newProof().cookie), denied("INVALID_FLOW"));
    await assert.rejects(entry.describe(a.proofCookie), denied("INVALID_FLOW"));
    await assert.rejects(entry.activate(a.proofCookie, { memberId: set.team.first, language: "java", requestKey: randomUUID() }), denied("INVALID_FLOW"));
    const row = (await owner.query("SELECT proof_ciphertext FROM replacement_requests WHERE flow_id=$1", [a.request.request_id])).rows[0];
    assert.equal(row.proof_ciphertext.includes(a.proofCookie), false);
    assert.equal((await owner.query("SELECT count(*)::integer AS n FROM replacement_requests WHERE parent_flow_id=$1", [set.parent.flowId])).rows[0].n, 1);
    await assert.rejects(service.request(set.parent.proofCookie, { memberId: randomUUID(), requestKey: randomUUID() }), denied("ROUND_OR_MEMBER_UNAVAILABLE"));
    const mate = await flow(set.team);
    await entry.activate(mate.proofCookie, { memberId: set.team.second, language: "python", requestKey: randomUUID() });
    await assert.rejects(service.request(set.parent.proofCookie, { memberId: set.team.second, requestKey: key }), denied("INTENT_CONFLICT"));
  });

  await t.test("approval and concurrent activation preserve the member/language and redeliver exactly one new cookie", async () => {
    const set = await setup(), mateFlow = await flow(set.team);
    const mate = await entry.activate(mateFlow.proofCookie, { memberId: set.team.second, language: "java", requestKey: randomUUID() });
    if (mate.status !== "ACTIVATED") throw new Error("Synthetic teammate failed.");
    const r = await request(set), person = await actor();
    const before = (await owner.query("SELECT * FROM member_rounds WHERE member_id=$1", [set.team.first])).rows;
    const approved = await decision(r.request.request_id, person);
    assert.equal(approved.receipt.outcome, "APPLIED");
    await assert.rejects(entry.inspect(set.active.sessionCookie), denied("INVALID_SESSION"));
    const slot = (await owner.query("SELECT session_id,reservation_flow_id FROM member_session_slots WHERE member_id=$1", [set.team.first])).rows[0];
    assert.deepEqual(slot, { session_id: null, reservation_flow_id: r.request.request_id });
    assert.equal((await service.describe(r.proofCookie)).expires_at, r.request.expires_at);
    const key = randomUUID(), [a, b] = await Promise.all([service.activate(r.proofCookie, key), service.activate(r.proofCookie, key)]);
    assert.deepEqual(a, b);
    assert.deepEqual(await create().recover(r.proofCookie), a);
    assert.equal(a.session.memberId, set.team.first); assert.equal(a.session.language, "cpp");
    assert.equal(a.session.memberRoundId, set.active.session.memberRoundId);
    assert.notEqual(a.sessionCookie, set.active.sessionCookie);
    assert.deepEqual((await owner.query("SELECT * FROM member_rounds WHERE member_id=$1", [set.team.first])).rows, before);
    assert.equal((await entry.inspect(mate.sessionCookie)).memberId, set.team.second);
    assert.equal((await owner.query("SELECT count(*)::integer AS n FROM participant_sessions WHERE member_id=$1 AND revoked_at IS NULL", [set.team.first])).rows[0].n, 1);
    assert.equal((await owner.query("SELECT count(*)::integer AS n FROM participant_sessions WHERE member_id=$1", [set.team.first])).rows[0].n, 2);
    await assert.rejects(service.activate(r.proofCookie, randomUUID()), denied("INTENT_CONFLICT"));
    assert.deepEqual(await service.decide(person.sessionCookie, approved.input), approved.receipt);
    assert.equal((await entry.inspect(a.sessionCookie)).sessionId, a.session.sessionId);
  });

  await t.test("two pending requests are bounded and competing approvals can reserve only one handoff", async () => {
    const set = await setup(), a = await request(set), b = await request(set);
    await assert.rejects(request(set), denied("FLOW_CAPACITY_UNAVAILABLE"));
    const one = await actor(), two = await actor("OWNER");
    const results = await Promise.all([decision(a.request.request_id, one), decision(b.request.request_id, two)]);
    assert.deepEqual(results.map((r) => r.receipt.outcome).sort(), ["APPLIED", "REJECTED"]);
    const winner = results[0]!.receipt.outcome === "APPLIED" ? a : b, loser = winner === a ? b : a;
    await assert.rejects(service.describe(loser.proofCookie), denied("INVALID_FLOW"));
    const active = await service.activate(winner.proofCookie, randomUUID());
    assert.equal((await entry.inspect(active.sessionCookie)).memberId, set.team.first);
    const losingRow = (await owner.query("SELECT state,proof_ciphertext FROM replacement_requests WHERE flow_id=$1", [loser.request.request_id])).rows[0];
    assert.deepEqual(losingRow, { state: "SUPERSEDED", proof_ciphertext: null });
    assert.equal((await owner.query("SELECT count(*)::integer AS n FROM replacement_decisions WHERE flow_id=ANY($1::uuid[]) AND outcome='APPLIED'", [[a.request.request_id, b.request.request_id]])).rows[0].n, 1);
  });

  await t.test("staff rejection is permanent and leaves the old session, language and original deadline untouched", async () => {
    const set = await setup(), r = await request(set), person = await actor("OWNER");
    const before = (await owner.query("SELECT * FROM participant_sessions WHERE id=$1", [set.active.session.sessionId])).rows;
    const rejected = await decision(r.request.request_id, person, "REJECT");
    assert.equal(rejected.receipt.outcome, "APPLIED");
    assert.deepEqual(await service.decide(person.sessionCookie, rejected.input), rejected.receipt);
    await assert.rejects(service.decide(person.sessionCookie, { ...rejected.input, action: "APPROVE" }), denied("INTENT_CONFLICT"));
    assert.deepEqual((await owner.query("SELECT * FROM participant_sessions WHERE id=$1", [set.active.session.sessionId])).rows, before);
    await assert.rejects(service.activate(r.proofCookie, randomUUID()), denied("INVALID_FLOW"));
    assert.equal((await entry.inspect(set.active.sessionCookie)).language, "cpp");
  });

  await t.test("logout requires fresh approval even with an empty slot; a delayed old logout cannot revoke the replacement", async () => {
    const set = await setup(), oldLogout = { sessionId: set.active.session.sessionId, requestKey: randomUUID() };
    await entry.logout(set.active.sessionCookie, oldLogout);
    const r = await request(set), person = await actor();
    await decision(r.request.request_id, person);
    const active = await service.activate(r.proofCookie, randomUUID());
    await entry.logout(set.active.sessionCookie, oldLogout);
    await assert.rejects(entry.logout(active.sessionCookie, oldLogout), denied("INVALID_SESSION"));
    assert.equal((await entry.inspect(active.sessionCookie)).language, "cpp");
    await entry.logout(active.sessionCookie, { sessionId: active.session.sessionId, requestKey: randomUUID() });
    await assert.rejects(service.recover(r.proofCookie), denied("INVALID_FLOW"));
    assert.equal((await owner.query("SELECT proof_ciphertext FROM replacement_requests WHERE flow_id=$1", [r.request.request_id])).rows[0].proof_ciphertext, null);
  });

  await t.test("a still-valid current cookie resumes without creating a request or renewing activity", async () => {
    const set = await setup(), before = (await owner.query("SELECT last_activity_at FROM participant_sessions WHERE id=$1", [set.active.session.sessionId])).rows;
    const result = await service.request(set.parent.proofCookie, { memberId: set.team.first, requestKey: randomUUID() }, set.active.sessionCookie);
    assert.equal(result.status, "RESUME");
    assert.equal((await owner.query("SELECT count(*)::integer AS n FROM replacement_requests WHERE member_id=$1", [set.team.first])).rows[0].n, 0);
    assert.deepEqual((await owner.query("SELECT last_activity_at FROM participant_sessions WHERE id=$1", [set.active.session.sessionId])).rows, before);
  });

  await t.test("staff receipts require current authority, and participant cookies cannot approve their own replacement", async () => {
    const set = await setup(), r = await request(set), person = await actor();
    const input = { flowId: r.request.request_id, requestKey: randomUUID(), expectedRevision: "1", action: "APPROVE" as const, reason: "Synthetic verification" };
    await assert.rejects(service.decide(set.active.sessionCookie, input), denied("INVALID_SESSION"));
    await owner.query("UPDATE staff_identities SET disabled_at=date_trunc('milliseconds',clock_timestamp()) WHERE id=$1", [person.id]);
    await assert.rejects(service.decide(person.sessionCookie, input), denied("INVALID_SESSION"));
    assert.equal((await entry.inspect(set.active.sessionCookie)).memberId, set.team.first);
    const authorised = await actor("SUPER_ADMIN"), applied = await decision(r.request.request_id, authorised);
    assert.deepEqual(await service.outcome(authorised.sessionCookie, applied.input.requestKey), { status: "OBSERVED", receipt: applied.receipt });
    const unrelated = await actor();
    assert.deepEqual(await service.outcome(unrelated.sessionCookie, applied.input.requestKey), { status: "NOT_OBSERVED", receipt: null });
  });

  await t.test("current team-code revocation rejects approval durably, and blocks prevent an approved activation", async () => {
    const set = await setup(), r = await request(set), person = await actor();
    await owner.query("UPDATE access_credentials SET revoked_at=date_trunc('milliseconds',clock_timestamp()) WHERE id=$1", [set.team.credentialId]);
    const deniedApproval = await decision(r.request.request_id, person);
    assert.equal(deniedApproval.receipt.outcome, "REJECTED"); assert.equal(deniedApproval.receipt.reason, "ACCESS_UNAVAILABLE");
    assert.deepEqual(await service.decide(person.sessionCookie, deniedApproval.input), deniedApproval.receipt);
    const next = await setup(), pending = await request(next), another = await actor();
    await decision(pending.request.request_id, another);
    const arena = (await owner.query("SELECT arena_instance_id FROM rounds WHERE id=$1", [next.active.session.roundId])).rows[0].arena_instance_id;
    await owner.query("INSERT INTO access_blocks(id,arena_instance_id,member_id,created_by,reason,created_at) VALUES($1,$2,$3,$4,'Synthetic replacement block',date_trunc('milliseconds',clock_timestamp()))", [randomUUID(), arena, next.team.first, another.id]);
    await assert.rejects(service.activate(pending.proofCookie, randomUUID()), denied("ACCESS_UNAVAILABLE"));
    assert.equal((await owner.query("SELECT count(*)::integer AS n FROM participant_sessions WHERE member_id=$1", [next.team.first])).rows[0].n, 1);
  });

  await t.test("an untrusted clock cannot request, approve or activate a handoff", async () => {
    const set = await setup(), r = await request(set), person = await actor();
    healthy = false;
    try {
      await assert.rejects(request(set), denied("CLOCK_UNTRUSTED"));
      await assert.rejects(decision(r.request.request_id, person), denied("CLOCK_UNTRUSTED"));
      await assert.rejects(service.activate(r.proofCookie, randomUUID()), denied("CLOCK_UNTRUSTED"));
    } finally { healthy = true; }
    assert.equal((await entry.inspect(set.active.sessionCookie)).memberId, set.team.first);
    assert.equal((await owner.query("SELECT state FROM replacement_requests WHERE flow_id=$1", [r.request.request_id])).rows[0].state, "PENDING");
  });

  await t.test("replacement metadata, deadline, approval and reservation cannot be forged independently", async () => {
    const set = await setup(), r = await request(set), person = await actor();
    const id = r.request.request_id;
    await assert.rejects(api.query("UPDATE replacement_requests SET state='APPROVED' WHERE flow_id=$1", [id]), { code: "P0001" });
    await assert.rejects(owner.query("UPDATE replacement_requests SET expected_slot_revision=expected_slot_revision+1 WHERE flow_id=$1", [id]), { code: "P0001" });
    await assert.rejects(owner.query("UPDATE entry_flows SET expires_at=expires_at+interval '1 minute' WHERE id=$1", [id]), { code: "P0001" });
    await assert.rejects(api.query("UPDATE member_session_slots SET session_id=NULL,reservation_flow_id=$2,revision=revision+1 WHERE member_id=$1", [set.team.first, id]), { code: "P0001" });
    await assert.rejects(owner.query("DELETE FROM replacement_requests WHERE flow_id=$1", [id]), { code: "P0001" });
    const session = person.session;
    await assert.rejects(api.query(`INSERT INTO replacement_decisions(id,flow_id,actor_id,session_id,credential_id,credential_version,request_key,fingerprint,action,expected_revision,reason,outcome,recorded_at)
      SELECT $1,$2,$3,s.id,s.credential_id,s.credential_version,$4,$5,'APPROVE',1,'Synthetic missing effect','APPLIED',date_trunc('milliseconds',clock_timestamp()) FROM staff_sessions s WHERE s.id=$6`,
    [randomUUID(), id, person.id, randomUUID(), Buffer.alloc(32, 1), session.session_id]), { code: "P0001" });
    const applied = await decision(id, person);
    await assert.rejects(owner.query("DELETE FROM replacement_decisions WHERE id=$1", [applied.receipt.outcome_id]), { code: "P0001" });
    await assert.rejects(api.query("DELETE FROM replacement_decisions WHERE id=$1", [applied.receipt.outcome_id]), { code: "42501" });
    const times = (await owner.query("SELECT created_at,expires_at FROM entry_flows WHERE id=$1", [id])).rows[0];
    assert.equal(times.expires_at.getTime() - times.created_at.getTime(), 600000);
  });

  await t.test("encryption failure rolls back the new grant while retaining the already-approved reservation", async () => {
    const set = await setup(), r = await request(set), person = await actor(); await decision(r.request.request_id, person);
    const failing = createReplacementService(api, clock, { ...delivery, async encrypt() { throw new Error("Synthetic delivery failure"); } });
    await assert.rejects(failing.activate(r.proofCookie, randomUUID()), /Synthetic delivery failure/);
    const slot = (await owner.query("SELECT session_id,reservation_flow_id FROM member_session_slots WHERE member_id=$1", [set.team.first])).rows[0];
    assert.deepEqual(slot, { session_id: null, reservation_flow_id: r.request.request_id });
    assert.equal((await owner.query("SELECT count(*)::integer AS n FROM participant_sessions WHERE member_id=$1", [set.team.first])).rows[0].n, 1);
    assert.equal((await service.activate(r.proofCookie, randomUUID())).session.language, "cpp");
  });

  await t.test("expiry before approval leaves the old session valid and records a non-applying staff receipt", async () => {
    const set = await expired(false), person = await actor();
    await assert.rejects(service.describe(set.proof.cookie), denied("INVALID_FLOW"));
    await assert.rejects(service.activate(set.proof.cookie, randomUUID()), denied("INVALID_FLOW"));
    const result = await decision(set.proof.id, person);
    assert.equal(result.receipt.outcome, "REJECTED"); assert.equal(result.receipt.reason, "EXPIRED");
    assert.equal((await entry.inspect(set.old.cookie)).language, "cpp");
  });

  await t.test("expiry after approval never restores the old session and a fresh verified request replaces the held reservation", async () => {
    const set = await expired(true);
    await assert.rejects(service.describe(set.proof.cookie), denied("INVALID_FLOW"));
    await assert.rejects(service.activate(set.proof.cookie, randomUUID()), denied("INVALID_FLOW"));
    await assert.rejects(entry.inspect(set.old.cookie), denied("INVALID_SESSION"));
    const parent = await flow(set.team), next = await service.request(parent.proofCookie, { memberId: set.team.first, requestKey: randomUUID() });
    if (next.status !== "REQUESTED") throw new Error("Fresh historical recovery request failed.");
    await assert.rejects(service.activate(next.proofCookie, randomUUID()), denied("HANDOFF_NOT_READY"));
    const person = await actor(); await decision(next.request.request_id, person);
    const result = await service.activate(next.proofCookie, randomUUID());
    assert.equal(result.session.language, "cpp");
    assert.equal((await owner.query("SELECT proof_ciphertext FROM replacement_requests WHERE flow_id=$1", [set.proof.id])).rows[0].proof_ciphertext, null);
    await assert.rejects(entry.inspect(set.old.cookie), denied("INVALID_SESSION"));
  });

  await t.test("superseded activation proofs and delayed approvals cannot revive a previous replacement", async () => {
    const set = await setup(), first = await request(set), person = await actor(), approved = await decision(first.request.request_id, person);
    const a = await service.activate(first.proofCookie, randomUUID());
    const second = await request(set); await decision(second.request.request_id, person);
    const b = await service.activate(second.proofCookie, randomUUID());
    await assert.rejects(service.recover(first.proofCookie), denied("INVALID_FLOW"));
    await assert.rejects(entry.inspect(a.sessionCookie), denied("INVALID_SESSION"));
    assert.deepEqual(await service.decide(person.sessionCookie, approved.input), approved.receipt);
    assert.equal((await entry.inspect(b.sessionCookie)).sessionId, b.session.sessionId);
    assert.equal((await owner.query("SELECT ciphertext FROM session_deliveries WHERE flow_id=$1", [first.request.request_id])).rows[0].ciphertext, null);
    assert.equal((await owner.query("SELECT count(*)::integer AS n FROM participant_sessions WHERE member_id=$1 AND revoked_at IS NULL", [set.team.first])).rows[0].n, 1);
  });
}
