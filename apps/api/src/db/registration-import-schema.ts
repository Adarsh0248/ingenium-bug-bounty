import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  customType,
  foreignKey,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { accessCredentials } from "./access-schema.js";
import { staffSessions } from "./staff-schema.js";
import { teams } from "./schema.js";
const bytes = customType<{ data: Buffer }>({ dataType: () => "bytea" });
export const registrationImportOutcomes = pgTable(
  "registration_import_outcomes",
  {
    id: uuid("id").primaryKey(),
    actorId: uuid("actor_id").notNull(),
    sessionId: uuid("session_id").notNull(),
    credentialId: uuid("credential_id").notNull(),
    credentialVersion: bigint("credential_version", {
      mode: "bigint",
    }).notNull(),
    requestKey: uuid("request_key").notNull(),
    expectedRevision: bigint("expected_revision", { mode: "bigint" }).notNull(),
    csvDigest: bytes("csv_digest").notNull(),
    fingerprint: bytes("fingerprint").notNull(),
    reason: text("reason").notNull(),
    outcome: text("outcome").notNull(),
    denialReason: text("denial_reason"),
    items: jsonb("items").notNull(),
    recordedAt: timestamp("recorded_at", {
      withTimezone: true,
      precision: 3,
    }).notNull(),
  },
  (t) => [
    foreignKey({
      name: "registration_import_session_actor",
      columns: [t.sessionId, t.actorId],
      foreignColumns: [staffSessions.id, staffSessions.staffId],
    }),
    foreignKey({
      name: "registration_import_credential_actor",
      columns: [t.credentialId, t.credentialVersion, t.actorId],
      foreignColumns: [
        accessCredentials.id,
        accessCredentials.version,
        accessCredentials.staffId,
      ],
    }),
    unique("registration_import_intent").on(t.actorId, t.requestKey),
    check(
      "registration_import_shape",
      sql`${t.expectedRevision}>=0 and octet_length(${t.csvDigest})=32 and octet_length(${t.fingerprint})=32
    and octet_length(${t.reason}) between 1 and 1024 and btrim(${t.reason})<>''
    and jsonb_typeof(${t.items})='array' and jsonb_array_length(${t.items}) between 1 and 100 and octet_length(${t.items}::text)<=524288
    and ((${t.outcome} in ('APPLIED','UNCHANGED') and ${t.denialReason} is null) or (${t.outcome}='REJECTED' and ${t.denialReason} is not null
      and ${t.denialReason} in ('STALE_VERSION','REGISTRATION_CONFLICT','TEAM_CAPACITY')))`,
    ),
  ],
);
export const registrationSources = pgTable(
  "registration_sources",
  {
    registrationId: text("registration_id").primaryKey(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id),
    importId: uuid("import_id")
      .notNull()
      .references(() => registrationImportOutcomes.id),
  },
  (t) => [
    unique("registration_one_team").on(t.teamId),
    check(
      "registration_id_shape",
      sql`${t.registrationId} ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'`,
    ),
  ],
);
