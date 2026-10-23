import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  customType,
  foreignKey,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { accessCredentials } from "./access-schema.js";
import { staffSessions } from "./staff-schema.js";
import { teams } from "./schema.js";

const bytes = customType<{ data: Buffer }>({ dataType: () => "bytea" });
export const teamManagementOutcomes = pgTable(
  "team_management_outcomes",
  {
    id: uuid("id").primaryKey(),
    actorId: uuid("actor_id").notNull(),
    sessionId: uuid("session_id").notNull(),
    credentialId: uuid("credential_id").notNull(),
    credentialVersion: bigint("credential_version", {
      mode: "bigint",
    }).notNull(),
    requestKey: uuid("request_key").notNull(),
    action: text("action").notNull(),
    targetTeamId: uuid("target_team_id").references(() => teams.id),
    expectedRevision: bigint("expected_revision", { mode: "bigint" }).notNull(),
    fingerprint: bytes("fingerprint").notNull(),
    reason: text("reason").notNull(),
    outcome: text("outcome").notNull(),
    denialReason: text("denial_reason"),
    resultTeamId: uuid("result_team_id").references(() => teams.id),
    resultCredentialId: uuid("result_credential_id").references(
      () => accessCredentials.id,
    ),
    codeVersion: bigint("code_version", { mode: "bigint" }),
    recordedAt: timestamp("recorded_at", {
      withTimezone: true,
      precision: 3,
    }).notNull(),
  },
  (t) => [
    foreignKey({
      name: "team_management_session_actor",
      columns: [t.sessionId, t.actorId],
      foreignColumns: [staffSessions.id, staffSessions.staffId],
    }),
    foreignKey({
      name: "team_management_credential_actor",
      columns: [t.credentialId, t.credentialVersion, t.actorId],
      foreignColumns: [
        accessCredentials.id,
        accessCredentials.version,
        accessCredentials.staffId,
      ],
    }),
    unique("team_management_intent").on(t.actorId, t.requestKey),
    uniqueIndex("team_management_issued_credential")
      .on(t.resultCredentialId)
      .where(sql`${t.action}<>'REVOKE'`),
    check(
      "team_management_shape",
      sql`${t.expectedRevision}>=0 and octet_length(${t.fingerprint})=32
    and octet_length(${t.reason}) between 1 and 1024 and btrim(${t.reason})<>''
    and ((${t.action}='CREATE' and ${t.targetTeamId} is null) or (${t.action} in ('ROTATE','ISSUE','REVOKE') and ${t.targetTeamId} is not null))
    and ((${t.outcome}='APPLIED' and ${t.denialReason} is null and ${t.resultTeamId} is not null and ${t.resultCredentialId} is not null and ${t.codeVersion}>0)
      or (${t.outcome}='REJECTED' and ${t.denialReason} is not null and ${t.denialReason} in ('STALE_VERSION','TEAM_CAPACITY','TEAM_INCOMPLETE','CODE_INACTIVE','CODE_ACTIVE')
        and ${t.resultTeamId} is null and ${t.resultCredentialId} is null and ${t.codeVersion} is null))`,
    ),
  ],
);
