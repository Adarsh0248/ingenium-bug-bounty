import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { bigint, check, customType, foreignKey, integer, pgTable, primaryKey, text, timestamp, unique, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { teams, teamMembers } from "./schema.js";

const bytes = customType<{ data: Buffer }>({ dataType: () => "bytea" });
const instant = (name: string) => timestamp(name, { withTimezone: true, precision: 3 });
const id = () => uuid("id").primaryKey().$defaultFn(randomUUID);

export const securityControl = pgTable("security_control", {
  id: integer("id").primaryKey(), revision: bigint("revision", { mode: "bigint" }).notNull().default(sql`0`),
}, (t) => [check("security_control_singleton", sql`${t.id} = 1 and ${t.revision} >= 0`)]);

export const staffIdentities = pgTable("staff_identities", {
  id: id(), displayName: text("display_name").notNull(), role: text("role").notNull(), disabledAt: instant("disabled_at"),
  revision: bigint("revision", { mode: "bigint" }).notNull().default(sql`0`),
}, (t) => [check("staff_identity_role", sql`${t.role} in ('ORGANISER', 'OWNER', 'SUPER_ADMIN')`),
  check("staff_identity_name", sql`octet_length(${t.displayName}) between 1 and 120 and length(btrim(${t.displayName})) > 0 and ${t.revision}>=0`)]);

export const accessCredentials = pgTable("access_credentials", {
  id: id(), teamId: uuid("team_id").references(() => teams.id, { onDelete: "restrict" }),
  staffId: uuid("staff_id").references(() => staffIdentities.id, { onDelete: "restrict" }),
  verifier: bytes("verifier").notNull(), version: bigint("version", { mode: "bigint" }).notNull(),
  issuedAt: instant("issued_at").notNull(), revokedAt: instant("revoked_at"),
}, (t) => [check("credential_exact_owner", sql`num_nonnulls(${t.teamId}, ${t.staffId}) = 1`),
  check("credential_verifier", sql`octet_length(${t.verifier}) = 32 and ${t.version} > 0`),
  check("credential_revoked_time", sql`${t.revokedAt} is null or ${t.revokedAt} >= ${t.issuedAt}`),
  unique("credential_verifier_unique").on(t.verifier), unique("credential_team_version").on(t.teamId, t.version),
  unique("credential_staff_version").on(t.staffId, t.version), unique("credential_id_version_team").on(t.id, t.version, t.teamId),
  unique("credential_id_version_staff").on(t.id, t.version, t.staffId),
  uniqueIndex("credential_one_active_team").on(t.teamId).where(sql`${t.revokedAt} is null and ${t.teamId} is not null`),
  uniqueIndex("credential_one_active_staff").on(t.staffId).where(sql`${t.revokedAt} is null and ${t.staffId} is not null`)]);

export const arenaInstances = pgTable("arena_instances", {
  id: id(), status: text("status").notNull(), createdBy: uuid("created_by").notNull().references(() => staffIdentities.id, { onDelete: "restrict" }),
  createdAt: instant("created_at").notNull(), revision: bigint("revision", { mode: "bigint" }).notNull().default(sql`0`),
}, (t) => [check("arena_instance_status", sql`${t.status} in ('SETUP', 'IN_PROGRESS', 'COMPLETED', 'DISCARDED') and ${t.revision} >= 0`),
  uniqueIndex("arena_one_reserved_instance").on(sql`(true)`).where(sql`${t.status} in ('SETUP', 'IN_PROGRESS')`)]);

export const arenaControl = pgTable("arena_control", {
  id: integer("id").primaryKey(), currentInstanceId: uuid("current_instance_id").references(() => arenaInstances.id, { onDelete: "restrict" }),
  revision: bigint("revision", { mode: "bigint" }).notNull().default(sql`0`),
}, (t) => [check("arena_control_singleton", sql`${t.id} = 1 and ${t.revision} >= 0`)]);

export const rounds = pgTable("rounds", {
  id: id(), arenaInstanceId: uuid("arena_instance_id").notNull().references(() => arenaInstances.id, { onDelete: "restrict" }),
  kind: integer("kind").notNull(), state: text("state").notNull(), durationMs: bigint("duration_ms", { mode: "bigint" }).notNull(),
  startedAt: instant("started_at"), closesAt: instant("closes_at"), revision: bigint("revision", { mode: "bigint" }).notNull().default(sql`0`),
  configurationRevision: bigint("configuration_revision", { mode: "bigint" }).notNull().default(sql`0`),
  trustedTimeAt: instant("trusted_time_at"),
}, (t) => [check("round_kind_duration", sql`${t.kind} in (1, 2) and ${t.durationMs} between 1 and 18000000 and ${t.revision} >= 0`),
  check("round_configuration_revision", sql`${t.configurationRevision} >= 0`),
  check("round_state", sql`${t.state} in ('DRAFT', 'READY', 'RUNNING', 'PAUSED', 'CLOSING', 'CLOSED', 'CANCELLING', 'CANCELLED')`),
  check("round_start_shape", sql`(${t.state} in ('DRAFT', 'READY') and ${t.startedAt} is null and ${t.closesAt} is null)
    or (${t.state} not in ('DRAFT', 'READY') and ${t.startedAt} is not null and ${t.closesAt} is not null and ${t.closesAt} > ${t.startedAt})`),
  unique("round_instance_kind").on(t.arenaInstanceId, t.kind), unique("round_id_instance").on(t.id, t.arenaInstanceId),
  uniqueIndex("round_one_live_per_instance").on(t.arenaInstanceId).where(sql`${t.state} in ('RUNNING','PAUSED','CLOSING','CANCELLING')`)]);

export const teamRounds = pgTable("team_rounds", {
  id: id(), teamId: uuid("team_id").notNull().references(() => teams.id, { onDelete: "restrict" }),
  roundId: uuid("round_id").notNull().references(() => rounds.id, { onDelete: "restrict" }), displayName: text("display_name").notNull(),
}, (t) => [unique("team_round_once").on(t.teamId, t.roundId), unique("team_round_same_scope").on(t.id, t.teamId, t.roundId),
  check("team_round_name", sql`octet_length(${t.displayName}) between 1 and 120 and length(btrim(${t.displayName})) > 0`)]);

export const entryFlows = pgTable("entry_flows", {
  id: id(), teamId: uuid("team_id").notNull(), credentialId: uuid("credential_id").notNull(),
  purpose: text("purpose").notNull().default("TEAM_ENTRY"),
  credentialVersion: bigint("credential_version", { mode: "bigint" }).notNull(), proofVerifier: bytes("proof_verifier").notNull(),
  roundId: uuid("round_id").references(() => rounds.id, { onDelete: "restrict" }),
  state: text("state").notNull(), createdAt: instant("created_at").notNull(), expiresAt: instant("expires_at").notNull(),
  activatedSessionId: uuid("activated_session_id").references((): AnyPgColumn => participantSessions.id, { onDelete: "restrict" }), activatedAt: instant("activated_at"),
}, (t) => [foreignKey({ name: "entry_flow_credential_owner", columns: [t.credentialId, t.credentialVersion, t.teamId],
  foreignColumns: [accessCredentials.id, accessCredentials.version, accessCredentials.teamId] }).onDelete("restrict"),
  unique("entry_flow_id_team").on(t.id, t.teamId), check("entry_flow_purpose", sql`${t.purpose} in ('TEAM_ENTRY','REPLACEMENT')`),
  check("entry_flow_shape", sql`octet_length(${t.proofVerifier}) = 32 and ${t.expiresAt} = ${t.createdAt} + interval '10 minutes'
    and ${t.state} in ('OPEN', 'ACTIVATED', 'EXPIRED', 'REVOKED', 'SUPERSEDED')
    and ((${t.activatedSessionId} is null and ${t.activatedAt} is null and ${t.state} <> 'ACTIVATED')
      or (${t.state} <> 'OPEN' and ${t.activatedSessionId} is not null and ${t.activatedAt} is not null and ${t.activatedAt} >= ${t.createdAt} and ${t.activatedAt} < ${t.expiresAt}))`)]);

export const memberRounds = pgTable("member_rounds", {
  id: id(), teamRoundId: uuid("team_round_id").notNull(), teamId: uuid("team_id").notNull(),
  memberId: uuid("member_id").notNull(), roundId: uuid("round_id").notNull(), displayName: text("display_name").notNull(),
  language: text("language"), enrolledAt: instant("enrolled_at"), firstEntryFlowId: uuid("first_entry_flow_id"),
}, (t) => [foreignKey({ name: "member_round_registered_team", columns: [t.memberId, t.teamId], foreignColumns: [teamMembers.id, teamMembers.teamId] }).onDelete("restrict"),
  foreignKey({ name: "member_round_team_round", columns: [t.teamRoundId, t.teamId, t.roundId], foreignColumns: [teamRounds.id, teamRounds.teamId, teamRounds.roundId] }).onDelete("restrict"),
  foreignKey({ name: "member_round_entry_team", columns: [t.firstEntryFlowId, t.teamId], foreignColumns: [entryFlows.id, entryFlows.teamId] }).onDelete("restrict"),
  unique("member_round_once").on(t.memberId, t.roundId), unique("member_round_session_scope").on(t.id, t.memberId, t.teamId, t.roundId),
  check("member_round_name", sql`octet_length(${t.displayName}) between 1 and 120 and length(btrim(${t.displayName})) > 0`),
  check("member_round_enrolment", sql`(${t.language} is null and ${t.enrolledAt} is null and ${t.firstEntryFlowId} is null)
    or (${t.language} is not null and ${t.language} in ('c','cpp','java','python','javascript') and ${t.enrolledAt} is not null and ${t.firstEntryFlowId} is not null)`)]);

export const participantSessions = pgTable("participant_sessions", {
  id: id(), memberRoundId: uuid("member_round_id").notNull(), memberId: uuid("member_id").notNull(), teamId: uuid("team_id").notNull(),
  roundId: uuid("round_id").notNull(), entryFlowId: uuid("entry_flow_id").notNull(), credentialId: uuid("credential_id").notNull(),
  credentialVersion: bigint("credential_version", { mode: "bigint" }).notNull(), secretVerifier: bytes("secret_verifier").notNull(),
  createdAt: instant("created_at").notNull(), absoluteExpiresAt: instant("absolute_expires_at").notNull(),
  lastActivityAt: instant("last_activity_at").notNull(), revokedAt: instant("revoked_at"), revocationReason: text("revocation_reason"),
}, (t) => [foreignKey({ name: "session_member_scope", columns: [t.memberRoundId, t.memberId, t.teamId, t.roundId],
  foreignColumns: [memberRounds.id, memberRounds.memberId, memberRounds.teamId, memberRounds.roundId] }).onDelete("restrict"),
  foreignKey({ name: "session_credential_owner", columns: [t.credentialId, t.credentialVersion, t.teamId],
    foreignColumns: [accessCredentials.id, accessCredentials.version, accessCredentials.teamId] }).onDelete("restrict"),
  foreignKey({ name: "session_entry_team", columns: [t.entryFlowId, t.teamId], foreignColumns: [entryFlows.id, entryFlows.teamId] }).onDelete("restrict"),
  unique("session_id_member").on(t.id, t.memberId), unique("session_id_flow").on(t.id, t.entryFlowId),
  uniqueIndex("session_one_unrevoked_member").on(t.memberId).where(sql`${t.revokedAt} is null`),
  check("session_lifetime", sql`octet_length(${t.secretVerifier}) = 32 and ${t.absoluteExpiresAt} = ${t.createdAt} + interval '8 hours'
    and ${t.lastActivityAt} >= ${t.createdAt} and ${t.lastActivityAt} < ${t.absoluteExpiresAt}
    and ((${t.revokedAt} is null and ${t.revocationReason} is null) or (${t.revokedAt} is not null and ${t.revokedAt} >= ${t.createdAt} and ${t.revocationReason} is not null))`)]);

export const memberSessionSlots = pgTable("member_session_slots", {
  memberId: uuid("member_id").primaryKey().references(() => teamMembers.id, { onDelete: "restrict" }),
  sessionId: uuid("session_id"), revision: bigint("revision", { mode: "bigint" }).notNull().default(sql`0`),
  reservationFlowId: uuid("reservation_flow_id"),
}, (t) => [foreignKey({ name: "slot_session_member", columns: [t.sessionId, t.memberId], foreignColumns: [participantSessions.id, participantSessions.memberId] }).onDelete("restrict"),
  foreignKey({ name: "slot_reservation_member", columns: [t.reservationFlowId,t.memberId], foreignColumns: [replacementRequests.flowId,replacementRequests.memberId] }).onDelete("restrict"),
  check("slot_revision", sql`${t.revision} >= 0 and num_nonnulls(${t.sessionId},${t.reservationFlowId})<=1`)]);

export const sessionDeliveries = pgTable("session_deliveries", {
  flowId: uuid("flow_id").primaryKey(), sessionId: uuid("session_id").notNull(), keyId: text("key_id").notNull(),
  ciphertext: text("ciphertext"), expiresAt: instant("expires_at").notNull(), purgedAt: instant("purged_at"),
}, (t) => [foreignKey({ name: "delivery_session_flow", columns: [t.sessionId, t.flowId], foreignColumns: [participantSessions.id, participantSessions.entryFlowId] }).onDelete("restrict"),
  check("delivery_shape", sql`length(${t.keyId}) between 1 and 64 and ((${t.ciphertext} is not null and octet_length(${t.ciphertext}) between 1 and 4096 and ${t.purgedAt} is null)
    or (${t.ciphertext} is null and ${t.purgedAt} is not null))`)]);

export const entryOutcomes = pgTable("entry_outcomes", {
  flowId: uuid("flow_id").notNull().references(() => entryFlows.id, { onDelete: "restrict" }), requestKey: uuid("request_key").notNull(),
  fingerprint: bytes("fingerprint").notNull(), memberId: uuid("member_id").notNull().references(() => teamMembers.id, { onDelete: "restrict" }),
  language: text("language").notNull(), outcome: text("outcome").notNull(), reason: text("reason"),
  sessionId: uuid("session_id").references(() => participantSessions.id, { onDelete: "restrict" }), recordedAt: instant("recorded_at").notNull(),
}, (t) => [primaryKey({ columns: [t.flowId, t.requestKey] }), check("entry_outcome_shape", sql`octet_length(${t.fingerprint}) = 32
    and ${t.language} in ('c','cpp','java','python','javascript') and ((${t.outcome} = 'ACTIVATED' and ${t.sessionId} is not null and ${t.reason} is null)
    or (${t.outcome} = 'REJECTED' and ${t.sessionId} is null and ${t.reason} is not null and ${t.reason} in ('ALREADY_ENROLLED','ROUND_UNAVAILABLE','ACCESS_UNAVAILABLE')))`)]);

export const participantSessionOutcomes = pgTable("participant_session_outcomes", {
  sessionId: uuid("session_id").notNull().references(() => participantSessions.id, { onDelete: "restrict" }),
  requestKey: uuid("request_key").notNull(), action: text("action").notNull(), fingerprint: bytes("fingerprint").notNull(),
  recordedAt: instant("recorded_at").notNull(), expiresAt: instant("expires_at").notNull(),
}, (t) => [primaryKey({ columns: [t.sessionId, t.requestKey] }),
  check("participant_session_outcome_shape", sql`${t.action} in ('KEEP_ALIVE','LOGOUT') and octet_length(${t.fingerprint})=32 and ${t.expiresAt}>${t.recordedAt}`)]);

export const replacementRequests = pgTable("replacement_requests", {
  flowId: uuid("flow_id").primaryKey(), parentFlowId: uuid("parent_flow_id").notNull(), requestKey: uuid("request_key").notNull(),
  fingerprint: bytes("fingerprint").notNull(), memberRoundId: uuid("member_round_id").notNull(), memberId: uuid("member_id").notNull(),
  teamId: uuid("team_id").notNull(), roundId: uuid("round_id").notNull(), expectedSessionId: uuid("expected_session_id"),
  expectedSlotRevision: bigint("expected_slot_revision", { mode: "bigint" }).notNull(), state: text("state").notNull(),
  proofKeyId: text("proof_key_id").notNull(), proofCiphertext: text("proof_ciphertext"), proofPurgedAt: instant("proof_purged_at"),
}, (t) => [foreignKey({ name: "replacement_flow_team", columns: [t.flowId,t.teamId], foreignColumns: [entryFlows.id,entryFlows.teamId] }).onDelete("restrict"),
  foreignKey({ name: "replacement_parent_team", columns: [t.parentFlowId,t.teamId], foreignColumns: [entryFlows.id,entryFlows.teamId] }).onDelete("restrict"),
  foreignKey({ name: "replacement_member_scope", columns: [t.memberRoundId,t.memberId,t.teamId,t.roundId], foreignColumns: [memberRounds.id,memberRounds.memberId,memberRounds.teamId,memberRounds.roundId] }).onDelete("restrict"),
  foreignKey({ name: "replacement_expected_member", columns: [t.expectedSessionId,t.memberId], foreignColumns: [participantSessions.id,participantSessions.memberId] }).onDelete("restrict"),
  unique("replacement_create_intent").on(t.parentFlowId,t.requestKey), unique("replacement_flow_member").on(t.flowId,t.memberId),
  uniqueIndex("replacement_one_approved").on(t.memberId).where(sql`${t.state}='APPROVED'`),
  check("replacement_request_shape", sql`${t.flowId}<>${t.parentFlowId} and octet_length(${t.fingerprint})=32 and ${t.expectedSlotRevision}>=0
    and ${t.state} in ('PENDING','APPROVED','ACTIVATED','REJECTED','EXPIRED','SUPERSEDED') and length(${t.proofKeyId}) between 1 and 64
    and ((${t.proofCiphertext} is not null and octet_length(${t.proofCiphertext}) between 1 and 4096 and ${t.proofPurgedAt} is null)
      or (${t.proofCiphertext} is null and ${t.proofPurgedAt} is not null))`)]);

export const accessBlocks = pgTable("access_blocks", {
  id: id(), arenaInstanceId: uuid("arena_instance_id").notNull().references(() => arenaInstances.id, { onDelete: "restrict" }),
  teamId: uuid("team_id").references(() => teams.id, { onDelete: "restrict" }), memberId: uuid("member_id").references(() => teamMembers.id, { onDelete: "restrict" }),
  createdBy: uuid("created_by").notNull().references(() => staffIdentities.id, { onDelete: "restrict" }), reason: text("reason").notNull(),
  createdAt: instant("created_at").notNull(), clearedAt: instant("cleared_at"),
}, (t) => [check("access_block_target", sql`num_nonnulls(${t.teamId}, ${t.memberId}) = 1 and octet_length(${t.reason}) between 1 and 1024 and (${t.clearedAt} is null or ${t.clearedAt} >= ${t.createdAt})`),
  uniqueIndex("access_block_one_team").on(t.arenaInstanceId, t.teamId).where(sql`${t.clearedAt} is null and ${t.teamId} is not null`),
  uniqueIndex("access_block_one_member").on(t.arenaInstanceId, t.memberId).where(sql`${t.clearedAt} is null and ${t.memberId} is not null`)]);

export const entryEvents = pgTable("entry_events", {
  id: id(), flowId: uuid("flow_id").notNull().references(() => entryFlows.id, { onDelete: "restrict" }),
  sessionId: uuid("session_id").references(() => participantSessions.id, { onDelete: "restrict" }), kind: text("kind").notNull(), createdAt: instant("created_at").notNull(),
}, (t) => [check("entry_event_kind", sql`(${t.kind} = 'FLOW_OPENED' and ${t.sessionId} is null)
  or (${t.kind} in ('SESSION_ACTIVATED','SESSION_REVOKED') and ${t.sessionId} is not null)`),
  foreignKey({ name: "entry_event_session_flow", columns: [t.sessionId, t.flowId], foreignColumns: [participantSessions.id, participantSessions.entryFlowId] }).onDelete("restrict")]);

export const quotaControl = pgTable("quota_control", { id: integer("id").primaryKey() }, (t) => [check("quota_control_singleton", sql`${t.id} = 1`)]);
export const quotaBuckets = pgTable("quota_buckets", {
  kind: text("kind").notNull(), keyHash: bytes("key_hash").notNull(), rate: integer("rate").notNull(), burst: integer("burst").notNull(),
  credits: bigint("credits", { mode: "bigint" }).notNull(), refilledAt: instant("refilled_at").notNull(), seenAt: instant("seen_at").notNull(),
}, (t) => [primaryKey({ columns: [t.kind, t.keyHash] }), check("quota_bucket_shape", sql`${t.kind} in ('AUTH_GLOBAL','AUTH_IP','AUTH_BROWSER','AUTH_CODE','HTTP_GLOBAL','HTTP_IP','READ_MEMBER','MEMBER_COMMAND','DRAFT_SAVE','READ_STAFF','STAFF_CONFIRM','STAFF_COMMAND')
  and octet_length(${t.keyHash}) = 32 and ${t.rate} > 0 and ${t.burst} > 0 and ${t.credits} between 0 and ${t.burst}::bigint * 60000 and ${t.seenAt} >= ${t.refilledAt}`)]);
