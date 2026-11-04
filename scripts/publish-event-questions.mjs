import assert from 'node:assert/strict';
import {readFile,open,rename} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {parseArgs} from 'node:util';
import {isAbsolute,dirname} from 'node:path';
import {setTimeout as wait} from 'node:timers/promises';

const {values:v}=parseArgs({options:{origin:{type:'string'},round:{type:'string'},'code-file':{type:'string'},'import-receipt':{type:'string'},'judge-descriptor':{type:'string'},receipt:{type:'string'}}});
assert.ok(['1','2'].includes(v.round),'Choose exactly one round to publish.');
for(const key of ['code-file','import-receipt','judge-descriptor','receipt'])assert.ok(v[key]&&isAbsolute(v[key]),'Absolute private operator paths are required.');
const origin=new URL(v.origin);assert.equal(origin.protocol,'https:');assert.equal(origin.pathname,'/');assert.ok(!origin.username&&!origin.password&&!origin.search&&!origin.hash);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),languages=['c','cpp','java','python'];
const runReason='Execute every frozen reference case and original starter-failure witness on the isolated production judge.';
const imported=JSON.parse(await readFile(v['import-receipt'],'utf8')),descriptor=JSON.parse(await readFile(v['judge-descriptor'],'utf8')).judge;
assert.equal(imported.origin,origin.origin);assert.equal(Object.keys(imported.completed).length,150);assert.ok(!imported.pending);
const questions=[],digests=[];
for(const round of [1,2]){
 const bytes=await readFile(new URL(`../content/round-${round}/pack.json`,import.meta.url)),pack=JSON.parse(bytes);
 assert.equal(pack.questions.length,round===1?50:100);assert.deepEqual(pack.languages,languages);digests.push(sha(bytes));questions.push(...pack.questions);
}
assert.deepEqual(digests,imported.pack_sha256);
assert.equal(new Set(questions.map(q=>q.id)).size,150);assert.equal(new Set(Object.values(imported.completed)).size,150);
for(const q of questions){assert.ok(imported.completed[q.id]);assert.deepEqual(Object.keys(q.variants).sort(),[...languages].sort());for(const l of languages)assert.match(descriptor.runtimes[l].digest,/^[a-f0-9]{64}$/);}
let journal;
try{journal=JSON.parse(await readFile(v.receipt,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
journal??={protocol:'ingenium-event-publication-v1',origin:origin.origin,pack_sha256:digests,host_epoch_id:descriptor.host_epoch_id,versions:{},pending:null};
assert.equal(journal.protocol,'ingenium-event-publication-v1');assert.equal(journal.origin,origin.origin);assert.deepEqual(journal.pack_sha256,digests);
async function save(){const file=await open(v.receipt+'.next','w',0o600);try{await file.writeFile(JSON.stringify(journal,null,2)+'\n');await file.sync();}finally{await file.close();}await rename(v.receipt+'.next',v.receipt);const directory=await open(dirname(v.receipt),'r');try{await directory.sync();}finally{await directory.close();}}
const cookies=new Map();
let csrf,signedIn=false;
async function call(path,data){
 let capacityRetries=0;
 for(;;){
  assert.ok(path.startsWith('/api/v1/')&&!path.includes('#'));
  const response=await fetch(new URL(path,origin),{method:data===undefined?'GET':'POST',redirect:'manual',signal:AbortSignal.timeout(15000),headers:{Origin:origin.origin,Accept:'application/json',Cookie:[...cookies].map(([k,v])=>`${k}=${v}`).join('; '),...(data===undefined?{}:{'content-type':'application/json','x-csrf-token':csrf??''})},...(data===undefined?{}:{body:JSON.stringify(data)})});
  for(const value of response.headers.getSetCookie()){const pair=value.split(';',1)[0],at=pair.indexOf('=');assert.ok(at>0);const name=pair.slice(0,at),secret=pair.slice(at+1);assert.match(name,/^[A-Za-z0-9_-]+$/);assert.match(secret,/^[\x21-\x3a\x3c-\x7e]*$/);cookies.set(name,secret);}
  const chunks=[];let size=0;for await(const chunk of response.body){size+=chunk.byteLength;assert.ok(size<=2097152,'Bounded API response required.');chunks.push(Buffer.from(chunk));}const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if(response.status===429&&body.error?.code==='RATE_LIMITED'&&body.error.outcome==='NOT_PROCESSED'){await wait(Math.max(1,Math.min(60,Number(response.headers.get('retry-after'))||1))*1000);continue;}
  if(body.error?.code==='CAPACITY_UNAVAILABLE'&&body.error.outcome==='NOT_PROCESSED'&&capacityRetries++<12){await wait(5000);continue;}
  if(!response.ok||body.error){const e=new Error(`${path}: ${body.error?.code??body.data?.reason??response.status}`);e.safe=true;throw e;}
  return body.data;
 }
}
function accept(p,r){
 const q=journal.versions[p.source_id];assert.ok(q);
 if(p.kind==='BIND'){assert.ok(['APPLIED','UNCHANGED'].includes(r.outcome));q.bound[p.language]=true;q.revision=r.content_revision;}
 else if(p.kind==='PREPARE'){assert.ok(['APPLIED','UNCHANGED'].includes(r.outcome));assert.ok(r.snapshot_id);q.snapshot_id=r.snapshot_id;}
 else if(p.kind==='RUN'){assert.equal(r.outcome,'ADMITTED');assert.ok(r.run_id);q.run_id=r.run_id;}
 else if(p.kind==='PUBLISH'){assert.equal(r.outcome,'APPLIED');q.published=true;q.published_at=r.recorded_at;}
 else assert.fail('Unrecognised publication receipt.');
 journal.pending=null;
}
async function command(sourceId,kind,path,data,outcome,extra={}){
 assert.equal(journal.pending,null);const key=randomUUID();journal.pending={source_id:sourceId,kind,key,outcome:outcome(key),...extra};await save();
 const r=await call(path,{...data,request_key:key});accept(journal.pending,r);await save();return r;
}
try{
 await save();csrf=(await call('/api/v1/bootstrap?audience=ANONYMOUS')).csrf_token;
 const codes=[...(await readFile(v['code-file'],'utf8')).matchAll(/\b[A-Z2-7]{32}\b/g)];assert.equal(codes.length,1);
 const entry=await call('/api/v1/entry/verify',{code:codes[0][0]});assert.equal(entry.audience,'STAFF');assert.equal(entry.flow.mode,'NORMAL');csrf=entry.csrf_token;
 const login=await call('/api/v1/staff/entry/activate',{request_key:randomUUID()});csrf=login.csrf_token;signedIn=true;
 if(journal.host_epoch_id!==descriptor.host_epoch_id){
  assert.equal(journal.pending,null,'Reconcile the original command before changing hosts.');
  for(const q of Object.values(journal.versions).filter(q=>q.run_id&&!q.published)){const r=await call(`/api/v1/staff/content/validation-runs/${q.run_id}`);assert.equal(r.status,'PASSED','An unfinished original run must stay with its original host.');assert.equal(r.physical_pending,false);}
  journal.previous_host_epochs??=[];journal.previous_host_epochs.push(journal.host_epoch_id);journal.host_epoch_id=descriptor.host_epoch_id;await save();
 }
 if(journal.pending){
  const p=journal.pending,result=await call(p.outcome);
  if(result.status==='NOT_OBSERVED'&&p.kind==='RUN'){
   // Staff commands are idempotent for this same actor and request key; never create a replacement key.
   const q=journal.versions[p.source_id];assert.ok(q.snapshot_id&&!q.run_id);
   accept(p,await call(`/api/v1/staff/content/validation-snapshots/${q.snapshot_id}/runs`,{expected_revision:q.revision,reason:runReason,request_key:p.key}));
  }else{assert.equal(result.status,'OBSERVED','Original command is unconfirmed; preserve its request key.');accept(p,result.outcome);}
  await save();
 }
 const selected=questions.filter(q=>q.round_type===Number(v.round));assert.equal(selected.length,v.round==='1'?50:100);
 for(const question of selected){
  const versionId=imported.completed[question.id],q=journal.versions[question.id]??={version_id:versionId,bound:{},snapshot_id:null,run_id:null,published:false};
  assert.equal(q.version_id,versionId);if(q.published)continue;
  const path=`/api/v1/staff/content/versions/${versionId}`,current=await call(path);
  assert.equal(current.round_type,question.round_type);assert.equal(current.title,question.title);assert.equal(current.statement,question.statement);assert.equal(current.difficulty,question.difficulty);assert.equal(current.base_bounty,question.base_bounty);assert.equal(current.publication_status,'DRAFT');
  q.revision=current.content_revision;await save();
  for(const language of languages){
   if(q.bound[language])continue;
   const actual=(await call(`${path}/variants/${language}`)).data,expected=question.variants[language];
   for(const key of ['starter_code','reference_solution_code','defect_description'])assert.equal(sha(actual[key]),sha(expected[key]),'Live source differs from the reviewed pack.');
   const payload={language,starter_code:actual.starter_code,reference_solution_code:actual.reference_solution_code,defect_description:actual.defect_description,runtime_key:descriptor.runtimes[language].key,cpu_time_limit_ms:['c','cpp'].includes(language)?2000:4000,wall_time_limit_ms:['c','cpp'].includes(language)?10000:15000,memory_limit_kb:524288};
   await command(question.id,'BIND',`${path}/VARIANT`,{expected_revision:q.revision,reason:'Bind the reviewed question to the verified production runtime; preserve its source and witnesses.',payload},key=>`/api/v1/staff/outcomes/content/VARIANT/${versionId}/${key}`,{language});
  }
  if(!q.snapshot_id)await command(question.id,'PREPARE',`${path}/prepare-validation`,{expected_revision:q.revision,reason:'Freeze the reviewed four-language event question for real production reference and starter-witness validation.'},key=>`/api/v1/staff/outcomes/validation-preparation/${versionId}/${key}`);
  if(!q.run_id)await command(question.id,'RUN',`/api/v1/staff/content/validation-snapshots/${q.snapshot_id}/runs`,{expected_revision:q.revision,reason:runReason},key=>`/api/v1/staff/outcomes/validation-run/${q.snapshot_id}/${key}`);
  let last=-1,report;
  for(;;){
   report=await call(`/api/v1/staff/content/validation-runs/${q.run_id}`);assert.equal(report.snapshot_id,q.snapshot_id);
   const completed=report.checks.filter(c=>c.result!==null).length;
   if(completed!==last){console.log(JSON.stringify({round:question.round_type,title:question.title,completed_checks:completed,total_checks:report.checks.length,published:Object.values(journal.versions).filter(q=>q.published).length}));last=completed;}
   if(report.status==='PASSED'&&!report.physical_pending)break;
   if(!['QUEUED','RUNNING','PASSED'].includes(report.status)){journal.failure={source_id:question.id,run_id:q.run_id,status:report.status,checks:report.checks.map(c=>({language:c.language,role:c.source_role,result:c.result,expected:c.expected_result,physical_pending:c.physical_pending}))};await save();throw new Error('A real validation failed; original run and physical holds are retained.');}
   await wait(5000);
  }
  assert.ok(report.checks.every(c=>c.result===c.expected_result&&!c.physical_pending));q.fingerprint=report.configuration_fingerprint;q.check_count=report.checks.length;q.validated_at=report.finished_at;await save();
  await command(question.id,'PUBLISH',`/api/v1/staff/competition/publications/${q.snapshot_id}`,{run_id:q.run_id,expected_revision:q.revision,review:'Reviewed the Protocol Rebellion statement, samples, unique defect, hints and equivalent C/C++/Java/Python variants. Every real production reference test and original starter witness passed; physical cleanup is confirmed.'},key=>`/api/v1/staff/outcomes/publication/${q.snapshot_id}/${key}`);
  console.log(JSON.stringify({state:'PUBLISHED',round:question.round_type,title:question.title,total_published:Object.values(journal.versions).filter(q=>q.published).length}));
 }
 assert.ok(selected.every(q=>journal.versions[q.id]?.published));journal.round_finished??={};journal.round_finished[v.round]=new Date().toISOString();await save();
 console.log(JSON.stringify({state:'ROUND_PUBLISHED',round:Number(v.round),published:selected.length,competition_started:false}));
}catch(error){console.error(`Publication stopped: ${error.safe?error.message:error.name}. Preserve the original publication receipt, validation runs and physical holds.`);process.exitCode=1;}
finally{if(signedIn)await call('/api/v1/staff/logout',{}).catch(()=>{});}
