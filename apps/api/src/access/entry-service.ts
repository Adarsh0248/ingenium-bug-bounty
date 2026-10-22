import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { canonicalCode, commandFingerprint, language, newProof, parseProof, sameVerifier, sha256, uuid } from "./credentials.js";
import type { DeliveryBinding, Language, SessionDelivery } from "./credentials.js";
import { memberCommandQuota, memberReadQuota, verificationQuota } from "./quotas.js";
import { AccessError, accessTransaction, advanceRoundTime, decisionTime, first } from "./transaction.js";
import type { ClockGuard } from "./transaction.js";
import { openStaffFlow } from "./staff-service.js";

export interface Flow {
  id: string; team_id: string; credential_id: string; credential_version: string; round_id: string | null; state: string;
  purpose: "TEAM_ENTRY" | "REPLACEMENT";
  proof_verifier: Buffer; created_at: Date; expires_at: Date; activated_session_id: string | null;
}
interface Round { id: string; arena_instance_id: string; kind: number; state: string; closes_at: Date | null; current: boolean; }
interface Member { id: string; member_id: string; team_id: string; round_id: string; language: Language | null; enrolled_at: Date | null; }
interface Session {
  id: string; member_round_id: string; member_id: string; team_id: string; round_id: string; entry_flow_id: string;
  credential_id: string; credential_version: string; secret_verifier: Buffer; created_at: Date; absolute_expires_at: Date;
  last_activity_at: Date; revoked_at: Date | null; revocation_reason: string | null; language: Language; team_name: string; member_name: string; arena_instance_id: string; round_state: string;
}
interface Outcome { fingerprint: Buffer; outcome: "ACTIVATED" | "REJECTED"; reason: string | null; session_id: string | null; }
export interface Activation { memberId: string; language: Language; requestKey: string; }
export interface SessionCommand { sessionId: string; requestKey: string; }
type SessionAction = "KEEP_ALIVE" | "LOGOUT";
interface SessionOutcome {
  session_id: string; request_key: string; action: SessionAction; fingerprint: Buffer; recorded_at: Date; expires_at: Date;
}

function reversed(clock: ClockGuard): never { clock.fault("CLOCK_REVERSED"); throw new AccessError("CLOCK_UNTRUSTED"); }

export function flowValid(flow: Flow | undefined, verifier: Buffer, now: Date, clock: ClockGuard): flow is Flow {
  if (flow && now < flow.created_at) reversed(clock);
  return Boolean(flow && flow.purpose === "TEAM_ENTRY" && sameVerifier(flow.proof_verifier, verifier) && ["OPEN", "ACTIVATED"].includes(flow.state) && now < flow.expires_at);
}

export async function credentialValid(client: PoolClient, flow: Pick<Flow, "credential_id" | "credential_version" | "team_id">, now: Date): Promise<boolean> {
  return Boolean(await first(client, "SELECT id FROM access_credentials WHERE id=$1 AND version=$2 AND team_id=$3 AND revoked_at IS NULL AND issued_at <= $4", [flow.credential_id, flow.credential_version, flow.team_id, now]));
}

export async function isBlocked(client: PoolClient, arenaId: string, teamId: string, memberId?: string): Promise<boolean> {
  return Boolean(await first(client, "SELECT id FROM access_blocks WHERE arena_instance_id=$1 AND cleared_at IS NULL AND (team_id=$2 OR member_id=$3) LIMIT 1", [arenaId, teamId, memberId ?? null]));
}

export async function lockedRounds(client: PoolClient, ids: string[], shared = false): Promise<void> {
  const sorted = [...new Set(ids)].sort();
  if (!sorted.length) return;
  const result = await client.query(`SELECT id FROM rounds WHERE id=ANY($1::uuid[]) ORDER BY id FOR ${shared ? "SHARE" : "UPDATE"}`, [sorted]);
  if (result.rowCount !== sorted.length) throw new AccessError("ROUND_UNAVAILABLE");
}

export async function roundFor(client: PoolClient, id: string): Promise<Round | undefined> {
  return first<Round>(client, `SELECT r.*, (a.status='IN_PROGRESS' AND c.current_instance_id=a.id) AS current
    FROM rounds r JOIN arena_instances a ON a.id=r.arena_instance_id CROSS JOIN arena_control c WHERE c.id=1 AND r.id=$1`, [id]);
}

export async function sessionRow(client: PoolClient, sessionId: string, current = true): Promise<Session | undefined> {
  return first<Session>(client, `SELECT s.*, mr.language, mr.display_name AS member_name, tr.display_name AS team_name,
      r.arena_instance_id, r.state AS round_state FROM participant_sessions s
    JOIN member_rounds mr ON mr.id=s.member_round_id JOIN team_rounds tr ON tr.id=mr.team_round_id JOIN rounds r ON r.id=s.round_id
    WHERE s.id=$1 AND (NOT $2 OR EXISTS (SELECT 1 FROM member_session_slots slot WHERE slot.member_id=s.member_id AND slot.session_id=s.id))`, [sessionId, current]);
}

export async function sessionValid(client: PoolClient, row: Session | undefined, verifier: Buffer, now: Date, clock: ClockGuard): Promise<boolean> {
  if (row && (now < row.created_at || now < row.last_activity_at)) reversed(clock);
  return Boolean(row && sameVerifier(row.secret_verifier, verifier) && !row.revoked_at && participantTimeValid(row, now) && await credentialValid(client, row, now)
    && !await isBlocked(client, row.arena_instance_id, row.team_id, row.member_id));
}

export function participantTimeValid(row: Pick<Session, "created_at" | "last_activity_at" | "absolute_expires_at">, now: Date): boolean {
  if (now < row.created_at || now < row.last_activity_at) throw new AccessError("CLOCK_UNTRUSTED");
  return now < row.absolute_expires_at && now.getTime() < row.last_activity_at.getTime() + 7200000;
}

export function participantDeadlines(row: Pick<Session, "absolute_expires_at" | "last_activity_at">) {
  const expires = Math.min(row.absolute_expires_at.getTime(), row.last_activity_at.getTime() + 7200000);
  return { expiresAt: new Date(expires).toISOString(), absoluteExpiresAt: row.absolute_expires_at.toISOString(),
    warningAt: new Date(expires - 300000).toISOString() };
}

export function view(row: Session) {
  return { sessionId: row.id, memberId: row.member_id, memberRoundId: row.member_round_id, teamId: row.team_id, roundId: row.round_id,
    language: row.language, memberName: row.member_name, teamName: row.team_name, roundState: row.round_state,
    ...participantDeadlines(row) };
}

function sessionReceipt(row: SessionOutcome) {
  return { sessionId: row.session_id, requestKey: row.request_key, action: row.action, recordedAt: row.recorded_at.toISOString(), expiresAt: row.expires_at.toISOString() };
}

export async function participantOutcomeCapacity(client: PoolClient) {
  const count = await first<{ n: number }>(client, `SELECT ((SELECT count(*) FROM entry_outcomes)
    +(SELECT count(*) FROM participant_session_outcomes)+(SELECT count(*) FROM competition_outcomes WHERE participant_session_id IS NOT NULL)
    +(SELECT count(*) FROM draft_save_outcomes)+(SELECT count(*) FROM workbench_activities WHERE request_key IS NOT NULL))::integer AS n`);
  if (!count || count.n >= 4000000) throw new AccessError("OUTCOME_CAPACITY_UNAVAILABLE");
}

export async function memberHandoffRounds(client: PoolClient, memberId: string): Promise<string[]> {
  // A handoff may outlive its round's current slot.
  return (await client.query<{ round_id: string }>(`SELECT DISTINCT round_id FROM replacement_requests
    WHERE member_id=$1 AND (state IN ('PENDING','APPROVED') OR proof_ciphertext IS NOT NULL)`, [memberId])).rows.map((r) => r.round_id);
}

export async function retireMemberHandoffs(client: PoolClient, memberId: string, now: Date, except: string | null = null) {
  await client.query(`WITH retired AS (
    UPDATE replacement_requests SET state='SUPERSEDED' WHERE member_id=$1 AND flow_id IS DISTINCT FROM $2::uuid AND state IN ('PENDING','APPROVED') RETURNING flow_id
  ) UPDATE entry_flows SET state='SUPERSEDED' WHERE id IN (SELECT flow_id FROM retired) AND state='OPEN'`, [memberId, except]);
  await client.query(`UPDATE replacement_requests SET proof_ciphertext=NULL,proof_purged_at=$2
    WHERE member_id=$1 AND flow_id IS DISTINCT FROM $3::uuid AND proof_ciphertext IS NOT NULL`, [memberId, now, except]);
  await client.query(`UPDATE member_session_slots SET reservation_flow_id=NULL,revision=revision+1
    WHERE member_id=$1 AND reservation_flow_id IS NOT NULL AND reservation_flow_id IS DISTINCT FROM $2::uuid`, [memberId, except]);
}

async function sessionCommandContext(client: PoolClient, clock: ClockGuard, proof: NonNullable<ReturnType<typeof parseProof>>,
  input: SessionCommand, action?: SessionAction, shared = false) {
  const initial = await sessionRow(client, proof.id, false);
  if (!initial || !sameVerifier(initial.secret_verifier, proof.verifier)) throw new AccessError("INVALID_SESSION");
  const roundIds = [initial.round_id, ...(action === "LOGOUT" ? await memberHandoffRounds(client, initial.member_id) : [])];
  await lockedRounds(client, roundIds, shared);
  const slot = await first<{ session_id: string | null }>(client, `SELECT session_id FROM member_session_slots WHERE member_id=$1 FOR ${shared ? "SHARE" : "UPDATE"}`, [initial.member_id]);
  const now = await decisionTime(client, clock, roundIds);
  const row = await sessionRow(client, proof.id, false);
  if (!row || !sameVerifier(row.secret_verifier, proof.verifier)) throw new AccessError("INVALID_SESSION");
  const prior = await first<SessionOutcome>(client, "SELECT * FROM participant_session_outcomes WHERE session_id=$1 AND request_key=$2", [proof.id, input.requestKey]);
  if (prior && action && !sameVerifier(prior.fingerprint, commandFingerprint(["PARTICIPANT_SESSION_V1", action, proof.id]))) throw new AccessError("INTENT_CONFLICT");
  // A lost logout reply grants only its original receipt, never renewed session authority.
  const signedOutReceipt = prior?.action === "LOGOUT" && row.revocation_reason === "LOGOUT" && row.revoked_at?.getTime() === prior.recorded_at.getTime();
  if (row.created_at > now || row.last_activity_at > now) reversed(clock);
  if (signedOutReceipt) {
    if (!participantTimeValid(row, now) || !await credentialValid(client, row, now)
      || await isBlocked(client, row.arena_instance_id, row.team_id, row.member_id)) throw new AccessError("INVALID_SESSION");
  } else if (slot?.session_id !== row.id || !await sessionValid(client, row, proof.verifier, now, clock)) throw new AccessError("INVALID_SESSION");
  return { row, now, prior, roundIds };
}

function commandProof(cookie: unknown, input: SessionCommand) {
  uuid(input.sessionId); uuid(input.requestKey);
  const proof = parseProof(cookie);
  if (!proof || proof.id !== input.sessionId) throw new AccessError("INVALID_SESSION");
  return proof;
}

type ActivationResult = { status: "REJECTED"; reason: string | null } | { status: "ACTIVATED"; sessionCookie: string; session: ReturnType<typeof view> };

export function createEntryService(pool: Pool, clock: ClockGuard, delivery: SessionDelivery) {
  async function sessionCommand(cookie: unknown, input: SessionCommand, action: SessionAction) {
    const proof = commandProof(cookie, input);
    const memberRoundId = await accessTransaction(pool, clock, async (client) =>
      (await sessionCommandContext(client, clock, proof, input, action, true)).row.member_round_id, "SHARED");
    await memberCommandQuota(pool, clock, memberRoundId);
    return accessTransaction(pool, clock, async (client) => {
      const { row, now, prior, roundIds } = await sessionCommandContext(client, clock, proof, input, action);
      if (prior) return { receipt: sessionReceipt(prior), session: view(row) };
      await participantOutcomeCapacity(client);
      const expires = action === "KEEP_ALIVE" ? participantDeadlines({ ...row, last_activity_at: now }).expiresAt : participantDeadlines(row).expiresAt;
      const outcome: SessionOutcome = { session_id: row.id, request_key: input.requestKey, action,
        fingerprint: commandFingerprint(["PARTICIPANT_SESSION_V1", action, row.id]), recorded_at: now, expires_at: new Date(expires) };
      await client.query(`INSERT INTO participant_session_outcomes(session_id,request_key,action,fingerprint,recorded_at,expires_at)
        VALUES($1,$2,$3,$4,$5,$6)`, [row.id, input.requestKey, action, outcome.fingerprint, now, expires]);
      if (action === "KEEP_ALIVE") {
        await client.query("UPDATE participant_sessions SET last_activity_at=$2 WHERE id=$1", [row.id, now]);
      } else {
        await retireMemberHandoffs(client, row.member_id, now);
        await client.query("UPDATE participant_sessions SET revoked_at=$2,revocation_reason='LOGOUT' WHERE id=$1", [row.id, now]);
        await client.query("UPDATE member_session_slots SET session_id=NULL,revision=revision+1 WHERE member_id=$1 AND session_id=$2", [row.member_id, row.id]);
        await client.query("UPDATE entry_flows SET state='REVOKED' WHERE id=$1 AND state='ACTIVATED'", [row.entry_flow_id]);
        await client.query("UPDATE session_deliveries SET ciphertext=NULL,purged_at=$2 WHERE session_id=$1 AND ciphertext IS NOT NULL", [row.id, now]);
      }
      await advanceRoundTime(client, roundIds, now);
      return { receipt: sessionReceipt(outcome), session: view(action === "KEEP_ALIVE" ? { ...row, last_activity_at: now } : row) };
    }, "EXCLUSIVE");
  }
  const service = {
    async keepAlive(cookie: unknown, input: SessionCommand) { return sessionCommand(cookie, input, "KEEP_ALIVE"); },
    async logout(cookie: unknown, input: SessionCommand) {
      const result = await sessionCommand(cookie, input, "LOGOUT");
      return { signedOut: true as const, receipt: result.receipt };
    },
    async sessionOutcome(cookie: unknown, input: SessionCommand) {
      const proof = commandProof(cookie, input);
      const memberId = await accessTransaction(pool, clock, async (client) =>
        (await sessionCommandContext(client, clock, proof, input, undefined, true)).row.member_id, "SHARED");
      await memberReadQuota(pool, clock, memberId);
      return accessTransaction(pool, clock, async (client) => {
        const { prior } = await sessionCommandContext(client, clock, proof, input, undefined, true);
        return { status: prior ? "OBSERVED" as const : "NOT_OBSERVED" as const, receipt: prior ? sessionReceipt(prior) : null };
      }, "SHARED");
    },
    async begin(codeInput: unknown, context: { ip: string; browserId: string }) {
      let code: string;
      try { code = canonicalCode(codeInput); } catch { throw new AccessError("INVALID_CODE"); }
      const verifier = sha256(code);
      await verificationQuota(pool, clock, context.ip, context.browserId, verifier);
      const proof = newProof();
      return accessTransaction(pool, clock, async (client) => {
        const credential = await first<{ id: string; version: string; team_id: string | null; staff_id: string | null; issued_at: Date }>(client,
          "SELECT id,version,team_id,staff_id,issued_at FROM access_credentials WHERE verifier=$1 AND revoked_at IS NULL", [verifier]);
        if (!credential) throw new AccessError("INVALID_CODE");
        if (credential.staff_id) {
          const now = await decisionTime(client, clock);
          if (now < credential.issued_at) reversed(clock);
          if (!await first(client, "SELECT id FROM staff_identities WHERE id=$1 AND disabled_at IS NULL", [credential.staff_id])) throw new AccessError("INVALID_CODE");
          return openStaffFlow(client, { ...credential, staff_id: credential.staff_id }, now);
        }
        if (!credential.team_id) throw new AccessError("INVALID_CODE");
        if ((await client.query("SELECT id FROM arena_control WHERE id=1")).rowCount !== 1) throw new AccessError("SECURITY_UNAVAILABLE");
        const active = await first<{ id: string; arena_instance_id: string }>(client, `SELECT r.id,r.arena_instance_id FROM arena_control c
          JOIN arena_instances a ON a.id=c.current_instance_id AND a.status='IN_PROGRESS'
          JOIN rounds r ON r.arena_instance_id=a.id AND r.state IN ('RUNNING','PAUSED') WHERE c.id=1`);
        await lockedRounds(client, active ? [active.id] : []);
        const now = await decisionTime(client, clock, active ? [active.id] : []);
        if (now < credential.issued_at) reversed(clock);
        const capacity = await first<{ live: number; owned: number; retained: number }>(client, `SELECT (count(*) FILTER (WHERE expires_at>$2 AND state IN ('OPEN','ACTIVATED'))
          +(SELECT count(*) FROM staff_entry_flows WHERE expires_at>$2 AND state IN ('OPEN','ACTIVATED')))::integer AS live,
          count(*) FILTER (WHERE credential_id=$1 AND expires_at>$2 AND state IN ('OPEN','ACTIVATED'))::integer AS owned,
          count(*) FILTER (WHERE purpose='TEAM_ENTRY')::integer AS retained FROM entry_flows`, [credential.id, now]);
        if (!capacity || capacity.live >= 1000 || capacity.owned >= 8 || capacity.retained >= 50000) throw new AccessError("FLOW_CAPACITY_UNAVAILABLE");
        if (active && await isBlocked(client, active.arena_instance_id, credential.team_id)) throw new AccessError("ACCESS_UNAVAILABLE");
        const team = await first<{ display_name: string }>(client, "SELECT display_name FROM teams WHERE id=$1", [credential.team_id]);
        const members = (await client.query<{ id: string; display_name: string }>("SELECT id,display_name FROM team_members WHERE team_id=$1 ORDER BY position", [credential.team_id])).rows;
        if (!team || members.length !== 2) throw new AccessError("REGISTRATION_UNAVAILABLE");
        const expiresAt = new Date(now.getTime() + 600000);
        await client.query(`INSERT INTO entry_flows (id,team_id,credential_id,credential_version,proof_verifier,round_id,state,created_at,expires_at)
          VALUES ($1,$2,$3,$4,$5,$6,'OPEN',$7,$8)`, [proof.id, credential.team_id, credential.id, credential.version, proof.verifier, active?.id ?? null, now, expiresAt]);
        await client.query("INSERT INTO entry_events (id,flow_id,kind,created_at) VALUES ($1,$2,'FLOW_OPENED',$3)", [randomUUID(), proof.id, now]);
        await advanceRoundTime(client, active ? [active.id] : [], now);
        return { audience: "TEAM" as const, proofCookie: proof.cookie, flowId: proof.id, expiresAt: expiresAt.toISOString(),
          teamName: team.display_name, members: members.map((member) => ({ id: member.id, name: member.display_name })), roundId: active?.id ?? null };
      }, "EXCLUSIVE");
    },

    async activate(proofCookie: unknown, input: Activation): Promise<ActivationResult> {
      const proof = parseProof(proofCookie);
      if (!proof) throw new AccessError("INVALID_FLOW");
      uuid(input.memberId); uuid(input.requestKey); language(input.language);
      const fingerprint = sha256(JSON.stringify([1, proof.id, input.memberId, input.language]));
      const freshSession = newProof();
      return accessTransaction(pool, clock, async (client) => {
        const flow = await first<Flow>(client, "SELECT * FROM entry_flows WHERE id=$1", [proof.id]);
        if (!flow || !sameVerifier(flow.proof_verifier, proof.verifier)) throw new AccessError("INVALID_FLOW");
        const member = flow?.round_id ? await first<Member>(client, "SELECT * FROM member_rounds WHERE round_id=$1 AND team_id=$2 AND member_id=$3", [flow.round_id, flow.team_id, input.memberId]) : undefined;
        if (!member) throw new AccessError("ROUND_OR_MEMBER_UNAVAILABLE");
        const old = await first<{ round_id: string }>(client, "SELECT s.round_id FROM member_session_slots slot JOIN participant_sessions s ON s.id=slot.session_id WHERE slot.member_id=$1", [input.memberId]);
        const roundIds = [...(flow.round_id ? [flow.round_id] : []), ...(old ? [old.round_id] : []), ...await memberHandoffRounds(client, input.memberId)];
        await lockedRounds(client, roundIds);
        if ((await client.query("SELECT member_id FROM member_session_slots WHERE member_id=$1 FOR UPDATE", [input.memberId])).rowCount !== 1) throw new AccessError("SECURITY_UNAVAILABLE");
        const now = await decisionTime(client, clock, roundIds);
        if (!flowValid(flow, proof.verifier, now, clock) || !await credentialValid(client, flow, now)) throw new AccessError("INVALID_FLOW");
        const round = await roundFor(client, member.round_id);
        if (!round || await isBlocked(client, round.arena_instance_id, member.team_id, member.member_id)) throw new AccessError("ACCESS_UNAVAILABLE");
        const outcome = await first<Outcome>(client, "SELECT fingerprint,outcome,reason,session_id FROM entry_outcomes WHERE flow_id=$1 AND request_key=$2", [flow.id, input.requestKey]);
        if (outcome) {
          if (!sameVerifier(outcome.fingerprint, fingerprint)) throw new AccessError("INTENT_CONFLICT");
          if (outcome.outcome === "REJECTED") return { status: "REJECTED" as const, reason: outcome.reason };
          const session = outcome.session_id ? await sessionRow(client, outcome.session_id) : undefined;
          const saved = await first<{ ciphertext: string | null; key_id: string; expires_at: Date }>(client, "SELECT ciphertext,key_id,expires_at FROM session_deliveries WHERE flow_id=$1 AND session_id=$2", [flow.id, outcome.session_id]);
          if (!session || !saved?.ciphertext || saved.key_id !== delivery.keyId || now >= saved.expires_at || flow.activated_session_id !== session.id) throw new AccessError("DELIVERY_UNAVAILABLE");
          const binding: DeliveryBinding = { flowId: flow.id, sessionId: session.id, memberRoundId: session.member_round_id,
            credentialId: flow.credential_id, credentialVersion: flow.credential_version, expiresAt: flow.expires_at.toISOString() };
          let cookie: string;
          try { cookie = await delivery.decrypt(saved.ciphertext, binding); } catch { throw new AccessError("DELIVERY_UNAVAILABLE"); }
          const recovered = parseProof(cookie);
          if (!recovered || !await sessionValid(client, session, recovered.verifier, now, clock)) throw new AccessError("INVALID_SESSION");
          return { status: "ACTIVATED" as const, sessionCookie: cookie, session: view(session) };
        }
        if (flow.state !== "OPEN") throw new AccessError("INTENT_CONFLICT");
        await participantOutcomeCapacity(client);
        const reason = member.enrolled_at ? "ALREADY_ENROLLED" : !round.current || !["RUNNING", "PAUSED"].includes(round.state)
          || (round.state === "RUNNING" && (!round.closes_at || now >= round.closes_at)) ? "ROUND_UNAVAILABLE" : null;
        if (reason) {
          await client.query("INSERT INTO entry_outcomes (flow_id,request_key,fingerprint,member_id,language,outcome,reason,recorded_at) VALUES ($1,$2,$3,$4,$5,'REJECTED',$6,$7)",
            [flow.id, input.requestKey, fingerprint, input.memberId, input.language, reason, now]);
          await advanceRoundTime(client, roundIds, now);
          return { status: "REJECTED" as const, reason };
        }
        const total = await first<{ count: number }>(client, "SELECT count(*)::integer AS count FROM participant_sessions");
        if (!total || total.count >= 50000) throw new AccessError("SESSION_CAPACITY_UNAVAILABLE");
        await retireMemberHandoffs(client, member.member_id, now);
        await client.query(`UPDATE participant_sessions SET revoked_at=$2,revocation_reason='ROUND_TRANSITION'
          WHERE member_id=$1 AND revoked_at IS NULL`, [member.member_id, now]);
        await client.query(`UPDATE session_deliveries d SET ciphertext=NULL,purged_at=$2 FROM participant_sessions s
          WHERE s.id=d.session_id AND s.member_id=$1 AND d.ciphertext IS NOT NULL`, [member.member_id, now]);
        await client.query(`UPDATE entry_flows SET state='SUPERSEDED' WHERE team_id=$1 AND round_id<>$2 AND state IN ('OPEN','ACTIVATED')
          AND activated_session_id IN (SELECT id FROM participant_sessions WHERE member_id=$3)`, [member.team_id, round.id, member.member_id]);
        await client.query("UPDATE member_rounds SET language=$2,enrolled_at=$3,first_entry_flow_id=$4 WHERE id=$1 AND enrolled_at IS NULL", [member.id, input.language, now, flow.id]);
        const absoluteExpiry = new Date(now.getTime() + 28800000);
        await client.query(`INSERT INTO participant_sessions (id,member_round_id,member_id,team_id,round_id,entry_flow_id,credential_id,credential_version,secret_verifier,created_at,absolute_expires_at,last_activity_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$10)`, [freshSession.id, member.id, member.member_id, member.team_id, member.round_id, flow.id,
          flow.credential_id, flow.credential_version, freshSession.verifier, now, absoluteExpiry]);
        await client.query("UPDATE member_session_slots SET session_id=$2,revision=revision+1 WHERE member_id=$1", [member.member_id, freshSession.id]);
        await client.query("UPDATE entry_flows SET state='ACTIVATED',activated_session_id=$2,activated_at=$3 WHERE id=$1", [flow.id, freshSession.id, now]);
        const binding: DeliveryBinding = { flowId: flow.id, sessionId: freshSession.id, memberRoundId: member.id,
          credentialId: flow.credential_id, credentialVersion: flow.credential_version, expiresAt: flow.expires_at.toISOString() };
        const ciphertext = await delivery.encrypt(binding, freshSession.cookie);
        await client.query("INSERT INTO session_deliveries (flow_id,session_id,key_id,ciphertext,expires_at) VALUES ($1,$2,$3,$4,$5)", [flow.id, freshSession.id, delivery.keyId, ciphertext, flow.expires_at]);
        await client.query("INSERT INTO entry_outcomes (flow_id,request_key,fingerprint,member_id,language,outcome,session_id,recorded_at) VALUES ($1,$2,$3,$4,$5,'ACTIVATED',$6,$7)",
          [flow.id, input.requestKey, fingerprint, member.member_id, input.language, freshSession.id, now]);
        await client.query("INSERT INTO entry_events (id,flow_id,session_id,kind,created_at) VALUES ($1,$2,$3,'SESSION_ACTIVATED',$4)", [randomUUID(), flow.id, freshSession.id, now]);
        const session = await sessionRow(client, freshSession.id);
        if (!session) throw new AccessError("SECURITY_UNAVAILABLE");
        await advanceRoundTime(client, roundIds, now);
        return { status: "ACTIVATED" as const, sessionCookie: freshSession.cookie, session: view(session) };
      }, "EXCLUSIVE");
    },

    async inspect(sessionCookie: unknown) {
      const proof = parseProof(sessionCookie);
      if (!proof) throw new AccessError("INVALID_SESSION");
      return accessTransaction(pool, clock, async (client) => {
        const initial = await sessionRow(client, proof.id);
        if (!initial) throw new AccessError("INVALID_SESSION");
        await lockedRounds(client, [initial.round_id], true);
        if ((await client.query("SELECT member_id FROM member_session_slots WHERE member_id=$1 FOR SHARE", [initial.member_id])).rowCount !== 1) throw new AccessError("INVALID_SESSION");
        const now = await decisionTime(client, clock, [initial.round_id]);
        const current = await sessionRow(client, proof.id);
        if (!await sessionValid(client, current, proof.verifier, now, clock)) throw new AccessError("INVALID_SESSION");
        return view(current!);
      }, "SHARED");
    },

    async recover(proofCookie: unknown): Promise<ActivationResult> {
      const proof = parseProof(proofCookie);
      if (!proof) throw new AccessError("INVALID_FLOW");
      const intent = await accessTransaction(pool, clock, async (client) => {
        const flow = await first<Flow>(client, "SELECT * FROM entry_flows WHERE id=$1", [proof.id]);
        if (!flow || !sameVerifier(flow.proof_verifier, proof.verifier)) throw new AccessError("INVALID_FLOW");
        await lockedRounds(client, flow.round_id ? [flow.round_id] : [], true);
        const now = await decisionTime(client, clock, flow.round_id ? [flow.round_id] : []);
        if (!flowValid(flow, proof.verifier, now, clock) || !await credentialValid(client, flow, now)) throw new AccessError("INVALID_FLOW");
        const saved = await first<{ member_id: string; language: Language; request_key: string }>(client,
          "SELECT member_id,language,request_key FROM entry_outcomes WHERE flow_id=$1 AND outcome='ACTIVATED'", [flow.id]);
        if (!saved) throw new AccessError("DELIVERY_UNAVAILABLE");
        return { memberId: saved.member_id, language: saved.language, requestKey: saved.request_key };
      }, "SHARED");
      return service.activate(proofCookie, intent);
    },

    async describe(proofCookie: unknown) {
      const proof = parseProof(proofCookie);
      if (!proof) throw new AccessError("INVALID_FLOW");
      return accessTransaction(pool, clock, async (client) => {
        const flow = await first<Flow>(client, "SELECT * FROM entry_flows WHERE id=$1", [proof.id]);
        if (!flow || !sameVerifier(flow.proof_verifier, proof.verifier)) throw new AccessError("INVALID_FLOW");
        await lockedRounds(client, flow.round_id ? [flow.round_id] : [], true);
        const now = await decisionTime(client, clock, flow.round_id ? [flow.round_id] : []);
        if (!flowValid(flow, proof.verifier, now, clock) || !await credentialValid(client, flow, now)) throw new AccessError("INVALID_FLOW");
        const round = flow.round_id ? await roundFor(client, flow.round_id) : undefined;
        if (round && await isBlocked(client, round.arena_instance_id, flow.team_id)) throw new AccessError("ACCESS_UNAVAILABLE");
        const team = await first<{ display_name: string }>(client, "SELECT display_name FROM teams WHERE id=$1", [flow.team_id]);
        const members = (await client.query<{ id: string; display_name: string }>("SELECT id,display_name FROM team_members WHERE team_id=$1 ORDER BY position", [flow.team_id])).rows;
        if (!team || members.length !== 2) throw new AccessError("REGISTRATION_UNAVAILABLE");
        return { flowId: flow.id, state: flow.state, expiresAt: flow.expires_at.toISOString(), teamName: team.display_name,
          members: members.map((member) => ({ id: member.id, name: member.display_name })), roundId: flow.round_id };
      }, "SHARED");
    },
  };
  return service;
}
