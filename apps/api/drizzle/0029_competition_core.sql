CREATE TABLE "bounties" (
	"id" uuid PRIMARY KEY NOT NULL,
	"round_id" uuid NOT NULL,
	"definition_id" uuid NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "bounty_round_definition" UNIQUE("round_id","definition_id"),
	CONSTRAINT "bounty_round_position" UNIQUE("round_id","position"),
	CONSTRAINT "bounty_round_scope" UNIQUE("id","round_id"),
	CONSTRAINT "bounty_position" CHECK ("bounties"."position" between 1 and 40)
);
--> statement-breakpoint
CREATE TABLE "bounty_awards" (
	"id" uuid PRIMARY KEY NOT NULL,
	"submission_id" uuid NOT NULL,
	"team_round_id" uuid NOT NULL,
	"bounty_id" uuid NOT NULL,
	"round_kind" integer NOT NULL,
	"base_bounty" integer NOT NULL,
	"points" integer NOT NULL,
	"recorded_at" timestamp (3) with time zone NOT NULL,
	CONSTRAINT "competition_award_team_bounty" UNIQUE("team_round_id","bounty_id"),
	CONSTRAINT "competition_award_submission" UNIQUE("submission_id"),
	CONSTRAINT "competition_award_shape" CHECK ("bounty_awards"."round_kind" in (1,2) and "bounty_awards"."base_bounty" between 10 and 1000 and "bounty_awards"."points" between 5 and 1000)
);
--> statement-breakpoint
CREATE TABLE "competition_assessments" (
	"submission_id" uuid PRIMARY KEY NOT NULL,
	"verdict" text NOT NULL,
	"evidence_digest" "bytea" NOT NULL,
	"recorded_at" timestamp (3) with time zone NOT NULL,
	CONSTRAINT "competition_assessment_shape" CHECK ("competition_assessments"."verdict" in ('PASSED','WRONG_ANSWER','COMPILATION_ERROR','RUNTIME_ERROR','TIME_LIMIT_EXCEEDED','MEMORY_LIMIT_EXCEEDED','OUTPUT_LIMIT_EXCEEDED') and octet_length("competition_assessments"."evidence_digest")=32)
);
--> statement-breakpoint
CREATE TABLE "competition_configs" (
	"round_id" uuid PRIMARY KEY NOT NULL,
	"revision" bigint NOT NULL,
	"ready_digest" "bytea",
	"next_receipt" bigint DEFAULT 0 NOT NULL,
	"draw_ciphertext" text,
	"draw_commitment" text,
	"draw_reveal" jsonb,
	CONSTRAINT "competition_config_shape" CHECK ("competition_configs"."revision">0 and "competition_configs"."next_receipt" between 0 and 20000
    and ("competition_configs"."ready_digest" is null or octet_length("competition_configs"."ready_digest")=32)
    and (("competition_configs"."draw_ciphertext" is null and "competition_configs"."draw_commitment" is null and "competition_configs"."draw_reveal" is null)
      or ("competition_configs"."draw_ciphertext" is not null and octet_length("competition_configs"."draw_ciphertext") between 1 and 16384 and "competition_configs"."draw_commitment" ~ '^[0-9a-f]{64}$'
        and ("competition_configs"."draw_reveal" is null or (jsonb_typeof("competition_configs"."draw_reveal")='object' and octet_length("competition_configs"."draw_reveal"::text)<=16384)))))
);
--> statement-breakpoint
CREATE TABLE "competition_events" (
	"sequence" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "competition_events_sequence_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"round_id" uuid NOT NULL,
	"team_round_id" uuid,
	"kind" text NOT NULL,
	"reference_id" uuid NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL,
	CONSTRAINT "competition_event_kind" CHECK ("competition_events"."kind" in ('ROUND_CHANGED','HINT_PURCHASED','SUBMISSION_RECEIVED','ASSESSMENT_RECORDED','BOUNTY_AWARDED','PENALTY_APPLIED','RESULT_FINALISED','QUALIFICATION_LOCKED'))
);
--> statement-breakpoint
CREATE TABLE "competition_outcomes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"round_id" uuid NOT NULL,
	"staff_session_id" uuid,
	"participant_session_id" uuid,
	"actor_id" uuid NOT NULL,
	"request_key" uuid NOT NULL,
	"action" text NOT NULL,
	"fingerprint" "bytea" NOT NULL,
	"reason" text NOT NULL,
	"result" jsonb NOT NULL,
	"recorded_at" timestamp (3) with time zone NOT NULL,
	CONSTRAINT "competition_command_intent" UNIQUE("round_id","actor_id","request_key"),
	CONSTRAINT "competition_outcome_shape" CHECK (num_nonnulls("competition_outcomes"."staff_session_id","competition_outcomes"."participant_session_id")=1 and octet_length("competition_outcomes"."fingerprint")=32
    and octet_length("competition_outcomes"."reason") between 1 and 1024 and jsonb_typeof("competition_outcomes"."result")='object' and octet_length("competition_outcomes"."result"::text)<=16384)
);
--> statement-breakpoint
CREATE TABLE "competition_pauses" (
	"id" uuid PRIMARY KEY NOT NULL,
	"round_id" uuid NOT NULL,
	"scope" text NOT NULL,
	"team_round_id" uuid,
	"member_round_id" uuid,
	"started_at" timestamp (3) with time zone NOT NULL,
	"ended_at" timestamp (3) with time zone,
	"source_id" uuid NOT NULL,
	"end_source_id" uuid,
	CONSTRAINT "competition_pause_shape" CHECK ((("competition_pauses"."scope"='GLOBAL' and num_nonnulls("competition_pauses"."team_round_id","competition_pauses"."member_round_id")=0)
    or ("competition_pauses"."scope"='TEAM' and "competition_pauses"."team_round_id" is not null and "competition_pauses"."member_round_id" is null)
    or ("competition_pauses"."scope"='MEMBER' and "competition_pauses"."team_round_id" is null and "competition_pauses"."member_round_id" is not null))
    and (("competition_pauses"."ended_at" is null and "competition_pauses"."end_source_id" is null) or ("competition_pauses"."ended_at">="competition_pauses"."started_at" and "competition_pauses"."end_source_id" is not null)))
);
--> statement-breakpoint
CREATE TABLE "competition_publications" (
	"snapshot_id" uuid PRIMARY KEY NOT NULL,
	"version_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"published_at" timestamp (3) with time zone NOT NULL,
	"review" text NOT NULL,
	CONSTRAINT "competition_published_version" UNIQUE("version_id"),
	CONSTRAINT "competition_publication_review" CHECK (octet_length("competition_publications"."review") between 1 and 1024)
);
--> statement-breakpoint
CREATE TABLE "competition_rosters" (
	"round_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"team_round_id" uuid NOT NULL,
	CONSTRAINT "competition_rosters_round_id_team_id_pk" PRIMARY KEY("round_id","team_id"),
	CONSTRAINT "competition_roster_position" UNIQUE("team_round_id")
);
--> statement-breakpoint
CREATE TABLE "competition_submissions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"round_id" uuid NOT NULL,
	"team_round_id" uuid NOT NULL,
	"member_round_id" uuid NOT NULL,
	"bounty_id" uuid NOT NULL,
	"source" "bytea" NOT NULL,
	"language" text NOT NULL,
	"receipt_order" bigint NOT NULL,
	"received_at" timestamp (3) with time zone NOT NULL,
	"elapsed_ms" bigint NOT NULL,
	"hint_tier" integer NOT NULL,
	"source_id" uuid NOT NULL,
	CONSTRAINT "competition_receipt_order" UNIQUE("round_id","receipt_order"),
	CONSTRAINT "competition_submission_shape" CHECK (octet_length("competition_submissions"."source") between 1 and 131072
    and "competition_submissions"."language" in ('c','cpp','java','python','javascript') and "competition_submissions"."receipt_order" between 1 and 20000 and "competition_submissions"."elapsed_ms" between 0 and 18000000 and "competition_submissions"."hint_tier" between 0 and 3)
);
--> statement-breakpoint
CREATE TABLE "hint_purchases" (
	"id" uuid PRIMARY KEY NOT NULL,
	"team_round_id" uuid NOT NULL,
	"bounty_id" uuid NOT NULL,
	"level" integer NOT NULL,
	"price" integer NOT NULL,
	"source_id" uuid NOT NULL,
	"recorded_at" timestamp (3) with time zone NOT NULL,
	CONSTRAINT "competition_hint_owned" UNIQUE("team_round_id","bounty_id","level"),
	CONSTRAINT "competition_hint_shape" CHECK ("hint_purchases"."level" between 1 and 3 and "hint_purchases"."price" between 1 and 800)
);
--> statement-breakpoint
CREATE TABLE "qualification_decisions" (
	"result_id" uuid PRIMARY KEY NOT NULL,
	"selected" jsonb NOT NULL,
	"reveal" jsonb NOT NULL,
	"source_id" uuid NOT NULL,
	CONSTRAINT "competition_qualification_shape" CHECK (jsonb_typeof("qualification_decisions"."selected")='array' and jsonb_array_length("qualification_decisions"."selected") between 1 and 50 and jsonb_typeof("qualification_decisions"."reveal")='object' and octet_length("qualification_decisions"."reveal"::text)<=16384)
);
--> statement-breakpoint
CREATE TABLE "round_carryovers" (
	"team_round_id" uuid PRIMARY KEY NOT NULL,
	"result_id" uuid NOT NULL,
	"source_team_round_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	CONSTRAINT "competition_carryover_once" UNIQUE("result_id","source_team_round_id"),
	CONSTRAINT "competition_carryover_amount" CHECK ("round_carryovers"."amount" between 0 and 40000)
);
--> statement-breakpoint
CREATE TABLE "round_results" (
	"id" uuid PRIMARY KEY NOT NULL,
	"round_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"standings" jsonb NOT NULL,
	"digest" "bytea" NOT NULL,
	"config_digest" "bytea" NOT NULL,
	"finalised_at" timestamp (3) with time zone NOT NULL,
	CONSTRAINT "competition_final_result" UNIQUE("round_id"),
	CONSTRAINT "competition_result_shape" CHECK ("round_results"."version"=1 and octet_length("round_results"."digest")=32 and octet_length("round_results"."config_digest")=32
    and jsonb_typeof("round_results"."standings")='array' and jsonb_array_length("round_results"."standings") between 1 and 100 and octet_length("round_results"."standings"::text)<=1048576
    and "round_results"."digest"=sha256(convert_to("round_results"."standings"::text,'UTF8')))
);
--> statement-breakpoint
CREATE TABLE "wallet_entries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"team_round_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"award_id" uuid,
	"purchase_id" uuid,
	"carryover_id" uuid,
	"recorded_at" timestamp (3) with time zone NOT NULL,
	CONSTRAINT "wallet_award_once" UNIQUE("award_id"),
	CONSTRAINT "wallet_hint_once" UNIQUE("purchase_id"),
	CONSTRAINT "wallet_opening_once" UNIQUE("carryover_id"),
	CONSTRAINT "wallet_entry_source" CHECK (num_nonnulls("wallet_entries"."award_id","wallet_entries"."purchase_id","wallet_entries"."carryover_id")=1 and "wallet_entries"."amount"<>0 and "wallet_entries"."amount" between -800 and 40000)
);
--> statement-breakpoint
CREATE TABLE "wrong_submission_penalties" (
	"submission_id" uuid PRIMARY KEY NOT NULL,
	"team_round_id" uuid NOT NULL,
	"milliseconds" integer DEFAULT 300000 NOT NULL,
	"recorded_at" timestamp (3) with time zone NOT NULL,
	CONSTRAINT "competition_wrong_penalty" CHECK ("wrong_submission_penalties"."milliseconds"=300000)
);
--> statement-breakpoint
ALTER TABLE "bounties" ADD CONSTRAINT "bounties_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bounties" ADD CONSTRAINT "bounties_definition_id_bug_definitions_id_fk" FOREIGN KEY ("definition_id") REFERENCES "public"."bug_definitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bounties" ADD CONSTRAINT "bounties_snapshot_id_competition_publications_snapshot_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."competition_publications"("snapshot_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bounty_awards" ADD CONSTRAINT "bounty_awards_submission_id_competition_assessments_submission_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."competition_assessments"("submission_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bounty_awards" ADD CONSTRAINT "bounty_awards_team_round_id_team_rounds_id_fk" FOREIGN KEY ("team_round_id") REFERENCES "public"."team_rounds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bounty_awards" ADD CONSTRAINT "bounty_awards_bounty_id_bounties_id_fk" FOREIGN KEY ("bounty_id") REFERENCES "public"."bounties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_assessments" ADD CONSTRAINT "competition_assessments_submission_id_competition_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."competition_submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_configs" ADD CONSTRAINT "competition_configs_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_events" ADD CONSTRAINT "competition_events_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_events" ADD CONSTRAINT "competition_events_team_round_id_team_rounds_id_fk" FOREIGN KEY ("team_round_id") REFERENCES "public"."team_rounds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_outcomes" ADD CONSTRAINT "competition_outcomes_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_outcomes" ADD CONSTRAINT "competition_outcomes_staff_session_id_staff_sessions_id_fk" FOREIGN KEY ("staff_session_id") REFERENCES "public"."staff_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_outcomes" ADD CONSTRAINT "competition_outcomes_participant_session_id_participant_sessions_id_fk" FOREIGN KEY ("participant_session_id") REFERENCES "public"."participant_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_pauses" ADD CONSTRAINT "competition_pauses_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_pauses" ADD CONSTRAINT "competition_pauses_team_round_id_team_rounds_id_fk" FOREIGN KEY ("team_round_id") REFERENCES "public"."team_rounds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_pauses" ADD CONSTRAINT "competition_pauses_member_round_id_member_rounds_id_fk" FOREIGN KEY ("member_round_id") REFERENCES "public"."member_rounds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_pauses" ADD CONSTRAINT "competition_pauses_source_id_competition_outcomes_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."competition_outcomes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_pauses" ADD CONSTRAINT "competition_pauses_end_source_id_competition_outcomes_id_fk" FOREIGN KEY ("end_source_id") REFERENCES "public"."competition_outcomes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_publications" ADD CONSTRAINT "competition_publications_snapshot_id_validation_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."validation_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_publications" ADD CONSTRAINT "competition_publications_version_id_bug_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."bug_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_publications" ADD CONSTRAINT "competition_publications_run_id_validation_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."validation_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_publications" ADD CONSTRAINT "competition_publications_actor_id_staff_identities_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."staff_identities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_rosters" ADD CONSTRAINT "competition_rosters_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_rosters" ADD CONSTRAINT "competition_rosters_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_submissions" ADD CONSTRAINT "competition_submissions_team_round_id_team_rounds_id_fk" FOREIGN KEY ("team_round_id") REFERENCES "public"."team_rounds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_submissions" ADD CONSTRAINT "competition_submissions_member_round_id_member_rounds_id_fk" FOREIGN KEY ("member_round_id") REFERENCES "public"."member_rounds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_submissions" ADD CONSTRAINT "competition_submissions_source_id_competition_outcomes_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."competition_outcomes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_submissions" ADD CONSTRAINT "competition_submission_bounty" FOREIGN KEY ("bounty_id","round_id") REFERENCES "public"."bounties"("id","round_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hint_purchases" ADD CONSTRAINT "hint_purchases_team_round_id_team_rounds_id_fk" FOREIGN KEY ("team_round_id") REFERENCES "public"."team_rounds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hint_purchases" ADD CONSTRAINT "hint_purchases_bounty_id_bounties_id_fk" FOREIGN KEY ("bounty_id") REFERENCES "public"."bounties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hint_purchases" ADD CONSTRAINT "hint_purchases_source_id_competition_outcomes_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."competition_outcomes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qualification_decisions" ADD CONSTRAINT "qualification_decisions_result_id_round_results_id_fk" FOREIGN KEY ("result_id") REFERENCES "public"."round_results"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qualification_decisions" ADD CONSTRAINT "qualification_decisions_source_id_competition_outcomes_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."competition_outcomes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_carryovers" ADD CONSTRAINT "round_carryovers_team_round_id_team_rounds_id_fk" FOREIGN KEY ("team_round_id") REFERENCES "public"."team_rounds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_carryovers" ADD CONSTRAINT "round_carryovers_result_id_qualification_decisions_result_id_fk" FOREIGN KEY ("result_id") REFERENCES "public"."qualification_decisions"("result_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_carryovers" ADD CONSTRAINT "round_carryovers_source_team_round_id_team_rounds_id_fk" FOREIGN KEY ("source_team_round_id") REFERENCES "public"."team_rounds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_results" ADD CONSTRAINT "round_results_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_entries" ADD CONSTRAINT "wallet_entries_team_round_id_team_rounds_id_fk" FOREIGN KEY ("team_round_id") REFERENCES "public"."team_rounds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_entries" ADD CONSTRAINT "wallet_entries_award_id_bounty_awards_id_fk" FOREIGN KEY ("award_id") REFERENCES "public"."bounty_awards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_entries" ADD CONSTRAINT "wallet_entries_purchase_id_hint_purchases_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."hint_purchases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_entries" ADD CONSTRAINT "wallet_entries_carryover_id_round_carryovers_team_round_id_fk" FOREIGN KEY ("carryover_id") REFERENCES "public"."round_carryovers"("team_round_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wrong_submission_penalties" ADD CONSTRAINT "wrong_submission_penalties_submission_id_competition_assessments_submission_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."competition_assessments"("submission_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wrong_submission_penalties" ADD CONSTRAINT "wrong_submission_penalties_team_round_id_team_rounds_id_fk" FOREIGN KEY ("team_round_id") REFERENCES "public"."team_rounds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "competition_shared_winner" ON "bounty_awards" USING btree ("bounty_id") WHERE "bounty_awards"."round_kind"=2;--> statement-breakpoint
CREATE UNIQUE INDEX "competition_open_global" ON "competition_pauses" USING btree ("round_id") WHERE "competition_pauses"."scope"='GLOBAL' and "competition_pauses"."ended_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "competition_open_team" ON "competition_pauses" USING btree ("team_round_id") WHERE "competition_pauses"."scope"='TEAM' and "competition_pauses"."ended_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "competition_open_member" ON "competition_pauses" USING btree ("member_round_id") WHERE "competition_pauses"."scope"='MEMBER' and "competition_pauses"."ended_at" is null;