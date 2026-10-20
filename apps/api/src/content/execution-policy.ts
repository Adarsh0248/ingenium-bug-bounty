import { commandFingerprint, sha256 } from "../access/credentials.js";
import type { Language } from "../access/credentials.js";
import { checkText } from "./policy.js";
import type { CodeResult } from "./validation-policy.js";

export interface AuthoringPayload {
  attemptId:string;hostEpochId:string;runId:string;checkId:string;runtimeKey:string;runtimeDigest:string;language:Language;
  sourceRole:"REFERENCE"|"STARTER";checkType:"TEST_CASE"|"COMPILATION";source:Buffer;stdin:Buffer;cpuMs:number;wallMs:number;memoryKb:number;
}
// Implementations must authenticate and verify supervisor evidence, not translate stock Judge0 status labels.
export interface TrustedAuthoringDriver {
  hostEpochId:string;endpointRef:string;runtimes:ReadonlyMap<Language,{key:string;digest:string}>;
  assertReady(signal:AbortSignal):Promise<void>;
  submit(payload:AuthoringPayload,signal:AbortSignal):Promise<unknown>;
  observe(payload:AuthoringPayload,signal:AbortSignal):Promise<unknown>;
}
const hex=/^[0-9a-f]{64}$/;
const kinds=["NORMAL","COMPILATION_ERROR","RUNTIME_ERROR","TIME_LIMIT_EXCEEDED","MEMORY_LIMIT_EXCEEDED","OUTPUT_LIMIT_EXCEEDED","INFRA_ERROR"];
export function authoringPayloadDigest(p:AuthoringPayload):Buffer {
  return commandFingerprint(["AUTHORING_EXECUTION_V1",p.attemptId,p.hostEpochId,p.runId,p.checkId,p.runtimeKey,p.runtimeDigest,p.language,p.sourceRole,p.checkType,
    sha256(p.source).toString("hex"),String(p.source.length),sha256(p.stdin).toString("hex"),String(p.stdin.length),String(p.cpuMs),String(p.wallMs),String(p.memoryKb)]);
}
function record(value:unknown):Record<string,unknown> {
  if(!value || typeof value!=="object" || Array.isArray(value))throw new Error("Unusable authoring evidence.");
  return value as Record<string,unknown>;
}
function decimal(value:unknown):value is string {return typeof value==="string" && /^(0|[1-9][0-9]{0,18})$/.test(value) && BigInt(value)<=9223372036854775807n;}
export function acceptAuthoringObservation(p:AuthoringPayload,observation:unknown,expected:Buffer,checker:"TOKENS"|"EXACT_TEXT") {
  const v=record(observation);
  if(v.state==="PENDING" && Object.keys(v).length===1)return null;
  const fields=["state","attempt_id","host_epoch_id","payload_digest","runtime_digest","source_sha256","stdin_sha256","evidence_digest","execution_result",
    "stdout","stdout_complete","stderr","stderr_truncated","compiler_output","compiler_output_truncated","cpu_ns","peak_bytes","drain"];
  if(Object.keys(v).length!==fields.length || Object.keys(v).some(k=>!fields.includes(k)) || v.state!=="FINISHED" || v.attempt_id!==p.attemptId || v.host_epoch_id!==p.hostEpochId
    || v.payload_digest!==authoringPayloadDigest(p).toString("hex") || v.runtime_digest!==p.runtimeDigest || v.source_sha256!==sha256(p.source).toString("hex") || v.stdin_sha256!==sha256(p.stdin).toString("hex")
    || typeof v.evidence_digest!=="string" || !hex.test(v.evidence_digest) || typeof v.execution_result!=="string" || !kinds.includes(v.execution_result)
    || !Buffer.isBuffer(v.stdout) || v.stdout.length>1048577 || typeof v.stdout_complete!=="boolean" || !Buffer.isBuffer(v.stderr) || v.stderr.length>65536
    || typeof v.stderr_truncated!=="boolean" || typeof v.compiler_output_truncated!=="boolean"
    || !Buffer.isBuffer(v.compiler_output) || v.compiler_output.length>65536 || !decimal(v.cpu_ns) || !decimal(v.peak_bytes))throw new Error("Unusable authoring evidence.");
  if(v.execution_result==="NORMAL" && (!v.stdout_complete || v.stdout.length>1048576))throw new Error("Incomplete stdout is not an answer.");
  let release:Buffer|null=null;
  if(v.drain!==null){
    const d=record(v.drain);
    if(Object.keys(d).length!==4 || d.cannot_start!==true || d.processes_stopped!==true || d.workspace_removed!==true || typeof d.proof_digest!=="string" || !hex.test(d.proof_digest))throw new Error("Unusable drain evidence.");
    release=commandFingerprint(["AUTHORING_DRAIN_V1",p.attemptId,p.hostEpochId,v.payload_digest as string,d.proof_digest]);
  }
  const result:CodeResult|"INFRA_ERROR"=v.execution_result==="NORMAL" ? p.checkType==="COMPILATION" || checkText(checker,v.stdout,expected) ? "PASSED":"WRONG_ANSWER" : v.execution_result as CodeResult|"INFRA_ERROR";
  return {result,release,stdoutPrefix:v.stdout.subarray(0,16384),stderr:v.stderr,compilerOutput:v.compiler_output,
    metadata:{schema_version:1,attempt_id:p.attemptId,host_epoch_id:p.hostEpochId,payload_digest:v.payload_digest,result,runtime_digest:p.runtimeDigest,
      source_sha256:v.source_sha256,stdin_sha256:v.stdin_sha256,provider_evidence_digest:v.evidence_digest,execution_result:v.execution_result,
      stdout_sha256:sha256(v.stdout).toString("hex"),stdout_bytes:v.stdout.length,stdout_complete:v.stdout_complete,stderr_truncated:v.stderr_truncated,
      compiler_output_truncated:v.compiler_output_truncated,cpu_ns:v.cpu_ns,peak_bytes:v.peak_bytes} };
}
