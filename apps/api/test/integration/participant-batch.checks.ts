import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import type {TestContext} from 'node:test';
import {Pool} from 'pg';
import type {participantJudgingChecks} from './participant-judging.checks.js';
import {createParticipantJudgeWorker} from '../../src/competition/judging-worker.js';
import {readParticipantBatch} from '../../src/content/batch-protocol.js';
import {acceptParticipantBatchResult} from '../../src/content/batch-result.js';
import {runParticipantBatch} from '../../src/judge/batch-runner.js';
import type {TrustedParticipantBatchDriver} from '../../src/content/judge-driver.js';
import {isolateObservation} from '../fixtures/isolate-observation.js';
import {readFile} from 'node:fs/promises';

export async function participantBatchChecks(t:TestContext,c:Parameters<typeof participantJudgingChecks>[1]){
 assert.match((await c.owner.query('SELECT current_database() name')).rows[0].name,/^ingenium_competition_[0-9a-f]+$/);
 await c.owner.query(await readFile(new URL('../../../../infra/app-host/event-capacity.sql',import.meta.url),'utf8'));
 const query=async(sql:string,args:unknown[]=[]) => (await c.owner.query(sql,args)).rows;
 const pool=new Pool({connectionString:c.owner.options.connectionString,options:'-c role=ingenium_app_worker',max:2});
 const sends=new Map<string,number>(),saved=new Map<string,Awaited<ReturnType<typeof runParticipantBatch>>>(),held=new Set<string>(),lost=new Set<string>(),wrong=new Set<string>(),pending=new Set<string>();
 const singleSubmit=c.driver.submit.bind(c.driver);
 const driver=Object.assign(c.driver,{
  async assertBatchReady(){},
  async submitBatch(raw:Buffer,batchId:string,digest:string){
   sends.set(batchId,(sends.get(batchId)??0)+1);
   const b=readParticipantBatch(raw,{batchId,hostEpochId:c.driver.hostEpochId,digest},c.driver.runtimes);
   const result=await runParticipantBatch(raw,{batchId,hostEpochId:c.driver.hostEpochId,digest},{owner:randomUUID(),providerToken:randomUUID()},c.driver.runtimes,{
    async verifySource(){},async compile(){return isolateObservation('compile');},async snapshotArtifact(){return 'a'.repeat(64);},
    async runCase(plan){return isolateObservation('run',{stdout:wrong.has(b.runId)&&plan.attemptId===b.cases[0]!.payload.attemptId?Buffer.from('13\n'):Buffer.from('12\n')});},async record(){},
   },new AbortController().signal);
   saved.set(batchId,result);if(lost.delete(b.runId))throw new Error('Synthetic original accepted POST reply lost');
   return this.observeBatch(raw,batchId,digest);
  },
  async observeBatch(raw:Buffer,batchId:string,digest:string){
   const result=saved.get(batchId);if(!result||pending.has(result.run_id))return null;
   return acceptParticipantBatchResult(raw,{batchId,hostEpochId:c.driver.hostEpochId,digest},c.driver.runtimes,{...result,
    drain:held.has(result.run_id)?null:{cannot_start:true,processes_stopped:true,workspace_removed:true,proof_digest:'b'.repeat(64)}});
  },
 }) as TrustedParticipantBatchDriver;
 // Preserve method binding for a stateful driver just as the real private transport does.
 driver.submit=singleSubmit;
 const worker=createParticipantJudgeWorker(pool,c.clock,driver,c.judge.workerId);
 const parent=async(id:string)=>(await query('SELECT * FROM participant_judging WHERE id=$1',[id]))[0];
 async function until(id:string,drained=true){
  for(let n=0;n<120;n++){
   if((await parent(id)).completed_at&&(!drained||!(await query('SELECT 1 FROM participant_attempts a JOIN participant_jobs j ON j.id=a.job_id WHERE j.parent_id=$1 AND a.released_at IS NULL',[id])).length))return;
   await worker.tick();await delay(30);
  }
  assert.fail('Synthetic batch lifecycle did not settle');
 }
 try{
  await t.test('batch mode is root-only, requires an authenticated capability, and cannot change during an active round',async()=>{
   await assert.rejects(c.api.query('UPDATE participant_batch_control SET enabled=false'),{code:'42501'});
   await assert.rejects(pool.query('UPDATE participant_batch_control SET enabled=false'),{code:'42501'});
   await assert.rejects(c.owner.query('UPDATE participant_batch_control SET enabled=false'),/no active round/);
   await assert.rejects(c.api.query('SELECT raw FROM participant_batches'),{code:'42501'});
  });
  await t.test('four language batches retain every original case/source, use one physical hold and produce one award',async()=>{
   const a=await c.newRound();assert.equal(await worker.claim(),true);
   for(const [cookie,bug] of [[a.aa,a.x],[a.ab,a.y],[a.ba,a.x],[a.bb,a.y]]){
    await c.budgets();const receipt=await c.service.submit(cookie!,a.round,bug!,'synthetic batch exact source\r\n',randomUUID()),id=receipt.result.submission_id as string;
    held.add(id);assert.equal(await worker.tick(),'OBSERVED');
    const attempts=await query('SELECT a.* FROM participant_attempts a JOIN participant_jobs j ON j.id=a.job_id WHERE j.parent_id=$1',[id]);
    assert.equal(attempts.length,8);assert.ok(attempts.every(x=>x.result==='PASSED'&&x.released_at===null));
    assert.equal((await query('SELECT count(*)::int n FROM execution_capacity_slots WHERE participant_attempt_id=ANY($1::uuid[])',[attempts.map(x=>x.id)]))[0].n,1);
    assert.equal((await query('SELECT count(*)::int n FROM bounty_awards WHERE submission_id=$1',[id]))[0].n,1);
    const b=(await query('SELECT * FROM participant_batches WHERE parent_id=$1',[id]))[0];
    const generation=(await query('SELECT worker_generation FROM judge_control WHERE id=1'))[0].worker_generation;
    await assert.rejects(pool.query('SELECT participant_record($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9)',[worker.workerId,generation,b.carrier_attempt_id,'PASSED',JSON.stringify(attempts[0].evidence),Buffer.from('12\n'),Buffer.alloc(0),Buffer.alloc(0),Buffer.alloc(32)]),/whole original batch/);
    await assert.rejects(pool.query('SELECT participant_batch_record($1,$2,$3,$4::jsonb,$5)',[worker.workerId,generation,b.id,'[]',Buffer.alloc(32)]),/Incomplete original batch/);
    await assert.rejects(c.owner.query('UPDATE participant_batches SET raw=NULL WHERE id=$1',[b.id]),/immutable|purge|payload/i);
    assert.equal((await query('SELECT count(*)::int n FROM participant_attempts a JOIN participant_jobs j ON j.id=a.job_id WHERE j.parent_id=$1 AND a.released_at IS NULL',[id]))[0].n,8);
    assert.equal(readParticipantBatch(b.raw,{batchId:b.id,hostEpochId:driver.hostEpochId,digest:b.digest.toString('hex')},driver.runtimes).cases[0]!.payload.source.toString(),'synthetic batch exact source\r\n');
    await assert.rejects(pool.query('SELECT participant_original_record($1,1,$2,NULL,NULL,NULL,NULL,NULL,NULL)',[worker.workerId,b.carrier_attempt_id]),{code:'42501'});
    held.delete(id);await until(id);assert.equal(sends.get(b.id),1);
   }
  });
  await t.test('lost POST replies are observed without resending and wrong first answers still complete all eight original cases',async()=>{
   const a=await c.newRound();assert.equal(await worker.claim(),true);await c.budgets();
   const id=(await c.service.submit(a.aa,a.round,a.y,'synthetic wrong first case',randomUUID())).result.submission_id as string;
   lost.add(id);wrong.add(id);assert.equal(await worker.tick(),'UNCERTAIN');
   assert.equal((await parent(id)).result,null);assert.equal((await query('SELECT count(*)::int n FROM execution_capacity_slots WHERE participant_attempt_id IS NOT NULL'))[0].n,1);
   await until(id);assert.equal((await parent(id)).result,'WRONG_ANSWER');
   assert.deepEqual((await query('SELECT result FROM participant_jobs WHERE parent_id=$1 ORDER BY position',[id])).map(x=>x.result),['WRONG_ANSWER',...Array(7).fill('PASSED')]);
   assert.equal((await query('SELECT count(*)::int n FROM bounty_awards WHERE submission_id=$1',[id]))[0].n,0);assert.ok([...sends.values()].every(n=>n===1));
  });
  await t.test('large sources use the existing individual path instead of blocking a batch queue',async()=>{
   const a=await c.newRound();assert.equal(await worker.claim(),true);await c.budgets();
   const id=(await c.service.run(a.ab,a.round,a.x,'x'.repeat(4097),randomUUID())).result.run_id as string;c.answers.set(id,'PASSED');
   await until(id);assert.equal((await query('SELECT 1 FROM participant_batches WHERE parent_id=$1',[id])).length,0);
  });
  await t.test('a sample batch retains its actual feedback and its original compiled-source binding',async()=>{
   const a=await c.newRound();assert.equal(await worker.claim(),true);await c.budgets();
   const id=(await c.service.run(a.bb,a.round,a.y,'synthetic sample source',randomUUID())).result.run_id as string;await until(id);
   await c.budgets();const view=await c.service.judging(a.bb,a.round,id);
   assert.equal(view.result,'PASSED');assert.equal(Buffer.from(view.samples[0].stdout_b64,'base64').toString(),'12\n');
   assert.equal(view.samples[0].stdout_truncated,false);assert.equal(view.samples[0].compiler_output_truncated,false);
   assert.equal((await query('SELECT 1 FROM bounty_awards WHERE submission_id=$1',[id])).length,0);
  });
  await t.test('a replacement lease observes the original held batch without another admission',async()=>{
   const a=await c.newRound();assert.equal(await worker.claim(),true);await c.budgets();
   const id=(await c.service.submit(a.aa,a.round,a.x,'synthetic successor source',randomUUID())).result.submission_id as string;held.add(id);
   assert.equal(await worker.tick(),'OBSERVED');
   await c.owner.query("UPDATE judge_control SET lease_until=date_trunc('milliseconds',clock_timestamp())-interval '1 millisecond' WHERE id=1");
   const successor=createParticipantJudgeWorker(pool,c.clock,driver);assert.equal(await successor.claim(),true);await assert.rejects(worker.tick(),{code:'55000'});
   held.delete(id);
   for(let n=0;n<30&&(await query('SELECT 1 FROM participant_attempts a JOIN participant_jobs j ON j.id=a.job_id WHERE j.parent_id=$1 AND a.released_at IS NULL',[id])).length;n++){await successor.tick();await delay(35);}
   assert.equal((await query('SELECT 1 FROM participant_attempts a JOIN participant_jobs j ON j.id=a.job_id WHERE j.parent_id=$1 AND a.released_at IS NULL',[id])).length,0);
   assert.ok([...sends.values()].every(n=>n===1));
   await c.owner.query("UPDATE judge_control SET lease_until=date_trunc('milliseconds',clock_timestamp())-interval '1 millisecond' WHERE id=1");assert.equal(await worker.claim(),true);
  });
  await t.test('two coordinator lanes fill additional free slots instead of repeatedly polling only their first two batches',async()=>{
   const a=await c.newRound();assert.equal(await worker.claim(),true);const ids:string[]=[];
   for(const [cookie,bug]of [[a.aa,a.x],[a.ba,a.x],[a.ab,a.y],[a.bb,a.y]]){
    await c.budgets();const id=(await c.service.submit(cookie!,a.round,bug!,'synthetic parallel source',randomUUID())).result.submission_id as string;ids.push(id);pending.add(id);
   }
   const before=sends.size;for(let n=0;n<4;n++)assert.equal(await worker.tick(),'PENDING');
   assert.equal(sends.size-before,4);assert.equal((await query('SELECT count(*)::int n FROM execution_capacity_slots WHERE participant_attempt_id IS NOT NULL'))[0].n,4);
   for(const id of ids)pending.delete(id);for(const id of ids)await until(id);assert.ok([...sends.values()].every(n=>n===1));
  });
  await t.test('cancelling pending batch work keeps every physical hold and prevents late results from awarding points',async()=>{
   const a=await c.newRound();assert.equal(await worker.claim(),true);await c.budgets();
   const id=(await c.service.submit(a.aa,a.round,a.x,'synthetic cancellation source',randomUUID())).result.submission_id as string;pending.add(id);held.add(id);
   assert.equal(await worker.tick(),'PENDING');
   const round=(await query('SELECT arena_instance_id,revision FROM rounds WHERE id=$1',[a.round]))[0];
   await c.budgets();const cancelled=await c.service.command(c.staff.sessionCookie,{action:'CANCEL_ROUND',roundId:a.round,requestKey:randomUUID(),expectedRevision:round.revision,
    reason:'Synthetic pending-batch cancellation',ownCode:c.staff.code,payload:{arena_id:round.arena_instance_id,confirmed_round_id:a.round,incident_ref:'BATCH-TEST-01'}});
   assert.equal(cancelled.result.status,'APPLIED');assert.equal((await parent(id)).status,'CANCELLED');
   assert.equal((await query('SELECT count(*)::int n FROM participant_attempts a JOIN participant_jobs j ON j.id=a.job_id WHERE j.parent_id=$1 AND a.released_at IS NULL',[id]))[0].n,8);
   pending.delete(id);await delay(300);assert.equal(await worker.tick(),'OBSERVED');
   assert.equal((await parent(id)).result,null);assert.equal((await query('SELECT 1 FROM bounty_awards WHERE submission_id=$1',[id])).length,0);
   held.delete(id);for(let n=0;n<30&&(await query('SELECT 1 FROM participant_attempts a JOIN participant_jobs j ON j.id=a.job_id WHERE j.parent_id=$1 AND a.released_at IS NULL',[id])).length;n++){await worker.tick();await delay(35);}
   assert.equal((await query('SELECT 1 FROM participant_attempts a JOIN participant_jobs j ON j.id=a.job_id WHERE j.parent_id=$1 AND a.released_at IS NULL',[id])).length,0);
   const intent=(await query('SELECT id FROM round_cancellations WHERE round_id=$1',[a.round]))[0];await c.budgets();
   const finish=await c.service.command(c.staff.sessionCookie,{action:'FINISH_CANCEL',roundId:a.round,requestKey:randomUUID(),expectedRevision:(await query('SELECT revision FROM rounds WHERE id=$1',[a.round]))[0].revision,
    reason:'Synthetic cancellation drained',ownCode:c.staff.code,payload:{arena_id:round.arena_instance_id,cancellation_id:intent.id}});assert.equal(finish.result.status,'APPLIED');
  });
  await t.test('batch payload retention uses the original round boundary, keeps digests and cannot resurrect purged bytes',async()=>{
   const a=await c.newRound();assert.equal(await worker.claim(),true);await c.budgets();
   const id=(await c.service.run(a.ab,a.round,a.x,'synthetic retention source',randomUUID())).result.run_id as string;await until(id);
   const batch=(await query('SELECT * FROM participant_batches WHERE parent_id=$1',[id]))[0];
   assert.equal((await query("SELECT retention_eligible('participant_batches',$1,clock_timestamp()+interval '60 days') eligible",[batch.id]))[0].eligible,false);
   await c.newRound();
   const bound=(await query("SELECT retention_eligible('participant_batches',$1,retention_terminal_at($2)+interval '7 days'-interval '1 millisecond') early,retention_eligible('participant_batches',$1,retention_terminal_at($2)+interval '7 days') due",[batch.id,a.round]))[0];
   assert.deepEqual(bound,{early:false,due:true});
   const client=await c.owner.connect();
   try{
    assert.match((await client.query('SELECT current_database() name')).rows[0].name,/^ingenium_competition_[0-9a-f]+$/);
    await client.query('BEGIN; SET LOCAL session_replication_role=replica');
    const timestamps=(await client.query("SELECT table_name,array_agg(column_name::text ORDER BY ordinal_position) columns FROM information_schema.columns WHERE table_schema='public' AND data_type='timestamp with time zone' GROUP BY table_name")).rows;
    const quote=(s:string)=>'"'+s.replaceAll('"','""')+'"';
    for(const table of timestamps)await client.query(`UPDATE public.${quote(table.table_name)} SET ${table.columns.map((column:string)=>`${quote(column)}=${quote(column)}-interval '31 days'`).join(',')}`);
    await client.query('SET LOCAL session_replication_role=origin');
    const reserved=(await client.query('SELECT reserved_bytes FROM participant_judging WHERE id=$1',[id])).rows[0].reserved_bytes;
    assert.equal((await client.query("SELECT retire_payload('participant_batches',$1) n",[batch.id])).rows[0].n,1);
    await client.query('SET CONSTRAINTS ALL IMMEDIATE');await client.query('COMMIT');
    const now=(await query('SELECT * FROM participant_batches WHERE id=$1',[batch.id]))[0];assert.equal(now.raw,null);assert.deepEqual(now.digest,batch.digest);
    assert.ok(BigInt((await parent(id)).reserved_bytes)<BigInt(reserved));
    await assert.rejects(c.owner.query('UPDATE participant_batches SET raw=$2 WHERE id=$1',[batch.id,batch.raw]),/immutable|Purged/);
    assert.equal((await query("SELECT count(*)::int n FROM payload_purges WHERE kind='participant_batches' AND target_id=$1",[batch.id]))[0].n,1);
   }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  });
 }finally{await pool.end();}
}
