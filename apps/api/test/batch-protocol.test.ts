import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {readFileSync} from "node:fs";
import {test} from "node:test";
import {sha256} from "../src/access/credentials.js";
import {createParticipantBatch,readParticipantBatch} from "../src/content/batch-protocol.js";
import type {ParticipantBatchCase} from "../src/content/batch-protocol.js";
import {judgeJson} from "../src/content/judge-protocol.js";
import {judgeRuntimes} from "./fixtures/judge.js";

const runtimes=judgeRuntimes();
function fixture(count=2){
  const shared={hostEpochId:randomUUID(),runId:randomUUID(),runtimeKey:runtimes.get('c')!.key,runtimeDigest:runtimes.get('c')!.digest,
    language:'c',sourceRole:'OFFICIAL',checkType:'TEST_CASE',source:Buffer.from('int main(void) { return 0; }'),cpuMs:2000,wallMs:10000,memoryKb:524288} as const;
  return Array.from({length:count},(_,i):ParticipantBatchCase=>({caseId:randomUUID(),position:i+1,
    payload:{...shared,attemptId:randomUUID(),checkId:randomUUID(),source:Buffer.from(shared.source),stdin:Buffer.from([i,0,255])},
    expected:Buffer.from([i,255,0]),checker:'EXACT_TEXT'}));
}
function parse(raw:Buffer,id:string,epoch:string){return readParticipantBatch(raw,{batchId:id,hostEpochId:epoch,digest:sha256(raw).toString('hex')},runtimes);}

test('one batch binds every original case, input, expected output, source, runtime and limit without repeated source bytes',()=>{
  const cases=fixture(8),id=randomUUID(),wire=createParticipantBatch(id,cases,runtimes),before=Buffer.from(cases[0]!.payload.source);
  for(const c of cases){c.payload.source.fill(0);c.payload.stdin.fill(0);c.expected.fill(0);}
  const decoded=readParticipantBatch(wire.raw,{batchId:id,hostEpochId:cases[0]!.payload.hostEpochId,digest:wire.digest},runtimes);
  assert.equal(decoded.cases.length,8);
  for(const [i,c] of decoded.cases.entries()){
    assert.equal(c.caseId,cases[i]!.caseId);assert.equal(c.payload.attemptId,cases[i]!.payload.attemptId);
    assert.deepEqual(c.payload.source,before);assert.deepEqual(c.payload.stdin,Buffer.from([i,0,255]));assert.deepEqual(c.expected,Buffer.from([i,255,0]));
    assert.equal(c.payload.cpuMs,2000);assert.equal(c.payload.wallMs,10000);assert.equal(c.payload.memoryKb,524288);
  }
  assert.equal(wire.raw.toString().split(before.toString('base64')).length-1,1);
});

test('a batch cannot mix source, owner run, language, runtime, lane or compilation-only work',()=>{
  for(const patch of [{source:Buffer.from('other')},{runId:randomUUID()},{hostEpochId:randomUUID()},{language:'python'},
    {runtimeDigest:'b'.repeat(64)},{sourceRole:'SAMPLE'},{checkType:'COMPILATION'},{sourceRole:'REFERENCE'}]){
    const cases=fixture();Object.assign(cases[1]!.payload,patch);
    assert.throws(()=>createParticipantBatch(randomUUID(),cases,runtimes));
  }
});

test('duplicate identities, reordered or excessive cases and invalid per-case limits are refused',()=>{
  for(const change of [
    (v:ParticipantBatchCase[])=>{v[1]!.caseId=v[0]!.caseId;},
    (v:ParticipantBatchCase[])=>{v[1]!.payload.attemptId=v[0]!.payload.attemptId;},
    (v:ParticipantBatchCase[])=>{v[1]!.payload.checkId=v[0]!.payload.checkId;},
    (v:ParticipantBatchCase[])=>{v[1]!.position=1;},
    (v:ParticipantBatchCase[])=>{v[1]!.position=21;},
    (v:ParticipantBatchCase[])=>{v[1]!.payload.cpuMs=2001;},
    (v:ParticipantBatchCase[])=>{v[1]!.payload.memoryKb=524289;},
    (v:ParticipantBatchCase[])=>{v[1]!.expected=Buffer.alloc(1048577);},
  ]){const cases=fixture();change(cases);assert.throws(()=>createParticipantBatch(randomUUID(),cases,runtimes));}
  assert.throws(()=>createParticipantBatch(randomUUID(),[],runtimes));
  assert.throws(()=>createParticipantBatch(randomUUID(),fixture(21),runtimes));
  const sample=fixture(4);for(const c of sample)c.payload.sourceRole='SAMPLE';
  assert.throws(()=>createParticipantBatch(randomUUID(),sample,runtimes));
});

test('the native boundary rejects tampering even when malformed bytes carry a recomputed digest',()=>{
  const cases=fixture(),id=randomUUID(),epoch=cases[0]!.payload.hostEpochId,wire=createParticipantBatch(id,cases,runtimes);
  assert.throws(()=>readParticipantBatch(wire.raw,{batchId:randomUUID(),hostEpochId:epoch,digest:wire.digest},runtimes));
  assert.throws(()=>readParticipantBatch(wire.raw,{batchId:id,hostEpochId:randomUUID(),digest:wire.digest},runtimes));
  assert.throws(()=>readParticipantBatch(Buffer.concat([wire.raw,Buffer.from(' ')]),{batchId:id,hostEpochId:epoch,digest:wire.digest},runtimes));
  for(const modify of [
    (v:any)=>{v.extra=true;},(v:any)=>{v.cases.c00.extra=true;},(v:any)=>{v.cases.c00.expected_b64='AB==';},
    (v:any)=>{v.source_role='REFERENCE';},(v:any)=>{v.cases.c00.attempt_id=id;},
    (v:any)=>{v.cases.c02=v.cases.c01;delete v.cases.c01;},(v:any)=>{v.cases=[];},
  ]){const value=JSON.parse(wire.raw.toString());modify(value);assert.throws(()=>parse(Buffer.from(JSON.stringify(value)),id,epoch));}
  const altered=JSON.parse(wire.raw.toString());altered.cases.c00.expected_b64=Buffer.from('different').toString('base64');
  const raw=Buffer.from(judgeJson(altered));assert.throws(()=>readParticipantBatch(raw,{batchId:id,hostEpochId:epoch,digest:wire.digest},runtimes));
});

test('every complete eight-case Round 2 question fits the bounded batch format in all four event languages',t=>{
  const pack=JSON.parse(readFileSync(new URL('../../../content/round-2/pack.json',import.meta.url),'utf8'));
  assert.equal(pack.questions.length,100);let largest=0;
  for(const q of pack.questions)for(const language of ['c','cpp','java','python'] as const){
    const template=fixture(1)[0]!,runtime=runtimes.get(language)!;
    const cases:ParticipantBatchCase[]=q.cases.map((c:any)=>({caseId:randomUUID(),position:c.position,
      payload:{...template.payload,attemptId:randomUUID(),checkId:randomUUID(),language,runtimeKey:runtime.key,runtimeDigest:runtime.digest,
        source:Buffer.from(q.variants[language].starter_code),stdin:Buffer.from(c.input_data),cpuMs:['c','cpp'].includes(language)?2000:4000,wallMs:['c','cpp'].includes(language)?10000:15000},
      expected:Buffer.from(c.expected_output),checker:q.checker_mode}));
    const id=randomUUID(),wire=createParticipantBatch(id,cases,runtimes);largest=Math.max(largest,wire.raw.length);
    assert.equal(parse(wire.raw,id,template.payload.hostEpochId).cases.length,8);
  }
  t.diagnostic(`All 400 language/question batches fit; largest canonical request ${largest} bytes. No programs executed by this format test.`);
});
