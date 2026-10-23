import { sql } from "drizzle-orm";
import {
  check,
  customType,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

const bytes = customType<{ data: Buffer }>({ dataType: () => "bytea" });
export const restoreQuarantine = pgTable(
  "restore_quarantine",
  {
    id: integer("id").primaryKey(),
    requestKey: uuid("request_key").notNull().unique(),
    fingerprint: bytes("fingerprint").notNull(),
    backupRef: text("backup_ref").notNull(),
    operator: text("operator").notNull(),
    osUser: text("os_user").notNull(),
    reason: text("reason").notNull(),
    observedAt: timestamp("observed_at", {
      withTimezone: true,
      precision: 3,
    }).notNull(),
    effects: jsonb("effects").notNull(),
  },
  (t) => [
    check(
      "restore_quarantine_shape",
      sql`${t.id}=1 and octet_length(${t.fingerprint})=32
  and octet_length(${t.backupRef}) between 1 and 256 and length(btrim(${t.backupRef}))>0
  and octet_length(${t.operator}) between 1 and 120 and length(btrim(${t.operator}))>0
  and octet_length(${t.osUser}) between 1 and 120 and length(btrim(${t.osUser}))>0
  and octet_length(${t.reason}) between 1 and 1024 and length(btrim(${t.reason}))>0
  and jsonb_typeof(${t.effects})='object' and octet_length(${t.effects}::text) between 1 and 4096`,
    ),
  ],
);
