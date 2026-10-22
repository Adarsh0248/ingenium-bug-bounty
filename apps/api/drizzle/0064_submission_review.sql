CREATE TABLE "submission_review_audits" (
	"id" uuid PRIMARY KEY NOT NULL,
	"parent_id" uuid NOT NULL,
	"round_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"credential_id" uuid NOT NULL,
	"credential_version" bigint NOT NULL,
	"request_key" uuid NOT NULL,
	"fingerprint" "bytea" NOT NULL,
	"reason" text NOT NULL,
	"source_digest" "bytea" NOT NULL,
	"attempt_id" uuid,
	"result_digest" "bytea",
	"recorded_at" timestamp (3) with time zone NOT NULL,
	CONSTRAINT "submission_review_intent" UNIQUE("actor_id","parent_id","request_key"),
	CONSTRAINT "submission_review_shape" CHECK (octet_length("submission_review_audits"."fingerprint")=32 and octet_length("submission_review_audits"."source_digest")=32
    and octet_length("submission_review_audits"."reason") between 1 and 1024 and length(btrim("submission_review_audits"."reason"))>0
    and (("submission_review_audits"."attempt_id" is null and "submission_review_audits"."result_digest" is null) or ("submission_review_audits"."attempt_id" is not null and "submission_review_audits"."result_digest" is not null and octet_length("submission_review_audits"."result_digest")=32)))
);
--> statement-breakpoint
ALTER TABLE "submission_review_audits" ADD CONSTRAINT "submission_review_audits_parent_id_participant_judging_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."participant_judging"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_review_audits" ADD CONSTRAINT "submission_review_audits_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_review_audits" ADD CONSTRAINT "submission_review_audits_actor_id_staff_identities_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."staff_identities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_review_audits" ADD CONSTRAINT "submission_review_audits_attempt_id_participant_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."participant_attempts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_review_audits" ADD CONSTRAINT "submission_review_session_actor" FOREIGN KEY ("session_id","actor_id") REFERENCES "public"."staff_sessions"("id","staff_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_review_audits" ADD CONSTRAINT "submission_review_credential_actor" FOREIGN KEY ("credential_id","credential_version","actor_id") REFERENCES "public"."access_credentials"("id","version","staff_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "submission_review_history" ON "submission_review_audits" USING btree ("parent_id","recorded_at","id");
--> statement-breakpoint
CREATE TRIGGER submission_review_immutable BEFORE UPDATE OR DELETE ON submission_review_audits FOR EACH ROW EXECUTE FUNCTION immutable_access_history();
CREATE FUNCTION validate_submission_review() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
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
    RAISE EXCEPTION 'Current private-review authority required'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.participant_judging p WHERE p.id=NEW.parent_id AND p.round_id=NEW.round_id AND sha256(p.source)=NEW.source_digest) THEN
    RAISE EXCEPTION 'Foreign submitted program'; END IF;
  IF NEW.attempt_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.participant_attempts a JOIN public.participant_jobs j ON j.id=a.job_id
    WHERE a.id=NEW.attempt_id AND j.parent_id=NEW.parent_id AND a.resolved_at IS NOT NULL AND a.result_digest=NEW.result_digest) THEN
    RAISE EXCEPTION 'Foreign or unresolved diagnostic evidence'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER submission_review_authority BEFORE INSERT ON submission_review_audits FOR EACH ROW EXECUTE FUNCTION validate_submission_review();
REVOKE ALL ON FUNCTION validate_submission_review() FROM PUBLIC;
GRANT SELECT,INSERT ON submission_review_audits TO ingenium_api;
