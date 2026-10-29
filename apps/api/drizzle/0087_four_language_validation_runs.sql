-- Four languages need two reference cases and one starter witness each: twelve checks.
DO $$
DECLARE definition text;
BEGIN
  SELECT pg_get_functiondef('public.admit_validation_run(uuid)'::regprocedure) INTO definition;
  IF position('jobs NOT BETWEEN 15 AND 115' IN definition)=0 THEN
    RAISE EXCEPTION 'Unexpected validation admission definition';
  END IF;
  EXECUTE replace(definition,'jobs NOT BETWEEN 15 AND 115','jobs NOT BETWEEN 12 AND 115');
  SELECT pg_get_constraintdef(oid) INTO definition FROM pg_constraint
    WHERE conrelid='public.validation_runs'::regclass AND conname='validation_run_shape';
  IF position('check_count >= 15' IN definition)=0 THEN
    RAISE EXCEPTION 'Unexpected validation run constraint';
  END IF;
  ALTER TABLE public.validation_runs DROP CONSTRAINT validation_run_shape;
  EXECUTE 'ALTER TABLE public.validation_runs ADD CONSTRAINT validation_run_shape '
    || replace(definition,'check_count >= 15','check_count >= 12');
END;
$$;
--> statement-breakpoint
GRANT SELECT ON public.execution_capacity_slots TO ingenium_app_worker;
