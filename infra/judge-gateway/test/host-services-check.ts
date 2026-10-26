import assert from "node:assert/strict";
import {randomBytes,randomUUID,X509Certificate} from "node:crypto";
import {constants} from "node:fs";
import {mkdir,open,readFile} from "node:fs/promises";
import {hostname} from "node:os";
import {setTimeout as delay} from "node:timers/promises";
import type {TestContext} from "node:test";
import {Pool} from "pg";
import {LANGUAGES,sha256} from "../../../apps/api/src/access/credentials.js";
import {rootRuntimeJson} from "../../../apps/api/src/runtime/private-file.js";
import {parseHostRuntime} from "../../../apps/api/src/judge/host-config.js";
import {JUDGE_DATABASE_POOLS} from "../../../apps/api/src/judge/database-role.js";
import {createJudgeRegistry,createJudgeSupervisorStore,createJudgePublisherStore} from "../../../apps/api/src/judge/registry.js";
import {createProtectedExecutorClient} from "../../../apps/api/src/judge/executor.js";
import {createJudgeQueue} from "../../../apps/api/src/judge/queue.js";
import {openSupervisorSession,startJudgeSupervisor} from "../../../apps/api/src/judge/supervisor.js";
import {buildJudgeGateway} from "../../../apps/api/src/judge/gateway.js";
import {createAuthoringJudgeDriver} from "../../../apps/api/src/content/judge-driver.js";
import {acceptAuthoringObservation} from "../../../apps/api/src/content/execution-policy.js";
import type {AuthoringPayload} from "../../../apps/api/src/content/execution-policy.js";
import {FIXED_HOST_SOURCES} from "../../../apps/api/test/fixtures/host-executions.js";
import {HOST_FAILURE_CASES} from "../../../apps/api/test/fixtures/host-failures.js";
import {createTestRedis} from "../../../apps/api/test/fixtures/redis.js";
import {createTestTls} from "../../../apps/api/test/fixtures/tls.js";

const pools:Pool[]=[],cleanups:(()=>Promise<void>)[]=[];
let stage="caller",directory="",redis:Awaited<ReturnType<typeof createTestRedis>>|undefined,
  service:Awaited<ReturnType<typeof startJudgeSupervisor>>|undefined,gateway:ReturnType<typeof buildJudgeGateway>|undefined,completed=false,readinessObservations=0,peakReadinessMs=0;
try{
  const endurance=process.argv[2]==="--endurance";
  const bridge=process.argv[2]==="--bridge";
  const capacity=process.argv[2]==="--capacity";
  assert.equal(process.argv.length,endurance||bridge||capacity?3:2);assert.equal(hostname(),"ingenium-judge-verification-01");assert.equal(process.getuid?.(),0);process.umask(0o077);
  const settings=parseHostRuntime(await rootRuntimeJson("/etc/ingenium/judge-launcher.json",4194304));
  const context=`/var/lib/ingenium/candidate-rehearsal-${settings.hostEpochId}`;
  const previous=await rootRuntimeJson(`${context}/completed`,32768) as {results:unknown[]};assert.equal(previous.results.length,5);
  directory=`/var/lib/ingenium/services-rehearsal-${randomUUID()}`;await mkdir(directory,{mode:0o700});
  async function save(name:string,value:unknown){const f=await open(`${directory}/${name}`,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o400);try{await f.writeFile(JSON.stringify(value)+"\n");await f.sync();}finally{await f.close();}const d=await open(directory,constants.O_RDONLY|constants.O_DIRECTORY);try{await d.sync();}finally{await d.close();}}
  await save("run-intent",{endurance,bridge,capacity,duration_ms:endurance?18000000:bridge?1800000:0,boot_id:settings.bootId,event_deployed:false});
  const pool=(url:string,max=3)=>{const p=new Pool({connectionString:url,max,connectionTimeoutMillis:1000,query_timeout:5000});p.on("error",()=>{});pools.push(p);return p;};
  const ingressSecret=await rootRuntimeJson(`${context}/credential-ingenium_rehearsal_ingress_${settings.hostEpochId.replaceAll("-","").slice(0,12)}`,4096) as {secret:string};
  const ingressUrl=new URL(settings.databaseUrl);ingressUrl.username=ingressUrl.username.replace("_runner_","_ingress_");ingressUrl.password=ingressSecret.secret;
  const ingress=pool(ingressUrl.toString(),JUDGE_DATABASE_POOLS.gateway),runner=pool(settings.databaseUrl,JUDGE_DATABASE_POOLS.supervisor),registry=createJudgeRegistry(ingress,settings),store=createJudgeSupervisorStore(runner,settings);
  assert.equal(await registry.ready(),false);assert.deepEqual(await store.held(),[]);
  const ownerSecret=await rootRuntimeJson("/var/lib/ingenium/registry-rehearsal-a6bf44ef-1c3a-4ac5-a26d-adda369c87bb/credentials",4096) as {owner:string};
  const ownerUrl=new URL(settings.databaseUrl);ownerUrl.username="ingenium_rehearsal_owner";ownerUrl.password=ownerSecret.owner;const owner=pool(ownerUrl.toString());
  const publisherName=`ingenium_rehearsal_pub_${randomUUID().replaceAll("-","")}`,password=randomBytes(32).toString("hex");
  await save("publisher-intent",{name:publisherName,password});
  await owner.query((await owner.query("SELECT format('CREATE ROLE %I LOGIN PASSWORD %L IN ROLE ingenium_judge_publisher',$1::text,$2::text) sql",[publisherName,password])).rows[0].sql);
  const publisherUrl=new URL(settings.databaseUrl);publisherUrl.username=publisherName;publisherUrl.password=password;
  const publisher=createJudgePublisherStore(pool(publisherUrl.toString(),JUDGE_DATABASE_POOLS.publisher),settings);
  stage="redis";redis=await createTestRedis();await save("redis",redis.settings);
  stage="tls";const tls=await createTestTls({after(fn:()=>Promise<void>){cleanups.push(fn);}} as unknown as TestContext);
  await save("tls",{directory:tls.directory});
  gateway=buildJudgeGateway({registry,serverName:"judge.test",workerAddress:"127.0.0.1",workerCertificateSha256:sha256(new X509Certificate(tls.clientCert).raw).toString("hex"),ca:tls.ca,certificate:tls.cert,privateKey:tls.key});
  await gateway.listen({host:"127.0.0.1",port:bridge?23590:0});const address=gateway.server.address();assert.ok(address&&typeof address!=="string");
  const clientSettings={hostEpochId:settings.hostEpochId,endpointRef:"isolated-services-rehearsal",runtimes:settings.runtimes,address:"127.0.0.1",port:address.port,serverName:"judge.test",serverCertificateSha256:sha256(new X509Certificate(tls.cert).raw).toString("hex"),ca:tls.ca,certificate:tls.clientCert,privateKey:tls.clientKey};
  const driver=createAuthoringJudgeDriver(clientSettings);
  const launcherSha256=sha256(await readFile("/opt/ingenium/judge-executor/launch")).toString("hex"),executor=()=>createProtectedExecutorClient({...settings,launcherSha256});
  const queue=()=>createJudgeQueue({...settings,...redis!.settings}),session=await openSupervisorSession(runner,settings);
  const slots=capacity||bridge?8:2;
  const verifier=executor();
  const readiness={...verifier,async readiness(signal:AbortSignal){const start=performance.now();try{const proof=await verifier.readiness(signal);readinessObservations++;peakReadinessMs=Math.max(peakReadinessMs,Math.ceil(performance.now()-start));return proof;}catch(error){console.error(JSON.stringify({scope:"REHEARSAL_READINESS_FAILURE",elapsed_ms:Math.ceil(performance.now()-start),observations:readinessObservations,peak_passed_ms:peakReadinessMs}));throw error;}}};
  stage="continuous-service";service=await startJudgeSupervisor({store,publisher,session,queues:Array.from({length:slots+1},queue),executors:Array.from({length:slots},executor),readiness,signal:new AbortController().signal});
  await driver.assertReady(AbortSignal.timeout(10000));
  const runStarted=performance.now(),utcStarted=Date.now();let batches=0,total=0,maximum=0,serviceFailed=false,peakRss=process.memoryUsage().rss;
  void service.completion.then(result=>{serviceFailed=result.failed;});
  await save("started",{utc:new Date(utcStarted).toISOString(),boot_id:settings.bootId});
  if(bridge){
    await save("bridge-client",{...clientSettings,port:13360,runtimes:[...clientSettings.runtimes],ca:tls.ca.toString(),certificate:tls.clientCert.toString(),privateKey:tls.clientKey.toString(),manifests:await rootRuntimeJson(`${context}/runtime-manifests`,32768)});
    await save("bridge-process",{pid:process.pid});
    console.log(JSON.stringify({scope:"ISOLATED_ROUND_FLOW_BRIDGE",pid:process.pid,port:address.port,evidence:directory,event_deployed:false}));
    let stop=false;const requested=()=>{stop=true;};process.once("SIGTERM",requested);process.once("SIGINT",requested);
    try{while(!stop&&performance.now()-runStarted<1800000){assert.equal(serviceFailed,false);await delay(250);}}finally{process.removeListener("SIGTERM",requested);process.removeListener("SIGINT",requested);}
    assert.deepEqual(await store.held(),[]);assert.equal(await redis.control.sendCommand(["XLEN",`ingenium:authoring:${settings.hostEpochId}:${settings.bootId}`]),0);
  }else{
  do{
  const batch=batches++,jobs:AuthoringPayload[]=[],expected=new Map<string,string>(),names=new Map<string,string>();
  const fixed=LANGUAGES.map(language=>({id:language,language,source:FIXED_HOST_SOURCES[language],result:"PASSED",cpuMs:2000,wallMs:10000,memoryKb:524288}));
  if(capacity){const copies=fixed.slice();fixed.splice(0);for(let repeat=0;repeat<4;repeat++)for(const item of copies)fixed.push({...item,id:`${item.id}-${repeat}`});}
  if(endurance)fixed.unshift({...fixed[0]!,...HOST_FAILURE_CASES[(batch+13)%HOST_FAILURE_CASES.length]!});
  stage="http-admission";
  for(const item of fixed){const {language}=item,runtime=settings.runtimes.get(language)!;
    const p:AuthoringPayload={hostEpochId:settings.hostEpochId,attemptId:randomUUID(),runId:randomUUID(),checkId:randomUUID(),language,runtimeKey:runtime.key,runtimeDigest:runtime.digest,sourceRole:"REFERENCE",checkType:"TEST_CASE",source:Buffer.from(FIXED_HOST_SOURCES[language]),stdin:Buffer.from("7 5\n"),cpuMs:2000,wallMs:10000,memoryKb:524288};
    p.source=Buffer.from(item.source);p.cpuMs=item.cpuMs;p.wallMs=item.wallMs;p.memoryKb=item.memoryKb;
    const name=endurance?`batch-${batch}-${item.id}`:item.id;names.set(p.attemptId,name);expected.set(p.attemptId,item.result);
    await save(`${name}-intent`,{attempt_id:p.attemptId});
    await driver.submit(p,AbortSignal.timeout(10000));
    // An explicit duplicate reconciles admission; it cannot grant another execution.
    await driver.submit(p,AbortSignal.timeout(10000));jobs.push(p);
  }
  stage="queue-drain";const started=performance.now(),results=[];
  while(results.length<jobs.length){assert.equal(serviceFailed,false,"Continuous judge stopped after a fault.");assert.ok(performance.now()-started<300000,"Real compiler queue did not drain within five minutes.");
    maximum=Math.max(maximum,(await store.held()).length);
    for(const p of jobs){if(results.some(r=>r.attempt_id===p.attemptId))continue;
      const observed=await createAuthoringJudgeDriver(clientSettings).observe(p,AbortSignal.timeout(10000));
      const verdict=acceptAuthoringObservation(p,observed,Buffer.from("12\n"),"EXACT_TEXT");if(!verdict)continue;
      assert.equal(verdict.result,expected.get(p.attemptId));assert.ok(verdict.release);const record=await store.execution(p.attemptId);assert.ok(record?.started&&record.evidence?.metadata.drain);
      const row={language:p.language,attempt_id:p.attemptId,verdict:verdict.result,elapsed_ms:Math.round(performance.now()-started),cpu_ns:verdict.metadata.cpu_ns,peak_bytes:verdict.metadata.peak_bytes};await save(`${names.get(p.attemptId)}-completed`,row);results.push(row);console.log(`PASS: ${names.get(p.attemptId)} -> real mTLS/Redis/continuous worker/compiler/output and full cleanup`);
    }await delay(250);
  }
  assert.equal(maximum,slots);assert.deepEqual(await store.held(),[]);
  const queues=await redis.control.sendCommand(["XLEN",`ingenium:authoring:${settings.hostEpochId}:${settings.bootId}`]);assert.equal(queues,0);
  total+=results.length;peakRss=Math.max(peakRss,process.memoryUsage().rss);assert.ok(peakRss<536870912);
  await save(`batch-${batch}-completed`,{results,elapsed_ms:Math.round(performance.now()-runStarted),peak_rss:peakRss});
  if(endurance&&performance.now()-runStarted<18000000)await delay(1000);
  }while(endurance&&performance.now()-runStarted<18000000);
  }
  assert.equal((await readFile("/proc/sys/kernel/random/boot_id","ascii")).trim(),settings.bootId);
  const elapsed=Math.round(performance.now()-runStarted);if(endurance){assert.ok(elapsed>=18000000);assert.ok(Date.now()-utcStarted>=18000000);}
  assert.deepEqual(await service.close(),{failed:false});service=undefined;assert.equal(await registry.ready(),false);
  await gateway.close();gateway=undefined;await redis.close();redis=undefined;
  await save("completed",{batches,total,elapsed_ms:elapsed,peak_rss:peakRss,maximum_held:maximum,queue_empty:true,readiness_withdrawn:true,readiness_observations:readinessObservations,peak_readiness_ms:peakReadinessMs,event_deployed:false});completed=true;
  console.log(JSON.stringify({scope:endurance?"INSTALLED_JUDGE_FIVE_HOUR_ENDURANCE":bridge?"ISOLATED_ROUND_FLOW_BRIDGE_STOPPED":capacity?"INSTALLED_EIGHT_SLOT_MIXED_COMPILER":"INSTALLED_PRIVATE_CONTINUOUS_JUDGE",event_deployed:false,evidence:directory,maximum_held:maximum,batches,total,elapsed_ms:elapsed,peak_rss:peakRss,readiness_observations:readinessObservations,peak_readiness_ms:peakReadinessMs}));
}catch(error){let detail=service?.failureCause;for(let depth=0;depth<4&&detail instanceof Error;depth++)detail=detail.cause??{name:detail.name,message:detail.message.slice(0,256)};if(directory)console.error(JSON.stringify({scope:"REHEARSAL_TERMINAL_OBSERVATIONS",readiness_observations:readinessObservations,peak_readiness_ms:peakReadinessMs,launcher_failure:detail??null}));console.error(`FAIL: installed services ${stage}${service?.failureStage?`/${service.failureStage}`:""}; preserve ${directory||"the original context"}, all records and physical resources. ${error instanceof Error?error.name:"UnknownError"}`);process.exitCode=1;}
finally{await service?.close();await gateway?.close();for(const p of pools)await p.end();if(!completed&&redis?.control.isOpen)redis.control.destroy();if(completed)for(const cleanup of cleanups.reverse())await cleanup();}
