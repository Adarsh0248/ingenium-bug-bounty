import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {constants} from "node:fs";
import {mkdir,open} from "node:fs/promises";
import {hostname} from "node:os";
import {Pool} from "pg";
import {rootRuntimeJson} from "../../../apps/api/src/runtime/private-file.js";
import {parseHostRuntime} from "../../../apps/api/src/judge/host-config.js";
import {createJudgeRegistry,createJudgeSupervisorStore} from "../../../apps/api/src/judge/registry.js";
import {HOST_FAILURE_CASES} from "../../../apps/api/test/fixtures/host-failures.js";
import {runHostExecutionCases} from "../../../apps/api/test/fixtures/host-executions.js";
let stage="caller",directory="";const pools:Pool[]=[];
try{
  assert.equal(process.argv.length,2);assert.equal(hostname(),"ingenium-judge-verification-01");assert.equal(process.getuid?.(),0);process.umask(0o077);
  const parsed=parseHostRuntime(await rootRuntimeJson("/etc/ingenium/judge-launcher.json",4194304));
  const prior=`/var/lib/ingenium/candidate-rehearsal-${parsed.hostEpochId}`;
  const completed=await rootRuntimeJson(`${prior}/completed`,32768) as {results:unknown[]};assert.equal(completed.results.length,5);
  const prepared=await rootRuntimeJson(`${prior}/host-prepared`,4096) as {proof_digest:string};
  const credentials=await rootRuntimeJson(`${prior}/credential-ingenium_rehearsal_ingress_${parsed.hostEpochId.replaceAll("-","").slice(0,12)}`,4096) as {secret:string};
  const url=new URL(parsed.databaseUrl);url.username=url.username.replace("_runner_","_ingress_");url.password=credentials.secret;
  const pool=(connectionString:string)=>{const p=new Pool({connectionString,max:3,connectionTimeoutMillis:1000,query_timeout:5000});p.on("error",()=>{});pools.push(p);return p;};
  const ingress=pool(url.toString()),runner=pool(parsed.databaseUrl),registry=createJudgeRegistry(ingress,parsed),store=createJudgeSupervisorStore(runner,parsed);
  assert.equal(await registry.ready(),false);assert.deepEqual(await store.held(),[]);
  directory=`/var/lib/ingenium/failure-rehearsal-${randomUUID()}`;await mkdir(directory,{mode:0o700});
  async function save(name:string,value:unknown){const f=await open(`${directory}/${name}`,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o400);try{await f.writeFile(JSON.stringify(value)+"\n");await f.sync();}finally{await f.close();}const d=await open(directory,constants.O_RDONLY|constants.O_DIRECTORY);try{await d.sync();}finally{await d.close();}}
  await save("intent",{scope:"INSTALLED_FAILURE_AND_BOUNDARY_CASES",epoch:parsed.hostEpochId,cases:HOST_FAILURE_CASES.map(c=>c.id),event_deployed:false});
  const results=await runHostExecutionCases(parsed,ingress,runner,prepared.proof_digest,HOST_FAILURE_CASES,save,value=>{stage=value;});
  assert.deepEqual(await store.held(),[]);assert.equal(await registry.ready(),false);await save("completed",{results});
  console.log(JSON.stringify({scope:"INSTALLED_FAILURE_AND_BOUNDARY_CASES",event_deployed:false,results,evidence:directory}));
}catch(error){console.error(`FAIL: installed failure checks ${stage}; preserve ${directory||"the original context"}, records and resources. ${error instanceof Error?error.name:"UnknownError"}`);process.exitCode=1;}
finally{for(const p of pools)await p.end();}
