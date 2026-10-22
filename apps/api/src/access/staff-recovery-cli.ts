import { randomUUID } from "node:crypto";
import { userInfo } from "node:os";
import { parseArgs } from "node:util";
import { Pool } from "pg";
import { privateRuntimeJson } from "../runtime/private-file.js";
import { maintenanceDatabaseUrl } from "./staff-bootstrap.js";
import { newAccessCode, uuid } from "./credentials.js";
import {
  assertOperatorDatabase,
  operatorStaffOutcome,
  recoverSuperAdmin,
} from "./staff-recovery.js";
import type { OperatorStaffInput } from "./staff-recovery.js";
import {
  readOperatorCandidate,
  writeOperatorCandidate,
} from "./staff-recovery-file.js";

async function main() {
  const { values } = parseArgs({
    options: {
      action: { type: "string" },
      "staff-id": { type: "string" },
      "expected-revision": { type: "string" },
      name: { type: "string" },
      "replacement-session": { type: "string" },
      operator: { type: "string" },
      verification: { type: "string" },
      reason: { type: "string" },
      "request-key": { type: "string" },
      out: { type: "string" },
      confirm: { type: "string" },
      status: { type: "boolean" },
      inspect: { type: "boolean" },
      resume: { type: "string" },
    },
  });
  const mode = values.status
    ? "status"
    : values.inspect
      ? "inspect"
      : values.resume
        ? "resume"
        : "new";
  const allowed =
    mode === "status"
      ? ["status", "request-key"]
      : mode === "inspect"
        ? ["inspect", "staff-id"]
        : mode === "resume"
          ? ["resume", "confirm"]
          : [
              "action",
              "staff-id",
              "expected-revision",
              "name",
              "replacement-session",
              "operator",
              "verification",
              "reason",
              "request-key",
              "out",
              "confirm",
            ];
  if (Object.keys(values).some((key) => !allowed.includes(key)))
    throw new Error("Conflicting operator modes.");
  const config = (await privateRuntimeJson(
    process.env.STAFF_MAINTENANCE_RUNTIME_FILE ?? "",
    8192,
  )) as Record<string, unknown>;
  if (
    !config ||
    Object.keys(config).sort().join() !== "database_url,schema_version" ||
    config.schema_version !== 1 ||
    typeof config.database_url !== "string"
  )
    throw new Error("Explicit maintenance runtime file required.");
  const connectionString = maintenanceDatabaseUrl({
    STAFF_MAINTENANCE_DATABASE_URL: config.database_url,
  });
  const pool = new Pool({
    connectionString,
    max: 1,
    connectionTimeoutMillis: 3000,
    query_timeout: 5000,
    application_name: "ingenium-operator-staff-recovery",
  });
  pool.on("error", () => {
    console.error(
      "Maintenance connection unavailable; reconcile the original request key.",
    );
    process.exitCode = 1;
  });
  try {
    await assertOperatorDatabase(pool);
    if (mode === "status") {
      console.log(
        JSON.stringify(
          await operatorStaffOutcome(pool, uuid(values["request-key"])),
        ),
      );
      return;
    }
    if (mode === "inspect") {
      const id = values["staff-id"] ? uuid(values["staff-id"]) : null;
      const result = await pool.query(
        `SELECT (SELECT revision::text FROM security_control WHERE id=1) AS security_revision,
        COALESCE(jsonb_agg(staff_admin_state(id) ORDER BY id),'[]'::jsonb) AS staff FROM
        (SELECT id FROM staff_identities WHERE role='SUPER_ADMIN' AND
          (($1::uuid IS NULL AND disabled_at IS NULL) OR id=$1) ORDER BY id LIMIT 50) selected`,
        [id],
      );
      console.log(JSON.stringify(result.rows[0]));
      return;
    }
    if (values.confirm !== "OPERATOR_SUPER_ADMIN")
      throw new Error("Explicit operator confirmation required.");
    let input: OperatorStaffInput;
    if (mode === "resume") {
      input = (await readOperatorCandidate(values.resume!)).input;
      if (input.osUser !== userInfo().username)
        throw new Error("Original maintenance account required.");
    } else {
      if (!values.out) throw new Error("Private candidate handoff required.");
      const action = values.action as OperatorStaffInput["action"];
      const generated = action === "DISABLE" ? null : newAccessCode();
      input = {
        requestKey: uuid(values["request-key"]),
        action,
        staffId: action === "CREATE" ? randomUUID() : uuid(values["staff-id"]),
        credentialId: generated ? randomUUID() : null,
        verifier: generated?.verifier ?? null,
        displayName: values.name ?? null,
        expectedRevision: values["expected-revision"]!,
        replacementSessionId: values["replacement-session"] ?? null,
        operator: values.operator!,
        osUser: userInfo().username,
        verification: values.verification!,
        reason: values.reason!,
      };
      if (action === "CREATE" && values["staff-id"])
        throw new Error("New staff ID is generated privately.");
      const { verifier: _, ...intent } = input;
      await writeOperatorCandidate(values.out, {
        schema_version: 1,
        input: intent,
        access_code: generated?.code ?? null,
      });
    }
    await recoverSuperAdmin(pool, input);
    console.log(
      JSON.stringify(await operatorStaffOutcome(pool, input.requestKey)),
    );
    console.log(
      "Compare the retained candidate IDs and current credential before private distribution. No service, clock or competition state was changed.",
    );
  } finally {
    await pool.end();
  }
}

void main().catch(() => {
  console.error(
    "Operator action not acknowledged. Preserve the private candidate; use --status with its original request key. Do not distribute an unverified code or replace the request key. Resume only that retained candidate after reconciliation.",
  );
  process.exitCode = 1;
});
