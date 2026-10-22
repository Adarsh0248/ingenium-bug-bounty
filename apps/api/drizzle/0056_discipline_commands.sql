-- Custom SQL migration file, put your code below! --
CREATE TRIGGER discipline_history_immutable BEFORE UPDATE OR DELETE ON discipline_outcomes
  FOR EACH ROW EXECUTE FUNCTION immutable_access_history();
REVOKE ALL ON discipline_outcomes FROM PUBLIC,ingenium_api;
GRANT SELECT ON discipline_outcomes TO ingenium_api;
--> statement-breakpoint
CREATE FUNCTION discipline_minutes(subject uuid) RETURNS bigint LANGUAGE sql STABLE SET search_path=pg_catalog,public AS $$
  SELECT COALESCE(sum(d.minutes),0)::bigint FROM public.discipline_outcomes d
    WHERE d.team_round_id=subject AND d.action='PENALISE' AND d.outcome='APPLIED'
      AND NOT EXISTS(SELECT 1 FROM public.discipline_outcomes u WHERE u.original_id=d.id AND u.action='REVERSE' AND u.outcome='APPLIED');
$$;
CREATE OR REPLACE FUNCTION competition_standings(subject uuid) RETURNS jsonb LANGUAGE sql STABLE SET search_path=pg_catalog,public AS $$
  WITH totals AS (
    SELECT t.id AS team_round_id,t.team_id,t.display_name AS team_name,public.competition_balance(t.id) AS wallet,
      COALESCE((SELECT sum(points) FROM public.bounty_awards WHERE team_round_id=t.id),0)
        -CASE WHEN r.kind=1 THEN COALESCE((SELECT sum(price) FROM public.hint_purchases WHERE team_round_id=t.id),0) ELSE 0 END AS points,
      COALESCE((SELECT sum(s.elapsed_ms) FROM public.bounty_awards a JOIN public.competition_submissions s ON s.id=a.submission_id WHERE a.team_round_id=t.id),0)::bigint AS solve_time_ms,
      (COALESCE((SELECT sum(milliseconds) FROM public.wrong_submission_penalties WHERE team_round_id=t.id),0)+60000*public.discipline_minutes(t.id))::bigint AS penalty_ms,
      COALESCE((SELECT array_agg(v.difficulty ORDER BY v.difficulty DESC) FROM public.bounty_awards a JOIN public.bounties b ON b.id=a.bounty_id
        JOIN public.validation_snapshots v ON v.id=b.snapshot_id WHERE a.team_round_id=t.id),'{}'::integer[]) AS difficulties
    FROM public.team_rounds t JOIN public.rounds r ON r.id=t.round_id WHERE t.round_id=subject
  ), positions AS (SELECT *,solve_time_ms+penalty_ms AS effective_time_ms,
    rank() OVER(ORDER BY points DESC,solve_time_ms+penalty_ms,difficulties DESC) AS rank FROM totals)
  SELECT COALESCE(jsonb_agg(to_jsonb(p) ORDER BY rank,team_round_id),'[]'::jsonb) FROM positions p;
$$;
--> statement-breakpoint
CREATE FUNCTION discipline_command(sid uuid,request uuid,operation text,arena uuid,team uuid,member uuid,stage uuid,
  block uuid,original uuid,amount integer,expected bigint,audit_reason text,own_verifier bytea)
RETURNS discipline_outcomes LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE actor uuid; credential uuid; credential_version bigint; code bytea; n timestamptz; observed bigint; gate uuid;
  old public.discipline_outcomes%ROWTYPE; source uuid=gen_random_uuid(); fp bytea; denial text;
  r public.rounds%ROWTYPE; b public.access_blocks%ROWTYPE; p public.discipline_outcomes%ROWTYPE; tr uuid; rr record;
BEGIN
  PERFORM id FROM public.security_control WHERE id=1 FOR UPDATE;
  SELECT current_instance_id INTO gate FROM public.arena_control WHERE id=1 FOR UPDATE;
  FOR rr IN SELECT id FROM public.rounds WHERE arena_instance_id=arena ORDER BY id FOR UPDATE LOOP
    PERFORM public.competition_now(rr.id);
  END LOOP;
  n=date_trunc('milliseconds',clock_timestamp());
  SELECT s.staff_id,s.credential_id,s.credential_version,c.verifier INTO actor,credential,credential_version,code
    FROM public.staff_sessions s JOIN public.staff_session_slots z ON z.staff_id=s.staff_id AND z.session_id=s.id
    JOIN public.staff_identities i ON i.id=s.staff_id JOIN public.access_credentials c ON c.id=s.credential_id AND c.version=s.credential_version AND c.staff_id=s.staff_id
    WHERE s.id=sid AND s.mode='NORMAL' AND s.revoked_at IS NULL AND i.role IN ('OWNER','SUPER_ADMIN') AND i.disabled_at IS NULL AND c.revoked_at IS NULL
      AND n>=s.created_at AND n>=s.last_activity_at AND c.issued_at<=n AND n<s.absolute_expires_at AND n<s.last_activity_at+interval '15 minutes';
  IF actor IS NULL OR own_verifier IS DISTINCT FROM code THEN RAISE EXCEPTION 'Current confirmed discipline authority required' USING ERRCODE='42501'; END IF;
  IF request IS NULL OR arena IS NULL OR team IS NULL OR operation IS NULL OR operation NOT IN ('BLOCK','UNBLOCK','PENALISE','REVERSE') OR expected IS NULL OR expected<0
    OR audit_reason IS NULL OR octet_length(audit_reason) NOT BETWEEN 1 AND 1024 OR btrim(audit_reason)=''
    OR (operation IN ('BLOCK','UNBLOCK') AND (stage IS NOT NULL OR original IS NOT NULL OR amount IS NOT NULL OR (operation='BLOCK' AND block IS NOT NULL) OR (operation='UNBLOCK' AND block IS NULL)))
    OR (operation IN ('PENALISE','REVERSE') AND (stage IS NULL OR member IS NOT NULL OR block IS NOT NULL
      OR (operation='PENALISE' AND (original IS NOT NULL OR amount IS NULL OR amount NOT BETWEEN 1 AND 300))
      OR (operation='REVERSE' AND (original IS NULL OR amount IS NOT NULL)))) THEN RAISE EXCEPTION 'Invalid discipline command' USING ERRCODE='22023'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.teams WHERE id=team) OR (member IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.team_members WHERE id=member AND team_id=team)) THEN
    RAISE EXCEPTION 'Target unavailable' USING ERRCODE='22023'; END IF;
  fp=sha256(convert_to(jsonb_build_array('DISCIPLINE_V1',operation,arena,team,member,stage,block,original,amount,expected::text,audit_reason)::text,'UTF8'));
  SELECT * INTO old FROM public.discipline_outcomes WHERE actor_id=actor AND request_key=request;
  IF FOUND THEN
    IF old.fingerprint<>fp THEN RAISE EXCEPTION 'Discipline intent changed' USING ERRCODE='P0002'; END IF;
    RETURN old;
  END IF;
  IF (SELECT count(*) FROM public.discipline_outcomes)>=100000 THEN RAISE EXCEPTION 'Discipline history capacity' USING ERRCODE='54000'; END IF;
  IF stage IS NOT NULL THEN
    PERFORM public.competition_close_due(stage,n);
    SELECT * INTO r FROM public.rounds WHERE id=stage AND arena_instance_id=arena;
    SELECT id INTO tr FROM public.team_rounds WHERE round_id=stage AND team_id=team FOR UPDATE;
    IF r.id IS NULL OR tr IS NULL THEN RAISE EXCEPTION 'Round target unavailable' USING ERRCODE='22023'; END IF;
    observed=r.revision;
    IF operation='REVERSE' THEN
      SELECT * INTO p FROM public.discipline_outcomes WHERE id=original AND action='PENALISE' AND outcome='APPLIED' AND team_round_id=tr AND arena_id=arena;
      IF NOT FOUND THEN RAISE EXCEPTION 'Penalty source unavailable' USING ERRCODE='22023'; END IF;
    END IF;
  ELSE
    SELECT revision INTO observed FROM public.security_control WHERE id=1;
    IF NOT EXISTS(SELECT 1 FROM public.rounds x JOIN public.round_draft_teams d ON d.round_id=x.id WHERE x.arena_instance_id=arena AND d.team_id=team)
      AND NOT EXISTS(SELECT 1 FROM public.rounds x JOIN public.competition_rosters d ON d.round_id=x.id WHERE x.arena_instance_id=arena AND d.team_id=team) THEN
      RAISE EXCEPTION 'Arena target unavailable' USING ERRCODE='22023'; END IF;
    IF operation='UNBLOCK' THEN
      SELECT * INTO b FROM public.access_blocks WHERE id=block AND arena_instance_id=arena
        AND ((member IS NULL AND team_id=team) OR (member IS NOT NULL AND member_id=member));
      IF NOT FOUND THEN RAISE EXCEPTION 'Block source unavailable' USING ERRCODE='22023'; END IF;
    END IF;
  END IF;
  IF gate IS DISTINCT FROM arena OR NOT EXISTS(SELECT 1 FROM public.arena_instances WHERE id=arena AND status IN ('SETUP','IN_PROGRESS')) THEN denial='ARENA_UNAVAILABLE';
  ELSIF observed<>expected THEN denial='STALE_VERSION';
  ELSIF stage IS NOT NULL AND (r.state NOT IN ('RUNNING','PAUSED','CLOSING') OR EXISTS(SELECT 1 FROM public.round_results WHERE round_id=stage)) THEN denial='ROUND_UNAVAILABLE';
  ELSIF operation='BLOCK' AND EXISTS(SELECT 1 FROM public.access_blocks WHERE arena_instance_id=arena AND cleared_at IS NULL
      AND ((member IS NULL AND team_id=team) OR (member IS NOT NULL AND member_id=member))) THEN denial='ALREADY_BLOCKED';
  ELSIF operation='UNBLOCK' AND b.cleared_at IS NOT NULL THEN denial='ALREADY_CLEARED';
  ELSIF operation='PENALISE' AND public.discipline_minutes(tr)+amount>300 THEN denial='PENALTY_CAP';
  ELSIF operation='REVERSE' AND EXISTS(SELECT 1 FROM public.discipline_outcomes WHERE original_id=original AND outcome='APPLIED') THEN denial='ALREADY_REVERSED'; END IF;
  IF denial IS NULL AND operation='BLOCK' THEN
    block=gen_random_uuid();
    INSERT INTO public.access_blocks(id,arena_instance_id,team_id,member_id,created_by,reason,created_at)
      VALUES(block,arena,CASE WHEN member IS NULL THEN team END,member,actor,audit_reason,n);
  END IF;
  INSERT INTO public.discipline_outcomes VALUES(source,actor,sid,credential,credential_version,request,operation,arena,team,member,stage,tr,block,original,amount,expected,fp,audit_reason,
    CASE WHEN denial IS NULL THEN 'APPLIED' ELSE 'REJECTED' END,denial,n) RETURNING * INTO old;
  IF denial IS NOT NULL THEN RETURN old; END IF;
  IF operation='BLOCK' THEN
    PERFORM member_id FROM public.member_session_slots WHERE member_id IN (SELECT id FROM public.team_members WHERE team_id=team AND (member IS NULL OR id=member)) ORDER BY member_id FOR UPDATE;
    UPDATE public.replacement_requests SET state='SUPERSEDED' WHERE team_id=team AND (member IS NULL OR member_id=member)
      AND round_id IN (SELECT id FROM public.rounds WHERE arena_instance_id=arena) AND state IN ('PENDING','APPROVED');
    UPDATE public.replacement_requests SET proof_ciphertext=NULL,proof_purged_at=n WHERE team_id=team AND (member IS NULL OR member_id=member)
      AND round_id IN (SELECT id FROM public.rounds WHERE arena_instance_id=arena) AND proof_ciphertext IS NOT NULL;
    UPDATE public.participant_sessions SET revoked_at=n,revocation_reason='ACCESS_BLOCKED' WHERE team_id=team AND (member IS NULL OR member_id=member)
      AND round_id IN (SELECT id FROM public.rounds WHERE arena_instance_id=arena) AND revoked_at IS NULL;
    UPDATE public.entry_flows f SET state='REVOKED' WHERE f.team_id=team AND f.round_id IN (SELECT id FROM public.rounds WHERE arena_instance_id=arena)
      AND f.state IN ('OPEN','ACTIVATED') AND (member IS NULL OR EXISTS(SELECT 1 FROM public.participant_sessions s WHERE s.id=f.activated_session_id AND s.member_id=member)
        OR EXISTS(SELECT 1 FROM public.replacement_requests q WHERE q.flow_id=f.id AND q.member_id=member));
    UPDATE public.member_session_slots z SET session_id=NULL,reservation_flow_id=NULL,revision=revision+1
      WHERE z.member_id IN (SELECT id FROM public.team_members WHERE team_id=team AND (member IS NULL OR id=member))
        AND (EXISTS(SELECT 1 FROM public.participant_sessions s JOIN public.rounds x ON x.id=s.round_id WHERE s.id=z.session_id AND x.arena_instance_id=arena)
          OR EXISTS(SELECT 1 FROM public.entry_flows f JOIN public.rounds x ON x.id=f.round_id WHERE f.id=z.reservation_flow_id AND x.arena_instance_id=arena));
    UPDATE public.session_deliveries d SET ciphertext=NULL,purged_at=n FROM public.participant_sessions s JOIN public.rounds x ON x.id=s.round_id
      WHERE s.id=d.session_id AND s.team_id=team AND (member IS NULL OR s.member_id=member) AND x.arena_instance_id=arena AND d.ciphertext IS NOT NULL;
  ELSIF operation='UNBLOCK' THEN
    UPDATE public.access_blocks SET cleared_at=n WHERE id=block;
  ELSE
    UPDATE public.rounds SET revision=revision+1 WHERE id=stage;
    -- A generic standings invalidation carries no disciplinary reason to participants.
    PERFORM public.competition_event(stage,tr,'ROUND_CHANGED',source,n);
  END IF;
  IF operation IN ('BLOCK','UNBLOCK') THEN UPDATE public.security_control SET revision=revision+1 WHERE id=1; END IF;
  UPDATE public.staff_sessions SET last_activity_at=n WHERE id=sid;
  RETURN old;
END $$;
--> statement-breakpoint
CREATE FUNCTION discipline_block_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF TG_OP='DELETE' OR (to_jsonb(NEW)-'cleared_at') IS DISTINCT FROM (to_jsonb(OLD)-'cleared_at')
    OR OLD.cleared_at IS NOT NULL OR NEW.cleared_at IS NULL OR (EXISTS(SELECT 1 FROM public.discipline_outcomes WHERE action='BLOCK' AND outcome='APPLIED' AND block_id=OLD.id)
      AND NOT EXISTS(SELECT 1 FROM public.discipline_outcomes
      WHERE action='UNBLOCK' AND outcome='APPLIED' AND block_id=OLD.id AND recorded_at=NEW.cleared_at
        AND xmin::text::bigint=(pg_current_xact_id()::text::bigint & 4294967295))) THEN RAISE EXCEPTION 'Block requires its once-only unblock source'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER discipline_block_once BEFORE UPDATE OR DELETE ON access_blocks FOR EACH ROW EXECUTE FUNCTION discipline_block_guard();
REVOKE ALL ON FUNCTION discipline_command(uuid,uuid,text,uuid,uuid,uuid,uuid,uuid,uuid,integer,bigint,text,bytea) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION discipline_command(uuid,uuid,text,uuid,uuid,uuid,uuid,uuid,uuid,integer,bigint,text,bytea),discipline_minutes(uuid) TO ingenium_api;
