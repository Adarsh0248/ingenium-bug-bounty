import assert from "node:assert/strict";
import { test } from "node:test";
import { Pool } from "pg";
import { buildApp } from "../../src/app.js";
import { loadConfig } from "../../src/config.js";
import { createDatabase } from "../../src/database.js";

test("readiness uses a real development PostgreSQL connection", async (t) => {
  const config = loadConfig(process.env);
  const database = createDatabase(config.databaseUrl, () => {
    assert.fail("An unexpected PostgreSQL pool error occurred.");
  });
  const app = buildApp({ database });
  t.after(() => app.close());

  const response = await app.inject({ method: "GET", url: "/ready" });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { status: "ready" });
});

test("the API database role is not a database administrator or schema owner", async (t) => {
  const config = loadConfig(process.env);
  const pool = new Pool({ connectionString: config.databaseUrl, max: 1, connectionTimeoutMillis: 1000 });
  t.after(() => pool.end());

  const result = await pool.query(`
    SELECT current_user AS name, rolsuper, rolcreatedb, rolcreaterole, rolreplication,
           has_schema_privilege(current_user, 'public', 'CREATE') AS can_create_schema_objects,
           (SELECT pg_get_userbyid(datdba) = current_user FROM pg_database WHERE datname = current_database()) AS owns_database
    FROM pg_roles WHERE rolname = current_user
  `);
  assert.deepEqual(result.rows[0], {
    name: "ingenium_api",
    rolsuper: false,
    rolcreatedb: false,
    rolcreaterole: false,
    rolreplication: false,
    can_create_schema_objects: false,
    owns_database: false,
  });
});
