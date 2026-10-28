-- New Round 1 drafts may explicitly use the 5x reward policy. Existing rows and frozen rewards are never rewritten.
ALTER TABLE public.bug_versions DROP CONSTRAINT bug_version_content;
ALTER TABLE public.bug_versions ADD CONSTRAINT bug_version_content CHECK (version_number between 1 and 1000 and content_revision>=1 and content_bytes>=4096
    and octet_length(title) between 1 and 160 and length(btrim(title))>0 and octet_length(statement)<=65536
    and difficulty between 1 and 100 and base_bounty in (difficulty*10,difficulty*50) and submission_format='FULL_PROGRAM'
    and checker_mode in ('TOKENS','EXACT_TEXT') and checker_version='ingenium-text-v1');
--> statement-breakpoint
ALTER TABLE public.validation_snapshots DROP CONSTRAINT snapshot_metadata;
ALTER TABLE public.validation_snapshots ADD CONSTRAINT snapshot_metadata CHECK (version_number between 1 and 1000 and content_revision>=1 and round_type in (1,2)
    and octet_length(title) between 1 and 160 and length(btrim(title))>0 and octet_length(statement)<=65536
    and difficulty between 1 and 100 and (base_bounty=difficulty*10 or (round_type=1 and base_bounty=difficulty*50))
    and submission_format='FULL_PROGRAM' and checker_mode in ('TOKENS','EXACT_TEXT') and checker_version='ingenium-text-v1');
--> statement-breakpoint
ALTER TABLE public.bounty_awards DROP CONSTRAINT competition_award_shape;
ALTER TABLE public.bounty_awards ADD CONSTRAINT competition_award_shape CHECK ((round_kind=1 and base_bounty between 10 and 5000 and points=base_bounty) or (round_kind=2 and base_bounty between 10 and 1000 and points between 5 and 1000));
--> statement-breakpoint
ALTER TABLE public.hint_purchases DROP CONSTRAINT competition_hint_shape;
ALTER TABLE public.hint_purchases ADD CONSTRAINT competition_hint_shape CHECK (level between 1 and 3 and price between 1 and 2000);
--> statement-breakpoint
ALTER TABLE public.round_carryovers DROP CONSTRAINT competition_carryover_amount;
ALTER TABLE public.round_carryovers ADD CONSTRAINT competition_carryover_amount CHECK (amount between 0 and 250000);
--> statement-breakpoint
ALTER TABLE public.wallet_entries DROP CONSTRAINT wallet_entry_source;
ALTER TABLE public.wallet_entries ADD CONSTRAINT wallet_entry_source CHECK (num_nonnulls(award_id,purchase_id,carryover_id)=1 and amount<>0 and amount between -2000 and 250000);
--> statement-breakpoint
CREATE FUNCTION guard_bug_reward_round() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF NEW.base_bounty=NEW.difficulty*50 AND NOT EXISTS(SELECT 1 FROM public.bug_definitions WHERE id=NEW.definition_id AND round_type=1) THEN
  RAISE EXCEPTION 'Boosted rewards are Round 1 only';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER bug_reward_round BEFORE INSERT OR UPDATE OF base_bounty,difficulty,definition_id ON public.bug_versions FOR EACH ROW EXECUTE FUNCTION guard_bug_reward_round();
REVOKE ALL ON FUNCTION guard_bug_reward_round() FROM PUBLIC;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION content_edit_status(kind text,subject uuid,p jsonb) RETURNS text LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE v public.bug_versions%ROWTYPE; variant public.language_variants%ROWTYPE; c public.test_cases%ROWTYPE; current_payload jsonb; ids uuid[];
BEGIN
  SELECT * INTO v FROM public.bug_versions WHERE id=subject;
  IF NOT FOUND OR v.publication_status<>'DRAFT' THEN RETURN 'CONTENT_LOCKED'; END IF;
  IF kind='METADATA' THEN
    IF ROW(v.title,v.statement,v.difficulty,v.checker_mode,v.category,v.base_bounty) IS NOT DISTINCT FROM ROW(p->>'title',p->>'statement',(p->>'difficulty')::integer,p->>'checker_mode',CASE WHEN p?'category' THEN p->>'category' ELSE v.category END,(p->>'difficulty')::integer*10*COALESCE((p->>'reward_multiplier')::integer,v.base_bounty/(v.difficulty*10))) THEN RETURN 'UNCHANGED'; END IF;
  ELSIF kind='VARIANT' THEN
    SELECT * INTO variant FROM public.language_variants WHERE version_id=subject AND language=p->>'language';
    IF FOUND AND ROW(variant.starter_code,variant.reference_code,variant.defect_description,variant.runtime_key,variant.cpu_ms,variant.wall_ms,variant.memory_kb)
      IS NOT DISTINCT FROM ROW(decode(p->>'starter_b64','base64'),decode(p->>'reference_b64','base64'),p->>'defect_description',p->>'runtime_key',
        (p->>'cpu_time_limit_ms')::integer,(p->>'wall_time_limit_ms')::integer,(p->>'memory_limit_kb')::integer) THEN RETURN 'UNCHANGED'; END IF;
  ELSIF kind IN ('CASE','DELETE_CASE') THEN
    SELECT * INTO c FROM public.test_cases WHERE id=(p->>'case_id')::uuid AND version_id=subject AND removed_at IS NULL;
    IF p->>'case_id' IS NOT NULL AND c.id IS NULL THEN RETURN 'CASE_UNAVAILABLE'; END IF;
    IF kind='DELETE_CASE' THEN
      IF EXISTS(SELECT 1 FROM public.failure_witnesses WHERE test_case_id=c.id) THEN RETURN 'REFERENCED_CASE'; END IF;
    ELSE
      IF EXISTS(SELECT 1 FROM public.test_cases WHERE version_id=subject AND removed_at IS NULL AND position=(p->>'position')::integer AND id IS DISTINCT FROM c.id) THEN RETURN 'POSITION_OCCUPIED'; END IF;
      IF c.id IS NOT NULL AND ROW(c.position,c.visibility,c.input_data,c.expected_output) IS NOT DISTINCT FROM
        ROW((p->>'position')::integer,p->>'visibility',decode(p->>'input_b64','base64'),decode(p->>'expected_b64','base64')) THEN RETURN 'UNCHANGED'; END IF;
    END IF;
  ELSIF kind='HINT' THEN
    IF EXISTS(SELECT 1 FROM public.bug_hints WHERE version_id=subject AND level=(p->>'level')::integer AND content=p->>'content') THEN RETURN 'UNCHANGED'; END IF;
  ELSIF kind='WITNESSES' THEN
    SELECT * INTO variant FROM public.language_variants WHERE version_id=subject AND language=p->>'language';
    IF NOT FOUND THEN RETURN 'VARIANT_MISSING'; END IF;
    IF EXISTS(SELECT 1 FROM jsonb_array_elements(p->'witnesses') w WHERE w->>'check_type'='TEST_CASE' AND NOT EXISTS(
      SELECT 1 FROM public.test_cases WHERE id=(w->>'test_case_id')::uuid AND version_id=subject AND removed_at IS NULL)) THEN RETURN 'CASE_UNAVAILABLE'; END IF;
    SELECT COALESCE(jsonb_agg(jsonb_build_object('check_type',check_type,'test_case_id',test_case_id,'expected_failure',expected_failure) ORDER BY position),'[]'::jsonb)
      INTO current_payload FROM public.failure_witnesses WHERE variant_id=variant.id;
    IF current_payload=p->'witnesses' THEN RETURN 'UNCHANGED'; END IF;
  ELSIF kind='REORDER_CASES' THEN
    SELECT COALESCE(array_agg(value::uuid ORDER BY ordinal),'{}'::uuid[]) INTO ids FROM jsonb_array_elements_text(p->'case_ids') WITH ORDINALITY a(value,ordinal);
    IF cardinality(ids)<>(SELECT count(*) FROM public.test_cases WHERE version_id=subject AND removed_at IS NULL)
      OR cardinality(ids)<>(SELECT count(DISTINCT item) FROM unnest(ids) item)
      OR EXISTS(SELECT 1 FROM unnest(ids) wanted(case_id) WHERE NOT EXISTS(SELECT 1 FROM public.test_cases tc WHERE tc.id=wanted.case_id AND tc.version_id=subject AND tc.removed_at IS NULL)) THEN RETURN 'INVALID_ORDER'; END IF;
    IF NOT EXISTS(SELECT 1 FROM public.test_cases tc WHERE tc.version_id=subject AND tc.removed_at IS NULL AND tc.position<>array_position(ids,tc.id)) THEN RETURN 'UNCHANGED'; END IF;
  ELSE RAISE EXCEPTION 'Unsupported content operation'; END IF;
  RETURN 'APPLIED';
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION apply_content_edit(source_id uuid,payload text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE s public.content_outcomes%ROWTYPE; gate public.catalogue_control%ROWTYPE; definition public.bug_definitions%ROWTYPE; v public.bug_versions%ROWTYPE;
  p jsonb; chosen_variant uuid; n integer; old_bytes bigint; new_bytes bigint; multiplier integer;
BEGIN
  SELECT * INTO gate FROM public.lock_catalogue();
  SELECT * INTO s FROM public.content_outcomes WHERE id=source_id;
  IF NOT FOUND OR s.outcome<>'APPLIED' OR s.payload_digest<>sha256(convert_to(payload,'UTF8')) THEN RAISE EXCEPTION 'Matching applied content source required'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.staff_sessions x JOIN public.staff_session_slots slot ON slot.staff_id=x.staff_id AND slot.session_id=x.id
    JOIN public.staff_identities i ON i.id=x.staff_id JOIN public.access_credentials c ON c.id=x.credential_id AND c.version=x.credential_version AND c.staff_id=x.staff_id
    WHERE x.id=s.session_id AND x.staff_id=s.actor_id AND x.credential_id=s.credential_id AND x.credential_version=s.credential_version
      AND x.mode='NORMAL' AND x.revoked_at IS NULL AND i.role IN ('OWNER','SUPER_ADMIN') AND i.disabled_at IS NULL AND c.revoked_at IS NULL
      AND clock_timestamp()<x.absolute_expires_at AND clock_timestamp()<x.last_activity_at+interval '15 minutes') THEN RAISE EXCEPTION 'Authoring authority changed'; END IF;
  p=payload::jsonb;
  IF s.action='CREATE' THEN
    IF s.expected_revision<>gate.revision OR (SELECT count(*) FROM public.bug_definitions)>=250 THEN RAISE EXCEPTION USING ERRCODE='54000',MESSAGE='Catalogue capacity or revision unavailable'; END IF;
    INSERT INTO public.bug_definitions(id,round_type,created_by,created_at,revision) VALUES(s.result_definition_id,(p->>'round_type')::integer,s.actor_id,s.recorded_at,1);
  ELSIF s.action='NEW_VERSION' THEN
    SELECT * INTO definition FROM public.bug_definitions WHERE id=s.definition_id FOR UPDATE;
    IF NOT FOUND OR definition.revision<>s.expected_revision OR s.result_definition_id<>definition.id THEN RAISE EXCEPTION 'Definition revision changed'; END IF;
    UPDATE public.bug_definitions SET revision=revision+1 WHERE id=definition.id;
  ELSE
    SELECT * INTO v FROM public.bug_versions WHERE id=s.version_id FOR UPDATE;
    IF NOT FOUND OR v.content_revision<>s.expected_revision OR v.publication_status<>'DRAFT' OR s.result_definition_id<>v.definition_id
      OR s.result_version_id<>v.id OR public.content_edit_status(s.action,v.id,p)<>'APPLIED' THEN RAISE EXCEPTION 'Content effect is stale, unavailable or unchanged'; END IF;
  END IF;
  multiplier=COALESCE((p->>'reward_multiplier')::integer,CASE WHEN s.action='METADATA' THEN v.base_bounty/(v.difficulty*10) ELSE 1 END);
  IF s.action IN ('CREATE','NEW_VERSION','METADATA') AND (multiplier NOT IN (1,5) OR (multiplier=5 AND NOT EXISTS(
    SELECT 1 FROM public.bug_definitions WHERE id=s.result_definition_id AND round_type=1))) THEN RAISE EXCEPTION 'Invalid round reward policy'; END IF;
  IF s.action IN ('CREATE','NEW_VERSION') THEN
    IF (SELECT count(*) FROM public.bug_versions)>=1000 THEN RAISE EXCEPTION USING ERRCODE='54000',MESSAGE='Catalogue version capacity unavailable'; END IF;
    SELECT COALESCE(max(version_number),0)+1 INTO n FROM public.bug_versions WHERE definition_id=s.result_definition_id;
    INSERT INTO public.bug_versions(id,definition_id,version_number,title,statement,difficulty,base_bounty,publication_status,created_by,created_at,
      submission_format,checker_mode,checker_version,content_revision,content_bytes,last_source_id,category)
      VALUES(s.result_version_id,s.result_definition_id,n,p->>'title',p->>'statement',(p->>'difficulty')::integer,(p->>'difficulty')::integer*10*multiplier,'DRAFT',s.actor_id,s.recorded_at,
        'FULL_PROGRAM',p->>'checker_mode','ingenium-text-v1',1,4096,s.id,p->>'category');
    old_bytes=0;
  ELSE
    old_bytes=v.content_bytes;
    UPDATE public.bug_versions SET content_revision=s.result_revision,last_source_id=s.id WHERE id=v.id;
    IF s.action='METADATA' THEN
      UPDATE public.bug_versions SET title=p->>'title',statement=p->>'statement',difficulty=(p->>'difficulty')::integer,
        base_bounty=(p->>'difficulty')::integer*10*multiplier,checker_mode=p->>'checker_mode',category=CASE WHEN p?'category' THEN p->>'category' ELSE v.category END WHERE id=v.id;
    ELSIF s.action='VARIANT' THEN
      INSERT INTO public.language_variants(id,version_id,language,starter_code,reference_code,defect_description,runtime_key,cpu_ms,wall_ms,memory_kb)
        VALUES(gen_random_uuid(),v.id,p->>'language',decode(p->>'starter_b64','base64'),decode(p->>'reference_b64','base64'),p->>'defect_description',p->>'runtime_key',
          (p->>'cpu_time_limit_ms')::integer,(p->>'wall_time_limit_ms')::integer,(p->>'memory_limit_kb')::integer)
        ON CONFLICT(version_id,language) DO UPDATE SET starter_code=EXCLUDED.starter_code,reference_code=EXCLUDED.reference_code,defect_description=EXCLUDED.defect_description,
          runtime_key=EXCLUDED.runtime_key,cpu_ms=EXCLUDED.cpu_ms,wall_ms=EXCLUDED.wall_ms,memory_kb=EXCLUDED.memory_kb;
    ELSIF s.action='CASE' THEN
      IF p->>'case_id' IS NULL THEN
        INSERT INTO public.test_cases(id,version_id,position,visibility,input_data,expected_output)
          VALUES(s.result_case_id,v.id,(p->>'position')::integer,p->>'visibility',decode(p->>'input_b64','base64'),decode(p->>'expected_b64','base64'));
      ELSE
        IF s.result_case_id IS DISTINCT FROM (p->>'case_id')::uuid THEN RAISE EXCEPTION 'Case identity mismatch'; END IF;
        UPDATE public.test_cases SET position=(p->>'position')::integer,visibility=p->>'visibility',input_data=decode(p->>'input_b64','base64'),expected_output=decode(p->>'expected_b64','base64') WHERE id=s.result_case_id AND version_id=v.id AND removed_at IS NULL;
      END IF;
    ELSIF s.action='DELETE_CASE' THEN
      UPDATE public.test_cases SET removed_at=s.recorded_at WHERE id=(p->>'case_id')::uuid AND version_id=v.id AND removed_at IS NULL;
    ELSIF s.action='HINT' THEN
      INSERT INTO public.bug_hints(version_id,level,content) VALUES(v.id,(p->>'level')::integer,p->>'content') ON CONFLICT(version_id,level) DO UPDATE SET content=EXCLUDED.content;
    ELSIF s.action='WITNESSES' THEN
      SELECT id INTO chosen_variant FROM public.language_variants WHERE version_id=v.id AND language=p->>'language';
      DELETE FROM public.failure_witnesses WHERE variant_id=chosen_variant;
      INSERT INTO public.failure_witnesses(variant_id,version_id,position,check_type,test_case_id,expected_failure)
        SELECT chosen_variant,v.id,ordinal::integer,w->>'check_type',(w->>'test_case_id')::uuid,w->>'expected_failure' FROM jsonb_array_elements(p->'witnesses') WITH ORDINALITY a(w,ordinal);
    ELSIF s.action='REORDER_CASES' THEN
      UPDATE public.test_cases SET position=position+20 WHERE version_id=v.id AND removed_at IS NULL;
      UPDATE public.test_cases SET position=ordinal::integer FROM jsonb_array_elements_text(p->'case_ids') WITH ORDINALITY a(value,ordinal)
        WHERE id=value::uuid AND version_id=v.id AND removed_at IS NULL;
    END IF;
  END IF;
  SELECT public.content_version_bytes(s.result_version_id) INTO new_bytes;
  IF gate.committed_bytes-old_bytes+new_bytes>3221225472 THEN RAISE EXCEPTION USING ERRCODE='54000',MESSAGE='Catalogue byte capacity unavailable'; END IF;
  UPDATE public.bug_versions SET content_bytes=new_bytes WHERE id=s.result_version_id;
  UPDATE public.catalogue_control SET committed_bytes=committed_bytes-old_bytes+new_bytes,revision=revision+1 WHERE id=1;
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION competition_settle(subject uuid,n timestamptz) RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE r public.rounds%ROWTYPE; a record; sid uuid; aid uuid; cash integer; score integer;
BEGIN
  SELECT * INTO r FROM public.rounds WHERE id=subject FOR UPDATE;
  IF r.state NOT IN ('RUNNING','CLOSING') THEN RETURN; END IF;
  FOR a IN SELECT s.*,x.verdict,v.difficulty,v.base_bounty FROM public.competition_submissions s
    JOIN public.competition_assessments x ON x.submission_id=s.id JOIN public.bounties b ON b.id=s.bounty_id
    JOIN public.validation_snapshots v ON v.id=b.snapshot_id WHERE s.round_id=subject ORDER BY s.receipt_order LOOP
    IF a.verdict<>'PASSED' THEN
      IF r.kind=2 AND NOT EXISTS(SELECT 1 FROM public.wrong_submission_penalties WHERE submission_id=a.id) THEN
        INSERT INTO public.wrong_submission_penalties VALUES(a.id,a.team_round_id,300000,n);
        PERFORM public.competition_event(subject,a.team_round_id,'PENALTY_APPLIED',a.id,n);
      END IF;
      CONTINUE;
    END IF;
    IF EXISTS(SELECT 1 FROM public.bounty_awards WHERE bounty_id=a.bounty_id AND (r.kind=2 OR team_round_id=a.team_round_id)) THEN CONTINUE; END IF;
    SELECT s.id INTO sid FROM public.competition_submissions s LEFT JOIN public.competition_assessments x ON x.submission_id=s.id
      WHERE s.bounty_id=a.bounty_id AND s.receipt_order<a.receipt_order AND (r.kind=2 OR s.team_round_id=a.team_round_id)
        AND (x.verdict IS NULL OR x.verdict='PASSED') ORDER BY s.receipt_order LIMIT 1;
    IF FOUND THEN CONTINUE; END IF;
    aid=gen_random_uuid(); cash=a.base_bounty;
    score=(a.base_bounty/10)*CASE WHEN r.kind=1 THEN 10 WHEN a.hint_tier=0 THEN 10 WHEN a.hint_tier=1 THEN 9 WHEN a.hint_tier=2 THEN 7 ELSE 5 END;
    INSERT INTO public.bounty_awards VALUES(aid,a.id,a.team_round_id,a.bounty_id,r.kind,cash,score,n);
    INSERT INTO public.wallet_entries VALUES(gen_random_uuid(),a.team_round_id,cash,aid,NULL,NULL,n);
    PERFORM public.competition_event(subject,CASE WHEN r.kind=1 THEN a.team_round_id END,'BOUNTY_AWARDED',aid,n);
  END LOOP;
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION competition_original_participant_command(sid uuid,subject uuid,request uuid,action text,p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE r public.rounds%ROWTYPE; session public.participant_sessions%ROWTYPE; m public.member_rounds%ROWTYPE; b record;
  n timestamptz; fp bytea; old jsonb; result jsonb; source uuid=gen_random_uuid(); target uuid; owned uuid; tier integer; price integer; sub uuid; code bytea; sequence bigint;
BEGIN
  PERFORM id FROM public.security_control WHERE id=1 FOR SHARE;
  SELECT * INTO r FROM public.rounds WHERE id=subject FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Round unavailable'; END IF;
  n=public.competition_now(subject);
  SELECT s.* INTO session FROM public.participant_sessions s JOIN public.member_session_slots slot ON slot.member_id=s.member_id AND slot.session_id=s.id
    JOIN public.access_credentials c ON c.id=s.credential_id AND c.version=s.credential_version AND c.team_id=s.team_id
    WHERE s.id=sid AND s.round_id=subject AND s.revoked_at IS NULL AND c.revoked_at IS NULL AND c.issued_at<=n
      AND n>=s.last_activity_at AND n<s.absolute_expires_at AND n<s.last_activity_at+interval '2 hours'
      AND NOT EXISTS(SELECT 1 FROM public.access_blocks WHERE arena_instance_id=r.arena_instance_id AND cleared_at IS NULL AND (team_id=s.team_id OR member_id=s.member_id));
  IF session.id IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Current participant authority required'; END IF;
  SELECT * INTO m FROM public.member_rounds WHERE id=session.member_round_id;
  IF action NOT IN ('HINT','SUBMIT') OR p IS NULL OR jsonb_typeof(p)<>'object' OR octet_length(p::text)>180000 THEN RAISE EXCEPTION 'Invalid participant command'; END IF;
  target=(p->>'bounty_id')::uuid;
  SELECT bb.*,s.difficulty,s.base_bounty INTO b FROM public.bounties bb JOIN public.validation_snapshots s ON s.id=bb.snapshot_id WHERE bb.id=target AND bb.round_id=subject;
  IF b.id IS NULL THEN RAISE EXCEPTION 'Foreign bounty'; END IF;
  fp=public.competition_fingerprint(action,p,0,'PARTICIPANT'); old=public.competition_old_receipt(subject,m.id,request,fp); IF old IS NOT NULL THEN RETURN old; END IF;
  IF action='HINT' THEN
    IF (p->>'level')::integer NOT BETWEEN 1 AND 3 OR p->>'level' IS NULL THEN RAISE EXCEPTION 'Invalid hint level'; END IF;
    SELECT id INTO owned FROM public.hint_purchases WHERE team_round_id=m.team_round_id AND bounty_id=target AND level=(p->>'level')::integer;
    IF owned IS NOT NULL THEN RETURN public.competition_receipt(source,subject,sid,m.id,request,action,fp,'PARTICIPANT',jsonb_build_object('status','ALREADY_OWNED','purchase_id',owned),n,false); END IF;
  END IF;
  PERFORM public.competition_close_due(subject,n); SELECT * INTO r FROM public.rounds WHERE id=subject;
  result=jsonb_build_object('status','REJECTED','reason','ROUND_UNAVAILABLE');
  IF r.state='RUNNING' AND n<r.closes_at AND EXISTS(SELECT 1 FROM public.arena_control WHERE id=1 AND current_instance_id=r.arena_instance_id)
    AND NOT public.competition_paused(subject,m.team_round_id,m.id) THEN
    IF EXISTS(SELECT 1 FROM public.bounty_awards WHERE bounty_id=target AND (r.kind=2 OR team_round_id=m.team_round_id)) THEN result=jsonb_build_object('status','REJECTED','reason','BOUNTY_UNAVAILABLE');
    ELSE
      SELECT COALESCE(max(level),0) INTO tier FROM public.hint_purchases WHERE team_round_id=m.team_round_id AND bounty_id=target;
      IF action='HINT' THEN
        IF (p->>'level')::integer<>tier+1 THEN result=jsonb_build_object('status','REJECTED','reason','HINT_LOCKED');
        ELSE
          price=(b.base_bounty/10)*CASE WHEN tier=0 THEN 1 WHEN tier=1 THEN 3 WHEN r.kind=1 THEN 4 ELSE 8 END;
          IF public.competition_balance(m.team_round_id)<price THEN result=jsonb_build_object('status','REJECTED','reason','INSUFFICIENT_FUNDS');
          ELSE
            owned=gen_random_uuid();
            INSERT INTO public.hint_purchases VALUES(owned,m.team_round_id,target,tier+1,price,source,n);
            INSERT INTO public.wallet_entries VALUES(gen_random_uuid(),m.team_round_id,-price,NULL,owned,NULL,n);
            result=jsonb_build_object('status','PURCHASED','purchase_id',owned);
            PERFORM public.competition_event(subject,m.team_round_id,'HINT_PURCHASED',owned,n);
          END IF;
        END IF;
      ELSE
        code=decode(p->>'source_b64','base64');
        IF code IS NULL OR octet_length(code) NOT BETWEEN 1 AND 131072 THEN RAISE EXCEPTION 'Invalid source'; END IF;
        IF EXISTS(SELECT 1 FROM public.competition_submissions s LEFT JOIN public.competition_assessments a ON a.submission_id=s.id
          WHERE s.team_round_id=m.team_round_id AND s.bounty_id=target AND a.submission_id IS NULL) THEN result=jsonb_build_object('status','REJECTED','reason','OFFICIAL_PENDING');
        ELSIF (SELECT next_receipt FROM public.competition_configs WHERE round_id=subject)>=20000 THEN RAISE EXCEPTION 'Official admission capacity';
        ELSIF NOT EXISTS(SELECT 1 FROM public.judge_control WHERE id=1 AND lease_until>n AND active_validation_id IS NULL) THEN RAISE EXCEPTION 'Judge unavailable';
        ELSE
          UPDATE public.competition_configs SET next_receipt=next_receipt+1 WHERE round_id=subject RETURNING next_receipt INTO sequence;
          sub=gen_random_uuid();
          INSERT INTO public.competition_submissions VALUES(sub,subject,m.team_round_id,m.id,target,code,m.language,sequence,n,public.competition_elapsed(subject,m.team_round_id,m.id,n),tier,source);
          result=jsonb_build_object('status','ADMITTED','submission_id',sub,'receipt_order',sequence,'received_at',n,'hint_tier',tier);
          PERFORM public.competition_event(subject,m.team_round_id,'SUBMISSION_RECEIVED',sub,n);
        END IF;
      END IF;
    END IF;
  END IF;
  old=public.competition_receipt(source,subject,sid,m.id,request,action,fp,'PARTICIPANT',result,n,false);
  IF result->>'status' IN ('PURCHASED','ADMITTED') THEN UPDATE public.participant_sessions SET last_activity_at=n WHERE id=sid; END IF;
  RETURN old;
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION competition_economic_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE subject uuid; b record; s public.competition_submissions%ROWTYPE; r public.rounds%ROWTYPE; cash bigint;
BEGIN
  IF TG_TABLE_NAME='wallet_entries' THEN
    subject=NEW.team_round_id;
    IF NEW.award_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.bounty_awards WHERE id=NEW.award_id AND team_round_id=subject AND base_bounty=NEW.amount) THEN RAISE EXCEPTION 'Award credit mismatch'; END IF;
    IF NEW.purchase_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.hint_purchases WHERE id=NEW.purchase_id AND team_round_id=subject AND price=-NEW.amount) THEN RAISE EXCEPTION 'Hint debit mismatch'; END IF;
    IF NEW.carryover_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.round_carryovers WHERE team_round_id=NEW.carryover_id AND team_round_id=subject AND amount=NEW.amount AND amount>0) THEN RAISE EXCEPTION 'Opening credit mismatch'; END IF;
    IF public.competition_balance(subject)<0 THEN RAISE EXCEPTION 'Wallet cannot become negative'; END IF;
  ELSIF TG_TABLE_NAME='hint_purchases' THEN
    SELECT bb.*,v.difficulty,v.base_bounty,stage.kind INTO b FROM public.bounties bb JOIN public.validation_snapshots v ON v.id=bb.snapshot_id JOIN public.rounds stage ON stage.id=bb.round_id WHERE bb.id=NEW.bounty_id;
    IF NEW.price<>(b.base_bounty/10)*(CASE WHEN NEW.level=1 THEN 1 WHEN NEW.level=2 THEN 3 WHEN b.kind=1 THEN 4 ELSE 8 END)
      OR (SELECT count(*) FROM public.hint_purchases WHERE team_round_id=NEW.team_round_id AND bounty_id=NEW.bounty_id AND level<NEW.level)<>NEW.level-1
      OR NOT EXISTS(SELECT 1 FROM public.competition_outcomes o JOIN public.participant_sessions ps ON ps.id=o.participant_session_id
        JOIN public.member_rounds m ON m.id=ps.member_round_id WHERE o.id=NEW.source_id AND o.round_id=b.round_id AND m.team_round_id=NEW.team_round_id
          AND o.action='HINT' AND o.result->>'status'='PURCHASED' AND o.result->>'purchase_id'=NEW.id::text AND o.recorded_at=NEW.recorded_at)
      OR NOT EXISTS(SELECT 1 FROM public.wallet_entries WHERE purchase_id=NEW.id AND team_round_id=NEW.team_round_id AND amount=-NEW.price) THEN RAISE EXCEPTION 'Hint requires its sequential source and exact debit'; END IF;
  ELSIF TG_TABLE_NAME='bounty_awards' THEN
    SELECT * INTO s FROM public.competition_submissions WHERE id=NEW.submission_id;
    SELECT * INTO r FROM public.rounds WHERE id=s.round_id;
    SELECT v.difficulty,v.base_bounty INTO b FROM public.bounties bb JOIN public.validation_snapshots v ON v.id=bb.snapshot_id WHERE bb.id=s.bounty_id;
    IF NEW.team_round_id<>s.team_round_id OR NEW.bounty_id<>s.bounty_id OR NEW.round_kind<>r.kind OR NEW.base_bounty<>b.base_bounty
      OR NEW.points<>(b.base_bounty/10)*(CASE WHEN r.kind=1 OR s.hint_tier=0 THEN 10 WHEN s.hint_tier=1 THEN 9 WHEN s.hint_tier=2 THEN 7 ELSE 5 END)
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
