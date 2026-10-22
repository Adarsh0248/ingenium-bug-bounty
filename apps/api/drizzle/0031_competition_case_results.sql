CREATE TABLE "competition_case_results" (
	"submission_id" uuid NOT NULL,
	"case_id" uuid NOT NULL,
	"verdict" text NOT NULL,
	"evidence_digest" "bytea" NOT NULL,
	"recorded_at" timestamp (3) with time zone NOT NULL,
	CONSTRAINT "competition_case_results_submission_id_case_id_pk" PRIMARY KEY("submission_id","case_id"),
	CONSTRAINT "competition_case_verdict" CHECK ("competition_case_results"."verdict" in ('PASSED','WRONG_ANSWER','COMPILATION_ERROR','RUNTIME_ERROR','TIME_LIMIT_EXCEEDED','MEMORY_LIMIT_EXCEEDED','OUTPUT_LIMIT_EXCEEDED')),
	CONSTRAINT "competition_case_digest" CHECK (octet_length("competition_case_results"."evidence_digest")=32)
);
--> statement-breakpoint
ALTER TABLE "competition_case_results" ADD CONSTRAINT "competition_case_results_submission_id_competition_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."competition_submissions"("id") ON DELETE no action ON UPDATE no action;