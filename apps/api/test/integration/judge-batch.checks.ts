import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import type {TestContext} from 'node:test';
import type {Pool} from 'pg';
import {createParticipantBatch} from '../../src/content/batch-protocol.js';
import type {ParticipantBatchCase} from '../../src/content/batch-protocol.js';
import {runParticipantBatch} from '../../src/judge/batch-runner.js';
import type {createJudgeRegistry,createJudgeSupervisorStore} from '../../src/judge/registry.js';
import {judgePayload,judgeReply} from '../fixtures/judge.js';
import {isolateObservation} from '../fixtures/isolate-observation.js';
import type {TrustedParticipantBatchDriver} from '../../src/content/judge-driver.js';
export async function judgeBatchTransportChecks(driver:TrustedParticipantBatchDriver,c:{registry:ReturnType<typeof createJudgeRegistry>;supervisor:ReturnType<typeof createJudgeSupervisorStore>;fresh:()=>Promise<unknown>}){
 await c.fresh();const p=judgePayload('java');p.hostEpochId=c.registry.hostEpochId;p.sourceRole='SAMPLE';
 const cases:ParticipantBatchCase[]=Array.from({length:2},(_,i)=>({caseId:randomUUID(),position:i+1,payload:{...p,attemptId:randomUUID(),checkId:randomUUID()},expected:Buffer.from('12\n'),checker:'TOKENS'}));
 const id=randomUUID(),wire=createParticipantBatch(id,cases,c.registry.runtimes),signal=()=>AbortSignal.timeout(10000);
 await driver.assertBatchReady(signal());assert.equal(await driver.submitBatch(wire.raw,id,wire.digest,signal()),null);
 assert.equal(await driver.submitBatch(wire.raw,id,wire.digest,signal()),null);assert.equal(await driver.observeBatch(wire.raw,id,wire.digest,signal()),null);
 const first=cases[0]!.payload,token=(await c.registry.admit(first,randomUUID())).value.provider_token!,owner=randomUUID();
 assert.ok(await c.supervisor.claim(first.attemptId,token,owner));assert.ok(await c.supervisor.beginLaunch(first.attemptId,token,owner));
 const answer=await runParticipantBatch(wire.raw,{batchId:id,hostEpochId:p.hostEpochId,digest:wire.digest},{owner,providerToken:token},c.registry.runtimes,{
  async verifySource(){},async compile(){return isolateObservation('compile');},async snapshotArtifact(){return 'a'.repeat(64);},async runCase(){return isolateObservation('run');},async record(){},
 },new AbortController().signal);
 await c.supervisor.sealBatch(first.attemptId,token,owner,answer);
 const held=await driver.observeBatch(wire.raw,id,wire.digest,signal());assert.equal(held!.drain,null);assert.deepEqual(held!.cases.map(c=>c.result),['PASSED','PASSED']);
 await c.supervisor.seal(first,token,owner,judgeReply(first,randomUUID(),Buffer.from('12\n'),token).evidence);
 assert.ok((await driver.observeBatch(wire.raw,id,wire.digest,signal()))!.drain);
 await assert.rejects(driver.submitBatch(wire.raw,id,'b'.repeat(64),signal()));
}
export async function judgeBatchChecks(t:TestContext,c:{owner:Pool;ingress:Pool;runner:Pool;registry:ReturnType<typeof createJudgeRegistry>;supervisor:ReturnType<typeof createJudgeSupervisorStore>;fresh:()=>Promise<unknown>}){
 await t.test('one native batch admission preserves every input and permits exactly one original carrier; lost admission replies are idempotent',async()=>{
  await c.fresh();const p=judgePayload('cpp');p.hostEpochId=c.registry.hostEpochId;p.sourceRole='OFFICIAL';
  const cases:ParticipantBatchCase[]=Array.from({length:3},(_,i)=>({caseId:randomUUID(),position:i+1,payload:{...p,attemptId:randomUUID(),checkId:randomUUID(),stdin:Buffer.from(`${i}\n`)},expected:Buffer.from('12\n'),checker:'EXACT_TEXT'}));
  const id=randomUUID(),wire=createParticipantBatch(id,cases,c.registry.runtimes),before=(await c.owner.query('SELECT count(*)::int n FROM ingenium_judge.attempts')).rows[0].n;
  const admitted=await c.registry.admitBatch(wire.raw,id,wire.digest,randomUUID());assert.equal(admitted.status,201);assert.equal(admitted.value.state,'PENDING');
  await assert.rejects(c.registry.admit(cases[1]!.payload,randomUUID()),{code:'22023'});
  const overlapId=randomUUID(),overlap=createParticipantBatch(overlapId,cases.slice(1),c.registry.runtimes);
  await assert.rejects(c.registry.admitBatch(overlap.raw,overlapId,overlap.digest,randomUUID()),{code:'22023'});
  await c.registry.admitBatch(wire.raw,id,wire.digest,randomUUID());assert.equal((await c.owner.query('SELECT count(*)::int n FROM ingenium_judge.attempts')).rows[0].n,before+1);
  const first=cases[0]!.payload,token=(await c.registry.admit(first,randomUUID())).value.provider_token!,owner=randomUUID();
  assert.ok(await c.supervisor.claim(first.attemptId,token,owner));assert.ok(await c.supervisor.beginLaunch(first.attemptId,token,owner));
  const batch=await c.supervisor.batchForAttempt(first.attemptId);assert.equal(batch!.batchId,id);assert.deepEqual(batch!.raw,wire.raw);
  await assert.rejects(c.ingress.query('UPDATE ingenium_judge.participant_batches SET result=NULL'),{code:'42501'});
  await assert.rejects(c.runner.query('SELECT raw FROM ingenium_judge.participant_batches'),{code:'42501'});
  const answer=await runParticipantBatch(wire.raw,{batchId:id,hostEpochId:p.hostEpochId,digest:wire.digest},{owner,providerToken:token},c.registry.runtimes,{
   async verifySource(){},async compile(){return isolateObservation('compile');},async snapshotArtifact(){return 'a'.repeat(64);},
   async runCase(){return isolateObservation('run');},async record(){},
  },new AbortController().signal);
  const reserved=(await c.owner.query('SELECT retained_bytes FROM ingenium_judge.control WHERE id=1')).rows[0].retained_bytes;
  await c.supervisor.sealBatch(first.attemptId,token,owner,answer);await c.supervisor.sealBatch(first.attemptId,token,owner,answer);
  const accounted=(await c.owner.query('SELECT retained_bytes FROM ingenium_judge.control WHERE id=1')).rows[0].retained_bytes;
  assert.ok(BigInt(accounted)<BigInt(reserved));
  let seen=await c.registry.observeBatch(id,wire.digest,randomUUID());assert.equal(seen.value.state,'FINISHED');assert.equal((seen.value.evidence as any).drain,null);
  assert.equal(Object.keys((seen.value.evidence as any).cases).length,3);
  // A completed aggregate is still held until its one physical carrier has a genuine drain proof.
  const standard=judgeReply(first,randomUUID(),Buffer.from('12\n'),token).evidence;
  await c.supervisor.seal(first,token,owner,standard);seen=await c.registry.observeBatch(id,wire.digest,randomUUID());assert.ok((seen.value.evidence as any).drain);
  const original=(await c.owner.query('SELECT to_jsonb(b) row FROM ingenium_judge.participant_batches b WHERE batch_id=$1',[id])).rows[0].row;
  await assert.rejects(c.owner.query('UPDATE ingenium_judge.participant_batches SET raw=$2,digest=sha256($2) WHERE batch_id=$1',[id,Buffer.from('{}')]),{code:'P0001'});
  await assert.rejects(c.owner.query('UPDATE ingenium_judge.participant_batches SET result=NULL,sealed_at=NULL WHERE batch_id=$1',[id]),{code:'P0001'});
  await assert.rejects(c.owner.query('DELETE FROM ingenium_judge.participant_batches WHERE batch_id=$1',[id]),{code:'P0001'});
  assert.deepEqual((await c.owner.query('SELECT to_jsonb(b) row FROM ingenium_judge.participant_batches b WHERE batch_id=$1',[id])).rows[0].row,original);
  await assert.rejects(c.registry.admitBatch(wire.raw,randomUUID(),wire.digest,randomUUID()));
  await assert.rejects(c.registry.observeBatch(id,'b'.repeat(64),randomUUID()),{code:'22023'});
  const extra=createParticipantBatch(randomUUID(),cases,c.registry.runtimes);await assert.rejects(c.registry.admitBatch(extra.raw,JSON.parse(extra.raw.toString()).batch_id,extra.digest,randomUUID()),{code:'22023'});
 });
}
