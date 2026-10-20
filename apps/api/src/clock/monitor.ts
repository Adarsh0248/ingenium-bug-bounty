import { randomBytes, randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { AccessError } from "../access/transaction.js";
import type { ClockGuard } from "../access/transaction.js";
import { assess, FRESHNESS, parseReport, SECOND } from "./policy.js";
import type { ClockFault, ClockReport } from "./policy.js";

export interface ClockSource {
  bootId: string; resolutionNs: bigint; nowNs(): bigint;
  sample(nonce: string, sequence: bigint): Promise<unknown>;
}
interface Health {
  runtime_id: string | null; running: boolean; fault_latched: boolean; fault_generation: string; fault_reason: ClockFault | null;
  sequence: string; healthy_count: number; healthy_since_ns: string | null; healthy_last_ns: string | null; state: string;
}

export function createClockMonitor(pool: Pool, source: ClockSource) {
  const runtimeId = randomUUID();
  let started = false, stopped = false, stopping = false, latched = false, trusted = false;
  let restored = false;
  let sequence = 0n, received: bigint | undefined, previousNow: bigint | undefined, previous: ClockReport | undefined;
  let pendingFault: { reason: ClockFault; id: string } | undefined;
  let resetPending = false, streakPresent = false;
  let serial = Promise.resolve();

  function enqueue<T>(work: () => Promise<T>): Promise<T> {
    const result = serial.then(work);
    serial = result.then(() => {}, () => {});
    return result;
  }
  async function transaction<T>(work: (client: PoolClient, state: Health) => Promise<T>) {
    const client = await pool.connect();
    const disconnected = () => {};
    client.on("error", disconnected);
    let destroy = false;
    try {
      await client.query("BEGIN; SET LOCAL lock_timeout='750ms'; SET LOCAL statement_timeout='2s'; SET LOCAL idle_in_transaction_session_timeout='3s'; SET LOCAL transaction_timeout='3s'");
      if ((await client.query("SELECT id FROM security_control WHERE id=1 FOR UPDATE")).rowCount !== 1) throw new Error("Missing security anchor.");
      const state = (await client.query<Health>("SELECT * FROM clock_health WHERE id=1 FOR UPDATE")).rows[0];
      if (!state) throw new Error("Missing clock anchor.");
      const result = await work(client, state);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      try { await client.query("ROLLBACK"); } catch { destroy = true; }
      throw error;
    } finally { client.removeListener("error", disconnected); client.release(destroy); }
  }
  async function event(client: PoolClient, kind: string, generation: string, reason: ClockFault | null, evidence: object, id: string = randomUUID()) {
    if ((await client.query("SELECT count(*)::integer AS count FROM clock_events")).rows[0].count >= 100000) throw new Error("Clock audit capacity unavailable.");
    await client.query(`INSERT INTO clock_events(id,runtime_id,generation,kind,reason,observed_at,evidence)
      VALUES($1,$2,$3,$4,$5,date_trunc('milliseconds',clock_timestamp()),$6) ON CONFLICT (id) DO NOTHING`, [id, runtimeId, generation, kind, reason, JSON.stringify(evidence)]);
  }
  function fault(reason: ClockFault) {
    trusted = false; restored = false;
    if (latched && !streakPresent) return;
    streakPresent = false;
    resetPending = true;
    pendingFault ??= { reason, id: randomUUID() };
    latched = true;
    if (started && !stopped) void enqueue(persistFault).catch(() => {});
  }
  function now() {
    let value: bigint;
    try { value = source.nowNs(); } catch { fault("PROBE_FAILED"); throw new AccessError("CLOCK_UNTRUSTED"); }
    if (value < 0n || (previousNow !== undefined && value < previousNow)) {
      fault("MONOTONIC_REVERSED"); throw new AccessError("CLOCK_UNTRUSTED");
    }
    previousNow = value;
    return value;
  }
  function freshness() {
    const current = now();
    if (received !== undefined && current - received + source.resolutionNs >= FRESHNESS) fault("STALE_REPORT");
  }
  async function writeFault(client: PoolClient, state: Health) {
    const pending = pendingFault;
    if (state.runtime_id !== runtimeId || !state.running) throw new Error("Clock runtime changed.");
    if (!state.fault_latched && pending) {
      state.fault_generation = (BigInt(state.fault_generation) + 1n).toString();
      await client.query("UPDATE clock_health SET fault_latched=true,fault_generation=$1,fault_reason=$2,state='FAULT',healthy_count=0,healthy_since_ns=NULL,healthy_last_ns=NULL WHERE id=1", [state.fault_generation, pending.reason]);
      await event(client, "FAULT", state.fault_generation, pending.reason, { policy: 1, sequence: sequence.toString() }, pending.id);
    } else if (state.fault_latched && resetPending) {
      await client.query("UPDATE clock_health SET state='FAULT',healthy_count=0,healthy_since_ns=NULL,healthy_last_ns=NULL WHERE id=1");
    }
    return pending;
  }
  function acknowledged(pending: typeof pendingFault) {
    if (pendingFault === pending) pendingFault = undefined;
    resetPending = false;
  }
  async function persistFault() {
    if (!pendingFault && !resetPending) return;
    acknowledged(await transaction(writeFault));
  }

  const guard: ClockGuard = {
    assertHealthy() {
      if (!started || stopped || stopping) throw new AccessError("CLOCK_UNTRUSTED");
      freshness();
      if (latched || !trusted) throw new AccessError("CLOCK_UNTRUSTED");
    },
    async verify(client) {
      guard.assertHealthy();
      const state = (await client.query<{ runtime_id: string; fault_latched: boolean; running: boolean; state: string }>("SELECT runtime_id,fault_latched,running,state FROM clock_health WHERE id=1 FOR SHARE")).rows[0];
      if (!state || state.runtime_id !== runtimeId || !state.running || state.fault_latched || !["HEALTHY", "WARNING"].includes(state.state)) {
        fault("RUNTIME_REPLACED"); throw new AccessError("CLOCK_UNTRUSTED");
      }
    },
    fault,
  };

  // Restored measurements permit only the separately authorised recovery routes.
  const recoveryGuard: ClockGuard = {
    assertHealthy() {
      if (!started || stopped || stopping) throw new AccessError("CLOCK_UNTRUSTED");
      freshness();
      if (!restored || pendingFault || resetPending) throw new AccessError("CLOCK_UNTRUSTED");
    },
    async verify(client) {
      recoveryGuard.assertHealthy();
      const state = (await client.query<Health>("SELECT * FROM clock_health WHERE id=1 FOR SHARE")).rows[0];
      if (!state || state.runtime_id !== runtimeId || !state.running || state.healthy_count !== 7
          || BigInt(state.healthy_last_ns!)-BigInt(state.healthy_since_ns!) < 30n*SECOND) throw new AccessError("CLOCK_UNTRUSTED");
    }, fault,
  };

  return {
    guard, recoveryGuard, runtimeId,
    async start() {
      await enqueue(async () => {
        if (started || stopped) throw new Error("Clock monitor already used.");
        now();
        const state = await transaction(async (client, old) => {
          if ((await client.query("SELECT count(*)::integer AS count FROM clock_runs")).rows[0].count >= 10000) throw new Error("Clock runtime capacity unavailable.");
          const unclean = old.running && !old.fault_latched;
          const generation = (BigInt(old.fault_generation) + (unclean ? 1n : 0n)).toString();
          const reason = old.fault_reason ?? (unclean ? "UNCLEAN_RESTART" : null);
          await client.query("INSERT INTO clock_runs(id,boot_id,started_observed_at) VALUES($1,$2,date_trunc('milliseconds',clock_timestamp()))", [runtimeId, source.bootId]);
          await client.query(`UPDATE clock_health SET runtime_id=$1,boot_id=$2,running=true,fault_latched=$3,fault_generation=$4,fault_reason=$5,
            sequence=0,received_ns=NULL,report=NULL,healthy_count=0,healthy_since_ns=NULL,healthy_last_ns=NULL,state=$6 WHERE id=1`,
          [runtimeId, source.bootId, old.fault_latched || unclean, generation, reason, reason ? "FAULT" : "STARTING"]);
          await event(client, "STARTED", generation, null, { policy: 1, boot_id: source.bootId });
          if (unclean) await event(client, "FAULT", generation, "UNCLEAN_RESTART", { policy: 1 });
          return { latched: old.fault_latched || unclean };
        });
        latched = state.latched; started = true;
      });
    },
    async pollOnce() {
      await enqueue(async () => {
        if (!started || stopped) throw new Error("Clock monitor is not running.");
        try {
          freshness();
          await persistFault();
          const begin = now(), nonce = randomBytes(32).toString("base64url");
          sequence++;
          let report: ClockReport;
          let finish: bigint;
          try {
            const value = await source.sample(nonce, sequence);
            finish = now();
            report = parseReport(value, source.bootId, nonce, sequence);
          } catch {
            fault("PROBE_FAILED"); await persistFault(); return;
          }
          const result = assess(report, previous, begin, finish, source.resolutionNs);
          if (result.fault) fault(result.fault);
          await persistFault();
          const recorded = await transaction(async (client, state) => {
            if (state.runtime_id !== runtimeId || !state.running) throw new Error("Clock runtime changed.");
            let count = result.fault ? 0 : state.healthy_count;
            let since = count ? BigInt(state.healthy_since_ns!) : finish;
            let last = count ? BigInt(state.healthy_last_ns!) : finish;
            if (!result.fault && (!count || finish-last >= 5n*SECOND)) { count = Math.min(7, count+1); last = finish; }
            if (result.fault) { since = 0n; last = 0n; }
            const established = count === 7 && finish-since >= 30n*SECOND;
            const status = state.fault_latched ? "FAULT" : established ? result.warning ? "WARNING" : "HEALTHY" : "STARTING";
            await client.query(`UPDATE clock_health SET sequence=$1,received_ns=$2,report=$3,healthy_count=$4,healthy_since_ns=$5,healthy_last_ns=$6,state=$7 WHERE id=1`,
              [sequence.toString(), finish.toString(), JSON.stringify(report), count, count ? since.toString() : null, count ? last.toString() : null, status]);
            if (established && !state.fault_latched && !["HEALTHY", "WARNING"].includes(state.state)) await event(client, "TRUST_ESTABLISHED", state.fault_generation, null, { policy: 1, sequence: sequence.toString() });
            return { ready: established && !state.fault_latched, restored: established, latched: state.fault_latched, streak: count > 0 };
          });
          previous = report; received = finish;
          streakPresent = recorded.streak;
          latched = recorded.latched || Boolean(pendingFault || resetPending);
          restored = recorded.restored && !pendingFault && !resetPending;
          trusted = recorded.ready && !latched;
          freshness();
        } catch {
          fault("DATABASE_UNAVAILABLE");
          await persistFault().catch(() => {});
        }
      });
    },
    async flush() { await enqueue(persistFault); },
    async stop() {
      stopping = true;
      await enqueue(async () => {
        if (!started || stopped) return;
        trusted = false;
        await persistFault();
        const pending = await transaction(async (client, state) => {
          if (state.runtime_id !== runtimeId || !state.running) throw new Error("Clock runtime changed.");
          const captured = await writeFault(client, state);
          await client.query("UPDATE clock_health SET running=false,state='STOPPED' WHERE id=1");
          await client.query("UPDATE clock_runs SET stopped_observed_at=date_trunc('milliseconds',clock_timestamp()) WHERE id=$1", [runtimeId]);
          await event(client, "STOPPED", state.fault_generation, null, { policy: 1 });
          return captured;
        });
        acknowledged(pending);
        stopped = true;
      });
    },
  };
}
