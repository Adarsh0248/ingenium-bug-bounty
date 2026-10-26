import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { chmod,copyFile,lstat,mkdir,open,readFile,rename } from "node:fs/promises";
import { dirname } from "node:path";
import { hostname } from "node:os";
import { promisify } from "node:util";
import { Pool } from "pg";
import { LANGUAGES,sha256,uuid } from "../../../apps/api/src/access/credentials.js";
import { parseHostRuntime } from "../../../apps/api/src/judge/host-config.js";
import { openHostInstallation,reviewedHostRelease } from "../../../apps/api/src/judge/host-installation.js";
import { openVerifiedHost } from "../../../apps/api/src/judge/host-verification.js";
import { EXECUTION_PLAN_SHA256 } from "../../../apps/api/src/judge/execution-plan.js";
import { protectedLinuxFile } from "../../../apps/api/src/judge/isolate-context.js";
import { createJudgeRegistry,createJudgeSupervisorStore } from "../../../apps/api/src/judge/registry.js";
import { rootRuntimeJson } from "../../../apps/api/src/runtime/private-file.js";
import { runtimeObject } from "../../../apps/api/src/worker/config.js";
import { prepareRehearsalDatabase } from "../../../apps/api/test/fixtures/host-registry.js";
import { runFixedHostExecutions } from "../../../apps/api/test/fixtures/host-executions.js";
import { inspectRehearsalDatabase } from "../../../apps/api/test/fixtures/host-database.js";

const pools:Pool[]=[];let stage="caller",directory="";
try{
  assert.equal(process.argv.length,2);assert.equal(process.platform,"linux");assert.equal(process.getuid?.(),0);assert.equal(hostname(),"ingenium-judge-verification-01");process.umask(0o077);
  const root="/opt/ingenium/judge-executor",spec=runtimeObject(JSON.parse((await protectedLinuxFile(new URL("candidate.json",import.meta.url).pathname,65536)).toString("utf8")),
    ["source_epoch","source_boot_id","target_boot_id","source_history_sha256","source_release_sha256","image_id","image_config_sha256","image_tree_sha256","host_sha256","capsule_sha256","expected_attempts","unstarted_preparation"]);
  for(const field of ["source_history_sha256","source_release_sha256","image_config_sha256","image_tree_sha256","host_sha256","capsule_sha256"])assert.ok(typeof spec[field]==="string"&&/^[0-9a-f]{64}$/.test(spec[field] as string));
  assert.ok(typeof spec.image_id==="string"&&/^sha256:[0-9a-f]{64}$/.test(spec.image_id));assert.ok(Array.isArray(spec.expected_attempts)&&spec.expected_attempts.length<=1000);for(const id of spec.expected_attempts)uuid(id);
  const raw=await rootRuntimeJson("/etc/ingenium/judge-launcher.json",4194304),old=parseHostRuntime(raw);
  assert.equal(old.hostEpochId,spec.source_epoch);assert.equal(old.release.digest,spec.source_release_sha256);assert.equal(old.bootId,uuid(spec.source_boot_id));
  const boot=uuid((await readFile("/proc/sys/kernel/random/boot_id","ascii")).trim());assert.equal(boot,uuid(spec.target_boot_id));
  const epoch=randomUUID();directory=`/var/lib/ingenium/candidate-rehearsal-${epoch}`;await mkdir(directory,{mode:0o700});
  async function save(name:string,value:unknown){
    const file=await open(`${directory}/${name}`,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o400);
    try{await file.writeFile(JSON.stringify(value)+"\n");await file.sync();}finally{await file.close();}
    const folder=await open(directory,constants.O_RDONLY|constants.O_DIRECTORY);try{await folder.sync();}finally{await folder.close();}
  }
  await save("intent",{scope:"PINNED_CANDIDATE_REHEARSAL",epoch,boot,spec,provider_schema:"STRUCTURAL_TEST_FIXTURE",event_deployed:false});
  let priorManifest=old.manifest,priorRelease=old.release;
  if(spec.unstarted_preparation!==null){
    stage="unstarted-preparation";const pending=uuid(spec.unstarted_preparation),path=`/var/lib/ingenium/candidate-rehearsal-${pending}`;
    const intent=await rootRuntimeJson(`${path}/intent`,8192) as {epoch:string;boot:string;spec:typeof spec};
    assert.equal(intent.epoch,pending);assert.equal(intent.boot,boot);assert.equal(intent.spec.source_epoch,old.hostEpochId);assert.equal(intent.spec.source_history_sha256,spec.source_history_sha256);
    const retained=await rootRuntimeJson(`${path}/candidate-release`,65536) as {manifest:typeof old.manifest;release:typeof old.release};
    priorManifest=reviewedHostRelease(retained.manifest,retained.release);priorRelease=retained.release;
    for(const missing of [`${path}/host-prepared`,`${path}/before-database-create`,`/var/lib/ingenium/judge-executor/host-verification/${pending}/verified`])await assert.rejects(lstat(missing),{code:"ENOENT"});
    await save("continued-unstarted-preparation",{epoch:pending});
  }
  stage="old-installation";const installed=await openHostInstallation(priorManifest,priorRelease,AbortSignal.timeout(10000));await installed.close();
  const candidateHost=await readFile(new URL("host-cli.js",import.meta.url)),candidateCapsule=await readFile(new URL("capsule-cli.js",import.meta.url));
  assert.equal(sha256(candidateHost).toString("hex"),spec.host_sha256);assert.equal(sha256(candidateCapsule).toString("hex"),spec.capsule_sha256);
  const ownerSecret=runtimeObject(await rootRuntimeJson("/var/lib/ingenium/registry-rehearsal-a6bf44ef-1c3a-4ac5-a26d-adda369c87bb/credentials",4096),["owner"]);assert.equal(typeof ownerSecret.owner,"string");
  const ownerUrl=new URL(old.databaseUrl);ownerUrl.username="ingenium_rehearsal_owner";ownerUrl.password=ownerSecret.owner as string;
  stage="original-database-identity";const database=await inspectRehearsalDatabase();assert.equal(database.row.State.Running,true);
  const ports=database.row.NetworkSettings.Ports["5432/tcp"];assert.equal(ports.length,1);assert.equal(ports[0].HostIp,"127.0.0.1");assert.match(ports[0].HostPort,/^[1-9][0-9]{0,4}$/);ownerUrl.port=ports[0].HostPort;
  const pool=(url:string,max=2)=>{const p=new Pool({connectionString:url,max,connectionTimeoutMillis:1000,query_timeout:5000});pools.push(p);p.on("error",()=>{});return p;};
  const prior=pool(ownerUrl.toString()),snapshot=async()=>(await prior.query(`SELECT to_jsonb(a) a,to_jsonb(s) s,to_jsonb(o) o FROM ingenium_judge.attempts a JOIN public.submissions s ON s.id=a.submission_id JOIN ingenium_judge.outbox o USING(attempt_id) ORDER BY a.attempt_id`)).rows;
  stage="source-history";const before=await snapshot();assert.deepEqual(before.map(row=>row.a.attempt_id),spec.expected_attempts);assert.equal(sha256(JSON.stringify(before)).toString("hex"),spec.source_history_sha256);
  const exec=promisify(execFile),docker=async(args:string[])=>(await exec(`${root}/docker`,["--config",`${root}/docker-client`,"--host","unix:///run/docker.sock",...args],{timeout:10000,maxBuffer:131072,env:{PATH:"/usr/bin:/bin",LANG:"C.UTF-8"}})).stdout.trim();
  const ids=await docker(["ps","-a","--no-trunc","--filter",`label=ingenium.executor.epoch=${old.hostEpochId}`,"--format","{{.ID}}"]);
  for(const id of ids?ids.split("\n"):[]){assert.match(id,/^[0-9a-f]{64}$/);const row=JSON.parse(await docker(["inspect","--format","{{json .}}",id]));assert.equal(row.Id,id);assert.equal(row.State.Running,false);assert.equal(row.State.Pid,0);assert.equal(row.Config.Labels["ingenium.executor.epoch"],old.hostEpochId);}
  if(spec.unstarted_preparation!==null){
    const pending=uuid(spec.unstarted_preparation),intent=await rootRuntimeJson(`/var/lib/ingenium/judge-executor/host-verification/${pending}/intent`,4096) as {nonce:string};
    assert.equal(await docker(["ps","-a","--filter",`label=ingenium.image-observation=${uuid(intent.nonce)}`,"--format","{{.ID}}"]),"");
    assert.equal(await docker(["ps","-a","--filter",`label=ingenium.executor.epoch=${pending}`,"--format","{{.ID}}"]),"");
  }
  await save("source-history",{sha256:sha256(JSON.stringify(before)).toString("hex"),attempts:spec.expected_attempts,retained_container_ids:ids});
  stage="preserve-release";const archived=`${directory}/original-release`,folders=new Set([archived]);await mkdir(archived,{mode:0o700});
  for(const file of priorManifest.files){const path=`${archived}/${file.path}`;await mkdir(dirname(path),{recursive:true,mode:0o700});for(let folder=dirname(path);folder.startsWith(archived);folder=dirname(folder))folders.add(folder);await copyFile(`${root}/${file.path}`,path,constants.COPYFILE_EXCL);await chmod(path,file.mode);const f=await open(path,constants.O_RDONLY);try{assert.equal(sha256(await f.readFile()).toString("hex"),file.sha256);await f.sync();}finally{await f.close();}}
  for(const path of [...folders].sort((a,b)=>b.length-a.length)){const f=await open(path,constants.O_RDONLY|constants.O_DIRECTORY);try{await f.sync();}finally{await f.close();}}
  await save("original-launcher",raw);await save("original-manifest",priorManifest);
  if(spec.unstarted_preparation===null){await save("before-fence",{epoch:old.hostEpochId});assert.equal((await prior.query("UPDATE ingenium_judge.control SET state='FENCED',ready_until='-infinity',readiness_proof=NULL WHERE epoch=$1 AND state='ACTIVE' RETURNING state",[old.hostEpochId])).rows[0]?.state,"FENCED");}
  else assert.equal((await prior.query("SELECT state FROM ingenium_judge.control WHERE epoch=$1",[old.hostEpochId])).rows[0]?.state,"FENCED");
  await save("fenced",{epoch:old.hostEpochId});
  const replacements=new Map([["app/judge/host-cli.js",candidateHost],["app/judge/capsule-cli.js",candidateCapsule]]);
  const manifest={...old.manifest,image_id:spec.image_id as string,image_config_sha256:spec.image_config_sha256 as string,files:old.manifest.files.map(file=>{const bytes=replacements.get(file.path);return bytes?{...file,size:bytes.length,sha256:sha256(bytes).toString("hex")}:file;})};
  const release={imageId:spec.image_id as string,digest:sha256(JSON.stringify(manifest)).toString("hex")};reviewedHostRelease(manifest,release);await save("candidate-release",{manifest,release});
  stage="install-reviewed-code";
  for(const [path,bytes] of replacements){if(sha256(await readFile(`${root}/${path}`)).equals(sha256(bytes)))continue;const temporary=`${directory}/${path.endsWith("host-cli.js")?"host":"capsule"}.next`,file=await open(temporary,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o400);try{await file.writeFile(bytes);await file.chmod(0o444);await file.sync();}finally{await file.close();}await rename(temporary,`${root}/${path}`);}
  const codeRoot=await open(`${root}/app/judge`,constants.O_RDONLY|constants.O_DIRECTORY);try{await codeRoot.sync();}finally{await codeRoot.close();}
  const runtimeManifests=await Promise.all(LANGUAGES.map(async language=>{
    const manifest={language,image:release.imageId,binaries:old.binaries,policy:EXECUTION_PLAN_SHA256};
    const digest=(await prior.query("SELECT encode(sha256(convert_to($1::jsonb::text,'UTF8')),'hex') digest",[JSON.stringify(manifest)])).rows[0].digest as string;
    assert.match(digest,/^[0-9a-f]{64}$/);return {language,key:`ingenium-${language}-${release.imageId.slice(7,19)}`,digest,manifest};
  }));await save("runtime-manifests",runtimeManifests);
  const runtimes=new Map(runtimeManifests.map(row=>[row.language,{key:row.key,digest:row.digest}])) as typeof old.runtimes;
  const settings={...old,hostEpochId:epoch,bootId:boot,release,manifest,runtimes,imageTreeSha256:spec.image_tree_sha256 as string};
  stage="host-preparation";const host=await openVerifiedHost(settings,release,manifest,AbortSignal.timeout(10000));let proof:Buffer;
  try{proof=await host.prepare(AbortSignal.timeout(80000));assert.ok(proof.equals(await host.assertReady(AbortSignal.timeout(5000))));}finally{await host.close();}
  await save("host-prepared",{epoch,boot,release,proof_digest:proof.toString("hex")});
  stage="new-registry";const db=`ingenium_rehearsal_${epoch.replaceAll("-","")}`;await save("before-database-create",{db});await prior.query(`CREATE DATABASE ${db}`);
  const url=new URL(ownerUrl);url.pathname=`/${db}`;const owner=pool(url.toString()),accounts=await prepareRehearsalDatabase(owner,url,settings,name=>readFile(new URL(name,import.meta.url),"utf8"),save);
  const next={...(raw as Record<string,unknown>),database_url:accounts[1]!.toString(),host_epoch_id:epoch,boot_id:boot,runtimes:Object.fromEntries(runtimes),image_tree_sha256:settings.imageTreeSha256,release:{image_id:release.imageId,digest:release.digest},manifest};
  const parsed=parseHostRuntime(next);await save("launcher-next",next);await rename(`${directory}/launcher-next`,"/etc/ingenium/judge-launcher.json");const configRoot=await open("/etc/ingenium",constants.O_RDONLY|constants.O_DIRECTORY);try{await configRoot.sync();}finally{await configRoot.close();}
  const ingress=pool(accounts[0]!.toString()),runner=pool(accounts[1]!.toString(),3),results=await runFixedHostExecutions(parsed,ingress,runner,proof.toString("hex"),save,value=>{stage=value;});
  assert.deepEqual(await createJudgeSupervisorStore(runner,parsed).held(),[]);assert.equal(await createJudgeRegistry(ingress,parsed).ready(),false);assert.deepEqual(await snapshot(),before);await save("completed",{results,prior_fenced_history_unchanged:true});
  console.log("PASS: pinned candidate compiled and ran all five languages; original permits, history and stopped resources preserved under fenced epoch");console.log(JSON.stringify({scope:"PINNED_CANDIDATE_REHEARSAL",epoch,image_id:release.imageId,provider_schema:"STRUCTURAL_TEST_FIXTURE",event_deployed:false,results,evidence:directory}));
}catch(error){console.error(`FAIL: candidate rehearsal ${stage}; preserve ${directory||"the installation"}, all epochs, records and physical resources. ${error instanceof Error?error.name:"UnknownError"}`);process.exitCode=1;}
finally{for(const pool of pools)await pool.end();}
