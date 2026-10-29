-- Team inventory and economic effects use the same round lock as official admission and settlement.
CREATE TABLE shop_purchases (
  id uuid PRIMARY KEY, round_id uuid NOT NULL REFERENCES rounds(id), team_round_id uuid NOT NULL REFERENCES team_rounds(id),
  item_id text NOT NULL CHECK(item_id IN ('boundary-probe','hex-scanner','overdrive-core','ghost-scan','chrono-shield','claim-lock','black-ice')),
  price integer NOT NULL CHECK(price BETWEEN 400 AND 15000), source_id uuid NOT NULL UNIQUE REFERENCES competition_outcomes(id) DEFERRABLE INITIALLY DEFERRED,
  purchased_at timestamptz(3) NOT NULL
);
CREATE INDEX shop_team_inventory ON shop_purchases(team_round_id,purchased_at,id);
CREATE UNIQUE INDEX shop_once_per_round ON shop_purchases(team_round_id,item_id)
  WHERE item_id IN ('overdrive-core','chrono-shield','claim-lock','black-ice');
CREATE TABLE shop_activations (
  id uuid PRIMARY KEY, purchase_id uuid NOT NULL UNIQUE REFERENCES shop_purchases(id), round_id uuid NOT NULL REFERENCES rounds(id),
  team_round_id uuid NOT NULL REFERENCES team_rounds(id), item_id text NOT NULL,
  bounty_id uuid REFERENCES bounties(id), target_team_round_id uuid REFERENCES team_rounds(id),
  source_id uuid NOT NULL UNIQUE REFERENCES competition_outcomes(id) DEFERRABLE INITIALLY DEFERRED,
  activated_at timestamptz(3) NOT NULL, active_ms bigint NOT NULL, expires_ms bigint,
  CHECK(expires_ms IS NULL OR expires_ms>active_ms)
);
CREATE UNIQUE INDEX shop_intel_once ON shop_activations(team_round_id,bounty_id,item_id) WHERE bounty_id IS NOT NULL;
CREATE UNIQUE INDEX shop_freeze_once ON shop_activations(target_team_round_id) WHERE item_id='black-ice';
CREATE TABLE shop_submission_effects (
  submission_id uuid PRIMARY KEY REFERENCES competition_submissions(id),
  protection_id uuid REFERENCES shop_activations(id), shield_id uuid UNIQUE REFERENCES shop_activations(id),
  CHECK(protection_id IS NOT NULL OR shield_id IS NOT NULL)
);
CREATE TABLE shop_snapshot_intel (
  snapshot_id uuid NOT NULL REFERENCES validation_snapshots(id), language text NOT NULL,
  snapshot_fingerprint bytea NOT NULL CHECK(octet_length(snapshot_fingerprint)=32),
  starter_sha256 bytea NOT NULL CHECK(octet_length(starter_sha256)=32),
  data jsonb NOT NULL CHECK(jsonb_typeof(data)='object' AND octet_length(data::text)<=180000),
  PRIMARY KEY(snapshot_id,language)
);
ALTER TABLE wallet_entries ADD COLUMN shop_purchase_id uuid UNIQUE REFERENCES shop_purchases(id);
ALTER TABLE wallet_entries DROP CONSTRAINT wallet_entry_source;
ALTER TABLE wallet_entries ADD CONSTRAINT wallet_entry_source CHECK(
  num_nonnulls(award_id,purchase_id,carryover_id,shop_purchase_id)=1 AND amount<>0 AND amount BETWEEN -15000 AND 250000);
ALTER TABLE bounty_awards ADD COLUMN protected boolean NOT NULL DEFAULT false;
DROP INDEX competition_shared_winner;
CREATE UNIQUE INDEX competition_shared_winner ON bounty_awards(bounty_id) WHERE round_kind=2 AND NOT protected;
ALTER TABLE bounty_awards ADD CONSTRAINT protected_round_two CHECK(NOT protected OR round_kind=2);
--> statement-breakpoint
CREATE FUNCTION shop_clock(stage uuid,n timestamptz) RETURNS bigint LANGUAGE sql STABLE SET search_path=pg_catalog,public AS $$
  SELECT floor(extract(epoch FROM n)*1000)::bigint-COALESCE((SELECT sum(floor(extract(epoch FROM (least(coalesce(ended_at,n),n)-started_at))*1000))::bigint
    FROM public.competition_pauses WHERE round_id=stage AND scope='GLOBAL' AND started_at<n),0);
$$;
CREATE FUNCTION shop_protection(team uuid,bounty uuid,n timestamptz) RETURNS uuid LANGUAGE sql STABLE SET search_path=pg_catalog,public AS $$
  SELECT a.id FROM public.shop_activations a WHERE a.team_round_id=team AND a.bounty_id=bounty AND a.item_id='claim-lock'
    AND public.shop_clock(a.round_id,n)>=a.active_ms AND public.shop_clock(a.round_id,n)<a.expires_ms;
$$;
CREATE FUNCTION competition_bounty_unavailable(bounty uuid,team uuid,n timestamptz) RETURNS boolean LANGUAGE sql STABLE SET search_path=pg_catalog,public AS $$
  SELECT EXISTS(SELECT 1 FROM public.bounty_awards a JOIN public.bounties b ON b.id=a.bounty_id JOIN public.rounds r ON r.id=b.round_id
    WHERE a.bounty_id=bounty AND (a.team_round_id=team OR (r.kind=2 AND NOT a.protected AND public.shop_protection(team,bounty,n) IS NULL)));
$$;
CREATE FUNCTION shop_frozen(team uuid,n timestamptz) RETURNS boolean LANGUAGE sql STABLE SET search_path=pg_catalog,public AS $$
  SELECT EXISTS(SELECT 1 FROM public.shop_activations WHERE target_team_round_id=team AND item_id='black-ice'
    AND public.shop_clock(round_id,n)<expires_ms);
$$;
CREATE FUNCTION shop_assistance(team uuid,bounty uuid) RETURNS integer LANGUAGE sql STABLE SET search_path=pg_catalog,public AS $$
  SELECT COALESCE(max(CASE item_id WHEN 'hex-scanner' THEN 2 ELSE 1 END),0) FROM public.shop_activations
    WHERE team_round_id=team AND bounty_id=bounty AND item_id IN ('boundary-probe','hex-scanner');
$$;
CREATE FUNCTION shop_authority(sid uuid,stage uuid,n timestamptz) RETURNS member_rounds LANGUAGE plpgsql STABLE SET search_path=pg_catalog,public AS $$
DECLARE m public.member_rounds%ROWTYPE;
BEGIN
  SELECT mr.* INTO m FROM public.participant_sessions s JOIN public.member_session_slots slot ON slot.session_id=s.id AND slot.member_id=s.member_id
    JOIN public.access_credentials c ON c.id=s.credential_id AND c.version=s.credential_version AND c.team_id=s.team_id
    JOIN public.member_rounds mr ON mr.id=s.member_round_id AND mr.round_id=stage AND mr.enrolled_at IS NOT NULL AND mr.language IS NOT NULL
    JOIN public.rounds r ON r.id=stage WHERE s.id=sid AND s.round_id=stage AND s.revoked_at IS NULL AND c.revoked_at IS NULL AND c.issued_at<=n
    AND n>=s.last_activity_at AND n<s.absolute_expires_at AND n<s.last_activity_at+interval '2 hours'
    AND NOT EXISTS(SELECT 1 FROM public.access_blocks WHERE arena_instance_id=r.arena_instance_id AND cleared_at IS NULL AND (team_id=s.team_id OR member_id=s.member_id));
  IF m.id IS NULL THEN RAISE EXCEPTION 'Current participant authority required' USING ERRCODE='42501'; END IF;
  RETURN m;
END $$;
--> statement-breakpoint
CREATE FUNCTION shop_command(sid uuid,stage uuid,request uuid,action text,p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE r public.rounds%ROWTYPE; m public.member_rounds%ROWTYPE; owned public.shop_purchases%ROWTYPE;
  n timestamptz; tick bigint; fp bytea; old jsonb; result jsonb; source uuid=gen_random_uuid(); purchase uuid; activation uuid;
  item text; price integer; target uuid; bounty uuid; duration bigint; reason text;
BEGIN
  PERFORM id FROM public.security_control WHERE id=1 FOR SHARE;
  SELECT * INTO r FROM public.rounds WHERE id=stage FOR UPDATE;
  n=public.competition_now(stage); tick=public.shop_clock(stage,n); m=public.shop_authority(sid,stage,n);
  IF request IS NULL OR action NOT IN ('SHOP_PURCHASE','SHOP_ACTIVATE') OR p IS NULL OR jsonb_typeof(p)<>'object'
    OR octet_length(p::text)>1024 THEN RAISE EXCEPTION 'Invalid shop command' USING ERRCODE='22023'; END IF;
  fp=public.competition_fingerprint(action,p,0,'PARTICIPANT'); old=public.competition_old_receipt(stage,m.id,request,fp);
  IF old IS NOT NULL THEN RETURN old; END IF;
  IF action='SHOP_PURCHASE' THEN
    IF NOT p ? 'item_id' OR NOT p ? 'target_id' OR (SELECT count(*) FROM jsonb_object_keys(p))<>2 THEN RAISE EXCEPTION 'Invalid purchase' USING ERRCODE='22023'; END IF;
    item=p->>'item_id'; target=(p->>'target_id')::uuid;
    price=CASE item WHEN 'boundary-probe' THEN 400 WHEN 'hex-scanner' THEN 750 WHEN 'overdrive-core' THEN 500 WHEN 'ghost-scan' THEN 1500
      WHEN 'chrono-shield' THEN 2500 WHEN 'claim-lock' THEN 5000 WHEN 'black-ice' THEN 15000 END;
    IF price IS NULL OR (item='black-ice')<>(target IS NOT NULL) THEN RAISE EXCEPTION 'Invalid shop target' USING ERRCODE='22023'; END IF;
    IF target IS NOT NULL AND (target=m.team_round_id OR NOT EXISTS(SELECT 1 FROM public.team_rounds WHERE id=target AND round_id=stage)) THEN RAISE EXCEPTION 'Foreign shop target' USING ERRCODE='22023'; END IF;
  ELSE
    IF NOT p ? 'purchase_id' OR NOT p ? 'bounty_id' OR (SELECT count(*) FROM jsonb_object_keys(p))<>2 THEN RAISE EXCEPTION 'Invalid activation' USING ERRCODE='22023'; END IF;
    SELECT * INTO owned FROM public.shop_purchases WHERE id=(p->>'purchase_id')::uuid AND team_round_id=m.team_round_id AND round_id=stage;
    item=owned.item_id; purchase=owned.id; bounty=(p->>'bounty_id')::uuid;
    IF purchase IS NULL OR item NOT IN ('boundary-probe','hex-scanner','claim-lock') OR NOT EXISTS(SELECT 1 FROM public.bounties WHERE id=bounty AND round_id=stage)
      THEN RAISE EXCEPTION 'Foreign inventory or bounty' USING ERRCODE='22023'; END IF;
  END IF;
  PERFORM public.competition_close_due(stage,n); SELECT * INTO r FROM public.rounds WHERE id=stage;
  IF r.kind<>2 OR r.state NOT IN ('RUNNING','PAUSED') OR (r.state='RUNNING' AND n>=r.closes_at)
    OR NOT EXISTS(SELECT 1 FROM public.arena_control WHERE id=1 AND current_instance_id=r.arena_instance_id) THEN reason='ROUND_CLOSED';
  ELSIF public.competition_paused(stage,m.team_round_id,m.id) THEN reason='PAUSED';
  ELSIF action='SHOP_PURCHASE' AND public.shop_frozen(m.team_round_id,n) THEN reason='CREDIT_FROZEN';
  ELSIF action='SHOP_PURCHASE' THEN
    IF (SELECT count(*) FROM public.shop_purchases WHERE team_round_id=m.team_round_id)>=1024 THEN reason='INVENTORY_FULL';
    ELSIF item IN ('overdrive-core','chrono-shield','claim-lock','black-ice') AND EXISTS(SELECT 1 FROM public.shop_purchases WHERE team_round_id=m.team_round_id AND item_id=item) THEN reason='ALREADY_OWNED';
    ELSIF item='ghost-scan' AND EXISTS(SELECT 1 FROM public.shop_activations WHERE team_round_id=m.team_round_id AND item_id=item AND tick<active_ms+120000) THEN reason='SCAN_COOLDOWN';
    ELSIF item='black-ice' AND EXISTS(SELECT 1 FROM public.shop_activations WHERE target_team_round_id=target AND item_id=item) THEN reason='TARGET_ALREADY_HIT';
    ELSIF public.competition_balance(m.team_round_id)<price THEN reason='INSUFFICIENT_FUNDS'; END IF;
  ELSE
    IF EXISTS(SELECT 1 FROM public.shop_activations WHERE purchase_id=purchase) THEN reason='ITEM_USED';
    ELSIF EXISTS(SELECT 1 FROM public.shop_activations WHERE team_round_id=m.team_round_id AND bounty_id=bounty AND item_id=item) THEN reason='ALREADY_APPLIED';
    ELSIF public.competition_bounty_unavailable(bounty,m.team_round_id,n) THEN reason='BOUNTY_UNAVAILABLE';
    ELSIF item IN ('boundary-probe','hex-scanner') AND NOT EXISTS(SELECT 1 FROM public.shop_snapshot_intel i JOIN public.bounties b ON b.snapshot_id=i.snapshot_id
      WHERE b.id=bounty AND i.language=m.language AND i.data ? CASE item WHEN 'boundary-probe' THEN 'probe' ELSE 'scanner' END) THEN reason='INTEL_UNAVAILABLE'; END IF;
  END IF;
  result=jsonb_build_object('status','REJECTED','reason',reason,'item_id',item);
  IF reason IS NULL THEN
    IF action='SHOP_PURCHASE' THEN
      purchase=gen_random_uuid();
      INSERT INTO public.shop_purchases VALUES(purchase,stage,m.team_round_id,item,price,source,n);
      INSERT INTO public.wallet_entries(id,team_round_id,amount,shop_purchase_id,recorded_at) VALUES(gen_random_uuid(),m.team_round_id,-price,purchase,n);
    END IF;
    IF action='SHOP_ACTIVATE' OR item NOT IN ('boundary-probe','hex-scanner','claim-lock') THEN
      duration=CASE item WHEN 'ghost-scan' THEN 15000 WHEN 'claim-lock' THEN 300000 WHEN 'black-ice' THEN 1800000 END;
      activation=gen_random_uuid();
      INSERT INTO public.shop_activations VALUES(activation,purchase,stage,m.team_round_id,item,bounty,target,source,n,tick,tick+duration);
    END IF;
    result=jsonb_build_object('status',CASE WHEN action='SHOP_PURCHASE' THEN 'PURCHASED' ELSE 'ACTIVATED' END,'item_id',item,'purchase_id',purchase);
  END IF;
  old=public.competition_receipt(source,stage,sid,m.id,request,action,fp,'PARTICIPANT',result,n,false);
  IF reason IS NULL THEN UPDATE public.participant_sessions SET last_activity_at=n WHERE id=sid; END IF;
  RETURN old;
END $$;
--> statement-breakpoint
CREATE FUNCTION shop_changed() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE e uuid; streams uuid[];
BEGIN
  INSERT INTO public.live_effects(round_id) VALUES(NEW.round_id) RETURNING id INTO e;
  SELECT array_agg(id) INTO streams FROM public.live_streams WHERE
    (kind='TEAM' AND (team_round_id=NEW.team_round_id OR (TG_TABLE_NAME='shop_activations' AND team_round_id=(to_jsonb(NEW)->>'target_team_round_id')::uuid)))
    OR (kind='ROUND' AND round_id=NEW.round_id AND NEW.item_id='overdrive-core');
  PERFORM public.live_emit(e,streams,jsonb_build_object('type','INVALIDATE','projection','shop'));
  RETURN NEW;
END $$;
CREATE TRIGGER shop_purchased AFTER INSERT ON shop_purchases FOR EACH ROW EXECUTE FUNCTION shop_changed();
CREATE TRIGGER shop_activated AFTER INSERT ON shop_activations FOR EACH ROW EXECUTE FUNCTION shop_changed();
CREATE FUNCTION shop_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Shop records are immutable'; END $$;
CREATE TRIGGER shop_purchase_immutable BEFORE UPDATE OR DELETE ON shop_purchases FOR EACH ROW EXECUTE FUNCTION shop_immutable();
CREATE TRIGGER shop_activation_immutable BEFORE UPDATE OR DELETE ON shop_activations FOR EACH ROW EXECUTE FUNCTION shop_immutable();
CREATE TRIGGER shop_submission_immutable BEFORE UPDATE OR DELETE ON shop_submission_effects FOR EACH ROW EXECUTE FUNCTION shop_immutable();
CREATE TRIGGER shop_intel_immutable BEFORE UPDATE OR DELETE ON shop_snapshot_intel FOR EACH ROW EXECUTE FUNCTION shop_immutable();
CREATE FUNCTION shop_submission_snapshot() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE protection uuid; shield uuid;
BEGIN
  IF (SELECT kind FROM public.rounds WHERE id=NEW.round_id)<>2 THEN RETURN NEW; END IF;
  protection=public.shop_protection(NEW.team_round_id,NEW.bounty_id,NEW.received_at);
  SELECT a.id INTO shield FROM public.shop_activations a WHERE a.team_round_id=NEW.team_round_id AND a.item_id='chrono-shield'
    AND NOT EXISTS(SELECT 1 FROM public.shop_submission_effects WHERE shield_id=a.id);
  IF protection IS NOT NULL OR shield IS NOT NULL THEN INSERT INTO public.shop_submission_effects VALUES(NEW.id,protection,shield); END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER shop_submission_snapshot AFTER INSERT ON competition_submissions FOR EACH ROW EXECUTE FUNCTION shop_submission_snapshot();
CREATE FUNCTION shop_wallet_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF NEW.shop_purchase_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.shop_purchases WHERE id=NEW.shop_purchase_id AND team_round_id=NEW.team_round_id AND price=-NEW.amount)
    THEN RAISE EXCEPTION 'Shop debit mismatch'; END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER shop_wallet_guard AFTER INSERT ON wallet_entries DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION shop_wallet_guard();
REVOKE ALL ON shop_purchases,shop_activations,shop_submission_effects,shop_snapshot_intel FROM PUBLIC,ingenium_api,ingenium_competition_worker;
GRANT SELECT ON shop_purchases,shop_activations,shop_submission_effects TO ingenium_api;
DO $$ DECLARE f record; BEGIN
  FOR f IN SELECT oid::regprocedure sig FROM pg_proc WHERE pronamespace='public'::regnamespace AND (proname LIKE 'shop\_%' ESCAPE '\' OR proname='competition_bounty_unavailable') LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,ingenium_api,ingenium_competition_worker',f.sig);
  END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION shop_command(uuid,uuid,uuid,text,jsonb),shop_clock(uuid,timestamptz),shop_protection(uuid,uuid,timestamptz),shop_assistance(uuid,uuid),competition_bounty_unavailable(uuid,uuid,timestamptz) TO ingenium_api;
