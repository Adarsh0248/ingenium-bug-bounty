import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { newAccessCode } from "../src/access/credentials.js";
import { validateOperatorStaff } from "../src/access/staff-recovery.js";
import type { OperatorStaffInput } from "../src/access/staff-recovery.js";
import {
  parseOperatorCandidate,
  writeOperatorCandidate,
} from "../src/access/staff-recovery-file.js";

const code = newAccessCode();
const input: OperatorStaffInput = {
  requestKey: randomUUID(),
  action: "CREATE",
  staffId: randomUUID(),
  credentialId: randomUUID(),
  verifier: code.verifier,
  displayName: "Synthetic recovery admin",
  expectedRevision: "0",
  replacementSessionId: null,
  operator: "Synthetic operator",
  osUser: "synthetic-maintainer",
  verification: "Synthetic out-of-band identity check",
  reason: "Synthetic recovery test",
};

test("operator recovery bounds identities, action shapes, fresh verifiers, UTF-8 text and canonical revisions", () => {
  validateOperatorStaff(input);
  validateOperatorStaff({ ...input, action: "ROTATE", displayName: null });
  validateOperatorStaff({
    ...input,
    action: "DISABLE",
    displayName: null,
    credentialId: null,
    verifier: null,
    replacementSessionId: randomUUID(),
  });
  for (const patch of [
    { action: "PROMOTE" },
    { requestKey: "1" },
    { staffId: "1" },
    { expectedRevision: "01" },
    { verifier: Buffer.alloc(31) },
    { reason: " " },
    { verification: "" },
    { osUser: "\0" },
    { operator: "x".repeat(121) },
    { displayName: "\ud800" },
    { replacementSessionId: randomUUID() },
    { action: "ROTATE", displayName: "unexpected" },
    {
      action: "DISABLE",
      displayName: null,
      credentialId: null,
      verifier: null,
      replacementSessionId: null,
    },
  ])
    assert.throws(() =>
      validateOperatorStaff({ ...input, ...patch } as OperatorStaffInput),
    );
});

test("private recovery candidates preserve the exact original code and intent and reject extra or mismatched fields", () => {
  const { verifier: _, ...intent } = input;
  const candidate = {
    schema_version: 1,
    input: intent,
    access_code: code.code,
  };
  assert.deepEqual(parseOperatorCandidate(candidate), {
    input,
    accessCode: code.code,
  });
  for (const wrong of [
    null,
    [],
    { ...candidate, schema_version: 2 },
    { ...candidate, extra: true },
    { ...candidate, input: { ...intent, verifier: "unexpected" } },
    { ...candidate, access_code: code.code.toLowerCase() },
    { ...candidate, access_code: null },
    { ...candidate, input: { ...intent, action: "DISABLE" } },
  ])
    assert.throws(() => parseOperatorCandidate(wrong));
});

test("operator candidate writes are unavailable from the Windows development environment", async () => {
  if (process.platform === "linux" && process.getuid?.() !== 0) return;
  const { verifier: _, ...intent } = input;
  await assert.rejects(
    writeOperatorCandidate("/not-created.json", {
      schema_version: 1,
      input: intent,
      access_code: code.code,
    }),
    /Restricted Linux/,
  );
});
