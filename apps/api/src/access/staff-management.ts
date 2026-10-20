import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { commandFingerprint, newAccessCode, sameVerifier, uuid } from "./credentials.js";
import { createStaffService, confirmStaffCode, staffOutcomeCapacity } from "./staff-service.js";
import type { SessionDelivery } from "./credentials.js";
import { AccessError, accessTransaction, decisionTime, first } from "./transaction.js";
import type { ClockGuard } from "./transaction.js";
import { staffQuota } from "./quotas.js";

export type StaffAction="CREATE"|"UPDATE"|"ROTATE";
export interface StaffState {staff_id:string;display_name:string;role:"OWNER"|"ORGANISER"|"SUPER_ADMIN";enabled:boolean;revision:string;code_version:string;}
interface Receipt {
  id:string;actor_id:string;action:StaffAction;target_staff_id:string|null;request_key:string;fingerprint:Buffer;
  outcome:"APPLIED"|"UNCHANGED"|"REJECTED";denial_reason:string|null;expected_revision:string;recorded_at:Date;
  result_staff_id:string|null;result_credential_id:string|null;before_state:StaffState|null;after_state:StaffState|null;
}
export interface StaffCommand {
  action:StaffAction;targetId:string|null;requestKey:string;expectedRevision:string;ownCode:unknown;reason:string;
  displayName:string|null;role:"OWNER"|"ORGANISER"|null;enabled:boolean|null;
}
export function boundedStaffText(value:unknown,max:number):string {
  if(typeof value!=="string" || !value.isWellFormed() || !value.trim() || value.includes("\0") || Buffer.byteLength(value)>max)throw new AccessError("INVALID_CONTEXT");
  return value;
}
export function staffRevision(value:unknown):string {
  if(typeof value!=="string" || !/^(0|[1-9]\d{0,18})$/.test(value) || BigInt(value)>9223372036854775806n)throw new AccessError("INVALID_CONTEXT");
  return value;
}
function validate(input:StaffCommand) {
  uuid(input.requestKey);staffRevision(input.expectedRevision);boundedStaffText(input.reason,1024);
  if(!["CREATE","UPDATE","ROTATE"].includes(input.action))throw new AccessError("INVALID_CONTEXT");
  if(input.action==="CREATE" ? input.targetId!==null : !input.targetId)throw new AccessError("INVALID_CONTEXT");
  if(input.targetId)uuid(input.targetId);
  if(input.action==="ROTATE") {
    if(input.displayName!==null || input.role!==null || input.enabled!==null)throw new AccessError("INVALID_CONTEXT");
  } else {
    boundedStaffText(input.displayName,120);
    if(!["OWNER","ORGANISER"].includes(input.role??"") || typeof input.enabled!=="boolean" || (input.action==="CREATE"&&!input.enabled))throw new AccessError("INVALID_CONTEXT");
  }
}
function receiptView(row:Receipt) {
  return {outcome_id:row.id,action:row.action,target_staff_id:row.target_staff_id,request_key:row.request_key,expected_revision:row.expected_revision,
    outcome:row.outcome,reason:row.denial_reason,recorded_at:row.recorded_at.toISOString(),result_staff_id:row.result_staff_id,
    code_issued:row.result_credential_id!==null,before:row.before_state,after:row.after_state};
}
async function state(client:PoolClient,id:string|null):Promise<StaffState|null> {
  return (await first<{state:StaffState|null}>(client,"SELECT staff_admin_state($1) AS state",[id]))?.state??null;
}
function allowedTarget(value:StaffState|null):asserts value is StaffState {
  if(!value || value.role==="SUPER_ADMIN")throw new AccessError("STAFF_TARGET_UNAVAILABLE");
}

export function createStaffManagement(pool:Pool,clock:ClockGuard,delivery:SessionDelivery) {
  const sessions=createStaffService(pool,clock,delivery);
  async function principal(client:PoolClient,cookie:unknown,now:Date) {
    const actor=await sessions.authorize(client,cookie,now);
    if(actor.role!=="SUPER_ADMIN")throw new AccessError("ACCESS_UNAVAILABLE");
    return actor;
  }
  async function readBudget(cookie:unknown) {
    const actor=await sessions.inspect(cookie);if(actor.role!=="SUPER_ADMIN")throw new AccessError("ACCESS_UNAVAILABLE");
    await staffQuota(pool,clock,actor.staff_id,"READ_STAFF");
  }
  const service={
    async command(cookie:unknown,input:StaffCommand) {
      validate(input);
      const initial=await sessions.inspect(cookie);if(initial.role!=="SUPER_ADMIN")throw new AccessError("ACCESS_UNAVAILABLE");
      await staffQuota(pool,clock,initial.staff_id,"STAFF_COMMAND");
      await staffQuota(pool,clock,initial.session_id,"STAFF_CONFIRM");
      const fingerprint=commandFingerprint([input.action,input.targetId,input.expectedRevision,input.displayName,input.role,input.enabled,input.reason]);
      const generated=newAccessCode();
      return accessTransaction(pool,clock,async(client)=>{
        const now=await decisionTime(client,clock),actor=await principal(client,cookie,now);
        const before=await state(client,input.targetId);
        if(input.targetId)allowedTarget(before);
        const prior=await first<Receipt>(client,`SELECT * FROM staff_management_outcomes WHERE actor_id=$1 AND action=$2 AND target_staff_id IS NOT DISTINCT FROM $3::uuid AND request_key=$4`,[actor.staff_id,input.action,input.targetId,input.requestKey]);
        if(prior){if(!sameVerifier(prior.fingerprint,fingerprint))throw new AccessError("INTENT_CONFLICT");return{outcome:receiptView(prior),issued_code:null};}
        await confirmStaffCode(client,actor,input.ownCode);
        await staffOutcomeCapacity(client);
        const control=await first<{revision:string}>(client,"SELECT revision FROM security_control WHERE id=1");
        if(!control)throw new AccessError("SECURITY_UNAVAILABLE");
        let outcome:Receipt["outcome"]="APPLIED",denial:string|null=null;
        if(input.expectedRevision!==(before?.revision??control.revision)){outcome="REJECTED";denial="STALE_VERSION";}
        else if(input.action==="UPDATE" && before && before.display_name===input.displayName && before.role===input.role && before.enabled===input.enabled)outcome="UNCHANGED";
        else if(input.action==="CREATE" || (input.action==="UPDATE" && input.enabled && !before?.enabled)) {
          if((await client.query("SELECT count(*)::integer AS n FROM staff_identities WHERE disabled_at IS NULL")).rows[0].n>=50){outcome="REJECTED";denial="STAFF_CAPACITY";}
        }
        const id=randomUUID(),resultStaff=input.action==="CREATE"&&outcome==="APPLIED"?randomUUID():null;
        const credential=(input.action==="CREATE"||input.action==="ROTATE")&&outcome==="APPLIED"?randomUUID():null;
        let after=before;
        if(outcome==="APPLIED")after={staff_id:resultStaff??input.targetId!,display_name:input.displayName??before!.display_name,role:input.role??before!.role,
          enabled:input.enabled??before!.enabled,revision:input.action==="CREATE"?"1":(BigInt(before!.revision)+1n).toString(),
          code_version:credential?(BigInt(before?.code_version??"0")+1n).toString():before!.code_version};
        await client.query(`INSERT INTO staff_management_outcomes(id,actor_id,session_id,credential_id,credential_version,control_id,target_staff_id,action,request_key,fingerprint,expected_revision,
          display_name,role,enabled,reason,outcome,denial_reason,recorded_at,result_staff_id,result_credential_id,before_state,after_state)
          VALUES($1,$2,$3,$4,$5,1,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)`,
          [id,actor.staff_id,actor.id,actor.credential_id,actor.credential_version,input.targetId,input.action,input.requestKey,fingerprint,input.expectedRevision,
            input.displayName,input.role,input.enabled,input.reason,outcome,denial,now,resultStaff,credential,before?JSON.stringify(before):null,after?JSON.stringify(after):null]);
        if(outcome==="APPLIED") {
          await client.query("SELECT apply_staff_management($1,$2)",[id,credential?generated.verifier:null]);
          await client.query("UPDATE staff_sessions SET last_activity_at=$2 WHERE id=$1",[actor.id,now]);
        }
        const row=await first<Receipt>(client,"SELECT * FROM staff_management_outcomes WHERE id=$1",[id]);
        if(!row)throw new AccessError("SECURITY_UNAVAILABLE");
        return{outcome:receiptView(row),issued_code:credential?generated.code:null};
      },"EXCLUSIVE");
    },
    async list(cookie:unknown,afterId?:string) {
      if(afterId)uuid(afterId);await readBudget(cookie);
      return accessTransaction(pool,clock,async(client)=>{
        await principal(client,cookie,await decisionTime(client,clock));
        const rows=await client.query<{state:StaffState;has_active_code:boolean}>(`SELECT staff_admin_state(i.id) AS state,EXISTS(SELECT 1 FROM access_credentials c WHERE c.staff_id=i.id AND c.revoked_at IS NULL) AS has_active_code
          FROM staff_identities i WHERE ($1::uuid IS NULL OR i.id>$1) ORDER BY i.id LIMIT 51`,[afterId??null]);
        const items=rows.rows.slice(0,50);
        const control=await first<{revision:string}>(client,"SELECT revision FROM security_control WHERE id=1");
        if(!control)throw new AccessError("SECURITY_UNAVAILABLE");
        return{control_revision:control.revision,items:items.map(r=>({...r.state,has_active_code:r.has_active_code})),next_after:rows.rows.length>50?items.at(-1)!.state.staff_id:null};
      },"SHARED");
    },
    async outcome(cookie:unknown,action:StaffAction,targetId:string|null,requestKey:string) {
      uuid(requestKey);if(!["CREATE","UPDATE","ROTATE"].includes(action)||(action==="CREATE")!==(targetId===null))throw new AccessError("INVALID_CONTEXT");
      if(targetId)uuid(targetId);await readBudget(cookie);
      return accessTransaction(pool,clock,async(client)=>{
        const actor=await principal(client,cookie,await decisionTime(client,clock));if(targetId)allowedTarget(await state(client,targetId));
        const row=await first<Receipt>(client,"SELECT * FROM staff_management_outcomes WHERE actor_id=$1 AND action=$2 AND target_staff_id IS NOT DISTINCT FROM $3::uuid AND request_key=$4",[actor.staff_id,action,targetId,requestKey]);
        return{status:row?"OBSERVED" as const:"NOT_OBSERVED" as const,outcome:row?receiptView(row):null};
      },"SHARED");
    },
  };
  return service;
}
