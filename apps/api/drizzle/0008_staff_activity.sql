CREATE TABLE "staff_keep_alive_outcomes" (
	"session_id" uuid NOT NULL,
	"request_key" uuid NOT NULL,
	"recorded_at" timestamp (3) with time zone NOT NULL,
	CONSTRAINT "staff_keep_alive_outcomes_session_id_request_key_pk" PRIMARY KEY("session_id","request_key")
);
--> statement-breakpoint
ALTER TABLE "staff_sessions" DROP CONSTRAINT "staff_session_lifetime";--> statement-breakpoint
ALTER TABLE "staff_keep_alive_outcomes" ADD CONSTRAINT "staff_keep_alive_outcomes_session_id_staff_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."staff_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_sessions" ADD CONSTRAINT "staff_session_lifetime" CHECK (octet_length("staff_sessions"."secret_verifier")=32 and "staff_sessions"."absolute_expires_at"="staff_sessions"."created_at"+interval '8 hours'
    and "staff_sessions"."last_activity_at">="staff_sessions"."created_at" and "staff_sessions"."last_activity_at"<"staff_sessions"."absolute_expires_at"
    and "staff_sessions"."mode" in ('NORMAL','CLOCK_RECOVERY') and "staff_sessions"."generation">=0 and ("staff_sessions"."mode"<>'CLOCK_RECOVERY' or "staff_sessions"."generation">0)
    and (("staff_sessions"."revoked_at" is null and "staff_sessions"."revocation_reason" is null) or ("staff_sessions"."revoked_at" is not null and "staff_sessions"."revoked_at">="staff_sessions"."created_at" and "staff_sessions"."revocation_reason" is not null)));
--> statement-breakpoint
CREATE TRIGGER staff_keep_alive_immutable BEFORE UPDATE OR DELETE ON staff_keep_alive_outcomes FOR EACH ROW EXECUTE FUNCTION immutable_access_history();
GRANT SELECT,INSERT ON staff_keep_alive_outcomes TO ingenium_api;
CREATE FUNCTION revoke_changed_staff_access() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE owner_id uuid; changed_credential uuid; observed timestamptz;
BEGIN
  IF TG_TABLE_NAME='staff_identities' THEN owner_id=NEW.id;
  ELSE owner_id=NEW.staff_id; changed_credential=NEW.id; END IF;
  IF owner_id IS NULL THEN RETURN NEW; END IF;
  PERFORM id FROM public.security_control WHERE id=1 FOR UPDATE;
  observed=date_trunc('milliseconds',clock_timestamp());
  UPDATE public.staff_sessions SET revoked_at=observed,revocation_reason='ACCESS_CHANGED'
    WHERE staff_id=owner_id AND revoked_at IS NULL AND (changed_credential IS NULL OR staff_sessions.credential_id=changed_credential);
  UPDATE public.staff_entry_flows SET state='REVOKED' WHERE staff_id=owner_id AND state IN ('OPEN','ACTIVATED')
    AND (changed_credential IS NULL OR staff_entry_flows.credential_id=changed_credential);
  UPDATE public.staff_session_deliveries d SET ciphertext=NULL,purged_at=observed FROM public.staff_sessions s
    WHERE s.id=d.session_id AND s.staff_id=owner_id AND s.revoked_at IS NOT NULL AND d.ciphertext IS NOT NULL;
  RETURN NEW;
END;
$$;
CREATE TRIGGER staff_identity_access_changed AFTER UPDATE OF role,disabled_at ON staff_identities FOR EACH ROW
  WHEN (OLD.role IS DISTINCT FROM NEW.role OR OLD.disabled_at IS DISTINCT FROM NEW.disabled_at) EXECUTE FUNCTION revoke_changed_staff_access();
CREATE TRIGGER staff_credential_access_changed AFTER UPDATE OF revoked_at ON access_credentials FOR EACH ROW
  WHEN (OLD.revoked_at IS NULL AND NEW.revoked_at IS NOT NULL AND NEW.staff_id IS NOT NULL) EXECUTE FUNCTION revoke_changed_staff_access();
REVOKE ALL ON FUNCTION revoke_changed_staff_access() FROM PUBLIC;
