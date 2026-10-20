ALTER TABLE "bug_hints" DROP CONSTRAINT "bug_hints_version_id_level_pk";--> statement-breakpoint
ALTER TABLE "bug_hints" ADD COLUMN "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "bug_hints" ADD CONSTRAINT "hint_version_level" UNIQUE("version_id","level");--> statement-breakpoint
ALTER TABLE "bug_hints" ADD CONSTRAINT "hint_same_version" UNIQUE("id","version_id");