import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { commandFingerprint, newProof, parseProof, sameVerifier, uuid } from "./credentials.js";
import type { DeliveryBinding, Language, SessionDelivery } from "./credentials.js";
import { credentialValid, flowValid, isBlocked, lockedRounds, memberHandoffRounds, participantOutcomeCapacity, retireMemberHandoffs, roundFor, sessionRow, sessionValid, view } from "./entry-service.js";
import type { Flow } from "./entry-service.js";
import { memberCommandQuota, memberReadQuota, staffQuota } from "./quotas.js";
import { boundedStaffText, staffRevision } from "./staff-management.js";
import { createStaffService, staffOutcomeCapacity } from "./staff-service.js";
import { AccessError, accessTransaction, advanceRoundTime, decisionTime, first } from "./transaction.js";
import type { ClockGuard } from "./transaction.js";

interface Handoff extends Flow {
  flow_id: string; parent_flow_id: string; request_key: string; fingerprint: Buffer; member_round_id: string; member_id: string;
  round_id: string; expected_session_id: string | null; expected_slot_revision: string; request_state: string;
  proof_key_id: string; proof_ciphertext: string | null; language: Language;
}
interface Slot { session_id: string | null; reservation_flow_id: string | null; revision: string; }
interface Decision {
  id: string; flow_id: string; actor_id: string; request_key: string; fingerprint: Buffer; action: "APPROVE" | "REJECT";
  expected_revision: string; outcome: "APPLIED" | "REJECTED"; denial_reason: string | null; recorded_at: Date;
}
export interface ReplacementDecision { flowId: string; requestKey: string; action: "APPROVE" | "REJECT"; expectedRevision: string; reason: string; }

const requestView = (r: Handoff) => ({ request_id: r.id, state: r.request_state, expires_at: r.expires_at.toISOString() });
const decisionView = (d: Decision) => ({ outcome_id: d.id, request_id: d.flow_id, request_key: d.request_key, action: d.action,
  expected_revision: d.expected_revision, outcome: d.outcome, reason: d.denial_reason, recorded_at: d.recorded_at.toISOString() });
async function handoffRow(client: PoolClient, id: string) {
  return first<Handoff>(client, `SELECT r.*,f.*,r.state AS request_state,m.language FROM replacement_requests r
    JOIN entry_flows f ON f.id=r.flow_id JOIN member_rounds m ON m.id=r.member_round_id WHERE r.flow_id=$1`, [id]);
}
async function anchors(client: PoolClient, r: { member_id: string; round_id: string }, shared = false) {
  const previous = await first<{ round_id: string }>(client, `SELECT s.round_id FROM member_session_slots x JOIN participant_sessions s ON s.id=x.session_id WHERE x.member_id=$1`, [r.member_id]);
  const ids = [...new Set([r.round_id, ...(previous ? [previous.round_id] : []), ...await memberHandoffRounds(client, r.member_id)])];
  await lockedRounds(client, ids, shared);
  const slot = await first<Slot>(client, `SELECT session_id,reservation_flow_id,revision FROM member_session_slots WHERE member_id=$1 FOR ${shared ? "SHARE" : "UPDATE"}`, [r.member_id]);
  if (!slot) throw new AccessError("SECURITY_UNAVAILABLE");
  return { slot, ids };
}
function binding(r: Handoff, stage: "REQUEST" | "SESSION", sessionId: string): DeliveryBinding {
  return { flowId: r.id, sessionId, memberRoundId: r.member_round_id, handoff: stage,
    credentialId: r.credential_id, credentialVersion: r.credential_version, expiresAt: r.expires_at.toISOString() };
}

export function createReplacementService(pool: Pool, clock: ClockGuard, delivery: SessionDelivery) {
  const staff = createStaffService(pool, clock, delivery);
  async function protectedRequest(client: PoolClient, cookie: unknown, shared = false) {
    const proof = parseProof(cookie), initial = proof ? await handoffRow(client, proof.id) : undefined;
    if (!proof || !initial || !sameVerifier(initial.proof_verifier, proof.verifier)) throw new AccessError("INVALID_FLOW");
    const locks = await anchors(client, initial, shared), now = await decisionTime(client, clock, locks.ids);
    const r = (await handoffRow(client, proof.id))!;
    if (now < r.created_at) { clock.fault("CLOCK_REVERSED"); throw new AccessError("CLOCK_UNTRUSTED"); }
    if (r.purpose !== "REPLACEMENT" || now >= r.expires_at || !["OPEN", "ACTIVATED"].includes(r.state)
      || !["PENDING", "APPROVED", "ACTIVATED"].includes(r.request_state) || !await credentialValid(client, r, now)) throw new AccessError("INVALID_FLOW");
    const round = await roundFor(client, r.round_id);
    if (!round || await isBlocked(client, round.arena_instance_id, r.team_id, r.member_id)) throw new AccessError("ACCESS_UNAVAILABLE");
    return { r, round, now, ...locks };
  }
  async function creationContext(client: PoolClient, cookie: unknown, memberId: string, shared = false) {
    const proof = parseProof(cookie), f = proof ? await first<Flow>(client, "SELECT * FROM entry_flows WHERE id=$1", [proof.id]) : undefined;
    if (!proof || !f || !sameVerifier(f.proof_verifier, proof.verifier)) throw new AccessError("INVALID_FLOW");
    const m = await first<{ id: string; member_id: string; round_id: string; enrolled_at: Date | null }>(client,
      "SELECT id,member_id,round_id,enrolled_at FROM member_rounds WHERE member_id=$1 AND team_id=$2 AND round_id=$3", [memberId, f.team_id, f.round_id]);
    if (!m?.enrolled_at) throw new AccessError("ROUND_OR_MEMBER_UNAVAILABLE");
    const locks = await anchors(client, m, shared), now = await decisionTime(client, clock, locks.ids);
    if (!flowValid(f, proof.verifier, now, clock) || !await credentialValid(client, f, now)) throw new AccessError("INVALID_FLOW");
    const round = await roundFor(client, m.round_id);
    if (!round?.current || !["RUNNING", "PAUSED"].includes(round.state) || (round.state === "RUNNING" && (!round.closes_at || now >= round.closes_at))) throw new AccessError("ROUND_OR_MEMBER_UNAVAILABLE");
    if (await isBlocked(client, round.arena_instance_id, f.team_id, memberId)) throw new AccessError("ACCESS_UNAVAILABLE");
    return { f, m, round, now, ...locks };
  }
  const service = {
    async request(cookie: unknown, input: { memberId: string; requestKey: string }, participantCookie?: unknown) {
      uuid(input.memberId); uuid(input.requestKey);
      const memberRound = await accessTransaction(pool, clock, async (client) => (await creationContext(client, cookie, input.memberId, true)).m.id, "SHARED");
      await memberCommandQuota(pool, clock, memberRound);
      return accessTransaction(pool, clock, async (client) => {
        const context = await creationContext(client, cookie, input.memberId);
        const { f, m, round, now, ids } = context;
        let slot = context.slot;
        const current = parseProof(participantCookie);
        if (current && slot.session_id === current.id) {
          const row = await sessionRow(client, current.id);
          if (row?.member_round_id === m.id && await sessionValid(client, row, current.verifier, now, clock)) return { status: "RESUME" as const, session: view(row) };
        }
        const fingerprint = commandFingerprint(["REPLACEMENT_REQUEST_V1", f.id, input.memberId]);
        const prior = await first<{ flow_id: string; fingerprint: Buffer }>(client, "SELECT flow_id,fingerprint FROM replacement_requests WHERE parent_flow_id=$1 AND request_key=$2", [f.id, input.requestKey]);
        if (prior) {
          if (!sameVerifier(prior.fingerprint, fingerprint)) throw new AccessError("INTENT_CONFLICT");
          const r = (await handoffRow(client, prior.flow_id))!;
          if (now >= r.expires_at || !r.proof_ciphertext || r.proof_key_id !== delivery.keyId || !["PENDING", "APPROVED", "ACTIVATED"].includes(r.request_state)) throw new AccessError("INVALID_FLOW");
          return { status: "REQUESTED" as const, proofCookie: await delivery.decrypt(r.proof_ciphertext, binding(r, "REQUEST", r.id)), request: requestView(r) };
        }
        if (slot.reservation_flow_id) {
          const held = await handoffRow(client, slot.reservation_flow_id);
          if (!held) throw new AccessError("SECURITY_UNAVAILABLE");
          if (now < held.expires_at && await credentialValid(client, held, now)) throw new AccessError("HANDOFF_NOT_READY");
          await retireMemberHandoffs(client, input.memberId, now);
          slot = (await first<Slot>(client, "SELECT session_id,reservation_flow_id,revision FROM member_session_slots WHERE member_id=$1", [input.memberId]))!;
        }
        const count = await first<{ live: number; owned: number; retained: number; pending: number }>(client, `SELECT
          (count(*) FILTER (WHERE expires_at>$2 AND state IN ('OPEN','ACTIVATED'))+(SELECT count(*) FROM staff_entry_flows WHERE expires_at>$2 AND state IN ('OPEN','ACTIVATED')))::integer AS live,
          count(*) FILTER (WHERE credential_id=$1 AND expires_at>$2 AND state IN ('OPEN','ACTIVATED'))::integer AS owned,
          count(*) FILTER (WHERE purpose='REPLACEMENT')::integer AS retained,
          (SELECT count(*) FROM replacement_requests r JOIN entry_flows f ON f.id=r.flow_id WHERE r.member_id=$3 AND r.state IN ('PENDING','APPROVED') AND f.expires_at>$2)::integer AS pending
          FROM entry_flows`, [f.credential_id, now, input.memberId]);
        if (!count || count.live >= 1000 || count.owned >= 8 || count.retained >= 50000 || count.pending >= 2) throw new AccessError("FLOW_CAPACITY_UNAVAILABLE");
        const proof = newProof(), expires = new Date(now.getTime() + 600000);
        const b: DeliveryBinding = { flowId: proof.id, sessionId: proof.id, memberRoundId: m.id, handoff: "REQUEST", credentialId: f.credential_id, credentialVersion: f.credential_version, expiresAt: expires.toISOString() };
        const ciphertext = await delivery.encrypt(b, proof.cookie);
        await client.query(`INSERT INTO entry_flows(id,team_id,credential_id,credential_version,purpose,proof_verifier,round_id,state,created_at,expires_at)
          VALUES($1,$2,$3,$4,'REPLACEMENT',$5,$6,'OPEN',$7,$8)`, [proof.id, f.team_id, f.credential_id, f.credential_version, proof.verifier, round.id, now, expires]);
        await client.query(`INSERT INTO replacement_requests(flow_id,parent_flow_id,request_key,fingerprint,member_round_id,member_id,team_id,round_id,expected_session_id,expected_slot_revision,state,proof_key_id,proof_ciphertext)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'PENDING',$11,$12)`, [proof.id, f.id, input.requestKey, fingerprint, m.id, input.memberId, f.team_id, round.id, slot.session_id, slot.revision, delivery.keyId, ciphertext]);
        await client.query("INSERT INTO entry_events(id,flow_id,kind,created_at) VALUES($1,$2,'FLOW_OPENED',$3)", [randomUUID(), proof.id, now]);
        await advanceRoundTime(client, ids, now);
        return { status: "REQUESTED" as const, proofCookie: proof.cookie, request: requestView((await handoffRow(client, proof.id))!) };
      }, "EXCLUSIVE");
    },
    async describe(cookie: unknown) {
      const memberId = await accessTransaction(pool, clock, async (client) => (await protectedRequest(client, cookie, true)).r.member_id, "SHARED");
      await memberReadQuota(pool, clock, memberId);
      return accessTransaction(pool, clock, async (client) => requestView((await protectedRequest(client, cookie, true)).r), "SHARED");
    },
    async decide(cookie: unknown, input: ReplacementDecision) {
      uuid(input.flowId); uuid(input.requestKey); staffRevision(input.expectedRevision); boundedStaffText(input.reason, 1024);
      if (!["APPROVE", "REJECT"].includes(input.action)) throw new AccessError("INVALID_CONTEXT");
      const actor = await staff.inspect(cookie); await staffQuota(pool, clock, actor.staff_id, "STAFF_COMMAND");
      const fingerprint = commandFingerprint(["REPLACEMENT_DECISION_V1", input.flowId, input.action, input.expectedRevision, input.reason]);
      return accessTransaction(pool, clock, async (client) => {
        const r = await handoffRow(client, input.flowId);
        if (!r) throw new AccessError("REPLACEMENT_UNAVAILABLE");
        const { slot, ids } = await anchors(client, r), now = await decisionTime(client, clock, ids), current = await staff.authorize(client, cookie, now);
        const prior = await first<Decision>(client, "SELECT * FROM replacement_decisions WHERE actor_id=$1 AND request_key=$2", [current.staff_id, input.requestKey]);
        if (prior) { if (!sameVerifier(prior.fingerprint, fingerprint)) throw new AccessError("INTENT_CONFLICT"); return decisionView(prior); }
        await staffOutcomeCapacity(client);
        const round = await roundFor(client, r.round_id);
        let denial: string | null = r.request_state !== "PENDING" || r.state !== "OPEN" || input.expectedRevision !== r.expected_slot_revision
          || slot.revision !== r.expected_slot_revision || slot.session_id !== r.expected_session_id ? "STALE_REQUEST" : now >= r.expires_at ? "EXPIRED" : null;
        if (!denial && (!round?.current || !["RUNNING", "PAUSED"].includes(round.state) || (round.state === "RUNNING" && (!round.closes_at || now >= round.closes_at)))) denial = "ROUND_UNAVAILABLE";
        if (!denial && (!await credentialValid(client, r, now) || await isBlocked(client, round!.arena_instance_id, r.team_id, r.member_id))) denial = "ACCESS_UNAVAILABLE";
        if (!denial && slot.reservation_flow_id) denial = "HANDOFF_RESERVED";
        const id = randomUUID();
        await client.query(`INSERT INTO replacement_decisions(id,flow_id,actor_id,session_id,credential_id,credential_version,request_key,fingerprint,action,expected_revision,reason,outcome,denial_reason,recorded_at)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`, [id, r.id, current.staff_id, current.id, current.credential_id, current.credential_version,
          input.requestKey, fingerprint, input.action, input.expectedRevision, input.reason, denial ? "REJECTED" : "APPLIED", denial, now]);
        if (!denial) {
          if (input.action === "REJECT") {
            await client.query("UPDATE replacement_requests SET state='REJECTED',proof_ciphertext=NULL,proof_purged_at=$2 WHERE flow_id=$1", [r.id, now]);
            await client.query("UPDATE entry_flows SET state='REVOKED' WHERE id=$1", [r.id]);
          } else {
            await retireMemberHandoffs(client, r.member_id, now, r.id);
            if (slot.session_id) {
              const old = await sessionRow(client, slot.session_id, false);
              if (!old || now < old.last_activity_at || now < old.created_at) { clock.fault("CLOCK_REVERSED"); throw new AccessError("CLOCK_UNTRUSTED"); }
              await client.query("UPDATE participant_sessions SET revoked_at=$2,revocation_reason='REPLACED' WHERE id=$1 AND revoked_at IS NULL", [slot.session_id, now]);
              await client.query("UPDATE session_deliveries SET ciphertext=NULL,purged_at=$2 WHERE session_id=$1 AND ciphertext IS NOT NULL", [slot.session_id, now]);
              await client.query("UPDATE entry_flows SET state='SUPERSEDED' WHERE activated_session_id=$1 AND state='ACTIVATED'", [slot.session_id]);
            }
            await client.query("UPDATE replacement_requests SET state='APPROVED' WHERE flow_id=$1", [r.id]);
            await client.query("UPDATE member_session_slots SET session_id=NULL,reservation_flow_id=$2,revision=revision+1 WHERE member_id=$1", [r.member_id, r.id]);
          }
          await client.query("UPDATE staff_sessions SET last_activity_at=$2 WHERE id=$1", [current.id, now]);
        }
        await advanceRoundTime(client, ids, now);
        return decisionView((await first<Decision>(client, "SELECT * FROM replacement_decisions WHERE id=$1", [id]))!);
      }, "EXCLUSIVE");
    },
    async activate(cookie: unknown, requestKey: string) {
      uuid(requestKey); const fresh = newProof();
      const memberRoundId = await accessTransaction(pool, clock, async (client) => (await protectedRequest(client, cookie, true)).r.member_round_id, "SHARED");
      await memberCommandQuota(pool, clock, memberRoundId);
      return accessTransaction(pool, clock, async (client) => {
        const { r, slot, now, round, ids } = await protectedRequest(client, cookie);
        const fingerprint = commandFingerprint(["REPLACEMENT_ACTIVATE_V1", r.id, r.member_round_id, r.language]);
        const prior = await first<{ request_key: string; fingerprint: Buffer; session_id: string }>(client, "SELECT request_key,fingerprint,session_id FROM entry_outcomes WHERE flow_id=$1 AND outcome='ACTIVATED'", [r.id]);
        if (prior) {
          if (prior.request_key !== requestKey || !sameVerifier(prior.fingerprint, fingerprint)) throw new AccessError("INTENT_CONFLICT");
          const saved = await first<{ ciphertext: string | null; key_id: string }>(client, "SELECT ciphertext,key_id FROM session_deliveries WHERE flow_id=$1 AND session_id=$2", [r.id, prior.session_id]);
          if (!saved?.ciphertext || saved.key_id !== delivery.keyId || r.activated_session_id !== prior.session_id) throw new AccessError("DELIVERY_UNAVAILABLE");
          const exact = await delivery.decrypt(saved.ciphertext, binding(r, "SESSION", prior.session_id)), proof = parseProof(exact)!;
          const row = await sessionRow(client, proof.id);
          if (!await sessionValid(client, row, proof.verifier, now, clock)) throw new AccessError("INVALID_SESSION");
          return { status: "ACTIVATED" as const, sessionCookie: exact, session: view(row!) };
        }
        if (r.request_state !== "APPROVED") throw new AccessError("HANDOFF_NOT_READY");
        if (slot.reservation_flow_id !== r.id || slot.session_id !== null || BigInt(slot.revision) !== BigInt(r.expected_slot_revision) + 1n) throw new AccessError("INVALID_FLOW");
        if (!round.current || !["RUNNING", "PAUSED"].includes(round.state) || (round.state === "RUNNING" && (!round.closes_at || now >= round.closes_at))) throw new AccessError("ACCESS_UNAVAILABLE");
        await participantOutcomeCapacity(client);
        if ((await client.query("SELECT count(*)::integer AS n FROM participant_sessions")).rows[0].n >= 50000) throw new AccessError("SESSION_CAPACITY_UNAVAILABLE");
        const ciphertext = await delivery.encrypt(binding(r, "SESSION", fresh.id), fresh.cookie);
        await client.query(`INSERT INTO participant_sessions(id,member_round_id,member_id,team_id,round_id,entry_flow_id,credential_id,credential_version,secret_verifier,created_at,absolute_expires_at,last_activity_at)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$10)`, [fresh.id, r.member_round_id, r.member_id, r.team_id, r.round_id, r.id, r.credential_id, r.credential_version, fresh.verifier, now, new Date(now.getTime() + 28800000)]);
        await client.query("UPDATE entry_flows SET state='ACTIVATED',activated_session_id=$2,activated_at=$3 WHERE id=$1", [r.id, fresh.id, now]);
        await client.query("UPDATE replacement_requests SET state='ACTIVATED' WHERE flow_id=$1", [r.id]);
        await client.query("UPDATE member_session_slots SET session_id=$2,reservation_flow_id=NULL,revision=revision+1 WHERE member_id=$1", [r.member_id, fresh.id]);
        await client.query("INSERT INTO session_deliveries(flow_id,session_id,key_id,ciphertext,expires_at) VALUES($1,$2,$3,$4,$5)", [r.id, fresh.id, delivery.keyId, ciphertext, r.expires_at]);
        await client.query(`INSERT INTO entry_outcomes(flow_id,request_key,fingerprint,member_id,language,outcome,session_id,recorded_at)
          VALUES($1,$2,$3,$4,$5,'ACTIVATED',$6,$7)`, [r.id, requestKey, fingerprint, r.member_id, r.language, fresh.id, now]);
        await client.query("INSERT INTO entry_events(id,flow_id,session_id,kind,created_at) VALUES($1,$2,$3,'SESSION_ACTIVATED',$4)", [randomUUID(), r.id, fresh.id, now]);
        await advanceRoundTime(client, ids, now);
        return { status: "ACTIVATED" as const, sessionCookie: fresh.cookie, session: view((await sessionRow(client, fresh.id))!) };
      }, "EXCLUSIVE");
    },
    async recover(cookie: unknown) {
      const key = await accessTransaction(pool, clock, async (client) => {
        const { r } = await protectedRequest(client, cookie, true);
        const prior = await first<{ request_key: string }>(client, "SELECT request_key FROM entry_outcomes WHERE flow_id=$1 AND outcome='ACTIVATED'", [r.id]);
        if (!prior) throw new AccessError("HANDOFF_NOT_READY"); return prior.request_key;
      }, "SHARED");
      return service.activate(cookie, key);
    },
    async list(cookie: unknown, after?: string) {
      if (after) uuid(after); const actor = await staff.inspect(cookie); await staffQuota(pool, clock, actor.staff_id, "READ_STAFF");
      return accessTransaction(pool, clock, async (client) => {
        const now = await decisionTime(client, clock); await staff.authorize(client, cookie, now);
        const rows = (await client.query<{ request_id: string; member_name: string; team_name: string; state: string; expected_revision: string; created_at: Date; expires_at: Date }>(`SELECT f.id AS request_id,m.display_name AS member_name,tr.display_name AS team_name,
          r.state,r.expected_slot_revision AS expected_revision,f.created_at,f.expires_at FROM replacement_requests r JOIN entry_flows f ON f.id=r.flow_id
          JOIN member_rounds m ON m.id=r.member_round_id JOIN team_rounds tr ON tr.id=m.team_round_id
          WHERE r.state IN ('PENDING','APPROVED') AND f.expires_at>$1 AND ($2::uuid IS NULL OR f.id>$2) ORDER BY f.id LIMIT 50`, [now, after ?? null])).rows;
        return { items: rows.map((r) => ({ ...r, created_at: r.created_at.toISOString(), expires_at: r.expires_at.toISOString() })), next_after: rows.length === 50 ? rows.at(-1)!.request_id : null };
      }, "SHARED");
    },
    async outcome(cookie: unknown, requestKey: string) {
      uuid(requestKey); const actor = await staff.inspect(cookie); await staffQuota(pool, clock, actor.staff_id, "READ_STAFF");
      return accessTransaction(pool, clock, async (client) => {
        const current = await staff.authorize(client, cookie, await decisionTime(client, clock));
        const row = await first<Decision>(client, "SELECT * FROM replacement_decisions WHERE actor_id=$1 AND request_key=$2", [current.staff_id, requestKey]);
        return { status: row ? "OBSERVED" as const : "NOT_OBSERVED" as const, receipt: row ? decisionView(row) : null };
      }, "SHARED");
    },
  };
  return service;
}
