CREATE TRIGGER replacement_decision_immutable BEFORE UPDATE OR DELETE ON replacement_decisions FOR EACH ROW EXECUTE FUNCTION immutable_access_history();
--> statement-breakpoint
CREATE FUNCTION guard_replacement_request() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' OR (to_jsonb(NEW)-ARRAY['state','proof_ciphertext','proof_purged_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['state','proof_ciphertext','proof_purged_at'])
    OR (ROW(NEW.proof_ciphertext,NEW.proof_purged_at) IS DISTINCT FROM ROW(OLD.proof_ciphertext,OLD.proof_purged_at)
      AND NOT (OLD.proof_ciphertext IS NOT NULL AND OLD.proof_purged_at IS NULL AND NEW.proof_ciphertext IS NULL AND NEW.proof_purged_at IS NOT NULL))
    OR (NEW.state<>OLD.state AND NOT (
      (OLD.state='PENDING' AND NEW.state IN ('APPROVED','REJECTED','EXPIRED','SUPERSEDED')) OR
      (OLD.state='APPROVED' AND NEW.state IN ('ACTIVATED','EXPIRED','SUPERSEDED')) OR
      (OLD.state='ACTIVATED' AND NEW.state IN ('EXPIRED','SUPERSEDED')))) THEN
    RAISE EXCEPTION 'Replacement identity, deadline and consumed state cannot reset';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER replacement_request_guard BEFORE UPDATE OR DELETE ON replacement_requests FOR EACH ROW EXECUTE FUNCTION guard_replacement_request();
--> statement-breakpoint
CREATE FUNCTION guard_member_slot_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' OR NEW.member_id<>OLD.member_id OR NEW.revision<OLD.revision
    OR (ROW(NEW.session_id,NEW.reservation_flow_id) IS DISTINCT FROM ROW(OLD.session_id,OLD.reservation_flow_id) AND NEW.revision<>OLD.revision+1) THEN
    RAISE EXCEPTION 'Member slot changes require their next revision';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER member_slot_revision_guard BEFORE UPDATE OR DELETE ON member_session_slots FOR EACH ROW EXECUTE FUNCTION guard_member_slot_revision();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION validate_participant_binding() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE sid uuid; s public.participant_sessions%ROWTYPE; valid boolean;
BEGIN
  IF TG_TABLE_NAME='participant_sessions' THEN sid=NEW.id;
  ELSIF TG_TABLE_NAME='member_session_slots' THEN
    IF TG_OP='UPDATE' AND OLD.session_id IS DISTINCT FROM NEW.session_id AND EXISTS (
      SELECT 1 FROM public.participant_sessions WHERE id=OLD.session_id AND revoked_at IS NULL
    ) THEN RAISE EXCEPTION 'The previous slot session must be revoked before replacement'; END IF;
    sid=COALESCE(NEW.session_id,OLD.session_id);
  ELSIF TG_TABLE_NAME='entry_flows' THEN sid=NEW.activated_session_id;
  ELSIF TG_TABLE_NAME='session_deliveries' THEN sid=NEW.session_id;
  ELSIF TG_TABLE_NAME='entry_outcomes' THEN sid=NEW.session_id;
  ELSIF TG_TABLE_NAME='member_rounds' THEN
    IF NEW.enrolled_at IS NULL THEN RETURN NEW; END IF;
    SELECT id INTO sid FROM public.participant_sessions WHERE member_round_id=NEW.id AND entry_flow_id=NEW.first_entry_flow_id;
    IF sid IS NULL THEN RAISE EXCEPTION 'Enrolment requires its committed first-entry session'; END IF;
  END IF;
  IF sid IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO s FROM public.participant_sessions WHERE id=sid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Missing bound participant session'; END IF;
  IF TG_TABLE_NAME='entry_flows' THEN
    IF NEW.id<>s.entry_flow_id THEN RAISE EXCEPTION 'Foreign activated flow'; END IF;
  END IF;
  IF TG_TABLE_NAME='entry_outcomes' THEN
    SELECT NEW.flow_id=s.entry_flow_id AND NEW.member_id=s.member_id AND NEW.language=language INTO valid FROM public.member_rounds WHERE id=s.member_round_id;
    IF valid IS NOT TRUE THEN RAISE EXCEPTION 'Foreign activation outcome'; END IF;
  END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.member_rounds m JOIN public.entry_flows f ON f.id=s.entry_flow_id
    JOIN public.session_deliveries d ON d.flow_id=f.id AND d.session_id=s.id
    WHERE m.id=s.member_round_id AND m.language IS NOT NULL AND f.activated_session_id=s.id AND f.activated_at=s.created_at
      AND f.round_id=s.round_id AND f.team_id=s.team_id AND f.credential_id=s.credential_id AND f.credential_version=s.credential_version AND d.expires_at=f.expires_at
      AND ((f.purpose='TEAM_ENTRY' AND m.first_entry_flow_id=f.id AND m.enrolled_at=s.created_at) OR
        (f.purpose='REPLACEMENT' AND m.enrolled_at<=s.created_at AND EXISTS (
          SELECT 1 FROM public.replacement_requests r JOIN public.replacement_decisions a ON a.flow_id=r.flow_id AND a.action='APPROVE' AND a.outcome='APPLIED'
          WHERE r.flow_id=f.id AND r.member_round_id=m.id AND r.member_id=s.member_id AND a.recorded_at<=s.created_at)))
      AND (s.revoked_at IS NOT NULL OR EXISTS (SELECT 1 FROM public.member_session_slots x WHERE x.member_id=s.member_id AND x.session_id=s.id AND x.reservation_flow_id IS NULL))
      AND 1=(SELECT count(*) FROM public.entry_outcomes o WHERE o.flow_id=f.id AND o.session_id=s.id AND o.outcome='ACTIVATED'
        AND o.member_id=s.member_id AND o.language=m.language AND o.recorded_at=s.created_at)
  ) INTO valid;
  IF valid IS NOT TRUE THEN RAISE EXCEPTION 'Participant source binding is incomplete'; END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE FUNCTION validate_replacement_binding() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE fid uuid; r public.replacement_requests%ROWTYPE; f public.entry_flows%ROWTYPE;
BEGIN
  IF TG_TABLE_NAME='entry_flows' THEN
    fid=NEW.id;
    IF NEW.purpose='TEAM_ENTRY' THEN
      IF EXISTS (SELECT 1 FROM public.replacement_requests WHERE flow_id=fid) THEN RAISE EXCEPTION 'Replacement has the wrong flow purpose'; END IF;
      RETURN NEW;
    END IF;
  ELSE fid=NEW.flow_id; END IF;
  SELECT * INTO r FROM public.replacement_requests WHERE flow_id=fid;
  SELECT * INTO f FROM public.entry_flows WHERE id=fid;
  IF r.flow_id IS NULL OR f.id IS NULL OR f.purpose<>'REPLACEMENT' OR NOT EXISTS (
    SELECT 1 FROM public.entry_flows p JOIN public.member_rounds m ON m.id=r.member_round_id
    WHERE p.id=r.parent_flow_id AND p.purpose='TEAM_ENTRY' AND p.round_id=f.round_id AND p.team_id=f.team_id
      AND p.credential_id=f.credential_id AND p.credential_version=f.credential_version AND p.created_at<=f.created_at
      AND r.round_id=f.round_id AND m.enrolled_at<=f.created_at AND m.language IS NOT NULL
  ) THEN RAISE EXCEPTION 'Replacement must bind its verified first-entry proof and enrolled member'; END IF;
  IF TG_TABLE_NAME='replacement_requests' AND TG_OP='INSERT' AND 2<(
    SELECT count(*) FROM public.replacement_requests q JOIN public.entry_flows g ON g.id=q.flow_id
    WHERE q.member_id=r.member_id AND q.state IN ('PENDING','APPROVED') AND g.expires_at>f.created_at
  ) THEN RAISE EXCEPTION 'Too many outstanding member replacements'; END IF;
  IF r.state IN ('PENDING','APPROVED') AND f.state<>'OPEN' THEN RAISE EXCEPTION 'Unconsumed replacement requires an open flow'; END IF;
  IF r.state='PENDING' AND EXISTS (SELECT 1 FROM public.replacement_decisions WHERE flow_id=fid AND outcome='APPLIED') THEN
    RAISE EXCEPTION 'Applied replacement decision cannot remain pending';
  END IF;
  IF r.state IN ('APPROVED','ACTIVATED') AND NOT EXISTS (SELECT 1 FROM public.replacement_decisions WHERE flow_id=fid AND action='APPROVE' AND outcome='APPLIED') THEN
    RAISE EXCEPTION 'Replacement needs its original approval';
  END IF;
  IF r.state='APPROVED' AND NOT EXISTS (SELECT 1 FROM public.member_session_slots WHERE member_id=r.member_id AND reservation_flow_id=fid AND session_id IS NULL AND revision=r.expected_slot_revision+1) THEN
    RAISE EXCEPTION 'Approved request must occupy its exact reserved member slot';
  END IF;
  IF r.state='ACTIVATED' AND NOT EXISTS (SELECT 1 FROM public.participant_sessions WHERE id=f.activated_session_id AND entry_flow_id=fid AND member_round_id=r.member_round_id) THEN
    RAISE EXCEPTION 'Consumed replacement requires its bound session';
  END IF;
  IF r.state='REJECTED' AND (f.state<>'REVOKED' OR NOT EXISTS (SELECT 1 FROM public.replacement_decisions WHERE flow_id=fid AND action='REJECT' AND outcome='APPLIED')) THEN
    RAISE EXCEPTION 'Rejected request needs its staff decision';
  END IF;
  IF r.state IN ('REJECTED','EXPIRED','SUPERSEDED') AND r.proof_ciphertext IS NOT NULL THEN RAISE EXCEPTION 'Retired replacement proof must be purged'; END IF;
  RETURN NEW;
END;
$$;
CREATE CONSTRAINT TRIGGER replacement_binding AFTER INSERT OR UPDATE ON replacement_requests DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_replacement_binding();
CREATE CONSTRAINT TRIGGER replacement_flow_binding AFTER INSERT OR UPDATE ON entry_flows DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_replacement_binding();
--> statement-breakpoint
CREATE FUNCTION validate_member_reservation() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE x public.member_session_slots%ROWTYPE;
BEGIN
  SELECT * INTO x FROM public.member_session_slots WHERE member_id=NEW.member_id;
  IF x.reservation_flow_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.replacement_requests r
    WHERE r.flow_id=x.reservation_flow_id AND r.member_id=x.member_id AND r.state='APPROVED' AND x.revision=r.expected_slot_revision+1) THEN
    RAISE EXCEPTION 'Member reservation must match its approved request';
  END IF;
  IF EXISTS (SELECT 1 FROM public.replacement_requests r WHERE r.member_id=x.member_id AND
    ((r.state='PENDING' AND r.expected_slot_revision<>x.revision) OR (r.state='APPROVED' AND r.flow_id IS DISTINCT FROM x.reservation_flow_id))) THEN
    RAISE EXCEPTION 'Changed member slots must retire stale handoffs';
  END IF;
  RETURN NEW;
END;
$$;
CREATE CONSTRAINT TRIGGER member_reservation_binding AFTER INSERT OR UPDATE ON member_session_slots DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_member_reservation();
--> statement-breakpoint
CREATE FUNCTION guard_replacement_decision() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.staff_sessions s JOIN public.staff_session_slots x ON x.staff_id=s.staff_id AND x.session_id=s.id
    JOIN public.staff_identities i ON i.id=s.staff_id JOIN public.access_credentials c ON c.id=s.credential_id
    WHERE s.id=NEW.session_id AND s.staff_id=NEW.actor_id AND s.mode='NORMAL' AND s.revoked_at IS NULL AND i.disabled_at IS NULL
      AND s.credential_id=NEW.credential_id AND s.credential_version=NEW.credential_version AND c.revoked_at IS NULL
      AND c.issued_at<=NEW.recorded_at AND s.created_at<=NEW.recorded_at AND s.last_activity_at<=NEW.recorded_at
      AND NEW.recorded_at<s.absolute_expires_at AND NEW.recorded_at<s.last_activity_at+interval '15 minutes'
  ) THEN RAISE EXCEPTION 'Replacement decision needs current normal staff authority'; END IF;
  IF NEW.outcome='APPLIED' AND NOT EXISTS (
    SELECT 1 FROM public.replacement_requests r JOIN public.entry_flows f ON f.id=r.flow_id
    JOIN public.member_session_slots x ON x.member_id=r.member_id
    JOIN public.rounds q ON q.id=r.round_id JOIN public.arena_instances a ON a.id=q.arena_instance_id
    JOIN public.arena_control c ON c.id=1 AND c.current_instance_id=a.id JOIN public.access_credentials t ON t.id=f.credential_id
    WHERE r.flow_id=NEW.flow_id AND r.state='PENDING' AND f.state='OPEN' AND r.expected_slot_revision=NEW.expected_revision
      AND x.revision=r.expected_slot_revision AND x.session_id IS NOT DISTINCT FROM r.expected_session_id AND x.reservation_flow_id IS NULL
      AND f.created_at<=NEW.recorded_at AND NEW.recorded_at<f.expires_at
      AND a.status='IN_PROGRESS' AND (q.state='PAUSED' OR (q.state='RUNNING' AND NEW.recorded_at<q.closes_at))
      AND t.revoked_at IS NULL AND t.issued_at<=NEW.recorded_at AND NOT EXISTS (
        SELECT 1 FROM public.access_blocks b WHERE b.arena_instance_id=a.id AND b.cleared_at IS NULL AND (b.team_id=r.team_id OR b.member_id=r.member_id))
  ) THEN RAISE EXCEPTION 'Approval/rejection cannot change a stale request'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER replacement_decision_guard BEFORE INSERT ON replacement_decisions FOR EACH ROW EXECUTE FUNCTION guard_replacement_decision();
--> statement-breakpoint
CREATE FUNCTION validate_replacement_decision_effect() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE r public.replacement_requests%ROWTYPE; x public.member_session_slots%ROWTYPE; f public.entry_flows%ROWTYPE;
BEGIN
  IF NEW.outcome<>'APPLIED' THEN RETURN NEW; END IF;
  SELECT * INTO r FROM public.replacement_requests WHERE flow_id=NEW.flow_id;
  SELECT * INTO x FROM public.member_session_slots WHERE member_id=r.member_id;
  SELECT * INTO f FROM public.entry_flows WHERE id=r.flow_id;
  IF NEW.action='APPROVE' THEN
    IF r.state<>'APPROVED' OR x.reservation_flow_id IS DISTINCT FROM r.flow_id OR x.session_id IS NOT NULL OR x.revision<>r.expected_slot_revision+1
      OR EXISTS (SELECT 1 FROM public.participant_sessions WHERE id=r.expected_session_id AND (revoked_at IS NULL OR revoked_at>NEW.recorded_at))
      OR EXISTS (SELECT 1 FROM public.session_deliveries WHERE session_id=r.expected_session_id AND ciphertext IS NOT NULL) THEN
      RAISE EXCEPTION 'Approval must revoke and reserve exactly the observed member grant';
    END IF;
  ELSIF r.state<>'REJECTED' OR f.state<>'REVOKED' OR r.proof_ciphertext IS NOT NULL
    OR x.session_id IS DISTINCT FROM r.expected_session_id OR x.revision<>r.expected_slot_revision THEN
    RAISE EXCEPTION 'Rejection must leave the observed grant unchanged';
  END IF;
  RETURN NEW;
END;
$$;
CREATE CONSTRAINT TRIGGER replacement_decision_effect AFTER INSERT ON replacement_decisions DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_replacement_decision_effect();
--> statement-breakpoint
REVOKE ALL ON FUNCTION guard_replacement_request(),guard_member_slot_revision(),validate_replacement_binding(),validate_member_reservation(),guard_replacement_decision(),validate_replacement_decision_effect() FROM PUBLIC;
GRANT SELECT,INSERT ON replacement_requests,replacement_decisions TO ingenium_api;
GRANT UPDATE(state,proof_ciphertext,proof_purged_at) ON replacement_requests TO ingenium_api;
GRANT UPDATE(reservation_flow_id) ON member_session_slots TO ingenium_api;
