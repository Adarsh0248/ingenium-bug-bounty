import {sha256,uuid} from "../access/credentials.js";
import {readParticipantBatch} from "../content/batch-protocol.js";
import {classifyRunEvidence,judgeJson,JUDGE_BODY_LIMIT} from "../content/judge-protocol.js";
import type {JudgeRuntimes} from "../content/judge-protocol.js";
import {authoringPayloadDigest} from "../content/execution-policy.js";
import {checkText} from "../content/policy.js";
import {createExecutionPlan} from "./execution-plan.js";
import type {ExecutionPlan} from "./execution-plan.js";
import {isolatePhaseEvidence} from "./isolate-evidence.js";
import type {IsolateObservation} from "./isolate-evidence.js";

// Only the native factory may implement this seam: fresh case workspaces/cgroups and a sealed read-only artifact.
export interface TrustedBatchSession {
  verifySource(plan:ExecutionPlan,signal:AbortSignal):Promise<void>;
  compile(plan:ExecutionPlan,signal:AbortSignal):Promise<IsolateObservation>;
  snapshotArtifact(signal:AbortSignal):Promise<string>;
  runCase(plan:ExecutionPlan,key:string,signal:AbortSignal):Promise<IsolateObservation>;
  record(key:string,value:unknown):Promise<void>;
}

export async function runParticipantBatch(raw:Buffer,identity:{batchId:string;hostEpochId:string;digest:string},
  permit:{owner:string;providerToken:string},runtimes:JudgeRuntimes,session:TrustedBatchSession,signal:AbortSignal){
  const batch=readParticipantBatch(raw,identity,runtimes);uuid(permit.owner);uuid(permit.providerToken);
  const plans=batch.cases.map(c=>createExecutionPlan({payload:c.payload,...permit},runtimes)),first=plans[0]!;
  signal.throwIfAborted();await session.verifySource(first,signal);signal.throwIfAborted();
  let compiler:{phase:ReturnType<typeof isolatePhaseEvidence>;output_b64:string;truncated:boolean}|null=null;
  if(first.compile){
    const observation=await session.compile(first,signal),phase=isolatePhaseEvidence(first,"compile",observation);
    compiler={phase,output_b64:observation.pipes.compiler.toString("base64"),truncated:observation.pipes.compilerTruncated};
    await session.record("compile",compiler);
    if(phase.infrastructure_error)throw new Error("Batch compiler infrastructure fault; preserve its original hold.");
  }
  const compilationFailed=compiler!==null&&compiler.phase.exit_code!==0;
  let artifact:string|null=null;
  if(!compilationFailed){
    signal.throwIfAborted();artifact=await session.snapshotArtifact(signal);
    if(!/^[0-9a-f]{64}$/.test(artifact))throw new Error("Batch artifact identity unavailable; preserve its original hold.");
    await session.record("artifact",{sha256:artifact});
  }
  const result:Record<string,unknown>={};
  for(const [index,c]of batch.cases.entries()){
    signal.throwIfAborted();const key=`c${String(index).padStart(2,"0")}`,plan=plans[index]!;
    let run:ReturnType<typeof isolatePhaseEvidence>|null=null,observation:IsolateObservation|null=null,
      verdict=compilationFailed?"COMPILATION_ERROR":"INFRA_ERROR",match:boolean|null=null;
    if(!compilationFailed){
      observation=await session.runCase(plan,key,signal);run=isolatePhaseEvidence(plan,"run",observation);
      verdict=classifyRunEvidence(run,observation.pipes.stdoutComplete,observation.pipes.stdout.length);
      if(verdict==="NORMAL"){
        match=checkText(c.checker,observation.pipes.stdout,c.expected);verdict=match?"PASSED":"WRONG_ANSWER";
      }
    }
    const stdout=observation?.pipes.stdout??Buffer.alloc(0),stderr=observation?.pipes.stderr??Buffer.alloc(0);
    const capture=(bytes:Buffer,limit:number,truncated:boolean)=>({bytes:bytes.length,sha256:sha256(bytes).toString("hex"),
      prefix_b64:bytes.subarray(0,limit).toString("base64"),truncated:truncated||bytes.length>limit});
    const evidence={batch_id:batch.batchId,batch_digest:identity.digest,case_id:c.caseId,attempt_id:c.payload.attemptId,
      check_id:c.payload.checkId,position:c.position,payload_digest:authoringPayloadDigest(c.payload).toString("hex"),
      stdin_sha256:sha256(c.payload.stdin).toString("hex"),expected_sha256:sha256(c.expected).toString("hex"),checker_mode:c.checker,
      compile_origin:compiler===null?null:batch.batchId,artifact_sha256:artifact,run,verdict,output_match:match,
      stdout:capture(stdout,16384,!(observation?.pipes.stdoutComplete??true)),stderr:capture(stderr,4096,observation?.pipes.stderrTruncated??false)};
    // A completed observation is retained even if cancellation arrives immediately after it.
    await session.record(key,evidence);result[key]=evidence;
    if(verdict==="INFRA_ERROR")throw new Error("Batch case infrastructure fault; preserve completed cases and its physical hold.");
  }
  const evidence={protocol:"ingenium-participant-batch-result-v1",batch_id:batch.batchId,batch_digest:identity.digest,
    host_epoch_id:batch.hostEpochId,run_id:batch.runId,runtime_digest:first.runtimeDigest,source_sha256:sha256(first.source).toString("hex"),
    compile:compiler,artifact_sha256:artifact,cases:result,drain:null};
  if(Buffer.byteLength(judgeJson(evidence))>JUDGE_BODY_LIMIT)throw new Error("Batch result exceeds its bound; preserve original work.");
  return evidence;
}
