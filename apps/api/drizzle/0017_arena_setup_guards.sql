-- Custom SQL migration file, put your code below! --
ALTER TABLE arena_setup_outcomes ALTER CONSTRAINT arena_setup_outcomes_result_instance_id_arena_instances_id_fk DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE arena_setup_outcomes ALTER CONSTRAINT arena_setup_outcomes_result_round_id_rounds_id_fk DEFERRABLE INITIALLY DEFERRED;
CREATE TRIGGER arena_setup_immutable BEFORE UPDATE OR DELETE ON arena_setup_outcomes FOR EACH ROW EXECUTE FUNCTION immutable_access_history();
CREATE TRIGGER arena_setup_teams_immutable BEFORE UPDATE OR DELETE ON arena_setup_teams FOR EACH ROW EXECUTE FUNCTION immutable_access_history();
--> statement-breakpoint
CREATE FUNCTION lock_arena_control(exclusive_lock boolean) RETURNS SETOF public.arena_control LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  IF exclusive_lock THEN
    PERFORM id FROM public.security_control WHERE id=1 FOR UPDATE;
  ELSE PERFORM id FROM public.security_control WHERE id=1 FOR SHARE; END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'Security anchor is missing'; END IF;
  IF exclusive_lock THEN
    RETURN QUERY SELECT * FROM public.arena_control WHERE id=1 FOR UPDATE;
  ELSE RETURN QUERY SELECT * FROM public.arena_control WHERE id=1 FOR SHARE; END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'Arena reservation anchor is missing'; END IF;
END;
$$;
CREATE FUNCTION validate_arena_reservation() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE reserved uuid; pointer uuid;
BEGIN
  SELECT current_instance_id INTO pointer FROM public.arena_control WHERE id=1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Arena reservation anchor is missing'; END IF;
  SELECT id INTO reserved FROM public.arena_instances WHERE status IN ('SETUP','IN_PROGRESS');
  IF pointer IS DISTINCT FROM reserved THEN RAISE EXCEPTION 'Arena reservation does not match its current instance'; END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER arena_reservation_control AFTER INSERT OR UPDATE OR DELETE ON arena_control DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_arena_reservation();
CREATE CONSTRAINT TRIGGER arena_reservation_instance AFTER INSERT OR UPDATE OR DELETE ON arena_instances DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_arena_reservation();
CREATE FUNCTION protect_arena_control() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Arena reservation anchor cannot be deleted'; END IF;
  IF NEW.id<>OLD.id OR NEW.revision<OLD.revision
    OR (NEW.current_instance_id IS DISTINCT FROM OLD.current_instance_id AND NEW.revision<>OLD.revision+1) THEN
    RAISE EXCEPTION 'Arena reservation revision cannot reset or be omitted'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER arena_control_guard BEFORE UPDATE OR DELETE ON arena_control FOR EACH ROW EXECUTE FUNCTION protect_arena_control();
--> statement-breakpoint
CREATE FUNCTION validate_arena_setup_authority() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.staff_sessions s JOIN public.staff_session_slots x ON x.staff_id=s.staff_id AND x.session_id=s.id
    JOIN public.staff_identities i ON i.id=s.staff_id JOIN public.access_credentials c ON c.id=s.credential_id AND c.staff_id=s.staff_id AND c.version=s.credential_version
    WHERE s.id=NEW.session_id AND s.staff_id=NEW.actor_id AND s.credential_id=NEW.credential_id AND s.credential_version=NEW.credential_version
      AND s.mode='NORMAL' AND s.revoked_at IS NULL AND i.role IN ('OWNER','SUPER_ADMIN') AND i.disabled_at IS NULL AND c.revoked_at IS NULL
      AND c.issued_at<=NEW.recorded_at AND s.created_at<=NEW.recorded_at AND s.last_activity_at<=NEW.recorded_at
      AND NEW.recorded_at<s.absolute_expires_at AND NEW.recorded_at<s.last_activity_at+interval '15 minutes') THEN
    RAISE EXCEPTION 'Current arena-configuration authority required'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER arena_setup_authority BEFORE INSERT ON arena_setup_outcomes FOR EACH ROW EXECUTE FUNCTION validate_arena_setup_authority();
CREATE FUNCTION protect_setup_team_payload() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  -- A committed receipt cannot acquire new payload rows in a later transaction.
  IF NOT EXISTS(SELECT 1 FROM public.arena_setup_outcomes WHERE id=NEW.outcome_id
    AND xmin::text::bigint=(pg_current_xact_id()::text::bigint & 4294967295)) THEN
    RAISE EXCEPTION 'Setup team payload must be committed with its receipt'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER arena_setup_team_payload BEFORE INSERT ON arena_setup_teams FOR EACH ROW EXECUTE FUNCTION protect_setup_team_payload();
--> statement-breakpoint
CREATE FUNCTION apply_arena_setup(source_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE source public.arena_setup_outcomes%ROWTYPE; gate public.arena_control%ROWTYPE; stage public.rounds%ROWTYPE;
BEGIN
  PERFORM id FROM public.security_control WHERE id=1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Security anchor is missing'; END IF;
  SELECT * INTO gate FROM public.arena_control WHERE id=1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Arena reservation anchor is missing'; END IF;
  SELECT * INTO source FROM public.arena_setup_outcomes WHERE id=source_id;
  IF NOT FOUND OR source.outcome<>'APPLIED' THEN RAISE EXCEPTION 'Applied arena source required'; END IF;
  IF source.round_id IS NOT NULL THEN SELECT * INTO stage FROM public.rounds WHERE id=source.round_id FOR UPDATE; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.staff_sessions s JOIN public.staff_session_slots x ON x.staff_id=s.staff_id AND x.session_id=s.id
    JOIN public.staff_identities i ON i.id=s.staff_id JOIN public.access_credentials c ON c.id=s.credential_id AND c.staff_id=s.staff_id AND c.version=s.credential_version
    WHERE s.id=source.session_id AND s.staff_id=source.actor_id AND s.credential_id=source.credential_id AND s.credential_version=source.credential_version
      AND i.role IN ('OWNER','SUPER_ADMIN') AND i.disabled_at IS NULL AND c.revoked_at IS NULL AND s.mode='NORMAL' AND s.revoked_at IS NULL
      AND clock_timestamp()<s.absolute_expires_at AND clock_timestamp()<s.last_activity_at+interval '15 minutes') THEN
    RAISE EXCEPTION 'Arena authority changed before effect'; END IF;
  IF (SELECT count(*) FROM public.arena_setup_teams WHERE outcome_id=source.id)>100 OR EXISTS(
    SELECT 1 FROM public.arena_setup_teams t WHERE t.outcome_id=source.id AND (SELECT count(*) FROM public.team_members m WHERE m.team_id=t.team_id)<>2) THEN
    RAISE EXCEPTION 'Round 1 requires at most 100 complete registered teams'; END IF;
  IF source.action='CREATE' THEN
    IF gate.current_instance_id IS NOT NULL OR gate.revision<>source.expected_revision OR source.result_revision<>1 THEN
      RAISE EXCEPTION 'Arena reservation is occupied or stale'; END IF;
    INSERT INTO public.arena_instances(id,status,created_by,created_at,revision) VALUES(source.result_instance_id,'SETUP',source.actor_id,source.recorded_at,1);
    INSERT INTO public.rounds(id,arena_instance_id,kind,state,duration_ms,revision,configuration_revision,trusted_time_at)
      VALUES(source.result_round_id,source.result_instance_id,1,'DRAFT',source.duration_ms,1,1,source.recorded_at);
    UPDATE public.arena_control SET current_instance_id=source.result_instance_id,revision=revision+1 WHERE id=1;
  ELSE
    IF stage.id IS NULL OR stage.id IS DISTINCT FROM source.result_round_id OR stage.arena_instance_id IS DISTINCT FROM source.result_instance_id
      OR stage.arena_instance_id IS DISTINCT FROM gate.current_instance_id OR stage.kind<>1 OR stage.state NOT IN ('DRAFT','READY')
      OR stage.configuration_revision<>source.expected_revision OR source.result_revision<>stage.configuration_revision+1
      OR NOT EXISTS(SELECT 1 FROM public.arena_instances WHERE id=stage.arena_instance_id AND status='SETUP')
      OR EXISTS(SELECT 1 FROM public.team_rounds WHERE round_id=stage.id) THEN RAISE EXCEPTION 'Round is not an editable current draft'; END IF;
    UPDATE public.rounds SET duration_ms=source.duration_ms,state='DRAFT',configuration_revision=source.result_revision,revision=revision+1 WHERE id=stage.id;
    DELETE FROM public.round_draft_teams WHERE round_id=stage.id;
  END IF;
  INSERT INTO public.round_draft_teams(round_id,team_id) SELECT source.result_round_id,team_id FROM public.arena_setup_teams WHERE outcome_id=source.id;
END;
$$;
--> statement-breakpoint
CREATE FUNCTION protect_round_configuration() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF NEW.configuration_revision IS DISTINCT FROM OLD.configuration_revision OR NEW.duration_ms IS DISTINCT FROM OLD.duration_ms THEN
    IF OLD.state NOT IN ('DRAFT','READY') OR NEW.state<>'DRAFT' OR NEW.configuration_revision<>OLD.configuration_revision+1 OR NEW.revision<>OLD.revision+1
      OR NOT EXISTS(SELECT 1 FROM public.arena_control c JOIN public.arena_instances i ON i.id=c.current_instance_id
        WHERE c.id=1 AND i.id=OLD.arena_instance_id AND i.status='SETUP')
      OR NOT EXISTS(SELECT 1 FROM public.arena_setup_outcomes o WHERE o.action='CONFIGURE' AND o.outcome='APPLIED' AND o.round_id=OLD.id
        AND o.result_round_id=NEW.id AND o.result_instance_id=OLD.arena_instance_id AND o.expected_revision=OLD.configuration_revision
        AND o.result_revision=NEW.configuration_revision AND o.duration_ms=NEW.duration_ms) THEN
      RAISE EXCEPTION 'Round configuration requires an editable source-linked draft'; END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER round_configuration_guard BEFORE UPDATE ON rounds FOR EACH ROW EXECUTE FUNCTION protect_round_configuration();
CREATE FUNCTION protect_draft_roster() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE subject uuid;
BEGIN
  IF TG_OP='UPDATE' THEN RAISE EXCEPTION 'Replace draft roster membership, do not retarget it'; END IF;
  IF TG_OP='DELETE' THEN subject=OLD.round_id; ELSE subject=NEW.round_id; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.rounds r JOIN public.arena_control c ON c.current_instance_id=r.arena_instance_id
    JOIN public.arena_instances i ON i.id=r.arena_instance_id WHERE c.id=1 AND r.id=subject AND r.kind=1 AND r.state='DRAFT'
      AND i.status='SETUP' AND NOT EXISTS(SELECT 1 FROM public.team_rounds WHERE round_id=r.id)) THEN
    RAISE EXCEPTION 'Draft roster is locked outside current setup'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER draft_roster_guard BEFORE INSERT OR UPDATE OR DELETE ON round_draft_teams FOR EACH ROW EXECUTE FUNCTION protect_draft_roster();
--> statement-breakpoint
CREATE FUNCTION validate_arena_setup_effect() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE stage public.rounds%ROWTYPE;
BEGIN
  IF (SELECT count(*) FROM public.arena_setup_teams WHERE outcome_id=NEW.id)>100 THEN RAISE EXCEPTION 'Setup roster payload too large'; END IF;
  IF NEW.outcome='REJECTED' THEN RETURN NULL; END IF;
  SELECT * INTO stage FROM public.rounds WHERE id=NEW.result_round_id;
  IF NOT FOUND OR stage.arena_instance_id<>NEW.result_instance_id OR stage.kind<>1 OR stage.duration_ms<>NEW.duration_ms
    OR stage.configuration_revision<>NEW.result_revision OR stage.state NOT IN ('DRAFT','READY')
    OR (NEW.outcome='APPLIED' AND stage.state<>'DRAFT')
    OR (NEW.outcome='UNCHANGED' AND NEW.expected_revision<>stage.configuration_revision)
    OR (NEW.action='CONFIGURE' AND NEW.round_id<>stage.id)
    OR EXISTS((SELECT team_id FROM public.round_draft_teams WHERE round_id=stage.id EXCEPT SELECT team_id FROM public.arena_setup_teams WHERE outcome_id=NEW.id)
      UNION ALL (SELECT team_id FROM public.arena_setup_teams WHERE outcome_id=NEW.id EXCEPT SELECT team_id FROM public.round_draft_teams WHERE round_id=stage.id)) THEN
    RAISE EXCEPTION 'Arena receipt requires its exact committed draft effect'; END IF;
  IF NEW.action='CREATE' AND NOT EXISTS(SELECT 1 FROM public.arena_instances i JOIN public.arena_control c ON c.current_instance_id=i.id
    WHERE c.id=1 AND i.id=NEW.result_instance_id AND i.status='SETUP' AND i.created_by=NEW.actor_id AND i.created_at=NEW.recorded_at
      AND c.revision=NEW.expected_revision+1 AND stage.configuration_revision=1 AND stage.started_at IS NULL) THEN
    RAISE EXCEPTION 'Arena creation requires its reserved instance and first draft'; END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER arena_setup_effect AFTER INSERT ON arena_setup_outcomes DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_arena_setup_effect();
--> statement-breakpoint
REVOKE ALL ON FUNCTION lock_arena_control(boolean),validate_arena_reservation(),protect_arena_control(),validate_arena_setup_authority(),protect_setup_team_payload(),apply_arena_setup(uuid),protect_round_configuration(),protect_draft_roster(),validate_arena_setup_effect() FROM PUBLIC;
GRANT SELECT,INSERT ON arena_setup_outcomes,arena_setup_teams TO ingenium_api;
GRANT SELECT ON round_draft_teams TO ingenium_api;
GRANT EXECUTE ON FUNCTION lock_arena_control(boolean),apply_arena_setup(uuid) TO ingenium_api;
