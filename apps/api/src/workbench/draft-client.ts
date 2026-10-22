export interface DraftView{
  round_id:string;bounty_id:string;member_round_id:string;language:string;revision:string;source:string;writable:boolean;reason:string|null;
}
export interface SaveIntent{request_key:string;base_revision:string;source:string;}
export interface SaveReceipt{
  round_id:string;bounty_id:string;member_round_id:string;request_key:string;base_revision:string;
  outcome:"SAVED"|"UNCHANGED"|"CONFLICT"|"REJECTED";reason_code:string|null;result_revision:string|null;
}
export type SaveState="UNSAVED"|"SAVING"|"SAVED"|"OFFLINE"|"CONFLICT"|"UNRESOLVED"|"READ_ONLY";
interface Hooks{
  now():number;key():string;load():Promise<DraftView>;save(intent:SaveIntent):Promise<SaveReceipt>;
  outcome(key:string):Promise<{status:"OBSERVED"|"NOT_OBSERVED";outcome:SaveReceipt|null}>;
  change(state:{source:string;revision:string;state:SaveState;dirty:boolean;reason:string|null}):void;
}
const size=(source:string)=>new TextEncoder().encode(source).length;
const revision=(value:unknown):value is string=>typeof value==="string"&&/^(0|[1-9]\d{0,18})$/.test(value)&&BigInt(value)<=9223372036854775806n;

// Shared by the tab's editors; refusing another dirty buffer never evicts existing text.
export class DraftBuffers{
  private readonly items=new Map<string,{source:string;dirty:boolean}>();
  set(key:string,source:string,dirty:boolean){
    if(!source.isWellFormed())throw new Error("INVALID_SOURCE");
    const others=[...this.items].filter(([id,item])=>id!==key&&item.dirty);
    if(dirty&&(others.length>=8||others.reduce((n,[,item])=>n+size(item.source),0)+size(source)>1048576))throw new Error("DIRTY_BUFFER_CAPACITY");
    this.items.set(key,{source,dirty});
  }
  get(key:string){return this.items.get(key);}
  release(key:string,reviewedDiscard=false){if(this.items.get(key)?.dirty&&!reviewedDiscard)throw new Error("UNSAVED_REVIEW_REQUIRED");this.items.delete(key);}
}

export function createDraftEditor(initial:DraftView,hooks:Hooks,buffers=new DraftBuffers()){
  let source=initial.source,savedSource=initial.source,base=initial.revision,writable=initial.writable,reason=initial.reason,online=true,closed=false;
  let state:SaveState=initial.writable?(base==="0"?"UNSAVED":"SAVED"):"READ_ONLY",pending:SaveIntent|null=null,uncertain=false,inFlight=false,reconciling=false,conflict=false;
  let dirtyAt:number|null=null,lastEdit=0,saveTimer:ReturnType<typeof setTimeout>|undefined,recoveryTimer:ReturnType<typeof setTimeout>|undefined,recoveryStep=0;
  let epoch=0,retrying=false;
  const id=JSON.stringify([initial.round_id,initial.member_round_id,initial.bounty_id]),backoff=[500,1000,2000,4000,8000];
  if(!revision(base)||!source.isWellFormed()||size(source)>131072)throw new Error("INVALID_DRAFT_VIEW");
  const previous=buffers.get(id);
  if(previous?.dirty){source=previous.source;conflict=true;state="CONFLICT";}
  buffers.set(id,source,source!==savedSource);
  const dirty=()=>source!==savedSource;
  function notify(){buffers.set(id,source,dirty());hooks.change({source,revision:base,state,dirty:dirty(),reason});}
  function clearSave(){if(saveTimer)clearTimeout(saveTimer);saveTimer=undefined;}
  function status(){state=!online?"OFFLINE":conflict?"CONFLICT":uncertain?"UNRESOLVED":inFlight?"SAVING":!writable?"READ_ONLY":dirty()||base==="0"?"UNSAVED":"SAVED";notify();}
  function schedule(){
    clearSave();if(closed||!online||!writable||pending||conflict||reconciling||!dirty())return;
    if(size(source)>131072){reason="DRAFT_TOO_LARGE";status();return;}
    const now=hooks.now();dirtyAt??=now;
    const wait=Math.max(0,Math.min(lastEdit+2000,dirtyAt+10000)-now);saveTimer=setTimeout(()=>{saveTimer=undefined;void flush();},wait);
  }
  function validateView(view:DraftView){
    if(view.round_id!==initial.round_id||view.bounty_id!==initial.bounty_id||view.member_round_id!==initial.member_round_id||view.language!==initial.language
      ||!revision(view.revision)||typeof view.source!=="string"||!view.source.isWellFormed()||size(view.source)>131072)throw new Error("DRAFT_SCOPE_MISMATCH");
  }
  function apply(receipt:SaveReceipt,intent:SaveIntent){
    if(receipt.round_id!==initial.round_id||receipt.bounty_id!==initial.bounty_id||receipt.member_round_id!==initial.member_round_id||receipt.request_key!==intent.request_key||receipt.base_revision!==intent.base_revision)throw new Error("DRAFT_RECEIPT_MISMATCH");
    if(receipt.outcome==="SAVED"||receipt.outcome==="UNCHANGED"){
      if(!revision(receipt.result_revision)||BigInt(receipt.result_revision)!==BigInt(intent.base_revision)+(receipt.outcome==="SAVED"?1n:0n))throw new Error("DRAFT_REVISION_MISMATCH");
      base=receipt.result_revision;savedSource=intent.source;reason=null;dirtyAt=dirty()?lastEdit:null;
    }else if(receipt.outcome==="CONFLICT"){conflict=true;reason="REVISION_MISMATCH";}
    else if(receipt.outcome==="REJECTED"){
      reason=receipt.reason_code;
      if(reason!=="DRAFT_TOO_LARGE")writable=false;
    }else throw new Error("INVALID_DRAFT_RECEIPT");
    pending=null;uncertain=false;recoveryStep=0;if(recoveryTimer)clearTimeout(recoveryTimer);recoveryTimer=undefined;status();schedule();
  }
  function recoverLater(){
    if(closed||!online||!pending||!uncertain||recoveryTimer||recoveryStep>=backoff.length)return;
    recoveryTimer=setTimeout(()=>{recoveryTimer=undefined;recoveryStep++;void reconcile();},backoff[recoveryStep]!);
  }
  async function reconcile(){
    if(closed||!online||!pending||!uncertain||inFlight||reconciling)return;
    reconciling=true;const intent=pending,version=epoch;
    try{const found=await hooks.outcome(intent.request_key);if(closed||version!==epoch||pending!==intent)return;
      if(found.status==="OBSERVED"&&found.outcome)apply(found.outcome,intent);
      else if(found.status!=="NOT_OBSERVED")throw new Error("INVALID_DRAFT_OUTCOME");
    }catch{uncertain=true;}
    finally{reconciling=false;if(!closed){status();recoverLater();schedule();}}
  }
  async function send(intent:SaveIntent){
    if(closed||inFlight)return;inFlight=true;uncertain=false;status();const version=epoch;
    try{const result=await hooks.save({...intent});if(!closed&&version===epoch&&pending===intent)apply(result,intent);}
    catch{if(!closed&&version===epoch){uncertain=true;reason="SAVE_OUTCOME_UNKNOWN";}}
    finally{inFlight=false;if(!closed){status();recoverLater();schedule();}}
  }
  async function flush(){
    if(closed||!online||!writable||pending||conflict||reconciling||size(source)>131072||!dirty()&&base!=="0")return;
    clearSave();pending={request_key:hooks.key(),base_revision:base,source};await send(pending);
  }
  async function refresh(){
    if(closed||!online||inFlight||reconciling)return;
    if(pending){await reconcile();if(pending)return;}
    reconciling=true;const version=epoch;
    try{const view=await hooks.load();if(closed||version!==epoch)return;validateView(view);writable=view.writable;reason=view.reason;
      if(dirty()&&view.revision!==base){conflict=true;reason="REVISION_MISMATCH";}
      else if(!dirty()){base=view.revision;savedSource=view.source;source=view.source;conflict=false;}
    }catch{writable=false;reason="DRAFT_REFRESH_REQUIRED";}
    finally{reconciling=false;if(!closed){status();schedule();}}
  }
  notify();
  return{
    get source(){return source;},get revision(){return base;},get state(){return state;},get unresolved(){return pending===null?null:{...pending};},
    edit(text:string){
      if(closed||!writable)throw new Error("DRAFT_READ_ONLY");if(typeof text!=="string"||!text.isWellFormed())throw new Error("INVALID_SOURCE");
      buffers.set(id,text,text!==savedSource);source=text;lastEdit=hooks.now();dirtyAt??=lastEdit;reason=size(text)>131072?"DRAFT_TOO_LARGE":reason==="DRAFT_TOO_LARGE"?null:reason;status();schedule();
    },
    save:flush,
    availability(connected:boolean,allowed:boolean,why:string|null=null){
      if(closed)return;
      online=connected;writable=allowed;reason=why;clearSave();status();
      // A new live snapshot is permission metadata, never permission to replay an old edit blindly.
      if(connected)void refresh();
    },
    refresh,
    async retry(){
      if(closed||!pending||!uncertain||!online||inFlight||reconciling||retrying)return;
      retrying=true;
      try{
        await reconcile();if(!pending||closed)return;
        const intent=pending,version=epoch,view=await hooks.load();
        if(closed||version!==epoch||pending!==intent)return;
        validateView(view);writable=view.writable;reason=view.reason;if(!writable){status();return;}
        recoveryStep=0;await send(intent);
      }finally{retrying=false;}
    },
    async review(){if(!online)throw new Error("DRAFT_OFFLINE");const view=await hooks.load();validateView(view);return view;},
    resolve(view:DraftView,choice:"LOCAL"|"SERVER"){
      if(pending||inFlight||reconciling)throw new Error("DRAFT_UNRESOLVED");validateView(view);
      if(choice!=="LOCAL"&&choice!=="SERVER")throw new Error("INVALID_REVIEW");
      const next=choice==="SERVER"?view.source:source;buffers.set(id,next,next!==view.source);
      epoch++;base=view.revision;savedSource=view.source;source=next;conflict=false;writable=view.writable;reason=view.reason;dirtyAt=lastEdit=hooks.now();status();schedule();
    },
    close(){closed=true;epoch++;clearSave();if(recoveryTimer)clearTimeout(recoveryTimer);},
  };
}
