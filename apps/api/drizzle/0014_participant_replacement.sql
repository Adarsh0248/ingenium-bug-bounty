CREATE TABLE "replacement_requests" (
	"flow_id" uuid PRIMARY KEY NOT NULL,
	"parent_flow_id" uuid NOT NULL,
	"request_key" uuid NOT NULL,
	"fingerprint" "bytea" NOT NULL,
	"member_round_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"round_id" uuid NOT NULL,
	"expected_session_id" uuid,
	"expected_slot_revision" bigint NOT NULL,
	"state" text NOT NULL,
	"proof_key_id" text NOT NULL,
	"proof_ciphertext" text,
	"proof_purged_at" timestamp (3) with time zone,
	CONSTRAINT "replacement_create_intent" UNIQUE("parent_flow_id","request_key"),
	CONSTRAINT "replacement_flow_member" UNIQUE("flow_id","member_id"),
	CONSTRAINT "replacement_request_shape" CHECK ("replacement_requests"."flow_id"<>"replacement_requests"."parent_flow_id" and octet_length("replacement_requests"."fingerprint")=32 and "replacement_requests"."expected_slot_revision">=0
    and "replacement_requests"."state" in ('PENDING','APPROVED','ACTIVATED','REJECTED','EXPIRED','SUPERSEDED') and length("replacement_requests"."proof_key_id") between 1 and 64
    and (("replacement_requests"."proof_ciphertext" is not null and octet_length("replacement_requests"."proof_ciphertext") between 1 and 4096 and "replacement_requests"."proof_purged_at" is null)
      or ("replacement_requests"."proof_ciphertext" is null and "replacement_requests"."proof_purged_at" is not null)))
);
--> statement-breakpoint
CREATE TABLE "replacement_decisions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"flow_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"credential_id" uuid NOT NULL,
	"credential_version" bigint NOT NULL,
	"request_key" uuid NOT NULL,
	"fingerprint" "bytea" NOT NULL,
	"action" text NOT NULL,
	"expected_revision" bigint NOT NULL,
	"reason" text NOT NULL,
	"outcome" text NOT NULL,
	"denial_reason" text,
	"recorded_at" timestamp (3) with time zone NOT NULL,
	CONSTRAINT "replacement_decision_intent" UNIQUE("actor_id","request_key"),
	CONSTRAINT "replacement_decision_shape" CHECK ("replacement_decisions"."action" in ('APPROVE','REJECT') and "replacement_decisions"."expected_revision">=0 and octet_length("replacement_decisions"."fingerprint")=32
    and octet_length("replacement_decisions"."reason") between 1 and 1024 and length(btrim("replacement_decisions"."reason"))>0
    and (("replacement_decisions"."outcome"='APPLIED' and "replacement_decisions"."denial_reason" is null) or ("replacement_decisions"."outcome"='REJECTED' and "replacement_decisions"."denial_reason" in ('STALE_REQUEST','EXPIRED','ROUND_UNAVAILABLE','ACCESS_UNAVAILABLE','HANDOFF_RESERVED'))))
);
--> statement-breakpoint
ALTER TABLE "member_session_slots" DROP CONSTRAINT "slot_revision";--> statement-breakpoint
ALTER TABLE "entry_flows" ADD COLUMN "purpose" text DEFAULT 'TEAM_ENTRY' NOT NULL;--> statement-breakpoint
ALTER TABLE "member_session_slots" ADD COLUMN "reservation_flow_id" uuid;--> statement-breakpoint
ALTER TABLE "replacement_requests" ADD CONSTRAINT "replacement_flow_team" FOREIGN KEY ("flow_id","team_id") REFERENCES "public"."entry_flows"("id","team_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replacement_requests" ADD CONSTRAINT "replacement_parent_team" FOREIGN KEY ("parent_flow_id","team_id") REFERENCES "public"."entry_flows"("id","team_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replacement_requests" ADD CONSTRAINT "replacement_member_scope" FOREIGN KEY ("member_round_id","member_id","team_id","round_id") REFERENCES "public"."member_rounds"("id","member_id","team_id","round_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replacement_requests" ADD CONSTRAINT "replacement_expected_member" FOREIGN KEY ("expected_session_id","member_id") REFERENCES "public"."participant_sessions"("id","member_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replacement_decisions" ADD CONSTRAINT "replacement_decisions_flow_id_replacement_requests_flow_id_fk" FOREIGN KEY ("flow_id") REFERENCES "public"."replacement_requests"("flow_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replacement_decisions" ADD CONSTRAINT "replacement_decisions_actor_id_staff_identities_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."staff_identities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replacement_decisions" ADD CONSTRAINT "replacement_decision_actor_session" FOREIGN KEY ("session_id","actor_id") REFERENCES "public"."staff_sessions"("id","staff_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replacement_decisions" ADD CONSTRAINT "replacement_decision_actor_code" FOREIGN KEY ("credential_id","credential_version","actor_id") REFERENCES "public"."access_credentials"("id","version","staff_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "replacement_one_approved" ON "replacement_requests" USING btree ("member_id") WHERE "replacement_requests"."state"='APPROVED';--> statement-breakpoint
CREATE UNIQUE INDEX "replacement_one_applied_decision" ON "replacement_decisions" USING btree ("flow_id") WHERE "replacement_decisions"."outcome"='APPLIED';--> statement-breakpoint
ALTER TABLE "member_session_slots" ADD CONSTRAINT "slot_reservation_member" FOREIGN KEY ("reservation_flow_id","member_id") REFERENCES "public"."replacement_requests"("flow_id","member_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entry_flows" ADD CONSTRAINT "entry_flow_purpose" CHECK ("entry_flows"."purpose" in ('TEAM_ENTRY','REPLACEMENT'));--> statement-breakpoint
ALTER TABLE "member_session_slots" ADD CONSTRAINT "slot_revision" CHECK ("member_session_slots"."revision" >= 0 and num_nonnulls("member_session_slots"."session_id","member_session_slots"."reservation_flow_id")<=1);