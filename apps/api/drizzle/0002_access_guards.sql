INSERT INTO security_control (id) VALUES (1);
INSERT INTO arena_control (id) VALUES (1);
INSERT INTO quota_control (id) VALUES (1);
INSERT INTO member_session_slots (member_id) SELECT id FROM team_members;
--> statement-breakpoint
CREATE FUNCTION initialise_member_session_slot() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  INSERT INTO public.member_session_slots (member_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$;
CREATE TRIGGER member_slot_initialisation AFTER INSERT ON team_members FOR EACH ROW EXECUTE FUNCTION initialise_member_session_slot();
--> statement-breakpoint
CREATE FUNCTION immutable_access_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Access history is immutable'; END;
$$;
CREATE TRIGGER entry_outcome_immutable BEFORE UPDATE OR DELETE ON entry_outcomes FOR EACH ROW EXECUTE FUNCTION immutable_access_history();
CREATE TRIGGER entry_event_immutable BEFORE UPDATE OR DELETE ON entry_events FOR EACH ROW EXECUTE FUNCTION immutable_access_history();
--> statement-breakpoint
CREATE FUNCTION guard_member_enrolment() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' OR ROW(NEW.id,NEW.team_round_id,NEW.team_id,NEW.member_id,NEW.round_id,NEW.display_name)
       IS DISTINCT FROM ROW(OLD.id,OLD.team_round_id,OLD.team_id,OLD.member_id,OLD.round_id,OLD.display_name)
     OR (OLD.enrolled_at IS NOT NULL AND NEW IS DISTINCT FROM OLD) THEN
    RAISE EXCEPTION 'Member identity and enrolled language are immutable';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER member_enrolment_guard BEFORE UPDATE OR DELETE ON member_rounds FOR EACH ROW EXECUTE FUNCTION guard_member_enrolment();
--> statement-breakpoint
CREATE FUNCTION guard_participant_session() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' OR (to_jsonb(NEW)-ARRAY['last_activity_at','revoked_at','revocation_reason'])
       IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['last_activity_at','revoked_at','revocation_reason'])
     OR NEW.last_activity_at<OLD.last_activity_at
     OR (OLD.revoked_at IS NOT NULL AND NEW IS DISTINCT FROM OLD) THEN
    RAISE EXCEPTION 'Session identity, deadlines and revocation cannot be reset';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER participant_session_guard BEFORE UPDATE OR DELETE ON participant_sessions FOR EACH ROW EXECUTE FUNCTION guard_participant_session();
--> statement-breakpoint
CREATE FUNCTION guard_entry_flow() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' OR (to_jsonb(NEW)-ARRAY['state','activated_session_id','activated_at'])
       IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['state','activated_session_id','activated_at'])
     OR (OLD.activated_session_id IS NOT NULL AND ROW(NEW.activated_session_id,NEW.activated_at) IS DISTINCT FROM ROW(OLD.activated_session_id,OLD.activated_at))
     OR (OLD.state IN ('EXPIRED','REVOKED','SUPERSEDED') AND NEW IS DISTINCT FROM OLD)
     OR (OLD.state='ACTIVATED' AND NEW.state='OPEN') THEN
    RAISE EXCEPTION 'Entry flow cannot be reset or reactivated';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER entry_flow_guard BEFORE UPDATE OR DELETE ON entry_flows FOR EACH ROW EXECUTE FUNCTION guard_entry_flow();
--> statement-breakpoint
CREATE FUNCTION guard_session_delivery() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' OR ROW(NEW.flow_id,NEW.session_id,NEW.key_id,NEW.expires_at) IS DISTINCT FROM ROW(OLD.flow_id,OLD.session_id,OLD.key_id,OLD.expires_at)
     OR (NEW IS DISTINCT FROM OLD AND NOT (OLD.ciphertext IS NOT NULL AND NEW.ciphertext IS NULL AND OLD.purged_at IS NULL AND NEW.purged_at IS NOT NULL)) THEN
    RAISE EXCEPTION 'Session delivery can only be purged, never replaced';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER session_delivery_guard BEFORE UPDATE OR DELETE ON session_deliveries FOR EACH ROW EXECUTE FUNCTION guard_session_delivery();
--> statement-breakpoint
CREATE FUNCTION guard_access_credential() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' OR (to_jsonb(NEW)-'revoked_at') IS DISTINCT FROM (to_jsonb(OLD)-'revoked_at')
     OR (OLD.revoked_at IS NOT NULL AND NEW IS DISTINCT FROM OLD) THEN
    RAISE EXCEPTION 'Access credentials are immutable except once-only revocation';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER access_credential_guard BEFORE UPDATE OR DELETE ON access_credentials FOR EACH ROW EXECUTE FUNCTION guard_access_credential();
--> statement-breakpoint
CREATE FUNCTION validate_participant_binding() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE sid uuid; s public.participant_sessions%ROWTYPE; valid boolean;
BEGIN
  IF TG_TABLE_NAME='participant_sessions' THEN sid=NEW.id;
  ELSIF TG_TABLE_NAME='member_session_slots' THEN
    IF TG_OP='UPDATE' AND OLD.session_id IS DISTINCT FROM NEW.session_id THEN
      IF EXISTS (SELECT 1 FROM public.participant_sessions WHERE id=OLD.session_id AND revoked_at IS NULL) THEN
        RAISE EXCEPTION 'The previous slot session must be revoked before replacement';
      END IF;
    END IF;
    sid=COALESCE(NEW.session_id,OLD.session_id);
  ELSIF TG_TABLE_NAME='entry_flows' THEN sid=NEW.activated_session_id;
  ELSIF TG_TABLE_NAME='session_deliveries' THEN sid=NEW.session_id;
  ELSIF TG_TABLE_NAME='entry_outcomes' THEN sid=NEW.session_id;
  ELSIF TG_TABLE_NAME='member_rounds' THEN
    IF NEW.enrolled_at IS NULL THEN RETURN NEW; END IF;
    SELECT id INTO sid FROM public.participant_sessions WHERE member_round_id=NEW.id AND entry_flow_id=NEW.first_entry_flow_id;
    IF sid IS NULL THEN RAISE EXCEPTION 'Enrolment requires its committed entry session'; END IF;
  END IF;
  IF sid IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO s FROM public.participant_sessions WHERE id=sid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Missing bound participant session'; END IF;
  IF TG_TABLE_NAME='entry_flows' THEN
    IF NEW.id<>s.entry_flow_id THEN RAISE EXCEPTION 'Foreign activated flow'; END IF;
  END IF;
  IF TG_TABLE_NAME='entry_outcomes' THEN
    SELECT NEW.flow_id=s.entry_flow_id AND NEW.member_id=s.member_id AND NEW.language=language INTO valid
      FROM public.member_rounds WHERE id=s.member_round_id;
    IF valid IS NOT TRUE THEN RAISE EXCEPTION 'Foreign activation outcome'; END IF;
  END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.member_rounds m JOIN public.entry_flows f ON f.id=s.entry_flow_id
    JOIN public.session_deliveries d ON d.flow_id=f.id AND d.session_id=s.id
    WHERE m.id=s.member_round_id AND m.first_entry_flow_id=f.id AND m.enrolled_at=s.created_at
      AND m.language IS NOT NULL AND f.activated_session_id=s.id AND f.activated_at=s.created_at
      AND f.round_id=s.round_id AND f.team_id=s.team_id AND f.credential_id=s.credential_id AND f.credential_version=s.credential_version
      AND d.expires_at=f.expires_at
      AND (s.revoked_at IS NOT NULL OR EXISTS (SELECT 1 FROM public.member_session_slots x WHERE x.member_id=s.member_id AND x.session_id=s.id))
      AND 1=(SELECT count(*) FROM public.entry_outcomes o WHERE o.flow_id=f.id AND o.session_id=s.id AND o.outcome='ACTIVATED'
             AND o.member_id=s.member_id AND o.language=m.language AND o.recorded_at=s.created_at)
  ) INTO valid;
  IF valid IS NOT TRUE THEN RAISE EXCEPTION 'Participant entry binding is incomplete'; END IF;
  RETURN NEW;
END;
$$;
CREATE CONSTRAINT TRIGGER participant_binding AFTER INSERT OR UPDATE ON participant_sessions DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_participant_binding();
CREATE CONSTRAINT TRIGGER slot_binding AFTER INSERT OR UPDATE ON member_session_slots DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_participant_binding();
CREATE CONSTRAINT TRIGGER flow_binding AFTER INSERT OR UPDATE ON entry_flows DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_participant_binding();
CREATE CONSTRAINT TRIGGER delivery_binding AFTER INSERT OR UPDATE ON session_deliveries DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_participant_binding();
CREATE CONSTRAINT TRIGGER outcome_binding AFTER INSERT OR UPDATE ON entry_outcomes DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_participant_binding();
CREATE CONSTRAINT TRIGGER enrolment_binding AFTER INSERT OR UPDATE ON member_rounds DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_participant_binding();
--> statement-breakpoint
REVOKE ALL ON FUNCTION initialise_member_session_slot(), immutable_access_history(), guard_member_enrolment(), guard_participant_session(),
  guard_entry_flow(), guard_session_delivery(), guard_access_credential(), validate_participant_binding() FROM PUBLIC;
GRANT SELECT ON teams,team_members,staff_identities,access_credentials,security_control,arena_control,arena_instances,rounds,team_rounds,member_rounds,
  member_session_slots,entry_flows,participant_sessions,session_deliveries,entry_outcomes,entry_events,access_blocks,quota_control,quota_buckets TO ingenium_api;
GRANT UPDATE (revision) ON security_control,rounds TO ingenium_api;
GRANT UPDATE (id) ON quota_control TO ingenium_api;
GRANT UPDATE (session_id,revision) ON member_session_slots TO ingenium_api;
GRANT UPDATE (language,enrolled_at,first_entry_flow_id) ON member_rounds TO ingenium_api;
GRANT UPDATE (state,activated_session_id,activated_at) ON entry_flows TO ingenium_api;
GRANT UPDATE (last_activity_at,revoked_at,revocation_reason) ON participant_sessions TO ingenium_api;
GRANT UPDATE (ciphertext,purged_at) ON session_deliveries TO ingenium_api;
GRANT INSERT ON entry_flows,participant_sessions,session_deliveries,entry_outcomes,entry_events,quota_buckets TO ingenium_api;
GRANT UPDATE (credits,refilled_at,seen_at) ON quota_buckets TO ingenium_api;
