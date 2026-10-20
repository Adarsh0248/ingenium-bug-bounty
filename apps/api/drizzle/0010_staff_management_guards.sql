ALTER TABLE staff_management_outcomes ALTER CONSTRAINT staff_management_outcomes_result_staff_id_staff_identities_id_fk DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE staff_management_outcomes ALTER CONSTRAINT staff_management_outcomes_result_credential_id_access_credentials_id_fk DEFERRABLE INITIALLY DEFERRED;
CREATE TRIGGER staff_management_immutable BEFORE UPDATE OR DELETE ON staff_management_outcomes FOR EACH ROW EXECUTE FUNCTION immutable_access_history();
CREATE TRIGGER operator_bootstrap_immutable BEFORE UPDATE OR DELETE ON operator_bootstraps FOR EACH ROW EXECUTE FUNCTION immutable_access_history();
CREATE TRIGGER staff_issue_immutable BEFORE UPDATE OR DELETE ON staff_credential_issues FOR EACH ROW EXECUTE FUNCTION immutable_access_history();
--> statement-breakpoint
CREATE FUNCTION staff_admin_state(subject uuid) RETURNS jsonb LANGUAGE sql STABLE SET search_path=pg_catalog,public AS $$
  SELECT jsonb_build_object('staff_id',i.id,'display_name',i.display_name,'role',i.role,'enabled',i.disabled_at IS NULL,'revision',i.revision::text,
    'code_version',COALESCE((SELECT max(c.version) FROM public.access_credentials c WHERE c.staff_id=i.id),0)::text)
  FROM public.staff_identities i WHERE i.id=subject;
$$;
CREATE FUNCTION validate_staff_management() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.staff_sessions s JOIN public.staff_session_slots x ON x.staff_id=s.staff_id AND x.session_id=s.id
    JOIN public.staff_identities i ON i.id=s.staff_id JOIN public.access_credentials c ON c.id=s.credential_id AND c.version=s.credential_version AND c.staff_id=s.staff_id
    WHERE s.id=NEW.session_id AND s.staff_id=NEW.actor_id AND s.credential_id=NEW.credential_id AND s.credential_version=NEW.credential_version
      AND s.mode='NORMAL' AND s.revoked_at IS NULL AND i.role='SUPER_ADMIN' AND i.disabled_at IS NULL AND c.revoked_at IS NULL
      AND c.issued_at<=NEW.recorded_at AND s.created_at<=NEW.recorded_at AND s.last_activity_at<=NEW.recorded_at
      AND NEW.recorded_at<s.absolute_expires_at AND NEW.recorded_at<s.last_activity_at+interval '15 minutes') THEN RAISE EXCEPTION 'Current Super Admin authority required'; END IF;
  IF NEW.target_staff_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.staff_identities WHERE id=NEW.target_staff_id AND role IN ('OWNER','ORGANISER')) THEN
    RAISE EXCEPTION 'Browser staff management cannot target Super Admins'; END IF;
  IF NEW.before_state IS DISTINCT FROM public.staff_admin_state(NEW.target_staff_id) THEN RAISE EXCEPTION 'Staff before-state changed'; END IF;
  IF NEW.outcome='REJECTED' AND (NEW.denial_reason IS NULL OR NEW.after_state IS DISTINCT FROM NEW.before_state) THEN RAISE EXCEPTION 'Invalid rejection snapshot'; END IF;
  IF NEW.outcome='UNCHANGED' AND (NEW.action<>'UPDATE' OR NEW.after_state IS DISTINCT FROM NEW.before_state) THEN RAISE EXCEPTION 'Invalid unchanged snapshot'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER staff_management_authority BEFORE INSERT ON staff_management_outcomes FOR EACH ROW EXECUTE FUNCTION validate_staff_management();
--> statement-breakpoint
CREATE FUNCTION apply_staff_management(source_id uuid,new_verifier bytea) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE source public.staff_management_outcomes%ROWTYPE; current_revision bigint; next_version bigint; subject uuid;
BEGIN
  PERFORM id FROM public.security_control WHERE id=1 FOR UPDATE;
  SELECT * INTO source FROM public.staff_management_outcomes WHERE id=source_id;
  IF NOT FOUND OR source.outcome<>'APPLIED' THEN RAISE EXCEPTION 'Applied staff source required'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.staff_sessions s JOIN public.staff_session_slots x ON x.staff_id=s.staff_id AND x.session_id=s.id
    JOIN public.staff_identities i ON i.id=s.staff_id JOIN public.access_credentials c ON c.id=s.credential_id AND c.version=s.credential_version
    WHERE s.id=source.session_id AND s.staff_id=source.actor_id AND i.role='SUPER_ADMIN' AND i.disabled_at IS NULL AND c.revoked_at IS NULL
      AND s.mode='NORMAL' AND s.revoked_at IS NULL AND clock_timestamp()<s.absolute_expires_at AND clock_timestamp()<s.last_activity_at+interval '15 minutes') THEN
    RAISE EXCEPTION 'Super Admin authority changed before effect'; END IF;
  IF source.before_state IS DISTINCT FROM public.staff_admin_state(source.target_staff_id) THEN RAISE EXCEPTION 'Staff source already applied or stale'; END IF;
  IF source.action='CREATE' THEN
    SELECT revision INTO current_revision FROM public.security_control WHERE id=1;
    IF current_revision<>source.expected_revision OR source.result_staff_id IS NULL THEN RAISE EXCEPTION 'Stale security revision'; END IF;
    subject=source.result_staff_id;
    INSERT INTO public.staff_identities(id,display_name,role,revision) VALUES(subject,source.display_name,source.role,1);
  ELSE
    SELECT revision INTO current_revision FROM public.staff_identities WHERE id=source.target_staff_id AND role IN ('OWNER','ORGANISER') FOR UPDATE;
    IF NOT FOUND OR current_revision<>source.expected_revision THEN RAISE EXCEPTION 'Stale or privileged staff target'; END IF;
    subject=source.target_staff_id;
    IF source.action='UPDATE' THEN
      UPDATE public.staff_identities SET display_name=source.display_name,role=source.role,
        disabled_at=CASE WHEN source.enabled THEN NULL ELSE COALESCE(disabled_at,source.recorded_at) END,revision=revision+1 WHERE id=subject;
    ELSE UPDATE public.staff_identities SET revision=revision+1 WHERE id=subject; END IF;
  END IF;
  IF (SELECT count(*) FROM public.staff_identities WHERE disabled_at IS NULL)>50 THEN RAISE EXCEPTION 'Active staff capacity exceeded'; END IF;
  IF source.action IN ('CREATE','ROTATE') THEN
    IF new_verifier IS NULL OR octet_length(new_verifier)<>32 OR source.result_credential_id IS NULL THEN RAISE EXCEPTION 'Fresh credential required'; END IF;
    SELECT COALESCE(max(version),0)+1 INTO next_version FROM public.access_credentials WHERE staff_id=subject;
    UPDATE public.access_credentials SET revoked_at=source.recorded_at WHERE staff_id=subject AND revoked_at IS NULL;
    INSERT INTO public.access_credentials(id,staff_id,verifier,version,issued_at) VALUES(source.result_credential_id,subject,new_verifier,next_version,source.recorded_at);
    INSERT INTO public.staff_credential_issues(credential_id,management_id) VALUES(source.result_credential_id,source.id);
  ELSIF new_verifier IS NOT NULL OR source.result_credential_id IS NOT NULL THEN RAISE EXCEPTION 'Unexpected credential'; END IF;
  IF source.after_state IS DISTINCT FROM public.staff_admin_state(subject) THEN RAISE EXCEPTION 'Staff effect snapshot mismatch'; END IF;
  UPDATE public.security_control SET revision=revision+1 WHERE id=1;
END;
$$;
CREATE FUNCTION validate_staff_management_effect() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF NEW.outcome='APPLIED' AND NEW.after_state IS DISTINCT FROM public.staff_admin_state(COALESCE(NEW.result_staff_id,NEW.target_staff_id)) THEN
    RAISE EXCEPTION 'Staff source requires its committed effect'; END IF;
  IF NEW.result_credential_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.staff_credential_issues x JOIN public.access_credentials c ON c.id=x.credential_id
    WHERE x.management_id=NEW.id AND c.id=NEW.result_credential_id AND c.staff_id=COALESCE(NEW.result_staff_id,NEW.target_staff_id)
      AND c.issued_at=NEW.recorded_at AND c.revoked_at IS NULL) THEN RAISE EXCEPTION 'Staff issuance binding is incomplete'; END IF;
  RETURN NEW;
END;
$$;
CREATE CONSTRAINT TRIGGER staff_management_effect AFTER INSERT ON staff_management_outcomes DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_staff_management_effect();
--> statement-breakpoint
CREATE FUNCTION lock_staff_security() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  PERFORM id FROM public.security_control WHERE id=1 FOR UPDATE;
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Staff identity history cannot be deleted'; END IF;
  IF TG_TABLE_NAME='staff_identities' THEN
    IF NEW.id<>OLD.id OR NEW.revision<OLD.revision THEN RAISE EXCEPTION 'Staff identity/revision cannot reset'; END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER staff_security_lock BEFORE UPDATE OR DELETE ON staff_identities FOR EACH ROW EXECUTE FUNCTION lock_staff_security();
CREATE TRIGGER staff_credential_security_lock BEFORE UPDATE ON access_credentials FOR EACH ROW WHEN (NEW.staff_id IS NOT NULL) EXECUTE FUNCTION lock_staff_security();
CREATE FUNCTION preserve_last_super_admin() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE relevant boolean;
BEGIN
  IF TG_TABLE_NAME='staff_identities' THEN relevant=OLD.role='SUPER_ADMIN' AND OLD.disabled_at IS NULL AND (NEW.role<>'SUPER_ADMIN' OR NEW.disabled_at IS NOT NULL);
  ELSE relevant=OLD.revoked_at IS NULL AND NEW.revoked_at IS NOT NULL AND EXISTS(SELECT 1 FROM public.staff_identities WHERE id=NEW.staff_id AND role='SUPER_ADMIN' AND disabled_at IS NULL); END IF;
  IF relevant AND NOT EXISTS(SELECT 1 FROM public.staff_identities i JOIN public.access_credentials c ON c.staff_id=i.id AND c.revoked_at IS NULL
    WHERE i.role='SUPER_ADMIN' AND i.disabled_at IS NULL) THEN RAISE EXCEPTION 'Cannot remove the last usable Super Admin'; END IF;
  RETURN NEW;
END;
$$;
CREATE CONSTRAINT TRIGGER last_super_admin_identity AFTER UPDATE ON staff_identities DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION preserve_last_super_admin();
CREATE CONSTRAINT TRIGGER last_super_admin_credential AFTER UPDATE ON access_credentials DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION preserve_last_super_admin();
DROP TRIGGER staff_identity_access_changed ON staff_identities;
CREATE TRIGGER staff_identity_access_changed AFTER UPDATE OF display_name,role,disabled_at ON staff_identities FOR EACH ROW
  WHEN (OLD.display_name IS DISTINCT FROM NEW.display_name OR OLD.role IS DISTINCT FROM NEW.role OR OLD.disabled_at IS DISTINCT FROM NEW.disabled_at) EXECUTE FUNCTION revoke_changed_staff_access();
CREATE FUNCTION validate_staff_issue() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  IF NEW.management_id IS NOT NULL THEN
    IF NOT EXISTS(SELECT 1 FROM public.staff_management_outcomes m JOIN public.access_credentials c ON c.id=NEW.credential_id
      WHERE m.id=NEW.management_id AND m.outcome='APPLIED' AND m.action IN ('CREATE','ROTATE') AND m.result_credential_id=c.id
        AND c.staff_id=COALESCE(m.result_staff_id,m.target_staff_id) AND c.issued_at=m.recorded_at) THEN RAISE EXCEPTION 'Foreign staff issue source'; END IF;
  ELSE
    IF NOT EXISTS(SELECT 1 FROM public.operator_bootstraps b JOIN public.access_credentials c ON c.id=NEW.credential_id
      WHERE b.id=NEW.bootstrap_id AND b.credential_id=c.id AND b.staff_id=c.staff_id AND c.version=1 AND c.issued_at=b.recorded_at) THEN
      RAISE EXCEPTION 'Foreign operator issue source'; END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE CONSTRAINT TRIGGER staff_issue_binding AFTER INSERT ON staff_credential_issues DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_staff_issue();
CREATE FUNCTION validate_operator_bootstrap() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.staff_identities i JOIN public.access_credentials c ON c.staff_id=i.id
    JOIN public.staff_credential_issues x ON x.credential_id=c.id AND x.bootstrap_id=NEW.id
    WHERE i.id=NEW.staff_id AND i.role='SUPER_ADMIN' AND i.disabled_at IS NULL AND c.id=NEW.credential_id AND c.version=1
      AND c.issued_at=NEW.recorded_at AND c.revoked_at IS NULL) THEN RAISE EXCEPTION 'Incomplete first Super Admin binding'; END IF;
  RETURN NEW;
END;
$$;
CREATE CONSTRAINT TRIGGER operator_bootstrap_binding AFTER INSERT ON operator_bootstraps DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_operator_bootstrap();
--> statement-breakpoint
REVOKE ALL ON FUNCTION staff_admin_state(uuid),validate_staff_management(),apply_staff_management(uuid,bytea),validate_staff_management_effect(),lock_staff_security(),preserve_last_super_admin(),validate_staff_issue(),validate_operator_bootstrap() FROM PUBLIC;
GRANT SELECT,INSERT ON staff_management_outcomes TO ingenium_api;
GRANT SELECT ON staff_credential_issues TO ingenium_api;
GRANT EXECUTE ON FUNCTION staff_admin_state(uuid),apply_staff_management(uuid,bytea) TO ingenium_api;
