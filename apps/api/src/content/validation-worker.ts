import { randomUUID } from "node:crypto";
import type { Pool,PoolClient } from "pg";
import { AccessError,decisionTime,first } from "../access/transaction.js";
import type { ClockGuard } from "../access/transaction.js";
import { acceptAuthoringObservation,authoringPayloadDigest } from "./execution-policy.js";
import type { AuthoringPayload,TrustedAuthoringDriver } from "./execution-policy.js";
import { judgeTransaction } from "./judge-transaction.js";

export async function expireValidationRuns(pool:Pool,clock:ClockGuard){
  return judgeTransaction(pool,clock,async client=>{await client.query("SELECT * FROM lock_validation_judge()");await decisionTime(client,clock);await client.query("SELECT expire_validation_run()");});
}
export function createValidationWorker(pool:Pool,clock:ClockGuard,driver:TrustedAuthoringDriver,workerId=randomUUID()){
  let generation:string|undefined,busy=false;
  async function payload(client:PoolClient,checkId:string,attemptId:string){
    const row=await first<{run_id:string;host_epoch_id:string;runtime_key:string;digest:Buffer;language:AuthoringPayload["language"];source_role:AuthoringPayload["sourceRole"];check_type:AuthoringPayload["checkType"];
      starter_code:Buffer;reference_code:Buffer;input_data:Buffer|null;expected_output:Buffer|null;cpu_ms:number;wall_ms:number;memory_kb:number;checker_mode:"TOKENS"|"EXACT_TEXT"}>(client,
      `SELECT c.run_id,r.host_epoch_id,v.runtime_key,m.digest,p.language,p.source_role,p.check_type,v.starter_code,v.reference_code,t.input_data,t.expected_output,v.cpu_ms,v.wall_ms,v.memory_kb,s.checker_mode
      FROM authoring_checks c JOIN validation_runs r ON r.id=c.run_id JOIN validation_snapshots s ON s.id=r.snapshot_id
      JOIN validation_snapshot_checks p ON p.id=c.snapshot_check_id JOIN validation_snapshot_variants v ON v.snapshot_id=r.snapshot_id AND v.variant_id=p.variant_id
      JOIN runtime_manifests m ON m.key=v.runtime_key AND m.language=v.language LEFT JOIN validation_snapshot_cases t ON t.snapshot_id=r.snapshot_id AND t.case_id=p.case_id WHERE c.id=$1`,[checkId]);
    if(!row)throw new AccessError("SECURITY_UNAVAILABLE");
    const value:AuthoringPayload={attemptId,hostEpochId:row.host_epoch_id,runId:row.run_id,checkId,runtimeKey:row.runtime_key,runtimeDigest:row.digest.toString("hex"),language:row.language,
      sourceRole:row.source_role,checkType:row.check_type,source:row.source_role==="REFERENCE"?row.reference_code:row.starter_code,stdin:row.input_data??Buffer.alloc(0),cpuMs:row.cpu_ms,wallMs:row.wall_ms,memoryKb:row.memory_kb};
    return {value,expected:row.expected_output??Buffer.alloc(0),checker:row.checker_mode};
  }
  async function transaction<T>(work:(client:PoolClient)=>Promise<T>){return judgeTransaction(pool,clock,work);}
  return {
    workerId,
    async claim(){
      await driver.assertReady(AbortSignal.timeout(10000));
      generation=await transaction(async client=>{
        await client.query("SELECT * FROM lock_validation_judge()");await decisionTime(client,clock);
        const host=await first<{endpoint_ref:string;state:string}>(client,"SELECT endpoint_ref,state FROM judge_host_epochs WHERE id=$1",[driver.hostEpochId]);
        const runtimes=(await client.query<{language:AuthoringPayload["language"];runtime_key:string;digest:Buffer}>(`SELECT h.language,h.runtime_key,m.digest FROM judge_host_runtimes h JOIN runtime_manifests m ON m.key=h.runtime_key AND m.language=h.language WHERE h.host_epoch_id=$1`,[driver.hostEpochId])).rows;
        if(!host || host.state!=="ACTIVE" || host.endpoint_ref!==driver.endpointRef || runtimes.length!==5 || driver.runtimes.size!==5
          || runtimes.some(r=>driver.runtimes.get(r.language)?.key!==r.runtime_key || driver.runtimes.get(r.language)?.digest!==r.digest.toString("hex")))throw new AccessError("SECURITY_UNAVAILABLE");
        const row=await first<{generation:string|null}>(client,"SELECT claim_validation_worker($1,$2) AS generation",[workerId,driver.hostEpochId]);
        return row?.generation??undefined;
      });
      return generation!==undefined;
    },
    async tick(){
      if(!generation)throw new AccessError("SECURITY_UNAVAILABLE");
      if(busy)return "BUSY" as const;busy=true;
      try {
        const dispatch=await transaction(async client=>{
          await client.query("SELECT * FROM lock_validation_judge()");await decisionTime(client,clock);
          await client.query("SELECT sweep_validation_run($1,$2)",[workerId,generation]);
          const old=await first<{id:string;check_id:string;payload_digest:Buffer}>(client,"SELECT id,check_id,payload_digest FROM authoring_attempts WHERE released_at IS NULL AND host_epoch_id=$1 AND next_poll_at<=date_trunc('milliseconds',clock_timestamp()) AND poll_count<10000 ORDER BY next_poll_at,id LIMIT 1",[driver.hostEpochId]);
          if(old){
            const poll=await first<{allowed:boolean}>(client,"SELECT claim_authoring_poll($1,$2,$3) AS allowed",[workerId,generation,old.id]);
            if(!poll?.allowed)return null;
            const p=await payload(client,old.check_id,old.id);if(!authoringPayloadDigest(p.value).equals(old.payload_digest))throw new AccessError("SECURITY_UNAVAILABLE");return {...p,fresh:false};
          }
          if(!(await first(client,"SELECT id FROM execution_capacity_slots WHERE authoring_attempt_id IS NULL AND participant_attempt_id IS NULL LIMIT 1")))return null;
          const next=await first<{id:string}>(client,`SELECT c.id FROM authoring_checks c JOIN validation_runs r ON r.id=c.run_id JOIN validation_snapshot_checks p ON p.id=c.snapshot_check_id JOIN judge_control g ON g.active_validation_id=r.id
            WHERE c.result IS NULL AND c.available_at<=date_trunc('milliseconds',clock_timestamp()) AND r.status IN ('QUEUED','RUNNING')
              AND NOT EXISTS(SELECT 1 FROM authoring_attempts a WHERE a.check_id=c.id AND a.released_at IS NULL)
            ORDER BY p.position LIMIT 1`);
          if(!next)return null;
          const p=await payload(client,next.id,randomUUID());
          await client.query("SELECT prepare_authoring_attempt($1,$2,$3,$4,$5)",[workerId,generation,next.id,p.value.attemptId,authoringPayloadDigest(p.value)]);
          return {...p,fresh:true};
        });
        if(!dispatch)return "IDLE" as const;
        let observation:unknown;
        try {observation=await (dispatch.fresh?driver.submit(dispatch.value,AbortSignal.timeout(10000)):driver.observe(dispatch.value,AbortSignal.timeout(10000)));}
        catch {return "UNCERTAIN" as const;}
        let accepted:ReturnType<typeof acceptAuthoringObservation>;
        try {accepted=acceptAuthoringObservation(dispatch.value,observation,dispatch.expected,dispatch.checker);}catch{return "UNUSABLE_EVIDENCE" as const;}
        if(!accepted)return "PENDING" as const;
        await transaction(async client=>{
          await client.query("SELECT * FROM lock_validation_judge()");await decisionTime(client,clock);
          await client.query("SELECT record_authoring_result($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9)",[workerId,generation,dispatch.value.attemptId,accepted.result,JSON.stringify(accepted.metadata),accepted.stdoutPrefix,accepted.stderr,accepted.compilerOutput,accepted.release]);
        });
        return "OBSERVED" as const;
      } finally {busy=false;}
    },
  };
}
