ALTER TABLE public.participant_judging ADD COLUMN sample_expiry_policy integer NOT NULL DEFAULT 1
  CHECK (sample_expiry_policy IN (1,2));
ALTER TABLE public.participant_judging ALTER COLUMN sample_expiry_policy SET DEFAULT 2;
-- Preserve every completed result; only still-pending samples adopt queue-aware expiry.
UPDATE public.participant_judging SET sample_expiry_policy=2 WHERE lane='SAMPLE' AND completed_at IS NULL;
--> statement-breakpoint
CREATE FUNCTION public.sample_run_expired(p public.participant_judging,n timestamptz) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
  SELECT CASE WHEN p.sample_expiry_policy=1 THEN n>=p.created_at+interval '120 seconds'
    ELSE p.started_at IS NOT NULL AND n>=greatest(p.started_at,
      COALESCE((SELECT max(a.prepared_at) FROM public.participant_attempts a JOIN public.participant_jobs j ON j.id=a.job_id
        WHERE j.parent_id=p.id AND a.prepared_at<=n),p.started_at),
      COALESCE((SELECT max(a.resolved_at) FROM public.participant_attempts a JOIN public.participant_jobs j ON j.id=a.job_id
        WHERE j.parent_id=p.id AND a.resolved_at<=n),p.started_at))+interval '120 seconds' END
$$;
REVOKE ALL ON FUNCTION public.sample_run_expired(public.participant_judging,timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sample_run_expired(public.participant_judging,timestamptz) TO ingenium_api,ingenium_app_worker;
--> statement-breakpoint
DO $$
DECLARE signature text; definition text; before_text text; after_text text;
BEGIN
  FOREACH signature IN ARRAY ARRAY[
    'public.competition_participant_command(uuid,uuid,uuid,text,jsonb)',
    'public.participant_refresh(timestamp with time zone)',
    'public.participant_expire(uuid)'
  ] LOOP
    definition=pg_get_functiondef(signature::regprocedure);
    before_text=CASE WHEN signature='public.participant_expire(uuid)' THEN 'n>=p.created_at+interval ''120 seconds''' ELSE 'n>=created_at+interval ''120 seconds''' END;
    after_text=CASE WHEN signature='public.participant_expire(uuid)' THEN 'public.sample_run_expired(p,n)' ELSE 'public.sample_run_expired(participant_judging,n)' END;
    IF (length(definition)-length(replace(definition,before_text,'')))/length(before_text)<>1 THEN
      RAISE EXCEPTION 'Expected one reviewed sample deadline in %',signature;
    END IF;
    EXECUTE replace(definition,before_text,after_text);
  END LOOP;
  definition=pg_get_functiondef('public.participant_candidate(timestamp with time zone,uuid)'::regprocedure);
  before_text='n<p.created_at+interval ''120 seconds''';
  IF strpos(definition,before_text)=0 THEN RAISE EXCEPTION 'Reviewed sample scheduling deadline missing'; END IF;
  EXECUTE replace(definition,before_text,'NOT public.sample_run_expired(p,n)');
  definition=pg_get_functiondef('public.participant_plan_integrity()'::regprocedure);
  before_text='p.completed_at<p.created_at+interval ''120 seconds''';
  IF strpos(definition,before_text)=0 THEN RAISE EXCEPTION 'Reviewed sample failure deadline missing'; END IF;
  definition=replace(definition,before_text,'NOT public.sample_run_expired(p,p.completed_at)');
  before_text='p.completed_at>=p.created_at+interval ''120 seconds''';
  IF strpos(definition,before_text)=0 THEN RAISE EXCEPTION 'Reviewed sample completion deadline missing'; END IF;
  EXECUTE replace(definition,before_text,'public.sample_run_expired(p,p.completed_at)');
END $$;
--> statement-breakpoint
CREATE FUNCTION public.guard_sample_expiry_policy() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
  IF NEW.sample_expiry_policy IS DISTINCT FROM OLD.sample_expiry_policy THEN RAISE EXCEPTION 'Sample expiry policy is immutable'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER sample_expiry_policy_immutable BEFORE UPDATE ON public.participant_judging
  FOR EACH ROW EXECUTE FUNCTION public.guard_sample_expiry_policy();
REVOKE ALL ON FUNCTION public.guard_sample_expiry_policy() FROM PUBLIC;
