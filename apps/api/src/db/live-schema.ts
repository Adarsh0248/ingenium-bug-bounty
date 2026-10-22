import { sql } from "drizzle-orm";
import { bigint, check, index, integer, jsonb, pgTable, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { rounds, arenaInstances, teamRounds, memberRounds, staffIdentities, participantSessions, accessCredentials, accessBlocks } from "./access-schema.js";
import { staffSessions } from "./staff-schema.js";
import { competitionEvents } from "./competition-schema.js";
import { participantJudging } from "./participant-judge-schema.js";
import { validationRuns } from "./judge-schema.js";
import { bugVersions } from "./content-schema.js";
import {draftSaveOutcomes} from "./workbench-schema.js";
import { text } from "drizzle-orm/pg-core";
const instant = (name: string) => timestamp(name, { withTimezone: true, precision: 3 });

export const liveControl = pgTable("live_control", {
  id: integer("id").primaryKey(), rows: bigint("rows", { mode: "bigint" }).notNull().default(sql`0`),
  reserved: bigint("reserved", { mode: "bigint" }).notNull().default(sql`0`),
}, t => [check("live_budget", sql`${t.id}=1 and ${t.rows}>=0 and ${t.reserved}>=0 and ${t.rows}+${t.reserved}<=262144`)]);
export const liveStreams = pgTable("live_streams", {
  id: uuid("id").primaryKey().defaultRandom(), kind: text("kind").notNull(), roundId: uuid("round_id").references(() => rounds.id),
  teamRoundId: uuid("team_round_id").references(() => teamRounds.id), memberRoundId: uuid("member_round_id").references(() => memberRounds.id),
  staffId: uuid("staff_id").references(() => staffIdentities.id), schemaVersion: integer("schema_version").notNull().default(1),
  head: bigint("head", { mode: "bigint" }).notNull().default(sql`0`), retainedFrom: bigint("retained_from", { mode: "bigint" }).notNull().default(sql`1`),
  retainUntil: instant("retain_until"),
}, t => [unique("live_scope").on(t.kind, t.roundId, t.teamRoundId, t.memberRoundId, t.staffId).nullsNotDistinct(),
  check("live_stream_shape", sql`${t.schemaVersion}=1 and ${t.head}>=0 and ${t.retainedFrom} between 1 and ${t.head}+1 and (
    (${t.kind}='ROUND' and ${t.roundId} is not null and num_nonnulls(${t.teamRoundId},${t.memberRoundId},${t.staffId})=0)
    or (${t.kind}='TEAM' and ${t.roundId} is not null and ${t.teamRoundId} is not null and num_nonnulls(${t.memberRoundId},${t.staffId})=0)
    or (${t.kind}='MEMBER' and ${t.roundId} is not null and ${t.memberRoundId} is not null and num_nonnulls(${t.teamRoundId},${t.staffId})=0)
    or (${t.kind} in ('STAFF_OPS','STAFF_SECURITY') and num_nonnulls(${t.roundId},${t.teamRoundId},${t.memberRoundId},${t.staffId})=0)
    or (${t.kind}='STAFF_SELF' and ${t.staffId} is not null and num_nonnulls(${t.roundId},${t.teamRoundId},${t.memberRoundId})=0))`)]);
export const liveEffects = pgTable("live_effects", {
  id: uuid("id").primaryKey().defaultRandom(), revision: bigint("revision", { mode: "bigint" }).notNull().generatedAlwaysAsIdentity(),
  competitionSequence: bigint("competition_sequence", { mode: "bigint" }).references(() => competitionEvents.sequence),
  parentId: uuid("parent_id").references(() => participantJudging.id), roundId: uuid("round_id").references(() => rounds.id),
  arenaId: uuid("arena_id").references(() => arenaInstances.id), participantSessionId: uuid("participant_session_id").references(() => participantSessions.id),
  staffSessionId: uuid("staff_session_id").references(() => staffSessions.id), staffId: uuid("staff_id").references(() => staffIdentities.id),
  credentialId: uuid("credential_id").references(() => accessCredentials.id), blockId: uuid("block_id").references(() => accessBlocks.id),
  validationRunId: uuid("validation_run_id").references(() => validationRuns.id), versionId: uuid("version_id").references(() => bugVersions.id),
  draftOutcomeId:uuid("draft_outcome_id").references(()=>draftSaveOutcomes.id),
  createdAt: instant("created_at").notNull().defaultNow(),
}, t => [index("live_effect_age").on(t.createdAt),check("live_effect_source", sql`num_nonnulls(${t.competitionSequence},${t.parentId},${t.roundId},${t.arenaId},${t.participantSessionId},${t.staffSessionId},${t.staffId},${t.credentialId},${t.blockId},${t.validationRunId},${t.versionId},${t.draftOutcomeId})=1`)]);
export const liveDeliveries = pgTable("live_deliveries", {
  streamId: uuid("stream_id").notNull().references(() => liveStreams.id), sequence: bigint("sequence", { mode: "bigint" }).notNull(),
  effectId: uuid("effect_id").notNull().references(() => liveEffects.id), patch: jsonb("patch").notNull(),
  createdAt: instant("created_at").notNull().defaultNow(), publishedAt: instant("published_at"),
}, t => [unique("live_sequence").on(t.streamId, t.sequence), unique("live_effect_delivery").on(t.effectId, t.streamId),
  index("live_unpublished").on(t.createdAt,t.streamId,t.sequence).where(sql`${t.publishedAt} is null`),
  check("live_delivery_bound", sql`${t.sequence}>0 and jsonb_typeof(${t.patch})='object' and octet_length(${t.patch}::text)<=15360`)]);
export const liveReservations = pgTable("live_reservations", {
  id: uuid("id").primaryKey().defaultRandom(), parentId: uuid("parent_id").references(() => participantJudging.id),
  validationRunId: uuid("validation_run_id").references(() => validationRuns.id), remaining: integer("remaining").notNull(),
}, t => [unique("live_parent_reservation").on(t.parentId), unique("live_validation_reservation").on(t.validationRunId),
  check("live_reservation_shape", sql`num_nonnulls(${t.parentId},${t.validationRunId})=1 and ${t.remaining} between 0 and 2048`)]);
