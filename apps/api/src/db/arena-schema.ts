import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { bigint, check, customType, foreignKey, integer, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { accessCredentials, arenaControl, arenaInstances, rounds, staffIdentities } from "./access-schema.js";
import { staffSessions } from "./staff-schema.js";
import { teams } from "./schema.js";

const bytes = customType<{ data: Buffer }>({ dataType: () => "bytea" });
export const arenaSetupOutcomes = pgTable("arena_setup_outcomes", {
  id: uuid("id").primaryKey().$defaultFn(randomUUID), actorId: uuid("actor_id").notNull().references(() => staffIdentities.id, { onDelete: "restrict" }),
  sessionId: uuid("session_id").notNull(), credentialId: uuid("credential_id").notNull(), credentialVersion: bigint("credential_version", { mode: "bigint" }).notNull(),
  action: text("action").notNull(), controlId: integer("control_id").references(() => arenaControl.id, { onDelete: "restrict" }),
  roundId: uuid("round_id").references(() => rounds.id, { onDelete: "restrict" }), requestKey: uuid("request_key").notNull(), fingerprint: bytes("fingerprint").notNull(),
  expectedRevision: bigint("expected_revision", { mode: "bigint" }).notNull(), durationMs: bigint("duration_ms", { mode: "bigint" }).notNull(),
  reason: text("reason").notNull(), outcome: text("outcome").notNull(), denialReason: text("denial_reason"),
  recordedAt: timestamp("recorded_at", { withTimezone: true, precision: 3 }).notNull(),
  resultInstanceId: uuid("result_instance_id").references(() => arenaInstances.id, { onDelete: "restrict" }),
  resultRoundId: uuid("result_round_id").references(() => rounds.id, { onDelete: "restrict" }),
  resultRevision: bigint("result_revision", { mode: "bigint" }),
}, (t) => [foreignKey({ name: "arena_setup_actor_session", columns: [t.sessionId,t.actorId], foreignColumns: [staffSessions.id,staffSessions.staffId] }).onDelete("restrict"),
  foreignKey({ name: "arena_setup_actor_code", columns: [t.credentialId,t.credentialVersion,t.actorId], foreignColumns: [accessCredentials.id,accessCredentials.version,accessCredentials.staffId] }).onDelete("restrict"),
  uniqueIndex("arena_setup_create_intent").on(t.actorId,t.requestKey).where(sql`${t.action}='CREATE'`),
  uniqueIndex("arena_setup_configure_intent").on(t.actorId,t.roundId,t.requestKey).where(sql`${t.action}='CONFIGURE'`),
  uniqueIndex("arena_setup_applied_revision").on(t.resultRoundId,t.resultRevision).where(sql`${t.outcome}='APPLIED'`),
  check("arena_setup_applied_revision_shape", sql`${t.outcome}<>'APPLIED' or (${t.action}='CREATE' and ${t.resultRevision}=1)
    or (${t.action}='CONFIGURE' and ${t.resultRevision}=${t.expectedRevision}+1)`),
  check("arena_setup_target", sql`(${t.action}='CREATE' and ${t.controlId} is not null and ${t.controlId}=1 and ${t.roundId} is null)
    or (${t.action}='CONFIGURE' and ${t.controlId} is null and ${t.roundId} is not null)`),
  check("arena_setup_payload", sql`octet_length(${t.fingerprint})=32 and ${t.expectedRevision}>=0 and ${t.durationMs} between 1 and 18000000
    and octet_length(${t.reason}) between 1 and 1024 and length(btrim(${t.reason}))>0`),
  check("arena_setup_result", sql`(${t.outcome} in ('APPLIED','UNCHANGED') and ${t.denialReason} is null and ${t.resultInstanceId} is not null
      and ${t.resultRoundId} is not null and ${t.resultRevision} is not null and ${t.resultRevision}>=0 and (${t.outcome}<>'UNCHANGED' or ${t.action}='CONFIGURE'))
    or (${t.outcome}='REJECTED' and ${t.denialReason} is not null and ${t.denialReason} in ('STALE_VERSION','ARENA_RESERVED','ROUND_UNAVAILABLE','TEAM_INCOMPLETE')
      and ${t.resultInstanceId} is null and ${t.resultRoundId} is null and ${t.resultRevision} is null)`)]);

export const arenaSetupTeams = pgTable("arena_setup_teams", {
  outcomeId: uuid("outcome_id").notNull().references(() => arenaSetupOutcomes.id, { onDelete: "restrict" }),
  teamId: uuid("team_id").notNull().references(() => teams.id, { onDelete: "restrict" }),
}, (t) => [primaryKey({ columns: [t.outcomeId,t.teamId] })]);

// Draft choices are not the frozen TeamRound/MemberRound access records made at launch.
export const roundDraftTeams = pgTable("round_draft_teams", {
  roundId: uuid("round_id").notNull().references(() => rounds.id, { onDelete: "restrict" }),
  teamId: uuid("team_id").notNull().references(() => teams.id, { onDelete: "restrict" }),
}, (t) => [primaryKey({ columns: [t.roundId,t.teamId] })]);
