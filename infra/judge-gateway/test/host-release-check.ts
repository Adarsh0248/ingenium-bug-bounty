import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { chmod,copyFile,mkdir,open,readFile,rename } from "node:fs/promises";
import { dirname } from "node:path";
import { hostname,release as kernelRelease } from "node:os";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";
import { Pool } from "pg";
import { LANGUAGES,sha256 } from "../../../apps/api/src/access/credentials.js";
import { parseHostRuntime } from "../../../apps/api/src/judge/host-config.js";
import { openHostInstallation,reviewedHostRelease } from "../../../apps/api/src/judge/host-installation.js";
import { openVerifiedHost } from "../../../apps/api/src/judge/host-verification.js";
import { protectedDirectory } from "../../../apps/api/src/judge/isolate-context.js";
import { createJudgeRegistry,createJudgeSupervisorStore } from "../../../apps/api/src/judge/registry.js";
import { rootRuntimeJson } from "../../../apps/api/src/runtime/private-file.js";
import { runtimeObject } from "../../../apps/api/src/worker/config.js";
import { runFixedHostExecutions } from "../../../apps/api/test/fixtures/host-executions.js";
import { prepareRehearsalDatabase } from "../../../apps/api/test/fixtures/host-registry.js";

const pools:Pool[]=[];let stage="caller",directory="";
try{
  assert.equal(process.argv.length,2);assert.equal(process.platform,"linux");assert.equal(process.getuid?.(),0);assert.equal(hostname(),"ingenium-judge-verification-01");process.umask(0o077);
  const root="/opt/ingenium/judge-executor",original="/var/lib/ingenium/registry-rehearsal-a6bf44ef-1c3a-4ac5-a26d-adda369c87bb";
  const raw=await rootRuntimeJson("/etc/ingenium/judge-launcher.json",4194304),old=parseHostRuntime(raw);
  assert.equal(old.hostEpochId,"bac6fb8c-6740-4c32-a415-f6cb860fe39a");assert.equal(old.release.digest,"d3e22161024199246dfc6a7c8cacd885b90cddb836e86a0981808dedb57fbba3");
  const boot=(await readFile("/proc/sys/kernel/random/boot_id","ascii")).trim();assert.notEqual(boot,old.bootId);assert.equal(kernelRelease(),old.kernelRelease);
  const epoch=randomUUID();directory=`/var/lib/ingenium/release-rehearsal-${epoch}`;await mkdir(directory,{mode:0o700});
  async function save(name:string,value:unknown){
    const file=await open(`${directory}/${name}`,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o400);
    try{await file.writeFile(JSON.stringify(value)+"\n");await file.sync();}finally{await file.close();}
    const folder=await open(directory,constants.O_RDONLY|constants.O_DIRECTORY);try{await folder.sync();}finally{await folder.close();}
  }
  await save("intent",{scope:"REVIEWED_RELEASE_REHEARSAL",epoch,boot,old_epoch:old.hostEpochId,provider_schema:"STRUCTURAL_TEST_FIXTURE",event_deployed:false});
  stage="old-release";const installation=await openHostInstallation(old.manifest,old.release,AbortSignal.timeout(10000));await installation.close();
  assert.equal(sha256(await readFile(new URL("host-cli.js",import.meta.url))).toString("hex"),"f8d4d2777d1370b34d62bc3b894517225a6cc90efeaf4e030a225ec41050da17");
  stage="original-database";
  const exec=promisify(execFile),docker=async(args:string[])=>(await exec(`${root}/docker`,["--config",`${root}/docker-client`,"--host","unix:///run/docker.sock",...args],{timeout:20000,maxBuffer:65536,env:{PATH:"/usr/bin:/bin",LANG:"C.UTF-8"}})).stdout.trim();
  const allocation=runtimeObject(await rootRuntimeJson(`${original}/intent`,4096),["scope","provider_schema","event_admission","epoch","boot_id","name","volume","image"]);
  const receipt=runtimeObject(await rootRuntimeJson(`${original}/container-id`,4096),["id"]);assert.ok(typeof receipt.id==="string"&&/^[0-9a-f]{64}$/.test(receipt.id));
  let container=JSON.parse(await docker(["inspect","--format","{{json .}}",receipt.id]));
  assert.equal(container.Config.Image,allocation.image);assert.equal(container.Config.Labels["ingenium.registry-rehearsal"],"a6bf44ef-1c3a-4ac5-a26d-adda369c87bb");
  assert.equal(container.HostConfig.RestartPolicy.Name,"no");assert.equal(container.HostConfig.ReadonlyRootfs,true);assert.equal(container.HostConfig.Privileged,false);
  assert.equal(await docker(["ps","-a","--filter",`label=ingenium.executor.epoch=${old.hostEpochId}`,"--format","{{.ID}}"]),"");
  if(!container.State.Running){await save("before-database-start",{id:receipt.id});assert.equal(await docker(["start",receipt.id]),receipt.id);}
  container=JSON.parse(await docker(["inspect","--format","{{json .}}",receipt.id]));
  const ports=container.NetworkSettings.Ports["5432/tcp"];assert.equal(ports.length,1);assert.equal(ports[0].HostIp,"127.0.0.1");assert.match(ports[0].HostPort,/^[1-9][0-9]{0,4}$/);
  const secret=runtimeObject(await rootRuntimeJson(`${original}/credentials`,4096),["owner"]);assert.equal(typeof secret.owner,"string");
  const ownerUrl=new URL(old.databaseUrl);ownerUrl.username="ingenium_rehearsal_owner";ownerUrl.password=secret.owner as string;ownerUrl.port=ports[0].HostPort;
  const pool=(url:string,max=2)=>{const p=new Pool({connectionString:url,max,connectionTimeoutMillis:1000,query_timeout:5000});pools.push(p);p.on("error",()=>{});return p;};
  const prior=pool(ownerUrl.toString());for(let n=0;;n++){try{await prior.query("SELECT 1");break;}catch{assert.ok(n<30);await delay(500);}}
  const snapshot=async()=>{const rows=(await prior.query(`SELECT to_jsonb(a) a,to_jsonb(s) s,to_jsonb(o) o FROM ingenium_judge.attempts a JOIN public.submissions s ON s.id=a.submission_id JOIN ingenium_judge.outbox o USING(attempt_id) ORDER BY a.attempt_id`)).rows;assert.equal(rows.length,2);return rows;};
  const before=await snapshot();for(const row of before){assert.equal(row.a.evidence,null);assert.equal(row.a.drain,null);assert.ok(row.a.launch_started_at);}
  await save("old-associations",{sha256:sha256(JSON.stringify(before)).toString("hex"),attempts:before.map(row=>row.a.attempt_id)});
  await save("before-fence",{old_epoch:old.hostEpochId});
  assert.equal((await prior.query("UPDATE ingenium_judge.control SET state='FENCED',ready_until='-infinity',readiness_proof=NULL WHERE epoch=$1 AND state='ACTIVE' RETURNING state",[old.hostEpochId])).rows[0]?.state,"FENCED");
  await save("fenced",{old_epoch:old.hostEpochId});
  stage="preserve-original-release";
  const archived=`${directory}/original-release`;await mkdir(archived,{mode:0o700});
  const folders=new Set([archived]);
  for(const file of old.manifest.files){const target=`${archived}/${file.path}`;await mkdir(dirname(target),{recursive:true,mode:0o700});folders.add(dirname(target));await copyFile(`${root}/${file.path}`,target,constants.COPYFILE_EXCL);await chmod(target,file.mode);assert.equal(sha256(await readFile(target)).toString("hex"),file.sha256);const held=await open(target,constants.O_RDONLY);try{await held.sync();}finally{await held.close();}}
  for(const path of [...folders].sort((a,b)=>b.length-a.length)){const held=await open(path,constants.O_RDONLY|constants.O_DIRECTORY);try{await held.sync();}finally{await held.close();}}
  await copyFile("/etc/ingenium/judge-launcher.json",`${directory}/original-launcher.json`,constants.COPYFILE_EXCL);await chmod(`${directory}/original-launcher.json`,0o400);
  const archivedConfig=await open(`${directory}/original-launcher.json`,constants.O_RDONLY);try{await archivedConfig.sync();}finally{await archivedConfig.close();}await save("original-manifest",old.manifest);
  stage="corrected-release";
  const bytes=await readFile(new URL("host-cli.js",import.meta.url)),manifest={...old.manifest,files:old.manifest.files.map(file=>file.path==="app/judge/host-cli.js"?{...file,size:bytes.length,sha256:sha256(bytes).toString("hex")}:file)};
  const release={imageId:old.release.imageId,digest:sha256(JSON.stringify(manifest)).toString("hex")};reviewedHostRelease(manifest,release);
  const staged=await open(`${directory}/host-cli.next`,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o400);try{await staged.writeFile(bytes);await staged.chmod(0o444);await staged.sync();}finally{await staged.close();}
  await save("before-release-install",{release,manifest});await rename(`${directory}/host-cli.next`,`${root}/app/judge/host-cli.js`);
  const codeDir=await open(`${root}/app/judge`,constants.O_RDONLY|constants.O_DIRECTORY);try{await codeDir.sync();}finally{await codeDir.close();}
  const settings={...old,hostEpochId:epoch,bootId:boot,release,manifest};
  stage="open-corrected-installation";const host=await openVerifiedHost(settings,release,manifest,AbortSignal.timeout(10000));let proof:Buffer;
  try{stage="fresh-host-preparation";proof=await host.prepare(AbortSignal.timeout(80000));assert.ok(proof.equals(await host.assertReady(AbortSignal.timeout(5000))));}finally{await host.close();}
  await save("host-prepared",{epoch,boot,release,proof_digest:proof.toString("hex")});
  stage="fresh-database";const db=`ingenium_rehearsal_${epoch.replaceAll("-","")}`;await save("before-database-create",{db});await prior.query(`CREATE DATABASE ${db}`);
  const newUrl=new URL(ownerUrl);newUrl.pathname=`/${db}`;const owner=pool(newUrl.toString());
  const accounts=await prepareRehearsalDatabase(owner,newUrl,settings,name=>readFile(new URL(name,import.meta.url),"utf8"),save);
  stage="fresh-launcher-config";const record=raw as Record<string,unknown>,next={...record,database_url:accounts[1]!.toString(),host_epoch_id:epoch,boot_id:boot,release:{image_id:release.imageId,digest:release.digest},manifest};
  const parsed=parseHostRuntime(next);await save("launcher-next",next);await rename(`${directory}/launcher-next`,"/etc/ingenium/judge-launcher.json");
  const configDir=await open("/etc/ingenium",constants.O_RDONLY|constants.O_DIRECTORY);try{await configDir.sync();}finally{await configDir.close();}
  stage="fixed-executions";const ingress=pool(accounts[0]!.toString()),runner=pool(accounts[1]!.toString(),3);
  const results=await runFixedHostExecutions(parsed,ingress,runner,proof.toString("hex"),save,value=>{stage=value;});
  assert.deepEqual(await createJudgeSupervisorStore(runner,parsed).held(),[]);assert.equal(await createJudgeRegistry(ingress,parsed).ready(),false);assert.deepEqual(await snapshot(),before);
  assert.equal((await prior.query("SELECT state FROM ingenium_judge.control WHERE epoch=$1",[old.hostEpochId])).rows[0].state,"FENCED");
  await save("completed",{results,old_associations_unchanged:true,old_epoch_fenced:true});
  console.log("PASS: corrected immutable release and fresh boot/epoch; five real fixed executions recovered and drained; old fenced attempts unchanged");
  console.log(JSON.stringify({scope:"REVIEWED_RELEASE_REHEARSAL",event_deployed:false,provider_schema:"STRUCTURAL_TEST_FIXTURE",epoch,boot,results,evidence:directory}));
}catch(error){console.error(`FAIL: reviewed release rehearsal ${stage}; preserve ${directory||"the installation"}, all releases, epochs, records and resources. ${error instanceof Error?error.name:"UnknownError"}`);process.exitCode=1;}
finally{for(const pool of pools)await pool.end();}
