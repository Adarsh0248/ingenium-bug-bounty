-- Read-only recovery of a consumed permit; never transfers its owner or grants another launch.
BEGIN;
CREATE FUNCTION ingenium_judge.execution(e uuid,b uuid,a uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v ingenium_judge.attempts%ROWTYPE;
BEGIN
  IF NOT EXISTS(SELECT FROM ingenium_judge.control WHERE epoch=e AND boot_id=b) THEN RAISE EXCEPTION 'Wrong host'; END IF;
  SELECT * INTO v FROM ingenium_judge.attempts WHERE attempt_id=a AND epoch=e AND permit_owner IS NOT NULL;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('envelope',v.envelope,'provider_token',v.provider_token,'permit_owner',v.permit_owner,'evidence',v.evidence,'drain',v.drain);
END $$;
REVOKE ALL ON FUNCTION ingenium_judge.execution(uuid,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ingenium_judge.execution(uuid,uuid,uuid) TO ingenium_judge_supervisor;
COMMIT;
