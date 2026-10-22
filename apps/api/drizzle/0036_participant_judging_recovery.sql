ALTER TABLE participant_retry_permissions ALTER CONSTRAINT participant_retry_permissions_source_id_competition_outcomes_id_fk DEFERRABLE INITIALLY DEFERRED;
CREATE TRIGGER participant_retry_immutable BEFORE UPDATE OR DELETE ON participant_retry_permissions FOR EACH ROW EXECUTE FUNCTION immutable_access_history();
--> statement-breakpoint
CREATE FUNCTION participant_defer(worker uuid,generation bigint,attempt uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  PERFORM * FROM public.lock_validation_judge(); PERFORM public.require_validation_worker(worker,generation);
  UPDATE public.participant_jobs j SET status='NEEDS_ATTENTION' FROM public.participant_attempts a
    WHERE a.id=attempt AND a.job_id=j.id AND a.released_at IS NULL AND j.result IS NULL AND a.host_epoch_id=(SELECT host_epoch_id FROM public.judge_control WHERE id=1);
  PERFORM public.participant_refresh(public.validation_judge_time());
END $$;
CREATE FUNCTION participant_expire(subject uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE n timestamptz; expired uuid;
BEGIN
  PERFORM id FROM public.security_control WHERE id=1 FOR SHARE;
  n=public.competition_now(subject);
  FOR expired IN UPDATE public.participant_judging SET status='COMPLETED',result='INFRA_ERROR',completed_at=n
    WHERE round_id=subject AND lane='SAMPLE' AND completed_at IS NULL AND n>=created_at+interval '120 seconds' RETURNING id LOOP
    PERFORM public.participant_rebudget(expired);
  END LOOP;
END $$;
CREATE FUNCTION participant_retry(sid uuid,job uuid,request uuid,reason text,own_verifier bytea) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE p public.participant_judging%ROWTYPE; n timestamptz; actor uuid; fp bytea; old jsonb; source uuid=gen_random_uuid(); answer jsonb;
BEGIN
  PERFORM id FROM public.security_control WHERE id=1 FOR UPDATE;
  SELECT p0.* INTO p FROM public.participant_judging p0 JOIN public.participant_jobs j ON j.parent_id=p0.id WHERE j.id=job;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown recovery job'; END IF;
  n=public.competition_now(p.round_id);
  SELECT s.staff_id INTO actor FROM public.staff_sessions s JOIN public.staff_session_slots z ON z.staff_id=s.staff_id AND z.session_id=s.id
    JOIN public.staff_identities i ON i.id=s.staff_id JOIN public.access_credentials c ON c.id=s.credential_id AND c.version=s.credential_version
    WHERE s.id=sid AND s.mode='NORMAL' AND s.revoked_at IS NULL AND i.role IN ('OWNER','SUPER_ADMIN') AND i.disabled_at IS NULL AND c.revoked_at IS NULL
      AND c.verifier=own_verifier AND n>=s.last_activity_at AND n<s.absolute_expires_at AND n<s.last_activity_at+interval '15 minutes';
  IF actor IS NULL OR reason IS NULL OR octet_length(reason) NOT BETWEEN 1 AND 1024 OR btrim(reason)='' THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Confirmed recovery authority required'; END IF;
  fp=public.competition_fingerprint('RETRY_JOB',jsonb_build_object('job_id',job),0,reason);
  old=public.competition_old_receipt(p.round_id,actor,request,fp); IF old IS NOT NULL THEN RETURN old; END IF;
  PERFORM id FROM public.judge_control WHERE id=1 FOR UPDATE;
  answer=jsonb_build_object('status','REJECTED','reason','UNSAFE_RECOVERY');
  IF p.lane='OFFICIAL' AND p.completed_at IS NULL AND EXISTS(SELECT 1 FROM public.rounds WHERE id=p.round_id AND state IN ('RUNNING','PAUSED','CLOSING'))
    AND EXISTS(SELECT 1 FROM public.participant_jobs WHERE id=job AND result IS NULL)
    AND (SELECT count(*) FROM public.participant_attempts WHERE job_id=job)=3
    AND NOT EXISTS(SELECT 1 FROM public.participant_attempts WHERE job_id=job AND (result IS DISTINCT FROM 'INFRA_ERROR' OR released_at IS NULL))
    AND NOT EXISTS(SELECT 1 FROM public.participant_retry_permissions WHERE job_id=job) THEN
    INSERT INTO public.participant_retry_permissions VALUES(job,source);
    UPDATE public.participant_jobs SET status='RECOVERING' WHERE id=job;
    answer=jsonb_build_object('status','APPLIED','job_id',job);
  END IF;
  old=public.competition_receipt(source,p.round_id,sid,actor,request,'RETRY_JOB',fp,reason,answer,n,true);
  IF answer->>'status'='APPLIED' THEN UPDATE public.staff_sessions SET last_activity_at=n WHERE id=sid; END IF;
  RETURN old;
END $$;
--> statement-breakpoint
CREATE FUNCTION participant_plan_integrity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE subject uuid; p public.participant_judging%ROWTYPE;
BEGIN
  IF TG_TABLE_NAME='participant_judging' THEN subject=NEW.id;
  ELSIF TG_TABLE_NAME='participant_jobs' THEN subject=NEW.parent_id;
  ELSIF TG_TABLE_NAME='participant_attempts' THEN SELECT parent_id INTO subject FROM public.participant_jobs WHERE id=NEW.job_id;
  ELSE subject=NEW.submission_id; END IF;
  SELECT * INTO p FROM public.participant_judging WHERE id=subject;
  IF p.id IS NULL THEN RAISE EXCEPTION 'Participant plan is missing'; END IF;
  IF p.reserved_bytes<>public.participant_accounted(p.id) THEN RAISE EXCEPTION 'Participant byte reservation mismatch'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.member_rounds m JOIN public.team_rounds t ON t.id=m.team_round_id
    JOIN public.bounties b ON b.id=p.bounty_id JOIN public.validation_snapshot_variants v ON v.snapshot_id=p.snapshot_id AND v.language=p.language
    JOIN public.runtime_manifests r ON r.key=p.runtime_key AND r.language=p.language
    WHERE m.id=p.member_round_id AND t.id=p.team_round_id AND t.round_id=p.round_id AND b.round_id=p.round_id AND b.snapshot_id=p.snapshot_id
      AND m.language=p.language AND v.runtime_key=p.runtime_key AND r.digest=p.runtime_digest) THEN RAISE EXCEPTION 'Foreign participant plan'; END IF;
  IF p.lane='OFFICIAL' AND NOT EXISTS(SELECT 1 FROM public.competition_submissions s WHERE s.id=p.id AND s.source=p.source AND s.language=p.language
    AND s.member_round_id=p.member_round_id AND s.team_round_id=p.team_round_id AND s.bounty_id=p.bounty_id AND s.received_at=p.created_at) THEN RAISE EXCEPTION 'Official plan lost its exact admission'; END IF;
  IF p.lane='SAMPLE' AND NOT EXISTS(SELECT 1 FROM public.competition_outcomes o WHERE o.id=p.source_id AND o.round_id=p.round_id AND o.actor_id=p.member_round_id
    AND o.action='RUN' AND o.result->>'status'='ADMITTED' AND o.result->>'run_id'=p.id::text AND o.recorded_at=p.created_at) THEN RAISE EXCEPTION 'Sample plan lost its exact receipt'; END IF;
  IF EXISTS((SELECT case_id,position FROM public.validation_snapshot_cases WHERE snapshot_id=p.snapshot_id AND (p.lane='OFFICIAL' OR visibility='SAMPLE')
    EXCEPT SELECT case_id,position FROM public.participant_jobs WHERE parent_id=p.id) UNION ALL
    (SELECT case_id,position FROM public.participant_jobs WHERE parent_id=p.id EXCEPT SELECT case_id,position FROM public.validation_snapshot_cases WHERE snapshot_id=p.snapshot_id AND (p.lane='OFFICIAL' OR visibility='SAMPLE')))
    THEN RAISE EXCEPTION 'Participant suite is incomplete'; END IF;
  IF EXISTS(SELECT 1 FROM public.participant_jobs j LEFT JOIN public.participant_attempts a ON a.id=j.settling_attempt_id
    WHERE j.parent_id=p.id AND j.result IS NOT NULL AND (a.id IS NULL OR a.job_id<>j.id OR a.result<>j.result)) THEN RAISE EXCEPTION 'Case result lacks its own reliable attempt'; END IF;
  IF p.completed_at IS NOT NULL AND ((p.result='INFRA_ERROR' AND (p.lane<>'SAMPLE' OR p.completed_at<p.created_at+interval '120 seconds'))
    OR (p.result<>'INFRA_ERROR' AND (EXISTS(SELECT 1 FROM public.participant_jobs WHERE parent_id=p.id AND result IS NULL)
      OR (p.lane='SAMPLE' AND p.completed_at>=p.created_at+interval '120 seconds')))) THEN RAISE EXCEPTION 'Invalid whole-parent completion'; END IF;
  IF EXISTS(SELECT 1 FROM public.competition_assessments WHERE submission_id=p.id) AND
    (p.completed_at IS NULL OR EXISTS(SELECT 1 FROM public.participant_jobs WHERE parent_id=p.id AND result IS NULL)) THEN RAISE EXCEPTION 'Official assessment skipped the protected jobs'; END IF;
  RETURN NULL;
END $$;
CREATE FUNCTION participant_accounted(subject uuid) RETURNS bigint LANGUAGE sql STABLE SET search_path=pg_catalog,public AS $$
  SELECT 524288+CASE WHEN p.completed_at IS NULL THEN
    (SELECT count(*) FROM public.participant_jobs WHERE parent_id=p.id)*262144*CASE WHEN p.lane='OFFICIAL' THEN 4 ELSE 2 END
    ELSE COALESCE((SELECT sum(CASE WHEN a.result IS NULL THEN 262144 ELSE
      2048+octet_length(a.evidence::text)+octet_length(a.stdout_prefix)+octet_length(a.stderr)+octet_length(a.compiler_output) END)
      FROM public.participant_attempts a JOIN public.participant_jobs j ON j.id=a.job_id WHERE j.parent_id=p.id),0) END
    FROM public.participant_judging p WHERE p.id=subject;
$$;
CREATE FUNCTION participant_rebudget(subject uuid) RETURNS void LANGUAGE sql SET search_path=pg_catalog,public AS $$
  UPDATE public.participant_judging SET reserved_bytes=public.participant_accounted(subject) WHERE id=subject AND completed_at IS NOT NULL AND reserved_bytes<>public.participant_accounted(subject);
$$;
REVOKE ALL ON FUNCTION participant_accounted(uuid),participant_rebudget(uuid) FROM PUBLIC;
CREATE CONSTRAINT TRIGGER participant_parent_integrity AFTER INSERT OR UPDATE ON participant_judging DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION participant_plan_integrity();
CREATE CONSTRAINT TRIGGER participant_job_integrity AFTER INSERT OR UPDATE ON participant_jobs DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION participant_plan_integrity();
CREATE CONSTRAINT TRIGGER participant_attempt_integrity AFTER INSERT OR UPDATE ON participant_attempts DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION participant_plan_integrity();
CREATE CONSTRAINT TRIGGER participant_assessment_integrity AFTER INSERT ON competition_assessments DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION participant_plan_integrity();
CREATE FUNCTION participant_authoring_barrier() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  IF NEW.active_validation_id IS NOT NULL AND (EXISTS(SELECT 1 FROM public.participant_judging WHERE completed_at IS NULL)
    OR EXISTS(SELECT 1 FROM public.participant_attempts WHERE released_at IS NULL)) THEN RAISE EXCEPTION 'Participant work must drain before authoring'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER participant_authoring_exclusion BEFORE UPDATE ON judge_control FOR EACH ROW EXECUTE FUNCTION participant_authoring_barrier();
REVOKE ALL ON FUNCTION participant_defer(uuid,bigint,uuid),participant_expire(uuid),participant_retry(uuid,uuid,uuid,text,bytea),participant_plan_integrity() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION participant_expire(uuid),participant_retry(uuid,uuid,uuid,text,bytea) TO ingenium_api;
GRANT EXECUTE ON FUNCTION participant_defer(uuid,bigint,uuid) TO ingenium_competition_worker;
GRANT SELECT ON participant_retry_permissions TO ingenium_api,ingenium_competition_worker;
REVOKE ALL ON FUNCTION participant_authoring_barrier() FROM PUBLIC;
CREATE FUNCTION participant_retry_integrity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.competition_outcomes o JOIN public.participant_jobs j ON j.id=NEW.job_id
    JOIN public.participant_judging p ON p.id=j.parent_id WHERE o.id=NEW.source_id AND o.round_id=p.round_id AND o.staff_session_id IS NOT NULL
      AND o.action='RETRY_JOB' AND o.result->>'status'='APPLIED' AND o.result->>'job_id'=j.id::text) THEN RAISE EXCEPTION 'Extra dispatch needs its exact confirmed receipt'; END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER participant_retry_integrity AFTER INSERT ON participant_retry_permissions DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION participant_retry_integrity();
REVOKE ALL ON FUNCTION participant_retry_integrity() FROM PUBLIC;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION guard_participant_activity_source() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF NEW.last_activity_at IS DISTINCT FROM OLD.last_activity_at AND (
    OLD.revoked_at IS NOT NULL OR NEW.last_activity_at>=OLD.absolute_expires_at OR NEW.last_activity_at>=OLD.last_activity_at+interval '2 hours'
    OR NOT EXISTS(SELECT 1 FROM public.member_session_slots WHERE member_id=OLD.member_id AND session_id=OLD.id)
  ) THEN RAISE EXCEPTION 'Expired or retired participant sessions cannot renew'; END IF;
  IF NEW.last_activity_at IS DISTINCT FROM OLD.last_activity_at AND NOT EXISTS(
    SELECT 1 FROM public.participant_session_outcomes o WHERE o.session_id=NEW.id AND o.action='KEEP_ALIVE' AND o.recorded_at=NEW.last_activity_at
  ) AND NOT EXISTS(
    SELECT 1 FROM public.competition_outcomes o WHERE o.participant_session_id=NEW.id AND o.recorded_at=NEW.last_activity_at
      AND o.xmin::text::bigint=(pg_current_xact_id()::text::bigint & 4294967295)
      AND ((o.action='SUBMIT' AND o.result->>'status'='ADMITTED' AND EXISTS(SELECT 1 FROM public.competition_submissions WHERE source_id=o.id AND member_round_id=NEW.member_round_id))
        OR (o.action='RUN' AND o.result->>'status'='ADMITTED' AND EXISTS(SELECT 1 FROM public.participant_judging WHERE source_id=o.id AND member_round_id=NEW.member_round_id AND lane='SAMPLE'))
        OR (o.action='HINT' AND o.result->>'status'='PURCHASED' AND EXISTS(SELECT 1 FROM public.hint_purchases WHERE source_id=o.id)))
  ) THEN RAISE EXCEPTION 'Participant activity requires its committed source'; END IF;
  IF OLD.revoked_at IS NULL AND NEW.revocation_reason='LOGOUT' AND NOT EXISTS(
    SELECT 1 FROM public.participant_session_outcomes o WHERE o.session_id=NEW.id AND o.action='LOGOUT' AND o.recorded_at=NEW.revoked_at
  ) THEN RAISE EXCEPTION 'Participant logout requires its committed source'; END IF;
  IF OLD.revoked_at IS NULL AND NEW.revocation_reason='LOGOUT' AND (
    NEW.revoked_at<OLD.last_activity_at OR NEW.revoked_at>=OLD.absolute_expires_at OR NEW.revoked_at>=OLD.last_activity_at+interval '2 hours'
  ) THEN RAISE EXCEPTION 'Logout must use a still-valid participant session'; END IF;
  RETURN NEW;
END $$;
