-- Compute each sporting input once per roster, not once per team per snapshot.
CREATE OR REPLACE FUNCTION competition_standings(subject uuid) RETURNS jsonb LANGUAGE sql STABLE SET search_path=pg_catalog,public AS $$
  WITH roster AS MATERIALIZED (
    SELECT t.id,t.team_id,t.display_name,r.kind FROM public.team_rounds t JOIN public.rounds r ON r.id=t.round_id WHERE t.round_id=subject
  ), awards AS (
    SELECT a.team_round_id,sum(a.points) points,sum(s.elapsed_ms)::bigint solve_time_ms,array_agg(v.difficulty ORDER BY v.difficulty DESC) difficulties
    FROM public.bounty_awards a JOIN roster t ON t.id=a.team_round_id
    JOIN public.competition_submissions s ON s.id=a.submission_id JOIN public.bounties b ON b.id=a.bounty_id
    JOIN public.validation_snapshots v ON v.id=b.snapshot_id GROUP BY a.team_round_id
  ), wallets AS (
    SELECT w.team_round_id,sum(w.amount)::bigint wallet FROM public.wallet_entries w JOIN roster t ON t.id=w.team_round_id GROUP BY w.team_round_id
  ), hints AS (
    SELECT h.team_round_id,sum(h.price) price FROM public.hint_purchases h JOIN roster t ON t.id=h.team_round_id GROUP BY h.team_round_id
  ), automatic AS (
    SELECT p.team_round_id,sum(p.milliseconds) milliseconds FROM public.wrong_submission_penalties p JOIN roster t ON t.id=p.team_round_id GROUP BY p.team_round_id
  ), manual AS (
    SELECT d.team_round_id,sum(d.minutes)::bigint minutes FROM public.discipline_outcomes d JOIN roster t ON t.id=d.team_round_id
    WHERE d.action='PENALISE' AND d.outcome='APPLIED' AND NOT EXISTS(
      SELECT 1 FROM public.discipline_outcomes u WHERE u.original_id=d.id AND u.action='REVERSE' AND u.outcome='APPLIED'
    ) GROUP BY d.team_round_id
  ), totals AS (
    SELECT t.id AS team_round_id,t.team_id,t.display_name AS team_name,coalesce(w.wallet,0)::bigint wallet,
      coalesce(a.points,0)-CASE WHEN t.kind=1 THEN coalesce(h.price,0) ELSE 0 END AS points,
      coalesce(a.solve_time_ms,0)::bigint solve_time_ms,
      (coalesce(p.milliseconds,0)+60000*coalesce(d.minutes,0))::bigint penalty_ms,
      coalesce(a.difficulties,'{}'::integer[]) difficulties
    FROM roster t LEFT JOIN awards a ON a.team_round_id=t.id LEFT JOIN wallets w ON w.team_round_id=t.id
    LEFT JOIN hints h ON h.team_round_id=t.id LEFT JOIN automatic p ON p.team_round_id=t.id LEFT JOIN manual d ON d.team_round_id=t.id
  ), positions AS (
    SELECT *,solve_time_ms+penalty_ms effective_time_ms,rank() OVER(ORDER BY points DESC,solve_time_ms+penalty_ms,difficulties DESC) rank FROM totals
  ) SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY rank,team_round_id),'[]'::jsonb) FROM positions p;
$$;
