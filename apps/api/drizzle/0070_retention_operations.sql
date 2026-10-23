CREATE TABLE "retention_progress" (
	"family" text PRIMARY KEY NOT NULL,
	"last_completed_at" timestamp (3) with time zone,
	"last_batch_count" integer DEFAULT 0 NOT NULL,
	"total_purged" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "retention_progress_shape" CHECK ("retention_progress"."family" in ('SECRETS','PAYLOADS') and "retention_progress"."last_batch_count" between 0 and 40 and "retention_progress"."total_purged" between 0 and 8000000
  and ("retention_progress"."last_completed_at" is not null or ("retention_progress"."last_batch_count"=0 and "retention_progress"."total_purged"=0)))
);
--> statement-breakpoint
INSERT INTO retention_progress(family,last_completed_at,total_purged)
  SELECT f.family,max(p.recorded_at),count(p.target_id) FROM (VALUES('SECRETS'),('PAYLOADS')) f(family)
    LEFT JOIN payload_purges p ON (p.kind IN ('entry_flows','staff_entry_flows','participant_sessions','staff_sessions'))=(f.family='SECRETS') GROUP BY f.family;
REVOKE ALL ON retention_progress FROM PUBLIC,ingenium_api;
GRANT SELECT ON retention_progress TO ingenium_api;
ALTER FUNCTION maintain_payload_retention(text) RENAME TO maintain_retention_batch;
REVOKE ALL ON FUNCTION maintain_retention_batch(text) FROM PUBLIC,ingenium_api;
CREATE FUNCTION maintain_payload_retention(family text) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE removed integer;
BEGIN
  removed=public.maintain_retention_batch(family);
  UPDATE public.retention_progress SET last_completed_at=date_trunc('milliseconds',clock_timestamp()),last_batch_count=removed,total_purged=total_purged+removed WHERE retention_progress.family=$1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Missing retention progress'; END IF;
  RETURN removed;
END $$;
REVOKE ALL ON FUNCTION maintain_payload_retention(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION maintain_payload_retention(text) TO ingenium_api;
