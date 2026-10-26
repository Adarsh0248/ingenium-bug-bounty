import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { constants } from "node:fs";
import { lstat,mkdir,open,readFile,readdir } from "node:fs/promises";
import { hostname } from "node:os";
import { promisify } from "node:util";
import { Pool } from "pg";
import { sha256 } from "../../../apps/api/src/access/credentials.js";
import { judgeJson } from "../../../apps/api/src/content/judge-protocol.js";
import { inspectHostCgroups } from "../../../apps/api/src/judge/host-cgroups.js";
import { parseHostRuntime } from "../../../apps/api/src/judge/host-config.js";
import { protectedDirectory } from "../../../apps/api/src/judge/isolate-context.js";
import { CAPSULE_DIRECTORY } from "../../../apps/api/src/judge/capsule-configuration.js";
import { createJudgeRegistry,createJudgeSupervisorStore } from "../../../apps/api/src/judge/registry.js";
import { rootRuntimeJson } from "../../../apps/api/src/runtime/private-file.js";
import { runtimeObject } from "../../../apps/api/src/worker/config.js";
import { runFixedHostExecutions } from "../../../apps/api/test/fixtures/host-executions.js";

const pools:Pool[]=[];let stage="caller";
try{
  assert.equal(process.argv.length,2);assert.equal(process.platform,"linux");assert.equal(process.getuid?.(),0);assert.equal(hostname(),"ingenium-judge-verification-01");process.umask(0o077);
  const original="/var/lib/ingenium/registry-rehearsal-a6bf44ef-1c3a-4ac5-a26d-adda369c87bb",epoch="bac6fb8c-6740-4c32-a415-f6cb860fe39a",attempt="892f92fd-ef98-4857-8e43-d6be2e9e90e9";
  stage="original-context";await protectedDirectory(original);
  const runtime=await rootRuntimeJson("/etc/ingenium/judge-launcher.json",4194304),parsed=parseHostRuntime(runtime);
  assert.equal(parsed.hostEpochId,epoch);assert.equal(parsed.bootId,(await readFile("/proc/sys/kernel/random/boot_id","ascii")).trim());
  assert.equal(parsed.release.digest,"d3e22161024199246dfc6a7c8cacd885b90cddb836e86a0981808dedb57fbba3");
  const directory=`${original}/setup-fix-v1`;await mkdir(directory,{mode:0o700});
  async function save(name:string,value:unknown){
    const file=await open(`${directory}/${name}`,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o400);
    try{await file.writeFile(JSON.stringify(value)+"\n");await file.sync();}finally{await file.close();}
    const folder=await open(directory,constants.O_RDONLY|constants.O_DIRECTORY);try{await folder.sync();}finally{await folder.close();}
  }
  await save("intent",{scope:"MISSING_CONFIGURATION_ROOT_CONTINUATION",epoch,attempt,event_admission:false});
  const claim=runtimeObject(await rootRuntimeJson(`${original}/c-claim`,4096),["attempt_id","provider_token","owner"]),capsule=`/var/lib/ingenium/judge-executor/checkpoints/capsule-${epoch}-${attempt}`;
  assert.equal(claim.attempt_id,attempt);assert.deepEqual((await readdir(capsule)).sort(),["binding.json","intent.json","resource_intent.json"]);
  const intent=JSON.parse(await readFile(`${capsule}/intent.json`,"utf8")),resources=JSON.parse(await readFile(`${capsule}/resource_intent.json`,"utf8"));
  assert.equal(intent.nonce,"413ca06e-1f43-4853-963b-09f514b5e056");const name=`ingenium-exec-${intent.nonce.replaceAll("-","")}`;
  assert.equal(judgeJson(await inspectHostCgroups(parsed.bootId)),judgeJson(resources.roots));
  for(const row of Object.values(resources.roots) as {path:string}[])await assert.rejects(lstat(`${row.path}/${name}`),{code:"ENOENT"});
  await assert.rejects(lstat(CAPSULE_DIRECTORY),{code:"ENOENT"});
  stage="original-database";
  const exec=promisify(execFile),docker=async(args:string[])=>(await exec("/opt/ingenium/judge-executor/docker",["--config","/opt/ingenium/judge-executor/docker-client","--host","unix:///run/docker.sock",...args],{timeout:10000,maxBuffer:32768,env:{PATH:"/usr/bin:/bin",LANG:"C.UTF-8"}})).stdout.trim();
  assert.equal(await docker(["ps","-a","--filter",`label=ingenium.executor.epoch=${epoch}`,"--format","{{.ID}}"]),"");
  const pg=runtimeObject(await rootRuntimeJson(`${original}/container-id`,4096),["id"]),allocation=runtimeObject(await rootRuntimeJson(`${original}/intent`,4096),["scope","provider_schema","event_admission","epoch","boot_id","name","volume","image"]);
  assert.ok(typeof pg.id==="string"&&/^[0-9a-f]{64}$/.test(pg.id));const container=JSON.parse(await docker(["inspect","--format","{{json .}}",pg.id]));
  assert.equal(container.Config.Labels["ingenium.registry-rehearsal"],"a6bf44ef-1c3a-4ac5-a26d-adda369c87bb");assert.equal(container.Config.Image,allocation.image);assert.equal(container.State.Running,true);
  const ownerUrl=new URL(parsed.databaseUrl),secret=runtimeObject(await rootRuntimeJson(`${original}/credentials`,4096),["owner"]);
  assert.equal(typeof secret.owner,"string");ownerUrl.username="ingenium_rehearsal_owner";ownerUrl.password=secret.owner as string;
  assert.deepEqual(container.NetworkSettings.Ports["5432/tcp"],[{HostIp:"127.0.0.1",HostPort:ownerUrl.port}]);
  const pool=(url:string)=>{const p=new Pool({connectionString:url,max:3,connectionTimeoutMillis:1000,query_timeout:5000});pools.push(p);p.on("error",()=>{});return p;};
  const owner=pool(ownerUrl.toString()),runner=pool(parsed.databaseUrl),ingressSecret=runtimeObject(await rootRuntimeJson(`${original}/credential-ingenium_rehearsal_ingress`,4096),["secret"]);
  assert.equal(typeof ingressSecret.secret,"string");const ingressUrl=new URL(parsed.databaseUrl);ingressUrl.username="ingenium_rehearsal_ingress";ingressUrl.password=ingressSecret.secret as string;
  const ingress=pool(ingressUrl.toString()),supervisor=createJudgeSupervisorStore(runner,parsed),registry=createJudgeRegistry(ingress,parsed);
  assert.deepEqual(await supervisor.held(),[attempt]);assert.equal(await registry.ready(),false);
  const snapshot=async()=>{const row=(await owner.query(`SELECT jsonb_build_object('attempt',to_jsonb(a),'provider',to_jsonb(s),'outbox',to_jsonb(o)) value
    FROM ingenium_judge.attempts a JOIN public.submissions s ON s.id=a.submission_id JOIN ingenium_judge.outbox o USING(attempt_id) WHERE a.attempt_id=$1`,[attempt])).rows[0];assert.ok(row);return row.value;};
  const before=await snapshot();assert.equal(before.attempt.permit_owner,claim.owner);assert.equal(before.attempt.provider_token,claim.provider_token);assert.equal(before.attempt.evidence,null);assert.equal(before.attempt.drain,null);
  assert.equal((await owner.query("SELECT count(*)::int n FROM ingenium_judge.attempts")).rows[0].n,1);
  await save("verified-original",{attempt,record_sha256:sha256(judgeJson(before)).toString("hex"),no_execution_container:true,no_owned_cgroups:true});
  stage="missing-root-setup";await mkdir(CAPSULE_DIRECTORY,{mode:0o700});await protectedDirectory(CAPSULE_DIRECTORY);
  const root=await open(CAPSULE_DIRECTORY,constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW);try{const info=await root.stat();assert.equal(info.mode&0o7777,0o700);assert.equal(info.uid,0);assert.equal(info.gid,0);await root.sync();}finally{await root.close();}
  const parent=await open("/var/lib/ingenium/judge-executor",constants.O_RDONLY|constants.O_DIRECTORY);try{await parent.sync();}finally{await parent.close();}
  await save("root-created",{path:CAPSULE_DIRECTORY});
  const results=await runFixedHostExecutions(parsed,ingress,runner,"ad6e9094abfb246c457b29b156e0848188dcc580e15529a6492c9d360b7ed2c0",save,value=>{stage=value;});
  assert.deepEqual(await snapshot(),before);assert.deepEqual(await supervisor.held(),[attempt]);assert.equal(await registry.ready(),false);
  const counts=(await owner.query("SELECT count(*)::int attempts,count(*) FILTER(WHERE drain IS NOT NULL)::int drained FROM ingenium_judge.attempts")).rows[0];assert.deepEqual(counts,{attempts:6,drained:5});
  await save("completed",{results,counts,original_attempt_unchanged:true,original_reservation_held:true});
  console.log("PASS: missing configuration root installed; five fresh real executions completed; original failed attempt and reservation unchanged");
  console.log(JSON.stringify({scope:"DATABASE_BACKED_FIXED_LAUNCHER",event_admission:false,provider_schema:"STRUCTURAL_TEST_FIXTURE",http_queue_tested:false,two_job_concurrency_tested:false,results,counts,original_reservation_held:true,evidence:directory}));
}catch(error){console.error(`FAIL: fixed registry continuation ${stage}; preserve all original and continuation records/resources. ${error instanceof Error?error.name:"UnknownError"}`);process.exitCode=1;}
finally{for(const pool of pools)await pool.end();}
