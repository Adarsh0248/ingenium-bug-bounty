ALTER TABLE validation_snapshots ALTER CONSTRAINT validation_snapshots_source_id_validation_preparation_outcomes_id_fk DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE validation_preparation_outcomes ALTER CONSTRAINT validation_prepare_snapshot DEFERRABLE INITIALLY DEFERRED;
CREATE TRIGGER validation_prepare_immutable BEFORE UPDATE OR DELETE ON validation_preparation_outcomes FOR EACH ROW EXECUTE FUNCTION immutable_access_history();
CREATE TRIGGER validation_prepare_authority BEFORE INSERT ON validation_preparation_outcomes FOR EACH ROW EXECUTE FUNCTION validate_content_authority();
CREATE TRIGGER validation_audit_immutable BEFORE UPDATE OR DELETE ON validation_snapshot_audits FOR EACH ROW EXECUTE FUNCTION immutable_access_history();
CREATE TRIGGER validation_audit_authority BEFORE INSERT ON validation_snapshot_audits FOR EACH ROW EXECUTE FUNCTION validate_content_authority();
--> statement-breakpoint
-- Hashes keep the canonical manifest bounded; the exact private bytes live in frozen rows.
CREATE FUNCTION validation_configuration_manifest(subject uuid,frozen boolean) RETURNS jsonb LANGUAGE sql STABLE SET search_path=pg_catalog,public AS $$
  WITH version AS (
    SELECT v.id,v.definition_id,v.version_number,v.content_revision,d.round_type,v.title,v.statement,v.difficulty,v.base_bounty,v.submission_format,v.checker_mode,v.checker_version
      FROM public.bug_versions v JOIN public.bug_definitions d ON d.id=v.definition_id WHERE NOT frozen AND v.id=subject
    UNION ALL
    SELECT version_id,definition_id,version_number,content_revision,round_type,title,statement,difficulty,base_bounty,submission_format,checker_mode,checker_version
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
    'difficulty',difficulty,'base_bounty',base_bounty,'submission_format',submission_format,'checker_mode',checker_mode,'checker_version',checker_version),
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
CREATE FUNCTION validation_snapshot_bytes(subject uuid) RETURNS bigint LANGUAGE sql STABLE SET search_path=pg_catalog,public AS $$
  SELECT 65536+octet_length(title)+octet_length(statement)+octet_length(manifest_text)+
    COALESCE((SELECT sum(octet_length(starter_code)+octet_length(reference_code)+octet_length(defect_description)+octet_length(runtime_key)+256) FROM public.validation_snapshot_variants WHERE snapshot_id=s.id),0)+
    COALESCE((SELECT sum(octet_length(input_data)+octet_length(expected_output)+256) FROM public.validation_snapshot_cases WHERE snapshot_id=s.id),0)+
    COALESCE((SELECT sum(octet_length(content)+128) FROM public.validation_snapshot_hints WHERE snapshot_id=s.id),0)+
    (SELECT count(*)*256 FROM public.validation_snapshot_witnesses WHERE snapshot_id=s.id)
  FROM public.validation_snapshots s WHERE id=subject;
$$;
CREATE FUNCTION validation_check_plan(subject uuid) RETURNS TABLE("position" integer,variant_id uuid,language text,source_role text,check_type text,case_id uuid,witness_position integer,expected_result text)
  LANGUAGE sql STABLE SET search_path=pg_catalog,public AS $$
  SELECT row_number() OVER(ORDER BY language COLLATE "C",source_role,ordinal)::integer,variant_id,language,source_role,check_type,case_id,witness_position,expected_result FROM (
    SELECT v.variant_id,v.language,'REFERENCE'::text source_role,'TEST_CASE'::text check_type,c.case_id,NULL::integer witness_position,'PASSED'::text expected_result,c.position ordinal
      FROM public.validation_snapshot_variants v CROSS JOIN public.validation_snapshot_cases c WHERE v.snapshot_id=subject AND c.snapshot_id=subject
    UNION ALL
    SELECT v.variant_id,v.language,'STARTER',w.check_type,w.case_id,w.position,w.expected_result,w.position
      FROM public.validation_snapshot_variants v JOIN public.validation_snapshot_witnesses w ON w.snapshot_id=v.snapshot_id AND w.variant_id=v.variant_id WHERE v.snapshot_id=subject
  ) plan;
$$;
--> statement-breakpoint
CREATE FUNCTION guard_validation_snapshot() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE subject uuid;
BEGIN
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Frozen validation content is immutable'; END IF;
  IF TG_TABLE_NAME='validation_snapshots' THEN subject=NEW.id; ELSE subject=NEW.snapshot_id; END IF;
  IF TG_TABLE_NAME='validation_snapshots' THEN
    IF NOT EXISTS(SELECT 1 FROM public.validation_preparation_outcomes o JOIN public.bug_versions v ON v.id=o.version_id
      WHERE o.id=NEW.source_id AND o.outcome='APPLIED' AND o.result_snapshot_id=NEW.id AND o.actor_id=NEW.created_by AND o.recorded_at=NEW.created_at
      AND o.version_id=NEW.version_id AND o.expected_revision=NEW.content_revision AND v.content_revision=NEW.content_revision AND v.publication_status='DRAFT'
      AND o.xmin::text::bigint=(pg_current_xact_id()::text::bigint & 4294967295)) THEN RAISE EXCEPTION 'Snapshot requires its current applied source'; END IF;
  ELSIF NOT EXISTS(SELECT 1 FROM public.validation_snapshots s WHERE s.id=subject AND s.xmin::text::bigint=(pg_current_xact_id()::text::bigint & 4294967295)) THEN
    RAISE EXCEPTION 'Frozen children require a newly captured snapshot';
  END IF;
  RETURN NEW;
END;
$$;
CREATE FUNCTION validate_validation_snapshot() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE s public.validation_snapshots%ROWTYPE; n integer; samples integer; total_bytes bigint;
BEGIN
  SELECT * INTO s FROM public.validation_snapshots WHERE id=NEW.id;
  IF s.manifest_text::jsonb IS DISTINCT FROM public.validation_configuration_manifest(s.id,true) OR s.content_bytes<>public.validation_snapshot_bytes(s.id) THEN
    RAISE EXCEPTION 'Frozen manifest or budget mismatch'; END IF;
  SELECT count(*),count(*) FILTER(WHERE visibility='SAMPLE'),sum(octet_length(input_data)+octet_length(expected_output)) INTO n,samples,total_bytes FROM public.validation_snapshot_cases WHERE snapshot_id=s.id;
  IF n<2 OR n>20 OR samples<1 OR samples>3 OR n=samples OR total_bytes>16777216
    OR (SELECT count(*) FROM public.validation_snapshot_variants WHERE snapshot_id=s.id)<>5
    OR (SELECT count(*) FROM public.validation_snapshot_hints WHERE snapshot_id=s.id)<>3
    OR length(btrim(s.statement))=0
    OR EXISTS(SELECT 1 FROM public.validation_snapshot_variants v WHERE v.snapshot_id=s.id AND
      (length(btrim(v.defect_description))=0 OR (SELECT count(*) FROM public.validation_snapshot_witnesses w WHERE w.snapshot_id=s.id AND w.variant_id=v.variant_id) NOT BETWEEN 1 AND 3))
    OR EXISTS(SELECT 1 FROM public.validation_snapshot_witnesses w JOIN public.validation_snapshot_variants v USING(snapshot_id,variant_id)
      WHERE w.snapshot_id=s.id AND w.check_type='COMPILATION' AND v.language NOT IN ('c','cpp','java')) THEN RAISE EXCEPTION 'Frozen validation suite is incomplete'; END IF;
  IF EXISTS((SELECT position,variant_id,language,source_role,check_type,case_id,witness_position,expected_result FROM public.validation_snapshot_checks WHERE snapshot_id=s.id
    EXCEPT ALL SELECT * FROM public.validation_check_plan(s.id)) UNION ALL
    (SELECT * FROM public.validation_check_plan(s.id) EXCEPT ALL SELECT position,variant_id,language,source_role,check_type,case_id,witness_position,expected_result FROM public.validation_snapshot_checks WHERE snapshot_id=s.id)) THEN
      RAISE EXCEPTION 'Frozen check plan mismatch'; END IF;
  RETURN NULL;
END;
$$;
CREATE FUNCTION validate_validation_preparation() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF NEW.outcome<>'REJECTED' AND NOT EXISTS(SELECT 1 FROM public.validation_snapshots s WHERE s.id=NEW.result_snapshot_id AND s.version_id=NEW.version_id
    AND s.content_revision=NEW.expected_revision AND (NEW.outcome='UNCHANGED' OR s.source_id=NEW.id)) THEN RAISE EXCEPTION 'Preparation receipt requires its exact frozen effect'; END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER validation_preparation_effect AFTER INSERT ON validation_preparation_outcomes DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_validation_preparation();
CREATE CONSTRAINT TRIGGER validation_snapshot_complete AFTER INSERT ON validation_snapshots DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_validation_snapshot();
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['validation_snapshots','validation_snapshot_variants','validation_snapshot_cases','validation_snapshot_hints','validation_snapshot_witnesses','validation_snapshot_checks'] LOOP
    EXECUTE format('CREATE TRIGGER validation_frozen_guard BEFORE INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION guard_validation_snapshot()',t);
  END LOOP;
END $$;
--> statement-breakpoint
CREATE FUNCTION freeze_validation_snapshot(source uuid,manifest text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE o public.validation_preparation_outcomes%ROWTYPE; v public.bug_versions%ROWTYPE; gate public.catalogue_control%ROWTYPE; size bigint;
BEGIN
  PERFORM * FROM public.lock_arena_control(true);
  PERFORM r.id FROM public.rounds r JOIN public.arena_control a ON a.current_instance_id=r.arena_instance_id ORDER BY r.id FOR UPDATE OF r;
  SELECT * INTO gate FROM public.lock_catalogue();
  SELECT * INTO o FROM public.validation_preparation_outcomes WHERE id=source AND outcome='APPLIED' AND xmin::text::bigint=(pg_current_xact_id()::text::bigint & 4294967295);
  IF NOT FOUND THEN RAISE EXCEPTION 'Current preparation source required'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.staff_sessions x JOIN public.staff_session_slots slot ON slot.staff_id=x.staff_id AND slot.session_id=x.id
    JOIN public.staff_identities i ON i.id=x.staff_id JOIN public.access_credentials c ON c.id=x.credential_id AND c.version=x.credential_version AND c.staff_id=x.staff_id
    WHERE x.id=o.session_id AND x.staff_id=o.actor_id AND x.credential_id=o.credential_id AND x.credential_version=o.credential_version
      AND x.mode='NORMAL' AND x.revoked_at IS NULL AND i.role IN ('OWNER','SUPER_ADMIN') AND i.disabled_at IS NULL AND c.revoked_at IS NULL
      AND clock_timestamp()<x.absolute_expires_at AND clock_timestamp()<x.last_activity_at+interval '15 minutes') THEN RAISE EXCEPTION 'Validation authoring authority changed'; END IF;
  IF EXISTS(SELECT 1 FROM public.rounds r JOIN public.arena_control a ON a.current_instance_id=r.arena_instance_id WHERE r.state IN ('RUNNING','PAUSED','CLOSING','CANCELLING')) THEN RAISE EXCEPTION 'Arena is active'; END IF;
  SELECT * INTO v FROM public.bug_versions WHERE id=o.version_id FOR UPDATE;
  IF NOT FOUND OR v.publication_status<>'DRAFT' OR v.content_revision<>o.expected_revision OR manifest::jsonb IS DISTINCT FROM public.validation_configuration_manifest(v.id,false) THEN RAISE EXCEPTION 'Capture changed before freezing'; END IF;
  size=v.content_bytes+61440+octet_length(manifest)-COALESCE((SELECT sum(octet_length(input_data)+octet_length(expected_output)+256) FROM public.test_cases WHERE version_id=v.id AND removed_at IS NOT NULL),0);
  IF gate.committed_bytes+size>3221225472 THEN RAISE EXCEPTION USING ERRCODE='54000',MESSAGE='Catalogue snapshot capacity unavailable'; END IF;
  INSERT INTO public.validation_snapshots(id,version_id,definition_id,version_number,content_revision,round_type,title,statement,difficulty,base_bounty,submission_format,checker_mode,checker_version,manifest_text,fingerprint,content_bytes,created_by,created_at,source_id)
    SELECT o.result_snapshot_id,v.id,v.definition_id,v.version_number,v.content_revision,d.round_type,v.title,v.statement,v.difficulty,v.base_bounty,v.submission_format,v.checker_mode,v.checker_version,
      manifest,sha256(convert_to(manifest,'UTF8')),size,o.actor_id,o.recorded_at,o.id FROM public.bug_definitions d WHERE d.id=v.definition_id;
  INSERT INTO public.validation_snapshot_variants SELECT o.result_snapshot_id,version_id,id,language,starter_code,reference_code,defect_description,runtime_key,cpu_ms,wall_ms,memory_kb FROM public.language_variants WHERE version_id=v.id;
  INSERT INTO public.validation_snapshot_cases SELECT o.result_snapshot_id,version_id,id,position,visibility,input_data,expected_output FROM public.test_cases WHERE version_id=v.id AND removed_at IS NULL;
  INSERT INTO public.validation_snapshot_hints SELECT o.result_snapshot_id,version_id,id,level,content FROM public.bug_hints WHERE version_id=v.id;
  INSERT INTO public.validation_snapshot_witnesses SELECT o.result_snapshot_id,variant_id,position,check_type,test_case_id,expected_failure FROM public.failure_witnesses WHERE version_id=v.id;
  INSERT INTO public.validation_snapshot_checks(snapshot_id,position,variant_id,language,source_role,check_type,case_id,witness_position,expected_result)
    SELECT o.result_snapshot_id,* FROM public.validation_check_plan(o.result_snapshot_id);
  UPDATE public.catalogue_control SET committed_bytes=committed_bytes+size,revision=revision+1 WHERE id=1;
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION validate_content_budget() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
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
  SELECT COALESCE(sum(content_bytes),0) INTO expected FROM (SELECT content_bytes FROM public.bug_versions UNION ALL SELECT content_bytes FROM public.validation_snapshots) totals;
  IF actual IS NULL OR actual<>expected OR (SELECT count(*) FROM public.bug_definitions)>250 OR (SELECT count(*) FROM public.bug_versions)>1000 THEN RAISE EXCEPTION 'Catalogue guard or accounting mismatch'; END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION validation_configuration_manifest(uuid,boolean),validation_snapshot_bytes(uuid),validation_check_plan(uuid),guard_validation_snapshot(),validate_validation_snapshot(),validate_validation_preparation(),freeze_validation_snapshot(uuid,text) FROM PUBLIC;
GRANT SELECT ON validation_snapshots,validation_snapshot_variants,validation_snapshot_cases,validation_snapshot_hints,validation_snapshot_witnesses,validation_snapshot_checks TO ingenium_api;
GRANT SELECT,INSERT ON validation_preparation_outcomes,validation_snapshot_audits TO ingenium_api;
GRANT EXECUTE ON FUNCTION validation_configuration_manifest(uuid,boolean),freeze_validation_snapshot(uuid,text) TO ingenium_api;
