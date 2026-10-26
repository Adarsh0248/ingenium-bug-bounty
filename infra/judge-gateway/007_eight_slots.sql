-- Judge database only. Does not modify an existing permit, result, host or readiness lease.
BEGIN;
CREATE OR REPLACE FUNCTION ingenium_judge.claim(e uuid,b uuid,a uuid,t uuid,w uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c ingenium_judge.control%ROWTYPE; v ingenium_judge.attempts%ROWTYPE;
BEGIN
  SELECT * INTO c FROM ingenium_judge.control WHERE id=1 FOR UPDATE;
  IF c.epoch IS DISTINCT FROM e OR c.boot_id IS DISTINCT FROM b OR c.state<>'ACTIVE' OR c.ready_until<=clock_timestamp() OR NOT ingenium_judge.compatible() THEN RAISE EXCEPTION 'Supervisor unavailable' USING ERRCODE='55000'; END IF;
  SELECT * INTO v FROM ingenium_judge.attempts WHERE attempt_id=a AND epoch=e AND provider_token=t FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Wrong execution binding'; END IF;
  IF v.permit_owner IS NOT NULL THEN RETURN NULL; END IF;
  IF w IS NULL OR (SELECT count(*) FROM ingenium_judge.attempts WHERE permit_owner IS NOT NULL AND drain IS NULL)>=8 THEN RETURN NULL; END IF;
  UPDATE ingenium_judge.attempts SET permit_owner=w,started_at=clock_timestamp() WHERE attempt_id=a;
  RETURN v.envelope;
END $$;
CREATE OR REPLACE FUNCTION ingenium_judge.held_executions(e uuid,b uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
  IF NOT EXISTS(SELECT FROM ingenium_judge.control WHERE epoch=e AND boot_id=b) THEN RAISE EXCEPTION 'Wrong host'; END IF;
  IF (SELECT count(*) FROM ingenium_judge.attempts WHERE epoch=e AND permit_owner IS NOT NULL AND drain IS NULL)>8 THEN RAISE EXCEPTION 'Physical hold bound exceeded'; END IF;
  RETURN (SELECT coalesce(jsonb_agg(attempt_id ORDER BY started_at,attempt_id),'[]'::jsonb)
    FROM ingenium_judge.attempts WHERE epoch=e AND permit_owner IS NOT NULL AND drain IS NULL);
END $$;
COMMIT;
