CREATE TABLE "clock_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"runtime_id" uuid NOT NULL,
	"generation" bigint DEFAULT 0 NOT NULL,
	"kind" text NOT NULL,
	"reason" text,
	"observed_at" timestamp (3) with time zone NOT NULL,
	"evidence" jsonb NOT NULL,
	CONSTRAINT "clock_event_shape" CHECK ("clock_events"."generation">=0 and "clock_events"."kind" in ('STARTED','FAULT','TRUST_ESTABLISHED','STOPPED')
    and (("clock_events"."kind"='FAULT' and "clock_events"."reason" is not null) or ("clock_events"."kind"<>'FAULT' and "clock_events"."reason" is null))
    and jsonb_typeof("clock_events"."evidence")='object' and octet_length("clock_events"."evidence"::text)<=4096)
);
--> statement-breakpoint
CREATE TABLE "clock_health" (
	"id" integer PRIMARY KEY NOT NULL,
	"runtime_id" uuid,
	"boot_id" uuid,
	"running" boolean DEFAULT false NOT NULL,
	"fault_latched" boolean DEFAULT false NOT NULL,
	"fault_generation" bigint DEFAULT 0 NOT NULL,
	"fault_reason" text,
	"sequence" bigint DEFAULT 0 NOT NULL,
	"received_ns" bigint,
	"report" jsonb,
	"healthy_count" integer DEFAULT 0 NOT NULL,
	"healthy_since_ns" bigint,
	"healthy_last_ns" bigint,
	"state" text DEFAULT 'STOPPED' NOT NULL,
	CONSTRAINT "clock_health_shape" CHECK ("clock_health"."id"=1 and "clock_health"."fault_generation">=0 and "clock_health"."sequence">=0 and "clock_health"."healthy_count" between 0 and 7
    and "clock_health"."state" in ('STOPPED','STARTING','HEALTHY','WARNING','FAULT')
    and (("clock_health"."runtime_id" is null and "clock_health"."boot_id" is null and not "clock_health"."running") or ("clock_health"."runtime_id" is not null and "clock_health"."boot_id" is not null))
    and (("clock_health"."fault_latched" and "clock_health"."fault_reason" is not null and "clock_health"."fault_generation">0) or (not "clock_health"."fault_latched" and "clock_health"."fault_reason" is null))
    and (("clock_health"."healthy_count"=0 and "clock_health"."healthy_since_ns" is null and "clock_health"."healthy_last_ns" is null)
      or ("clock_health"."healthy_count">0 and "clock_health"."healthy_since_ns" is not null and "clock_health"."healthy_since_ns">=0 and "clock_health"."healthy_last_ns" is not null and "clock_health"."healthy_last_ns">="clock_health"."healthy_since_ns"))
    and ("clock_health"."state" not in ('HEALTHY','WARNING') or (not "clock_health"."fault_latched" and "clock_health"."running" and "clock_health"."healthy_count"=7 and "clock_health"."received_ns" is not null and "clock_health"."report" is not null))
    and ("clock_health"."received_ns" is null or "clock_health"."received_ns">=0)
    and ("clock_health"."report" is null or (jsonb_typeof("clock_health"."report")='object' and octet_length("clock_health"."report"::text)<=4096)))
);
--> statement-breakpoint
CREATE TABLE "clock_runs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"boot_id" uuid NOT NULL,
	"started_observed_at" timestamp (3) with time zone NOT NULL,
	"stopped_observed_at" timestamp (3) with time zone,
	CONSTRAINT "clock_run_boot" UNIQUE("id","boot_id")
);
--> statement-breakpoint
ALTER TABLE "rounds" ADD COLUMN "trusted_time_at" timestamp (3) with time zone;--> statement-breakpoint
ALTER TABLE "clock_events" ADD CONSTRAINT "clock_events_runtime_id_clock_runs_id_fk" FOREIGN KEY ("runtime_id") REFERENCES "public"."clock_runs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clock_health" ADD CONSTRAINT "clock_health_run" FOREIGN KEY ("runtime_id","boot_id") REFERENCES "public"."clock_runs"("id","boot_id") ON DELETE restrict ON UPDATE no action;