import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { AccessError } from "../access/transaction.js";
import type { ClockGuard } from "../access/transaction.js";
import type { ClockSource } from "./monitor.js";
import { assess, FRESHNESS, integer, parseReport, SECOND } from "./policy.js";
import type { ClockFault, ClockReport } from "./policy.js";

interface Health {
  runtime_id: string | null;
  boot_id: string | null;
  running: boolean;
  fault_latched: boolean;
  fault_generation: string;
  state: string;
  sequence: string;
  received_ns: string | null;
  report: ClockReport | null;
  healthy_count: number;
}
export function createWorkerClock(
  pool: Pool,
  source: Pick<ClockSource, "bootId" | "nowNs" | "resolutionNs">,
) {
  let binding: Health | undefined,
    previous: Health | undefined,
    trusted = false,
    count = 0;
  let since = 0n,
    lastReceipt = 0n,
    lastNow: bigint | undefined;
  let pending:
    | {
        runtime: string;
        generation: string;
        request: string;
        reason: ClockFault;
      }
    | undefined;
  const reset = () => {
    trusted = false;
    count = 0;
    previous = undefined;
  };
  function fault(reason: ClockFault) {
    reset();
    if (binding?.runtime_id && !binding.fault_latched)
      pending ??= {
        runtime: binding.runtime_id,
        generation: binding.fault_generation,
        request: randomUUID(),
        reason,
      };
  }
  function now() {
    let value: bigint;
    try {
      value = source.nowNs();
    } catch {
      fault("PROBE_FAILED");
      throw new AccessError("CLOCK_UNTRUSTED");
    }
    if (value < 0n || (lastNow !== undefined && value < lastNow)) {
      fault("MONOTONIC_REVERSED");
      throw new AccessError("CLOCK_UNTRUSTED");
    }
    lastNow = value;
    return value;
  }
  async function transaction<T>(
    exclusive: boolean,
    work: (client: PoolClient) => Promise<T>,
  ) {
    const client = await pool.connect();
    let destroy = false;
    const disconnected = () => {};
    client.on("error", disconnected);
    try {
      await client.query(
        "BEGIN; SET LOCAL lock_timeout='750ms'; SET LOCAL statement_timeout='2s'; SET LOCAL idle_in_transaction_session_timeout='3s'; SET LOCAL transaction_timeout='3s'",
      );
      if (
        (
          await client.query(
            `SELECT id FROM security_control WHERE id=1 FOR ${exclusive ? "UPDATE" : "SHARE"}`,
          )
        ).rowCount !== 1
      )
        throw new Error("Missing clock authority.");
      if (
        (await client.query("SELECT restore_is_quarantined() AS quarantined"))
          .rows[0]?.quarantined !== false
      )
        throw new AccessError("RESTORE_QUARANTINED");
      const result = await work(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {
        destroy = true;
      }
      throw error;
    } finally {
      client.removeListener("error", disconnected);
      client.release(destroy);
    }
  }
  async function flush() {
    const captured = pending;
    if (!captured) return;
    await transaction(true, async (client) => {
      await client.query("SELECT record_worker_clock_fault($1,$2,$3,$4)", [
        captured.runtime,
        captured.generation,
        captured.request,
        captured.reason,
      ]);
    });
    if (pending === captured) pending = undefined;
  }
  const healthy = (row: Health | undefined) =>
    row?.running &&
    !row.fault_latched &&
    row.healthy_count === 7 &&
    ["HEALTHY", "WARNING"].includes(row.state);
  const guard: ClockGuard = {
    fault,
    assertHealthy() {
      const current = now();
      if (
        trusted &&
        previous &&
        (current - lastReceipt + source.resolutionNs >= FRESHNESS ||
          current - integer(previous.received_ns) + source.resolutionNs >=
            FRESHNESS)
      )
        fault("STALE_REPORT");
      if (!trusted || pending) throw new AccessError("CLOCK_UNTRUSTED");
    },
    async verify(client) {
      guard.assertHealthy();
      const row = (
        await client.query<Health>(
          "SELECT * FROM clock_health WHERE id=1 FOR SHARE",
        )
      ).rows[0];
      guard.assertHealthy();
      if (
        !healthy(row) ||
        row?.runtime_id !== binding?.runtime_id ||
        row?.fault_generation !== binding?.fault_generation ||
        row?.boot_id !== source.bootId
      ) {
        reset();
        throw new AccessError("CLOCK_UNTRUSTED");
      }
      if (integer(row.sequence) < integer(previous!.sequence)) {
        fault("INVALID_REPORT");
        throw new AccessError("CLOCK_UNTRUSTED");
      }
      guard.assertHealthy();
    },
  };
  return {
    guard,
    flush,
    async pollOnce() {
      let reading = true;
      try {
        await flush();
        const row = await transaction(
          false,
          async (client) =>
            (
              await client.query<Health>(
                "SELECT * FROM clock_health WHERE id=1 FOR SHARE",
              )
            ).rows[0],
        );
        reading = false;
        if (!row || !healthy(row)) {
          reset();
          binding = row;
          return;
        }
        if (
          row.runtime_id !== binding?.runtime_id ||
          row.fault_generation !== binding?.fault_generation
        )
          reset();
        binding = row;
        const current = now();
        if (row.boot_id !== source.bootId || !row.report) {
          fault("INVALID_REPORT");
          throw new AccessError("CLOCK_UNTRUSTED");
        }
        const report = parseReport(
          row.report,
          source.bootId,
          row.report.nonce,
          integer(row.sequence),
        );
        const low = integer(report.boottime_before_ns),
          high = integer(report.boottime_after_ns),
          received = integer(row.received_ns);
        if (
          high > current + source.resolutionNs ||
          received > current + source.resolutionNs ||
          received + source.resolutionNs < high ||
          received - low > 2n * SECOND
        ) {
          fault("INVALID_REPORT");
          throw new AccessError("CLOCK_UNTRUSTED");
        }
        if (current - received + source.resolutionNs >= FRESHNESS) {
          fault("STALE_REPORT");
          throw new AccessError("CLOCK_UNTRUSTED");
        }
        if (previous && integer(row.sequence) <= integer(previous.sequence)) {
          if (
            row.sequence !== previous.sequence ||
            row.received_ns !== previous.received_ns ||
            JSON.stringify(row.report) !== JSON.stringify(previous.report)
          ) {
            fault("INVALID_REPORT");
            throw new AccessError("CLOCK_UNTRUSTED");
          }
          if (current - lastReceipt + source.resolutionNs >= FRESHNESS) {
            fault("STALE_REPORT");
            throw new AccessError("CLOCK_UNTRUSTED");
          }
          return;
        }
        const assessment = assess(
          report,
          previous?.report ?? undefined,
          low,
          high,
          0n,
        );
        if (assessment.fault) {
          fault(assessment.fault);
          throw new AccessError("CLOCK_UNTRUSTED");
        }
        if (!count || current - lastReceipt >= 5n * SECOND) {
          if (!count) since = current;
          count = Math.min(7, count + 1);
          lastReceipt = current;
        }
        previous = row;
        trusted = count === 7 && current - since >= 30n * SECOND;
      } catch (error) {
        if (
          error instanceof AccessError &&
          error.code === "RESTORE_QUARANTINED"
        )
          reset();
        if (!(error instanceof AccessError))
          fault(reading ? "DATABASE_UNAVAILABLE" : "INVALID_REPORT");
        throw error;
      }
    },
  };
}
