import { Pool } from "pg";

export interface Database {
  check(): Promise<void>;
  close(): Promise<void>;
}

export function createDatabase(
  connectionString: string,
  onUnexpectedError: () => void,
): Database {
  const pool = new Pool({
    connectionString,
    application_name: "ingenium-api-foundation",
    max: 4,
    connectionTimeoutMillis: 1000,
    idleTimeoutMillis: 10000,
    statement_timeout: 2000,
    query_timeout: 2500,
  });

  pool.on("error", onUnexpectedError);

  return {
    async check() {
      await pool.query("SELECT 1");
    },
    async close() {
      await pool.end();
    },
  };
}
