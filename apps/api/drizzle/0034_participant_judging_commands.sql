INSERT INTO participant_scheduler(id) VALUES(1);
CREATE INDEX participant_parent_member ON participant_judging(member_round_id,lane,created_at);
CREATE INDEX participant_parent_team ON participant_judging(team_round_id,lane,created_at);
CREATE INDEX participant_job_queue ON participant_jobs(parent_id,position) WHERE result IS NULL;
ALTER TABLE participant_judging ALTER CONSTRAINT participant_judging_source_id_competition_outcomes_id_fk DEFERRABLE INITIALLY DEFERRED;
--> statement-breakpoint
CREATE FUNCTION participant_plan(subject uuid,submission uuid,receipt uuid,lane_name text,stage uuid,team uuid,member uuid,bounty uuid,code bytea,lang text,n timestamptz)
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
      WHERE p.lane=lane_name AND p.completed_at IS NULL AND j.result IS NULL)+count_cases>(CASE WHEN lane_name='OFFICIAL' THEN 4096 ELSE 256 END)
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
CREATE FUNCTION participant_official_plan() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  PERFORM public.participant_plan(NEW.id,NEW.id,NULL,'OFFICIAL',NEW.round_id,NEW.team_round_id,NEW.member_round_id,NEW.bounty_id,NEW.source,NEW.language,NEW.received_at);
  RETURN NULL;
END $$;
CREATE TRIGGER participant_official_jobs AFTER INSERT ON competition_submissions FOR EACH ROW EXECUTE FUNCTION participant_official_plan();
--> statement-breakpoint
ALTER FUNCTION competition_participant_command(uuid,uuid,uuid,text,jsonb) RENAME TO competition_original_participant_command;
CREATE FUNCTION competition_participant_command(sid uuid,subject uuid,request uuid,action text,p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE r public.rounds%ROWTYPE; session public.participant_sessions%ROWTYPE; m public.member_rounds%ROWTYPE;
  n timestamptz; fp bytea; old jsonb; answer jsonb; source uuid=gen_random_uuid(); run uuid=gen_random_uuid(); target uuid; code bytea;
BEGIN
  IF action<>'RUN' THEN RETURN public.competition_original_participant_command(sid,subject,request,action,p); END IF;
  PERFORM id FROM public.security_control WHERE id=1 FOR SHARE;
  SELECT * INTO r FROM public.rounds WHERE id=subject FOR UPDATE; n=public.competition_now(subject);
  SELECT s.* INTO session FROM public.participant_sessions s JOIN public.member_session_slots slot ON slot.member_id=s.member_id AND slot.session_id=s.id
    JOIN public.access_credentials c ON c.id=s.credential_id AND c.version=s.credential_version AND c.team_id=s.team_id
    WHERE s.id=sid AND s.round_id=subject AND s.revoked_at IS NULL AND c.revoked_at IS NULL AND c.issued_at<=n
      AND n>=s.last_activity_at AND n<s.absolute_expires_at AND n<s.last_activity_at+interval '2 hours'
      AND NOT EXISTS(SELECT 1 FROM public.access_blocks WHERE arena_instance_id=r.arena_instance_id AND cleared_at IS NULL AND (team_id=s.team_id OR member_id=s.member_id));
  IF session.id IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Current participant authority required'; END IF;
  SELECT * INTO m FROM public.member_rounds WHERE id=session.member_round_id;
  IF p IS NULL OR jsonb_typeof(p)<>'object' OR octet_length(p::text)>180000 OR (SELECT count(*) FROM jsonb_object_keys(p))<>2 THEN RAISE EXCEPTION 'Invalid sample request'; END IF;
  target=(p->>'bounty_id')::uuid; code=decode(p->>'source_b64','base64');
  IF NOT EXISTS(SELECT 1 FROM public.bounties WHERE id=target AND round_id=subject) OR code IS NULL OR octet_length(code) NOT BETWEEN 1 AND 131072 THEN RAISE EXCEPTION 'Invalid sample source or bounty'; END IF;
  fp=public.competition_fingerprint(action,p,0,'PARTICIPANT'); old=public.competition_old_receipt(subject,m.id,request,fp); IF old IS NOT NULL THEN RETURN old; END IF;
  PERFORM public.competition_close_due(subject,n); SELECT * INTO r FROM public.rounds WHERE id=subject;
  answer=jsonb_build_object('status','REJECTED','reason','ROUND_UNAVAILABLE');
  IF r.state='RUNNING' AND n<r.closes_at AND EXISTS(SELECT 1 FROM public.arena_control WHERE id=1 AND current_instance_id=r.arena_instance_id)
    AND NOT public.competition_paused(subject,m.team_round_id,m.id) THEN
    IF EXISTS(SELECT 1 FROM public.bounty_awards WHERE bounty_id=target AND (r.kind=2 OR team_round_id=m.team_round_id)) THEN answer=jsonb_build_object('status','REJECTED','reason','BOUNTY_UNAVAILABLE');
    ELSE
      PERFORM id FROM public.judge_control WHERE id=1 FOR UPDATE;
      -- Expiry releases only logical sample allowances; an unknown physical attempt still occupies its slot.
      UPDATE public.participant_judging SET status='COMPLETED',result='INFRA_ERROR',completed_at=n
        WHERE lane='SAMPLE' AND member_round_id=m.id AND completed_at IS NULL AND n>=created_at+interval '120 seconds';
      PERFORM public.participant_rebudget(id) FROM public.participant_judging WHERE member_round_id=m.id AND lane='SAMPLE' AND completed_at=n;
      IF (SELECT count(*) FROM public.participant_judging WHERE member_round_id=m.id AND lane='SAMPLE' AND completed_at IS NULL)>=2 THEN
        RAISE EXCEPTION USING ERRCODE='54000',MESSAGE='Two unfinished sample Runs already admitted'; END IF;
      PERFORM public.participant_plan(run,NULL,source,'SAMPLE',subject,m.team_round_id,m.id,target,code,m.language,n);
      answer=jsonb_build_object('status','ADMITTED','run_id',run);
    END IF;
  END IF;
  old=public.competition_receipt(source,subject,sid,m.id,request,action,fp,'PARTICIPANT',answer,n,false);
  IF answer->>'status'='ADMITTED' THEN UPDATE public.participant_sessions SET last_activity_at=n WHERE id=sid; END IF;
  RETURN old;
END $$;
--> statement-breakpoint
CREATE FUNCTION participant_refresh(n timestamptz) RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE p public.participant_judging%ROWTYPE; final text; cases jsonb; expired uuid;
BEGIN
  FOR expired IN UPDATE public.participant_judging SET status='COMPLETED',result='INFRA_ERROR',completed_at=n
    WHERE lane='SAMPLE' AND completed_at IS NULL AND n>=created_at+interval '120 seconds' RETURNING id LOOP
    PERFORM public.participant_rebudget(expired);
  END LOOP;
  FOR p IN SELECT * FROM public.participant_judging WHERE completed_at IS NULL ORDER BY created_at,id LOOP
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
CREATE FUNCTION participant_candidate(n timestamptz,epoch uuid) RETURNS uuid LANGUAGE plpgsql STABLE SET search_path=pg_catalog,public AS $$
BEGIN
  RETURN (SELECT j.id FROM public.participant_jobs j JOIN public.participant_judging p ON p.id=j.parent_id CROSS JOIN public.participant_scheduler s CROSS JOIN public.judge_control c
    WHERE s.id=1 AND c.id=1 AND c.host_epoch_id=epoch AND c.active_validation_id IS NULL
      AND EXISTS(SELECT 1 FROM public.execution_capacity_slots WHERE authoring_attempt_id IS NULL AND participant_attempt_id IS NULL)
      AND EXISTS(SELECT 1 FROM public.judge_host_epochs WHERE id=epoch AND state='ACTIVE')
      AND j.result IS NULL AND j.status IN ('QUEUED','RECOVERING') AND j.available_at<=n AND p.completed_at IS NULL AND p.host_epoch_id=epoch
      AND (p.lane='OFFICIAL' OR n<p.created_at+interval '120 seconds')
      AND EXISTS(SELECT 1 FROM public.rounds WHERE id=p.round_id AND state IN ('RUNNING','PAUSED','CLOSING'))
      AND NOT EXISTS(SELECT 1 FROM public.participant_attempts live JOIN public.participant_jobs busy ON busy.id=live.job_id WHERE live.released_at IS NULL AND busy.parent_id=p.id)
      AND (SELECT count(*) FROM public.participant_attempts live JOIN public.participant_jobs x ON x.id=live.job_id JOIN public.participant_judging busy ON busy.id=x.parent_id
        JOIN public.team_rounds bt ON bt.id=busy.team_round_id JOIN public.team_rounds pt ON pt.id=p.team_round_id WHERE live.released_at IS NULL AND bt.team_id=pt.team_id)<2
    ORDER BY (p.lane=CASE WHEN s.turn=3 THEN 'SAMPLE' ELSE 'OFFICIAL' END) DESC,
      (p.team_round_id>CASE WHEN p.lane='OFFICIAL' THEN s.last_official_team ELSE s.last_sample_team END) DESC NULLS LAST,
      p.team_round_id,p.queue_order,j.position LIMIT 1);
END;
$$;
CREATE FUNCTION participant_next(worker uuid,generation bigint) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE c public.judge_control%ROWTYPE; n timestamptz; a public.participant_attempts%ROWTYPE; chosen uuid;
BEGIN
  SELECT * INTO c FROM public.lock_validation_judge(); n=public.require_validation_worker(worker,generation);
  PERFORM public.participant_refresh(n);
  SELECT * INTO a FROM public.participant_attempts WHERE released_at IS NULL AND host_epoch_id=c.host_epoch_id AND next_poll_at<=n AND poll_count<10000 ORDER BY next_poll_at,id LIMIT 1 FOR UPDATE;
  IF FOUND THEN
    UPDATE public.participant_attempts SET poll_count=poll_count+1,next_poll_at=n+least(8000,500*(2^least(poll_count,4)))::integer*interval '1 millisecond' WHERE id=a.id;
    RETURN jsonb_build_object('attempt_id',a.id,'job_id',a.job_id,'fresh',false);
  END IF;
  IF c.active_validation_id IS NOT NULL OR NOT EXISTS(SELECT 1 FROM public.execution_capacity_slots WHERE authoring_attempt_id IS NULL AND participant_attempt_id IS NULL)
    OR NOT EXISTS(SELECT 1 FROM public.judge_host_epochs WHERE id=c.host_epoch_id AND state='ACTIVE') THEN RETURN NULL; END IF;
  PERFORM id FROM public.participant_scheduler WHERE id=1 FOR UPDATE;
  chosen=public.participant_candidate(n,c.host_epoch_id);
  IF chosen IS NULL THEN RETURN NULL; END IF;
  -- The same locked transaction must prepare this choice; a worker cannot choose a friendlier queue position.
  RETURN jsonb_build_object('job_id',chosen,'fresh',true);
END $$;
CREATE FUNCTION participant_prepare(worker uuid,generation bigint,job uuid,attempt uuid,payload bytea) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE c public.judge_control%ROWTYPE; p public.participant_judging%ROWTYPE; n timestamptz; slot integer; ordinal integer;
BEGIN
  SELECT * INTO c FROM public.lock_validation_judge();
  n=public.require_validation_worker(worker,generation);
  IF public.participant_candidate(n,c.host_epoch_id) IS DISTINCT FROM job OR octet_length(payload)<>32 THEN RAISE EXCEPTION 'Stale participant dispatch choice'; END IF;
  SELECT p0.* INTO p FROM public.participant_judging p0 JOIN public.participant_jobs j ON j.parent_id=p0.id WHERE j.id=job;
  SELECT count(*)+1 INTO ordinal FROM public.participant_attempts WHERE job_id=job;
  IF ordinal>(CASE WHEN p.lane='SAMPLE' THEN 2 WHEN EXISTS(SELECT 1 FROM public.participant_retry_permissions WHERE job_id=job) THEN 4 ELSE 3 END)
    OR EXISTS(SELECT 1 FROM public.participant_attempts WHERE job_id=job AND (result IS DISTINCT FROM 'INFRA_ERROR' OR released_at IS NULL)) THEN RAISE EXCEPTION 'No safe participant retry'; END IF;
  SELECT id INTO slot FROM public.execution_capacity_slots WHERE authoring_attempt_id IS NULL AND participant_attempt_id IS NULL ORDER BY id LIMIT 1;
  INSERT INTO public.participant_attempts(id,job_id,number,host_epoch_id,payload_digest,worker_id,generation,send_state,prepared_at,send_started_at,next_poll_at)
    VALUES(attempt,job,ordinal,p.host_epoch_id,payload,worker,generation,'SEND_STARTED',n,n,n+interval '500 milliseconds');
  UPDATE public.execution_capacity_slots SET participant_attempt_id=attempt,revision=revision+1 WHERE id=slot;
  UPDATE public.participant_jobs SET status='PROCESSING' WHERE id=job;
  UPDATE public.participant_judging SET status=CASE WHEN lane='OFFICIAL' THEN 'JUDGING' ELSE 'PROCESSING' END,started_at=COALESCE(started_at,n) WHERE id=p.id;
  UPDATE public.participant_scheduler SET turn=(turn+1)%4,
    last_official_team=CASE WHEN p.lane='OFFICIAL' THEN p.team_round_id ELSE last_official_team END,
    last_sample_team=CASE WHEN p.lane='SAMPLE' THEN p.team_round_id ELSE last_sample_team END WHERE id=1;
END $$;
--> statement-breakpoint
CREATE FUNCTION participant_record(worker uuid,generation bigint,attempt uuid,answer text,metadata jsonb,stdout bytea,stderr_bytes bytea,compiler_bytes bytea,release_proof bytea)
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
      UPDATE public.participant_jobs SET status='COMPLETED',result=answer,completed_at=n,settling_attempt_id=a.id WHERE id=a.job_id AND result IS NULL;
    END IF;
  END IF;
  IF release_proof IS NOT NULL THEN
    IF octet_length(release_proof)<>32 OR (a.release_digest IS NOT NULL AND a.release_digest<>release_proof) THEN RAISE EXCEPTION 'Conflicting physical drain'; END IF;
    UPDATE public.participant_attempts SET released_at=COALESCE(released_at,n),release_digest=release_proof WHERE id=a.id;
    UPDATE public.execution_capacity_slots SET participant_attempt_id=NULL,revision=revision+1 WHERE participant_attempt_id=a.id;
  END IF;
  IF answer='INFRA_ERROR' THEN
    UPDATE public.participant_jobs SET status=CASE WHEN release_proof IS NOT NULL AND a.number<CASE WHEN p.lane='SAMPLE' THEN 2 ELSE 3 END THEN 'RECOVERING' ELSE 'NEEDS_ATTENTION' END,
      available_at=COALESCE(a.resolved_at,n)+CASE WHEN a.number=1 THEN interval '2 seconds' ELSE interval '5 seconds' END WHERE id=a.job_id AND result IS NULL;
  END IF;
  PERFORM public.participant_refresh(n);
  PERFORM public.participant_rebudget(p.id);
END $$;
--> statement-breakpoint
CREATE FUNCTION guard_participant_judging() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Participant judging history is retained'; END IF;
  IF TG_TABLE_NAME='participant_judging' THEN
    IF (to_jsonb(NEW)-ARRAY['status','result','started_at','completed_at','reserved_bytes']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','result','started_at','completed_at','reserved_bytes'])
      OR (OLD.started_at IS NOT NULL AND NEW.started_at IS DISTINCT FROM OLD.started_at)
      OR (OLD.completed_at IS NOT NULL AND (to_jsonb(NEW)-'reserved_bytes') IS DISTINCT FROM (to_jsonb(OLD)-'reserved_bytes'))
      OR NEW.reserved_bytes>OLD.reserved_bytes OR (NEW.reserved_bytes<>OLD.reserved_bytes AND NEW.reserved_bytes<>public.participant_accounted(OLD.id)) THEN RAISE EXCEPTION 'Participant plan or terminal result is immutable'; END IF;
  ELSIF TG_TABLE_NAME='participant_jobs' THEN
    IF ROW(NEW.id,NEW.parent_id,NEW.case_id,NEW.position) IS DISTINCT FROM ROW(OLD.id,OLD.parent_id,OLD.case_id,OLD.position)
      OR (OLD.result IS NOT NULL AND NEW IS DISTINCT FROM OLD) THEN RAISE EXCEPTION 'Frozen participant job is immutable'; END IF;
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
CREATE TRIGGER participant_parent_guard BEFORE UPDATE OR DELETE ON participant_judging FOR EACH ROW EXECUTE FUNCTION guard_participant_judging();
CREATE TRIGGER participant_job_guard BEFORE UPDATE OR DELETE ON participant_jobs FOR EACH ROW EXECUTE FUNCTION guard_participant_judging();
CREATE TRIGGER participant_attempt_guard BEFORE UPDATE OR DELETE ON participant_attempts FOR EACH ROW EXECUTE FUNCTION guard_participant_judging();
CREATE FUNCTION participant_integrity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  IF EXISTS(SELECT 1 FROM public.participant_attempts a WHERE (a.released_at IS NULL) IS DISTINCT FROM EXISTS(SELECT 1 FROM public.execution_capacity_slots WHERE participant_attempt_id=a.id))
    OR EXISTS(SELECT 1 FROM public.participant_attempts a JOIN public.participant_jobs j ON j.id=a.job_id JOIN public.participant_judging p ON p.id=j.parent_id
      WHERE a.released_at IS NULL AND a.host_epoch_id IS DISTINCT FROM (SELECT host_epoch_id FROM public.judge_control WHERE id=1)) THEN RAISE EXCEPTION 'Participant physical accounting mismatch'; END IF;
  IF EXISTS(SELECT 1 FROM public.execution_capacity_slots WHERE participant_attempt_id IS NOT NULL) AND
    (EXISTS(SELECT 1 FROM public.execution_capacity_slots WHERE authoring_attempt_id IS NOT NULL) OR EXISTS(SELECT 1 FROM public.judge_control WHERE active_validation_id IS NOT NULL)) THEN RAISE EXCEPTION 'Authoring and participant execution cannot overlap'; END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER participant_capacity_integrity AFTER INSERT OR UPDATE ON participant_attempts DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION participant_integrity();
CREATE CONSTRAINT TRIGGER participant_slot_integrity AFTER UPDATE OR DELETE ON execution_capacity_slots DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION participant_integrity();
CREATE CONSTRAINT TRIGGER participant_host_integrity AFTER UPDATE ON judge_control DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION participant_integrity();
--> statement-breakpoint
REVOKE ALL ON FUNCTION competition_original_participant_command(uuid,uuid,uuid,text,jsonb),participant_plan(uuid,uuid,uuid,text,uuid,uuid,uuid,uuid,bytea,text,timestamptz),participant_official_plan(),participant_refresh(timestamptz),participant_candidate(timestamptz,uuid),guard_participant_judging(),participant_integrity() FROM PUBLIC;
REVOKE ALL ON FUNCTION competition_original_participant_command(uuid,uuid,uuid,text,jsonb) FROM ingenium_api;
REVOKE ALL ON FUNCTION competition_participant_command(uuid,uuid,uuid,text,jsonb),participant_next(uuid,bigint),participant_prepare(uuid,bigint,uuid,uuid,bytea),participant_record(uuid,bigint,uuid,text,jsonb,bytea,bytea,bytea,bytea) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION competition_participant_command(uuid,uuid,uuid,text,jsonb) TO ingenium_api;
GRANT SELECT ON participant_judging,participant_jobs,participant_attempts TO ingenium_api,ingenium_competition_worker;
GRANT SELECT ON judge_control,judge_host_epochs,judge_host_runtimes,runtime_manifests,validation_snapshot_variants,validation_snapshot_cases TO ingenium_competition_worker;
GRANT UPDATE(id) ON security_control TO ingenium_competition_worker;
GRANT SELECT ON clock_health TO ingenium_competition_worker;
GRANT UPDATE(id) ON clock_health TO ingenium_competition_worker;
GRANT EXECUTE ON FUNCTION lock_validation_judge(),claim_validation_worker(uuid,uuid),participant_next(uuid,bigint),participant_prepare(uuid,bigint,uuid,uuid,bytea),participant_record(uuid,bigint,uuid,text,jsonb,bytea,bytea,bytea,bytea) TO ingenium_competition_worker;
