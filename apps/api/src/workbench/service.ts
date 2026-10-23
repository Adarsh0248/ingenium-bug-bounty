import type {Pool,PoolClient} from "pg";
import {uuid} from "../access/credentials.js";
import {draftSaveQuota,memberCommandQuota,memberReadQuota} from "../access/quotas.js";
import {AccessError,first} from "../access/transaction.js";
import type {ClockGuard} from "../access/transaction.js";
import {createParticipantReads} from "./scope.js";

export interface DraftIntent{roundId:string;bountyId:string;requestKey:string;baseRevision:string;source:string;}
export interface DraftReceipt{outcome_id:string;round_id:string;member_round_id:string;bounty_id:string;request_key:string;base_revision:string;
  outcome:"SAVED"|"UNCHANGED"|"CONFLICT"|"REJECTED";reason_code:string|null;result_revision:string|null;recorded_at:string;}
interface Scope{client:PoolClient;now:Date;sessionId:string;memberId:string;memberRoundId:string;teamRoundId:string;roundId:string;language:string;historical:boolean;
  bounty:{snapshot_id:string;title:string;difficulty:number;base_bounty:number;submission_format:string;checker_mode:string;state:string;started_at:Date|null;closes_at:Date|null;current:boolean;claimed:boolean;paused:boolean};}
export function draftInput(input:DraftIntent){
  try{uuid(input.roundId);uuid(input.bountyId);uuid(input.requestKey);}catch{throw new AccessError("INVALID_CONTEXT");}
  if(typeof input.baseRevision!=="string"||!/^(0|[1-9]\d{0,18})$/.test(input.baseRevision)||BigInt(input.baseRevision)>9223372036854775805n
    ||typeof input.source!=="string"||!input.source.isWellFormed()||Buffer.byteLength(input.source)>1048576)throw new AccessError("INVALID_CONTEXT");
  return Buffer.from(input.source,"utf8");
}
function receipt(row:Record<string,any>):DraftReceipt{return{outcome_id:row.id,round_id:row.round_id,member_round_id:row.member_round_id,bounty_id:row.bounty_id,request_key:row.request_key,
  base_revision:String(row.base_revision),outcome:row.outcome,reason_code:row.reason_code,result_revision:row.result_revision===null?null:String(row.result_revision),recorded_at:new Date(row.recorded_at).toISOString()};}
export function createWorkbenchService(pool:Pool,clock:ClockGuard){
  const reads=createParticipantReads(pool,clock),principal=reads.principal;
  async function scoped<T>(cookie:unknown,round:string,bounty:string,write:boolean,work:(context:Scope)=>Promise<T>):Promise<T>{
    try{uuid(round);uuid(bounty);}catch{throw new AccessError("INVALID_CONTEXT");}
    return reads.scoped(cookie,round,write,async context=>{
      const {client,memberRoundId,teamRoundId}=context;
      const selected=await first<Scope["bounty"]>(client,`SELECT b.snapshot_id,s.title,s.difficulty,s.base_bounty,s.submission_format,s.checker_mode,r.state,r.started_at,r.closes_at,
        (a.status='IN_PROGRESS' AND c.current_instance_id=a.id) AS current,
        EXISTS(SELECT 1 FROM bounty_awards w WHERE w.bounty_id=b.id AND (r.kind=2 OR w.team_round_id=$3)) AS claimed,
        EXISTS(SELECT 1 FROM competition_pauses p WHERE p.round_id=r.id AND p.ended_at IS NULL AND (p.scope='GLOBAL' OR p.team_round_id=$3 OR p.member_round_id=$4)) AS paused
        FROM bounties b JOIN rounds r ON r.id=b.round_id JOIN validation_snapshots s ON s.id=b.snapshot_id JOIN arena_instances a ON a.id=r.arena_instance_id CROSS JOIN arena_control c
        WHERE b.id=$2 AND b.round_id=$1 AND c.id=1 AND r.started_at IS NOT NULL AND r.state NOT IN ('DRAFT','READY')`,[round,bounty,teamRoundId,memberRoundId]);
      if(!selected)throw new AccessError("WORKBENCH_UNAVAILABLE");
      return work({...context,bounty:selected});
    });
  }
  async function read<T>(cookie:unknown,round:string,bounty:string,work:(context:Scope)=>Promise<T>){const actor=await principal(cookie);await memberReadQuota(pool,clock,actor.member_id);return scoped(cookie,round,bounty,false,work);}
  function gate(c:Scope){
    const b=c.bounty;
    if(c.historical||!b.current||!b.closes_at||c.now>=b.closes_at||!["RUNNING","PAUSED"].includes(b.state))return{writable:false,reason:"ROUND_NOT_WRITABLE"};
    if(b.paused)return{writable:false,reason:"PAUSED"};if(b.claimed)return{writable:false,reason:"BOUNTY_UNAVAILABLE"};return{writable:true,reason:null};
  }
  async function variant(c:Scope){
    const row=await first<{starter_code:Buffer;cpu_ms:number;wall_ms:number;memory_kb:number}>(c.client,"SELECT starter_code,cpu_ms,wall_ms,memory_kb FROM validation_snapshot_variants WHERE snapshot_id=$1 AND language=$2",[c.bounty.snapshot_id,c.language]);
    if(!row)throw new AccessError("WORKBENCH_UNAVAILABLE");return row;
  }
  return{
    async metadata(cookie:unknown,round:string,bounty:string){return read(cookie,round,bounty,async c=>{
      const v=await variant(c),samples=(await c.client.query("SELECT row_number() OVER(ORDER BY position)::integer AS sample_number,octet_length(input_data) AS input_bytes,octet_length(expected_output) AS output_bytes FROM validation_snapshot_cases WHERE snapshot_id=$1 AND visibility='SAMPLE' ORDER BY position",[c.bounty.snapshot_id])).rows;
      const work=await first(c.client,`SELECT EXISTS(SELECT 1 FROM participant_judging WHERE bounty_id=$1 AND team_round_id=$2 AND lane='OFFICIAL' AND completed_at IS NULL AND status<>'CANCELLED') AS official_pending,
        (SELECT count(*)::integer FROM participant_judging WHERE member_round_id=$3 AND lane='SAMPLE' AND completed_at IS NULL AND status<>'CANCELLED' AND created_at>$4::timestamptz-interval '120 seconds') AS unfinished_runs,
        COALESCE((SELECT max(level) FROM hint_purchases WHERE bounty_id=$1 AND team_round_id=$2),0) AS hint_tier`,[bounty,c.teamRoundId,c.memberRoundId,c.now]);
      return{round_id:round,bounty_id:bounty,member_round_id:c.memberRoundId,title:c.bounty.title,difficulty:c.bounty.difficulty,base_bounty:c.bounty.base_bounty,
        submission_format:c.bounty.submission_format,checker_mode:c.bounty.checker_mode,language:c.language,cpu_ms:v.cpu_ms,wall_ms:v.wall_ms,memory_kb:v.memory_kb,
        samples,claimed:c.bounty.claimed,historical:c.historical,...gate(c),official_pending:work!.official_pending,unfinished_runs:work!.unfinished_runs,hint_tier:work!.hint_tier,server_time:c.now.toISOString()};
    });},
    async statement(cookie:unknown,round:string,bounty:string){return read(cookie,round,bounty,async c=>{const row=await first<{statement:string}>(c.client,"SELECT statement FROM validation_snapshots WHERE id=$1",[c.bounty.snapshot_id]);return{bounty_id:bounty,statement:row!.statement};});},
    async starter(cookie:unknown,round:string,bounty:string){return read(cookie,round,bounty,async c=>({bounty_id:bounty,language:c.language,source:(await variant(c)).starter_code.toString("utf8")}));},
    async sample(cookie:unknown,round:string,bounty:string,number:number,field:"input"|"expected_output"){
      if(!Number.isSafeInteger(number)||number<1||number>3||!["input","expected_output"].includes(field))throw new AccessError("INVALID_CONTEXT");
      return read(cookie,round,bounty,async c=>{const row=await first<{content:Buffer}>(c.client,`SELECT CASE WHEN $3='input' THEN input_data ELSE expected_output END AS content FROM validation_snapshot_cases WHERE snapshot_id=$1 AND visibility='SAMPLE' ORDER BY position LIMIT 1 OFFSET $2`,[c.bounty.snapshot_id,number-1,field]);
        if(!row)throw new AccessError("WORKBENCH_UNAVAILABLE");return{bounty_id:bounty,sample_number:number,field,content:row.content.toString("utf8"),byte_length:row.content.length};});
    },
    async draft(cookie:unknown,round:string,bounty:string){return read(cookie,round,bounty,async c=>{
      const row=await first<{id:string;source_code:Buffer|null;revision:string;created_at:Date;updated_at:Date}>(c.client,"SELECT id,source_code,revision,created_at,updated_at FROM code_drafts WHERE member_round_id=$1 AND bounty_id=$2",[c.memberRoundId,bounty]);
      if(row?.source_code===null)throw new AccessError("PAYLOAD_EXPIRED");
      return{draft_id:row?.id??null,round_id:round,bounty_id:bounty,member_round_id:c.memberRoundId,language:c.language,revision:row?.revision??"0",
        source:row?row.source_code.toString("utf8"):(await variant(c)).starter_code.toString("utf8"),source_kind:row?"DRAFT":"STARTER",created_at:row?.created_at.toISOString()??null,updated_at:row?.updated_at.toISOString()??null,...gate(c)};
    });},
    async save(cookie:unknown,input:DraftIntent){
      const code=draftInput(input),actor=await principal(cookie);await draftSaveQuota(pool,clock,actor.member_round_id);
      return scoped(cookie,input.roundId,input.bountyId,true,async c=>{
        if(c.historical)throw new AccessError("WORKBENCH_UNAVAILABLE");
        const row=await first(c.client,"SELECT * FROM workbench_save($1,$2,$3,$4,$5,$6)",[c.sessionId,input.roundId,input.bountyId,input.requestKey,input.baseRevision,code]);return receipt(row!);
      });
    },
    async outcome(cookie:unknown,round:string,bounty:string,key:string){try{uuid(key);}catch{throw new AccessError("INVALID_CONTEXT");}
      return read(cookie,round,bounty,async c=>{const row=await first(c.client,"SELECT * FROM draft_save_outcomes WHERE member_round_id=$1 AND bounty_id=$2 AND request_key=$3",[c.memberRoundId,bounty,key]);return{status:row?"OBSERVED":"NOT_OBSERVED",outcome:row?receipt(row):null};});
    },
    async officialSource(cookie:unknown,round:string,bounty:string,submission:string){try{uuid(submission);}catch{throw new AccessError("INVALID_CONTEXT");}
      return read(cookie,round,bounty,async c=>{const row=await first<{id:string;member_round_id:string;language:string;source:Buffer|null;received_at:Date}>(c.client,"SELECT id,member_round_id,language,source,received_at FROM competition_submissions WHERE id=$1 AND round_id=$2 AND bounty_id=$3 AND team_round_id=$4",[submission,round,bounty,c.teamRoundId]);
        if(!row)throw new AccessError("WORKBENCH_UNAVAILABLE");if(row.source===null)throw new AccessError("PAYLOAD_EXPIRED");return{submission_id:row.id,member_round_id:row.member_round_id,language:row.language,source:row.source.toString("utf8"),received_at:row.received_at.toISOString(),read_only:true};});
    },
    async submissions(cookie:unknown,round:string,bounty:string,after?:string){
      if(after!==undefined&&(!/^(0|[1-9]\d{0,18})$/.test(after)||BigInt(after)>9223372036854775807n))throw new AccessError("INVALID_CONTEXT");
      return read(cookie,round,bounty,async c=>{const rows=(await c.client.query(`SELECT s.id AS submission_id,s.member_round_id,s.language,s.receipt_order::text,s.received_at,p.status,p.result
        FROM competition_submissions s JOIN participant_judging p ON p.submission_id=s.id WHERE s.round_id=$1 AND s.bounty_id=$2 AND s.team_round_id=$3 AND s.receipt_order>$4 ORDER BY s.receipt_order LIMIT 50`,[round,bounty,c.teamRoundId,after??"0"])).rows;
        return{submissions:rows,next_after:rows.length===50?rows.at(-1)!.receipt_order:null};});
    },
    async open(cookie:unknown,round:string,bounty:string,key:string){try{uuid(key);}catch{throw new AccessError("INVALID_CONTEXT");}
      const actor=await principal(cookie);await memberCommandQuota(pool,clock,actor.member_round_id);
      return scoped(cookie,round,bounty,true,async c=>{if(c.historical)throw new AccessError("WORKBENCH_UNAVAILABLE");
        const row=await first(c.client,"SELECT id,request_key,recorded_at FROM workbench_open($1,$2,$3,$4)",[c.sessionId,round,bounty,key]);return{opening_id:row!.id,request_key:row!.request_key,recorded_at:new Date(row!.recorded_at).toISOString()};});
    },
  };
}
