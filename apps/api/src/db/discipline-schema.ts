import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  customType,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import {
  accessBlocks,
  accessCredentials,
  arenaInstances,
  rounds,
  teamRounds,
} from "./access-schema.js";
import { staffSessions } from "./staff-schema.js";
import { teams, teamMembers } from "./schema.js";

const bytes = customType<{ data: Buffer }>({ dataType: () => "bytea" });
export const disciplineOutcomes = pgTable(
  "discipline_outcomes",
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
    arenaId: uuid("arena_id")
      .notNull()
      .references(() => arenaInstances.id),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id),
    memberId: uuid("member_id").references(() => teamMembers.id),
    roundId: uuid("round_id").references(() => rounds.id),
    teamRoundId: uuid("team_round_id").references(() => teamRounds.id),
    blockId: uuid("block_id").references(() => accessBlocks.id),
    originalId: uuid("original_id").references(
      (): AnyPgColumn => disciplineOutcomes.id,
    ),
    minutes: integer("minutes"),
    expectedRevision: bigint("expected_revision", { mode: "bigint" }).notNull(),
    fingerprint: bytes("fingerprint").notNull(),
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
      name: "discipline_session_actor",
      columns: [t.sessionId, t.actorId],
      foreignColumns: [staffSessions.id, staffSessions.staffId],
    }),
    foreignKey({
      name: "discipline_credential_actor",
      columns: [t.credentialId, t.credentialVersion, t.actorId],
      foreignColumns: [
        accessCredentials.id,
        accessCredentials.version,
        accessCredentials.staffId,
      ],
    }),
    foreignKey({
      name: "discipline_member_team",
      columns: [t.memberId, t.teamId],
      foreignColumns: [teamMembers.id, teamMembers.teamId],
    }),
    foreignKey({
      name: "discipline_round_arena",
      columns: [t.roundId, t.arenaId],
      foreignColumns: [rounds.id, rounds.arenaInstanceId],
    }),
    foreignKey({
      name: "discipline_team_round",
      columns: [t.teamRoundId, t.teamId, t.roundId],
      foreignColumns: [teamRounds.id, teamRounds.teamId, teamRounds.roundId],
    }),
    unique("discipline_intent").on(t.actorId, t.requestKey),
    index("discipline_team_history").on(
      t.arenaId,
      t.teamId,
      t.recordedAt,
      t.id,
    ),
    index("discipline_manual_total")
      .on(t.teamRoundId)
      .where(sql`${t.action}='PENALISE' and ${t.outcome}='APPLIED'`),
    uniqueIndex("discipline_reversal_once")
      .on(t.originalId)
      .where(sql`${t.outcome}='APPLIED'`),
    uniqueIndex("discipline_block_action_once")
      .on(t.blockId, t.action)
      .where(sql`${t.outcome}='APPLIED'`),
    check(
      "discipline_shape",
      sql`${t.expectedRevision}>=0 and octet_length(${t.fingerprint})=32 and octet_length(${t.reason}) between 1 and 1024 and btrim(${t.reason})<>''
    and ((${t.action} in ('BLOCK','UNBLOCK') and ${t.roundId} is null and ${t.teamRoundId} is null and ${t.originalId} is null and ${t.minutes} is null
      and (${t.action}='BLOCK' or ${t.blockId} is not null))
      or (${t.action} in ('PENALISE','REVERSE') and ${t.roundId} is not null and ${t.teamRoundId} is not null and ${t.memberId} is null and ${t.blockId} is null
        and ((${t.action}='PENALISE' and ${t.originalId} is null and ${t.minutes} is not null and ${t.minutes} between 1 and 300) or (${t.action}='REVERSE' and ${t.originalId} is not null and ${t.minutes} is null))))
    and ((${t.outcome}='APPLIED' and ${t.denialReason} is null and (${t.action}<>'BLOCK' or ${t.blockId} is not null))
      or (${t.outcome}='REJECTED' and ${t.denialReason} is not null and ${t.denialReason} in ('STALE_VERSION','ARENA_UNAVAILABLE','ROUND_UNAVAILABLE','ALREADY_BLOCKED','ALREADY_CLEARED','PENALTY_CAP','ALREADY_REVERSED')))`,
    ),
  ],
);
