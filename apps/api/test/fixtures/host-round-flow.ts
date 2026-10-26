import assert from "node:assert/strict";
import {randomBytes,randomUUID} from "node:crypto";
import {setTimeout as delay} from "node:timers/promises";
import {Pool} from "pg";
import {readFile} from "node:fs/promises";
import {LANGUAGES,newAccessCode,sessionDelivery,parseProof} from "../../src/access/credentials.js";
import {migrateDatabase} from "../../src/db/migrate.js";
import {createEntryService} from "../../src/access/entry-service.js";
import {createStaffService} from "../../src/access/staff-service.js";
import {createArenaService} from "../../src/access/arena-service.js";
import {AccessError} from "../../src/access/transaction.js";
import {createContentService} from "../../src/content/service.js";
import {createValidationService} from "../../src/content/validation-service.js";
import {createValidationRunService} from "../../src/content/validation-runs.js";
import {createValidationWorker} from "../../src/content/validation-worker.js";
import {createPublicationService} from "../../src/content/publication-service.js";
import {createCompetitionService} from "../../src/competition/service.js";
import type {CompetitionCommand} from "../../src/competition/service.js";
import type {TrustedAuthoringDriver} from "../../src/content/execution-policy.js";
import {acceptJudgeReply} from "../../src/content/judge-protocol.js";
import {startJudgingWorker,assertWorkerDatabase} from "../../src/worker/judging.js";
import {competitionRuntime} from "../../src/worker/readiness.js";
import {judgeReply} from "./judge.js";
import {FIXED_HOST_SOURCES} from "./host-executions.js";

export interface RuntimeManifestFixture {language:(typeof LANGUAGES)[number];key:string;digest:string;manifest:unknown;}
export async function runLocalRoundFlow(ownerConnection:string,apiConnection:string,driver:TrustedAuthoringDriver,manifests:RuntimeManifestFixture[],mode:"REAL"|"SYNTHETIC_PREFLIGHT"|"REAL_BURST"|"SYNTHETIC_BURST",save:(name:string,value:unknown)=>Promise<void>){
  const burst=mode==="REAL_BURST"||mode==="SYNTHETIC_BURST";
  const ownerUrl=new URL(ownerConnection),apiUrl=new URL(apiConnection);
  assert.equal(ownerUrl.hostname,"127.0.0.1");assert.equal(apiUrl.hostname,"127.0.0.1");
  assert.equal(ownerUrl.username,"ingenium_schema_owner");assert.equal(apiUrl.username,"ingenium_api");assert.equal(ownerUrl.pathname,"/ingenium_schema_test");
  const name=`ingenium_rounds_${randomUUID().replaceAll("-","")}`;
  const bootstrap=new Pool({connectionString:ownerConnection,max:1});
  try{await bootstrap.query(`CREATE DATABASE ${name}`);}finally{await bootstrap.end();}
  ownerUrl.pathname=apiUrl.pathname=`/${name}`;await migrateDatabase(ownerUrl.toString());
  const pool=(url:string,max=3)=>{const p=new Pool({connectionString:url,max,connectionTimeoutMillis:1000,query_timeout:5000});p.on("error",()=>{});return p;};
  const owner=pool(ownerUrl.toString()),api=pool(apiUrl.toString(),burst?12:3),workerUrl=new URL(ownerUrl);
  if(burst)await owner.query(await readFile(new URL("../../../../infra/app-host/event-capacity.sql",import.meta.url),"utf8"));
  const role=`ingenium_round_worker_${randomUUID().replaceAll("-","")}`,password=randomBytes(32).toString("hex");
  await owner.query((await owner.query("SELECT format('CREATE ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD %L IN ROLE ingenium_app_worker',$1::text,$2::text) sql",[role,password])).rows[0].sql);
  workerUrl.username=role;workerUrl.password=password;const runner=pool(workerUrl.toString(),4);
  const clock={assertHealthy(){},async verify(){},fault(){throw new Error("Synthetic local clock fault");}};
  let worker:ReturnType<typeof startJudgingWorker>|undefined,stage="runtime-registration",workerFaults=0;
  async function until(check:()=>Promise<boolean>,limit=120000){const end=performance.now()+limit;while(!await check()){assert.ok(performance.now()<end,`${stage} exceeded its deadline`);await delay(250);}}
  try{
    await assertWorkerDatabase(runner);
    assert.equal(manifests.length,5);
    for(const row of manifests){assert.equal(row.key,driver.runtimes.get(row.language)?.key);const actual=(await owner.query("INSERT INTO runtime_manifests(key,language,manifest,digest,created_at) VALUES($1,$2,$3::jsonb,sha256(convert_to($3::jsonb::text,'UTF8')),date_trunc('milliseconds',clock_timestamp())) RETURNING encode(digest,'hex') digest",[row.key,row.language,JSON.stringify(row.manifest)])).rows[0].digest;assert.equal(actual,row.digest);assert.equal(actual,driver.runtimes.get(row.language)?.digest);}
    await owner.query("INSERT INTO judge_host_epochs(id,state,endpoint_ref,created_at) VALUES($1,'ACTIVE',$2,date_trunc('milliseconds',clock_timestamp()))",[driver.hostEpochId,driver.endpointRef]);
    for(const [language,runtime]of driver.runtimes)await owner.query("INSERT INTO judge_host_runtimes VALUES($1,$2,$3)",[driver.hostEpochId,language,runtime.key]);
    const delivery=sessionDelivery("isolated-round-flow",randomBytes(32)),entry=createEntryService(api,clock,delivery),staff=createStaffService(api,clock,delivery);
    const content=createContentService(api,clock,delivery),validation=createValidationService(api,clock,delivery),arena=createArenaService(api,clock,delivery);
    const deps=competitionRuntime(api,clock,{hostEpochId:driver.hostEpochId,endpointRef:driver.endpointRef,runtimes:driver.runtimes,drawKey:randomBytes(32),drawKeyId:"isolated-round-flow"}),competition=createCompetitionService(api,clock,delivery,deps);
    async function person(){const id=randomUUID(),code=newAccessCode();await owner.query("INSERT INTO staff_identities(id,display_name,role) VALUES($1,'Isolated round-flow owner','OWNER')",[id]);await owner.query("INSERT INTO access_credentials(id,staff_id,verifier,version,issued_at) VALUES($1,$2,$3,1,date_trunc('milliseconds',clock_timestamp()))",[randomUUID(),id,code.verifier]);const flow=await entry.begin(code.code,{ip:"127.0.0.1",browserId:randomUUID()});assert.equal(flow.audience,"STAFF");return {...await staff.activate(flow.proofCookie,randomUUID()),code:code.code};}
    const actor=await person();
    // Publication setup is synthetic; only participant Run/Submit below uses the real installed judge.
    const seedDriver={...driver,async submit(p:Parameters<typeof driver.submit>[0]){const nonce=randomUUID(),value=judgeReply(p,nonce,Buffer.from(p.sourceRole==="STARTER"?"0\n":"12\n"));return acceptJudgeReply(value,p,nonce,200);},async observe(p:Parameters<typeof driver.observe>[0]){return this.submit(p);}};
    const seedWorker=createValidationWorker(api,clock,seedDriver);await seedWorker.claim();
    async function fixture(round:number){
      const edit=async(action:Parameters<typeof content.command>[1]["action"],targetId:string|null,payload:unknown)=>{
        await owner.query("DELETE FROM quota_buckets");const revision=(await owner.query(action==="CREATE"?"SELECT revision FROM catalogue_control WHERE id=1":"SELECT content_revision revision FROM bug_versions WHERE id=$1",action==="CREATE"?[]:[targetId])).rows[0].revision;
        return content.command(actor.sessionCookie,{action,targetId,payload,expectedRevision:revision,requestKey:randomUUID(),reason:"Isolated published fixture setup"});
      };
      const version=(await edit("CREATE",null,{round_type:round,title:"Isolated addition fixture",statement:"Read two integers and print their sum.",difficulty:round===1?100:80,checker_mode:"EXACT_TEXT"})).version_id!;
      const starters={c:'#include <stdio.h>\nint main(void){puts("0");}\n',cpp:'#include <cstdio>\nint main(){puts("0");}\n',java:'public class Main{public static void main(String[]a){System.out.println(0);}}\n',python:'print(0)\n',javascript:'console.log(0);\n'};
      for(const language of LANGUAGES)await edit("VARIANT",version,{language,starter_code:starters[language],reference_solution_code:FIXED_HOST_SOURCES[language],defect_description:"The starter ignores its inputs and prints zero.",runtime_key:driver.runtimes.get(language)!.key,cpu_time_limit_ms:2000,wall_time_limit_ms:10000,memory_limit_kb:524288});
      await edit("CASE",version,{case_id:null,position:1,visibility:"SAMPLE",input_data:"7 5\n",expected_output:"12\n"});
      const hidden=(await edit("CASE",version,{case_id:null,position:2,visibility:"HIDDEN",input_data:"5 7\n",expected_output:"12\n"})).case_id!;
      for(const level of [1,2,3])await edit("HINT",version,{level,content:`Isolated hint ${level}`});
      for(const language of LANGUAGES)await edit("WITNESSES",version,{language,witnesses:[{check_type:"TEST_CASE",test_case_id:hidden,expected_failure:"WRONG_OUTPUT"}]});
      const revision=(await owner.query("SELECT content_revision FROM bug_versions WHERE id=$1",[version])).rows[0].content_revision;
      const snapshot=(await validation.prepare(actor.sessionCookie,{versionId:version,expectedRevision:revision,requestKey:randomUUID(),reason:"Isolated fixture capture"})).snapshot_id!;
      const run=(await createValidationRunService(api,clock,delivery).admit(actor.sessionCookie,{snapshotId:snapshot,expectedRevision:revision,requestKey:randomUUID(),reason:"Synthetic fixture validation"})).run_id!;
      await until(async()=>{await seedWorker.tick();return(await owner.query("SELECT status FROM validation_runs WHERE id=$1",[run])).rows[0].status==="PASSED";});
      await createPublicationService(api,clock,delivery).publish(actor.sessionCookie,{snapshotId:snapshot,runId:run,expectedRevision:revision,requestKey:randomUUID(),review:"Synthetic content setup; participant execution is independently real",ownCode:actor.code});return snapshot;
    }
    stage="fixture-publication";const first=await fixture(1),second=await fixture(2);await owner.query("DELETE FROM quota_buckets");
    const teams:{id:string;code:string;members:string[]}[]=[];for(let i=0;i<(burst?100:2);i++){const id=randomUUID(),code=newAccessCode(),members=[randomUUID(),randomUUID()];await owner.query("INSERT INTO teams(id,display_name) VALUES($1,$2)",[id,`Isolated team ${i}`]);await owner.query("INSERT INTO team_members(id,team_id,position,display_name) VALUES($1,$3,1,'First'),($2,$3,2,'Second')",[...members,id]);await owner.query("INSERT INTO access_credentials(id,team_id,verifier,version,issued_at) VALUES($1,$2,$3,1,date_trunc('milliseconds',clock_timestamp()))",[randomUUID(),id,code.verifier]);teams.push({id,code:code.code,members});}
    await until(async()=>(await owner.query("SELECT lease_until<=clock_timestamp() expired FROM judge_control WHERE id=1")).rows[0].expired,45000);
    worker=startJudgingWorker(runner,clock,driver,()=>{workerFaults++;});
    const command=async(action:CompetitionCommand["action"],round:string,payload={})=>{
      stage=`${action.toLowerCase()}-control`;const request={action,roundId:round,payload,requestKey:randomUUID(),expectedRevision:(await owner.query("SELECT revision FROM rounds WHERE id=$1",[round])).rows[0].revision,reason:"Isolated real round flow",ownCode:actor.code};
      for(let attempt=0;;attempt++){try{return await competition.command(actor.sessionCookie,request);}catch(error){if(!(error instanceof AccessError)||error.code!=="RATE_LIMITED"||attempt>=3||!error.retryAfterSeconds||error.retryAfterSeconds>60)throw error;await delay(error.retryAfterSeconds*1000);}}
    };
    const join=async(team:typeof teams[number],language:typeof LANGUAGES[number],member=0)=>{const flow=await entry.begin(team.code,{ip:"127.0.0.1",browserId:randomUUID()});assert.equal(flow.audience,"TEAM");const a=await entry.activate(flow.proofCookie,{memberId:team.members[member]!,language,requestKey:randomUUID()});assert.equal(a.status,"ACTIVATED");return a;};
    const ready=()=>until(async()=>{try{await deps.assertReady(new AbortController().signal);return true;}catch{return false;}},30000);
    const complete=async(id:string)=>{await until(async()=>Boolean((await owner.query("SELECT completed_at FROM participant_judging WHERE id=$1",[id])).rows[0]?.completed_at),180000);return(await owner.query("SELECT result FROM participant_judging WHERE id=$1",[id])).rows[0].result;};
    const admit=async(cookie:string,round:string,bug:string,language:typeof LANGUAGES[number],sample=false,wrong=false)=>{
      stage=`${sample?"sample":"official"}-${language}`;
      if(!sample){const last=(await owner.query("SELECT max(p.created_at) at FROM participant_judging p JOIN participant_sessions s ON s.member_round_id=p.member_round_id WHERE s.id=$1 AND p.lane='OFFICIAL'",[parseProof(cookie)?.id])).rows[0].at as Date|null;if(last)await delay(Math.max(0,last.getTime()+5010-Date.now()));}
      const source=wrong?FIXED_HOST_SOURCES[language].replaceAll("a+b","a+b+1"):FIXED_HOST_SOURCES[language];const r=await competition[sample?"run":"submit"](cookie,round,bug,source,randomUUID());assert.equal(r.result.status,"ADMITTED");return(r.result.run_id??r.result.submission_id) as string;
    };
    stage="round-one";await ready();const r1=(await arena.command(actor.sessionCookie,{action:"CREATE",roundId:null,requestKey:randomUUID(),expectedRevision:"0",durationMs:18000000,teamIds:teams.map(t=>t.id),reason:"Isolated actual-judge round one"})).round_id!;
    await command("CONFIGURE",r1,{snapshots:[first]});await command("READY",r1);await command("START",r1);
    if(burst){
      stage="burst-enrolment";const members:{cookie:string;language:typeof LANGUAGES[number]}[]=[];
      for(let i=0;i<teams.length;i++){
        // Fixture setup only; no quota counters change in the measured burst or settlement.
        if(i%10===0)await owner.query("DELETE FROM quota_buckets");
        for(let member=0;member<2;member++){const language=LANGUAGES[(i*2+member)%5]!,a=await join(teams[i]!,language,member);members.push({cookie:a.sessionCookie,language});}
      }
      const bounty=(await owner.query("SELECT id FROM bounties WHERE round_id=$1",[r1])).rows[0].id;
      await owner.query("DELETE FROM quota_buckets");stage="burst-admission";
      const at=performance.now(),latency:number[]=[];
      const replies=[];
      for(let i=0;i<members.length;i+=16)replies.push(...await Promise.all(members.slice(i,i+16).map(async m=>{const begin=performance.now(),key=randomUUID(),r=await competition.submit(m.cookie,r1,bounty,FIXED_HOST_SOURCES[m.language],key);latency.push(performance.now()-begin);return{m,key,receipt:r};})));
      const accepted=replies.filter(r=>r.receipt.result.status==="ADMITTED"),refused=replies.filter(r=>r.receipt.result.status!=="ADMITTED");
      assert.equal(accepted.length,100);assert.equal(refused.length,100);assert.equal(new Set(accepted.map(r=>r.receipt.result.submission_id)).size,100);
      await save("burst-admitted",{admitted:100,refused:100,service_admission_ms:Math.round(performance.now()-at)});
      console.log(`BURST: 200 service requests, 100 retained receipts, 100 team/bug refusals; no quota reset`);
      stage="burst-sample";const sampleAt=performance.now(),sample=await competition.run(members[0]!.cookie,r1,bounty,FIXED_HOST_SOURCES[members[0]!.language],randomUUID());
      assert.equal(sample.result.status,"ADMITTED");assert.equal(await complete(sample.result.run_id as string),"PASSED");
      const sampleMs=Math.round(performance.now()-sampleAt);stage="burst-settlement";
      await until(async()=>(await owner.query("SELECT count(*)::int n FROM participant_judging WHERE round_id=$1 AND lane='OFFICIAL' AND completed_at IS NULL",[r1])).rows[0].n===0,1200000);
      assert.equal((await owner.query("SELECT count(*)::int n FROM participant_judging WHERE round_id=$1 AND lane='OFFICIAL' AND result='PASSED'",[r1])).rows[0].n,100);
      assert.equal((await owner.query("SELECT count(*)::int n FROM bounty_awards WHERE bounty_id=$1",[bounty])).rows[0].n,100);
      assert.equal((await owner.query("SELECT count(*)::int n FROM execution_capacity_slots WHERE participant_attempt_id IS NOT NULL")).rows[0].n,0);
      for(const r of accepted.slice(0,5))assert.equal((await competition.submit(r.m.cookie,r1,bounty,FIXED_HOST_SOURCES[r.m.language],r.key)).result.submission_id,r.receipt.result.submission_id);
      // A real compiler queue may outlast the staff idle window; use normal sign-in rather than extending its deadline.
      const freshFlow=await entry.begin(actor.code,{ip:"127.0.0.1",browserId:randomUUID()});assert.equal(freshFlow.audience,"STAFF");
      const freshStaff=await staff.activate(freshFlow.proofCookie,randomUUID());assert.equal(freshStaff.session.staff_id,actor.session.staff_id);
      assert.notEqual(freshStaff.sessionCookie,actor.sessionCookie);await assert.rejects(staff.inspect(actor.sessionCookie));actor.sessionCookie=freshStaff.sessionCookie;
      await command("CLOSE",r1);await command("FINALISE",r1);
      latency.sort((a,b)=>a-b);
      const report={scope:mode==="REAL_BURST"?"REAL_COMPILER_100_TEAM_SERVICE_BURST":"SYNTHETIC_BURST_PREFLIGHT",admission_transport:"IN_PROCESS_AUTHORISED_SERVICE",admission_parallelism:16,application_slots:(await owner.query("SELECT count(*)::int n FROM execution_capacity_slots")).rows[0].n,participant_execution_real:mode==="REAL_BURST",fixture_authoring_synthetic:true,synthetic_clock:true,teams:100,members:200,admitted:100,refused:100,official_passed:100,independent_awards:100,staff_fresh_signin:true,sample_ms:sampleMs,elapsed_ms:Math.round(performance.now()-at),service_admission_p95_ms:Math.ceil(latency[189]!),worker_fault_notifications:workerFaults,event_deployed:false};
      await save("completed",report);console.log(`PASS: ${report.scope}; original official receipts settled without permit replay`);console.log(JSON.stringify(report));return;
    }
    const a=await join(teams[0]!,"cpp"),b=await join(teams[1]!,"python"),bug1=(await owner.query("SELECT id FROM bounties WHERE round_id=$1",[r1])).rows[0].id;
    const sample=await admit(a.sessionCookie,r1,bug1,"cpp",true);assert.equal(await complete(sample),"PASSED");
    const ax=await admit(a.sessionCookie,r1,bug1,"cpp"),bx=await admit(b.sessionCookie,r1,bug1,"python");assert.equal(await complete(ax),"PASSED");assert.equal(await complete(bx),"PASSED");assert.equal((await owner.query("SELECT count(*)::int n FROM bounty_awards WHERE bounty_id=$1",[bug1])).rows[0].n,2);
    await command("CLOSE",r1);await command("FINALISE",r1);await command("QUALIFY",r1);
    stage="round-two";const r2=(await command("SETUP_R2",r1,{teams:teams.map(t=>t.id),duration_ms:18000000})).result.round_id as string;
    await command("CONFIGURE",r2,{snapshots:[second]});await command("READY",r2);await ready();await command("START",r2);
    const aa=await join(teams[0]!,"javascript"),bb=await join(teams[1]!,"c"),bug2=(await owner.query("SELECT id FROM bounties WHERE round_id=$1",[r2])).rows[0].id;
    const standings=(await owner.query("SELECT competition_standings($1) value",[r2])).rows[0].value as {points:number}[];assert.ok(standings.every(row=>row.points===0));
    const teamA=(await owner.query("SELECT id,competition_balance(id) balance FROM team_rounds WHERE team_id=$1 AND round_id=$2",[teams[0]!.id,r2])).rows[0];assert.ok(BigInt(teamA.balance)>0n);
    const wrong=await admit(bb.sessionCookie,r2,bug2,"c",false,true);assert.equal(await complete(wrong),"WRONG_ANSWER");
    assert.equal((await owner.query("SELECT milliseconds FROM wrong_submission_penalties WHERE submission_id=$1",[wrong])).rows[0].milliseconds,300000);
    await delay(5010);
    assert.equal((await competition.buyHint(aa.sessionCookie,r2,bug2,1,randomUUID())).result.status,"PURCHASED");assert.equal((await competition.buyHint(aa.sessionCookie,r2,bug2,3,randomUUID())).result.reason,"HINT_LOCKED");assert.equal((await competition.buyHint(aa.sessionCookie,r2,bug2,2,randomUUID())).result.status,"PURCHASED");
    const spent=(await owner.query("SELECT sum(price)::text spent FROM hint_purchases WHERE team_round_id=$1",[teamA.id])).rows[0].spent;
    assert.equal(BigInt((await owner.query("SELECT competition_balance($1) balance",[teamA.id])).rows[0].balance),BigInt(teamA.balance)-BigInt(spent));
    const win=await admit(aa.sessionCookie,r2,bug2,"javascript"),lose=await admit(bb.sessionCookie,r2,bug2,"c");await complete(win);await complete(lose);
    const awards=(await owner.query("SELECT a.team_round_id FROM bounty_awards a WHERE bounty_id=$1",[bug2])).rows;assert.equal(awards.length,1);
    assert.equal(awards[0].team_round_id,(await owner.query("SELECT m.team_round_id FROM member_rounds m JOIN team_rounds t ON t.id=m.team_round_id WHERE m.member_id=$1 AND t.round_id=$2",[teams[0]!.members[0],r2])).rows[0].team_round_id);
    await command("CLOSE",r2);await command("FINALISE",r2);assert.equal((await owner.query("SELECT count(*)::int n FROM round_results WHERE round_id=ANY($1::uuid[])",[[r1,r2]])).rows[0].n,2);assert.equal(workerFaults,0);
    const report={scope:mode==="REAL"?"REAL_PARTICIPANT_TWO_ROUND_FLOW":"SYNTHETIC_ROUND_FLOW_PREFLIGHT",participant_execution_real:mode==="REAL",fixture_authoring_synthetic:true,synthetic_clock:true,rounds:[r1,r2],sample_passed:true,independent_awards:2,shared_awards:1,sequential_hints:true,instant_hint_debits:true,score_reset:true,wallet_carryover:true,wrong_penalty_ms:300000};await save("completed",report);
    console.log(`PASS: ${report.scope}; restricted worker, independent round one and shared round two; synthetic publication/time setup`);
    console.log(JSON.stringify(report));
  }catch(error){await save("failure",{stage,error:error instanceof Error?error.name:"UnknownError",code:error&&typeof error==="object"&&"code"in error?String(error.code).slice(0,64):null});throw new Error(`Round flow ${stage} failed; preserve its records.`,{cause:error});}
  finally{await worker?.close();for(const p of [owner,api,runner])await p.end();}
}
