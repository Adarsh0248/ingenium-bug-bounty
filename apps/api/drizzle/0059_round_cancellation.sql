CREATE TABLE "cancellation_finishes" (
	"cancellation_id" uuid PRIMARY KEY NOT NULL,
	"source_id" uuid NOT NULL,
	CONSTRAINT "cancellation_finish_once" UNIQUE("source_id")
);
--> statement-breakpoint
CREATE TABLE "round_cancellations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"arena_id" uuid NOT NULL,
	"round_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"incident_ref" text NOT NULL,
	CONSTRAINT "cancellation_round_once" UNIQUE("round_id"),
	CONSTRAINT "cancellation_start_once" UNIQUE("source_id"),
	CONSTRAINT "cancellation_incident" CHECK ("round_cancellations"."incident_ref" ~ '^[A-Za-z0-9][A-Za-z0-9._/-]{0,119}$')
);
--> statement-breakpoint
ALTER TABLE "participant_jobs" DROP CONSTRAINT "participant_job_shape";--> statement-breakpoint
ALTER TABLE "participant_judging" DROP CONSTRAINT "participant_parent_shape";--> statement-breakpoint
ALTER TABLE "participant_jobs" ADD COLUMN "cancellation_id" uuid;--> statement-breakpoint
ALTER TABLE "participant_judging" ADD COLUMN "cancellation_id" uuid;--> statement-breakpoint
ALTER TABLE "cancellation_finishes" ADD CONSTRAINT "cancellation_finishes_cancellation_id_round_cancellations_id_fk" FOREIGN KEY ("cancellation_id") REFERENCES "public"."round_cancellations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cancellation_finishes" ADD CONSTRAINT "cancellation_finishes_source_id_competition_outcomes_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."competition_outcomes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_cancellations" ADD CONSTRAINT "round_cancellations_arena_id_arena_instances_id_fk" FOREIGN KEY ("arena_id") REFERENCES "public"."arena_instances"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_cancellations" ADD CONSTRAINT "round_cancellations_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_cancellations" ADD CONSTRAINT "round_cancellations_source_id_competition_outcomes_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."competition_outcomes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_cancellations" ADD CONSTRAINT "cancellation_round_arena" FOREIGN KEY ("round_id","arena_id") REFERENCES "public"."rounds"("id","arena_instance_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant_jobs" ADD CONSTRAINT "participant_jobs_cancellation_id_round_cancellations_id_fk" FOREIGN KEY ("cancellation_id") REFERENCES "public"."round_cancellations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant_judging" ADD CONSTRAINT "participant_judging_cancellation_id_round_cancellations_id_fk" FOREIGN KEY ("cancellation_id") REFERENCES "public"."round_cancellations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant_jobs" ADD CONSTRAINT "participant_job_shape" CHECK ("participant_jobs"."position" between 1 and 20
    and (("participant_jobs"."status"='CANCELLED' and "participant_jobs"."cancellation_id" is not null and num_nonnulls("participant_jobs"."result","participant_jobs"."completed_at","participant_jobs"."settling_attempt_id")=0)
      or ("participant_jobs"."status" in ('QUEUED','PROCESSING','RECOVERING','NEEDS_ATTENTION') and "participant_jobs"."cancellation_id" is null and num_nonnulls("participant_jobs"."result","participant_jobs"."completed_at","participant_jobs"."settling_attempt_id")=0)
      or ("participant_jobs"."status"='COMPLETED' and "participant_jobs"."cancellation_id" is null and num_nonnulls("participant_jobs"."result","participant_jobs"."completed_at","participant_jobs"."settling_attempt_id")=3
        and "participant_jobs"."result" in ('PASSED','WRONG_ANSWER','COMPILATION_ERROR','RUNTIME_ERROR','TIME_LIMIT_EXCEEDED','MEMORY_LIMIT_EXCEEDED','OUTPUT_LIMIT_EXCEEDED'))));--> statement-breakpoint
ALTER TABLE "participant_judging" ADD CONSTRAINT "participant_parent_shape" CHECK ("participant_judging"."policy_version"=1 and octet_length("participant_judging"."source") between 1 and 131072 and octet_length("participant_judging"."runtime_digest")=32
    and "participant_judging"."language" in ('c','cpp','java','python','javascript') and "participant_judging"."reserved_bytes" between 524288 and 21495808
    and (("participant_judging"."lane"='OFFICIAL' and "participant_judging"."submission_id" is not null and "participant_judging"."submission_id"="participant_judging"."id" and "participant_judging"."source_id" is null) or ("participant_judging"."lane"='SAMPLE' and "participant_judging"."submission_id" is null and "participant_judging"."source_id" is not null))
    and ("participant_judging"."started_at" is null or "participant_judging"."started_at">="participant_judging"."created_at")
    and (("participant_judging"."status"='CANCELLED' and "participant_judging"."cancellation_id" is not null and "participant_judging"."result" is null and "participant_judging"."completed_at" is null)
      or ("participant_judging"."status" in ('QUEUED','PROCESSING','JUDGING','RECOVERING','NEEDS_ATTENTION') and "participant_judging"."cancellation_id" is null and "participant_judging"."result" is null and "participant_judging"."completed_at" is null)
      or ("participant_judging"."status"='COMPLETED' and "participant_judging"."result" in ('PASSED','WRONG_ANSWER','COMPILATION_ERROR','RUNTIME_ERROR','TIME_LIMIT_EXCEEDED','MEMORY_LIMIT_EXCEEDED','OUTPUT_LIMIT_EXCEEDED','INFRA_ERROR')
        and "participant_judging"."cancellation_id" is null and "participant_judging"."result" is not null and "participant_judging"."completed_at" is not null and "participant_judging"."completed_at">="participant_judging"."created_at" and ("participant_judging"."lane"='SAMPLE' or "participant_judging"."result"<>'INFRA_ERROR'))));