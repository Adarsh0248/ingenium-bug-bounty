import {sha256} from '../access/credentials.js';
import {authoringPayloadDigest} from './execution-policy.js';
import {readParticipantBatch} from './batch-protocol.js';
import {classifyRunEvidence,judgeJson,validateJudgePhase,JUDGE_BODY_LIMIT} from './judge-protocol.js';
import type {JudgeRuntimes} from './judge-protocol.js';
import {checkText} from './policy.js';
const bad=():never=>{throw new Error('Unbound participant batch evidence; retain its physical hold.');};
function exact(value:unknown,keys:readonly string[]){
  if(!value||typeof value!=='object'||Array.isArray(value))return bad();const row=value as Record<string,unknown>;
  if(Object.keys(row).length!==keys.length||keys.some(k=>!Object.hasOwn(row,k)))return bad();return row;
}
const hex=(value:unknown):value is string=>typeof value==='string'&&/^[0-9a-f]{64}$/.test(value);
function capture(value:unknown,limit:number,maximum:number){
  const row=exact(value,['bytes','sha256','prefix_b64','truncated']);
  if(!Number.isSafeInteger(row.bytes)||(row.bytes as number)<0||(row.bytes as number)>maximum||!hex(row.sha256)||typeof row.prefix_b64!=='string'
    ||row.prefix_b64.length>Math.ceil(limit/3)*4||typeof row.truncated!=='boolean')return bad();
  const bytes=Buffer.from(row.prefix_b64,'base64');if(bytes.toString('base64')!==row.prefix_b64||bytes.length!==Math.min(limit,row.bytes as number))return bad();
  if((row.bytes as number)>limit&&!row.truncated||bytes.length===row.bytes&&sha256(bytes).toString('hex')!==row.sha256)return bad();
  return {sha256:row.sha256,bytes:row.bytes as number,prefix:bytes,truncated:row.truncated as boolean};
}

export function acceptParticipantBatchResult(raw:Buffer,identity:{batchId:string;hostEpochId:string;digest:string},runtimes:JudgeRuntimes,value:unknown){
  const batch=readParticipantBatch(raw,identity,runtimes),first=batch.cases[0]!.payload;
  if(Buffer.byteLength(judgeJson(value))>JUDGE_BODY_LIMIT)return bad();
  const result=exact(value,['protocol','batch_id','batch_digest','host_epoch_id','run_id','runtime_digest','source_sha256','compile','artifact_sha256','cases','drain']);
  if(result.protocol!=='ingenium-participant-batch-result-v1'||result.batch_id!==batch.batchId||result.batch_digest!==identity.digest
    ||result.host_epoch_id!==batch.hostEpochId||result.run_id!==batch.runId||result.runtime_digest!==first.runtimeDigest
    ||result.source_sha256!==sha256(first.source).toString('hex'))return bad();
  let compiler:Buffer=Buffer.alloc(0),compilation:Record<string,unknown>|null=null;
  if(['c','cpp','java'].includes(first.language)){
    const c=exact(result.compile,['phase','output_b64','truncated']);if(typeof c.output_b64!=='string'||c.output_b64.length>87384||typeof c.truncated!=='boolean')return bad();
    compiler=Buffer.from(c.output_b64,'base64');if(compiler.length>65536||compiler.toString('base64')!==c.output_b64)return bad();
    compilation=validateJudgePhase(c.phase,{cpu_ms:15000,wall_ms:30000,memory_kb:1048576});
    if(compilation.infrastructure_error||compilation.failure_attribution==='INFRASTRUCTURE')return bad();
  }else if(result.compile!==null)return bad();
  const compilationFailed=compilation!==null&&compilation.exit_code!==0;
  if(compilationFailed?(result.artifact_sha256!==null||compilation!.failure_attribution!=='PARTICIPANT'||compilation!.exit_code!==1):!hex(result.artifact_sha256))return bad();
  let drain:string|null=null;
  if(result.drain!==null){const d=exact(result.drain,['cannot_start','processes_stopped','workspace_removed','proof_digest']);
    if(d.cannot_start!==true||d.processes_stopped!==true||d.workspace_removed!==true||!hex(d.proof_digest))return bad();drain=d.proof_digest;}
  const cases=exact(result.cases,batch.cases.map((_,i)=>`c${String(i).padStart(2,'0')}`));
  const accepted=batch.cases.map((c,index)=>{
    const row=exact(cases[`c${String(index).padStart(2,'0')}`],['batch_id','batch_digest','case_id','attempt_id','check_id','position','payload_digest','stdin_sha256','expected_sha256','checker_mode','compile_origin','artifact_sha256','run','verdict','output_match','stdout','stderr']);
    const p=c.payload;
    if(row.batch_id!==batch.batchId||row.batch_digest!==identity.digest||row.case_id!==c.caseId||row.attempt_id!==p.attemptId
      ||row.check_id!==p.checkId||row.position!==c.position||row.payload_digest!==authoringPayloadDigest(p).toString('hex')
      ||row.stdin_sha256!==sha256(p.stdin).toString('hex')||row.expected_sha256!==sha256(c.expected).toString('hex')||row.checker_mode!==c.checker
      ||row.compile_origin!==(compilation===null?null:batch.batchId)||row.artifact_sha256!==result.artifact_sha256)return bad();
    const out=capture(row.stdout,16384,1048577),err=capture(row.stderr,4096,65536);
    let verdict:string,usage:Record<string,unknown>|null=compilation;
    if(compilationFailed){if(row.run!==null||out.bytes!==0||err.bytes!==0||out.truncated||err.truncated||row.output_match!==null)return bad();verdict='COMPILATION_ERROR';}
    else{
      const run=validateJudgePhase(row.run,{cpu_ms:p.cpuMs,wall_ms:p.wallMs,memory_kb:p.memoryKb});usage=run;
      // The trusted native checker saw complete stdout; a retained display prefix may be shorter.
      const classified=classifyRunEvidence(run,!run.output_limited,out.bytes);
      if(classified==='INFRA_ERROR')return bad();
      if(classified==='NORMAL'){
        if(typeof row.output_match!=='boolean'||out.bytes===out.prefix.length&&checkText(c.checker,out.prefix,c.expected)!==row.output_match
          ||c.checker==='EXACT_TEXT'&&out.bytes!==c.expected.length&&row.output_match)return bad();
        verdict=row.output_match?'PASSED':'WRONG_ANSWER';
      }
      else{if(row.output_match!==null)return bad();verdict=classified;}
    }
    if(row.verdict!==verdict)return bad();
    const metadata={schema_version:2,protocol:'ingenium-participant-batch-result-v1',attempt_id:p.attemptId,host_epoch_id:p.hostEpochId,
      payload_digest:row.payload_digest,runtime_digest:p.runtimeDigest,source_sha256:result.source_sha256,stdin_sha256:row.stdin_sha256,
      batch_id:batch.batchId,batch_digest:identity.digest,case_evidence_sha256:sha256(judgeJson(row)).toString('hex'),result:verdict,
      stdout_sha256:out.sha256,stdout_bytes:out.bytes,stdout_complete:!(row.run as Record<string,unknown>|null)?.output_limited,
      stderr_truncated:err.truncated,compiler_output_truncated:result.compile===null?false:(result.compile as Record<string,unknown>).truncated,
      cpu_ns:usage?.cpu_ns,peak_bytes:usage?.peak_bytes,evidence:row};
    return {attemptId:p.attemptId,caseId:c.caseId,checkId:p.checkId,result:verdict,metadata,stdoutPrefix:out.prefix,stderr:err.prefix,compilerOutput:compiler,drain};
  });
  return {batchId:batch.batchId,drain,cases:accepted};
}
