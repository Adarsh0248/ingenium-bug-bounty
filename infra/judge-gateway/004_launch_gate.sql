-- Fresh general-registry installation only. Never delete evidence to make this migration applicable.
BEGIN;
DO $$ BEGIN
  IF EXISTS(SELECT FROM ingenium_judge.attempts) THEN RAISE EXCEPTION 'Install the launch gate before admitting any general-registry work'; END IF;
END $$;
ALTER TABLE ingenium_judge.attempts ADD COLUMN launch_started_at timestamptz;
ALTER TABLE ingenium_judge.attempts ADD CHECK(launch_started_at IS NULL OR permit_owner IS NOT NULL);
ALTER TABLE ingenium_judge.attempts ADD CHECK(evidence IS NULL OR launch_started_at IS NOT NULL);
CREATE FUNCTION ingenium_judge.launch_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
  IF OLD.launch_started_at IS NOT NULL AND NEW.launch_started_at IS DISTINCT FROM OLD.launch_started_at THEN RAISE EXCEPTION 'Launch cannot be repeated or reset'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER launch_guard BEFORE UPDATE ON ingenium_judge.attempts FOR EACH ROW EXECUTE FUNCTION ingenium_judge.launch_guard();
CREATE FUNCTION ingenium_judge.begin_launch(e uuid,b uuid,a uuid,t uuid,w uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c ingenium_judge.control%ROWTYPE; v ingenium_judge.attempts%ROWTYPE;
BEGIN
  SELECT * INTO c FROM ingenium_judge.control WHERE id=1 FOR UPDATE;
  IF c.epoch IS DISTINCT FROM e OR c.boot_id IS DISTINCT FROM b OR c.state<>'ACTIVE' OR c.ready_until<=clock_timestamp()
    OR c.readiness_proof IS NULL OR NOT ingenium_judge.compatible() THEN RAISE EXCEPTION 'Host cannot start execution' USING ERRCODE='55000'; END IF;
  SELECT * INTO v FROM ingenium_judge.attempts WHERE attempt_id=a AND epoch=e AND provider_token=t FOR UPDATE;
  IF NOT FOUND OR w IS NULL OR v.permit_owner IS DISTINCT FROM w THEN RAISE EXCEPTION 'Wrong launch owner' USING ERRCODE='22023'; END IF;
  IF v.launch_started_at IS NOT NULL THEN RETURN NULL; END IF;
  UPDATE ingenium_judge.attempts SET launch_started_at=clock_timestamp() WHERE attempt_id=a;
  RETURN v.envelope;
END $$;
CREATE OR REPLACE FUNCTION ingenium_judge.execution(e uuid,b uuid,a uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v ingenium_judge.attempts%ROWTYPE;
BEGIN
  IF NOT EXISTS(SELECT FROM ingenium_judge.control WHERE epoch=e AND boot_id=b) THEN RAISE EXCEPTION 'Wrong host'; END IF;
  SELECT * INTO v FROM ingenium_judge.attempts WHERE attempt_id=a AND epoch=e AND permit_owner IS NOT NULL;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('envelope',v.envelope,'provider_token',v.provider_token,'permit_owner',v.permit_owner,
    'launch_started',v.launch_started_at IS NOT NULL,'evidence',v.evidence,'drain',v.drain);
END $$;
REVOKE ALL ON FUNCTION ingenium_judge.launch_guard(),ingenium_judge.begin_launch(uuid,uuid,uuid,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ingenium_judge.begin_launch(uuid,uuid,uuid,uuid,uuid) TO ingenium_judge_supervisor;
COMMIT;
