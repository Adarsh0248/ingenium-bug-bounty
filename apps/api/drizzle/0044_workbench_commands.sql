CREATE FUNCTION workbench_fingerprint(stage uuid,member uuid,bounty uuid,base bigint,code bytea) RETURNS bytea LANGUAGE sql IMMUTABLE SET search_path=pg_catalog,public AS $$
  SELECT sha256(convert_to(jsonb_build_array('ingenium-draft-v1',stage,member,bounty,base::text,encode(sha256(code),'hex'))::text,'UTF8'));
$$;
--> statement-breakpoint
CREATE FUNCTION workbench_usage(team uuid DEFAULT NULL) RETURNS bigint LANGUAGE sql STABLE SET search_path=pg_catalog,public AS $$
  SELECT COALESCE((SELECT sum(p.reserved_bytes) FROM participant_judging p WHERE team IS NULL OR p.team_round_id=team),0)
    +COALESCE((SELECT sum(octet_length(d.source_code)+512) FROM code_drafts d JOIN member_rounds m ON m.id=d.member_round_id WHERE team IS NULL OR m.team_round_id=team),0)
    +512*(SELECT count(*) FROM draft_save_outcomes d JOIN member_rounds m ON m.id=d.member_round_id WHERE team IS NULL OR m.team_round_id=team)
    +256*(SELECT count(*) FROM workbench_activities d JOIN member_rounds m ON m.id=d.member_round_id WHERE team IS NULL OR m.team_round_id=team);
$$;
--> statement-breakpoint
CREATE FUNCTION workbench_storage_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE team uuid; delta bigint; member uuid;
BEGIN
  PERFORM id FROM judge_control WHERE id=1 FOR UPDATE;
  member:=NEW.member_round_id; SELECT team_round_id INTO team FROM member_rounds WHERE id=member;
  IF TG_TABLE_NAME='participant_judging' THEN delta:=NEW.reserved_bytes;
  ELSIF TG_TABLE_NAME='code_drafts' THEN
    delta:=octet_length(NEW.source_code)+512;
    IF TG_OP='UPDATE' THEN delta:=octet_length(NEW.source_code)-octet_length(OLD.source_code); END IF;
  ELSE delta:=CASE WHEN TG_TABLE_NAME='draft_save_outcomes' THEN 512 ELSE 256 END; END IF;
  IF delta>0 AND (workbench_usage(team)+delta>201326592 OR workbench_usage(NULL)+delta>31138512896) THEN
    RAISE EXCEPTION 'Participant source storage capacity' USING ERRCODE='54000';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER workbench_parent_storage BEFORE INSERT ON participant_judging FOR EACH ROW EXECUTE FUNCTION workbench_storage_guard();
CREATE TRIGGER workbench_draft_storage BEFORE INSERT OR UPDATE ON code_drafts FOR EACH ROW EXECUTE FUNCTION workbench_storage_guard();
CREATE TRIGGER workbench_outcome_storage BEFORE INSERT ON draft_save_outcomes FOR EACH ROW EXECUTE FUNCTION workbench_storage_guard();
CREATE TRIGGER workbench_activity_storage BEFORE INSERT ON workbench_activities FOR EACH ROW EXECUTE FUNCTION workbench_storage_guard();
--> statement-breakpoint
CREATE FUNCTION workbench_outcome_capacity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  IF (SELECT count(*) FROM entry_outcomes)+(SELECT count(*) FROM participant_session_outcomes)
    +(SELECT count(*) FROM competition_outcomes WHERE participant_session_id IS NOT NULL)+(SELECT count(*) FROM draft_save_outcomes)
    +(SELECT count(*) FROM workbench_activities WHERE request_key IS NOT NULL)>=4000000 THEN
    RAISE EXCEPTION 'Participant outcome capacity' USING ERRCODE='54000';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER workbench_outcome_count BEFORE INSERT ON draft_save_outcomes FOR EACH ROW EXECUTE FUNCTION workbench_outcome_capacity();
CREATE TRIGGER workbench_open_count BEFORE INSERT ON workbench_activities FOR EACH ROW WHEN(NEW.request_key IS NOT NULL) EXECUTE FUNCTION workbench_outcome_capacity();
CREATE TRIGGER workbench_competition_count BEFORE INSERT ON competition_outcomes FOR EACH ROW WHEN(NEW.participant_session_id IS NOT NULL) EXECUTE FUNCTION workbench_outcome_capacity();
--> statement-breakpoint
CREATE FUNCTION workbench_authority(sid uuid,stage uuid,target uuid) RETURNS participant_sessions LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE s participant_sessions%ROWTYPE; n timestamptz;
BEGIN
  PERFORM id FROM security_control WHERE id=1 FOR SHARE;
  PERFORM id FROM arena_control WHERE id=1 FOR SHARE;
  PERFORM id FROM rounds WHERE id=stage FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Workbench scope unavailable' USING ERRCODE='42501'; END IF;
  PERFORM id FROM judge_control WHERE id=1 FOR UPDATE;
  PERFORM slot.member_id FROM member_session_slots slot JOIN participant_sessions p ON p.member_id=slot.member_id WHERE p.id=sid FOR UPDATE OF slot;
  n:=competition_now(stage);
  SELECT p.* INTO s FROM participant_sessions p JOIN member_session_slots x ON x.member_id=p.member_id AND x.session_id=p.id
    JOIN access_credentials c ON c.id=p.credential_id AND c.version=p.credential_version AND c.team_id=p.team_id
    JOIN rounds r ON r.id=p.round_id WHERE p.id=sid AND p.round_id=stage AND p.revoked_at IS NULL AND c.revoked_at IS NULL AND c.issued_at<=n
    AND n>=p.created_at AND n>=p.last_activity_at AND n<p.absolute_expires_at AND n<p.last_activity_at+interval '2 hours'
    AND NOT EXISTS(SELECT 1 FROM access_blocks b WHERE b.arena_instance_id=r.arena_instance_id AND b.cleared_at IS NULL AND (b.team_id=p.team_id OR b.member_id=p.member_id));
  IF s.id IS NULL OR NOT EXISTS(SELECT 1 FROM bounties WHERE id=target AND round_id=stage) THEN RAISE EXCEPTION 'Workbench authority required' USING ERRCODE='42501'; END IF;
  RETURN s;
END $$;
--> statement-breakpoint
CREATE FUNCTION workbench_save(sid uuid,stage uuid,target uuid,request uuid,base bigint,code bytea) RETURNS draft_save_outcomes
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE s participant_sessions%ROWTYPE; r rounds%ROWTYPE; d code_drafts%ROWTYPE; o draft_save_outcomes%ROWTYPE; m member_rounds%ROWTYPE;
  n timestamptz; fp bytea; reason text; result_kind text; next_revision bigint; source uuid:=gen_random_uuid();
BEGIN
  s:=workbench_authority(sid,stage,target);SELECT * INTO m FROM member_rounds WHERE id=s.member_round_id;
  IF request IS NULL OR base IS NULL OR base NOT BETWEEN 0 AND 9223372036854775805 OR code IS NULL OR octet_length(code)>1048576 THEN RAISE EXCEPTION 'Invalid draft request' USING ERRCODE='22023'; END IF;
  fp:=workbench_fingerprint(stage,m.id,target,base,code);
  SELECT * INTO o FROM draft_save_outcomes WHERE member_round_id=m.id AND bounty_id=target AND request_key=request;
  IF FOUND THEN
    IF o.request_fingerprint<>fp THEN RAISE EXCEPTION 'Draft intent key reused' USING ERRCODE='P0002'; END IF;
    RETURN o;
  END IF;
  n:=competition_now(stage);PERFORM competition_close_due(stage,n);SELECT * INTO r FROM rounds WHERE id=stage;
  IF octet_length(code)>131072 THEN reason:='DRAFT_TOO_LARGE';
  ELSIF r.state NOT IN ('RUNNING','PAUSED') OR n>=r.closes_at OR NOT EXISTS(SELECT 1 FROM arena_control c JOIN arena_instances a ON a.id=c.current_instance_id WHERE c.id=1 AND a.id=r.arena_instance_id AND a.status='IN_PROGRESS') THEN reason:='ROUND_NOT_WRITABLE';
  ELSIF competition_paused(stage,m.team_round_id,m.id) THEN reason:='PAUSED';
  ELSIF EXISTS(SELECT 1 FROM bounty_awards WHERE bounty_id=target AND (r.kind=2 OR team_round_id=m.team_round_id)) THEN reason:='BOUNTY_UNAVAILABLE'; END IF;
  SELECT * INTO d FROM code_drafts WHERE member_round_id=m.id AND bounty_id=target FOR UPDATE;
  IF reason IS NOT NULL THEN result_kind:='REJECTED';
  ELSIF base<>COALESCE(d.revision,0) THEN result_kind:='CONFLICT';reason:='REVISION_MISMATCH';
  ELSIF d.id IS NOT NULL AND d.source_code=code THEN result_kind:='UNCHANGED';next_revision:=d.revision;
  ELSE
    result_kind:='SAVED';next_revision:=base+1;
    IF d.id IS NULL THEN INSERT INTO code_drafts(member_round_id,bounty_id,round_id,source_code,revision,created_at,updated_at) VALUES(m.id,target,stage,code,next_revision,n,n);
    ELSE UPDATE code_drafts SET source_code=code,revision=next_revision,updated_at=n WHERE id=d.id; END IF;
  END IF;
  INSERT INTO draft_save_outcomes(id,member_round_id,bounty_id,round_id,request_key,request_fingerprint,base_revision,outcome,reason_code,result_revision,recorded_at)
    VALUES(source,m.id,target,stage,request,fp,base,result_kind,reason,next_revision,n) RETURNING * INTO o;
  IF result_kind='SAVED' THEN
    INSERT INTO workbench_activities(session_id,member_round_id,bounty_id,draft_outcome_id,recorded_at) VALUES(sid,m.id,target,source,n);
    UPDATE participant_sessions SET last_activity_at=n WHERE id=sid;
  END IF;
  RETURN o;
END $$;
--> statement-breakpoint
CREATE FUNCTION workbench_open(sid uuid,stage uuid,target uuid,request uuid) RETURNS workbench_activities
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE s participant_sessions%ROWTYPE; r rounds%ROWTYPE; a workbench_activities%ROWTYPE; n timestamptz;
BEGIN
  s:=workbench_authority(sid,stage,target);IF request IS NULL THEN RAISE EXCEPTION 'Invalid open request' USING ERRCODE='22023'; END IF;
  SELECT * INTO a FROM workbench_activities WHERE member_round_id=s.member_round_id AND bounty_id=target AND request_key=request;
  IF FOUND THEN RETURN a; END IF;
  n:=competition_now(stage);PERFORM competition_close_due(stage,n);SELECT * INTO r FROM rounds WHERE id=stage;
  IF r.started_at IS NULL OR r.state IN ('DRAFT','READY') THEN RAISE EXCEPTION 'Challenge not available' USING ERRCODE='42501'; END IF;
  INSERT INTO workbench_activities(session_id,member_round_id,bounty_id,request_key,recorded_at) VALUES(sid,s.member_round_id,target,request,n) RETURNING * INTO a;
  UPDATE participant_sessions SET last_activity_at=n WHERE id=sid;
  RETURN a;
END $$;
--> statement-breakpoint
CREATE FUNCTION guard_workbench_draft() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Draft identity cannot be deleted'; END IF;
  IF NOT EXISTS(SELECT 1 FROM member_rounds WHERE id=NEW.member_round_id AND round_id=NEW.round_id AND enrolled_at IS NOT NULL) THEN RAISE EXCEPTION 'Draft member scope mismatch'; END IF;
  IF TG_OP='INSERT' THEN
    IF NEW.revision<>1 OR NEW.created_at<>NEW.updated_at THEN RAISE EXCEPTION 'Invalid first draft'; END IF;
  ELSIF ROW(NEW.id,NEW.member_round_id,NEW.bounty_id,NEW.round_id,NEW.created_at) IS DISTINCT FROM ROW(OLD.id,OLD.member_round_id,OLD.bounty_id,OLD.round_id,OLD.created_at)
    OR NEW.revision<>OLD.revision+1 OR NEW.source_code=OLD.source_code OR NEW.updated_at<OLD.updated_at THEN RAISE EXCEPTION 'Invalid draft transition'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER draft_transition BEFORE INSERT OR UPDATE OR DELETE ON code_drafts FOR EACH ROW EXECUTE FUNCTION guard_workbench_draft();
CREATE TRIGGER draft_outcome_immutable BEFORE UPDATE OR DELETE ON draft_save_outcomes FOR EACH ROW EXECUTE FUNCTION immutable_access_history();
CREATE TRIGGER workbench_activity_immutable BEFORE UPDATE OR DELETE ON workbench_activities FOR EACH ROW EXECUTE FUNCTION immutable_access_history();
--> statement-breakpoint
CREATE FUNCTION workbench_integrity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE o draft_save_outcomes%ROWTYPE; d code_drafts%ROWTYPE; a workbench_activities%ROWTYPE; m member_rounds%ROWTYPE;
BEGIN
  IF TG_TABLE_NAME='code_drafts' THEN
    IF NOT EXISTS(SELECT 1 FROM draft_save_outcomes x WHERE x.member_round_id=NEW.member_round_id AND x.bounty_id=NEW.bounty_id AND x.outcome='SAVED'
      AND x.result_revision=NEW.revision AND x.recorded_at=NEW.updated_at AND x.xmin::text::bigint=(pg_current_xact_id()::text::bigint & 4294967295)
      AND x.request_fingerprint=workbench_fingerprint(NEW.round_id,NEW.member_round_id,NEW.bounty_id,x.base_revision,NEW.source_code)) THEN RAISE EXCEPTION 'Draft change needs its bound receipt'; END IF;
  ELSIF TG_TABLE_NAME='draft_save_outcomes' THEN
    o:=NEW;SELECT * INTO m FROM member_rounds WHERE id=o.member_round_id;
    IF m.round_id<>o.round_id OR m.enrolled_at IS NULL THEN RAISE EXCEPTION 'Draft outcome scope mismatch'; END IF;
    IF o.outcome IN ('SAVED','UNCHANGED') THEN
      SELECT * INTO d FROM code_drafts WHERE member_round_id=o.member_round_id AND bounty_id=o.bounty_id;
      IF d.id IS NULL OR d.revision<>o.result_revision OR o.request_fingerprint<>workbench_fingerprint(o.round_id,o.member_round_id,o.bounty_id,o.base_revision,d.source_code) THEN RAISE EXCEPTION 'Draft acknowledgement mismatch'; END IF;
      IF o.outcome='SAVED' AND NOT EXISTS(SELECT 1 FROM workbench_activities WHERE draft_outcome_id=o.id) THEN RAISE EXCEPTION 'Changed save needs activity source'; END IF;
    END IF;
  ELSE
    a:=NEW;SELECT * INTO m FROM member_rounds WHERE id=a.member_round_id;
    IF NOT EXISTS(SELECT 1 FROM participant_sessions s JOIN bounties b ON b.round_id=s.round_id WHERE s.id=a.session_id AND s.member_round_id=m.id AND b.id=a.bounty_id AND s.last_activity_at>=a.recorded_at) THEN RAISE EXCEPTION 'Activity scope mismatch'; END IF;
    IF a.draft_outcome_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM draft_save_outcomes x WHERE x.id=a.draft_outcome_id AND x.member_round_id=m.id AND x.bounty_id=a.bounty_id AND x.outcome='SAVED' AND x.recorded_at=a.recorded_at) THEN RAISE EXCEPTION 'Activity draft source mismatch'; END IF;
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER draft_integrity AFTER INSERT OR UPDATE ON code_drafts DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION workbench_integrity();
CREATE CONSTRAINT TRIGGER draft_outcome_integrity AFTER INSERT ON draft_save_outcomes DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION workbench_integrity();
CREATE CONSTRAINT TRIGGER workbench_activity_integrity AFTER INSERT ON workbench_activities DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION workbench_integrity();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION guard_participant_activity_source() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF NEW.last_activity_at IS DISTINCT FROM OLD.last_activity_at AND (
    OLD.revoked_at IS NOT NULL OR NEW.last_activity_at>=OLD.absolute_expires_at OR NEW.last_activity_at>=OLD.last_activity_at+interval '2 hours'
    OR NOT EXISTS(SELECT 1 FROM member_session_slots WHERE member_id=OLD.member_id AND session_id=OLD.id)
  ) THEN RAISE EXCEPTION 'Expired or retired participant sessions cannot renew'; END IF;
  IF NEW.last_activity_at IS DISTINCT FROM OLD.last_activity_at AND NOT EXISTS(
    SELECT 1 FROM participant_session_outcomes o WHERE o.session_id=NEW.id AND o.action='KEEP_ALIVE' AND o.recorded_at=NEW.last_activity_at
  ) AND NOT EXISTS(
    SELECT 1 FROM competition_outcomes o WHERE o.participant_session_id=NEW.id AND o.recorded_at=NEW.last_activity_at
      AND o.xmin::text::bigint=(pg_current_xact_id()::text::bigint & 4294967295)
      AND ((o.action='SUBMIT' AND o.result->>'status'='ADMITTED' AND EXISTS(SELECT 1 FROM competition_submissions WHERE source_id=o.id AND member_round_id=NEW.member_round_id))
        OR (o.action='RUN' AND o.result->>'status'='ADMITTED' AND EXISTS(SELECT 1 FROM participant_judging WHERE source_id=o.id AND member_round_id=NEW.member_round_id AND lane='SAMPLE'))
        OR (o.action='HINT' AND o.result->>'status'='PURCHASED' AND EXISTS(SELECT 1 FROM hint_purchases WHERE source_id=o.id)))
  ) AND NOT EXISTS(SELECT 1 FROM workbench_activities a WHERE a.session_id=NEW.id AND a.member_round_id=NEW.member_round_id AND a.recorded_at=NEW.last_activity_at
    AND a.xmin::text::bigint=(pg_current_xact_id()::text::bigint & 4294967295)) THEN RAISE EXCEPTION 'Participant activity requires its committed source'; END IF;
  IF OLD.revoked_at IS NULL AND NEW.revocation_reason='LOGOUT' AND NOT EXISTS(
    SELECT 1 FROM participant_session_outcomes o WHERE o.session_id=NEW.id AND o.action='LOGOUT' AND o.recorded_at=NEW.revoked_at
  ) THEN RAISE EXCEPTION 'Participant logout requires its committed source'; END IF;
  IF OLD.revoked_at IS NULL AND NEW.revocation_reason='LOGOUT' AND (
    NEW.revoked_at<OLD.last_activity_at OR NEW.revoked_at>=OLD.absolute_expires_at OR NEW.revoked_at>=OLD.last_activity_at+interval '2 hours'
  ) THEN RAISE EXCEPTION 'Logout must use a still-valid participant session'; END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
REVOKE ALL ON code_drafts,draft_save_outcomes,workbench_activities FROM PUBLIC,ingenium_api,ingenium_competition_worker;
GRANT SELECT ON code_drafts,draft_save_outcomes,workbench_activities TO ingenium_api;
REVOKE ALL ON FUNCTION workbench_fingerprint(uuid,uuid,uuid,bigint,bytea),workbench_usage(uuid),workbench_storage_guard(),workbench_outcome_capacity(),workbench_authority(uuid,uuid,uuid),workbench_save(uuid,uuid,uuid,uuid,bigint,bytea),workbench_open(uuid,uuid,uuid,uuid),guard_workbench_draft(),workbench_integrity() FROM PUBLIC,ingenium_api,ingenium_competition_worker;
GRANT EXECUTE ON FUNCTION workbench_save(uuid,uuid,uuid,uuid,bigint,bytea),workbench_open(uuid,uuid,uuid,uuid) TO ingenium_api;
