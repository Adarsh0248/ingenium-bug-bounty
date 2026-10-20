ALTER TABLE "content_read_audits" DROP CONSTRAINT "content_read_section";--> statement-breakpoint
ALTER TABLE "content_read_audits" ADD COLUMN "variant_id" uuid;--> statement-breakpoint
ALTER TABLE "content_read_audits" ADD COLUMN "case_id" uuid;--> statement-breakpoint
ALTER TABLE "content_read_audits" ADD CONSTRAINT "content_read_variant" FOREIGN KEY ("variant_id","version_id") REFERENCES "public"."language_variants"("id","version_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_read_audits" ADD CONSTRAINT "content_read_case" FOREIGN KEY ("case_id","version_id") REFERENCES "public"."test_cases"("id","version_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_read_audits" ADD CONSTRAINT "content_read_section" CHECK (("content_read_audits"."section"='VARIANTS' and "content_read_audits"."variant_id" is not null and "content_read_audits"."case_id" is null)
    or ("content_read_audits"."section"='CASES' and "content_read_audits"."case_id" is not null and "content_read_audits"."variant_id" is null)
    or ("content_read_audits"."section" in ('HINTS','WITNESSES') and "content_read_audits"."variant_id" is null and "content_read_audits"."case_id" is null));