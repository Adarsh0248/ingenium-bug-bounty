CREATE FUNCTION live_draft_saved() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE effect uuid; streams uuid[];
BEGIN
  IF NEW.outcome<>'SAVED' THEN RETURN NEW; END IF;
  INSERT INTO live_effects(draft_outcome_id) VALUES(NEW.id) RETURNING id INTO effect;
  SELECT array_agg(id) INTO streams FROM live_streams WHERE kind='MEMBER' AND member_round_id=NEW.member_round_id;
  PERFORM live_emit(effect,streams,jsonb_build_object('type','INVALIDATE','projection','draft','bounty_id',NEW.bounty_id,'revision',NEW.result_revision::text));
  RETURN NEW;
END $$;
CREATE TRIGGER live_draft_saved AFTER INSERT ON draft_save_outcomes FOR EACH ROW EXECUTE FUNCTION live_draft_saved();
REVOKE ALL ON FUNCTION live_draft_saved() FROM PUBLIC,ingenium_api,ingenium_competition_worker;
