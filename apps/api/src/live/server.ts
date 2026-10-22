import { randomUUID, createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import { Server } from "socket.io";
import type { Socket } from "socket.io";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { browserId, boundedCookies } from "../access/browser-policy.js";
import type { BrowserPolicy } from "../access/browser-policy.js";
import { browserHttpQuota, memberReadQuota, staffQuota } from "../access/quotas.js";
import { AccessError } from "../access/transaction.js";
import type { EntryHttpOptions } from "../access/http.js";
import { createLiveService, scopeKey } from "./service.js";
import type { LiveActor, LiveAuth, LiveContext } from "./service.js";
import { decimal, exactObject, LIVE_LIMITS } from "./protocol.js";
import type { LiveEvent, StreamHead } from "./protocol.js";

interface Ticket { auth:LiveAuth; binding:string; expires:number; }
interface Peer {
  socket:Socket; auth:LiveAuth; actor:LiveActor; scope:string; streams:StreamHead[]; sync:string; expires:number; phase:"SYNCING"|"READY";
  snapshot:Map<string,string>|null; barrier:StreamHead[]|null; cursor:Map<string,string>; buffered:LiveEvent[]; bytes:number; lastHead:number;
  intent:{bounty:string; renewed:number}|null; presenceVersion:number; presenceDigest:string; commandAt:number; tokens:number; queued:number; commands:Promise<void>;
}
const hash=(value:string)=>createHash("sha256").update(value).digest("hex");
const heads=(streams:StreamHead[])=>new Map(streams.map(s=>[s.stream_id,s.head]));
const publicFailure=()=>({code:"LIVE_RESYNC_REQUIRED"});

export function installLive(app:FastifyInstance,options:EntryHttpOptions,policy:BrowserPolicy) {
  const service=createLiveService(options.pool,options.clock,options.delivery);
  const tickets=new Map<string,Ticket>(), peers=new Map<string,Peer>(), pending=new Map<string,{session:string;expires:number}>(), presenceVersions=new Map<string,number>();
  let handshakes=0;
  const io=new Server(app.server,{path:"/api/v1/live/socket",serveClient:false,maxHttpBufferSize:4096,connectTimeout:10000,
    perMessageDeflate:false,httpCompression:false,transports:["websocket"],
    allowRequest:(request,done)=>{
      const query=new URL(request.url??"/","http://local").searchParams;
      if(handshakes>=128 || io.engine.clientsCount>=1152 || request.headers.origin!==policy.origin || [...query.keys()].some(k=>!["EIO","transport","sid","t","b64"].includes(k))){done(null,false);return;}
      handshakes++;
      void browserHttpQuota(options.pool,options.clock,request.socket.remoteAddress??"unknown").then(()=>done(null,true),()=>done(null,false)).finally(()=>{handshakes--;});
    }});
  const namespace=io.of("/live");
  let timer:ReturnType<typeof setInterval>|undefined, polling=false, closed=false, maintenanceAt=0,reportedAt=-Infinity;
  const dirty=(p:Peer)=>{if(p.actor.team_round_id) presenceVersions.set(p.actor.team_round_id,(presenceVersions.get(p.actor.team_round_id)??0)+1);};
  const binding=(cookie:string,browser:string,audience:string)=>hash(JSON.stringify([cookie,browser,audience]));
  function control(p:Peer,event:string,value:unknown){if(!p.socket.connected||!p.socket.conn.transport.writable)return false;p.socket.emit(event,value);return true;}
  function cleanTickets(){const now=performance.now();for(const [id,t] of tickets)if(t.expires<=now)tickets.delete(id);for(const[id,p]of pending)if(p.expires<=now)pending.delete(id);}
  async function quota(auth:LiveAuth) { const actor=await service.guarded(auth,async c=>c.actor);
    if(actor.audience==="PARTICIPANT") await memberReadQuota(options.pool,options.clock,actor.member_id!);
    else await staffQuota(options.pool,options.clock,actor.staff_id!,"READ_STAFF");
  }
  async function ticket(request:FastifyRequest,audience:LiveAuth["audience"],roundId:string|null) {
    cleanTickets(); if(tickets.size>=1024) throw new AccessError("REQUEST_CAPACITY_UNAVAILABLE");
    const cookie=request.cookies[audience==="STAFF"?policy.names.staff:policy.names.participant], browser=browserId(request,policy);
    if(!cookie || !browser)throw new AccessError("INVALID_SESSION");
    const auth:LiveAuth={audience,cookie,roundId}; await quota(auth);
    const id=randomUUID();tickets.set(id,{auth,binding:binding(cookie,browser,audience),expires:performance.now()+10000});
    return {ticket:id,expires_in_ms:10000,path:"/api/v1/live/socket",namespace:"/live",transports:["websocket"]};
  }
  function reset(p:Peer) {
    if(p.intent){p.intent=null;dirty(p);}
    p.sync=randomUUID();p.expires=performance.now()+LIVE_LIMITS.syncMs;p.phase="SYNCING";p.snapshot=null;p.barrier=null;p.buffered=[];p.bytes=0;
    p.socket.emit("sync",{schema_version:1,sync_id:p.sync,expires_in_ms:LIVE_LIMITS.syncMs});
  }
  function ensure(p:Peer,context:LiveContext){if(p.scope!==scopeKey(context.actor,context.streams))throw new AccessError("LIVE_RESYNC_REQUIRED");}
  function peer(request:FastifyRequest,audience:LiveAuth["audience"],sync:string,synchronising=true) {
    const cookie=request.cookies[audience==="STAFF"?policy.names.staff:policy.names.participant];
    const browser=browserId(request,policy);
    const p=[...peers.values()].find(p=>p.sync===sync && p.auth.audience===audience && p.auth.cookie===cookie && p.socket.data.browser===browser);
    if(!p || synchronising && p.expires<=performance.now() || !p.socket.connected)throw new AccessError("LIVE_RESYNC_REQUIRED");
    return p;
  }
  async function snapshot(request:FastifyRequest,audience:LiveAuth["audience"],sync:string) {
    const p=peer(request,audience,sync);await quota(p.auth);
    const value=await service.guarded(p.auth,async c=>{ensure(p,c);return service.snapshot(c);});
    if(p.sync!==sync || p.expires<=performance.now())throw new AccessError("LIVE_RESYNC_REQUIRED");
    p.snapshot=heads(value.streams);p.cursor=new Map(p.snapshot);p.barrier=null;
    p.buffered=p.buffered.filter(e=>BigInt(e.sequence)>BigInt(p.snapshot!.get(e.stream_id)??"0"));p.bytes=p.buffered.reduce((n,e)=>n+Buffer.byteLength(JSON.stringify(e)),0);
    return {...value,sync_id:sync};
  }
  async function replay(request:FastifyRequest,audience:LiveAuth["audience"],input:{sync_id:string;stream_id:string;after:string}) {
    const p=peer(request,audience,input.sync_id);if(!p.snapshot)throw new AccessError("LIVE_RESYNC_REQUIRED");await quota(p.auth);
    return service.guarded(p.auth,async c=>{
      ensure(p,c);p.barrier??=c.streams;
      const target=p.barrier.find(s=>s.stream_id===input.stream_id), start=p.snapshot!.get(input.stream_id);
      if(!target || !start || !decimal(input.after) || BigInt(input.after)<BigInt(start))throw new AccessError("LIVE_RESYNC_REQUIRED");
      const value=await service.page(c,input.stream_id,input.after,target.head);
      return {...value,heads:p.barrier,sync_id:p.sync};
    });
  }
  async function projection(request:FastifyRequest,audience:LiveAuth["audience"],sync:string){
    const p=peer(request,audience,sync,false);if(p.phase!=="READY")throw new AccessError("LIVE_RESYNC_REQUIRED");await quota(p.auth);
    const result=await service.guarded(p.auth,async c=>{ensure(p,c);return service.snapshot(c);});
    if(p.sync!==sync||!p.socket.connected)throw new AccessError("LIVE_RESYNC_REQUIRED");return{...result,sync_id:sync};
  }
  namespace.use(async (socket,next)=>{
    try {
      options.clock.assertHealthy();cleanTickets();
      if(socket.handshake.headers.origin!==policy.origin || !exactObject(socket.handshake.auth,["ticket"]) || typeof socket.handshake.auth.ticket!=="string")throw new AccessError("INVALID_SESSION");
      boundedCookies({headers:socket.handshake.headers} as FastifyRequest,policy);
      const cookies=app.parseCookie(socket.handshake.headers.cookie??""), signed=app.unsignCookie(cookies[policy.names.browser]??"");
      const id=socket.handshake.auth.ticket as string, t=tickets.get(id);tickets.delete(id);
      if(!t || t.expires<=performance.now() || !signed.valid || !signed.value)throw new AccessError("INVALID_SESSION");
      const cookie=cookies[t.auth.audience==="STAFF"?policy.names.staff:policy.names.participant];
      if(!cookie || binding(cookie,signed.value,t.auth.audience)!==t.binding)throw new AccessError("INVALID_SESSION");
      await browserHttpQuota(options.pool,options.clock,socket.handshake.address);
      const initial=await service.guarded(t.auth,async c=>({actor:c.actor,streams:c.streams}));
      const key=initial.actor.session_id;
      const cap=initial.actor.audience==="PARTICIPANT"?3:2;
      if(peers.size+pending.size>=1024 || [...peers.values()].filter(p=>p.actor.session_id===key).length+[...pending.values()].filter(p=>p.session===key).length>=cap)throw new AccessError("REQUEST_CAPACITY_UNAVAILABLE");
      pending.set(socket.id,{session:key,expires:performance.now()+10000});
      socket.data.live={auth:t.auth,...initial,browser:signed.value};next();
    } catch {next(new Error("LIVE_AUTHORITY_REQUIRED"));}
  });
  namespace.on("connection",socket=>{
    pending.delete(socket.id);
    const {auth,actor,streams,browser}=socket.data.live as {auth:LiveAuth;actor:LiveActor;streams:StreamHead[];browser:string};delete socket.data.live;socket.data.browser=browser;
    const p:Peer={socket,auth,actor,scope:scopeKey(actor,streams),streams,sync:"",expires:0,phase:"SYNCING",snapshot:null,barrier:null,
      cursor:heads(streams),buffered:[],bytes:0,lastHead:0,intent:null,presenceVersion:-1,presenceDigest:"",commandAt:performance.now(),tokens:12,queued:0,commands:Promise.resolve()};
    peers.set(socket.id,p);
    socket.on("disconnect",()=>{peers.delete(socket.id);dirty(p);if(p.actor.team_round_id&&![...peers.values()].some(x=>x.actor.team_round_id===p.actor.team_round_id))presenceVersions.delete(p.actor.team_round_id);});
    socket.onAny((event,...args)=>{
      // No durable actions travel over this channel, and every accepted command is bounded.
      const now=performance.now();p.tokens=Math.min(12,p.tokens+(now-p.commandAt)*0.012);p.commandAt=now;
      if(!["ready","ack","presence","resync"].includes(event) || args.length!==1 || p.tokens<1 || p.queued>=8){socket.emit("resync_required",publicFailure());socket.disconnect(true);return;}
      p.tokens--;p.queued++;
      p.commands=p.commands.then(()=>command(p,event,args[0])).catch(error=>{app.log.warn({event:"live_command_refused",code:error instanceof AccessError?error.code:(error as {code?:string}).code??"UNAVAILABLE"});p.socket.emit("resync_required",publicFailure());p.socket.disconnect(true);}).finally(()=>{p.queued--;});
    });
    reset(p);
  });
  async function command(p:Peer,event:string,input:unknown) {
    if(event==="resync"){
      if(!exactObject(input,[]))throw new AccessError("INVALID_CONTEXT");
      await service.guarded(p.auth,async c=>{ensure(p,c);p.streams=c.streams;p.cursor=heads(c.streams);reset(p);});return;
    }
    if(event==="presence"){
      if(p.phase!=="READY" || !exactObject(input,["action","bounty_id"]) || !["ENTER","RENEW","LEAVE"].includes(String(input.action)))throw new AccessError("INVALID_CONTEXT");
      await service.guarded(p.auth,async c=>{
        ensure(p,c);
        if(input.action==="LEAVE"){p.intent=null;dirty(p);return;}
        if(typeof input.bounty_id!=="string" || input.action==="RENEW" && p.intent?.bounty!==input.bounty_id)throw new AccessError("INVALID_CONTEXT");
        const eligible=await service.presence(c,input.bounty_id);
        if(!eligible){p.intent=null;dirty(p);return;}
        p.intent={bounty:input.bounty_id,renewed:performance.now()};dirty(p);
      });return;
    }
    if(!exactObject(input,["sync_id","heads"]) || input.sync_id!==p.sync || !exactObject(input.heads,p.streams.map(s=>s.stream_id)))throw new AccessError("LIVE_RESYNC_REQUIRED");
    const acknowledged=input.heads as Record<string,unknown>;
    await service.guarded(p.auth,async c=>{
      ensure(p,c);
      for(const s of c.streams)if(!decimal(acknowledged[s.stream_id]) || BigInt(acknowledged[s.stream_id] as string)>BigInt(s.head))throw new AccessError("LIVE_RESYNC_REQUIRED");
      if(event==="ready"){
        if(!p.snapshot || !p.barrier || p.expires<=performance.now() || p.barrier.some(s=>BigInt(acknowledged[s.stream_id] as string)<BigInt(s.head)))throw new AccessError("LIVE_RESYNC_REQUIRED");
        p.phase="READY";p.socket.emit("ready",{sync_id:p.sync,heads:c.streams,server_time:c.now.toISOString()});
      }
      p.buffered=p.buffered.filter(e=>BigInt(e.sequence)>BigInt(acknowledged[e.stream_id] as string));
      p.bytes=p.buffered.reduce((n,e)=>n+Buffer.byteLength(JSON.stringify(e)),0);
    });
  }
  async function presenceView(c:LiveContext,p:Peer) {
    const grouped=new Map<string,{member_round_id:string;name:string;bounty_id:string;paused:boolean;tabs:number}>();
    for(const other of peers.values()){
      const intent=other.intent;
      if(!intent || other.actor.team_round_id!==p.actor.team_round_id || other.actor.round_id!==p.actor.round_id)continue;
      // Revalidate the announcing session as well as the recipient, without renewing either session.
      const valid=await service.intent(c,other.auth,other.actor,intent.bounty);
      if(other.intent!==intent||!other.socket.connected)continue;
      if(!valid){other.intent=null;dirty(other);continue;}
      const k=`${other.actor.member_round_id}:${intent.bounty}`,existing=grouped.get(k);
      if(existing)existing.tabs++;else grouped.set(k,{member_round_id:other.actor.member_round_id!,name:other.actor.name,bounty_id:intent.bounty,paused:valid.paused,tabs:1});
    }
    return [...grouped.values()].sort((a,b)=>a.member_round_id.localeCompare(b.member_round_id)||a.bounty_id.localeCompare(b.bounty_id));
  }
  async function tick() {
    if(polling || closed)return;polling=true;
    try {
      options.clock.assertHealthy();cleanTickets();const now=performance.now();
      for(const p of peers.values())if(p.intent && now-p.intent.renewed>=LIVE_LIMITS.presenceTtlMs){p.intent=null;dirty(p);}
      const all=(await options.pool.query<{id:string;head:string}>("SELECT id,head::text FROM live_streams")).rows, current=new Map(all.map(s=>[s.id,s.head]));
      await options.pool.query("SELECT live_publish_batch()");
      async function deliver(p:Peer) {
        if(p.phase==="SYNCING" && now>=p.expires){p.socket.emit("resync_required",publicFailure());p.socket.disconnect(true);return;}
        const presenceVersion=presenceVersions.get(p.actor.team_round_id??"")??0;
        if(now-p.lastHead<LIVE_LIMITS.headMs && presenceVersion===p.presenceVersion && p.streams.every(s=>current.get(s.stream_id)===p.cursor.get(s.stream_id)))return;
        await service.guarded(p.auth,async c=>{
          ensure(p,c);p.streams=c.streams;
          for(const s of c.streams){
            const from=p.cursor.get(s.stream_id)??"0";
            if(from===s.head)continue;
            const page=await service.page(c,s.stream_id,from,s.head);
            for(const event of page.events){
              const size=Buffer.byteLength(JSON.stringify(event));
              if(p.buffered.length>=LIVE_LIMITS.bufferEvents || p.bytes+size>LIVE_LIMITS.bufferBytes)throw new AccessError("LIVE_RESYNC_REQUIRED");
              p.buffered.push(event);p.bytes+=size;
              // The retained unacknowledged byte/event budget also bounds transport backpressure.
              if(p.socket.connected)p.socket.emit("event",{...event,sync_id:p.sync,replay:p.phase!=="READY"});
            }
            p.cursor.set(s.stream_id,page.next);
          }
          if(p.actor.audience==="PARTICIPANT" && (presenceVersion!==p.presenceVersion || now-p.lastHead>=LIVE_LIMITS.headMs)){
            const view=await presenceView(c,p), digest=hash(JSON.stringify(view));
            if(digest!==p.presenceDigest){if(control(p,"presence",{sync_id:p.sync,editors:view}))p.presenceDigest=digest;else return;}
          }
          p.presenceVersion=presenceVersions.get(p.actor.team_round_id??"")??0;
          if(control(p,"heads",{sync_id:p.sync,heads:c.streams,server_time:c.now.toISOString(),expires_at:c.actor.expires_at}))p.lastHead=now;
        }).catch(error=>{app.log.warn({event:"live_connection_invalidated",code:error instanceof AccessError?error.code:(error as {code?:string}).code??"UNAVAILABLE"});p.intent=null;dirty(p);p.socket.emit("resync_required",publicFailure());p.socket.disconnect(true);});
      }
      const connections=[...peers.values()];
      for(let i=0;i<connections.length;i+=6)await Promise.all(connections.slice(i,i+6).map(deliver));
      if(now-maintenanceAt>=60000){await service.maintain();maintenanceAt=now;}
    } catch (error) {
      if(performance.now()-reportedAt>=60000){reportedAt=performance.now();app.log.warn({event:"live_delivery_unavailable",code:error instanceof AccessError?error.code:(error as {code?:string}).code??"UNAVAILABLE"});}
      for(const p of peers.values()){p.socket.emit("stale",publicFailure());p.socket.disconnect(true);}
    } finally {polling=false;}
  }
  app.addHook("onListen",async()=>{timer=setInterval(()=>{void tick();},LIVE_LIMITS.pollMs);timer.unref();});
  app.addHook("preClose",async()=>{closed=true;if(timer)clearInterval(timer);namespace.disconnectSockets(true);tickets.clear();peers.clear();
    // Engine.IO detaches its upgrade handlers; Fastify owns and closes the shared HTTP server.
    io.engine.close();
    while(polling)await new Promise(resolve=>setTimeout(resolve,10));
  });
  return {ticket,snapshot,replay,projection};
}
