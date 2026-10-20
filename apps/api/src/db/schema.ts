import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { check, integer, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

export const teams = pgTable("teams", {
  id: uuid("id").primaryKey().$defaultFn(randomUUID),
  displayName: text("display_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull()
    .default(sql`date_trunc('milliseconds', clock_timestamp())`),
}, (table) => [
  check("teams_display_name_bytes", sql`octet_length(${table.displayName}) between 1 and 120`),
  check("teams_display_name_nonblank", sql`length(btrim(${table.displayName})) > 0`),
]);

export const teamMembers = pgTable("team_members", {
  id: uuid("id").primaryKey().$defaultFn(randomUUID),
  teamId: uuid("team_id").notNull().references(() => teams.id, { onDelete: "restrict", onUpdate: "restrict" }),
  position: integer("position").$type<1 | 2>().notNull(),
  displayName: text("display_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull()
    .default(sql`date_trunc('milliseconds', clock_timestamp())`),
}, (table) => [
  check("team_members_position", sql`${table.position} in (1, 2)`),
  check("team_members_display_name_bytes", sql`octet_length(${table.displayName}) between 1 and 120`),
  check("team_members_display_name_nonblank", sql`length(btrim(${table.displayName})) > 0`),
  unique("team_members_team_position").on(table.teamId, table.position),
  unique("team_members_id_team").on(table.id, table.teamId),
]);
