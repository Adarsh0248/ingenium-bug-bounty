INSERT INTO staff_session_slots(staff_id) SELECT id FROM staff_identities;
CREATE FUNCTION initialise_staff_session_slot() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN INSERT INTO public.staff_session_slots(staff_id) VALUES(NEW.id); RETURN NEW; END;
$$;
CREATE TRIGGER staff_slot_initialisation AFTER INSERT ON staff_identities FOR EACH ROW EXECUTE FUNCTION initialise_staff_session_slot();
--> statement-breakpoint
CREATE TRIGGER staff_session_guard BEFORE UPDATE OR DELETE ON staff_sessions FOR EACH ROW EXECUTE FUNCTION guard_participant_session();
CREATE TRIGGER staff_delivery_guard BEFORE UPDATE OR DELETE ON staff_session_deliveries FOR EACH ROW EXECUTE FUNCTION guard_session_delivery();
CREATE TRIGGER staff_outcome_immutable BEFORE UPDATE OR DELETE ON staff_entry_outcomes FOR EACH ROW EXECUTE FUNCTION immutable_access_history();
CREATE TRIGGER staff_event_immutable BEFORE UPDATE OR DELETE ON staff_session_events FOR EACH ROW EXECUTE FUNCTION immutable_access_history();
CREATE TRIGGER clock_clearance_immutable BEFORE UPDATE OR DELETE ON clock_clearances FOR EACH ROW EXECUTE FUNCTION immutable_access_history();
CREATE FUNCTION guard_staff_flow() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' OR (to_jsonb(NEW)-ARRAY['state','session_id','activated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['state','session_id','activated_at'])
    OR (OLD.session_id IS NOT NULL AND ROW(NEW.session_id,NEW.activated_at) IS DISTINCT FROM ROW(OLD.session_id,OLD.activated_at))
    OR (OLD.state IN ('EXPIRED','REVOKED','SUPERSEDED') AND NEW IS DISTINCT FROM OLD) OR (OLD.state='ACTIVATED' AND NEW.state='OPEN') THEN
    RAISE EXCEPTION 'Staff flow identity and activation cannot be reset';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER staff_flow_guard BEFORE UPDATE OR DELETE ON staff_entry_flows FOR EACH ROW EXECUTE FUNCTION guard_staff_flow();
--> statement-breakpoint
CREATE FUNCTION validate_staff_binding() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE sid uuid; s public.staff_sessions%ROWTYPE;
BEGIN
  IF TG_TABLE_NAME='staff_sessions' THEN sid=NEW.id;
  ELSIF TG_TABLE_NAME='staff_session_slots' THEN
    IF TG_OP='UPDATE' AND OLD.session_id IS DISTINCT FROM NEW.session_id AND EXISTS(SELECT 1 FROM public.staff_sessions WHERE id=OLD.session_id AND revoked_at IS NULL) THEN
      RAISE EXCEPTION 'Previous staff slot must be revoked';
    END IF;
    sid=COALESCE(NEW.session_id,OLD.session_id);
  ELSE sid=NEW.session_id;
  END IF;
  IF sid IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO s FROM public.staff_sessions WHERE id=sid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Missing staff session'; END IF;
  IF TG_TABLE_NAME='staff_entry_flows' THEN
    IF NEW.id<>s.flow_id THEN RAISE EXCEPTION 'Foreign staff flow'; END IF;
  ELSIF TG_TABLE_NAME IN ('staff_entry_outcomes','staff_session_deliveries') THEN
    IF NEW.flow_id<>s.flow_id THEN RAISE EXCEPTION 'Foreign staff delivery/outcome'; END IF;
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.staff_entry_flows f JOIN public.staff_session_deliveries d ON d.flow_id=f.id AND d.session_id=s.id
    WHERE f.id=s.flow_id AND f.staff_id=s.staff_id AND f.session_id=s.id AND f.activated_at=s.created_at
      AND f.credential_id=s.credential_id AND f.credential_version=s.credential_version AND f.mode=s.mode AND f.generation=s.generation
      AND d.expires_at=f.expires_at AND (s.revoked_at IS NOT NULL OR EXISTS(SELECT 1 FROM public.staff_session_slots x WHERE x.staff_id=s.staff_id AND x.session_id=s.id))
      AND 1=(SELECT count(*) FROM public.staff_entry_outcomes o WHERE o.flow_id=f.id AND o.session_id=s.id AND o.recorded_at=s.created_at)) THEN
    RAISE EXCEPTION 'Staff activation binding is incomplete';
  END IF;
  RETURN NEW;
END;
$$;
CREATE CONSTRAINT TRIGGER staff_session_binding AFTER INSERT OR UPDATE ON staff_sessions DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_staff_binding();
CREATE CONSTRAINT TRIGGER staff_slot_binding AFTER INSERT OR UPDATE ON staff_session_slots DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_staff_binding();
CREATE CONSTRAINT TRIGGER staff_flow_binding AFTER INSERT OR UPDATE ON staff_entry_flows DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_staff_binding();
CREATE CONSTRAINT TRIGGER staff_delivery_binding AFTER INSERT OR UPDATE ON staff_session_deliveries DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_staff_binding();
CREATE CONSTRAINT TRIGGER staff_outcome_binding AFTER INSERT ON staff_entry_outcomes DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_staff_binding();
--> statement-breakpoint
CREATE FUNCTION validate_clock_clearance() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.clock_health h, public.staff_sessions s
    JOIN public.staff_identities i ON i.id=s.staff_id JOIN public.staff_session_slots x ON x.staff_id=s.staff_id AND x.session_id=s.id
    JOIN public.access_credentials c ON c.id=s.credential_id AND c.version=s.credential_version AND c.staff_id=s.staff_id
    WHERE h.id=1 AND h.running AND h.fault_latched AND h.runtime_id=NEW.runtime_id AND h.fault_generation=NEW.generation
      AND h.sequence=NEW.report_sequence AND h.healthy_count=7 AND h.healthy_last_ns-h.healthy_since_ns>=30000000000
      AND s.id=NEW.session_id AND s.staff_id=NEW.staff_id AND s.credential_id=NEW.credential_id AND s.credential_version=NEW.credential_version
      AND s.revoked_at IS NULL AND i.disabled_at IS NULL AND i.role IN ('OWNER','SUPER_ADMIN') AND c.revoked_at IS NULL
      AND c.issued_at<=NEW.recorded_at AND s.created_at<=NEW.recorded_at AND s.last_activity_at<=NEW.recorded_at
      AND NEW.recorded_at<s.absolute_expires_at AND NEW.recorded_at<s.last_activity_at+interval '15 minutes'
      AND (s.mode='NORMAL' OR s.generation=NEW.generation)) THEN RAISE EXCEPTION 'Invalid timing clearance authority or evidence'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER clock_clearance_validation BEFORE INSERT ON clock_clearances FOR EACH ROW EXECUTE FUNCTION validate_clock_clearance();
CREATE FUNCTION require_clock_clearance_effect() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS(SELECT 1 FROM clock_health WHERE id=1 AND (fault_latched OR fault_generation<>NEW.generation OR runtime_id<>NEW.runtime_id)) THEN
    RAISE EXCEPTION 'Timing clearance must commit with its exact clock effect';
  END IF;
  RETURN NEW;
END;
$$;
CREATE CONSTRAINT TRIGGER clock_clearance_effect AFTER INSERT ON clock_clearances DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION require_clock_clearance_effect();
CREATE OR REPLACE FUNCTION guard_clock_health() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' OR NEW.fault_generation<OLD.fault_generation
    OR (NEW.runtime_id IS NOT DISTINCT FROM OLD.runtime_id AND NEW.sequence<OLD.sequence)
    OR (OLD.running AND NEW.runtime_id IS DISTINCT FROM OLD.runtime_id AND NOT NEW.fault_latched) THEN RAISE EXCEPTION 'Clock history cannot reset'; END IF;
  IF OLD.fault_latched THEN
    IF NEW.fault_latched AND ROW(NEW.fault_generation,NEW.fault_reason) IS DISTINCT FROM ROW(OLD.fault_generation,OLD.fault_reason) THEN RAISE EXCEPTION 'Incident identity cannot reset'; END IF;
    IF NOT NEW.fault_latched AND (NEW.fault_generation<>OLD.fault_generation OR NEW.runtime_id IS DISTINCT FROM OLD.runtime_id
      OR NEW.fault_reason IS NOT NULL OR NOT EXISTS(SELECT 1 FROM clock_clearances c WHERE c.generation=OLD.fault_generation
        AND c.runtime_id=OLD.runtime_id AND c.report_sequence=OLD.sequence)) THEN RAISE EXCEPTION 'A bound authorised timing clearance is required'; END IF;
  ELSIF NEW.fault_generation<>OLD.fault_generation+(CASE WHEN NEW.fault_latched THEN 1 ELSE 0 END) THEN RAISE EXCEPTION 'Incident generation cannot reset';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION initialise_staff_session_slot(),guard_staff_flow(),validate_staff_binding(),validate_clock_clearance(),require_clock_clearance_effect() FROM PUBLIC;
GRANT SELECT,INSERT ON staff_entry_flows,staff_sessions,staff_session_deliveries,staff_entry_outcomes,staff_session_events,clock_clearances TO ingenium_api;
GRANT SELECT ON staff_session_slots TO ingenium_api;
GRANT UPDATE(session_id,revision) ON staff_session_slots TO ingenium_api;
GRANT UPDATE(state,session_id,activated_at) ON staff_entry_flows TO ingenium_api;
GRANT UPDATE(last_activity_at,revoked_at,revocation_reason) ON staff_sessions TO ingenium_api;
GRANT UPDATE(ciphertext,purged_at) ON staff_session_deliveries TO ingenium_api;
