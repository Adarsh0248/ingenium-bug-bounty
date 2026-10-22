INSERT INTO live_control(id) VALUES(1);
INSERT INTO live_streams(kind) VALUES('STAFF_OPS'),('STAFF_SECURITY');
INSERT INTO live_streams(kind,round_id) SELECT 'ROUND',id FROM rounds;
INSERT INTO live_streams(kind,round_id,team_round_id) SELECT 'TEAM',round_id,id FROM team_rounds;
INSERT INTO live_streams(kind,round_id,member_round_id) SELECT 'MEMBER',round_id,id FROM member_rounds;
INSERT INTO live_streams(kind,staff_id) SELECT 'STAFF_SELF',id FROM staff_identities;
--> statement-breakpoint
CREATE FUNCTION lock_live_control() RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
  SELECT id FROM live_control WHERE id=1 FOR SHARE;
$$;
--> statement-breakpoint
CREATE FUNCTION live_reserve(parent uuid, validation uuid, amount integer) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  PERFORM id FROM live_control WHERE id=1 FOR UPDATE;
  IF EXISTS(SELECT 1 FROM live_reservations WHERE parent_id=parent OR validation_run_id=validation) THEN RETURN; END IF;
  -- Charge every reserved delivery at the full 16 KiB ceiling, including metadata.
  UPDATE live_control SET reserved=reserved+amount WHERE id=1 AND rows+reserved+amount<=245760;
  IF NOT FOUND THEN RAISE EXCEPTION 'Live delivery capacity unavailable' USING ERRCODE='54000'; END IF;
  INSERT INTO live_reservations(parent_id,validation_run_id,remaining) VALUES(parent,validation,amount);
END $$;
--> statement-breakpoint
CREATE FUNCTION live_release(parent uuid, validation uuid, keep integer) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE r live_reservations%ROWTYPE;
BEGIN
  PERFORM id FROM live_control WHERE id=1 FOR UPDATE;
  SELECT * INTO r FROM live_reservations WHERE parent_id=parent OR validation_run_id=validation FOR UPDATE;
  IF FOUND AND r.remaining>keep THEN
    UPDATE live_control SET reserved=reserved-(r.remaining-keep) WHERE id=1;
    UPDATE live_reservations SET remaining=keep WHERE id=r.id;
  END IF;
END $$;
--> statement-breakpoint
CREATE FUNCTION live_emit(effect uuid, streams uuid[], body jsonb, parent uuid DEFAULT NULL, validation uuid DEFAULT NULL, control_event boolean DEFAULT false) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE s live_streams%ROWTYPE; reservation live_reservations%ROWTYPE; n integer; covered integer;
BEGIN
  IF body->>'type' NOT IN ('INVALIDATE','CLAIM','AWARD','JUDGING','AUTHORITY') OR octet_length(body::text)>15360 THEN
    RAISE EXCEPTION 'Invalid live projection';
  END IF;
  PERFORM id FROM live_control WHERE id=1 FOR UPDATE;
  SELECT count(DISTINCT x)::integer INTO n FROM unnest(streams) x WHERE x IS NOT NULL;
  SELECT * INTO reservation FROM live_reservations WHERE parent_id=parent OR validation_run_id=validation FOR UPDATE;
  covered:=least(COALESCE(reservation.remaining,0),n);
  UPDATE live_control SET rows=rows+n,reserved=reserved-covered WHERE id=1
    AND rows+reserved+n-covered<=CASE WHEN control_event THEN 262144 ELSE 245760 END;
  IF NOT FOUND THEN RAISE EXCEPTION 'Live delivery capacity unavailable' USING ERRCODE='54000'; END IF;
  IF covered>0 THEN UPDATE live_reservations SET remaining=remaining-covered WHERE id=reservation.id; END IF;
  FOR s IN SELECT * FROM live_streams WHERE id=ANY(streams) ORDER BY id FOR UPDATE LOOP
    UPDATE live_streams SET head=head+1 WHERE id=s.id;
    INSERT INTO live_deliveries(stream_id,sequence,effect_id,patch) VALUES(s.id,s.head+1,effect,body);
  END LOOP;
END $$;
--> statement-breakpoint
CREATE FUNCTION live_source_changed() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE e uuid; r uuid; team uuid; member uuid; staff uuid; source_parent uuid; validation uuid; ids uuid[];
  body jsonb; rowdata jsonb:=to_jsonb(NEW); previous jsonb; award_round_kind integer; item record;
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
      SELECT a.team_round_id,a.bounty_id,a.id,a.round_kind INTO item FROM bounty_awards a WHERE a.id=NEW.reference_id;
      team:=item.team_round_id; award_round_kind:=item.round_kind;
      body:=jsonb_build_object('type','AWARD','projection','competition','award_id',item.id,'bounty_id',item.bounty_id);
    END IF;
    SELECT array_agg(id) INTO ids FROM live_streams WHERE (kind='TEAM' AND team_round_id=team) OR kind='STAFF_OPS';
    source_parent:=CASE WHEN NEW.kind IN ('SUBMISSION_RECEIVED','ASSESSMENT_RECORDED','PENALTY_APPLIED') THEN NEW.reference_id ELSE NULL END;
    IF NEW.kind='BOUNTY_AWARDED' THEN SELECT submission_id INTO source_parent FROM bounty_awards WHERE id=NEW.reference_id; END IF;
    PERFORM live_emit(e,ids,body,source_parent);
    IF NEW.kind IN ('BOUNTY_AWARDED','HINT_PURCHASED','PENALTY_APPLIED','RESULT_FINALISED','QUALIFICATION_LOCKED','ROUND_CHANGED') THEN
      body:=CASE WHEN NEW.kind='BOUNTY_AWARDED' AND award_round_kind=2 THEN body || '{"type":"CLAIM"}'::jsonb
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
--> statement-breakpoint
DO $$ DECLARE name text; BEGIN
  FOREACH name IN ARRAY ARRAY['rounds','team_rounds','member_rounds','staff_identities','competition_events','participant_jobs','authoring_checks','participant_judging','validation_runs','bug_versions','arena_instances','participant_sessions','staff_sessions','access_credentials','access_blocks'] LOOP
    EXECUTE format('CREATE TRIGGER live_changed AFTER INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION live_source_changed()',name);
  END LOOP;
END $$;
--> statement-breakpoint
CREATE FUNCTION live_maintain() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE item record; n integer;
BEGIN
  PERFORM id FROM live_control WHERE id=1 FOR UPDATE;
  -- Only a published, old prefix is removable; a missed final event remains replayable.
  FOR item IN SELECT s.id FROM live_streams s WHERE (s.retain_until IS NULL OR s.retain_until<clock_timestamp())
    AND EXISTS(SELECT 1 FROM live_deliveries d WHERE d.stream_id=s.id AND d.sequence=s.retained_from AND d.published_at IS NOT NULL AND d.created_at<clock_timestamp()-interval '15 minutes') ORDER BY s.id LIMIT 20 LOOP
    WITH prefix AS (
      SELECT sequence FROM live_deliveries d WHERE d.stream_id=item.id AND d.sequence<COALESCE((
        SELECT min(x.sequence) FROM live_deliveries x WHERE x.stream_id=item.id AND (x.published_at IS NULL OR x.created_at>clock_timestamp()-interval '15 minutes')),9223372036854775807)
      ORDER BY sequence LIMIT 100
    ), gone AS (DELETE FROM live_deliveries WHERE stream_id=item.id AND sequence IN(SELECT sequence FROM prefix) RETURNING sequence)
    SELECT count(*) INTO n FROM gone;
    IF n>0 THEN
      UPDATE live_control SET rows=rows-n WHERE id=1;
      UPDATE live_streams SET retained_from=COALESCE((SELECT min(sequence) FROM live_deliveries WHERE stream_id=item.id),head+1) WHERE id=item.id;
    END IF;
  END LOOP;
  DELETE FROM live_effects e WHERE e.id IN(SELECT x.id FROM live_effects x WHERE NOT EXISTS(SELECT 1 FROM live_deliveries d WHERE d.effect_id=x.id) ORDER BY x.created_at LIMIT 2000);
END $$;
--> statement-breakpoint
CREATE FUNCTION live_publish_batch() RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
  WITH batch AS (SELECT stream_id,sequence FROM live_deliveries WHERE published_at IS NULL ORDER BY created_at,stream_id,sequence LIMIT 100)
  UPDATE live_deliveries d SET published_at=date_trunc('milliseconds',clock_timestamp()) FROM batch b WHERE d.stream_id=b.stream_id AND d.sequence=b.sequence;
$$;
--> statement-breakpoint
CREATE TRIGGER live_effect_immutable BEFORE UPDATE ON live_effects FOR EACH ROW EXECUTE FUNCTION immutable_access_history();
REVOKE ALL ON live_control,live_streams,live_effects,live_deliveries,live_reservations FROM PUBLIC,ingenium_api,ingenium_competition_worker;
GRANT SELECT ON live_control,live_streams,live_effects,live_deliveries,live_reservations TO ingenium_api,ingenium_competition_worker;
REVOKE ALL ON FUNCTION live_emit(uuid,uuid[],jsonb,uuid,uuid,boolean),live_reserve(uuid,uuid,integer),live_release(uuid,uuid,integer),live_source_changed(),live_maintain(),live_publish_batch() FROM PUBLIC,ingenium_api,ingenium_competition_worker;
REVOKE ALL ON FUNCTION lock_live_control() FROM PUBLIC,ingenium_api,ingenium_competition_worker;
GRANT EXECUTE ON FUNCTION lock_live_control() TO ingenium_api;
GRANT EXECUTE ON FUNCTION live_maintain(),live_publish_batch() TO ingenium_api;
