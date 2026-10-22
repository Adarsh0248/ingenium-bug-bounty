CREATE TABLE "team_management_outcomes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"actor_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"credential_id" uuid NOT NULL,
	"credential_version" bigint NOT NULL,
	"request_key" uuid NOT NULL,
	"action" text NOT NULL,
	"target_team_id" uuid,
	"expected_revision" bigint NOT NULL,
	"fingerprint" "bytea" NOT NULL,
	"reason" text NOT NULL,
	"outcome" text NOT NULL,
	"denial_reason" text,
	"result_team_id" uuid,
	"result_credential_id" uuid,
	"code_version" bigint,
	"recorded_at" timestamp (3) with time zone NOT NULL,
	CONSTRAINT "team_management_intent" UNIQUE("actor_id","request_key"),
	CONSTRAINT "team_management_issued_credential" UNIQUE("result_credential_id"),
	CONSTRAINT "team_management_shape" CHECK ("team_management_outcomes"."expected_revision">=0 and octet_length("team_management_outcomes"."fingerprint")=32
    and octet_length("team_management_outcomes"."reason") between 1 and 1024 and btrim("team_management_outcomes"."reason")<>''
    and (("team_management_outcomes"."action"='CREATE' and "team_management_outcomes"."target_team_id" is null) or ("team_management_outcomes"."action"='ROTATE' and "team_management_outcomes"."target_team_id" is not null))
    and (("team_management_outcomes"."outcome"='APPLIED' and "team_management_outcomes"."denial_reason" is null and "team_management_outcomes"."result_team_id" is not null and "team_management_outcomes"."result_credential_id" is not null and "team_management_outcomes"."code_version">0)
      or ("team_management_outcomes"."outcome"='REJECTED' and "team_management_outcomes"."denial_reason" is not null and "team_management_outcomes"."denial_reason" in ('STALE_VERSION','TEAM_CAPACITY','TEAM_INCOMPLETE')
        and "team_management_outcomes"."result_team_id" is null and "team_management_outcomes"."result_credential_id" is null and "team_management_outcomes"."code_version" is null)))
);
--> statement-breakpoint
ALTER TABLE "team_management_outcomes" ADD CONSTRAINT "team_management_outcomes_target_team_id_teams_id_fk" FOREIGN KEY ("target_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_management_outcomes" ADD CONSTRAINT "team_management_outcomes_result_team_id_teams_id_fk" FOREIGN KEY ("result_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_management_outcomes" ADD CONSTRAINT "team_management_outcomes_result_credential_id_access_credentials_id_fk" FOREIGN KEY ("result_credential_id") REFERENCES "public"."access_credentials"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_management_outcomes" ADD CONSTRAINT "team_management_session_actor" FOREIGN KEY ("session_id","actor_id") REFERENCES "public"."staff_sessions"("id","staff_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_management_outcomes" ADD CONSTRAINT "team_management_credential_actor" FOREIGN KEY ("credential_id","credential_version","actor_id") REFERENCES "public"."access_credentials"("id","version","staff_id") ON DELETE no action ON UPDATE no action;