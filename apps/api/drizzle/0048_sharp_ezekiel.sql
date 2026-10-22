CREATE TABLE "content_publication_outcomes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"credential_id" uuid NOT NULL,
	"credential_version" bigint NOT NULL,
	"request_key" uuid NOT NULL,
	"expected_revision" bigint NOT NULL,
	"fingerprint" "bytea" NOT NULL,
	"review" text NOT NULL,
	"outcome" text NOT NULL,
	"denial_reason" text,
	"recorded_at" timestamp (3) with time zone NOT NULL,
	CONSTRAINT "content_publication_intent" UNIQUE("actor_id","snapshot_id","request_key"),
	CONSTRAINT "content_publication_shape" CHECK ("content_publication_outcomes"."credential_version">0 and "content_publication_outcomes"."expected_revision">0 and octet_length("content_publication_outcomes"."fingerprint")=32
    and octet_length("content_publication_outcomes"."review") between 1 and 1024 and btrim("content_publication_outcomes"."review")<>''
    and (("content_publication_outcomes"."outcome"='APPLIED' and "content_publication_outcomes"."denial_reason" is null) or ("content_publication_outcomes"."outcome"='REJECTED' and "content_publication_outcomes"."denial_reason" in
      ('STALE_VERSION','CONTENT_LOCKED','ARENA_ACTIVE','VALIDATION_NOT_PASSED','CLEANUP_PENDING'))))
);
--> statement-breakpoint
ALTER TABLE "content_publication_outcomes" ADD CONSTRAINT "content_publication_outcomes_snapshot_id_validation_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."validation_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_publication_outcomes" ADD CONSTRAINT "content_publication_outcomes_run_id_validation_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."validation_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_publication_outcomes" ADD CONSTRAINT "content_publication_outcomes_actor_id_staff_identities_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."staff_identities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_publication_outcomes" ADD CONSTRAINT "content_publication_outcomes_session_id_staff_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."staff_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_publication_outcomes" ADD CONSTRAINT "content_publication_outcomes_credential_id_access_credentials_id_fk" FOREIGN KEY ("credential_id") REFERENCES "public"."access_credentials"("id") ON DELETE no action ON UPDATE no action;