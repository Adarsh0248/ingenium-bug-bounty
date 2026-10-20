INSERT INTO judge_control(id) VALUES(1);
INSERT INTO execution_capacity_slots(id) VALUES(1),(2);
ALTER TABLE validation_runs ALTER CONSTRAINT validation_runs_source_id_validation_run_outcomes_id_fk DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE validation_run_outcomes ALTER CONSTRAINT validation_run_outcomes_result_run_id_validation_runs_id_fk DEFERRABLE INITIALLY DEFERRED;
CREATE TRIGGER validation_run_outcome_immutable BEFORE UPDATE OR DELETE ON validation_run_outcomes FOR EACH ROW EXECUTE FUNCTION immutable_access_history();
CREATE TRIGGER validation_run_outcome_authority BEFORE INSERT ON validation_run_outcomes FOR EACH ROW EXECUTE FUNCTION validate_content_authority();
CREATE TRIGGER validation_run_audit_immutable BEFORE UPDATE OR DELETE ON validation_run_audits FOR EACH ROW EXECUTE FUNCTION immutable_access_history();
CREATE TRIGGER validation_run_audit_authority BEFORE INSERT ON validation_run_audits FOR EACH ROW EXECUTE FUNCTION validate_content_authority();
CREATE TRIGGER judge_host_runtime_immutable BEFORE UPDATE OR DELETE ON judge_host_runtimes FOR EACH ROW EXECUTE FUNCTION immutable_access_history();
CREATE FUNCTION guard_judge_epoch() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Execution epoch history cannot be deleted'; END IF;
  IF ROW(NEW.id,NEW.endpoint_ref,NEW.created_at) IS DISTINCT FROM ROW(OLD.id,OLD.endpoint_ref,OLD.created_at) OR OLD.state='RETIRED'
    OR (OLD.state<>'ACTIVE' AND NEW.state='ACTIVE') THEN RAISE EXCEPTION 'An execution epoch cannot be retargeted or reactivated'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER judge_epoch_identity BEFORE UPDATE OR DELETE ON judge_host_epochs FOR EACH ROW EXECUTE FUNCTION guard_judge_epoch();
--> statement-breakpoint
CREATE FUNCTION lock_validation_judge() RETURNS SETOF public.judge_control LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  PERFORM * FROM public.lock_arena_control(true);
  PERFORM r.id FROM public.rounds r JOIN public.arena_control a ON a.current_instance_id=r.arena_instance_id ORDER BY r.id FOR UPDATE OF r;
  PERFORM * FROM public.lock_catalogue();
  RETURN QUERY SELECT * FROM public.judge_control WHERE id=1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Judge control is missing'; END IF;
  PERFORM id FROM public.execution_capacity_slots ORDER BY id FOR UPDATE;
END;
$$;
CREATE FUNCTION validation_judge_time() RETURNS timestamptz LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE n timestamptz=date_trunc('milliseconds',clock_timestamp()); previous timestamptz;
BEGIN
  SELECT trusted_time_at INTO previous FROM public.judge_control WHERE id=1;
  IF previous>n OR EXISTS(SELECT 1 FROM public.rounds current_round JOIN public.arena_control arena ON arena.current_instance_id=current_round.arena_instance_id WHERE current_round.trusted_time_at>n) THEN
    RAISE EXCEPTION USING ERRCODE='22008',MESSAGE='Judge time reversed'; END IF;
  RETURN n;
END;
$$;
CREATE FUNCTION claim_validation_worker(worker uuid,host uuid) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE c public.judge_control%ROWTYPE; n timestamptz; g bigint;
BEGIN
  SELECT * INTO c FROM public.lock_validation_judge(); n=public.validation_judge_time();
  IF NOT EXISTS(SELECT 1 FROM public.judge_host_epochs WHERE id=host AND state='ACTIVE')
    OR (SELECT count(*) FROM public.judge_host_runtimes WHERE host_epoch_id=host)<>5 THEN RAISE EXCEPTION 'Compatible execution host required'; END IF;
  IF c.lease_until>n AND c.worker_id<>worker THEN RETURN NULL; END IF;
  IF c.host_epoch_id IS DISTINCT FROM host AND (c.active_validation_id IS NOT NULL OR EXISTS(SELECT 1 FROM public.execution_capacity_slots WHERE authoring_attempt_id IS NOT NULL)) THEN
    RAISE EXCEPTION 'Prior host execution remains accounted'; END IF;
  g=CASE WHEN c.worker_id=worker AND c.lease_until>n THEN c.worker_generation ELSE c.worker_generation+1 END;
  UPDATE public.judge_control SET worker_id=worker,worker_generation=g,host_epoch_id=host,lease_until=n+interval '30 seconds',trusted_time_at=n WHERE id=1;
  RETURN g;
END;
$$;
CREATE FUNCTION require_validation_worker(worker uuid,generation bigint) RETURNS timestamptz LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE c public.judge_control%ROWTYPE; n timestamptz;
BEGIN
  SELECT * INTO c FROM public.judge_control WHERE id=1; n=public.validation_judge_time();
  IF c.worker_id IS DISTINCT FROM worker OR c.worker_generation<>generation OR c.lease_until<=n THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Validation worker lease is stale'; END IF;
  UPDATE public.judge_control SET lease_until=n+interval '30 seconds',trusted_time_at=n WHERE id=1;
  RETURN n;
END;
$$;
CREATE FUNCTION validation_accounted_bytes(subject uuid) RETURNS bigint LANGUAGE sql STABLE SET search_path=pg_catalog,public AS $$
  SELECT CASE WHEN status IN ('QUEUED','RUNNING') THEN 524288+check_count::bigint*3*262144 ELSE 524288+COALESCE((
    SELECT sum(CASE WHEN a.released_at IS NULL THEN 262144 ELSE COALESCE(octet_length(a.evidence::text)+octet_length(a.stdout_prefix)+octet_length(a.stderr)+octet_length(a.compiler_output)+4096,0) END)
    FROM public.authoring_attempts a JOIN public.authoring_checks c ON c.id=a.check_id WHERE c.run_id=r.id),0) END FROM public.validation_runs r WHERE id=subject;
$$;
CREATE FUNCTION refresh_validation_run(subject uuid,n timestamptz) RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE r public.validation_runs%ROWTYPE; final text; actual bigint;
BEGIN
  SELECT * INTO r FROM public.validation_runs WHERE id=subject FOR UPDATE;
  IF r.status IN ('QUEUED','RUNNING') THEN
    IF n>=r.deadline_at THEN UPDATE public.authoring_checks SET result='INFRA_ERROR',completed_at=n WHERE run_id=subject AND result IS NULL; END IF;
    IF NOT EXISTS(SELECT 1 FROM public.authoring_checks WHERE run_id=subject AND result IS NULL) THEN
      IF EXISTS(SELECT 1 FROM public.authoring_checks WHERE run_id=subject AND result='INFRA_ERROR') THEN final='INFRA_ERROR';
      ELSIF EXISTS(SELECT 1 FROM public.authoring_checks c JOIN public.validation_snapshot_checks p ON p.id=c.snapshot_check_id WHERE c.run_id=subject AND p.source_role='REFERENCE' AND c.result<>'PASSED')
        OR EXISTS(SELECT 1 FROM public.validation_snapshot_variants v WHERE v.snapshot_id=r.snapshot_id AND NOT EXISTS(
          SELECT 1 FROM public.authoring_checks c JOIN public.validation_snapshot_checks p ON p.id=c.snapshot_check_id
          WHERE c.run_id=subject AND p.variant_id=v.variant_id AND p.source_role='STARTER' AND c.result=p.expected_result)) THEN final='FAILED'; ELSE final='PASSED'; END IF;
      IF n>=r.deadline_at THEN final='INFRA_ERROR'; END IF;
      UPDATE public.validation_runs SET status=final,finished_at=n WHERE id=subject;
    END IF;
  END IF;
  actual=public.validation_accounted_bytes(subject);
  IF actual<>r.accounted_bytes THEN
    UPDATE public.validation_runs SET accounted_bytes=actual WHERE id=subject;
    UPDATE public.catalogue_control SET committed_bytes=committed_bytes-r.accounted_bytes+actual,revision=revision+1 WHERE id=1;
  END IF;
  IF (SELECT status FROM public.validation_runs WHERE id=subject) NOT IN ('QUEUED','RUNNING') AND NOT EXISTS(
    SELECT 1 FROM public.authoring_attempts a JOIN public.authoring_checks c ON c.id=a.check_id WHERE c.run_id=subject AND a.released_at IS NULL) THEN
    UPDATE public.judge_control SET active_validation_id=NULL WHERE id=1 AND active_validation_id=subject;
  END IF;
END;
$$;
--> statement-breakpoint
CREATE FUNCTION admit_validation_run(source uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE o public.validation_run_outcomes%ROWTYPE; s public.validation_snapshots%ROWTYPE; c public.judge_control%ROWTYPE; v public.bug_versions%ROWTYPE; n timestamptz; jobs integer; size bigint;
BEGIN
  SELECT * INTO c FROM public.lock_validation_judge(); n=public.validation_judge_time();
  SELECT * INTO o FROM public.validation_run_outcomes WHERE id=source AND outcome='ADMITTED' AND xmin::text::bigint=(pg_current_xact_id()::text::bigint & 4294967295);
  IF NOT FOUND THEN RAISE EXCEPTION 'Current run source required'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.staff_sessions x JOIN public.staff_session_slots slot ON slot.staff_id=x.staff_id AND slot.session_id=x.id
    JOIN public.staff_identities i ON i.id=x.staff_id JOIN public.access_credentials credential ON credential.id=x.credential_id AND credential.version=x.credential_version AND credential.staff_id=x.staff_id
    WHERE x.id=o.session_id AND x.staff_id=o.actor_id AND x.credential_id=o.credential_id AND x.credential_version=o.credential_version
      AND x.mode='NORMAL' AND x.revoked_at IS NULL AND i.role IN ('OWNER','SUPER_ADMIN') AND i.disabled_at IS NULL AND credential.revoked_at IS NULL
      AND n<x.absolute_expires_at AND n<x.last_activity_at+interval '15 minutes') THEN RAISE EXCEPTION 'Run requester authority changed'; END IF;
  SELECT * INTO s FROM public.validation_snapshots WHERE id=o.snapshot_id;
  SELECT * INTO v FROM public.bug_versions WHERE id=s.version_id;
  IF v.publication_status<>'DRAFT' OR v.content_revision<>s.content_revision OR o.expected_revision<>s.content_revision THEN RAISE EXCEPTION 'Validation source is stale'; END IF;
  IF EXISTS(SELECT 1 FROM public.rounds r JOIN public.arena_control a ON a.current_instance_id=r.arena_instance_id WHERE r.state IN ('RUNNING','PAUSED','CLOSING','CANCELLING')) THEN RAISE EXCEPTION 'Arena is active'; END IF;
  IF c.active_validation_id IS NOT NULL OR EXISTS(SELECT 1 FROM public.execution_capacity_slots WHERE authoring_attempt_id IS NOT NULL)
    OR c.lease_until IS NULL OR c.lease_until<=n OR NOT EXISTS(SELECT 1 FROM public.judge_host_epochs WHERE id=c.host_epoch_id AND state='ACTIVE') THEN
      RAISE EXCEPTION USING ERRCODE='54000',MESSAGE='Validation execution is not available'; END IF;
  IF EXISTS(SELECT 1 FROM public.validation_snapshot_variants frozen_variant WHERE frozen_variant.snapshot_id=s.id AND NOT EXISTS(
    SELECT 1 FROM public.judge_host_runtimes h WHERE h.host_epoch_id=c.host_epoch_id AND h.language=frozen_variant.language AND h.runtime_key=frozen_variant.runtime_key)) THEN
      RAISE EXCEPTION USING ERRCODE='54000',MESSAGE='Frozen runtimes do not match the worker'; END IF;
  SELECT count(*) INTO jobs FROM public.validation_snapshot_checks WHERE snapshot_id=s.id; size=524288+jobs::bigint*3*262144;
  IF jobs NOT BETWEEN 15 AND 115 OR (SELECT committed_bytes FROM public.catalogue_control WHERE id=1)+size>3221225472 THEN RAISE EXCEPTION USING ERRCODE='54000',MESSAGE='Validation reservation unavailable'; END IF;
  INSERT INTO public.validation_runs(id,snapshot_id,configuration_fingerprint,host_epoch_id,status,requested_by,created_at,deadline_at,policy_version,check_count,accounted_bytes,source_id)
    VALUES(o.result_run_id,s.id,s.fingerprint,c.host_epoch_id,'QUEUED',o.actor_id,o.recorded_at,o.recorded_at+interval '10 minutes',1,jobs,size,o.id);
  INSERT INTO public.authoring_checks(id,run_id,snapshot_id,snapshot_check_id,available_at)
    SELECT gen_random_uuid(),o.result_run_id,s.id,id,o.recorded_at FROM public.validation_snapshot_checks WHERE snapshot_id=s.id;
  UPDATE public.judge_control SET active_validation_id=o.result_run_id,trusted_time_at=n WHERE id=1;
  UPDATE public.catalogue_control SET committed_bytes=committed_bytes+size,revision=revision+1 WHERE id=1;
END;
$$;
CREATE FUNCTION prepare_authoring_attempt(worker uuid,generation bigint,chosen_check uuid,attempt uuid,payload bytea) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE c public.judge_control%ROWTYPE; r public.validation_runs%ROWTYPE; j public.authoring_checks%ROWTYPE; n timestamptz; slot integer; ordinal integer;
BEGIN
  SELECT * INTO c FROM public.lock_validation_judge(); n=public.require_validation_worker(worker,generation);
  SELECT * INTO j FROM public.authoring_checks WHERE id=chosen_check;
  SELECT * INTO r FROM public.validation_runs WHERE id=j.run_id FOR UPDATE;
  IF r.id IS NOT NULL THEN SELECT * INTO j FROM public.authoring_checks WHERE id=chosen_check FOR UPDATE; END IF;
  IF NOT FOUND OR c.active_validation_id IS DISTINCT FROM r.id OR r.host_epoch_id<>c.host_epoch_id OR r.status NOT IN ('QUEUED','RUNNING') OR n>=r.deadline_at
    OR j.result IS NOT NULL OR j.available_at>n OR octet_length(payload)<>32
    OR NOT EXISTS(SELECT 1 FROM public.judge_host_epochs WHERE id=r.host_epoch_id AND state='ACTIVE')
    OR EXISTS(SELECT 1 FROM public.rounds x JOIN public.arena_control a ON a.current_instance_id=x.arena_instance_id WHERE x.state IN ('RUNNING','PAUSED','CLOSING','CANCELLING')) THEN RAISE EXCEPTION 'Authoring dispatch is not allowed'; END IF;
  IF EXISTS(SELECT 1 FROM public.authoring_attempts WHERE check_id=j.id AND released_at IS NULL) THEN RAISE EXCEPTION 'Prior execution is not drained'; END IF;
  SELECT count(*)+1 INTO ordinal FROM public.authoring_attempts WHERE check_id=j.id;
  IF ordinal>3 OR EXISTS(SELECT 1 FROM public.authoring_attempts WHERE check_id=j.id AND result IS DISTINCT FROM 'INFRA_ERROR') THEN RAISE EXCEPTION 'No safe automatic retry'; END IF;
  SELECT id INTO slot FROM public.execution_capacity_slots WHERE authoring_attempt_id IS NULL ORDER BY id LIMIT 1;
  IF slot IS NULL THEN RAISE EXCEPTION USING ERRCODE='54000',MESSAGE='Execution capacity unavailable'; END IF;
  UPDATE public.authoring_checks SET worker_id=worker,lease_generation=generation WHERE id=j.id;
  INSERT INTO public.authoring_attempts(id,check_id,number,host_epoch_id,worker_id,lease_generation,send_state,payload_digest,prepared_at)
    VALUES(attempt,j.id,ordinal,r.host_epoch_id,worker,generation,'PREPARED',payload,n);
  UPDATE public.execution_capacity_slots SET authoring_attempt_id=attempt,revision=revision+1 WHERE id=slot;
  UPDATE public.authoring_attempts SET send_state='SEND_STARTED',send_started_at=n WHERE id=attempt;
  IF r.status='QUEUED' THEN UPDATE public.validation_runs SET status='RUNNING',started_at=n WHERE id=r.id; END IF;
END;
$$;
CREATE FUNCTION record_authoring_result(worker uuid,generation bigint,attempt uuid,answer text,metadata jsonb,stdout bytea,stderr_bytes bytea,compiler_bytes bytea,release_proof bytea)
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE a public.authoring_attempts%ROWTYPE; j public.authoring_checks%ROWTYPE; c public.judge_control%ROWTYPE; n timestamptz; digest bytea; run_status text;
BEGIN
  SELECT * INTO c FROM public.lock_validation_judge(); n=public.require_validation_worker(worker,generation);
  SELECT * INTO a FROM public.authoring_attempts WHERE id=attempt;
  IF NOT FOUND OR a.host_epoch_id<>c.host_epoch_id OR a.send_state<>'SEND_STARTED' THEN RAISE EXCEPTION 'Attempt binding changed'; END IF;
  PERFORM parent_run.id FROM public.validation_runs parent_run JOIN public.authoring_checks owned_check ON owned_check.run_id=parent_run.id WHERE owned_check.id=a.check_id FOR UPDATE OF parent_run;
  SELECT * INTO j FROM public.authoring_checks WHERE id=a.check_id FOR UPDATE;
  SELECT * INTO a FROM public.authoring_attempts WHERE id=attempt FOR UPDATE;
  IF metadata->>'attempt_id' IS DISTINCT FROM a.id::text OR metadata->>'host_epoch_id' IS DISTINCT FROM a.host_epoch_id::text
    OR metadata->>'payload_digest' IS DISTINCT FROM encode(a.payload_digest,'hex') OR metadata->>'result' IS DISTINCT FROM answer
    OR (metadata->>'schema_version') IS DISTINCT FROM '1' THEN RAISE EXCEPTION 'Protected evidence binding mismatch'; END IF;
  digest=sha256(convert_to(metadata::text,'UTF8')||sha256(stdout)||sha256(stderr_bytes)||sha256(compiler_bytes));
  IF a.result IS NULL THEN
    UPDATE public.authoring_attempts SET result=answer,result_digest=digest,resolved_at=n,evidence=metadata,stdout_prefix=stdout,stderr=stderr_bytes,compiler_output=compiler_bytes WHERE id=a.id;
  ELSIF a.result<>answer OR a.result_digest<>digest THEN RAISE EXCEPTION 'Sealed attempt evidence cannot change'; END IF;
  IF release_proof IS NOT NULL THEN
    IF a.released_at IS NULL THEN
      UPDATE public.authoring_attempts SET released_at=n,release_digest=release_proof WHERE id=a.id;
      UPDATE public.execution_capacity_slots SET authoring_attempt_id=NULL,revision=revision+1 WHERE authoring_attempt_id=a.id;
    ELSIF a.release_digest<>release_proof THEN RAISE EXCEPTION 'Release evidence cannot change'; END IF;
  END IF;
  SELECT status INTO run_status FROM public.validation_runs WHERE id=j.run_id;
  IF j.result IS NULL AND run_status IN ('QUEUED','RUNNING') AND n<(SELECT deadline_at FROM public.validation_runs WHERE id=j.run_id) THEN
    UPDATE public.authoring_checks SET worker_id=worker,lease_generation=generation WHERE id=j.id;
    IF answer<>'INFRA_ERROR' THEN UPDATE public.authoring_checks SET result=answer,completed_at=n,settling_attempt_id=a.id WHERE id=j.id;
    ELSIF (SELECT released_at FROM public.authoring_attempts WHERE id=a.id) IS NOT NULL THEN
      IF a.number=3 THEN UPDATE public.authoring_checks SET result='INFRA_ERROR',completed_at=n,settling_attempt_id=a.id WHERE id=j.id;
      ELSE UPDATE public.authoring_checks SET available_at=(SELECT resolved_at FROM public.authoring_attempts WHERE id=a.id)+CASE a.number WHEN 1 THEN interval '2 seconds' ELSE interval '5 seconds' END WHERE id=j.id; END IF;
    END IF;
  END IF;
  PERFORM public.refresh_validation_run(j.run_id,n);
END;
$$;
CREATE FUNCTION claim_authoring_poll(worker uuid,generation bigint,attempt uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE c public.judge_control%ROWTYPE; a public.authoring_attempts%ROWTYPE; n timestamptz; delay_ms integer;
BEGIN
  SELECT * INTO c FROM public.lock_validation_judge(); n=public.require_validation_worker(worker,generation);
  SELECT * INTO a FROM public.authoring_attempts WHERE id=attempt FOR UPDATE;
  IF NOT FOUND OR a.host_epoch_id<>c.host_epoch_id OR a.send_state<>'SEND_STARTED' OR a.released_at IS NOT NULL THEN RAISE EXCEPTION 'Poll is not owned'; END IF;
  IF a.next_poll_at>n OR a.poll_count>=10000 THEN RETURN false; END IF;
  delay_ms=LEAST(5000,(CASE a.poll_count WHEN 0 THEN 1000 WHEN 1 THEN 2000 ELSE 4900 END)+floor(random()*101)::integer);
  UPDATE public.authoring_attempts SET poll_count=poll_count+1,next_poll_at=n+delay_ms*interval '1 millisecond' WHERE id=attempt;
  RETURN true;
END;
$$;
CREATE FUNCTION sweep_validation_run(worker uuid,generation bigint) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE c public.judge_control%ROWTYPE; n timestamptz;
BEGIN
  SELECT * INTO c FROM public.lock_validation_judge(); n=public.require_validation_worker(worker,generation);
  IF c.active_validation_id IS NOT NULL THEN PERFORM public.refresh_validation_run(c.active_validation_id,n); END IF;
END;
$$;
CREATE FUNCTION expire_validation_run() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE c public.judge_control%ROWTYPE; n timestamptz;
BEGIN
  SELECT * INTO c FROM public.lock_validation_judge(); n=public.validation_judge_time();
  IF c.active_validation_id IS NOT NULL AND EXISTS(SELECT 1 FROM public.validation_runs WHERE id=c.active_validation_id AND status IN ('QUEUED','RUNNING') AND deadline_at<=n) THEN
    PERFORM public.refresh_validation_run(c.active_validation_id,n);
  END IF;
  UPDATE public.judge_control SET trusted_time_at=n WHERE id=1;
END;
$$;
--> statement-breakpoint
CREATE FUNCTION guard_authoring_state() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE c public.judge_control%ROWTYPE;
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Authoring execution history cannot be deleted'; END IF;
  IF TG_TABLE_NAME='validation_runs' THEN
    IF TG_OP='INSERT' THEN
      IF NOT EXISTS(SELECT 1 FROM public.validation_run_outcomes o JOIN public.validation_snapshots s ON s.id=o.snapshot_id WHERE o.id=NEW.source_id
        AND o.outcome='ADMITTED' AND o.result_run_id=NEW.id AND o.actor_id=NEW.requested_by AND o.recorded_at=NEW.created_at AND s.id=NEW.snapshot_id AND s.fingerprint=NEW.configuration_fingerprint
        AND o.xmin::text::bigint=(pg_current_xact_id()::text::bigint & 4294967295)) THEN RAISE EXCEPTION 'Run requires its exact current source'; END IF;
    ELSE
      IF ROW(NEW.id,NEW.snapshot_id,NEW.configuration_fingerprint,NEW.host_epoch_id,NEW.requested_by,NEW.created_at,NEW.deadline_at,NEW.policy_version,NEW.check_count,NEW.source_id)
        IS DISTINCT FROM ROW(OLD.id,OLD.snapshot_id,OLD.configuration_fingerprint,OLD.host_epoch_id,OLD.requested_by,OLD.created_at,OLD.deadline_at,OLD.policy_version,OLD.check_count,OLD.source_id)
        OR (OLD.started_at IS NOT NULL AND NEW.started_at IS DISTINCT FROM OLD.started_at)
        OR (OLD.status NOT IN ('QUEUED','RUNNING') AND ROW(NEW.status,NEW.finished_at,NEW.started_at) IS DISTINCT FROM ROW(OLD.status,OLD.finished_at,OLD.started_at))
        OR (OLD.status='RUNNING' AND NEW.status='QUEUED') THEN RAISE EXCEPTION 'Frozen run identity or final result cannot change'; END IF;
    END IF;
  ELSIF TG_TABLE_NAME='authoring_checks' THEN
    IF TG_OP='INSERT' THEN
      IF NOT EXISTS(SELECT 1 FROM public.validation_runs r JOIN public.validation_snapshot_checks p ON p.snapshot_id=r.snapshot_id WHERE r.id=NEW.run_id AND p.id=NEW.snapshot_check_id AND r.snapshot_id=NEW.snapshot_id
        AND r.xmin::text::bigint=(pg_current_xact_id()::text::bigint & 4294967295)) THEN RAISE EXCEPTION 'Check requires its newly admitted exact plan'; END IF;
    ELSIF ROW(NEW.id,NEW.run_id,NEW.snapshot_id,NEW.snapshot_check_id) IS DISTINCT FROM ROW(OLD.id,OLD.run_id,OLD.snapshot_id,OLD.snapshot_check_id) OR OLD.result IS NOT NULL THEN
      RAISE EXCEPTION 'Final check or ownership cannot be rewritten';
    END IF;
    IF NEW.result IS NOT NULL AND NEW.result<>'INFRA_ERROR' AND NOT EXISTS(SELECT 1 FROM public.authoring_attempts a WHERE a.id=NEW.settling_attempt_id AND a.check_id=NEW.id AND a.result=NEW.result) THEN RAISE EXCEPTION 'Check needs its owned sealed result'; END IF;
  ELSE
    IF TG_OP='INSERT' THEN
      SELECT * INTO c FROM public.judge_control WHERE id=1;
      IF NEW.worker_id IS DISTINCT FROM c.worker_id OR NEW.lease_generation IS DISTINCT FROM c.worker_generation OR c.lease_until IS NULL OR c.lease_until<=clock_timestamp() OR NEW.send_state<>'PREPARED' THEN RAISE EXCEPTION 'Attempt requires current ownership'; END IF;
    ELSE
      IF ROW(NEW.id,NEW.check_id,NEW.number,NEW.host_epoch_id,NEW.worker_id,NEW.lease_generation,NEW.payload_digest,NEW.prepared_at)
        IS DISTINCT FROM ROW(OLD.id,OLD.check_id,OLD.number,OLD.host_epoch_id,OLD.worker_id,OLD.lease_generation,OLD.payload_digest,OLD.prepared_at)
        OR (OLD.send_state='SEND_STARTED' AND ROW(NEW.send_state,NEW.send_started_at) IS DISTINCT FROM ROW(OLD.send_state,OLD.send_started_at))
        OR (OLD.result IS NOT NULL AND ROW(NEW.result,NEW.result_digest,NEW.resolved_at,NEW.evidence,NEW.stdout_prefix,NEW.stderr,NEW.compiler_output)
          IS DISTINCT FROM ROW(OLD.result,OLD.result_digest,OLD.resolved_at,OLD.evidence,OLD.stdout_prefix,OLD.stderr,OLD.compiler_output))
        OR (OLD.released_at IS NOT NULL AND ROW(NEW.released_at,NEW.release_digest) IS DISTINCT FROM ROW(OLD.released_at,OLD.release_digest)) THEN RAISE EXCEPTION 'Attempt identity, permit or sealed evidence cannot change'; END IF;
      IF NEW.poll_count<OLD.poll_count OR NEW.poll_count>OLD.poll_count+1 OR NEW.next_poll_at<OLD.next_poll_at THEN RAISE EXCEPTION 'Poll budgets cannot reset'; END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER validation_run_state_guard BEFORE INSERT OR UPDATE OR DELETE ON validation_runs FOR EACH ROW EXECUTE FUNCTION guard_authoring_state();
CREATE TRIGGER authoring_check_state_guard BEFORE INSERT OR UPDATE OR DELETE ON authoring_checks FOR EACH ROW EXECUTE FUNCTION guard_authoring_state();
CREATE TRIGGER authoring_attempt_state_guard BEFORE INSERT OR UPDATE OR DELETE ON authoring_attempts FOR EACH ROW EXECUTE FUNCTION guard_authoring_state();
CREATE FUNCTION validate_authoring_integrity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE r public.validation_runs%ROWTYPE;
BEGIN
  IF TG_TABLE_NAME='validation_run_outcomes' THEN
    IF NEW.outcome='ADMITTED' AND NOT EXISTS(SELECT 1 FROM public.validation_runs WHERE id=NEW.result_run_id AND source_id=NEW.id AND snapshot_id=NEW.snapshot_id) THEN RAISE EXCEPTION 'Run receipt has no exact effect'; END IF;
  END IF;
  IF TG_TABLE_NAME='validation_runs' THEN
    SELECT * INTO r FROM public.validation_runs WHERE id=NEW.id;
    IF r.check_count<>(SELECT count(*) FROM public.authoring_checks WHERE run_id=r.id) OR r.accounted_bytes<>public.validation_accounted_bytes(r.id)
      OR EXISTS(SELECT 1 FROM public.validation_snapshot_checks p WHERE p.snapshot_id=r.snapshot_id AND NOT EXISTS(SELECT 1 FROM public.authoring_checks c WHERE c.run_id=r.id AND c.snapshot_check_id=p.id)) THEN RAISE EXCEPTION 'Run plan or accounting is incomplete'; END IF;
    IF r.status IN ('PASSED','FAILED') AND (EXISTS(SELECT 1 FROM public.authoring_checks WHERE run_id=r.id AND (result IS NULL OR result='INFRA_ERROR'))
      OR r.finished_at>=r.deadline_at) THEN RAISE EXCEPTION 'Reliable completion cannot skip required checks'; END IF;
    IF r.status='PASSED' AND (EXISTS(SELECT 1 FROM public.authoring_checks c JOIN public.validation_snapshot_checks p ON p.id=c.snapshot_check_id WHERE c.run_id=r.id AND p.source_role='REFERENCE' AND c.result<>'PASSED')
      OR EXISTS(SELECT 1 FROM public.validation_snapshot_variants v WHERE v.snapshot_id=r.snapshot_id AND NOT EXISTS(SELECT 1 FROM public.authoring_checks c JOIN public.validation_snapshot_checks p ON p.id=c.snapshot_check_id WHERE c.run_id=r.id AND p.variant_id=v.variant_id AND p.source_role='STARTER' AND c.result=p.expected_result))) THEN RAISE EXCEPTION 'Passing run lacks required reference or defect evidence'; END IF;
  END IF;
  IF (SELECT count(*) FROM public.execution_capacity_slots)<>2 OR EXISTS(SELECT 1 FROM public.authoring_attempts a WHERE (a.released_at IS NULL) IS DISTINCT FROM EXISTS(SELECT 1 FROM public.execution_capacity_slots s WHERE s.authoring_attempt_id=a.id)) THEN RAISE EXCEPTION 'Physical reservation accounting mismatch'; END IF;
  IF EXISTS(SELECT 1 FROM public.validation_runs pending_run WHERE pending_run.status IN ('QUEUED','RUNNING') AND pending_run.id IS DISTINCT FROM (SELECT active_validation_id FROM public.judge_control WHERE id=1))
    OR EXISTS(SELECT 1 FROM public.execution_capacity_slots s JOIN public.authoring_attempts a ON a.id=s.authoring_attempt_id JOIN public.authoring_checks j ON j.id=a.check_id
      WHERE j.run_id IS DISTINCT FROM (SELECT active_validation_id FROM public.judge_control WHERE id=1)) THEN RAISE EXCEPTION 'Active or unsafe work must retain its own judge barrier'; END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER validation_run_complete AFTER INSERT OR UPDATE ON validation_runs DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_authoring_integrity();
CREATE CONSTRAINT TRIGGER validation_run_receipt_effect AFTER INSERT ON validation_run_outcomes DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_authoring_integrity();
CREATE CONSTRAINT TRIGGER judge_capacity_integrity AFTER UPDATE ON judge_control DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_authoring_integrity();
CREATE CONSTRAINT TRIGGER authoring_capacity_integrity AFTER INSERT OR UPDATE ON authoring_attempts DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_authoring_integrity();
CREATE CONSTRAINT TRIGGER slot_capacity_integrity AFTER UPDATE OR DELETE ON execution_capacity_slots DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_authoring_integrity();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION validate_content_budget() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE subject uuid; expected bigint; actual bigint;
BEGIN
  IF TG_TABLE_NAME='bug_versions' THEN subject=NEW.id; ELSE subject=NULL; END IF;
  IF subject IS NOT NULL THEN
    IF (SELECT content_bytes FROM public.bug_versions WHERE id=subject)<>public.content_version_bytes(subject) THEN RAISE EXCEPTION 'Catalogue byte accounting mismatch'; END IF;
    IF (SELECT count(*) FROM public.test_cases WHERE version_id=subject AND removed_at IS NULL)>20
      OR (SELECT count(*) FROM public.test_cases WHERE version_id=subject AND removed_at IS NULL AND visibility='SAMPLE')>3
      OR EXISTS(SELECT 1 FROM public.test_cases WHERE version_id=subject AND removed_at IS NULL AND position>20)
      OR COALESCE((SELECT sum(octet_length(input_data)+octet_length(expected_output)) FROM public.test_cases WHERE version_id=subject AND removed_at IS NULL),0)>16777216 THEN
      RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Content suite exceeds its confirmed bounds'; END IF;
  END IF;
  SELECT committed_bytes INTO actual FROM public.catalogue_control WHERE id=1;
  SELECT COALESCE(sum(content_bytes),0) INTO expected FROM (SELECT content_bytes FROM public.bug_versions UNION ALL SELECT content_bytes FROM public.validation_snapshots UNION ALL SELECT accounted_bytes FROM public.validation_runs) totals;
  IF actual IS NULL OR actual<>expected OR (SELECT count(*) FROM public.bug_definitions)>250 OR (SELECT count(*) FROM public.bug_versions)>1000 THEN RAISE EXCEPTION 'Catalogue guard or accounting mismatch'; END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION lock_validation_judge(),validation_judge_time(),claim_validation_worker(uuid,uuid),require_validation_worker(uuid,bigint),validation_accounted_bytes(uuid),refresh_validation_run(uuid,timestamptz),admit_validation_run(uuid),prepare_authoring_attempt(uuid,bigint,uuid,uuid,bytea),record_authoring_result(uuid,bigint,uuid,text,jsonb,bytea,bytea,bytea,bytea),sweep_validation_run(uuid,bigint),guard_authoring_state(),validate_authoring_integrity() FROM PUBLIC;
REVOKE ALL ON FUNCTION expire_validation_run() FROM PUBLIC;
REVOKE ALL ON FUNCTION claim_authoring_poll(uuid,bigint,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION guard_judge_epoch() FROM PUBLIC;
GRANT SELECT ON judge_control,judge_host_epochs,judge_host_runtimes,execution_capacity_slots,validation_runs,authoring_checks,authoring_attempts TO ingenium_api;
GRANT SELECT,INSERT ON validation_run_outcomes,validation_run_audits TO ingenium_api;
GRANT EXECUTE ON FUNCTION lock_validation_judge(),claim_validation_worker(uuid,uuid),admit_validation_run(uuid),prepare_authoring_attempt(uuid,bigint,uuid,uuid,bytea),record_authoring_result(uuid,bigint,uuid,text,jsonb,bytea,bytea,bytea,bytea),sweep_validation_run(uuid,bigint),expire_validation_run() TO ingenium_api;
GRANT EXECUTE ON FUNCTION claim_authoring_poll(uuid,bigint,uuid) TO ingenium_api;
