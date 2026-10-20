CREATE TABLE "authoring_attempts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"check_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"host_epoch_id" uuid NOT NULL,
	"worker_id" uuid NOT NULL,
	"lease_generation" bigint NOT NULL,
	"send_state" text NOT NULL,
	"payload_digest" "bytea" NOT NULL,
	"prepared_at" timestamp (3) with time zone NOT NULL,
	"send_started_at" timestamp (3) with time zone,
	"result" text,
	"result_digest" "bytea",
	"resolved_at" timestamp (3) with time zone,
	"evidence" jsonb,
	"stdout_prefix" "bytea",
	"stderr" "bytea",
	"compiler_output" "bytea",
	"released_at" timestamp (3) with time zone,
	"release_digest" "bytea",
	CONSTRAINT "authoring_attempt_number" UNIQUE("check_id","number"),
	CONSTRAINT "authoring_attempt_shape" CHECK ("authoring_attempts"."number" between 1 and 3 and "authoring_attempts"."lease_generation">0 and octet_length("authoring_attempts"."payload_digest")=32
    and (("authoring_attempts"."send_state"='PREPARED' and "authoring_attempts"."send_started_at" is null) or ("authoring_attempts"."send_state"='SEND_STARTED' and "authoring_attempts"."send_started_at" is not null and "authoring_attempts"."send_started_at">="authoring_attempts"."prepared_at"))
    and (("authoring_attempts"."result" is null and num_nonnulls("authoring_attempts"."result_digest","authoring_attempts"."resolved_at","authoring_attempts"."evidence","authoring_attempts"."stdout_prefix","authoring_attempts"."stderr","authoring_attempts"."compiler_output")=0)
      or ("authoring_attempts"."result" is not null and "authoring_attempts"."result" in ('PASSED','WRONG_ANSWER','COMPILATION_ERROR','RUNTIME_ERROR','TIME_LIMIT_EXCEEDED','MEMORY_LIMIT_EXCEEDED','OUTPUT_LIMIT_EXCEEDED','INFRA_ERROR')
        and num_nonnulls("authoring_attempts"."result_digest","authoring_attempts"."resolved_at","authoring_attempts"."evidence","authoring_attempts"."stdout_prefix","authoring_attempts"."stderr","authoring_attempts"."compiler_output")=6 and octet_length("authoring_attempts"."result_digest")=32
        and jsonb_typeof("authoring_attempts"."evidence")='object' and octet_length("authoring_attempts"."evidence"::text)<=32768 and octet_length("authoring_attempts"."stdout_prefix")<=16384
        and octet_length("authoring_attempts"."stderr")<=65536 and octet_length("authoring_attempts"."compiler_output")<=65536 and "authoring_attempts"."resolved_at">="authoring_attempts"."send_started_at"))
    and (("authoring_attempts"."released_at" is null and "authoring_attempts"."release_digest" is null) or ("authoring_attempts"."released_at" is not null and octet_length("authoring_attempts"."release_digest")=32
      and "authoring_attempts"."release_digest" is not null and "authoring_attempts"."released_at">="authoring_attempts"."prepared_at")))
);
--> statement-breakpoint
CREATE TABLE "authoring_checks" (
	"id" uuid PRIMARY KEY NOT NULL,
	"run_id" uuid NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"snapshot_check_id" uuid NOT NULL,
	"result" text,
	"completed_at" timestamp (3) with time zone,
	"available_at" timestamp (3) with time zone NOT NULL,
	"settling_attempt_id" uuid,
	"worker_id" uuid,
	"lease_generation" bigint,
	CONSTRAINT "authoring_required_check_once" UNIQUE("run_id","snapshot_check_id"),
	CONSTRAINT "authoring_check_same_run" UNIQUE("id","run_id"),
	CONSTRAINT "authoring_check_shape" CHECK (("authoring_checks"."worker_id" is null) = ("authoring_checks"."lease_generation" is null) and ("authoring_checks"."lease_generation" is null or "authoring_checks"."lease_generation">0)
    and (("authoring_checks"."result" is null and "authoring_checks"."completed_at" is null and "authoring_checks"."settling_attempt_id" is null) or ("authoring_checks"."result" is not null and "authoring_checks"."completed_at" is not null
      and "authoring_checks"."result" in ('PASSED','WRONG_ANSWER','COMPILATION_ERROR','RUNTIME_ERROR','TIME_LIMIT_EXCEEDED','MEMORY_LIMIT_EXCEEDED','OUTPUT_LIMIT_EXCEEDED','INFRA_ERROR')
      and ("authoring_checks"."result"='INFRA_ERROR' or "authoring_checks"."settling_attempt_id" is not null))))
);
--> statement-breakpoint
CREATE TABLE "execution_capacity_slots" (
	"id" integer PRIMARY KEY NOT NULL,
	"authoring_attempt_id" uuid,
	"revision" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "slot_authoring_attempt_once" UNIQUE("authoring_attempt_id"),
	CONSTRAINT "development_slot_bounds" CHECK ("execution_capacity_slots"."id" between 1 and 2 and "execution_capacity_slots"."revision">=0)
);
--> statement-breakpoint
CREATE TABLE "judge_control" (
	"id" integer PRIMARY KEY NOT NULL,
	"worker_id" uuid,
	"worker_generation" bigint DEFAULT 0 NOT NULL,
	"lease_until" timestamp (3) with time zone,
	"host_epoch_id" uuid,
	"trusted_time_at" timestamp (3) with time zone,
	"active_validation_id" uuid,
	CONSTRAINT "judge_control_shape" CHECK ("judge_control"."id"=1 and "judge_control"."worker_generation">=0 and ((num_nonnulls("judge_control"."worker_id","judge_control"."lease_until","judge_control"."host_epoch_id")=0 and "judge_control"."worker_generation"=0)
  or (num_nonnulls("judge_control"."worker_id","judge_control"."lease_until","judge_control"."host_epoch_id")=3 and "judge_control"."worker_generation">0)))
);
--> statement-breakpoint
CREATE TABLE "judge_host_epochs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"state" text NOT NULL,
	"endpoint_ref" text NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL,
	"retirement_digest" "bytea",
	CONSTRAINT "judge_epoch_shape" CHECK ("judge_host_epochs"."state" in ('ACTIVE','QUARANTINED','RETIRED') and octet_length("judge_host_epochs"."endpoint_ref") between 1 and 256
  and (("judge_host_epochs"."state"='RETIRED' and octet_length("judge_host_epochs"."retirement_digest")=32 and "judge_host_epochs"."retirement_digest" is not null) or ("judge_host_epochs"."state"<>'RETIRED' and "judge_host_epochs"."retirement_digest" is null)))
);
--> statement-breakpoint
CREATE TABLE "judge_host_runtimes" (
	"host_epoch_id" uuid NOT NULL,
	"language" text NOT NULL,
	"runtime_key" text NOT NULL,
	CONSTRAINT "judge_host_runtimes_host_epoch_id_language_pk" PRIMARY KEY("host_epoch_id","language")
);
--> statement-breakpoint
CREATE TABLE "validation_run_audits" (
	"id" uuid PRIMARY KEY NOT NULL,
	"run_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"credential_id" uuid NOT NULL,
	"credential_version" bigint NOT NULL,
	"recorded_at" timestamp (3) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "validation_run_outcomes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"credential_id" uuid NOT NULL,
	"credential_version" bigint NOT NULL,
	"request_key" uuid NOT NULL,
	"fingerprint" "bytea" NOT NULL,
	"expected_revision" bigint NOT NULL,
	"reason" text NOT NULL,
	"outcome" text NOT NULL,
	"denial_reason" text,
	"recorded_at" timestamp (3) with time zone NOT NULL,
	"result_run_id" uuid,
	CONSTRAINT "validation_run_intent" UNIQUE("actor_id","snapshot_id","request_key"),
	CONSTRAINT "validation_run_one_source" UNIQUE("result_run_id"),
	CONSTRAINT "validation_run_outcome_shape" CHECK (octet_length("validation_run_outcomes"."fingerprint")=32 and "validation_run_outcomes"."expected_revision">=1 and octet_length("validation_run_outcomes"."reason") between 1 and 1024 and length(btrim("validation_run_outcomes"."reason"))>0
    and (("validation_run_outcomes"."outcome"='ADMITTED' and "validation_run_outcomes"."result_run_id" is not null and "validation_run_outcomes"."denial_reason" is null)
      or ("validation_run_outcomes"."outcome"='REJECTED' and "validation_run_outcomes"."result_run_id" is null and "validation_run_outcomes"."denial_reason" is not null and "validation_run_outcomes"."denial_reason" in ('STALE_VERSION','CONTENT_LOCKED','ARENA_ACTIVE'))))
);
--> statement-breakpoint
CREATE TABLE "validation_runs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"configuration_fingerprint" "bytea" NOT NULL,
	"host_epoch_id" uuid NOT NULL,
	"status" text NOT NULL,
	"requested_by" uuid NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL,
	"deadline_at" timestamp (3) with time zone NOT NULL,
	"started_at" timestamp (3) with time zone,
	"finished_at" timestamp (3) with time zone,
	"policy_version" integer NOT NULL,
	"check_count" integer NOT NULL,
	"accounted_bytes" bigint NOT NULL,
	"source_id" uuid NOT NULL,
	CONSTRAINT "validation_run_snapshot_scope" UNIQUE("id","snapshot_id"),
	CONSTRAINT "validation_run_source_once" UNIQUE("source_id"),
	CONSTRAINT "validation_run_shape" CHECK (octet_length("validation_runs"."configuration_fingerprint")=32 and "validation_runs"."policy_version"=1 and "validation_runs"."check_count" between 15 and 115
    and "validation_runs"."deadline_at"="validation_runs"."created_at"+interval '10 minutes' and ("validation_runs"."started_at" is null or "validation_runs"."started_at">="validation_runs"."created_at")
    and (("validation_runs"."status"='QUEUED' and "validation_runs"."started_at" is null and "validation_runs"."finished_at" is null) or ("validation_runs"."status"='RUNNING' and "validation_runs"."started_at" is not null and "validation_runs"."finished_at" is null)
      or ("validation_runs"."status" in ('PASSED','FAILED','INFRA_ERROR') and "validation_runs"."finished_at" is not null and "validation_runs"."finished_at">="validation_runs"."created_at" and ("validation_runs"."started_at" is null or "validation_runs"."finished_at">="validation_runs"."started_at")))
    and ("validation_runs"."status" not in ('PASSED','FAILED') or ("validation_runs"."started_at" is not null and "validation_runs"."finished_at"<"validation_runs"."deadline_at"))
    and "validation_runs"."accounted_bytes" between 524288 and 90963968)
);
--> statement-breakpoint
ALTER TABLE "authoring_attempts" ADD CONSTRAINT "authoring_attempts_check_id_authoring_checks_id_fk" FOREIGN KEY ("check_id") REFERENCES "public"."authoring_checks"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "authoring_attempts" ADD CONSTRAINT "authoring_attempts_host_epoch_id_judge_host_epochs_id_fk" FOREIGN KEY ("host_epoch_id") REFERENCES "public"."judge_host_epochs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "authoring_checks" ADD CONSTRAINT "authoring_checks_snapshot_check_id_validation_snapshot_checks_id_fk" FOREIGN KEY ("snapshot_check_id") REFERENCES "public"."validation_snapshot_checks"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "authoring_checks" ADD CONSTRAINT "authoring_checks_settling_attempt_id_authoring_attempts_id_fk" FOREIGN KEY ("settling_attempt_id") REFERENCES "public"."authoring_attempts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "authoring_checks" ADD CONSTRAINT "authoring_check_run" FOREIGN KEY ("run_id","snapshot_id") REFERENCES "public"."validation_runs"("id","snapshot_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "execution_capacity_slots" ADD CONSTRAINT "execution_capacity_slots_authoring_attempt_id_authoring_attempts_id_fk" FOREIGN KEY ("authoring_attempt_id") REFERENCES "public"."authoring_attempts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judge_control" ADD CONSTRAINT "judge_control_host_epoch_id_judge_host_epochs_id_fk" FOREIGN KEY ("host_epoch_id") REFERENCES "public"."judge_host_epochs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judge_control" ADD CONSTRAINT "judge_control_active_validation_id_validation_runs_id_fk" FOREIGN KEY ("active_validation_id") REFERENCES "public"."validation_runs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judge_host_runtimes" ADD CONSTRAINT "judge_host_runtimes_host_epoch_id_judge_host_epochs_id_fk" FOREIGN KEY ("host_epoch_id") REFERENCES "public"."judge_host_epochs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judge_host_runtimes" ADD CONSTRAINT "judge_host_runtime" FOREIGN KEY ("runtime_key","language") REFERENCES "public"."runtime_manifests"("key","language") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_run_audits" ADD CONSTRAINT "validation_run_audits_run_id_validation_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."validation_runs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_run_audits" ADD CONSTRAINT "validation_report_actor_session" FOREIGN KEY ("session_id","actor_id") REFERENCES "public"."staff_sessions"("id","staff_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_run_audits" ADD CONSTRAINT "validation_report_actor_code" FOREIGN KEY ("credential_id","credential_version","actor_id") REFERENCES "public"."access_credentials"("id","version","staff_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_run_outcomes" ADD CONSTRAINT "validation_run_outcomes_snapshot_id_validation_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."validation_snapshots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_run_outcomes" ADD CONSTRAINT "validation_run_outcomes_result_run_id_validation_runs_id_fk" FOREIGN KEY ("result_run_id") REFERENCES "public"."validation_runs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_run_outcomes" ADD CONSTRAINT "validation_run_actor_session" FOREIGN KEY ("session_id","actor_id") REFERENCES "public"."staff_sessions"("id","staff_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_run_outcomes" ADD CONSTRAINT "validation_run_actor_code" FOREIGN KEY ("credential_id","credential_version","actor_id") REFERENCES "public"."access_credentials"("id","version","staff_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_runs" ADD CONSTRAINT "validation_runs_snapshot_id_validation_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."validation_snapshots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_runs" ADD CONSTRAINT "validation_runs_host_epoch_id_judge_host_epochs_id_fk" FOREIGN KEY ("host_epoch_id") REFERENCES "public"."judge_host_epochs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_runs" ADD CONSTRAINT "validation_runs_requested_by_staff_identities_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."staff_identities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_runs" ADD CONSTRAINT "validation_runs_source_id_validation_run_outcomes_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."validation_run_outcomes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "authoring_one_potentially_live" ON "authoring_attempts" USING btree ("check_id") WHERE "authoring_attempts"."released_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "validation_one_active" ON "validation_runs" USING btree ((true)) WHERE "validation_runs"."status" in ('QUEUED','RUNNING');