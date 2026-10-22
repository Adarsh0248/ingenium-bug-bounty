-- Expiry is logical completion, never proof that a physical execution has stopped.
CREATE OR REPLACE FUNCTION participant_expire(subject uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE n timestamptz; expired uuid;
BEGIN
  PERFORM id FROM public.security_control WHERE id=1 FOR SHARE;
  n=public.competition_now(subject);
  PERFORM public.cancellation_progress(subject);
  FOR expired IN UPDATE public.participant_judging SET status='COMPLETED',result='INFRA_ERROR',completed_at=n
    WHERE id IN(SELECT p.id FROM public.participant_judging p WHERE p.round_id=subject AND p.lane='SAMPLE' AND p.completed_at IS NULL
      AND p.status<>'CANCELLED' AND NOT EXISTS(SELECT 1 FROM public.round_cancellations c WHERE c.round_id=subject)
      AND n>=p.created_at+interval '120 seconds' ORDER BY p.created_at,p.id LIMIT 20 FOR UPDATE) RETURNING id LOOP
    PERFORM public.participant_rebudget(expired);
  END LOOP;
END $$;
--> statement-breakpoint
CREATE FUNCTION maintain_competition_round(subject uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE n timestamptz;
BEGIN
  PERFORM id FROM public.security_control WHERE id=1 FOR UPDATE;
  PERFORM * FROM public.lock_arena_control(true);
  -- Older-round expiry still locks all affected rounds before catalogue/judge budgets.
  PERFORM r.id FROM public.rounds r CROSS JOIN public.arena_control a
    WHERE a.id=1 AND (r.id=subject OR r.arena_instance_id=a.current_instance_id) ORDER BY r.id FOR UPDATE OF r;
  IF NOT EXISTS(SELECT 1 FROM public.rounds WHERE id=subject) THEN RETURN; END IF;
  PERFORM * FROM public.lock_validation_judge();
  n=public.competition_now(subject);
  IF EXISTS(SELECT 1 FROM public.arena_control a JOIN public.rounds r ON r.arena_instance_id=a.current_instance_id WHERE a.id=1 AND r.id=subject) THEN
    PERFORM public.competition_close_due(subject,n);
  END IF;
  PERFORM public.participant_expire(subject);
END $$;
REVOKE ALL ON FUNCTION maintain_competition_round(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION maintain_competition_round(uuid) TO ingenium_api;
GRANT DELETE ON quota_buckets TO ingenium_api;
