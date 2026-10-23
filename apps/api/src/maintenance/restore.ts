import type { Pool } from "pg";
import { uuid } from "../access/credentials.js";
import { maintenanceDatabaseUrl } from "../access/staff-bootstrap.js";
import { boundedStaffText } from "../access/staff-management.js";

export interface RestoreIntent {
  requestKey: string;
  backupRef: string;
  operator: string;
  osUser: string;
  reason: string;
}
export function restoreConfig(value: unknown) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).sort().join() !== "database_url,schema_version"
  )
    throw new Error("Explicit restore runtime required.");
  const v = value as Record<string, unknown>;
  if (
    v.schema_version !== 1 ||
    typeof v.database_url !== "string" ||
    !new URL(v.database_url).password
  )
    throw new Error("Private schema-owner configuration required.");
  return maintenanceDatabaseUrl({
    STAFF_MAINTENANCE_DATABASE_URL: v.database_url,
  });
}
export function validateRestoreIntent(input: RestoreIntent) {
  uuid(input.requestKey);
  boundedStaffText(input.backupRef, 256);
  boundedStaffText(input.operator, 120);
  boundedStaffText(input.osUser, 120);
  boundedStaffText(input.reason, 1024);
}
export async function quarantineRestoredDatabase(
  pool: Pool,
  input: RestoreIntent,
) {
  validateRestoreIntent(input);
  return (
    await pool.query(
      "SELECT quarantine_restored_database($1,$2,$3,$4,$5) AS result",
      [
        input.requestKey,
        input.backupRef,
        input.operator,
        input.osUser,
        input.reason,
      ],
    )
  ).rows[0]!.result;
}
export async function restoreStatus(pool: Pool, requestKey: string) {
  uuid(requestKey);
  const result = await pool.query(
    `SELECT request_key,observed_at,effects FROM restore_quarantine
    WHERE request_key=$1 AND current_user=pg_get_userbyid((SELECT relowner FROM pg_class WHERE oid='public.restore_quarantine'::regclass))`,
    [requestKey],
  );
  return {
    status: result.rowCount ? "RECORDED" : "NOT_OBSERVED",
    outcome: result.rows[0] ?? null,
    admission_authorised: false,
  };
}
export async function inspectRestoredDatabase(pool: Pool, requestKey: string) {
  const status = await restoreStatus(pool, requestKey);
  if (status.status !== "RECORDED")
    throw new Error("Original quarantine receipt required.");
  const client = await pool.connect();
  const disconnected = () => {};
  client.on("error", disconnected);
  let destroy = false;
  try {
    await client.query(
      "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SET LOCAL statement_timeout='3s'; SET LOCAL transaction_timeout='5s'",
    );
    const row = (
      await client.query(
        `SELECT
      (SELECT count(*)::int FROM restore_quarantine WHERE request_key=$1) AS receipt,
      (SELECT count(*)::int FROM participant_sessions WHERE revoked_at IS NULL) AS unrevoked_participants,
      (SELECT count(*)::int FROM staff_sessions WHERE revoked_at IS NULL) AS unrevoked_staff,
      (SELECT count(*)::int FROM entry_flows WHERE state IN ('OPEN','ACTIVATED'))+
        (SELECT count(*)::int FROM staff_entry_flows WHERE state IN ('OPEN','ACTIVATED')) AS open_flows,
      (SELECT count(*)::int FROM session_deliveries WHERE ciphertext IS NOT NULL)+
        (SELECT count(*)::int FROM staff_session_deliveries WHERE ciphertext IS NOT NULL)+
        (SELECT count(*)::int FROM replacement_requests WHERE proof_ciphertext IS NOT NULL) AS delivery_capsules,
      (SELECT count(*)::int FROM arena_instances WHERE status IN ('SETUP','IN_PROGRESS')) AS reserved_arenas,
      (SELECT count(*)::int FROM rounds WHERE state IN ('RUNNING','PAUSED','CLOSING','CANCELLING')) AS unfinished_rounds,
      (SELECT count(*)::int FROM participant_judging WHERE status NOT IN ('COMPLETED','CANCELLED')) AS unfinished_participant_work,
      (SELECT count(*)::int FROM validation_runs WHERE status IN ('QUEUED','RUNNING')) AS unfinished_validation,
      (SELECT count(*)::int FROM participant_attempts WHERE released_at IS NULL)+
        (SELECT count(*)::int FROM authoring_attempts WHERE released_at IS NULL) AS unreleased_attempts,
      (SELECT count(*)::int FROM execution_capacity_slots WHERE num_nonnulls(authoring_attempt_id,participant_attempt_id)>0) AS physical_holds,
      (SELECT count(*)::int FROM judge_host_epochs WHERE state='ACTIVE') AS active_epochs,
      (SELECT count(*)::int FROM judge_host_epochs WHERE state='QUARANTINED') AS quarantined_epochs,
      (SELECT running FROM clock_health WHERE id=1) AS clock_running`,
        [requestKey],
      )
    ).rows[0];
    if (row?.receipt !== 1 || typeof row.clock_running !== "boolean")
      throw new Error("Incomplete recovery inventory.");
    await client.query("COMMIT");
    const { receipt: _, ...inventory } = row;
    return {
      ...status,
      inventory,
      recovery_gates: {
        access_invalidated:
          !row.unrevoked_participants &&
          !row.unrevoked_staff &&
          !row.open_flows &&
          !row.delivery_capsules,
        old_epochs_logically_quarantined: row.active_epochs === 0,
        physical_old_host_fencing: "UNVERIFIED",
        complete_sporting_recovery_point: "UNVERIFIED",
        deployment_secret_rotation: "UNVERIFIED",
        trusted_current_time: "UNVERIFIED",
        retention_catch_up: "UNVERIFIED",
      },
      admission_authorised: false,
    };
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
