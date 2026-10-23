import type { Pool } from "pg";
import { AUDIT_FAMILIES } from "./audit-policy.js";
import type {
  AuditFamily,
  StaffAuditItem,
  StaffAuditPage,
} from "./audit-policy.js";
import { uuid } from "./credentials.js";
import type { SessionDelivery } from "./credentials.js";
import { staffQuota } from "./quotas.js";
import { createStaffService } from "./staff-service.js";
import {
  AccessError,
  accessTransaction,
  decisionTime,
  first,
} from "./transaction.js";
import type { ClockGuard } from "./transaction.js";

const globalScope = "NULL::uuid AS arena_id,NULL::uuid AS round_id";
const projections: Record<AuditFamily, string> = {
  ANNOUNCEMENTS: `SELECT a.id,a.recorded_at,a.actor_id,'ANNOUNCE_'||a.scope AS action,a.outcome,a.denial_reason,a.reason,coalesce(a.team_id,a.round_id,a.arena_id) AS target_id,a.arena_id,a.round_id FROM announcements a`,
  ROUND: `SELECT a.id,a.recorded_at,a.actor_id,a.action,a.result->>'status' AS outcome,a.result->>'reason' AS denial_reason,a.reason,
    a.round_id AS target_id,r.arena_instance_id AS arena_id,a.round_id FROM competition_outcomes a JOIN rounds r ON r.id=a.round_id WHERE a.staff_session_id IS NOT NULL`,
  ARENA: `SELECT a.id,a.recorded_at,a.actor_id,a.action,a.outcome,a.denial_reason,a.reason,coalesce(a.result_round_id,a.round_id) AS target_id,
    r.arena_instance_id AS arena_id,r.id AS round_id FROM arena_setup_outcomes a LEFT JOIN rounds r ON r.id=coalesce(a.result_round_id,a.round_id)`,
  DISCIPLINE: `SELECT a.id,a.recorded_at,a.actor_id,a.action,a.outcome,a.denial_reason,a.reason,coalesce(a.member_id,a.team_id) AS target_id,a.arena_id,a.round_id FROM discipline_outcomes a`,
  REPLACEMENTS: `SELECT a.id,a.recorded_at,a.actor_id,a.action,a.outcome,a.denial_reason,a.reason,q.member_id AS target_id,r.arena_instance_id AS arena_id,q.round_id
    FROM replacement_decisions a JOIN replacement_requests q ON q.flow_id=a.flow_id JOIN rounds r ON r.id=q.round_id`,
  TEAMS: `SELECT a.id,a.recorded_at,a.actor_id,a.action,a.outcome,a.denial_reason,a.reason,coalesce(a.result_team_id,a.target_team_id) AS target_id,${globalScope} FROM team_management_outcomes a`,
  IMPORTS: `SELECT a.id,a.recorded_at,a.actor_id,'IMPORT'::text AS action,a.outcome,a.denial_reason,a.reason,NULL::uuid AS target_id,${globalScope} FROM registration_import_outcomes a`,
  CONTENT: `SELECT a.id,a.recorded_at,a.actor_id,a.action,a.outcome,a.denial_reason,a.reason,coalesce(a.result_version_id,a.version_id,a.definition_id) AS target_id,${globalScope} FROM content_outcomes a`,
  CONTENT_READS: `SELECT a.id,a.recorded_at,a.actor_id,a.section AS action,'READ'::text AS outcome,NULL::text AS denial_reason,''::text AS reason,a.version_id AS target_id,${globalScope} FROM content_read_audits a`,
  PREPARATION: `SELECT a.id,a.recorded_at,a.actor_id,'PREPARE'::text AS action,a.outcome,a.denial_reason,a.reason,a.version_id AS target_id,${globalScope} FROM validation_preparation_outcomes a`,
  SNAPSHOT_READS: `SELECT a.id,a.recorded_at,a.actor_id,a.section AS action,'READ'::text AS outcome,NULL::text AS denial_reason,''::text AS reason,coalesce(a.snapshot_id,a.version_id) AS target_id,${globalScope} FROM validation_snapshot_audits a`,
  VALIDATION: `SELECT a.id,a.recorded_at,a.actor_id,'VALIDATE'::text AS action,a.outcome,a.denial_reason,a.reason,a.snapshot_id AS target_id,${globalScope} FROM validation_run_outcomes a`,
  REPORT_READS: `SELECT a.id,a.recorded_at,a.actor_id,'REPORT'::text AS action,'READ'::text AS outcome,NULL::text AS denial_reason,''::text AS reason,a.run_id AS target_id,${globalScope} FROM validation_run_audits a`,
  PUBLICATION: `SELECT a.id,a.recorded_at,a.actor_id,'PUBLISH'::text AS action,a.outcome,a.denial_reason,a.review AS reason,a.snapshot_id AS target_id,${globalScope} FROM content_publication_outcomes a`,
  SUBMISSION_REVIEWS: `SELECT a.id,a.recorded_at,a.actor_id,'REVIEW'::text AS action,'READ'::text AS outcome,NULL::text AS denial_reason,a.reason,a.parent_id AS target_id,r.arena_instance_id AS arena_id,a.round_id FROM submission_review_audits a JOIN rounds r ON r.id=a.round_id`,
  DIAGNOSTICS: `SELECT a.id,a.recorded_at,a.actor_id,'DIAGNOSTIC'::text AS action,'READ'::text AS outcome,NULL::text AS denial_reason,a.reason,a.run_id AS target_id,${globalScope} FROM validation_diagnostic_audits a`,
  CLOCK: `SELECT a.id,a.recorded_at,a.staff_id AS actor_id,'CLEAR_CLOCK'::text AS action,'APPLIED'::text AS outcome,NULL::text AS denial_reason,a.reason,a.id AS target_id,${globalScope} FROM clock_clearances a`,
  STAFF: `SELECT a.id,a.recorded_at,a.actor_id,a.action,a.outcome,a.denial_reason,a.reason,coalesce(a.result_staff_id,a.target_staff_id) AS target_id,${globalScope} FROM staff_management_outcomes a`,
};
export function auditScope(
  family: unknown,
  arena?: string,
  after?: string,
): AuditFamily {
  if (typeof family !== "string" || !Object.hasOwn(AUDIT_FAMILIES, family))
    throw new AccessError("INVALID_CONTEXT");
  const key = family as AuditFamily;
  if (arena !== undefined) {
    uuid(arena);
    if (!AUDIT_FAMILIES[key].arena) throw new AccessError("INVALID_CONTEXT");
  }
  if (after !== undefined) uuid(after);
  return key;
}
export function createStaffAuditService(
  pool: Pool,
  clock: ClockGuard,
  delivery: SessionDelivery,
) {
  const staff = createStaffService(pool, clock, delivery);
  return {
    async list(
      cookie: unknown,
      family: unknown,
      arena?: string,
      after?: string,
    ): Promise<StaffAuditPage> {
      const key = auditScope(family, arena, after),
        initial = await staff.inspect(cookie);
      function permitted(role: string) {
        if (
          role === "ORGANISER" ||
          (AUDIT_FAMILIES[key].superAdmin && role !== "SUPER_ADMIN")
        )
          throw new AccessError("ACCESS_UNAVAILABLE");
      }
      permitted(initial.role);
      await staffQuota(pool, clock, initial.staff_id, "READ_STAFF");
      return accessTransaction(
        pool,
        clock,
        async (client) => {
          const actor = await staff.authorize(
            client,
            cookie,
            await decisionTime(client, clock),
          );
          permitted(actor.role);
          if (
            arena &&
            !(await first(
              client,
              "SELECT id FROM arena_instances WHERE id=$1",
              [arena],
            ))
          )
            throw new AccessError("ACCESS_UNAVAILABLE");
          const source = `WITH records AS NOT MATERIALIZED (${projections[key]})`;
          if (
            after &&
            !(await first(
              client,
              `${source} SELECT id FROM records WHERE id=$1 AND ($2::uuid IS NULL OR arena_id=$2)`,
              [after, arena ?? null],
            ))
          )
            throw new AccessError("INVALID_CONTEXT");
          const rows = (
            await client.query<
              Omit<StaffAuditItem, "recorded_at"> & { recorded_at: Date }
            >(
              `${source}
        SELECT a.id,a.recorded_at,a.actor_id,i.display_name AS actor_name,a.action,a.outcome,a.denial_reason,a.reason,a.target_id,a.arena_id,a.round_id
        FROM records a JOIN staff_identities i ON i.id=a.actor_id
        WHERE ($1::uuid IS NULL OR a.arena_id=$1) AND ($2::uuid IS NULL OR (a.recorded_at,a.id)<(SELECT recorded_at,id FROM records WHERE id=$2))
        ORDER BY a.recorded_at DESC,a.id DESC LIMIT 41`,
              [arena ?? null, after ?? null],
            )
          ).rows;
          return {
            family: key,
            arena_id: arena ?? null,
            items: rows.slice(0, 40).map((row) => ({
              ...row,
              recorded_at: row.recorded_at.toISOString(),
            })),
            next_after: rows.length > 40 ? rows[39]!.id : null,
          };
        },
        "SHARED",
      );
    },
  };
}
