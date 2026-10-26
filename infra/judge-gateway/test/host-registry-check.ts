import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomBytes,randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { mkdir,open,readFile } from "node:fs/promises";
import { hostname } from "node:os";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";
import { Pool } from "pg";
import { LANGUAGES,sha256 } from "../../../apps/api/src/access/credentials.js";
import { assertJudgeDatabaseRole } from "../../../apps/api/src/judge/database-role.js";
import { EXECUTION_PLAN_SHA256 } from "../../../apps/api/src/judge/execution-plan.js";
import { parseHostRuntime } from "../../../apps/api/src/judge/host-config.js";
import { protectedDirectory } from "../../../apps/api/src/judge/isolate-context.js";
import { createJudgeRegistry,createJudgeSupervisorStore } from "../../../apps/api/src/judge/registry.js";
import { runFixedHostExecutions } from "../../../apps/api/test/fixtures/host-executions.js";
import { prepareRehearsalDatabase } from "../../../apps/api/test/fixtures/host-registry.js";

const IMAGE="docker.io/library/postgres:17.11-bookworm@sha256:3645570cccdfa447589da9f57dd740faa29b30938e861289a5574b6ca6b03826";
const epoch="bac6fb8c-6740-4c32-a415-f6cb860fe39a",root="/opt/ingenium/judge-executor";
const pools:Pool[]=[];let stage="caller",directory="";

try{
  assert.equal(process.argv.length,2);assert.equal(process.platform,"linux");assert.equal(process.getuid?.(),0);assert.equal(hostname(),"ingenium-judge-verification-01");
  process.umask(0o077);await protectedDirectory(root);
  stage="original-preparation";
  const prior=`/var/lib/ingenium/host-installation-${epoch}`;await protectedDirectory(prior);
  const original=JSON.parse(await readFile(`${prior}/intent`,"utf8")),completed=JSON.parse(await readFile(`${prior}/completed`,"utf8"));
  assert.equal(original.settings.hostEpochId,epoch);assert.equal(original.settings.bootId,(await readFile("/proc/sys/kernel/random/boot_id","ascii")).trim());
  assert.equal(original.release.digest,"d3e22161024199246dfc6a7c8cacd885b90cddb836e86a0981808dedb57fbba3");
  assert.equal(completed.proof_digest,"ad6e9094abfb246c457b29b156e0848188dcc580e15529a6492c9d360b7ed2c0");
  const nonce=randomUUID(),name=`ingenium-registry-${nonce}`,volume=`${name}-data`;
  directory=`/var/lib/ingenium/registry-rehearsal-${nonce}`;await mkdir(directory,{mode:0o700});
  async function save(name:string,value:unknown){
    const file=await open(`${directory}/${name}`,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o400);
    try{await file.writeFile(JSON.stringify(value)+"\n");await file.sync();}finally{await file.close();}
    const folder=await open(directory,constants.O_RDONLY|constants.O_DIRECTORY);try{await folder.sync();}finally{await folder.close();}
  }
  const exec=promisify(execFile),password=randomBytes(32).toString("hex");
  const docker=async(args:string[],secret=false)=>(await exec(`${root}/docker`,["--config",`${root}/docker-client`,"--host","unix:///run/docker.sock",...args],
    {timeout:180000,maxBuffer:131072,env:{PATH:"/usr/bin:/bin",LANG:"C.UTF-8",...(secret?{POSTGRES_PASSWORD:password}:{})}})).stdout.trim();
  await save("intent",{scope:"DATABASE_BACKED_FIXED_LAUNCHER",provider_schema:"STRUCTURAL_TEST_FIXTURE",event_admission:false,epoch,boot_id:original.settings.bootId,name,volume,image:IMAGE});
  await save("credentials",{owner:password});
  stage="database-image";await docker(["pull","--platform","linux/amd64",IMAGE]);
  stage="database-volume";assert.equal(await docker(["volume","create","--label",`ingenium.registry-rehearsal=${nonce}`,volume]),volume);
  stage="database-container";
  const id=await docker(["create","--pull=never","--name",name,"--label",`ingenium.registry-rehearsal=${nonce}`,"--restart","no","--read-only","--user","999:999",
    "--cap-drop","ALL","--security-opt","no-new-privileges=true","--memory","536870912","--memory-swap","536870912","--cpus","0.5","--pids-limit","64",
    "--publish","127.0.0.1::5432","--env","POSTGRES_USER=ingenium_rehearsal_owner","--env","POSTGRES_DB=ingenium_registry_rehearsal","--env","POSTGRES_PASSWORD",
    "--mount",`type=volume,src=${volume},dst=/var/lib/postgresql/data`,"--tmpfs","/var/run/postgresql:rw,nosuid,nodev,noexec,size=8m,uid=999,gid=999,mode=0700",
    "--tmpfs","/tmp:rw,nosuid,nodev,noexec,size=16m,uid=999,gid=999,mode=0700","--log-driver","json-file","--log-opt","max-size=1m","--log-opt","max-file=1",
    IMAGE,"postgres","-c","max_connections=20","-c","shared_buffers=32MB","-c","max_wal_size=64MB","-c","min_wal_size=32MB"],true);
  assert.match(id,/^[0-9a-f]{64}$/);await save("container-id",{id});assert.equal(await docker(["start",id]),id);
  const container=JSON.parse(await docker(["inspect","--format","{{json .}}",id]));
  assert.equal(container.Id,id);assert.equal(container.Config.Labels["ingenium.registry-rehearsal"],nonce);assert.equal(container.Config.Image,IMAGE);
  assert.equal(container.HostConfig.RestartPolicy.Name,"no");assert.equal(container.HostConfig.ReadonlyRootfs,true);assert.equal(container.HostConfig.Privileged,false);
  const ports=container.NetworkSettings.Ports["5432/tcp"];assert.equal(ports.length,1);assert.equal(ports[0].HostIp,"127.0.0.1");assert.match(ports[0].HostPort,/^[1-9][0-9]{0,4}$/);
  const url=new URL(`postgresql://127.0.0.1:${ports[0].HostPort}/ingenium_registry_rehearsal`);url.username="ingenium_rehearsal_owner";url.password=password;
  const pool=(value:URL,max=2)=>{const p=new Pool({connectionString:value.toString(),max,connectionTimeoutMillis:1000,query_timeout:5000});pools.push(p);p.on("error",()=>{});return p;};
  const owner=pool(url);
  stage="database-startup";
  for(let attempt=0;;attempt++){try{await owner.query("SELECT 1");break;}catch{assert.ok(attempt<60);await delay(500);}}
  const binaries={"/usr/local/bin/isolate":"c8ad768bf22499f579eb07be75379c890347272de8190302b48b2bc0bab8d1d3","/usr/local/bin/ingenium-phase-exec":"681a9f9b99321363de8ae21ca4d9b9b5efff7a8219703849236cdc251bdbc3a9",
    "/usr/local/bin/gcc":"b12d612d7864e24b21f967e051c3fba6697727ef7a4274b11b8ff78838d965d7","/usr/local/bin/g++":"8832f947c17df1720a2d1cd17251b9a65f90f27f957ac9d2d2756dd05220dc94",
    "/usr/local/bin/python3.14":"353d0275b5ca0447ebfc6ecae7d80a7a7e7a627d4669fdcc3f836f0b8d804c79","/usr/local/bin/node":"67ca5783febb8bf85736c79fcdd92c8d6d465a0eb2a082672bcdfa76a506751c",
    "/usr/local/java/bin/java":"2a207f5e7d075afa01d97f8048389a64432a44c4a5af0f5e77d6e286ec5f401d","/usr/local/java/bin/javac":"55859b80e7a9c4c4736be19ad3addeb35112ca6d17a30c4e0e116afc0a499bdb"};
  const runtimes=Object.fromEntries(LANGUAGES.map(language=>[language,{key:`ingenium-${language}-20261025`,digest:sha256(JSON.stringify({language,image:original.release.imageId,binaries,policy:EXECUTION_PLAN_SHA256})).toString("hex")}]));
  stage="reviewed-migrations";
  const accounts=await prepareRehearsalDatabase(owner,url,{hostEpochId:epoch,bootId:original.settings.bootId,runtimes:new Map(LANGUAGES.map(language=>[language,runtimes[language]!]))},
    name=>readFile(new URL(name,import.meta.url),"utf8"),save);
  stage="protected-runtime-file";
  const tags=["isolate","phase_exec","gcc","gpp","python","node","java","javac"];
  const config={schema_version:1,database_url:accounts[1]!.toString(),host_epoch_id:epoch,boot_id:original.settings.bootId,runtimes,
    executables:Object.fromEntries(Object.values(binaries).map((value,i)=>[tags[i]!,value])),kernel_release:original.settings.kernelRelease,image_tree_sha256:original.settings.imageTreeSha256,
    release:{image_id:original.release.imageId,digest:original.release.digest},manifest:original.manifest};
  const parsed=parseHostRuntime(config);await mkdir("/etc/ingenium",{recursive:true,mode:0o700});await protectedDirectory("/etc/ingenium");
  const runtime=await open("/etc/ingenium/judge-launcher.json",constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o400);
  try{await runtime.writeFile(JSON.stringify(config)+"\n");await runtime.sync();}finally{await runtime.close();}
  const parent=await open("/etc/ingenium",constants.O_RDONLY|constants.O_DIRECTORY);try{await parent.sync();}finally{await parent.close();}
  const ingress=pool(accounts[0]!),runner=pool(accounts[1]!,3);
  await assertJudgeDatabaseRole(ingress,"gateway");await assertJudgeDatabaseRole(runner,"supervisor");await assert.rejects(assertJudgeDatabaseRole(owner,"supervisor"));
  const registry=createJudgeRegistry(ingress,parsed),supervisor=createJudgeSupervisorStore(runner,parsed);
  const results=await runFixedHostExecutions(parsed,ingress,runner,completed.proof_digest,save,value=>{stage=value;});
  assert.deepEqual(await supervisor.held(),[]);
  const counts=(await owner.query("SELECT (SELECT count(*)::int FROM public.submissions) providers,(SELECT count(*)::int FROM ingenium_judge.attempts) attempts,(SELECT count(*)::int FROM ingenium_judge.attempts WHERE launch_started_at IS NOT NULL AND drain IS NOT NULL) drained")).rows[0];
  assert.deepEqual(counts,{providers:5,attempts:5,drained:5});assert.equal(await registry.ready(),false);
  await save("completed",{results,counts,readiness_withdrawn:true});
  console.log("PASS: five real fixed executions sealed and drained once; readiness withdrawn; original database and checkpoints retained");
  console.log(JSON.stringify({scope:"DATABASE_BACKED_FIXED_LAUNCHER",provider_schema:"STRUCTURAL_TEST_FIXTURE",event_admission:false,http_queue_tested:false,host_epoch_id:epoch,results,counts,evidence:directory}));
}catch(error){
  console.error(`FAIL: fixed database/launcher rehearsal ${stage}; preserve ${directory||"the installation"}, database, permits and physical resources. ${error instanceof Error?error.name:"UnknownError"}`);process.exitCode=1;
}finally{
  for(const pool of pools)await pool.end();
}
