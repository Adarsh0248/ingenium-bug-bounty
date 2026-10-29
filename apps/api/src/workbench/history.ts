import type { Pool } from "pg";
import { uuid } from "../access/credentials.js";
import { AccessError, first } from "../access/transaction.js";
import type { ClockGuard } from "../access/transaction.js";
import { judgingFeedback } from "../competition/feedback.js";
import { createParticipantReads } from "./scope.js";

export function createHistoryService(pool: Pool, clock: ClockGuard) {
  const { read } = createParticipantReads(pool, clock);
  return {
    async rounds(cookie: unknown) {
      return read(
        cookie,
        undefined,
        async (c) =>
          (
            await c.client.query(
              `SELECT r.id AS round_id,r.kind,r.state FROM rounds r
        JOIN member_rounds m ON m.round_id=r.id JOIN rounds current ON current.id=$1
        WHERE m.member_id=$2 AND m.enrolled_at IS NOT NULL AND m.language IS NOT NULL
        AND (r.id=current.id OR (current.kind=2 AND r.kind=1 AND r.state='CLOSED' AND r.arena_instance_id=current.arena_instance_id)) ORDER BY r.kind`,
              [c.roundId, c.memberId],
            )
          ).rows,
      );
    },
    async overview(cookie: unknown, round: string) {
      return read(cookie, round, async (c) => {
        const meta = await first<{
          round_id: string;
          kind: number;
          state: string;
          final: boolean;
          wallet: number;
          standings: Record<string, unknown>[];
        }>(
          c.client,
          `SELECT r.id AS round_id,r.kind,r.state,EXISTS(SELECT 1 FROM round_results WHERE round_id=r.id) AS final,
            competition_balance($2)::integer AS wallet,shop_standings(r.id) AS standings
            FROM rounds r WHERE r.id=$1`,
          [round, c.teamRoundId],
        );
        if (!meta || !Array.isArray(meta.standings))
          throw new AccessError("SECURITY_UNAVAILABLE");
        const cancelled = meta.state.startsWith("CANCEL");
        const bounties = (
          await c.client.query(
            `SELECT b.id AS bounty_id,s.title,s.difficulty,s.base_bounty,
          competition_bounty_unavailable(b.id,$2,$4) AS claimed,
          COALESCE((SELECT max(level) FROM hint_purchases WHERE bounty_id=b.id AND team_round_id=$2),0) AS hint_tier,
          EXISTS(SELECT 1 FROM code_drafts WHERE bounty_id=b.id AND member_round_id=$3) AS draft_saved,
          (SELECT points FROM bounty_awards WHERE bounty_id=b.id AND team_round_id=$2) AS awarded_points
          FROM bounties b JOIN rounds r ON r.id=b.round_id JOIN validation_snapshots s ON s.id=b.snapshot_id WHERE b.round_id=$1 ORDER BY b.position`,
            [round, c.teamRoundId, c.memberRoundId,c.now],
          )
        ).rows;
        return {
          round: {
            round_id: round,
            kind: meta.kind,
            state: meta.state,
            language: c.language,
          },
          final: meta.final,
          cancelled,
          wallet: meta.wallet,
          standings: meta.standings.map(({ wallet: _private, ...s }) => ({
            ...s,
            ...(cancelled ? { rank: null } : {}),
          })),
          bounties,
        };
      });
    },
    async attempts(cookie: unknown, round: string, after?: string) {
      if (after !== undefined) uuid(after);
      return read(cookie, round, async (c) => {
        const args = [round, c.teamRoundId, c.memberRoundId, after ?? null];
        if (
          after &&
          !(await first(
            c.client,
            `SELECT id FROM participant_judging WHERE id=$4 AND round_id=$1
          AND ((lane='OFFICIAL' AND team_round_id=$2) OR (lane='SAMPLE' AND member_round_id=$3))`,
            args,
          ))
        )
          throw new AccessError("WORKBENCH_UNAVAILABLE");
        const items = (
          await c.client.query(
            `SELECT p.id,p.bounty_id,s.title,p.member_round_id,p.language,p.lane,p.status,p.result,p.created_at,p.completed_at,
          a.id AS award_id FROM participant_judging p JOIN bounties b ON b.id=p.bounty_id JOIN validation_snapshots s ON s.id=b.snapshot_id
          LEFT JOIN bounty_awards a ON a.submission_id=p.submission_id AND a.team_round_id=$2
          WHERE p.round_id=$1 AND ((p.lane='OFFICIAL' AND p.team_round_id=$2) OR (p.lane='SAMPLE' AND p.member_round_id=$3))
          AND ($4::uuid IS NULL OR (p.created_at,p.id)>(SELECT created_at,id FROM participant_judging WHERE id=$4))
          ORDER BY p.created_at,p.id LIMIT 50`,
            args,
          )
        ).rows;
        return {
          items,
          next_after: items.length === 50 ? items.at(-1)!.id : null,
        };
      });
    },
    async wallet(cookie: unknown, round: string, after?: string) {
      if (after !== undefined) uuid(after);
      return read(cookie, round, async (c) => {
        if (
          after &&
          !(await first(
            c.client,
            "SELECT id FROM wallet_entries WHERE id=$1 AND team_round_id=$2",
            [after, c.teamRoundId],
          ))
        )
          throw new AccessError("WORKBENCH_UNAVAILABLE");
        const items = (
          await c.client.query(
            `SELECT w.id,w.amount,w.recorded_at,
          CASE WHEN w.award_id IS NOT NULL THEN 'AWARD' WHEN w.purchase_id IS NOT NULL THEN 'HINT' ELSE 'CARRYOVER' END AS kind,
          s.title,p.level AS hint_level,a.points AS awarded_points
          FROM wallet_entries w LEFT JOIN bounty_awards a ON a.id=w.award_id LEFT JOIN hint_purchases p ON p.id=w.purchase_id
          LEFT JOIN bounties b ON b.id=COALESCE(a.bounty_id,p.bounty_id) LEFT JOIN validation_snapshots s ON s.id=b.snapshot_id
          WHERE w.team_round_id=$1 AND ($2::uuid IS NULL OR (w.recorded_at,w.id)>(SELECT recorded_at,id FROM wallet_entries WHERE id=$2))
          ORDER BY w.recorded_at,w.id LIMIT 50`,
            [c.teamRoundId, after ?? null],
          )
        ).rows;
        return {
          items,
          next_after: items.length === 50 ? items.at(-1)!.id : null,
        };
      });
    },
    async execution(cookie: unknown, round: string, parent: string) {
      uuid(parent);
      return read(cookie, round, (c) =>
        judgingFeedback(c.client, round, c.memberRoundId, parent),
      );
    },
    async hints(cookie: unknown, round: string, bounty: string) {
      uuid(bounty);
      return read(
        cookie,
        round,
        async (c) =>
          (
            await c.client.query(
              `SELECT h.level,h.content,p.recorded_at FROM hint_purchases p
        JOIN bounties b ON b.id=p.bounty_id JOIN validation_snapshot_hints h ON h.snapshot_id=b.snapshot_id AND h.level=p.level
        WHERE b.round_id=$1 AND b.id=$2 AND p.team_round_id=$3 ORDER BY h.level`,
              [round, bounty, c.teamRoundId],
            )
          ).rows,
      );
    },
  };
}
