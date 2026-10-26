import assert from "node:assert/strict";
import {randomBytes,randomUUID} from "node:crypto";
import {setTimeout as delay} from "node:timers/promises";
import type {TestContext} from "node:test";
import type {Pool} from "pg";
import {buildApp} from "../../src/app.js";
import {browserPolicy} from "../../src/access/browser-policy.js";
import {createEntryService} from "../../src/access/entry-service.js";
import {createReplacementService} from "../../src/access/replacement-service.js";
import {AccessError} from "../../src/access/transaction.js";
import type {ClockGuard} from "../../src/access/transaction.js";
import type {SessionDelivery} from "../../src/access/credentials.js";
import {createWorkbenchService} from "../../src/workbench/service.js";
import type {CompetitionDependencies,createCompetitionService} from "../../src/competition/service.js";
import type {createParticipantJudgeWorker} from "../../src/competition/judging-worker.js";
type Arena={round:string;aa:string;ab:string;ba:string;bb:string;x:string;y:string};
interface Context{owner:Pool;api:Pool;clock:ClockGuard;delivery:SessionDelivery;deps:CompetitionDependencies;service:ReturnType<typeof createCompetitionService>;
  judge:ReturnType<typeof createParticipantJudgeWorker>;answers:Map<string,string>;staff:{sessionCookie:string;code:string};
  teams:{id:string;code:string;members:string[]}[];budgets():Promise<void>;newRound():Promise<Arena>;startRace(round:string):Promise<Arena>;}
export async function workbenchChecks(t:TestContext,c:Context){
  const a=await c.newRound(),query=async(sql:string,args:unknown[]=[]) => (await c.owner.query(sql,args)).rows;
  let healthy=true;
  const clock={...c.clock,assertHealthy(){if(!healthy)throw new AccessError("CLOCK_UNTRUSTED");c.clock.assertHealthy();}},service=createWorkbenchService(c.api,clock);
  const save=async(cookie:string,bounty:string,base:string,source:string,key=randomUUID())=>{await c.budgets();return service.save(cookie,{roundId:a.round,bountyId:bounty,requestKey:key,baseRevision:base,source});};
  const before=()=>query("SELECT id,last_activity_at FROM participant_sessions ORDER BY id");
  const counts=()=>query("SELECT (SELECT count(*) FROM code_drafts) drafts,(SELECT count(*) FROM draft_save_outcomes) outcomes,(SELECT count(*) FROM participant_judging) parents,(SELECT count(*) FROM wallet_entries) ledger");
  async function control(action:"PAUSE"|"RESUME",scope="GLOBAL",target:string|null=null){await c.budgets();return c.service.command(c.staff.sessionCookie,{action,roundId:a.round,requestKey:randomUUID(),expectedRevision:(await query("SELECT revision FROM rounds WHERE id=$1",[a.round]))[0].revision,payload:{scope,target},reason:"Synthetic workbench gate",ownCode:c.staff.code});}
  async function complete(id:string){c.answers.set(id,"PASSED");await c.judge.claim();const end=Date.now()+15000;while(!(await query("SELECT completed_at FROM participant_judging WHERE id=$1",[id]))[0].completed_at){assert.ok(Date.now()<end);await c.judge.tick();await delay(25);}}
  let latest="",savedKey=randomUUID(),official="",replacement=a.aa;
  await t.test("opening reads only the enrolled language and public samples, with virtual revision zero and no read activity",async()=>{
    await c.budgets();const initial=await before(),n=await counts();
    for(const cookie of [a.aa,a.ab,a.ba]){const metadata=await service.metadata(cookie,a.round,a.x),draft=await service.draft(cookie,a.round,a.x);
      assert.equal(metadata.language,draft.language);assert.equal(draft.revision,"0");assert.equal(draft.draft_id,null);assert.equal(metadata.samples.length,1);assert.equal(metadata.writable,true);
      assert.equal(draft.source,(await service.starter(cookie,a.round,a.x)).source);
      assert.equal((await service.sample(cookie,a.round,a.x,1,"input")).content,"7 5\n");assert.equal((await service.sample(cookie,a.round,a.x,1,"expected_output")).content,"12\n");
      const encoded=JSON.stringify(metadata);for(const secret of ["reference","defect_description","source_code","hidden","hint content"])assert.equal(encoded.includes(secret),false);
    }
    await assert.rejects(service.sample(a.aa,a.round,a.x,2,"input"));await assert.rejects(service.metadata(a.aa,randomUUID(),a.x));await assert.rejects(service.draft(c.staff.sessionCookie,a.round,a.x));
    assert.deepEqual(await before(),initial);assert.deepEqual(await counts(),n);
  });
  await t.test("explicit bug opening records current activity once while background reads and same-key recovery cannot renew it",async()=>{
    await c.budgets();const initial=await before(),key=randomUUID(),opened=await service.open(a.aa,a.round,a.x,key);const changed=await before();assert.notDeepEqual(initial,changed);
    await c.budgets();assert.deepEqual(await service.open(a.aa,a.round,a.x,key),opened);assert.deepEqual(await before(),changed);
    assert.ok((await service.metadata(a.aa,a.round,a.x)).writable);
  });
  await t.test("captures are team-shared, round scoped and private, with one first-capture live notice",async()=>{
    await c.budgets();
    const read=async(cookie:string)=>(await c.service.state(cookie,a.round,"PARTICIPANT")).bounties as {bounty_id:string;captured:boolean;category:string;difficulty:number;base_bounty:number}[];
    const first=await read(a.aa),mate=await read(a.ab),other=await read(a.ba);
    assert.equal(first.find(b=>b.bounty_id===a.x)!.captured,true);
    assert.equal(mate.find(b=>b.bounty_id===a.x)!.captured,true);
    assert.equal(other.find(b=>b.bounty_id===a.x)!.captured,false);
    for(const b of first){assert.equal(b.category,"ARRAYS");const m=mate.find(x=>x.bounty_id===b.bounty_id)!;assert.equal(m.difficulty,b.difficulty);assert.equal(m.base_bounty,b.base_bounty);}
    const before=(await query("SELECT count(*)::integer n FROM live_deliveries WHERE patch->>'projection'='capture'"))[0].n;
    await c.budgets();await service.open(a.ab,a.round,a.x,randomUUID());
    assert.equal((await query("SELECT count(*)::integer n FROM live_deliveries WHERE patch->>'projection'='capture'"))[0].n,before);
    const notices=await query("SELECT s.kind,s.team_round_id,d.patch FROM live_deliveries d JOIN live_streams s ON s.id=d.stream_id WHERE d.patch->>'projection'='capture'");
    assert.ok(notices.length>0);assert.ok(notices.every(n=>n.kind==='TEAM'&&!JSON.stringify(n.patch).includes('source')));
    assert.equal((await read(a.aa)).find(b=>b.bounty_id===a.y)!.captured,false);
  });
  await t.test("pauses block first capture on the server while captured questions remain reopenable",async()=>{
    await control("PAUSE");await c.budgets();await assert.rejects(service.open(a.aa,a.round,a.y,randomUUID()));
    await c.budgets();await service.open(a.ab,a.round,a.x,randomUUID());await control("RESUME");
  });
  await t.test("identical concurrent first saves commit one exact draft, one activity and one durable receipt",async()=>{
    await c.budgets();const intent={roundId:a.round,bountyId:a.x,requestKey:savedKey,baseRevision:"0",source:"\ufefffirst\r\n\u0000\u20ac"};
    const results=await Promise.all([service.save(a.aa,intent),service.save(a.aa,intent)]);assert.deepEqual(results[0],results[1]);assert.equal(results[0]!.outcome,"SAVED");assert.equal(results[0]!.result_revision,"1");
    const draft=await service.draft(a.aa,a.round,a.x);assert.equal(draft.source,intent.source);assert.equal(draft.revision,"1");latest=intent.source;
    assert.equal((await query("SELECT count(*)::integer n FROM workbench_activities WHERE draft_outcome_id=$1",[results[0]!.outcome_id]))[0].n,1);
    await assert.rejects(save(a.aa,a.x,"0","changed",savedKey),{code:"P0002"});
  });
  await t.test("independent teammate drafts stay private and changed-key stale identical text still conflicts",async()=>{
    assert.equal((await service.draft(a.ab,a.round,a.x)).revision,"0");assert.equal((await service.outcome(a.ab,a.round,a.x,savedKey)).status,"NOT_OBSERVED");
    assert.equal((await save(a.ab,a.x,"0","teammate python")).outcome,"SAVED");assert.equal((await service.draft(a.aa,a.round,a.x)).source,latest);
    const changed=await before(),draft=await service.draft(a.aa,a.round,a.x);
    const noop=await save(a.aa,a.x,"1",latest);assert.equal(noop.outcome,"UNCHANGED");assert.equal(noop.result_revision,"1");assert.deepEqual(await before(),changed);assert.deepEqual(await service.draft(a.aa,a.round,a.x),draft);
    const stale=await save(a.aa,a.x,"0",latest);assert.equal(stale.outcome,"CONFLICT");assert.equal(stale.reason_code,"REVISION_MISMATCH");assert.equal(stale.result_revision,null);assert.deepEqual(await before(),changed);
  });
  await t.test("competing tabs cannot overwrite a newer revision, and clearing source never resets identity or revisions",async()=>{
    await c.budgets();const writes=await Promise.all([service.save(a.aa,{roundId:a.round,bountyId:a.x,requestKey:randomUUID(),baseRevision:"1",source:"tab one"}),service.save(a.aa,{roundId:a.round,bountyId:a.x,requestKey:randomUUID(),baseRevision:"1",source:"tab two"})]);
    assert.deepEqual(writes.map(x=>x.outcome).sort(),["CONFLICT","SAVED"]);const old=await service.draft(a.aa,a.round,a.x);
    assert.equal((await save(a.aa,a.x,"2","")).result_revision,"3");const cleared=await service.draft(a.aa,a.round,a.x);assert.equal(cleared.source,"");assert.equal(cleared.draft_id,old.draft_id);
    assert.equal((await save(a.aa,a.x,"3"," \r\n\t")).result_revision,"4");latest=" \r\n\t";
    const recovered=await createWorkbenchService(c.api,clock).outcome(a.aa,a.round,a.x,savedKey);assert.equal(recovered.outcome!.result_revision,"1");assert.equal((await service.draft(a.aa,a.round,a.x)).revision,"4");
  });
  await t.test("all pause scopes deny new saves before no-op/conflict checks and an old rejection stays denied after resume",async()=>{
    const meta=await service.metadata(a.aa,a.round,a.y),member=meta.member_round_id,team=(await query("SELECT team_round_id FROM member_rounds WHERE id=$1",[member]))[0].team_round_id;
    const firstKey=randomUUID();await control("PAUSE","MEMBER",member);const initial=await before();
    const rejected=await save(a.aa,a.y,"0","blocked",firstKey);assert.equal(rejected.reason_code,"PAUSED");assert.equal((await service.draft(a.aa,a.round,a.y)).draft_id,null);assert.deepEqual(await before(),initial);
    assert.equal((await save(a.ab,a.y,"0","other member still works")).outcome,"SAVED");
    await control("PAUSE","TEAM",team);await control("RESUME","MEMBER",member);assert.equal((await save(a.aa,a.x,"4",latest)).reason_code,"PAUSED");
    assert.equal((await save(a.ba,a.y,"0","other team independent")).outcome,"SAVED");await control("PAUSE");await control("RESUME","TEAM",team);
    assert.equal((await save(a.aa,a.x,"4",latest)).reason_code,"PAUSED");await control("RESUME");
    assert.deepEqual(await save(a.aa,a.y,"0","blocked",firstKey),rejected);assert.equal((await save(a.aa,a.y,"0","allowed new intent")).outcome,"SAVED");
  });
  await t.test("draft byte boundaries preserve empty/NUL/UTF-8 and bounded oversized intents create no source or judging effects",async()=>{
    const max="\u20ac".repeat(43690)+"xy";assert.equal(Buffer.byteLength(max),131072);const result=await save(a.aa,a.y,"1",max);assert.equal(result.outcome,"SAVED");
    const unchanged=await before(),n=await counts();const tooLarge=await save(a.aa,a.y,"2",max+"!");assert.equal(tooLarge.reason_code,"DRAFT_TOO_LARGE");assert.equal((await service.draft(a.aa,a.round,a.y)).source,max);assert.deepEqual(await before(),unchanged);
    const after=await counts();assert.equal(after[0].parents,n[0].parents);assert.equal(after[0].ledger,n[0].ledger);
    for(const source of ["\ud800",42,null])await assert.rejects(service.save(a.aa,{roundId:a.round,bountyId:a.y,requestKey:randomUUID(),baseRevision:"2",source:source as string}));
    await assert.rejects(service.save(a.aa,{roundId:a.round,bountyId:a.y,requestKey:randomUUID(),baseRevision:"02",source:"text"}));
  });
  await t.test("a member-only draft notice exposes no source to teammate, round or staff streams",async()=>{
    const old=await before();const member=(await service.metadata(a.aa,a.round,a.x)).member_round_id;
    const events=await query("SELECT s.kind,s.member_round_id,d.patch FROM live_effects e JOIN live_deliveries d ON d.effect_id=e.id JOIN live_streams s ON s.id=d.stream_id WHERE e.draft_outcome_id IS NOT NULL");
    assert.ok(events.length>0);assert.ok(events.every(e=>e.kind==="MEMBER"&&e.patch.projection==="draft"&&!JSON.stringify(e.patch).includes("source")));
    assert.ok(events.some(e=>e.member_round_id===member));assert.deepEqual(await before(),old);
  });
  await t.test("pending official work does not block editing, admitted source stays exact and only teammates can read it",async()=>{
    await c.budgets();const source="exact admitted program\r\n\u0000",admitted=await c.service.submit(a.aa,a.round,a.x,source,randomUUID());official=admitted.result.submission_id as string;
    assert.equal((await service.metadata(a.aa,a.round,a.x)).official_pending,true);assert.equal((await save(a.aa,a.x,"4","newer private text")).outcome,"SAVED");latest="newer private text";
    assert.equal((await service.officialSource(a.ab,a.round,a.x,official)).source,source);assert.equal((await service.officialSource(a.ab,a.round,a.x,official)).read_only,true);
    await assert.rejects(service.officialSource(a.ba,a.round,a.x,official));assert.equal((await service.submissions(a.ab,a.round,a.x)).submissions[0].submission_id,official);
    await complete(official);assert.equal((await save(a.aa,a.x,"5",latest)).reason_code,"BOUNTY_UNAVAILABLE");assert.equal((await save(a.ba,a.x,"0","other R1 team can continue")).outcome,"SAVED");
    assert.equal((await service.draft(a.aa,a.round,a.x)).source,latest);
  });
  await t.test("revocation and unhealthy time deny draft and source access without mutating state",async()=>{
    const initial=await counts();healthy=false;await assert.rejects(service.draft(a.aa,a.round,a.x));await assert.rejects(save(a.aa,a.y,"2","denied"));healthy=true;assert.deepEqual(await counts(),initial);
    await assert.rejects(service.draft("forged",a.round,a.x));await assert.rejects(service.save(c.staff.sessionCookie,{roundId:a.round,bountyId:a.x,requestKey:randomUUID(),baseRevision:"5",source:"staff is not a participant"}));
  });
  await t.test("approved browser replacement restores the same owned draft and original save outcome without changing language",async()=>{
    const entry=createEntryService(c.api,c.clock,c.delivery),replacements=createReplacementService(c.api,c.clock,c.delivery),team=c.teams[0]!;
    await c.budgets();const flow=await entry.begin(team.code,{ip:"127.0.0.1",browserId:randomUUID()});assert.equal(flow.audience,"TEAM");
    const requested=await replacements.request(flow.proofCookie,{memberId:team.members[0]!,requestKey:randomUUID()});assert.equal(requested.status,"REQUESTED");if(requested.status!=="REQUESTED")throw new Error("Expected replacement");
    const slot=(await query("SELECT revision FROM member_session_slots WHERE member_id=$1",[team.members[0]]))[0];await c.budgets();
    await replacements.decide(c.staff.sessionCookie,{flowId:requested.request.request_id,requestKey:randomUUID(),action:"APPROVE",expectedRevision:slot.revision,reason:"Synthetic draft restoration"});
    const activated=await replacements.activate(requested.proofCookie,randomUUID());replacement=activated.sessionCookie;
    assert.equal((await service.draft(replacement,a.round,a.x)).source,latest);assert.equal((await service.outcome(replacement,a.round,a.x,savedKey)).outcome!.result_revision,"1");await assert.rejects(service.draft(a.aa,a.round,a.x));
  });
  await t.test("database source guards and storage budget failures roll back the complete save, activity and live effect",async()=>{
    await assert.rejects(c.api.query("UPDATE code_drafts SET revision=revision+1"),{code:"42501"});await assert.rejects(c.owner.query("DELETE FROM draft_save_outcomes"),{code:"P0001"});
    const client=await c.owner.connect();try{await client.query("BEGIN");const meta=await service.metadata(replacement,a.round,a.y);
      await client.query("SAVEPOINT forged");
      await client.query("UPDATE code_drafts SET source_code=$3,revision=revision+1,updated_at=greatest(clock_timestamp(),updated_at) WHERE member_round_id=$1 AND bounty_id=$2",[meta.member_round_id,a.y,Buffer.from("forged without a receipt")]);
      await assert.rejects(client.query("SET CONSTRAINTS ALL IMMEDIATE"),{code:"P0001"});await client.query("ROLLBACK TO SAVEPOINT forged");
      const team=(await client.query("SELECT team_round_id FROM member_rounds WHERE id=$1",[meta.member_round_id])).rows[0].team_round_id;
      await client.query("CREATE OR REPLACE FUNCTION workbench_usage(team uuid DEFAULT NULL) RETURNS bigint LANGUAGE sql STABLE AS 'SELECT 201326592::bigint'");
      const initial=(await client.query("SELECT count(*)::integer n FROM draft_save_outcomes")).rows[0].n;await client.query("SAVEPOINT capacity");
      await assert.rejects(client.query("SELECT workbench_save($1,$2,$3,$4,2,$5)",[replacement.split(".")[1],a.round,a.y,randomUUID(),Buffer.from("should not persist")]),{code:"54000"});await client.query("ROLLBACK TO SAVEPOINT capacity");
      assert.equal((await client.query("SELECT count(*)::integer n FROM draft_save_outcomes")).rows[0].n,initial);assert.ok(team);
    }finally{await client.query("ROLLBACK");client.release();}
  });
  await httpChecks();
  await t.test("R2 grants read only the same member's R1 drafts and team official source while shared claims lock new saves",async()=>{
    const race=await c.startRace(a.round);await c.budgets();const history=await service.draft(race.aa,a.round,a.x);assert.equal(history.source,latest);assert.equal(history.writable,false);assert.equal(history.reason,"ROUND_NOT_WRITABLE");
    assert.equal((await service.officialSource(race.ab,a.round,a.x,official)).source,"exact admitted program\r\n\u0000");assert.notEqual((await service.draft(race.ab,a.round,a.x)).source,latest);
    assert.equal((await service.outcome(race.aa,a.round,a.x,savedKey)).status,"OBSERVED");await assert.rejects(service.save(race.aa,{roundId:a.round,bountyId:a.x,requestKey:randomUUID(),baseRevision:"5",source:"no historical writes"}));await assert.rejects(service.draft(replacement,a.round,a.x));
    await c.budgets();const own=await service.save(race.ba,{roundId:race.round,bountyId:race.x,requestKey:randomUUID(),baseRevision:"0",source:"rival text preserved"});assert.equal(own.outcome,"SAVED");
    const win=await c.service.submit(race.aa,race.round,race.x,"race correct",randomUUID());await complete(win.result.submission_id as string);
    await c.budgets();const denied=await service.save(race.ba,{roundId:race.round,bountyId:race.x,requestKey:randomUUID(),baseRevision:"1",source:"late edit"});assert.equal(denied.reason_code,"BOUNTY_UNAVAILABLE");assert.equal((await service.draft(race.ba,race.round,race.x)).source,"rival text preserved");
    await c.service.command(c.staff.sessionCookie,{action:"CLOSE",roundId:race.round,requestKey:randomUUID(),expectedRevision:(await query("SELECT revision FROM rounds WHERE id=$1",[race.round]))[0].revision,payload:{},reason:"Synthetic workbench finish",ownCode:c.staff.code});
    await c.budgets();const closed=await service.save(race.ba,{roundId:race.round,bountyId:race.x,requestKey:randomUUID(),baseRevision:"1",source:"no last-save exception"});assert.equal(closed.reason_code,"ROUND_NOT_WRITABLE");
    await c.budgets();assert.deepEqual(await service.save(race.ba,{roundId:race.round,bountyId:race.x,requestKey:own.request_key,baseRevision:"0",source:"rival text preserved"}),own);
    assert.equal((await service.draft(race.ba,race.round,race.x)).source,"rival text preserved");
    await c.service.command(c.staff.sessionCookie,{action:"FINALISE",roundId:race.round,requestKey:randomUUID(),expectedRevision:(await query("SELECT revision FROM rounds WHERE id=$1",[race.round]))[0].revision,payload:{},reason:"Synthetic workbench finish",ownCode:c.staff.code});
  });
  async function httpChecks(){
    await t.test("workbench HTTP is CSRF-bound, source-safe, exact on byte limits and explicit about processed conflicts",async()=>{
      const browser={mode:"loopback" as const,origin:"http://127.0.0.1:3000",cookieKey:randomBytes(32),csrfKey:randomBytes(32)},policy=browserPolicy(browser);
      const app=buildApp({database:{async check(){},async close(){}},entry:{pool:c.api,clock,delivery:c.delivery,browser,competition:c.deps}}),jar=new Map<string,string>();let token="";
      async function request(url:string,body?:unknown,headers:Record<string,string>={}){await c.budgets();const response=await app.inject({method:body===undefined?"GET":"POST",url,headers:{origin:browser.origin,cookie:[...jar].map(([k,v])=>`${k}=${v}`).join("; "),...(body===undefined?{}:{"content-type":"application/json","x-csrf-token":token}),...headers},...(body===undefined?{}:{payload:body as object})});
        const lines=response.headers["set-cookie"];for(const line of lines===undefined?[]:typeof lines==="string"?[lines]:lines){const pair=line.split(";")[0]!,index=pair.indexOf("=");jar.set(pair.slice(0,index),pair.slice(index+1));}return response;}
      try{await request("/api/v1/bootstrap?audience=ANONYMOUS");jar.set(policy.names.participant,replacement);token=(await request("/api/v1/bootstrap?audience=PARTICIPANT")).json().data.csrf_token;
        const base=`/api/v1/competition/rounds/${a.round}/bounties/${a.y}`,input={request_key:randomUUID(),base_revision:"2",source:"\u0000".repeat(131072)};
        assert.equal((await request(`${base}/draft`,input,{"x-csrf-token":"invalid"})).statusCode,403);
        for(const extra of [{member_round_id:randomUUID()},{language:"java"},{force:true}])assert.equal((await request(`${base}/draft`,{...input,...extra})).statusCode,400);
        const success=await request(`${base}/draft`,input);assert.equal(success.statusCode,200,success.body);assert.equal(success.json().data.outcome,"SAVED");
        const source=await request(`${base}/draft`);assert.equal(source.statusCode,200);assert.equal(source.json().data.source,input.source);assert.equal(source.headers["cache-control"],"no-store");
        const conflict=await request(`${base}/draft`,{...input,request_key:randomUUID()});assert.equal(conflict.statusCode,409);assert.equal(conflict.json().data.outcome,"CONFLICT");
        const tooLarge=await request(`${base}/draft`,{request_key:randomUUID(),base_revision:"3",source:"x".repeat(131073)});assert.equal(tooLarge.statusCode,409);assert.equal(tooLarge.json().data.reason_code,"DRAFT_TOO_LARGE");
        assert.equal((await request(`${base}/draft`,{request_key:randomUUID(),base_revision:"3",source:"x".repeat(1048576)})).statusCode,413);
        assert.equal((await request(`${base}?language=java`)).statusCode,400);assert.equal((await request(`${base}/samples/2/input`)).statusCode,404);
        const metadata=await request(base);assert.equal(metadata.statusCode,200,metadata.body);assert.equal(Object.hasOwn(metadata.json().data,"source"),false);assert.equal(Object.hasOwn(metadata.json().data,"reference_code"),false);
      }finally{await app.close();}
    });
  }
}
