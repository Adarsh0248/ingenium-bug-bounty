-- Custom SQL migration file, put your code below! --
INSERT INTO catalogue_control(id) VALUES(1);
ALTER TABLE bug_versions ALTER CONSTRAINT bug_versions_last_source_id_content_outcomes_id_fk DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE content_outcomes ALTER CONSTRAINT content_result_version DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE content_outcomes ALTER CONSTRAINT content_result_case DEFERRABLE INITIALLY DEFERRED;
CREATE TRIGGER content_outcome_immutable BEFORE UPDATE OR DELETE ON content_outcomes FOR EACH ROW EXECUTE FUNCTION immutable_access_history();
CREATE TRIGGER content_read_immutable BEFORE UPDATE OR DELETE ON content_read_audits FOR EACH ROW EXECUTE FUNCTION immutable_access_history();
CREATE TRIGGER runtime_manifest_immutable BEFORE UPDATE OR DELETE ON runtime_manifests FOR EACH ROW EXECUTE FUNCTION immutable_access_history();
--> statement-breakpoint
CREATE FUNCTION lock_catalogue() RETURNS SETOF public.catalogue_control LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  PERFORM id FROM public.security_control WHERE id=1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Security anchor is missing'; END IF;
  RETURN QUERY SELECT * FROM public.catalogue_control WHERE id=1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Catalogue anchor is missing'; END IF;
END;
$$;
CREATE FUNCTION content_version_bytes(subject uuid) RETURNS bigint LANGUAGE sql STABLE SET search_path=pg_catalog,public AS $$
  SELECT 4096+octet_length(v.title)+octet_length(v.statement)+
    COALESCE((SELECT sum(octet_length(starter_code)+octet_length(reference_code)+octet_length(defect_description)+COALESCE(octet_length(runtime_key),0)+256) FROM public.language_variants WHERE version_id=v.id),0)+
    COALESCE((SELECT sum(octet_length(input_data)+octet_length(expected_output)+256) FROM public.test_cases WHERE version_id=v.id),0)+
    COALESCE((SELECT sum(octet_length(content)+128) FROM public.bug_hints WHERE version_id=v.id),0)+
    COALESCE((SELECT count(*)*256 FROM public.failure_witnesses WHERE version_id=v.id),0)
  FROM public.bug_versions v WHERE v.id=subject;
$$;
CREATE FUNCTION validate_content_authority() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.staff_sessions s JOIN public.staff_session_slots x ON x.staff_id=s.staff_id AND x.session_id=s.id
    JOIN public.staff_identities i ON i.id=s.staff_id JOIN public.access_credentials c ON c.id=s.credential_id AND c.staff_id=s.staff_id AND c.version=s.credential_version
    WHERE s.id=NEW.session_id AND s.staff_id=NEW.actor_id AND s.mode='NORMAL' AND s.revoked_at IS NULL AND i.role IN ('OWNER','SUPER_ADMIN')
      AND i.disabled_at IS NULL AND c.revoked_at IS NULL AND c.issued_at<=NEW.recorded_at AND s.created_at<=NEW.recorded_at
      AND s.last_activity_at<=NEW.recorded_at AND NEW.recorded_at<s.absolute_expires_at AND NEW.recorded_at<s.last_activity_at+interval '15 minutes'
      AND (TG_TABLE_NAME='content_read_audits' OR (c.id=(to_jsonb(NEW)->>'credential_id')::uuid AND c.version=(to_jsonb(NEW)->>'credential_version')::bigint))) THEN
    RAISE EXCEPTION 'Current private-authoring authority required'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER content_outcome_authority BEFORE INSERT ON content_outcomes FOR EACH ROW EXECUTE FUNCTION validate_content_authority();
CREATE TRIGGER content_read_authority BEFORE INSERT ON content_read_audits FOR EACH ROW EXECUTE FUNCTION validate_content_authority();
--> statement-breakpoint
CREATE FUNCTION content_edit_status(kind text,subject uuid,p jsonb) RETURNS text LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE v public.bug_versions%ROWTYPE; variant public.language_variants%ROWTYPE; c public.test_cases%ROWTYPE; current_payload jsonb; ids uuid[];
BEGIN
  SELECT * INTO v FROM public.bug_versions WHERE id=subject;
  IF NOT FOUND OR v.publication_status<>'DRAFT' THEN RETURN 'CONTENT_LOCKED'; END IF;
  IF kind='METADATA' THEN
    IF ROW(v.title,v.statement,v.difficulty,v.checker_mode) IS NOT DISTINCT FROM ROW(p->>'title',p->>'statement',(p->>'difficulty')::integer,p->>'checker_mode') THEN RETURN 'UNCHANGED'; END IF;
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
CREATE FUNCTION apply_content_edit(source_id uuid,payload text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
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
      submission_format,checker_mode,checker_version,content_revision,content_bytes,last_source_id)
      VALUES(s.result_version_id,s.result_definition_id,n,p->>'title',p->>'statement',(p->>'difficulty')::integer,(p->>'difficulty')::integer*10,'DRAFT',s.actor_id,s.recorded_at,
        'FULL_PROGRAM',p->>'checker_mode','ingenium-text-v1',1,4096,s.id);
    old_bytes=0;
  ELSE
    old_bytes=v.content_bytes;
    UPDATE public.bug_versions SET content_revision=s.result_revision,last_source_id=s.id WHERE id=v.id;
    IF s.action='METADATA' THEN
      UPDATE public.bug_versions SET title=p->>'title',statement=p->>'statement',difficulty=(p->>'difficulty')::integer,
        base_bounty=(p->>'difficulty')::integer*10,checker_mode=p->>'checker_mode' WHERE id=v.id;
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
CREATE FUNCTION guard_draft_version() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE source public.content_outcomes%ROWTYPE;
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Version history cannot be deleted'; END IF;
  IF NEW.publication_status<>'DRAFT' THEN RAISE EXCEPTION 'Publication requires the not-yet-enabled validation/review gate'; END IF;
  IF TG_OP='UPDATE' THEN
    IF OLD.publication_status<>'DRAFT' OR ROW(NEW.id,NEW.definition_id,NEW.version_number,NEW.created_by,NEW.created_at,NEW.submission_format,NEW.checker_version)
      IS DISTINCT FROM ROW(OLD.id,OLD.definition_id,OLD.version_number,OLD.created_by,OLD.created_at,OLD.submission_format,OLD.checker_version) THEN RAISE EXCEPTION 'Version identity/publication is immutable'; END IF;
  END IF;
  SELECT * INTO source FROM public.content_outcomes WHERE id=NEW.last_source_id AND outcome='APPLIED' AND result_version_id=NEW.id AND result_definition_id=NEW.definition_id
    AND result_revision=NEW.content_revision AND xmin::text::bigint=(pg_current_xact_id()::text::bigint & 4294967295);
  IF NOT FOUND THEN RAISE EXCEPTION 'Draft requires its current transaction source'; END IF;
  IF TG_OP='INSERT' THEN
    IF source.action NOT IN ('CREATE','NEW_VERSION') OR NEW.content_revision<>1 THEN RAISE EXCEPTION 'New version source required'; END IF;
  ELSIF NEW.content_revision<>OLD.content_revision THEN
    IF NEW.content_revision<>OLD.content_revision+1 OR source.version_id<>OLD.id OR source.expected_revision<>OLD.content_revision THEN RAISE EXCEPTION 'Content revision must advance once'; END IF;
  ELSIF NEW.last_source_id<>OLD.last_source_id THEN RAISE EXCEPTION 'Content source cannot change without a new revision'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER draft_version_guard BEFORE INSERT OR UPDATE OR DELETE ON bug_versions FOR EACH ROW EXECUTE FUNCTION guard_draft_version();
CREATE FUNCTION guard_draft_child() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE subject uuid;
BEGIN
  IF TG_OP='DELETE' THEN subject=OLD.version_id; ELSE subject=NEW.version_id; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.bug_versions v JOIN public.content_outcomes o ON o.id=v.last_source_id WHERE v.id=subject AND v.publication_status='DRAFT'
    AND o.outcome='APPLIED' AND o.result_version_id=v.id AND o.result_revision=v.content_revision
    AND o.xmin::text::bigint=(pg_current_xact_id()::text::bigint & 4294967295)) THEN RAISE EXCEPTION 'Child edit requires its locked current draft source'; END IF;
  IF TG_OP='UPDATE' AND NEW.version_id<>OLD.version_id THEN RAISE EXCEPTION 'Child cannot move between versions'; END IF;
  IF TG_TABLE_NAME='test_cases' THEN
    IF TG_OP='UPDATE' AND OLD.removed_at IS NOT NULL THEN RAISE EXCEPTION 'Retired case cannot be edited or restored'; END IF;
  END IF;
  IF TG_TABLE_NAME='failure_witnesses' AND TG_OP<>'DELETE' THEN
    IF NEW.check_type='COMPILATION' AND NOT EXISTS(SELECT 1 FROM public.language_variants WHERE id=NEW.variant_id AND language IN ('c','cpp','java')) THEN RAISE EXCEPTION 'Interpreter compilation witness is unsupported'; END IF;
    IF NEW.test_case_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.test_cases WHERE id=NEW.test_case_id AND version_id=subject AND removed_at IS NULL) THEN RAISE EXCEPTION 'Witness case is not active in this version'; END IF;
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER draft_variant_guard BEFORE INSERT OR UPDATE OR DELETE ON language_variants FOR EACH ROW EXECUTE FUNCTION guard_draft_child();
CREATE TRIGGER draft_case_guard BEFORE INSERT OR UPDATE OR DELETE ON test_cases FOR EACH ROW EXECUTE FUNCTION guard_draft_child();
CREATE TRIGGER draft_hint_guard BEFORE INSERT OR UPDATE OR DELETE ON bug_hints FOR EACH ROW EXECUTE FUNCTION guard_draft_child();
CREATE TRIGGER draft_witness_guard BEFORE INSERT OR UPDATE OR DELETE ON failure_witnesses FOR EACH ROW EXECUTE FUNCTION guard_draft_child();
--> statement-breakpoint
CREATE FUNCTION validate_content_effect() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE v public.bug_versions%ROWTYPE;
BEGIN
  IF NEW.outcome='REJECTED' THEN RETURN NULL; END IF;
  SELECT * INTO v FROM public.bug_versions WHERE id=NEW.result_version_id;
  IF NOT FOUND OR v.definition_id<>NEW.result_definition_id OR v.content_revision<>NEW.result_revision OR v.publication_status<>'DRAFT'
    OR (NEW.outcome='APPLIED' AND v.last_source_id<>NEW.id) THEN RAISE EXCEPTION 'Content receipt requires its exact committed version effect'; END IF;
  IF NEW.action='CREATE' AND NOT EXISTS(SELECT 1 FROM public.bug_definitions WHERE id=v.definition_id AND created_by=NEW.actor_id AND created_at=NEW.recorded_at AND revision=1) THEN RAISE EXCEPTION 'Creation source is incomplete'; END IF;
  IF NEW.action='NEW_VERSION' AND (NEW.definition_id<>v.definition_id OR NOT EXISTS(SELECT 1 FROM public.bug_definitions WHERE id=v.definition_id AND revision=NEW.expected_revision+1)) THEN RAISE EXCEPTION 'Version allocation source is incomplete'; END IF;
  IF NEW.action='CASE' AND (NEW.result_case_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.test_cases WHERE id=NEW.result_case_id AND version_id=v.id AND removed_at IS NULL)) THEN RAISE EXCEPTION 'Case source is incomplete'; END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER content_effect AFTER INSERT ON content_outcomes DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_content_effect();
CREATE FUNCTION validate_content_budget() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
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
  SELECT COALESCE(sum(content_bytes),0) INTO expected FROM public.bug_versions;
  IF actual IS NULL OR actual<>expected OR (SELECT count(*) FROM public.bug_definitions)>250 OR (SELECT count(*) FROM public.bug_versions)>1000 THEN RAISE EXCEPTION 'Catalogue guard or accounting mismatch'; END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER catalogue_version_budget AFTER INSERT OR UPDATE ON bug_versions DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_content_budget();
CREATE CONSTRAINT TRIGGER catalogue_total_budget AFTER INSERT OR UPDATE OR DELETE ON catalogue_control DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_content_budget();
--> statement-breakpoint
REVOKE ALL ON FUNCTION lock_catalogue(),content_version_bytes(uuid),validate_content_authority(),content_edit_status(text,uuid,jsonb),apply_content_edit(uuid,text),guard_draft_version(),guard_draft_child(),validate_content_effect(),validate_content_budget() FROM PUBLIC;
GRANT SELECT ON catalogue_control,bug_definitions,bug_versions,language_variants,test_cases,bug_hints,failure_witnesses,runtime_manifests TO ingenium_api;
GRANT SELECT,INSERT ON content_outcomes,content_read_audits TO ingenium_api;
GRANT EXECUTE ON FUNCTION lock_catalogue(),content_edit_status(text,uuid,jsonb),apply_content_edit(uuid,text) TO ingenium_api;
