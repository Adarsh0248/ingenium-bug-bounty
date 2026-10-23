-- Keep deferred byte/source checks inside the existing three-second transaction budget.
DO $$
DECLARE definition text; marker text='ORDER BY kind,id LIMIT 20';
BEGIN
  SELECT pg_get_functiondef('public.maintain_retention_batch(text)'::regprocedure) INTO definition;
  IF length(definition)-length(replace(definition,marker,''))<>length(marker) THEN
    RAISE EXCEPTION 'Unexpected retention candidate limit';
  END IF;
  EXECUTE replace(definition,marker,'ORDER BY kind,id LIMIT 5');
END $$;
