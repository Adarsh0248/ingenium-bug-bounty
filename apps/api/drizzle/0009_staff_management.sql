CREATE TABLE "operator_bootstraps" (
	"id" uuid PRIMARY KEY NOT NULL,
	"control_id" integer NOT NULL,
	"request_key" uuid NOT NULL,
	"operator" text NOT NULL,
	"os_user" text NOT NULL,
	"reason" text NOT NULL,
	"recorded_at" timestamp (3) with time zone NOT NULL,
	"staff_id" uuid NOT NULL,
	"credential_id" uuid NOT NULL,
	CONSTRAINT "first_super_admin_once" UNIQUE("control_id"),
	CONSTRAINT "operator_bootstrap_intent" UNIQUE("request_key"),
	CONSTRAINT "operator_bootstrap_shape" CHECK ("operator_bootstraps"."control_id"=1
  and octet_length("operator_bootstraps"."operator") between 1 and 120 and octet_length("operator_bootstraps"."os_user") between 1 and 120
  and octet_length("operator_bootstraps"."reason") between 1 and 1024 and length(btrim("operator_bootstraps"."reason"))>0)
);
--> statement-breakpoint
CREATE TABLE "staff_credential_issues" (
	"credential_id" uuid PRIMARY KEY NOT NULL,
	"management_id" uuid,
	"bootstrap_id" uuid,
	CONSTRAINT "management_one_credential" UNIQUE("management_id"),
	CONSTRAINT "bootstrap_one_credential" UNIQUE("bootstrap_id"),
	CONSTRAINT "staff_issue_source" CHECK (num_nonnulls("staff_credential_issues"."management_id","staff_credential_issues"."bootstrap_id")=1)
);
--> statement-breakpoint
CREATE TABLE "staff_management_outcomes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"actor_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"credential_id" uuid NOT NULL,
	"credential_version" bigint NOT NULL,
	"control_id" integer NOT NULL,
	"target_staff_id" uuid,
	"action" text NOT NULL,
	"request_key" uuid NOT NULL,
	"fingerprint" "bytea" NOT NULL,
	"expected_revision" bigint NOT NULL,
	"display_name" text,
	"role" text,
	"enabled" boolean,
	"reason" text NOT NULL,
	"outcome" text NOT NULL,
	"denial_reason" text,
	"recorded_at" timestamp (3) with time zone NOT NULL,
	"result_staff_id" uuid,
	"result_credential_id" uuid,
	"before_state" jsonb,
	"after_state" jsonb,
	CONSTRAINT "staff_manage_intent" UNIQUE("actor_id","action","target_staff_id","request_key"),
	CONSTRAINT "staff_management_shape" CHECK ("staff_management_outcomes"."control_id"=1 and "staff_management_outcomes"."expected_revision">=0 and octet_length("staff_management_outcomes"."fingerprint")=32
    and octet_length("staff_management_outcomes"."reason") between 1 and 1024 and length(btrim("staff_management_outcomes"."reason"))>0
    and "staff_management_outcomes"."action" in ('CREATE','UPDATE','ROTATE') and "staff_management_outcomes"."outcome" in ('APPLIED','UNCHANGED','REJECTED')
    and (("staff_management_outcomes"."outcome"='REJECTED' and "staff_management_outcomes"."denial_reason" in ('STALE_VERSION','STAFF_CAPACITY')) or ("staff_management_outcomes"."outcome"<>'REJECTED' and "staff_management_outcomes"."denial_reason" is null))
    and (("staff_management_outcomes"."action"='CREATE' and "staff_management_outcomes"."target_staff_id" is null and "staff_management_outcomes"."display_name" is not null and "staff_management_outcomes"."role" is not null and "staff_management_outcomes"."enabled"=true)
      or ("staff_management_outcomes"."action"='UPDATE' and "staff_management_outcomes"."target_staff_id" is not null and "staff_management_outcomes"."display_name" is not null and "staff_management_outcomes"."role" is not null and "staff_management_outcomes"."enabled" is not null)
      or ("staff_management_outcomes"."action"='ROTATE' and "staff_management_outcomes"."target_staff_id" is not null and "staff_management_outcomes"."display_name" is null and "staff_management_outcomes"."role" is null and "staff_management_outcomes"."enabled" is null))
    and ("staff_management_outcomes"."display_name" is null or (octet_length("staff_management_outcomes"."display_name") between 1 and 120 and length(btrim("staff_management_outcomes"."display_name"))>0))
    and ("staff_management_outcomes"."role" is null or "staff_management_outcomes"."role" in ('OWNER','ORGANISER'))
    and (("staff_management_outcomes"."action"='CREATE' and "staff_management_outcomes"."outcome"='APPLIED' and "staff_management_outcomes"."result_staff_id" is not null) or (("staff_management_outcomes"."action"<>'CREATE' or "staff_management_outcomes"."outcome"<>'APPLIED') and "staff_management_outcomes"."result_staff_id" is null))
    and (("staff_management_outcomes"."action" in ('CREATE','ROTATE') and "staff_management_outcomes"."outcome"='APPLIED' and "staff_management_outcomes"."result_credential_id" is not null)
      or (("staff_management_outcomes"."action"='UPDATE' or "staff_management_outcomes"."outcome"<>'APPLIED') and "staff_management_outcomes"."result_credential_id" is null))
    and ("staff_management_outcomes"."action"='UPDATE' or "staff_management_outcomes"."outcome"<>'UNCHANGED')
    and ("staff_management_outcomes"."before_state" is null or (jsonb_typeof("staff_management_outcomes"."before_state")='object' and octet_length("staff_management_outcomes"."before_state"::text)<=1024))
    and ("staff_management_outcomes"."after_state" is null or (jsonb_typeof("staff_management_outcomes"."after_state")='object' and octet_length("staff_management_outcomes"."after_state"::text)<=1024)))
);
--> statement-breakpoint
ALTER TABLE "staff_identities" DROP CONSTRAINT "staff_identity_name";--> statement-breakpoint
ALTER TABLE "staff_identities" ADD COLUMN "revision" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "operator_bootstraps" ADD CONSTRAINT "operator_bootstraps_control_id_security_control_id_fk" FOREIGN KEY ("control_id") REFERENCES "public"."security_control"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operator_bootstraps" ADD CONSTRAINT "operator_bootstraps_staff_id_staff_identities_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff_identities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operator_bootstraps" ADD CONSTRAINT "operator_bootstraps_credential_id_access_credentials_id_fk" FOREIGN KEY ("credential_id") REFERENCES "public"."access_credentials"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_credential_issues" ADD CONSTRAINT "staff_credential_issues_credential_id_access_credentials_id_fk" FOREIGN KEY ("credential_id") REFERENCES "public"."access_credentials"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_credential_issues" ADD CONSTRAINT "staff_credential_issues_management_id_staff_management_outcomes_id_fk" FOREIGN KEY ("management_id") REFERENCES "public"."staff_management_outcomes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_credential_issues" ADD CONSTRAINT "staff_credential_issues_bootstrap_id_operator_bootstraps_id_fk" FOREIGN KEY ("bootstrap_id") REFERENCES "public"."operator_bootstraps"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_management_outcomes" ADD CONSTRAINT "staff_management_outcomes_control_id_security_control_id_fk" FOREIGN KEY ("control_id") REFERENCES "public"."security_control"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_management_outcomes" ADD CONSTRAINT "staff_management_outcomes_target_staff_id_staff_identities_id_fk" FOREIGN KEY ("target_staff_id") REFERENCES "public"."staff_identities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_management_outcomes" ADD CONSTRAINT "staff_management_outcomes_result_staff_id_staff_identities_id_fk" FOREIGN KEY ("result_staff_id") REFERENCES "public"."staff_identities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_management_outcomes" ADD CONSTRAINT "staff_management_outcomes_result_credential_id_access_credentials_id_fk" FOREIGN KEY ("result_credential_id") REFERENCES "public"."access_credentials"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_management_outcomes" ADD CONSTRAINT "staff_management_session_actor" FOREIGN KEY ("session_id","actor_id") REFERENCES "public"."staff_sessions"("id","staff_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_management_outcomes" ADD CONSTRAINT "staff_management_credential_actor" FOREIGN KEY ("credential_id","credential_version","actor_id") REFERENCES "public"."access_credentials"("id","version","staff_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "staff_create_intent" ON "staff_management_outcomes" USING btree ("actor_id","action","request_key") WHERE "staff_management_outcomes"."target_staff_id" is null;--> statement-breakpoint
ALTER TABLE "staff_identities" ADD CONSTRAINT "staff_identity_name" CHECK (octet_length("staff_identities"."display_name") between 1 and 120 and length(btrim("staff_identities"."display_name")) > 0 and "staff_identities"."revision">=0);