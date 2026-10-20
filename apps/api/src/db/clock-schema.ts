import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { bigint, boolean, check, foreignKey, integer, jsonb, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

const instant = (name: string) => timestamp(name, { withTimezone: true, precision: 3 });
const counter = (name: string) => bigint(name, { mode: "bigint" }).notNull().default(sql`0`);

export const clockRuns = pgTable("clock_runs", {
  id: uuid("id").primaryKey().$defaultFn(randomUUID), bootId: uuid("boot_id").notNull(),
  startedObservedAt: instant("started_observed_at").notNull(), stoppedObservedAt: instant("stopped_observed_at"),
}, (t) => [unique("clock_run_boot").on(t.id, t.bootId)]);

export const clockHealth = pgTable("clock_health", {
  id: integer("id").primaryKey(), runtimeId: uuid("runtime_id"), bootId: uuid("boot_id"), running: boolean("running").notNull().default(false),
  faultLatched: boolean("fault_latched").notNull().default(false), faultGeneration: counter("fault_generation"), faultReason: text("fault_reason"),
  sequence: counter("sequence"), receivedNs: bigint("received_ns", { mode: "bigint" }), report: jsonb("report"),
  healthyCount: integer("healthy_count").notNull().default(0), healthySinceNs: bigint("healthy_since_ns", { mode: "bigint" }),
  healthyLastNs: bigint("healthy_last_ns", { mode: "bigint" }), state: text("state").notNull().default("STOPPED"),
}, (t) => [foreignKey({ name: "clock_health_run", columns: [t.runtimeId, t.bootId], foreignColumns: [clockRuns.id, clockRuns.bootId] }).onDelete("restrict"),
  check("clock_health_shape", sql`${t.id}=1 and ${t.faultGeneration}>=0 and ${t.sequence}>=0 and ${t.healthyCount} between 0 and 7
    and ${t.state} in ('STOPPED','STARTING','HEALTHY','WARNING','FAULT')
    and ((${t.runtimeId} is null and ${t.bootId} is null and not ${t.running}) or (${t.runtimeId} is not null and ${t.bootId} is not null))
    and ((${t.faultLatched} and ${t.faultReason} is not null and ${t.faultGeneration}>0) or (not ${t.faultLatched} and ${t.faultReason} is null))
    and ((${t.healthyCount}=0 and ${t.healthySinceNs} is null and ${t.healthyLastNs} is null)
      or (${t.healthyCount}>0 and ${t.healthySinceNs} is not null and ${t.healthySinceNs}>=0 and ${t.healthyLastNs} is not null and ${t.healthyLastNs}>=${t.healthySinceNs}))
    and (${t.state} not in ('HEALTHY','WARNING') or (not ${t.faultLatched} and ${t.running} and ${t.healthyCount}=7 and ${t.receivedNs} is not null and ${t.report} is not null))
    and (${t.receivedNs} is null or ${t.receivedNs}>=0)
    and (${t.report} is null or (jsonb_typeof(${t.report})='object' and octet_length(${t.report}::text)<=4096))`)]);

export const clockEvents = pgTable("clock_events", {
  id: uuid("id").primaryKey().$defaultFn(randomUUID), runtimeId: uuid("runtime_id").notNull().references(() => clockRuns.id, { onDelete: "restrict" }),
  generation: counter("generation"), kind: text("kind").notNull(), reason: text("reason"),
  observedAt: instant("observed_at").notNull(), evidence: jsonb("evidence").notNull(),
}, (t) => [check("clock_event_shape", sql`${t.generation}>=0 and ${t.kind} in ('STARTED','FAULT','TRUST_ESTABLISHED','STOPPED')
    and ((${t.kind}='FAULT' and ${t.reason} is not null) or (${t.kind}<>'FAULT' and ${t.reason} is null))
    and jsonb_typeof(${t.evidence})='object' and octet_length(${t.evidence}::text)<=4096`)]);
