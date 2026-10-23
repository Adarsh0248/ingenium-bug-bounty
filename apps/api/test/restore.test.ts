import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import {
  restoreConfig,
  validateRestoreIntent,
} from "../src/maintenance/restore.js";

test("restore runtime accepts only explicit local maintenance credentials", () => {
  const valid = {
    schema_version: 1,
    database_url: "postgresql://schema_owner:synthetic@127.0.0.1/synthetic",
  };
  assert.equal(restoreConfig(valid), valid.database_url);
  for (const bad of [
    null,
    [],
    {},
    { ...valid, schema_version: 2 },
    { ...valid, extra: true },
    ...[
      "postgresql://ingenium_api:synthetic@127.0.0.1/synthetic",
      "postgresql://owner@127.0.0.1/synthetic",
      "postgresql://owner:synthetic@remote.example/synthetic",
      "postgresql://owner:synthetic@127.0.0.1/synthetic?x=1",
    ].map((database_url) => ({ ...valid, database_url })),
  ])
    assert.throws(() => restoreConfig(bad));
});
test("restore intents require a stable key and bounded nonempty audit metadata", () => {
  const input = {
    requestKey: randomUUID(),
    backupRef: "synthetic-full/LSN",
    operator: "Synthetic operator",
    osUser: "fixture",
    reason: "Disposable recovery drill",
  };
  validateRestoreIntent(input);
  for (const [field, limit] of [
    ["backupRef", 256],
    ["operator", 120],
    ["osUser", 120],
    ["reason", 1024],
  ] as const)
    for (const value of [
      "",
      " ",
      "x".repeat(limit + 1),
      "\u0000",
      String.fromCodePoint(0x00e9).repeat(limit),
    ])
      assert.throws(() => validateRestoreIntent({ ...input, [field]: value }));
  assert.throws(() =>
    validateRestoreIntent({ ...input, requestKey: "not-an-id" }),
  );
});
