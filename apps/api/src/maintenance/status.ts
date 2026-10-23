import type { Pool } from "pg";
import type { SessionDelivery } from "../access/credentials.js";
import type { ClockGuard } from "../access/transaction.js";
import {
  AccessError,
  accessTransaction,
  decisionTime,
} from "../access/transaction.js";
import { staffQuota } from "../access/quotas.js";
import { createStaffService } from "../access/staff-service.js";

export interface RetentionStatus {
  server_time: string;
  batches: {
    family: "SECRETS" | "PAYLOADS";
    last_completed_at: string | null;
    last_batch_count: number;
    total_purged: number;
  }[];
  physical_holds: number;
}
export function createRetentionStatus(
  pool: Pool,
  clock: ClockGuard,
  delivery: SessionDelivery,
) {
  const staff = createStaffService(pool, clock, delivery);
  return async (cookie: unknown): Promise<RetentionStatus> => {
    const initial = await staff.inspect(cookie);
    if (initial.role === "ORGANISER")
      throw new AccessError("ACCESS_UNAVAILABLE");
    await staffQuota(pool, clock, initial.staff_id, "READ_STAFF");
    return accessTransaction(
      pool,
      clock,
      async (client) => {
        const now = await decisionTime(client, clock),
          actor = await staff.authorize(client, cookie, now);
        if (actor.role === "ORGANISER")
          throw new AccessError("ACCESS_UNAVAILABLE");
        const batches = (
          await client.query<{
            family: "SECRETS" | "PAYLOADS";
            last_completed_at: Date | null;
            last_batch_count: number;
            total_purged: string;
          }>(
            "SELECT family,last_completed_at,last_batch_count,total_purged FROM retention_progress ORDER BY family",
          )
        ).rows;
        if (
          batches.length !== 2 ||
          batches.some((b) => b.last_completed_at && b.last_completed_at > now)
        )
          throw new AccessError("SECURITY_UNAVAILABLE");
        const holds = (
          await client.query<{ n: number }>(
            "SELECT count(*)::integer n FROM execution_capacity_slots WHERE num_nonnulls(authoring_attempt_id,participant_attempt_id)>0",
          )
        ).rows[0]!.n;
        return {
          server_time: now.toISOString(),
          batches: batches.map((b) => ({
            ...b,
            total_purged: Number(b.total_purged),
            last_completed_at: b.last_completed_at?.toISOString() ?? null,
          })),
          physical_holds: holds,
        };
      },
      "SHARED",
    );
  };
}
