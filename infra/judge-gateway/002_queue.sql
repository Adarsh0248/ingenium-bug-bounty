-- Judge-only follow-up to 001_registry.sql. No host, readiness or LOGIN is provisioned.
BEGIN;
DO $$ BEGIN
  IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='ingenium_judge_publisher') THEN CREATE ROLE ingenium_judge_publisher NOLOGIN; END IF;
  IF EXISTS(SELECT FROM pg_roles WHERE rolname='ingenium_judge_publisher'
    AND (rolcanlogin OR rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls)) THEN RAISE EXCEPTION 'Publisher must be an unprivileged NOLOGIN role'; END IF;
END $$;

-- Include already acknowledged but unclaimed jobs: Redis can lose an acknowledged write.
CREATE FUNCTION ingenium_judge.queue_candidates(e uuid,b uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c ingenium_judge.control%ROWTYPE;
BEGIN
  SELECT * INTO c FROM ingenium_judge.control WHERE id=1;
  IF c.epoch IS DISTINCT FROM e OR c.boot_id IS DISTINCT FROM b THEN RAISE EXCEPTION 'Wrong host'; END IF;
  IF c.state<>'ACTIVE' OR c.ready_until<=clock_timestamp() OR c.readiness_proof IS NULL OR NOT ingenium_judge.compatible() THEN RETURN '[]'::jsonb; END IF;
  RETURN (SELECT coalesce(jsonb_agg(row_to_json(q)),'[]'::jsonb) FROM (
    SELECT a.attempt_id,a.provider_token FROM ingenium_judge.attempts a JOIN ingenium_judge.outbox o USING(attempt_id)
    WHERE a.epoch=e AND a.permit_owner IS NULL ORDER BY a.created_at,a.attempt_id LIMIT 120) q);
END $$;
CREATE FUNCTION ingenium_judge.delivery_state(e uuid,b uuid,a uuid,t uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v ingenium_judge.attempts%ROWTYPE;
BEGIN
  IF NOT EXISTS(SELECT FROM ingenium_judge.control WHERE epoch=e AND boot_id=b) THEN RAISE EXCEPTION 'Wrong host'; END IF;
  SELECT * INTO v FROM ingenium_judge.attempts WHERE attempt_id=a AND epoch=e AND provider_token=t;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown delivery binding' USING ERRCODE='22023'; END IF;
  RETURN CASE WHEN v.permit_owner IS NULL THEN 'PREPARED' ELSE 'CONSUMED' END;
END $$;
REVOKE ALL ON FUNCTION ingenium_judge.queue_candidates(uuid,uuid),ingenium_judge.delivery_state(uuid,uuid,uuid,uuid) FROM PUBLIC;
GRANT USAGE ON SCHEMA ingenium_judge TO ingenium_judge_publisher;
GRANT EXECUTE ON FUNCTION ingenium_judge.queue_candidates(uuid,uuid),ingenium_judge.delivery_state(uuid,uuid,uuid,uuid),ingenium_judge.published(uuid,uuid,uuid) TO ingenium_judge_publisher;
GRANT EXECUTE ON FUNCTION ingenium_judge.delivery_state(uuid,uuid,uuid,uuid) TO ingenium_judge_supervisor;
COMMIT;
