import assert from "node:assert/strict";
import { test } from "node:test";
import { migrationDatabaseUrl } from "../src/db/migrate.js";

test("migrations require a separate explicit owner URL and never fall back to runtime credentials", () => {
  assert.throws(() => migrationDatabaseUrl({ DATABASE_URL: "postgres://ingenium_api:private@127.0.0.1/ingenium_dev" }), /MIGRATION_DATABASE_URL is required/);
  for (const url of ["not a URL", "https://localhost/db", "postgres://user@remote.example/db", "postgres://ingenium_api@localhost/db", "postgres://localhost/db", "postgres://owner@localhost/"]) {
    assert.throws(() => migrationDatabaseUrl({ MIGRATION_DATABASE_URL: url }));
  }
  for (const url of ["postgres://owner@127.0.0.1/ingenium_dev", "postgresql://owner@localhost/ingenium_dev", "postgres://owner@[::1]/ingenium_dev"]) {
    assert.equal(migrationDatabaseUrl({ MIGRATION_DATABASE_URL: url }), url);
  }
});
