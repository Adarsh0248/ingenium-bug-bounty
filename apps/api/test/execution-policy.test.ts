import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { sha256 } from "../src/access/credentials.js";
import { acceptAuthoringObservation,authoringPayloadDigest } from "../src/content/execution-policy.js";
import type { AuthoringPayload } from "../src/content/execution-policy.js";

function payload():AuthoringPayload{return {attemptId:randomUUID(),hostEpochId:randomUUID(),runId:randomUUID(),checkId:randomUUID(),runtimeKey:"synthetic-cpp",runtimeDigest:"a".repeat(64),language:"cpp",
  sourceRole:"REFERENCE",checkType:"TEST_CASE",source:Buffer.from("\ufeffsynthetic\0\r\n"),stdin:Buffer.from(""),cpuMs:1000,wallMs:5000,memoryKb:262144};}
function observation(p:AuthoringPayload,stdout=Buffer.from("12\n")){
  return {state:"FINISHED",attempt_id:p.attemptId,host_epoch_id:p.hostEpochId,payload_digest:authoringPayloadDigest(p).toString("hex"),runtime_digest:p.runtimeDigest,
    source_sha256:sha256(p.source).toString("hex"),stdin_sha256:sha256(p.stdin).toString("hex"),evidence_digest:"b".repeat(64),execution_result:"NORMAL",stdout,stdout_complete:true,
    stderr:Buffer.from(""),stderr_truncated:false,compiler_output:Buffer.from(""),compiler_output_truncated:false,cpu_ns:"10000",peak_bytes:"4096",drain:{cannot_start:true,processes_stopped:true,workspace_removed:true,proof_digest:"c".repeat(64)}};
}
test("authoring payload identity binds exact source/input, runtime/limits, frozen check and unique attempt, but contains no expected output",()=>{
  const p=payload(),digest=authoringPayloadDigest(p);assert.equal(digest.length,32);assert.equal("expected_output" in p,false);
  for(const changed of [{attemptId:randomUUID()},{hostEpochId:randomUUID()},{runtimeKey:"other"},{wallMs:5001},{source:Buffer.from("synthetic")},{stdin:Buffer.from("\0")},{sourceRole:"STARTER" as const}])assert.notDeepEqual(authoringPayloadDigest({...p,...changed}),digest);
});
test("only complete normally finished stdout reaches the frozen checker; provider success labels never mean acceptance",()=>{
  const p=payload();assert.equal(acceptAuthoringObservation(p,{state:"PENDING"},Buffer.from("12\n"),"EXACT_TEXT"),null);
  const exact=observation(p);assert.equal(acceptAuthoringObservation(p,exact,Buffer.from("12\n"),"EXACT_TEXT")!.result,"PASSED");
  assert.equal(acceptAuthoringObservation(p,exact,Buffer.from("12"),"EXACT_TEXT")!.result,"WRONG_ANSWER");
  assert.equal(acceptAuthoringObservation(p,exact,Buffer.from("12"),"TOKENS")!.result,"PASSED");
  assert.equal(acceptAuthoringObservation(p,observation(p,Buffer.from([255])),Buffer.from(""),"TOKENS")!.result,"WRONG_ANSWER");
  assert.throws(()=>acceptAuthoringObservation(p,{...exact,stdout_complete:false},Buffer.from("12\n"),"EXACT_TEXT"));
  assert.throws(()=>acceptAuthoringObservation(p,{...exact,execution_result:"Accepted"},Buffer.from("12\n"),"EXACT_TEXT"));
});
test("evidence from a foreign attempt/host/source/runtime or malformed counters is unusable, not a code failure",()=>{
  const p=payload(),v=observation(p);
  for(const changed of [{attempt_id:randomUUID()},{host_epoch_id:randomUUID()},{runtime_digest:"f".repeat(64)},{payload_digest:"f".repeat(64)},{source_sha256:"f".repeat(64)},
    {stdin_sha256:"f".repeat(64)},{cpu_ns:"1.5"},{peak_bytes:"9223372036854775808"},{cpu_ns:12},{evidence_digest:"not-a-digest"},{extra:true},{stderr_truncated:null},
    {stderr:Buffer.alloc(65537)},{compiler_output:Buffer.alloc(65537)},{stdout:Buffer.alloc(1048578)}])assert.throws(()=>acceptAuthoringObservation(p,{...v,...changed},Buffer.from("12\n"),"TOKENS"));
});
test("logical results do not imply physical drain, and every positive release condition is mandatory",()=>{
  const p=payload(),v=observation(p);
  const held=acceptAuthoringObservation(p,{...v,drain:null},Buffer.from("12\n"),"EXACT_TEXT")!;assert.equal(held.result,"PASSED");assert.equal(held.release,null);
  for(const changed of [{cannot_start:false},{processes_stopped:false},{workspace_removed:false},{proof_digest:"invalid"},{extra:true}])assert.throws(()=>acceptAuthoringObservation(p,{...v,drain:{...v.drain,...changed}},Buffer.from("12\n"),"TOKENS"));
  assert.equal(acceptAuthoringObservation(p,v,Buffer.from("12\n"),"TOKENS")!.release!.length,32);
});
test("bounded private evidence retains only a labelled stdout prefix, including for overflow/compilation/infrastructure observations",()=>{
  const p=payload(),v=observation(p,Buffer.alloc(1048577,65));
  const overflow=acceptAuthoringObservation(p,{...v,execution_result:"OUTPUT_LIMIT_EXCEEDED",stdout_complete:false},Buffer.from(""),"TOKENS")!;
  assert.equal(overflow.result,"OUTPUT_LIMIT_EXCEEDED");assert.equal(overflow.stdoutPrefix.length,16384);assert.equal(overflow.metadata.stdout_bytes,1048577);
  for(const kind of ["COMPILATION_ERROR","RUNTIME_ERROR","TIME_LIMIT_EXCEEDED","MEMORY_LIMIT_EXCEEDED","INFRA_ERROR"])assert.equal(acceptAuthoringObservation(p,{...v,execution_result:kind,stdout_complete:false},Buffer.from(""),"TOKENS")!.result,kind);
  const compile={...p,checkType:"COMPILATION" as const};assert.equal(acceptAuthoringObservation(compile,observation(compile,Buffer.from("")),Buffer.from("not used"),"EXACT_TEXT")!.result,"PASSED");
});
