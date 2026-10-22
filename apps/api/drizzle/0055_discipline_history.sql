CREATE TABLE "discipline_outcomes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"actor_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"credential_id" uuid NOT NULL,
	"credential_version" bigint NOT NULL,
	"request_key" uuid NOT NULL,
	"action" text NOT NULL,
	"arena_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"member_id" uuid,
	"round_id" uuid,
	"team_round_id" uuid,
	"block_id" uuid,
	"original_id" uuid,
	"minutes" integer,
	"expected_revision" bigint NOT NULL,
	"fingerprint" "bytea" NOT NULL,
	"reason" text NOT NULL,
	"outcome" text NOT NULL,
	"denial_reason" text,
	"recorded_at" timestamp (3) with time zone NOT NULL,
	CONSTRAINT "discipline_intent" UNIQUE("actor_id","request_key"),
	CONSTRAINT "discipline_shape" CHECK ("discipline_outcomes"."expected_revision">=0 and octet_length("discipline_outcomes"."fingerprint")=32 and octet_length("discipline_outcomes"."reason") between 1 and 1024 and btrim("discipline_outcomes"."reason")<>''
    and (("discipline_outcomes"."action" in ('BLOCK','UNBLOCK') and "discipline_outcomes"."round_id" is null and "discipline_outcomes"."team_round_id" is null and "discipline_outcomes"."original_id" is null and "discipline_outcomes"."minutes" is null
      and ("discipline_outcomes"."action"='BLOCK' or "discipline_outcomes"."block_id" is not null))
      or ("discipline_outcomes"."action" in ('PENALISE','REVERSE') and "discipline_outcomes"."round_id" is not null and "discipline_outcomes"."team_round_id" is not null and "discipline_outcomes"."member_id" is null and "discipline_outcomes"."block_id" is null
        and (("discipline_outcomes"."action"='PENALISE' and "discipline_outcomes"."original_id" is null and "discipline_outcomes"."minutes" between 1 and 300) or ("discipline_outcomes"."action"='REVERSE' and "discipline_outcomes"."original_id" is not null and "discipline_outcomes"."minutes" is null))))
    and (("discipline_outcomes"."outcome"='APPLIED' and "discipline_outcomes"."denial_reason" is null and ("discipline_outcomes"."action"<>'BLOCK' or "discipline_outcomes"."block_id" is not null))
      or ("discipline_outcomes"."outcome"='REJECTED' and "discipline_outcomes"."denial_reason" in ('STALE_VERSION','ARENA_UNAVAILABLE','ROUND_UNAVAILABLE','ALREADY_BLOCKED','ALREADY_CLEARED','PENALTY_CAP','ALREADY_REVERSED'))))
);
--> statement-breakpoint
ALTER TABLE "discipline_outcomes" ADD CONSTRAINT "discipline_outcomes_arena_id_arena_instances_id_fk" FOREIGN KEY ("arena_id") REFERENCES "public"."arena_instances"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discipline_outcomes" ADD CONSTRAINT "discipline_outcomes_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discipline_outcomes" ADD CONSTRAINT "discipline_outcomes_member_id_team_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."team_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discipline_outcomes" ADD CONSTRAINT "discipline_outcomes_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discipline_outcomes" ADD CONSTRAINT "discipline_outcomes_team_round_id_team_rounds_id_fk" FOREIGN KEY ("team_round_id") REFERENCES "public"."team_rounds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discipline_outcomes" ADD CONSTRAINT "discipline_outcomes_block_id_access_blocks_id_fk" FOREIGN KEY ("block_id") REFERENCES "public"."access_blocks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discipline_outcomes" ADD CONSTRAINT "discipline_outcomes_original_id_discipline_outcomes_id_fk" FOREIGN KEY ("original_id") REFERENCES "public"."discipline_outcomes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discipline_outcomes" ADD CONSTRAINT "discipline_session_actor" FOREIGN KEY ("session_id","actor_id") REFERENCES "public"."staff_sessions"("id","staff_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discipline_outcomes" ADD CONSTRAINT "discipline_credential_actor" FOREIGN KEY ("credential_id","credential_version","actor_id") REFERENCES "public"."access_credentials"("id","version","staff_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discipline_outcomes" ADD CONSTRAINT "discipline_member_team" FOREIGN KEY ("member_id","team_id") REFERENCES "public"."team_members"("id","team_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discipline_outcomes" ADD CONSTRAINT "discipline_round_arena" FOREIGN KEY ("round_id","arena_id") REFERENCES "public"."rounds"("id","arena_instance_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discipline_outcomes" ADD CONSTRAINT "discipline_team_round" FOREIGN KEY ("team_round_id","team_id","round_id") REFERENCES "public"."team_rounds"("id","team_id","round_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "discipline_reversal_once" ON "discipline_outcomes" USING btree ("original_id") WHERE "discipline_outcomes"."outcome"='APPLIED';--> statement-breakpoint
CREATE UNIQUE INDEX "discipline_block_action_once" ON "discipline_outcomes" USING btree ("block_id","action") WHERE "discipline_outcomes"."outcome"='APPLIED';