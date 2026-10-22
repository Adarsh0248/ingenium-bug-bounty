CREATE TABLE "registration_import_outcomes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"actor_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"credential_id" uuid NOT NULL,
	"credential_version" bigint NOT NULL,
	"request_key" uuid NOT NULL,
	"expected_revision" bigint NOT NULL,
	"csv_digest" "bytea" NOT NULL,
	"fingerprint" "bytea" NOT NULL,
	"reason" text NOT NULL,
	"outcome" text NOT NULL,
	"denial_reason" text,
	"items" jsonb NOT NULL,
	"recorded_at" timestamp (3) with time zone NOT NULL,
	CONSTRAINT "registration_import_intent" UNIQUE("actor_id","request_key"),
	CONSTRAINT "registration_import_shape" CHECK ("registration_import_outcomes"."expected_revision">=0 and octet_length("registration_import_outcomes"."csv_digest")=32 and octet_length("registration_import_outcomes"."fingerprint")=32
    and octet_length("registration_import_outcomes"."reason") between 1 and 1024 and btrim("registration_import_outcomes"."reason")<>''
    and jsonb_typeof("registration_import_outcomes"."items")='array' and jsonb_array_length("registration_import_outcomes"."items") between 1 and 1000 and octet_length("registration_import_outcomes"."items"::text)<=524288
    and (("registration_import_outcomes"."outcome" in ('APPLIED','UNCHANGED') and "registration_import_outcomes"."denial_reason" is null) or ("registration_import_outcomes"."outcome"='REJECTED' and "registration_import_outcomes"."denial_reason" is not null
      and "registration_import_outcomes"."denial_reason" in ('STALE_VERSION','REGISTRATION_CONFLICT','TEAM_CAPACITY'))))
);
--> statement-breakpoint
CREATE TABLE "registration_sources" (
	"registration_id" text PRIMARY KEY NOT NULL,
	"team_id" uuid NOT NULL,
	"import_id" uuid NOT NULL,
	CONSTRAINT "registration_one_team" UNIQUE("team_id"),
	CONSTRAINT "registration_id_shape" CHECK ("registration_sources"."registration_id" ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$')
);
--> statement-breakpoint
ALTER TABLE "registration_import_outcomes" ADD CONSTRAINT "registration_import_session_actor" FOREIGN KEY ("session_id","actor_id") REFERENCES "public"."staff_sessions"("id","staff_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration_import_outcomes" ADD CONSTRAINT "registration_import_credential_actor" FOREIGN KEY ("credential_id","credential_version","actor_id") REFERENCES "public"."access_credentials"("id","version","staff_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration_sources" ADD CONSTRAINT "registration_sources_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration_sources" ADD CONSTRAINT "registration_sources_import_id_registration_import_outcomes_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."registration_import_outcomes"("id") ON DELETE no action ON UPDATE no action;