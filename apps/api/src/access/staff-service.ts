import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { canonicalCode, newProof, parseProof, sameVerifier, sha256, uuid } from "./credentials.js";
import type { DeliveryBinding, SessionDelivery } from "./credentials.js";
import { staffQuota, verificationQuota } from "./quotas.js";
import { AccessError, accessTransaction, decisionTime, first } from "./transaction.js";
import type { ClockGuard } from "./transaction.js";

export type StaffMode = "NORMAL" | "CLOCK_RECOVERY";
interface Credential { id: string; staff_id: string; version: string; issued_at: Date; }
interface Flow {
  id: string; staff_id: string; credential_id: string; credential_version: string; proof_verifier: Buffer | null;
  mode: StaffMode; generation: string; state: string; created_at: Date; expires_at: Date; session_id: string | null;
}
export interface StaffSession {
  id: string; staff_id: string; flow_id: string; credential_id: string; credential_version: string; secret_verifier: Buffer | null;
  mode: StaffMode; generation: string; created_at: Date; absolute_expires_at: Date; last_activity_at: Date; revoked_at: Date | null;
  display_name: string; role: "ORGANISER" | "OWNER" | "SUPER_ADMIN";
}
const manager = (role: string) => role === "OWNER" || role === "SUPER_ADMIN";
function reversed(clock: ClockGuard): never { clock.fault("CLOCK_REVERSED"); throw new AccessError("CLOCK_UNTRUSTED"); }
function timeAfter(clock: ClockGuard, now: Date, ...values: Date[]) { if (values.some((value) => now < value)) reversed(clock); }
export async function staffOutcomeCapacity(client: PoolClient, extra = 1) {
  const row=await first<{ n: number }>(client,`SELECT ((SELECT count(*) FROM staff_entry_outcomes)+(SELECT count(*) FROM staff_keep_alive_outcomes)
    +(SELECT count(*) FROM clock_clearances)+(SELECT count(*) FROM staff_management_outcomes)+(SELECT count(*) FROM replacement_decisions)+(SELECT count(*) FROM arena_setup_outcomes)
    +(SELECT count(*) FROM content_outcomes)+(SELECT count(*) FROM content_read_audits)
    +(SELECT count(*) FROM validation_preparation_outcomes)+(SELECT count(*) FROM validation_snapshot_audits)
    +(SELECT count(*) FROM validation_run_outcomes)+(SELECT count(*) FROM validation_run_audits)+(SELECT count(*) FROM validation_diagnostic_audits)
    +(SELECT count(*) FROM competition_outcomes WHERE staff_session_id IS NOT NULL)+(SELECT count(*) FROM competition_publications)
    +(SELECT count(*) FROM content_publication_outcomes)+(SELECT count(*) FROM team_management_outcomes)
      +(SELECT count(*) FROM registration_import_outcomes)+(SELECT count(*) FROM discipline_outcomes)+(SELECT count(*) FROM submission_review_audits)+(SELECT count(*) FROM announcements)
      +(SELECT count(*) FROM report_decisions)+(SELECT count(*) FROM score_adjustments)+operator_staff_outcome_count()+$1)::integer AS n`, [extra]);
  if (!row || row.n>=100000) throw new AccessError("AUDIT_CAPACITY_UNAVAILABLE");
}
function sessionView(s: StaffSession) {
  const expires = Math.min(s.absolute_expires_at.getTime(), s.last_activity_at.getTime()+900000);
  return { session_id: s.id, staff_id: s.staff_id, display_name: s.display_name, role: s.role, mode: s.mode,
    expires_at: new Date(expires).toISOString(), absolute_expires_at: s.absolute_expires_at.toISOString(), warning_at: new Date(expires-120000).toISOString() };
}
export async function confirmStaffCode(client:PoolClient,s:StaffSession,value:unknown) {
  let code:string;try{code=canonicalCode(value);}catch{throw new AccessError("STAFF_CONFIRMATION_REQUIRED");}
  const own=await first<{verifier:Buffer}>(client,"SELECT verifier FROM access_credentials WHERE id=$1 AND version=$2 AND staff_id=$3 AND revoked_at IS NULL",[s.credential_id,s.credential_version,s.staff_id]);
  if(!own || !sameVerifier(own.verifier,sha256(code)))throw new AccessError("STAFF_CONFIRMATION_REQUIRED");
  return own.verifier;
}
export async function staffActionVerifier(client:PoolClient,s:StaffSession,value?:unknown) {
  if (s.mode !== "NORMAL") throw new AccessError("INVALID_SESSION");
  if (value !== undefined) return confirmStaffCode(client,s,value);
  // The caller has authorised the current session inside the guarded transaction.
  const own=await first<{verifier:Buffer}>(client,"SELECT verifier FROM access_credentials WHERE id=$1 AND version=$2 AND staff_id=$3 AND revoked_at IS NULL",[s.credential_id,s.credential_version,s.staff_id]);
  if (!own) throw new AccessError("INVALID_SESSION");
  return own.verifier;
}
export function staffTimeValid(row: { created_at: Date; absolute_expires_at: Date; last_activity_at: Date }, now: Date) {
  if (now<row.created_at || now<row.last_activity_at) throw new AccessError("CLOCK_UNTRUSTED");
  return now<row.absolute_expires_at && now.getTime()<row.last_activity_at.getTime()+900000;
}
async function credentialValid(client: PoolClient, value: { credential_id: string; credential_version: string; staff_id: string }, now: Date) {
  return Boolean(await first(client, `SELECT c.id FROM access_credentials c JOIN staff_identities i ON i.id=c.staff_id
    WHERE c.id=$1 AND c.version=$2 AND c.staff_id=$3 AND c.revoked_at IS NULL AND c.issued_at<=$4 AND i.disabled_at IS NULL`,
    [value.credential_id,value.credential_version,value.staff_id,now]));
}

export async function openStaffFlow(client: PoolClient, credential: Credential, now: Date, mode: StaffMode = "NORMAL") {
  const identity = await first<{ role: string }>(client, "SELECT role FROM staff_identities WHERE id=$1 AND disabled_at IS NULL", [credential.staff_id]);
  if (!identity || (mode === "CLOCK_RECOVERY" && !manager(identity.role))) throw new AccessError("INVALID_CODE");
  const state = await first<{ fault_generation: string; fault_latched: boolean }>(client, "SELECT fault_generation,fault_latched FROM clock_health WHERE id=1");
  if (!state || (mode === "CLOCK_RECOVERY" && !state.fault_latched)) throw new AccessError("CLOCK_RECOVERY_UNAVAILABLE");
  const count = await first<{ live: number; owned: number; retained: number }>(client, `SELECT (count(*) FILTER (WHERE expires_at>$2 AND state IN ('OPEN','ACTIVATED'))
    +(SELECT count(*) FROM entry_flows WHERE expires_at>$2 AND state IN ('OPEN','ACTIVATED')))::integer AS live,
    count(*) FILTER (WHERE staff_id=$1 AND expires_at>$2 AND state IN ('OPEN','ACTIVATED'))::integer AS owned,count(*)::integer AS retained FROM staff_entry_flows`, [credential.staff_id,now]);
  if (!count || count.live>=1000 || count.owned>=8 || count.retained>=50000) throw new AccessError("FLOW_CAPACITY_UNAVAILABLE");
  const proof = newProof(), expires = new Date(now.getTime()+600000);
  await client.query(`INSERT INTO staff_entry_flows(id,staff_id,credential_id,credential_version,proof_verifier,mode,generation,state,created_at,expires_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,'OPEN',$8,$9)`, [proof.id,credential.staff_id,credential.id,credential.version,proof.verifier,mode,state.fault_generation,now,expires]);
  return { audience: "STAFF" as const, proofCookie: proof.cookie, flow_id: proof.id, mode, expires_at: expires.toISOString() };
}

export function createStaffService(pool: Pool, clock: ClockGuard, delivery: SessionDelivery, recoveryClock?: ClockGuard) {
  const guardFor = (recovery: boolean) => { if (recovery && !recoveryClock) throw new AccessError("CLOCK_RECOVERY_UNAVAILABLE"); return recovery ? recoveryClock! : clock; };
  async function flowRow(client: PoolClient, cookie: unknown, now: Date, guard: ClockGuard, recovery: boolean) {
    const proof = parseProof(cookie);
    const flow = proof ? await first<Flow>(client, "SELECT * FROM staff_entry_flows WHERE id=$1", [proof.id]) : undefined;
    if (!flow || !sameVerifier(flow.proof_verifier,proof!.verifier)) throw new AccessError("INVALID_FLOW");
    timeAfter(guard,now,flow.created_at);
    if (!['OPEN','ACTIVATED'].includes(flow.state) || now>=flow.expires_at || !await credentialValid(client,flow,now)) throw new AccessError("INVALID_FLOW");
    if ((flow.mode === "CLOCK_RECOVERY") !== recovery) throw new AccessError("INVALID_FLOW");
    if (recovery) {
      const health = await first<{ fault_latched: boolean; fault_generation: string }>(client,"SELECT fault_latched,fault_generation FROM clock_health WHERE id=1");
      const actor = await first<{ role: string }>(client,"SELECT role FROM staff_identities WHERE id=$1",[flow.staff_id]);
      if (!health?.fault_latched || health.fault_generation!==flow.generation || !actor || !manager(actor.role)) throw new AccessError("INVALID_FLOW");
    }
    return flow;
  }
  async function sessionRow(client: PoolClient, cookie: unknown, now: Date, guard: ClockGuard, recovery: boolean) {
    const proof = parseProof(cookie);
    const s = proof ? await first<StaffSession>(client, `SELECT s.*,i.display_name,i.role FROM staff_sessions s
      JOIN staff_session_slots x ON x.staff_id=s.staff_id AND x.session_id=s.id JOIN staff_identities i ON i.id=s.staff_id AND i.disabled_at IS NULL WHERE s.id=$1`,[proof.id]) : undefined;
    if (!s || !sameVerifier(s.secret_verifier,proof!.verifier)) throw new AccessError("INVALID_SESSION");
    timeAfter(guard,now,s.created_at,s.last_activity_at);
    if (s.revoked_at || !staffTimeValid(s,now) || !await credentialValid(client,s,now)) throw new AccessError("INVALID_SESSION");
    if (!recovery && s.mode!=="NORMAL") throw new AccessError("ACCESS_UNAVAILABLE");
    if (recovery) {
      if (!manager(s.role)) throw new AccessError("ACCESS_UNAVAILABLE");
      const health = await first<{ fault_latched: boolean; fault_generation: string }>(client,"SELECT fault_latched,fault_generation FROM clock_health WHERE id=1");
      if (s.mode === "CLOCK_RECOVERY" && health?.fault_latched && s.generation!==health.fault_generation) throw new AccessError("INVALID_SESSION");
    }
    return s;
  }
  const service = {
    async authorize(client:PoolClient,cookie:unknown,now:Date) { return sessionRow(client,cookie,now,clock,false); },
    async beginRecovery(codeInput: unknown, context: { ip: string; browserId: string }) {
      const guard = guardFor(true);
      let code: string; try { code=canonicalCode(codeInput); } catch { throw new AccessError("INVALID_CODE"); }
      await verificationQuota(pool,guard,context.ip,context.browserId,sha256(code));
      return accessTransaction(pool,guard,async(client) => {
        const c = await first<Credential>(client,"SELECT id,staff_id,version,issued_at FROM access_credentials WHERE verifier=$1 AND staff_id IS NOT NULL AND revoked_at IS NULL",[sha256(code)]);
        if (!c) throw new AccessError("INVALID_CODE");
        const now=await decisionTime(client,guard); timeAfter(guard,now,c.issued_at);
        return openStaffFlow(client,c,now,"CLOCK_RECOVERY");
      },"EXCLUSIVE");
    },
    async describe(cookie: unknown, recovery=false) {
      const guard=guardFor(recovery);
      return accessTransaction(pool,guard,async(client) => {
        const flow=await flowRow(client,cookie,await decisionTime(client,guard),guard,recovery);
        return { flow_id: flow.id, mode: flow.mode, expires_at: flow.expires_at.toISOString() };
      },"SHARED");
    },
    async activate(cookie: unknown, requestKey: string, recovery=false) {
      uuid(requestKey); const guard=guardFor(recovery), fresh=newProof();
      return accessTransaction(pool,guard,async(client) => {
        const now=await decisionTime(client,guard), flow=await flowRow(client,cookie,now,guard,recovery);
        const fingerprint=sha256(JSON.stringify([1,flow.id,flow.mode]));
        const prior=await first<{ request_key: string; fingerprint: Buffer; session_id: string }>(client,"SELECT * FROM staff_entry_outcomes WHERE flow_id=$1",[flow.id]);
        if (prior && (prior.request_key!==requestKey || !sameVerifier(prior.fingerprint,fingerprint))) throw new AccessError("INTENT_CONFLICT");
        if (prior) {
          const record=await first<{ key_id: string; ciphertext: string | null }>(client,"SELECT key_id,ciphertext FROM staff_session_deliveries WHERE flow_id=$1 AND session_id=$2",[flow.id,prior.session_id]);
          if (!record?.ciphertext || record.key_id!==delivery.keyId) throw new AccessError("DELIVERY_UNAVAILABLE");
          const binding: DeliveryBinding = { flowId: flow.id, sessionId: prior.session_id, staffId: flow.staff_id, mode: flow.mode, generation: flow.generation,
            credentialId: flow.credential_id, credentialVersion: flow.credential_version, expiresAt: flow.expires_at.toISOString() };
          const exact=await delivery.decrypt(record.ciphertext,binding);
          const s=await sessionRow(client,exact,now,guard,recovery);
          return { sessionCookie: exact, session: sessionView(s) };
        }
        if (flow.state!=="OPEN") throw new AccessError("INVALID_FLOW");
        if ((await client.query("SELECT staff_id FROM staff_session_slots WHERE staff_id=$1 FOR UPDATE",[flow.staff_id])).rowCount!==1) throw new AccessError("SECURITY_UNAVAILABLE");
        if ((await client.query("SELECT count(*)::integer AS n FROM staff_sessions")).rows[0].n>=50000) throw new AccessError("SESSION_CAPACITY_UNAVAILABLE");
        await staffOutcomeCapacity(client);
        const old=await first<{ id: string; created_at: Date; last_activity_at: Date }>(client,"SELECT id,created_at,last_activity_at FROM staff_sessions WHERE staff_id=$1 AND revoked_at IS NULL",[flow.staff_id]);
        if (old) {
          timeAfter(guard,now,old.created_at,old.last_activity_at);
          await client.query("UPDATE staff_sessions SET revoked_at=$2,revocation_reason='FRESH_SIGN_IN' WHERE id=$1",[old.id,now]);
          await client.query("INSERT INTO staff_session_events(id,session_id,kind,recorded_at) VALUES($1,$2,'SUPERSEDED',$3)",[randomUUID(),old.id,now]);
        }
        await client.query(`UPDATE staff_session_deliveries d SET ciphertext=NULL,purged_at=$2 FROM staff_sessions s WHERE d.session_id=s.id AND s.staff_id=$1 AND d.ciphertext IS NOT NULL`,[flow.staff_id,now]);
        await client.query("UPDATE staff_entry_flows SET state='SUPERSEDED' WHERE staff_id=$1 AND id<>$2 AND state IN ('OPEN','ACTIVATED')",[flow.staff_id,flow.id]);
        await client.query(`INSERT INTO staff_sessions(id,staff_id,flow_id,credential_id,credential_version,secret_verifier,mode,generation,created_at,absolute_expires_at,last_activity_at)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$9)`,[fresh.id,flow.staff_id,flow.id,flow.credential_id,flow.credential_version,fresh.verifier,flow.mode,flow.generation,now,new Date(now.getTime()+28800000)]);
        await client.query("UPDATE staff_session_slots SET session_id=$2,revision=revision+1 WHERE staff_id=$1",[flow.staff_id,fresh.id]);
        await client.query("UPDATE staff_entry_flows SET state='ACTIVATED',session_id=$2,activated_at=$3 WHERE id=$1",[flow.id,fresh.id,now]);
        const binding: DeliveryBinding={ flowId: flow.id, sessionId: fresh.id, staffId: flow.staff_id, mode: flow.mode, generation: flow.generation,
          credentialId: flow.credential_id, credentialVersion: flow.credential_version, expiresAt: flow.expires_at.toISOString() };
        const ciphertext=await delivery.encrypt(binding,fresh.cookie);
        await client.query("INSERT INTO staff_session_deliveries(flow_id,session_id,key_id,ciphertext,expires_at) VALUES($1,$2,$3,$4,$5)",[flow.id,fresh.id,delivery.keyId,ciphertext,flow.expires_at]);
        await client.query("INSERT INTO staff_entry_outcomes(flow_id,request_key,fingerprint,session_id,recorded_at) VALUES($1,$2,$3,$4,$5)",[flow.id,requestKey,fingerprint,fresh.id,now]);
        await client.query("INSERT INTO staff_session_events(id,session_id,kind,recorded_at) VALUES($1,$2,'ACTIVATED',$3)",[randomUUID(),fresh.id,now]);
        return { sessionCookie: fresh.cookie, session: sessionView(await sessionRow(client,fresh.cookie,now,guard,recovery)) };
      },"EXCLUSIVE");
    },
    async recover(cookie: unknown, recovery=false) {
      const guard=guardFor(recovery);
      const key=await accessTransaction(pool,guard,async(client) => {
        const flow=await flowRow(client,cookie,await decisionTime(client,guard),guard,recovery);
        const outcome=await first<{ request_key: string }>(client,"SELECT request_key FROM staff_entry_outcomes WHERE flow_id=$1",[flow.id]);
        if (!outcome) throw new AccessError("DELIVERY_UNAVAILABLE"); return outcome.request_key;
      },"SHARED");
      return service.activate(cookie,key,recovery);
    },
    async inspect(cookie: unknown, recovery=false) {
      const guard=guardFor(recovery);
      return accessTransaction(pool,guard,async(client) => sessionView(await sessionRow(client,cookie,await decisionTime(client,guard),guard,recovery)),"SHARED");
    },
    async keepAlive(cookie: unknown, requestKey: string) {
      uuid(requestKey);
      const current=await service.inspect(cookie);
      await staffQuota(pool,clock,current.staff_id,"STAFF_COMMAND");
      return accessTransaction(pool,clock,async(client) => {
        const now=await decisionTime(client,clock), s=await sessionRow(client,cookie,now,clock,false);
        if (await first(client,"SELECT request_key FROM staff_keep_alive_outcomes WHERE session_id=$1 AND request_key=$2",[s.id,requestKey])) return sessionView(s);
        await staffOutcomeCapacity(client);
        await client.query("INSERT INTO staff_keep_alive_outcomes(session_id,request_key,recorded_at) VALUES($1,$2,$3)",[s.id,requestKey,now]);
        await client.query("UPDATE staff_sessions SET last_activity_at=$2 WHERE id=$1",[s.id,now]);
        return sessionView({...s,last_activity_at:now});
      },"EXCLUSIVE");
    },
    async logout(cookie: unknown, recovery=false) {
      const guard=guardFor(recovery);
      return accessTransaction(pool,guard,async(client) => {
        const now=await decisionTime(client,guard), s=await sessionRow(client,cookie,now,guard,recovery);
        await client.query("UPDATE staff_sessions SET revoked_at=$2,revocation_reason='LOGOUT' WHERE id=$1",[s.id,now]);
        await client.query("UPDATE staff_session_slots SET session_id=NULL,revision=revision+1 WHERE staff_id=$1",[s.staff_id]);
        await client.query("UPDATE staff_entry_flows SET state='REVOKED' WHERE staff_id=$1 AND state IN ('OPEN','ACTIVATED')",[s.staff_id]);
        await client.query("UPDATE staff_session_deliveries SET ciphertext=NULL,purged_at=$2 WHERE session_id=$1 AND ciphertext IS NOT NULL",[s.id,now]);
        await client.query("INSERT INTO staff_session_events(id,session_id,kind,recorded_at) VALUES($1,$2,'SIGNED_OUT',$3)",[randomUUID(),s.id,now]);
        return { signed_out: true };
      },"EXCLUSIVE");
    },
    async clockStatus(cookie: unknown) {
      const guard=guardFor(true), actor=await service.inspect(cookie,true);
      await staffQuota(pool,guard,actor.staff_id,"READ_STAFF");
      return accessTransaction(pool,guard,async(client) => {
        const s=await sessionRow(client,cookie,await decisionTime(client,guard),guard,true);
        const h=await first<{ runtime_id: string; fault_generation: string; fault_latched: boolean; state: string; healthy_count: number }>(client,"SELECT runtime_id,fault_generation,fault_latched,state,healthy_count FROM clock_health WHERE id=1");
        if (!h) throw new AccessError("CLOCK_UNTRUSTED");
        const lifetime=sessionView(s);
        return {...h,expires_at:lifetime.expires_at,warning_at:lifetime.warning_at};
      },"SHARED");
    },
    async clockOutcome(cookie: unknown, requestKey: string) {
      uuid(requestKey);
      const guard=guardFor(true), actor=await service.inspect(cookie,true);
      await staffQuota(pool,guard,actor.staff_id,"READ_STAFF");
      return accessTransaction(pool,guard,async client=>{
        const s=await sessionRow(client,cookie,await decisionTime(client,guard),guard,true);
        const row=await first<{clearance_id:string;generation:string}>(client,
          "SELECT id AS clearance_id,generation FROM clock_clearances WHERE staff_id=$1 AND request_key=$2",[s.staff_id,requestKey]);
        return {status:row?"OBSERVED":"NOT_OBSERVED",outcome:row?{...row,cleared:true}:null};
      },"SHARED");
    },
    async clearClock(cookie: unknown, input: { code: unknown; requestKey: string; runtimeId: string; generation: string; reason: string }) {
      const guard=guardFor(true); uuid(input.requestKey); uuid(input.runtimeId);
      if (typeof input.generation!=="string" || !/^[1-9]\d{0,18}$/.test(input.generation) || BigInt(input.generation)>9223372036854775807n || typeof input.reason!=="string" || !input.reason.isWellFormed() || !input.reason.trim() || input.reason.includes("\0") || Buffer.byteLength(input.reason)>1024) throw new AccessError("INVALID_CONTEXT");
      const actor=await service.inspect(cookie,true);
      await staffQuota(pool,guard,actor.session_id,"STAFF_CONFIRM");
      const fingerprint=sha256(JSON.stringify([1,input.runtimeId,input.generation,input.reason]));
      return accessTransaction(pool,guard,async(client) => {
        const now=await decisionTime(client,guard), s=await sessionRow(client,cookie,now,guard,true);
        const old=await first<{ id: string; fingerprint: Buffer; generation: string }>(client,"SELECT id,fingerprint,generation FROM clock_clearances WHERE staff_id=$1 AND request_key=$2",[s.staff_id,input.requestKey]);
        if (old) { if (!sameVerifier(old.fingerprint,fingerprint)) throw new AccessError("INTENT_CONFLICT"); return { clearance_id: old.id, generation: old.generation, cleared: true }; }
        await confirmStaffCode(client,s,input.code);
        const h=await first<{ runtime_id: string; fault_latched: boolean; fault_generation: string; sequence: string }>(client,"SELECT * FROM clock_health WHERE id=1 FOR UPDATE");
        if (!h?.fault_latched || h.runtime_id!==input.runtimeId || h.fault_generation!==input.generation) throw new AccessError("INTENT_CONFLICT");
        if ((await client.query("SELECT id FROM rounds WHERE trusted_time_at>$1 LIMIT 1",[now])).rowCount) { guard.fault("CLOCK_REVERSED"); throw new AccessError("CLOCK_UNTRUSTED"); }
        await staffOutcomeCapacity(client);
        const id=randomUUID();
        await client.query(`INSERT INTO clock_clearances(id,staff_id,session_id,credential_id,credential_version,request_key,fingerprint,runtime_id,generation,report_sequence,reason,recorded_at)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,[id,s.staff_id,s.id,s.credential_id,s.credential_version,input.requestKey,fingerprint,h.runtime_id,h.fault_generation,h.sequence,input.reason,now]);
        await client.query("UPDATE clock_health SET fault_latched=false,fault_reason=NULL,state=CASE WHEN abs((report->>'system_offset_ns')::numeric)>50000000 THEN 'WARNING' ELSE 'HEALTHY' END WHERE id=1");
        await client.query("UPDATE staff_sessions SET last_activity_at=$2 WHERE id=$1",[s.id,now]);
        return { clearance_id:id, generation:h.fault_generation, cleared:true };
      },"EXCLUSIVE");
    },
  };
  return service;
}
