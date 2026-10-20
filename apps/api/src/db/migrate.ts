import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client } from "pg";

export const migrationsFolder = fileURLToPath(new URL("../../drizzle/", import.meta.url));

export function migrationDatabaseUrl(environment: NodeJS.ProcessEnv): string {
  const value = environment.MIGRATION_DATABASE_URL;
  if (!value) throw new Error("MIGRATION_DATABASE_URL is required; use separate schema-owner credentials.");
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("MIGRATION_DATABASE_URL must be a PostgreSQL URL.");
  }
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !["127.0.0.1", "[::1]", "localhost"].includes(url.hostname)
      || !url.username || url.username === "ingenium_api" || url.pathname.length <= 1) {
    throw new Error("This local migration command requires a loopback PostgreSQL database and a non-API owner.");
  }
  return value;
}

export async function migrateDatabase(connectionString: string): Promise<void> {
  const client = new Client({ connectionString, application_name: "ingenium-schema-migration",
    connectionTimeoutMillis: 5000, statement_timeout: 30000, lock_timeout: 5000 });
  await client.connect();
  let locked = false;
  try {
    const role = await client.query<{ allowed: boolean }>(`
      SELECT current_user <> 'ingenium_api'
        AND has_schema_privilege(current_user, 'public', 'CREATE') AS allowed
      FROM pg_roles WHERE rolname = current_user
    `);
    if (role.rows[0]?.allowed !== true) throw new Error("Schema-owner privileges are required for migrations.");
    const result = await client.query<{ acquired: boolean }>("SELECT pg_try_advisory_lock(187031, 1) AS acquired");
    locked = result.rows[0]?.acquired === true;
    if (!locked) throw new Error("Another schema migration is already running.");
    await migrate(drizzle(client), { migrationsFolder });
  } finally {
    try {
      if (locked) await client.query("SELECT pg_advisory_unlock(187031, 1)");
    } finally {
      await client.end();
    }
  }
}
