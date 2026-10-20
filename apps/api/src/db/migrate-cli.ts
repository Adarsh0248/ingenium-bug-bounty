import { migrationDatabaseUrl, migrateDatabase } from "./migrate.js";

try {
  const connectionString = migrationDatabaseUrl(process.env);
  await migrateDatabase(connectionString);
  console.log("Reviewed local database migrations applied. No application server was started.");
} catch (error) {
  const code = typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
    && /^[A-Z0-9_]{1,32}$/.test(error.code) ? ` (${error.code})` : "";
  console.error(`Migration failed${code}. Check the separate local migration credentials, migration SQL and database availability. No database was reset.`);
  process.exitCode = 1;
}
