CREATE TABLE "clock_clearances" (
	"id" uuid PRIMARY KEY NOT NULL,
	"staff_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"credential_id" uuid NOT NULL,
	"credential_version" bigint NOT NULL,
	"request_key" uuid NOT NULL,
	"fingerprint" "bytea" NOT NULL,
	"runtime_id" uuid NOT NULL,
	"generation" bigint NOT NULL,
	"report_sequence" bigint NOT NULL,
	"reason" text NOT NULL,
	"recorded_at" timestamp (3) with time zone NOT NULL,
	CONSTRAINT "clock_clearance_generation" UNIQUE("generation"),
	CONSTRAINT "clock_clearance_intent" UNIQUE("staff_id","request_key"),
	CONSTRAINT "clock_clearance_shape" CHECK ("clock_clearances"."generation">0 and "clock_clearances"."report_sequence">0 and octet_length("clock_clearances"."fingerprint")=32 and octet_length("clock_clearances"."reason") between 1 and 1024 and length(btrim("clock_clearances"."reason"))>0)
);
--> statement-breakpoint
CREATE TABLE "staff_entry_flows" (
	"id" uuid PRIMARY KEY NOT NULL,
	"staff_id" uuid NOT NULL,
	"credential_id" uuid NOT NULL,
	"credential_version" bigint NOT NULL,
	"proof_verifier" "bytea" NOT NULL,
	"mode" text NOT NULL,
	"generation" bigint NOT NULL,
	"state" text NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL,
	"expires_at" timestamp (3) with time zone NOT NULL,
	"session_id" uuid,
	"activated_at" timestamp (3) with time zone,
	CONSTRAINT "staff_flow_owner" UNIQUE("id","staff_id"),
	CONSTRAINT "staff_flow_shape" CHECK (octet_length("staff_entry_flows"."proof_verifier")=32 and "staff_entry_flows"."expires_at"="staff_entry_flows"."created_at"+interval '10 minutes'
    and "staff_entry_flows"."mode" in ('NORMAL','CLOCK_RECOVERY') and "staff_entry_flows"."generation">=0 and ("staff_entry_flows"."mode"<>'CLOCK_RECOVERY' or "staff_entry_flows"."generation">0)
    and "staff_entry_flows"."state" in ('OPEN','ACTIVATED','EXPIRED','REVOKED','SUPERSEDED')
    and (("staff_entry_flows"."session_id" is null and "staff_entry_flows"."activated_at" is null and "staff_entry_flows"."state"<>'ACTIVATED')
      or ("staff_entry_flows"."session_id" is not null and "staff_entry_flows"."activated_at" is not null and "staff_entry_flows"."state"<>'OPEN' and "staff_entry_flows"."activated_at">="staff_entry_flows"."created_at" and "staff_entry_flows"."activated_at"<"staff_entry_flows"."expires_at")))
);
--> statement-breakpoint
CREATE TABLE "staff_entry_outcomes" (
	"flow_id" uuid NOT NULL,
	"request_key" uuid NOT NULL,
	"fingerprint" "bytea" NOT NULL,
	"session_id" uuid NOT NULL,
	"recorded_at" timestamp (3) with time zone NOT NULL,
	CONSTRAINT "staff_entry_outcomes_flow_id_request_key_pk" PRIMARY KEY("flow_id","request_key"),
	CONSTRAINT "staff_one_activation" UNIQUE("flow_id"),
	CONSTRAINT "staff_outcome_fingerprint" CHECK (octet_length("staff_entry_outcomes"."fingerprint")=32)
);
--> statement-breakpoint
CREATE TABLE "staff_session_deliveries" (
	"flow_id" uuid PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"key_id" text NOT NULL,
	"ciphertext" text,
	"expires_at" timestamp (3) with time zone NOT NULL,
	"purged_at" timestamp (3) with time zone,
	CONSTRAINT "staff_delivery_shape" CHECK (length("staff_session_deliveries"."key_id") between 1 and 64 and (("staff_session_deliveries"."ciphertext" is not null and octet_length("staff_session_deliveries"."ciphertext") between 1 and 4096 and "staff_session_deliveries"."purged_at" is null) or ("staff_session_deliveries"."ciphertext" is null and "staff_session_deliveries"."purged_at" is not null)))
);
--> statement-breakpoint
CREATE TABLE "staff_session_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"recorded_at" timestamp (3) with time zone NOT NULL,
	CONSTRAINT "staff_session_event_kind" CHECK ("staff_session_events"."kind" in ('ACTIVATED','SIGNED_OUT','SUPERSEDED'))
);
--> statement-breakpoint
CREATE TABLE "staff_session_slots" (
	"staff_id" uuid PRIMARY KEY NOT NULL,
	"session_id" uuid,
	"revision" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "staff_slot_revision" CHECK ("staff_session_slots"."revision">=0)
);
--> statement-breakpoint
CREATE TABLE "staff_sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"staff_id" uuid NOT NULL,
	"flow_id" uuid NOT NULL,
	"credential_id" uuid NOT NULL,
	"credential_version" bigint NOT NULL,
	"secret_verifier" "bytea" NOT NULL,
	"mode" text NOT NULL,
	"generation" bigint NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL,
	"absolute_expires_at" timestamp (3) with time zone NOT NULL,
	"last_activity_at" timestamp (3) with time zone NOT NULL,
	"revoked_at" timestamp (3) with time zone,
	"revocation_reason" text,
	CONSTRAINT "staff_session_owner" UNIQUE("id","staff_id"),
	CONSTRAINT "staff_session_flow" UNIQUE("id","flow_id"),
	CONSTRAINT "staff_session_lifetime" CHECK (octet_length("staff_sessions"."secret_verifier")=32 and "staff_sessions"."absolute_expires_at"="staff_sessions"."created_at"+interval '8 hours'
    and "staff_sessions"."last_activity_at">="staff_sessions"."created_at" and "staff_sessions"."last_activity_at"<"staff_sessions"."absolute_expires_at"
    and "staff_sessions"."mode" in ('NORMAL','CLOCK_RECOVERY') and "staff_sessions"."generation">=0 and ("staff_sessions"."mode"<>'CLOCK_RECOVERY' or "staff_sessions"."generation">0)
    and (("staff_sessions"."revoked_at" is null and "staff_sessions"."revocation_reason" is null) or ("staff_sessions"."revoked_at">="staff_sessions"."created_at" and "staff_sessions"."revocation_reason" is not null)))
);
--> statement-breakpoint
ALTER TABLE "quota_buckets" DROP CONSTRAINT "quota_bucket_shape";--> statement-breakpoint
ALTER TABLE "access_credentials" ADD CONSTRAINT "credential_id_version_staff" UNIQUE("id","version","staff_id");--> statement-breakpoint
ALTER TABLE "clock_clearances" ADD CONSTRAINT "clock_clearances_runtime_id_clock_runs_id_fk" FOREIGN KEY ("runtime_id") REFERENCES "public"."clock_runs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clock_clearances" ADD CONSTRAINT "clearance_session_actor" FOREIGN KEY ("session_id","staff_id") REFERENCES "public"."staff_sessions"("id","staff_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clock_clearances" ADD CONSTRAINT "clearance_credential_actor" FOREIGN KEY ("credential_id","credential_version","staff_id") REFERENCES "public"."access_credentials"("id","version","staff_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_entry_flows" ADD CONSTRAINT "staff_entry_flows_staff_id_staff_identities_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff_identities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_entry_flows" ADD CONSTRAINT "staff_entry_flows_session_id_staff_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."staff_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_entry_flows" ADD CONSTRAINT "staff_flow_credential" FOREIGN KEY ("credential_id","credential_version","staff_id") REFERENCES "public"."access_credentials"("id","version","staff_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_entry_outcomes" ADD CONSTRAINT "staff_entry_outcomes_flow_id_staff_entry_flows_id_fk" FOREIGN KEY ("flow_id") REFERENCES "public"."staff_entry_flows"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_entry_outcomes" ADD CONSTRAINT "staff_entry_outcomes_session_id_staff_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."staff_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_session_deliveries" ADD CONSTRAINT "staff_delivery_flow" FOREIGN KEY ("session_id","flow_id") REFERENCES "public"."staff_sessions"("id","flow_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_session_events" ADD CONSTRAINT "staff_session_events_session_id_staff_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."staff_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_session_slots" ADD CONSTRAINT "staff_session_slots_staff_id_staff_identities_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff_identities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_session_slots" ADD CONSTRAINT "staff_slot_owner" FOREIGN KEY ("session_id","staff_id") REFERENCES "public"."staff_sessions"("id","staff_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_sessions" ADD CONSTRAINT "staff_sessions_staff_id_staff_identities_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff_identities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_sessions" ADD CONSTRAINT "staff_session_credential" FOREIGN KEY ("credential_id","credential_version","staff_id") REFERENCES "public"."access_credentials"("id","version","staff_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_sessions" ADD CONSTRAINT "staff_session_flow_owner" FOREIGN KEY ("flow_id","staff_id") REFERENCES "public"."staff_entry_flows"("id","staff_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "staff_one_unrevoked" ON "staff_sessions" USING btree ("staff_id") WHERE "staff_sessions"."revoked_at" is null;--> statement-breakpoint
ALTER TABLE "quota_buckets" ADD CONSTRAINT "quota_bucket_shape" CHECK ("quota_buckets"."kind" in ('AUTH_GLOBAL','AUTH_IP','AUTH_BROWSER','AUTH_CODE','HTTP_GLOBAL','HTTP_IP','READ_MEMBER','READ_STAFF','STAFF_CONFIRM','STAFF_COMMAND')
  and octet_length("quota_buckets"."key_hash") = 32 and "quota_buckets"."rate" > 0 and "quota_buckets"."burst" > 0 and "quota_buckets"."credits" between 0 and "quota_buckets"."burst"::bigint * 60000 and "quota_buckets"."seen_at" >= "quota_buckets"."refilled_at");
