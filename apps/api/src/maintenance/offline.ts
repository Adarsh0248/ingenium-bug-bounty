import type { Pool } from "pg";
import type { ClockGuard } from "../access/transaction.js";
import { AccessError, decisionTime } from "../access/transaction.js";
import { judgeTransaction } from "../content/judge-transaction.js";

export function maintenanceConfig(value: unknown) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).sort().join() !== "database_url,schema_version"
  )
    throw new Error("Invalid maintenance runtime.");
  const v = value as Record<string, unknown>;
  if (v.schema_version !== 1 || typeof v.database_url !== "string")
    throw new Error("Invalid maintenance runtime.");
  const url = new URL(v.database_url);
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !["127.0.0.1", "[::1]", "localhost"].includes(url.hostname) ||
    url.username !== "ingenium_api" ||
    !url.password ||
    url.pathname.length < 2 ||
    url.search ||
    url.hash
  )
    throw new Error("Restricted local API-role connection required.");
  return v.database_url;
}
export async function offlineRetention(
  pool: Pool,
  clock: ClockGuard,
  limit: number,
  signal: AbortSignal,
) {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100)
    throw new Error("Maintenance batch limit must be between 1 and 100.");
  let batches = 0,
    purged = 0,
    empty = false;
  for (; batches < limit && !signal.aborted && !empty; batches++) {
    const count = await judgeTransaction(pool, clock, async (client) => {
      await client.query("SELECT * FROM lock_arena_control(true)");
      await decisionTime(client, clock);
      const state = (
        await client.query(`SELECT current_user='ingenium_api' AS restricted,
        EXISTS(SELECT 1 FROM arena_instances WHERE status IN ('SETUP','IN_PROGRESS')) OR EXISTS(SELECT 1 FROM arena_control WHERE current_instance_id IS NOT NULL)
        OR EXISTS(SELECT 1 FROM execution_capacity_slots WHERE num_nonnulls(authoring_attempt_id,participant_attempt_id)>0)
        OR EXISTS(SELECT 1 FROM participant_judging WHERE status NOT IN ('COMPLETED','CANCELLED'))
        OR EXISTS(SELECT 1 FROM validation_runs WHERE status IN ('QUEUED','RUNNING')) AS busy`)
      ).rows[0];
      if (!state.restricted || state.busy)
        throw new AccessError("MAINTENANCE_UNAVAILABLE");
      return (
        (
          await client.query<{ n: number }>(
            "SELECT maintain_payload_retention('SECRETS') n",
          )
        ).rows[0]!.n +
        (
          await client.query<{ n: number }>(
            "SELECT maintain_payload_retention('PAYLOADS') n",
          )
        ).rows[0]!.n
      );
    });
    purged += count;
    empty = count === 0;
  }
  return { batches, purged, empty, interrupted: signal.aborted };
}
