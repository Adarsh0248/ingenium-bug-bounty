-- Custom SQL migration file, put your code below! --
CREATE TRIGGER cancellation_immutable BEFORE UPDATE OR DELETE ON round_cancellations FOR EACH ROW EXECUTE FUNCTION immutable_access_history();
CREATE TRIGGER cancellation_finish_immutable BEFORE UPDATE OR DELETE ON cancellation_finishes FOR EACH ROW EXECUTE FUNCTION immutable_access_history();
REVOKE ALL ON round_cancellations,cancellation_finishes FROM PUBLIC,ingenium_api;
GRANT SELECT ON round_cancellations,cancellation_finishes TO ingenium_api;
--> statement-breakpoint
CREATE FUNCTION cancellation_progress(subject uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE c uuid; parent uuid;
BEGIN
  SELECT x.id INTO c FROM public.round_cancellations x JOIN public.rounds r ON r.id=x.round_id WHERE x.round_id=subject AND r.state='CANCELLING';
  IF c IS NULL THEN RETURN; END IF;
  -- Bounded logical drain keeps emergency fencing inside the existing transaction budget.
  FOR parent IN SELECT id FROM public.participant_judging p WHERE p.round_id=subject
    AND (p.status NOT IN ('COMPLETED','CANCELLED') OR EXISTS(SELECT 1 FROM public.participant_jobs j WHERE j.parent_id=p.id AND j.status NOT IN ('COMPLETED','CANCELLED')))
    ORDER BY id LIMIT 20 FOR UPDATE LOOP
    UPDATE public.participant_jobs SET status='CANCELLED',cancellation_id=c WHERE parent_id=parent AND status NOT IN ('COMPLETED','CANCELLED');
    UPDATE public.participant_judging SET status='CANCELLED',cancellation_id=c WHERE id=parent AND status NOT IN ('COMPLETED','CANCELLED');
    PERFORM public.participant_rebudget(parent);
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION cancellation_progress(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cancellation_progress(uuid) TO ingenium_api;
--> statement-breakpoint
CREATE FUNCTION competition_cancel_command(sid uuid,subject uuid,request uuid,expected bigint,action text,p jsonb,reason text,own_verifier bytea)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE r public.rounds%ROWTYPE; actor uuid; n timestamptz; fp bytea; old jsonb; source uuid=gen_random_uuid(); result jsonb;
  gate uuid; cancellation uuid; incident text; pending integer;
BEGIN
  PERFORM id FROM public.security_control WHERE id=1 FOR UPDATE;
  PERFORM * FROM public.lock_validation_judge();
  SELECT current_instance_id INTO gate FROM public.arena_control WHERE id=1;
  SELECT * INTO r FROM public.rounds WHERE id=subject FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Round unavailable' USING ERRCODE='22023'; END IF;
  n=public.competition_now(subject);
  SELECT s.staff_id INTO actor FROM public.staff_sessions s JOIN public.staff_session_slots z ON z.staff_id=s.staff_id AND z.session_id=s.id
    JOIN public.staff_identities i ON i.id=s.staff_id JOIN public.access_credentials c ON c.id=s.credential_id AND c.version=s.credential_version
    WHERE s.id=sid AND s.mode='NORMAL' AND s.revoked_at IS NULL AND i.role IN ('OWNER','SUPER_ADMIN') AND i.disabled_at IS NULL AND c.revoked_at IS NULL
      AND c.verifier=own_verifier AND n>=s.created_at AND n>=s.last_activity_at AND c.issued_at<=n AND n<s.absolute_expires_at AND n<s.last_activity_at+interval '15 minutes';
  IF actor IS NULL THEN RAISE EXCEPTION 'Current confirmed cancellation authority required' USING ERRCODE='42501'; END IF;
  IF action IS NULL OR action NOT IN ('CANCEL_ROUND','FINISH_CANCEL') OR request IS NULL OR expected IS NULL OR expected<0
    OR reason IS NULL OR octet_length(reason) NOT BETWEEN 1 AND 1024 OR btrim(reason)='' OR jsonb_typeof(p) IS DISTINCT FROM 'object'
    OR p->>'arena_id' IS DISTINCT FROM r.arena_instance_id::text
    OR (action='CANCEL_ROUND' AND ((SELECT count(*) FROM jsonb_object_keys(p))<>3 OR p->>'confirmed_round_id' IS DISTINCT FROM subject::text
      OR p->>'incident_ref' IS NULL OR (p->>'incident_ref') !~ '^[A-Za-z0-9][A-Za-z0-9._/-]{0,119}$'))
    OR (action='FINISH_CANCEL' AND ((SELECT count(*) FROM jsonb_object_keys(p))<>2 OR p->>'cancellation_id' IS NULL)) THEN RAISE EXCEPTION 'Exact cancellation context required' USING ERRCODE='22023'; END IF;
  fp=public.competition_fingerprint(action,p,expected,reason);
  old=public.competition_old_receipt(subject,actor,request,fp); IF old IS NOT NULL THEN RETURN old; END IF;
  result=jsonb_build_object('status','APPLIED');
  IF gate IS DISTINCT FROM r.arena_instance_id THEN result=jsonb_build_object('status','REJECTED','reason','ARENA_UNAVAILABLE');
  ELSIF expected<>r.revision THEN result=jsonb_build_object('status','REJECTED','reason','STALE_VERSION'); END IF;
  IF result->>'status'='APPLIED' AND action='CANCEL_ROUND' THEN
    IF r.state NOT IN ('RUNNING','PAUSED','CLOSING') OR EXISTS(SELECT 1 FROM public.round_results WHERE round_id=subject)
      OR EXISTS(SELECT 1 FROM public.round_cancellations WHERE round_id=subject) THEN result=jsonb_build_object('status','REJECTED','reason','ROUND_UNAVAILABLE');
    ELSE
      cancellation=gen_random_uuid(); incident=p->>'incident_ref';
      -- The source, fencing state and cancelled logical work commit together; no remote stop is inferred.
      old=public.competition_receipt(source,subject,sid,actor,request,action,fp,reason,jsonb_build_object('status','APPLIED','cancellation_id',cancellation),n,true);
      INSERT INTO public.round_cancellations VALUES(cancellation,r.arena_instance_id,subject,source,incident);
      UPDATE public.rounds SET state='CANCELLING',revision=revision+1 WHERE id=subject;
      PERFORM public.cancellation_progress(subject);
    END IF;
  ELSIF result->>'status'='APPLIED' THEN
    SELECT id INTO cancellation FROM public.round_cancellations WHERE round_id=subject AND id::text=p->>'cancellation_id';
    IF r.state<>'CANCELLING' OR cancellation IS NULL THEN result=jsonb_build_object('status','REJECTED','reason','ROUND_UNAVAILABLE');
    ELSE
      PERFORM public.cancellation_progress(subject);
      SELECT count(*) INTO pending FROM public.participant_attempts a JOIN public.participant_jobs j ON j.id=a.job_id
        JOIN public.participant_judging q ON q.id=j.parent_id JOIN public.rounds x ON x.id=q.round_id WHERE x.arena_instance_id=r.arena_instance_id AND a.released_at IS NULL;
      IF pending>0 OR EXISTS(SELECT 1 FROM public.participant_judging WHERE round_id=subject AND status NOT IN ('COMPLETED','CANCELLED'))
        OR EXISTS(SELECT 1 FROM public.participant_jobs j JOIN public.participant_judging p ON p.id=j.parent_id WHERE p.round_id=subject AND j.status NOT IN ('COMPLETED','CANCELLED')) THEN
        result=jsonb_build_object('status','REJECTED','reason','DRAIN_PENDING');
      ELSE
        old=public.competition_receipt(source,subject,sid,actor,request,action,fp,reason,jsonb_build_object('status','APPLIED','cancellation_id',cancellation),n,true);
        INSERT INTO public.cancellation_finishes VALUES(cancellation,source);
        UPDATE public.rounds SET state='CANCELLED',revision=revision+1 WHERE id=subject;
        UPDATE public.arena_instances SET status='DISCARDED',revision=revision+1 WHERE id=r.arena_instance_id;
        UPDATE public.arena_control SET current_instance_id=NULL,revision=revision+1 WHERE id=1;
      END IF;
    END IF;
  END IF;
  IF old IS NULL THEN old=public.competition_receipt(source,subject,sid,actor,request,action,fp,reason,result,n,true); END IF;
  IF old->'result'->>'status'='APPLIED' THEN
    UPDATE public.staff_sessions SET last_activity_at=n WHERE id=sid;
    PERFORM public.competition_event(subject,NULL,'ROUND_CHANGED',source,n);
  END IF;
  RETURN old;
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION guard_participant_judging() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Participant judging history is retained'; END IF;
  IF TG_TABLE_NAME='participant_judging' THEN
    IF (to_jsonb(NEW)-ARRAY['status','result','started_at','completed_at','reserved_bytes','cancellation_id']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','result','started_at','completed_at','reserved_bytes','cancellation_id'])
      OR (OLD.started_at IS NOT NULL AND NEW.started_at IS DISTINCT FROM OLD.started_at)
      OR ((OLD.completed_at IS NOT NULL OR OLD.status='CANCELLED') AND (to_jsonb(NEW)-'reserved_bytes') IS DISTINCT FROM (to_jsonb(OLD)-'reserved_bytes'))
      OR NEW.reserved_bytes>OLD.reserved_bytes OR (NEW.reserved_bytes<>OLD.reserved_bytes AND NEW.reserved_bytes<>public.participant_accounted(OLD.id)) THEN RAISE EXCEPTION 'Participant plan or terminal result is immutable'; END IF;
  ELSIF TG_TABLE_NAME='participant_jobs' THEN
    IF ROW(NEW.id,NEW.parent_id,NEW.case_id,NEW.position) IS DISTINCT FROM ROW(OLD.id,OLD.parent_id,OLD.case_id,OLD.position)
      OR ((OLD.result IS NOT NULL OR OLD.status='CANCELLED') AND NEW IS DISTINCT FROM OLD) THEN RAISE EXCEPTION 'Frozen participant job is immutable'; END IF;
  ELSE
    IF (to_jsonb(NEW)-ARRAY['result','evidence','result_digest','stdout_prefix','stderr','compiler_output','resolved_at','release_digest','released_at','poll_count','next_poll_at'])
      IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['result','evidence','result_digest','stdout_prefix','stderr','compiler_output','resolved_at','release_digest','released_at','poll_count','next_poll_at'])
      OR (OLD.result IS NOT NULL AND ROW(NEW.result,NEW.evidence,NEW.result_digest,NEW.stdout_prefix,NEW.stderr,NEW.compiler_output,NEW.resolved_at)
        IS DISTINCT FROM ROW(OLD.result,OLD.evidence,OLD.result_digest,OLD.stdout_prefix,OLD.stderr,OLD.compiler_output,OLD.resolved_at))
      OR (OLD.released_at IS NOT NULL AND ROW(NEW.released_at,NEW.release_digest) IS DISTINCT FROM ROW(OLD.released_at,OLD.release_digest)) THEN RAISE EXCEPTION 'Attempt binding or saved evidence is immutable'; END IF;
    IF NEW.poll_count<OLD.poll_count OR NEW.poll_count>OLD.poll_count+1 OR NEW.next_poll_at<OLD.next_poll_at THEN RAISE EXCEPTION 'Participant polling budget cannot reset'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE FUNCTION cancelled_processing_source() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE stage uuid;
BEGIN
  IF NEW.status<>'CANCELLED' THEN RETURN NULL; END IF;
  IF TG_TABLE_NAME='participant_judging' THEN stage=NEW.round_id;
  ELSE SELECT round_id INTO stage FROM public.participant_judging WHERE id=NEW.parent_id; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.round_cancellations c JOIN public.rounds r ON r.id=c.round_id
    WHERE c.id=NEW.cancellation_id AND c.round_id=stage AND r.state IN ('CANCELLING','CANCELLED')) THEN RAISE EXCEPTION 'Cancelled work needs its whole-round source'; END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER cancelled_parent_source AFTER INSERT OR UPDATE ON participant_judging DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION cancelled_processing_source();
CREATE CONSTRAINT TRIGGER cancelled_job_source AFTER INSERT OR UPDATE ON participant_jobs DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION cancelled_processing_source();
REVOKE ALL ON FUNCTION competition_cancel_command(uuid,uuid,uuid,bigint,text,jsonb,text,bytea) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION competition_cancel_command(uuid,uuid,uuid,bigint,text,jsonb,text,bytea) TO ingenium_api;
--> statement-breakpoint
CREATE FUNCTION cancellation_integrity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE c public.round_cancellations%ROWTYPE; o public.competition_outcomes%ROWTYPE;
BEGIN
  IF TG_TABLE_NAME='round_cancellations' THEN c=NEW;
  ELSE SELECT * INTO c FROM public.round_cancellations WHERE id=NEW.cancellation_id; END IF;
  SELECT * INTO o FROM public.competition_outcomes WHERE id=CASE WHEN TG_TABLE_NAME='cancellation_finishes' THEN NEW.source_id ELSE c.source_id END;
  IF o.round_id IS DISTINCT FROM c.round_id OR o.staff_session_id IS NULL OR o.action IS DISTINCT FROM (CASE WHEN TG_TABLE_NAME='cancellation_finishes' THEN 'FINISH_CANCEL' ELSE 'CANCEL_ROUND' END)
    OR o.result->>'status' IS DISTINCT FROM 'APPLIED' OR o.result->>'cancellation_id' IS DISTINCT FROM c.id::text THEN RAISE EXCEPTION 'Cancellation requires its exact confirmed source'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.rounds WHERE id=c.round_id AND arena_instance_id=c.arena_id AND state IN ('CANCELLING','CANCELLED'))
    OR EXISTS(SELECT 1 FROM public.round_results WHERE round_id=c.round_id) THEN RAISE EXCEPTION 'Cancelled round cannot have a sporting final'; END IF;
  IF TG_TABLE_NAME='cancellation_finishes' AND (NOT EXISTS(SELECT 1 FROM public.rounds WHERE id=c.round_id AND state='CANCELLED')
    OR EXISTS(SELECT 1 FROM public.participant_attempts a JOIN public.participant_jobs j ON j.id=a.job_id JOIN public.participant_judging q ON q.id=j.parent_id
      JOIN public.rounds r ON r.id=q.round_id WHERE r.arena_instance_id=c.arena_id AND a.released_at IS NULL)) THEN RAISE EXCEPTION 'Cancellation drain is incomplete'; END IF;
  RETURN NULL;
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION participant_plan(subject uuid,submission uuid,receipt uuid,lane_name text,stage uuid,team uuid,member uuid,bounty uuid,code bytea,lang text,n timestamptz)
RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE snap uuid; host uuid; profile record; count_cases integer; reserve bigint;
BEGIN
  PERFORM id FROM public.judge_control WHERE id=1 FOR UPDATE;
  SELECT host_epoch_id INTO host FROM public.judge_control WHERE id=1 AND lease_until>n AND active_validation_id IS NULL;
  SELECT snapshot_id INTO snap FROM public.bounties WHERE id=bounty AND round_id=stage;
  SELECT v.runtime_key,m.digest INTO profile FROM public.validation_snapshot_variants v
    JOIN public.judge_host_runtimes h ON h.host_epoch_id=host AND h.language=v.language AND h.runtime_key=v.runtime_key
    JOIN public.runtime_manifests m ON m.key=v.runtime_key AND m.language=v.language
    JOIN public.judge_host_epochs e ON e.id=host AND e.state='ACTIVE' WHERE v.snapshot_id=snap AND v.language=lang;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Frozen participant runtime unavailable'; END IF;
  SELECT count(*) INTO count_cases FROM public.validation_snapshot_cases WHERE snapshot_id=snap AND (lane_name='OFFICIAL' OR visibility='SAMPLE');
  IF count_cases NOT BETWEEN 1 AND 20 OR (lane_name='SAMPLE' AND count_cases>3) THEN RAISE EXCEPTION 'Invalid participant suite'; END IF;
  IF (SELECT count(*) FROM public.participant_jobs j JOIN public.participant_judging p ON p.id=j.parent_id
      WHERE p.lane=lane_name AND p.completed_at IS NULL AND p.status<>'CANCELLED' AND j.result IS NULL)+count_cases>(CASE WHEN lane_name='OFFICIAL' THEN 4096 ELSE 256 END)
    OR (SELECT count(*) FROM public.participant_judging p JOIN public.rounds r ON r.id=p.round_id WHERE p.lane=lane_name
      AND r.arena_instance_id=(SELECT arena_instance_id FROM public.rounds WHERE id=stage))>=20000
    THEN RAISE EXCEPTION USING ERRCODE='54000',MESSAGE='Participant queue capacity'; END IF;
  IF EXISTS(SELECT 1 FROM public.participant_judging WHERE member_round_id=member AND lane=lane_name
    AND created_at>n-CASE WHEN lane_name='OFFICIAL' THEN interval '5 seconds' ELSE interval '3 seconds' END) THEN
    RAISE EXCEPTION USING ERRCODE='P0003',MESSAGE='Participant judging cooldown'; END IF;
  reserve=524288+count_cases::bigint*262144*CASE WHEN lane_name='OFFICIAL' THEN 4 ELSE 2 END;
  IF COALESCE((SELECT sum(reserved_bytes) FROM public.participant_judging WHERE team_round_id=team),0)+reserve>201326592
    OR COALESCE((SELECT sum(reserved_bytes) FROM public.participant_judging),0)+reserve>31138512896 THEN
    RAISE EXCEPTION USING ERRCODE='54000',MESSAGE='Participant retained evidence capacity'; END IF;
  INSERT INTO public.participant_judging(id,submission_id,source_id,lane,round_id,team_round_id,member_round_id,bounty_id,snapshot_id,source,language,host_epoch_id,runtime_key,runtime_digest,created_at,status,reserved_bytes)
    VALUES(subject,submission,receipt,lane_name,stage,team,member,bounty,snap,code,lang,host,profile.runtime_key,profile.digest,n,'QUEUED',reserve);
  INSERT INTO public.participant_jobs(id,parent_id,case_id,position,available_at,status)
    SELECT gen_random_uuid(),subject,case_id,position,n,'QUEUED' FROM public.validation_snapshot_cases WHERE snapshot_id=snap AND (lane_name='OFFICIAL' OR visibility='SAMPLE') ORDER BY position;
END $$;
CREATE CONSTRAINT TRIGGER cancellation_source AFTER INSERT ON round_cancellations DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION cancellation_integrity();
CREATE CONSTRAINT TRIGGER cancellation_finish_source AFTER INSERT ON cancellation_finishes DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION cancellation_integrity();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION participant_accounted(subject uuid) RETURNS bigint LANGUAGE sql STABLE SET search_path=pg_catalog,public AS $$
  SELECT 524288+CASE WHEN p.completed_at IS NULL AND p.status<>'CANCELLED' THEN
    (SELECT count(*) FROM public.participant_jobs WHERE parent_id=p.id)*262144*CASE WHEN p.lane='OFFICIAL' THEN 4 ELSE 2 END
    ELSE COALESCE((SELECT sum(CASE WHEN a.result IS NULL THEN 262144 ELSE
      2048+octet_length(a.evidence::text)+octet_length(a.stdout_prefix)+octet_length(a.stderr)+octet_length(a.compiler_output) END)
      FROM public.participant_attempts a JOIN public.participant_jobs j ON j.id=a.job_id WHERE j.parent_id=p.id),0) END
    FROM public.participant_judging p WHERE p.id=subject;
$$;
CREATE OR REPLACE FUNCTION participant_rebudget(subject uuid) RETURNS void LANGUAGE sql SET search_path=pg_catalog,public AS $$
  UPDATE public.participant_judging SET reserved_bytes=public.participant_accounted(subject) WHERE id=subject AND (completed_at IS NOT NULL OR status='CANCELLED') AND reserved_bytes<>public.participant_accounted(subject);
$$;
CREATE OR REPLACE FUNCTION participant_authoring_barrier() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  IF NEW.active_validation_id IS NOT NULL AND (EXISTS(SELECT 1 FROM public.participant_judging WHERE completed_at IS NULL AND status<>'CANCELLED')
    OR EXISTS(SELECT 1 FROM public.participant_attempts WHERE released_at IS NULL)) THEN RAISE EXCEPTION 'Participant work must drain before authoring'; END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION participant_refresh(n timestamptz) RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE p public.participant_judging%ROWTYPE; final text; cases jsonb; expired uuid;
BEGIN
  PERFORM public.cancellation_progress(round_id) FROM public.round_cancellations c JOIN public.rounds r ON r.id=c.round_id WHERE r.state='CANCELLING';
  FOR expired IN UPDATE public.participant_judging SET status='COMPLETED',result='INFRA_ERROR',completed_at=n
    WHERE lane='SAMPLE' AND completed_at IS NULL AND status<>'CANCELLED' AND NOT EXISTS(SELECT 1 FROM public.round_cancellations c WHERE c.round_id=participant_judging.round_id) AND n>=created_at+interval '120 seconds' RETURNING id LOOP
    PERFORM public.participant_rebudget(expired);
  END LOOP;
  FOR p IN SELECT * FROM public.participant_judging q WHERE completed_at IS NULL AND status<>'CANCELLED' AND NOT EXISTS(SELECT 1 FROM public.round_cancellations c WHERE c.round_id=q.round_id) ORDER BY created_at,id LOOP
    IF NOT EXISTS(SELECT 1 FROM public.participant_jobs WHERE parent_id=p.id AND result IS NULL) THEN
      SELECT result INTO final FROM public.participant_jobs WHERE parent_id=p.id AND result<>'PASSED' ORDER BY position LIMIT 1;
      final=COALESCE(final,'PASSED');
      IF p.lane='OFFICIAL' THEN
        SELECT jsonb_agg(jsonb_build_object('case_id',j.case_id,'verdict',j.result,'evidence_digest',encode(a.result_digest,'hex')) ORDER BY j.position) INTO cases
          FROM public.participant_jobs j JOIN public.participant_attempts a ON a.id=j.settling_attempt_id WHERE j.parent_id=p.id;
        PERFORM public.competition_assess(p.id,sha256(p.source),cases);
      END IF;
      UPDATE public.participant_judging SET status='COMPLETED',result=final,completed_at=n WHERE id=p.id;
      PERFORM public.participant_rebudget(p.id);
    ELSIF (p.lane='OFFICIAL' AND n>=p.created_at+interval '5 minutes') OR EXISTS(SELECT 1 FROM public.participant_jobs WHERE parent_id=p.id AND status='NEEDS_ATTENTION') THEN
      UPDATE public.participant_judging SET status='NEEDS_ATTENTION' WHERE id=p.id;
    ELSIF EXISTS(SELECT 1 FROM public.participant_jobs WHERE parent_id=p.id AND status='RECOVERING') THEN
      UPDATE public.participant_judging SET status='RECOVERING' WHERE id=p.id;
    END IF;
  END LOOP;
END $$;
CREATE OR REPLACE FUNCTION participant_expire(subject uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE n timestamptz; expired uuid;
BEGIN
  PERFORM id FROM public.security_control WHERE id=1 FOR SHARE;
  n=public.competition_now(subject);
  PERFORM public.cancellation_progress(subject);
  FOR expired IN UPDATE public.participant_judging SET status='COMPLETED',result='INFRA_ERROR',completed_at=n
    WHERE round_id=subject AND lane='SAMPLE' AND completed_at IS NULL AND status<>'CANCELLED' AND NOT EXISTS(SELECT 1 FROM public.round_cancellations c WHERE c.round_id=subject) AND n>=created_at+interval '120 seconds' RETURNING id LOOP
    PERFORM public.participant_rebudget(expired);
  END LOOP;
END $$;
CREATE OR REPLACE FUNCTION participant_defer(worker uuid,generation bigint,attempt uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  PERFORM * FROM public.lock_validation_judge(); PERFORM public.require_validation_worker(worker,generation);
  UPDATE public.participant_jobs j SET status='NEEDS_ATTENTION' FROM public.participant_attempts a
    WHERE a.id=attempt AND a.job_id=j.id AND a.released_at IS NULL AND j.result IS NULL AND j.status<>'CANCELLED' AND a.host_epoch_id=(SELECT host_epoch_id FROM public.judge_control WHERE id=1);
  PERFORM public.participant_refresh(public.validation_judge_time());
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION participant_record(worker uuid,generation bigint,attempt uuid,answer text,metadata jsonb,stdout bytea,stderr_bytes bytea,compiler_bytes bytea,release_proof bytea)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE a public.participant_attempts%ROWTYPE; p public.participant_judging%ROWTYPE; n timestamptz; digest bytea;
BEGIN
  PERFORM * FROM public.lock_validation_judge(); n=public.require_validation_worker(worker,generation);
  SELECT * INTO a FROM public.participant_attempts WHERE id=attempt FOR UPDATE;
  SELECT p0.* INTO p FROM public.participant_judging p0 JOIN public.participant_jobs j ON j.parent_id=p0.id WHERE j.id=a.job_id;
  IF a.id IS NULL OR a.host_epoch_id IS DISTINCT FROM (SELECT host_epoch_id FROM public.judge_control WHERE id=1)
    OR metadata->>'attempt_id' IS DISTINCT FROM a.id::text OR metadata->>'payload_digest' IS DISTINCT FROM encode(a.payload_digest,'hex')
    OR metadata->>'runtime_digest' IS DISTINCT FROM encode(p.runtime_digest,'hex') OR metadata->>'source_sha256' IS DISTINCT FROM encode(sha256(p.source),'hex')
    OR metadata->>'host_epoch_id' IS DISTINCT FROM a.host_epoch_id::text THEN RAISE EXCEPTION 'Unbound participant evidence'; END IF;
  digest=sha256(convert_to(metadata::text,'UTF8'));
  IF a.result IS NOT NULL AND (a.result<>answer OR a.result_digest<>digest OR a.stdout_prefix<>stdout OR a.stderr<>stderr_bytes OR a.compiler_output<>compiler_bytes) THEN RAISE EXCEPTION 'Conflicting participant evidence'; END IF;
  IF a.result IS NULL THEN
    UPDATE public.participant_attempts SET result=answer,evidence=metadata,result_digest=digest,stdout_prefix=stdout,stderr=stderr_bytes,compiler_output=compiler_bytes,resolved_at=n WHERE id=a.id;
    IF answer<>'INFRA_ERROR' THEN
      UPDATE public.participant_jobs SET status='COMPLETED',result=answer,completed_at=n,settling_attempt_id=a.id WHERE id=a.job_id AND result IS NULL AND status<>'CANCELLED' AND NOT EXISTS(SELECT 1 FROM public.round_cancellations WHERE round_id=p.round_id);
    END IF;
  END IF;
  IF release_proof IS NOT NULL THEN
    IF octet_length(release_proof)<>32 OR (a.release_digest IS NOT NULL AND a.release_digest<>release_proof) THEN RAISE EXCEPTION 'Conflicting physical drain'; END IF;
    UPDATE public.participant_attempts SET released_at=COALESCE(released_at,n),release_digest=release_proof WHERE id=a.id;
    UPDATE public.execution_capacity_slots SET participant_attempt_id=NULL,revision=revision+1 WHERE participant_attempt_id=a.id;
  END IF;
  IF answer='INFRA_ERROR' THEN
    UPDATE public.participant_jobs SET status=CASE WHEN release_proof IS NOT NULL AND a.number<CASE WHEN p.lane='SAMPLE' THEN 2 ELSE 3 END THEN 'RECOVERING' ELSE 'NEEDS_ATTENTION' END,
      available_at=COALESCE(a.resolved_at,n)+CASE WHEN a.number=1 THEN interval '2 seconds' ELSE interval '5 seconds' END WHERE id=a.job_id AND result IS NULL AND status<>'CANCELLED' AND NOT EXISTS(SELECT 1 FROM public.round_cancellations WHERE round_id=p.round_id);
  END IF;
  PERFORM public.participant_refresh(n);
  PERFORM public.participant_rebudget(p.id);
END $$;
