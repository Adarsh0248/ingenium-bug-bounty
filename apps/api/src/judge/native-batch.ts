import {lstat} from "node:fs/promises";
import {authoringPayloadDigest} from "../content/execution-policy.js";
import {readParticipantBatch} from "../content/batch-protocol.js";
import type {JudgeRuntimes} from "../content/judge-protocol.js";
import {createExecutionPlan} from "./execution-plan.js";
import {runParticipantBatch} from "./batch-runner.js";
import {openBatchArtifact} from "./batch-artifact.js";
import type {ExecutionClaim} from "./executor.js";
import type {ExecutionCheckpoints,BatchPhaseKey} from "./checkpoints.js";
import {nativePhase} from "./isolate-backend.js";
import {executionEvidence,isolatePhaseEvidence} from "./isolate-evidence.js";
import type {IsolateObservation} from "./isolate-evidence.js";
import {prepareExecutionWorkspace} from "./workspace.js";

export async function executeNativeParticipantBatch(raw:Buffer,identity:{batchId:string;hostEpochId:string;digest:string},
  claim:ExecutionClaim,runtimes:JudgeRuntimes,checkpoints:ExecutionCheckpoints,signal:AbortSignal){
  const batch=readParticipantBatch(raw,identity,runtimes),first=batch.cases[0]!.payload;
  if(!authoringPayloadDigest(first).equals(authoringPayloadDigest(claim.payload))||checkpoints.hostEpochId!==first.hostEpochId)
    throw new Error("Batch carrier is not its exact original first case.");
  const plan=createExecutionPlan(claim,runtimes),workspace=await prepareExecutionWorkspace(plan,signal);
  let artifact:Awaited<ReturnType<typeof openBatchArtifact>>|undefined;
  const observations:{compile:IsolateObservation|null;run:IsolateObservation|null}={compile:null,run:null};
  async function assertStopped(){
    signal.throwIfAborted();
    for(const path of ['/var/local/lib/isolate/0','/run/ingenium/cgroups/memory/box-0','/run/ingenium/cgroups/cpuacct/box-0']){
      try{await lstat(path);throw new Error("Previous native phase still owns resources.");}
      catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
    }
  }
  try{
    const result=await runParticipantBatch(raw,identity,{owner:claim.owner,providerToken:claim.providerToken},runtimes,{
      async verifySource(){await workspace.verifyBeforeFirstPhase();},
      async compile(p,current){observations.compile=await nativePhase(p,'compile',checkpoints,current);return observations.compile;},
      async snapshotArtifact(current){artifact=await openBatchArtifact(plan,assertStopped,current);return artifact.digest;},
      async runCase(p,key,current){
        if(!artifact||!/^c(?:0[0-9]|1[0-9])$/.test(key))throw new Error("Original sealed batch artifact required.");
        await artifact.restoreCase(current);
        const observed=await nativePhase(p,'run',checkpoints,current,{original:plan,key:`b${key.slice(1)}` as BatchPhaseKey});
        if(key==='c00')observations.run=observed;return observed;
      },
      async record(key,value){
        const record=key==='compile'?'batch_compile':key==='artifact'?'batch_artifact':`b${key.slice(1)}_result` as `${BatchPhaseKey}_result`;
        await checkpoints.saveCapsule(plan,record,value);
      },
    },signal);
    await assertStopped();
    await checkpoints.saveCapsule(plan,'batch_result',result);
    const {compile,run}=observations;
    const evidence=executionEvidence(plan,compile?{phase:isolatePhaseEvidence(plan,'compile',compile),pipes:compile.pipes}:null,
      run?{phase:isolatePhaseEvidence(plan,'run',run),pipes:run.pipes}:null);
    return {evidence:await checkpoints.save(plan,evidence),batch:result};
  }finally{await artifact?.close();await workspace.close();}
}
