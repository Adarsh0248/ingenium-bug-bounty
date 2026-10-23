import assert from "node:assert/strict";
import { test } from "node:test";
import { resolve } from "node:path";
import { loadConfig } from "../src/config.js";

const databaseUrl =
  "postgresql://test-user:test-password@127.0.0.1:5433/ingenium_dev";

test("configuration defaults bind the API to localhost", () => {
  assert.deepEqual(loadConfig({ DATABASE_URL: databaseUrl }), {
    host: "127.0.0.1",
    port: 3000,
    databaseUrl,
  });
});

test("configuration accepts an explicit valid local port", () => {
  assert.equal(
    loadConfig({ DATABASE_URL: databaseUrl, API_PORT: "3100" }).port,
    3100,
  );
});

test("invalid API ports are rejected rather than coerced", () => {
  for (const port of [
    "",
    "0",
    "-1",
    "3.5",
    "3000oops",
    "65536",
    "1e3",
    " 3000 ",
  ]) {
    assert.throws(
      () => loadConfig({ DATABASE_URL: databaseUrl, API_PORT: port }),
      /API_PORT/,
    );
  }
});

test("this foundation cannot accidentally bind the API to the public network", () => {
  assert.throws(
    () => loadConfig({ DATABASE_URL: databaseUrl, API_HOST: "0.0.0.0" }),
    /loopback/,
  );
});

test("a database URL is required", () => {
  assert.throws(() => loadConfig({}), /DATABASE_URL is required/);
});

test("invalid database URLs are rejected without echoing credentials", () => {
  for (const url of [
    "not-a-url",
    "https://test-user:test-password@example.com/db",
    "postgresql://localhost/",
  ]) {
    assert.throws(
      () => loadConfig({ DATABASE_URL: url }),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /DATABASE_URL/);
        assert.doesNotMatch(error.message, /test-password|example\.com/);
        return true;
      },
    );
  }
});

test("protected event mode rejects database URL overrides and missing passwords", () => {
  const runtime = resolve("synthetic-runtime/entry.json");
  assert.equal(
    loadConfig({ DATABASE_URL: databaseUrl, ENTRY_RUNTIME_FILE: runtime })
      .entryRuntimeFile,
    runtime,
  );
  for (const url of [
    databaseUrl + "?options=-c%20role%3Dpostgres",
    databaseUrl + "#secret",
    databaseUrl.replace(":test-password", ""),
    databaseUrl.replace("127.0.0.1", "db.example.invalid"),
  ]) {
    assert.throws(
      () => loadConfig({ DATABASE_URL: url, ENTRY_RUNTIME_FILE: runtime }),
      /without URL overrides/,
    );
  }
});
