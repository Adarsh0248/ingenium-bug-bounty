import assert from "node:assert/strict";
import test from "node:test";
import type { PoolClient } from "pg";
import {
  confirmStaffCode,
  staffActionVerifier,
} from "../src/access/staff-service.js";
import type { StaffSession } from "../src/access/staff-service.js";
import { newAccessCode } from "../src/access/credentials.js";

test("normal staff actions use the bound session without retaining or resending a raw code", async () => {
  const credential = newAccessCode();
  const client = {
    async query() {
      return { rows: [{ verifier: credential.verifier }] };
    },
  } as unknown as PoolClient;
  const session = {
    mode: "NORMAL",
    credential_id: "credential",
    credential_version: "1",
    staff_id: "staff",
  } as StaffSession;
  assert.deepEqual(
    await staffActionVerifier(client, session),
    credential.verifier,
  );
  assert.deepEqual(
    await staffActionVerifier(client, session, credential.code),
    credential.verifier,
  );
  await assert.rejects(
    staffActionVerifier(client, session, newAccessCode().code),
    { code: "STAFF_CONFIRMATION_REQUIRED" },
  );
  await assert.rejects(
    staffActionVerifier(
      {
        async query() {
          return { rows: [] };
        },
      } as unknown as PoolClient,
      session,
    ),
    { code: "INVALID_SESSION" },
  );
  await assert.rejects(
    staffActionVerifier(client, { ...session, mode: "CLOCK_RECOVERY" }),
    { code: "INVALID_SESSION" },
  );
  await assert.rejects(
    staffActionVerifier(
      client,
      { ...session, mode: "CLOCK_RECOVERY" },
      credential.code,
    ),
    { code: "INVALID_SESSION" },
  );
  await assert.rejects(confirmStaffCode(client, session, undefined), {
    code: "STAFF_CONFIRMATION_REQUIRED",
  });
});
