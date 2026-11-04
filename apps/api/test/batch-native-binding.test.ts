import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {test} from 'node:test';
import {createParticipantBatch} from '../src/content/batch-protocol.js';
import type {ParticipantBatchCase} from '../src/content/batch-protocol.js';
import {judgeJson} from '../src/content/judge-protocol.js';
import {readCapsuleRequest} from '../src/judge/capsule-request.js';
import {capsuleConfiguration} from '../src/judge/capsule-configuration.js';
import {capsuleReference} from '../src/judge/capsule-lifecycle.js';
import {createExecutionPlan} from '../src/judge/execution-plan.js';
import {executionRequest} from '../src/judge/executor.js';
import {ISOLATE_BINARIES} from '../src/judge/isolate-context.js';
import {phaseInitialisation,phaseResourceRecord,retainedBatchPhaseGroups} from '../src/judge/phase-resources.js';
import {judgePayload,judgeRuntimes} from './fixtures/judge.js';
function fixture(){
 const shared=judgePayload('cpp'),runtimes=judgeRuntimes(),id=randomUUID(),boot=randomUUID();shared.sourceRole='OFFICIAL';
 const cases:ParticipantBatchCase[]=Array.from({length:3},(_,i)=>({caseId:randomUUID(),position:i+1,
  payload:{...shared,attemptId:randomUUID(),checkId:randomUUID(),stdin:Buffer.from(`${i}\n`)},expected:Buffer.from('12\n'),checker:'TOKENS'}));
 const wire=createParticipantBatch(id,cases,runtimes),claim={payload:cases[0]!.payload,owner:randomUUID(),providerToken:randomUUID()},plan=createExecutionPlan(claim,runtimes),
 settings={hostEpochId:shared.hostEpochId,bootId:boot,runtimes,binaries:Object.fromEntries(ISOLATE_BINARIES.map(p=>[p,'a'.repeat(64)])) as Record<typeof ISOLATE_BINARIES[number],string>,batch:{batchId:id,digest:wire.digest,raw:wire.raw}},
 release={imageId:`sha256:${'b'.repeat(64)}`,digest:'c'.repeat(64)},ref=capsuleReference(plan,{version:1,nonce:randomUUID(),image_id:release.imageId,release_sha256:release.digest});
 return {id,boot,cases,wire,claim,plan,settings,ref,runtimes};
}
test('the root-only capsule configuration binds a batch to its exact original carrier and all private case bytes',()=>{
 const f=fixture(),config=capsuleConfiguration(f.settings,f.plan,f.ref),request=Buffer.from(judgeJson(executionRequest(f.claim,f.boot,f.runtimes,'EXECUTE'))),
 parsed=readCapsuleRequest(config,request);
 assert.equal(parsed.settings.batch!.digest,f.wire.digest);assert.deepEqual(parsed.settings.batch!.raw,f.wire.raw);
 for(const change of [(c:any)=>{c.batch.digest='d'.repeat(64);},(c:any)=>{c.batch.batch_id=randomUUID();},(c:any)=>{c.batch.extra=true;},
  (c:any)=>{c.batch.raw_b64+='=';},(c:any)=>{c.attempt_id=randomUUID();}]){
  const changed=JSON.parse(config.toString());change(changed);assert.throws(()=>readCapsuleRequest(Buffer.from(judgeJson(changed)),request));
 }
});
test('batch resource recovery follows the newest original phase intent and never reuses a previous case identity after a partial start',()=>{
 const f=fixture(),physical={container_id:'a'.repeat(64),cgroup_parent:`/ingenium-exec-${'b'.repeat(32)}`},
 groups={memory:{device:'11',inode:'12'},cpuacct:{device:'21',inode:'22'}},
 rows:Record<string,unknown|null>={compile_init:phaseInitialisation(f.plan,'compile',f.boot,physical,'c'.repeat(64)),compile_groups:null,run_init:null,run_groups:null};
 rows.compile_groups=phaseResourceRecord(rows.compile_init as ReturnType<typeof phaseInitialisation>,groups);
 const casePlan=(i:number)=>createExecutionPlan({...f.claim,payload:f.cases[i]!.payload},f.runtimes);
 rows.b00_init=phaseInitialisation(casePlan(0),'run',f.boot,physical,'d'.repeat(64));rows.b00_groups=phaseResourceRecord(rows.b00_init as any,groups);rows.b00_result={retained:true};
 rows.b01_init=phaseInitialisation(casePlan(1),'run',f.boot,physical,'e'.repeat(64));
 assert.deepEqual(retainedBatchPhaseGroups(f.plan,f.cases,f.boot,physical,rows),{phase:'run',groups:null});
 rows.b01_groups=phaseResourceRecord(rows.b01_init as any,{memory:{device:'11',inode:'13'},cpuacct:{device:'21',inode:'23'}});
 assert.equal(retainedBatchPhaseGroups(f.plan,f.cases,f.boot,physical,rows).groups!.memory.inode,'13');
 for(const altered of [{...rows,b00_result:null},{...rows,b01_init:rows.b00_init},{...rows,b03_init:rows.b01_init},
  {...rows,b00_init:null},{...rows,run_init:rows.b00_init}])assert.throws(()=>retainedBatchPhaseGroups(f.plan,f.cases,f.boot,physical,altered));
});
