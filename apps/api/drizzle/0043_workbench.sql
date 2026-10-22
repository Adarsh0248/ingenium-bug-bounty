CREATE TABLE "code_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_round_id" uuid NOT NULL,
	"bounty_id" uuid NOT NULL,
	"round_id" uuid NOT NULL,
	"source_code" "bytea" NOT NULL,
	"revision" bigint NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL,
	"updated_at" timestamp (3) with time zone NOT NULL,
	CONSTRAINT "draft_member_bounty" UNIQUE("member_round_id","bounty_id"),
	CONSTRAINT "draft_shape" CHECK (octet_length("code_drafts"."source_code")<=131072 and "code_drafts"."revision" between 1 and 9223372036854775806 and "code_drafts"."updated_at">="code_drafts"."created_at")
);
--> statement-breakpoint
CREATE TABLE "draft_save_outcomes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_round_id" uuid NOT NULL,
	"bounty_id" uuid NOT NULL,
	"round_id" uuid NOT NULL,
	"request_key" uuid NOT NULL,
	"request_fingerprint" "bytea" NOT NULL,
	"base_revision" bigint NOT NULL,
	"outcome" text NOT NULL,
	"reason_code" text,
	"result_revision" bigint,
	"recorded_at" timestamp (3) with time zone NOT NULL,
	CONSTRAINT "draft_save_intent" UNIQUE("member_round_id","bounty_id","request_key"),
	CONSTRAINT "draft_outcome_shape" CHECK (octet_length("draft_save_outcomes"."request_fingerprint")=32 and "draft_save_outcomes"."base_revision" between 0 and 9223372036854775805 and (
    ("draft_save_outcomes"."outcome"='SAVED' and "draft_save_outcomes"."reason_code" is null and "draft_save_outcomes"."result_revision"="draft_save_outcomes"."base_revision"+1 and "draft_save_outcomes"."result_revision" is not null)
    or ("draft_save_outcomes"."outcome"='UNCHANGED' and "draft_save_outcomes"."reason_code" is null and "draft_save_outcomes"."result_revision"="draft_save_outcomes"."base_revision" and "draft_save_outcomes"."base_revision">0 and "draft_save_outcomes"."result_revision" is not null)
    or ("draft_save_outcomes"."outcome"='CONFLICT' and "draft_save_outcomes"."reason_code"='REVISION_MISMATCH' and "draft_save_outcomes"."reason_code" is not null and "draft_save_outcomes"."result_revision" is null)
    or ("draft_save_outcomes"."outcome"='REJECTED' and "draft_save_outcomes"."reason_code" in ('PAUSED','BOUNTY_UNAVAILABLE','ROUND_NOT_WRITABLE','DRAFT_TOO_LARGE') and "draft_save_outcomes"."reason_code" is not null and "draft_save_outcomes"."result_revision" is null)))
);
--> statement-breakpoint
CREATE TABLE "workbench_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"member_round_id" uuid NOT NULL,
	"bounty_id" uuid NOT NULL,
	"request_key" uuid,
	"draft_outcome_id" uuid,
	"recorded_at" timestamp (3) with time zone NOT NULL,
	CONSTRAINT "workbench_open_intent" UNIQUE("member_round_id","bounty_id","request_key"),
	CONSTRAINT "workbench_changed_save" UNIQUE("draft_outcome_id"),
	CONSTRAINT "workbench_activity_source" CHECK (num_nonnulls("workbench_activities"."request_key","workbench_activities"."draft_outcome_id")=1)
);
--> statement-breakpoint
ALTER TABLE "code_drafts" ADD CONSTRAINT "code_drafts_member_round_id_member_rounds_id_fk" FOREIGN KEY ("member_round_id") REFERENCES "public"."member_rounds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "code_drafts" ADD CONSTRAINT "code_drafts_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "code_drafts" ADD CONSTRAINT "draft_bounty_round" FOREIGN KEY ("bounty_id","round_id") REFERENCES "public"."bounties"("id","round_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft_save_outcomes" ADD CONSTRAINT "draft_save_outcomes_member_round_id_member_rounds_id_fk" FOREIGN KEY ("member_round_id") REFERENCES "public"."member_rounds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft_save_outcomes" ADD CONSTRAINT "draft_save_outcomes_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft_save_outcomes" ADD CONSTRAINT "draft_outcome_bounty_round" FOREIGN KEY ("bounty_id","round_id") REFERENCES "public"."bounties"("id","round_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workbench_activities" ADD CONSTRAINT "workbench_activities_session_id_participant_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."participant_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workbench_activities" ADD CONSTRAINT "workbench_activities_member_round_id_member_rounds_id_fk" FOREIGN KEY ("member_round_id") REFERENCES "public"."member_rounds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workbench_activities" ADD CONSTRAINT "workbench_activities_bounty_id_bounties_id_fk" FOREIGN KEY ("bounty_id") REFERENCES "public"."bounties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workbench_activities" ADD CONSTRAINT "workbench_activities_draft_outcome_id_draft_save_outcomes_id_fk" FOREIGN KEY ("draft_outcome_id") REFERENCES "public"."draft_save_outcomes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "draft_outcome_member" ON "draft_save_outcomes" USING btree ("member_round_id");--> statement-breakpoint
CREATE INDEX "workbench_activity_member" ON "workbench_activities" USING btree ("member_round_id");