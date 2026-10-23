CREATE TABLE "payload_purges" (
	"kind" text NOT NULL,
	"target_id" uuid NOT NULL,
	"manifest" jsonb NOT NULL,
	"recorded_at" timestamp (3) with time zone NOT NULL,
	CONSTRAINT "payload_purges_kind_target_id_pk" PRIMARY KEY("kind","target_id"),
	CONSTRAINT "payload_purge_shape" CHECK ("payload_purges"."kind" in ('entry_flows','staff_entry_flows','participant_sessions','staff_sessions','code_drafts','participant_judging','competition_submissions','participant_attempts','authoring_attempts')
    and jsonb_typeof("payload_purges"."manifest")='object' and octet_length("payload_purges"."manifest"::text) between 1 and 2048)
);
--> statement-breakpoint
ALTER TABLE "authoring_attempts" DROP CONSTRAINT "authoring_attempt_shape";--> statement-breakpoint
ALTER TABLE "participant_attempts" DROP CONSTRAINT "participant_attempt_shape";--> statement-breakpoint
ALTER TABLE "entry_flows" ALTER COLUMN "proof_verifier" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "participant_sessions" ALTER COLUMN "secret_verifier" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "staff_entry_flows" ALTER COLUMN "proof_verifier" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "staff_sessions" ALTER COLUMN "secret_verifier" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "competition_submissions" ALTER COLUMN "source" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "participant_judging" ALTER COLUMN "source" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "code_drafts" ALTER COLUMN "source_code" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "authoring_attempts" ADD CONSTRAINT "authoring_attempt_shape" CHECK ("authoring_attempts"."number" between 1 and 3 and "authoring_attempts"."lease_generation">0 and octet_length("authoring_attempts"."payload_digest")=32 and "authoring_attempts"."poll_count" between 0 and 10000 and "authoring_attempts"."next_poll_at">="authoring_attempts"."prepared_at"
    and (("authoring_attempts"."send_state"='PREPARED' and "authoring_attempts"."send_started_at" is null) or ("authoring_attempts"."send_state"='SEND_STARTED' and "authoring_attempts"."send_started_at" is not null and "authoring_attempts"."send_started_at">="authoring_attempts"."prepared_at"))
    and (("authoring_attempts"."result" is null and num_nonnulls("authoring_attempts"."result_digest","authoring_attempts"."resolved_at","authoring_attempts"."evidence","authoring_attempts"."stdout_prefix","authoring_attempts"."stderr","authoring_attempts"."compiler_output")=0)
      or ("authoring_attempts"."result" is not null and "authoring_attempts"."result" in ('PASSED','WRONG_ANSWER','COMPILATION_ERROR','RUNTIME_ERROR','TIME_LIMIT_EXCEEDED','MEMORY_LIMIT_EXCEEDED','OUTPUT_LIMIT_EXCEEDED','INFRA_ERROR')
        and num_nonnulls("authoring_attempts"."result_digest","authoring_attempts"."resolved_at","authoring_attempts"."evidence")=3 and num_nonnulls("authoring_attempts"."stdout_prefix","authoring_attempts"."stderr","authoring_attempts"."compiler_output") in (0,3) and octet_length("authoring_attempts"."result_digest")=32
        and jsonb_typeof("authoring_attempts"."evidence")='object' and octet_length("authoring_attempts"."evidence"::text)<=32768 and octet_length("authoring_attempts"."stdout_prefix")<=16384
        and octet_length("authoring_attempts"."stderr")<=65536 and octet_length("authoring_attempts"."compiler_output")<=65536 and "authoring_attempts"."resolved_at">="authoring_attempts"."send_started_at"))
    and (("authoring_attempts"."released_at" is null and "authoring_attempts"."release_digest" is null) or ("authoring_attempts"."released_at" is not null and octet_length("authoring_attempts"."release_digest")=32
      and "authoring_attempts"."release_digest" is not null and "authoring_attempts"."released_at">="authoring_attempts"."prepared_at")));--> statement-breakpoint
ALTER TABLE "participant_attempts" ADD CONSTRAINT "participant_attempt_shape" CHECK ("participant_attempts"."number" between 1 and 4 and "participant_attempts"."generation">0 and octet_length("participant_attempts"."payload_digest")=32 and "participant_attempts"."poll_count" between 0 and 10000
    and (("participant_attempts"."send_state"='PREPARED' and "participant_attempts"."send_started_at" is null) or ("participant_attempts"."send_state"='SEND_STARTED' and "participant_attempts"."send_started_at" is not null and "participant_attempts"."send_started_at">="participant_attempts"."prepared_at"))
    and (("participant_attempts"."result" is null and num_nonnulls("participant_attempts"."evidence","participant_attempts"."result_digest","participant_attempts"."stdout_prefix","participant_attempts"."stderr","participant_attempts"."compiler_output","participant_attempts"."resolved_at")=0)
      or ("participant_attempts"."result" in ('PASSED','WRONG_ANSWER','COMPILATION_ERROR','RUNTIME_ERROR','TIME_LIMIT_EXCEEDED','MEMORY_LIMIT_EXCEEDED','OUTPUT_LIMIT_EXCEEDED','INFRA_ERROR')
        and num_nonnulls("participant_attempts"."evidence","participant_attempts"."result_digest","participant_attempts"."resolved_at")=3
        and num_nonnulls("participant_attempts"."stdout_prefix","participant_attempts"."stderr","participant_attempts"."compiler_output") in (0,3)
        and octet_length("participant_attempts"."evidence"::text)<=65536 and octet_length("participant_attempts"."result_digest")=32 and octet_length("participant_attempts"."stdout_prefix")<=16384
        and octet_length("participant_attempts"."stderr")<=65536 and octet_length("participant_attempts"."compiler_output")<=65536 and "participant_attempts"."resolved_at">="participant_attempts"."send_started_at"))
    and (("participant_attempts"."released_at" is null and "participant_attempts"."release_digest" is null) or ("participant_attempts"."released_at" is not null and "participant_attempts"."released_at">="participant_attempts"."prepared_at" and octet_length("participant_attempts"."release_digest")=32 and "participant_attempts"."release_digest" is not null)));
--> statement-breakpoint
CREATE FUNCTION retention_fields(kind text) RETURNS text[] LANGUAGE sql IMMUTABLE SET search_path=pg_catalog,public AS $$
  SELECT CASE kind WHEN 'entry_flows' THEN ARRAY['proof_verifier'] WHEN 'staff_entry_flows' THEN ARRAY['proof_verifier']
    WHEN 'participant_sessions' THEN ARRAY['secret_verifier'] WHEN 'staff_sessions' THEN ARRAY['secret_verifier']
    WHEN 'code_drafts' THEN ARRAY['source_code'] WHEN 'participant_judging' THEN ARRAY['source'] WHEN 'competition_submissions' THEN ARRAY['source']
    WHEN 'participant_attempts' THEN ARRAY['stdout_prefix','stderr','compiler_output'] WHEN 'authoring_attempts' THEN ARRAY['stdout_prefix','stderr','compiler_output'] END;
$$;
CREATE FUNCTION retention_manifest(kind text,payload jsonb) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog,public AS $$
DECLARE field text; raw bytea; result jsonb='{}';
BEGIN
  FOREACH field IN ARRAY public.retention_fields(kind) LOOP
    raw=decode(substr(payload->>field,3),'hex');
    result=result||jsonb_build_object(field,jsonb_build_object('bytes',octet_length(raw))||
      CASE WHEN field IN ('secret_verifier','proof_verifier') THEN '{}'::jsonb ELSE jsonb_build_object('sha256',encode(sha256(raw),'hex')) END);
  END LOOP;
  RETURN result;
END $$;
CREATE FUNCTION payload_purge_transition(kind text,before_row jsonb,after_row jsonb) RETURNS boolean LANGUAGE sql STABLE SET search_path=pg_catalog,public AS $$
  SELECT public.retention_fields(kind) IS NOT NULL
    AND (before_row-public.retention_fields(kind))=(after_row-public.retention_fields(kind))
    AND NOT EXISTS(SELECT 1 FROM unnest(public.retention_fields(kind)) f WHERE after_row->f IS DISTINCT FROM 'null'::jsonb)
    AND EXISTS(SELECT 1 FROM public.payload_purges p WHERE p.kind=$1 AND p.target_id=(before_row->>'id')::uuid
      AND p.xmin::text::bigint=(pg_current_xact_id()::text::bigint & 4294967295) AND p.manifest=public.retention_manifest(kind,before_row));
$$;
CREATE FUNCTION retention_terminal_at(stage uuid) RETURNS timestamptz LANGUAGE sql STABLE SET search_path=pg_catalog,public AS $$
  SELECT max(o.recorded_at) FROM public.rounds target JOIN public.arena_instances a ON a.id=target.arena_instance_id
    JOIN public.rounds r ON r.arena_instance_id=a.id JOIN public.competition_outcomes o ON o.round_id=r.id
  WHERE target.id=stage AND o.result->>'status'='APPLIED'
    AND ((a.status='COMPLETED' AND r.kind=2 AND o.action='FINALISE') OR (a.status='DISCARDED' AND o.action IN ('DISCARD','FINISH_CANCEL')));
$$;
CREATE FUNCTION retention_arena_safe(stage uuid,days integer,n timestamptz) RETURNS boolean LANGUAGE sql STABLE SET search_path=pg_catalog,public AS $$
  SELECT public.retention_terminal_at(stage)<=n-make_interval(days=>days)
    AND NOT EXISTS(SELECT 1 FROM public.rounds r JOIN public.rounds target ON r.arena_instance_id=target.arena_instance_id
      WHERE target.id=stage AND (r.state IN ('RUNNING','PAUSED','CLOSING','CANCELLING')
        OR EXISTS(SELECT 1 FROM public.arena_control a WHERE a.current_instance_id=r.arena_instance_id)
        OR EXISTS(SELECT 1 FROM public.participant_judging p WHERE p.round_id=r.id AND
          (p.status NOT IN ('COMPLETED','CANCELLED') OR EXISTS(SELECT 1 FROM public.participant_jobs j JOIN public.participant_attempts a ON a.job_id=j.id
            WHERE j.parent_id=p.id AND (a.released_at IS NULL OR EXISTS(SELECT 1 FROM public.execution_capacity_slots s WHERE s.participant_attempt_id=a.id)))))));
$$;
CREATE FUNCTION retention_eligible(kind text,target uuid,n timestamptz) RETURNS boolean LANGUAGE plpgsql STABLE SET search_path=pg_catalog,public AS $$
DECLARE row_data jsonb; p public.participant_judging%ROWTYPE; run public.validation_runs%ROWTYPE; stage uuid;
BEGIN
  IF public.retention_fields(kind) IS NULL THEN RETURN false; END IF;
  EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE id=$1',kind) INTO row_data USING target;
  IF row_data IS NULL OR NOT EXISTS(SELECT 1 FROM unnest(public.retention_fields(kind)) f WHERE row_data->f<>'null'::jsonb) THEN RETURN false; END IF;
  IF kind IN ('entry_flows','staff_entry_flows') THEN RETURN (row_data->>'expires_at')::timestamptz<=n-interval '24 hours'; END IF;
  IF kind IN ('participant_sessions','staff_sessions') THEN
    RETURN least((row_data->>'absolute_expires_at')::timestamptz,(row_data->>'revoked_at')::timestamptz)<=n-interval '24 hours';
  END IF;
  IF kind='authoring_attempts' THEN
    SELECT r.* INTO run FROM public.validation_runs r JOIN public.authoring_checks c ON c.run_id=r.id WHERE c.id=(row_data->>'check_id')::uuid;
    RETURN run.status IN ('PASSED','FAILED','INFRA_ERROR') AND run.finished_at<=n-interval '7 days' AND row_data->>'result' IS NOT NULL
      AND NOT EXISTS(SELECT 1 FROM public.authoring_attempts a JOIN public.authoring_checks c ON c.id=a.check_id WHERE c.run_id=run.id AND
        (a.released_at IS NULL OR EXISTS(SELECT 1 FROM public.execution_capacity_slots s WHERE s.authoring_attempt_id=a.id)))
      AND NOT EXISTS(SELECT 1 FROM public.bounties b JOIN public.rounds r ON r.id=b.round_id JOIN public.arena_instances a ON a.id=r.arena_instance_id
        WHERE b.snapshot_id=run.snapshot_id AND a.status IN ('SETUP','IN_PROGRESS'));
  END IF;
  IF kind='participant_attempts' THEN
    SELECT parent.* INTO p FROM public.participant_judging parent JOIN public.participant_jobs j ON j.parent_id=parent.id WHERE j.id=(row_data->>'job_id')::uuid;
    RETURN row_data->>'result' IS NOT NULL AND public.retention_arena_safe(p.round_id,7,n);
  END IF;
  IF kind='participant_judging' THEN
    RETURN public.retention_arena_safe((row_data->>'round_id')::uuid,CASE WHEN row_data->>'lane'='OFFICIAL' THEN 30 ELSE 7 END,n);
  END IF;
  RETURN public.retention_arena_safe((row_data->>'round_id')::uuid,CASE WHEN kind='competition_submissions' THEN 30 ELSE 7 END,n);
END $$;
--> statement-breakpoint
CREATE FUNCTION guard_payload_purge() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE payload jsonb; field text;
BEGIN
  EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE id=$1',NEW.kind) INTO payload USING NEW.target_id;
  IF NEW.recorded_at IS DISTINCT FROM date_trunc('milliseconds',statement_timestamp()) OR
    NOT coalesce(public.retention_eligible(NEW.kind,NEW.target_id,NEW.recorded_at),false) OR NEW.manifest IS DISTINCT FROM public.retention_manifest(NEW.kind,payload) THEN
    RAISE EXCEPTION 'An eligible original payload is required'; END IF;
  IF (SELECT count(*) FROM public.payload_purges)>=8000000 THEN RAISE EXCEPTION 'Payload tombstone capacity' USING ERRCODE='54000'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER payload_purge_original BEFORE INSERT ON payload_purges FOR EACH ROW EXECUTE FUNCTION guard_payload_purge();
CREATE TRIGGER payload_purge_immutable BEFORE UPDATE OR DELETE ON payload_purges FOR EACH ROW EXECUTE FUNCTION immutable_access_history();
CREATE FUNCTION payload_purge_effect() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE payload jsonb;
BEGIN
  EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE id=$1',NEW.kind) INTO payload USING NEW.target_id;
  IF payload IS NULL OR EXISTS(SELECT 1 FROM unnest(public.retention_fields(NEW.kind)) f WHERE payload->f IS DISTINCT FROM 'null'::jsonb) THEN
    RAISE EXCEPTION 'Payload purge requires its atomic null-byte effect'; END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER payload_purge_bound_effect AFTER INSERT ON payload_purges DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION payload_purge_effect();
CREATE FUNCTION guard_retained_payload() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE fields text[]=public.retention_fields(TG_TABLE_NAME); empty boolean; retired boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM unnest(fields) f WHERE to_jsonb(NEW)->f='null'::jsonb) INTO empty;
  SELECT EXISTS(SELECT 1 FROM public.payload_purges WHERE kind=TG_TABLE_NAME AND target_id=NEW.id) INTO retired;
  IF retired THEN
    IF TG_OP<>'UPDATE' OR EXISTS(SELECT 1 FROM unnest(fields) f WHERE to_jsonb(NEW)->f IS DISTINCT FROM 'null'::jsonb) THEN RAISE EXCEPTION 'Purged bytes cannot return'; END IF;
  ELSIF empty AND (TG_TABLE_NAME NOT IN ('participant_attempts','authoring_attempts') OR to_jsonb(NEW)->>'result' IS NOT NULL) THEN
    RAISE EXCEPTION 'Missing payload without a retention tombstone';
  END IF;
  RETURN NEW;
END $$;
DO $$ DECLARE name text; BEGIN
  FOREACH name IN ARRAY ARRAY['entry_flows','staff_entry_flows','participant_sessions','staff_sessions','code_drafts','participant_judging','competition_submissions','participant_attempts','authoring_attempts'] LOOP
    EXECUTE format('CREATE TRIGGER retained_payload_state BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.guard_retained_payload()',name);
  END LOOP;
END $$;
--> statement-breakpoint
-- Prepend one narrow transition check; preserve the complete existing guard bodies.
DO $$ DECLARE name text; body text; at integer; answer text; BEGIN
  FOREACH name IN ARRAY ARRAY['immutable_access_history','guard_entry_flow','guard_staff_flow','guard_participant_session','guard_participant_judging','guard_authoring_state','guard_workbench_draft','workbench_integrity'] LOOP
    SELECT prosrc INTO STRICT body FROM pg_proc WHERE oid=to_regprocedure('public.'||name||'()');
    at=strpos(body,'BEGIN');
    IF at=0 OR strpos(body,'payload_purge_transition')<>0 THEN RAISE EXCEPTION 'Unexpected retention guard migration target'; END IF;
    answer=CASE WHEN name='workbench_integrity' THEN 'NULL' ELSE 'NEW' END;
    body=overlay(body placing E'\n  IF TG_OP=''UPDATE'' AND public.payload_purge_transition(TG_TABLE_NAME,to_jsonb(OLD),to_jsonb(NEW)) THEN RETURN '||answer||E'; END IF;\n' FROM at+5 FOR 0);
    EXECUTE format('CREATE OR REPLACE FUNCTION public.%I() RETURNS trigger LANGUAGE plpgsql %s SET search_path=pg_catalog,public AS %L',name,
      CASE WHEN name='workbench_integrity' THEN 'SECURITY DEFINER' ELSE '' END,body);
  END LOOP;
END $$;
DO $$ DECLARE body text; BEGIN
  SELECT prosrc INTO STRICT body FROM pg_proc WHERE oid='public.participant_plan_integrity()'::regprocedure;
  IF strpos(body,'s.source=p.source')=0 THEN RAISE EXCEPTION 'Unexpected exact-source binding'; END IF;
  body=replace(body,'s.source=p.source','s.source IS NOT DISTINCT FROM p.source');
  EXECUTE format('CREATE OR REPLACE FUNCTION public.participant_plan_integrity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS %L',body);
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION participant_accounted(subject uuid) RETURNS bigint LANGUAGE sql STABLE SET search_path=pg_catalog,public AS $$
  SELECT 524288+CASE WHEN p.completed_at IS NULL AND p.status<>'CANCELLED' THEN
    (SELECT count(*) FROM public.participant_jobs WHERE parent_id=p.id)*262144*CASE WHEN p.lane='OFFICIAL' THEN 4 ELSE 2 END
    ELSE COALESCE((SELECT sum(CASE WHEN a.result IS NULL THEN 262144 ELSE
      2048+octet_length(a.evidence::text)+coalesce(octet_length(a.stdout_prefix),0)+coalesce(octet_length(a.stderr),0)+coalesce(octet_length(a.compiler_output),0) END)
      FROM public.participant_attempts a JOIN public.participant_jobs j ON j.id=a.job_id WHERE j.parent_id=p.id),0) END
    FROM public.participant_judging p WHERE p.id=subject;
$$;
CREATE OR REPLACE FUNCTION validation_accounted_bytes(subject uuid) RETURNS bigint LANGUAGE sql STABLE SET search_path=pg_catalog,public AS $$
  SELECT CASE WHEN status IN ('QUEUED','RUNNING') THEN 524288+check_count::bigint*3*262144 ELSE 524288+COALESCE((
    SELECT sum(CASE WHEN a.released_at IS NULL THEN 262144 ELSE COALESCE(octet_length(a.evidence::text),0)+coalesce(octet_length(a.stdout_prefix),0)+coalesce(octet_length(a.stderr),0)+coalesce(octet_length(a.compiler_output),0)+4096 END)
    FROM public.authoring_attempts a JOIN public.authoring_checks c ON c.id=a.check_id WHERE c.run_id=r.id),0) END FROM public.validation_runs r WHERE id=subject;
$$;
CREATE FUNCTION retire_payload(kind text,target uuid) RETURNS integer LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE payload jsonb; sets text; stage uuid; run uuid; count integer=0; n timestamptz=date_trunc('milliseconds',statement_timestamp());
BEGIN
  IF public.retention_fields(kind) IS NULL THEN RAISE EXCEPTION 'Unknown payload family'; END IF;
  EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE id=$1 FOR UPDATE',kind) INTO payload USING target;
  IF NOT coalesce(public.retention_eligible(kind,target,n),false) THEN RETURN 0; END IF;
  INSERT INTO public.payload_purges VALUES(kind,target,public.retention_manifest(kind,payload),n);
  SELECT string_agg(format('%I=NULL',f),',') INTO sets FROM unnest(public.retention_fields(kind)) f;
  EXECUTE format('UPDATE public.%I SET %s WHERE id=$1',kind,sets) USING target;
  count=1;
  IF kind IN ('participant_judging','competition_submissions') AND (kind='competition_submissions' OR payload->>'lane'='OFFICIAL') THEN
    count=count+public.retire_payload(CASE WHEN kind='participant_judging' THEN 'competition_submissions' ELSE 'participant_judging' END,target);
  ELSIF kind='participant_attempts' THEN
    SELECT parent_id INTO stage FROM public.participant_jobs WHERE id=(payload->>'job_id')::uuid;
    PERFORM public.participant_rebudget(stage);
  ELSIF kind='authoring_attempts' THEN
    SELECT run_id INTO run FROM public.authoring_checks WHERE id=(payload->>'check_id')::uuid;
    PERFORM public.refresh_validation_run(run,n);
  END IF;
  RETURN count;
END $$;
CREATE FUNCTION maintain_payload_retention(family text) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE item record; count integer=0; stages uuid[]; candidates jsonb;
BEGIN
  IF family NOT IN ('SECRETS','PAYLOADS') OR family IS NULL THEN RAISE EXCEPTION 'Unknown retention batch'; END IF;
  PERFORM id FROM public.security_control WHERE id=1 FOR UPDATE;
  PERFORM public.lock_arena_control(true);
  SELECT coalesce(jsonb_agg(to_jsonb(c)),'[]') INTO candidates FROM (
    SELECT * FROM (
      SELECT 'entry_flows'::text kind,id FROM public.entry_flows WHERE family='SECRETS' AND proof_verifier IS NOT NULL AND expires_at<=statement_timestamp()-interval '24 hours'
      UNION ALL SELECT 'staff_entry_flows',id FROM public.staff_entry_flows WHERE family='SECRETS' AND proof_verifier IS NOT NULL AND expires_at<=statement_timestamp()-interval '24 hours'
      UNION ALL SELECT 'participant_sessions',id FROM public.participant_sessions WHERE family='SECRETS' AND secret_verifier IS NOT NULL AND least(absolute_expires_at,revoked_at)<=statement_timestamp()-interval '24 hours'
      UNION ALL SELECT 'staff_sessions',id FROM public.staff_sessions WHERE family='SECRETS' AND secret_verifier IS NOT NULL AND least(absolute_expires_at,revoked_at)<=statement_timestamp()-interval '24 hours'
      UNION ALL SELECT 'code_drafts',id FROM public.code_drafts WHERE family='PAYLOADS' AND source_code IS NOT NULL AND updated_at<=statement_timestamp()-interval '7 days'
      UNION ALL SELECT 'participant_judging',id FROM public.participant_judging WHERE family='PAYLOADS' AND source IS NOT NULL AND created_at<=statement_timestamp()-interval '7 days'
      UNION ALL SELECT 'competition_submissions',id FROM public.competition_submissions WHERE family='PAYLOADS' AND source IS NOT NULL AND received_at<=statement_timestamp()-interval '30 days'
      UNION ALL SELECT 'participant_attempts',id FROM public.participant_attempts WHERE family='PAYLOADS' AND stdout_prefix IS NOT NULL AND resolved_at<=statement_timestamp()-interval '7 days'
      UNION ALL SELECT 'authoring_attempts',id FROM public.authoring_attempts WHERE family='PAYLOADS' AND stdout_prefix IS NOT NULL AND resolved_at<=statement_timestamp()-interval '7 days'
    ) c WHERE public.retention_eligible(kind,id,date_trunc('milliseconds',statement_timestamp())) ORDER BY kind,id LIMIT 20
  ) c;
  -- Security and the arena gate exclude all admission/control writes before catalogue/judge locks.
  SELECT array_agg(id ORDER BY id) INTO stages FROM public.rounds WHERE arena_instance_id IN (
    SELECT current_instance_id FROM public.arena_control WHERE id=1
    UNION SELECT r.arena_instance_id FROM public.rounds r WHERE EXISTS (
      SELECT 1 FROM jsonb_to_recordset(candidates) c(kind text,id uuid)
      JOIN public.participant_judging p ON c.kind='participant_judging' AND p.id=c.id WHERE p.round_id=r.id)
    UNION SELECT r.arena_instance_id FROM public.rounds r JOIN public.code_drafts d ON d.round_id=r.id WHERE d.id IN (SELECT id FROM jsonb_to_recordset(candidates) c(kind text,id uuid) WHERE kind='code_drafts')
    UNION SELECT r.arena_instance_id FROM public.rounds r JOIN public.competition_submissions s ON s.round_id=r.id WHERE s.id IN (SELECT id FROM jsonb_to_recordset(candidates) c(kind text,id uuid) WHERE kind='competition_submissions')
    UNION SELECT r.arena_instance_id FROM public.rounds r JOIN public.participant_judging p ON p.round_id=r.id JOIN public.participant_jobs j ON j.parent_id=p.id JOIN public.participant_attempts a ON a.job_id=j.id
      WHERE a.id IN (SELECT id FROM jsonb_to_recordset(candidates) c(kind text,id uuid) WHERE kind='participant_attempts'));
  PERFORM id FROM public.rounds WHERE id=ANY(stages) ORDER BY id FOR UPDATE;
  PERFORM public.lock_validation_judge();
  IF EXISTS(SELECT 1 FROM public.rounds WHERE id=ANY(stages) AND trusted_time_at>statement_timestamp()) THEN RAISE EXCEPTION 'Retention time reversed' USING ERRCODE='22008'; END IF;
  FOR item IN SELECT * FROM jsonb_to_recordset(candidates) c(kind text,id uuid) LOOP count=count+public.retire_payload(item.kind,item.id); END LOOP;
  RETURN count;
END $$;
REVOKE ALL ON payload_purges FROM PUBLIC,ingenium_api;
GRANT SELECT ON payload_purges TO ingenium_api;
REVOKE ALL ON FUNCTION retention_fields(text),retention_manifest(text,jsonb),payload_purge_transition(text,jsonb,jsonb),retention_terminal_at(uuid),retention_arena_safe(uuid,integer,timestamptz),
  retention_eligible(text,uuid,timestamptz),guard_payload_purge(),payload_purge_effect(),guard_retained_payload(),retire_payload(text,uuid),maintain_payload_retention(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION retention_fields(text),retention_manifest(text,jsonb),payload_purge_transition(text,jsonb,jsonb),maintain_payload_retention(text) TO ingenium_api;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION workbench_usage(team uuid DEFAULT NULL) RETURNS bigint LANGUAGE sql STABLE SET search_path=pg_catalog,public AS $$
  SELECT COALESCE((SELECT sum(p.reserved_bytes) FROM public.participant_judging p WHERE team IS NULL OR p.team_round_id=team),0)
    +COALESCE((SELECT sum(coalesce(octet_length(d.source_code),0)+512) FROM public.code_drafts d JOIN public.member_rounds m ON m.id=d.member_round_id WHERE team IS NULL OR m.team_round_id=team),0)
    +512*(SELECT count(*) FROM public.draft_save_outcomes d JOIN public.member_rounds m ON m.id=d.member_round_id WHERE team IS NULL OR m.team_round_id=team)
    +256*(SELECT count(*) FROM public.workbench_activities d JOIN public.member_rounds m ON m.id=d.member_round_id WHERE team IS NULL OR m.team_round_id=team)
    +coalesce((SELECT sum(octet_length(manifest::text)+128) FROM public.payload_purges WHERE kind NOT IN ('authoring_attempts','entry_flows','staff_entry_flows','participant_sessions','staff_sessions') AND team IS NULL),0);
$$;
