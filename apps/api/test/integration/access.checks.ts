import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import type { TestContext } from "node:test";
import type { Pool } from "pg";
import { createEntryService } from "../../src/access/entry-service.js";
import { newAccessCode, newProof, sessionDelivery } from "../../src/access/credentials.js";
import { AccessError } from "../../src/access/transaction.js";
import { refill } from "../../src/access/quotas.js";
import { browserChecks } from "./browser.checks.js";
import { participantSessionChecks } from "./participant-session.checks.js";
import { replacementChecks } from "./replacement.checks.js";
import { createReplacementService } from "../../src/access/replacement-service.js";
import { createStaffService } from "../../src/access/staff-service.js";

export async function accessChecks(t: TestContext, owner: Pool, api: Pool): Promise<void> {
  const key = randomBytes(32);
  const codec = sessionDelivery("synthetic-test-v1", key);
  const clock = { assertHealthy() {}, async verify() {}, fault() {} };
  const service = createEntryService(api, clock, codec);
  const staffId = randomUUID(), arenaId = randomUUID(), roundId = randomUUID();
  await owner.query("INSERT INTO staff_identities (id,display_name,role) VALUES ($1,'Synthetic operator','SUPER_ADMIN')", [staffId]);
  await owner.query(`WITH created AS (INSERT INTO arena_instances (id,status,created_by,created_at)
    VALUES ($1,'IN_PROGRESS',$2,date_trunc('milliseconds',clock_timestamp())) RETURNING id)
    UPDATE arena_control SET current_instance_id=created.id,revision=revision+1 FROM created WHERE arena_control.id=1`, [arenaId, staffId]);
  await owner.query(`INSERT INTO rounds (id,arena_instance_id,kind,state,duration_ms,started_at,closes_at)
    VALUES ($1,$2,1,'RUNNING',3600000,date_trunc('milliseconds',clock_timestamp())-interval '1 minute',date_trunc('milliseconds',clock_timestamp())+interval '59 minutes')`, [roundId, arenaId]);

  async function fixture() {
    const id = randomUUID(), first = randomUUID(), second = randomUUID(), teamRound = randomUUID();
    const credentialId = randomUUID();
    const access = newAccessCode();
    await owner.query("INSERT INTO teams (id,display_name) VALUES ($1,'Synthetic team')", [id]);
    await owner.query("INSERT INTO team_members (id,team_id,position,display_name) VALUES ($1,$3,1,'Synthetic first'),($2,$3,2,'Synthetic second')", [first, second, id]);
    await owner.query("INSERT INTO access_credentials (id,team_id,verifier,version,issued_at) VALUES ($1,$2,$3,1,date_trunc('milliseconds',clock_timestamp()))", [credentialId, id, access.verifier]);
    await owner.query("INSERT INTO team_rounds (id,team_id,round_id,display_name) VALUES ($1,$2,$3,'Frozen synthetic team')", [teamRound, id, roundId]);
    await owner.query("INSERT INTO member_rounds (id,team_round_id,team_id,member_id,round_id,display_name) VALUES ($1,$3,$4,$5,$7,'Frozen first'),($2,$3,$4,$6,$7,'Frozen second')", [randomUUID(), randomUUID(), teamRound, id, first, second, roundId]);
    return { id, first, second, code: access.code, credentialId };
  }
  const context = () => ({ ip: "127.0.0.1", browserId: randomUUID() });
  async function flow(team: Awaited<ReturnType<typeof fixture>>) {
    const result = await service.begin(team.code, context());
    assert.equal(result.audience, "TEAM");
    if (result.audience !== "TEAM") throw new Error("Synthetic team routed incorrectly.");
    return result;
  }
  const denied = (code: string) => (error: unknown) => error instanceof AccessError && error.code === code;

  await t.test("valid code reveals only its own two members and unverified codes create no flow", async () => {
    const team = await fixture();
    const other = await fixture();
    const result = await flow(team);
    assert.deepEqual(result.members.map((member) => member.id).sort(), [team.first, team.second].sort());
    assert.equal(JSON.stringify(result.members).includes(other.first), false);
    const before = (await owner.query("SELECT count(*) AS count FROM entry_flows")).rows;
    await assert.rejects(service.begin(newAccessCode().code, context()), denied("INVALID_CODE"));
    await assert.rejects(service.begin("not a code", context()), denied("INVALID_CODE"));
    assert.deepEqual((await owner.query("SELECT count(*) AS count FROM entry_flows")).rows, before);
  });

  await t.test("two teammates choose independent languages; reads do not renew idle expiry", async () => {
    const team = await fixture();
    const firstFlow = await flow(team), secondFlow = await flow(team);
    const first = await service.activate(firstFlow.proofCookie, { memberId: team.first, language: "cpp", requestKey: randomUUID() });
    const second = await service.activate(secondFlow.proofCookie, { memberId: team.second, language: "python", requestKey: randomUUID() });
    assert.equal(first.status, "ACTIVATED"); assert.equal(second.status, "ACTIVATED");
    if (first.status !== "ACTIVATED" || second.status !== "ACTIVATED") throw new Error("Synthetic first entry failed.");
    const before = (await owner.query("SELECT last_activity_at FROM participant_sessions WHERE id=$1", [first.session.sessionId])).rows;
    assert.equal((await service.inspect(first.sessionCookie)).language, "cpp");
    assert.equal((await service.inspect(second.sessionCookie)).language, "python");
    assert.equal(first.session.teamName, "Frozen synthetic team");
    assert.deepEqual((await owner.query("SELECT last_activity_at FROM participant_sessions WHERE id=$1", [first.session.sessionId])).rows, before);
    const stored = (await owner.query("SELECT secret_verifier FROM participant_sessions WHERE id=$1", [first.session.sessionId])).rows[0];
    assert.equal(Buffer.isBuffer(stored.secret_verifier), true);
    assert.equal(stored.secret_verifier.length, 32);
  });

  await t.test("same-proof concurrent activation and a restarted service recover one exact cookie", async () => {
    const team = await fixture(), entry = await flow(team);
    const intent = { memberId: team.first, language: "java" as const, requestKey: randomUUID() };
    const [a, b] = await Promise.all([service.activate(entry.proofCookie, intent), service.activate(entry.proofCookie, intent)]);
    assert.ok(api.totalCount >= 2, "Race checks must use separate PostgreSQL connections.");
    assert.deepEqual(a, b);
    assert.equal(a.status, "ACTIVATED");
    const restarted = createEntryService(api, clock, sessionDelivery("synthetic-test-v1", Uint8Array.from(key)));
    assert.deepEqual(await restarted.activate(entry.proofCookie, intent), a);
    assert.deepEqual(await restarted.recover(entry.proofCookie), a);
    await assert.rejects(restarted.recover(newProof().cookie), denied("INVALID_FLOW"));
    assert.equal((await owner.query("SELECT count(*)::integer AS count FROM participant_sessions WHERE member_id=$1", [team.first])).rows[0].count, 1);
    assert.equal((await owner.query("SELECT count(*)::integer AS count FROM entry_events WHERE flow_id=$1 AND kind='SESSION_ACTIVATED'", [entry.flowId])).rows[0].count, 1);
    await assert.rejects(service.activate(entry.proofCookie, { ...intent, language: "c" }), denied("INTENT_CONFLICT"));
    await assert.rejects(service.activate(entry.proofCookie, { ...intent, requestKey: randomUUID() }), denied("INTENT_CONFLICT"));
  });

  await t.test("different browsers racing for a member cannot both enrol or change the winning language", async () => {
    const team = await fixture(), first = await flow(team), second = await flow(team);
    const results = await Promise.all([
      service.activate(first.proofCookie, { memberId: team.first, language: "c", requestKey: randomUUID() }),
      service.activate(second.proofCookie, { memberId: team.first, language: "python", requestKey: randomUUID() }),
    ]);
    assert.deepEqual(results.map((result) => result.status).sort(), ["ACTIVATED", "REJECTED"]);
    const winner = results.find((result) => result.status === "ACTIVATED");
    const loser = results.find((result) => result.status === "REJECTED");
    assert.equal(loser?.reason, "ALREADY_ENROLLED");
    assert.equal((await owner.query("SELECT language FROM member_rounds WHERE member_id=$1 AND round_id=$2", [team.first, roundId])).rows[0].language, winner?.session.language);
    await assert.rejects(owner.query("UPDATE member_rounds SET language='java' WHERE member_id=$1 AND round_id=$2", [team.first, roundId]), { code: "P0001" });
    await assert.rejects(owner.query("UPDATE member_rounds SET language=NULL,enrolled_at=NULL,first_entry_flow_id=NULL WHERE member_id=$1 AND round_id=$2", [team.first, roundId]), { code: "P0001" });
  });

  await t.test("foreign members, forged proofs and an unhealthy clock never create a session", async () => {
    const team = await fixture(), other = await fixture(), entry = await flow(team);
    const intent = { memberId: other.first, language: "java" as const, requestKey: randomUUID() };
    await assert.rejects(service.activate(entry.proofCookie, intent), denied("ROUND_OR_MEMBER_UNAVAILABLE"));
    await assert.rejects(service.activate(newProof().cookie, { ...intent, memberId: team.first }), denied("INVALID_FLOW"));
    const unhealthy = createEntryService(api, { ...clock, assertHealthy() { throw new AccessError("CLOCK_UNTRUSTED"); } }, codec);
    await assert.rejects(unhealthy.activate(entry.proofCookie, { ...intent, memberId: team.first }), denied("CLOCK_UNTRUSTED"));
    assert.equal((await owner.query("SELECT count(*)::integer AS count FROM participant_sessions WHERE member_id=$1", [team.first])).rows[0].count, 0);
  });

  await t.test("encryption failure rolls back enrolment, its slot and its source outcome together", async () => {
    const team = await fixture(), entry = await flow(team);
    const failing = createEntryService(api, clock, { ...codec, async encrypt() { throw new Error("Synthetic encryption failure"); } });
    await assert.rejects(failing.activate(entry.proofCookie, { memberId: team.first, language: "cpp", requestKey: randomUUID() }), /Synthetic encryption failure/);
    assert.deepEqual((await owner.query("SELECT language,enrolled_at FROM member_rounds WHERE member_id=$1", [team.first])).rows, [{ language: null, enrolled_at: null }]);
    assert.equal((await owner.query("SELECT session_id FROM member_session_slots WHERE member_id=$1", [team.first])).rows[0].session_id, null);
    assert.equal((await owner.query("SELECT count(*)::integer AS count FROM entry_outcomes WHERE flow_id=$1", [entry.flowId])).rows[0].count, 0);
  });

  await t.test("revoked credentials and team/member blocks invalidate both cookies and delivery recovery", async () => {
    const team = await fixture(), entry = await flow(team), requestKey = randomUUID();
    const intent = { memberId: team.first, language: "python" as const, requestKey };
    const active = await service.activate(entry.proofCookie, intent);
    assert.equal(active.status, "ACTIVATED");
    if (active.status !== "ACTIVATED") throw new Error("Synthetic session failed.");
    const blockId = randomUUID();
    await owner.query("INSERT INTO access_blocks (id,arena_instance_id,member_id,created_by,reason,created_at) VALUES ($1,$2,$3,$4,'Synthetic support block',date_trunc('milliseconds',clock_timestamp()))", [blockId, arenaId, team.first, staffId]);
    await assert.rejects(service.inspect(active.sessionCookie), denied("INVALID_SESSION"));
    await assert.rejects(service.activate(entry.proofCookie, intent), denied("ACCESS_UNAVAILABLE"));
    await owner.query("UPDATE access_blocks SET cleared_at=date_trunc('milliseconds',clock_timestamp()) WHERE id=$1", [blockId]);
    await owner.query("UPDATE access_credentials SET revoked_at=date_trunc('milliseconds',clock_timestamp()) WHERE id=$1", [team.credentialId]);
    await assert.rejects(service.inspect(active.sessionCookie), denied("INVALID_SESSION"));
    await assert.rejects(service.activate(entry.proofCookie, intent), denied("INVALID_FLOW"));
    await assert.rejects(service.begin(team.code, context()), denied("INVALID_CODE"));
  });

  await t.test("same-round re-entry still needs organiser recovery after the old grant is revoked", async () => {
    const team = await fixture(), entry = await flow(team);
    const active = await service.activate(entry.proofCookie, { memberId: team.first, language: "java", requestKey: randomUUID() });
    if (active.status !== "ACTIVATED") throw new Error("Synthetic session failed.");
    await owner.query("UPDATE participant_sessions SET revoked_at=date_trunc('milliseconds',clock_timestamp()),revocation_reason='SYNTHETIC_LOGOUT' WHERE id=$1", [active.session.sessionId]);
    await owner.query("UPDATE member_session_slots SET session_id=NULL,revision=revision+1 WHERE member_id=$1", [team.first]);
    const another = await flow(team);
    assert.deepEqual(await service.activate(another.proofCookie, { memberId: team.first, language: "c", requestKey: randomUUID() }), { status: "REJECTED", reason: "ALREADY_ENROLLED" });
  });

  await t.test("shared PostgreSQL quota survives a new service and denied attempts retain ingress debits", async () => {
    const team = await fixture();
    for (let index = 0; index < 4; index++) await flow(team);
    const before = (await owner.query("SELECT credits,refilled_at FROM quota_buckets WHERE kind='AUTH_GLOBAL'")).rows[0];
    await assert.rejects(createEntryService(api, clock, codec).begin(team.code, context()), denied("RATE_LIMITED"));
    const after = (await owner.query("SELECT credits,refilled_at FROM quota_buckets WHERE kind='AUTH_GLOBAL'")).rows[0];
    assert.equal(BigInt(after.credits), refill(BigInt(before.credits), BigInt(after.refilled_at.getTime()-before.refilled_at.getTime()), 2000n, 400n) - 60000n);
    assert.equal((await owner.query("SELECT count(*)::integer AS count FROM entry_flows WHERE team_id=$1", [team.id])).rows[0].count, 4);
  });

  await t.test("common-code routing uses the stored staff owner and denies disabled staff without creating participant flows", async () => {
    const backup=randomUUID();
    await owner.query("INSERT INTO staff_identities(id,display_name,role) VALUES($1,'Synthetic spare Super Admin','SUPER_ADMIN')",[backup]);
    await owner.query("INSERT INTO access_credentials(id,staff_id,verifier,version,issued_at) VALUES($1,$2,$3,1,date_trunc('milliseconds',clock_timestamp()))",[randomUUID(),backup,newAccessCode().verifier]);
    const access = newAccessCode(), credentialId = randomUUID();
    await owner.query("INSERT INTO access_credentials (id,staff_id,verifier,version,issued_at) VALUES ($1,$2,$3,1,date_trunc('milliseconds',clock_timestamp()))", [credentialId, staffId, access.verifier]);
    const before = (await owner.query("SELECT count(*) AS count FROM entry_flows")).rows;
    assert.equal((await service.begin(access.code, context())).audience, "STAFF");
    await owner.query("UPDATE staff_identities SET disabled_at=date_trunc('milliseconds',clock_timestamp()) WHERE id=$1", [staffId]);
    await assert.rejects(service.begin(access.code, context()), denied("INVALID_CODE"));
    await owner.query("UPDATE staff_identities SET disabled_at=NULL WHERE id=$1", [staffId]);
    assert.deepEqual((await owner.query("SELECT count(*) AS count FROM entry_flows")).rows, before);
  });

  await t.test("parallel verifications cannot exceed the shared code burst", async () => {
    const team = await fixture();
    const results = await Promise.allSettled(Array.from({ length: 5 }, () => service.begin(team.code, context())));
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 4);
    const rejected = results.find((result) => result.status === "rejected");
    assert.ok(rejected?.status === "rejected" && rejected.reason instanceof AccessError && rejected.reason.code === "RATE_LIMITED");
    assert.equal((await owner.query("SELECT count(*)::integer AS count FROM entry_flows WHERE team_id=$1", [team.id])).rows[0].count, 4);
  });

  await t.test("entry outcomes and original cookie deadlines cannot be rewritten", async () => {
    const team = await fixture(), entry = await flow(team);
    const active = await service.activate(entry.proofCookie, { memberId: team.first, language: "java", requestKey: randomUUID() });
    if (active.status !== "ACTIVATED") throw new Error("Synthetic session failed.");
    await assert.rejects(owner.query("UPDATE participant_sessions SET absolute_expires_at=absolute_expires_at+interval '1 hour' WHERE id=$1", [active.session.sessionId]), { code: "P0001" });
    await assert.rejects(owner.query("DELETE FROM entry_outcomes WHERE flow_id=$1", [entry.flowId]), { code: "P0001" });
    await assert.rejects(owner.query("UPDATE session_deliveries SET ciphertext='changed' WHERE flow_id=$1", [entry.flowId]), { code: "P0001" });
    const corruptKey = createEntryService(api, clock, sessionDelivery("synthetic-test-v1", randomBytes(32)));
    await assert.rejects(corruptKey.activate(entry.proofCookie, { memberId: team.first, language: "java", requestKey: (await owner.query("SELECT request_key FROM entry_outcomes WHERE flow_id=$1", [entry.flowId])).rows[0].request_key }), denied("DELIVERY_UNAVAILABLE"));
  });

  await t.test("deferred bindings refuse incomplete enrolment, a live slot removal and duplicate activation sources", async () => {
    const team = await fixture(), entry = await flow(team);
    await assert.rejects(owner.query(`UPDATE member_rounds SET language='cpp',enrolled_at=date_trunc('milliseconds',clock_timestamp()),first_entry_flow_id=$2
      WHERE member_id=$1 AND round_id=$3`, [team.first, entry.flowId, roundId]), { code: "P0001" });
    const active = await service.activate(entry.proofCookie, { memberId: team.first, language: "cpp", requestKey: randomUUID() });
    if (active.status !== "ACTIVATED") throw new Error("Synthetic session failed.");
    await assert.rejects(api.query("UPDATE member_session_slots SET session_id=NULL WHERE member_id=$1", [team.first]), { code: "P0001" });
    await assert.rejects(api.query("UPDATE member_session_slots SET session_id=$2,revision=revision+1 WHERE member_id=$1", [team.second, active.session.sessionId]), { code: "23503" });
    await assert.rejects(api.query(`INSERT INTO entry_outcomes (flow_id,request_key,fingerprint,member_id,language,outcome,session_id,recorded_at)
      SELECT flow_id,$2,fingerprint,member_id,language,outcome,session_id,recorded_at FROM entry_outcomes WHERE flow_id=$1`, [entry.flowId, randomUUID()]), { code: "P0001" });
    assert.equal((await service.inspect(active.sessionCookie)).sessionId, active.session.sessionId);
    assert.equal((await owner.query("SELECT count(*)::integer AS count FROM entry_outcomes WHERE flow_id=$1", [entry.flowId])).rows[0].count, 1);
  });

  await t.test("the runtime role cannot provision codes, grant staff access, change round state or erase history", async () => {
    const team = await fixture(), entry = await flow(team);
    await assert.rejects(api.query("UPDATE access_credentials SET revoked_at=date_trunc('milliseconds',clock_timestamp()) WHERE id=$1", [team.credentialId]), { code: "42501" });
    await assert.rejects(api.query("UPDATE staff_identities SET role='SUPER_ADMIN' WHERE id=$1", [staffId]), { code: "42501" });
    await assert.rejects(api.query("UPDATE rounds SET state='CLOSED' WHERE id=$1", [roundId]), { code: "42501" });
    await assert.rejects(api.query("DELETE FROM entry_events WHERE flow_id=$1", [entry.flowId]), { code: "42501" });
    await assert.rejects(api.query("INSERT INTO access_credentials (id,team_id,verifier,version,issued_at) VALUES ($1,$2,$3,2,date_trunc('milliseconds',clock_timestamp()))", [randomUUID(), team.id, newAccessCode().verifier]), { code: "42501" });
  });

  await participantSessionChecks(t, owner, api, codec, fixture);
  await replacementChecks(t, owner, api, codec, fixture);
  await browserChecks(t, owner, api, codec, fixture);

  await t.test("Round 2 first entry uses its selected roster, chooses a new language and retires the R1 grant", async () => {
    const team = await fixture(), first = await flow(team), stale = await flow(team);
    const active = await service.activate(first.proofCookie, { memberId: team.first, language: "cpp", requestKey: randomUUID() });
    if (active.status !== "ACTIVATED") throw new Error("Synthetic session failed.");
    const heldTeam = await fixture(), heldEntry = await flow(heldTeam);
    await service.activate(heldEntry.proofCookie, { memberId: heldTeam.first, language: "java", requestKey: randomUUID() });
    const recoveryEntry = await flow(heldTeam), replacements = createReplacementService(api, clock, codec);
    const pending = await replacements.request(recoveryEntry.proofCookie, { memberId: heldTeam.first, requestKey: randomUUID() });
    if (pending.status !== "REQUESTED") throw new Error("Synthetic Round 1 handoff failed.");
    const approverId = randomUUID(), approverCode = newAccessCode();
    await owner.query("INSERT INTO staff_identities(id,display_name,role) VALUES($1,'Synthetic transition approver','ORGANISER')", [approverId]);
    await owner.query("INSERT INTO access_credentials(id,staff_id,verifier,version,issued_at) VALUES($1,$2,$3,1,date_trunc('milliseconds',clock_timestamp()))", [randomUUID(), approverId, approverCode.verifier]);
    const staffEntry = await service.begin(approverCode.code, context());
    if (staffEntry.audience !== "STAFF") throw new Error("Synthetic staff routing failed.");
    const approver = await createStaffService(api, clock, codec).activate(staffEntry.proofCookie, randomUUID());
    await replacements.decide(approver.sessionCookie, { flowId: pending.request.request_id, requestKey: randomUUID(), expectedRevision: "1", action: "APPROVE", reason: "Synthetic Round 1 approved handoff" });
    const r2 = randomUUID(), tr2 = randomUUID();
    await owner.query("UPDATE rounds SET state='CLOSED' WHERE id=$1", [roundId]);
    await owner.query(`INSERT INTO rounds (id,arena_instance_id,kind,state,duration_ms,started_at,closes_at)
      VALUES ($1,$2,2,'RUNNING',3600000,date_trunc('milliseconds',clock_timestamp()),date_trunc('milliseconds',clock_timestamp())+interval '1 hour')`, [r2, arenaId]);
    await owner.query("INSERT INTO team_rounds (id,team_id,round_id,display_name) VALUES ($1,$2,$3,'Round 2 frozen team')", [tr2, team.id, r2]);
    await owner.query("INSERT INTO member_rounds (id,team_round_id,team_id,member_id,round_id,display_name) VALUES ($1,$3,$4,$5,$7,'R2 first'),($2,$3,$4,$6,$7,'R2 second')", [randomUUID(), randomUUID(), tr2, team.id, team.first, team.second, r2]);
    const heldRoster = randomUUID();
    await owner.query("INSERT INTO team_rounds(id,team_id,round_id,display_name) VALUES($1,$2,$3,'Synthetic handoff R2 team')", [heldRoster, heldTeam.id, r2]);
    await owner.query("INSERT INTO member_rounds(id,team_round_id,team_id,member_id,round_id,display_name) VALUES($1,$2,$3,$4,$5,'Synthetic handoff R2 member')", [randomUUID(), heldRoster, heldTeam.id, heldTeam.first, r2]);
    assert.deepEqual(await service.activate(stale.proofCookie, { memberId: team.second, language: "c", requestKey: randomUUID() }), { status: "REJECTED", reason: "ROUND_UNAVAILABLE" });
    const next = await flow(team);
    const r2Active = await service.activate(next.proofCookie, { memberId: team.first, language: "c", requestKey: randomUUID() });
    assert.equal(r2Active.status, "ACTIVATED");
    if (r2Active.status !== "ACTIVATED") throw new Error("Synthetic R2 session failed.");
    assert.equal(r2Active.session.language, "c");
    assert.equal(r2Active.session.roundId, r2);
    assert.equal((await owner.query("SELECT language FROM member_rounds WHERE member_id=$1 AND round_id=$2", [team.first, roundId])).rows[0].language, "cpp");
    await assert.rejects(service.inspect(active.sessionCookie), denied("INVALID_SESSION"));
    assert.equal((await owner.query("SELECT ciphertext FROM session_deliveries WHERE flow_id=$1", [first.flowId])).rows[0].ciphertext, null);
    await assert.rejects(api.query("UPDATE member_session_slots SET session_id=$2 WHERE member_id=$1", [team.first, active.session.sessionId]), { code: "P0001" });
    const delayedLogout = { sessionId: active.session.sessionId, requestKey: randomUUID() };
    await assert.rejects(service.logout(r2Active.sessionCookie, delayedLogout), denied("INVALID_SESSION"));
    await assert.rejects(service.logout(active.sessionCookie, delayedLogout), denied("INVALID_SESSION"));
    assert.equal((await service.inspect(r2Active.sessionCookie)).language, "c");
    const heldR2Flow = await flow(heldTeam);
    const heldR2 = await service.activate(heldR2Flow.proofCookie, { memberId: heldTeam.first, language: "python", requestKey: randomUUID() });
    assert.equal(heldR2.status, "ACTIVATED");
    const retired = (await owner.query("SELECT state,proof_ciphertext FROM replacement_requests WHERE flow_id=$1", [pending.request.request_id])).rows[0];
    assert.deepEqual(retired, { state: "SUPERSEDED", proof_ciphertext: null });
    await assert.rejects(replacements.activate(pending.proofCookie, randomUUID()), denied("INVALID_FLOW"));
  });
}
