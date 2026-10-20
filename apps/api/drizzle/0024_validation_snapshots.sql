CREATE TABLE "validation_preparation_outcomes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version_id" uuid NOT NULL,
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
	"issues" jsonb NOT NULL,
	"recorded_at" timestamp (3) with time zone NOT NULL,
	"result_snapshot_id" uuid,
	CONSTRAINT "validation_prepare_intent" UNIQUE("actor_id","version_id","request_key"),
	CONSTRAINT "validation_prepare_shape" CHECK (octet_length("validation_preparation_outcomes"."fingerprint")=32 and "validation_preparation_outcomes"."expected_revision">=0 and octet_length("validation_preparation_outcomes"."reason") between 1 and 1024 and length(btrim("validation_preparation_outcomes"."reason"))>0
    and jsonb_typeof("validation_preparation_outcomes"."issues")='array' and jsonb_array_length("validation_preparation_outcomes"."issues")<=128 and octet_length("validation_preparation_outcomes"."issues"::text)<=32768
    and (("validation_preparation_outcomes"."outcome" in ('APPLIED','UNCHANGED') and "validation_preparation_outcomes"."denial_reason" is null and "validation_preparation_outcomes"."result_snapshot_id" is not null and jsonb_array_length("validation_preparation_outcomes"."issues")=0)
      or ("validation_preparation_outcomes"."outcome"='REJECTED' and "validation_preparation_outcomes"."denial_reason" is not null and "validation_preparation_outcomes"."denial_reason" in ('STALE_VERSION','CONTENT_LOCKED','CONTENT_INCOMPLETE','ARENA_ACTIVE') and "validation_preparation_outcomes"."result_snapshot_id" is null)))
);
--> statement-breakpoint
CREATE TABLE "validation_snapshot_audits" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version_id" uuid NOT NULL,
	"snapshot_id" uuid,
	"actor_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"credential_id" uuid NOT NULL,
	"credential_version" bigint NOT NULL,
	"section" text NOT NULL,
	"recorded_at" timestamp (3) with time zone NOT NULL,
	CONSTRAINT "validation_audit_shape" CHECK (("validation_snapshot_audits"."section"='CAPTURE' and "validation_snapshot_audits"."snapshot_id" is null) or ("validation_snapshot_audits"."section" in ('SUMMARY','CHECKS') and "validation_snapshot_audits"."snapshot_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "validation_snapshot_cases" (
	"snapshot_id" uuid NOT NULL,
	"version_id" uuid NOT NULL,
	"case_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"visibility" text NOT NULL,
	"input_data" "bytea" NOT NULL,
	"expected_output" "bytea" NOT NULL,
	CONSTRAINT "validation_snapshot_cases_snapshot_id_case_id_pk" PRIMARY KEY("snapshot_id","case_id"),
	CONSTRAINT "snapshot_case_position" UNIQUE("snapshot_id","position"),
	CONSTRAINT "snapshot_case_bounds" CHECK ("validation_snapshot_cases"."position" between 1 and 20 and "validation_snapshot_cases"."visibility" in ('SAMPLE','HIDDEN') and octet_length("validation_snapshot_cases"."input_data")<=1048576 and octet_length("validation_snapshot_cases"."expected_output")<=1048576)
);
--> statement-breakpoint
CREATE TABLE "validation_snapshot_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"variant_id" uuid NOT NULL,
	"language" text NOT NULL,
	"source_role" text NOT NULL,
	"check_type" text NOT NULL,
	"case_id" uuid,
	"witness_position" integer,
	"expected_result" text NOT NULL,
	CONSTRAINT "snapshot_check_position" UNIQUE("snapshot_id","position"),
	CONSTRAINT "snapshot_check_shape" CHECK ("validation_snapshot_checks"."position" between 1 and 115 and (("validation_snapshot_checks"."source_role"='REFERENCE' and "validation_snapshot_checks"."check_type"='TEST_CASE' and "validation_snapshot_checks"."case_id" is not null and "validation_snapshot_checks"."witness_position" is null and "validation_snapshot_checks"."expected_result"='PASSED')
    or ("validation_snapshot_checks"."source_role"='STARTER' and "validation_snapshot_checks"."witness_position" is not null and "validation_snapshot_checks"."witness_position" between 1 and 3
      and (("validation_snapshot_checks"."check_type"='COMPILATION' and "validation_snapshot_checks"."case_id" is null and "validation_snapshot_checks"."expected_result"='COMPILATION_ERROR')
        or ("validation_snapshot_checks"."check_type"='TEST_CASE' and "validation_snapshot_checks"."case_id" is not null and "validation_snapshot_checks"."expected_result" in ('WRONG_ANSWER','RUNTIME_ERROR','TIME_LIMIT_EXCEEDED','MEMORY_LIMIT_EXCEEDED'))))))
);
--> statement-breakpoint
CREATE TABLE "validation_snapshot_hints" (
	"snapshot_id" uuid NOT NULL,
	"version_id" uuid NOT NULL,
	"hint_id" uuid NOT NULL,
	"level" integer NOT NULL,
	"content" text NOT NULL,
	CONSTRAINT "validation_snapshot_hints_snapshot_id_level_pk" PRIMARY KEY("snapshot_id","level"),
	CONSTRAINT "snapshot_hint_once" UNIQUE("snapshot_id","hint_id"),
	CONSTRAINT "snapshot_hint_bounds" CHECK ("validation_snapshot_hints"."level" between 1 and 3 and octet_length("validation_snapshot_hints"."content") between 1 and 16384 and length(btrim("validation_snapshot_hints"."content"))>0)
);
--> statement-breakpoint
CREATE TABLE "validation_snapshot_variants" (
	"snapshot_id" uuid NOT NULL,
	"version_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"language" text NOT NULL,
	"starter_code" "bytea" NOT NULL,
	"reference_code" "bytea" NOT NULL,
	"defect_description" text NOT NULL,
	"runtime_key" text NOT NULL,
	"cpu_ms" integer NOT NULL,
	"wall_ms" integer NOT NULL,
	"memory_kb" integer NOT NULL,
	CONSTRAINT "validation_snapshot_variants_snapshot_id_variant_id_pk" PRIMARY KEY("snapshot_id","variant_id"),
	CONSTRAINT "snapshot_variant_language" UNIQUE("snapshot_id","language"),
	CONSTRAINT "snapshot_variant_scope" UNIQUE("snapshot_id","variant_id","language"),
	CONSTRAINT "snapshot_variant_bounds" CHECK ("validation_snapshot_variants"."language" in ('c','cpp','java','python','javascript') and octet_length("validation_snapshot_variants"."starter_code") between 1 and 131072
    and octet_length("validation_snapshot_variants"."reference_code") between 1 and 131072 and octet_length("validation_snapshot_variants"."defect_description") between 1 and 16384
    and "validation_snapshot_variants"."cpu_ms" between 1 and (case when "validation_snapshot_variants"."language" in ('c','cpp') then 2000 else 4000 end)
    and "validation_snapshot_variants"."wall_ms" between "validation_snapshot_variants"."cpu_ms" and (case when "validation_snapshot_variants"."language" in ('c','cpp') then 10000 else 15000 end) and "validation_snapshot_variants"."memory_kb" between 1 and 524288)
);
--> statement-breakpoint
CREATE TABLE "validation_snapshot_witnesses" (
	"snapshot_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"check_type" text NOT NULL,
	"case_id" uuid,
	"expected_result" text NOT NULL,
	CONSTRAINT "validation_snapshot_witnesses_snapshot_id_variant_id_position_pk" PRIMARY KEY("snapshot_id","variant_id","position"),
	CONSTRAINT "snapshot_witness_shape" CHECK ("validation_snapshot_witnesses"."position" between 1 and 3 and (("validation_snapshot_witnesses"."check_type"='COMPILATION' and "validation_snapshot_witnesses"."case_id" is null and "validation_snapshot_witnesses"."expected_result"='COMPILATION_ERROR')
    or ("validation_snapshot_witnesses"."check_type"='TEST_CASE' and "validation_snapshot_witnesses"."case_id" is not null and "validation_snapshot_witnesses"."expected_result" in ('WRONG_ANSWER','RUNTIME_ERROR','TIME_LIMIT_EXCEEDED','MEMORY_LIMIT_EXCEEDED'))))
);
--> statement-breakpoint
CREATE TABLE "validation_snapshots" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version_id" uuid NOT NULL,
	"definition_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"content_revision" bigint NOT NULL,
	"round_type" integer NOT NULL,
	"title" text NOT NULL,
	"statement" text NOT NULL,
	"difficulty" integer NOT NULL,
	"base_bounty" integer NOT NULL,
	"submission_format" text NOT NULL,
	"checker_mode" text NOT NULL,
	"checker_version" text NOT NULL,
	"manifest_text" text NOT NULL,
	"fingerprint" "bytea" NOT NULL,
	"content_bytes" bigint NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL,
	"source_id" uuid NOT NULL,
	CONSTRAINT "snapshot_version_revision" UNIQUE("version_id","content_revision"),
	CONSTRAINT "snapshot_same_version" UNIQUE("id","version_id"),
	CONSTRAINT "snapshot_source_once" UNIQUE("source_id"),
	CONSTRAINT "snapshot_metadata" CHECK ("validation_snapshots"."version_number" between 1 and 1000 and "validation_snapshots"."content_revision">=1 and "validation_snapshots"."round_type" in (1,2)
    and octet_length("validation_snapshots"."title") between 1 and 160 and length(btrim("validation_snapshots"."title"))>0 and octet_length("validation_snapshots"."statement")<=65536
    and "validation_snapshots"."difficulty" between 1 and 100 and "validation_snapshots"."base_bounty"=10*"validation_snapshots"."difficulty" and "validation_snapshots"."submission_format"='FULL_PROGRAM'
    and "validation_snapshots"."checker_mode" in ('TOKENS','EXACT_TEXT') and "validation_snapshots"."checker_version"='ingenium-text-v1'),
	CONSTRAINT "snapshot_fingerprint" CHECK (octet_length("validation_snapshots"."manifest_text") between 1 and 32768 and jsonb_typeof("validation_snapshots"."manifest_text"::jsonb)='object'
    and octet_length("validation_snapshots"."fingerprint")=32 and "validation_snapshots"."fingerprint"=sha256(convert_to("validation_snapshots"."manifest_text",'UTF8')) and "validation_snapshots"."content_bytes" between 65536 and 3221225472)
);
--> statement-breakpoint
ALTER TABLE "validation_preparation_outcomes" ADD CONSTRAINT "validation_preparation_outcomes_version_id_bug_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."bug_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_preparation_outcomes" ADD CONSTRAINT "validation_prepare_actor_session" FOREIGN KEY ("session_id","actor_id") REFERENCES "public"."staff_sessions"("id","staff_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_preparation_outcomes" ADD CONSTRAINT "validation_prepare_actor_code" FOREIGN KEY ("credential_id","credential_version","actor_id") REFERENCES "public"."access_credentials"("id","version","staff_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_preparation_outcomes" ADD CONSTRAINT "validation_prepare_snapshot" FOREIGN KEY ("result_snapshot_id","version_id") REFERENCES "public"."validation_snapshots"("id","version_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_snapshot_audits" ADD CONSTRAINT "validation_snapshot_audits_version_id_bug_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."bug_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_snapshot_audits" ADD CONSTRAINT "validation_audit_actor_session" FOREIGN KEY ("session_id","actor_id") REFERENCES "public"."staff_sessions"("id","staff_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_snapshot_audits" ADD CONSTRAINT "validation_audit_actor_code" FOREIGN KEY ("credential_id","credential_version","actor_id") REFERENCES "public"."access_credentials"("id","version","staff_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_snapshot_audits" ADD CONSTRAINT "validation_audit_snapshot" FOREIGN KEY ("snapshot_id","version_id") REFERENCES "public"."validation_snapshots"("id","version_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_snapshot_cases" ADD CONSTRAINT "snapshot_case_parent" FOREIGN KEY ("snapshot_id","version_id") REFERENCES "public"."validation_snapshots"("id","version_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_snapshot_cases" ADD CONSTRAINT "snapshot_case_original" FOREIGN KEY ("case_id","version_id") REFERENCES "public"."test_cases"("id","version_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_snapshot_checks" ADD CONSTRAINT "snapshot_check_variant" FOREIGN KEY ("snapshot_id","variant_id","language") REFERENCES "public"."validation_snapshot_variants"("snapshot_id","variant_id","language") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_snapshot_checks" ADD CONSTRAINT "snapshot_check_case" FOREIGN KEY ("snapshot_id","case_id") REFERENCES "public"."validation_snapshot_cases"("snapshot_id","case_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_snapshot_checks" ADD CONSTRAINT "snapshot_check_witness" FOREIGN KEY ("snapshot_id","variant_id","witness_position") REFERENCES "public"."validation_snapshot_witnesses"("snapshot_id","variant_id","position") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_snapshot_hints" ADD CONSTRAINT "snapshot_hint_parent" FOREIGN KEY ("snapshot_id","version_id") REFERENCES "public"."validation_snapshots"("id","version_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_snapshot_hints" ADD CONSTRAINT "snapshot_hint_original" FOREIGN KEY ("hint_id","version_id") REFERENCES "public"."bug_hints"("id","version_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_snapshot_variants" ADD CONSTRAINT "snapshot_variant_parent" FOREIGN KEY ("snapshot_id","version_id") REFERENCES "public"."validation_snapshots"("id","version_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_snapshot_variants" ADD CONSTRAINT "snapshot_variant_original" FOREIGN KEY ("variant_id","version_id") REFERENCES "public"."language_variants"("id","version_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_snapshot_variants" ADD CONSTRAINT "snapshot_variant_runtime" FOREIGN KEY ("runtime_key","language") REFERENCES "public"."runtime_manifests"("key","language") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_snapshot_witnesses" ADD CONSTRAINT "snapshot_witness_variant" FOREIGN KEY ("snapshot_id","variant_id") REFERENCES "public"."validation_snapshot_variants"("snapshot_id","variant_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_snapshot_witnesses" ADD CONSTRAINT "snapshot_witness_case" FOREIGN KEY ("snapshot_id","case_id") REFERENCES "public"."validation_snapshot_cases"("snapshot_id","case_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_snapshots" ADD CONSTRAINT "validation_snapshots_created_by_staff_identities_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."staff_identities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_snapshots" ADD CONSTRAINT "validation_snapshots_source_id_validation_preparation_outcomes_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."validation_preparation_outcomes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_snapshots" ADD CONSTRAINT "snapshot_version_definition" FOREIGN KEY ("version_id","definition_id") REFERENCES "public"."bug_versions"("id","definition_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "validation_prepare_applied_once" ON "validation_preparation_outcomes" USING btree ("result_snapshot_id") WHERE "validation_preparation_outcomes"."outcome"='APPLIED';--> statement-breakpoint
CREATE UNIQUE INDEX "snapshot_check_reference_once" ON "validation_snapshot_checks" USING btree ("snapshot_id","variant_id","case_id") WHERE "validation_snapshot_checks"."source_role"='REFERENCE';--> statement-breakpoint
CREATE UNIQUE INDEX "snapshot_check_starter_once" ON "validation_snapshot_checks" USING btree ("snapshot_id","variant_id","witness_position") WHERE "validation_snapshot_checks"."source_role"='STARTER';--> statement-breakpoint
CREATE UNIQUE INDEX "snapshot_witness_unique_case" ON "validation_snapshot_witnesses" USING btree ("snapshot_id","variant_id","case_id") WHERE "validation_snapshot_witnesses"."case_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "snapshot_witness_one_compile" ON "validation_snapshot_witnesses" USING btree ("snapshot_id","variant_id") WHERE "validation_snapshot_witnesses"."check_type"='COMPILATION';