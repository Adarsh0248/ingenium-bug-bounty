-- Notices are once-only projections; eligibility always uses the trusted clock even if maintenance is delayed.
CREATE TABLE shop_expiry_notices (
  activation_id uuid NOT NULL REFERENCES shop_activations(id), kind text NOT NULL CHECK(kind IN ('EFFECT','COOLDOWN')),
  recorded_at timestamptz(3) NOT NULL, PRIMARY KEY(activation_id,kind)
);
CREATE FUNCTION shop_expire(stage uuid,n timestamptz) RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE due record; e uuid; streams uuid[]; tick bigint;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.rounds WHERE id=stage AND kind=2 AND state IN ('RUNNING','PAUSED','CLOSING')) THEN RETURN; END IF;
  tick=public.shop_clock(stage,n);
  FOR due IN SELECT a.*,k.kind FROM public.shop_activations a CROSS JOIN (VALUES('EFFECT'),('COOLDOWN')) k(kind)
    WHERE a.round_id=stage AND ((k.kind='EFFECT' AND tick>=a.expires_ms) OR (k.kind='COOLDOWN' AND a.item_id='ghost-scan' AND tick>=a.active_ms+120000))
    AND NOT EXISTS(SELECT 1 FROM public.shop_expiry_notices WHERE activation_id=a.id AND kind=k.kind)
    ORDER BY a.activated_at,a.id,k.kind LIMIT 32 LOOP
    INSERT INTO public.shop_expiry_notices VALUES(due.id,due.kind,n);
    INSERT INTO public.live_effects(round_id) VALUES(stage) RETURNING id INTO e;
    SELECT array_agg(id) INTO streams FROM public.live_streams WHERE kind='TEAM' AND team_round_id IN (due.team_round_id,due.target_team_round_id);
    PERFORM public.live_emit(e,streams,jsonb_build_object('type','INVALIDATE','projection','shop'));
  END LOOP;
END $$;
REVOKE ALL ON shop_expiry_notices FROM PUBLIC,ingenium_api,ingenium_competition_worker;
REVOKE ALL ON FUNCTION shop_expire(uuid,timestamptz) FROM PUBLIC,ingenium_api,ingenium_competition_worker;
CREATE FUNCTION shop_integrity() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE p public.shop_purchases%ROWTYPE; o public.competition_outcomes%ROWTYPE; m public.member_rounds%ROWTYPE;
BEGIN
  IF TG_TABLE_NAME='shop_purchases' THEN
    p=NEW;
    SELECT * INTO o FROM public.competition_outcomes WHERE id=p.source_id;
    SELECT mr.* INTO m FROM public.member_rounds mr JOIN public.participant_sessions s ON s.member_round_id=mr.id WHERE s.id=o.participant_session_id;
    IF m.team_round_id IS DISTINCT FROM p.team_round_id OR m.round_id IS DISTINCT FROM p.round_id OR o.round_id IS DISTINCT FROM p.round_id
      OR o.action IS DISTINCT FROM 'SHOP_PURCHASE' OR o.result->>'status' IS DISTINCT FROM 'PURCHASED' OR o.result->>'purchase_id' IS DISTINCT FROM p.id::text
      OR o.result->>'item_id' IS DISTINCT FROM p.item_id OR o.recorded_at IS DISTINCT FROM p.purchased_at
      OR p.price<>(CASE p.item_id WHEN 'boundary-probe' THEN 400 WHEN 'hex-scanner' THEN 750 WHEN 'overdrive-core' THEN 500 WHEN 'ghost-scan' THEN 1500
        WHEN 'chrono-shield' THEN 2500 WHEN 'claim-lock' THEN 5000 WHEN 'black-ice' THEN 15000 END)
      OR NOT EXISTS(SELECT 1 FROM public.rounds WHERE id=p.round_id AND kind=2)
      OR NOT EXISTS(SELECT 1 FROM public.wallet_entries WHERE shop_purchase_id=p.id AND team_round_id=p.team_round_id AND amount=-p.price)
      THEN RAISE EXCEPTION 'Shop purchase requires its exact source and debit'; END IF;
  ELSE
    SELECT * INTO p FROM public.shop_purchases WHERE id=NEW.purchase_id;
    SELECT * INTO o FROM public.competition_outcomes WHERE id=NEW.source_id;
    SELECT mr.* INTO m FROM public.member_rounds mr JOIN public.participant_sessions s ON s.member_round_id=mr.id WHERE s.id=o.participant_session_id;
    IF NEW.team_round_id<>p.team_round_id OR NEW.round_id<>p.round_id OR NEW.item_id<>p.item_id OR m.team_round_id IS DISTINCT FROM p.team_round_id
      OR o.recorded_at IS DISTINCT FROM NEW.activated_at OR o.result->>'purchase_id' IS DISTINCT FROM p.id::text
      OR (p.item_id IN ('boundary-probe','hex-scanner','claim-lock') AND (o.action<>'SHOP_ACTIVATE' OR o.result->>'status'<>'ACTIVATED'))
      OR (p.item_id NOT IN ('boundary-probe','hex-scanner','claim-lock') AND (o.id<>p.source_id OR o.action<>'SHOP_PURCHASE' OR o.result->>'status'<>'PURCHASED'))
      OR NEW.active_ms<>public.shop_clock(NEW.round_id,NEW.activated_at)
      OR (NEW.expires_ms-NEW.active_ms) IS DISTINCT FROM (CASE p.item_id WHEN 'ghost-scan' THEN 15000 WHEN 'claim-lock' THEN 300000 WHEN 'black-ice' THEN 1800000 END)
      OR ((p.item_id IN ('boundary-probe','hex-scanner','claim-lock'))<>(NEW.bounty_id IS NOT NULL))
      OR ((p.item_id='black-ice')<>(NEW.target_team_round_id IS NOT NULL))
      OR (NEW.bounty_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.bounties WHERE id=NEW.bounty_id AND round_id=p.round_id))
      OR (NEW.target_team_round_id IS NOT NULL AND (NEW.target_team_round_id=p.team_round_id OR NOT EXISTS(SELECT 1 FROM public.team_rounds WHERE id=NEW.target_team_round_id AND round_id=p.round_id)))
      THEN RAISE EXCEPTION 'Shop activation requires its own source, inventory and exact effect'; END IF;
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER shop_purchase_integrity AFTER INSERT ON shop_purchases DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION shop_integrity();
CREATE CONSTRAINT TRIGGER shop_activation_integrity AFTER INSERT ON shop_activations DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION shop_integrity();
REVOKE ALL ON FUNCTION shop_integrity() FROM PUBLIC,ingenium_api,ingenium_competition_worker;
CREATE FUNCTION shop_standings(stage uuid) RETURNS jsonb LANGUAGE sql STABLE SET search_path=pg_catalog,public AS $$
  SELECT coalesce(jsonb_agg(value || CASE WHEN EXISTS(SELECT 1 FROM public.shop_purchases
    WHERE team_round_id=(value->>'team_round_id')::uuid AND item_id='overdrive-core') THEN '{"overdrive":true}'::jsonb ELSE '{}'::jsonb END ORDER BY ord),'[]'::jsonb)
  FROM jsonb_array_elements(public.competition_display_standings(stage)) WITH ORDINALITY AS rows(value,ord);
$$;
REVOKE ALL ON FUNCTION shop_standings(uuid) FROM PUBLIC,ingenium_api,ingenium_competition_worker;
GRANT EXECUTE ON FUNCTION shop_standings(uuid) TO ingenium_api;

--> statement-breakpoint
CREATE OR REPLACE FUNCTION maintain_competition_round(subject uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE n timestamptz;
BEGIN
  PERFORM id FROM public.security_control WHERE id=1 FOR UPDATE;
  PERFORM * FROM public.lock_arena_control(true);
  -- Older-round expiry still locks all affected rounds before catalogue/judge budgets.
  PERFORM r.id FROM public.rounds r CROSS JOIN public.arena_control a
    WHERE a.id=1 AND (r.id=subject OR r.arena_instance_id=a.current_instance_id) ORDER BY r.id FOR UPDATE OF r;
  IF NOT EXISTS(SELECT 1 FROM public.rounds WHERE id=subject) THEN RETURN; END IF;
  PERFORM * FROM public.lock_validation_judge();
  n=public.competition_now(subject);
  IF EXISTS(SELECT 1 FROM public.arena_control a JOIN public.rounds r ON r.arena_instance_id=a.current_instance_id WHERE a.id=1 AND r.id=subject) THEN
    PERFORM public.competition_close_due(subject,n);
  END IF;
  PERFORM public.participant_expire(subject);
  PERFORM public.shop_expire(subject,n);
END $$;

--> statement-breakpoint
CREATE OR REPLACE FUNCTION guard_participant_activity_source() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF NEW.last_activity_at IS DISTINCT FROM OLD.last_activity_at AND (
    OLD.revoked_at IS NOT NULL OR NEW.last_activity_at>=OLD.absolute_expires_at OR NEW.last_activity_at>=OLD.last_activity_at+interval '2 hours'
    OR NOT EXISTS(SELECT 1 FROM member_session_slots WHERE member_id=OLD.member_id AND session_id=OLD.id)
  ) THEN RAISE EXCEPTION 'Expired or retired participant sessions cannot renew'; END IF;
  IF NEW.last_activity_at IS DISTINCT FROM OLD.last_activity_at AND NOT EXISTS(
    SELECT 1 FROM participant_session_outcomes o WHERE o.session_id=NEW.id AND o.action='KEEP_ALIVE' AND o.recorded_at=NEW.last_activity_at
  ) AND NOT EXISTS(
    SELECT 1 FROM competition_outcomes o WHERE o.participant_session_id=NEW.id AND o.recorded_at=NEW.last_activity_at
      AND o.xmin::text::bigint=(pg_current_xact_id()::text::bigint & 4294967295)
      AND ((o.action='SUBMIT' AND o.result->>'status'='ADMITTED' AND EXISTS(SELECT 1 FROM competition_submissions WHERE source_id=o.id AND member_round_id=NEW.member_round_id))
        OR (o.action='RUN' AND o.result->>'status'='ADMITTED' AND EXISTS(SELECT 1 FROM participant_judging WHERE source_id=o.id AND member_round_id=NEW.member_round_id AND lane='SAMPLE'))
        OR (o.action='HINT' AND o.result->>'status'='PURCHASED' AND EXISTS(SELECT 1 FROM hint_purchases WHERE source_id=o.id))
        OR (o.action='SHOP_PURCHASE' AND o.result->>'status'='PURCHASED' AND EXISTS(SELECT 1 FROM shop_purchases WHERE source_id=o.id))
        OR (o.action='SHOP_ACTIVATE' AND o.result->>'status'='ACTIVATED' AND EXISTS(SELECT 1 FROM shop_activations WHERE source_id=o.id)))
  ) AND NOT EXISTS(SELECT 1 FROM workbench_activities a WHERE a.session_id=NEW.id AND a.member_round_id=NEW.member_round_id AND a.recorded_at=NEW.last_activity_at
    AND a.xmin::text::bigint=(pg_current_xact_id()::text::bigint & 4294967295)) THEN RAISE EXCEPTION 'Participant activity requires its committed source'; END IF;
  IF OLD.revoked_at IS NULL AND NEW.revocation_reason='LOGOUT' AND NOT EXISTS(
    SELECT 1 FROM participant_session_outcomes o WHERE o.session_id=NEW.id AND o.action='LOGOUT' AND o.recorded_at=NEW.revoked_at
  ) THEN RAISE EXCEPTION 'Participant logout requires its committed source'; END IF;
  IF OLD.revoked_at IS NULL AND NEW.revocation_reason='LOGOUT' AND (
    NEW.revoked_at<OLD.last_activity_at OR NEW.revoked_at>=OLD.absolute_expires_at OR NEW.revoked_at>=OLD.last_activity_at+interval '2 hours'
  ) THEN RAISE EXCEPTION 'Logout must use a still-valid participant session'; END IF;
  RETURN NEW;
END $$;

--> statement-breakpoint
ALTER TABLE public.shop_activations RENAME CONSTRAINT shop_activations_purchase_id_fkey TO shop_activations_purchase_id_shop_purchases_id_fk;
ALTER TABLE public.shop_activations RENAME CONSTRAINT shop_activations_round_id_fkey TO shop_activations_round_id_rounds_id_fk;
ALTER TABLE public.shop_activations RENAME CONSTRAINT shop_activations_team_round_id_fkey TO shop_activations_team_round_id_team_rounds_id_fk;
ALTER TABLE public.shop_activations RENAME CONSTRAINT shop_activations_bounty_id_fkey TO shop_activations_bounty_id_bounties_id_fk;
ALTER TABLE public.shop_activations RENAME CONSTRAINT shop_activations_target_team_round_id_fkey TO shop_activations_target_team_round_id_team_rounds_id_fk;
ALTER TABLE public.shop_activations RENAME CONSTRAINT shop_activations_source_id_fkey TO shop_activations_source_id_competition_outcomes_id_fk;
ALTER TABLE public.shop_activations RENAME CONSTRAINT shop_activations_purchase_id_key TO shop_activations_purchase_id_unique;
ALTER TABLE public.shop_activations RENAME CONSTRAINT shop_activations_source_id_key TO shop_activations_source_id_unique;
ALTER TABLE public.shop_expiry_notices RENAME CONSTRAINT shop_expiry_notices_activation_id_fkey TO shop_expiry_notices_activation_id_shop_activations_id_fk;
ALTER TABLE public.shop_presence RENAME CONSTRAINT shop_presence_session_id_fkey TO shop_presence_session_id_participant_sessions_id_fk;
ALTER TABLE public.shop_presence RENAME CONSTRAINT shop_presence_member_round_id_fkey TO shop_presence_member_round_id_member_rounds_id_fk;
ALTER TABLE public.shop_presence RENAME CONSTRAINT shop_presence_bounty_id_fkey TO shop_presence_bounty_id_bounties_id_fk;
ALTER TABLE public.shop_purchases RENAME CONSTRAINT shop_purchases_round_id_fkey TO shop_purchases_round_id_rounds_id_fk;
ALTER TABLE public.shop_purchases RENAME CONSTRAINT shop_purchases_team_round_id_fkey TO shop_purchases_team_round_id_team_rounds_id_fk;
ALTER TABLE public.shop_purchases RENAME CONSTRAINT shop_purchases_source_id_fkey TO shop_purchases_source_id_competition_outcomes_id_fk;
ALTER TABLE public.shop_purchases RENAME CONSTRAINT shop_purchases_source_id_key TO shop_purchases_source_id_unique;
ALTER TABLE public.shop_snapshot_intel RENAME CONSTRAINT shop_snapshot_intel_snapshot_id_fkey TO shop_snapshot_intel_snapshot_id_validation_snapshots_id_fk;
ALTER TABLE public.shop_submission_effects RENAME CONSTRAINT shop_submission_effects_submission_id_fkey TO shop_submission_effects_submission_id_competition_submissions_id_fk;
ALTER TABLE public.shop_submission_effects RENAME CONSTRAINT shop_submission_effects_protection_id_fkey TO shop_submission_effects_protection_id_shop_activations_id_fk;
ALTER TABLE public.shop_submission_effects RENAME CONSTRAINT shop_submission_effects_shield_id_fkey TO shop_submission_effects_shield_id_shop_activations_id_fk;
ALTER TABLE public.shop_submission_effects RENAME CONSTRAINT shop_submission_effects_shield_id_key TO shop_submission_effects_shield_id_unique;
ALTER TABLE public.wallet_entries RENAME CONSTRAINT wallet_entries_shop_purchase_id_fkey TO wallet_entries_shop_purchase_id_shop_purchases_id_fk;
ALTER TABLE public.wallet_entries RENAME CONSTRAINT wallet_entries_shop_purchase_id_key TO wallet_entries_shop_purchase_id_unique;
