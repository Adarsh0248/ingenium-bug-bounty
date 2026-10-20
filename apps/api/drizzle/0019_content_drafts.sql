CREATE TABLE "bug_definitions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"round_type" integer NOT NULL,
	"archived_at" timestamp (3) with time zone,
	"created_by" uuid NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL,
	"revision" bigint NOT NULL,
	CONSTRAINT "bug_definition_shape" CHECK ("bug_definitions"."round_type" in (1,2) and "bug_definitions"."archived_at" is null and "bug_definitions"."revision">=1)
);
--> statement-breakpoint
CREATE TABLE "bug_hints" (
	"version_id" uuid NOT NULL,
	"level" integer NOT NULL,
	"content" text NOT NULL,
	CONSTRAINT "bug_hints_version_id_level_pk" PRIMARY KEY("version_id","level"),
	CONSTRAINT "bug_hint_bounds" CHECK ("bug_hints"."level" between 1 and 3 and octet_length("bug_hints"."content")<=16384)
);
--> statement-breakpoint
CREATE TABLE "bug_versions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"definition_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"title" text NOT NULL,
	"statement" text NOT NULL,
	"difficulty" integer NOT NULL,
	"base_bounty" integer NOT NULL,
	"publication_status" text NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL,
	"published_by" uuid,
	"published_at" timestamp (3) with time zone,
	"submission_format" text NOT NULL,
	"checker_mode" text NOT NULL,
	"checker_version" text NOT NULL,
	"content_revision" bigint NOT NULL,
	"content_bytes" bigint NOT NULL,
	"last_source_id" uuid NOT NULL,
	CONSTRAINT "bug_version_number" UNIQUE("definition_id","version_number"),
	CONSTRAINT "bug_version_definition" UNIQUE("id","definition_id"),
	CONSTRAINT "bug_version_content" CHECK ("bug_versions"."version_number" between 1 and 1000 and "bug_versions"."content_revision">=1 and "bug_versions"."content_bytes">=4096
    and octet_length("bug_versions"."title") between 1 and 160 and length(btrim("bug_versions"."title"))>0 and octet_length("bug_versions"."statement")<=65536
    and "bug_versions"."difficulty" between 1 and 100 and "bug_versions"."base_bounty"="bug_versions"."difficulty"*10 and "bug_versions"."submission_format"='FULL_PROGRAM'
    and "bug_versions"."checker_mode" in ('TOKENS','EXACT_TEXT') and "bug_versions"."checker_version"='ingenium-text-v1'),
	CONSTRAINT "bug_version_publication" CHECK (("bug_versions"."publication_status"='DRAFT' and "bug_versions"."published_by" is null and "bug_versions"."published_at" is null)
    or ("bug_versions"."publication_status"='PUBLISHED' and "bug_versions"."published_by" is not null and "bug_versions"."published_at" is not null and "bug_versions"."published_at">="bug_versions"."created_at"))
);
--> statement-breakpoint
CREATE TABLE "catalogue_control" (
	"id" integer PRIMARY KEY NOT NULL,
	"revision" bigint DEFAULT 0 NOT NULL,
	"committed_bytes" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "catalogue_control_bounds" CHECK ("catalogue_control"."id"=1 and "catalogue_control"."revision">=0 and "catalogue_control"."committed_bytes" between 0 and 3221225472)
);
--> statement-breakpoint
CREATE TABLE "content_outcomes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"actor_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"credential_id" uuid NOT NULL,
	"credential_version" bigint NOT NULL,
	"action" text NOT NULL,
	"control_id" integer,
	"definition_id" uuid,
	"version_id" uuid,
	"request_key" uuid NOT NULL,
	"fingerprint" "bytea" NOT NULL,
	"payload_digest" "bytea" NOT NULL,
	"expected_revision" bigint NOT NULL,
	"reason" text NOT NULL,
	"outcome" text NOT NULL,
	"denial_reason" text,
	"recorded_at" timestamp (3) with time zone NOT NULL,
	"result_definition_id" uuid,
	"result_version_id" uuid,
	"result_revision" bigint,
	"result_case_id" uuid,
	CONSTRAINT "content_outcome_target" CHECK (("content_outcomes"."action"='CREATE' and "content_outcomes"."control_id" is not null and "content_outcomes"."control_id"=1 and "content_outcomes"."definition_id" is null and "content_outcomes"."version_id" is null)
    or ("content_outcomes"."action"='NEW_VERSION' and "content_outcomes"."control_id" is null and "content_outcomes"."definition_id" is not null and "content_outcomes"."version_id" is null)
    or ("content_outcomes"."action" in ('METADATA','VARIANT','CASE','DELETE_CASE','WITNESSES','HINT','REORDER_CASES') and "content_outcomes"."control_id" is null and "content_outcomes"."definition_id" is null and "content_outcomes"."version_id" is not null)),
	CONSTRAINT "content_outcome_payload" CHECK (octet_length("content_outcomes"."fingerprint")=32 and octet_length("content_outcomes"."payload_digest")=32 and "content_outcomes"."expected_revision">=0
    and octet_length("content_outcomes"."reason") between 1 and 1024 and length(btrim("content_outcomes"."reason"))>0),
	CONSTRAINT "content_outcome_result" CHECK (("content_outcomes"."outcome" in ('APPLIED','UNCHANGED') and "content_outcomes"."denial_reason" is null and "content_outcomes"."result_version_id" is not null
      and "content_outcomes"."result_definition_id" is not null and "content_outcomes"."result_revision" is not null and "content_outcomes"."result_revision">=1
      and ("content_outcomes"."action"='CASE' or "content_outcomes"."result_case_id" is null)
      and (("content_outcomes"."action" in ('CREATE','NEW_VERSION') and "content_outcomes"."outcome"='APPLIED' and "content_outcomes"."result_revision"=1)
        or ("content_outcomes"."version_id" is not null and "content_outcomes"."result_version_id"="content_outcomes"."version_id" and "content_outcomes"."result_revision"="content_outcomes"."expected_revision"+(case when "content_outcomes"."outcome"='APPLIED' then 1 else 0 end))))
    or ("content_outcomes"."outcome"='REJECTED' and "content_outcomes"."denial_reason" is not null and "content_outcomes"."denial_reason" in ('STALE_VERSION','CONTENT_LOCKED','POSITION_OCCUPIED','CASE_UNAVAILABLE','VARIANT_MISSING','REFERENCED_CASE','INVALID_ORDER')
      and num_nonnulls("content_outcomes"."result_definition_id","content_outcomes"."result_version_id","content_outcomes"."result_revision","content_outcomes"."result_case_id")=0))
);
--> statement-breakpoint
CREATE TABLE "content_read_audits" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"section" text NOT NULL,
	"recorded_at" timestamp (3) with time zone NOT NULL,
	CONSTRAINT "content_read_section" CHECK ("content_read_audits"."section" in ('VARIANTS','CASES','HINTS','WITNESSES'))
);
--> statement-breakpoint
CREATE TABLE "failure_witnesses" (
	"variant_id" uuid NOT NULL,
	"version_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"check_type" text NOT NULL,
	"test_case_id" uuid,
	"expected_failure" text NOT NULL,
	CONSTRAINT "failure_witnesses_variant_id_position_pk" PRIMARY KEY("variant_id","position"),
	CONSTRAINT "failure_witness_shape" CHECK ("failure_witnesses"."position" between 1 and 3 and (("failure_witnesses"."check_type"='COMPILATION' and "failure_witnesses"."test_case_id" is null and "failure_witnesses"."expected_failure"='COMPILATION_ERROR')
    or ("failure_witnesses"."check_type"='TEST_CASE' and "failure_witnesses"."test_case_id" is not null and "failure_witnesses"."expected_failure" in ('WRONG_ANSWER','RUNTIME_ERROR','TIME_LIMIT_EXCEEDED','MEMORY_LIMIT_EXCEEDED'))))
);
--> statement-breakpoint
CREATE TABLE "language_variants" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version_id" uuid NOT NULL,
	"language" text NOT NULL,
	"starter_code" "bytea" NOT NULL,
	"reference_code" "bytea" NOT NULL,
	"defect_description" text NOT NULL,
	"runtime_key" text,
	"cpu_ms" integer,
	"wall_ms" integer,
	"memory_kb" integer,
	CONSTRAINT "variant_version_language" UNIQUE("version_id","language"),
	CONSTRAINT "variant_same_version" UNIQUE("id","version_id"),
	CONSTRAINT "variant_content_bounds" CHECK ("language_variants"."language" in ('c','cpp','java','python','javascript') and octet_length("language_variants"."starter_code")<=131072
    and octet_length("language_variants"."reference_code")<=131072 and octet_length("language_variants"."defect_description")<=16384),
	CONSTRAINT "variant_runtime_bounds" CHECK (num_nonnulls("language_variants"."runtime_key","language_variants"."cpu_ms","language_variants"."wall_ms","language_variants"."memory_kb")=0
    or (num_nonnulls("language_variants"."runtime_key","language_variants"."cpu_ms","language_variants"."wall_ms","language_variants"."memory_kb")=4 and "language_variants"."cpu_ms" between 1 and (case when "language_variants"."language" in ('c','cpp') then 2000 else 4000 end)
      and "language_variants"."wall_ms" between "language_variants"."cpu_ms" and (case when "language_variants"."language" in ('c','cpp') then 10000 else 15000 end) and "language_variants"."memory_kb" between 1 and 524288))
);
--> statement-breakpoint
CREATE TABLE "runtime_manifests" (
	"key" text PRIMARY KEY NOT NULL,
	"language" text NOT NULL,
	"manifest" jsonb NOT NULL,
	"digest" "bytea" NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL,
	CONSTRAINT "runtime_key_language" UNIQUE("key","language"),
	CONSTRAINT "runtime_manifest_shape" CHECK ("runtime_manifests"."key" ~ '^[a-z0-9][a-z0-9._-]{0,63}$'
  and "runtime_manifests"."language" in ('c','cpp','java','python','javascript') and jsonb_typeof("runtime_manifests"."manifest")='object' and octet_length("runtime_manifests"."manifest"::text)<=32768
  and octet_length("runtime_manifests"."digest")=32 and "runtime_manifests"."digest"=sha256(convert_to("runtime_manifests"."manifest"::text,'UTF8')))
);
--> statement-breakpoint
CREATE TABLE "test_cases" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"visibility" text NOT NULL,
	"input_data" "bytea" NOT NULL,
	"expected_output" "bytea" NOT NULL,
	CONSTRAINT "case_same_version" UNIQUE("id","version_id"),
	CONSTRAINT "case_version_position" UNIQUE("version_id","position"),
	CONSTRAINT "case_bounds" CHECK ("test_cases"."position" between 1 and 20 and "test_cases"."visibility" in ('SAMPLE','HIDDEN') and octet_length("test_cases"."input_data")<=1048576 and octet_length("test_cases"."expected_output")<=1048576)
);
--> statement-breakpoint
ALTER TABLE "bug_definitions" ADD CONSTRAINT "bug_definitions_created_by_staff_identities_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."staff_identities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bug_hints" ADD CONSTRAINT "bug_hints_version_id_bug_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."bug_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bug_versions" ADD CONSTRAINT "bug_versions_definition_id_bug_definitions_id_fk" FOREIGN KEY ("definition_id") REFERENCES "public"."bug_definitions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bug_versions" ADD CONSTRAINT "bug_versions_created_by_staff_identities_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."staff_identities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bug_versions" ADD CONSTRAINT "bug_versions_published_by_staff_identities_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."staff_identities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bug_versions" ADD CONSTRAINT "bug_versions_last_source_id_content_outcomes_id_fk" FOREIGN KEY ("last_source_id") REFERENCES "public"."content_outcomes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_outcomes" ADD CONSTRAINT "content_outcomes_actor_id_staff_identities_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."staff_identities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_outcomes" ADD CONSTRAINT "content_outcomes_control_id_catalogue_control_id_fk" FOREIGN KEY ("control_id") REFERENCES "public"."catalogue_control"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_outcomes" ADD CONSTRAINT "content_outcomes_definition_id_bug_definitions_id_fk" FOREIGN KEY ("definition_id") REFERENCES "public"."bug_definitions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_outcomes" ADD CONSTRAINT "content_outcomes_version_id_bug_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."bug_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_outcomes" ADD CONSTRAINT "content_actor_session" FOREIGN KEY ("session_id","actor_id") REFERENCES "public"."staff_sessions"("id","staff_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_outcomes" ADD CONSTRAINT "content_actor_code" FOREIGN KEY ("credential_id","credential_version","actor_id") REFERENCES "public"."access_credentials"("id","version","staff_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_outcomes" ADD CONSTRAINT "content_result_version" FOREIGN KEY ("result_version_id","result_definition_id") REFERENCES "public"."bug_versions"("id","definition_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_outcomes" ADD CONSTRAINT "content_result_case" FOREIGN KEY ("result_case_id","result_version_id") REFERENCES "public"."test_cases"("id","version_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_read_audits" ADD CONSTRAINT "content_read_audits_version_id_bug_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."bug_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_read_audits" ADD CONSTRAINT "content_read_actor_session" FOREIGN KEY ("session_id","actor_id") REFERENCES "public"."staff_sessions"("id","staff_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "failure_witnesses" ADD CONSTRAINT "witness_variant_version" FOREIGN KEY ("variant_id","version_id") REFERENCES "public"."language_variants"("id","version_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "failure_witnesses" ADD CONSTRAINT "witness_case_version" FOREIGN KEY ("test_case_id","version_id") REFERENCES "public"."test_cases"("id","version_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "language_variants" ADD CONSTRAINT "language_variants_version_id_bug_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."bug_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "language_variants" ADD CONSTRAINT "variant_runtime_language" FOREIGN KEY ("runtime_key","language") REFERENCES "public"."runtime_manifests"("key","language") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_cases" ADD CONSTRAINT "test_cases_version_id_bug_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."bug_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "content_create_intent" ON "content_outcomes" USING btree ("actor_id","request_key") WHERE "content_outcomes"."action"='CREATE';--> statement-breakpoint
CREATE UNIQUE INDEX "content_new_version_intent" ON "content_outcomes" USING btree ("actor_id","definition_id","request_key") WHERE "content_outcomes"."action"='NEW_VERSION';--> statement-breakpoint
CREATE UNIQUE INDEX "content_edit_intent" ON "content_outcomes" USING btree ("actor_id","version_id","request_key") WHERE "content_outcomes"."version_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "content_applied_revision" ON "content_outcomes" USING btree ("result_version_id","result_revision") WHERE "content_outcomes"."outcome"='APPLIED';--> statement-breakpoint
CREATE UNIQUE INDEX "witness_unique_case" ON "failure_witnesses" USING btree ("variant_id","test_case_id") WHERE "failure_witnesses"."test_case_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "witness_one_compilation" ON "failure_witnesses" USING btree ("variant_id") WHERE "failure_witnesses"."check_type"='COMPILATION';