import assert from "node:assert/strict";
import test from "node:test";
import { LiveReplica,connectLive } from "../src/live/client.js";
import type { LiveEvent,StreamHead } from "../src/live/protocol.js";
const streams=(head="0"):StreamHead[]=>["round","team","member"].map(stream_id=>({stream_id,kind:stream_id,schema_version:1,head,retained_from:"1"}));
const event=(sequence:string,patch:Record<string,unknown>={type:"INVALIDATE",projection:"competition"},stream_id="team"):LiveEvent=>({stream_id,sequence,event_id:`id-${sequence}`,resource_revision:sequence,schema_version:1,patch});
function fixture(){let now=0;const invalidations:string[]=[],awards:string[]=[],replica=new LiveReplica(()=>now,s=>invalidations.push(s),s=>awards.push(s));replica.begin("sync");replica.snapshot("sync",streams());
  return{replica,invalidations,awards,time(value:number){now=value;}};}
test("a live replica merges buffered and replayed duplicates by stream and consecutive sequence",()=>{
  const {replica,invalidations}=fixture();replica.event("sync",event("2"),true);replica.event("sync",event("1"),true);replica.event("sync",event("1"),true);
  assert.equal(replica.ready("sync",streams().map(s=>s.stream_id==="team"?{...s,head:"2"}:s)),true);assert.equal(replica.cursors.get("team"),"2");assert.equal(invalidations.length,2);
  replica.event("sync",event("2"),false);assert.equal(invalidations.length,2);
});
test("a missing final event is detected from an authenticated head even without another event",()=>{
  const {replica}=fixture();replica.ready("sync",streams());const target=streams().map(s=>s.stream_id==="team"?{...s,head:"1"}:s);
  assert.equal(replica.head("sync",target),true);assert.equal(replica.gaps(target).length,1);
  replica.event("sync",event("1"),true);assert.equal(replica.gaps(target).length,0);
});
test("gaps cannot reach READY and old sync-generation messages cannot change a replacement snapshot",()=>{
  const {replica}=fixture();replica.event("sync",event("2"),true);
  assert.equal(replica.ready("sync",streams().map(s=>s.stream_id==="team"?{...s,head:"2"}:s)),false);
  replica.begin("replacement");replica.snapshot("replacement",streams("9"));assert.equal(replica.event("sync",event("10"),false),false);assert.equal(replica.cursors.get("team"),"9");
});
test("old claims and replayed own awards do not create a new win animation",()=>{
  const {replica,awards}=fixture(),patch={type:"AWARD",projection:"competition",award_id:"award-one"};
  replica.event("sync",event("1",patch),true);replica.ready("sync",streams().map(s=>s.stream_id==="team"?{...s,head:"1"}:s));assert.deepEqual(awards,[]);
  replica.event("sync",event("2",{...patch,award_id:"award-two"}),false);replica.observeAward("award-two",true);
  replica.event("sync",event("3",{type:"CLAIM",projection:"competition",award_id:"rival"}),false);assert.deepEqual(awards,["award-two"]);
});
test("HTTP-first award observation and reconnect replay cannot double the animation",()=>{
  const {replica,awards}=fixture();replica.ready("sync",streams());replica.observeAward("one",true);
  replica.event("sync",event("1",{type:"AWARD",award_id:"one"}),false);replica.begin("two");replica.snapshot("two",streams("1"));replica.ready("two",streams("1"));replica.observeAward("one",true);assert.deepEqual(awards,["one"]);
});
test("a live own award carries its bounty to the presentation queue exactly once",()=>{
  const awards:{id:string;bounty:string|undefined}[]=[];
  const replica=new LiveReplica(()=>0,()=>{},(id,bounty)=>awards.push({id,bounty}));
  replica.begin("sync");replica.snapshot("sync",streams());replica.ready("sync",streams());
  const patch={type:"AWARD",award_id:"won",bounty_id:"target"};
  replica.event("sync",event("1",patch),false);replica.event("sync",event("2",patch),false);
  replica.event("sync",event("3",{...patch,award_id:"historical"}),true);
  assert.deepEqual(awards,[{id:"won",bounty:"target"}]);
});
test("stale heads disable writes at ten seconds without pretending that competition time paused",()=>{
  const {replica,time}=fixture();assert.equal(replica.writable(),false);replica.ready("sync",streams());time(9999);assert.equal(replica.writable(),true);time(10000);assert.equal(replica.writable(),false);assert.equal(replica.phase,"STALE");
});
test("schema mismatch, unowned streams and pruned history require a new snapshot",()=>{
  let f=fixture();f.replica.ready("sync",streams());assert.equal(f.replica.event("sync",{...event("1"),schema_version:2},false),false);
  f=fixture();f.replica.ready("sync",streams());assert.equal(f.replica.event("sync",event("1",{},"other-team"),false),false);
  f=fixture();f.replica.ready("sync",streams());assert.equal(f.replica.head("sync",streams("5").map(s=>({...s,retained_from:"3"}))),false);
});
test("a bounded synchronization buffer fails closed instead of discarding a gap",()=>{
  const {replica}=fixture();for(let i=1;i<=256;i++)assert.equal(replica.event("sync",event(String(i)),true),true);
  assert.equal(replica.event("sync",event("257"),true),false);assert.equal(replica.phase,"STALE");
});
test("decimal cursors stay lossless above JavaScript's safe integer range",()=>{
  const {replica}=fixture();const n="9007199254740993";replica.snapshot("sync",streams(n));replica.ready("sync",streams(n));replica.event("sync",event("9007199254740994"),false);assert.equal(replica.cursors.get("team"),"9007199254740994");
});
test("oversized UTF-8 events fail closed before entering the replay buffer",()=>{
  const {replica}=fixture();assert.equal(replica.event("sync",event("1",{type:"INVALIDATE",projection:"competition",text:"\u20ac".repeat(6000)}),true),false);
});
test("duplicate or impossible stream heads cannot hide a missing private stream",()=>{
  let f=fixture();const data=streams();assert.equal(f.replica.head("sync",[data[0]!,data[0]!,data[1]!]),false);
  f=fixture();assert.equal(f.replica.snapshot("sync",streams().map(s=>({...s,retained_from:"3"}))),false);
});
test("the client renews a live editor at fifteen seconds and never buffers an offline intent",async t=>{
  t.mock.timers.enable({apis:["setInterval"]});
  let now=0,connected=false;const listeners=new Map<string,(value:any)=>void>(),commands:{event:string;value:any}[]=[];
  const client=connectLive("PARTICIPANT",null,{now:()=>now,post:async(path)=>path.endsWith("tickets")?{ticket:"ticket"}:path.endsWith("snapshot")?{sync_id:"sync",streams:streams()}:{sync_id:"sync",events:[],next:"0",through:"0",heads:streams()},
    transport(){return{get connected(){return connected;},on(event,listener){listeners.set(event,listener);},connect(){connected=true;listeners.get("sync")!({sync_id:"sync"});},disconnect(){connected=false;},volatile:{emit(event,value){commands.push({event,value});if(event==="ready")listeners.get("ready")!({sync_id:"sync",heads:streams()});}}};},
    install(){},invalidate(){},award(){},presence(){},state(){}});
  try{
    for(let i=0;i<20;i++)await Promise.resolve();assert.equal(client.replica.phase,"READY");client.edit("bug");
    for(const time of [5000,10000]){now=time;listeners.get("heads")!({sync_id:"sync",heads:streams()});t.mock.timers.tick(5000);}
    now=14999;t.mock.timers.tick(4999);assert.equal(commands.filter(c=>c.event==="presence"&&c.value.action==="RENEW").length,0);
    now=15000;t.mock.timers.tick(1);assert.equal(commands.filter(c=>c.event==="presence"&&c.value.action==="RENEW").length,1);
    connected=false;const count=commands.length;client.edit("different-bug");assert.equal(commands.length,count);
  }finally{client.close();}
});
