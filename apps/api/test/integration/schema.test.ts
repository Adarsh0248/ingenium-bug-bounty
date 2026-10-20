import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { lstat } from "node:fs/promises";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { setTimeout } from "node:timers/promises";
import { drizzle } from "drizzle-orm/node-postgres";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { Client, Pool } from "pg";
import { migrateDatabase, migrationsFolder } from "../../src/db/migrate.js";
import { teamMembers, teams } from "../../src/db/schema.js";
import { accessChecks } from "./access.checks.js";
import { clockChecks } from "./clock.checks.js";
import { staffChecks } from "./staff.checks.js";
import { staffManagementChecks } from "./staff-management.checks.js";
import { arenaChecks } from "./arena.checks.js";
import { contentChecks } from "./content.checks.js";
import { validationChecks } from "./validation.checks.js";

const exec = promisify(execFile);
const IMAGE = "postgres:17.11-bookworm@sha256:3645570cccdfa447589da9f57dd740faa29b30938e861289a5574b6ca6b03826";
const roleScript = fileURLToPath(new URL("../../../../infra/postgres/01-api-role.sql", import.meta.url));

async function docker(args: string[], environment = process.env): Promise<string> {
  const result = await exec("docker", args, { env: environment, timeout: 30000, maxBuffer: 1048576, windowsHide: true });
  return result.stdout.trim();
}

async function waitForDatabase(connectionString: string): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt++) {
    const client = new Client({ connectionString, connectionTimeoutMillis: 500, query_timeout: 1000 });
    try {
      await client.connect();
      await client.query("SELECT 1");
      return;
    } catch {
      await setTimeout(500);
    } finally {
      await client.end();
    }
  }
  throw new Error("The disposable PostgreSQL test database did not become ready.");
}

test("registration migrations work on isolated PostgreSQL and preserve their constraints on repeat application", { timeout: 180000 }, async (t) => {
  assert.equal((await lstat(roleScript)).isFile(), true, "The reviewed role script must be a regular file before mounting it.");
  const nonce = randomUUID();
  const password = randomBytes(24).toString("hex");
  const apiPassword = randomBytes(24).toString("hex");
  // Isolated feature databases share this bounded tmpfs, including migration WAL.
  const container = await docker(["create", "--pull=never", "--name", `ingenium-schema-test-${nonce}`,
    "--label", `ingenium.schema-test=${nonce}`, "--restart", "no", "--read-only", "--user", "999:999", "--cap-drop", "ALL",
    "--security-opt", "no-new-privileges=true", "--memory", "768m", "--memory-swap", "768m", "--cpus", "1", "--pids-limit", "128",
    "--publish", "127.0.0.1::5432", "--env", "POSTGRES_USER=ingenium_schema_owner", "--env", "POSTGRES_DB=ingenium_schema_test",
    "--env", "POSTGRES_PASSWORD", "--env", "POSTGRES_API_PASSWORD",
    "--tmpfs", "/var/lib/postgresql/data:rw,nosuid,nodev,noexec,size=512m,uid=999,gid=999,mode=0700",
    "--tmpfs", "/var/run/postgresql:rw,nosuid,nodev,noexec,size=8m,uid=999,gid=999,mode=0700",
    "--tmpfs", "/tmp:rw,nosuid,nodev,noexec,size=16m,uid=999,gid=999,mode=0700",
    "--mount", `type=bind,src=${roleScript},dst=/docker-entrypoint-initdb.d/01-api-role.sql,readonly`,
    "--log-driver", "json-file", "--log-opt", "max-size=1m", "--log-opt", "max-file=1", IMAGE],
  { ...process.env, POSTGRES_PASSWORD: password, POSTGRES_API_PASSWORD: apiPassword });
  assert.match(container, /^[a-f0-9]{64}$/);
  let owner: Pool | undefined;
  let api: Pool | undefined;
  try {
    await docker(["start", container]);
    const port = await docker(["inspect", "--format", '{{(index (index .NetworkSettings.Ports "5432/tcp") 0).HostPort}}', container]);
    assert.match(port, /^[1-9]\d{0,4}$/);
    const url = new URL(`postgresql://127.0.0.1:${port}/ingenium_schema_test`);
    url.username = "ingenium_schema_owner";
    url.password = password;
    try {
      await waitForDatabase(url.toString());
    } catch {
      const logs = await exec("docker", ["logs", "--tail", "40", container], { timeout: 10000, maxBuffer: 32768, windowsHide: true });
      const diagnostic = (logs.stdout + logs.stderr).replaceAll(password, "[redacted]").replaceAll(apiPassword, "[redacted]");
      throw new Error(`The disposable PostgreSQL test database did not become ready. Startup log:\n${diagnostic}`);
    }
    const ownerUrl = url.toString();
    owner = new Pool({ connectionString: ownerUrl, max: 2, connectionTimeoutMillis: 2000, statement_timeout: 5000 });
    await migrateDatabase(ownerUrl);
    const db = drizzle(owner);
    url.username = "ingenium_api";
    url.password = apiPassword;
    const apiUrl = url.toString();
    api = new Pool({ connectionString: apiUrl, max: 4, connectionTimeoutMillis: 2000 });

    await t.test("names are labels, members have stable UUIDs and exactly two distinct positions", async () => {
      const first = await db.insert(teams).values({ displayName: "Same team label" }).returning();
      const second = await db.insert(teams).values({ displayName: "Same team label" }).returning();
      const team = first[0];
      assert.ok(team && second[0]);
      assert.notEqual(team.id, second[0].id);
      assert.match(team.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      const members = await db.insert(teamMembers).values([
        { teamId: team.id, position: 1, displayName: "Same member label" },
        { teamId: team.id, position: 2, displayName: "Same member label" },
      ]).returning();
      assert.equal(members.length, 2);
      assert.notEqual(members[0]?.id, members[1]?.id);
      await assert.rejects(owner!.query("INSERT INTO team_members (id, team_id, position, display_name) VALUES ($1, $2, 1, 'Duplicate slot')", [randomUUID(), team.id]), { code: "23505" });
      for (const position of [0, 3]) {
        await assert.rejects(owner!.query("INSERT INTO team_members (id, team_id, position, display_name) VALUES ($1, $2, $3, 'Third member')", [randomUUID(), team.id, position]), { code: "23514" });
      }
      await assert.rejects(owner!.query("INSERT INTO team_members (id, team_id, position, display_name) VALUES ($1, $2, 1, 'Orphan')", [randomUUID(), randomUUID()]), { code: "23503" });
      await assert.rejects(owner!.query("DELETE FROM teams WHERE id = $1", [team.id]), { code: "23503" });
    });

    await t.test("name limits count UTF-8 bytes rather than JavaScript characters", async () => {
      const unicodeName = String.fromCodePoint(0x00e9).repeat(60);
      await db.insert(teams).values({ displayName: unicodeName });
      for (const name of ["", "   ", "x".repeat(121), unicodeName + "x"]) {
        await assert.rejects(owner!.query("INSERT INTO teams (id, display_name) VALUES ($1, $2)", [randomUUID(), name]), { code: "23514" });
      }
      await assert.rejects(owner!.query("INSERT INTO teams (id, display_name) VALUES ($1, $2)", [randomUUID(), "name\u0000invalid"]), { code: "22021" });
      const result = await owner!.query("SELECT bool_and(created_at = date_trunc('milliseconds', created_at)) AS precise FROM teams");
      assert.equal(result.rows[0].precise, true);
    });

    await t.test("repeat migrations preserve rows and the runtime role cannot migrate or provision registrations", async () => {
      const before = await owner!.query("SELECT count(*)::integer AS count FROM teams");
      await migrateDatabase(ownerUrl);
      assert.deepEqual((await owner!.query("SELECT count(*)::integer AS count FROM teams")).rows, before.rows);
      assert.equal((await owner!.query("SELECT count(*)::integer AS count FROM drizzle.__drizzle_migrations")).rows[0].count, readMigrationFiles({ migrationsFolder }).length);
      assert.equal((await api!.query("SELECT 1 AS ready")).rows[0].ready, 1);
      await assert.rejects(api!.query("INSERT INTO teams (id,display_name) VALUES ($1,'Unauthorised registration')", [randomUUID()]), { code: "42501" });
      await assert.rejects(api!.query("CREATE TABLE must_not_exist (id integer)"), { code: "42501" });
      await assert.rejects(migrateDatabase(apiUrl), /Schema-owner privileges are required/);
    });

    await t.test("a competing migration cannot acquire the same session lock", async () => {
      const lock = await owner!.connect();
      try {
        await lock.query("SELECT pg_advisory_lock(187031, 1)");
        await assert.rejects(migrateDatabase(ownerUrl), /Another schema migration is already running/);
      } finally {
        await lock.query("SELECT pg_advisory_unlock(187031, 1)");
        lock.release();
      }
      await migrateDatabase(ownerUrl);
    });

    await t.test("a failed migration rolls back new tables without deleting pre-existing data", async () => {
      await owner!.query("CREATE DATABASE ingenium_schema_failure");
      const failureUrl = new URL(ownerUrl);
      failureUrl.pathname = "/ingenium_schema_failure";
      const client = new Client({ connectionString: failureUrl.toString(), connectionTimeoutMillis: 2000 });
      await client.connect();
      try {
        await client.query("CREATE TABLE teams (id integer PRIMARY KEY); INSERT INTO teams VALUES (42)");
        await assert.rejects(migrateDatabase(failureUrl.toString()), (error: unknown) => {
          assert.ok(error instanceof Error && typeof error.cause === "object" && error.cause !== null && "code" in error.cause);
          assert.equal(error.cause.code, "42P07");
          return true;
        });
        assert.deepEqual((await client.query("SELECT * FROM teams")).rows, [{ id: 42 }]);
        assert.equal((await client.query("SELECT to_regclass('public.team_members') AS name")).rows[0].name, null);
        assert.equal((await client.query("SELECT count(*)::integer AS count FROM drizzle.__drizzle_migrations")).rows[0].count, 0);
      } finally {
        await client.end();
      }
    });
    await accessChecks(t, owner, api);
    await staffChecks(t, owner, api);
    await staffManagementChecks(t, ownerUrl, apiUrl);
    await arenaChecks(t, ownerUrl, apiUrl);
    await contentChecks(t, ownerUrl, apiUrl);
    await validationChecks(t, ownerUrl, apiUrl);
    await clockChecks(t, ownerUrl, apiUrl);
  } finally {
    await api?.end();
    await owner?.end();
    const identity = await docker(["inspect", "--format", '{{index .Config.Labels "ingenium.schema-test"}}|{{.Config.Image}}', container]);
    assert.equal(identity, `${nonce}|${IMAGE}`, "Test container ownership changed; do not remove it.");
    await docker(["stop", "--time", "5", container]);
    assert.equal(await docker(["inspect", "--format", "{{.State.Running}}", container]), "false");
    await docker(["rm", container]);
  }
});
