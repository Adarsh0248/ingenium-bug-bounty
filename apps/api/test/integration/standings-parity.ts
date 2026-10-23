import assert from "node:assert/strict";
import type { Pool } from "pg";

// The pre-optimisation formula is the oracle, including wallet privacy handled by callers.
export async function standingsParity(pool: Pool) {
  const rounds = (await pool.query("SELECT id FROM rounds ORDER BY id")).rows;
  for (const { id } of rounds) {
    const result = (await pool.query(`WITH totals AS (
      SELECT t.id AS team_round_id,t.team_id,t.display_name AS team_name,public.competition_balance(t.id) AS wallet,
        COALESCE((SELECT sum(points) FROM public.bounty_awards WHERE team_round_id=t.id),0)
          -CASE WHEN r.kind=1 THEN COALESCE((SELECT sum(price) FROM public.hint_purchases WHERE team_round_id=t.id),0) ELSE 0 END AS points,
        COALESCE((SELECT sum(s.elapsed_ms) FROM public.bounty_awards a JOIN public.competition_submissions s ON s.id=a.submission_id WHERE a.team_round_id=t.id),0)::bigint AS solve_time_ms,
        (COALESCE((SELECT sum(milliseconds) FROM public.wrong_submission_penalties WHERE team_round_id=t.id),0)+60000*public.discipline_minutes(t.id))::bigint AS penalty_ms,
        COALESCE((SELECT array_agg(v.difficulty ORDER BY v.difficulty DESC) FROM public.bounty_awards a JOIN public.bounties b ON b.id=a.bounty_id
          JOIN public.validation_snapshots v ON v.id=b.snapshot_id WHERE a.team_round_id=t.id),'{}'::integer[]) AS difficulties
      FROM public.team_rounds t JOIN public.rounds r ON r.id=t.round_id WHERE t.round_id=$1
    ), positions AS (SELECT *,solve_time_ms+penalty_ms effective_time_ms,rank() OVER(ORDER BY points DESC,solve_time_ms+penalty_ms,difficulties DESC) rank FROM totals)
    SELECT public.competition_standings($1) actual,coalesce(jsonb_agg(to_jsonb(p) ORDER BY rank,team_round_id),'[]'::jsonb) expected FROM positions p`, [id])).rows[0];
    assert.deepEqual(result.actual, result.expected, "Sporting optimisation must preserve every exact field, rank and order.");
  }
}
