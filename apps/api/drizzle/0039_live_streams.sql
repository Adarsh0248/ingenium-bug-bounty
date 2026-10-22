CREATE TABLE "live_control" (
	"id" integer PRIMARY KEY NOT NULL,
	"rows" bigint DEFAULT 0 NOT NULL,
	"reserved" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "live_budget" CHECK ("live_control"."id"=1 and "live_control"."rows">=0 and "live_control"."reserved">=0 and "live_control"."rows"+"live_control"."reserved"<=262144)
);
--> statement-breakpoint
CREATE TABLE "live_deliveries" (
	"stream_id" uuid NOT NULL,
	"sequence" bigint NOT NULL,
	"effect_id" uuid NOT NULL,
	"patch" jsonb NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp (3) with time zone,
	CONSTRAINT "live_sequence" UNIQUE("stream_id","sequence"),
	CONSTRAINT "live_effect_delivery" UNIQUE("effect_id","stream_id"),
	CONSTRAINT "live_delivery_bound" CHECK ("live_deliveries"."sequence">0 and jsonb_typeof("live_deliveries"."patch")='object' and octet_length("live_deliveries"."patch"::text)<=15360)
);
--> statement-breakpoint
CREATE TABLE "live_effects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"revision" bigint GENERATED ALWAYS AS IDENTITY (sequence name "live_effects_revision_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"competition_sequence" bigint,
	"parent_id" uuid,
	"round_id" uuid,
	"arena_id" uuid,
	"participant_session_id" uuid,
	"staff_session_id" uuid,
	"staff_id" uuid,
	"credential_id" uuid,
	"block_id" uuid,
	"validation_run_id" uuid,
	"version_id" uuid,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "live_effect_source" CHECK (num_nonnulls("live_effects"."competition_sequence","live_effects"."parent_id","live_effects"."round_id","live_effects"."arena_id","live_effects"."participant_session_id","live_effects"."staff_session_id","live_effects"."staff_id","live_effects"."credential_id","live_effects"."block_id","live_effects"."validation_run_id","live_effects"."version_id")=1)
);
--> statement-breakpoint
CREATE TABLE "live_reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" uuid,
	"validation_run_id" uuid,
	"remaining" integer NOT NULL,
	CONSTRAINT "live_parent_reservation" UNIQUE("parent_id"),
	CONSTRAINT "live_validation_reservation" UNIQUE("validation_run_id"),
	CONSTRAINT "live_reservation_shape" CHECK (num_nonnulls("live_reservations"."parent_id","live_reservations"."validation_run_id")=1 and "live_reservations"."remaining" between 0 and 2048)
);
--> statement-breakpoint
CREATE TABLE "live_streams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"round_id" uuid,
	"team_round_id" uuid,
	"member_round_id" uuid,
	"staff_id" uuid,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"head" bigint DEFAULT 0 NOT NULL,
	"retained_from" bigint DEFAULT 1 NOT NULL,
	CONSTRAINT "live_scope" UNIQUE NULLS NOT DISTINCT("kind","round_id","team_round_id","member_round_id","staff_id"),
	CONSTRAINT "live_stream_shape" CHECK ("live_streams"."schema_version"=1 and "live_streams"."head">=0 and "live_streams"."retained_from" between 1 and "live_streams"."head"+1 and (
    ("live_streams"."kind"='ROUND' and "live_streams"."round_id" is not null and num_nonnulls("live_streams"."team_round_id","live_streams"."member_round_id","live_streams"."staff_id")=0)
    or ("live_streams"."kind"='TEAM' and "live_streams"."round_id" is not null and "live_streams"."team_round_id" is not null and num_nonnulls("live_streams"."member_round_id","live_streams"."staff_id")=0)
    or ("live_streams"."kind"='MEMBER' and "live_streams"."round_id" is not null and "live_streams"."member_round_id" is not null and num_nonnulls("live_streams"."team_round_id","live_streams"."staff_id")=0)
    or ("live_streams"."kind" in ('STAFF_OPS','STAFF_SECURITY') and num_nonnulls("live_streams"."round_id","live_streams"."team_round_id","live_streams"."member_round_id","live_streams"."staff_id")=0)
    or ("live_streams"."kind"='STAFF_SELF' and "live_streams"."staff_id" is not null and num_nonnulls("live_streams"."round_id","live_streams"."team_round_id","live_streams"."member_round_id")=0)))
);
--> statement-breakpoint
ALTER TABLE "live_deliveries" ADD CONSTRAINT "live_deliveries_stream_id_live_streams_id_fk" FOREIGN KEY ("stream_id") REFERENCES "public"."live_streams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_deliveries" ADD CONSTRAINT "live_deliveries_effect_id_live_effects_id_fk" FOREIGN KEY ("effect_id") REFERENCES "public"."live_effects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_effects" ADD CONSTRAINT "live_effects_competition_sequence_competition_events_sequence_fk" FOREIGN KEY ("competition_sequence") REFERENCES "public"."competition_events"("sequence") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_effects" ADD CONSTRAINT "live_effects_parent_id_participant_judging_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."participant_judging"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_effects" ADD CONSTRAINT "live_effects_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_effects" ADD CONSTRAINT "live_effects_arena_id_arena_instances_id_fk" FOREIGN KEY ("arena_id") REFERENCES "public"."arena_instances"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_effects" ADD CONSTRAINT "live_effects_participant_session_id_participant_sessions_id_fk" FOREIGN KEY ("participant_session_id") REFERENCES "public"."participant_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_effects" ADD CONSTRAINT "live_effects_staff_session_id_staff_sessions_id_fk" FOREIGN KEY ("staff_session_id") REFERENCES "public"."staff_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_effects" ADD CONSTRAINT "live_effects_staff_id_staff_identities_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff_identities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_effects" ADD CONSTRAINT "live_effects_credential_id_access_credentials_id_fk" FOREIGN KEY ("credential_id") REFERENCES "public"."access_credentials"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_effects" ADD CONSTRAINT "live_effects_block_id_access_blocks_id_fk" FOREIGN KEY ("block_id") REFERENCES "public"."access_blocks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_effects" ADD CONSTRAINT "live_effects_validation_run_id_validation_runs_id_fk" FOREIGN KEY ("validation_run_id") REFERENCES "public"."validation_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_effects" ADD CONSTRAINT "live_effects_version_id_bug_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."bug_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_reservations" ADD CONSTRAINT "live_reservations_parent_id_participant_judging_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."participant_judging"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_reservations" ADD CONSTRAINT "live_reservations_validation_run_id_validation_runs_id_fk" FOREIGN KEY ("validation_run_id") REFERENCES "public"."validation_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_streams" ADD CONSTRAINT "live_streams_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_streams" ADD CONSTRAINT "live_streams_team_round_id_team_rounds_id_fk" FOREIGN KEY ("team_round_id") REFERENCES "public"."team_rounds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_streams" ADD CONSTRAINT "live_streams_member_round_id_member_rounds_id_fk" FOREIGN KEY ("member_round_id") REFERENCES "public"."member_rounds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_streams" ADD CONSTRAINT "live_streams_staff_id_staff_identities_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff_identities"("id") ON DELETE no action ON UPDATE no action;