import type { Pool, PoolClient, QueryResultRow } from "pg";
import type { ClockFault } from "../clock/policy.js";

export class AccessError extends Error {
  constructor(public readonly code: string, public readonly retryAfterSeconds?: number) {
    super(code);
    this.name = "AccessError";
  }
}

export interface ClockGuard { assertHealthy(): void; verify(client: PoolClient): Promise<void>; fault(reason: ClockFault): void; }

export async function decisionTime(client: PoolClient, clock: ClockGuard, rounds: string[] = []): Promise<Date> {
  clock.assertHealthy();
  const result = await client.query<{ now: Date }>("SELECT date_trunc('milliseconds', clock_timestamp()) AS now");
  clock.assertHealthy();
  const now = result.rows[0]?.now;
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) { clock.fault("CLOCK_REVERSED"); throw new AccessError("CLOCK_UNTRUSTED"); }
  if (rounds.length) {
    const rows = await client.query<{ trusted_time_at: Date | null }>("SELECT trusted_time_at FROM rounds WHERE id=ANY($1::uuid[])", [rounds]);
    if (rows.rows.some((row) => row.trusted_time_at && now < row.trusted_time_at)) { clock.fault("CLOCK_REVERSED"); throw new AccessError("CLOCK_UNTRUSTED"); }
  }
  return now;
}

export async function advanceRoundTime(client: PoolClient, rounds: string[], now: Date): Promise<void> {
  if (rounds.length) await client.query("UPDATE rounds SET trusted_time_at=$2 WHERE id=ANY($1::uuid[])", [[...new Set(rounds)].sort(), now]);
}

export async function accessTransaction<T>(pool: Pool, clock: ClockGuard, work: (client: PoolClient) => Promise<T>, security: "EXCLUSIVE" | "SHARED" | "QUOTA"): Promise<T> {
  clock.assertHealthy();
  const client = await pool.connect();
  const ignoreDisconnectedClient = () => {};
  client.on("error", ignoreDisconnectedClient);
  let destroy = false;
  try {
    await client.query("BEGIN; SET LOCAL lock_timeout = '750ms'; SET LOCAL statement_timeout = '2s'; SET LOCAL idle_in_transaction_session_timeout = '3s'; SET LOCAL transaction_timeout = '3s'");
    if (security !== "QUOTA") {
      const result = await client.query(`SELECT id FROM security_control WHERE id = 1 FOR ${security === "EXCLUSIVE" ? "UPDATE" : "SHARE"}`);
      if (result.rowCount !== 1) throw new AccessError("SECURITY_UNAVAILABLE");
    }
    await clock.verify(client);
    const value = await work(client);
    clock.assertHealthy();
    await client.query("COMMIT");
    return value;
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch { destroy = true; }
    throw error;
  } finally {
    client.removeListener("error", ignoreDisconnectedClient);
    client.release(destroy);
  }
}

export async function first<Row extends QueryResultRow>(client: PoolClient, text: string, values: unknown[] = []): Promise<Row | undefined> {
  return (await client.query<Row>(text, values)).rows[0];
}
