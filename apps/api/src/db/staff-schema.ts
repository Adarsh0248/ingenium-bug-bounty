import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { bigint, check, customType, foreignKey, pgTable, primaryKey, text, timestamp, unique, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { accessCredentials, staffIdentities } from "./access-schema.js";
import { clockRuns } from "./clock-schema.js";

const bytes = customType<{ data: Buffer }>({ dataType: () => "bytea" });
const instant = (name: string) => timestamp(name, { withTimezone: true, precision: 3 });
const id = () => uuid("id").primaryKey().$defaultFn(randomUUID);

export const staffEntryFlows = pgTable("staff_entry_flows", {
  id: id(), staffId: uuid("staff_id").notNull().references(() => staffIdentities.id, { onDelete: "restrict" }),
  credentialId: uuid("credential_id").notNull(), credentialVersion: bigint("credential_version", { mode: "bigint" }).notNull(),
  proofVerifier: bytes("proof_verifier"), mode: text("mode").notNull(), generation: bigint("generation", { mode: "bigint" }).notNull(),
  state: text("state").notNull(), createdAt: instant("created_at").notNull(), expiresAt: instant("expires_at").notNull(),
  sessionId: uuid("session_id").references((): AnyPgColumn => staffSessions.id, { onDelete: "restrict" }), activatedAt: instant("activated_at"),
}, (t) => [unique("staff_flow_owner").on(t.id, t.staffId),
  foreignKey({ name: "staff_flow_credential", columns: [t.credentialId,t.credentialVersion,t.staffId], foreignColumns: [accessCredentials.id,accessCredentials.version,accessCredentials.staffId] }).onDelete("restrict"),
  check("staff_flow_shape", sql`octet_length(${t.proofVerifier})=32 and ${t.expiresAt}=${t.createdAt}+interval '10 minutes'
    and ${t.mode} in ('NORMAL','CLOCK_RECOVERY') and ${t.generation}>=0 and (${t.mode}<>'CLOCK_RECOVERY' or ${t.generation}>0)
    and ${t.state} in ('OPEN','ACTIVATED','EXPIRED','REVOKED','SUPERSEDED')
    and ((${t.sessionId} is null and ${t.activatedAt} is null and ${t.state}<>'ACTIVATED')
      or (${t.sessionId} is not null and ${t.activatedAt} is not null and ${t.state}<>'OPEN' and ${t.activatedAt}>=${t.createdAt} and ${t.activatedAt}<${t.expiresAt}))`)]);

export const staffSessions = pgTable("staff_sessions", {
  id: id(), staffId: uuid("staff_id").notNull().references(() => staffIdentities.id, { onDelete: "restrict" }),
  flowId: uuid("flow_id").notNull(), credentialId: uuid("credential_id").notNull(), credentialVersion: bigint("credential_version", { mode: "bigint" }).notNull(),
  secretVerifier: bytes("secret_verifier"), mode: text("mode").notNull(), generation: bigint("generation", { mode: "bigint" }).notNull(),
  createdAt: instant("created_at").notNull(), absoluteExpiresAt: instant("absolute_expires_at").notNull(), lastActivityAt: instant("last_activity_at").notNull(),
  revokedAt: instant("revoked_at"), revocationReason: text("revocation_reason"),
}, (t) => [unique("staff_session_owner").on(t.id,t.staffId), unique("staff_session_flow").on(t.id,t.flowId),
  foreignKey({ name: "staff_session_credential", columns: [t.credentialId,t.credentialVersion,t.staffId], foreignColumns: [accessCredentials.id,accessCredentials.version,accessCredentials.staffId] }).onDelete("restrict"),
  foreignKey({ name: "staff_session_flow_owner", columns: [t.flowId,t.staffId], foreignColumns: [staffEntryFlows.id,staffEntryFlows.staffId] }).onDelete("restrict"),
  uniqueIndex("staff_one_unrevoked").on(t.staffId).where(sql`${t.revokedAt} is null`),
  check("staff_session_lifetime", sql`octet_length(${t.secretVerifier})=32 and ${t.absoluteExpiresAt}=${t.createdAt}+interval '8 hours'
    and ${t.lastActivityAt}>=${t.createdAt} and ${t.lastActivityAt}<${t.absoluteExpiresAt}
    and ${t.mode} in ('NORMAL','CLOCK_RECOVERY') and ${t.generation}>=0 and (${t.mode}<>'CLOCK_RECOVERY' or ${t.generation}>0)
    and ((${t.revokedAt} is null and ${t.revocationReason} is null) or (${t.revokedAt} is not null and ${t.revokedAt}>=${t.createdAt} and ${t.revocationReason} is not null))`)]);

export const staffSessionSlots = pgTable("staff_session_slots", {
  staffId: uuid("staff_id").primaryKey().references(() => staffIdentities.id, { onDelete: "restrict" }), sessionId: uuid("session_id"),
  revision: bigint("revision", { mode: "bigint" }).notNull().default(sql`0`),
}, (t) => [foreignKey({ name: "staff_slot_owner", columns: [t.sessionId,t.staffId], foreignColumns: [staffSessions.id,staffSessions.staffId] }).onDelete("restrict"), check("staff_slot_revision", sql`${t.revision}>=0`)]);

export const staffSessionDeliveries = pgTable("staff_session_deliveries", {
  flowId: uuid("flow_id").primaryKey(), sessionId: uuid("session_id").notNull(), keyId: text("key_id").notNull(), ciphertext: text("ciphertext"),
  expiresAt: instant("expires_at").notNull(), purgedAt: instant("purged_at"),
}, (t) => [foreignKey({ name: "staff_delivery_flow", columns: [t.sessionId,t.flowId], foreignColumns: [staffSessions.id,staffSessions.flowId] }).onDelete("restrict"),
  check("staff_delivery_shape", sql`length(${t.keyId}) between 1 and 64 and ((${t.ciphertext} is not null and octet_length(${t.ciphertext}) between 1 and 4096 and ${t.purgedAt} is null) or (${t.ciphertext} is null and ${t.purgedAt} is not null))`)]);

export const staffEntryOutcomes = pgTable("staff_entry_outcomes", {
  flowId: uuid("flow_id").notNull().references(() => staffEntryFlows.id, { onDelete: "restrict" }), requestKey: uuid("request_key").notNull(),
  fingerprint: bytes("fingerprint").notNull(), sessionId: uuid("session_id").notNull().references(() => staffSessions.id, { onDelete: "restrict" }), recordedAt: instant("recorded_at").notNull(),
}, (t) => [primaryKey({ columns: [t.flowId,t.requestKey] }), unique("staff_one_activation").on(t.flowId), check("staff_outcome_fingerprint", sql`octet_length(${t.fingerprint})=32`)]);

export const staffSessionEvents = pgTable("staff_session_events", {
  id: id(), sessionId: uuid("session_id").notNull().references(() => staffSessions.id, { onDelete: "restrict" }),
  kind: text("kind").notNull(), recordedAt: instant("recorded_at").notNull(),
}, (t) => [check("staff_session_event_kind", sql`${t.kind} in ('ACTIVATED','SIGNED_OUT','SUPERSEDED')`)]);

export const staffKeepAliveOutcomes = pgTable("staff_keep_alive_outcomes", {
  sessionId: uuid("session_id").notNull().references(() => staffSessions.id, { onDelete: "restrict" }), requestKey: uuid("request_key").notNull(),
  recordedAt: instant("recorded_at").notNull(),
}, (t) => [primaryKey({ columns: [t.sessionId,t.requestKey] })]);

export const clockClearances = pgTable("clock_clearances", {
  id: id(), staffId: uuid("staff_id").notNull(), sessionId: uuid("session_id").notNull(), credentialId: uuid("credential_id").notNull(),
  credentialVersion: bigint("credential_version", { mode: "bigint" }).notNull(), requestKey: uuid("request_key").notNull(), fingerprint: bytes("fingerprint").notNull(),
  runtimeId: uuid("runtime_id").notNull().references(() => clockRuns.id, { onDelete: "restrict" }), generation: bigint("generation", { mode: "bigint" }).notNull(),
  reportSequence: bigint("report_sequence", { mode: "bigint" }).notNull(), reason: text("reason").notNull(), recordedAt: instant("recorded_at").notNull(),
}, (t) => [foreignKey({ name: "clearance_session_actor", columns: [t.sessionId,t.staffId], foreignColumns: [staffSessions.id,staffSessions.staffId] }).onDelete("restrict"),
  foreignKey({ name: "clearance_credential_actor", columns: [t.credentialId,t.credentialVersion,t.staffId], foreignColumns: [accessCredentials.id,accessCredentials.version,accessCredentials.staffId] }).onDelete("restrict"),
  unique("clock_clearance_generation").on(t.generation), unique("clock_clearance_intent").on(t.staffId,t.requestKey),
  check("clock_clearance_shape", sql`${t.generation}>0 and ${t.reportSequence}>0 and octet_length(${t.fingerprint})=32 and octet_length(${t.reason}) between 1 and 1024 and length(btrim(${t.reason}))>0`)]);
