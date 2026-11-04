import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {chmod,chown,link,mkdir,readFile,rm,stat,symlink,writeFile} from 'node:fs/promises';
import {test,beforeEach} from 'node:test';
import {openBatchArtifact} from '../../../apps/api/src/judge/batch-artifact.js';
import {createExecutionPlan} from '../../../apps/api/src/judge/execution-plan.js';
import {judgePayload,judgeRuntimes} from '../../../apps/api/test/fixtures/judge.js';
const root='/run/ingenium',work=root+'/workspace',control=root+'/control';
beforeEach(async()=>{await rm(root,{recursive:true,force:true});await mkdir(work,{recursive:true,mode:0o700});await mkdir(control,{mode:0o700});await chmod(root,0o755);});
async function fixture(language:'cpp'|'java'|'python'='cpp'){
  const p=judgePayload(language);p.source=Buffer.from('original source\n');p.sourceRole='OFFICIAL';
  const plan=createExecutionPlan({payload:p,owner:randomUUID(),providerToken:randomUUID()},judgeRuntimes());
  await writeFile(work+'/'+plan.sourceFile,p.source,{mode:0o444});
  if(language==='cpp'){await writeFile(work+'/main','executable-bytes',{mode:0o755});await chown(work+'/main',60000,60000);}
  if(language==='java'){await mkdir(work+'/pkg');await writeFile(work+'/Main.class','main bytecode',{mode:0o644});await writeFile(work+'/pkg/Nested.class','nested bytecode',{mode:0o644});}
  await chown(work,60000,60000);return plan;
}
test('one immutable artifact restores fresh original bytes and ownership for every test',async()=>{
  const plan=await fixture(),signal=new AbortController().signal;let stops=0;
  const artifact=await openBatchArtifact(plan,async()=>{stops++;},signal);
  try{
    assert.match(artifact.digest,/^[a-f0-9]{64}$/);
    for(let i=0;i<8;i++){
      await artifact.restoreCase(signal);assert.equal((await stat(work)).uid,60000);assert.equal((await stat(work)).mode&0o7777,0o700);
      assert.equal((await stat(work+'/main')).uid,60000);assert.equal((await stat(control+'/artifact/main')).uid,0);assert.equal((await stat(work+'/main')).mode&0o7777,0o555);
      assert.equal((await readFile(work+'/main')).toString(),'executable-bytes');
      await rm(work+'/main');await writeFile(work+'/main','participant replacement');
      await mkdir(work+'/junk');await writeFile(work+'/junk/state','previous-case-state');
    }
    assert.equal(stops,9);
  }finally{await artifact.close();}
});
test('Java package artifacts and interpreted source are restored without copying prior case files',async()=>{
  for(const language of ['java','python']as const){
    await rm(root,{recursive:true});await mkdir(work,{recursive:true,mode:0o700});await mkdir(control,{mode:0o700});await chmod(root,0o755);
    const plan=await fixture(language),artifact=await openBatchArtifact(plan,async()=>{},new AbortController().signal);
    try{await artifact.restoreCase(new AbortController().signal);assert.deepEqual(await readFile(work+'/'+plan.sourceFile),plan.source);
      if(language==='java')assert.equal((await readFile(work+'/pkg/Nested.class')).toString(),'nested bytecode');
    }finally{await artifact.close();}
  }
});
test('a participant-created symlink is unlinked without changing its outside target',async()=>{
  const plan=await fixture(),signal=new AbortController().signal,artifact=await openBatchArtifact(plan,async()=>{},signal);
  try{await artifact.restoreCase(signal);await writeFile('/run/outside','unchanged');await symlink('/run/outside',work+'/escape');
    await artifact.restoreCase(signal);assert.equal((await readFile('/run/outside')).toString(),'unchanged');await assert.rejects(stat(work+'/escape'));
  }finally{await artifact.close();}
});
test('deep participant directories cannot make the next case inherit their state',async()=>{
 const plan=await fixture(),signal=new AbortController().signal,artifact=await openBatchArtifact(plan,async()=>{},signal);
 try{await artifact.restoreCase(signal);const path=work+'/'+Array(40).fill('deep').join('/');await mkdir(path,{recursive:true});await writeFile(path+'/state','old');
  await artifact.restoreCase(signal);await assert.rejects(stat(work+'/deep'));assert.equal((await readFile(work+'/main')).toString(),'executable-bytes');
 }finally{await artifact.close();}
});
test('changed sealed artifact bytes, source substitution, hard links and snapshot symlinks fail closed',async()=>{
  const plan=await fixture(),signal=new AbortController().signal,artifact=await openBatchArtifact(plan,async()=>{},signal);
  try{await chmod(control+'/artifact/main',0o600);await writeFile(control+'/artifact/main','changed');await assert.rejects(artifact.restoreCase(signal));}finally{await artifact.close();}
  await rm(control+'/artifact',{recursive:true});await fixture();
  await link(work+'/main',work+'/extra-link');await assert.rejects(openBatchArtifact(plan,async()=>{},signal));
});
test('an unproved stopped process or cancellation prevents workspace replacement',async()=>{
  const plan=await fixture(),signal=new AbortController().signal;let stopped=true;
  const artifact=await openBatchArtifact(plan,async()=>{assert.equal(stopped,true);},signal);
  try{await writeFile(work+'/sentinel','preserve');stopped=false;await assert.rejects(artifact.restoreCase(signal));
    assert.equal((await readFile(work+'/sentinel')).toString(),'preserve');await assert.rejects(artifact.restoreCase(AbortSignal.abort()));
  }finally{await artifact.close();}
});
