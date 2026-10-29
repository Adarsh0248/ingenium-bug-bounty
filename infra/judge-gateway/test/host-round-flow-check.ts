import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {hostname} from 'node:os';
import {mkdir,open} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {Client} from 'pg';
import {rootRuntimeJson} from '../../../apps/api/src/runtime/private-file.js';
import {createAuthoringJudgeDriver} from '../../../apps/api/src/content/judge-driver.js';
import type {JudgeDriverSettings} from '../../../apps/api/src/content/judge-driver.js';
import type {Language} from '../../../apps/api/src/access/credentials.js';
import {runLocalRoundFlow} from '../../../apps/api/test/fixtures/host-round-flow.js';
import type {RuntimeManifestFixture} from '../../../apps/api/test/fixtures/host-round-flow.js';

const image='docker.io/library/postgres:17.11-bookworm@sha256:3645570cccdfa447589da9f57dd740faa29b30938e861289a5574b6ca6b03826';
let directory='',container='',completed=false;
const exec=promisify(execFile),docker=async(args:string[],env=process.env)=>(await exec('/opt/ingenium/judge-executor/docker',args,{env,timeout:30000,maxBuffer:65536})).stdout.trim();
try{
  assert.equal(process.argv.length,4);assert.equal(process.getuid?.(),0);assert.equal(hostname(),'ingenium-judge-verification-01');
  const mode=process.argv[2];assert.ok(mode==='--burst'||mode==='--rounds');
  assert.match(process.argv[3]!,/^\/var\/lib\/ingenium\/services-rehearsal-[0-9a-f-]{36}\/bridge-client$/);process.umask(0o077);
  const raw=await rootRuntimeJson(process.argv[3]!,65536) as Omit<JudgeDriverSettings,'runtimes'|'ca'|'certificate'|'privateKey'>&{runtimes:[Language,{key:string;digest:string}][];ca:string;certificate:string;privateKey:string;manifests:RuntimeManifestFixture[]};
  assert.equal(raw.address,'127.0.0.1');assert.equal(raw.port,13360);
  const driver=createAuthoringJudgeDriver({...raw,port:23590,runtimes:new Map(raw.runtimes),ca:Buffer.from(raw.ca),certificate:Buffer.from(raw.certificate),privateKey:Buffer.from(raw.privateKey)});
  await driver.assertReady(AbortSignal.timeout(10000));
  const nonce=randomUUID();directory=`/var/lib/ingenium/app-round-rehearsal-${nonce}`;await mkdir(directory,{mode:0o700});
  async function save(name:string,value:unknown){assert.match(name,/^[a-z-]+$/);const f=await open(`${directory}/${name}.json`,'wx',0o400);try{await f.writeFile(JSON.stringify(value)+'\n');await f.sync();}finally{await f.close();}}
  const ownerPassword=randomBytes(24).toString('hex'),apiPassword=randomBytes(24).toString('hex');
  await save('intent',{scope:mode==='--burst'?'LINUX_REAL_COMPILER_BURST':'LINUX_REAL_SHOP_ROUND_FLOW',nonce,epoch:raw.hostEpochId,event_deployed:false});
  container=await docker(['create','--pull=never','--name',`ingenium-app-round-${nonce}`,'--label',`ingenium.app-round-rehearsal=${nonce}`,'--restart','no','--read-only','--user','999:999','--cap-drop','ALL','--security-opt','no-new-privileges=true','--memory','768m','--memory-swap','768m','--cpus','1','--pids-limit','128','--publish','127.0.0.1::5432','--env','POSTGRES_USER=ingenium_schema_owner','--env','POSTGRES_DB=ingenium_schema_test','--env','POSTGRES_PASSWORD','--env','POSTGRES_API_PASSWORD','--tmpfs','/var/lib/postgresql/data:rw,nosuid,nodev,noexec,size=512m,uid=999,gid=999,mode=0700','--tmpfs','/var/run/postgresql:rw,nosuid,nodev,noexec,size=8m,uid=999,gid=999,mode=0700','--tmpfs','/tmp:rw,nosuid,nodev,noexec,size=16m,uid=999,gid=999,mode=0700','--mount',`type=bind,src=${fileURLToPath(new URL('./01-api-role.sql',import.meta.url))},dst=/docker-entrypoint-initdb.d/01-api-role.sql,readonly`,'--log-driver','json-file','--log-opt','max-size=1m','--log-opt','max-file=1',image],{...process.env,POSTGRES_PASSWORD:ownerPassword,POSTGRES_API_PASSWORD:apiPassword});
  assert.match(container,/^[0-9a-f]{64}$/);await save('container',{id:container});await docker(['start',container]);
  const ports=JSON.parse(await docker(['inspect','--format','{{json .NetworkSettings.Ports}}',container]))['5432/tcp'];assert.equal(ports.length,1);assert.equal(ports[0].HostIp,'127.0.0.1');
  const ownerUrl=new URL(`postgres://127.0.0.1:${ports[0].HostPort}/ingenium_schema_test`);ownerUrl.username='ingenium_schema_owner';ownerUrl.password=ownerPassword;
  const apiUrl=new URL(ownerUrl);apiUrl.username='ingenium_api';apiUrl.password=apiPassword;
  await save('private-database',{owner:ownerUrl.toString(),api:apiUrl.toString()});
  let ready=false;
  for(let attempt=0;attempt<60&&!ready;attempt++){const client=new Client({connectionString:ownerUrl.toString(),connectionTimeoutMillis:500});try{await client.connect();await client.query('SELECT 1');ready=true;}catch{await delay(500);}finally{await client.end();}}
  assert.ok(ready,'The isolated database did not start.');
  console.log(JSON.stringify({scope:'LINUX_ROUND_REHEARSAL_STARTED',mode,evidence:directory,event_deployed:false}));
  await runLocalRoundFlow(ownerUrl.toString(),apiUrl.toString(),driver,raw.manifests,mode==='--burst'?'REAL_BURST':'REAL',save);
  const config=JSON.parse(await docker(['inspect','--format','{{json .Config}}',container]));assert.equal(config.Image,image);assert.equal(config.Labels['ingenium.app-round-rehearsal'],nonce);
  await docker(['stop','--time','5',container]);assert.equal(await docker(['inspect','--format','{{.State.Running}}',container]),'false');await docker(['rm',container]);completed=true;
  console.log(`PASS: Linux application and real protected judge rehearsal; only its labelled successful database removed; evidence ${directory}`);
}catch(error){console.error(`FAIL: Linux round rehearsal; preserve ${directory||'the original context'}, database ${container||'not created'}, all receipts and permits. ${error instanceof Error?error.message:'UnknownError'}`);process.exitCode=1;}
finally{if(!completed&&container)console.error('Original database retained; do not replay admissions.');}
