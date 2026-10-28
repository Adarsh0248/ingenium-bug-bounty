ALTER TABLE "bounties" DROP CONSTRAINT "bounty_position";
--> statement-breakpoint
ALTER TABLE "bounties" ADD CONSTRAINT "bounty_position" CHECK ("bounties"."position" between 1 and 100);
--> statement-breakpoint
DO $$
DECLARE definition text; marker text:='jsonb_array_length(p->''snapshots'') NOT BETWEEN 1 AND 50';
BEGIN
 SELECT pg_get_functiondef('public.competition_staff_command(uuid,uuid,uuid,bigint,text,jsonb,text,bytea)'::regprocedure) INTO definition;
 IF length(definition)-length(replace(definition,marker,''))<>length(marker) THEN RAISE EXCEPTION 'Unexpected bounty configuration definition'; END IF;
 EXECUTE replace(definition,marker,'jsonb_array_length(p->''snapshots'') NOT BETWEEN 1 AND (CASE WHEN r.kind=2 THEN 100 ELSE 50 END)');
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION competition_selection_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE subject uuid;
BEGIN
  IF TG_OP='DELETE' THEN subject=OLD.round_id; ELSE subject=NEW.round_id; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.rounds r JOIN public.arena_control c ON c.current_instance_id=r.arena_instance_id
    WHERE c.id=1 AND r.id=subject AND r.state IN ('DRAFT','READY')) OR EXISTS(SELECT 1 FROM public.team_rounds WHERE round_id=subject) THEN RAISE EXCEPTION 'Launched selection is immutable'; END IF;
  IF TG_OP='UPDATE' THEN RAISE EXCEPTION 'Replace unlaunched selection, never retarget'; END IF;
  IF TG_OP='INSERT' AND TG_TABLE_NAME='bounties' THEN
    IF NEW.position>(SELECT CASE WHEN kind=2 THEN 100 ELSE 50 END FROM public.rounds WHERE id=subject) THEN
      RAISE EXCEPTION 'Invalid bounty position for round' USING ERRCODE='23514',CONSTRAINT='bounty_position';
    END IF;
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
