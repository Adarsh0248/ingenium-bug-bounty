import { Pool } from "pg";

export interface Database {
  check(): Promise<void>;
  close(): Promise<void>;
}

export function createDatabase(
  connectionString: string,
  onUnexpectedError: () => void,
  max = 4,
): Database & { pool: Pool } {
  const pool = new Pool({
    connectionString,
    application_name: "ingenium-api-foundation",
    max,
    connectionTimeoutMillis: 1000,
    idleTimeoutMillis: 10000,
    statement_timeout: 2000,
    query_timeout: 2500,
  });

  pool.on("error", onUnexpectedError);

  return {
    pool,
    async check() {
      await pool.query("SELECT 1");
    },
    async close() {
      await pool.end();
    },
  };
}
