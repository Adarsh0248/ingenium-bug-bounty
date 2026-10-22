import assert from "node:assert/strict";
import test from "node:test";
import {createDraftEditor,DraftBuffers} from "../src/workbench/draft-client.js";
import type {DraftView,SaveIntent,SaveReceipt} from "../src/workbench/draft-client.js";
const view=(source="starter",revision="0"):DraftView=>({round_id:"round",bounty_id:"bug",member_round_id:"member",language:"cpp",source,revision,writable:true,reason:null});
const receipt=(intent:SaveIntent,kind:SaveReceipt["outcome"]="SAVED"):SaveReceipt=>({round_id:"round",bounty_id:"bug",member_round_id:"member",request_key:intent.request_key,base_revision:intent.base_revision,outcome:kind,
  reason_code:kind==="CONFLICT"?"REVISION_MISMATCH":null,result_revision:["SAVED","UNCHANGED"].includes(kind)?String(BigInt(intent.base_revision)+(kind==="SAVED"?1n:0n)):null});
const settle=async()=>{for(let i=0;i<15;i++)await Promise.resolve();};
function fixture(){let now=0,key=0,server=view();const sent:SaveIntent[]=[],changes:any[]=[];const replies=new Map<string,SaveReceipt>();
  const hooks={now:()=>now,key:()=>String(++key),async load(){return{...server};},async save(intent:SaveIntent){sent.push({...intent});const result=receipt(intent);replies.set(intent.request_key,result);server=view(intent.source,result.result_revision!);return result;},
    async outcome(key:string){return{status:replies.has(key)?"OBSERVED" as const:"NOT_OBSERVED" as const,outcome:replies.get(key)??null};},change(state:any){changes.push(state);}};
  return{hooks,sent,changes,replies,time(n:number){now=n;},server(value:DraftView){server=value;}};
}

test("a virtual starter is not labelled Saved until the first explicit save is acknowledged",async()=>{
  const f=fixture(),editor=createDraftEditor(view(),f.hooks);
  try{assert.equal(editor.state,"UNSAVED");assert.equal(editor.revision,"0");assert.equal(f.sent.length,0);await editor.save();assert.equal(f.sent[0]!.source,"starter");assert.equal(editor.state,"SAVED");assert.equal(editor.revision,"1");}
  finally{editor.close();}
});
test("autosave waits two idle seconds and acknowledges only committed exact source",async t=>{
  t.mock.timers.enable({apis:["setTimeout"]});const f=fixture(),editor=createDraftEditor(view(),f.hooks);
  try{editor.edit("\ufefftext\r\n\u0000\u20ac");assert.equal(editor.state,"UNSAVED");f.time(1999);t.mock.timers.tick(1999);assert.equal(f.sent.length,0);
    f.time(2000);t.mock.timers.tick(1);await settle();assert.equal(f.sent[0]!.source,editor.source);assert.equal(editor.state,"SAVED");assert.equal(editor.revision,"1");
  }finally{editor.close();}
});
test("continuous typing schedules at ten seconds rather than postponing forever",async t=>{
  t.mock.timers.enable({apis:["setTimeout"]});const f=fixture(),editor=createDraftEditor(view(),f.hooks);
  try{editor.edit("0");for(let time=1000;time<10000;time+=1000){f.time(time);t.mock.timers.tick(1000);editor.edit(String(time));assert.equal(f.sent.length,0);}
    f.time(10000);t.mock.timers.tick(1000);await settle();assert.equal(f.sent.length,1);assert.equal(f.sent[0]!.source,"9000");
  }finally{editor.close();}
});
test("one unresolved save owns its original source while newer typing never becomes falsely saved",async t=>{
  t.mock.timers.enable({apis:["setTimeout"]});const f=fixture();let resolve!:(r:SaveReceipt)=>void;
  f.hooks.save=async intent=>{f.sent.push({...intent});return new Promise(r=>{resolve=r;});};const editor=createDraftEditor(view(),f.hooks);
  try{editor.edit("first");const pending=editor.save();editor.edit("second");f.time(10000);t.mock.timers.tick(10000);assert.equal(f.sent.length,1);assert.equal(editor.state,"SAVING");
    resolve(receipt(f.sent[0]!));await pending;assert.equal(editor.source,"second");assert.equal(editor.state,"UNSAVED");assert.equal(editor.revision,"1");
    t.mock.timers.tick(1);assert.equal(f.sent.length,2);assert.equal(f.sent[1]!.source,"second");assert.equal(f.sent[1]!.base_revision,"1");
  }finally{editor.close();}
});
test("response loss reconciles the original key through reads, with no automatic second POST",async t=>{
  t.mock.timers.enable({apis:["setTimeout"]});const f=fixture(),normal=f.hooks.save;f.hooks.save=async intent=>{await normal(intent);throw new Error("lost response");};const editor=createDraftEditor(view(),f.hooks);
  try{editor.edit("committed");await editor.save();assert.equal(editor.state,"UNRESOLVED");editor.edit("new local text");f.time(500);t.mock.timers.tick(500);await settle();
    assert.equal(f.sent.length,1);assert.equal(editor.source,"new local text");assert.equal(editor.revision,"1");assert.equal(editor.state,"UNSAVED");
  }finally{editor.close();}
});
test("missing outcomes stay unresolved after bounded read backoff; explicit retry keeps the old key and payload",async t=>{
  t.mock.timers.enable({apis:["setTimeout"]});const f=fixture();let fail=true,reads=0;
  f.hooks.save=async intent=>{f.sent.push({...intent});if(fail)throw new Error("unknown commit");return receipt(intent);};const lookup=f.hooks.outcome;f.hooks.outcome=async key=>{reads++;return lookup(key);};const editor=createDraftEditor(view(),f.hooks);
  try{editor.edit("original");await editor.save();editor.edit("newer");let time=0;
    for(const wait of [500,1000,2000,4000,8000]){time+=wait;f.time(time);t.mock.timers.tick(wait);await settle();}
    assert.equal(reads,5);assert.equal(f.sent.length,1);assert.equal(editor.state,"UNRESOLVED");const original={...f.sent[0]!};fail=false;await editor.retry();
    assert.deepEqual(f.sent[1],original);assert.equal(editor.source,"newer");assert.equal(editor.state,"UNSAVED");
  }finally{editor.close();}
});
test("a conflict stops automatic saves until the user reviews and explicitly chooses a copy",async t=>{
  t.mock.timers.enable({apis:["setTimeout"]});const f=fixture();f.hooks.save=async intent=>{f.sent.push({...intent});return receipt(intent,"CONFLICT");};f.server(view("other tab","3"));const editor=createDraftEditor(view(),f.hooks);
  try{editor.edit("my unsaved text");await editor.save();assert.equal(editor.state,"CONFLICT");f.time(20000);t.mock.timers.tick(20000);assert.equal(f.sent.length,1);assert.equal(editor.source,"my unsaved text");
    const saved=await editor.review();assert.equal(saved.source,"other tab");editor.resolve(saved,"LOCAL");assert.equal(editor.source,"my unsaved text");assert.equal(editor.revision,"3");assert.equal(editor.state,"UNSAVED");
    editor.resolve(saved,"SERVER");assert.equal(editor.source,"other tab");assert.equal(editor.state,"SAVED");
  }finally{editor.close();}
});
test("pause, claim and offline recovery preserve text and require current draft state before saving again",async t=>{
  t.mock.timers.enable({apis:["setTimeout"]});const f=fixture(),editor=createDraftEditor(view("saved","2"),f.hooks);f.server(view("saved","2"));
  try{editor.edit("local");f.server({...view("saved","2"),writable:false,reason:"PAUSED"});editor.availability(true,false,"PAUSED");await settle();assert.equal(editor.state,"READ_ONLY");assert.equal(editor.source,"local");assert.throws(()=>editor.edit("during pause"),/READ_ONLY/);
    f.time(10000);t.mock.timers.tick(10000);assert.equal(f.sent.length,0);editor.availability(false,true);editor.edit("offline edit");assert.equal(editor.state,"OFFLINE");assert.equal(f.sent.length,0);
    f.server(view("remote newer","3"));editor.availability(true,true);await settle();assert.equal(editor.state,"CONFLICT");assert.equal(editor.source,"offline edit");assert.equal(f.sent.length,0);
  }finally{editor.close();}
});
test("oversized local text remains unsaved and is never truncated or automatically submitted",async t=>{
  t.mock.timers.enable({apis:["setTimeout"]});const f=fixture(),editor=createDraftEditor(view(),f.hooks),text="\u20ac".repeat(43691);
  try{editor.edit(text);f.time(10000);t.mock.timers.tick(10000);await editor.save();assert.equal(editor.source,text);assert.equal(editor.state,"UNSAVED");assert.equal(f.sent.length,0);assert.equal(f.changes.at(-1).reason,"DRAFT_TOO_LARGE");}finally{editor.close();}
});
test("the tab refuses a ninth dirty buffer or more than 1 MiB without evicting or changing existing text",()=>{
  const buffers=new DraftBuffers();for(let i=0;i<8;i++)buffers.set(String(i),"x".repeat(131072),true);
  assert.throws(()=>buffers.set("9","extra",true),/CAPACITY/);assert.throws(()=>buffers.set("0","x".repeat(131073),true),/CAPACITY/);assert.equal(buffers.get("0")!.source.length,131072);
  assert.throws(()=>buffers.release("0"),/REVIEW/);buffers.release("0",true);buffers.set("9","reviewed replacement",true);assert.equal(buffers.get("9")!.source,"reviewed replacement");
});
test("a restored dirty buffer is not silently overwritten by a new server snapshot",()=>{
  const f=fixture(),buffers=new DraftBuffers(),id=JSON.stringify(["round","member","bug"]);buffers.set(id,"retained local",true);
  const editor=createDraftEditor(view("new server","5"),f.hooks,buffers);try{assert.equal(editor.source,"retained local");assert.equal(editor.state,"CONFLICT");}finally{editor.close();}
});

test("a known read-only view stays read-only offline and shrinking oversized text clears its warning",()=>{
  const f=fixture(),locked=createDraftEditor({...view(),writable:false,reason:"BOUNTY_UNAVAILABLE"},f.hooks);
  try{locked.availability(false,false,"BOUNTY_UNAVAILABLE");assert.throws(()=>locked.edit("offline bypass"),/READ_ONLY/);}finally{locked.close();}
  const editor=createDraftEditor(view(),f.hooks);
  try{editor.edit("x".repeat(131073));editor.edit("small again");assert.equal(f.changes.at(-1).reason,null);}finally{editor.close();}
});

test("overlapping explicit retries cannot dispatch twice while permission recovery is still pending",async t=>{
  t.mock.timers.enable({apis:["setTimeout"]});const f=fixture();let fail=true,loads=0,resolve!:(v:DraftView)=>void;
  f.hooks.save=async intent=>{f.sent.push({...intent});if(fail)throw new Error("lost response");return receipt(intent);};
  f.hooks.load=async()=>{loads++;return new Promise(r=>{resolve=r;});};const editor=createDraftEditor(view(),f.hooks);
  try{editor.edit("original");await editor.save();const first=editor.retry();await settle();const second=editor.retry();await settle();assert.equal(loads,1);
    fail=false;resolve(view());await Promise.all([first,second]);assert.equal(f.sent.length,2);assert.deepEqual(f.sent[0],f.sent[1]);assert.equal(editor.state,"SAVED");
  }finally{editor.close();}
});

test("a reply arriving after the editor closes cannot replace retained text or notify a departed view",async t=>{
  t.mock.timers.enable({apis:["setTimeout"]});const f=fixture(),buffers=new DraftBuffers();let resolve!:(r:SaveReceipt)=>void;
  f.hooks.save=async intent=>{f.sent.push({...intent});return new Promise(r=>{resolve=r;});};const editor=createDraftEditor(view(),f.hooks,buffers);
  editor.edit("submitted snapshot");const pending=editor.save();editor.edit("newest local copy");editor.close();const count=f.changes.length;
  resolve(receipt(f.sent[0]!));await pending;editor.availability(true,true);assert.equal(f.changes.length,count);assert.equal(editor.source,"newest local copy");
  assert.equal(buffers.get(JSON.stringify(["round","member","bug"]))!.source,"newest local copy");
});
