import { Pool } from "pg";

export interface Database {
  check(): Promise<void>;
  close(): Promise<void>;
}

export async function assertApiDatabase(pool: Pool): Promise<void> {
  const result = await pool.query<{
    allowed: boolean;
  }>(`SELECT current_user=session_user
    AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication AND NOT rolbypassrls
    AND pg_has_role(current_user,'ingenium_api','MEMBER')
    AND NOT pg_has_role(current_user,'ingenium_app_worker','MEMBER')
    AND NOT pg_has_role(current_user,'ingenium_competition_worker','MEMBER')
    AND NOT has_schema_privilege(current_user,'public','CREATE')
    AND NOT has_database_privilege(current_user,current_database(),'CREATE')
    AND has_table_privilege(current_user,'public.access_credentials','SELECT')
    AND NOT EXISTS(SELECT 1 FROM unnest(ARRAY['public.access_credentials','public.bounty_awards','public.wallet_entries','public.competition_submissions','public.round_results']) AS targets(name)
      WHERE has_table_privilege(current_user,name,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
        OR has_any_column_privilege(current_user,name,'INSERT,UPDATE,REFERENCES')) AS allowed
    FROM pg_roles WHERE rolname=current_user`);
  if (result.rows[0]?.allowed !== true)
    throw new Error("Restricted event API credentials required.");
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
