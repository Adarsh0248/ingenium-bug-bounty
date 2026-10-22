CREATE FUNCTION competition_publish(sid uuid,snapshot uuid,validation uuid,review text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE actor uuid; n timestamptz; v public.validation_snapshots%ROWTYPE; old public.competition_publications%ROWTYPE;
BEGIN
  PERFORM id FROM public.security_control WHERE id=1 FOR UPDATE;
  PERFORM id FROM public.catalogue_control WHERE id=1 FOR UPDATE;
  n=date_trunc('milliseconds',clock_timestamp());
  SELECT s.staff_id INTO actor FROM public.staff_sessions s JOIN public.staff_session_slots z ON z.staff_id=s.staff_id AND z.session_id=s.id
    JOIN public.staff_identities i ON i.id=s.staff_id JOIN public.access_credentials c ON c.id=s.credential_id AND c.version=s.credential_version
    WHERE s.id=sid AND s.mode='NORMAL' AND s.revoked_at IS NULL AND i.role IN ('OWNER','SUPER_ADMIN') AND i.disabled_at IS NULL AND c.revoked_at IS NULL
      AND n>=s.last_activity_at AND n<s.absolute_expires_at AND n<s.last_activity_at+interval '15 minutes';
  IF actor IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Current publication authority required'; END IF;
  IF review IS NULL OR octet_length(review) NOT BETWEEN 1 AND 1024 OR btrim(review)='' THEN RAISE EXCEPTION 'Review required'; END IF;
  SELECT * INTO v FROM public.validation_snapshots WHERE id=snapshot;
  IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.bug_versions WHERE id=v.version_id AND content_revision=v.content_revision)
    OR NOT EXISTS(SELECT 1 FROM public.validation_runs WHERE id=validation AND snapshot_id=snapshot AND configuration_fingerprint=v.fingerprint AND status='PASSED')
    OR EXISTS(SELECT 1 FROM public.authoring_attempts a JOIN public.authoring_checks c ON c.id=a.check_id WHERE c.run_id=validation AND a.released_at IS NULL)
    OR EXISTS(SELECT 1 FROM public.rounds WHERE state IN ('RUNNING','PAUSED','CLOSING','CANCELLING')) THEN RAISE EXCEPTION 'Exact passed drained validation and inactive arena required'; END IF;
  SELECT * INTO old FROM public.competition_publications WHERE snapshot_id=snapshot;
  IF FOUND THEN IF old.run_id<>validation OR old.review<>review THEN RAISE EXCEPTION 'Publication is immutable'; END IF; RETURN snapshot; END IF;
  INSERT INTO public.competition_publications VALUES(snapshot,v.version_id,validation,actor,n,review);
  UPDATE public.bug_versions SET publication_status='PUBLISHED',published_by=actor,published_at=n WHERE id=v.version_id;
  UPDATE public.staff_sessions SET last_activity_at=n WHERE id=sid;
  RETURN snapshot;
END $$;
CREATE OR REPLACE FUNCTION guard_participant_activity_source() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF NEW.last_activity_at IS DISTINCT FROM OLD.last_activity_at AND (
    OLD.revoked_at IS NOT NULL OR NEW.last_activity_at>=OLD.absolute_expires_at OR NEW.last_activity_at>=OLD.last_activity_at+interval '2 hours'
    OR NOT EXISTS(SELECT 1 FROM public.member_session_slots WHERE member_id=OLD.member_id AND session_id=OLD.id)
  ) THEN RAISE EXCEPTION 'Expired or retired participant sessions cannot renew'; END IF;
  IF NEW.last_activity_at IS DISTINCT FROM OLD.last_activity_at AND NOT EXISTS(
    SELECT 1 FROM public.participant_session_outcomes o WHERE o.session_id=NEW.id AND o.action='KEEP_ALIVE' AND o.recorded_at=NEW.last_activity_at
  ) AND NOT EXISTS(
    SELECT 1 FROM public.competition_outcomes o WHERE o.participant_session_id=NEW.id AND o.recorded_at=NEW.last_activity_at
      AND o.xmin::text::bigint=(pg_current_xact_id()::text::bigint & 4294967295)
      AND ((o.action='SUBMIT' AND o.result->>'status'='ADMITTED' AND EXISTS(SELECT 1 FROM public.competition_submissions WHERE source_id=o.id AND member_round_id=NEW.member_round_id))
        OR (o.action='HINT' AND o.result->>'status'='PURCHASED' AND EXISTS(SELECT 1 FROM public.hint_purchases WHERE source_id=o.id)))
  ) THEN RAISE EXCEPTION 'Participant activity requires its committed source'; END IF;
  IF OLD.revoked_at IS NULL AND NEW.revocation_reason='LOGOUT' AND NOT EXISTS(
    SELECT 1 FROM public.participant_session_outcomes o WHERE o.session_id=NEW.id AND o.action='LOGOUT' AND o.recorded_at=NEW.revoked_at
  ) THEN RAISE EXCEPTION 'Participant logout requires its committed source'; END IF;
  IF OLD.revoked_at IS NULL AND NEW.revocation_reason='LOGOUT' AND (
    NEW.revoked_at<OLD.last_activity_at OR NEW.revoked_at>=OLD.absolute_expires_at OR NEW.revoked_at>=OLD.last_activity_at+interval '2 hours'
  ) THEN RAISE EXCEPTION 'Logout must use a still-valid participant session'; END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION guard_draft_version() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE source public.content_outcomes%ROWTYPE;
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Version history cannot be deleted'; END IF;
  IF TG_OP='UPDATE' AND OLD.publication_status='DRAFT' AND NEW.publication_status='PUBLISHED' THEN
    IF (to_jsonb(NEW)-ARRAY['publication_status','published_by','published_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['publication_status','published_by','published_at'])
      OR NOT EXISTS(SELECT 1 FROM public.competition_publications p JOIN public.validation_snapshots s ON s.id=p.snapshot_id
        WHERE p.version_id=NEW.id AND s.content_revision=NEW.content_revision AND p.actor_id=NEW.published_by AND p.published_at=NEW.published_at
          AND p.xmin::text::bigint=(pg_current_xact_id()::text::bigint & 4294967295)) THEN RAISE EXCEPTION 'Current reviewed publication source required'; END IF;
    RETURN NEW;
  END IF;
  IF NEW.publication_status<>'DRAFT' THEN RAISE EXCEPTION 'Published content is immutable'; END IF;
  IF TG_OP='UPDATE' THEN
    IF OLD.publication_status<>'DRAFT' OR ROW(NEW.id,NEW.definition_id,NEW.version_number,NEW.created_by,NEW.created_at,NEW.submission_format,NEW.checker_version)
      IS DISTINCT FROM ROW(OLD.id,OLD.definition_id,OLD.version_number,OLD.created_by,OLD.created_at,OLD.submission_format,OLD.checker_version) THEN RAISE EXCEPTION 'Version identity/publication is immutable'; END IF;
  END IF;
  SELECT * INTO source FROM public.content_outcomes WHERE id=NEW.last_source_id AND outcome='APPLIED' AND result_version_id=NEW.id AND result_definition_id=NEW.definition_id
    AND result_revision=NEW.content_revision AND xmin::text::bigint=(pg_current_xact_id()::text::bigint & 4294967295);
  IF NOT FOUND THEN RAISE EXCEPTION 'Draft requires its current transaction source'; END IF;
  IF TG_OP='INSERT' THEN
    IF source.action NOT IN ('CREATE','NEW_VERSION') OR NEW.content_revision<>1 THEN RAISE EXCEPTION 'New version source required'; END IF;
  ELSIF NEW.content_revision<>OLD.content_revision THEN
    IF NEW.content_revision<>OLD.content_revision+1 OR source.version_id<>OLD.id OR source.expected_revision<>OLD.content_revision THEN RAISE EXCEPTION 'Content revision must advance once'; END IF;
  ELSIF NEW.last_source_id<>OLD.last_source_id THEN RAISE EXCEPTION 'Content source cannot change without a new revision'; END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION protect_round_configuration() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF NEW.configuration_revision IS DISTINCT FROM OLD.configuration_revision OR NEW.duration_ms IS DISTINCT FROM OLD.duration_ms THEN
    IF OLD.kind=2 AND OLD.state IN ('DRAFT','READY') AND NEW.state='DRAFT' AND NEW.configuration_revision=OLD.configuration_revision+1 AND NEW.revision=OLD.revision+1
      AND NOT EXISTS(SELECT 1 FROM public.team_rounds WHERE round_id=OLD.id)
      AND EXISTS(SELECT 1 FROM public.competition_outcomes o JOIN public.rounds one ON one.id=o.round_id JOIN public.arena_control c ON c.current_instance_id=one.arena_instance_id
        WHERE c.id=1 AND one.kind=1 AND one.state='CLOSED' AND one.arena_instance_id=OLD.arena_instance_id AND o.action='SETUP_R2'
          AND o.result->>'status'='APPLIED' AND o.result->>'round_id'=NEW.id::text AND (o.result->>'duration_ms')::bigint=NEW.duration_ms
          AND o.xmin::text::bigint=(pg_current_xact_id()::text::bigint & 4294967295)) THEN RETURN NEW; END IF;
    IF OLD.state NOT IN ('DRAFT','READY') OR NEW.state<>'DRAFT' OR NEW.configuration_revision<>OLD.configuration_revision+1 OR NEW.revision<>OLD.revision+1
      OR NOT EXISTS(SELECT 1 FROM public.arena_control c JOIN public.arena_instances i ON i.id=c.current_instance_id
        WHERE c.id=1 AND i.id=OLD.arena_instance_id AND i.status='SETUP')
      OR NOT EXISTS(SELECT 1 FROM public.arena_setup_outcomes o WHERE o.action='CONFIGURE' AND o.outcome='APPLIED' AND o.round_id=OLD.id
        AND o.result_round_id=NEW.id AND o.result_instance_id=OLD.arena_instance_id AND o.expected_revision=OLD.configuration_revision
        AND o.result_revision=NEW.configuration_revision AND o.duration_ms=NEW.duration_ms) THEN RAISE EXCEPTION 'Round configuration requires an editable source-linked draft'; END IF;
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE FUNCTION competition_economic_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE subject uuid; b record; s public.competition_submissions%ROWTYPE; r public.rounds%ROWTYPE; cash bigint;
BEGIN
  IF TG_TABLE_NAME='wallet_entries' THEN
    subject=NEW.team_round_id;
    IF NEW.award_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.bounty_awards WHERE id=NEW.award_id AND team_round_id=subject AND base_bounty=NEW.amount) THEN RAISE EXCEPTION 'Award credit mismatch'; END IF;
    IF NEW.purchase_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.hint_purchases WHERE id=NEW.purchase_id AND team_round_id=subject AND price=-NEW.amount) THEN RAISE EXCEPTION 'Hint debit mismatch'; END IF;
    IF NEW.carryover_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.round_carryovers WHERE team_round_id=NEW.carryover_id AND team_round_id=subject AND amount=NEW.amount AND amount>0) THEN RAISE EXCEPTION 'Opening credit mismatch'; END IF;
    IF public.competition_balance(subject)<0 THEN RAISE EXCEPTION 'Wallet cannot become negative'; END IF;
  ELSIF TG_TABLE_NAME='hint_purchases' THEN
    SELECT bb.*,v.difficulty,stage.kind INTO b FROM public.bounties bb JOIN public.validation_snapshots v ON v.id=bb.snapshot_id JOIN public.rounds stage ON stage.id=bb.round_id WHERE bb.id=NEW.bounty_id;
    IF NEW.price<>b.difficulty*(CASE WHEN NEW.level=1 THEN 1 WHEN NEW.level=2 THEN 3 WHEN b.kind=1 THEN 4 ELSE 8 END)
      OR (SELECT count(*) FROM public.hint_purchases WHERE team_round_id=NEW.team_round_id AND bounty_id=NEW.bounty_id AND level<NEW.level)<>NEW.level-1
      OR NOT EXISTS(SELECT 1 FROM public.competition_outcomes o JOIN public.participant_sessions ps ON ps.id=o.participant_session_id
        JOIN public.member_rounds m ON m.id=ps.member_round_id WHERE o.id=NEW.source_id AND o.round_id=b.round_id AND m.team_round_id=NEW.team_round_id
          AND o.action='HINT' AND o.result->>'status'='PURCHASED' AND o.result->>'purchase_id'=NEW.id::text AND o.recorded_at=NEW.recorded_at)
      OR NOT EXISTS(SELECT 1 FROM public.wallet_entries WHERE purchase_id=NEW.id AND team_round_id=NEW.team_round_id AND amount=-NEW.price) THEN RAISE EXCEPTION 'Hint requires its sequential source and exact debit'; END IF;
  ELSIF TG_TABLE_NAME='bounty_awards' THEN
    SELECT * INTO s FROM public.competition_submissions WHERE id=NEW.submission_id;
    SELECT * INTO r FROM public.rounds WHERE id=s.round_id;
    SELECT v.difficulty INTO b FROM public.bounties bb JOIN public.validation_snapshots v ON v.id=bb.snapshot_id WHERE bb.id=s.bounty_id;
    IF NEW.team_round_id<>s.team_round_id OR NEW.bounty_id<>s.bounty_id OR NEW.round_kind<>r.kind OR NEW.base_bounty<>b.difficulty*10
      OR NEW.points<>b.difficulty*(CASE WHEN r.kind=1 OR s.hint_tier=0 THEN 10 WHEN s.hint_tier=1 THEN 9 WHEN s.hint_tier=2 THEN 7 ELSE 5 END)
      OR NOT EXISTS(SELECT 1 FROM public.competition_assessments WHERE submission_id=s.id AND verdict='PASSED')
      OR EXISTS(SELECT 1 FROM public.competition_submissions earlier LEFT JOIN public.competition_assessments a ON a.submission_id=earlier.id
        WHERE earlier.bounty_id=s.bounty_id AND earlier.receipt_order<s.receipt_order AND (r.kind=2 OR earlier.team_round_id=s.team_round_id) AND (a.verdict IS NULL OR a.verdict='PASSED'))
      OR NOT EXISTS(SELECT 1 FROM public.wallet_entries WHERE award_id=NEW.id AND team_round_id=s.team_round_id AND amount=NEW.base_bounty) THEN RAISE EXCEPTION 'Award requires earliest correct source and full credit'; END IF;
  ELSIF TG_TABLE_NAME='wrong_submission_penalties' THEN
    IF NOT EXISTS(SELECT 1 FROM public.competition_submissions sub JOIN public.rounds stage ON stage.id=sub.round_id JOIN public.competition_assessments a ON a.submission_id=sub.id
      WHERE sub.id=NEW.submission_id AND sub.team_round_id=NEW.team_round_id AND stage.kind=2 AND a.verdict<>'PASSED') THEN RAISE EXCEPTION 'Wrong penalty requires reliable incorrect R2 official'; END IF;
  ELSE
    IF NOT EXISTS(SELECT 1 FROM public.team_rounds dest JOIN public.rounds two ON two.id=dest.round_id JOIN public.round_results rr ON rr.id=NEW.result_id
      JOIN public.rounds one ON one.id=rr.round_id JOIN public.qualification_decisions d ON d.result_id=rr.id CROSS JOIN LATERAL jsonb_array_elements(rr.standings) v
      WHERE dest.id=NEW.team_round_id AND one.kind=1 AND two.kind=2 AND one.arena_instance_id=two.arena_instance_id AND (v->>'team_round_id')::uuid=NEW.source_team_round_id
        AND (v->>'team_id')::uuid=dest.team_id AND (v->>'wallet')::integer=NEW.amount AND d.selected @> jsonb_build_array(NEW.source_team_round_id::text))
      OR (NEW.amount>0 AND NOT EXISTS(SELECT 1 FROM public.wallet_entries WHERE carryover_id=NEW.team_round_id AND amount=NEW.amount))
      OR (NEW.amount=0 AND EXISTS(SELECT 1 FROM public.wallet_entries WHERE carryover_id=NEW.team_round_id)) THEN RAISE EXCEPTION 'Opening allocation requires own locked qualified result'; END IF;
  END IF;
  RETURN NULL;
END $$;
CREATE FUNCTION competition_pause_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF TG_OP='DELETE' OR (to_jsonb(NEW)-ARRAY['ended_at','end_source_id']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['ended_at','end_source_id'])
    OR OLD.ended_at IS NOT NULL OR NEW.ended_at IS NULL THEN RAISE EXCEPTION 'Pause may only close once'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER competition_pause_once BEFORE UPDATE OR DELETE ON competition_pauses FOR EACH ROW EXECUTE FUNCTION competition_pause_guard();
CREATE FUNCTION competition_selection_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE subject uuid;
BEGIN
  IF TG_OP='DELETE' THEN subject=OLD.round_id; ELSE subject=NEW.round_id; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.rounds r JOIN public.arena_control c ON c.current_instance_id=r.arena_instance_id
    WHERE c.id=1 AND r.id=subject AND r.state IN ('DRAFT','READY')) OR EXISTS(SELECT 1 FROM public.team_rounds WHERE round_id=subject) THEN RAISE EXCEPTION 'Launched selection is immutable'; END IF;
  IF TG_OP='UPDATE' THEN RAISE EXCEPTION 'Replace unlaunched selection, never retarget'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE TRIGGER competition_bounty_selection BEFORE INSERT OR UPDATE OR DELETE ON bounties FOR EACH ROW EXECUTE FUNCTION competition_selection_guard();
CREATE TRIGGER competition_roster_selection BEFORE INSERT OR UPDATE OR DELETE ON competition_rosters FOR EACH ROW EXECUTE FUNCTION competition_selection_guard();
--> statement-breakpoint
DO $$ DECLARE name text;
BEGIN
  FOREACH name IN ARRAY ARRAY['competition_outcomes','competition_publications','competition_submissions','competition_case_results','competition_assessments','bounty_awards','wrong_submission_penalties','hint_purchases','round_results','qualification_decisions','round_carryovers','wallet_entries','competition_events'] LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION public.immutable_access_history()',name||'_immutable',name);
  END LOOP;
  FOREACH name IN ARRAY ARRAY['wallet_entries','bounty_awards','hint_purchases','wrong_submission_penalties','round_carryovers'] LOOP
    EXECUTE format('CREATE CONSTRAINT TRIGGER %I AFTER INSERT ON %I DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.competition_economic_guard()',name||'_economic_guard',name);
  END LOOP;
END $$;
--> statement-breakpoint
DO $$ DECLARE f record;
BEGIN
  FOR f IN SELECT oid::regprocedure AS signature FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname LIKE 'competition\_%' ESCAPE '\' LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC',f.signature);
  END LOOP;
END $$;
CREATE FUNCTION competition_tick(subject uuid) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE n timestamptz; state text;
BEGIN
  PERFORM id FROM public.security_control WHERE id=1 FOR SHARE;
  n=public.competition_now(subject); PERFORM public.competition_close_due(subject,n); PERFORM public.competition_settle(subject,n);
  SELECT r.state INTO state FROM public.rounds r WHERE id=subject; RETURN state;
END $$;
REVOKE ALL ON FUNCTION competition_tick(uuid) FROM PUBLIC;
GRANT SELECT ON competition_configs,competition_rosters,bounties,competition_outcomes,competition_publications,competition_submissions,competition_assessments,competition_case_results,
  bounty_awards,wrong_submission_penalties,hint_purchases,round_results,qualification_decisions,round_carryovers,wallet_entries,competition_pauses,competition_events TO ingenium_api;
GRANT EXECUTE ON FUNCTION competition_staff_command(uuid,uuid,uuid,bigint,text,jsonb,text,bytea),competition_participant_command(uuid,uuid,uuid,text,jsonb),competition_publish(uuid,uuid,uuid,text),competition_standings(uuid),competition_balance(uuid) TO ingenium_api;
GRANT USAGE ON SCHEMA public TO ingenium_competition_worker;
GRANT SELECT ON security_control,rounds,competition_submissions,bounties,validation_snapshot_cases,validation_snapshot_variants,validation_snapshots,runtime_manifests TO ingenium_competition_worker;
GRANT EXECUTE ON FUNCTION competition_assess(uuid,bytea,jsonb),competition_tick(uuid) TO ingenium_competition_worker;
