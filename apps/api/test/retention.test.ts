import assert from "node:assert/strict";
import { test } from "node:test";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
  maintenanceConfig,
  offlineRetention,
} from "../src/maintenance/offline.js";

test("offline retention accepts only an exact private local restricted-role descriptor", () => {
  const database_url =
    "postgresql://ingenium_api:synthetic@127.0.0.1/ingenium_test";
  assert.equal(
    maintenanceConfig({ schema_version: 1, database_url }),
    database_url,
  );
  for (const value of [
    null,
    [],
    {},
    { schema_version: 2, database_url },
    { schema_version: 1, database_url, force: true },
    ...[
      "postgresql://owner:x@127.0.0.1/db",
      "postgresql://ingenium_api:x@public.test/db",
      "postgresql://ingenium_api@127.0.0.1/db",
      database_url + "?options=unsafe",
      database_url + "#x",
      "mysql://ingenium_api:x@localhost/db",
    ].map((database_url) => ({ schema_version: 1, database_url })),
  ])
    assert.throws(() => maintenanceConfig(value));
});
test("offline cleanup refuses invalid limits and cancellation before any database access", async () => {
  const pool = {
      connect() {
        throw new Error("Database must not be opened");
      },
    } as never,
    clock = {} as never;
  for (const limit of [0, -1, 101, 1.5, NaN])
    await assert.rejects(
      offlineRetention(pool, clock, limit, new AbortController().signal),
    );
  const controller = new AbortController();
  controller.abort();
  assert.deepEqual(await offlineRetention(pool, clock, 1, controller.signal), {
    batches: 0,
    purged: 0,
    empty: false,
    interrupted: true,
  });
});
test("the real retention CLI refuses missing confirmation without opening a runtime or printing its path", async () => {
  await assert.rejects(
    promisify(execFile)(
      process.execPath,
      [
        "--import",
        "tsx",
        fileURLToPath(new URL("../src/maintenance/cli.ts", import.meta.url)),
        "--runtime",
        "/never-open/synthetic-private-runtime.json",
        "--confirm",
        "WRONG",
      ],
      { timeout: 10000, maxBuffer: 8192, windowsHide: true },
    ),
    (error: unknown) => {
      const e = error as { code: number; stdout: string; stderr: string };
      assert.equal(e.code, 1);
      assert.equal(e.stdout, "");
      assert.match(e.stderr, /Retention was not fully acknowledged/);
      assert.doesNotMatch(
        e.stderr,
        /never-open|synthetic-private-runtime|postgresql|password/,
      );
      return true;
    },
  );
});
