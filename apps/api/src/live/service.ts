import type { Pool, PoolClient } from "pg";
import { parseProof, uuid } from "../access/credentials.js";
import type { SessionDelivery } from "../access/credentials.js";
import { lockedRounds, participantDeadlines, sessionRow, sessionValid } from "../access/entry-service.js";
import { createStaffService } from "../access/staff-service.js";
import { AccessError, accessTransaction, decisionTime, first } from "../access/transaction.js";
import type { ClockGuard } from "../access/transaction.js";
import type { LiveEvent, StreamHead } from "./protocol.js";

export interface LiveAuth { audience: "PARTICIPANT" | "STAFF"; cookie: string; roundId: string | null; }
export interface LiveActor {
  session_id: string; audience: LiveAuth["audience"]; round_id: string | null; team_round_id: string | null; member_round_id: string | null;
  member_id: string | null; staff_id: string | null; role: string | null; name: string; team_name: string | null; language: string | null; expires_at: string;
}
export interface LiveContext { actor: LiveActor; streams: StreamHead[]; now: Date; client: PoolClient; }
export function scopeKey(actor: LiveActor, streams: StreamHead[]) {
  return JSON.stringify([actor.session_id,actor.audience,actor.round_id,actor.team_round_id,actor.member_round_id,actor.role,streams.map(s=>s.stream_id)]);
}
export function createLiveService(pool: Pool, clock: ClockGuard, delivery: SessionDelivery) {
  const staff = createStaffService(pool,clock,delivery);
  async function guarded<T>(auth: LiveAuth, read: (context: LiveContext) => Promise<T>): Promise<T> {
    return accessTransaction(pool,clock,async client=>{
      await client.query("SELECT * FROM lock_arena_control(false)");
      const proof=parseProof(auth.cookie); if(!proof) throw new AccessError("INVALID_SESSION");
      const participant=auth.audience==="PARTICIPANT" ? await sessionRow(client,proof.id) : null;
      const round=auth.audience==="PARTICIPANT" ? participant?.round_id ?? null : auth.roundId;
      if (auth.audience==="PARTICIPANT" && (!participant || auth.roundId!==null && auth.roundId!==round)) throw new AccessError("INVALID_SESSION");
      if(round) { uuid(round); await lockedRounds(client,[round],true); }
      const now=await decisionTime(client,clock,round?[round]:[]);
      let actor: LiveActor;
      if(participant) {
        if(!await sessionValid(client,participant,proof.verifier,now,clock)) throw new AccessError("INVALID_SESSION");
        const member=await first<{team_round_id:string}>(client,"SELECT team_round_id FROM member_rounds WHERE id=$1",[participant.member_round_id]);
        if(!member) throw new AccessError("INVALID_SESSION");
        actor={audience:"PARTICIPANT",session_id:participant.id,round_id:round,team_round_id:member.team_round_id,member_round_id:participant.member_round_id,
          member_id:participant.member_id,staff_id:null,role:null,name:participant.member_name,team_name:participant.team_name,language:participant.language,expires_at:participantDeadlines(participant).expiresAt};
      } else {
        if(auth.audience!=="STAFF") throw new AccessError("INVALID_SESSION");
        const s=await staff.authorize(client,auth.cookie,now);
        actor={audience:"STAFF",session_id:s.id,round_id:round,team_round_id:null,member_round_id:null,member_id:null,staff_id:s.staff_id,role:s.role,
          name:s.display_name,team_name:null,language:null,expires_at:new Date(Math.min(s.absolute_expires_at.getTime(),s.last_activity_at.getTime()+900000)).toISOString()};
      }
      // Source triggers take this anchor last. State and committed heads cannot split across commits.
      await client.query("SELECT lock_live_control()");
      const streams=(await client.query<StreamHead>(`SELECT id AS stream_id,kind,schema_version,head::text,retained_from::text FROM live_streams WHERE
        ($1='PARTICIPANT' AND ((kind='ROUND' AND round_id=$2) OR (kind='TEAM' AND team_round_id=$3) OR (kind='MEMBER' AND member_round_id=$4)))
        OR ($1='STAFF' AND (kind='STAFF_OPS' OR (kind='ROUND' AND round_id=$2) OR (kind='STAFF_SELF' AND staff_id=$5) OR (kind='STAFF_SECURITY' AND $6='SUPER_ADMIN'))) ORDER BY id`,
      [auth.audience,round,actor.team_round_id,actor.member_round_id,actor.staff_id,actor.role])).rows;
      if(streams.length<(auth.audience==="PARTICIPANT"?3:2)) throw new AccessError("SECURITY_UNAVAILABLE");
      return read({actor,streams,now,client});
    },"SHARED");
  }
  async function snapshot(context: LiveContext) {
    const {actor,streams,now,client}=context, roundId=actor.round_id, team=actor.team_round_id;
    const round=roundId ? await first(client,`SELECT r.id AS round_id,r.arena_instance_id,r.kind,r.state,r.duration_ms,r.started_at,r.closes_at,r.revision,
      f.draw_commitment,f.draw_reveal,a.status AS arena_status,c.current_instance_id=r.arena_instance_id AS current FROM rounds r JOIN arena_instances a ON a.id=r.arena_instance_id
      LEFT JOIN competition_configs f ON f.round_id=r.id CROSS JOIN arena_control c WHERE r.id=$1 AND c.id=1`,[roundId]) : null;
    const arena=await first(client,"SELECT c.current_instance_id,a.status,a.revision FROM arena_control c LEFT JOIN arena_instances a ON a.id=c.current_instance_id WHERE c.id=1");
    const bounties=roundId ? (await client.query(`SELECT b.id AS bounty_id,s.title,s.difficulty,s.base_bounty,
      EXISTS(SELECT 1 FROM bounty_awards a WHERE a.bounty_id=b.id AND (r.kind=2 OR a.team_round_id=$2)) AS claimed,
      COALESCE((SELECT max(level) FROM hint_purchases WHERE bounty_id=b.id AND team_round_id=$2),0) AS hint_tier
      FROM bounties b JOIN rounds r ON r.id=b.round_id JOIN validation_snapshots s ON s.id=b.snapshot_id WHERE b.round_id=$1 ORDER BY b.position`,[roundId,team])).rows : [];
    const pauses=roundId ? (await client.query(`SELECT scope,team_round_id,member_round_id,started_at FROM competition_pauses WHERE round_id=$1 AND ended_at IS NULL
      AND ($2::uuid IS NULL OR scope='GLOBAL' OR team_round_id=$2 OR member_round_id IN(SELECT id FROM member_rounds WHERE team_round_id=$2))`,[roundId,team])).rows : [];
    const rows=roundId ? (await first<{standings:Record<string,unknown>[],final:boolean}>(client,`SELECT COALESCE((SELECT standings FROM round_results WHERE round_id=$1),competition_standings($1)) standings,
      EXISTS(SELECT 1 FROM round_results WHERE round_id=$1) final`,[roundId])) : null;
    const cancelled=round?.state==='CANCELLING'||round?.state==='CANCELLED';
    const standings:Record<string,unknown>[]=rows?.standings.map(({wallet:_wallet,...row})=>({...row,...(cancelled?{rank:null}:{})})) ?? [];
    const wallet=team ? (await first(client,"SELECT competition_balance($1) balance",[team]))?.balance : null;
    const judging=roundId ? (await client.query(`SELECT id AS parent_id,bounty_id,lane,member_round_id,language,status,result,created_at,completed_at FROM participant_judging
      WHERE round_id=$1 AND (($2::uuid IS NOT NULL AND ((lane='OFFICIAL' AND team_round_id=$2) OR (lane='SAMPLE' AND member_round_id=$3))) OR $4='STAFF') ORDER BY queue_order DESC LIMIT 100`,
    [roundId,team,actor.member_round_id,actor.audience])).rows : [];
    const security=actor.role==="SUPER_ADMIN" ? (await client.query("SELECT id,display_name,role,disabled_at,revision FROM staff_identities ORDER BY id LIMIT 100")).rows : null;
    const drafts=actor.member_round_id?(await client.query("SELECT bounty_id,revision::text,updated_at FROM code_drafts WHERE member_round_id=$1 ORDER BY bounty_id",[actor.member_round_id])).rows:[];
    const result={schema_version:1,server_time:now.toISOString(),actor,streams,arena,round,bounties,pauses,standings,final:rows?.final??false,
      hud:team ? {wallet:Number(wallet),standing:standings.find(s=>s.team_round_id===team)??null} : null,judging,security,drafts};
    if(Buffer.byteLength(JSON.stringify(result))>1048576) throw new AccessError("REQUEST_CAPACITY_UNAVAILABLE");
    return result;
  }
  async function page(context: LiveContext, streamId: string, after: string, through: string) {
    const stream=context.streams.find(s=>s.stream_id===streamId);
    if(!stream || !/^\d{1,19}$/.test(after) || !/^\d{1,19}$/.test(through) || BigInt(after)<BigInt(stream.retained_from)-1n || BigInt(through)>BigInt(stream.head) || BigInt(after)>BigInt(through)) throw new AccessError("LIVE_RESYNC_REQUIRED");
    const rows=(await context.client.query<LiveEvent>(`SELECT d.stream_id,d.sequence::text,e.id AS event_id,e.revision::text AS resource_revision,1 AS schema_version,d.patch
      FROM live_deliveries d JOIN live_effects e ON e.id=d.effect_id WHERE d.stream_id=$1 AND d.sequence>$2 AND d.sequence<=$3 ORDER BY d.sequence LIMIT 100`,[streamId,after,through])).rows;
    let bytes=0, expected=BigInt(after)+1n; const events:LiveEvent[]=[];
    for(const event of rows) {
      if(BigInt(event.sequence)!==expected) throw new AccessError("LIVE_RESYNC_REQUIRED");
      const size=Buffer.byteLength(JSON.stringify(event)); if(size>16384) throw new AccessError("LIVE_RESYNC_REQUIRED");
      if(bytes+size>262144) break;
      events.push(event); bytes+=size; expected++;
    }
    if(!events.length && BigInt(after)<BigInt(through)) throw new AccessError("LIVE_RESYNC_REQUIRED");
    return {events,through,next:events.at(-1)?.sequence??after};
  }
  async function presence(context:LiveContext,bounty:string) {
    uuid(bounty); const {actor,client,now}=context;
    if(actor.audience!=="PARTICIPANT") throw new AccessError("ACCESS_UNAVAILABLE");
    const row=await first<{paused:boolean}>(client,`SELECT EXISTS(SELECT 1 FROM competition_pauses p WHERE p.round_id=r.id AND p.ended_at IS NULL AND (p.scope='GLOBAL' OR p.team_round_id=$2 OR p.member_round_id=$3)) AS paused FROM bounties b JOIN rounds r ON r.id=b.round_id
      JOIN arena_instances a ON a.id=r.arena_instance_id CROSS JOIN arena_control c WHERE b.id=$1 AND r.id=$4 AND c.id=1 AND c.current_instance_id=a.id
      AND a.status='IN_PROGRESS' AND r.state IN ('RUNNING','PAUSED') AND $5<r.closes_at AND NOT EXISTS(SELECT 1 FROM bounty_awards w WHERE w.bounty_id=b.id AND (r.kind=2 OR w.team_round_id=$2))`,
    [bounty,actor.team_round_id,actor.member_round_id,actor.round_id,now]);
    return row ? {paused:row.paused} : null;
  }
  async function intent(context:LiveContext,auth:LiveAuth,actor:LiveActor,bounty:string){
    const proof=parseProof(auth.cookie), row=proof?await sessionRow(context.client,proof.id):null;
    if(!row || row.member_round_id!==actor.member_round_id || row.round_id!==context.actor.round_id || !await sessionValid(context.client,row,proof!.verifier,context.now,clock))return null;
    return presence({...context,actor},bounty);
  }
  return {guarded,snapshot,page,presence,intent,async maintain(){await accessTransaction(pool,clock,async client=>{await client.query("SELECT live_maintain()");},"SHARED");}};
}
