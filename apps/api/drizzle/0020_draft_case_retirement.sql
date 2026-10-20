ALTER TABLE "test_cases" DROP CONSTRAINT "case_version_position";--> statement-breakpoint
ALTER TABLE "test_cases" DROP CONSTRAINT "case_bounds";--> statement-breakpoint
ALTER TABLE "test_cases" ADD COLUMN "removed_at" timestamp (3) with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "case_version_position" ON "test_cases" USING btree ("version_id","position") WHERE "test_cases"."removed_at" is null;--> statement-breakpoint
ALTER TABLE "test_cases" ADD CONSTRAINT "case_bounds" CHECK ("test_cases"."position" between 1 and 40 and "test_cases"."visibility" in ('SAMPLE','HIDDEN') and octet_length("test_cases"."input_data")<=1048576 and octet_length("test_cases"."expected_output")<=1048576);