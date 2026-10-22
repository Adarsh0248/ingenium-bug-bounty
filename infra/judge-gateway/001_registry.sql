-- Apply manually to a NEW private Judge0 database after reviewing the pinned upstream schema.
BEGIN;
CREATE SCHEMA ingenium_judge;
REVOKE ALL ON SCHEMA ingenium_judge FROM PUBLIC;
DO $$ BEGIN
  IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='ingenium_judge_gateway') THEN CREATE ROLE ingenium_judge_gateway NOLOGIN; END IF;
  IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='ingenium_judge_supervisor') THEN CREATE ROLE ingenium_judge_supervisor NOLOGIN; END IF;
  IF EXISTS(SELECT FROM pg_roles WHERE rolname IN ('ingenium_judge_gateway','ingenium_judge_supervisor')
    AND (rolcanlogin OR rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls)) THEN RAISE EXCEPTION 'Registry privilege groups must be unprivileged NOLOGIN roles'; END IF;
END $$;
CREATE TABLE ingenium_judge.control (
  id integer PRIMARY KEY CHECK(id=1), epoch uuid NOT NULL UNIQUE, boot_id uuid NOT NULL,
  state text NOT NULL CHECK(state IN ('ACTIVE','FENCED')), ready_until timestamptz NOT NULL DEFAULT '-infinity',
  readiness_proof bytea CHECK(readiness_proof IS NULL OR octet_length(readiness_proof)=32),
  retained_bytes bigint NOT NULL DEFAULT 0 CHECK(retained_bytes BETWEEN 0 AND 4294967296)
);
CREATE TABLE ingenium_judge.runtimes (
  language text PRIMARY KEY CHECK(language IN ('c','cpp','java','python','javascript')),
  runtime_key text NOT NULL UNIQUE CHECK(runtime_key ~ '^[a-z0-9][a-z0-9._-]{0,63}$'),
  runtime_digest text NOT NULL CHECK(runtime_digest ~ '^[0-9a-f]{64}$'),
  provider_language_id integer NOT NULL UNIQUE REFERENCES public.languages(id),
  provider_language_fingerprint bytea NOT NULL CHECK(octet_length(provider_language_fingerprint)=32)
);
CREATE TABLE ingenium_judge.attempts (
  attempt_id uuid PRIMARY KEY, epoch uuid NOT NULL REFERENCES ingenium_judge.control(epoch),
  payload_digest bytea NOT NULL CHECK(octet_length(payload_digest)=32), envelope jsonb NOT NULL,
  provider_token uuid NOT NULL UNIQUE, submission_id integer NOT NULL UNIQUE REFERENCES public.submissions(id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  permit_owner uuid, started_at timestamptz,
  evidence jsonb, sealed_at timestamptz, drain jsonb,
  accounted_bytes bigint NOT NULL CHECK(accounted_bytes BETWEEN 8192 AND 4202496),
  CHECK((permit_owner IS NULL)=(started_at IS NULL)),
  CHECK((evidence IS NULL)=(sealed_at IS NULL)),
  CHECK(evidence IS NULL OR (permit_owner IS NOT NULL AND jsonb_typeof(evidence)='object' AND octet_length(evidence::text)<=2097152)),
  CHECK(drain IS NULL OR (evidence IS NOT NULL AND jsonb_typeof(drain)='object' AND octet_length(drain::text)<=4096)),
  CHECK(jsonb_typeof(envelope)='object' AND octet_length(envelope::text)<=2097152)
);
CREATE TABLE ingenium_judge.outbox (
  attempt_id uuid PRIMARY KEY REFERENCES ingenium_judge.attempts(attempt_id), published_at timestamptz
);

CREATE FUNCTION ingenium_judge.language_fingerprint(l public.languages) RETURNS bytea
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
  SELECT sha256(convert_to(jsonb_build_object('id',l.id,'name',l.name,'compile_cmd',l.compile_cmd,'run_cmd',l.run_cmd,'source_file',l.source_file,'is_archived',l.is_archived)::text,'UTF8'))
$$;
CREATE FUNCTION ingenium_judge.guards() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Registry history is immutable'; END IF;
  IF NEW IS NOT DISTINCT FROM OLD THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME='runtimes' THEN RAISE EXCEPTION 'Runtime binding is immutable'; END IF;
  IF TG_TABLE_NAME='control' THEN
    IF NEW.id<>OLD.id OR NEW.epoch<>OLD.epoch OR NEW.boot_id<>OLD.boot_id OR (OLD.state='FENCED' AND NEW.state<>'FENCED') THEN RAISE EXCEPTION 'Epoch cannot be reused'; END IF;
  ELSIF TG_TABLE_NAME='outbox' THEN
    IF NEW.attempt_id<>OLD.attempt_id OR OLD.published_at IS NOT NULL OR NEW.published_at IS NULL THEN RAISE EXCEPTION 'Outbox cannot be reset'; END IF;
  ELSE
    IF ROW(NEW.attempt_id,NEW.epoch,NEW.payload_digest,NEW.envelope,NEW.provider_token,NEW.submission_id,NEW.created_at)
      IS DISTINCT FROM ROW(OLD.attempt_id,OLD.epoch,OLD.payload_digest,OLD.envelope,OLD.provider_token,OLD.submission_id,OLD.created_at)
      OR (OLD.permit_owner IS NOT NULL AND ROW(NEW.permit_owner,NEW.started_at) IS DISTINCT FROM ROW(OLD.permit_owner,OLD.started_at))
      OR (OLD.evidence IS NOT NULL AND ROW(NEW.evidence,NEW.sealed_at) IS DISTINCT FROM ROW(OLD.evidence,OLD.sealed_at))
      OR (OLD.drain IS NOT NULL AND NEW.drain IS DISTINCT FROM OLD.drain) THEN RAISE EXCEPTION 'Permit, result and association cannot be reset'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER registry_guard BEFORE UPDATE OR DELETE ON ingenium_judge.control FOR EACH ROW EXECUTE FUNCTION ingenium_judge.guards();
CREATE TRIGGER registry_guard BEFORE UPDATE OR DELETE ON ingenium_judge.runtimes FOR EACH ROW EXECUTE FUNCTION ingenium_judge.guards();
CREATE TRIGGER registry_guard BEFORE UPDATE OR DELETE ON ingenium_judge.attempts FOR EACH ROW EXECUTE FUNCTION ingenium_judge.guards();
CREATE TRIGGER registry_guard BEFORE UPDATE OR DELETE ON ingenium_judge.outbox FOR EACH ROW EXECUTE FUNCTION ingenium_judge.guards();

CREATE FUNCTION ingenium_judge.compatible() RETURNS boolean LANGUAGE sql SET search_path=pg_catalog AS $$
  SELECT count(*)=5 AND coalesce(bool_and(NOT l.is_archived AND r.provider_language_fingerprint=ingenium_judge.language_fingerprint(l)),false)
  FROM ingenium_judge.runtimes r JOIN public.languages l ON l.id=r.provider_language_id
$$;
CREATE FUNCTION ingenium_judge.readiness(e uuid,b uuid) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog AS $$
  SELECT jsonb_build_object('ready',c.state='ACTIVE' AND c.ready_until>clock_timestamp() AND c.readiness_proof IS NOT NULL AND ingenium_judge.compatible(),
    'runtimes',(SELECT jsonb_object_agg(language,jsonb_build_object('key',runtime_key,'digest',runtime_digest)) FROM ingenium_judge.runtimes))
  FROM ingenium_judge.control c WHERE c.epoch=e AND c.boot_id=b
$$;
CREATE FUNCTION ingenium_judge.heartbeat(e uuid,b uuid,proof bytea) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c ingenium_judge.control%ROWTYPE;
BEGIN
  SELECT * INTO c FROM ingenium_judge.control WHERE id=1 FOR UPDATE;
  IF c.epoch IS DISTINCT FROM e OR c.boot_id IS DISTINCT FROM b OR c.state<>'ACTIVE' OR octet_length(proof)<>32 OR proof IS NULL OR NOT ingenium_judge.compatible() THEN RAISE EXCEPTION 'Host is not verified'; END IF;
  UPDATE ingenium_judge.control SET ready_until=clock_timestamp()+interval '30 seconds',readiness_proof=proof WHERE id=1;
END $$;
CREATE FUNCTION ingenium_judge.payload_digest(p jsonb) RETURNS bytea
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE result bytea=convert_to('ingenium-command-v1','UTF8'); value text; bytes bytea; source bytea; input bytea;
BEGIN
  source=decode(p->>'source_b64','base64'); input=decode(p->>'stdin_b64','base64');
  FOREACH value IN ARRAY ARRAY['AUTHORING_EXECUTION_V1',p->>'attempt_id',p->>'host_epoch_id',p->>'run_id',p->>'check_id',p->>'runtime_key',p->>'runtime_digest',p->>'language',
    p->>'source_role',p->>'check_type',encode(sha256(source),'hex'),octet_length(source)::text,encode(sha256(input),'hex'),octet_length(input)::text,p->>'cpu_ms',p->>'wall_ms',p->>'memory_kb'] LOOP
    IF value IS NULL THEN RAISE EXCEPTION 'Incomplete payload'; END IF;
    bytes=convert_to(value,'UTF8'); result=result||decode('02','hex')||int4send(octet_length(bytes))||bytes;
  END LOOP;
  RETURN sha256(result);
END $$;
CREATE FUNCTION ingenium_judge.validate_payload(p jsonb,e uuid) RETURNS void
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE k text; source bytea; input bytea; cpu integer; wall integer; memory integer; compiled boolean;
BEGIN
  IF p IS NULL OR jsonb_typeof(p) IS DISTINCT FROM 'object' OR octet_length(p::text)>2097152 OR (SELECT count(*) FROM jsonb_object_keys(p))<>18
    OR EXISTS(SELECT FROM jsonb_object_keys(p) x WHERE x NOT IN ('protocol','host_epoch_id','attempt_id','run_id','check_id','payload_digest','runtime_key','runtime_digest','language',
      'source_role','check_type','source_b64','stdin_b64','cpu_ms','wall_ms','memory_kb','number_of_runs','enable_network')) THEN RAISE EXCEPTION 'Invalid payload shape'; END IF;
  FOREACH k IN ARRAY ARRAY['protocol','host_epoch_id','attempt_id','run_id','check_id','payload_digest','runtime_key','runtime_digest','language','source_role','check_type','source_b64','stdin_b64'] LOOP
    IF jsonb_typeof(p->k) IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'Invalid payload type'; END IF;
  END LOOP;
  FOREACH k IN ARRAY ARRAY['host_epoch_id','attempt_id','run_id','check_id'] LOOP
    IF p->>k !~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN RAISE EXCEPTION 'Invalid identity'; END IF;
  END LOOP;
  IF p->>'protocol'<>'ingenium-authoring-v1' OR (p->>'host_epoch_id')::uuid<>e OR p->>'source_role' NOT IN ('REFERENCE','STARTER')
    OR p->>'check_type' NOT IN ('TEST_CASE','COMPILATION') OR p->'number_of_runs' IS DISTINCT FROM '1'::jsonb OR p->'enable_network' IS DISTINCT FROM 'false'::jsonb
    OR p->>'payload_digest' !~ '^[0-9a-f]{64}$' OR NOT EXISTS(SELECT FROM ingenium_judge.runtimes r WHERE r.language=p->>'language' AND r.runtime_key=p->>'runtime_key' AND r.runtime_digest=p->>'runtime_digest') THEN RAISE EXCEPTION 'Invalid frozen binding'; END IF;
  FOREACH k IN ARRAY ARRAY['cpu_ms','wall_ms','memory_kb'] LOOP
    IF jsonb_typeof(p->k) IS DISTINCT FROM 'number' OR p->>k !~ '^[1-9][0-9]{0,6}$' THEN RAISE EXCEPTION 'Invalid limits'; END IF;
  END LOOP;
  compiled=p->>'language' IN ('c','cpp'); cpu=(p->>'cpu_ms')::integer; wall=(p->>'wall_ms')::integer; memory=(p->>'memory_kb')::integer;
  IF cpu>(CASE WHEN compiled THEN 2000 ELSE 4000 END) OR wall<cpu OR wall>(CASE WHEN compiled THEN 10000 ELSE 15000 END) OR memory>524288
    THEN RAISE EXCEPTION 'Unsupported limits'; END IF;
  source=decode(p->>'source_b64','base64'); input=decode(p->>'stdin_b64','base64');
  IF octet_length(source)>131072 OR octet_length(input)>1048576 OR replace(encode(source,'base64'),E'\n','')<>p->>'source_b64' OR replace(encode(input,'base64'),E'\n','')<>p->>'stdin_b64'
    OR (p->>'check_type'='COMPILATION' AND (p->>'language' NOT IN ('c','cpp','java') OR octet_length(input)<>0))
    OR ingenium_judge.payload_digest(p)<>decode(p->>'payload_digest','hex') THEN RAISE EXCEPTION 'Payload bytes or digest differ'; END IF;
END $$;
CREATE FUNCTION ingenium_judge.admit(e uuid,b uuid,p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c ingenium_judge.control%ROWTYPE; a ingenium_judge.attempts%ROWTYPE; token uuid; provider integer; amount bigint;
BEGIN
  SELECT * INTO c FROM ingenium_judge.control WHERE id=1 FOR UPDATE;
  IF c.epoch IS DISTINCT FROM e OR c.boot_id IS DISTINCT FROM b THEN RAISE EXCEPTION 'Wrong host'; END IF;
  PERFORM ingenium_judge.validate_payload(p,e);
  SELECT * INTO a FROM ingenium_judge.attempts WHERE attempt_id=(p->>'attempt_id')::uuid;
  IF FOUND THEN
    IF a.epoch<>e OR a.envelope IS DISTINCT FROM p THEN RAISE EXCEPTION 'Attempt intent conflict' USING ERRCODE='22023'; END IF;
    RETURN jsonb_build_object('provider_token',a.provider_token);
  END IF;
  IF c.state<>'ACTIVE' OR c.ready_until<=clock_timestamp() OR c.readiness_proof IS NULL OR NOT ingenium_judge.compatible() THEN RAISE EXCEPTION 'Supervisor unavailable' USING ERRCODE='55000'; END IF;
  amount=octet_length(p::text)::bigint+2097152+8192;
  IF c.retained_bytes+amount>4294967296 OR (SELECT count(*) FROM ingenium_judge.attempts)>=10000
    OR (SELECT count(*) FROM ingenium_judge.attempts WHERE drain IS NULL)>=120 THEN RAISE EXCEPTION 'Registry capacity' USING ERRCODE='54000'; END IF;
  token=gen_random_uuid();
  INSERT INTO public.submissions(source_code,language_id,stdin,expected_output,status_id,created_at,token,number_of_runs,cpu_time_limit,cpu_extra_time,wall_time_limit,memory_limit,
    stack_limit,max_processes_and_or_threads,enable_per_process_and_thread_time_limit,enable_per_process_and_thread_memory_limit,max_file_size,redirect_stderr_to_stdout,enable_network)
    SELECT p->>'source_b64',r.provider_language_id,p->>'stdin_b64',NULL,1,clock_timestamp(),token::text,1,(p->>'cpu_ms')::numeric/1000,0,
      greatest((p->>'wall_ms')::numeric/1000,1),greatest((p->>'memory_kb')::integer,2048),65536,64,false,false,16384,false,false
    FROM ingenium_judge.runtimes r WHERE r.language=p->>'language' RETURNING id INTO provider;
  INSERT INTO ingenium_judge.attempts(attempt_id,epoch,payload_digest,envelope,provider_token,submission_id,accounted_bytes)
    VALUES((p->>'attempt_id')::uuid,e,decode(p->>'payload_digest','hex'),p,token,provider,amount);
  INSERT INTO ingenium_judge.outbox(attempt_id) VALUES((p->>'attempt_id')::uuid);
  UPDATE ingenium_judge.control SET retained_bytes=retained_bytes+amount WHERE id=1;
  RETURN jsonb_build_object('provider_token',token);
END $$;
CREATE FUNCTION ingenium_judge.observe(e uuid,b uuid,a uuid,d bytea) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v ingenium_judge.attempts%ROWTYPE;
BEGIN
  IF NOT EXISTS(SELECT FROM ingenium_judge.control WHERE epoch=e AND boot_id=b) THEN RAISE EXCEPTION 'Wrong host'; END IF;
  IF d IS NULL OR octet_length(d)<>32 THEN RAISE EXCEPTION 'Invalid payload identity' USING ERRCODE='22023'; END IF;
  SELECT * INTO v FROM ingenium_judge.attempts WHERE attempt_id=a;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF v.epoch<>e OR v.payload_digest IS DISTINCT FROM d THEN RAISE EXCEPTION 'Attempt intent conflict' USING ERRCODE='22023'; END IF;
  RETURN jsonb_build_object('envelope',v.envelope,'provider_token',v.provider_token,'evidence',v.evidence,'drain',v.drain);
END $$;
CREATE FUNCTION ingenium_judge.claim(e uuid,b uuid,a uuid,t uuid,w uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c ingenium_judge.control%ROWTYPE; v ingenium_judge.attempts%ROWTYPE;
BEGIN
  SELECT * INTO c FROM ingenium_judge.control WHERE id=1 FOR UPDATE;
  IF c.epoch IS DISTINCT FROM e OR c.boot_id IS DISTINCT FROM b OR c.state<>'ACTIVE' OR c.ready_until<=clock_timestamp() OR NOT ingenium_judge.compatible() THEN RAISE EXCEPTION 'Supervisor unavailable' USING ERRCODE='55000'; END IF;
  SELECT * INTO v FROM ingenium_judge.attempts WHERE attempt_id=a AND epoch=e AND provider_token=t FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Wrong execution binding'; END IF;
  IF v.permit_owner IS NOT NULL THEN RETURN NULL; END IF;
  IF w IS NULL OR (SELECT count(*) FROM ingenium_judge.attempts WHERE permit_owner IS NOT NULL AND drain IS NULL)>=2 THEN RETURN NULL; END IF;
  UPDATE ingenium_judge.attempts SET permit_owner=w,started_at=clock_timestamp() WHERE attempt_id=a;
  RETURN v.envelope;
END $$;
CREATE FUNCTION ingenium_judge.seal(e uuid,b uuid,a uuid,t uuid,w uuid,result jsonb,proof jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v ingenium_judge.attempts%ROWTYPE; amount bigint;
BEGIN
  PERFORM id FROM ingenium_judge.control WHERE id=1 AND epoch=e AND boot_id=b FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Wrong host'; END IF;
  SELECT * INTO v FROM ingenium_judge.attempts WHERE attempt_id=a AND epoch=e AND provider_token=t FOR UPDATE;
  IF NOT FOUND OR v.permit_owner IS DISTINCT FROM w OR w IS NULL THEN RAISE EXCEPTION 'No execution permit'; END IF;
  IF result IS NULL OR jsonb_typeof(result) IS DISTINCT FROM 'object' OR octet_length(result::text)>2097152 OR result->'metadata' ? 'drain'
    OR result->'metadata'->>'runtime_digest' IS DISTINCT FROM v.envelope->>'runtime_digest'
    OR result->'metadata'->>'source_sha256' IS DISTINCT FROM encode(sha256(decode(v.envelope->>'source_b64','base64')),'hex')
    OR result->'metadata'->>'stdin_sha256' IS DISTINCT FROM encode(sha256(decode(v.envelope->>'stdin_b64','base64')),'hex') THEN RAISE EXCEPTION 'Invalid result'; END IF;
  IF v.evidence IS NOT NULL AND v.evidence IS DISTINCT FROM result THEN RAISE EXCEPTION 'Sealed evidence cannot change'; END IF;
  IF proof IS NOT NULL AND (jsonb_typeof(proof)<>'object' OR (SELECT count(*) FROM jsonb_object_keys(proof))<>4 OR proof->'cannot_start' IS DISTINCT FROM 'true'::jsonb
    OR proof->'processes_stopped' IS DISTINCT FROM 'true'::jsonb OR proof->'workspace_removed' IS DISTINCT FROM 'true'::jsonb
    OR jsonb_typeof(proof->'proof_digest') IS DISTINCT FROM 'string' OR proof->>'proof_digest' !~ '^[0-9a-f]{64}$') THEN RAISE EXCEPTION 'Invalid drain proof'; END IF;
  IF v.drain IS NOT NULL AND proof IS DISTINCT FROM v.drain THEN RAISE EXCEPTION 'Drain proof cannot change'; END IF;
  amount=octet_length(v.envelope::text)::bigint+octet_length(result::text)+8192;
  UPDATE ingenium_judge.attempts SET evidence=result,sealed_at=coalesce(sealed_at,clock_timestamp()),drain=proof,accounted_bytes=amount WHERE attempt_id=a;
  UPDATE ingenium_judge.control SET retained_bytes=retained_bytes+amount-v.accounted_bytes WHERE id=1;
END $$;
CREATE FUNCTION ingenium_judge.deliveries(e uuid,b uuid) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog AS $$
  SELECT coalesce(jsonb_agg(row_to_json(q)), '[]'::jsonb) FROM (
    SELECT a.attempt_id,a.provider_token FROM ingenium_judge.outbox o JOIN ingenium_judge.attempts a USING(attempt_id) JOIN ingenium_judge.control c ON c.epoch=a.epoch
    WHERE c.epoch=e AND c.boot_id=b AND c.state='ACTIVE' AND c.ready_until>clock_timestamp() AND o.published_at IS NULL ORDER BY a.created_at,a.attempt_id LIMIT 16) q
$$;
CREATE FUNCTION ingenium_judge.published(e uuid,b uuid,a uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
  PERFORM id FROM ingenium_judge.control WHERE id=1 AND epoch=e AND boot_id=b FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Wrong host'; END IF;
  UPDATE ingenium_judge.outbox SET published_at=coalesce(published_at,clock_timestamp()) WHERE attempt_id=a AND EXISTS(SELECT FROM ingenium_judge.attempts WHERE attempt_id=a AND epoch=e);
END $$;
REVOKE ALL ON ALL TABLES IN SCHEMA ingenium_judge FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA ingenium_judge FROM PUBLIC;
GRANT USAGE ON SCHEMA ingenium_judge TO ingenium_judge_gateway,ingenium_judge_supervisor;
GRANT EXECUTE ON FUNCTION ingenium_judge.readiness(uuid,uuid),ingenium_judge.admit(uuid,uuid,jsonb),ingenium_judge.observe(uuid,uuid,uuid,bytea) TO ingenium_judge_gateway;
GRANT EXECUTE ON FUNCTION ingenium_judge.heartbeat(uuid,uuid,bytea),ingenium_judge.claim(uuid,uuid,uuid,uuid,uuid),ingenium_judge.seal(uuid,uuid,uuid,uuid,uuid,jsonb,jsonb),
  ingenium_judge.deliveries(uuid,uuid),ingenium_judge.published(uuid,uuid,uuid),ingenium_judge.observe(uuid,uuid,uuid,bytea) TO ingenium_judge_supervisor;
COMMIT;
