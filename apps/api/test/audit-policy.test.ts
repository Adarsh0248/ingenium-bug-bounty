import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { auditScope } from "../src/access/audit-service.js";
import { AUDIT_FAMILIES } from "../src/access/audit-policy.js";
test("audit scope accepts only fixed record categories and UUID cursors under their permitted arena scope", () => {
  for (const [key, definition] of Object.entries(AUDIT_FAMILIES)) {
    assert.equal(auditScope(key, undefined, randomUUID()), key);
    if (definition.arena) assert.equal(auditScope(key, randomUUID()), key);
    else assert.throws(() => auditScope(key, randomUUID()));
  }
  for (const key of [
    undefined,
    null,
    {},
    "__proto__",
    "constructor",
    "toString",
    "ROUND; DELETE FROM rounds",
    "round",
  ])
    assert.throws(() => auditScope(key));
  assert.throws(() => auditScope("ROUND", "bad"));
  assert.throws(() => auditScope("CONTENT", undefined, ""));
});
