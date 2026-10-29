import assert from "node:assert/strict";
import { randomBytes,randomUUID } from "node:crypto";
import { setTimeout } from "node:timers/promises";
import type { TestContext } from "node:test";
import { Pool } from "pg";
import { LANGUAGES,sha256 } from "../../src/access/credentials.js";
import type { SessionDelivery } from "../../src/access/credentials.js";
import { AccessError } from "../../src/access/transaction.js";
import type { ClockGuard } from "../../src/access/transaction.js";
import { createValidationRunService } from "../../src/content/validation-runs.js";
import { createValidationWorker,expireValidationRuns } from "../../src/content/validation-worker.js";
import { authoringPayloadDigest } from "../../src/content/execution-policy.js";
import type { AuthoringPayload,TrustedAuthoringDriver } from "../../src/content/execution-policy.js";
import { acceptJudgeReply } from "../../src/content/judge-protocol.js";
import { judgeReply } from "../fixtures/judge.js";
import { buildApp } from "../../src/app.js";
import { browserPolicy } from "../../src/access/browser-policy.js";
import { assertWorkerDatabase,startJudgingWorker } from "../../src/worker/judging.js";
import { validationDiagnosticChecks } from "./validation-diagnostic.checks.js";

interface Person {id:string;code:string;sessionCookie:string;session:{session_id:string};}
export async function validationRunChecks(t:TestContext,owner:Pool,api:Pool,clock:ClockGuard,delivery:SessionDelivery,person:(role?:string)=>Promise<Person>,snapshotId:string,expected:string){
  const service=createValidationRunService(api,clock,delivery),hostEpochId=randomUUID();
  const snapshot=(await owner.query("SELECT * FROM validation_snapshots WHERE id=$1",[snapshotId])).rows[0];
  const denied=(code:string)=>(e:unknown)=>e instanceof AccessError && e.code===code;
  const input=()=>({snapshotId,expectedRevision:snapshot.content_revision as string,requestKey:randomUUID(),reason:"Synthetic execution lifecycle"});
  let mode="NORMAL",targetCheck:string|undefined,ready=true,sends=0,sendHook:((p:AuthoringPayload)=>Promise<void>)|undefined;
  const saved=new Map<string,ReturnType<typeof result>>();
  function result(p:AuthoringPayload,kind="NORMAL",drained=true){
    const stdout=Buffer.from(p.sourceRole==="REFERENCE"?expected:"synthetic wrong output");
    return {state:"FINISHED",attempt_id:p.attemptId,host_epoch_id:p.hostEpochId,payload_digest:authoringPayloadDigest(p).toString("hex"),runtime_digest:p.runtimeDigest,
      source_sha256:sha256(p.source).toString("hex"),stdin_sha256:sha256(p.stdin).toString("hex"),evidence_digest:sha256(`synthetic-only:${p.attemptId}:${kind}`).toString("hex"),execution_result:kind,
      stdout,stdout_complete:true,stderr:Buffer.alloc(0),stderr_truncated:false,compiler_output:Buffer.alloc(0),compiler_output_truncated:false,cpu_ns:"10000",peak_bytes:"4096",
      drain:drained?{cannot_start:true,processes_stopped:true,workspace_removed:true,proof_digest:sha256(`synthetic-drain:${p.attemptId}`).toString("hex")}:null};
  }
  const runtimeRows=(await owner.query(`SELECT v.language,v.runtime_key,m.digest FROM validation_snapshot_variants v JOIN runtime_manifests m ON m.key=v.runtime_key AND m.language=v.language WHERE v.snapshot_id=$1`,[snapshotId])).rows;
  const driver:TrustedAuthoringDriver={hostEpochId,endpointRef:"synthetic-test-only",runtimes:new Map(runtimeRows.map(r=>[r.language,{key:r.runtime_key,digest:r.digest.toString("hex")}])),
    async assertReady(){if(!ready)throw new Error("Synthetic runner unavailable");},
    async submit(p){
      sends++;assert.equal("expected_output" in p,false);await sendHook?.(p);
      if(mode==="PENDING")return {state:"PENDING"};
      if(!targetCheck && ["INFRA","FAIL_REFERENCE"].includes(mode))targetCheck=p.checkId;
      const kind=mode==="INFRA" && targetCheck===p.checkId?"INFRA_ERROR":"NORMAL";
      const observation=result(p,kind,!(mode==="HOLD" && targetCheck===p.checkId));
      if(mode==="DIAGNOSTIC"){
        observation.stdout=Buffer.alloc(16385,120);
        observation.stderr=Buffer.concat([Buffer.from('\ufeff<script>window.diagnosticExecuted=true</script>\0\r\n'),Buffer.alloc(65536,101)]).subarray(0,65536);
        observation.compiler_output=Buffer.concat([Buffer.from('Synthetic private compiler diagnostic\r\n'),Buffer.alloc(65536,99)]).subarray(0,65536);
        observation.stderr_truncated=true;observation.compiler_output_truncated=true;
      }
      if(mode==="WIRE"){
        const nonce=randomUUID();return acceptJudgeReply(judgeReply(p,nonce,observation.stdout),p,nonce,201);
      }
      if(mode==="FAIL_REFERENCE" && p.checkId===targetCheck)observation.stdout=Buffer.from("synthetic incorrect reference");
      saved.set(p.attemptId,observation);
      if(mode==="PIPELINE")return {state:"PENDING"};
      if(mode==="LOST_REPLY"){mode="NORMAL";throw new Error("Synthetic lost POST reply");}
      return observation;
    },async observe(p){return saved.get(p.attemptId)??{state:"PENDING"};}};
  let worker=createValidationWorker(api,clock,driver),lastRun="";
  async function start(){
    const actor=await person();
    const outcome=await service.admit(actor.sessionCookie,input());assert.equal(outcome.outcome,"ADMITTED");lastRun=outcome.run_id!;return lastRun;
  }
  async function finish(runId:string){
    for(let i=0;i<100;i++){
      const state=(await owner.query("SELECT status FROM validation_runs WHERE id=$1",[runId])).rows[0].status;
      if(!["QUEUED","RUNNING"].includes(state))return state as string;
      const tick=await worker.tick();if(tick==="IDLE")await setTimeout(250);
    }throw new Error("Synthetic validation did not complete within its bounded test loop");
  }
  async function observeTick(){
    for(let i=0;i<70;i++){const state=await worker.tick();if(state!=="IDLE")return state;await setTimeout(100);}
    throw new Error("Synthetic observation did not become due");
  }
  async function expireAtDeadline(runId:string){
    const client=await owner.connect();try{
      await client.query("BEGIN");await client.query("SELECT * FROM lock_validation_judge()");
      // Owner-only helper exercises the exact boundary without changing the host clock or production policy.
      await client.query("SELECT refresh_validation_run(id,deadline_at) FROM validation_runs WHERE id=$1",[runId]);await client.query("COMMIT");
    }catch(e){await client.query("ROLLBACK");throw e;}finally{client.release();}
  }
  await t.test("validation admission without a registered live worker refuses before admission and leaves no outcome or reserved jobs",async()=>{
    const actor=await person(),command=input();
    await assert.rejects(service.admit(actor.sessionCookie,command),denied("REQUEST_CAPACITY_UNAVAILABLE"));
    assert.equal((await service.outcome(actor.sessionCookie,snapshotId,command.requestKey)).status,"NOT_OBSERVED");
    assert.equal((await owner.query("SELECT count(*)::integer AS n FROM validation_runs")).rows[0].n,0);
    assert.equal((await owner.query("SELECT count(*)::integer AS n FROM authoring_checks")).rows[0].n,0);
    await assert.rejects(service.admit((await person("ORGANISER")).sessionCookie,command),denied("REQUEST_CAPACITY_UNAVAILABLE"));
  });
  await t.test("a compatible trusted driver acquires one worker lease; readiness/profile mismatches cannot create a runnable binding",async()=>{
    await owner.query("INSERT INTO judge_host_epochs(id,state,endpoint_ref,created_at) VALUES($1,'ACTIVE',$2,date_trunc('milliseconds',clock_timestamp()))",[hostEpochId,driver.endpointRef]);
    for(const language of LANGUAGES)await owner.query("INSERT INTO judge_host_runtimes(host_epoch_id,language,runtime_key) VALUES($1,$2,$3)",[hostEpochId,language,driver.runtimes.get(language)!.key]);
    ready=false;await assert.rejects(worker.claim());ready=true;
    const bad=createValidationWorker(api,clock,{...driver,runtimes:new Map([...driver.runtimes].map(([k,v])=>[k,{...v,digest:"0".repeat(64)}]))});await assert.rejects(bad.claim(),denied("SECURITY_UNAVAILABLE"));
    assert.equal(await worker.claim(),true);assert.equal(await createValidationWorker(api,clock,driver).claim(),false);
  });
  await t.test("one full plan is admitted once across duplicate/restarted requests; a lost POST reply is looked up without another send",async()=>{
    const actor=await person(),command=input();
    const replies=await Promise.all([service.admit(actor.sessionCookie,command),service.admit(actor.sessionCookie,command)]);assert.deepEqual(replies[0],replies[1]);
    const runId=replies[0]!.run_id!;lastRun=runId;
    assert.deepEqual(await createValidationRunService(api,clock,delivery).admit(actor.sessionCookie,command),replies[0]);
    await assert.rejects(service.admit(actor.sessionCookie,{...command,reason:"Changed intent"}),denied("INTENT_CONFLICT"));
    await assert.rejects(service.admit(actor.sessionCookie,input()),denied("REQUEST_CAPACITY_UNAVAILABLE"));
    const initial=(await owner.query("SELECT *,extract(epoch FROM deadline_at-created_at)::integer AS budget FROM validation_runs WHERE id=$1",[runId])).rows[0];
    assert.equal(initial.check_count,15);assert.equal(initial.budget,600);assert.equal(initial.status,"QUEUED");assert.equal(initial.started_at,null);
    mode="LOST_REPLY";assert.equal(await worker.tick(),"UNCERTAIN");
    const originalAttempt=(await owner.query("SELECT a.id FROM authoring_attempts a JOIN authoring_checks c ON c.id=a.check_id WHERE c.run_id=$1",[runId])).rows[0].id;
    assert.equal(await observeTick(),"OBSERVED");
    assert.equal(await finish(runId),"PASSED");
    const report=await service.report(actor.sessionCookie,runId);assert.equal(report.physical_pending,false);assert.equal(report.can_publish,false);assert.ok(report.checks.every(c=>c.attempts===1));
    assert.deepEqual(report.configuration_fingerprint,snapshot.fingerprint.toString("hex"));
    assert.equal((await owner.query("SELECT count(*)::integer AS n FROM authoring_attempts a JOIN authoring_checks c ON c.id=a.check_id WHERE c.run_id=$1",[runId])).rows[0].n,15);
    assert.ok((await owner.query("SELECT released_at FROM authoring_attempts WHERE id=$1",[originalAttempt])).rows[0].released_at);
    assert.equal((await owner.query("SELECT publication_status FROM bug_versions WHERE id=$1",[snapshot.version_id])).rows[0].publication_status,"DRAFT");
    assert.doesNotMatch(JSON.stringify(report),/private expected|private source|compiler_output|stdout_prefix|endpoint_ref/);
  });
  await t.test("independent authoring checks use both slots while original pending attempts keep their identity and polling backoff",async()=>{
    mode="PIPELINE";const run=await start(),before=sends;
    assert.equal(await worker.tick(),'PENDING');assert.equal(await worker.tick(),'PENDING');
    const pending=(await owner.query("SELECT a.id,a.check_id FROM authoring_attempts a JOIN authoring_checks c ON c.id=a.check_id WHERE c.run_id=$1 AND a.released_at IS NULL",[run])).rows;
    assert.equal(pending.length,2);assert.equal(new Set(pending.map(r=>r.check_id)).size,2);assert.equal(sends,before+2);
    assert.equal((await owner.query('SELECT count(*)::int n FROM execution_capacity_slots WHERE authoring_attempt_id IS NOT NULL')).rows[0].n,2);
    mode='NORMAL';assert.equal(await finish(run),'PASSED');
    assert.equal((await owner.query('SELECT max(a.number)::int n FROM authoring_attempts a JOIN authoring_checks c ON c.id=a.check_id WHERE c.run_id=$1',[run])).rows[0].n,1);
  });
  await t.test("reliable reference failure is FAILED, never retried, and the other language checks still finish",async()=>{
    mode="FAIL_REFERENCE";targetCheck=undefined;const run=await start();assert.equal(await finish(run),"FAILED");
    const rows=(await owner.query("SELECT result,(SELECT count(*)::integer FROM authoring_attempts a WHERE a.check_id=c.id) AS n FROM authoring_checks c WHERE run_id=$1",[run])).rows;
    assert.equal(rows.filter(c=>c.result==="WRONG_ANSWER").length,6);assert.ok(rows.every(c=>c.n===1));
  });
  await t.test("infrastructure retries keep the frozen run and use the two/five-second delays with three sends maximum",async()=>{
    mode="INFRA";targetCheck=undefined;const run=await start();assert.equal(await finish(run),"INFRA_ERROR");
    const attempts=(await owner.query("SELECT number,send_started_at,resolved_at,result FROM authoring_attempts WHERE check_id=$1 ORDER BY number",[targetCheck])).rows;
    assert.deepEqual(attempts.map(a=>a.number),[1,2,3]);assert.ok(attempts.every(a=>a.result==="INFRA_ERROR"));
    assert.ok(attempts[1].send_started_at.getTime()-attempts[0].resolved_at.getTime()>=2000);assert.ok(attempts[2].send_started_at.getTime()-attempts[1].resolved_at.getTime()>=5000);
    assert.equal((await owner.query("SELECT count(*)::integer AS n FROM authoring_checks WHERE run_id=$1 AND result IS NULL",[run])).rows[0].n,0);
  });
  await t.test("logical success with incomplete cleanup retains its physical slot and blocks a new validation until matching drain proof arrives",async()=>{
    mode="HOLD";const run=await start();targetCheck=(await owner.query("SELECT c.id FROM authoring_checks c JOIN validation_snapshot_checks p ON p.id=c.snapshot_check_id WHERE c.run_id=$1 ORDER BY p.position DESC LIMIT 1",[run])).rows[0].id;
    assert.equal(await finish(run),"PASSED");const actor=await person();assert.equal((await service.report(actor.sessionCookie,run)).physical_pending,true);
    await assert.rejects(service.admit(actor.sessionCookie,input()),denied("REQUEST_CAPACITY_UNAVAILABLE"));
    const attempt=(await owner.query("SELECT id FROM authoring_attempts WHERE check_id=$1",[targetCheck])).rows[0].id,observation=saved.get(attempt)!;
    observation.drain={cannot_start:true,processes_stopped:true,workspace_removed:true,proof_digest:sha256(`synthetic-drain:${attempt}`).toString("hex")};
    assert.equal(await observeTick(),"OBSERVED");assert.equal((await service.report(actor.sessionCookie,run)).physical_pending,false);
    assert.equal((await owner.query("SELECT active_validation_id FROM judge_control")).rows[0].active_validation_id,null);
  });
  await t.test("an expired old sender cannot settle; its successor only observes the original attempt even if the old POST resumes late",async()=>{
    mode="NORMAL";const run=await start();let entered!:()=>void,release!:()=>void;
    const reached=new Promise<void>(resolve=>{entered=resolve;}),barrier=new Promise<void>(resolve=>{release=resolve;});
    sendHook=async()=>{entered();await barrier;};
    const oldTick=worker.tick();await reached;
    try{
      await owner.query("UPDATE judge_control SET lease_until=date_trunc('milliseconds',clock_timestamp())-interval '1 millisecond' WHERE id=1");
      const successor=createValidationWorker(api,clock,driver);assert.equal(await successor.claim(),true);const count=sends;
      const oldWorker=worker;worker=successor;
      await setTimeout(550);
      assert.equal(await observeTick(),"PENDING");assert.equal(sends,count);
      release();await assert.rejects(oldTick,{code:"55000"});assert.notEqual(worker.workerId,oldWorker.workerId);
      const nextPoll=(await owner.query('SELECT min(a.next_poll_at) due FROM authoring_attempts a JOIN authoring_checks c ON c.id=a.check_id WHERE c.run_id=$1 AND a.released_at IS NULL',[run])).rows[0].due as Date;
      await setTimeout(Math.max(0,nextPoll.getTime()-Date.now()+25));
      assert.equal(await observeTick(),"OBSERVED");assert.equal(sends,count);assert.equal(await finish(run),"PASSED");
      assert.equal((await owner.query("SELECT max(number)::integer AS n FROM authoring_attempts a JOIN authoring_checks c ON c.id=a.check_id WHERE c.run_id=$1",[run])).rows[0].n,1);
    }finally{release();sendHook=undefined;await oldTick.catch(()=>{});}
  });
  await t.test("deadline expiry accounts for every unstarted check, and late drained results cannot turn a finished INFRA_ERROR into PASSED",async()=>{
    mode="NORMAL";const unstarted=await start(),before=sends;await expireAtDeadline(unstarted);
    assert.equal((await owner.query("SELECT status,started_at FROM validation_runs WHERE id=$1",[unstarted])).rows[0].status,"INFRA_ERROR");assert.equal(sends,before);
    assert.equal((await owner.query("SELECT count(*)::integer AS n FROM authoring_attempts a JOIN authoring_checks c ON c.id=a.check_id WHERE c.run_id=$1",[unstarted])).rows[0].n,0);
    mode="PENDING";const uncertain=await start();assert.equal(await worker.tick(),"PENDING");
    const a=(await owner.query("SELECT a.id,a.check_id FROM authoring_attempts a JOIN authoring_checks c ON c.id=a.check_id WHERE c.run_id=$1",[uncertain])).rows[0];
    await expireAtDeadline(uncertain);const final=(await owner.query("SELECT status,finished_at FROM validation_runs WHERE id=$1",[uncertain])).rows[0];
    assert.equal(final.status,"INFRA_ERROR");await assert.rejects(service.admit((await person()).sessionCookie,input()),denied("REQUEST_CAPACITY_UNAVAILABLE"));
    // The driver's saved late result remains bound to the original attempt and its positive drain evidence.
    mode="NORMAL";sendHook=undefined;
    const original=(await owner.query(`SELECT c.run_id,p.language,p.source_role,p.check_type,v.runtime_key,m.digest,v.starter_code,v.reference_code,v.cpu_ms,v.wall_ms,v.memory_kb,t.input_data
      FROM authoring_checks c JOIN validation_snapshot_checks p ON p.id=c.snapshot_check_id JOIN validation_snapshot_variants v ON v.snapshot_id=c.snapshot_id AND v.variant_id=p.variant_id
      JOIN runtime_manifests m ON m.key=v.runtime_key AND m.language=v.language LEFT JOIN validation_snapshot_cases t ON t.snapshot_id=c.snapshot_id AND t.case_id=p.case_id WHERE c.id=$1`,[a.check_id])).rows[0];
    const p:AuthoringPayload={attemptId:a.id,hostEpochId,runId:original.run_id,checkId:a.check_id,runtimeKey:original.runtime_key,runtimeDigest:original.digest.toString("hex"),language:original.language,
      sourceRole:original.source_role,checkType:original.check_type,source:original.source_role==="REFERENCE"?original.reference_code:original.starter_code,stdin:original.input_data??Buffer.alloc(0),cpuMs:original.cpu_ms,wallMs:original.wall_ms,memoryKb:original.memory_kb};
    saved.set(a.id,result(p));assert.equal(await observeTick(),"OBSERVED");
    assert.deepEqual((await owner.query("SELECT status,finished_at FROM validation_runs WHERE id=$1",[uncertain])).rows[0],final);
    assert.equal((await owner.query("SELECT count(*)::integer AS n FROM execution_capacity_slots WHERE authoring_attempt_id IS NOT NULL")).rows[0].n,0);
  });
  await t.test("execution history and reservations cannot be forged or rewritten by the API role, and retained byte totals stay exact",async()=>{
    for(const table of ["validation_runs","authoring_checks","authoring_attempts","judge_control","execution_capacity_slots","judge_host_epochs"]){await assert.rejects(api.query(`DELETE FROM ${table}`),{code:"42501"});}
    await assert.rejects(api.query("SELECT refresh_validation_run($1,clock_timestamp())",[lastRun]),{code:"42501"});
    await assert.rejects(owner.query("UPDATE authoring_attempts SET payload_digest=decode(repeat('ab',32),'hex')"),{code:"P0001"});
    await assert.rejects(owner.query("UPDATE validation_runs SET deadline_at=deadline_at+interval '1 minute'"),{code:"P0001"});
    await assert.rejects(owner.query("UPDATE validation_runs SET status='QUEUED' WHERE id=$1",[lastRun]),{code:"P0001"});
    await assert.rejects(owner.query("DELETE FROM validation_run_outcomes"),{code:"P0001"});
    assert.equal((await owner.query(`SELECT committed_bytes=(SELECT sum(n) FROM (SELECT content_bytes AS n FROM bug_versions UNION ALL SELECT content_bytes FROM validation_snapshots UNION ALL SELECT accounted_bytes FROM validation_runs) q) AS exact FROM catalogue_control`)).rows[0].exact,true);
    assert.equal((await owner.query("SELECT bool_and(accounted_bytes<524288+check_count::bigint*3*262144) AS released FROM validation_runs")).rows[0].released,true);
  });
  await t.test("decoded synthetic wire evidence is retained privately through real worker settlement without exposing provider identity in reports",async()=>{
    mode="WIRE";const run=await start();assert.equal(await finish(run),"PASSED");
    const rows=(await owner.query("SELECT a.evidence FROM authoring_attempts a JOIN authoring_checks c ON c.id=a.check_id WHERE c.run_id=$1",[run])).rows;
    assert.equal(rows.length,15);assert.ok(rows.every(r=>r.evidence.supervisor_evidence.protocol==="ingenium-authoring-v1"));
    assert.ok(rows.every(r=>r.evidence.supervisor_evidence.metadata.run.tree_accounted===true));
    const report=await service.report((await person()).sessionCookie,run);
    assert.doesNotMatch(JSON.stringify(report),/provider_token|supervisor_evidence|payload_digest/);mode="NORMAL";
  });
  if([undefined,"worker-validation","diagnostics","diagnostics-browser"].includes(process.env.INGENIUM_TEST_SUITE)){
    mode="DIAGNOSTIC";const run=await start();await finish(run);
    mode="PENDING";const pendingRun=await start();await worker.tick();
    const pendingAttempt=(await owner.query("SELECT a.id FROM authoring_attempts a JOIN authoring_checks c ON c.id=a.check_id WHERE c.run_id=$1",[pendingRun])).rows[0].id;
    await validationDiagnosticChecks(t,{owner,api,clock,delivery,person,run,version:snapshot.version_id,pendingRun,pendingAttempt});
    assert.equal(await worker.claim(),true);
    await expireAtDeadline(pendingRun);
    mode="NORMAL";
    const pending=(await owner.query(`SELECT c.run_id,p.language,p.source_role,p.check_type,v.runtime_key,m.digest,v.starter_code,v.reference_code,v.cpu_ms,v.wall_ms,v.memory_kb,t.input_data,c.id AS check_id
      FROM authoring_attempts a JOIN authoring_checks c ON c.id=a.check_id JOIN validation_snapshot_checks p ON p.id=c.snapshot_check_id JOIN validation_snapshot_variants v ON v.snapshot_id=c.snapshot_id AND v.variant_id=p.variant_id
      JOIN runtime_manifests m ON m.key=v.runtime_key AND m.language=v.language LEFT JOIN validation_snapshot_cases t ON t.snapshot_id=c.snapshot_id AND t.case_id=p.case_id WHERE a.id=$1`,[pendingAttempt])).rows[0];
    const p:AuthoringPayload={attemptId:pendingAttempt,hostEpochId,runId:pending.run_id,checkId:pending.check_id,runtimeKey:pending.runtime_key,runtimeDigest:pending.digest.toString("hex"),language:pending.language,sourceRole:pending.source_role,checkType:pending.check_type,
      source:pending.source_role==="REFERENCE"?pending.reference_code:pending.starter_code,stdin:pending.input_data??Buffer.alloc(0),cpuMs:pending.cpu_ms,wallMs:pending.wall_ms,memoryKb:pending.memory_kb};
    saved.set(pendingAttempt,result(p));await observeTick();sendHook=undefined;
  }
  await t.test("judge clock reversal latches a fault and expiry maintenance needs no connected runner",async()=>{
    ready=false;await expireValidationRuns(api,clock);ready=true;
    const previous=(await owner.query("SELECT trusted_time_at FROM judge_control WHERE id=1")).rows[0].trusted_time_at;
    const faults:string[]=[],guard:ClockGuard={assertHealthy:()=>clock.assertHealthy(),verify:client=>clock.verify(client),fault:reason=>{faults.push(reason);clock.fault(reason);}};
    await owner.query("UPDATE judge_control SET trusted_time_at=date_trunc('milliseconds',clock_timestamp())+interval '1 minute' WHERE id=1");
    try{await assert.rejects(expireValidationRuns(api,guard),denied("CLOCK_UNTRUSTED"));assert.deepEqual(faults,["CLOCK_REVERSED"]);}
    finally{await owner.query("UPDATE judge_control SET trusted_time_at=$1 WHERE id=1",[previous]);}
  });
  const settings={mode:"production" as const,origin:"https://ingenium.test",cookieKey:randomBytes(32),csrfKey:randomBytes(32)},policy=browserPolicy(settings);
  const app=buildApp({database:{async check(){},async close(){}},entry:{pool:api,clock,delivery,browser:settings}});await app.ready();
  async function browser(actor:Person){
    const cookies=new Map<string,string>();
    async function send(url:string,body?:unknown,token?:string){
      const response=await app.inject({method:body===undefined?"GET":"POST",url,headers:{origin:settings.origin,cookie:[...cookies].map(([k,v])=>`${k}=${v}`).join(";"),...(body===undefined?{}:{"content-type":"application/json"}),...(token?{"x-csrf-token":token}:{})},...(body===undefined?{}:{payload:JSON.stringify(body)})});
      const lines=response.headers["set-cookie"];for(const line of typeof lines==="string"?[lines]:lines??[]){const pair=line.split(";")[0]!,i=pair.indexOf("=");cookies.set(pair.slice(0,i),pair.slice(i+1));}return response;
    }
    await send("/api/v1/bootstrap?audience=ANONYMOUS");cookies.set(policy.names.staff,actor.sessionCookie);
    const bootstrap=await send("/api/v1/bootstrap?audience=STAFF");assert.equal(bootstrap.statusCode,200);return {send,token:bootstrap.json().data.csrf_token as string};
  }
  try{await t.test("validation HTTP has staff-only exact bodies/CSRF, immutable own receipts and source-free audited progress reports",async()=>{
    mode="NORMAL";const actor=await person(),client=await browser(actor),command=input(),url=`/api/v1/staff/content/validation-snapshots/${snapshotId}/runs`;
    const body={request_key:command.requestKey,expected_revision:command.expectedRevision,reason:command.reason};
    assert.equal((await client.send(url,body)).statusCode,403);assert.equal((await client.send(url,{...body,status:"PASSED"},client.token)).statusCode,400);
    const response=await client.send(url,body,client.token);assert.equal(response.statusCode,200,response.body);const run=response.json().data.run_id;
    const observed=await client.send(`/api/v1/staff/outcomes/validation-run/${snapshotId}/${body.request_key}`);assert.deepEqual(observed.json().data.outcome,response.json().data);
    assert.equal(await finish(run),"PASSED");
    const report=await client.send(`/api/v1/staff/content/validation-runs/${run}`);assert.equal(report.statusCode,200,report.body);assert.equal(report.json().data.checks.length,15);assert.equal(report.headers["cache-control"],"no-store");
    assert.doesNotMatch(report.body,/private expected|private source|endpoint_ref|compiler_output|stdout_prefix|credential_id/);
    const organiser=await browser(await person("ORGANISER"));assert.equal((await organiser.send(`/api/v1/staff/content/validation-runs/${run}`)).statusCode,200);
    assert.equal((await organiser.send(url,{...body,expected_revision:"999999"},organiser.token)).statusCode,409);
    assert.equal((await owner.query("SELECT count(*)::integer AS n FROM validation_run_audits WHERE run_id=$1",[run])).rows[0].n,2);
  });}finally{await app.close();}
  await t.test("separate restricted automatic worker completes all five-language validation checks without manual ticks",async()=>{
    mode="NORMAL";ready=true;sendHook=undefined;
    await owner.query("UPDATE judge_control SET lease_until=date_trunc('milliseconds',clock_timestamp())-interval '1 millisecond' WHERE id=1");
    const pool=new Pool({connectionString:owner.options.connectionString!,options:"-c role=ingenium_app_worker",max:4});
    await assertWorkerDatabase(pool);
    let failure=false;
    const runtime=startJudgingWorker(pool,clock,driver,()=>{failure=true;});
    try{
      const deadline=Date.now()+20000;
      while((await owner.query("SELECT worker_id FROM judge_control WHERE id=1")).rows[0].worker_id!==runtime.workerId){assert.ok(Date.now()<deadline);await setTimeout(50);}
      const run=await start();
      while((await owner.query("SELECT status FROM validation_runs WHERE id=$1",[run])).rows[0].status!=="PASSED"){assert.ok(Date.now()<deadline);await setTimeout(50);}
      assert.equal(failure,false);
      assert.equal((await owner.query("SELECT count(*)::int n FROM authoring_checks WHERE run_id=$1 AND result IS NOT NULL",[run])).rows[0].n,15);
      assert.equal((await owner.query("SELECT count(*)::int n FROM execution_capacity_slots WHERE authoring_attempt_id IS NOT NULL")).rows[0].n,0);
    }finally{await runtime.close();await pool.end();}
  });
}
