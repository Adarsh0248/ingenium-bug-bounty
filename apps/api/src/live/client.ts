import { decimal, LIVE_LIMITS } from "./protocol.js";
import type { LiveEvent, StreamHead } from "./protocol.js";
const bytes=(event:LiveEvent)=>new TextEncoder().encode(JSON.stringify(event)).byteLength;
const validHead=(s:StreamHead)=>s&&typeof s.stream_id==="string"&&s.schema_version===1&&decimal(s.head)&&decimal(s.retained_from)&&BigInt(s.retained_from)>=1n&&BigInt(s.retained_from)<=BigInt(s.head)+1n;
const backpressured=(error:unknown)=>{const failure=error as {status?:number;code?:string}|null;return failure?.status===503&&failure.code==="CAPACITY_UNAVAILABLE"||failure?.status===429&&failure.code==="RATE_LIMITED";};

// Browser-independent state: an editor's dirty source never belongs in a server snapshot.
export class LiveReplica {
  phase:"SYNCING"|"READY"|"STALE"="STALE";
  syncId="";
  readonly cursors=new Map<string,string>();
  private pending=new Map<string,LiveEvent>();
  private awards=new Set<string>();
  private bytes=0;
  private lastHead=-Infinity;
  constructor(private readonly now:()=>number,private readonly invalidate:(projection:string)=>void,private readonly award:(id:string,bountyId?:string)=>void){}
  begin(sync:string){this.syncId=sync;this.phase="SYNCING";this.cursors.clear();this.pending.clear();this.bytes=0;this.lastHead=-Infinity;}
  snapshot(sync:string,streams:StreamHead[]){
    if(sync!==this.syncId || !Array.isArray(streams) || streams.length<2 || streams.some(s=>!validHead(s)) || new Set(streams.map(s=>s.stream_id)).size!==streams.length)return this.stale();
    this.cursors.clear();for(const s of streams)this.cursors.set(s.stream_id,s.head);
    if([...this.pending.values()].some(e=>!this.cursors.has(e.stream_id)))return this.stale();
    for(const [key,e]of this.pending)if(!this.cursors.has(e.stream_id)||BigInt(e.sequence)<=BigInt(this.cursors.get(e.stream_id)!)){this.pending.delete(key);this.bytes-=bytes(e);}
    return true;
  }
  event(sync:string,event:LiveEvent,replay:boolean){
    if(sync!==this.syncId)return false;
    if(!event || event.schema_version!==1 || !decimal(event.sequence) || !decimal(event.resource_revision) || typeof event.event_id!=="string" || typeof event.patch!=="object" || event.patch===null || bytes(event)>16384)return this.stale();
    const cursor=this.cursors.get(event.stream_id);
    if(this.cursors.size>0 && cursor===undefined)return this.stale();
    if(cursor!==undefined && BigInt(event.sequence)<=BigInt(cursor))return true;
    const key=`${event.stream_id}:${event.sequence}`,old=this.pending.get(key);
    if(old && JSON.stringify(old)!==JSON.stringify(event))return this.stale();
    if(!old){this.pending.set(key,event);this.bytes+=bytes(event);}
    if(this.pending.size>LIVE_LIMITS.bufferEvents || this.bytes>LIVE_LIMITS.bufferBytes)return this.stale();
    if(this.phase!=="SYNCING")this.drain(replay);
    return this.phase!=="STALE";
  }
  private drain(replay:boolean){
    for(const [stream,cursor]of this.cursors){
      let next=BigInt(cursor)+1n,e:LiveEvent|undefined;
      while((e=this.pending.get(`${stream}:${next}`))){
        this.pending.delete(`${stream}:${next}`);this.bytes-=bytes(e);this.cursors.set(stream,e.sequence);next++;
        const projection=e.patch.projection;if(typeof projection==="string")this.invalidate(projection);
        if(e.patch.type==="AWARD" && typeof e.patch.award_id==="string")this.observeAward(e.patch.award_id,!replay&&this.phase==="READY",typeof e.patch.bounty_id==="string"?e.patch.bounty_id:undefined);
      }
    }
  }
  observeAward(id:string,animate:boolean,bountyId?:string){if(this.awards.has(id))return;this.awards.add(id);if(animate)this.award(id,bountyId);}
  head(sync:string,streams:StreamHead[]){
    if(sync!==this.syncId)return false;
    if(!Array.isArray(streams) || streams.length!==this.cursors.size || streams.some(s=>!validHead(s) || !this.cursors.has(s.stream_id) || BigInt(this.cursors.get(s.stream_id)!)<BigInt(s.retained_from)-1n) || new Set(streams.map(s=>s.stream_id)).size!==streams.length)return this.stale();
    this.lastHead=this.now();return true;
  }
  ready(sync:string,barrier:StreamHead[]){
    if(sync!==this.syncId || !this.head(sync,barrier))return false;
    this.drain(true);
    if(barrier.some(s=>BigInt(this.cursors.get(s.stream_id)!)<BigInt(s.head)))return false;
    this.phase="READY";return true;
  }
  gaps(streams:StreamHead[]){return streams.filter(s=>this.cursors.has(s.stream_id) && BigInt(this.cursors.get(s.stream_id)!)<BigInt(s.head));}
  writable(){if(this.phase==="READY"&&this.now()-this.lastHead>=LIVE_LIMITS.staleMs)this.stale();return this.phase==="READY";}
  stale(){this.phase="STALE";return false;}
  acknowledgements(){return Object.fromEntries(this.cursors);}
}

export interface LiveTransport {
  connected:boolean;
  on(event:string,listener:(value:any)=>void):unknown;
  connect():unknown; disconnect():unknown;
  volatile:{emit(event:string,value:unknown):unknown};
}
interface Snapshot {sync_id:string;streams:StreamHead[];[key:string]:unknown;}
interface Replay {sync_id:string;events:LiveEvent[];next:string;through:string;heads:StreamHead[];}
interface ClientHooks {
  post(path:string,body:unknown):Promise<any>;
  // Own an unconnected forceNew:true/reconnection:false client; the ticket belongs in auth, never in a URL.
  transport(ticket:string):LiveTransport;
  install(snapshot:Snapshot):void;
  invalidate(projection:string):void;
  award(id:string,bountyId?:string):void;
  presence(editors:unknown[]):void;
  state(phase:LiveReplica["phase"]):void;
  now():number;
}
export function connectLive(audience:"PARTICIPANT"|"STAFF",roundId:string|null,hooks:ClientHooks){
  const replica=new LiveReplica(hooks.now,projection=>{hooks.invalidate(projection);dirty=true;queueRefresh();},hooks.award),prefix=audience==="STAFF"?"/api/v1/staff/live":"/api/v1/live";
  let socket:LiveTransport|null=null,stopped=false,working=false,connecting=false,generation=0,retry:ReturnType<typeof setTimeout>|undefined,handshake:ReturnType<typeof setTimeout>|undefined,editor:string|null=null,renewed=0,attempt=0;
  let dirty=false,refreshing=false,refreshFailures=0,projectionVersion=0,refreshTimer:ReturnType<typeof setTimeout>|undefined;
  const notify=()=>hooks.state(replica.phase);
  const send=(event:string,value:unknown)=>{if(socket?.connected)socket.volatile.emit(event,value);};
  function queueRefresh(){if(stopped||working||refreshing||refreshTimer||!dirty||replica.phase!=="READY")return;
    refreshTimer=setTimeout(()=>{refreshTimer=undefined;void refresh();},refreshFailures ? 1000+Math.random()*1000 : 100);}
  async function refresh(){
    if(stopped||!socket?.connected||!replica.writable())return;refreshing=true;dirty=false;const sync=replica.syncId,version=projectionVersion;
    try{const state:Snapshot=await hooks.post(`${prefix}/projection`,{sync_id:sync});if(!stopped&&sync===replica.syncId&&state.sync_id===sync&&version===projectionVersion){refreshFailures=0;hooks.install(state);}}
    catch(error){if(sync===replica.syncId&&version===projectionVersion){
      // These are read-only projections: bounded backoff avoids turning one full HTTP queue into a reconnect storm.
      if(!stopped && refreshFailures<2 && backpressured(error)){refreshFailures++;dirty=true;}
      else reconnect(backpressured(error));
    }}
    finally{refreshing=false;queueRefresh();}
  }
  async function connect(){
    if(stopped||connecting)return;
    // A slow ticket must not race the stale timer or install over a newer connection.
    connecting=true;const current=++generation;
    handshake=setTimeout(()=>{if(current===generation&&!stopped)reconnect();},LIVE_LIMITS.syncMs);
    try{
      const ticket=await hooks.post(`${prefix}/tickets`,audience==="STAFF"?{round_id:roundId}:{});
      if(stopped||current!==generation)return;socket=hooks.transport(ticket.ticket);const active=socket;
      active.on("sync",value=>{if(socket!==active||stopped)return;connecting=false;if(handshake)clearTimeout(handshake);handshake=undefined;
        void synchronise(value.sync_id).catch(error=>{if(socket===active&&!stopped)reconnect(backpressured(error));});});
      active.on("event",value=>{if(socket!==active||stopped)return;const {sync_id,replay,...event}=value;
        if(!replica.event(sync_id,event,replay===true))return reconnect();notify();});
      active.on("heads",value=>{if(socket!==active||stopped||working)return;
        if(!replica.head(value.sync_id,value.heads))return reconnect();
        if(replica.gaps(value.heads).length){replica.stale();notify();void synchroniseFresh();}
        else {if(value.ack_required!==false)send("ack",{sync_id:replica.syncId,heads:replica.acknowledgements()});notify();}});
      active.on("presence",value=>{if(socket===active&&value.sync_id===replica.syncId)hooks.presence(value.editors);});
      active.on("projection",(value:Snapshot)=>{
        if(socket!==active||stopped||value?.sync_id!==replica.syncId||!replica.writable())return;
        if(!Array.isArray(value.streams)||value.streams.length!==replica.cursors.size||new Set(value.streams.map(s=>s?.stream_id)).size!==replica.cursors.size
          ||value.streams.some(s=>!validHead(s)||replica.cursors.get(s.stream_id)!==s.head))return;
        projectionVersion++;dirty=false;refreshFailures=0;if(refreshTimer)clearTimeout(refreshTimer);refreshTimer=undefined;hooks.install(value);
      });
      active.on("ready",value=>{if(socket!==active||stopped||value.sync_id!==replica.syncId)return;
        // Validate the final authorised heads and refresh liveness, not just the earlier HTTP barrier.
        if(!replica.ready(value.sync_id,value.heads)){
          if(replica.phase==="STALE")reconnect();else void synchroniseFresh();return;
        }
        attempt=0;notify();queueRefresh();if(editor){send("presence",{action:"ENTER",bounty_id:editor});renewed=hooks.now();}});
      active.on("connect_error",error=>{if(socket===active&&!stopped)reconnect(error?.data?.code==="CAPACITY_UNAVAILABLE");});
      for(const event of ["disconnect","resync_required","stale"])active.on(event,()=>{if(socket===active&&!stopped)reconnect();});
      active.connect();
    }catch(error){if(current===generation&&!stopped)reconnect(backpressured(error));}
  }
  async function synchronise(sync:string){
    if(working)return;working=true;replica.begin(sync);notify();
    try{
      const snapshot:Snapshot=await hooks.post(`${prefix}/snapshot`,{sync_id:sync});
      if(stopped||replica.syncId!==sync)return;
      if(!replica.snapshot(sync,snapshot.streams))throw new Error("Snapshot mismatch");hooks.install(snapshot);
      let barrier:StreamHead[]=snapshot.streams,established=false;
      for(const stream of snapshot.streams){
        let after=replica.cursors.get(stream.stream_id)!;
        // The first replay establishes the server's barrier for every stream; unchanged streams need no extra read.
        if(established&&barrier.some(s=>s.stream_id===stream.stream_id&&s.head===after))continue;
        do{
          const page:Replay=await hooks.post(`${prefix}/replay`,{sync_id:sync,stream_id:stream.stream_id,after});
          if(stopped||replica.syncId!==sync)return;
          if(page.sync_id!==sync || !decimal(page.next) || BigInt(page.next)<BigInt(after))throw new Error("Replay mismatch");
          for(const event of page.events)if(!replica.event(sync,event,true))throw new Error("Replay gap");
          if(page.next===after && BigInt(after)<BigInt(page.through))throw new Error("Replay did not advance");
          after=page.next;barrier=page.heads;established=true;
          if(BigInt(after)>=BigInt(page.through))break;
        }while(true);
      }
      if(!replica.ready(sync,barrier))throw new Error("Replay incomplete");
      replica.phase="SYNCING";send("ready",{sync_id:sync,heads:replica.acknowledgements()});notify();
    }finally{if(replica.syncId===sync)working=false;}
  }
  async function synchroniseFresh(){if(socket?.connected){
    replica.phase="SYNCING";connecting=true;notify();const current=generation;
    if(handshake)clearTimeout(handshake);
    handshake=setTimeout(()=>{if(current===generation&&!stopped)reconnect();},LIVE_LIMITS.syncMs);
    send("resync",{});
  }else reconnect();}
  function reconnect(busy=false){
    generation++;connecting=false;if(handshake)clearTimeout(handshake);handshake=undefined;
    replica.stale();replica.syncId="";working=false;refreshFailures=0;notify();hooks.presence([]);const previous=socket;socket=null;previous?.disconnect();
    if(stopped||retry)return;
    if(busy)attempt=Math.max(attempt,5);
    // Keep jitter across the whole capped window instead of synchronising repeated failures at one fixed delay.
    retry=setTimeout(()=>{retry=undefined;void connect();},Math.max(busy?1000:0,250+Math.random()*Math.min(30000,1000*2**Math.min(attempt++,5))));
  }
  const timer=setInterval(()=>{
    if(!replica.writable()){notify();if(replica.phase==="STALE"&&!working&&!connecting&&!retry)reconnect();return;}
    if(editor&&hooks.now()-renewed>=LIVE_LIMITS.presenceRenewMs){send("presence",{action:"RENEW",bounty_id:editor});renewed=hooks.now();}
  },1000);
  void connect();
  return {replica,edit(bounty:string|null){editor=bounty;if(!replica.writable())return;send("presence",bounty?{action:"ENTER",bounty_id:bounty}:{action:"LEAVE"});renewed=hooks.now();},
    close(){stopped=true;generation++;clearInterval(timer);if(retry)clearTimeout(retry);if(handshake)clearTimeout(handshake);if(refreshTimer)clearTimeout(refreshTimer);const previous=socket;socket=null;previous?.disconnect();replica.stale();notify();}};
}
