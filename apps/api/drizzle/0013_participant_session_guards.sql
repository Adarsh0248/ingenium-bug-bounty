CREATE TRIGGER participant_session_outcome_immutable BEFORE UPDATE OR DELETE ON participant_session_outcomes
  FOR EACH ROW EXECUTE FUNCTION immutable_access_history();
--> statement-breakpoint
CREATE FUNCTION guard_participant_activity_source() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF NEW.last_activity_at IS DISTINCT FROM OLD.last_activity_at AND (
    OLD.revoked_at IS NOT NULL OR NEW.last_activity_at>=OLD.absolute_expires_at OR NEW.last_activity_at>=OLD.last_activity_at+interval '2 hours'
    OR NOT EXISTS (SELECT 1 FROM public.member_session_slots WHERE member_id=OLD.member_id AND session_id=OLD.id)
  ) THEN RAISE EXCEPTION 'Expired or retired participant sessions cannot renew'; END IF;
  IF NEW.last_activity_at IS DISTINCT FROM OLD.last_activity_at AND NOT EXISTS (
    SELECT 1 FROM public.participant_session_outcomes o WHERE o.session_id=NEW.id AND o.action='KEEP_ALIVE' AND o.recorded_at=NEW.last_activity_at
  ) THEN RAISE EXCEPTION 'Participant activity requires its committed source'; END IF;
  IF OLD.revoked_at IS NULL AND NEW.revocation_reason='LOGOUT' AND NOT EXISTS (
    SELECT 1 FROM public.participant_session_outcomes o WHERE o.session_id=NEW.id AND o.action='LOGOUT' AND o.recorded_at=NEW.revoked_at
  ) THEN RAISE EXCEPTION 'Participant logout requires its committed source'; END IF;
  IF OLD.revoked_at IS NULL AND NEW.revocation_reason='LOGOUT' AND (
    NEW.revoked_at<OLD.last_activity_at OR NEW.revoked_at>=OLD.absolute_expires_at OR NEW.revoked_at>=OLD.last_activity_at+interval '2 hours'
  ) THEN RAISE EXCEPTION 'Logout must use a still-valid participant session'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER participant_activity_source BEFORE UPDATE ON participant_sessions FOR EACH ROW EXECUTE FUNCTION guard_participant_activity_source();
--> statement-breakpoint
CREATE FUNCTION validate_participant_session_outcome() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE s public.participant_sessions%ROWTYPE;
BEGIN
  SELECT * INTO s FROM public.participant_sessions WHERE id=NEW.session_id;
  IF NOT FOUND OR NEW.recorded_at<s.created_at OR NEW.recorded_at>=s.absolute_expires_at THEN
    RAISE EXCEPTION 'Session command must belong to its original lifetime';
  END IF;
  IF NEW.action='KEEP_ALIVE' THEN
    IF s.last_activity_at<NEW.recorded_at OR NEW.expires_at<>LEAST(s.absolute_expires_at,NEW.recorded_at+interval '2 hours')
      OR (s.revoked_at IS NOT NULL AND s.revoked_at<NEW.recorded_at) THEN
      RAISE EXCEPTION 'Keep-alive outcome requires its matching activity';
    END IF;
  ELSIF s.revoked_at IS DISTINCT FROM NEW.recorded_at OR s.revocation_reason IS DISTINCT FROM 'LOGOUT'
    OR NEW.expires_at<>LEAST(s.absolute_expires_at,s.last_activity_at+interval '2 hours')
    OR EXISTS (SELECT 1 FROM public.member_session_slots WHERE session_id=s.id)
    OR EXISTS (SELECT 1 FROM public.session_deliveries WHERE session_id=s.id AND ciphertext IS NOT NULL)
    OR NOT EXISTS (SELECT 1 FROM public.entry_flows WHERE id=s.entry_flow_id AND state='REVOKED') THEN
    RAISE EXCEPTION 'Logout outcome requires revocation and purged delivery';
  END IF;
  RETURN NEW;
END;
$$;
CREATE CONSTRAINT TRIGGER participant_session_outcome_binding AFTER INSERT ON participant_session_outcomes
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_participant_session_outcome();
--> statement-breakpoint
REVOKE ALL ON FUNCTION guard_participant_activity_source(),validate_participant_session_outcome() FROM PUBLIC;
GRANT SELECT,INSERT ON participant_session_outcomes TO ingenium_api;
