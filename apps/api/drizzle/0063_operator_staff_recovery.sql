CREATE TABLE "operator_staff_outcomes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"action" text NOT NULL,
	"staff_id" uuid NOT NULL,
	"credential_id" uuid,
	"replacement_session_id" uuid,
	"expected_revision" bigint NOT NULL,
	"fingerprint" "bytea" NOT NULL,
	"operator" text NOT NULL,
	"os_user" text NOT NULL,
	"verification" text NOT NULL,
	"reason" text NOT NULL,
	"recorded_at" timestamp (3) with time zone NOT NULL,
	"before_state" jsonb,
	"after_state" jsonb NOT NULL,
	CONSTRAINT "operator_staff_shape" CHECK ("operator_staff_outcomes"."action" in ('CREATE','ROTATE','DISABLE') and "operator_staff_outcomes"."expected_revision">=0 and octet_length("operator_staff_outcomes"."fingerprint")=32
  and octet_length("operator_staff_outcomes"."operator") between 1 and 120 and length(btrim("operator_staff_outcomes"."operator"))>0
  and octet_length("operator_staff_outcomes"."os_user") between 1 and 120 and length(btrim("operator_staff_outcomes"."os_user"))>0
  and octet_length("operator_staff_outcomes"."verification") between 1 and 1024 and length(btrim("operator_staff_outcomes"."verification"))>0
  and octet_length("operator_staff_outcomes"."reason") between 1 and 1024 and length(btrim("operator_staff_outcomes"."reason"))>0
  and (("operator_staff_outcomes"."action"='CREATE' and "operator_staff_outcomes"."before_state" is null and "operator_staff_outcomes"."credential_id" is not null and "operator_staff_outcomes"."replacement_session_id" is null)
    or ("operator_staff_outcomes"."action"='ROTATE' and "operator_staff_outcomes"."before_state" is not null and "operator_staff_outcomes"."credential_id" is not null and "operator_staff_outcomes"."replacement_session_id" is null)
    or ("operator_staff_outcomes"."action"='DISABLE' and "operator_staff_outcomes"."before_state" is not null and "operator_staff_outcomes"."credential_id" is null and "operator_staff_outcomes"."replacement_session_id" is not null))
  and ("operator_staff_outcomes"."before_state" is null or (jsonb_typeof("operator_staff_outcomes"."before_state")='object' and octet_length("operator_staff_outcomes"."before_state"::text)<=1024))
  and jsonb_typeof("operator_staff_outcomes"."after_state")='object' and octet_length("operator_staff_outcomes"."after_state"::text)<=1024)
);
--> statement-breakpoint
ALTER TABLE "staff_credential_issues" DROP CONSTRAINT "staff_issue_source";--> statement-breakpoint
ALTER TABLE "staff_credential_issues" ADD COLUMN "recovery_id" uuid;--> statement-breakpoint
ALTER TABLE "operator_staff_outcomes" ADD CONSTRAINT "operator_staff_outcomes_staff_id_staff_identities_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff_identities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operator_staff_outcomes" ADD CONSTRAINT "operator_staff_outcomes_credential_id_access_credentials_id_fk" FOREIGN KEY ("credential_id") REFERENCES "public"."access_credentials"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operator_staff_outcomes" ADD CONSTRAINT "operator_staff_outcomes_replacement_session_id_staff_sessions_id_fk" FOREIGN KEY ("replacement_session_id") REFERENCES "public"."staff_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_credential_issues" ADD CONSTRAINT "staff_credential_issues_recovery_id_operator_staff_outcomes_id_fk" FOREIGN KEY ("recovery_id") REFERENCES "public"."operator_staff_outcomes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_credential_issues" ADD CONSTRAINT "recovery_one_credential" UNIQUE("recovery_id");--> statement-breakpoint
ALTER TABLE "staff_credential_issues" ADD CONSTRAINT "staff_issue_source" CHECK (num_nonnulls("staff_credential_issues"."management_id","staff_credential_issues"."bootstrap_id","staff_credential_issues"."recovery_id")=1);
--> statement-breakpoint
CREATE TRIGGER operator_staff_immutable BEFORE UPDATE OR DELETE ON operator_staff_outcomes FOR EACH ROW EXECUTE FUNCTION immutable_access_history();
CREATE FUNCTION operator_staff_outcome_count() RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
  SELECT count(*) FROM public.operator_staff_outcomes;
$$;
REVOKE ALL ON FUNCTION operator_staff_outcome_count() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION operator_staff_outcome_count() TO ingenium_api;
REVOKE ALL ON operator_staff_outcomes FROM PUBLIC,ingenium_api,ingenium_competition_worker,ingenium_app_worker;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION validate_staff_issue() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  IF NEW.management_id IS NOT NULL THEN
    IF NOT EXISTS(SELECT 1 FROM public.staff_management_outcomes m JOIN public.access_credentials c ON c.id=NEW.credential_id
      WHERE m.id=NEW.management_id AND m.outcome='APPLIED' AND m.action IN ('CREATE','ROTATE') AND m.result_credential_id=c.id
        AND c.staff_id=COALESCE(m.result_staff_id,m.target_staff_id) AND c.issued_at=m.recorded_at) THEN RAISE EXCEPTION 'Foreign staff issue source'; END IF;
  ELSIF NEW.recovery_id IS NOT NULL THEN
    IF NOT EXISTS(SELECT 1 FROM public.operator_staff_outcomes o JOIN public.access_credentials c ON c.id=NEW.credential_id
      WHERE o.id=NEW.recovery_id AND o.action IN ('CREATE','ROTATE') AND o.credential_id=c.id
        AND c.staff_id=o.staff_id AND c.issued_at=o.recorded_at) THEN RAISE EXCEPTION 'Foreign operator recovery source'; END IF;
  ELSE
    IF NOT EXISTS(SELECT 1 FROM public.operator_bootstraps b JOIN public.access_credentials c ON c.id=NEW.credential_id
      WHERE b.id=NEW.bootstrap_id AND b.credential_id=c.id AND b.staff_id=c.staff_id AND c.version=1 AND c.issued_at=b.recorded_at) THEN
      RAISE EXCEPTION 'Foreign operator issue source'; END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE FUNCTION validate_operator_staff_effect() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF NEW.after_state IS DISTINCT FROM public.staff_admin_state(NEW.staff_id)
    OR NEW.after_state->>'role' IS DISTINCT FROM 'SUPER_ADMIN'
    OR NEW.after_state->>'staff_id' IS DISTINCT FROM NEW.staff_id::text
    OR (NEW.action='CREATE' AND (NEW.after_state->>'revision' IS DISTINCT FROM '1' OR NEW.after_state->>'code_version' IS DISTINCT FROM '1'))
    OR (NEW.action<>'CREATE' AND (NEW.before_state->>'role' IS DISTINCT FROM 'SUPER_ADMIN'
      OR NEW.before_state->>'staff_id' IS DISTINCT FROM NEW.staff_id::text
      OR NEW.before_state->>'revision' IS DISTINCT FROM NEW.expected_revision::text
      OR (NEW.after_state->>'revision')::bigint<>NEW.expected_revision+1
      OR NEW.after_state->>'display_name' IS DISTINCT FROM NEW.before_state->>'display_name')) THEN
    RAISE EXCEPTION 'Incomplete operator staff effect'; END IF;
  IF NEW.action IN ('CREATE','ROTATE') THEN
    IF NEW.after_state->>'enabled' IS DISTINCT FROM 'true' OR NOT EXISTS(
      SELECT 1 FROM public.access_credentials c JOIN public.staff_credential_issues x ON x.credential_id=c.id AND x.recovery_id=NEW.id
      WHERE c.id=NEW.credential_id AND c.staff_id=NEW.staff_id AND c.revoked_at IS NULL AND c.issued_at=NEW.recorded_at
        AND c.version=CASE WHEN NEW.action='CREATE' THEN 1 ELSE (NEW.before_state->>'code_version')::bigint+1 END)
      THEN RAISE EXCEPTION 'Incomplete operator credential binding'; END IF;
  ELSE
    IF NEW.after_state->>'enabled' IS DISTINCT FROM 'false' OR NEW.before_state->>'enabled' IS DISTINCT FROM 'true'
      OR NOT EXISTS(SELECT 1 FROM public.clock_health WHERE id=1 AND NOT fault_latched)
      OR NEW.after_state->>'code_version' IS DISTINCT FROM NEW.before_state->>'code_version'
      OR EXISTS(SELECT 1 FROM public.access_credentials WHERE staff_id=NEW.staff_id AND revoked_at IS NULL)
      OR NOT EXISTS(SELECT 1 FROM public.staff_sessions s
        JOIN public.staff_session_slots x ON x.staff_id=s.staff_id AND x.session_id=s.id
        JOIN public.staff_identities i ON i.id=s.staff_id
        JOIN public.access_credentials c ON c.id=s.credential_id AND c.staff_id=s.staff_id AND c.version=s.credential_version
        WHERE s.id=NEW.replacement_session_id AND s.staff_id<>NEW.staff_id AND s.mode='NORMAL' AND s.revoked_at IS NULL
          AND i.role='SUPER_ADMIN' AND i.disabled_at IS NULL AND c.revoked_at IS NULL
          AND c.issued_at<=NEW.recorded_at AND s.created_at<=NEW.recorded_at AND s.last_activity_at<=NEW.recorded_at
          AND NEW.recorded_at<s.absolute_expires_at AND NEW.recorded_at<s.last_activity_at+interval '15 minutes') THEN
      RAISE EXCEPTION 'Verified replacement access required before retirement'; END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE CONSTRAINT TRIGGER operator_staff_effect AFTER INSERT ON operator_staff_outcomes DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_operator_staff_effect();
REVOKE ALL ON FUNCTION validate_operator_staff_effect() FROM PUBLIC;
