ALTER TABLE "execution_capacity_slots" DROP CONSTRAINT "physical_slot_bounds";--> statement-breakpoint
ALTER TABLE "execution_capacity_slots" ADD CONSTRAINT "physical_slot_bounds" CHECK ("execution_capacity_slots"."id" between 1 and 16 and "execution_capacity_slots"."revision">=0);
--> statement-breakpoint
DO $$
DECLARE definition text; marker text='(SELECT count(*) FROM public.execution_capacity_slots) NOT IN (2,8)';
BEGIN
 SELECT pg_get_functiondef('public.validate_authoring_integrity()'::regprocedure) INTO definition;
 IF strpos(definition,marker)=0 THEN RAISE EXCEPTION 'Reviewed capacity accounting guard not found';END IF;
 EXECUTE replace(definition,marker,'(SELECT count(*) FROM public.execution_capacity_slots) NOT IN (2,8,16)');
END $$;
