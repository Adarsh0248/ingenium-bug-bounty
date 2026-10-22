ALTER TABLE "live_streams" ADD COLUMN "retain_until" timestamp (3) with time zone;
--> statement-breakpoint
UPDATE live_streams SET retain_until=date_trunc('milliseconds',clock_timestamp())+interval '24 hours' WHERE round_id IN(
  SELECT r.id FROM rounds r JOIN arena_instances a ON a.id=r.arena_instance_id WHERE a.status IN ('COMPLETED','DISCARDED'));
--> statement-breakpoint
DO $$ DECLARE item record; BEGIN
  FOR item IN SELECT id,lane FROM participant_judging WHERE status<>'COMPLETED' ORDER BY id LOOP
    PERFORM live_reserve(item.id,NULL,CASE WHEN item.lane='OFFICIAL' THEN 1024 ELSE 256 END);
  END LOOP;
  FOR item IN SELECT id FROM validation_runs WHERE status IN ('QUEUED','RUNNING') ORDER BY id LOOP
    PERFORM live_reserve(NULL,item.id,2048);
  END LOOP;
END $$;
