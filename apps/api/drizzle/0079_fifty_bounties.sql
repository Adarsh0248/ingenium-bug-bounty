ALTER TABLE "bounties" DROP CONSTRAINT "bounty_position";--> statement-breakpoint
ALTER TABLE "bounties" ADD CONSTRAINT "bounty_position" CHECK ("bounties"."position" between 1 and 50);
--> statement-breakpoint
DO $$
DECLARE definition text; marker text:='jsonb_array_length(p->''snapshots'') NOT BETWEEN 1 AND 40';
BEGIN
 SELECT pg_get_functiondef('public.competition_staff_command(uuid,uuid,uuid,bigint,text,jsonb,text,bytea)'::regprocedure) INTO definition;
 IF length(definition)-length(replace(definition,marker,''))<>length(marker) THEN RAISE EXCEPTION 'Unexpected bounty configuration definition'; END IF;
 EXECUTE replace(definition,marker,'jsonb_array_length(p->''snapshots'') NOT BETWEEN 1 AND 50');
END $$;
