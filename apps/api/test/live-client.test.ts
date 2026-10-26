import assert from "node:assert/strict";
import test from "node:test";
import { LiveReplica,connectLive } from "../src/live/client.js";
import type { LiveEvent,StreamHead } from "../src/live/protocol.js";
const streams=(head="0"):StreamHead[]=>["round","team","member"].map(stream_id=>({stream_id,kind:stream_id,schema_version:1,head,retained_from:"1"}));
const event=(sequence:string,patch:Record<string,unknown>={type:"INVALIDATE",projection:"competition"},stream_id="team"):LiveEvent=>({stream_id,sequence,event_id:`id-${sequence}`,resource_revision:sequence,schema_version:1,patch});
function fixture(){let now=0;const invalidations:string[]=[],awards:string[]=[],replica=new LiveReplica(()=>now,s=>invalidations.push(s),s=>awards.push(s));replica.begin("sync");replica.snapshot("sync",streams());
  return{replica,invalidations,awards,time(value:number){now=value;}};}

for(const changed of [null,"member"]){
  test(`synchronisation establishes one server barrier and reads only streams with missing events (${changed})`,async()=>{
    const listeners=new Map<string,(value:any)=>void>(),requests:string[]=[],awards:string[]=[];
    const barrier=streams().map(s=>s.stream_id===changed?{...s,head:"1"}:s);
    const client=connectLive("PARTICIPANT",null,{now:()=>0,
      post:async(path,body:any)=>{
        if(path.endsWith("tickets"))return{ticket:"ticket"};
        if(path.endsWith("snapshot"))return{sync_id:"sync",streams:streams()};
        assert.ok(path.endsWith("replay"));requests.push(body.stream_id);
        return{sync_id:"sync",events:body.stream_id===changed?[event("1",{type:"AWARD",award_id:"historical"},changed!)]:[],next:body.stream_id===changed?"1":"0",through:body.stream_id===changed?"1":"0",heads:barrier};
      },
      transport(){return{connected:true,on(name,fn){listeners.set(name,fn);},connect(){listeners.get("sync")!({sync_id:"sync"});},disconnect(){},volatile:{emit(name){if(name==="ready")listeners.get("ready")!({sync_id:"sync",heads:barrier});}}};},
      install(){},invalidate(){},award(id){awards.push(id);},presence(){},state(){}});
    try{
      for(let i=0;i<40;i++)await Promise.resolve();
      assert.equal(client.replica.phase,"READY");assert.deepEqual(requests,changed?["round",changed]:["round"]);
      assert.equal(client.replica.cursors.get("member"),changed?"1":"0");assert.deepEqual(awards,[]);
    }finally{client.close();}
  });
}
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

for (const scenario of [{status:503,code:"CAPACITY_UNAVAILABLE",failures:1},{status:429,code:"RATE_LIMITED",failures:1},{status:503,code:"CAPACITY_UNAVAILABLE",failures:3},{status:401,code:"AUTHORITY_REQUIRED",failures:1}]) {
  const {failures,...failure}=scenario;
  test(`read projection ${failure.code} with ${failures} refusals has bounded recovery`,async t=>{
    t.mock.timers.enable({apis:["setTimeout","setInterval"]});
    t.mock.method(Math,"random",()=>0);
    const listeners=new Map<string,(value:any)=>void>();
    let reads=0,connections=0,installs=0;
    const flush=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};
    const client=connectLive("PARTICIPANT",null,{now:()=>0,
      post:async(path)=>{
        if(path.endsWith("tickets"))return{ticket:"ticket"};
        if(path.endsWith("snapshot"))return{sync_id:"sync",streams:streams()};
        if(path.endsWith("projection")){if(++reads<=failures)throw failure;return{sync_id:"sync",streams:streams("1")};}
        return{sync_id:"sync",events:[],next:"0",through:"0",heads:streams()};
      },
      transport(){connections++;return{connected:true,on(name,fn){listeners.set(name,fn);},connect(){listeners.get("sync")!({sync_id:"sync"});},disconnect(){},volatile:{emit(name){if(name==="ready")listeners.get("ready")!({sync_id:"sync",heads:streams()});}}};},
      install(){installs++;},invalidate(){},award(){},presence(){},state(){}});
    try{
      await flush();assert.equal(client.replica.phase,"READY");
      listeners.get("event")!({...event("1"),sync_id:"sync",replay:false});
      t.mock.timers.tick(100);await flush();
      if(failure.status===401){assert.equal(reads,1);assert.equal(client.replica.phase,"STALE");return;}
      assert.equal(reads,1);assert.equal(connections,1);assert.equal(client.replica.phase,"READY");
      t.mock.timers.tick(999);await flush();assert.equal(reads,1);
      t.mock.timers.tick(1001);await flush();
      if(failures===3){
        assert.equal(reads,2);assert.equal(connections,1);
        t.mock.timers.tick(2000);await flush();
        assert.equal(reads,3);assert.equal(client.replica.phase,"STALE");return;
      }
      assert.equal(reads,2);assert.equal(connections,1);assert.equal(installs,2);
      t.mock.timers.tick(5000);await flush();assert.equal(reads,2);
    }finally{client.close();}
  });
}

for(const mode of ["NONE","REPLY","FAILURE"])test(`a current pushed projection suppresses duplicate reads and fences old HTTP/sync replies (${mode})`,async t=>{
  const pending=mode!=="NONE";
  t.mock.timers.enable({apis:["setTimeout","setInterval"]});
  const listeners=new Map<string,(value:any)=>void>(),installed:string[]=[];let reads=0,reply:((value:any)=>void)|undefined,refuse:((error:unknown)=>void)|undefined;
  const flush=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};
  const client=connectLive("PARTICIPANT",null,{now:()=>0,
    post:async(path)=>{
      if(path.endsWith("tickets"))return{ticket:"ticket"};
      if(path.endsWith("snapshot"))return{sync_id:"sync",streams:streams(),marker:"initial"};
      if(path.endsWith("projection")){reads++;return new Promise((resolve,reject)=>{reply=resolve;refuse=reject;});}
      return{sync_id:"sync",events:[],next:"0",through:"0",heads:streams()};
    },
    transport(){return{connected:true,on(name,fn){listeners.set(name,fn);},connect(){listeners.get("sync")!({sync_id:"sync"});},disconnect(){},
      volatile:{emit(name){if(name==="ready")listeners.get("ready")!({sync_id:"sync",heads:streams()});}}};},
    install(value){installed.push(value.marker as string);},invalidate(){},award(){},presence(){},state(){}});
  try{
    await flush();assert.equal(client.replica.phase,"READY");
    listeners.get("event")!({...event("1",{projection:"competition"},"round"),sync_id:"sync",replay:false});
    if(pending){t.mock.timers.tick(100);await flush();assert.equal(reads,1);}
    const heads=streams().map(head=>head.stream_id==="round"?{...head,head:"1"}:head);
    assert.equal(typeof listeners.get("projection"),"function");
    listeners.get("projection")!({sync_id:"sync",streams:heads,marker:"current"});
    listeners.get("projection")!({sync_id:"old-sync",streams:heads,marker:"foreign"});
    listeners.get("projection")!({sync_id:"sync",streams:streams(),marker:"old-push"});
    if(mode==="FAILURE")refuse?.({status:401,code:"AUTHORITY_REQUIRED"});else reply?.({sync_id:"sync",streams:streams(),marker:"old-http"});await flush();
    t.mock.timers.tick(1000);await flush();assert.equal(reads,pending?1:0);
    assert.deepEqual(installed,["initial","current"]);assert.equal(client.replica.phase,"READY");
  }finally{client.close();}
});

for(const kind of ["HTTP_CAPACITY","HTTP_RATE","SNAPSHOT_CAPACITY","SOCKET_CAPACITY","NETWORK"] as const){
  for(const random of [0,0.5])test(`explicit ${kind} backpressure spreads retries without delaying ordinary network recovery (${random})`,async t=>{
    t.mock.timers.enable({apis:["setTimeout","setInterval"]});t.mock.method(Math,"random",()=>random);
    const listeners=new Map<string,(value:any)=>void>();let attempts=0;
    const flush=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};
    const client=connectLive("PARTICIPANT",null,{now:()=>0,
      post:async(path)=>{
        if(path.endsWith("tickets")){
          attempts++;
          if(kind==="HTTP_CAPACITY")throw{status:503,code:"CAPACITY_UNAVAILABLE"};
          if(kind==="HTTP_RATE")throw{status:429,code:"RATE_LIMITED"};
          if(kind==="NETWORK")throw new Error("Synthetic network failure");
          return{ticket:"ticket"};
        }
        assert.equal(kind,"SNAPSHOT_CAPACITY");throw{status:503,code:"CAPACITY_UNAVAILABLE"};
      },
      transport(){return{connected:true,on(name,fn){listeners.set(name,fn);},
        connect(){if(kind==="SOCKET_CAPACITY")listeners.get("connect_error")!({data:{code:"CAPACITY_UNAVAILABLE"}});else listeners.get("sync")!({sync_id:"sync"});},
        disconnect(){},volatile:{emit(){}}};},
      install(){},invalidate(){},award(){},presence(){},state(){}});
    try{
      await flush();assert.equal(attempts,1);
      const wait=kind==="NETWORK"?250+1000*random:Math.max(1000,250+30000*random);
      t.mock.timers.tick(wait-1);await flush();assert.equal(attempts,1);
      t.mock.timers.tick(1);await flush();assert.equal(attempts,2);assert.equal(client.replica.phase,"STALE");
    }finally{client.close();}
  });
}

for(const random of [0,0.9]){
  test(`reconnect backoff staggers readers across a shared network (${random})`,async t=>{
    t.mock.timers.enable({apis:["setTimeout","setInterval"]});
    t.mock.method(Math,"random",()=>random);
    let attempts=0;
    const flush=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
    const client=connectLive("PARTICIPANT",null,{now:()=>0,post:async(path)=>{assert.ok(path.endsWith("tickets"));attempts++;throw new Error("Synthetic unavailable endpoint");},
      transport(){throw new Error("No ticket was issued");},install(){},invalidate(){},award(){},presence(){},state(){}});
    try{
      await flush();assert.equal(attempts,1);
      for(let retry=0;retry<6;retry++){
        const wait=250+Math.min(30000,1000*2**Math.min(retry,5))*random;
        t.mock.timers.tick(wait-1);await flush();assert.equal(attempts,retry+1);
        t.mock.timers.tick(1);await flush();assert.equal(attempts,retry+2);
        assert.equal(client.replica.phase,"STALE");
      }
    }finally{client.close();}
  });
}

test("a slow ticket request cannot overlap with timer-driven reconnects or install a socket after close",async t=>{
  t.mock.timers.enable({apis:["setTimeout","setInterval"]});
  const replies:((value:unknown)=>void)[]=[];
  let transports=0;
  const flush=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
  const client=connectLive("PARTICIPANT",null,{now:()=>0,post:async()=>new Promise(resolve=>replies.push(resolve)),
    transport(){transports++;throw new Error("Late ticket must not create a socket");},install(){},invalidate(){},award(){},presence(){},state(){}});
  try {
    await flush();assert.equal(replies.length,1);
    t.mock.timers.tick(1000);await flush();
    t.mock.timers.tick(1000);await flush();
    assert.equal(replies.length,1,"Only one ticket request may be in flight");
    client.close();replies[0]!({ticket:"late"});await flush();assert.equal(transports,0);
  }finally{client.close();}
});

test("a timed-out ticket cannot install over its successor and the handshake deadline remains bounded",async t=>{
  t.mock.timers.enable({apis:["setTimeout","setInterval"]});t.mock.method(Math,"random",()=>0);
  const replies:((value:unknown)=>void)[]=[];
  let transports=0;
  const flush=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
  const client=connectLive("PARTICIPANT",null,{now:()=>0,post:async()=>new Promise(resolve=>replies.push(resolve)),
    transport(){transports++;return{connected:false,on(){},connect(){},disconnect(){},volatile:{emit(){}}};},
    install(){},invalidate(){},award(){},presence(){},state(){}});
  try{
    await flush();assert.equal(replies.length,1);
    t.mock.timers.tick(10000);await flush();assert.equal(client.replica.phase,"STALE");
    t.mock.timers.tick(250);await flush();assert.equal(replies.length,2);
    replies[0]!({ticket:"expired"});await flush();assert.equal(transports,0);
    replies[1]!({ticket:"current"});await flush();assert.equal(transports,1);
    t.mock.timers.tick(1000);await flush();assert.equal(replies.length,2);
    t.mock.timers.tick(10000);await flush();assert.equal(client.replica.phase,"STALE");
  }finally{client.close();}
});

test("idle heads need no acknowledgement, but pending heads repeat it after a lost reply",async()=>{
  const listeners=new Map<string,(value:any)=>void>(),commands:string[]=[];
  const client=connectLive("PARTICIPANT",null,{now:()=>0,
    post:async(path)=>path.endsWith("tickets")?{ticket:"ticket"}:path.endsWith("snapshot")?{sync_id:"sync",streams:streams()}:{sync_id:"sync",events:[],next:"0",through:"0",heads:streams()},
    transport(){return{connected:true,on(event,listener){listeners.set(event,listener);},connect(){listeners.get("sync")!({sync_id:"sync"});},disconnect(){},volatile:{emit(event){commands.push(event);if(event==="ready")listeners.get("ready")!({sync_id:"sync",heads:streams()});}}};},
    install(){},invalidate(){},award(){},presence(){},state(){}});
  try{
    for(let i=0;i<30;i++)await Promise.resolve();assert.equal(client.replica.phase,"READY");
    listeners.get("heads")!({sync_id:"sync",heads:streams(),ack_required:false});
    assert.equal(commands.filter(e=>e==="ack").length,0);
    for(let i=0;i<2;i++)listeners.get("heads")!({sync_id:"sync",heads:streams(),ack_required:true});
    assert.equal(commands.filter(e=>e==="ack").length,2);
    listeners.get("heads")!({sync_id:"sync",heads:streams()});
    assert.equal(commands.filter(e=>e==="ack").length,3,"Older servers retain the conservative acknowledgement behaviour");
  }finally{client.close();}
});

for(const mode of ["DELAYED","INVALID","GAP","BUFFERED"] as const){
  test(`the server ready acknowledgement verifies heads and liveness (${mode})`,async t=>{
    t.mock.timers.enable({apis:["setTimeout","setInterval"]});
    const listeners=new Map<string,(value:any)=>void>(),commands:string[]=[];
    let now=0,awards=0,tickets=0;
    const client=connectLive("PARTICIPANT",null,{now:()=>now,
      post:async(path)=>{
        if(path.endsWith("tickets")){tickets++;return{ticket:"ticket"};}
        if(path.endsWith("snapshot"))return{sync_id:"sync",streams:streams()};
        return{sync_id:"sync",events:[],next:"0",through:"0",heads:streams()};
      },
      transport(){return{connected:true,on(name,listener){listeners.set(name,listener);},connect(){listeners.get("sync")!({sync_id:"sync"});},disconnect(){},volatile:{emit(name){commands.push(name);}}};},
      install(){},invalidate(){},award(){awards++;},presence(){},state(){}});
    try{
      for(let i=0;i<30;i++)await Promise.resolve();
      assert.equal(client.replica.phase,"SYNCING");client.edit("bug");now=12000;
      if(mode==="BUFFERED")for(const stream of streams())listeners.get("event")!({...event("1",{type:"AWARD",award_id:"already-recorded",bounty_id:"bug"}),stream_id:stream.stream_id,sync_id:"sync"});
      const readyHeads=mode==="INVALID"?[streams()[0]!,streams()[0]!,streams()[1]!]:streams(mode==="GAP"||mode==="BUFFERED"?"1":"0");
      listeners.get("ready")!({sync_id:"sync",heads:readyHeads});
      if(mode==="INVALID")assert.equal(client.replica.phase,"STALE");
      else if(mode==="GAP"){
        assert.equal(client.replica.phase,"SYNCING");assert.ok(commands.includes("resync"));
      }else{
        assert.equal(client.replica.writable(),true);
        assert.ok(commands.includes("presence"));
        if(mode==="BUFFERED")assert.ok([...client.replica.cursors.values()].every(cursor=>cursor==="1"));
      }
      assert.equal(tickets,1);assert.equal(awards,0);
      if(mode==="INVALID"||mode==="GAP")assert.ok(!commands.includes("presence"));
    }finally{client.close();}
  });
}
