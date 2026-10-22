import type { Pool, PoolClient } from "pg";
import { commandFingerprint, sameVerifier, uuid } from "./credentials.js";
import { boundedStaffText, staffRevision } from "./staff-management.js";
import type { StaffState } from "./staff-management.js";
import { staffOutcomeCapacity } from "./staff-service.js";

export interface OperatorStaffInput {
  requestKey: string;
  action: "CREATE" | "ROTATE" | "DISABLE";
  staffId: string;
  credentialId: string | null;
  verifier: Buffer | null;
  displayName: string | null;
  expectedRevision: string;
  replacementSessionId: string | null;
  operator: string;
  osUser: string;
  verification: string;
  reason: string;
}

export function validateOperatorStaff(input: OperatorStaffInput) {
  uuid(input.requestKey);
  uuid(input.staffId);
  staffRevision(input.expectedRevision);
  boundedStaffText(input.operator, 120);
  boundedStaffText(input.osUser, 120);
  boundedStaffText(input.verification, 1024);
  boundedStaffText(input.reason, 1024);
  if (!["CREATE", "ROTATE", "DISABLE"].includes(input.action))
    throw new Error("Invalid operator action.");
  if (input.action === "CREATE") boundedStaffText(input.displayName, 120);
  else if (input.displayName !== null)
    throw new Error("Unexpected display name.");
  if (input.action === "DISABLE") {
    uuid(input.replacementSessionId);
    if (input.credentialId !== null || input.verifier !== null)
      throw new Error("Unexpected credential.");
  } else {
    uuid(input.credentialId);
    if (
      !Buffer.isBuffer(input.verifier) ||
      input.verifier.length !== 32 ||
      input.replacementSessionId !== null
    )
      throw new Error("Fresh credential required.");
  }
}

export async function assertOperatorDatabase(
  client: Pick<PoolClient, "query">,
) {
  const row = (
    await client.query(`SELECT current_user<>'ingenium_api' AND
    (SELECT count(*)=4 AND bool_and(pg_get_userbyid(relowner)=current_user) FROM pg_class
      WHERE oid IN ('public.security_control'::regclass,'public.staff_identities'::regclass,
        'public.access_credentials'::regclass,'public.operator_staff_outcomes'::regclass)) AS allowed`)
  ).rows[0];
  if (!row?.allowed)
    throw new Error("Actual schema-owner maintenance access required.");
}

async function state(
  client: PoolClient,
  id: string,
): Promise<StaffState | null> {
  return (
    (await client.query("SELECT staff_admin_state($1) AS state", [id])).rows[0]
      ?.state ?? null
  );
}

export async function operatorStaffOutcome(pool: Pool, requestKey: string) {
  uuid(requestKey);
  const client = await pool.connect();
  const disconnected = () => {};
  client.on("error", disconnected);
  let destroy = false;
  try {
    await assertOperatorDatabase(client);
    const row = (
      await client.query(
        `SELECT o.id AS request_key,o.action,o.staff_id,o.credential_id,o.recorded_at,o.before_state,o.after_state,
      EXISTS(SELECT 1 FROM staff_identities i JOIN access_credentials c ON c.staff_id=i.id
        WHERE i.id=o.staff_id AND i.role='SUPER_ADMIN' AND i.disabled_at IS NULL
          AND c.id=o.credential_id AND c.revoked_at IS NULL) AS credential_current
      FROM operator_staff_outcomes o WHERE o.id=$1`,
        [requestKey],
      )
    ).rows[0];
    return { status: row ? "RECORDED" : "NOT_OBSERVED", outcome: row ?? null };
  } catch (error) {
    destroy = true;
    throw error;
  } finally {
    client.removeListener("error", disconnected);
    client.release(destroy);
  }
}

export async function recoverSuperAdmin(pool: Pool, input: OperatorStaffInput) {
  validateOperatorStaff(input);
  const fingerprint = commandFingerprint([
    input.action,
    input.staffId,
    input.credentialId,
    input.verifier?.toString("hex") ?? null,
    input.displayName,
    input.expectedRevision,
    input.replacementSessionId,
    input.operator,
    input.osUser,
    input.verification,
    input.reason,
  ]);
  const client = await pool.connect();
  const disconnected = () => {};
  client.on("error", disconnected);
  let destroy = false;
  try {
    await client.query(
      "BEGIN; SET LOCAL lock_timeout='750ms'; SET LOCAL statement_timeout='2s'; SET LOCAL transaction_timeout='3s'",
    );
    await assertOperatorDatabase(client);
    if (
      (
        await client.query(
          "SELECT id FROM security_control WHERE id=1 FOR UPDATE",
        )
      ).rowCount !== 1
    )
      throw new Error("Security anchor missing.");
    const prior = (
      await client.query(
        "SELECT fingerprint FROM operator_staff_outcomes WHERE id=$1",
        [input.requestKey],
      )
    ).rows[0];
    if (prior) {
      if (!sameVerifier(prior.fingerprint, fingerprint))
        throw new Error("Operator intent differs; no changes made.");
      await client.query("COMMIT");
      return {
        status: "ALREADY_RECORDED" as const,
        request_key: input.requestKey,
      };
    }
    if (
      !(await client.query("SELECT 1 FROM operator_bootstraps LIMIT 1"))
        .rowCount
    )
      throw new Error("First Super Admin setup required.");
    await staffOutcomeCapacity(client);
    const before = await state(client, input.staffId);
    const revision =
      input.action === "CREATE"
        ? (
            await client.query(
              "SELECT revision FROM security_control WHERE id=1",
            )
          ).rows[0].revision
        : before?.revision;
    if (revision !== input.expectedRevision)
      throw new Error("Stale operator revision; no changes made.");
    if (
      input.action === "CREATE"
        ? before !== null
        : !before || before.role !== "SUPER_ADMIN"
    )
      throw new Error("Invalid Super Admin target.");
    if (
      (input.action === "CREATE" ||
        (input.action === "ROTATE" && !before?.enabled)) &&
      (
        await client.query(
          "SELECT count(*)::integer AS n FROM staff_identities WHERE disabled_at IS NULL",
        )
      ).rows[0].n >= 50
    )
      throw new Error("Staff capacity unavailable.");
    const now = (
      await client.query(
        "SELECT date_trunc('milliseconds',clock_timestamp()) AS now",
      )
    ).rows[0].now;
    if (input.action === "DISABLE") {
      if (!before?.enabled) throw new Error("Super Admin is already disabled.");
      if (
        !(
          await client.query(
            "SELECT id FROM clock_health WHERE id=1 AND NOT fault_latched",
          )
        ).rowCount
      )
        throw new Error(
          "Repair the time incident and verify replacement access before retirement; compromised codes can still be rotated.",
        );
      const replacement = await client.query(
        `SELECT s.id FROM staff_sessions s
        JOIN staff_session_slots x ON x.staff_id=s.staff_id AND x.session_id=s.id
        JOIN staff_identities i ON i.id=s.staff_id
        JOIN access_credentials c ON c.id=s.credential_id AND c.version=s.credential_version AND c.staff_id=s.staff_id
        WHERE s.id=$1 AND s.staff_id<>$2 AND s.mode='NORMAL' AND s.revoked_at IS NULL
          AND i.role='SUPER_ADMIN' AND i.disabled_at IS NULL AND c.revoked_at IS NULL
          AND c.issued_at<=$3 AND s.created_at<=$3 AND s.last_activity_at<=$3
          AND $3<s.absolute_expires_at AND $3<s.last_activity_at+interval '15 minutes'`,
        [input.replacementSessionId, input.staffId, now],
      );
      if (!replacement.rowCount)
        throw new Error(
          "A current verified replacement Super Admin session is required.",
        );
      await client.query(
        "UPDATE staff_identities SET disabled_at=$2,revision=revision+1 WHERE id=$1",
        [input.staffId, now],
      );
    } else if (input.action === "CREATE") {
      await client.query(
        "INSERT INTO staff_identities(id,display_name,role,revision) VALUES($1,$2,'SUPER_ADMIN',1)",
        [input.staffId, input.displayName],
      );
    } else {
      await client.query(
        "UPDATE staff_identities SET disabled_at=NULL,revision=revision+1 WHERE id=$1",
        [input.staffId],
      );
    }
    // Reuse the existing revocation triggers; a rotation never keeps the compromised code valid.
    await client.query(
      "UPDATE access_credentials SET revoked_at=$2 WHERE staff_id=$1 AND revoked_at IS NULL",
      [input.staffId, now],
    );
    if (input.credentialId) {
      await client.query(
        `INSERT INTO access_credentials(id,staff_id,verifier,version,issued_at)
        SELECT $1,$2,$3,COALESCE(max(version),0)+1,$4 FROM access_credentials WHERE staff_id=$2`,
        [input.credentialId, input.staffId, input.verifier, now],
      );
    }
    const after = await state(client, input.staffId);
    await client.query(
      `INSERT INTO operator_staff_outcomes(id,action,staff_id,credential_id,replacement_session_id,expected_revision,fingerprint,
      operator,os_user,verification,reason,recorded_at,before_state,after_state)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [
        input.requestKey,
        input.action,
        input.staffId,
        input.credentialId,
        input.replacementSessionId,
        input.expectedRevision,
        fingerprint,
        input.operator,
        input.osUser,
        input.verification,
        input.reason,
        now,
        before ? JSON.stringify(before) : null,
        JSON.stringify(after),
      ],
    );
    if (input.credentialId)
      await client.query(
        "INSERT INTO staff_credential_issues(credential_id,recovery_id) VALUES($1,$2)",
        [input.credentialId, input.requestKey],
      );
    await client.query(
      "UPDATE security_control SET revision=revision+1 WHERE id=1",
    );
    await client.query("COMMIT");
    return { status: "APPLIED" as const, request_key: input.requestKey };
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
