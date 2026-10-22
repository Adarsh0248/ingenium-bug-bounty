import type { Pool } from "pg";
import { canonicalCode, sha256, uuid } from "./credentials.js";
import type { SessionDelivery } from "./credentials.js";
import { boundedStaffText, staffRevision } from "./staff-management.js";
import {
  createStaffService,
  confirmStaffCode,
  staffOutcomeCapacity,
} from "./staff-service.js";
import { staffQuota } from "./quotas.js";
import { lockedRounds } from "./entry-service.js";
import {
  AccessError,
  accessTransaction,
  decisionTime,
  first,
  advanceRoundTime,
} from "./transaction.js";
import type { ClockGuard } from "./transaction.js";

export interface DisciplineCommand {
  action: "BLOCK" | "UNBLOCK" | "PENALISE" | "REVERSE";
  arenaId: string;
  teamId: string;
  memberId: string | null;
  roundId: string | null;
  blockId: string | null;
  originalId: string | null;
  minutes: number | null;
  expectedRevision: string;
  requestKey: string;
  reason: string;
  ownCode: unknown;
}
interface Receipt {
  id: string;
  request_key: string;
  action: string;
  arena_id: string;
  team_id: string;
  member_id: string | null;
  round_id: string | null;
  block_id: string | null;
  original_id: string | null;
  minutes: number | null;
  expected_revision: string;
  outcome: string;
  denial_reason: string | null;
  recorded_at: Date;
}
function view(r: Receipt) {
  return {
    outcome_id: r.id,
    request_key: r.request_key,
    action: r.action,
    arena_id: r.arena_id,
    team_id: r.team_id,
    member_id: r.member_id,
    round_id: r.round_id,
    block_id: r.block_id,
    original_id: r.original_id,
    minutes: r.minutes,
    expected_revision: r.expected_revision,
    outcome: r.outcome,
    reason: r.denial_reason,
    recorded_at: r.recorded_at.toISOString(),
  };
}
export function createDisciplineService(
  pool: Pool,
  clock: ClockGuard,
  delivery: SessionDelivery,
) {
  const staff = createStaffService(pool, clock, delivery);
  async function principal(
    client: Parameters<typeof staff.authorize>[0],
    cookie: unknown,
    now: Date,
  ) {
    const actor = await staff.authorize(client, cookie, now);
    if (actor.role === "ORGANISER") throw new AccessError("ACCESS_UNAVAILABLE");
    return actor;
  }
  async function budget(cookie: unknown, write = false) {
    const actor = await staff.inspect(cookie);
    if (actor.role === "ORGANISER") throw new AccessError("ACCESS_UNAVAILABLE");
    await staffQuota(
      pool,
      clock,
      actor.staff_id,
      write ? "STAFF_COMMAND" : "READ_STAFF",
    );
    if (write) await staffQuota(pool, clock, actor.staff_id, "STAFF_CONFIRM");
  }
  return {
    async command(cookie: unknown, input: DisciplineCommand) {
      for (const id of [input.arenaId, input.teamId, input.requestKey])
        uuid(id);
      for (const id of [
        input.memberId,
        input.roundId,
        input.blockId,
        input.originalId,
      ])
        if (id !== null) uuid(id);
      staffRevision(input.expectedRevision);
      boundedStaffText(input.reason, 1024);
      if (
        !["BLOCK", "UNBLOCK", "PENALISE", "REVERSE"].includes(input.action) ||
        (["BLOCK", "UNBLOCK"].includes(input.action) &&
          (input.roundId !== null ||
            input.originalId !== null ||
            input.minutes !== null ||
            (input.action === "BLOCK"
              ? input.blockId !== null
              : input.blockId === null))) ||
        (["PENALISE", "REVERSE"].includes(input.action) &&
          (input.roundId === null ||
            input.memberId !== null ||
            input.blockId !== null ||
            (input.action === "PENALISE"
              ? input.originalId !== null ||
                !Number.isInteger(input.minutes) ||
                input.minutes! < 1 ||
                input.minutes! > 300
              : input.originalId === null || input.minutes !== null)))
      )
        throw new AccessError("INVALID_CONTEXT");
      await budget(cookie, true);
      return accessTransaction(
        pool,
        clock,
        async (client) => {
          await client.query("SELECT * FROM lock_arena_control(true)");
          const rounds = (
            await client.query<{ id: string }>(
              "SELECT id FROM rounds WHERE arena_instance_id=$1 ORDER BY id",
              [input.arenaId],
            )
          ).rows.map((r) => r.id);
          await lockedRounds(client, rounds);
          const now = await decisionTime(client, clock, rounds),
            actor = await principal(client, cookie, now);
          await confirmStaffCode(client, actor, input.ownCode);
          if (
            !(await first(
              client,
              "SELECT id FROM discipline_outcomes WHERE actor_id=$1 AND request_key=$2",
              [actor.staff_id, input.requestKey],
            ))
          )
            await staffOutcomeCapacity(client);
          const r = await first<Receipt>(
            client,
            "SELECT * FROM discipline_command($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)",
            [
              actor.id,
              input.requestKey,
              input.action,
              input.arenaId,
              input.teamId,
              input.memberId,
              input.roundId,
              input.blockId,
              input.originalId,
              input.minutes,
              input.expectedRevision,
              input.reason,
              sha256(canonicalCode(input.ownCode)),
            ],
          );
          if (!r) throw new AccessError("SECURITY_UNAVAILABLE");
          await advanceRoundTime(
            client,
            rounds,
            await decisionTime(client, clock, rounds),
          );
          return { outcome: view(r) };
        },
        "EXCLUSIVE",
      ).catch((e: unknown) => {
        if (e && typeof e === "object" && "code" in e && e.code === "22023")
          throw new AccessError("INVALID_CONTEXT");
        throw e;
      });
    },
    async inspect(
      cookie: unknown,
      arenaId: string,
      teamId: string,
      roundId: string,
      after?: string,
    ) {
      for (const id of [arenaId, teamId, roundId]) uuid(id);
      if (after) uuid(after);
      await budget(cookie);
      return accessTransaction(
        pool,
        clock,
        async (client) => {
          const gate = await first<{ current_instance_id: string | null }>(
            client,
            "SELECT * FROM lock_arena_control(false)",
          );
          await lockedRounds(client, [roundId], true);
          await principal(
            client,
            cookie,
            await decisionTime(client, clock, [roundId]),
          );
          const round = await first<{
            state: string;
            revision: string;
            team_round_id: string | null;
            manual_minutes: string;
          }>(
            client,
            `SELECT r.state,r.revision,t.id AS team_round_id,discipline_minutes(t.id)::text AS manual_minutes FROM rounds r
            LEFT JOIN team_rounds t ON t.round_id=r.id AND t.team_id=$2 WHERE r.id=$1 AND r.arena_instance_id=$3
            AND (t.id IS NOT NULL OR EXISTS(SELECT 1 FROM round_draft_teams d WHERE d.round_id=r.id AND d.team_id=$2)
              OR EXISTS(SELECT 1 FROM competition_rosters d WHERE d.round_id=r.id AND d.team_id=$2))`,
            [roundId, teamId, arenaId],
          );
          if (!round) throw new AccessError("ACCESS_UNAVAILABLE");
          const rows = (
            await client.query<
              Receipt & {
                audit_reason: string;
                actor_name: string;
                actor_id: string;
                reversed: boolean;
              }
            >(
              `SELECT d.*,d.reason AS audit_reason,i.display_name AS actor_name,
          EXISTS(SELECT 1 FROM discipline_outcomes u WHERE u.original_id=d.id AND u.outcome='APPLIED') AS reversed FROM discipline_outcomes d JOIN staff_identities i ON i.id=d.actor_id
          WHERE d.arena_id=$1 AND d.team_id=$2 AND (d.round_id IS NULL OR d.round_id=$3) AND ($4::uuid IS NULL OR (d.recorded_at,d.id)<
            (SELECT recorded_at,id FROM discipline_outcomes WHERE id=$4 AND arena_id=$1 AND team_id=$2 AND (round_id IS NULL OR round_id=$3)))
          ORDER BY d.recorded_at DESC,d.id DESC LIMIT 51`,
              [arenaId, teamId, roundId, after ?? null],
            )
          ).rows;
          const blocks = (
            await client.query<{
              id: string;
              member_id: string | null;
              created_at: Date;
              reason: string;
            }>(
              `SELECT id,member_id,created_at,reason FROM access_blocks
          WHERE arena_instance_id=$1 AND cleared_at IS NULL AND (team_id=$2 OR member_id IN(SELECT id FROM team_members WHERE team_id=$2)) ORDER BY id`,
              [arenaId, teamId],
            )
          ).rows;
          const security = await first<{ revision: string }>(
            client,
            "SELECT revision FROM security_control WHERE id=1",
          );
          return {
            current: gate?.current_instance_id === arenaId,
            security_revision: security!.revision,
            round_revision: round.revision,
            state: round.state,
            enrolled: round.team_round_id !== null,
            manual_minutes: Number(round.manual_minutes),
            blocks: blocks.map((b) => ({
              block_id: b.id,
              member_id: b.member_id,
              created_at: b.created_at.toISOString(),
              reason: b.reason,
            })),
            items: rows.slice(0, 50).map((r) => ({
              ...view(r),
              audit_reason: r.audit_reason,
              actor_id: r.actor_id,
              actor_name: r.actor_name,
              reversed: r.reversed,
            })),
            next_after: rows.length > 50 ? rows[49]!.id : null,
          };
        },
        "SHARED",
      );
    },
    async outcome(cookie: unknown, key: string) {
      uuid(key);
      await budget(cookie);
      return accessTransaction(
        pool,
        clock,
        async (client) => {
          const actor = await principal(
            client,
            cookie,
            await decisionTime(client, clock),
          );
          const r = await first<Receipt>(
            client,
            "SELECT * FROM discipline_outcomes WHERE actor_id=$1 AND request_key=$2",
            [actor.staff_id, key],
          );
          return {
            status: r ? "OBSERVED" : "NOT_OBSERVED",
            outcome: r ? view(r) : null,
          };
        },
        "SHARED",
      );
    },
  };
}
