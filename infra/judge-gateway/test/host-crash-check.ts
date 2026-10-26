import assert from "node:assert/strict";
import {execFile} from "node:child_process";
import {randomUUID} from "node:crypto";
import {constants} from "node:fs";
import {mkdir,open,readFile} from "node:fs/promises";
import {hostname} from "node:os";
import {setTimeout as delay} from "node:timers/promises";
import {promisify} from "node:util";
import {Pool} from "pg";
import {sha256} from "../../../apps/api/src/access/credentials.js";
import {authoringPayloadDigest} from "../../../apps/api/src/content/execution-policy.js";
import type {AuthoringPayload} from "../../../apps/api/src/content/execution-policy.js";
import {judgeJson,readJudgeJson} from "../../../apps/api/src/content/judge-protocol.js";
import {rootRuntimeJson} from "../../../apps/api/src/runtime/private-file.js";
import {openExecutionCheckpoints} from "../../../apps/api/src/judge/checkpoints.js";
import {createExecutionPlan} from "../../../apps/api/src/judge/execution-plan.js";
import {acceptExecutionReply,createProtectedExecutorClient,exchangeProtectedProcess,executionRequest} from "../../../apps/api/src/judge/executor.js";
import {parseHostRuntime} from "../../../apps/api/src/judge/host-config.js";
import {createJudgeRegistry,createJudgeSupervisorStore} from "../../../apps/api/src/judge/registry.js";
import {openSupervisorSession} from "../../../apps/api/src/judge/supervisor.js";

let directory="",stage="caller";
const pools:Pool[]=[];
let session:Awaited<ReturnType<typeof openSupervisorSession>>|undefined,checkpoints:Awaited<ReturnType<typeof openExecutionCheckpoints>>|undefined;
try{
  assert.equal(process.argv.length,2);assert.equal(process.platform,"linux");assert.equal(process.getuid?.(),0);assert.equal(hostname(),"ingenium-judge-verification-01");process.umask(0o077);
  const settings=parseHostRuntime(await rootRuntimeJson("/etc/ingenium/judge-launcher.json",4194304));
  assert.equal(settings.hostEpochId,"3ced2a8c-8d52-4167-99b3-903b9bb5d24d");
  assert.equal(settings.bootId,(await readFile("/proc/sys/kernel/random/boot_id","ascii")).trim());
  directory=`/var/lib/ingenium/crash-rehearsal-${randomUUID()}`;await mkdir(directory,{mode:0o700});
  const save=async(name:string,value:unknown)=>{const f=await open(`${directory}/${name}`,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o400);try{await f.writeFile(JSON.stringify(value)+"\n");await f.sync();}finally{await f.close();}const d=await open(directory,constants.O_RDONLY|constants.O_DIRECTORY);try{await d.sync();}finally{await d.close();}};
  await save("intent",{boot_id:settings.bootId,host_epoch_id:settings.hostEpochId,event_deployed:false});
  const pool=(url:string)=>{const p=new Pool({connectionString:url,max:2,connectionTimeoutMillis:1000,query_timeout:5000});p.on("error",()=>{});pools.push(p);return p;};
  const runner=pool(settings.databaseUrl),store=createJudgeSupervisorStore(runner,settings);
  const context=`/var/lib/ingenium/candidate-rehearsal-${settings.hostEpochId}`;
  const secret=await rootRuntimeJson(`${context}/credential-ingenium_rehearsal_ingress_${settings.hostEpochId.replaceAll("-","").slice(0,12)}`,4096) as {secret:string};
  const url=new URL(settings.databaseUrl);url.username=url.username.replace("_runner_","_ingress_");url.password=secret.secret;
  const registry=createJudgeRegistry(pool(url.toString()),settings);
  assert.equal(await registry.ready(),false);assert.deepEqual(await store.held(),[]);
  session=await openSupervisorSession(runner,settings);
  const executor=createProtectedExecutorClient({...settings,launcherSha256:sha256(await readFile("/opt/ingenium/judge-executor/launch")).toString("hex")});
  stage="readiness";await session.heartbeat(await executor.readiness(AbortSignal.timeout(5000)),AbortSignal.timeout(5000));
  const runtime=settings.runtimes.get("c")!;
  const payload:AuthoringPayload={hostEpochId:settings.hostEpochId,attemptId:randomUUID(),runId:randomUUID(),checkId:randomUUID(),language:"c",runtimeKey:runtime.key,runtimeDigest:runtime.digest,sourceRole:"REFERENCE",checkType:"TEST_CASE",
    source:Buffer.from('#include <unistd.h>\n#include <sys/prctl.h>\nint main(void){if(getuid()!=60000||getgid()!=60000)return 23;if(prctl(PR_SET_NAME,"ingenium-crash",0,0,0))return 24;if(fork()<0)return 25;for(;;)pause();}\n'),stdin:Buffer.alloc(0),cpuMs:1000,wallMs:10000,memoryKb:524288};
  await save("payload",{attempt_id:payload.attemptId,payload_digest:authoringPayloadDigest(payload).toString("hex")});
  stage="admission";const providerToken=(await registry.admit(payload,randomUUID())).value.provider_token as string,claim={payload,providerToken,owner:randomUUID()};
  assert.ok(await store.claim(payload.attemptId,providerToken,claim.owner));await save("claim",{attempt_id:payload.attemptId,provider_token:providerToken,owner:claim.owner});
  const plan=createExecutionPlan(claim,settings.runtimes);checkpoints=await openExecutionCheckpoints(settings.hostEpochId,settings.bootId);
  const abort=new AbortController();stage="active-execution";
  const running=executor.exchange(executionRequest(claim,settings.bootId,settings.runtimes,"EXECUTE"),abort.signal).then(()=>"COMPLETED",()=>"INTERRUPTED");
  const exec=promisify(execFile),docker="/opt/ingenium/judge-executor/docker",end=performance.now()+60000;
  let container="",live=false;
  while(performance.now()<end){
    const found=(await exec(docker,["ps","-a","--no-trunc","--filter",`label=ingenium.executor.attempt=${payload.attemptId}`,"--format","{{.ID}}"],{timeout:3000,maxBuffer:8192})).stdout.trim();
    if(found){
      container=found;assert.match(container,/^[a-f0-9]{64}$/);
      if((await exec(docker,["inspect","--format","{{.State.Running}}",container],{timeout:3000,maxBuffer:8192})).stdout.trim()!=="true"){await delay(25);continue;}
      const result=await exec(docker,["top",container,"-eo","uid,pid,comm"],{timeout:3000,maxBuffer:8192});
      if(result.stdout.split("\n").filter(line=>/^\s*60000\s+[0-9]+\s+ingenium-crash\s*$/.test(line)).length===2){live=true;break;}
    }
    await delay(25);
  }
  assert.equal(live,true,"Two original sandbox processes were not observed.");
  await save("active",{container_id:container,observed_sandbox_processes:2});
  abort.abort();assert.equal(await running,"INTERRUPTED");
  const recover=executionRequest(claim,settings.bootId,settings.runtimes,"RECOVER");
  stage="read-only-recovery";assert.equal(acceptExecutionReply(await executor.exchange(recover,AbortSignal.timeout(10000)),claim,recover),null);
  const before=await store.execution(payload.attemptId);assert.ok(before?.started);assert.equal(before.evidence,null);assert.deepEqual(await store.held(),[payload.attemptId]);
  stage="explicit-retirement";
  const raw=await exchangeProtectedProcess({file:"/opt/ingenium/judge-executor/launch",args:["--retire"]},Buffer.from(judgeJson(recover)),AbortSignal.timeout(30000));
  assert.equal(acceptExecutionReply(readJudgeJson(raw),claim,recover),null);
  assert.deepEqual(await store.execution(payload.attemptId),before);
  const journal=await checkpoints.capsule(plan);assert.deepEqual(journal?.removed,{id:container});
  await assert.rejects(exec(docker,["inspect",container],{timeout:5000,maxBuffer:8192}));
  stage="duplicate-refusal";await assert.rejects(executor.exchange(executionRequest(claim,settings.bootId,settings.runtimes,"EXECUTE"),AbortSignal.timeout(10000)));
  assert.deepEqual(await store.execution(payload.attemptId),before);assert.deepEqual(await store.held(),[payload.attemptId]);
  await session.close();session=undefined;assert.equal(await registry.ready(),false);
  const report={scope:"INSTALLED_ACTIVE_CRASH_AND_EXPLICIT_RETIREMENT",attempt_id:payload.attemptId,observed_sandbox_processes:2,launcher_interrupted:true,readonly_recovery_without_verdict:true,duplicate_launch_refused:true,original_container_removed:true,original_permit_consumed:true,uncertain_result_still_held:true,no_participant_verdict_invented:true,event_deployed:false};
  await save("completed",report);console.log("PASS: installed active launcher interruption; read-only recovery, explicit original-ID retirement and duplicate refusal");console.log(JSON.stringify({...report,evidence:directory}));
}catch(error){console.error(`FAIL: installed crash ${stage}; preserve ${directory||"original context"}, permits and resources. ${error instanceof Error?error.name:"UnknownError"}`);process.exitCode=1;}
finally{await session?.close();await checkpoints?.close();for(const p of pools)await p.end();}
