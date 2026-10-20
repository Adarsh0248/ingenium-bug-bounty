CREATE TABLE "team_members" (
	"id" uuid PRIMARY KEY NOT NULL,
	"team_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"display_name" text NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT date_trunc('milliseconds', clock_timestamp()) NOT NULL,
	CONSTRAINT "team_members_team_position" UNIQUE("team_id","position"),
	CONSTRAINT "team_members_id_team" UNIQUE("id","team_id"),
	CONSTRAINT "team_members_position" CHECK ("team_members"."position" in (1, 2)),
	CONSTRAINT "team_members_display_name_bytes" CHECK (octet_length("team_members"."display_name") between 1 and 120),
	CONSTRAINT "team_members_display_name_nonblank" CHECK (length(btrim("team_members"."display_name")) > 0)
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT date_trunc('milliseconds', clock_timestamp()) NOT NULL,
	CONSTRAINT "teams_display_name_bytes" CHECK (octet_length("teams"."display_name") between 1 and 120),
	CONSTRAINT "teams_display_name_nonblank" CHECK (length(btrim("teams"."display_name")) > 0)
);
--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE restrict ON UPDATE restrict;