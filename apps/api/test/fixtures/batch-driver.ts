import {randomUUID} from 'node:crypto';
import {sha256} from '../../src/access/credentials.js';
import type {TrustedAuthoringDriver} from '../../src/content/execution-policy.js';
import type {TrustedParticipantBatchDriver} from '../../src/content/judge-driver.js';
import {readParticipantBatch} from '../../src/content/batch-protocol.js';
import {acceptParticipantBatchResult} from '../../src/content/batch-result.js';
import {runParticipantBatch} from '../../src/judge/batch-runner.js';
import {isolateObservation} from './isolate-observation.js';

// Disposable database preflight only: these observations never certify native execution or speed.
export function syntheticBatchDriver(driver:TrustedAuthoringDriver):TrustedParticipantBatchDriver{
 const results=new Map<string,Awaited<ReturnType<typeof runParticipantBatch>>>();
 const observe:TrustedParticipantBatchDriver['observeBatch']=async(raw,batchId,digest)=>{
  const result=results.get(batchId);if(!result)return null;
  return acceptParticipantBatchResult(raw,{batchId,hostEpochId:driver.hostEpochId,digest},driver.runtimes,{...result,
   drain:{cannot_start:true,processes_stopped:true,workspace_removed:true,proof_digest:sha256(`synthetic-batch:${batchId}`).toString('hex')}});
 };
 return {...driver,async assertBatchReady(){},observeBatch:observe,async submitBatch(raw,batchId,digest,signal){
  if(results.has(batchId))throw new Error('Preflight detected a duplicate batch POST');
  const identity={batchId,hostEpochId:driver.hostEpochId,digest};readParticipantBatch(raw,identity,driver.runtimes);
  const result=await runParticipantBatch(raw,identity,{owner:randomUUID(),providerToken:randomUUID()},driver.runtimes,{
   async verifySource(){},async compile(){return isolateObservation('compile');},async snapshotArtifact(){return 'a'.repeat(64);},
   async runCase(plan){const sum=plan.stdin.toString().trim().split(/\s+/).reduce((a,b)=>a+Number(b),0);return isolateObservation('run',{stdout:Buffer.from(`${sum}\n`)});},async record(){},
  },signal);results.set(batchId,result);return observe(raw,batchId,digest,signal);
 }};
}
