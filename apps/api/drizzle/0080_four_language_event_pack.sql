-- Four-language event packs are accepted; frozen five-language histories remain valid.
DO $$
DECLARE definition text; old_rule text;
BEGIN
  old_rule := 'OR (SELECT count(*) FROM public.validation_snapshot_variants WHERE snapshot_id=s.id)<>5';
  SELECT pg_get_functiondef('public.validate_validation_snapshot()'::regprocedure) INTO definition;
  IF position(old_rule IN definition)=0 THEN RAISE EXCEPTION 'Unexpected validation guard definition'; END IF;
  EXECUTE replace(definition, old_rule,
    'OR (SELECT count(*) FROM public.validation_snapshot_variants WHERE snapshot_id=s.id) NOT IN (4,5)
    OR EXISTS(SELECT 1 FROM (VALUES (''c''),(''cpp''),(''java''),(''python'')) required(language)
      WHERE NOT EXISTS(SELECT 1 FROM public.validation_snapshot_variants v WHERE v.snapshot_id=s.id AND v.language=required.language))');
END;
$$;
