import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomBytes,randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";
import { Pool } from "pg";
import { prepareRehearsalDatabase } from "../fixtures/host-registry.js";
import { assertJudgeDatabaseRole } from "../../src/judge/database-role.js";
import { createJudgeRegistry } from "../../src/judge/registry.js";
import { judgeRuntimes } from "../fixtures/judge.js";

test("host rehearsal bootstrap applies actual migrations on a new persistent test volume, with restricted accounts and no readiness/permits",{timeout:90000},async()=>{
  const exec=promisify(execFile),nonce=randomUUID(),volume=`ingenium-registry-bootstrap-${nonce}`,password=randomBytes(32).toString("hex");
  const image="docker.io/library/postgres:17.11-bookworm@sha256:3645570cccdfa447589da9f57dd740faa29b30938e861289a5574b6ca6b03826";
  const docker=async(args:string[])=>(await exec("docker",args,{timeout:30000,maxBuffer:32768,windowsHide:true,env:{...process.env,POSTGRES_PASSWORD:password}})).stdout.trim();
  assert.equal(await docker(["volume","create","--label",`ingenium.registry-bootstrap=${nonce}`,volume]),volume);
  const pools:Pool[]=[];let id:string|undefined;
  try{
    id=await docker(["create","--pull=never","--label",`ingenium.registry-bootstrap=${nonce}`,"--restart","no","--read-only","--user","999:999","--cap-drop","ALL",
      "--security-opt","no-new-privileges=true","--memory","512m","--memory-swap","512m","--cpus","0.5","--pids-limit","64","--publish","127.0.0.1::5432",
      "--env","POSTGRES_USER=ingenium_rehearsal_owner","--env","POSTGRES_DB=ingenium_registry_rehearsal","--env","POSTGRES_PASSWORD","--mount",`type=volume,src=${volume},dst=/var/lib/postgresql/data`,
      "--tmpfs","/var/run/postgresql:rw,nosuid,nodev,noexec,size=8m,uid=999,gid=999,mode=0700","--tmpfs","/tmp:rw,nosuid,nodev,noexec,size=16m,uid=999,gid=999,mode=0700",
      "--log-driver","none",image,"postgres","-c","max_connections=20","-c","shared_buffers=32MB","-c","max_wal_size=64MB","-c","min_wal_size=32MB"]);
    assert.match(id,/^[0-9a-f]{64}$/);await docker(["start",id]);
    const port=await docker(["inspect","--format",'{{(index (index .NetworkSettings.Ports "5432/tcp") 0).HostPort}}',id]);assert.match(port,/^[1-9][0-9]{0,4}$/);
    const url=new URL(`postgresql://127.0.0.1:${port}/ingenium_registry_rehearsal`);url.username="ingenium_rehearsal_owner";url.password=password;
    const pool=(url:URL)=>{const p=new Pool({connectionString:url.toString(),max:2,connectionTimeoutMillis:1000,query_timeout:5000});pools.push(p);p.on("error",()=>{});return p;};
    const owner=pool(url);for(let i=0;;i++){try{await owner.query("SELECT 1");break;}catch{assert.ok(i<60);await delay(500);}}
    const config={hostEpochId:randomUUID(),bootId:randomUUID(),runtimes:judgeRuntimes()},receipts:string[]=[];
    const accounts=await prepareRehearsalDatabase(owner,url,config,
      name=>readFile(new URL(`../../../../infra/judge-gateway/${name==="provider-structural.sql"?"test/":""}${name}`,import.meta.url),"utf8"),async name=>{assert.ok(!receipts.includes(name));receipts.push(name);});
    assert.equal(accounts.length,2);assert.equal(receipts.length,16);
    const ingress=pool(accounts[0]!),runner=pool(accounts[1]!);
    await assertJudgeDatabaseRole(ingress,"gateway");await assertJudgeDatabaseRole(runner,"supervisor");await assert.rejects(assertJudgeDatabaseRole(owner,"supervisor"));
    await assert.rejects(assertJudgeDatabaseRole(ingress,"supervisor"));await assert.rejects(assertJudgeDatabaseRole(runner,"gateway"));
    assert.equal(await createJudgeRegistry(ingress,config).ready(),false);
    assert.equal((await owner.query("SELECT ingenium_judge.compatible() AS compatible")).rows[0].compatible,true);
    assert.deepEqual((await owner.query("SELECT (SELECT count(*)::int FROM public.submissions) providers,(SELECT count(*)::int FROM ingenium_judge.attempts) attempts,(SELECT count(*)::int FROM ingenium_judge.runtimes) runtimes")).rows[0],{providers:0,attempts:0,runtimes:5});
    await assert.rejects(ingress.query("SELECT * FROM ingenium_judge.attempts"),{code:"42501"});
    await assert.rejects(runner.query("SELECT * FROM public.submissions"),{code:"42501"});
  }finally{
    for(const pool of pools)await pool.end();
    if(id){const config=JSON.parse(await docker(["inspect","--format","{{json .Config}}",id]));assert.equal(config.Image,image);assert.equal(config.Labels["ingenium.registry-bootstrap"],nonce);await docker(["stop","--timeout","5",id]);await docker(["rm",id]);}
    const config=JSON.parse(await docker(["volume","inspect","--format","{{json .}}",volume]));assert.equal(config.Name,volume);assert.equal(config.Labels["ingenium.registry-bootstrap"],nonce);await docker(["volume","rm",volume]);
  }
});
