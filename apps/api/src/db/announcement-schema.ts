import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  customType,
  foreignKey,
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { accessCredentials, arenaInstances, rounds } from "./access-schema.js";
import { teams } from "./schema.js";
import { staffSessions } from "./staff-schema.js";

const bytes = customType<{ data: Buffer }>({ dataType: () => "bytea" });
export const announcements = pgTable(
  "announcements",
  {
    id: uuid("id").primaryKey(),
    arenaId: uuid("arena_id")
      .notNull()
      .references(() => arenaInstances.id),
    scope: text("scope").notNull(),
    roundId: uuid("round_id").references(() => rounds.id),
    teamId: uuid("team_id").references(() => teams.id),
    actorId: uuid("actor_id").notNull(),
    sessionId: uuid("session_id").notNull(),
    credentialId: uuid("credential_id").notNull(),
    credentialVersion: bigint("credential_version", {
      mode: "bigint",
    }).notNull(),
    requestKey: uuid("request_key").notNull(),
    fingerprint: bytes("fingerprint").notNull(),
    message: text("message").notNull(),
    reason: text("reason").notNull(),
    outcome: text("outcome").notNull(),
    denialReason: text("denial_reason"),
    recordedAt: timestamp("recorded_at", {
      withTimezone: true,
      precision: 3,
    }).notNull(),
  },
  (t) => [
    foreignKey({
      name: "announcement_session",
      columns: [t.sessionId, t.actorId],
      foreignColumns: [staffSessions.id, staffSessions.staffId],
    }),
    foreignKey({
      name: "announcement_credential",
      columns: [t.credentialId, t.credentialVersion, t.actorId],
      foreignColumns: [
        accessCredentials.id,
        accessCredentials.version,
        accessCredentials.staffId,
      ],
    }),
    unique("announcement_intent").on(t.actorId, t.arenaId, t.requestKey),
    index("announcement_history").on(t.arenaId, t.recordedAt, t.id),
    check(
      "announcement_shape",
      sql`octet_length(${t.fingerprint})=32 and octet_length(${t.message}) between 1 and 4096 and length(btrim(${t.message}))>0
    and octet_length(${t.reason}) between 1 and 1024 and length(btrim(${t.reason}))>0
    and ((${t.scope}='EVENT' and num_nonnulls(${t.roundId},${t.teamId})=0)
      or (${t.scope}='ROUND' and ${t.roundId} is not null and ${t.teamId} is null)
      or (${t.scope}='TEAM' and ${t.teamId} is not null and ${t.roundId} is null))
    and ((${t.outcome}='APPLIED' and ${t.denialReason} is null) or (${t.outcome}='REJECTED' and ${t.denialReason} is not null and ${t.denialReason}='ARENA_CLOSED'))`,
    ),
  ],
);
