-- Preserve every existing accounting check while permitting the qualified event ceiling.
DO $$
DECLARE definition text; marker text='(SELECT count(*) FROM public.execution_capacity_slots)<>2';
BEGIN
  SELECT pg_get_functiondef('public.validate_authoring_integrity()'::regprocedure) INTO definition;
  IF length(definition)-length(replace(definition,marker,''))<>length(marker) THEN
    RAISE EXCEPTION 'Unexpected physical capacity integrity definition';
  END IF;
  EXECUTE replace(definition,marker,'(SELECT count(*) FROM public.execution_capacity_slots) NOT IN (2,8)');
END $$;
--> statement-breakpoint
DROP TRIGGER slot_capacity_integrity ON execution_capacity_slots;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER slot_capacity_integrity AFTER INSERT OR UPDATE OR DELETE ON execution_capacity_slots DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_authoring_integrity();
