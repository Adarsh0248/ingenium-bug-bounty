import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { constants } from "node:fs";
import { lstat,mkdir,open,readFile,rename } from "node:fs/promises";
import { hostname } from "node:os";
import { promisify } from "node:util";
import { Pool } from "pg";
import { sha256 } from "../../../apps/api/src/access/credentials.js";
import { parseHostRuntime } from "../../../apps/api/src/judge/host-config.js";
import { reviewedHostRelease } from "../../../apps/api/src/judge/host-installation.js";
import { openVerifiedHost } from "../../../apps/api/src/judge/host-verification.js";
import { createJudgeRegistry,createJudgeSupervisorStore } from "../../../apps/api/src/judge/registry.js";
import { rootRuntimeJson } from "../../../apps/api/src/runtime/private-file.js";
import { runtimeObject } from "../../../apps/api/src/worker/config.js";
import { runFixedHostExecutions } from "../../../apps/api/test/fixtures/host-executions.js";
import { prepareRehearsalDatabase } from "../../../apps/api/test/fixtures/host-registry.js";

const pools:Pool[]=[];let stage="caller";
try{
  assert.equal(process.argv.length,2);assert.equal(process.platform,"linux");assert.equal(process.getuid?.(),0);assert.equal(hostname(),"ingenium-judge-verification-01");process.umask(0o077);
  const epoch="a16ecbec-9d8a-46e4-bd67-bfa4c0b28f86",base=`/var/lib/ingenium/release-rehearsal-${epoch}`,directory=`${base}/mode-fix-v1`;
  const intent=runtimeObject(await rootRuntimeJson(`${base}/intent`,4096),["scope","epoch","boot","old_epoch","provider_schema","event_deployed"]);
  assert.equal(intent.epoch,epoch);assert.equal(intent.boot,(await readFile("/proc/sys/kernel/random/boot_id","ascii")).trim());
  const raw=await rootRuntimeJson(`${base}/original-launcher.json`,4194304),old=parseHostRuntime(raw);
  assert.equal(old.hostEpochId,intent.old_epoch);assert.ok((await readFile("/etc/ingenium/judge-launcher.json")).equals(await readFile(`${base}/original-launcher.json`)));
  const saved=runtimeObject(await rootRuntimeJson(`${base}/before-release-install`,4194304),["release","manifest"]),release=saved.release as {imageId:string;digest:string};
  const manifest=reviewedHostRelease(saved.manifest,release),settings={...old,hostEpochId:epoch,bootId:intent.boot as string,release,manifest};
  await assert.rejects(lstat(`/var/lib/ingenium/judge-executor/host-verification/${epoch}`),{code:"ENOENT"});
  await mkdir(directory,{mode:0o700});
  async function save(name:string,value:unknown){
    const file=await open(`${directory}/${name}`,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o400);
    try{await file.writeFile(JSON.stringify(value)+"\n");await file.sync();}finally{await file.close();}
    const folder=await open(directory,constants.O_RDONLY|constants.O_DIRECTORY);try{await folder.sync();}finally{await folder.close();}
  }
  await save("intent",{epoch,boot:settings.bootId,release,reason:"restore exact reviewed code mode before the first host cache allocation"});
  stage="original-fenced-database";
  const original="/var/lib/ingenium/registry-rehearsal-a6bf44ef-1c3a-4ac5-a26d-adda369c87bb";
  const receipt=runtimeObject(await rootRuntimeJson(`${original}/container-id`,4096),["id"]);assert.ok(typeof receipt.id==="string"&&/^[0-9a-f]{64}$/.test(receipt.id));
  const exec=promisify(execFile),container=JSON.parse((await exec("/opt/ingenium/judge-executor/docker",["--config","/opt/ingenium/judge-executor/docker-client","--host","unix:///run/docker.sock","inspect","--format","{{json .}}",receipt.id],{timeout:10000,maxBuffer:65536})).stdout);
  assert.equal(container.State.Running,true);assert.equal(container.Config.Labels["ingenium.registry-rehearsal"],"a6bf44ef-1c3a-4ac5-a26d-adda369c87bb");
  const ports=container.NetworkSettings.Ports["5432/tcp"];assert.equal(ports.length,1);assert.equal(ports[0].HostIp,"127.0.0.1");assert.match(ports[0].HostPort,/^[1-9][0-9]{0,4}$/);
  const secret=runtimeObject(await rootRuntimeJson(`${original}/credentials`,4096),["owner"]);assert.equal(typeof secret.owner,"string");
  const url=new URL(old.databaseUrl);url.username="ingenium_rehearsal_owner";url.password=secret.owner as string;url.port=ports[0].HostPort;
  const pool=(url:string,max=2)=>{const p=new Pool({connectionString:url,max,connectionTimeoutMillis:1000,query_timeout:5000});pools.push(p);p.on("error",()=>{});return p;};
  const prior=pool(url.toString()),snapshot=async()=>sha256(JSON.stringify((await prior.query(`SELECT to_jsonb(a) a,to_jsonb(s) s,to_jsonb(o) o FROM ingenium_judge.attempts a JOIN public.submissions s ON s.id=a.submission_id JOIN ingenium_judge.outbox o USING(attempt_id) ORDER BY a.attempt_id`)).rows)).toString("hex");
  const associations=runtimeObject(await rootRuntimeJson(`${base}/old-associations`,4096),["sha256","attempts"]);
  assert.equal(await snapshot(),associations.sha256);assert.equal((await prior.query("SELECT state FROM ingenium_judge.control WHERE epoch=$1",[old.hostEpochId])).rows[0].state,"FENCED");
  stage="code-mode";const code="/opt/ingenium/judge-executor/app/judge/host-cli.js",handle=await open(code,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
  try{const info=await handle.stat();assert.equal(info.uid,0);assert.equal(info.gid,0);assert.equal(info.nlink,1);assert.equal(info.mode&0o7777,0o400);assert.equal(sha256(await handle.readFile()).toString("hex"),"f8d4d2777d1370b34d62bc3b894517225a6cc90efeaf4e030a225ec41050da17");await handle.chmod(0o444);await handle.sync();}finally{await handle.close();}
  await save("mode-corrected",{path:code,mode:0o444});
  stage="open-installation";const host=await openVerifiedHost(settings,release,manifest,AbortSignal.timeout(10000));let proof:Buffer;
  try{stage="host-preparation";proof=await host.prepare(AbortSignal.timeout(80000));assert.ok(proof.equals(await host.assertReady(AbortSignal.timeout(5000))));}finally{await host.close();}
  await save("host-prepared",{epoch,boot:settings.bootId,release,proof_digest:proof.toString("hex")});
  stage="new-database";const db=`ingenium_rehearsal_${epoch.replaceAll("-","")}`;await save("before-database-create",{db});await prior.query(`CREATE DATABASE ${db}`);
  const newUrl=new URL(url);newUrl.pathname=`/${db}`;const owner=pool(newUrl.toString()),accounts=await prepareRehearsalDatabase(owner,newUrl,settings,name=>readFile(new URL(name,import.meta.url),"utf8"),save);
  stage="new-configuration";const next={...(raw as Record<string,unknown>),database_url:accounts[1]!.toString(),host_epoch_id:epoch,boot_id:settings.bootId,release:{image_id:release.imageId,digest:release.digest},manifest};
  const parsed=parseHostRuntime(next);await save("launcher-next",next);await rename(`${directory}/launcher-next`,"/etc/ingenium/judge-launcher.json");
  const configDir=await open("/etc/ingenium",constants.O_RDONLY|constants.O_DIRECTORY);try{await configDir.sync();}finally{await configDir.close();}
  const ingress=pool(accounts[0]!.toString()),runner=pool(accounts[1]!.toString(),3);
  const results=await runFixedHostExecutions(parsed,ingress,runner,proof.toString("hex"),save,value=>{stage=value;});
  assert.deepEqual(await createJudgeSupervisorStore(runner,parsed).held(),[]);assert.equal(await createJudgeRegistry(ingress,parsed).ready(),false);assert.equal(await snapshot(),associations.sha256);
  await save("completed",{results,old_fenced_associations_unchanged:true});
  console.log("PASS: exact reviewed mode restored; fresh-epoch five-language execution/recovery/cleanup completed; old fenced associations unchanged");
  console.log(JSON.stringify({scope:"CORRECTED_RELEASE_REHEARSAL",epoch,boot:settings.bootId,provider_schema:"STRUCTURAL_TEST_FIXTURE",event_deployed:false,results,evidence:directory}));
}catch(error){console.error(`FAIL: release mode continuation ${stage}; preserve original and continuation evidence, records and resources. ${error instanceof Error?error.name:"UnknownError"}`);process.exitCode=1;}
finally{for(const pool of pools)await pool.end();}
