CREATE TABLE "participant_retry_permissions" (
	"job_id" uuid PRIMARY KEY NOT NULL,
	"source_id" uuid NOT NULL,
	CONSTRAINT "participant_retry_source" UNIQUE("source_id")
);
--> statement-breakpoint
ALTER TABLE "participant_attempts" DROP CONSTRAINT "participant_attempt_shape";--> statement-breakpoint
ALTER TABLE "participant_jobs" DROP CONSTRAINT "participant_job_shape";--> statement-breakpoint
ALTER TABLE "participant_retry_permissions" ADD CONSTRAINT "participant_retry_permissions_job_id_participant_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."participant_jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant_retry_permissions" ADD CONSTRAINT "participant_retry_permissions_source_id_competition_outcomes_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."competition_outcomes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant_attempts" ADD CONSTRAINT "participant_attempt_shape" CHECK ("participant_attempts"."number" between 1 and 4 and "participant_attempts"."generation">0 and octet_length("participant_attempts"."payload_digest")=32 and "participant_attempts"."poll_count" between 0 and 10000
    and (("participant_attempts"."send_state"='PREPARED' and "participant_attempts"."send_started_at" is null) or ("participant_attempts"."send_state"='SEND_STARTED' and "participant_attempts"."send_started_at" is not null and "participant_attempts"."send_started_at">="participant_attempts"."prepared_at"))
    and (("participant_attempts"."result" is null and num_nonnulls("participant_attempts"."evidence","participant_attempts"."result_digest","participant_attempts"."stdout_prefix","participant_attempts"."stderr","participant_attempts"."compiler_output","participant_attempts"."resolved_at")=0)
      or ("participant_attempts"."result" in ('PASSED','WRONG_ANSWER','COMPILATION_ERROR','RUNTIME_ERROR','TIME_LIMIT_EXCEEDED','MEMORY_LIMIT_EXCEEDED','OUTPUT_LIMIT_EXCEEDED','INFRA_ERROR')
        and num_nonnulls("participant_attempts"."evidence","participant_attempts"."result_digest","participant_attempts"."stdout_prefix","participant_attempts"."stderr","participant_attempts"."compiler_output","participant_attempts"."resolved_at")=6
        and octet_length("participant_attempts"."evidence"::text)<=65536 and octet_length("participant_attempts"."result_digest")=32 and octet_length("participant_attempts"."stdout_prefix")<=16384
        and octet_length("participant_attempts"."stderr")<=65536 and octet_length("participant_attempts"."compiler_output")<=65536 and "participant_attempts"."resolved_at">="participant_attempts"."send_started_at"))
    and (("participant_attempts"."released_at" is null and "participant_attempts"."release_digest" is null) or ("participant_attempts"."released_at">="participant_attempts"."prepared_at" and octet_length("participant_attempts"."release_digest")=32 and "participant_attempts"."release_digest" is not null)));--> statement-breakpoint
ALTER TABLE "participant_jobs" ADD CONSTRAINT "participant_job_shape" CHECK ("participant_jobs"."position" between 1 and 20
    and (("participant_jobs"."status" in ('QUEUED','PROCESSING','RECOVERING','NEEDS_ATTENTION') and num_nonnulls("participant_jobs"."result","participant_jobs"."completed_at","participant_jobs"."settling_attempt_id")=0)
      or ("participant_jobs"."status"='COMPLETED' and num_nonnulls("participant_jobs"."result","participant_jobs"."completed_at","participant_jobs"."settling_attempt_id")=3
        and "participant_jobs"."result" in ('PASSED','WRONG_ANSWER','COMPILATION_ERROR','RUNTIME_ERROR','TIME_LIMIT_EXCEEDED','MEMORY_LIMIT_EXCEEDED','OUTPUT_LIMIT_EXCEEDED'))));