import type { Pool, PoolClient } from "pg";
import { uuid } from "../access/credentials.js";
import type { SessionDelivery } from "../access/credentials.js";
import { createStaffService } from "../access/staff-service.js";
import { staffQuota } from "../access/quotas.js";
import { lockedRounds } from "../access/entry-service.js";
import {
  AccessError,
  accessTransaction,
  decisionTime,
  first,
} from "../access/transaction.js";
import type { ClockGuard } from "../access/transaction.js";
import { recoveryReason } from "./recovery-policy.js";

export const JUDGING_VIEWS = [
  "ACTIVE",
  "ALL",
  "ATTENTION",
  "COMPLETED",
  "CANCELLED",
] as const;
export interface JudgingFilters {
  view?: (typeof JUDGING_VIEWS)[number];
  team_id?: string;
  lane?: "OFFICIAL" | "SAMPLE";
}
const held = `EXISTS(SELECT 1 FROM participant_jobs x JOIN participant_attempts a ON a.job_id=x.id WHERE x.parent_id=p.id AND a.released_at IS NULL)`;
const parentColumns = `p.id,p.lane,p.bounty_id,s.title,t.team_id,t.display_name AS team_name,p.language,p.status,p.result,p.created_at,p.completed_at`;
const parentTables = `participant_judging p JOIN team_rounds t ON t.id=p.team_round_id JOIN bounties b ON b.id=p.bounty_id JOIN validation_snapshots s ON s.id=b.snapshot_id`;
// Rejected legacy receipts retain their job binding in the canonical structured fingerprint.
const auditBinding = `o.round_id=$1 AND o.action='RETRY_JOB' AND o.staff_session_id IS NOT NULL
  AND o.fingerprint=sha256(convert_to(jsonb_build_array('RETRY_JOB',jsonb_build_object('job_id',$2::uuid),0,o.reason)::text,'UTF8'))`;
export function createStaffJudgingService(
  pool: Pool,
  clock: ClockGuard,
  delivery: SessionDelivery,
) {
  const staff = createStaffService(pool, clock, delivery);
  async function read<T>(
    cookie: unknown,
    round: string,
    work: (
      client: PoolClient,
      role: string,
      state: string,
      now: Date,
    ) => Promise<T>,
  ) {
    uuid(round);
    const initial = await staff.inspect(cookie);
    await staffQuota(pool, clock, initial.staff_id, "READ_STAFF");
    return accessTransaction(
      pool,
      clock,
      async (client) => {
        await lockedRounds(client, [round], true);
        const now = await decisionTime(client, clock, [round]),
          actor = await staff.authorize(client, cookie, now);
        const row = await first<{ state: string }>(
          client,
          "SELECT state FROM rounds WHERE id=$1",
          [round],
        );
        if (!row) throw new AccessError("ROUND_UNAVAILABLE");
        return work(client, actor.role, row.state, now);
      },
      "SHARED",
    );
  }
  return {
    async queue(
      cookie: unknown,
      round: string,
      after?: string,
      filters: JudgingFilters = {},
    ) {
      if (after !== undefined) uuid(after);
      if (filters.team_id !== undefined) uuid(filters.team_id);
      if (
        (filters.view !== undefined && !JUDGING_VIEWS.includes(filters.view)) ||
        (filters.lane !== undefined &&
          !["OFFICIAL", "SAMPLE"].includes(filters.lane))
      )
        throw new AccessError("INVALID_CONTEXT");
      return read(cookie, round, async (client, _role, state, now) => {
        if (
          after &&
          !(await first(
            client,
            "SELECT id FROM participant_judging WHERE id=$1 AND round_id=$2",
            [after, round],
          ))
        )
          throw new AccessError("ACCESS_UNAVAILABLE");
        const scope = `p.round_id=$1 AND ($2::uuid IS NULL OR t.team_id=$2) AND ($3::text IS NULL OR p.lane=$3)`;
        const summary = await first(
          client,
          `SELECT count(*)::integer AS total,
          count(*) FILTER(WHERE p.completed_at IS NULL AND p.status<>'CANCELLED')::integer AS unfinished,
          count(*) FILTER(WHERE p.status IN ('RECOVERING','NEEDS_ATTENTION'))::integer AS attention,
          count(*) FILTER(WHERE p.status='COMPLETED')::integer AS completed,
          count(*) FILTER(WHERE ${held})::integer AS physically_held FROM ${parentTables} WHERE ${scope}`,
          [round, filters.team_id ?? null, filters.lane ?? null],
        );
        const view = filters.view ?? "ACTIVE",
          predicate =
            view === "ALL"
              ? "true"
              : view === "ATTENTION"
                ? "p.status IN ('RECOVERING','NEEDS_ATTENTION')"
                : view === "COMPLETED" || view === "CANCELLED"
                  ? `p.status='${view}'`
                  : `(p.completed_at IS NULL AND p.status<>'CANCELLED' OR ${held})`;
        const parents = (
          await client.query(
            `SELECT ${parentColumns},
          (SELECT jsonb_agg(jsonb_build_object('id',j.id,'status',j.status,'dispatches',(SELECT count(*) FROM participant_attempts a WHERE a.job_id=j.id),
            'physically_held',EXISTS(SELECT 1 FROM participant_attempts a WHERE a.job_id=j.id AND a.released_at IS NULL)) ORDER BY j.position)
            FROM participant_jobs j WHERE j.parent_id=p.id) AS jobs
          FROM ${parentTables} WHERE ${scope} AND ${predicate}
            AND ($4::uuid IS NULL OR p.queue_order>(SELECT queue_order FROM participant_judging WHERE id=$4))
          ORDER BY p.queue_order LIMIT 40`,
            [
              round,
              filters.team_id ?? null,
              filters.lane ?? null,
              after ?? null,
            ],
          )
        ).rows;
        return {
          parents,
          next_after:
            parents.length === 40 ? (parents.at(-1)!.id as string) : null,
          summary,
          round_state: state,
          server_time: now.toISOString(),
        };
      });
    },
    async detail(cookie: unknown, round: string, parentId: string) {
      uuid(parentId);
      return read(cookie, round, async (client, role, state, now) => {
        const parent = await first(
          client,
          `SELECT ${parentColumns},p.started_at,sub.receipt_order::text
          FROM ${parentTables} LEFT JOIN competition_submissions sub ON sub.id=p.submission_id WHERE p.id=$2 AND p.round_id=$1`,
          [round, parentId],
        );
        if (!parent) throw new AccessError("ACCESS_UNAVAILABLE");
        const jobs = (
          await client.query(
            `SELECT j.id,j.status,j.result,j.available_at,j.completed_at,
          EXISTS(SELECT 1 FROM participant_retry_permissions WHERE job_id=j.id) AS extra_authorised,
          COALESCE((SELECT jsonb_agg(jsonb_build_object('id',a.id,'number',a.number,'send_state',a.send_state,'prepared_at',a.prepared_at,
            'send_started_at',a.send_started_at,'result',a.result,'resolved_at',a.resolved_at,'released_at',a.released_at,'next_poll_at',a.next_poll_at) ORDER BY a.number)
            FROM participant_attempts a WHERE a.job_id=j.id),'[]'::jsonb) AS attempts
          FROM participant_jobs j WHERE j.parent_id=$1 ORDER BY j.position`,
            [parentId],
          )
        ).rows;
        return {
          parent,
          role,
          round_state: state,
          server_time: now.toISOString(),
          jobs: jobs.map((j) => {
            const reason = recoveryReason({
              role,
              roundState: state,
              lane: parent.lane,
              parentCompleted: parent.completed_at !== null,
              jobStatus: j.status,
              jobResult: j.result,
              extraAuthorised: j.extra_authorised,
              attempts: j.attempts,
            });
            return {
              ...j,
              retry_allowed: reason === "ELIGIBLE",
              retry_reason: reason,
            };
          }),
        };
      });
    },
    async audit(cookie: unknown, round: string, jobId: string, after?: string) {
      uuid(jobId);
      if (after !== undefined) uuid(after);
      return read(cookie, round, async (client, role) => {
        if (!["OWNER", "SUPER_ADMIN"].includes(role))
          throw new AccessError("ACCESS_UNAVAILABLE");
        if (
          !(await first(
            client,
            "SELECT j.id FROM participant_jobs j JOIN participant_judging p ON p.id=j.parent_id WHERE j.id=$1 AND p.round_id=$2",
            [jobId, round],
          ))
        )
          throw new AccessError("ACCESS_UNAVAILABLE");
        if (
          after &&
          !(await first(
            client,
            `SELECT o.id FROM competition_outcomes o WHERE ${auditBinding} AND o.id=$3`,
            [round, jobId, after],
          ))
        )
          throw new AccessError("ACCESS_UNAVAILABLE");
        const items = (
          await client.query(
            `SELECT o.id,i.display_name AS actor_name,o.reason,o.recorded_at,o.result->>'status' AS decision,o.result->>'reason' AS reason_code
          FROM competition_outcomes o JOIN staff_identities i ON i.id=o.actor_id WHERE ${auditBinding}
          AND ($3::uuid IS NULL OR (o.recorded_at,o.id)>(SELECT recorded_at,id FROM competition_outcomes WHERE id=$3)) ORDER BY o.recorded_at,o.id LIMIT 40`,
            [round, jobId, after ?? null],
          )
        ).rows;
        return {
          items,
          next_after: items.length === 40 ? (items.at(-1)!.id as string) : null,
        };
      });
    },
  };
}
