import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  pgTable,
  text,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { arenaInstances, rounds } from "./access-schema.js";
import { competitionOutcomes } from "./competition-schema.js";

export const roundCancellations = pgTable(
  "round_cancellations",
  {
    id: uuid("id").primaryKey(),
    arenaId: uuid("arena_id")
      .notNull()
      .references(() => arenaInstances.id),
    roundId: uuid("round_id")
      .notNull()
      .references(() => rounds.id),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => competitionOutcomes.id),
    incidentRef: text("incident_ref").notNull(),
  },
  (t) => [
    unique("cancellation_round_once").on(t.roundId),
    unique("cancellation_start_once").on(t.sourceId),
    foreignKey({
      name: "cancellation_round_arena",
      columns: [t.roundId, t.arenaId],
      foreignColumns: [rounds.id, rounds.arenaInstanceId],
    }),
    check(
      "cancellation_incident",
      sql`${t.incidentRef} ~ '^[A-Za-z0-9][A-Za-z0-9._/-]{0,119}$'`,
    ),
  ],
);
export const cancellationFinishes = pgTable(
  "cancellation_finishes",
  {
    cancellationId: uuid("cancellation_id")
      .primaryKey()
      .references(() => roundCancellations.id),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => competitionOutcomes.id),
  },
  (t) => [unique("cancellation_finish_once").on(t.sourceId)],
);
