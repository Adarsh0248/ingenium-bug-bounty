import { sql } from "drizzle-orm";
import { bigint,check,customType,foreignKey,index,pgTable,text,timestamp,unique,uuid } from "drizzle-orm/pg-core";
import { memberRounds,participantSessions,rounds } from "./access-schema.js";
import { bounties } from "./competition-schema.js";
const bytes=customType<{data:Buffer}>({dataType:()=>"bytea"});
const instant=(name:string)=>timestamp(name,{withTimezone:true,precision:3});

export const codeDrafts=pgTable("code_drafts",{
  id:uuid("id").primaryKey().defaultRandom(),memberRoundId:uuid("member_round_id").notNull().references(()=>memberRounds.id),
  bountyId:uuid("bounty_id").notNull(),roundId:uuid("round_id").notNull().references(()=>rounds.id),
  sourceCode:bytes("source_code"),revision:bigint("revision",{mode:"bigint"}).notNull(),
  createdAt:instant("created_at").notNull(),updatedAt:instant("updated_at").notNull(),
},t=>[unique("draft_member_bounty").on(t.memberRoundId,t.bountyId),foreignKey({name:"draft_bounty_round",columns:[t.bountyId,t.roundId],foreignColumns:[bounties.id,bounties.roundId]}),
  check("draft_shape",sql`octet_length(${t.sourceCode})<=131072 and ${t.revision} between 1 and 9223372036854775806 and ${t.updatedAt}>=${t.createdAt}`)]);
export const draftSaveOutcomes=pgTable("draft_save_outcomes",{
  id:uuid("id").primaryKey().defaultRandom(),memberRoundId:uuid("member_round_id").notNull().references(()=>memberRounds.id),bountyId:uuid("bounty_id").notNull(),
  roundId:uuid("round_id").notNull().references(()=>rounds.id),requestKey:uuid("request_key").notNull(),requestFingerprint:bytes("request_fingerprint").notNull(),
  baseRevision:bigint("base_revision",{mode:"bigint"}).notNull(),outcome:text("outcome").notNull(),reasonCode:text("reason_code"),
  resultRevision:bigint("result_revision",{mode:"bigint"}),recordedAt:instant("recorded_at").notNull(),
},t=>[unique("draft_save_intent").on(t.memberRoundId,t.bountyId,t.requestKey),foreignKey({name:"draft_outcome_bounty_round",columns:[t.bountyId,t.roundId],foreignColumns:[bounties.id,bounties.roundId]}),
  index("draft_outcome_member").on(t.memberRoundId),check("draft_outcome_shape",sql`octet_length(${t.requestFingerprint})=32 and ${t.baseRevision} between 0 and 9223372036854775805 and (
    (${t.outcome}='SAVED' and ${t.reasonCode} is null and ${t.resultRevision}=${t.baseRevision}+1 and ${t.resultRevision} is not null)
    or (${t.outcome}='UNCHANGED' and ${t.reasonCode} is null and ${t.resultRevision}=${t.baseRevision} and ${t.baseRevision}>0 and ${t.resultRevision} is not null)
    or (${t.outcome}='CONFLICT' and ${t.reasonCode}='REVISION_MISMATCH' and ${t.reasonCode} is not null and ${t.resultRevision} is null)
    or (${t.outcome}='REJECTED' and ${t.reasonCode} in ('PAUSED','BOUNTY_UNAVAILABLE','ROUND_NOT_WRITABLE','DRAFT_TOO_LARGE') and ${t.reasonCode} is not null and ${t.resultRevision} is null))`)]);
export const workbenchActivities=pgTable("workbench_activities",{
  id:uuid("id").primaryKey().defaultRandom(),sessionId:uuid("session_id").notNull().references(()=>participantSessions.id),
  memberRoundId:uuid("member_round_id").notNull().references(()=>memberRounds.id),bountyId:uuid("bounty_id").notNull().references(()=>bounties.id),
  requestKey:uuid("request_key"),draftOutcomeId:uuid("draft_outcome_id").references(()=>draftSaveOutcomes.id),recordedAt:instant("recorded_at").notNull(),
},t=>[unique("workbench_open_intent").on(t.memberRoundId,t.bountyId,t.requestKey),unique("workbench_changed_save").on(t.draftOutcomeId),
  index("workbench_activity_member").on(t.memberRoundId),check("workbench_activity_source",sql`num_nonnulls(${t.requestKey},${t.draftOutcomeId})=1`)]);
