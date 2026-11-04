-- Append reviewed questions; existing live selections remain immutable.
ALTER TABLE public.bounties DROP CONSTRAINT bounty_position;
ALTER TABLE public.bounties ADD CONSTRAINT bounty_position CHECK(position BETWEEN 1 AND 120);
--> statement-breakpoint
DO $$
DECLARE definition text; marker text; addition text;
BEGIN
 SELECT pg_get_functiondef('public.competition_staff_command(uuid,uuid,uuid,bigint,text,jsonb,text,bytea)'::regprocedure) INTO definition;
 marker:='IF action NOT IN (''CONFIGURE'',''READY'',';
 IF strpos(definition,marker)=0 THEN RAISE EXCEPTION 'Reviewed staff action guard unavailable'; END IF;
 definition:=replace(definition,marker,'IF action NOT IN (''APPEND_QUESTIONS'',''CONFIGURE'',''READY'',');
 marker:='IF action=''CONFIGURE'' THEN';
 addition:=$body$IF action='APPEND_QUESTIONS' THEN
    IF r.kind<>2 OR r.state NOT IN ('RUNNING','PAUSED') THEN
      result=jsonb_build_object('status','REJECTED','reason','ROUND_NOT_OPEN');
    ELSIF jsonb_typeof(p->'snapshots') IS DISTINCT FROM 'array' OR jsonb_array_length(p->'snapshots') NOT BETWEEN 1 AND 20
      OR (SELECT count(*) FROM jsonb_object_keys(p))<>1
      OR (SELECT count(DISTINCT value) FROM jsonb_array_elements_text(p->'snapshots'))<>jsonb_array_length(p->'snapshots') THEN
      RAISE EXCEPTION 'Select one to twenty distinct published questions';
    ELSE
      SELECT count(*) INTO count_teams FROM public.bounties WHERE round_id=subject;
      IF count_teams+jsonb_array_length(p->'snapshots')>120 THEN
        result=jsonb_build_object('status','REJECTED','reason','QUESTION_CAPACITY');
      ELSIF (SELECT count(DISTINCT s.definition_id) FROM jsonb_array_elements_text(p->'snapshots') x(id)
        JOIN public.validation_snapshots s ON s.id=x.id::uuid
        JOIN public.competition_publications pub ON pub.snapshot_id=s.id
        JOIN public.validation_runs vr ON vr.id=pub.run_id
        WHERE s.round_type=2 AND vr.status='PASSED' AND vr.snapshot_id=s.id AND vr.configuration_fingerprint=s.fingerprint
          AND NOT EXISTS(SELECT 1 FROM public.bounties b WHERE b.round_id=subject AND b.definition_id=s.definition_id)
          AND NOT EXISTS(SELECT 1 FROM public.authoring_attempts a JOIN public.authoring_checks c ON c.id=a.check_id WHERE c.run_id=vr.id AND a.released_at IS NULL))
          <>jsonb_array_length(p->'snapshots') THEN
        result=jsonb_build_object('status','REJECTED','reason','QUESTIONS_NOT_ELIGIBLE');
      ELSE
        SELECT jsonb_build_object('status','APPLIED','added_count',jsonb_array_length(p->'snapshots'),
          'total_count',count_teams+jsonb_array_length(p->'snapshots'),'additions',jsonb_agg(jsonb_build_object(
            'bounty_id',gen_random_uuid(),'snapshot_id',s.id,'definition_id',s.definition_id,'position',count_teams+x.position) ORDER BY x.position))
          INTO result FROM jsonb_array_elements_text(p->'snapshots') WITH ORDINALITY x(id,position)
          JOIN public.validation_snapshots s ON s.id=x.id::uuid;
        recorded=public.competition_receipt(source,subject,sid,actor,request,action,fp,reason,result,n,true);
        INSERT INTO public.bounties(id,round_id,definition_id,snapshot_id,position)
          SELECT (x->>'bounty_id')::uuid,subject,(x->>'definition_id')::uuid,(x->>'snapshot_id')::uuid,(x->>'position')::integer
          FROM jsonb_array_elements(result->'additions') x;
        UPDATE public.rounds SET revision=revision+1 WHERE id=subject;
      END IF;
    END IF;
  ELSIF action='CONFIGURE' THEN$body$;
 IF length(definition)-length(replace(definition,marker,''))<>length(marker) THEN RAISE EXCEPTION 'Reviewed selection branch unavailable'; END IF;
 EXECUTE replace(definition,marker,addition);
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.competition_selection_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE subject uuid; stage public.rounds%ROWTYPE;
BEGIN
  IF TG_OP='DELETE' THEN subject=OLD.round_id; ELSE subject=NEW.round_id; END IF;
  SELECT r.* INTO stage FROM public.rounds r JOIN public.arena_control c ON c.current_instance_id=r.arena_instance_id WHERE c.id=1 AND r.id=subject;
  IF TG_TABLE_NAME='bounties' AND TG_OP='INSERT' AND stage.kind=2 AND stage.state IN ('RUNNING','PAUSED') THEN
    IF EXISTS(SELECT 1 FROM public.competition_outcomes o CROSS JOIN LATERAL jsonb_array_elements(o.result->'additions') x
      WHERE o.round_id=subject AND o.action='APPEND_QUESTIONS' AND o.staff_session_id IS NOT NULL AND o.result->>'status'='APPLIED'
        AND o.xmin::text::bigint=(pg_current_xact_id()::text::bigint & 4294967295)
        AND x->>'bounty_id'=NEW.id::text AND x->>'snapshot_id'=NEW.snapshot_id::text AND x->>'definition_id'=NEW.definition_id::text
        AND (x->>'position')::integer=NEW.position) THEN RETURN NEW; END IF;
    RAISE EXCEPTION 'Live additions require their exact current release receipt';
  END IF;
  IF stage.id IS NULL OR stage.state NOT IN ('DRAFT','READY') OR EXISTS(SELECT 1 FROM public.team_rounds WHERE round_id=subject) THEN
    RAISE EXCEPTION 'Launched selection is immutable'; END IF;
  IF TG_OP='UPDATE' THEN RAISE EXCEPTION 'Replace unlaunched selection, never retarget'; END IF;
  IF TG_OP='INSERT' AND TG_TABLE_NAME='bounties' THEN
    IF NEW.position>(CASE WHEN stage.kind=2 THEN 100 ELSE 50 END) THEN
      RAISE EXCEPTION 'Invalid bounty position for round' USING ERRCODE='23514',CONSTRAINT='bounty_position'; END IF;
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
--> statement-breakpoint
CREATE FUNCTION public.validate_live_question_release() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE total integer;
BEGIN
 IF NEW.action<>'APPEND_QUESTIONS' OR NEW.result->>'status'<>'APPLIED' THEN RETURN NEW; END IF;
 total:=(NEW.result->>'total_count')::integer;
 IF NEW.staff_session_id IS NULL OR jsonb_array_length(NEW.result->'additions') NOT BETWEEN 1 AND 20
   OR jsonb_array_length(NEW.result->'additions')<>(NEW.result->>'added_count')::integer OR total NOT BETWEEN 1 AND 120
   OR (SELECT count(*) FROM public.bounties WHERE round_id=NEW.round_id)<>total
   OR (SELECT count(*) FROM jsonb_array_elements(NEW.result->'additions') x JOIN public.bounties b
     ON b.id=(x->>'bounty_id')::uuid AND b.round_id=NEW.round_id AND b.definition_id=(x->>'definition_id')::uuid
       AND b.snapshot_id=(x->>'snapshot_id')::uuid AND b.position=(x->>'position')::integer)<>jsonb_array_length(NEW.result->'additions') THEN
   RAISE EXCEPTION 'Live release must contain every exact appended question'; END IF;
 RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER live_question_release_complete AFTER INSERT ON public.competition_outcomes
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.validate_live_question_release();
REVOKE ALL ON FUNCTION public.validate_live_question_release() FROM PUBLIC;
