import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {test} from "node:test";
import {createParticipantBatch} from "../src/content/batch-protocol.js";
import type {ParticipantBatchCase} from "../src/content/batch-protocol.js";
import {runParticipantBatch} from "../src/judge/batch-runner.js";
import type {TrustedBatchSession} from "../src/judge/batch-runner.js";
import {isolateObservation} from "./fixtures/isolate-observation.js";
import {judgePayload,judgeRuntimes} from "./fixtures/judge.js";
import {acceptParticipantBatchResult} from '../src/content/batch-result.js';

function fixture(language:'c'|'cpp'|'java'|'python'='cpp'){
  const shared=judgePayload(language),id=randomUUID(),runtimes=judgeRuntimes();shared.sourceRole='OFFICIAL';
  const cases:ParticipantBatchCase[]=Array.from({length:8},(_,i)=>({caseId:randomUUID(),position:i+1,
    payload:{...shared,attemptId:randomUUID(),checkId:randomUUID(),stdin:Buffer.from(`${i} ${12-i}\n`)},expected:Buffer.from('12\n'),checker:'EXACT_TEXT'}));
  const wire=createParticipantBatch(id,cases,runtimes),identity={batchId:id,hostEpochId:shared.hostEpochId,digest:wire.digest},
    permit={owner:randomUUID(),providerToken:randomUUID()},calls:string[]=[],records=new Map<string,unknown>();
  const session:TrustedBatchSession={
    async verifySource(){calls.push('source');},async compile(){calls.push('compile');return isolateObservation('compile');},
    async snapshotArtifact(){calls.push('artifact');return 'a'.repeat(64);},
    async runCase(plan,key){calls.push(key);assert.equal(plan.stdin.toString(),cases[Number(key.slice(1))]!.payload.stdin.toString());return isolateObservation('run');},
    async record(key,value){assert.equal(records.has(key),false);records.set(key,value);},
  };
  const run=(signal=new AbortController().signal)=>runParticipantBatch(wire.raw,identity,permit,runtimes,session,signal);
  return {id,cases,wire,identity,permit,runtimes,calls,records,session,run};
}

test('a batch compiles once, preserves all eight original run limits and runs every required case in all four languages',async()=>{
  for(const language of ['c','cpp','java','python']as const){
    const f=fixture(language),result=await f.run();
    const accepted=acceptParticipantBatchResult(f.wire.raw,f.identity,f.runtimes,result);
    assert.equal(accepted.cases.length,8);assert.equal(accepted.drain,null);assert.equal(accepted.cases[0]!.metadata.schema_version,2);
    assert.equal(f.calls.filter(c=>c==='compile').length,language==='python'?0:1);
    assert.equal(f.calls.filter(c=>/^c[0-9]{2}$/.test(c)).length,8);
    assert.equal(result.drain,null);assert.equal(result.batch_digest,f.wire.digest);
    for(const [i,value]of Object.values(result.cases).entries()){
      const c=value as any;assert.equal(c.verdict,'PASSED');assert.equal(c.attempt_id,f.cases[i]!.payload.attemptId);
      assert.equal(c.compile_origin,language==='python'?null:f.id);
      assert.deepEqual(c.run.limits,{cpu_ms:f.cases[i]!.payload.cpuMs,wall_ms:f.cases[i]!.payload.wallMs,memory_kb:f.cases[i]!.payload.memoryKb});
      assert.equal(c.output_match,true);
    }
  }
});

test('batch result acceptance rejects altered source, case identity, limits, captures, checker decision and pretend drains',async()=>{
  const f=fixture(),result=await f.run();
  for(const change of [
    (v:any)=>{v.source_sha256='b'.repeat(64);},(v:any)=>{delete v.cases.c07;},
    (v:any)=>{v.cases.c01.attempt_id=v.cases.c00.attempt_id;},(v:any)=>{v.cases.c01.expected_sha256='b'.repeat(64);},
    (v:any)=>{v.cases.c00.run.limits.cpu_ms++;},(v:any)=>{v.cases.c00.stdout.prefix_b64=Buffer.from('13\n').toString('base64');},
    (v:any)=>{v.cases.c00.output_match=false;v.cases.c00.verdict='WRONG_ANSWER';},
    (v:any)=>{v.cases.c00.compile_origin=null;},(v:any)=>{v.cases.c00.run.infrastructure_error=true;},
    (v:any)=>{v.drain={cannot_start:true,processes_stopped:false,workspace_removed:true,proof_digest:'a'.repeat(64)};},
    (v:any)=>{v.compile.extra=true;},(v:any)=>{v.artifact_sha256='b'.repeat(64);},
  ]){
    const changed=structuredClone(result);change(changed);assert.throws(()=>acceptParticipantBatchResult(f.wire.raw,f.identity,f.runtimes,changed));
  }
  const drained={...result,drain:{cannot_start:true,processes_stopped:true,workspace_removed:true,proof_digest:'a'.repeat(64)}};
  assert.equal(acceptParticipantBatchResult(f.wire.raw,f.identity,f.runtimes,drained).drain,'a'.repeat(64));
});

test('wrong answers and attributable runtime failures do not skip later required tests',async()=>{
  const f=fixture();let n=0;
  f.session.runCase=async()=>++n===1?isolateObservation('run',{stdout:Buffer.from('13\n')}):n===2?isolateObservation('run',{code:3}):isolateObservation('run');
  const result=await f.run(),verdicts=Object.values(result.cases).map(c=>(c as any).verdict);
  assert.equal(n,8);assert.deepEqual(verdicts,['WRONG_ANSWER','RUNTIME_ERROR',...Array(6).fill('PASSED')]);
});

test('one verified compiler rejection is explicitly shared; no run or successful answer is fabricated',async()=>{
  const f=fixture();let compilations=0;
  f.session.compile=async()=>{compilations++;return isolateObservation('compile',{code:1,compiler:Buffer.from(JSON.stringify([
    {kind:'error',locations:[{caret:{file:'/box/main.cpp',line:1,column:2}}],children:[],message:'expected semicolon'},
  ]))});};
  const result=await f.run();assert.equal(compilations,1);assert.deepEqual(f.calls,['source']);
  assert.equal(result.artifact_sha256,null);assert.equal(Object.keys(result.cases).length,8);
  for(const value of Object.values(result.cases)){const c=value as any;assert.equal(c.verdict,'COMPILATION_ERROR');assert.equal(c.run,null);assert.equal(c.compile_origin,f.id);assert.equal(c.output_match,null);}
});

test('cancellation retains the last genuine completed observation but starts no subsequent case',async()=>{
  const f=fixture(),cancel=new AbortController();let runs=0;
  f.session.runCase=async()=>{runs++;if(runs===3)cancel.abort();return isolateObservation('run');};
  await assert.rejects(f.run(cancel.signal));assert.equal(runs,3);
  assert.deepEqual([...f.records.keys()],['compile','artifact','c00','c01','c02']);
  const cancelled=fixture();await assert.rejects(cancelled.run(AbortSignal.abort()));assert.deepEqual(cancelled.calls,[]);
});

test('infrastructure failures, malformed counters and failed immutable writes retain partial history without starting more work',async()=>{
  const infra=fixture();let runs=0;
  infra.session.runCase=async()=>{runs++;return isolateObservation('run',{signal:9});};
  await assert.rejects(infra.run(),/infrastructure/);assert.equal(runs,1);assert.equal((infra.records.get('c00')as any).verdict,'INFRA_ERROR');
  const malformed=fixture();malformed.session.runCase=async()=>({...isolateObservation('run'),metadata:Buffer.from('status:XX\n')});
  await assert.rejects(malformed.run());assert.equal(malformed.records.has('c00'),false);
  const compiler=fixture();compiler.session.compile=async()=>isolateObservation('compile',{code:1,compiler:Buffer.from('compiler IO failure')});
  await assert.rejects(compiler.run(),/infrastructure/);assert.equal(compiler.records.size,1);
  const disk=fixture();disk.session.record=async()=>{throw new Error('immutable checkpoint unavailable');};
  await assert.rejects(disk.run(),/checkpoint/);assert.deepEqual(disk.calls,['source','compile']);
});
