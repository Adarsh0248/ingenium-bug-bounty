CREATE TABLE "participant_session_outcomes" (
	"session_id" uuid NOT NULL,
	"request_key" uuid NOT NULL,
	"action" text NOT NULL,
	"fingerprint" "bytea" NOT NULL,
	"recorded_at" timestamp (3) with time zone NOT NULL,
	"expires_at" timestamp (3) with time zone NOT NULL,
	CONSTRAINT "participant_session_outcomes_session_id_request_key_pk" PRIMARY KEY("session_id","request_key"),
	CONSTRAINT "participant_session_outcome_shape" CHECK ("participant_session_outcomes"."action" in ('KEEP_ALIVE','LOGOUT') and octet_length("participant_session_outcomes"."fingerprint")=32 and "participant_session_outcomes"."expires_at">"participant_session_outcomes"."recorded_at")
);
--> statement-breakpoint
ALTER TABLE "quota_buckets" DROP CONSTRAINT "quota_bucket_shape";--> statement-breakpoint
ALTER TABLE "participant_session_outcomes" ADD CONSTRAINT "participant_session_outcomes_session_id_participant_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."participant_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quota_buckets" ADD CONSTRAINT "quota_bucket_shape" CHECK ("quota_buckets"."kind" in ('AUTH_GLOBAL','AUTH_IP','AUTH_BROWSER','AUTH_CODE','HTTP_GLOBAL','HTTP_IP','READ_MEMBER','MEMBER_COMMAND','READ_STAFF','STAFF_CONFIRM','STAFF_COMMAND')
  and octet_length("quota_buckets"."key_hash") = 32 and "quota_buckets"."rate" > 0 and "quota_buckets"."burst" > 0 and "quota_buckets"."credits" between 0 and "quota_buckets"."burst"::bigint * 60000 and "quota_buckets"."seen_at" >= "quota_buckets"."refilled_at");