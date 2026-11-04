CREATE TABLE public.participant_batch_control(id integer PRIMARY KEY CHECK(id=1),enabled boolean NOT NULL DEFAULT false);
INSERT INTO public.participant_batch_control(id) VALUES(1);
CREATE TABLE public.participant_batches(
 id uuid PRIMARY KEY,parent_id uuid NOT NULL UNIQUE REFERENCES public.participant_judging(id),
 carrier_attempt_id uuid NOT NULL UNIQUE REFERENCES public.participant_attempts(id),
 raw bytea CHECK(octet_length(raw) BETWEEN 1 AND 16384),digest bytea NOT NULL CHECK(octet_length(digest)=32 AND digest=sha256(raw)),
 created_at timestamptz NOT NULL
);
CREATE TABLE public.participant_batch_members(
 batch_id uuid NOT NULL REFERENCES public.participant_batches(id),attempt_id uuid PRIMARY KEY REFERENCES public.participant_attempts(id),
 ordinal integer NOT NULL CHECK(ordinal BETWEEN 0 AND 7),UNIQUE(batch_id,ordinal)
);
CREATE TRIGGER participant_batches_immutable BEFORE UPDATE OR DELETE ON public.participant_batches FOR EACH ROW EXECUTE FUNCTION public.immutable_access_history();
CREATE TRIGGER participant_batch_members_immutable BEFORE UPDATE OR DELETE ON public.participant_batch_members FOR EACH ROW EXECUTE FUNCTION public.immutable_access_history();
REVOKE ALL ON public.participant_batch_control,public.participant_batches,public.participant_batch_members FROM PUBLIC,ingenium_api,ingenium_competition_worker;
GRANT SELECT ON public.participant_batch_control,public.participant_batches,public.participant_batch_members TO ingenium_app_worker;
GRANT SELECT ON public.participant_batch_control TO ingenium_competition_worker;
--> statement-breakpoint
CREATE FUNCTION public.participant_batch_policy_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF TG_OP='DELETE' OR NEW.id<>OLD.id OR NEW.enabled IS DISTINCT FROM OLD.enabled AND(
  EXISTS(SELECT 1 FROM public.rounds WHERE state IN('RUNNING','PAUSED','CLOSING','CANCELLING'))
  OR EXISTS(SELECT 1 FROM public.participant_judging WHERE completed_at IS NULL AND status<>'CANCELLED')
  OR EXISTS(SELECT 1 FROM public.participant_attempts WHERE released_at IS NULL))
 THEN RAISE EXCEPTION 'Batch policy changes require no active round or unresolved participant work';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER participant_batch_policy_guard BEFORE UPDATE OR DELETE ON public.participant_batch_control FOR EACH ROW EXECUTE FUNCTION public.participant_batch_policy_guard();
CREATE FUNCTION public.participant_batchable(subject uuid) RETURNS boolean LANGUAGE sql STABLE SET search_path=pg_catalog,public AS $$
 SELECT p.language IN('c','cpp','java','python') AND octet_length(p.source)<=4096
  AND (SELECT count(*) FROM public.participant_jobs WHERE parent_id=p.id) BETWEEN 1 AND(CASE WHEN p.lane='SAMPLE' THEN 3 ELSE 8 END)
  AND (SELECT sum(octet_length(c.input_data)+octet_length(c.expected_output)) FROM public.participant_jobs j JOIN public.validation_snapshot_cases c
   ON c.snapshot_id=p.snapshot_id AND c.case_id=j.case_id WHERE j.parent_id=p.id)<=1024
 FROM public.participant_judging p WHERE p.id=subject;
$$;
CREATE FUNCTION public.participant_batch_candidate(n timestamptz,epoch uuid) RETURNS uuid
LANGUAGE plpgsql STABLE SET search_path=pg_catalog,public AS $$
BEGIN
 IF NOT(SELECT enabled FROM public.participant_batch_control WHERE id=1)THEN RETURN NULL;END IF;
 RETURN(SELECT p.id FROM public.participant_judging p CROSS JOIN public.participant_scheduler s CROSS JOIN public.judge_control c
  WHERE s.id=1 AND c.id=1 AND c.host_epoch_id=epoch AND c.active_validation_id IS NULL AND p.host_epoch_id=epoch AND p.completed_at IS NULL
   AND EXISTS(SELECT 1 FROM public.execution_capacity_slots WHERE authoring_attempt_id IS NULL AND participant_attempt_id IS NULL)
   AND EXISTS(SELECT 1 FROM public.judge_host_epochs WHERE id=epoch AND state='ACTIVE')
   AND EXISTS(SELECT 1 FROM public.rounds WHERE id=p.round_id AND state IN('RUNNING','PAUSED','CLOSING'))
   AND(p.lane='OFFICIAL' OR NOT public.sample_run_expired(p,n))
   AND public.participant_batchable(p.id)
   AND NOT EXISTS(SELECT 1 FROM public.participant_jobs WHERE parent_id=p.id AND(result IS NOT NULL OR status NOT IN('QUEUED','RECOVERING') OR available_at>n))
   AND NOT EXISTS(SELECT 1 FROM public.participant_attempts a JOIN public.participant_jobs j ON j.id=a.job_id WHERE j.parent_id=p.id)
   AND(SELECT count(*) FROM public.execution_capacity_slots z JOIN public.participant_attempts a ON a.id=z.participant_attempt_id
     JOIN public.participant_jobs j ON j.id=a.job_id JOIN public.participant_judging busy ON busy.id=j.parent_id
     JOIN public.team_rounds bt ON bt.id=busy.team_round_id JOIN public.team_rounds pt ON pt.id=p.team_round_id WHERE bt.team_id=pt.team_id)<2
  ORDER BY(p.lane=CASE WHEN s.turn=3 THEN 'SAMPLE' ELSE 'OFFICIAL' END)DESC,
   (p.team_round_id>CASE WHEN p.lane='OFFICIAL' THEN s.last_official_team ELSE s.last_sample_team END)DESC NULLS LAST,
   p.team_round_id,p.queue_order LIMIT 1);
END $$;
CREATE FUNCTION public.participant_batch_next(worker uuid,generation bigint) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE c public.judge_control%ROWTYPE;n timestamptz;a public.participant_attempts%ROWTYPE;batch uuid;chosen uuid;
BEGIN
 SELECT * INTO c FROM public.lock_validation_judge();n=public.require_validation_worker(worker,generation);PERFORM public.participant_refresh(n);
 -- Fill available physical slots before polling; otherwise two worker lanes cap the whole eight-slot judge at two batches.
 PERFORM id FROM public.participant_scheduler WHERE id=1 FOR UPDATE;chosen=public.participant_batch_candidate(n,c.host_epoch_id);
 IF chosen IS NOT NULL THEN RETURN jsonb_build_object('parent_id',chosen,'fresh',true);END IF;
 SELECT a0.* INTO a FROM public.participant_batches b JOIN public.participant_attempts a0 ON a0.id=b.carrier_attempt_id
  WHERE a0.released_at IS NULL AND a0.host_epoch_id=c.host_epoch_id AND a0.next_poll_at<=n AND a0.poll_count<10000 ORDER BY a0.next_poll_at,a0.id LIMIT 1 FOR UPDATE OF a0;
 IF a.id IS NOT NULL THEN
  SELECT id INTO batch FROM public.participant_batches WHERE carrier_attempt_id=a.id;
  UPDATE public.participant_attempts SET poll_count=poll_count+1,next_poll_at=n+interval '250 milliseconds' WHERE id=a.id;
  RETURN jsonb_build_object('batch_id',batch,'fresh',false);
 END IF;
 RETURN NULL;
END $$;
--> statement-breakpoint
CREATE FUNCTION public.participant_batch_payload_digest(spec jsonb,item jsonb) RETURNS bytea
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
DECLARE result bytea=convert_to('ingenium-command-v1','UTF8');v text;bytes bytea;source bytea=decode(spec->>'source_b64','base64');input bytea=decode(item->>'stdin_b64','base64');
BEGIN
 FOREACH v IN ARRAY ARRAY['AUTHORING_EXECUTION_V1',item->>'attempt_id',spec->>'host_epoch_id',spec->>'run_id',item->>'check_id',spec->>'runtime_key',spec->>'runtime_digest',spec->>'language',
 spec->>'source_role','TEST_CASE',encode(sha256(source),'hex'),octet_length(source)::text,encode(sha256(input),'hex'),octet_length(input)::text,item->>'cpu_ms',item->>'wall_ms',item->>'memory_kb'] LOOP
  IF v IS NULL THEN RAISE EXCEPTION 'Incomplete batch case digest';END IF;bytes=convert_to(v,'UTF8');result=result||decode('02','hex')||int4send(octet_length(bytes))||bytes;
 END LOOP;RETURN sha256(result);
END $$;
CREATE FUNCTION public.participant_batch_prepare(worker uuid,generation bigint,parent uuid,subject uuid,bytes bytea) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE c public.judge_control%ROWTYPE;p public.participant_judging%ROWTYPE;n timestamptz;spec jsonb;item record;v record;slot integer;first_attempt uuid;count_cases integer=0;seen uuid[]='{}';
BEGIN
 SELECT * INTO c FROM public.lock_validation_judge();n=public.require_validation_worker(worker,generation);
 IF public.participant_batch_candidate(n,c.host_epoch_id) IS DISTINCT FROM parent OR subject IS NULL OR bytes IS NULL OR octet_length(bytes) NOT BETWEEN 1 AND 16384 THEN RAISE EXCEPTION 'Stale batch choice';END IF;
 SELECT * INTO p FROM public.participant_judging WHERE id=parent;
 spec=convert_from(bytes,'UTF8')::jsonb;
 IF spec->>'protocol' IS DISTINCT FROM 'ingenium-participant-batch-v1' OR spec->>'batch_id' IS DISTINCT FROM subject::text
  OR spec->>'host_epoch_id' IS DISTINCT FROM p.host_epoch_id::text OR spec->>'run_id' IS DISTINCT FROM p.id::text OR spec->>'language' IS DISTINCT FROM p.language
  OR spec->>'source_role' IS DISTINCT FROM p.lane OR spec->>'runtime_key' IS DISTINCT FROM p.runtime_key OR spec->>'runtime_digest' IS DISTINCT FROM encode(p.runtime_digest,'hex')
  OR decode(spec->>'source_b64','base64') IS DISTINCT FROM p.source OR jsonb_typeof(spec->'cases') IS DISTINCT FROM 'object'
 THEN RAISE EXCEPTION 'Batch differs from immutable participant source and runtime';END IF;
 FOR item IN SELECT key,value,row_number()OVER(ORDER BY key)-1 ordinal FROM jsonb_each(spec->'cases') ORDER BY key LOOP
  SELECT j.id,j.case_id,j.position,t.input_data,t.expected_output,s.checker_mode,q.cpu_ms,q.wall_ms,q.memory_kb INTO v FROM public.participant_jobs j
   JOIN public.validation_snapshot_cases t ON t.snapshot_id=p.snapshot_id AND t.case_id=j.case_id JOIN public.validation_snapshots s ON s.id=p.snapshot_id
   JOIN public.validation_snapshot_variants q ON q.snapshot_id=p.snapshot_id AND q.language=p.language
   WHERE j.parent_id=parent AND j.id=(item.value->>'check_id')::uuid AND j.position=(item.value->>'position')::integer;
  IF NOT FOUND OR item.key<>'c'||lpad(item.ordinal::text,2,'0') OR item.value->>'case_id' IS DISTINCT FROM v.case_id::text
   OR item.value->>'checker_mode' IS DISTINCT FROM v.checker_mode OR decode(item.value->>'stdin_b64','base64') IS DISTINCT FROM v.input_data
   OR decode(item.value->>'expected_b64','base64') IS DISTINCT FROM v.expected_output OR(item.value->>'cpu_ms')::integer IS DISTINCT FROM v.cpu_ms
   OR(item.value->>'wall_ms')::integer IS DISTINCT FROM v.wall_ms OR(item.value->>'memory_kb')::integer IS DISTINCT FROM v.memory_kb
   OR item.value->>'attempt_id' IS NULL OR(item.value->>'attempt_id')::uuid=ANY(seen) OR(item.value->>'attempt_id')::uuid=subject
  THEN RAISE EXCEPTION 'Batch case differs from its frozen original';END IF;
  seen=array_append(seen,(item.value->>'attempt_id')::uuid);count_cases=count_cases+1;
  IF item.ordinal=0 THEN first_attempt=(item.value->>'attempt_id')::uuid;END IF;
 END LOOP;
 IF count_cases<>(SELECT count(*) FROM public.participant_jobs WHERE parent_id=parent)THEN RAISE EXCEPTION 'Batch must contain every original test';END IF;
 SELECT id INTO slot FROM public.execution_capacity_slots WHERE authoring_attempt_id IS NULL AND participant_attempt_id IS NULL ORDER BY id LIMIT 1;
 FOR item IN SELECT key,value FROM jsonb_each(spec->'cases') ORDER BY key LOOP
  INSERT INTO public.participant_attempts(id,job_id,number,host_epoch_id,payload_digest,worker_id,generation,send_state,prepared_at,send_started_at,next_poll_at)
   VALUES((item.value->>'attempt_id')::uuid,(item.value->>'check_id')::uuid,1,p.host_epoch_id,public.participant_batch_payload_digest(spec,item.value),worker,generation,'SEND_STARTED',n,n,n+interval '250 milliseconds');
 END LOOP;
 INSERT INTO public.participant_batches VALUES(subject,parent,first_attempt,bytes,sha256(bytes),n);
 FOR item IN SELECT key,value,row_number()OVER(ORDER BY key)-1 ordinal FROM jsonb_each(spec->'cases') ORDER BY key LOOP
  INSERT INTO public.participant_batch_members VALUES(subject,(item.value->>'attempt_id')::uuid,item.ordinal);
 END LOOP;
 UPDATE public.execution_capacity_slots SET participant_attempt_id=first_attempt,revision=revision+1 WHERE id=slot;
 UPDATE public.participant_jobs SET status='PROCESSING' WHERE parent_id=parent;
 UPDATE public.participant_judging SET status=CASE WHEN lane='OFFICIAL' THEN 'JUDGING' ELSE 'PROCESSING' END,started_at=COALESCE(started_at,n) WHERE id=parent;
 UPDATE public.participant_scheduler SET turn=(turn+1)%4,last_official_team=CASE WHEN p.lane='OFFICIAL' THEN p.team_round_id ELSE last_official_team END,
  last_sample_team=CASE WHEN p.lane='SAMPLE' THEN p.team_round_id ELSE last_sample_team END WHERE id=1;
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.participant_integrity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.participant_attempts a WHERE(a.released_at IS NULL)IS DISTINCT FROM(
  EXISTS(SELECT 1 FROM public.execution_capacity_slots WHERE participant_attempt_id=a.id)
  OR EXISTS(SELECT 1 FROM public.participant_batch_members m JOIN public.participant_batches b ON b.id=m.batch_id
    JOIN public.execution_capacity_slots s ON s.participant_attempt_id=b.carrier_attempt_id WHERE m.attempt_id=a.id)))
  OR EXISTS(SELECT 1 FROM public.participant_attempts a WHERE a.released_at IS NULL AND a.host_epoch_id IS DISTINCT FROM(SELECT host_epoch_id FROM public.judge_control WHERE id=1))
 THEN RAISE EXCEPTION 'Participant batch physical accounting mismatch';END IF;
 IF EXISTS(SELECT 1 FROM public.execution_capacity_slots WHERE participant_attempt_id IS NOT NULL)AND(
  EXISTS(SELECT 1 FROM public.execution_capacity_slots WHERE authoring_attempt_id IS NOT NULL)OR EXISTS(SELECT 1 FROM public.judge_control WHERE active_validation_id IS NOT NULL))
 THEN RAISE EXCEPTION 'Authoring and participant execution cannot overlap';END IF;
 IF EXISTS(SELECT 1 FROM public.participant_batches b WHERE NOT EXISTS(SELECT 1 FROM public.participant_batch_members WHERE batch_id=b.id AND attempt_id=b.carrier_attempt_id AND ordinal=0)
  OR(SELECT count(*) FROM public.participant_batch_members WHERE batch_id=b.id)<>(SELECT count(*) FROM public.participant_jobs WHERE parent_id=b.parent_id)
  OR EXISTS(SELECT 1 FROM public.participant_batch_members m JOIN public.participant_attempts a ON a.id=m.attempt_id JOIN public.participant_jobs j ON j.id=a.job_id
    JOIN public.participant_attempts carrier ON carrier.id=b.carrier_attempt_id WHERE m.batch_id=b.id AND(j.parent_id<>b.parent_id OR a.host_epoch_id<>carrier.host_epoch_id OR(a.released_at IS NULL)IS DISTINCT FROM(carrier.released_at IS NULL))))
 THEN RAISE EXCEPTION 'Batch member association or shared drain mismatch';END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER participant_batch_integrity AFTER INSERT ON public.participant_batches DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.participant_integrity();
CREATE CONSTRAINT TRIGGER participant_batch_member_integrity AFTER INSERT ON public.participant_batch_members DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.participant_integrity();
--> statement-breakpoint
DO $$
DECLARE definition text;marker text;
BEGIN
 definition=pg_get_functiondef('public.participant_next(uuid,bigint)'::regprocedure);
 marker='FROM public.participant_attempts WHERE released_at IS NULL';
 IF strpos(definition,marker)=0 THEN RAISE EXCEPTION 'Reviewed individual poll selection missing';END IF;
 EXECUTE replace(definition,marker,'FROM public.participant_attempts WHERE NOT EXISTS(SELECT 1 FROM public.participant_batch_members m WHERE m.attempt_id=participant_attempts.id) AND released_at IS NULL');
 definition=pg_get_functiondef('public.participant_candidate(timestamp with time zone,uuid)'::regprocedure);
 marker='AND j.result IS NULL';
 IF strpos(definition,marker)=0 THEN RAISE EXCEPTION 'Reviewed individual job selection missing';END IF;
 EXECUTE replace(definition,marker,'AND NOT((SELECT enabled FROM public.participant_batch_control WHERE id=1) AND public.participant_batchable(p.id)
  AND NOT EXISTS(SELECT 1 FROM public.participant_attempts a JOIN public.participant_jobs j0 ON j0.id=a.job_id WHERE j0.parent_id=p.id)) AND j.result IS NULL');
END $$;
REVOKE ALL ON FUNCTION public.participant_batch_policy_guard(),public.participant_batch_candidate(timestamptz,uuid),public.participant_batch_payload_digest(jsonb,jsonb),
 public.participant_batch_next(uuid,bigint),public.participant_batch_prepare(uuid,bigint,uuid,uuid,bytea) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.participant_batch_next(uuid,bigint),public.participant_batch_prepare(uuid,bigint,uuid,uuid,bytea) TO ingenium_app_worker;
REVOKE ALL ON FUNCTION public.participant_batchable(uuid) FROM PUBLIC;
--> statement-breakpoint
-- Only the all-case transaction may record or release a member of a shared physical capsule.
ALTER FUNCTION public.participant_record(uuid,bigint,uuid,text,jsonb,bytea,bytea,bytea,bytea) RENAME TO participant_original_record;
REVOKE ALL ON FUNCTION public.participant_original_record(uuid,bigint,uuid,text,jsonb,bytea,bytea,bytea,bytea) FROM PUBLIC,ingenium_api,ingenium_app_worker,ingenium_competition_worker;
CREATE FUNCTION public.participant_record(worker uuid,generation bigint,attempt uuid,answer text,metadata jsonb,stdout bytea,stderr_bytes bytea,compiler_bytes bytea,release_proof bytea)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.participant_batch_members WHERE attempt_id=attempt)THEN RAISE EXCEPTION 'Batch members require the whole original batch';END IF;
 PERFORM public.participant_original_record(worker,generation,attempt,answer,metadata,stdout,stderr_bytes,compiler_bytes,release_proof);
END $$;
CREATE FUNCTION public.participant_batch_record(worker uuid,generation bigint,subject uuid,results jsonb,release_proof bytea)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE b public.participant_batches%ROWTYPE;item record;bound record;seen uuid[]='{}';
BEGIN
 PERFORM * FROM public.lock_validation_judge();PERFORM public.require_validation_worker(worker,generation);
 SELECT * INTO b FROM public.participant_batches WHERE id=subject;
 IF b.id IS NULL OR jsonb_typeof(results) IS DISTINCT FROM 'array' OR octet_length(results::text)>2097152
  OR jsonb_array_length(results)<>(SELECT count(*) FROM public.participant_batch_members WHERE batch_id=subject)
  OR release_proof IS NOT NULL AND octet_length(release_proof)<>32 THEN RAISE EXCEPTION 'Incomplete original batch result or physical drain';END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(results) LOOP
  SELECT a.id,j.id job_id,j.case_id,j.position INTO bound FROM public.participant_batch_members m JOIN public.participant_attempts a ON a.id=m.attempt_id
   JOIN public.participant_jobs j ON j.id=a.job_id WHERE m.batch_id=subject AND a.id=(item.value->>'attemptId')::uuid;
  IF NOT FOUND OR bound.id=ANY(seen) OR item.value->>'checkId' IS DISTINCT FROM bound.job_id::text OR item.value->>'caseId' IS DISTINCT FROM bound.case_id::text
   OR item.value->'metadata'->>'batch_id' IS DISTINCT FROM b.id::text OR item.value->'metadata'->>'batch_digest' IS DISTINCT FROM encode(b.digest,'hex')
   OR item.value->'metadata'->>'result' IS DISTINCT FROM item.value->>'result'
   OR item.value->'metadata'->'evidence'->>'position' IS DISTINCT FROM bound.position::text
   OR item.value->>'result' NOT IN('PASSED','WRONG_ANSWER','COMPILATION_ERROR','RUNTIME_ERROR','TIME_LIMIT_EXCEEDED','MEMORY_LIMIT_EXCEEDED','OUTPUT_LIMIT_EXCEEDED')
   THEN RAISE EXCEPTION 'Unbound or repeated batch member evidence';END IF;
  seen=array_append(seen,bound.id);
  PERFORM public.participant_original_record(worker,generation,bound.id,item.value->>'result',item.value->'metadata',decode(item.value->>'stdout_b64','base64'),
    decode(item.value->>'stderr_b64','base64'),decode(item.value->>'compiler_b64','base64'),release_proof);
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.participant_record(uuid,bigint,uuid,text,jsonb,bytea,bytea,bytea,bytea),public.participant_batch_record(uuid,bigint,uuid,jsonb,bytea) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.participant_record(uuid,bigint,uuid,text,jsonb,bytea,bytea,bytea,bytea) TO ingenium_app_worker,ingenium_competition_worker;
GRANT EXECUTE ON FUNCTION public.participant_batch_record(uuid,bigint,uuid,jsonb,bytea) TO ingenium_app_worker;
--> statement-breakpoint
-- Retain immutable identities/digests; purge the extra source/input copy through the existing audited policy.
ALTER TABLE public.payload_purges DROP CONSTRAINT payload_purge_shape;
ALTER TABLE public.payload_purges ADD CONSTRAINT payload_purge_shape CHECK(kind IN('entry_flows','staff_entry_flows','participant_sessions','staff_sessions','code_drafts','participant_judging','competition_submissions','participant_attempts','authoring_attempts','participant_batches') AND jsonb_typeof(manifest)='object' AND octet_length(manifest::text) BETWEEN 1 AND 2048);
DO $$ DECLARE definition text;marker text;BEGIN
 definition=pg_get_functiondef('public.retention_fields(text)'::regprocedure);marker='CASE kind';
 IF strpos(definition,marker)=0 THEN RAISE EXCEPTION 'Reviewed retention fields missing';END IF;
 EXECUTE replace(definition,marker,'CASE kind WHEN ''participant_batches'' THEN ARRAY[''raw'']');
 definition=pg_get_functiondef('public.retention_eligible(text,uuid,timestamptz)'::regprocedure);marker='  IF public.retention_fields(kind) IS NULL THEN RETURN false; END IF;';
 IF strpos(definition,marker)=0 THEN RAISE EXCEPTION 'Reviewed eligibility guard missing';END IF;
 EXECUTE replace(definition,marker,marker||E'\n  IF kind=''participant_batches'' THEN RETURN EXISTS(SELECT 1 FROM public.participant_batches b JOIN public.participant_judging pj ON pj.id=b.parent_id WHERE b.id=target AND b.raw IS NOT NULL AND public.retention_arena_safe(pj.round_id,CASE WHEN pj.lane=''OFFICIAL'' THEN 30 ELSE 7 END,n) AND NOT EXISTS(SELECT 1 FROM public.question_reports q WHERE q.parent_id=pj.id AND NOT EXISTS(SELECT 1 FROM public.report_decisions d WHERE d.report_id=q.id))); END IF;');
 definition=pg_get_functiondef('public.maintain_retention_batch(text)'::regprocedure);marker='UNION ALL SELECT ''participant_judging'',id';
 IF strpos(definition,marker)=0 THEN RAISE EXCEPTION 'Reviewed retention candidate query missing';END IF;
 definition=replace(definition,marker,'UNION ALL SELECT ''participant_batches'',id FROM public.participant_batches WHERE family=''PAYLOADS'' AND raw IS NOT NULL AND created_at<=statement_timestamp()-interval ''7 days'' '||marker);
 marker='  PERFORM id FROM public.rounds WHERE id=ANY(stages)';
 IF strpos(definition,marker)=0 THEN RAISE EXCEPTION 'Reviewed retention round locks missing';END IF;
 EXECUTE replace(definition,marker,'  stages=coalesce(stages,''{}'')||ARRAY(SELECT r.id FROM public.rounds r JOIN public.rounds target ON target.arena_instance_id=r.arena_instance_id JOIN public.participant_judging p ON p.round_id=target.id JOIN public.participant_batches b ON b.parent_id=p.id WHERE b.id IN(SELECT id FROM jsonb_to_recordset(candidates) c(kind text,id uuid) WHERE kind=''participant_batches''));'||E'\n'||marker);
 definition=pg_get_functiondef('public.retire_payload(text,uuid)'::regprocedure);marker='  count=1;';
 IF strpos(definition,marker)=0 THEN RAISE EXCEPTION 'Reviewed retention rebudget missing';END IF;
 EXECUTE replace(definition,marker,marker||E'\n  IF kind=''participant_batches'' THEN PERFORM public.participant_rebudget((payload->>''parent_id'')::uuid); END IF;');
END $$;
CREATE TRIGGER retained_payload_state BEFORE INSERT OR UPDATE ON public.participant_batches FOR EACH ROW EXECUTE FUNCTION public.guard_retained_payload();
CREATE OR REPLACE FUNCTION public.participant_accounted(subject uuid) RETURNS bigint LANGUAGE sql STABLE SET search_path=pg_catalog,public AS $$
 SELECT 524288+CASE WHEN p.completed_at IS NULL AND p.status<>'CANCELLED' THEN
  (SELECT count(*) FROM public.participant_jobs WHERE parent_id=p.id)*262144*CASE WHEN p.lane='OFFICIAL' THEN 4 ELSE 2 END
  ELSE coalesce((SELECT sum(CASE WHEN a.result IS NULL THEN 262144 ELSE 2048+octet_length(a.evidence::text)+coalesce(octet_length(a.stdout_prefix),0)+coalesce(octet_length(a.stderr),0)+coalesce(octet_length(a.compiler_output),0) END)
   FROM public.participant_attempts a JOIN public.participant_jobs j ON j.id=a.job_id WHERE j.parent_id=p.id),0)
   +coalesce((SELECT sum(coalesce(octet_length(raw),0)+256) FROM public.participant_batches WHERE parent_id=p.id),0) END
 FROM public.participant_judging p WHERE p.id=subject;
$$;
