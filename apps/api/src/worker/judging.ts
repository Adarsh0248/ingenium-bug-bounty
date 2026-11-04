import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import type { Pool } from "pg";
import type { ClockGuard } from "../access/transaction.js";
import { createValidationWorker } from "../content/validation-worker.js";
import { createParticipantJudgeWorker } from "../competition/judging-worker.js";
import type { TrustedAuthoringDriver } from "../content/execution-policy.js";
import { maintenanceLoop } from "../maintenance/loop.js";

export async function assertWorkerDatabase(pool: Pool) {
  const role = (
    await pool.query<{
      allowed: boolean;
    }>(`SELECT NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication AND NOT rolbypassrls
    AND current_user<>'ingenium_api' AND NOT has_schema_privilege(current_user,'public','CREATE')
    AND NOT pg_has_role(current_user,'ingenium_api','MEMBER') AND pg_has_role(current_user,'ingenium_app_worker','MEMBER')
    AND NOT has_table_privilege(current_user,'access_credentials','SELECT') AS allowed
    FROM pg_roles WHERE rolname=current_user`)
  ).rows[0];
  if (!role?.allowed)
    throw new Error("Separate restricted worker credentials required.");
}

export function createJudgingCoordinator(
  pool: Pool,
  clock: ClockGuard,
  driver: TrustedAuthoringDriver,
) {
  let claimReadiness: Promise<void> | undefined;
  let claimReadinessAt = -Infinity;
  const claimDriver: TrustedAuthoringDriver = {
    ...driver,
    async assertReady(signal) {
      signal.throwIfAborted();
      // All four lanes renew the same worker lease in this one claim batch.
      if (!claimReadiness || performance.now() - claimReadinessAt >= 5000) {
        claimReadinessAt = performance.now();
        claimReadiness = driver.assertReady(signal);
      }
      await claimReadiness;
      signal.throwIfAborted();
    },
  };
  const workerId = randomUUID(),
    validation = Array.from({ length: 2 }, () => createValidationWorker(pool, clock, claimDriver, workerId)),
    participants = Array.from({ length: 2 }, () =>
      createParticipantJudgeWorker(pool, clock, claimDriver, workerId),
    );
  let busy = false,
    stopping = false,
    readyAt = -Infinity;
  return {
    workerId,
    stop() {
      stopping = true;
    },
    async tick() {
      if (stopping) return "STOPPED" as const;
      if (busy) return "BUSY" as const;
      busy = true;
      try {
        clock.assertHealthy();
        if (performance.now() - readyAt >= 5000) {
          try {
            for (const validator of validation)
              if (!(await validator.claim()) || stopping) return "STANDBY" as const;
            for (const participant of participants)
              if (!(await participant.claim()) || stopping)
                return "STANDBY" as const;
            readyAt = claimReadinessAt;
          } finally {
            claimReadiness = undefined;
            claimReadinessAt = -Infinity;
          }
        }
        if (stopping) return "STOPPED" as const;
        const validations = await Promise.allSettled(validation.map(validator => validator.tick()));
        for (const turn of validations)
          if (turn.status === "rejected") throw turn.reason;
        if (stopping) return "STOPPED" as const;
        // Finish both original requests before renewal, shutdown or another turn.
        const turns = await Promise.allSettled(
          participants.map((participant) => participant.tick()),
        );
        for (const turn of turns)
          if (turn.status === "rejected") throw turn.reason;
        return "TICKED" as const;
      } catch (error) {
        readyAt = -Infinity;
        throw error;
      } finally {
        busy = false;
      }
    },
  };
}
export function startJudgingWorker(
  pool: Pool,
  clock: ClockGuard,
  driver: TrustedAuthoringDriver,
  report: () => void,
) {
  const coordinator = createJudgingCoordinator(pool, clock, driver);
  let reported = -Infinity;
  const stop = maintenanceLoop(
    () => coordinator.tick(),
    250,
    () => {
      if (performance.now() - reported >= 60000) {
        reported = performance.now();
        report();
      }
    },
  );
  return {
    workerId: coordinator.workerId,
    async close() {
      coordinator.stop();
      await stop();
    },
  };
}
