-- Preserve existing receipt, clock, judging and economic guards while applying admitted item effects.
CREATE FUNCTION shop_priority_conflict(submission uuid) RETURNS boolean LANGUAGE sql STABLE SET search_path=pg_catalog,public AS $$
  SELECT EXISTS(SELECT 1 FROM public.competition_submissions s JOIN public.rounds r ON r.id=s.round_id
    JOIN public.competition_submissions earlier ON earlier.bounty_id=s.bounty_id AND earlier.receipt_order<s.receipt_order
    LEFT JOIN public.competition_assessments a ON a.submission_id=earlier.id
    LEFT JOIN public.shop_submission_effects effect ON effect.submission_id=s.id
    LEFT JOIN public.shop_submission_effects prior ON prior.submission_id=earlier.id
    WHERE s.id=submission AND (a.verdict IS NULL OR a.verdict='PASSED') AND
      (CASE WHEN r.kind=1 THEN earlier.team_round_id=s.team_round_id
        WHEN effect.protection_id IS NOT NULL THEN earlier.team_round_id=s.team_round_id AND prior.protection_id IS NOT NULL
        ELSE prior.protection_id IS NULL END));
$$;

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
    IF action='HINT' AND public.shop_frozen(m.team_round_id,n) THEN result=jsonb_build_object('status','REJECTED','reason','CREDIT_FROZEN');
    ELSIF public.competition_bounty_unavailable(target,m.team_round_id,n) THEN result=jsonb_build_object('status','REJECTED','reason','BOUNTY_UNAVAILABLE');
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
            INSERT INTO public.wallet_entries(id,team_round_id,amount,award_id,purchase_id,carryover_id,recorded_at) VALUES(gen_random_uuid(),m.team_round_id,-price,NULL,owned,NULL,n);
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
          sub=gen_random_uuid(); tier=greatest(tier,public.shop_assistance(m.team_round_id,target));
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
CREATE OR REPLACE FUNCTION competition_participant_command(sid uuid,subject uuid,request uuid,action text,p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE r public.rounds%ROWTYPE; session public.participant_sessions%ROWTYPE; m public.member_rounds%ROWTYPE;
  n timestamptz; fp bytea; old jsonb; answer jsonb; source uuid=gen_random_uuid(); run uuid=gen_random_uuid(); target uuid; code bytea;
BEGIN
  IF action<>'RUN' THEN RETURN public.competition_original_participant_command(sid,subject,request,action,p); END IF;
  PERFORM id FROM public.security_control WHERE id=1 FOR SHARE;
  SELECT * INTO r FROM public.rounds WHERE id=subject FOR UPDATE; n=public.competition_now(subject);
  SELECT s.* INTO session FROM public.participant_sessions s JOIN public.member_session_slots slot ON slot.member_id=s.member_id AND slot.session_id=s.id
    JOIN public.access_credentials c ON c.id=s.credential_id AND c.version=s.credential_version AND c.team_id=s.team_id
    WHERE s.id=sid AND s.round_id=subject AND s.revoked_at IS NULL AND c.revoked_at IS NULL AND c.issued_at<=n
      AND n>=s.last_activity_at AND n<s.absolute_expires_at AND n<s.last_activity_at+interval '2 hours'
      AND NOT EXISTS(SELECT 1 FROM public.access_blocks WHERE arena_instance_id=r.arena_instance_id AND cleared_at IS NULL AND (team_id=s.team_id OR member_id=s.member_id));
  IF session.id IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Current participant authority required'; END IF;
  SELECT * INTO m FROM public.member_rounds WHERE id=session.member_round_id;
  IF p IS NULL OR jsonb_typeof(p)<>'object' OR octet_length(p::text)>180000 OR (SELECT count(*) FROM jsonb_object_keys(p))<>2 THEN RAISE EXCEPTION 'Invalid sample request'; END IF;
  target=(p->>'bounty_id')::uuid; code=decode(p->>'source_b64','base64');
  IF NOT EXISTS(SELECT 1 FROM public.bounties WHERE id=target AND round_id=subject) OR code IS NULL OR octet_length(code) NOT BETWEEN 1 AND 131072 THEN RAISE EXCEPTION 'Invalid sample source or bounty'; END IF;
  fp=public.competition_fingerprint(action,p,0,'PARTICIPANT'); old=public.competition_old_receipt(subject,m.id,request,fp); IF old IS NOT NULL THEN RETURN old; END IF;
  PERFORM public.competition_close_due(subject,n); SELECT * INTO r FROM public.rounds WHERE id=subject;
  answer=jsonb_build_object('status','REJECTED','reason','ROUND_UNAVAILABLE');
  IF r.state='RUNNING' AND n<r.closes_at AND EXISTS(SELECT 1 FROM public.arena_control WHERE id=1 AND current_instance_id=r.arena_instance_id)
    AND NOT public.competition_paused(subject,m.team_round_id,m.id) THEN
    IF public.competition_bounty_unavailable(target,m.team_round_id,n) THEN answer=jsonb_build_object('status','REJECTED','reason','BOUNTY_UNAVAILABLE');
    ELSE
      PERFORM id FROM public.judge_control WHERE id=1 FOR UPDATE;
      -- Expiry releases only logical sample allowances; an unknown physical attempt still occupies its slot.
      UPDATE public.participant_judging SET status='COMPLETED',result='INFRA_ERROR',completed_at=n
        WHERE lane='SAMPLE' AND member_round_id=m.id AND completed_at IS NULL AND n>=created_at+interval '120 seconds';
      PERFORM public.participant_rebudget(id) FROM public.participant_judging WHERE member_round_id=m.id AND lane='SAMPLE' AND completed_at=n;
      IF (SELECT count(*) FROM public.participant_judging WHERE member_round_id=m.id AND lane='SAMPLE' AND completed_at IS NULL)>=2 THEN
        RAISE EXCEPTION USING ERRCODE='54000',MESSAGE='Two unfinished sample Runs already admitted'; END IF;
      PERFORM public.participant_plan(run,NULL,source,'SAMPLE',subject,m.team_round_id,m.id,target,code,m.language,n);
      answer=jsonb_build_object('status','ADMITTED','run_id',run);
    END IF;
  END IF;
  old=public.competition_receipt(source,subject,sid,m.id,request,action,fp,'PARTICIPANT',answer,n,false);
  IF answer->>'status'='ADMITTED' THEN UPDATE public.participant_sessions SET last_activity_at=n WHERE id=sid; END IF;
  RETURN old;
END $$;
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
      IF r.kind=2 AND NOT EXISTS(SELECT 1 FROM public.shop_submission_effects WHERE submission_id=a.id AND shield_id IS NOT NULL) AND NOT EXISTS(SELECT 1 FROM public.wrong_submission_penalties WHERE submission_id=a.id) THEN
        INSERT INTO public.wrong_submission_penalties VALUES(a.id,a.team_round_id,300000,n);
        PERFORM public.competition_event(subject,a.team_round_id,'PENALTY_APPLIED',a.id,n);
      END IF;
      CONTINUE;
    END IF;
    IF EXISTS(SELECT 1 FROM public.bounty_awards WHERE bounty_id=a.bounty_id AND team_round_id=a.team_round_id) THEN CONTINUE; END IF;
    IF r.kind=2 AND NOT EXISTS(SELECT 1 FROM public.shop_submission_effects WHERE submission_id=a.id AND protection_id IS NOT NULL)
      AND EXISTS(SELECT 1 FROM public.bounty_awards WHERE bounty_id=a.bounty_id AND NOT protected) THEN CONTINUE; END IF;
    IF public.shop_priority_conflict(a.id) THEN CONTINUE; END IF;
    aid=gen_random_uuid(); cash=a.base_bounty;
    score=(a.base_bounty/10)*CASE WHEN r.kind=1 THEN 10 WHEN a.hint_tier=0 THEN 10 WHEN a.hint_tier=1 THEN 9 WHEN a.hint_tier=2 THEN 7 ELSE 5 END;
    INSERT INTO public.bounty_awards VALUES(aid,a.id,a.team_round_id,a.bounty_id,r.kind,cash,score,n,EXISTS(SELECT 1 FROM public.shop_submission_effects WHERE submission_id=a.id AND protection_id IS NOT NULL));
    INSERT INTO public.wallet_entries(id,team_round_id,amount,award_id,purchase_id,carryover_id,recorded_at) VALUES(gen_random_uuid(),a.team_round_id,cash,aid,NULL,NULL,n);
    PERFORM public.competition_event(subject,CASE WHEN r.kind=1 OR EXISTS(SELECT 1 FROM public.shop_submission_effects WHERE submission_id=a.id AND protection_id IS NOT NULL) THEN a.team_round_id END,'BOUNTY_AWARDED',aid,n);
  END LOOP;
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
      OR NEW.protected<>EXISTS(SELECT 1 FROM public.shop_submission_effects WHERE submission_id=s.id AND protection_id IS NOT NULL)
      OR public.shop_priority_conflict(s.id)
      OR NOT EXISTS(SELECT 1 FROM public.wallet_entries WHERE award_id=NEW.id AND team_round_id=s.team_round_id AND amount=NEW.base_bounty) THEN RAISE EXCEPTION 'Award requires earliest correct source and full credit'; END IF;
  ELSIF TG_TABLE_NAME='wrong_submission_penalties' THEN
    IF NOT EXISTS(SELECT 1 FROM public.competition_submissions sub JOIN public.rounds stage ON stage.id=sub.round_id JOIN public.competition_assessments a ON a.submission_id=sub.id
      WHERE sub.id=NEW.submission_id AND sub.team_round_id=NEW.team_round_id AND stage.kind=2 AND a.verdict<>'PASSED'
      AND NOT EXISTS(SELECT 1 FROM public.shop_submission_effects WHERE submission_id=sub.id AND shield_id IS NOT NULL)) THEN RAISE EXCEPTION 'Wrong penalty requires reliable incorrect R2 official'; END IF;
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
--> statement-breakpoint
CREATE OR REPLACE FUNCTION workbench_save(sid uuid,stage uuid,target uuid,request uuid,base bigint,code bytea) RETURNS draft_save_outcomes
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE s participant_sessions%ROWTYPE; r rounds%ROWTYPE; d code_drafts%ROWTYPE; o draft_save_outcomes%ROWTYPE; m member_rounds%ROWTYPE;
  n timestamptz; fp bytea; reason text; result_kind text; next_revision bigint; source uuid:=gen_random_uuid();
BEGIN
  s:=workbench_authority(sid,stage,target);SELECT * INTO m FROM member_rounds WHERE id=s.member_round_id;
  IF request IS NULL OR base IS NULL OR base NOT BETWEEN 0 AND 9223372036854775805 OR code IS NULL OR octet_length(code)>1048576 THEN RAISE EXCEPTION 'Invalid draft request' USING ERRCODE='22023'; END IF;
  fp:=workbench_fingerprint(stage,m.id,target,base,code);
  SELECT * INTO o FROM draft_save_outcomes WHERE member_round_id=m.id AND bounty_id=target AND request_key=request;
  IF FOUND THEN
    IF o.request_fingerprint<>fp THEN RAISE EXCEPTION 'Draft intent key reused' USING ERRCODE='P0002'; END IF;
    RETURN o;
  END IF;
  n:=competition_now(stage);PERFORM competition_close_due(stage,n);SELECT * INTO r FROM rounds WHERE id=stage;
  IF octet_length(code)>131072 THEN reason:='DRAFT_TOO_LARGE';
  ELSIF r.state NOT IN ('RUNNING','PAUSED') OR n>=r.closes_at OR NOT EXISTS(SELECT 1 FROM arena_control c JOIN arena_instances a ON a.id=c.current_instance_id WHERE c.id=1 AND a.id=r.arena_instance_id AND a.status='IN_PROGRESS') THEN reason:='ROUND_NOT_WRITABLE';
  ELSIF competition_paused(stage,m.team_round_id,m.id) THEN reason:='PAUSED';
  ELSIF public.competition_bounty_unavailable(target,m.team_round_id,n) THEN reason:='BOUNTY_UNAVAILABLE'; END IF;
  SELECT * INTO d FROM code_drafts WHERE member_round_id=m.id AND bounty_id=target FOR UPDATE;
  IF reason IS NOT NULL THEN result_kind:='REJECTED';
  ELSIF base<>COALESCE(d.revision,0) THEN result_kind:='CONFLICT';reason:='REVISION_MISMATCH';
  ELSIF d.id IS NOT NULL AND d.source_code=code THEN result_kind:='UNCHANGED';next_revision:=d.revision;
  ELSE
    result_kind:='SAVED';next_revision:=base+1;
    IF d.id IS NULL THEN INSERT INTO code_drafts(member_round_id,bounty_id,round_id,source_code,revision,created_at,updated_at) VALUES(m.id,target,stage,code,next_revision,n,n);
    ELSE UPDATE code_drafts SET source_code=code,revision=next_revision,updated_at=n WHERE id=d.id; END IF;
  END IF;
  INSERT INTO draft_save_outcomes(id,member_round_id,bounty_id,round_id,request_key,request_fingerprint,base_revision,outcome,reason_code,result_revision,recorded_at)
    VALUES(source,m.id,target,stage,request,fp,base,result_kind,reason,next_revision,n) RETURNING * INTO o;
  IF result_kind='SAVED' THEN
    INSERT INTO workbench_activities(session_id,member_round_id,bounty_id,draft_outcome_id,recorded_at) VALUES(sid,m.id,target,source,n);
    UPDATE participant_sessions SET last_activity_at=n WHERE id=sid;
  END IF;
  RETURN o;
END $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION shop_priority_conflict(uuid) FROM PUBLIC,ingenium_api,ingenium_competition_worker;
