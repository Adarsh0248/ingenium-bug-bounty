ALTER TABLE "bug_versions" ADD COLUMN "category" text;--> statement-breakpoint
ALTER TABLE "bug_versions" ADD CONSTRAINT "bug_category" CHECK ("bug_versions"."category" in ('ARRAYS','GRAPHS','SYSTEMS','LOGIC'));
--> statement-breakpoint
CREATE OR REPLACE FUNCTION content_edit_status(kind text,subject uuid,p jsonb) RETURNS text LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE v public.bug_versions%ROWTYPE; variant public.language_variants%ROWTYPE; c public.test_cases%ROWTYPE; current_payload jsonb; ids uuid[];
BEGIN
  SELECT * INTO v FROM public.bug_versions WHERE id=subject;
  IF NOT FOUND OR v.publication_status<>'DRAFT' THEN RETURN 'CONTENT_LOCKED'; END IF;
  IF kind='METADATA' THEN
    IF ROW(v.title,v.statement,v.difficulty,v.checker_mode,v.category) IS NOT DISTINCT FROM ROW(p->>'title',p->>'statement',(p->>'difficulty')::integer,p->>'checker_mode',CASE WHEN p?'category' THEN p->>'category' ELSE v.category END) THEN RETURN 'UNCHANGED'; END IF;
  ELSIF kind='VARIANT' THEN
    SELECT * INTO variant FROM public.language_variants WHERE version_id=subject AND language=p->>'language';
    IF FOUND AND ROW(variant.starter_code,variant.reference_code,variant.defect_description,variant.runtime_key,variant.cpu_ms,variant.wall_ms,variant.memory_kb)
      IS NOT DISTINCT FROM ROW(decode(p->>'starter_b64','base64'),decode(p->>'reference_b64','base64'),p->>'defect_description',p->>'runtime_key',
        (p->>'cpu_time_limit_ms')::integer,(p->>'wall_time_limit_ms')::integer,(p->>'memory_limit_kb')::integer) THEN RETURN 'UNCHANGED'; END IF;
  ELSIF kind IN ('CASE','DELETE_CASE') THEN
    SELECT * INTO c FROM public.test_cases WHERE id=(p->>'case_id')::uuid AND version_id=subject AND removed_at IS NULL;
    IF p->>'case_id' IS NOT NULL AND c.id IS NULL THEN RETURN 'CASE_UNAVAILABLE'; END IF;
    IF kind='DELETE_CASE' THEN
      IF EXISTS(SELECT 1 FROM public.failure_witnesses WHERE test_case_id=c.id) THEN RETURN 'REFERENCED_CASE'; END IF;
    ELSE
      IF EXISTS(SELECT 1 FROM public.test_cases WHERE version_id=subject AND removed_at IS NULL AND position=(p->>'position')::integer AND id IS DISTINCT FROM c.id) THEN RETURN 'POSITION_OCCUPIED'; END IF;
      IF c.id IS NOT NULL AND ROW(c.position,c.visibility,c.input_data,c.expected_output) IS NOT DISTINCT FROM
        ROW((p->>'position')::integer,p->>'visibility',decode(p->>'input_b64','base64'),decode(p->>'expected_b64','base64')) THEN RETURN 'UNCHANGED'; END IF;
    END IF;
  ELSIF kind='HINT' THEN
    IF EXISTS(SELECT 1 FROM public.bug_hints WHERE version_id=subject AND level=(p->>'level')::integer AND content=p->>'content') THEN RETURN 'UNCHANGED'; END IF;
  ELSIF kind='WITNESSES' THEN
    SELECT * INTO variant FROM public.language_variants WHERE version_id=subject AND language=p->>'language';
    IF NOT FOUND THEN RETURN 'VARIANT_MISSING'; END IF;
    IF EXISTS(SELECT 1 FROM jsonb_array_elements(p->'witnesses') w WHERE w->>'check_type'='TEST_CASE' AND NOT EXISTS(
      SELECT 1 FROM public.test_cases WHERE id=(w->>'test_case_id')::uuid AND version_id=subject AND removed_at IS NULL)) THEN RETURN 'CASE_UNAVAILABLE'; END IF;
    SELECT COALESCE(jsonb_agg(jsonb_build_object('check_type',check_type,'test_case_id',test_case_id,'expected_failure',expected_failure) ORDER BY position),'[]'::jsonb)
      INTO current_payload FROM public.failure_witnesses WHERE variant_id=variant.id;
    IF current_payload=p->'witnesses' THEN RETURN 'UNCHANGED'; END IF;
  ELSIF kind='REORDER_CASES' THEN
    SELECT COALESCE(array_agg(value::uuid ORDER BY ordinal),'{}'::uuid[]) INTO ids FROM jsonb_array_elements_text(p->'case_ids') WITH ORDINALITY a(value,ordinal);
    IF cardinality(ids)<>(SELECT count(*) FROM public.test_cases WHERE version_id=subject AND removed_at IS NULL)
      OR cardinality(ids)<>(SELECT count(DISTINCT item) FROM unnest(ids) item)
      OR EXISTS(SELECT 1 FROM unnest(ids) wanted(case_id) WHERE NOT EXISTS(SELECT 1 FROM public.test_cases tc WHERE tc.id=wanted.case_id AND tc.version_id=subject AND tc.removed_at IS NULL)) THEN RETURN 'INVALID_ORDER'; END IF;
    IF NOT EXISTS(SELECT 1 FROM public.test_cases tc WHERE tc.version_id=subject AND tc.removed_at IS NULL AND tc.position<>array_position(ids,tc.id)) THEN RETURN 'UNCHANGED'; END IF;
  ELSE RAISE EXCEPTION 'Unsupported content operation'; END IF;
  RETURN 'APPLIED';
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION apply_content_edit(source_id uuid,payload text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE s public.content_outcomes%ROWTYPE; gate public.catalogue_control%ROWTYPE; definition public.bug_definitions%ROWTYPE; v public.bug_versions%ROWTYPE;
  p jsonb; chosen_variant uuid; n integer; old_bytes bigint; new_bytes bigint;
BEGIN
  SELECT * INTO gate FROM public.lock_catalogue();
  SELECT * INTO s FROM public.content_outcomes WHERE id=source_id;
  IF NOT FOUND OR s.outcome<>'APPLIED' OR s.payload_digest<>sha256(convert_to(payload,'UTF8')) THEN RAISE EXCEPTION 'Matching applied content source required'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.staff_sessions x JOIN public.staff_session_slots slot ON slot.staff_id=x.staff_id AND slot.session_id=x.id
    JOIN public.staff_identities i ON i.id=x.staff_id JOIN public.access_credentials c ON c.id=x.credential_id AND c.version=x.credential_version AND c.staff_id=x.staff_id
    WHERE x.id=s.session_id AND x.staff_id=s.actor_id AND x.credential_id=s.credential_id AND x.credential_version=s.credential_version
      AND x.mode='NORMAL' AND x.revoked_at IS NULL AND i.role IN ('OWNER','SUPER_ADMIN') AND i.disabled_at IS NULL AND c.revoked_at IS NULL
      AND clock_timestamp()<x.absolute_expires_at AND clock_timestamp()<x.last_activity_at+interval '15 minutes') THEN RAISE EXCEPTION 'Authoring authority changed'; END IF;
  p=payload::jsonb;
  IF s.action='CREATE' THEN
    IF s.expected_revision<>gate.revision OR (SELECT count(*) FROM public.bug_definitions)>=250 THEN RAISE EXCEPTION USING ERRCODE='54000',MESSAGE='Catalogue capacity or revision unavailable'; END IF;
    INSERT INTO public.bug_definitions(id,round_type,created_by,created_at,revision) VALUES(s.result_definition_id,(p->>'round_type')::integer,s.actor_id,s.recorded_at,1);
  ELSIF s.action='NEW_VERSION' THEN
    SELECT * INTO definition FROM public.bug_definitions WHERE id=s.definition_id FOR UPDATE;
    IF NOT FOUND OR definition.revision<>s.expected_revision OR s.result_definition_id<>definition.id THEN RAISE EXCEPTION 'Definition revision changed'; END IF;
    UPDATE public.bug_definitions SET revision=revision+1 WHERE id=definition.id;
  ELSE
    SELECT * INTO v FROM public.bug_versions WHERE id=s.version_id FOR UPDATE;
    IF NOT FOUND OR v.content_revision<>s.expected_revision OR v.publication_status<>'DRAFT' OR s.result_definition_id<>v.definition_id
      OR s.result_version_id<>v.id OR public.content_edit_status(s.action,v.id,p)<>'APPLIED' THEN RAISE EXCEPTION 'Content effect is stale, unavailable or unchanged'; END IF;
  END IF;
  IF s.action IN ('CREATE','NEW_VERSION') THEN
    IF (SELECT count(*) FROM public.bug_versions)>=1000 THEN RAISE EXCEPTION USING ERRCODE='54000',MESSAGE='Catalogue version capacity unavailable'; END IF;
    SELECT COALESCE(max(version_number),0)+1 INTO n FROM public.bug_versions WHERE definition_id=s.result_definition_id;
    INSERT INTO public.bug_versions(id,definition_id,version_number,title,statement,difficulty,base_bounty,publication_status,created_by,created_at,
      submission_format,checker_mode,checker_version,content_revision,content_bytes,last_source_id,category)
      VALUES(s.result_version_id,s.result_definition_id,n,p->>'title',p->>'statement',(p->>'difficulty')::integer,(p->>'difficulty')::integer*10,'DRAFT',s.actor_id,s.recorded_at,
        'FULL_PROGRAM',p->>'checker_mode','ingenium-text-v1',1,4096,s.id,p->>'category');
    old_bytes=0;
  ELSE
    old_bytes=v.content_bytes;
    UPDATE public.bug_versions SET content_revision=s.result_revision,last_source_id=s.id WHERE id=v.id;
    IF s.action='METADATA' THEN
      UPDATE public.bug_versions SET title=p->>'title',statement=p->>'statement',difficulty=(p->>'difficulty')::integer,
        base_bounty=(p->>'difficulty')::integer*10,checker_mode=p->>'checker_mode',category=CASE WHEN p?'category' THEN p->>'category' ELSE v.category END WHERE id=v.id;
    ELSIF s.action='VARIANT' THEN
      INSERT INTO public.language_variants(id,version_id,language,starter_code,reference_code,defect_description,runtime_key,cpu_ms,wall_ms,memory_kb)
        VALUES(gen_random_uuid(),v.id,p->>'language',decode(p->>'starter_b64','base64'),decode(p->>'reference_b64','base64'),p->>'defect_description',p->>'runtime_key',
          (p->>'cpu_time_limit_ms')::integer,(p->>'wall_time_limit_ms')::integer,(p->>'memory_limit_kb')::integer)
        ON CONFLICT(version_id,language) DO UPDATE SET starter_code=EXCLUDED.starter_code,reference_code=EXCLUDED.reference_code,defect_description=EXCLUDED.defect_description,
          runtime_key=EXCLUDED.runtime_key,cpu_ms=EXCLUDED.cpu_ms,wall_ms=EXCLUDED.wall_ms,memory_kb=EXCLUDED.memory_kb;
    ELSIF s.action='CASE' THEN
      IF p->>'case_id' IS NULL THEN
        INSERT INTO public.test_cases(id,version_id,position,visibility,input_data,expected_output)
          VALUES(s.result_case_id,v.id,(p->>'position')::integer,p->>'visibility',decode(p->>'input_b64','base64'),decode(p->>'expected_b64','base64'));
      ELSE
        IF s.result_case_id IS DISTINCT FROM (p->>'case_id')::uuid THEN RAISE EXCEPTION 'Case identity mismatch'; END IF;
        UPDATE public.test_cases SET position=(p->>'position')::integer,visibility=p->>'visibility',input_data=decode(p->>'input_b64','base64'),expected_output=decode(p->>'expected_b64','base64') WHERE id=s.result_case_id AND version_id=v.id AND removed_at IS NULL;
      END IF;
    ELSIF s.action='DELETE_CASE' THEN
      UPDATE public.test_cases SET removed_at=s.recorded_at WHERE id=(p->>'case_id')::uuid AND version_id=v.id AND removed_at IS NULL;
    ELSIF s.action='HINT' THEN
      INSERT INTO public.bug_hints(version_id,level,content) VALUES(v.id,(p->>'level')::integer,p->>'content') ON CONFLICT(version_id,level) DO UPDATE SET content=EXCLUDED.content;
    ELSIF s.action='WITNESSES' THEN
      SELECT id INTO chosen_variant FROM public.language_variants WHERE version_id=v.id AND language=p->>'language';
      DELETE FROM public.failure_witnesses WHERE variant_id=chosen_variant;
      INSERT INTO public.failure_witnesses(variant_id,version_id,position,check_type,test_case_id,expected_failure)
        SELECT chosen_variant,v.id,ordinal::integer,w->>'check_type',(w->>'test_case_id')::uuid,w->>'expected_failure' FROM jsonb_array_elements(p->'witnesses') WITH ORDINALITY a(w,ordinal);
    ELSIF s.action='REORDER_CASES' THEN
      UPDATE public.test_cases SET position=position+20 WHERE version_id=v.id AND removed_at IS NULL;
      UPDATE public.test_cases SET position=ordinal::integer FROM jsonb_array_elements_text(p->'case_ids') WITH ORDINALITY a(value,ordinal)
        WHERE id=value::uuid AND version_id=v.id AND removed_at IS NULL;
    END IF;
  END IF;
  SELECT public.content_version_bytes(s.result_version_id) INTO new_bytes;
  IF gate.committed_bytes-old_bytes+new_bytes>3221225472 THEN RAISE EXCEPTION USING ERRCODE='54000',MESSAGE='Catalogue byte capacity unavailable'; END IF;
  UPDATE public.bug_versions SET content_bytes=new_bytes WHERE id=s.result_version_id;
  UPDATE public.catalogue_control SET committed_bytes=committed_bytes-old_bytes+new_bytes,revision=revision+1 WHERE id=1;
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION validation_configuration_manifest(subject uuid,frozen boolean) RETURNS jsonb LANGUAGE sql STABLE SET search_path=pg_catalog,public AS $$
  WITH version AS (
    SELECT v.id,v.definition_id,v.version_number,v.content_revision,d.round_type,v.title,v.statement,v.difficulty,v.base_bounty,v.submission_format,v.checker_mode,v.checker_version,v.category
      FROM public.bug_versions v JOIN public.bug_definitions d ON d.id=v.definition_id WHERE NOT frozen AND v.id=subject
    UNION ALL
    SELECT version_id,definition_id,version_number,content_revision,round_type,title,statement,difficulty,base_bounty,submission_format,checker_mode,checker_version,manifest_text::jsonb#>>'{version,category}'
      FROM public.validation_snapshots WHERE frozen AND id=subject
  ), variants AS (
    SELECT id,language,starter_code,reference_code,defect_description,runtime_key,cpu_ms,wall_ms,memory_kb FROM public.language_variants WHERE NOT frozen AND version_id=subject
    UNION ALL
    SELECT variant_id,language,starter_code,reference_code,defect_description,runtime_key,cpu_ms,wall_ms,memory_kb FROM public.validation_snapshot_variants WHERE frozen AND snapshot_id=subject
  ), cases AS (
    SELECT id,position,visibility,input_data,expected_output FROM public.test_cases WHERE NOT frozen AND version_id=subject AND removed_at IS NULL
    UNION ALL SELECT case_id,position,visibility,input_data,expected_output FROM public.validation_snapshot_cases WHERE frozen AND snapshot_id=subject
  ), hints AS (
    SELECT id,level,content FROM public.bug_hints WHERE NOT frozen AND version_id=subject
    UNION ALL SELECT hint_id,level,content FROM public.validation_snapshot_hints WHERE frozen AND snapshot_id=subject
  ), witnesses AS (
    SELECT variant_id,position,check_type,test_case_id,expected_failure FROM public.failure_witnesses WHERE NOT frozen AND version_id=subject
    UNION ALL SELECT variant_id,position,check_type,case_id,expected_result FROM public.validation_snapshot_witnesses WHERE frozen AND snapshot_id=subject
  )
  SELECT jsonb_build_object('schema_version',1,'version',jsonb_build_object('id',id,'definition_id',definition_id,'version_number',version_number,
    'content_revision',content_revision::text,'round_type',round_type,'title_sha256',encode(sha256(convert_to(title,'UTF8')),'hex'),
    'title_bytes',octet_length(title),'statement_sha256',encode(sha256(convert_to(statement,'UTF8')),'hex'),'statement_bytes',octet_length(statement),
    'difficulty',difficulty,'base_bounty',base_bounty,'submission_format',submission_format,'checker_mode',checker_mode,'checker_version',checker_version)||CASE WHEN category IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('category',category) END,
    'variants',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',v.id,'language',v.language,'starter_sha256',encode(sha256(starter_code),'hex'),
      'starter_bytes',octet_length(starter_code),'reference_sha256',encode(sha256(reference_code),'hex'),'reference_bytes',octet_length(reference_code),
      'description_sha256',encode(sha256(convert_to(defect_description,'UTF8')),'hex'),'description_bytes',octet_length(defect_description),
      'runtime_key',runtime_key,'runtime_digest',encode(r.digest,'hex'),'cpu_ms',cpu_ms,'wall_ms',wall_ms,'memory_kb',memory_kb) ORDER BY v.language COLLATE "C")
      FROM variants v LEFT JOIN public.runtime_manifests r ON r.key=v.runtime_key AND r.language=v.language),'[]'::jsonb),
    'cases',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',id,'position',position,'visibility',visibility,'input_sha256',encode(sha256(input_data),'hex'),
      'input_bytes',octet_length(input_data),'expected_sha256',encode(sha256(expected_output),'hex'),'expected_bytes',octet_length(expected_output)) ORDER BY position) FROM cases),'[]'::jsonb),
    'hints',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',id,'level',level,'content_sha256',encode(sha256(convert_to(content,'UTF8')),'hex'),
      'content_bytes',octet_length(content)) ORDER BY level) FROM hints),'[]'::jsonb),
    'witnesses',COALESCE((SELECT jsonb_agg(jsonb_build_object('variant_id',variant_id,'position',position,'check_type',check_type,
      'case_id',test_case_id,'expected_result',expected_failure) ORDER BY variant_id,position) FROM witnesses),'[]'::jsonb)) FROM version;
$$;
--> statement-breakpoint
-- Opening a question is a durable team capture; only that team's stream is invalidated.
CREATE FUNCTION live_bug_captured() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE effect uuid; team uuid; stage uuid; streams uuid[];
BEGIN
  SELECT team_round_id,round_id INTO team,stage FROM public.member_rounds WHERE id=NEW.member_round_id;
  IF EXISTS(SELECT 1 FROM public.workbench_activities w JOIN public.member_rounds m ON m.id=w.member_round_id
    WHERE w.bounty_id=NEW.bounty_id AND m.team_round_id=team AND w.request_key IS NOT NULL AND w.id<>NEW.id) THEN RETURN NEW; END IF;
  INSERT INTO public.live_effects(round_id) VALUES(stage) RETURNING id INTO effect;
  SELECT array_agg(id) INTO streams FROM public.live_streams WHERE kind='TEAM' AND team_round_id=team;
  PERFORM public.live_emit(effect,streams,jsonb_build_object('type','INVALIDATE','projection','capture','bounty_id',NEW.bounty_id));
  RETURN NEW;
END $$;
CREATE TRIGGER live_bug_captured AFTER INSERT ON workbench_activities FOR EACH ROW WHEN(NEW.request_key IS NOT NULL) EXECUTE FUNCTION live_bug_captured();
REVOKE ALL ON FUNCTION live_bug_captured() FROM PUBLIC,ingenium_api,ingenium_competition_worker;

--> statement-breakpoint
CREATE OR REPLACE FUNCTION workbench_open(sid uuid,stage uuid,target uuid,request uuid) RETURNS workbench_activities
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE s participant_sessions%ROWTYPE; r rounds%ROWTYPE; a workbench_activities%ROWTYPE; n timestamptz;
BEGIN
  s:=workbench_authority(sid,stage,target);IF request IS NULL THEN RAISE EXCEPTION 'Invalid open request' USING ERRCODE='22023'; END IF;
  SELECT * INTO a FROM workbench_activities WHERE member_round_id=s.member_round_id AND bounty_id=target AND request_key=request;
  IF FOUND THEN RETURN a; END IF;
  n:=competition_now(stage);PERFORM competition_close_due(stage,n);SELECT * INTO r FROM rounds WHERE id=stage;
  IF r.started_at IS NULL OR r.state IN ('DRAFT','READY') THEN RAISE EXCEPTION 'Challenge not available' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS(SELECT 1 FROM workbench_activities w JOIN member_rounds m ON m.id=w.member_round_id
    WHERE w.bounty_id=target AND w.request_key IS NOT NULL AND m.team_round_id=(SELECT team_round_id FROM member_rounds WHERE id=s.member_round_id))
    AND (r.state<>'RUNNING' OR n>=r.closes_at OR competition_paused(stage,(SELECT team_round_id FROM member_rounds WHERE id=s.member_round_id),s.member_round_id))
    THEN RAISE EXCEPTION 'Capture actions are paused or closed' USING ERRCODE='42501'; END IF;
  INSERT INTO workbench_activities(session_id,member_round_id,bounty_id,request_key,recorded_at) VALUES(sid,s.member_round_id,target,request,n) RETURNING * INTO a;
  UPDATE participant_sessions SET last_activity_at=n WHERE id=sid;
  RETURN a;
END $$;