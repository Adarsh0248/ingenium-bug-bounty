CREATE TABLE "arena_setup_outcomes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"actor_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"credential_id" uuid NOT NULL,
	"credential_version" bigint NOT NULL,
	"action" text NOT NULL,
	"control_id" integer,
	"round_id" uuid,
	"request_key" uuid NOT NULL,
	"fingerprint" "bytea" NOT NULL,
	"expected_revision" bigint NOT NULL,
	"duration_ms" bigint NOT NULL,
	"reason" text NOT NULL,
	"outcome" text NOT NULL,
	"denial_reason" text,
	"recorded_at" timestamp (3) with time zone NOT NULL,
	"result_instance_id" uuid,
	"result_round_id" uuid,
	"result_revision" bigint,
	CONSTRAINT "arena_setup_target" CHECK (("arena_setup_outcomes"."action"='CREATE' and "arena_setup_outcomes"."control_id" is not null and "arena_setup_outcomes"."control_id"=1 and "arena_setup_outcomes"."round_id" is null)
    or ("arena_setup_outcomes"."action"='CONFIGURE' and "arena_setup_outcomes"."control_id" is null and "arena_setup_outcomes"."round_id" is not null)),
	CONSTRAINT "arena_setup_payload" CHECK (octet_length("arena_setup_outcomes"."fingerprint")=32 and "arena_setup_outcomes"."expected_revision">=0 and "arena_setup_outcomes"."duration_ms" between 1 and 18000000
    and octet_length("arena_setup_outcomes"."reason") between 1 and 1024 and length(btrim("arena_setup_outcomes"."reason"))>0),
	CONSTRAINT "arena_setup_result" CHECK (("arena_setup_outcomes"."outcome" in ('APPLIED','UNCHANGED') and "arena_setup_outcomes"."denial_reason" is null and "arena_setup_outcomes"."result_instance_id" is not null
      and "arena_setup_outcomes"."result_round_id" is not null and "arena_setup_outcomes"."result_revision" is not null and "arena_setup_outcomes"."result_revision">=0 and ("arena_setup_outcomes"."outcome"<>'UNCHANGED' or "arena_setup_outcomes"."action"='CONFIGURE'))
    or ("arena_setup_outcomes"."outcome"='REJECTED' and "arena_setup_outcomes"."denial_reason" is not null and "arena_setup_outcomes"."denial_reason" in ('STALE_VERSION','ARENA_RESERVED','ROUND_UNAVAILABLE','TEAM_INCOMPLETE')
      and "arena_setup_outcomes"."result_instance_id" is null and "arena_setup_outcomes"."result_round_id" is null and "arena_setup_outcomes"."result_revision" is null))
);
--> statement-breakpoint
CREATE TABLE "arena_setup_teams" (
	"outcome_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	CONSTRAINT "arena_setup_teams_outcome_id_team_id_pk" PRIMARY KEY("outcome_id","team_id")
);
--> statement-breakpoint
CREATE TABLE "round_draft_teams" (
	"round_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	CONSTRAINT "round_draft_teams_round_id_team_id_pk" PRIMARY KEY("round_id","team_id")
);
--> statement-breakpoint
ALTER TABLE "rounds" ADD COLUMN "configuration_revision" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "arena_setup_outcomes" ADD CONSTRAINT "arena_setup_outcomes_actor_id_staff_identities_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."staff_identities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arena_setup_outcomes" ADD CONSTRAINT "arena_setup_outcomes_control_id_arena_control_id_fk" FOREIGN KEY ("control_id") REFERENCES "public"."arena_control"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arena_setup_outcomes" ADD CONSTRAINT "arena_setup_outcomes_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arena_setup_outcomes" ADD CONSTRAINT "arena_setup_outcomes_result_instance_id_arena_instances_id_fk" FOREIGN KEY ("result_instance_id") REFERENCES "public"."arena_instances"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arena_setup_outcomes" ADD CONSTRAINT "arena_setup_outcomes_result_round_id_rounds_id_fk" FOREIGN KEY ("result_round_id") REFERENCES "public"."rounds"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arena_setup_outcomes" ADD CONSTRAINT "arena_setup_actor_session" FOREIGN KEY ("session_id","actor_id") REFERENCES "public"."staff_sessions"("id","staff_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arena_setup_outcomes" ADD CONSTRAINT "arena_setup_actor_code" FOREIGN KEY ("credential_id","credential_version","actor_id") REFERENCES "public"."access_credentials"("id","version","staff_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arena_setup_teams" ADD CONSTRAINT "arena_setup_teams_outcome_id_arena_setup_outcomes_id_fk" FOREIGN KEY ("outcome_id") REFERENCES "public"."arena_setup_outcomes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arena_setup_teams" ADD CONSTRAINT "arena_setup_teams_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_draft_teams" ADD CONSTRAINT "round_draft_teams_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_draft_teams" ADD CONSTRAINT "round_draft_teams_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "arena_setup_create_intent" ON "arena_setup_outcomes" USING btree ("actor_id","request_key") WHERE "arena_setup_outcomes"."action"='CREATE';--> statement-breakpoint
CREATE UNIQUE INDEX "arena_setup_configure_intent" ON "arena_setup_outcomes" USING btree ("actor_id","round_id","request_key") WHERE "arena_setup_outcomes"."action"='CONFIGURE';--> statement-breakpoint
ALTER TABLE "rounds" ADD CONSTRAINT "round_configuration_revision" CHECK ("rounds"."configuration_revision" >= 0);