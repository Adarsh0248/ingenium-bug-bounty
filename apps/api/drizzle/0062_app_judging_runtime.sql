DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='ingenium_app_worker') THEN CREATE ROLE ingenium_app_worker NOLOGIN; END IF;
END $$;
GRANT ingenium_competition_worker TO ingenium_app_worker;
GRANT SELECT ON validation_runs,authoring_checks,authoring_attempts,validation_snapshot_checks TO ingenium_app_worker;
GRANT EXECUTE ON FUNCTION sweep_validation_run(uuid,bigint),claim_authoring_poll(uuid,bigint,uuid),prepare_authoring_attempt(uuid,bigint,uuid,uuid,bytea),
  record_authoring_result(uuid,bigint,uuid,text,jsonb,bytea,bytea,bytea,bytea) TO ingenium_app_worker;
--> statement-breakpoint
CREATE FUNCTION record_worker_clock_fault(subject uuid,observed bigint,request uuid,cause text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE h public.clock_health%ROWTYPE; old public.clock_events%ROWTYPE; generation bigint;
BEGIN
  IF subject IS NULL OR observed IS NULL OR observed<0 OR request IS NULL OR cause IS NULL OR cause NOT IN ('PROBE_FAILED','INVALID_REPORT','SOURCE_UNTRUSTED','UNSYNCHRONISED','ERROR_BOUND','WALL_STEP',
    'MEASUREMENT_UNCERTAIN','STALE_REPORT','MONOTONIC_REVERSED','CLOCK_REVERSED','UNCLEAN_RESTART','DATABASE_UNAVAILABLE','RUNTIME_REPLACED') THEN RAISE EXCEPTION 'Invalid clock incident'; END IF;
  PERFORM id FROM public.security_control WHERE id=1 FOR UPDATE;
  SELECT * INTO h FROM public.clock_health WHERE id=1 FOR UPDATE;
  SELECT * INTO old FROM public.clock_events WHERE id=request;
  IF FOUND THEN
    IF old.runtime_id<>subject OR old.reason IS DISTINCT FROM cause OR old.evidence->>'consumer' IS DISTINCT FROM 'APP_JUDGING'
      OR old.evidence->>'observed_generation' IS DISTINCT FROM observed::text THEN RAISE EXCEPTION 'Clock incident key reused'; END IF;
    RETURN true;
  END IF;
  IF h.runtime_id IS DISTINCT FROM subject OR h.fault_generation IS DISTINCT FROM observed OR NOT h.running THEN RETURN false; END IF;
  IF (SELECT count(*) FROM public.clock_events)>=100000 THEN RAISE EXCEPTION 'Clock audit capacity unavailable'; END IF;
  generation=h.fault_generation+CASE WHEN h.fault_latched THEN 0 ELSE 1 END;
  UPDATE public.clock_health SET fault_latched=true,fault_generation=generation,fault_reason=COALESCE(fault_reason,cause),state='FAULT',
    healthy_count=0,healthy_since_ns=NULL,healthy_last_ns=NULL WHERE id=1;
  INSERT INTO public.clock_events(id,runtime_id,generation,kind,reason,observed_at,evidence)
    VALUES(request,subject,generation,'FAULT',cause,date_trunc('milliseconds',clock_timestamp()),jsonb_build_object('consumer','APP_JUDGING','policy',1,'observed_generation',observed::text));
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION record_worker_clock_fault(uuid,bigint,uuid,text) FROM PUBLIC,ingenium_api,ingenium_competition_worker;
GRANT EXECUTE ON FUNCTION record_worker_clock_fault(uuid,bigint,uuid,text) TO ingenium_app_worker;
