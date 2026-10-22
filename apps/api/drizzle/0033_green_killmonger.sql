CREATE TABLE "participant_attempts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"job_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"host_epoch_id" uuid NOT NULL,
	"payload_digest" "bytea" NOT NULL,
	"worker_id" uuid NOT NULL,
	"generation" bigint NOT NULL,
	"send_state" text NOT NULL,
	"prepared_at" timestamp (3) with time zone NOT NULL,
	"send_started_at" timestamp (3) with time zone,
	"result" text,
	"evidence" jsonb,
	"result_digest" "bytea",
	"stdout_prefix" "bytea",
	"stderr" "bytea",
	"compiler_output" "bytea",
	"resolved_at" timestamp (3) with time zone,
	"release_digest" "bytea",
	"released_at" timestamp (3) with time zone,
	"poll_count" integer DEFAULT 0 NOT NULL,
	"next_poll_at" timestamp (3) with time zone NOT NULL,
	CONSTRAINT "participant_dispatch_number" UNIQUE("job_id","number"),
	CONSTRAINT "participant_attempt_shape" CHECK ("participant_attempts"."number" between 1 and 4 and "participant_attempts"."generation">0 and octet_length("participant_attempts"."payload_digest")=32 and "participant_attempts"."poll_count" between 0 and 10000
    and (("participant_attempts"."send_state"='PREPARED' and "participant_attempts"."send_started_at" is null) or ("participant_attempts"."send_state"='SEND_STARTED' and "participant_attempts"."send_started_at">="participant_attempts"."prepared_at"))
    and (("participant_attempts"."result" is null and num_nonnulls("participant_attempts"."evidence","participant_attempts"."result_digest","participant_attempts"."stdout_prefix","participant_attempts"."stderr","participant_attempts"."compiler_output","participant_attempts"."resolved_at")=0)
      or ("participant_attempts"."result" in ('PASSED','WRONG_ANSWER','COMPILATION_ERROR','RUNTIME_ERROR','TIME_LIMIT_EXCEEDED','MEMORY_LIMIT_EXCEEDED','OUTPUT_LIMIT_EXCEEDED','INFRA_ERROR')
        and num_nonnulls("participant_attempts"."evidence","participant_attempts"."result_digest","participant_attempts"."stdout_prefix","participant_attempts"."stderr","participant_attempts"."compiler_output","participant_attempts"."resolved_at")=6
        and octet_length("participant_attempts"."evidence"::text)<=65536 and octet_length("participant_attempts"."result_digest")=32 and octet_length("participant_attempts"."stdout_prefix")<=16384
        and octet_length("participant_attempts"."stderr")<=65536 and octet_length("participant_attempts"."compiler_output")<=65536 and "participant_attempts"."resolved_at">="participant_attempts"."send_started_at"))
    and (("participant_attempts"."released_at" is null and "participant_attempts"."release_digest" is null) or ("participant_attempts"."released_at">="participant_attempts"."prepared_at" and octet_length("participant_attempts"."release_digest")=32 and "participant_attempts"."release_digest" is not null)))
);
--> statement-breakpoint
CREATE TABLE "participant_jobs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"parent_id" uuid NOT NULL,
	"case_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"available_at" timestamp (3) with time zone NOT NULL,
	"status" text NOT NULL,
	"result" text,
	"completed_at" timestamp (3) with time zone,
	"settling_attempt_id" uuid,
	CONSTRAINT "participant_required_case" UNIQUE("parent_id","case_id"),
	CONSTRAINT "participant_job_shape" CHECK ("participant_jobs"."position" between 1 and 20
    and (("participant_jobs"."status" in ('QUEUED','PROCESSING','RECOVERING','NEEDS_ATTENTION') and num_nonnulls("participant_jobs"."result","participant_jobs"."completed_at","participant_jobs"."settling_attempt_id")=0)
      or ("participant_jobs"."status"='COMPLETED' and num_nonnulls("participant_jobs"."result","participant_jobs"."completed_at","participant_jobs"."settling_attempt_id")=3
        and "participant_jobs"."result" in ('PASSED','WRONG_ANSWER','COMPILATION_ERROR','RUNTIME_ERROR','TIME_LIMIT_EXCEEDED','MEMORY_LIMIT_EXCEEDED','OUTPUT_LIMIT_EXCEEDED'))))
);
--> statement-breakpoint
CREATE TABLE "participant_judging" (
	"id" uuid PRIMARY KEY NOT NULL,
	"submission_id" uuid,
	"source_id" uuid,
	"lane" text NOT NULL,
	"round_id" uuid NOT NULL,
	"team_round_id" uuid NOT NULL,
	"member_round_id" uuid NOT NULL,
	"bounty_id" uuid NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"source" "bytea" NOT NULL,
	"language" text NOT NULL,
	"host_epoch_id" uuid NOT NULL,
	"runtime_key" text NOT NULL,
	"runtime_digest" "bytea" NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL,
	"policy_version" integer DEFAULT 1 NOT NULL,
	"status" text NOT NULL,
	"result" text,
	"started_at" timestamp (3) with time zone,
	"completed_at" timestamp (3) with time zone,
	"reserved_bytes" bigint NOT NULL,
	CONSTRAINT "participant_official_plan" UNIQUE("submission_id"),
	CONSTRAINT "participant_sample_receipt" UNIQUE("source_id"),
	CONSTRAINT "participant_parent_shape" CHECK ("participant_judging"."policy_version"=1 and octet_length("participant_judging"."source") between 1 and 131072 and octet_length("participant_judging"."runtime_digest")=32
    and "participant_judging"."language" in ('c','cpp','java','python','javascript') and "participant_judging"."reserved_bytes" between 524288 and 21495808
    and (("participant_judging"."lane"='OFFICIAL' and "participant_judging"."submission_id"="participant_judging"."id" and "participant_judging"."source_id" is null) or ("participant_judging"."lane"='SAMPLE' and "participant_judging"."submission_id" is null and "participant_judging"."source_id" is not null))
    and (("participant_judging"."status" in ('QUEUED','PROCESSING','JUDGING','RECOVERING','NEEDS_ATTENTION') and "participant_judging"."result" is null and "participant_judging"."completed_at" is null)
      or ("participant_judging"."status"='COMPLETED' and "participant_judging"."result" in ('PASSED','WRONG_ANSWER','COMPILATION_ERROR','RUNTIME_ERROR','TIME_LIMIT_EXCEEDED','MEMORY_LIMIT_EXCEEDED','OUTPUT_LIMIT_EXCEEDED','INFRA_ERROR')
        and "participant_judging"."result" is not null and "participant_judging"."completed_at">="participant_judging"."created_at" and ("participant_judging"."lane"='SAMPLE' or "participant_judging"."result"<>'INFRA_ERROR'))))
);
--> statement-breakpoint
CREATE TABLE "participant_scheduler" (
	"id" integer PRIMARY KEY NOT NULL,
	"turn" integer DEFAULT 0 NOT NULL,
	"last_official_team" uuid,
	"last_sample_team" uuid,
	CONSTRAINT "participant_scheduler_singleton" CHECK ("participant_scheduler"."id"=1 and "participant_scheduler"."turn" between 0 and 3)
);
--> statement-breakpoint
ALTER TABLE "execution_capacity_slots" ADD COLUMN "participant_attempt_id" uuid;--> statement-breakpoint
ALTER TABLE "participant_attempts" ADD CONSTRAINT "participant_attempts_job_id_participant_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."participant_jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant_attempts" ADD CONSTRAINT "participant_attempts_host_epoch_id_judge_host_epochs_id_fk" FOREIGN KEY ("host_epoch_id") REFERENCES "public"."judge_host_epochs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant_jobs" ADD CONSTRAINT "participant_jobs_parent_id_participant_judging_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."participant_judging"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant_jobs" ADD CONSTRAINT "participant_jobs_settling_attempt_id_participant_attempts_id_fk" FOREIGN KEY ("settling_attempt_id") REFERENCES "public"."participant_attempts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant_judging" ADD CONSTRAINT "participant_judging_submission_id_competition_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."competition_submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant_judging" ADD CONSTRAINT "participant_judging_source_id_competition_outcomes_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."competition_outcomes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant_judging" ADD CONSTRAINT "participant_judging_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant_judging" ADD CONSTRAINT "participant_judging_team_round_id_team_rounds_id_fk" FOREIGN KEY ("team_round_id") REFERENCES "public"."team_rounds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant_judging" ADD CONSTRAINT "participant_judging_member_round_id_member_rounds_id_fk" FOREIGN KEY ("member_round_id") REFERENCES "public"."member_rounds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant_judging" ADD CONSTRAINT "participant_judging_bounty_id_bounties_id_fk" FOREIGN KEY ("bounty_id") REFERENCES "public"."bounties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant_judging" ADD CONSTRAINT "participant_judging_snapshot_id_validation_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."validation_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant_judging" ADD CONSTRAINT "participant_judging_host_epoch_id_judge_host_epochs_id_fk" FOREIGN KEY ("host_epoch_id") REFERENCES "public"."judge_host_epochs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "participant_one_live_attempt" ON "participant_attempts" USING btree ("job_id") WHERE "participant_attempts"."released_at" is null;--> statement-breakpoint
ALTER TABLE "execution_capacity_slots" ADD CONSTRAINT "execution_capacity_slots_participant_attempt_id_participant_attempts_id_fk" FOREIGN KEY ("participant_attempt_id") REFERENCES "public"."participant_attempts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "execution_capacity_slots" ADD CONSTRAINT "slot_participant_attempt_once" UNIQUE("participant_attempt_id");--> statement-breakpoint
ALTER TABLE "execution_capacity_slots" ADD CONSTRAINT "slot_one_purpose" CHECK (num_nonnulls("execution_capacity_slots"."authoring_attempt_id","execution_capacity_slots"."participant_attempt_id")<=1);
