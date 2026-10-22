-- Competition operations are source-linked transactions, not direct API table writes.
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='ingenium_competition_worker') THEN CREATE ROLE ingenium_competition_worker NOLOGIN; END IF;
END $$;
ALTER TABLE competition_pauses ALTER CONSTRAINT competition_pauses_source_id_competition_outcomes_id_fk DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE competition_pauses ALTER CONSTRAINT competition_pauses_end_source_id_competition_outcomes_id_fk DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE competition_submissions ALTER CONSTRAINT competition_submissions_source_id_competition_outcomes_id_fk DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE hint_purchases ALTER CONSTRAINT hint_purchases_source_id_competition_outcomes_id_fk DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE qualification_decisions ALTER CONSTRAINT qualification_decisions_source_id_competition_outcomes_id_fk DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX competition_submission_race ON competition_submissions(bounty_id,receipt_order);
CREATE INDEX competition_submission_team ON competition_submissions(team_round_id,bounty_id,receipt_order);
CREATE INDEX competition_wallet_team ON wallet_entries(team_round_id);
--> statement-breakpoint
CREATE FUNCTION competition_now(subject uuid) RETURNS timestamptz LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE n timestamptz; old_time timestamptz;
BEGIN
  SELECT trusted_time_at INTO old_time FROM public.rounds WHERE id=subject FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Round unavailable'; END IF;
  n=date_trunc('milliseconds',clock_timestamp());
  IF n<old_time THEN RAISE EXCEPTION 'Round clock reversed'; END IF;
  UPDATE public.rounds SET trusted_time_at=n WHERE id=subject;
  RETURN n;
END $$;
CREATE FUNCTION competition_fingerprint(action text,payload jsonb,revision bigint,reason text) RETURNS bytea LANGUAGE sql IMMUTABLE AS $$
  SELECT sha256(convert_to(jsonb_build_array(action,payload,revision,reason)::text,'UTF8'));
$$;
CREATE FUNCTION competition_receipt(source uuid,subject uuid,sid uuid,actor uuid,request uuid,kind text,fp bytea,reason text,result jsonb,n timestamptz,staff boolean)
RETURNS jsonb LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF staff AND ((SELECT count(*) FROM public.competition_outcomes WHERE staff_session_id IS NOT NULL)+(SELECT count(*) FROM public.competition_publications)
    +(SELECT count(*) FROM public.staff_entry_outcomes)+(SELECT count(*) FROM public.staff_keep_alive_outcomes)+(SELECT count(*) FROM public.clock_clearances)
    +(SELECT count(*) FROM public.staff_management_outcomes)+(SELECT count(*) FROM public.replacement_decisions)+(SELECT count(*) FROM public.arena_setup_outcomes)
    +(SELECT count(*) FROM public.content_outcomes)+(SELECT count(*) FROM public.content_read_audits)+(SELECT count(*) FROM public.validation_preparation_outcomes)
    +(SELECT count(*) FROM public.validation_snapshot_audits)+(SELECT count(*) FROM public.validation_run_outcomes)+(SELECT count(*) FROM public.validation_run_audits))>=100000 THEN RAISE EXCEPTION 'Staff audit capacity'; END IF;
  IF NOT staff AND ((SELECT count(*) FROM public.competition_outcomes WHERE participant_session_id IS NOT NULL)
    +(SELECT count(*) FROM public.entry_outcomes)+(SELECT count(*) FROM public.participant_session_outcomes))>=4000000 THEN RAISE EXCEPTION 'Competition outcome capacity'; END IF;
  INSERT INTO public.competition_outcomes VALUES(source,subject,CASE WHEN staff THEN sid END,CASE WHEN NOT staff THEN sid END,actor,request,kind,fp,reason,result,n);
  RETURN jsonb_build_object('outcome_id',source,'round_id',subject,'request_key',request,'action',kind,'recorded_at',n,'result',result);
END $$;
CREATE FUNCTION competition_old_receipt(subject uuid,actor uuid,request uuid,fp bytea) RETURNS jsonb LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE o public.competition_outcomes%ROWTYPE;
BEGIN
  SELECT * INTO o FROM public.competition_outcomes WHERE round_id=subject AND actor_id=actor AND request_key=request;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF o.fingerprint<>fp THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='Intent key reused'; END IF;
  RETURN jsonb_build_object('outcome_id',o.id,'round_id',subject,'request_key',request,'action',o.action,'recorded_at',o.recorded_at,'result',o.result);
END $$;
CREATE FUNCTION competition_event(subject uuid,team uuid,kind text,reference uuid,n timestamptz) RETURNS void LANGUAGE sql SET search_path=pg_catalog,public AS $$
  INSERT INTO public.competition_events(round_id,team_round_id,kind,reference_id,created_at) VALUES(subject,team,kind,reference,n);
$$;
CREATE FUNCTION competition_config_digest(subject uuid) RETURNS bytea LANGUAGE sql STABLE SET search_path=pg_catalog,public AS $$
  SELECT sha256(convert_to(jsonb_build_array('ingenium-competition-v1',r.id,r.kind,r.duration_ms,r.configuration_revision,
    (SELECT jsonb_agg(jsonb_build_array(team_id,team_round_id) ORDER BY team_id) FROM public.competition_rosters WHERE round_id=r.id),
    (SELECT jsonb_agg(jsonb_build_array(b.id,b.snapshot_id,encode(s.fingerprint,'hex'),s.difficulty,s.base_bounty) ORDER BY b.position)
      FROM public.bounties b JOIN public.validation_snapshots s ON s.id=b.snapshot_id WHERE b.round_id=r.id))::text,'UTF8'))
    FROM public.rounds r WHERE r.id=subject;
$$;
CREATE FUNCTION competition_balance(team uuid) RETURNS bigint LANGUAGE sql STABLE SET search_path=pg_catalog,public AS $$
  SELECT COALESCE(sum(amount),0)::bigint FROM public.wallet_entries WHERE team_round_id=team;
$$;
CREATE FUNCTION competition_standings(subject uuid) RETURNS jsonb LANGUAGE sql STABLE SET search_path=pg_catalog,public AS $$
  WITH totals AS (
    SELECT t.id AS team_round_id,t.team_id,t.display_name AS team_name,public.competition_balance(t.id) AS wallet,
      COALESCE((SELECT sum(points) FROM public.bounty_awards WHERE team_round_id=t.id),0)
        -CASE WHEN r.kind=1 THEN COALESCE((SELECT sum(price) FROM public.hint_purchases WHERE team_round_id=t.id),0) ELSE 0 END AS points,
      COALESCE((SELECT sum(s.elapsed_ms) FROM public.bounty_awards a JOIN public.competition_submissions s ON s.id=a.submission_id WHERE a.team_round_id=t.id),0)::bigint AS solve_time_ms,
      COALESCE((SELECT sum(milliseconds) FROM public.wrong_submission_penalties WHERE team_round_id=t.id),0)::bigint AS penalty_ms,
      COALESCE((SELECT array_agg(v.difficulty ORDER BY v.difficulty DESC) FROM public.bounty_awards a JOIN public.bounties b ON b.id=a.bounty_id
        JOIN public.validation_snapshots v ON v.id=b.snapshot_id WHERE a.team_round_id=t.id),'{}'::integer[]) AS difficulties
    FROM public.team_rounds t JOIN public.rounds r ON r.id=t.round_id WHERE t.round_id=subject
  ), positions AS (SELECT *,solve_time_ms+penalty_ms AS effective_time_ms,
    rank() OVER(ORDER BY points DESC,solve_time_ms+penalty_ms,difficulties DESC) AS rank FROM totals)
  SELECT COALESCE(jsonb_agg(to_jsonb(p) ORDER BY rank,team_round_id),'[]'::jsonb) FROM positions p;
$$;
CREATE FUNCTION competition_paused(subject uuid,team uuid,member uuid) RETURNS boolean LANGUAGE sql STABLE SET search_path=pg_catalog,public AS $$
  SELECT EXISTS(SELECT 1 FROM public.competition_pauses WHERE round_id=subject AND ended_at IS NULL
    AND (scope='GLOBAL' OR team_round_id=team OR member_round_id=member));
$$;
CREATE FUNCTION competition_elapsed(subject uuid,team uuid,member uuid,receipt timestamptz) RETURNS bigint LANGUAGE sql STABLE SET search_path=pg_catalog,public AS $$
  WITH spans AS (SELECT range_agg(tstzrange(greatest(p.started_at,r.started_at),least(COALESCE(p.ended_at,receipt),receipt),'[)')) AS ranges
    FROM public.competition_pauses p JOIN public.rounds r ON r.id=p.round_id
    WHERE p.round_id=subject AND p.started_at<receipt AND (p.ended_at IS NULL OR p.ended_at>r.started_at)
      AND (p.scope='GLOBAL' OR p.team_round_id=team)),
    discount AS (SELECT COALESCE(sum(extract(epoch FROM upper(span)-lower(span))*1000),0) AS ms FROM spans,unnest(ranges) span)
  SELECT (extract(epoch FROM receipt-r.started_at)*1000-discount.ms)::bigint FROM public.rounds r CROSS JOIN discount WHERE r.id=subject;
$$;
--> statement-breakpoint
CREATE FUNCTION competition_settle(subject uuid,n timestamptz) RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE r public.rounds%ROWTYPE; a record; sid uuid; aid uuid; cash integer; score integer;
BEGIN
  SELECT * INTO r FROM public.rounds WHERE id=subject FOR UPDATE;
  IF r.state NOT IN ('RUNNING','CLOSING') THEN RETURN; END IF;
  FOR a IN SELECT s.*,x.verdict,v.difficulty FROM public.competition_submissions s
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
    aid=gen_random_uuid(); cash=10*a.difficulty;
    score=a.difficulty*CASE WHEN r.kind=1 THEN 10 WHEN a.hint_tier=0 THEN 10 WHEN a.hint_tier=1 THEN 9 WHEN a.hint_tier=2 THEN 7 ELSE 5 END;
    INSERT INTO public.bounty_awards VALUES(aid,a.id,a.team_round_id,a.bounty_id,r.kind,cash,score,n);
    INSERT INTO public.wallet_entries VALUES(gen_random_uuid(),a.team_round_id,cash,aid,NULL,NULL,n);
    PERFORM public.competition_event(subject,CASE WHEN r.kind=1 THEN a.team_round_id END,'BOUNTY_AWARDED',aid,n);
  END LOOP;
END $$;
--> statement-breakpoint
CREATE FUNCTION competition_draw_commitment(p jsonb) RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog,public AS $$
DECLARE encoded text;
BEGIN
  IF jsonb_typeof(p)<>'object' OR (SELECT count(*) FROM jsonb_object_keys(p))<>5 OR (p->>'version')<>'1'
    OR (p->>'salt') !~ '^[0-9a-f]{64}$' OR jsonb_typeof(p->'roster') IS DISTINCT FROM 'array' OR jsonb_typeof(p->'permutation') IS DISTINCT FROM 'array'
    OR jsonb_array_length(p->'roster') NOT BETWEEN 1 AND 100 OR jsonb_array_length(p->'permutation')<>jsonb_array_length(p->'roster') THEN RAISE EXCEPTION 'Invalid draw'; END IF;
  encoded='{"version":1,"round_id":'||to_json((p->>'round_id')::uuid)::text||',"roster":'||replace((p->'roster')::text,', ',',')||',"permutation":'||replace((p->'permutation')::text,', ',',')||',"salt":'||to_json(p->>'salt')::text||'}';
  RETURN encode(sha256(convert_to(encoded,'UTF8')),'hex');
END $$;
CREATE FUNCTION competition_qualifiers(standings jsonb,p jsonb) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog,public AS $$
DECLARE answer jsonb;
BEGIN
  IF (SELECT count(DISTINCT v) FROM jsonb_array_elements_text(p->'roster') v)<>jsonb_array_length(standings)
    OR (SELECT count(DISTINCT v) FROM jsonb_array_elements_text(p->'permutation') v)<>jsonb_array_length(standings)
    OR EXISTS((SELECT value FROM jsonb_array_elements_text(p->'roster') EXCEPT SELECT x->>'team_round_id' FROM jsonb_array_elements(standings) x)
      UNION ALL (SELECT value FROM jsonb_array_elements_text(p->'permutation') EXCEPT SELECT x->>'team_round_id' FROM jsonb_array_elements(standings) x)) THEN RAISE EXCEPTION 'Draw roster mismatch'; END IF;
  SELECT jsonb_agg(team ORDER BY ranking,ordinal) INTO answer FROM (
    SELECT s->>'team_round_id' AS team,(s->>'rank')::integer AS ranking,d.ordinal
      FROM jsonb_array_elements(standings) s JOIN jsonb_array_elements_text(p->'permutation') WITH ORDINALITY d(team,ordinal) ON d.team=s->>'team_round_id'
      ORDER BY ranking,ordinal LIMIT 50) chosen;
  RETURN answer;
END $$;
--> statement-breakpoint
CREATE FUNCTION competition_participant_command(sid uuid,subject uuid,request uuid,action text,p jsonb) RETURNS jsonb
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
  SELECT bb.*,s.difficulty INTO b FROM public.bounties bb JOIN public.validation_snapshots s ON s.id=bb.snapshot_id WHERE bb.id=target AND bb.round_id=subject;
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
          price=b.difficulty*CASE WHEN tier=0 THEN 1 WHEN tier=1 THEN 3 WHEN r.kind=1 THEN 4 ELSE 8 END;
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
CREATE FUNCTION competition_assess(subject uuid,source_hash bytea,results jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE s public.competition_submissions%ROWTYPE; snapshot uuid; n timestamptz; digest bytea; final_verdict text; old public.competition_assessments%ROWTYPE;
BEGIN
  PERFORM id FROM public.security_control WHERE id=1 FOR SHARE;
  SELECT * INTO s FROM public.competition_submissions WHERE id=subject;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown official submission'; END IF;
  PERFORM id FROM public.rounds WHERE id=s.round_id FOR UPDATE;
  n=public.competition_now(s.round_id);
  IF source_hash IS DISTINCT FROM sha256(s.source) OR jsonb_typeof(results) IS DISTINCT FROM 'array' OR jsonb_array_length(results) NOT BETWEEN 2 AND 20 THEN RAISE EXCEPTION 'Unbound assessment'; END IF;
  SELECT snapshot_id INTO snapshot FROM public.bounties WHERE id=s.bounty_id;
  IF (SELECT count(DISTINCT (x->>'case_id')::uuid) FROM jsonb_array_elements(results) x)<>jsonb_array_length(results)
    OR EXISTS((SELECT case_id FROM public.validation_snapshot_cases WHERE snapshot_id=snapshot EXCEPT SELECT (x->>'case_id')::uuid FROM jsonb_array_elements(results) x)
      UNION ALL(SELECT (x->>'case_id')::uuid FROM jsonb_array_elements(results) x EXCEPT SELECT case_id FROM public.validation_snapshot_cases WHERE snapshot_id=snapshot))
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(results) x WHERE x->>'verdict' IS NULL OR x->>'verdict' NOT IN ('PASSED','WRONG_ANSWER','COMPILATION_ERROR','RUNTIME_ERROR','TIME_LIMIT_EXCEEDED','MEMORY_LIMIT_EXCEEDED','OUTPUT_LIMIT_EXCEEDED')
      OR x->>'evidence_digest' IS NULL OR x->>'evidence_digest' !~ '^[0-9a-f]{64}$' OR (SELECT count(*) FROM jsonb_object_keys(x))<>3) THEN RAISE EXCEPTION 'Exact reliable frozen case set required'; END IF;
  SELECT sha256(convert_to(jsonb_agg(x ORDER BY x->>'case_id')::text,'UTF8')) INTO digest FROM jsonb_array_elements(results) x;
  SELECT * INTO old FROM public.competition_assessments WHERE submission_id=subject;
  IF FOUND THEN IF old.evidence_digest<>digest THEN RAISE EXCEPTION 'Assessment is immutable'; END IF; RETURN jsonb_build_object('verdict',old.verdict); END IF;
  IF NOT EXISTS(SELECT 1 FROM public.rounds WHERE id=s.round_id AND state IN ('RUNNING','PAUSED','CLOSING')) THEN RAISE EXCEPTION 'Round cannot acquire an assessment'; END IF;
  SELECT x->>'verdict' INTO final_verdict FROM jsonb_array_elements(results) x JOIN public.validation_snapshot_cases c ON c.case_id=(x->>'case_id')::uuid AND c.snapshot_id=snapshot
    WHERE x->>'verdict'<>'PASSED' ORDER BY c.position LIMIT 1;
  final_verdict=COALESCE(final_verdict,'PASSED');
  INSERT INTO public.competition_case_results SELECT subject,(x->>'case_id')::uuid,x->>'verdict',decode(x->>'evidence_digest','hex'),n FROM jsonb_array_elements(results) x;
  INSERT INTO public.competition_assessments VALUES(subject,final_verdict,digest,n);
  PERFORM public.competition_event(s.round_id,s.team_round_id,'ASSESSMENT_RECORDED',subject,n);
  PERFORM public.competition_close_due(s.round_id,n); PERFORM public.competition_settle(s.round_id,n);
  RETURN jsonb_build_object('verdict',final_verdict);
END $$;
CREATE FUNCTION competition_close_due(subject uuid,n timestamptz) RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  UPDATE public.rounds SET state='CLOSING',revision=revision+1 WHERE id=subject AND state='RUNNING' AND n>=closes_at;
  IF FOUND THEN PERFORM public.competition_event(subject,NULL,'ROUND_CHANGED',subject,n); END IF;
END $$;
--> statement-breakpoint
CREATE FUNCTION competition_staff_command(sid uuid,subject uuid,request uuid,expected bigint,action text,p jsonb,reason text,own_verifier bytea)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE r public.rounds%ROWTYPE; actor uuid; role_name text; code bytea; n timestamptz; fp bytea; old jsonb; result jsonb; source uuid=gen_random_uuid();
  gate uuid; target uuid; tr uuid; mr uuid; scope_name text; paused public.competition_pauses%ROWTYPE; q record; stage uuid; count_teams integer; selected uuid[]; recorded jsonb;
BEGIN
  PERFORM id FROM public.security_control WHERE id=1 FOR UPDATE;
  SELECT current_instance_id INTO gate FROM public.arena_control WHERE id=1 FOR UPDATE;
  SELECT * INTO r FROM public.rounds WHERE id=subject FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Round unavailable'; END IF;
  n=public.competition_now(subject);
  SELECT s.staff_id,i.role,c.verifier INTO actor,role_name,code FROM public.staff_sessions s
    JOIN public.staff_session_slots z ON z.staff_id=s.staff_id AND z.session_id=s.id
    JOIN public.staff_identities i ON i.id=s.staff_id JOIN public.access_credentials c ON c.id=s.credential_id AND c.version=s.credential_version
    WHERE s.id=sid AND s.mode='NORMAL' AND s.revoked_at IS NULL AND i.disabled_at IS NULL AND c.revoked_at IS NULL
      AND n>=s.last_activity_at AND n<s.absolute_expires_at AND n<s.last_activity_at+interval '15 minutes';
  IF actor IS NULL OR role_name NOT IN ('OWNER','SUPER_ADMIN') THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Current owner authority required'; END IF;
  IF expected<0 OR reason IS NULL OR octet_length(reason) NOT BETWEEN 1 AND 1024 OR btrim(reason)='' OR p IS NULL OR jsonb_typeof(p)<>'object' OR octet_length(p::text)>32768 THEN RAISE EXCEPTION 'Invalid command'; END IF;
  IF action NOT IN ('CONFIGURE','READY','START','PAUSE','RESUME','CLOSE','FINALISE','QUALIFY','SETUP_R2','DISCARD') THEN RAISE EXCEPTION 'Unsupported competition command'; END IF;
  IF action IN ('START','PAUSE','RESUME','CLOSE','FINALISE','QUALIFY','DISCARD') AND own_verifier IS DISTINCT FROM code THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Own current staff code required'; END IF;
  fp=public.competition_fingerprint(action,CASE WHEN action IN ('START','QUALIFY') THEN '{}'::jsonb ELSE p END,expected,reason); old=public.competition_old_receipt(subject,actor,request,fp); IF old IS NOT NULL THEN RETURN old; END IF;
  PERFORM public.competition_close_due(subject,n); SELECT * INTO r FROM public.rounds WHERE id=subject;
  result=jsonb_build_object('status','APPLIED');
  IF gate IS DISTINCT FROM r.arena_instance_id THEN result=jsonb_build_object('status','REJECTED','reason','ARENA_UNAVAILABLE');
  ELSIF expected<>r.revision THEN result=jsonb_build_object('status','REJECTED','reason','STALE_VERSION'); END IF;
  IF result->>'status'='REJECTED' THEN RETURN public.competition_receipt(source,subject,sid,actor,request,action,fp,reason,result,n,true); END IF;
  IF action='CONFIGURE' THEN
    IF r.state NOT IN ('DRAFT','READY') OR EXISTS(SELECT 1 FROM public.team_rounds WHERE round_id=subject) THEN RAISE EXCEPTION 'Round not editable'; END IF;
    IF jsonb_typeof(p->'snapshots') IS DISTINCT FROM 'array' OR jsonb_array_length(p->'snapshots') NOT BETWEEN 1 AND 40
      OR (SELECT count(DISTINCT value::text) FROM jsonb_array_elements(p->'snapshots'))<>jsonb_array_length(p->'snapshots') THEN RAISE EXCEPTION 'Invalid bounty selection'; END IF;
    IF (SELECT count(*) FROM public.competition_publications pub JOIN public.validation_snapshots s ON s.id=pub.snapshot_id
        WHERE pub.snapshot_id IN(SELECT value::text::uuid FROM jsonb_array_elements_text(p->'snapshots')) AND s.round_type=r.kind)<>jsonb_array_length(p->'snapshots') THEN RAISE EXCEPTION 'Only matching published validated snapshots may be selected'; END IF;
    IF r.kind=1 THEN
      DELETE FROM public.competition_rosters WHERE round_id=subject;
      INSERT INTO public.competition_rosters SELECT subject,team_id,gen_random_uuid() FROM public.round_draft_teams WHERE round_id=subject;
    END IF;
    SELECT count(*) INTO count_teams FROM public.competition_rosters WHERE round_id=subject;
    IF count_teams NOT BETWEEN 1 AND (CASE WHEN r.kind=1 THEN 100 ELSE 50 END) THEN RAISE EXCEPTION 'Invalid roster'; END IF;
    DELETE FROM public.bounties WHERE round_id=subject;
    INSERT INTO public.bounties SELECT gen_random_uuid(),subject,s.definition_id,s.id,x.position::integer FROM jsonb_array_elements_text(p->'snapshots') WITH ORDINALITY x(id,position)
      JOIN public.validation_snapshots s ON s.id=x.id::uuid;
    INSERT INTO public.competition_configs(round_id,revision,next_receipt) VALUES(subject,1,0)
      ON CONFLICT(round_id) DO UPDATE SET revision=competition_configs.revision+1,ready_digest=NULL;
    UPDATE public.rounds SET state='DRAFT',revision=revision+1 WHERE id=subject;
  ELSIF action='READY' OR action='START' THEN
    IF r.state NOT IN ('DRAFT','READY') OR (action='START' AND r.state<>'READY') THEN RAISE EXCEPTION 'Round not ready for transition'; END IF;
    IF NOT EXISTS(SELECT 1 FROM public.bounties WHERE round_id=subject) OR NOT EXISTS(SELECT 1 FROM public.competition_rosters WHERE round_id=subject)
      OR EXISTS(SELECT 1 FROM public.competition_rosters t WHERE t.round_id=subject AND (SELECT count(*) FROM public.team_members WHERE team_id=t.team_id)<>2)
      OR (r.kind=1 AND EXISTS((SELECT team_id FROM public.round_draft_teams WHERE round_id=subject EXCEPT SELECT team_id FROM public.competition_rosters WHERE round_id=subject)
        UNION ALL (SELECT team_id FROM public.competition_rosters WHERE round_id=subject EXCEPT SELECT team_id FROM public.round_draft_teams WHERE round_id=subject))) THEN RAISE EXCEPTION 'Configuration requires review'; END IF;
    IF EXISTS(SELECT 1 FROM public.bounties b JOIN public.competition_publications pub ON pub.snapshot_id=b.snapshot_id JOIN public.validation_runs v ON v.id=pub.run_id
      JOIN public.validation_snapshots s ON s.id=b.snapshot_id WHERE b.round_id=subject AND (s.round_type<>r.kind OR v.status<>'PASSED')) THEN RAISE EXCEPTION 'Published evidence invalid'; END IF;
    IF action='READY' THEN
      UPDATE public.competition_configs SET ready_digest=public.competition_config_digest(subject) WHERE round_id=subject;
      UPDATE public.rounds SET state='READY',revision=revision+1 WHERE id=subject;
    ELSE
      IF NOT EXISTS(SELECT 1 FROM public.competition_configs WHERE round_id=subject AND ready_digest=public.competition_config_digest(subject)) THEN RAISE EXCEPTION 'Readiness is stale'; END IF;
      -- Only a separately installed current worker may make an arena startable.
      IF NOT EXISTS(SELECT 1 FROM public.judge_control c JOIN public.judge_host_epochs h ON h.id=c.host_epoch_id
        WHERE c.id=1 AND c.lease_until>n AND h.state='ACTIVE' AND c.active_validation_id IS NULL)
        OR EXISTS(SELECT 1 FROM public.execution_capacity_slots WHERE authoring_attempt_id IS NOT NULL) THEN RAISE EXCEPTION 'Judge unavailable or authoring not drained'; END IF;
      IF r.kind=1 AND (p->>'draw_ciphertext' IS NULL OR octet_length(p->>'draw_ciphertext') NOT BETWEEN 1 AND 16384 OR (p->>'draw_commitment') !~ '^[0-9a-f]{64}$') THEN RAISE EXCEPTION 'Committed encrypted draw required'; END IF;
      IF r.kind=2 AND NOT EXISTS(SELECT 1 FROM public.rounds one JOIN public.round_results rr ON rr.round_id=one.id
        JOIN public.qualification_decisions d ON d.result_id=rr.id WHERE one.arena_instance_id=r.arena_instance_id AND one.kind=1 AND one.state='CLOSED') THEN RAISE EXCEPTION 'Final R1 qualification required'; END IF;
      INSERT INTO public.team_rounds(id,team_id,round_id,display_name) SELECT x.team_round_id,t.id,subject,t.display_name FROM public.competition_rosters x JOIN public.teams t ON t.id=x.team_id WHERE x.round_id=subject;
      INSERT INTO public.member_rounds(id,team_round_id,team_id,member_id,round_id,display_name)
        SELECT gen_random_uuid(),x.team_round_id,x.team_id,m.id,subject,m.display_name FROM public.competition_rosters x JOIN public.team_members m ON m.team_id=x.team_id WHERE x.round_id=subject;
      IF r.kind=1 THEN UPDATE public.competition_configs SET draw_ciphertext=p->>'draw_ciphertext',draw_commitment=p->>'draw_commitment' WHERE round_id=subject;
      ELSE
        FOR q IN SELECT x.team_round_id,rr.id AS result_id,(v->>'team_round_id')::uuid AS source_team,(v->>'wallet')::integer AS amount
          FROM public.competition_rosters x JOIN public.rounds one ON one.arena_instance_id=r.arena_instance_id AND one.kind=1
          JOIN public.round_results rr ON rr.round_id=one.id JOIN public.qualification_decisions d ON d.result_id=rr.id
          CROSS JOIN LATERAL jsonb_array_elements(rr.standings) v WHERE x.round_id=subject AND (v->>'team_id')::uuid=x.team_id
            AND d.selected @> jsonb_build_array(v->>'team_round_id') LOOP
          INSERT INTO public.round_carryovers VALUES(q.team_round_id,q.result_id,q.source_team,q.amount);
          IF q.amount>0 THEN INSERT INTO public.wallet_entries VALUES(gen_random_uuid(),q.team_round_id,q.amount,NULL,NULL,q.team_round_id,n); END IF;
        END LOOP;
        IF (SELECT count(*) FROM public.round_carryovers WHERE team_round_id IN(SELECT team_round_id FROM public.competition_rosters WHERE round_id=subject))
          <>(SELECT count(*) FROM public.competition_rosters WHERE round_id=subject) THEN RAISE EXCEPTION 'Incomplete qualifier funding'; END IF;
      END IF;
      UPDATE public.rounds SET state='RUNNING',started_at=n,closes_at=n+duration_ms*interval '1 millisecond',revision=revision+1 WHERE id=subject;
      UPDATE public.arena_instances SET status='IN_PROGRESS',revision=revision+1 WHERE id=r.arena_instance_id;
    END IF;
  ELSIF action IN ('PAUSE','RESUME') THEN
    scope_name=p->>'scope'; target=(p->>'target')::uuid;
    IF scope_name NOT IN ('GLOBAL','TEAM','MEMBER') OR scope_name IS NULL OR ((scope_name='GLOBAL')<>(target IS NULL)) THEN RAISE EXCEPTION 'Invalid pause target'; END IF;
    IF scope_name='TEAM' THEN SELECT id INTO tr FROM public.team_rounds WHERE id=target AND round_id=subject; IF tr IS NULL THEN RAISE EXCEPTION 'Foreign team pause'; END IF; END IF;
    IF scope_name='MEMBER' THEN SELECT id INTO mr FROM public.member_rounds WHERE id=target AND round_id=subject; IF mr IS NULL THEN RAISE EXCEPTION 'Foreign member pause'; END IF; END IF;
    IF r.state NOT IN ('RUNNING','PAUSED') THEN RAISE EXCEPTION 'Round not active'; END IF;
    SELECT * INTO paused FROM public.competition_pauses WHERE round_id=subject AND scope=scope_name AND team_round_id IS NOT DISTINCT FROM tr AND member_round_id IS NOT DISTINCT FROM mr AND ended_at IS NULL;
    IF (action='PAUSE' AND paused.id IS NOT NULL) OR (action='RESUME' AND paused.id IS NULL) THEN result=jsonb_build_object('status','UNCHANGED');
    ELSIF action='PAUSE' THEN
      INSERT INTO public.competition_pauses VALUES(gen_random_uuid(),subject,scope_name,tr,mr,n,NULL,source,NULL);
      IF scope_name='GLOBAL' THEN UPDATE public.rounds SET state='PAUSED',revision=revision+1 WHERE id=subject; END IF;
    ELSE
      UPDATE public.competition_pauses SET ended_at=n,end_source_id=source WHERE id=paused.id;
      IF scope_name='GLOBAL' THEN UPDATE public.rounds SET state='RUNNING',closes_at=closes_at+(n-paused.started_at),revision=revision+1 WHERE id=subject; END IF;
      PERFORM public.competition_settle(subject,n);
    END IF;
    IF scope_name<>'GLOBAL' AND result->>'status'='APPLIED' THEN UPDATE public.rounds SET revision=revision+1 WHERE id=subject; END IF;
  ELSIF action='CLOSE' THEN
    IF r.state<>'RUNNING' OR n<=r.started_at THEN RAISE EXCEPTION 'Resume before manual close'; END IF;
    UPDATE public.rounds SET state='CLOSING',closes_at=n,revision=revision+1 WHERE id=subject;
    PERFORM public.competition_settle(subject,n);
  ELSIF action='FINALISE' THEN
    IF r.state<>'CLOSING' THEN RAISE EXCEPTION 'Round must be closing'; END IF;
    PERFORM public.competition_settle(subject,n);
    IF EXISTS(SELECT 1 FROM public.competition_submissions s LEFT JOIN public.competition_assessments a ON a.submission_id=s.id WHERE s.round_id=subject AND a.submission_id IS NULL) THEN RAISE EXCEPTION 'Earlier official work remains unresolved'; END IF;
    old=public.competition_standings(subject);
    INSERT INTO public.round_results VALUES(gen_random_uuid(),subject,1,old,sha256(convert_to(old::text,'UTF8')),public.competition_config_digest(subject),n);
    UPDATE public.rounds SET state='CLOSED',revision=revision+1 WHERE id=subject;
    IF r.kind=2 THEN
      UPDATE public.arena_instances SET status='COMPLETED',revision=revision+1 WHERE id=r.arena_instance_id;
      UPDATE public.arena_control SET current_instance_id=NULL,revision=revision+1 WHERE id=1;
    END IF;
    PERFORM public.competition_event(subject,NULL,'RESULT_FINALISED',subject,n);
  ELSIF action='QUALIFY' THEN
    IF r.kind<>1 OR r.state<>'CLOSED' THEN RAISE EXCEPTION 'Final R1 required'; END IF;
    SELECT * INTO q FROM public.round_results WHERE round_id=subject;
    IF EXISTS(SELECT 1 FROM public.qualification_decisions WHERE result_id=q.id) THEN result=jsonb_build_object('status','UNCHANGED');
    ELSE
      IF p->'reveal' IS NULL OR public.competition_draw_commitment(p->'reveal') IS DISTINCT FROM (SELECT draw_commitment FROM public.competition_configs WHERE round_id=subject)
        OR p->'reveal'->>'round_id'<>subject::text THEN RAISE EXCEPTION 'Draw reveal does not match precommitment'; END IF;
      old=public.competition_qualifiers(q.standings,p->'reveal');
      INSERT INTO public.qualification_decisions VALUES(q.id,old,p->'reveal',source);
      UPDATE public.competition_configs SET draw_reveal=p->'reveal' WHERE round_id=subject;
      UPDATE public.rounds SET revision=revision+1 WHERE id=subject;
      PERFORM public.competition_event(subject,NULL,'QUALIFICATION_LOCKED',q.id,n);
    END IF;
  ELSIF action='SETUP_R2' THEN
    IF r.kind<>1 OR r.state<>'CLOSED' THEN RAISE EXCEPTION 'R2 setup requires own final R1'; END IF;
    SELECT rr.id,d.selected,rr.standings INTO q FROM public.round_results rr JOIN public.qualification_decisions d ON d.result_id=rr.id WHERE rr.round_id=subject;
    IF NOT FOUND OR (p->>'duration_ms')::bigint NOT BETWEEN 1 AND 18000000 OR jsonb_array_length(p->'teams') NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'Locked qualification and valid R2 settings required'; END IF;
    SELECT array_agg(value::uuid) INTO selected FROM jsonb_array_elements_text(p->'teams');
    IF cardinality(selected)<>(SELECT count(DISTINCT x) FROM unnest(selected) x) OR EXISTS(SELECT 1 FROM unnest(selected) x WHERE NOT EXISTS(
      SELECT 1 FROM jsonb_array_elements(q.standings) v WHERE v->>'team_id'=x::text AND q.selected @> jsonb_build_array(v->>'team_round_id'))) THEN RAISE EXCEPTION 'Unqualified team'; END IF;
    SELECT id INTO stage FROM public.rounds WHERE arena_instance_id=r.arena_instance_id AND kind=2 FOR UPDATE;
    IF stage IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.rounds WHERE id=stage AND state IN ('DRAFT','READY')) THEN RAISE EXCEPTION 'Launched R2 cannot be configured'; END IF;
    IF stage IS NULL THEN
      stage=gen_random_uuid();
      INSERT INTO public.rounds(id,arena_instance_id,kind,state,duration_ms,revision,configuration_revision,trusted_time_at)
        VALUES(stage,r.arena_instance_id,2,'DRAFT',(p->>'duration_ms')::bigint,1,1,n);
    ELSE
      result=jsonb_build_object('status','APPLIED','round_id',stage,'duration_ms',(p->>'duration_ms')::bigint);
      recorded=public.competition_receipt(source,subject,sid,actor,request,action,fp,reason,result,n,true);
      UPDATE public.rounds SET state='DRAFT',duration_ms=(p->>'duration_ms')::bigint,configuration_revision=configuration_revision+1,revision=revision+1 WHERE id=stage;
      DELETE FROM public.competition_rosters WHERE round_id=stage;
      UPDATE public.competition_configs SET revision=revision+1,ready_digest=NULL WHERE round_id=stage;
    END IF;
    INSERT INTO public.competition_rosters SELECT stage,x,gen_random_uuid() FROM unnest(selected) x;
    result=jsonb_build_object('status','APPLIED','round_id',stage,'duration_ms',(p->>'duration_ms')::bigint);
    UPDATE public.rounds SET revision=revision+1 WHERE id=subject;
  ELSE
    IF NOT ((r.kind=1 AND r.state IN ('DRAFT','READY') AND NOT EXISTS(SELECT 1 FROM public.team_rounds WHERE round_id=subject))
      OR (r.kind=1 AND r.state='CLOSED' AND NOT EXISTS(SELECT 1 FROM public.rounds WHERE arena_instance_id=r.arena_instance_id AND kind=2 AND state NOT IN ('DRAFT','READY')))) THEN RAISE EXCEPTION 'Live instance cannot be discarded'; END IF;
    IF EXISTS(SELECT 1 FROM public.execution_capacity_slots WHERE authoring_attempt_id IS NOT NULL) THEN RAISE EXCEPTION 'Execution safety unresolved'; END IF;
    UPDATE public.arena_instances SET status='DISCARDED',revision=revision+1 WHERE id=r.arena_instance_id;
    UPDATE public.arena_control SET current_instance_id=NULL,revision=revision+1 WHERE id=1;
  END IF;
  IF result->>'status'='APPLIED' THEN
    UPDATE public.staff_sessions SET last_activity_at=n WHERE id=sid;
    PERFORM public.competition_event(subject,NULL,'ROUND_CHANGED',subject,n);
  END IF;
  IF recorded IS NOT NULL THEN RETURN recorded; END IF;
  RETURN public.competition_receipt(source,subject,sid,actor,request,action,fp,reason,result,n,true);
END $$;
