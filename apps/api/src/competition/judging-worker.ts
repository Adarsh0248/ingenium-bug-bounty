import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { AccessError, decisionTime, first } from "../access/transaction.js";
import type { ClockGuard } from "../access/transaction.js";
import { acceptAuthoringObservation, authoringPayloadDigest } from "../content/execution-policy.js";
import type { AuthoringPayload, TrustedAuthoringDriver } from "../content/execution-policy.js";
import { judgeTransaction } from "../content/judge-transaction.js";
import {createParticipantBatch,readParticipantBatch} from '../content/batch-protocol.js';
import type {TrustedParticipantBatchDriver} from '../content/judge-driver.js';

export function createParticipantJudgeWorker(pool: Pool, clock: ClockGuard, driver: TrustedAuthoringDriver, workerId = randomUUID()) {
  let generation: string | undefined, busy = false, batchEnabled=false;
  const batchDriver=driver as Partial<TrustedParticipantBatchDriver>;
  async function defer(attemptId: string) {
    await judgeTransaction(pool, clock, async client => {
      await client.query("SELECT * FROM lock_validation_judge()"); await decisionTime(client, clock);
      await client.query("SELECT participant_defer($1,$2,$3)", [workerId, generation, attemptId]);
    });
  }
  async function payload(client: PoolClient, jobId: string, attemptId: string) {
    const row = await first<{ id: string; lane: "OFFICIAL" | "SAMPLE"; source: Buffer; language: AuthoringPayload["language"]; host_epoch_id: string;
      runtime_key: string; runtime_digest: Buffer; input_data: Buffer; expected_output: Buffer; cpu_ms: number; wall_ms: number; memory_kb: number; checker_mode: "TOKENS" | "EXACT_TEXT" }>(client,
    `SELECT p.id,p.lane,p.source,p.language,p.host_epoch_id,p.runtime_key,p.runtime_digest,c.input_data,c.expected_output,v.cpu_ms,v.wall_ms,v.memory_kb,s.checker_mode
      FROM participant_jobs j JOIN participant_judging p ON p.id=j.parent_id JOIN validation_snapshots s ON s.id=p.snapshot_id
      JOIN validation_snapshot_variants v ON v.snapshot_id=p.snapshot_id AND v.language=p.language
      JOIN validation_snapshot_cases c ON c.snapshot_id=p.snapshot_id AND c.case_id=j.case_id WHERE j.id=$1`, [jobId]);
    if (!row || row.host_epoch_id !== driver.hostEpochId || driver.runtimes.get(row.language)?.key !== row.runtime_key
      || driver.runtimes.get(row.language)?.digest !== row.runtime_digest.toString("hex")) throw new AccessError("JUDGE_UNAVAILABLE");
    const value: AuthoringPayload = { attemptId, hostEpochId: row.host_epoch_id, runId: row.id, checkId: jobId, runtimeKey: row.runtime_key,
      runtimeDigest: row.runtime_digest.toString("hex"), language: row.language, sourceRole: row.lane, checkType: "TEST_CASE", source: row.source,
      stdin: row.input_data, cpuMs: row.cpu_ms, wallMs: row.wall_ms, memoryKb: row.memory_kb };
    return { value, expected: row.expected_output, checker: row.checker_mode };
  }
  return {
    workerId,
    async claim() {
      await driver.assertReady(AbortSignal.timeout(10000));
      generation = await judgeTransaction(pool, clock, async client => {
        await client.query("SELECT * FROM lock_validation_judge()"); await decisionTime(client, clock);
        const host = await first<{ endpoint_ref: string }>(client, "SELECT endpoint_ref FROM judge_host_epochs WHERE id=$1 AND state='ACTIVE'", [driver.hostEpochId]);
        const runtimes = (await client.query<{ language: AuthoringPayload["language"]; runtime_key: string; digest: Buffer }>(
          `SELECT h.language,h.runtime_key,m.digest FROM judge_host_runtimes h JOIN runtime_manifests m ON m.key=h.runtime_key AND m.language=h.language WHERE h.host_epoch_id=$1`, [driver.hostEpochId])).rows;
        if (host?.endpoint_ref !== driver.endpointRef || runtimes.length !== 5 || driver.runtimes.size !== 5
          || runtimes.some(r => driver.runtimes.get(r.language)?.key !== r.runtime_key || driver.runtimes.get(r.language)?.digest !== r.digest.toString("hex"))) throw new AccessError("JUDGE_UNAVAILABLE");
        return (await first<{ generation: string | null }>(client, "SELECT claim_validation_worker($1,$2) generation", [workerId, driver.hostEpochId]))?.generation ?? undefined;
      });
      batchEnabled=(await pool.query<{enabled:boolean}>("SELECT enabled FROM participant_batch_control WHERE id=1")).rows[0]?.enabled===true;
      if(batchEnabled){
        if(!batchDriver.assertBatchReady||!batchDriver.submitBatch||!batchDriver.observeBatch)throw new AccessError('JUDGE_UNAVAILABLE');
        await batchDriver.assertBatchReady(AbortSignal.timeout(10000));
      }
      return generation !== undefined;
    },
    async tick() {
      if (!generation) throw new AccessError("JUDGE_UNAVAILABLE");
      if (busy) return "BUSY" as const; busy = true;
      try {
        const dispatch = await judgeTransaction(pool, clock, async client => {
          await client.query("SELECT * FROM lock_validation_judge()"); await decisionTime(client, clock);
          if(batchEnabled){
            const next=await first<{value:{batch_id?:string;parent_id?:string;fresh:boolean}|null}>(client,'SELECT participant_batch_next($1,$2) value',[workerId,generation]);
            if(next?.value){
              const choice=next.value;
              if(choice.fresh){
                const jobs=(await client.query<{id:string;case_id:string;position:number}>('SELECT id,case_id,position FROM participant_jobs WHERE parent_id=$1 ORDER BY position',[choice.parent_id])).rows;
                const cases=[];
                for(const job of jobs){const p=await payload(client,job.id,randomUUID());cases.push({caseId:job.case_id,position:job.position,payload:p.value,expected:p.expected,checker:p.checker});}
                const batchId=randomUUID(),batch=createParticipantBatch(batchId,cases,driver.runtimes);
                await client.query('SELECT participant_batch_prepare($1,$2,$3,$4,$5)',[workerId,generation,choice.parent_id,batchId,batch.raw]);
                return {kind:'BATCH' as const,batchId,...batch,carrier:cases[0]!.payload.attemptId,fresh:true};
              }
              const old=await first<{raw:Buffer;digest:Buffer;carrier_attempt_id:string}>(client,'SELECT raw,digest,carrier_attempt_id FROM participant_batches WHERE id=$1',[choice.batch_id]);
              if(!old?.raw)throw new AccessError('JUDGE_UNAVAILABLE');
              const digest=old.digest.toString('hex'),batchId=choice.batch_id!;
              const batch=readParticipantBatch(old.raw,{batchId,hostEpochId:driver.hostEpochId,digest},driver.runtimes);
              if(batch.cases[0]!.payload.attemptId!==old.carrier_attempt_id)throw new AccessError('JUDGE_UNAVAILABLE');
              return {kind:'BATCH' as const,batchId,raw:old.raw,digest,carrier:old.carrier_attempt_id,fresh:false};
            }
          }
          const next = await first<{ value: { attempt_id?: string; job_id: string; fresh: boolean } | null }>(client, "SELECT participant_next($1,$2) value", [workerId, generation]);
          if (!next?.value) return null;
          const choice = next.value, p = await payload(client, choice.job_id, choice.attempt_id ?? randomUUID());
          if (choice.fresh) await client.query("SELECT participant_prepare($1,$2,$3,$4,$5)", [workerId, generation, choice.job_id, p.value.attemptId, authoringPayloadDigest(p.value)]);
          else {
            const old = await first<{ payload_digest: Buffer }>(client, "SELECT payload_digest FROM participant_attempts WHERE id=$1", [p.value.attemptId]);
            if (!old || !old.payload_digest.equals(authoringPayloadDigest(p.value))) throw new AccessError("JUDGE_UNAVAILABLE");
          }
          return {kind:'SINGLE' as const, ...p, fresh: choice.fresh };
        });
        if (!dispatch) return "IDLE" as const;
        if(dispatch.kind==='BATCH'){
          let accepted;
          try{accepted=await (dispatch.fresh?batchDriver.submitBatch!:batchDriver.observeBatch!).call(driver,dispatch.raw,dispatch.batchId,dispatch.digest,AbortSignal.timeout(10000));}
          catch{await defer(dispatch.carrier);return 'UNCERTAIN' as const;}
          if(!accepted)return 'PENDING' as const;
          if(accepted.batchId!==dispatch.batchId){await defer(dispatch.carrier);return 'UNUSABLE_EVIDENCE' as const;}
          await judgeTransaction(pool,clock,async client=>{
            await client.query('SELECT * FROM lock_validation_judge()');await decisionTime(client,clock);
            const cases=accepted.cases.map(c=>({attemptId:c.attemptId,caseId:c.caseId,checkId:c.checkId,result:c.result,metadata:c.metadata,
              stdout_b64:c.stdoutPrefix.toString('base64'),stderr_b64:c.stderr.toString('base64'),compiler_b64:c.compilerOutput.toString('base64')}));
            await client.query('SELECT participant_batch_record($1,$2,$3,$4::jsonb,$5)',[workerId,generation,dispatch.batchId,JSON.stringify(cases),accepted.drain===null?null:Buffer.from(accepted.drain,'hex')]);
          });
          return 'OBSERVED' as const;
        }
        let observation: unknown;
        try { observation = await (dispatch.fresh ? driver.submit(dispatch.value, AbortSignal.timeout(10000)) : driver.observe(dispatch.value, AbortSignal.timeout(10000))); }
        catch { await defer(dispatch.value.attemptId); return "UNCERTAIN" as const; }
        let accepted: ReturnType<typeof acceptAuthoringObservation>;
        try { accepted = acceptAuthoringObservation(dispatch.value, observation, dispatch.expected, dispatch.checker); }
        catch { await defer(dispatch.value.attemptId); return "UNUSABLE_EVIDENCE" as const; }
        if (!accepted) return "PENDING" as const;
        await judgeTransaction(pool, clock, async client => {
          await client.query("SELECT * FROM lock_validation_judge()"); await decisionTime(client, clock);
          await client.query("SELECT participant_record($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9)", [workerId, generation, dispatch.value.attemptId,
            accepted.result, JSON.stringify(accepted.metadata), accepted.stdoutPrefix, accepted.stderr, accepted.compilerOutput, accepted.release]);
        });
        return "OBSERVED" as const;
      } finally { busy = false; }
    },
  };
}
