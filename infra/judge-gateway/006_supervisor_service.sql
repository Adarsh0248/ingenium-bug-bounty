-- Separate judge database only. This never resets an execution permit or grants host readiness.
BEGIN;
CREATE FUNCTION ingenium_judge.service_lock(e uuid,b uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
  IF NOT EXISTS(SELECT FROM ingenium_judge.control WHERE epoch=e AND boot_id=b AND state='ACTIVE') THEN RAISE EXCEPTION 'Wrong active host'; END IF;
  RETURN pg_try_advisory_lock(1768843123,hashtext(e::text));
END $$;
CREATE FUNCTION ingenium_judge.service_session(e uuid,b uuid) RETURNS void
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
  IF NOT EXISTS(SELECT FROM pg_locks WHERE locktype='advisory' AND pid=pg_backend_pid() AND granted AND mode='ExclusiveLock'
    AND classid=1768843123::oid AND objid=hashtext(e::text)::oid AND objsubid=2
    AND database=(SELECT oid FROM pg_database WHERE datname=current_database())) THEN RAISE EXCEPTION 'Supervisor session lock required'; END IF;
END $$;
CREATE FUNCTION ingenium_judge.service_heartbeat(e uuid,b uuid,proof bytea) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
  PERFORM ingenium_judge.service_session(e,b);
  PERFORM ingenium_judge.heartbeat(e,b,proof);
END $$;
CREATE FUNCTION ingenium_judge.service_withdraw(e uuid,b uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
  PERFORM ingenium_judge.service_session(e,b);
  UPDATE ingenium_judge.control SET ready_until='-infinity',readiness_proof=NULL WHERE id=1 AND epoch=e AND boot_id=b;
  IF NOT FOUND THEN RAISE EXCEPTION 'Wrong host'; END IF;
END $$;
CREATE FUNCTION ingenium_judge.held_executions(e uuid,b uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
  IF NOT EXISTS(SELECT FROM ingenium_judge.control WHERE epoch=e AND boot_id=b) THEN RAISE EXCEPTION 'Wrong host'; END IF;
  IF (SELECT count(*) FROM ingenium_judge.attempts WHERE epoch=e AND permit_owner IS NOT NULL AND drain IS NULL)>2 THEN RAISE EXCEPTION 'Physical hold bound exceeded'; END IF;
  RETURN (SELECT coalesce(jsonb_agg(attempt_id ORDER BY started_at,attempt_id),'[]'::jsonb)
    FROM ingenium_judge.attempts WHERE epoch=e AND permit_owner IS NOT NULL AND drain IS NULL);
END $$;
REVOKE ALL ON FUNCTION ingenium_judge.service_lock(uuid,uuid),ingenium_judge.service_session(uuid,uuid),
  ingenium_judge.service_heartbeat(uuid,uuid,bytea),ingenium_judge.service_withdraw(uuid,uuid),ingenium_judge.held_executions(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ingenium_judge.service_lock(uuid,uuid),ingenium_judge.service_heartbeat(uuid,uuid,bytea),
  ingenium_judge.service_withdraw(uuid,uuid),ingenium_judge.held_executions(uuid,uuid) TO ingenium_judge_supervisor;
COMMIT;
