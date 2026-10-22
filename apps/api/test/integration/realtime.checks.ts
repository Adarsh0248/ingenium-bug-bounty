import assert from "node:assert/strict";
import { randomBytes,randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import type { TestContext } from "node:test";
import type { Pool } from "pg";
import { io } from "socket.io-client";
import type { Socket } from "socket.io-client";
import { buildApp } from "../../src/app.js";
import { browserPolicy } from "../../src/access/browser-policy.js";
import { createEntryService } from "../../src/access/entry-service.js";
import { createStaffService } from "../../src/access/staff-service.js";
import { AccessError } from "../../src/access/transaction.js";
import type { ClockGuard } from "../../src/access/transaction.js";
import type { SessionDelivery } from "../../src/access/credentials.js";
import type { CompetitionDependencies } from "../../src/competition/service.js";
import { createCompetitionService } from "../../src/competition/service.js";
import { createParticipantJudgeWorker } from "../../src/competition/judging-worker.js";
import { createLiveService } from "../../src/live/service.js";
import type { StreamHead } from "../../src/live/protocol.js";
import { connectLive } from "../../src/live/client.js";
import { createWorkbenchService } from "../../src/workbench/service.js";
type Arena={round:string;aa:string;ab:string;ba:string;bb:string;x:string;y:string};
function once(socket:Socket,event:string,options:{signal:AbortSignal}):Promise<any[]> {
  return new Promise((resolve,reject)=>{const listener=(...values:any[])=>{options.signal.removeEventListener("abort",abort);resolve(values);};
    const abort=()=>{socket.off(event,listener);reject(new Error(`Timed out waiting for ${event}`));};socket.once(event,listener);options.signal.addEventListener("abort",abort,{once:true});});
}
interface Context{
  owner:Pool;api:Pool;clock:ClockGuard;delivery:SessionDelivery;deps:CompetitionDependencies;
  service:ReturnType<typeof createCompetitionService>;judge:ReturnType<typeof createParticipantJudgeWorker>;answers:Map<string,string>;
  staff:{sessionCookie:string;code:string};organiser:{sessionCookie:string;code:string};budgets():Promise<void>;newRound():Promise<Arena>;startRace(round:string):Promise<Arena>;
  newStaff(role:string):Promise<{id:string;sessionCookie:string;code:string}>;
}
export async function realtimeChecks(t:TestContext,c:Context){
  const a=await c.newRound(),sockets:Socket[]=[],live=createLiveService(c.api,c.clock,c.delivery);
  let healthy=true;
  let currentCookie=a.aa;
  const clock={...c.clock,assertHealthy(){if(!healthy)throw new AccessError("CLOCK_UNTRUSTED");c.clock.assertHealthy();}};
  const browser={mode:"loopback" as const,origin:"http://127.0.0.1:3000",cookieKey:randomBytes(32),csrfKey:randomBytes(32)},policy=browserPolicy(browser);
  const makeApp=()=>buildApp({database:{async check(){},async close(){}},entry:{pool:c.api,clock,delivery:c.delivery,browser,competition:c.deps}});
  let app=makeApp(),address=await app.listen({host:"127.0.0.1",port:0});
  const query=async(sql:string,args:unknown[]=[]) => (await c.owner.query(sql,args)).rows;
  async function until(check:()=>boolean|Promise<boolean>,ms=8000){const deadline=Date.now()+ms;while(!await check()){assert.ok(Date.now()<deadline,"Bounded live test wait expired");await delay(50);}}
  async function session(cookie:string,audience:"PARTICIPANT"|"STAFF"="PARTICIPANT"){
    const jar=new Map<string,string>(),prefix=audience==="STAFF"?"/api/v1/staff/live":"/api/v1/live";
    let csrf="";
    const header=()=>[...jar].map(([name,value])=>`${name}=${value}`).join("; ");
    async function request(url:string,body?:unknown,extra:Record<string,string>={}){
      const response=await app.inject({method:body===undefined?"GET":"POST",url,headers:{origin:browser.origin,cookie:header(),...(body===undefined?{}:{"content-type":"application/json","x-csrf-token":csrf}),...extra},...(body===undefined?{}:{payload:body as object})});
      const values=response.headers["set-cookie"];
      for(const line of values===undefined?[]:typeof values==="string"?[values]:values){const [pair]=line.split(";");const split=pair!.indexOf("=");jar.set(pair!.slice(0,split),pair!.slice(split+1));}
      return response;
    }
    await request("/api/v1/bootstrap?audience=ANONYMOUS");jar.set(audience==="STAFF"?policy.names.staff:policy.names.participant,cookie);
    const bootstrap=await request(`/api/v1/bootstrap?audience=${audience}`);assert.equal(bootstrap.statusCode,200);csrf=bootstrap.json().data.csrf_token;
    async function post(path:string,body:unknown){await c.budgets();const response=await request(`${prefix}/${path}`,body);assert.equal(response.statusCode,200,response.body);return response.json().data;}
    async function connect(roundId:string|null=null){
      const ticket=await post("tickets",audience==="STAFF"?{round_id:roundId}:{});
      const socket=io(`${address}/live`,{path:"/api/v1/live/socket",transports:["websocket"],autoConnect:false,reconnection:false,forceNew:true,
        auth:{ticket:ticket.ticket},extraHeaders:{Origin:browser.origin,Cookie:header()}});sockets.push(socket);
      const sync=once(socket,"sync",{signal:AbortSignal.timeout(5000)});socket.connect();const [value]=await sync;
      const events:any[]=[],presence:any[]=[],headEvents:any[]=[];socket.on("event",e=>events.push(e));socket.on("presence",e=>presence.push(e));socket.on("heads",e=>headEvents.push(e));
      const cursors:Record<string,string>={};let acknowledged=false;
      socket.on("event",e=>{if(acknowledged)cursors[e.stream_id]=e.sequence;});
      const timer=setInterval(()=>{if(acknowledged&&socket.connected)socket.volatile.emit("ack",{sync_id:value.sync_id,heads:cursors});},500);timer.unref();socket.on("disconnect",()=>clearInterval(timer));
      async function synchronise(between?:()=>Promise<void>){
        const snapshot=await post("snapshot",{sync_id:value.sync_id});for(const h of snapshot.streams)cursors[h.stream_id]=h.head;
        await between?.();
        const replay:any[]=[];
        for(const h of snapshot.streams){let after=h.head;do{const page=await post("replay",{sync_id:value.sync_id,stream_id:h.stream_id,after});replay.push(...page.events);after=page.next;cursors[h.stream_id]=after;if(after===page.through)break;}while(true);}
        const ready=once(socket,"ready",{signal:AbortSignal.timeout(5000)});socket.volatile.emit("ready",{sync_id:value.sync_id,heads:cursors});await ready;acknowledged=true;
        return {snapshot,replay};
      }
      return{socket,sync:value.sync_id,events,presence,heads:headEvents,synchronise};
    }
    return{post,request,connect,header,prefix};
  }
  const people=[await session(a.aa),await session(a.ab),await session(a.ba)],aa=people[0]!,ab=people[1]!,ba=people[2]!;
  let first:Awaited<ReturnType<typeof aa.connect>>,second:Awaited<ReturnType<typeof ab.connect>>,other:Awaited<ReturnType<typeof ba.connect>>;
  async function control(round:string,action:"PAUSE"|"RESUME",scope="GLOBAL",target:string|null=null){await c.budgets();return c.service.command(c.staff.sessionCookie,{action,roundId:round,requestKey:randomUUID(),expectedRevision:(await query("SELECT revision FROM rounds WHERE id=$1",[round]))[0].revision,
    payload:{scope,target},reason:"Synthetic realtime control",ownCode:c.staff.code});}
  async function complete(id:string){c.answers.set(id,"PASSED");await c.judge.claim();const deadline=Date.now()+15000;
    while(!(await query("SELECT completed_at FROM participant_judging WHERE id=$1",[id]))[0].completed_at){assert.ok(Date.now()<deadline);await c.judge.tick();await delay(25);}}
  try{
    await t.test("live heads and budget roll back together; the API cannot manufacture deliveries",async()=>{
      const before=await query("SELECT id,head FROM live_streams ORDER BY id"),budget=await query("SELECT * FROM live_control");
      const client=await c.owner.connect();try{await client.query("BEGIN");await client.query("UPDATE rounds SET revision=revision+1 WHERE id=$1",[a.round]);assert.notDeepEqual((await client.query("SELECT id,head FROM live_streams ORDER BY id")).rows,before);}finally{await client.query("ROLLBACK");client.release();}
      assert.deepEqual(await query("SELECT id,head FROM live_streams ORDER BY id"),before);assert.deepEqual(await query("SELECT * FROM live_control"),budget);
      await assert.rejects(c.api.query("UPDATE live_streams SET head=head+1"),{code:"42501"});
      await assert.rejects(c.api.query("SELECT live_emit(gen_random_uuid(),ARRAY[]::uuid[],'{}')"),{code:"42501"});
    });
    await t.test("live tickets require the current audience, browser CSRF and exact Origin",async()=>{
      for(const extra of [{"x-csrf-token":"invalid"},{origin:"http://elsewhere.invalid"}])assert.equal((await aa.request(`${aa.prefix}/tickets`,{},extra)).statusCode,403);
      assert.equal((await aa.request(`${aa.prefix}/tickets`,{round_id:randomUUID()})).statusCode,400);
      const ticket=await aa.post("tickets",{}),bad=io(`${address}/live`,{path:"/api/v1/live/socket",transports:["websocket"],autoConnect:false,reconnection:false,auth:{ticket:ticket.ticket},extraHeaders:{Origin:browser.origin,Cookie:ba.header()}});sockets.push(bad);
      const denied=once(bad,"connect_error",{signal:AbortSignal.timeout(3000)});bad.connect();assert.match(String((await denied)[0]),/LIVE_AUTHORITY_REQUIRED/);bad.disconnect();
    });
    await t.test("ordinary delivery capacity cannot consume the control reserve",async()=>{
      const client=await c.owner.connect();try{
        await client.query("BEGIN");await client.query("UPDATE live_control SET rows=245760,reserved=0 WHERE id=1");
        const effect=(await client.query("INSERT INTO live_effects(round_id) VALUES($1) RETURNING id",[a.round])).rows[0].id;
        const stream=(await client.query("SELECT id FROM live_streams WHERE kind='ROUND' AND round_id=$1",[a.round])).rows[0].id;
        await client.query("SAVEPOINT ordinary");await assert.rejects(client.query("SELECT live_emit($1,ARRAY[$2::uuid],'{\"type\":\"INVALIDATE\",\"projection\":\"competition\"}')",[effect,stream]),{code:"54000"});await client.query("ROLLBACK TO SAVEPOINT ordinary");
        await client.query("SELECT live_emit($1,ARRAY[$2::uuid],'{\"type\":\"INVALIDATE\",\"projection\":\"competition\"}',NULL,NULL,true)",[effect,stream]);
        assert.equal((await client.query("SELECT rows::text FROM live_control")).rows[0].rows,"245761");
      }finally{await client.query("ROLLBACK");client.release();}
    });
    await t.test("snapshot/listener/replay covers a commit during synchronisation without a refresh",async()=>{
      first=await aa.connect();const {snapshot,replay}=await first.synchronise(async()=>{await control(a.round,"PAUSE");await control(a.round,"RESUME");});
      const member=(await query("SELECT m.language FROM member_rounds m JOIN participant_sessions s ON s.member_round_id=m.id WHERE s.id=$1",[a.aa.split(".")[1]]))[0];
      assert.equal(snapshot.actor.language,member.language);assert.equal(snapshot.streams.length,3);assert.ok(replay.length>=2);
      assert.equal(JSON.stringify(snapshot).includes("synthetic reference"),false);assert.equal(JSON.stringify(snapshot).includes("protected hint"),false);
      second=await ab.connect();const teammate=await second.synchronise();other=await ba.connect();const outsider=await other.synchronise();
      assert.equal(teammate.snapshot.actor.language,"python");
      assert.equal(snapshot.streams.find((s:StreamHead)=>s.kind==="TEAM").stream_id,teammate.snapshot.streams.find((s:StreamHead)=>s.kind==="TEAM").stream_id);
      assert.notEqual(snapshot.streams.find((s:StreamHead)=>s.kind==="TEAM").stream_id,outsider.snapshot.streams.find((s:StreamHead)=>s.kind==="TEAM").stream_id);
      assert.notEqual(snapshot.streams.find((s:StreamHead)=>s.kind==="MEMBER").stream_id,teammate.snapshot.streams.find((s:StreamHead)=>s.kind==="MEMBER").stream_id);
      assert.equal((await ba.request(`${ba.prefix}/snapshot`,{sync_id:first.sync})).statusCode,503);
    });
    await t.test("a saved draft invalidates only its owner's live workbench and snapshots contain revisions, never source",async()=>{
      await c.budgets();const workbench=createWorkbenchService(c.api,c.clock),source="private live draft text";
      await workbench.save(a.aa,{roundId:a.round,bountyId:a.x,requestKey:randomUUID(),baseRevision:"0",source});
      await until(()=>first.events.some(e=>e.patch.projection==="draft"&&e.patch.bounty_id===a.x&&e.patch.revision==="1"));
      assert.ok(!second.events.some(e=>e.patch.projection==="draft"));assert.ok(!other.events.some(e=>e.patch.projection==="draft"));
      const own=await live.guarded({audience:"PARTICIPANT",cookie:a.aa,roundId:null},live.snapshot),teammate=await live.guarded({audience:"PARTICIPANT",cookie:a.ab,roundId:null},live.snapshot);
      assert.equal(own.drafts.find(d=>d.bounty_id===a.x)?.revision,"1");assert.equal(teammate.drafts.length,0);
      assert.equal(JSON.stringify([own,teammate,first.events,second.events,other.events]).includes(source),false);
    });
    await t.test("three tabs per participant session are allowed; a fourth is refused without changing the member slot",async()=>{
      const before=await query("SELECT * FROM member_session_slots ORDER BY member_id"),two=await aa.connect(),three=await aa.connect();await two.synchronise();await three.synchronise();
      const ticket=await aa.post("tickets",{}),four=io(`${address}/live`,{path:"/api/v1/live/socket",transports:["websocket"],autoConnect:false,reconnection:false,auth:{ticket:ticket.ticket},extraHeaders:{Origin:browser.origin,Cookie:aa.header()}});sockets.push(four);
      const denied=once(four,"connect_error",{signal:AbortSignal.timeout(3000)});four.connect();await denied;four.disconnect();
      assert.deepEqual(await query("SELECT * FROM member_session_slots ORDER BY member_id"),before);two.socket.disconnect();three.socket.disconnect();
    });
    await t.test("editor intents aggregate tabs, stay team-private, clear on leave and display individual pauses",async()=>{
      const before=await query("SELECT id,last_activity_at FROM participant_sessions ORDER BY id"),tab=await aa.connect();await tab.synchronise();
      first.socket.volatile.emit("presence",{action:"ENTER",bounty_id:a.x});tab.socket.volatile.emit("presence",{action:"ENTER",bounty_id:a.x});
      await until(()=>second.presence.some(p=>p.editors.some((e:any)=>e.bounty_id===a.x&&e.tabs===2)));
      assert.ok(other.presence.every(p=>p.editors.length===0));
      const member=(await query("SELECT member_round_id FROM participant_sessions WHERE id=$1",[a.aa.split(".")[1]]))[0].member_round_id;
      await control(a.round,"PAUSE","MEMBER",member);await until(()=>second.presence.some(p=>p.editors.some((e:any)=>e.paused)));
      await control(a.round,"RESUME","MEMBER",member);
      tab.socket.volatile.emit("presence",{action:"LEAVE"});await until(()=>second.presence.at(-1)?.editors.some((e:any)=>e.tabs===1));
      first.socket.volatile.emit("presence",{action:"LEAVE"});await until(()=>second.presence.at(-1)?.editors.length===0);tab.socket.disconnect();
      assert.deepEqual(await query("SELECT id,last_activity_at FROM participant_sessions ORDER BY id"),before);
    });
    await t.test("member sample status reaches only its owner; official results and awards reach the whole team",async()=>{
      await c.budgets();const sample=(await c.service.run(a.aa,a.round,a.x,"synthetic sample",randomUUID())).result.run_id as string;assert.ok(sample);
      await until(()=>first.events.some(e=>e.patch.parent_id===sample));await complete(sample);
      await until(()=>first.events.some(e=>e.patch.parent_id===sample&&e.patch.status==="COMPLETED"));
      assert.ok(!second.events.some(e=>e.patch.parent_id===sample));assert.ok(!other.events.some(e=>e.patch.parent_id===sample));
      await c.budgets();const official=(await c.service.submit(a.aa,a.round,a.x,"synthetic official",randomUUID())).result.submission_id as string;await complete(official);
      await until(()=>first.events.some(e=>e.patch.type==="AWARD")&&second.events.some(e=>e.patch.type==="AWARD"));
      assert.ok(!other.events.some(e=>e.patch.type==="AWARD"));assert.ok(!other.events.some(e=>e.patch.parent_id===official));
      assert.ok(!first.events.some(e=>e.patch.type==="INVALIDATE"&&e.patch.parent_id===official),"Per-case official progress must not reveal the hidden suite through event counts");
      const snapshot=await live.guarded({audience:"PARTICIPANT",cookie:a.aa,roundId:null},live.snapshot);
      assert.equal(snapshot.hud?.wallet,1000);assert.equal(snapshot.hud?.standing?.points,1000);
      await c.budgets();await c.service.buyHint(a.ab,a.round,a.y,1,randomUUID());
      await until(()=>second.events.some(e=>e.patch.reason==="HINT_PURCHASED"));
      const after=await live.guarded({audience:"PARTICIPANT",cookie:a.aa,roundId:null},live.snapshot);
      assert.equal(after.hud?.wallet,920);assert.equal(after.hud?.standing?.points,920);assert.equal(after.bounties.find(b=>b.bounty_id===a.y)?.hint_tier,1);
    });
    await t.test("an abandoned editor intent expires at 45 seconds without expiring the login or changing points",async()=>{
      first.socket.volatile.emit("presence",{action:"ENTER",bounty_id:a.y});await until(()=>second.presence.at(-1)?.editors.some((e:any)=>e.bounty_id===a.y));
      const before=await query("SELECT id,last_activity_at FROM participant_sessions ORDER BY id"),wallet=await query("SELECT count(*)::text n FROM wallet_entries");
      await delay(43000);assert.ok(second.presence.at(-1)?.editors.some((e:any)=>e.bounty_id===a.y));
      await until(()=>second.presence.at(-1)?.editors.length===0,5000);assert.equal(first.socket.connected,true);
      assert.deepEqual(await query("SELECT id,last_activity_at FROM participant_sessions ORDER BY id"),before);assert.deepEqual(await query("SELECT count(*)::text n FROM wallet_entries"),wallet);
    });
    await t.test("replay rejects another stream and pruned history rather than returning a filtered global cursor",async()=>{
      await live.guarded({audience:"PARTICIPANT",cookie:a.aa,roundId:null},async context=>{
        await assert.rejects(live.page(context,randomUUID(),"0","0"));
      });
      const client=await c.owner.connect();try{
        await client.query("BEGIN");const stream=(await client.query("SELECT * FROM live_streams WHERE kind='TEAM' AND round_id=$1 ORDER BY id LIMIT 1",[a.round])).rows[0];
        await client.query("UPDATE live_deliveries SET created_at=clock_timestamp()-interval '16 minutes',published_at=clock_timestamp() WHERE stream_id=$1",[stream.id]);
        await client.query("SELECT live_maintain()");const pruned=(await client.query("SELECT * FROM live_streams WHERE id=$1",[stream.id])).rows[0];
        assert.equal(BigInt(pruned.retained_from),BigInt(pruned.head)+1n);
      }finally{await client.query("ROLLBACK");client.release();}
    });
    await t.test("the client helper refreshes a coherent projection, recovers a lost final event and reconnects without replaying gameplay commands",async()=>{
      let view:any=null,dropEvents=false,installs=0,current:Socket|undefined;
      const client=connectLive("PARTICIPANT",null,{now:()=>performance.now(),post:async(path,body)=>aa.post(path.slice(aa.prefix.length+1),body),
        transport(ticket){const socket=io(`${address}/live`,{path:"/api/v1/live/socket",transports:["websocket"],autoConnect:false,reconnection:false,forceNew:true,auth:{ticket},extraHeaders:{Origin:browser.origin,Cookie:aa.header()}});sockets.push(socket);current=socket;
          return{get connected(){return socket.connected;},on(event,listener){socket.on(event,event==="event"?value=>{if(!dropEvents)listener(value);}:listener);},connect(){socket.connect();},disconnect(){socket.disconnect();},volatile:socket.volatile};},
        install(snapshot){view=snapshot;installs++;},invalidate(){},award(){},presence(){},state(){}});
      try{
        await until(()=>client.replica.phase==="READY");assert.equal(view.hud.wallet,920);
        await control(a.round,"PAUSE");await until(()=>view.round.state==="PAUSED");await control(a.round,"RESUME");await until(()=>view.round.state==="RUNNING");
        const prior=client.replica.syncId;dropEvents=true;await control(a.round,"PAUSE");
        await until(()=>client.replica.phase==="READY"&&client.replica.syncId!==prior&&view.round.state==="PAUSED");dropEvents=false;
        await control(a.round,"RESUME");await until(()=>view.round.state==="RUNNING");
        const old=client.replica.syncId,before=installs;current!.disconnect();
        await until(()=>client.replica.phase==="READY"&&client.replica.syncId!==old&&installs>before);
        assert.equal(view.hud.wallet,920);assert.equal(view.hud.standing.points,920);
      }finally{client.close();}
    });
    await t.test("staff streams enforce the two-tab cap and exclude security-management data from ordinary roles",async()=>{
      const staff=await session(c.organiser.sessionCookie,"STAFF"),one=await staff.connect(a.round),two=await staff.connect(a.round);const view=await one.synchronise();await two.synchronise();
      assert.equal(view.snapshot.security,null);assert.ok(!view.snapshot.streams.some((s:StreamHead)=>s.kind==="STAFF_SECURITY"));assert.ok(view.snapshot.streams.some((s:StreamHead)=>s.kind==="STAFF_SELF"));
      const ticket=await staff.post("tickets",{round_id:a.round}),third=io(`${address}/live`,{path:"/api/v1/live/socket",transports:["websocket"],autoConnect:false,reconnection:false,auth:{ticket:ticket.ticket},extraHeaders:{Origin:browser.origin,Cookie:staff.header()}});sockets.push(third);
      const denied=once(third,"connect_error",{signal:AbortSignal.timeout(3000)});third.connect();await denied;third.disconnect();one.socket.disconnect();two.socket.disconnect();
    });
    await t.test("a shared R2 claim notifies the rival currently editing it, without exposing the winning source or private wallet",async()=>{
      for(const socket of sockets)socket.disconnect();
      const race=await c.startRace(a.round),winner=await session(race.aa),rival=await session(race.ba),win=await winner.connect(),lose=await rival.connect();await win.synchronise();await lose.synchronise();
      lose.socket.volatile.emit("presence",{action:"ENTER",bounty_id:race.x});await until(()=>lose.presence.at(-1)?.editors.length===1);
      await c.budgets();const submission=(await c.service.submit(race.aa,race.round,race.x,"private winning source",randomUUID())).result.submission_id as string;await complete(submission);
      await until(()=>lose.events.some(e=>e.patch.type==="CLAIM"&&e.patch.bounty_id===race.x));
      await until(()=>lose.presence.at(-1)?.editors.length===0);
      assert.ok(!lose.events.some(e=>e.patch.type==="AWARD"));assert.equal(JSON.stringify(lose.events).includes("private winning source"),false);
      await assert.rejects(live.guarded({audience:"PARTICIPANT",cookie:a.aa,roundId:null},live.snapshot));currentCookie=race.aa;
      await assert.rejects(live.guarded({audience:"PARTICIPANT",cookie:a.aa,roundId:race.round},live.snapshot));
      const disconnected=once(lose.socket,"disconnect",{signal:AbortSignal.timeout(7000)});await c.budgets();await createEntryService(c.api,c.clock,c.delivery).logout(race.ba,{sessionId:race.ba.split(".")[1]!,requestKey:randomUUID()});await disconnected;
      assert.equal((await rival.request(`${rival.prefix}/snapshot`,{sync_id:lose.sync})).statusCode,503);
      win.socket.disconnect();
    });
    await t.test("Super Admin security streams are removed on a role change before another private enqueue",async()=>{
      const identity=await c.newStaff("SUPER_ADMIN");await c.newStaff("SUPER_ADMIN");const user=await session(identity.sessionCookie,"STAFF"),connection=await user.connect();
      const {snapshot}=await connection.synchronise();assert.ok(snapshot.streams.some((s:StreamHead)=>s.kind==="STAFF_SECURITY"));assert.ok(snapshot.security.length>=1);assert.equal(JSON.stringify(snapshot).includes("verifier"),false);
      const disconnected=once(connection.socket,"disconnect",{signal:AbortSignal.timeout(7000)}),transaction=await c.owner.connect();
      try{await transaction.query("BEGIN");await transaction.query("SELECT id FROM security_control WHERE id=1 FOR UPDATE");await transaction.query("UPDATE staff_identities SET role='OWNER',revision=revision+1 WHERE id=$1",[identity.id]);await transaction.query("COMMIT");}finally{transaction.release();}
      await disconnected;assert.equal((await user.request(`${user.prefix}/tickets`,{})).statusCode,401);
      await c.budgets();const flow=await createEntryService(c.api,c.clock,c.delivery).begin(identity.code,{ip:"127.0.0.1",browserId:randomUUID()});assert.equal(flow.audience,"STAFF");
      const signedIn=await createStaffService(c.api,c.clock,c.delivery).activate(flow.proofCookie,randomUUID());
      const current=await session(signedIn.sessionCookie,"STAFF"),successor=await current.connect(),view=await successor.synchronise();assert.equal(view.snapshot.security,null);assert.ok(!view.snapshot.streams.some((s:StreamHead)=>s.kind==="STAFF_SECURITY"));successor.socket.disconnect();
    });
    await t.test("clock failure stops live authority and a fresh connection requires a new snapshot handle",async()=>{
      const current=await session(currentCookie),old=await current.connect();await old.synchronise();const disconnected=once(old.socket,"disconnect",{signal:AbortSignal.timeout(7000)});healthy=false;await disconnected;healthy=true;
      assert.equal((await current.request(`${current.prefix}/snapshot`,{sync_id:old.sync})).statusCode,503);
      const fresh=await current.connect();assert.notEqual(fresh.sync,old.sync);await fresh.synchronise();fresh.socket.disconnect();
    });
    await t.test("a slow synchronising tab exceeding 256 buffered events must start over, without any economic effect",async()=>{
      const current=await session(currentCookie),slow=await current.connect(),before=await query("SELECT count(*)::text n FROM wallet_entries");
      const disconnected=once(slow.socket,"disconnect",{signal:AbortSignal.timeout(5000)});
      const round=(await live.guarded({audience:"PARTICIPANT",cookie:currentCookie,roundId:null},async context=>context.actor.round_id));
      await c.owner.query("SELECT competition_event($1,NULL,'ROUND_CHANGED',$1,date_trunc('milliseconds',clock_timestamp())) FROM generate_series(1,270)",[round]);
      await disconnected;assert.deepEqual(await query("SELECT count(*)::text n FROM wallet_entries"),before);
    });
    await t.test("a server restart clears transient handles but preserves committed scores and stream heads",async()=>{
      const current=await session(currentCookie),prior=await current.connect(),{snapshot}=await prior.synchronise();await app.close();
      app=makeApp();address=await app.listen({host:"127.0.0.1",port:0});
      assert.equal((await current.request(`${current.prefix}/snapshot`,{sync_id:prior.sync})).statusCode,503);
      const successor=await current.connect(),next=await successor.synchronise();assert.notEqual(successor.sync,prior.sync);assert.deepEqual(next.snapshot.hud,snapshot.hud);
      for(const stream of snapshot.streams)assert.ok(BigInt(next.snapshot.streams.find((s:StreamHead)=>s.stream_id===stream.stream_id).head)>=BigInt(stream.head));successor.socket.disconnect();
    });
    assert.equal((await query("SELECT rows=(SELECT count(*) FROM live_deliveries) AND reserved=(SELECT COALESCE(sum(remaining),0) FROM live_reservations) AS valid FROM live_control"))[0].valid,true);
  }finally{for(const socket of sockets)socket.disconnect();await app.close();}
}
