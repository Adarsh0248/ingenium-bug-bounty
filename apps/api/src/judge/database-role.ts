import type { Pool } from "pg";

// Seven service connections leave room for sixteen launchers, readiness and PostgreSQL's reserved slots.
export const JUDGE_DATABASE_POOLS = Object.freeze({ gateway: 2, supervisor: 4, publisher: 1 });
const roles = { gateway: "ingenium_judge_gateway", supervisor: "ingenium_judge_supervisor", publisher: "ingenium_judge_publisher" } as const;
export async function assertJudgeDatabaseRole(database: Pick<Pool, "query">, kind: keyof typeof roles) {
  if (!Object.hasOwn(roles, kind)) throw new Error("Invalid judge service role.");
  const required = roles[kind];
  const row = (await database.query<{ allowed: boolean }>(`SELECT NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication AND NOT rolbypassrls
    AND pg_has_role(current_user,$1::text,'MEMBER')
    AND NOT EXISTS(SELECT FROM unnest($2::text[]) r WHERE pg_has_role(current_user,r,'MEMBER'))
    AND NOT has_schema_privilege(current_user,'public','CREATE') AND NOT has_schema_privilege(current_user,'ingenium_judge','CREATE')
    AND NOT has_table_privilege(current_user,'ingenium_judge.control','SELECT,INSERT,UPDATE,DELETE,TRUNCATE')
    AND NOT has_table_privilege(current_user,'ingenium_judge.attempts','SELECT,INSERT,UPDATE,DELETE,TRUNCATE')
    AND NOT has_table_privilege(current_user,'public.submissions','SELECT,INSERT,UPDATE,DELETE,TRUNCATE') AS allowed
    FROM pg_roles WHERE rolname=current_user`, [required, Object.values(roles).filter(role => role !== required)])).rows[0];
  if (!row?.allowed) throw new Error("Separate restricted judge service credentials required.");
}
