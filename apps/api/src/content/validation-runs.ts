import { randomUUID } from "node:crypto";
import type { Pool,PoolClient } from "pg";
import { commandFingerprint,sameVerifier,uuid } from "../access/credentials.js";
import type { SessionDelivery } from "../access/credentials.js";
import { boundedStaffText,staffRevision } from "../access/staff-management.js";
import { createStaffService,staffOutcomeCapacity } from "../access/staff-service.js";
import { staffQuota } from "../access/quotas.js";
import { AccessError,accessTransaction,advanceRoundTime,decisionTime,first } from "../access/transaction.js";
import type { ClockGuard } from "../access/transaction.js";
import { judgeTransaction } from "./judge-transaction.js";

export interface ValidationRunCommand {snapshotId:string;expectedRevision:string;requestKey:string;reason:string;}
interface Outcome {id:string;snapshot_id:string;request_key:string;fingerprint:Buffer;expected_revision:string;outcome:"ADMITTED"|"REJECTED";denial_reason:string|null;recorded_at:Date;result_run_id:string|null;}
function identifier(value:unknown){try{return uuid(value);}catch{throw new AccessError("INVALID_CONTEXT");}}
function receipt(o:Outcome){return {outcome_id:o.id,snapshot_id:o.snapshot_id,request_key:o.request_key,expected_revision:o.expected_revision,outcome:o.outcome,
  reason:o.denial_reason,recorded_at:o.recorded_at.toISOString(),run_id:o.result_run_id};}
export function createValidationRunService(pool:Pool,clock:ClockGuard,delivery:SessionDelivery){
  const staff=createStaffService(pool,clock,delivery);
  async function principal(client:PoolClient,cookie:unknown,now:Date){const actor=await staff.authorize(client,cookie,now);if(actor.role==="ORGANISER")throw new AccessError("ACCESS_UNAVAILABLE");return actor;}
  async function budget(cookie:unknown,write=false){const actor=await staff.inspect(cookie);if(actor.role==="ORGANISER")throw new AccessError("ACCESS_UNAVAILABLE");await staffQuota(pool,clock,actor.staff_id,write?"STAFF_COMMAND":"READ_STAFF");}
  return {
    async admit(cookie:unknown,input:ValidationRunCommand){
      identifier(input.snapshotId);identifier(input.requestKey);staffRevision(input.expectedRevision);boundedStaffText(input.reason,1024);
      if(input.expectedRevision==="0")throw new AccessError("INVALID_CONTEXT");
      await budget(cookie,true);
      const fingerprint=commandFingerprint(["VALIDATION_RUN_V1",input.snapshotId,input.expectedRevision,input.reason]);
      try{return await judgeTransaction(pool,clock,async client=>{
        await client.query("SELECT * FROM lock_validation_judge()");
        const rounds=(await client.query<{id:string;state:string}>("SELECT r.id,r.state FROM rounds r JOIN arena_control a ON a.current_instance_id=r.arena_instance_id ORDER BY r.id")).rows;
        const ids=rounds.map(r=>r.id),now=await decisionTime(client,clock,ids),actor=await principal(client,cookie,now);
        const prior=await first<Outcome>(client,"SELECT * FROM validation_run_outcomes WHERE actor_id=$1 AND snapshot_id=$2 AND request_key=$3",[actor.staff_id,input.snapshotId,input.requestKey]);
        if(prior){if(!sameVerifier(prior.fingerprint,fingerprint))throw new AccessError("INTENT_CONFLICT");return receipt(prior);}
        await client.query("SELECT expire_validation_run()");
        const snapshot=await first<{id:string;content_revision:string;current_revision:string;publication_status:string}>(client,`SELECT s.id,s.content_revision,v.content_revision AS current_revision,v.publication_status
          FROM validation_snapshots s JOIN bug_versions v ON v.id=s.version_id WHERE s.id=$1`,[input.snapshotId]);
        if(!snapshot)throw new AccessError("CONTENT_UNAVAILABLE");
        const denial=input.expectedRevision!==snapshot.content_revision || snapshot.current_revision!==snapshot.content_revision?"STALE_VERSION":snapshot.publication_status!=="DRAFT"?"CONTENT_LOCKED":rounds.some(r=>["RUNNING","PAUSED","CLOSING","CANCELLING"].includes(r.state))?"ARENA_ACTIVE":null;
        await staffOutcomeCapacity(client);
        const id=randomUUID(),runId=denial?null:randomUUID();
        await client.query(`INSERT INTO validation_run_outcomes(id,snapshot_id,actor_id,session_id,credential_id,credential_version,request_key,fingerprint,expected_revision,reason,outcome,denial_reason,recorded_at,result_run_id)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,[id,input.snapshotId,actor.staff_id,actor.id,actor.credential_id,actor.credential_version,input.requestKey,fingerprint,
          input.expectedRevision,input.reason,denial?"REJECTED":"ADMITTED",denial,now,runId]);
        if(!denial){await client.query("SELECT admit_validation_run($1)",[id]);await client.query("UPDATE staff_sessions SET last_activity_at=$2 WHERE id=$1",[actor.id,now]);}
        await advanceRoundTime(client,ids,now);
        const result=await first<Outcome>(client,"SELECT * FROM validation_run_outcomes WHERE id=$1",[id]);if(!result)throw new AccessError("SECURITY_UNAVAILABLE");return receipt(result);
      });}catch(error){if(error && typeof error==="object" && "code" in error && error.code==="54000")throw new AccessError("REQUEST_CAPACITY_UNAVAILABLE");throw error;}
    },
    async outcome(cookie:unknown,snapshotId:string,key:string){
      identifier(snapshotId);identifier(key);await budget(cookie);
      return accessTransaction(pool,clock,async client=>{
        const actor=await principal(client,cookie,await decisionTime(client,clock));
        const row=await first<Outcome>(client,"SELECT * FROM validation_run_outcomes WHERE actor_id=$1 AND snapshot_id=$2 AND request_key=$3",[actor.staff_id,snapshotId,key]);
        return {status:row?"OBSERVED" as const:"NOT_OBSERVED" as const,outcome:row?receipt(row):null};
      },"SHARED");
    },
    async report(cookie:unknown,runId:string){
      identifier(runId);await budget(cookie);
      return judgeTransaction(pool,clock,async client=>{
        await client.query("SELECT * FROM lock_validation_judge()");
        const now=await decisionTime(client,clock),actor=await principal(client,cookie,now);
        await client.query("SELECT expire_validation_run()");
        const r=await first<{id:string;snapshot_id:string;configuration_fingerprint:Buffer;status:string;created_at:Date;deadline_at:Date;started_at:Date|null;finished_at:Date|null}>(client,
          "SELECT * FROM validation_runs WHERE id=$1",[runId]);if(!r)throw new AccessError("CONTENT_UNAVAILABLE");
        await staffOutcomeCapacity(client);
        await client.query("INSERT INTO validation_run_audits(id,run_id,actor_id,session_id,credential_id,credential_version,recorded_at) VALUES($1,$2,$3,$4,$5,$6,$7)",[randomUUID(),runId,actor.staff_id,actor.id,actor.credential_id,actor.credential_version,now]);
        const checks=(await client.query(`SELECT c.id AS check_id,p.language,p.source_role,p.check_type,p.case_id,p.witness_position,p.expected_result,c.result,c.available_at,c.completed_at,
          (SELECT count(*)::integer FROM authoring_attempts a WHERE a.check_id=c.id) AS attempts,
          EXISTS(SELECT 1 FROM authoring_attempts a WHERE a.check_id=c.id AND a.released_at IS NULL) AS physical_pending
          FROM authoring_checks c JOIN validation_snapshot_checks p ON p.id=c.snapshot_check_id WHERE c.run_id=$1 ORDER BY p.position`,[runId])).rows;
        return {run_id:r.id,snapshot_id:r.snapshot_id,configuration_fingerprint:r.configuration_fingerprint.toString("hex"),status:r.status,created_at:r.created_at.toISOString(),deadline_at:r.deadline_at.toISOString(),
          started_at:r.started_at?.toISOString()??null,finished_at:r.finished_at?.toISOString()??null,physical_pending:checks.some(c=>c.physical_pending),can_publish:false as const,
          checks:checks.map(c=>({...c,available_at:c.available_at.toISOString(),completed_at:c.completed_at?.toISOString()??null}))};
      });
    },
  };
}
