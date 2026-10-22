-- Add explicit participant provenance without changing historical authoring digests or accepted bytes.
CREATE OR REPLACE FUNCTION ingenium_judge.validate_payload(p jsonb,e uuid) RETURNS void
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
  IF p->>'protocol'<>'ingenium-authoring-v1' OR (p->>'host_epoch_id')::uuid<>e OR p->>'source_role' NOT IN ('REFERENCE','STARTER','OFFICIAL','SAMPLE')
    OR p->>'check_type' NOT IN ('TEST_CASE','COMPILATION') OR (p->>'source_role' IN ('OFFICIAL','SAMPLE') AND p->>'check_type'<>'TEST_CASE')
    OR p->'number_of_runs' IS DISTINCT FROM '1'::jsonb OR p->'enable_network' IS DISTINCT FROM 'false'::jsonb
    OR p->>'payload_digest' !~ '^[0-9a-f]{64}$' OR NOT EXISTS(SELECT FROM ingenium_judge.runtimes r WHERE r.language=p->>'language' AND r.runtime_key=p->>'runtime_key' AND r.runtime_digest=p->>'runtime_digest') THEN RAISE EXCEPTION 'Invalid frozen binding'; END IF;
  FOREACH k IN ARRAY ARRAY['cpu_ms','wall_ms','memory_kb'] LOOP
    IF jsonb_typeof(p->k) IS DISTINCT FROM 'number' OR p->>k !~ '^[1-9][0-9]{0,6}$' THEN RAISE EXCEPTION 'Invalid limits'; END IF;
  END LOOP;
  compiled=p->>'language' IN ('c','cpp'); cpu=(p->>'cpu_ms')::integer; wall=(p->>'wall_ms')::integer; memory=(p->>'memory_kb')::integer;
  IF cpu>(CASE WHEN compiled THEN 2000 ELSE 4000 END) OR wall<cpu OR wall>(CASE WHEN compiled THEN 10000 ELSE 15000 END) OR memory>524288 THEN RAISE EXCEPTION 'Unsupported limits'; END IF;
  source=decode(p->>'source_b64','base64'); input=decode(p->>'stdin_b64','base64');
  IF octet_length(source)>131072 OR octet_length(input)>1048576 OR replace(encode(source,'base64'),E'\n','')<>p->>'source_b64' OR replace(encode(input,'base64'),E'\n','')<>p->>'stdin_b64'
    OR (p->>'check_type'='COMPILATION' AND (p->>'language' NOT IN ('c','cpp','java') OR octet_length(input)<>0))
    OR ingenium_judge.payload_digest(p)<>decode(p->>'payload_digest','hex') THEN RAISE EXCEPTION 'Payload bytes or digest differ'; END IF;
END $$;
