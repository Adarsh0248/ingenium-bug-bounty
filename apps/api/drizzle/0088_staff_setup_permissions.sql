-- All normal staff may manage teams, question authoring and arena setup.
-- Keep installed bodies, ownership and grants; change only these role allowlists.
DO $$
DECLARE signature text; definition text; previous text = '(''OWNER'',''SUPER_ADMIN'')';
BEGIN
  FOREACH signature IN ARRAY ARRAY[
    'public.validate_arena_setup_authority()',
    'public.apply_arena_setup(uuid)',
    'public.validate_content_authority()',
    'public.apply_content_edit(uuid,text)',
    'public.freeze_validation_snapshot(uuid,text)',
    'public.admit_validation_run(uuid)',
    'public.validate_validation_diagnostic()',
    'public.competition_staff_command(uuid,uuid,uuid,bigint,text,jsonb,text,bytea)',
    'public.publish_content_command(uuid,uuid,uuid,uuid,bigint,text,bytea)',
    'public.manage_team_command(uuid,uuid,text,uuid,bigint,text,text,text,text,bytea,bytea)',
    'public.import_registrations_command(uuid,uuid,bigint,bytea,jsonb,text,bytea,jsonb)'
  ] LOOP
    definition = pg_get_functiondef(signature::regprocedure);
    IF (length(definition) - length(replace(definition,previous,''))) / length(previous) <> 1 THEN
      RAISE EXCEPTION 'Expected one reviewed staff role guard in %', signature;
    END IF;
    EXECUTE replace(definition,previous,'(''OWNER'',''ORGANISER'',''SUPER_ADMIN'')');
  END LOOP;
END;
$$;
