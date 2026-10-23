import type { Pool } from "pg";
import type { ClockGuard } from "../access/transaction.js";
import type { SessionDelivery } from "../access/credentials.js";
import {
  AccessError,
  accessTransaction,
  decisionTime,
} from "../access/transaction.js";
import { staffQuota } from "../access/quotas.js";
import { createStaffService } from "../access/staff-service.js";

export type ObservationState = "OK" | "WARNING" | "CRITICAL" | "UNKNOWN";
export interface OperationsStatus {
  observed_at: string;
  state: ObservationState;
  quarantined: boolean;
  clock_state: string;
  metrics: {
    id: string;
    value: string | null;
    unit: "bytes" | "count" | "ms";
    limit: string | null;
    state: ObservationState;
  }[];
  unverified: string[];
}
const UNKNOWN = [
  "HOST_CPU_MEMORY_DISK",
  "BACKUP_WAL_CHAIN",
  "JUDGE_HOST_READINESS",
  "FULL_APP_STORAGE",
  "EXTERNAL_UPTIME_ALERTING",
];
const number = (v: unknown): bigint => {
  if (typeof v !== "string" || !/^(0|[1-9][0-9]{0,18})$/.test(v))
    throw new Error("Invalid operational observation.");
  return BigInt(v);
};
export function operationsStatus(value: unknown): OperationsStatus {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Missing operational observation.");
  const v = value as Record<string, unknown>;
  if (
    typeof v.observed_at !== "string" ||
    !Number.isFinite(Date.parse(v.observed_at)) ||
    typeof v.quarantined !== "boolean" ||
    typeof v.clock_fault !== "boolean" ||
    typeof v.clock_running !== "boolean" ||
    !["STOPPED", "STARTING", "HEALTHY", "WARNING", "FAULT"].includes(
      v.clock_state as string,
    )
  )
    throw new Error("Invalid operational observation.");
  const metrics: OperationsStatus["metrics"] = [];
  function metric(
    id: string,
    raw: unknown,
    unit: "bytes" | "count" | "ms",
    limit: bigint | null = null,
    warning?: bigint,
    critical?: bigint,
  ) {
    const n = raw === null ? null : number(raw);
    metrics.push({
      id,
      value: n?.toString() ?? null,
      unit,
      limit: limit?.toString() ?? null,
      state:
        n === null
          ? "UNKNOWN"
          : critical !== undefined && n >= critical
            ? "CRITICAL"
            : warning !== undefined && n >= warning
              ? "WARNING"
              : "OK",
    });
  }
  metric("DATABASE_BYTES", v.database_bytes, "bytes");
  const connections = number(v.connection_limit);
  if (connections < 1n) throw new Error("Invalid connection capacity.");
  metric(
    "DATABASE_CONNECTIONS",
    v.connections,
    "count",
    connections,
    (connections * 70n) / 100n,
  );
  metric("WAITING_LOCKS", v.waiting_locks, "count", null, 1n);
  metric("OFFICIAL_PENDING", v.official_pending, "count");
  metric("SAMPLE_PENDING", v.sample_pending, "count");
  metric("OLDEST_OFFICIAL", v.official_age_ms, "ms", null, 300000n);
  metric("VALIDATION_PENDING", v.validation_pending, "count");
  metric("PHYSICAL_HOLDS", v.physical_holds, "count", number(v.physical_slots));
  metric("QUARANTINED_EPOCHS", v.quarantined_epochs, "count", null, 1n);
  // Existing delivery counters charge each reserved row at the full 16 KiB ceiling.
  const live = number(v.outbox_rows) + number(v.outbox_reserved),
    liveLimit = 262144n;
  metric(
    "OUTBOX_ACCOUNTED_ROWS",
    live.toString(),
    "count",
    liveLimit,
    (liveLimit * 75n) / 100n,
    (liveLimit * 90n) / 100n,
  );
  metric("OUTBOX_UNPUBLISHED", v.outbox_unpublished, "count");
  metric("OUTBOX_AGE", v.outbox_age_ms, "ms", null, 2001n);
  const participantLimit = 31138512896n;
  metric(
    "PARTICIPANT_ACCOUNTED_BYTES",
    v.participant_accounted_bytes,
    "bytes",
    participantLimit,
    (participantLimit * 75n) / 100n,
    (participantLimit * 90n) / 100n,
  );
  metric("QUOTA_KEYS", v.quota_keys, "count", 100000n, 75000n, 90000n);
  metric("RETENTION_AGE", v.retention_age_ms, "ms", null, 180001n);
  const critical =
    v.quarantined ||
    v.clock_fault ||
    metrics.some((m) => m.state === "CRITICAL");
  const warning =
    !v.clock_running ||
    v.clock_state !== "HEALTHY" ||
    metrics.some((m) => m.state === "WARNING");
  return {
    observed_at: v.observed_at,
    state: critical ? "CRITICAL" : warning ? "WARNING" : "UNKNOWN",
    quarantined: v.quarantined,
    clock_state: v.clock_state as string,
    metrics,
    unverified: [...UNKNOWN],
  };
}
export async function readOperations(pool: Pool) {
  const row = (
    await pool.query("SELECT operations_observation() AS observation")
  ).rows[0];
  return operationsStatus(row?.observation);
}
export function createOperationsStatus(
  pool: Pool,
  clock: ClockGuard,
  delivery: SessionDelivery,
) {
  const staff = createStaffService(pool, clock, delivery);
  return async (cookie: unknown) => {
    const initial = await staff.inspect(cookie);
    if (initial.role === "ORGANISER")
      throw new AccessError("ACCESS_UNAVAILABLE");
    await staffQuota(pool, clock, initial.staff_id, "READ_STAFF");
    return accessTransaction(
      pool,
      clock,
      async (client) => {
        const actor = await staff.authorize(
          client,
          cookie,
          await decisionTime(client, clock),
        );
        if (actor.role === "ORGANISER")
          throw new AccessError("ACCESS_UNAVAILABLE");
        return operationsStatus(
          (await client.query("SELECT operations_observation() AS observation"))
            .rows[0]?.observation,
        );
      },
      "SHARED",
    );
  };
}
