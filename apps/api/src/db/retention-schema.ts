import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const payloadPurges = pgTable(
  "payload_purges",
  {
    kind: text("kind").notNull(),
    targetId: uuid("target_id").notNull(),
    manifest: jsonb("manifest").notNull(),
    recordedAt: timestamp("recorded_at", {
      withTimezone: true,
      precision: 3,
    }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.kind, t.targetId] }),
    check(
      "payload_purge_shape",
      sql`${t.kind} in ('entry_flows','staff_entry_flows','participant_sessions','staff_sessions','code_drafts','participant_judging','competition_submissions','participant_attempts','authoring_attempts')
    and jsonb_typeof(${t.manifest})='object' and octet_length(${t.manifest}::text) between 1 and 2048`,
    ),
  ],
);

export const retentionProgress = pgTable(
  "retention_progress",
  {
    family: text("family").primaryKey(),
    lastCompletedAt: timestamp("last_completed_at", {
      withTimezone: true,
      precision: 3,
    }),
    lastBatchCount: integer("last_batch_count").notNull().default(0),
    totalPurged: bigint("total_purged", { mode: "bigint" })
      .notNull()
      .default(sql`0`),
  },
  (t) => [
    check(
      "retention_progress_shape",
      sql`${t.family} in ('SECRETS','PAYLOADS') and ${t.lastBatchCount} between 0 and 40 and ${t.totalPurged} between 0 and 8000000
  and (${t.lastCompletedAt} is not null or (${t.lastBatchCount}=0 and ${t.totalPurged}=0))`,
    ),
  ],
);
