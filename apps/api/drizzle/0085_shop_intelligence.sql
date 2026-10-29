CREATE INDEX shop_unfinished_work ON participant_judging(bounty_id,team_round_id) WHERE completed_at IS NULL AND status<>'CANCELLED';
CREATE TABLE shop_presence (
  session_id uuid NOT NULL REFERENCES participant_sessions(id), connection_id text NOT NULL CHECK(octet_length(connection_id) BETWEEN 1 AND 64),
  member_round_id uuid NOT NULL REFERENCES member_rounds(id), bounty_id uuid NOT NULL REFERENCES bounties(id), expires_at timestamptz(3) NOT NULL,
  PRIMARY KEY(session_id,connection_id)
);
CREATE INDEX shop_activity_target ON shop_presence(bounty_id,expires_at);
CREATE FUNCTION shop_record_presence(sid uuid,stage uuid,connection text,bounty uuid,n timestamptz) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE m public.member_rounds%ROWTYPE;
BEGIN
  m=public.shop_authority(sid,stage,n);
  IF octet_length(connection) NOT BETWEEN 1 AND 64 THEN RAISE EXCEPTION 'Invalid presence connection'; END IF;
  DELETE FROM public.shop_presence WHERE expires_at<=n;
  IF bounty IS NULL THEN DELETE FROM public.shop_presence WHERE session_id=sid AND connection_id=connection; RETURN; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.bounties b JOIN public.rounds r ON r.id=b.round_id WHERE b.id=bounty AND r.id=stage AND r.kind=2
    AND r.state IN ('RUNNING','PAUSED') AND n<r.closes_at) THEN RETURN; END IF;
  IF (SELECT count(*) FROM public.shop_presence)>=1152 AND NOT EXISTS(SELECT 1 FROM public.shop_presence WHERE session_id=sid AND connection_id=connection)
    THEN RAISE EXCEPTION 'Presence capacity' USING ERRCODE='54000'; END IF;
  INSERT INTO public.shop_presence VALUES(sid,connection,m.id,bounty,n+interval '45 seconds')
    ON CONFLICT(session_id,connection_id) DO UPDATE SET bounty_id=EXCLUDED.bounty_id,expires_at=EXCLUDED.expires_at;
END $$;
CREATE FUNCTION shop_intelligence(sid uuid,stage uuid,bounty uuid,n timestamptz) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE m public.member_rounds%ROWTYPE; data jsonb; source bytea; probe boolean; scanner boolean;
BEGIN
  m=public.shop_authority(sid,stage,n);
  IF NOT EXISTS(SELECT 1 FROM public.bounties WHERE id=bounty AND round_id=stage) THEN RAISE EXCEPTION 'Foreign bounty' USING ERRCODE='42501'; END IF;
  SELECT EXISTS(SELECT 1 FROM public.shop_activations WHERE team_round_id=m.team_round_id AND bounty_id=bounty AND item_id='boundary-probe'),
    EXISTS(SELECT 1 FROM public.shop_activations WHERE team_round_id=m.team_round_id AND bounty_id=bounty AND item_id='hex-scanner') INTO probe,scanner;
  SELECT i.data,v.starter_code INTO data,source FROM public.shop_snapshot_intel i JOIN public.bounties b ON b.snapshot_id=i.snapshot_id
    JOIN public.validation_snapshot_variants v ON v.snapshot_id=i.snapshot_id AND v.language=i.language WHERE b.id=bounty AND i.language=m.language;
  RETURN jsonb_build_object('bounty_id',bounty,'assistance_tier',CASE WHEN scanner THEN 2 WHEN probe THEN 1 ELSE 0 END)
    ||CASE WHEN probe AND data ? 'probe' THEN jsonb_build_object('probe',data->'probe') ELSE '{}'::jsonb END
    ||CASE WHEN scanner AND data ? 'scanner' THEN jsonb_build_object('scanner',(data->'scanner')||jsonb_build_object('source',array_to_string((string_to_array(convert_from(source,'UTF8'),E'\n'))[(data#>>'{scanner,from_line}')::integer:(data#>>'{scanner,to_line}')::integer],E'\n'))) ELSE '{}'::jsonb END;
END $$;
CREATE FUNCTION shop_intel_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE s record; v record; info jsonb; first_line integer; last_line integer; code_lines text[];
BEGIN
  SELECT * INTO s FROM public.validation_snapshots WHERE id=NEW.snapshot_id;
  SELECT * INTO v FROM public.validation_snapshot_variants WHERE snapshot_id=NEW.snapshot_id AND language=NEW.language;
  IF v.variant_id IS NULL OR s.round_type<>2 OR NEW.snapshot_fingerprint<>s.fingerprint OR NEW.starter_sha256<>sha256(v.starter_code)
    OR EXISTS(SELECT 1 FROM public.bounties WHERE snapshot_id=NEW.snapshot_id) THEN RAISE EXCEPTION 'Intelligence requires unused matching frozen content'; END IF;
  IF (SELECT count(*) FROM jsonb_object_keys(NEW.data))<>2 OR NOT NEW.data ?& ARRAY['probe','scanner'] THEN RAISE EXCEPTION 'Invalid intelligence fields'; END IF;
  info=NEW.data->'probe';
  IF jsonb_typeof(info)<>'object' OR (SELECT count(*) FROM jsonb_object_keys(info))<>2 OR jsonb_typeof(info->'input')<>'string' OR jsonb_typeof(info->'output')<>'string'
    OR octet_length(info->>'input')>65536 OR octet_length(info->>'output')>65536 OR EXISTS(SELECT 1 FROM public.validation_snapshot_cases WHERE snapshot_id=NEW.snapshot_id
      AND regexp_replace(btrim(convert_from(input_data,'UTF8')),'\s+',' ','g')=regexp_replace(btrim(info->>'input'),'\s+',' ','g')) THEN RAISE EXCEPTION 'Probe must be a separate bounded example'; END IF;
  info=NEW.data->'scanner'; first_line=(info->>'from_line')::integer; last_line=(info->>'to_line')::integer;
  code_lines=string_to_array(convert_from(v.starter_code,'UTF8'),E'\n');
  IF jsonb_typeof(info)<>'object' OR (SELECT count(*) FROM jsonb_object_keys(info))<>4 OR jsonb_typeof(info->'label')<>'string' OR jsonb_typeof(info->'text')<>'string'
    OR octet_length(info->>'label') NOT BETWEEN 1 AND 160 OR octet_length(info->>'text') NOT BETWEEN 1 AND 16384
    OR first_line IS NULL OR last_line IS NULL OR first_line<1 OR last_line-first_line NOT BETWEEN 3 AND 79 OR last_line>array_length(code_lines,1)
    OR NOT EXISTS(SELECT 1 FROM generate_series(first_line,last_line) i WHERE code_lines[i] IS DISTINCT FROM (string_to_array(convert_from(v.reference_code,'UTF8'),E'\n'))[i])
    THEN RAISE EXCEPTION 'Scanner must cover a broad faulty starter section'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER shop_intel_guard BEFORE INSERT ON shop_snapshot_intel FOR EACH ROW EXECUTE FUNCTION shop_intel_guard();
REVOKE ALL ON shop_presence FROM PUBLIC,ingenium_api,ingenium_competition_worker;
GRANT SELECT ON shop_presence TO ingenium_api;
REVOKE ALL ON FUNCTION shop_record_presence(uuid,uuid,text,uuid,timestamptz),shop_intelligence(uuid,uuid,uuid,timestamptz),shop_intel_guard() FROM PUBLIC,ingenium_api,ingenium_competition_worker;
GRANT EXECUTE ON FUNCTION shop_record_presence(uuid,uuid,text,uuid,timestamptz),shop_intelligence(uuid,uuid,uuid,timestamptz) TO ingenium_api;

--> statement-breakpoint
CREATE OR REPLACE FUNCTION live_source_changed() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE e uuid; r uuid; team uuid; member uuid; staff uuid; source_parent uuid; validation uuid; ids uuid[];
  body jsonb; rowdata jsonb:=to_jsonb(NEW); previous jsonb; award_round_kind integer; protected_award boolean:=false; item record;
BEGIN
  IF TG_OP='UPDATE' THEN previous:=to_jsonb(OLD); END IF;
  IF TG_TABLE_NAME='rounds' THEN
    IF TG_OP='INSERT' THEN INSERT INTO live_streams(kind,round_id) VALUES('ROUND',NEW.id); END IF;
    IF TG_OP='UPDATE' AND (rowdata-'trusted_time_at')=(previous-'trusted_time_at') THEN RETURN NEW; END IF;
    r:=NEW.id; INSERT INTO live_effects(round_id) VALUES(r) RETURNING id INTO e;
  ELSIF TG_TABLE_NAME='team_rounds' THEN
    INSERT INTO live_streams(kind,round_id,team_round_id) VALUES('TEAM',NEW.round_id,NEW.id); RETURN NEW;
  ELSIF TG_TABLE_NAME='member_rounds' THEN
    IF TG_OP='INSERT' THEN INSERT INTO live_streams(kind,round_id,member_round_id) VALUES('MEMBER',NEW.round_id,NEW.id); RETURN NEW; END IF;
    IF NEW.language IS NOT DISTINCT FROM OLD.language THEN RETURN NEW; END IF;
    r:=NEW.round_id; member:=NEW.id;
    -- The session is the real authority source for the member's immutable language selection.
    SELECT id INTO item FROM participant_sessions WHERE member_round_id=member ORDER BY created_at DESC LIMIT 1;
    IF item IS NULL THEN RETURN NEW; END IF;
    INSERT INTO live_effects(participant_session_id) VALUES(item.id) RETURNING id INTO e;
  ELSIF TG_TABLE_NAME='staff_identities' THEN
    IF TG_OP='INSERT' THEN INSERT INTO live_streams(kind,staff_id) VALUES('STAFF_SELF',NEW.id); END IF;
    IF TG_OP='UPDATE' AND NEW IS NOT DISTINCT FROM OLD THEN RETURN NEW; END IF;
    staff:=NEW.id; INSERT INTO live_effects(staff_id) VALUES(staff) RETURNING id INTO e;
  ELSIF TG_TABLE_NAME='competition_events' THEN
    r:=NEW.round_id; team:=NEW.team_round_id;
    INSERT INTO live_effects(competition_sequence) VALUES(NEW.sequence) RETURNING id INTO e;
    body:=jsonb_build_object('type','INVALIDATE','projection','competition','reason',NEW.kind);
    IF NEW.kind='BOUNTY_AWARDED' THEN
      SELECT a.team_round_id,a.bounty_id,a.id,a.round_kind,a.protected INTO item FROM bounty_awards a WHERE a.id=NEW.reference_id;
      team:=item.team_round_id; award_round_kind:=item.round_kind; protected_award:=item.protected;
      body:=jsonb_build_object('type','AWARD','projection','competition','award_id',item.id,'bounty_id',item.bounty_id);
    END IF;
    SELECT array_agg(id) INTO ids FROM live_streams WHERE (kind='TEAM' AND team_round_id=team) OR kind='STAFF_OPS';
    source_parent:=CASE WHEN NEW.kind IN ('SUBMISSION_RECEIVED','ASSESSMENT_RECORDED','PENALTY_APPLIED') THEN NEW.reference_id ELSE NULL END;
    IF NEW.kind='BOUNTY_AWARDED' THEN SELECT submission_id INTO source_parent FROM bounty_awards WHERE id=NEW.reference_id; END IF;
    PERFORM live_emit(e,ids,body,source_parent);
    IF NEW.kind IN ('BOUNTY_AWARDED','HINT_PURCHASED','PENALTY_APPLIED','RESULT_FINALISED','QUALIFICATION_LOCKED','ROUND_CHANGED') THEN
      body:=CASE WHEN NEW.kind='BOUNTY_AWARDED' AND award_round_kind=2 AND NOT protected_award THEN body || '{"type":"CLAIM"}'::jsonb
        ELSE jsonb_build_object('type','INVALIDATE','projection','competition') END;
      SELECT array_agg(id) INTO ids FROM live_streams WHERE kind='ROUND' AND round_id=r;
      PERFORM live_emit(e,ids,body,source_parent,NULL,NEW.kind IN ('ROUND_CHANGED','RESULT_FINALISED','QUALIFICATION_LOCKED'));
    END IF;
    RETURN NEW;
  ELSIF TG_TABLE_NAME='participant_jobs' THEN
    IF TG_OP='INSERT' OR (NEW.status IS NOT DISTINCT FROM OLD.status AND NEW.result IS NOT DISTINCT FROM OLD.result) THEN RETURN NEW; END IF;
    SELECT * INTO item FROM participant_judging WHERE id=NEW.parent_id;
    IF item.status='COMPLETED' THEN RETURN NEW; END IF;
    source_parent:=item.id;
    -- Official per-case progress is staff-only: event counts must not disclose hidden-suite progress.
    IF item.lane='SAMPLE' THEN r:=item.round_id; member:=item.member_round_id; END IF;
    INSERT INTO live_effects(parent_id) VALUES(item.id) RETURNING id INTO e;
    body:=jsonb_build_object('type','INVALIDATE','projection','judging','parent_id',item.id);
  ELSIF TG_TABLE_NAME='authoring_checks' THEN
    IF TG_OP='INSERT' OR NEW.result IS NOT DISTINCT FROM OLD.result THEN RETURN NEW; END IF;
    IF NOT EXISTS(SELECT 1 FROM validation_runs WHERE id=NEW.run_id AND status='RUNNING') THEN RETURN NEW; END IF;
    validation:=NEW.run_id; INSERT INTO live_effects(validation_run_id) VALUES(validation) RETURNING id INTO e;
    body:='{"type":"INVALIDATE","projection":"content"}';
  ELSIF TG_TABLE_NAME='participant_judging' THEN
    source_parent:=NEW.id; r:=NEW.round_id;
    IF TG_OP='INSERT' THEN PERFORM live_reserve(NEW.id,NULL,CASE WHEN NEW.lane='OFFICIAL' THEN 1024 ELSE 256 END);
    ELSIF NEW.status IS NOT DISTINCT FROM OLD.status AND NEW.result IS NOT DISTINCT FROM OLD.result THEN RETURN NEW; END IF;
    IF NEW.lane='SAMPLE' THEN member:=NEW.member_round_id; ELSE team:=NEW.team_round_id; END IF;
    INSERT INTO live_effects(parent_id) VALUES(NEW.id) RETURNING id INTO e;
    body:=jsonb_build_object('type','JUDGING','projection','judging','parent_id',NEW.id,'bounty_id',NEW.bounty_id,'lane',NEW.lane,'status',NEW.status,'result',NEW.result);
  ELSIF TG_TABLE_NAME='validation_runs' THEN
    validation:=NEW.id;
    IF TG_OP='INSERT' THEN PERFORM live_reserve(NULL,NEW.id,2048);
    ELSIF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
    INSERT INTO live_effects(validation_run_id) VALUES(NEW.id) RETURNING id INTO e;
  ELSIF TG_TABLE_NAME='bug_versions' THEN
    IF TG_OP='UPDATE' AND NEW IS NOT DISTINCT FROM OLD THEN RETURN NEW; END IF;
    INSERT INTO live_effects(version_id) VALUES(NEW.id) RETURNING id INTO e;
  ELSIF TG_TABLE_NAME='arena_instances' THEN
    IF TG_OP='UPDATE' AND NEW IS NOT DISTINCT FROM OLD THEN RETURN NEW; END IF;
    INSERT INTO live_effects(arena_id) VALUES(NEW.id) RETURNING id INTO e;
    IF NEW.status IN ('COMPLETED','DISCARDED') THEN
      UPDATE live_streams SET retain_until=date_trunc('milliseconds',clock_timestamp())+interval '24 hours'
        WHERE round_id IN(SELECT id FROM rounds WHERE arena_instance_id=NEW.id) OR kind IN ('STAFF_OPS','STAFF_SECURITY','STAFF_SELF');
      FOR item IN SELECT p.id FROM participant_judging p JOIN rounds x ON x.id=p.round_id WHERE x.arena_instance_id=NEW.id LOOP
        PERFORM live_release(item.id,NULL,0);
      END LOOP;
    END IF;
  ELSIF TG_TABLE_NAME='participant_sessions' THEN
    IF TG_OP='UPDATE' AND NEW.revoked_at IS NOT DISTINCT FROM OLD.revoked_at THEN RETURN NEW; END IF;
    member:=NEW.member_round_id; SELECT round_id INTO r FROM member_rounds WHERE id=member;
    INSERT INTO live_effects(participant_session_id) VALUES(NEW.id) RETURNING id INTO e;
    body:='{"type":"AUTHORITY","projection":"session"}';
  ELSIF TG_TABLE_NAME='staff_sessions' THEN
    IF TG_OP='UPDATE' AND NEW.revoked_at IS NOT DISTINCT FROM OLD.revoked_at THEN RETURN NEW; END IF;
    staff:=NEW.staff_id; INSERT INTO live_effects(staff_session_id) VALUES(NEW.id) RETURNING id INTO e;
  ELSIF TG_TABLE_NAME='access_credentials' THEN
    IF TG_OP='UPDATE' AND NEW.revoked_at IS NOT DISTINCT FROM OLD.revoked_at THEN RETURN NEW; END IF;
    staff:=NEW.staff_id; INSERT INTO live_effects(credential_id) VALUES(NEW.id) RETURNING id INTO e;
  ELSIF TG_TABLE_NAME='access_blocks' THEN
    IF TG_OP='UPDATE' AND NEW.cleared_at IS NOT DISTINCT FROM OLD.cleared_at THEN RETURN NEW; END IF;
    INSERT INTO live_effects(block_id) VALUES(NEW.id) RETURNING id INTO e;
  ELSE RAISE EXCEPTION 'Unsupported live source'; END IF;
  SELECT array_agg(s.id) INTO ids FROM live_streams s WHERE
    (s.kind='ROUND' AND s.round_id=r AND team IS NULL AND member IS NULL)
    OR (s.kind='TEAM' AND s.team_round_id=team) OR (s.kind='MEMBER' AND s.member_round_id=member)
    OR (s.kind='STAFF_SELF' AND s.staff_id=staff)
    OR (s.kind='STAFF_OPS' AND TG_TABLE_NAME NOT IN ('staff_identities','staff_sessions','access_credentials','access_blocks','participant_sessions'))
    OR (s.kind='STAFF_SECURITY' AND TG_TABLE_NAME IN ('staff_identities','staff_sessions','access_credentials','access_blocks','participant_sessions'));
  PERFORM live_emit(e,ids,COALESCE(body,jsonb_build_object('type','INVALIDATE','projection',
    CASE WHEN TG_TABLE_NAME IN ('rounds','arena_instances','member_rounds') THEN 'competition'
      WHEN TG_TABLE_NAME IN ('validation_runs','bug_versions') THEN 'content' ELSE 'session' END)),source_parent,validation,
    TG_TABLE_NAME IN ('rounds','arena_instances','staff_identities','staff_sessions','access_credentials','access_blocks','participant_sessions'));
  IF TG_TABLE_NAME='participant_judging' THEN
    IF NEW.status='COMPLETED' THEN PERFORM live_release(NEW.id,NULL,CASE WHEN NEW.lane='OFFICIAL' THEN 16 ELSE 0 END); END IF;
  ELSIF TG_TABLE_NAME='validation_runs' THEN
    IF NEW.status NOT IN ('QUEUED','RUNNING') THEN PERFORM live_release(NULL,NEW.id,0); END IF;
  END IF;
  RETURN NEW;
END $$;
