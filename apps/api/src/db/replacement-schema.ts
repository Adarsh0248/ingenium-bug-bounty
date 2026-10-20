import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { bigint, check, customType, foreignKey, pgTable, text, timestamp, unique, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { accessCredentials, replacementRequests, staffIdentities } from "./access-schema.js";
import { staffSessions } from "./staff-schema.js";

const bytes = customType<{ data: Buffer }>({ dataType: () => "bytea" });
export const replacementDecisions = pgTable("replacement_decisions", {
  id: uuid("id").primaryKey().$defaultFn(randomUUID), flowId: uuid("flow_id").notNull().references(() => replacementRequests.flowId, { onDelete: "restrict" }),
  actorId: uuid("actor_id").notNull().references(() => staffIdentities.id, { onDelete: "restrict" }), sessionId: uuid("session_id").notNull(),
  credentialId: uuid("credential_id").notNull(), credentialVersion: bigint("credential_version", { mode: "bigint" }).notNull(),
  requestKey: uuid("request_key").notNull(), fingerprint: bytes("fingerprint").notNull(), action: text("action").notNull(),
  expectedRevision: bigint("expected_revision", { mode: "bigint" }).notNull(), reason: text("reason").notNull(),
  outcome: text("outcome").notNull(), denialReason: text("denial_reason"), recordedAt: timestamp("recorded_at", { withTimezone: true, precision: 3 }).notNull(),
}, (t) => [foreignKey({ name: "replacement_decision_actor_session", columns: [t.sessionId,t.actorId], foreignColumns: [staffSessions.id,staffSessions.staffId] }).onDelete("restrict"),
  foreignKey({ name: "replacement_decision_actor_code", columns: [t.credentialId,t.credentialVersion,t.actorId], foreignColumns: [accessCredentials.id,accessCredentials.version,accessCredentials.staffId] }).onDelete("restrict"),
  unique("replacement_decision_intent").on(t.actorId,t.requestKey),
  uniqueIndex("replacement_one_applied_decision").on(t.flowId).where(sql`${t.outcome}='APPLIED'`),
  check("replacement_decision_shape", sql`${t.action} in ('APPROVE','REJECT') and ${t.expectedRevision}>=0 and octet_length(${t.fingerprint})=32
    and octet_length(${t.reason}) between 1 and 1024 and length(btrim(${t.reason}))>0
    and ((${t.outcome}='APPLIED' and ${t.denialReason} is null) or (${t.outcome}='REJECTED' and ${t.denialReason} in ('STALE_REQUEST','EXPIRED','ROUND_UNAVAILABLE','ACCESS_UNAVAILABLE','HANDOFF_RESERVED')))`)]);
