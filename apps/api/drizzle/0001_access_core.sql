CREATE TABLE "access_blocks" (
	"id" uuid PRIMARY KEY NOT NULL,
	"arena_instance_id" uuid NOT NULL,
	"team_id" uuid,
	"member_id" uuid,
	"created_by" uuid NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL,
	"cleared_at" timestamp (3) with time zone,
	CONSTRAINT "access_block_target" CHECK (num_nonnulls("access_blocks"."team_id", "access_blocks"."member_id") = 1 and octet_length("access_blocks"."reason") between 1 and 1024 and ("access_blocks"."cleared_at" is null or "access_blocks"."cleared_at" >= "access_blocks"."created_at"))
);
--> statement-breakpoint
CREATE TABLE "access_credentials" (
	"id" uuid PRIMARY KEY NOT NULL,
	"team_id" uuid,
	"staff_id" uuid,
	"verifier" "bytea" NOT NULL,
	"version" bigint NOT NULL,
	"issued_at" timestamp (3) with time zone NOT NULL,
	"revoked_at" timestamp (3) with time zone,
	CONSTRAINT "credential_verifier_unique" UNIQUE("verifier"),
	CONSTRAINT "credential_team_version" UNIQUE("team_id","version"),
	CONSTRAINT "credential_staff_version" UNIQUE("staff_id","version"),
	CONSTRAINT "credential_id_version_team" UNIQUE("id","version","team_id"),
	CONSTRAINT "credential_exact_owner" CHECK (num_nonnulls("access_credentials"."team_id", "access_credentials"."staff_id") = 1),
	CONSTRAINT "credential_verifier" CHECK (octet_length("access_credentials"."verifier") = 32 and "access_credentials"."version" > 0),
	CONSTRAINT "credential_revoked_time" CHECK ("access_credentials"."revoked_at" is null or "access_credentials"."revoked_at" >= "access_credentials"."issued_at")
);
--> statement-breakpoint
CREATE TABLE "arena_control" (
	"id" integer PRIMARY KEY NOT NULL,
	"current_instance_id" uuid,
	"revision" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "arena_control_singleton" CHECK ("arena_control"."id" = 1 and "arena_control"."revision" >= 0)
);
--> statement-breakpoint
CREATE TABLE "arena_instances" (
	"id" uuid PRIMARY KEY NOT NULL,
	"status" text NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL,
	"revision" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "arena_instance_status" CHECK ("arena_instances"."status" in ('SETUP', 'IN_PROGRESS', 'COMPLETED', 'DISCARDED') and "arena_instances"."revision" >= 0)
);
--> statement-breakpoint
CREATE TABLE "entry_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"flow_id" uuid NOT NULL,
	"session_id" uuid,
	"kind" text NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL,
	CONSTRAINT "entry_event_kind" CHECK (("entry_events"."kind" = 'FLOW_OPENED' and "entry_events"."session_id" is null)
  or ("entry_events"."kind" in ('SESSION_ACTIVATED','SESSION_REVOKED') and "entry_events"."session_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "entry_flows" (
	"id" uuid PRIMARY KEY NOT NULL,
	"team_id" uuid NOT NULL,
	"credential_id" uuid NOT NULL,
	"credential_version" bigint NOT NULL,
	"proof_verifier" "bytea" NOT NULL,
	"round_id" uuid,
	"state" text NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL,
	"expires_at" timestamp (3) with time zone NOT NULL,
	"activated_session_id" uuid,
	"activated_at" timestamp (3) with time zone,
	CONSTRAINT "entry_flow_id_team" UNIQUE("id","team_id"),
	CONSTRAINT "entry_flow_shape" CHECK (octet_length("entry_flows"."proof_verifier") = 32 and "entry_flows"."expires_at" = "entry_flows"."created_at" + interval '10 minutes'
    and "entry_flows"."state" in ('OPEN', 'ACTIVATED', 'EXPIRED', 'REVOKED', 'SUPERSEDED')
    and (("entry_flows"."activated_session_id" is null and "entry_flows"."activated_at" is null and "entry_flows"."state" <> 'ACTIVATED')
      or ("entry_flows"."state" <> 'OPEN' and "entry_flows"."activated_session_id" is not null and "entry_flows"."activated_at" is not null and "entry_flows"."activated_at" >= "entry_flows"."created_at" and "entry_flows"."activated_at" < "entry_flows"."expires_at")))
);
--> statement-breakpoint
CREATE TABLE "entry_outcomes" (
	"flow_id" uuid NOT NULL,
	"request_key" uuid NOT NULL,
	"fingerprint" "bytea" NOT NULL,
	"member_id" uuid NOT NULL,
	"language" text NOT NULL,
	"outcome" text NOT NULL,
	"reason" text,
	"session_id" uuid,
	"recorded_at" timestamp (3) with time zone NOT NULL,
	CONSTRAINT "entry_outcomes_flow_id_request_key_pk" PRIMARY KEY("flow_id","request_key"),
	CONSTRAINT "entry_outcome_shape" CHECK (octet_length("entry_outcomes"."fingerprint") = 32
    and "entry_outcomes"."language" in ('c','cpp','java','python','javascript') and (("entry_outcomes"."outcome" = 'ACTIVATED' and "entry_outcomes"."session_id" is not null and "entry_outcomes"."reason" is null)
    or ("entry_outcomes"."outcome" = 'REJECTED' and "entry_outcomes"."session_id" is null and "entry_outcomes"."reason" is not null and "entry_outcomes"."reason" in ('ALREADY_ENROLLED','ROUND_UNAVAILABLE','ACCESS_UNAVAILABLE'))))
);
--> statement-breakpoint
CREATE TABLE "member_rounds" (
	"id" uuid PRIMARY KEY NOT NULL,
	"team_round_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"round_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"language" text,
	"enrolled_at" timestamp (3) with time zone,
	"first_entry_flow_id" uuid,
	CONSTRAINT "member_round_once" UNIQUE("member_id","round_id"),
	CONSTRAINT "member_round_session_scope" UNIQUE("id","member_id","team_id","round_id"),
	CONSTRAINT "member_round_name" CHECK (octet_length("member_rounds"."display_name") between 1 and 120 and length(btrim("member_rounds"."display_name")) > 0),
	CONSTRAINT "member_round_enrolment" CHECK (("member_rounds"."language" is null and "member_rounds"."enrolled_at" is null and "member_rounds"."first_entry_flow_id" is null)
    or ("member_rounds"."language" is not null and "member_rounds"."language" in ('c','cpp','java','python','javascript') and "member_rounds"."enrolled_at" is not null and "member_rounds"."first_entry_flow_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "member_session_slots" (
	"member_id" uuid PRIMARY KEY NOT NULL,
	"session_id" uuid,
	"revision" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "slot_revision" CHECK ("member_session_slots"."revision" >= 0)
);
--> statement-breakpoint
CREATE TABLE "participant_sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"member_round_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"round_id" uuid NOT NULL,
	"entry_flow_id" uuid NOT NULL,
	"credential_id" uuid NOT NULL,
	"credential_version" bigint NOT NULL,
	"secret_verifier" "bytea" NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL,
	"absolute_expires_at" timestamp (3) with time zone NOT NULL,
	"last_activity_at" timestamp (3) with time zone NOT NULL,
	"revoked_at" timestamp (3) with time zone,
	"revocation_reason" text,
	CONSTRAINT "session_id_member" UNIQUE("id","member_id"),
	CONSTRAINT "session_id_flow" UNIQUE("id","entry_flow_id"),
	CONSTRAINT "session_lifetime" CHECK (octet_length("participant_sessions"."secret_verifier") = 32 and "participant_sessions"."absolute_expires_at" = "participant_sessions"."created_at" + interval '8 hours'
    and "participant_sessions"."last_activity_at" >= "participant_sessions"."created_at" and "participant_sessions"."last_activity_at" < "participant_sessions"."absolute_expires_at"
    and (("participant_sessions"."revoked_at" is null and "participant_sessions"."revocation_reason" is null) or ("participant_sessions"."revoked_at" is not null and "participant_sessions"."revoked_at" >= "participant_sessions"."created_at" and "participant_sessions"."revocation_reason" is not null)))
);
--> statement-breakpoint
CREATE TABLE "quota_buckets" (
	"kind" text NOT NULL,
	"key_hash" "bytea" NOT NULL,
	"rate" integer NOT NULL,
	"burst" integer NOT NULL,
	"credits" bigint NOT NULL,
	"refilled_at" timestamp (3) with time zone NOT NULL,
	"seen_at" timestamp (3) with time zone NOT NULL,
	CONSTRAINT "quota_buckets_kind_key_hash_pk" PRIMARY KEY("kind","key_hash"),
	CONSTRAINT "quota_bucket_shape" CHECK ("quota_buckets"."kind" in ('AUTH_GLOBAL','AUTH_IP','AUTH_BROWSER','AUTH_CODE')
  and octet_length("quota_buckets"."key_hash") = 32 and "quota_buckets"."rate" > 0 and "quota_buckets"."burst" > 0 and "quota_buckets"."credits" between 0 and "quota_buckets"."burst"::bigint * 60000 and "quota_buckets"."seen_at" >= "quota_buckets"."refilled_at")
);
--> statement-breakpoint
CREATE TABLE "quota_control" (
	"id" integer PRIMARY KEY NOT NULL,
	CONSTRAINT "quota_control_singleton" CHECK ("quota_control"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE "rounds" (
	"id" uuid PRIMARY KEY NOT NULL,
	"arena_instance_id" uuid NOT NULL,
	"kind" integer NOT NULL,
	"state" text NOT NULL,
	"duration_ms" bigint NOT NULL,
	"started_at" timestamp (3) with time zone,
	"closes_at" timestamp (3) with time zone,
	"revision" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "round_instance_kind" UNIQUE("arena_instance_id","kind"),
	CONSTRAINT "round_id_instance" UNIQUE("id","arena_instance_id"),
	CONSTRAINT "round_kind_duration" CHECK ("rounds"."kind" in (1, 2) and "rounds"."duration_ms" between 1 and 18000000 and "rounds"."revision" >= 0),
	CONSTRAINT "round_state" CHECK ("rounds"."state" in ('DRAFT', 'READY', 'RUNNING', 'PAUSED', 'CLOSING', 'CLOSED', 'CANCELLING', 'CANCELLED')),
	CONSTRAINT "round_start_shape" CHECK (("rounds"."state" in ('DRAFT', 'READY') and "rounds"."started_at" is null and "rounds"."closes_at" is null)
    or ("rounds"."state" not in ('DRAFT', 'READY') and "rounds"."started_at" is not null and "rounds"."closes_at" is not null and "rounds"."closes_at" > "rounds"."started_at"))
);
--> statement-breakpoint
CREATE TABLE "security_control" (
	"id" integer PRIMARY KEY NOT NULL,
	"revision" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "security_control_singleton" CHECK ("security_control"."id" = 1 and "security_control"."revision" >= 0)
);
--> statement-breakpoint
CREATE TABLE "session_deliveries" (
	"flow_id" uuid PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"key_id" text NOT NULL,
	"ciphertext" text,
	"expires_at" timestamp (3) with time zone NOT NULL,
	"purged_at" timestamp (3) with time zone,
	CONSTRAINT "delivery_shape" CHECK (length("session_deliveries"."key_id") between 1 and 64 and (("session_deliveries"."ciphertext" is not null and octet_length("session_deliveries"."ciphertext") between 1 and 4096 and "session_deliveries"."purged_at" is null)
    or ("session_deliveries"."ciphertext" is null and "session_deliveries"."purged_at" is not null)))
);
--> statement-breakpoint
CREATE TABLE "staff_identities" (
	"id" uuid PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"role" text NOT NULL,
	"disabled_at" timestamp (3) with time zone,
	CONSTRAINT "staff_identity_role" CHECK ("staff_identities"."role" in ('ORGANISER', 'OWNER', 'SUPER_ADMIN')),
	CONSTRAINT "staff_identity_name" CHECK (octet_length("staff_identities"."display_name") between 1 and 120 and length(btrim("staff_identities"."display_name")) > 0)
);
--> statement-breakpoint
CREATE TABLE "team_rounds" (
	"id" uuid PRIMARY KEY NOT NULL,
	"team_id" uuid NOT NULL,
	"round_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	CONSTRAINT "team_round_once" UNIQUE("team_id","round_id"),
	CONSTRAINT "team_round_same_scope" UNIQUE("id","team_id","round_id"),
	CONSTRAINT "team_round_name" CHECK (octet_length("team_rounds"."display_name") between 1 and 120 and length(btrim("team_rounds"."display_name")) > 0)
);
--> statement-breakpoint
ALTER TABLE "access_blocks" ADD CONSTRAINT "access_blocks_arena_instance_id_arena_instances_id_fk" FOREIGN KEY ("arena_instance_id") REFERENCES "public"."arena_instances"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_blocks" ADD CONSTRAINT "access_blocks_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_blocks" ADD CONSTRAINT "access_blocks_member_id_team_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."team_members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_blocks" ADD CONSTRAINT "access_blocks_created_by_staff_identities_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."staff_identities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_credentials" ADD CONSTRAINT "access_credentials_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_credentials" ADD CONSTRAINT "access_credentials_staff_id_staff_identities_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff_identities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arena_control" ADD CONSTRAINT "arena_control_current_instance_id_arena_instances_id_fk" FOREIGN KEY ("current_instance_id") REFERENCES "public"."arena_instances"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arena_instances" ADD CONSTRAINT "arena_instances_created_by_staff_identities_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."staff_identities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entry_events" ADD CONSTRAINT "entry_events_flow_id_entry_flows_id_fk" FOREIGN KEY ("flow_id") REFERENCES "public"."entry_flows"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entry_events" ADD CONSTRAINT "entry_events_session_id_participant_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."participant_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entry_events" ADD CONSTRAINT "entry_event_session_flow" FOREIGN KEY ("session_id","flow_id") REFERENCES "public"."participant_sessions"("id","entry_flow_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entry_flows" ADD CONSTRAINT "entry_flows_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entry_flows" ADD CONSTRAINT "entry_flows_activated_session_id_participant_sessions_id_fk" FOREIGN KEY ("activated_session_id") REFERENCES "public"."participant_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entry_flows" ADD CONSTRAINT "entry_flow_credential_owner" FOREIGN KEY ("credential_id","credential_version","team_id") REFERENCES "public"."access_credentials"("id","version","team_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entry_outcomes" ADD CONSTRAINT "entry_outcomes_flow_id_entry_flows_id_fk" FOREIGN KEY ("flow_id") REFERENCES "public"."entry_flows"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entry_outcomes" ADD CONSTRAINT "entry_outcomes_member_id_team_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."team_members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entry_outcomes" ADD CONSTRAINT "entry_outcomes_session_id_participant_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."participant_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_rounds" ADD CONSTRAINT "member_round_registered_team" FOREIGN KEY ("member_id","team_id") REFERENCES "public"."team_members"("id","team_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_rounds" ADD CONSTRAINT "member_round_team_round" FOREIGN KEY ("team_round_id","team_id","round_id") REFERENCES "public"."team_rounds"("id","team_id","round_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_rounds" ADD CONSTRAINT "member_round_entry_team" FOREIGN KEY ("first_entry_flow_id","team_id") REFERENCES "public"."entry_flows"("id","team_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_session_slots" ADD CONSTRAINT "member_session_slots_member_id_team_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."team_members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_session_slots" ADD CONSTRAINT "slot_session_member" FOREIGN KEY ("session_id","member_id") REFERENCES "public"."participant_sessions"("id","member_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant_sessions" ADD CONSTRAINT "session_member_scope" FOREIGN KEY ("member_round_id","member_id","team_id","round_id") REFERENCES "public"."member_rounds"("id","member_id","team_id","round_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant_sessions" ADD CONSTRAINT "session_credential_owner" FOREIGN KEY ("credential_id","credential_version","team_id") REFERENCES "public"."access_credentials"("id","version","team_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant_sessions" ADD CONSTRAINT "session_entry_team" FOREIGN KEY ("entry_flow_id","team_id") REFERENCES "public"."entry_flows"("id","team_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_arena_instance_id_arena_instances_id_fk" FOREIGN KEY ("arena_instance_id") REFERENCES "public"."arena_instances"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_deliveries" ADD CONSTRAINT "delivery_session_flow" FOREIGN KEY ("session_id","flow_id") REFERENCES "public"."participant_sessions"("id","entry_flow_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_rounds" ADD CONSTRAINT "team_rounds_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_rounds" ADD CONSTRAINT "team_rounds_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "access_block_one_team" ON "access_blocks" USING btree ("arena_instance_id","team_id") WHERE "access_blocks"."cleared_at" is null and "access_blocks"."team_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "access_block_one_member" ON "access_blocks" USING btree ("arena_instance_id","member_id") WHERE "access_blocks"."cleared_at" is null and "access_blocks"."member_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "credential_one_active_team" ON "access_credentials" USING btree ("team_id") WHERE "access_credentials"."revoked_at" is null and "access_credentials"."team_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "credential_one_active_staff" ON "access_credentials" USING btree ("staff_id") WHERE "access_credentials"."revoked_at" is null and "access_credentials"."staff_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "arena_one_reserved_instance" ON "arena_instances" USING btree ((true)) WHERE "arena_instances"."status" in ('SETUP', 'IN_PROGRESS');--> statement-breakpoint
CREATE UNIQUE INDEX "session_one_unrevoked_member" ON "participant_sessions" USING btree ("member_id") WHERE "participant_sessions"."revoked_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "round_one_live_per_instance" ON "rounds" USING btree ("arena_instance_id") WHERE "rounds"."state" in ('RUNNING','PAUSED','CLOSING','CANCELLING');