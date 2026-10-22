CREATE TABLE "validation_diagnostic_audits" (
	"id" uuid PRIMARY KEY NOT NULL,
	"run_id" uuid NOT NULL,
	"attempt_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"credential_id" uuid NOT NULL,
	"credential_version" bigint NOT NULL,
	"request_key" uuid NOT NULL,
	"fingerprint" "bytea" NOT NULL,
	"reason" text NOT NULL,
	"result_digest" "bytea" NOT NULL,
	"recorded_at" timestamp (3) with time zone NOT NULL,
	CONSTRAINT "validation_diagnostic_intent" UNIQUE("actor_id","run_id","request_key"),
	CONSTRAINT "validation_diagnostic_shape" CHECK (octet_length("validation_diagnostic_audits"."fingerprint")=32 and octet_length("validation_diagnostic_audits"."result_digest")=32 and octet_length("validation_diagnostic_audits"."reason") between 1 and 1024 and length(btrim("validation_diagnostic_audits"."reason"))>0)
);
--> statement-breakpoint
ALTER TABLE "validation_diagnostic_audits" ADD CONSTRAINT "validation_diagnostic_audits_run_id_validation_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."validation_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_diagnostic_audits" ADD CONSTRAINT "validation_diagnostic_audits_attempt_id_authoring_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."authoring_attempts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_diagnostic_audits" ADD CONSTRAINT "validation_diagnostic_session" FOREIGN KEY ("session_id","actor_id") REFERENCES "public"."staff_sessions"("id","staff_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_diagnostic_audits" ADD CONSTRAINT "validation_diagnostic_credential" FOREIGN KEY ("credential_id","credential_version","actor_id") REFERENCES "public"."access_credentials"("id","version","staff_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "validation_diagnostic_history" ON "validation_diagnostic_audits" USING btree ("run_id","recorded_at","id");
--> statement-breakpoint
CREATE TRIGGER validation_diagnostic_immutable BEFORE UPDATE OR DELETE ON validation_diagnostic_audits FOR EACH ROW EXECUTE FUNCTION immutable_access_history();
CREATE FUNCTION validate_validation_diagnostic() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  PERFORM id FROM public.security_control WHERE id=1 FOR UPDATE;
  IF NOT EXISTS(SELECT 1 FROM public.staff_sessions s
    JOIN public.staff_session_slots x ON x.staff_id=s.staff_id AND x.session_id=s.id
    JOIN public.staff_identities i ON i.id=s.staff_id
    JOIN public.access_credentials c ON c.id=s.credential_id AND c.staff_id=s.staff_id AND c.version=s.credential_version
    WHERE s.id=NEW.session_id AND s.staff_id=NEW.actor_id AND s.credential_id=NEW.credential_id AND s.credential_version=NEW.credential_version
      AND s.mode='NORMAL' AND s.revoked_at IS NULL AND i.disabled_at IS NULL AND i.role IN ('OWNER','SUPER_ADMIN') AND c.revoked_at IS NULL
      AND c.issued_at<=NEW.recorded_at AND s.created_at<=NEW.recorded_at AND s.last_activity_at<=NEW.recorded_at
      AND NEW.recorded_at<s.absolute_expires_at AND NEW.recorded_at<s.last_activity_at+interval '15 minutes') THEN
    RAISE EXCEPTION 'Current diagnostic-review authority required'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.authoring_attempts a JOIN public.authoring_checks c ON c.id=a.check_id
    WHERE a.id=NEW.attempt_id AND c.run_id=NEW.run_id AND a.resolved_at IS NOT NULL AND a.result_digest=NEW.result_digest) THEN
    RAISE EXCEPTION 'Foreign or unresolved validation evidence'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER validation_diagnostic_authority BEFORE INSERT ON validation_diagnostic_audits FOR EACH ROW EXECUTE FUNCTION validate_validation_diagnostic();
REVOKE ALL ON FUNCTION validate_validation_diagnostic() FROM PUBLIC;
GRANT SELECT,INSERT ON validation_diagnostic_audits TO ingenium_api;
