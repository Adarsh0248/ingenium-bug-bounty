-- Additive: existing attempts, consumed permits and immutable results are never rewritten.
BEGIN;
CREATE TABLE ingenium_judge.participant_batches(
  batch_id uuid PRIMARY KEY,epoch uuid NOT NULL REFERENCES ingenium_judge.control(epoch),
  attempt_id uuid NOT NULL UNIQUE REFERENCES ingenium_judge.attempts(attempt_id),
  raw bytea NOT NULL CHECK(octet_length(raw) BETWEEN 1 AND 16384),
  digest bytea NOT NULL CHECK(octet_length(digest)=32 AND digest=sha256(raw)),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),result jsonb,sealed_at timestamptz,
  CHECK((result IS NULL)=(sealed_at IS NULL)),
  CHECK(result IS NULL OR(jsonb_typeof(result)='object' AND octet_length(result::text)<=2097152))
);
CREATE FUNCTION ingenium_judge.batch_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
 IF TG_OP='DELETE' OR ROW(NEW.batch_id,NEW.epoch,NEW.attempt_id,NEW.raw,NEW.digest,NEW.created_at)
   IS DISTINCT FROM ROW(OLD.batch_id,OLD.epoch,OLD.attempt_id,OLD.raw,OLD.digest,OLD.created_at)
   OR OLD.result IS NOT NULL AND ROW(NEW.result,NEW.sealed_at) IS DISTINCT FROM ROW(OLD.result,OLD.sealed_at)
 THEN RAISE EXCEPTION 'Batch history and sealed result are immutable';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER batch_immutable BEFORE UPDATE OR DELETE ON ingenium_judge.participant_batches FOR EACH ROW EXECUTE FUNCTION ingenium_judge.batch_guard();
CREATE TABLE ingenium_judge.participant_batch_members(
 attempt_id uuid PRIMARY KEY,batch_id uuid NOT NULL REFERENCES ingenium_judge.participant_batches(batch_id),
 ordinal integer NOT NULL CHECK(ordinal BETWEEN 0 AND 7),UNIQUE(batch_id,ordinal)
);
CREATE FUNCTION ingenium_judge.batch_member_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN RAISE EXCEPTION 'Original batch case identities are immutable';END $$;
CREATE TRIGGER batch_members_immutable BEFORE UPDATE OR DELETE ON ingenium_judge.participant_batch_members FOR EACH ROW EXECUTE FUNCTION ingenium_judge.batch_member_guard();
ALTER FUNCTION ingenium_judge.admit(uuid,uuid,jsonb) RENAME TO admit_original_batch;
REVOKE ALL ON FUNCTION ingenium_judge.admit_original_batch(uuid,uuid,jsonb) FROM PUBLIC,ingenium_judge_gateway,ingenium_judge_supervisor,ingenium_judge_publisher;
CREATE FUNCTION ingenium_judge.admit(e uuid,b uuid,p jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 PERFORM id FROM ingenium_judge.control WHERE id=1 FOR UPDATE;
 IF EXISTS(SELECT 1 FROM ingenium_judge.participant_batch_members m JOIN ingenium_judge.participant_batches x ON x.batch_id=m.batch_id
  WHERE m.attempt_id=(p->>'attempt_id')::uuid AND x.attempt_id<>m.attempt_id)THEN RAISE EXCEPTION 'A batch case cannot be admitted separately' USING ERRCODE='22023';END IF;
 RETURN ingenium_judge.admit_original_batch(e,b,p);
END $$;
REVOKE ALL ON FUNCTION ingenium_judge.admit(uuid,uuid,jsonb),ingenium_judge.batch_member_guard() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ingenium_judge.admit(uuid,uuid,jsonb) TO ingenium_judge_gateway;

CREATE FUNCTION ingenium_judge.admit_batch(e uuid,b uuid,subject uuid,raw_request bytea) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE spec jsonb; item record; p jsonb; first_payload jsonb; previous_position integer=0; number_cases integer;k text;
 seen_attempts uuid[]='{}';seen_checks uuid[]='{}';seen_cases uuid[]='{}';old ingenium_judge.participant_batches%ROWTYPE;retained bigint;
BEGIN
 PERFORM id FROM ingenium_judge.control WHERE id=1 AND epoch=e AND boot_id=b FOR UPDATE;
 IF NOT FOUND OR raw_request IS NULL OR octet_length(raw_request) NOT BETWEEN 1 AND 16384 OR subject IS NULL THEN RAISE EXCEPTION 'Invalid batch binding';END IF;
 SELECT * INTO old FROM ingenium_judge.participant_batches WHERE batch_id=subject;
 IF FOUND THEN
   IF old.epoch<>e OR old.raw IS DISTINCT FROM raw_request THEN RAISE EXCEPTION 'Batch intent conflict' USING ERRCODE='22023';END IF;
   RETURN;
 END IF;
 spec=convert_from(raw_request,'UTF8')::jsonb;
 FOREACH k IN ARRAY ARRAY['protocol','batch_id','host_epoch_id','run_id','runtime_key','runtime_digest','language','source_role','source_b64'] LOOP
   IF jsonb_typeof(spec->k) IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'Invalid batch field';END IF;
 END LOOP;
 IF jsonb_typeof(spec)<>'object' OR(SELECT count(*) FROM jsonb_object_keys(spec))<>10
   OR spec->>'protocol'<>'ingenium-participant-batch-v1' OR(spec->>'batch_id')::uuid<>subject
   OR(spec->>'host_epoch_id')::uuid<>e OR spec->>'source_role' NOT IN('OFFICIAL','SAMPLE')
   OR spec->>'language' NOT IN('c','cpp','java','python') OR jsonb_typeof(spec->'cases')<>'object'
 THEN RAISE EXCEPTION 'Invalid participant batch';END IF;
 number_cases=(SELECT count(*) FROM jsonb_object_keys(spec->'cases'));
 IF number_cases NOT BETWEEN 1 AND (CASE WHEN spec->>'source_role'='SAMPLE' THEN 3 ELSE 8 END) THEN RAISE EXCEPTION 'Invalid batch case count';END IF;
 FOR item IN SELECT key,value,row_number()OVER(ORDER BY key)-1 ordinal FROM jsonb_each(spec->'cases') ORDER BY key LOOP
   FOREACH k IN ARRAY ARRAY['case_id','attempt_id','check_id','stdin_b64','expected_b64','checker_mode'] LOOP
     IF jsonb_typeof(item.value->k) IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'Invalid batch case field';END IF;
   END LOOP;
   IF jsonb_typeof(item.value->'position') IS DISTINCT FROM 'number' OR item.value->>'position' !~ '^[1-9][0-9]?$' THEN RAISE EXCEPTION 'Invalid case position';END IF;
   IF item.key<>'c'||lpad(item.ordinal::text,2,'0') OR jsonb_typeof(item.value)<>'object' OR(SELECT count(*) FROM jsonb_object_keys(item.value))<>10
     OR(item.value->>'position')::integer<=previous_position OR(item.value->>'position')::integer>20
     OR item.value->>'checker_mode' NOT IN('TOKENS','EXACT_TEXT')
     OR(item.value->>'attempt_id')::uuid=ANY(seen_attempts) OR(item.value->>'check_id')::uuid=ANY(seen_checks)
     OR(item.value->>'case_id')::uuid=ANY(seen_cases) OR(item.value->>'attempt_id')::uuid=subject
     OR octet_length(decode(item.value->>'expected_b64','base64'))>1048576
     OR replace(encode(decode(item.value->>'expected_b64','base64'),'base64'),E'\n','') IS DISTINCT FROM item.value->>'expected_b64'
   THEN RAISE EXCEPTION 'Invalid or repeated batch case';END IF;
   seen_attempts=array_append(seen_attempts,(item.value->>'attempt_id')::uuid);seen_checks=array_append(seen_checks,(item.value->>'check_id')::uuid);
   seen_cases=array_append(seen_cases,(item.value->>'case_id')::uuid);previous_position=(item.value->>'position')::integer;
   p=jsonb_build_object('protocol','ingenium-authoring-v1','host_epoch_id',e,'attempt_id',item.value->>'attempt_id','run_id',spec->>'run_id',
     'check_id',item.value->>'check_id','runtime_key',spec->>'runtime_key','runtime_digest',spec->>'runtime_digest','language',spec->>'language',
     'source_role',spec->>'source_role','check_type','TEST_CASE','source_b64',spec->>'source_b64','stdin_b64',item.value->>'stdin_b64',
     'cpu_ms',item.value->'cpu_ms','wall_ms',item.value->'wall_ms','memory_kb',item.value->'memory_kb','number_of_runs',1,'enable_network',false);
   p=p||jsonb_build_object('payload_digest',encode(ingenium_judge.payload_digest(p),'hex'));
   PERFORM ingenium_judge.validate_payload(p,e);
   IF item.ordinal=0 THEN first_payload=p;END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM ingenium_judge.attempts WHERE attempt_id=ANY(seen_attempts)) OR EXISTS(SELECT 1 FROM ingenium_judge.participant_batch_members WHERE attempt_id=ANY(seen_attempts)) THEN RAISE EXCEPTION 'An original attempt cannot be repackaged into a batch' USING ERRCODE='22023';END IF;
 -- Every batch keeps a bounded result reservation in the same native storage budget.
 retained=octet_length(raw_request)::bigint+2097152+8192;
 IF(SELECT retained_bytes FROM ingenium_judge.control WHERE id=1)+retained+4202496>4294967296 THEN RAISE EXCEPTION 'Batch retained capacity' USING ERRCODE='54000';END IF;
 PERFORM ingenium_judge.admit(e,b,first_payload);
 INSERT INTO ingenium_judge.participant_batches(batch_id,epoch,attempt_id,raw,digest) VALUES(subject,e,(first_payload->>'attempt_id')::uuid,raw_request,sha256(raw_request));
 FOR item IN SELECT value,row_number()OVER(ORDER BY key)-1 ordinal FROM jsonb_each(spec->'cases') LOOP
  INSERT INTO ingenium_judge.participant_batch_members VALUES((item.value->>'attempt_id')::uuid,subject,item.ordinal);
 END LOOP;
 UPDATE ingenium_judge.control SET retained_bytes=retained_bytes+retained WHERE id=1;
END $$;

CREATE FUNCTION ingenium_judge.batch_for_attempt(e uuid,b uuid,attempt uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM ingenium_judge.control WHERE epoch=e AND boot_id=b)THEN RAISE EXCEPTION 'Wrong batch host';END IF;
 RETURN(SELECT jsonb_build_object('batch_id',x.batch_id,'digest',encode(x.digest,'hex'),'raw_b64',replace(encode(x.raw,'base64'),E'\n',''))
   FROM ingenium_judge.participant_batches x WHERE x.attempt_id=attempt AND x.epoch=e);
END $$;
CREATE FUNCTION ingenium_judge.observe_batch(e uuid,b uuid,subject uuid,d bytea) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v ingenium_judge.participant_batches%ROWTYPE;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM ingenium_judge.control WHERE epoch=e AND boot_id=b) OR d IS NULL OR octet_length(d)<>32 THEN RAISE EXCEPTION 'Wrong batch host or digest';END IF;
 SELECT * INTO v FROM ingenium_judge.participant_batches WHERE batch_id=subject;
 IF NOT FOUND THEN RETURN NULL;END IF;
 IF v.epoch<>e OR v.digest<>d THEN RAISE EXCEPTION 'Batch observation conflict' USING ERRCODE='22023';END IF;
 RETURN jsonb_build_object('raw_b64',replace(encode(v.raw,'base64'),E'\n',''),'result',v.result,'carrier',ingenium_judge.observe(e,b,v.attempt_id,
   (SELECT payload_digest FROM ingenium_judge.attempts WHERE attempt_id=v.attempt_id)));
END $$;
CREATE FUNCTION ingenium_judge.seal_batch(e uuid,b uuid,attempt uuid,token uuid,owner_id uuid,answer jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v ingenium_judge.participant_batches%ROWTYPE;a ingenium_judge.attempts%ROWTYPE;
BEGIN
 PERFORM id FROM ingenium_judge.control WHERE id=1 AND epoch=e AND boot_id=b FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'Wrong batch host';END IF;
 SELECT * INTO a FROM ingenium_judge.attempts WHERE attempt_id=attempt FOR UPDATE;
 SELECT * INTO v FROM ingenium_judge.participant_batches WHERE attempt_id=attempt FOR UPDATE;
 IF v.batch_id IS NULL OR a.epoch<>e OR a.provider_token IS DISTINCT FROM token OR a.permit_owner IS DISTINCT FROM owner_id OR a.launch_started_at IS NULL
   OR answer IS NULL OR jsonb_typeof(answer)<>'object' OR octet_length(answer::text)>2097152
   OR answer->>'protocol'<>'ingenium-participant-batch-result-v1' OR answer->>'batch_id'<>v.batch_id::text
   OR answer->>'batch_digest'<>encode(v.digest,'hex') OR answer->>'host_epoch_id'<>e::text OR answer->'drain' IS DISTINCT FROM 'null'::jsonb
 THEN RAISE EXCEPTION 'Unbound batch result';END IF;
 IF v.result IS NOT NULL THEN IF v.result IS DISTINCT FROM answer THEN RAISE EXCEPTION 'Conflicting immutable batch result';END IF;RETURN;END IF;
 UPDATE ingenium_judge.participant_batches SET result=answer,sealed_at=clock_timestamp() WHERE batch_id=v.batch_id;
 UPDATE ingenium_judge.control SET retained_bytes=retained_bytes-2097152+octet_length(answer::text) WHERE id=1;
END $$;
REVOKE ALL ON ingenium_judge.participant_batches,ingenium_judge.participant_batch_members FROM PUBLIC,ingenium_judge_gateway,ingenium_judge_supervisor,ingenium_judge_publisher;
REVOKE ALL ON FUNCTION ingenium_judge.batch_guard(),ingenium_judge.admit_batch(uuid,uuid,uuid,bytea),ingenium_judge.batch_for_attempt(uuid,uuid,uuid),
 ingenium_judge.observe_batch(uuid,uuid,uuid,bytea),ingenium_judge.seal_batch(uuid,uuid,uuid,uuid,uuid,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ingenium_judge.admit_batch(uuid,uuid,uuid,bytea),ingenium_judge.observe_batch(uuid,uuid,uuid,bytea) TO ingenium_judge_gateway;
GRANT EXECUTE ON FUNCTION ingenium_judge.batch_for_attempt(uuid,uuid,uuid),ingenium_judge.seal_batch(uuid,uuid,uuid,uuid,uuid,jsonb) TO ingenium_judge_supervisor;
COMMIT;
