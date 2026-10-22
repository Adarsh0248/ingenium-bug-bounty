CREATE TRIGGER team_management_immutable BEFORE UPDATE OR DELETE ON team_management_outcomes
  FOR EACH ROW EXECUTE FUNCTION immutable_access_history();
--> statement-breakpoint
CREATE FUNCTION manage_team_command(sid uuid,request uuid,operation text,target uuid,expected bigint,
  team_name text,member_one text,member_two text,audit_reason text,own_verifier bytea,new_verifier bytea)
RETURNS team_management_outcomes LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE actor uuid; credential uuid; credential_version bigint; code bytea; n timestamptz; observed bigint;
  old public.team_management_outcomes%ROWTYPE; fp bytea; denial text; subject uuid; issued uuid; next_version bigint;
BEGIN
  PERFORM id FROM public.security_control WHERE id=1 FOR UPDATE;
  n=date_trunc('milliseconds',clock_timestamp());
  SELECT s.staff_id,s.credential_id,s.credential_version,c.verifier INTO actor,credential,credential_version,code
    FROM public.staff_sessions s JOIN public.staff_session_slots z ON z.staff_id=s.staff_id AND z.session_id=s.id
    JOIN public.staff_identities i ON i.id=s.staff_id JOIN public.access_credentials c ON c.id=s.credential_id AND c.version=s.credential_version AND c.staff_id=s.staff_id
    WHERE s.id=sid AND s.mode='NORMAL' AND s.revoked_at IS NULL AND i.role IN ('OWNER','SUPER_ADMIN') AND i.disabled_at IS NULL AND c.revoked_at IS NULL
      AND n>=s.created_at AND n>=s.last_activity_at AND c.issued_at<=n AND n<s.absolute_expires_at AND n<s.last_activity_at+interval '15 minutes';
  IF actor IS NULL OR own_verifier IS DISTINCT FROM code THEN RAISE EXCEPTION 'Current confirmed registration authority required' USING ERRCODE='42501'; END IF;
  IF request IS NULL OR operation IS NULL OR operation NOT IN ('CREATE','ROTATE') OR expected IS NULL OR expected<0
    OR audit_reason IS NULL OR octet_length(audit_reason) NOT BETWEEN 1 AND 1024 OR btrim(audit_reason)=''
    OR new_verifier IS NULL OR octet_length(new_verifier)<>32
    OR (operation='CREATE' AND (target IS NOT NULL OR team_name IS NULL OR member_one IS NULL OR member_two IS NULL
      OR octet_length(team_name) NOT BETWEEN 1 AND 120 OR btrim(team_name)='' OR octet_length(member_one) NOT BETWEEN 1 AND 120
      OR btrim(member_one)='' OR octet_length(member_two) NOT BETWEEN 1 AND 120 OR btrim(member_two)=''))
    OR (operation='ROTATE' AND (target IS NULL OR num_nonnulls(team_name,member_one,member_two)<>0)) THEN
    RAISE EXCEPTION 'Invalid team command' USING ERRCODE='22023'; END IF;
  fp=sha256(convert_to(jsonb_build_array('TEAM_MANAGEMENT_V1',operation,target,expected::text,team_name,member_one,member_two,audit_reason)::text,'UTF8'));
  SELECT * INTO old FROM public.team_management_outcomes WHERE actor_id=actor AND request_key=request;
  IF FOUND THEN
    IF old.fingerprint<>fp THEN RAISE EXCEPTION 'Team intent changed' USING ERRCODE='P0002'; END IF;
    RETURN old;
  END IF;
  IF operation='CREATE' THEN
    SELECT revision INTO observed FROM public.security_control WHERE id=1;
  ELSE
    PERFORM id FROM public.teams WHERE id=target FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Team unavailable' USING ERRCODE='22023'; END IF;
    SELECT COALESCE(max(version),0) INTO observed FROM public.access_credentials WHERE team_id=target;
  END IF;
  IF observed<>expected THEN denial='STALE_VERSION';
  ELSIF operation='CREATE' AND (SELECT count(*) FROM public.teams)>=1000 THEN denial='TEAM_CAPACITY';
  ELSIF operation='ROTATE' AND (SELECT count(*) FROM public.team_members WHERE team_id=target)<>2 THEN denial='TEAM_INCOMPLETE'; END IF;
  IF (SELECT count(*) FROM public.team_management_outcomes)>=100000 THEN RAISE EXCEPTION 'Team history capacity' USING ERRCODE='54000'; END IF;
  IF denial IS NULL THEN
    subject=COALESCE(target,gen_random_uuid()); issued=gen_random_uuid();
    next_version=CASE WHEN operation='CREATE' THEN 1 ELSE observed+1 END;
    IF operation='CREATE' THEN
      INSERT INTO public.teams(id,display_name,created_at) VALUES(subject,team_name,n);
      INSERT INTO public.team_members(id,team_id,position,display_name,created_at)
        VALUES(gen_random_uuid(),subject,1,member_one,n),(gen_random_uuid(),subject,2,member_two,n);
    ELSE
      PERFORM member_id FROM public.member_session_slots WHERE member_id IN (SELECT id FROM public.team_members WHERE team_id=subject) ORDER BY member_id FOR UPDATE;
      UPDATE public.replacement_requests SET state='SUPERSEDED' WHERE team_id=subject AND state IN ('PENDING','APPROVED');
      UPDATE public.replacement_requests SET proof_ciphertext=NULL,proof_purged_at=n WHERE team_id=subject AND proof_ciphertext IS NOT NULL;
      UPDATE public.participant_sessions SET revoked_at=n,revocation_reason='CODE_ROTATED' WHERE team_id=subject AND revoked_at IS NULL;
      UPDATE public.member_session_slots SET session_id=NULL,reservation_flow_id=NULL,revision=revision+1
        WHERE member_id IN (SELECT id FROM public.team_members WHERE team_id=subject) AND (session_id IS NOT NULL OR reservation_flow_id IS NOT NULL);
      UPDATE public.entry_flows SET state='REVOKED' WHERE team_id=subject AND state IN ('OPEN','ACTIVATED');
      UPDATE public.session_deliveries d SET ciphertext=NULL,purged_at=n FROM public.participant_sessions s WHERE s.id=d.session_id AND s.team_id=subject AND d.ciphertext IS NOT NULL;
      UPDATE public.access_credentials SET revoked_at=n WHERE team_id=subject AND revoked_at IS NULL;
    END IF;
    INSERT INTO public.access_credentials(id,team_id,verifier,version,issued_at) VALUES(issued,subject,new_verifier,next_version,n);
    UPDATE public.security_control SET revision=revision+1 WHERE id=1;
  END IF;
  INSERT INTO public.team_management_outcomes VALUES(gen_random_uuid(),actor,sid,credential,credential_version,request,operation,target,expected,fp,audit_reason,
    CASE WHEN denial IS NULL THEN 'APPLIED' ELSE 'REJECTED' END,denial,subject,issued,next_version,n) RETURNING * INTO old;
  IF denial IS NULL THEN UPDATE public.staff_sessions SET last_activity_at=n WHERE id=sid; END IF;
  RETURN old;
END $$;
--> statement-breakpoint
REVOKE ALL ON team_management_outcomes FROM PUBLIC,ingenium_api;
GRANT SELECT ON team_management_outcomes TO ingenium_api;
REVOKE ALL ON FUNCTION manage_team_command(uuid,uuid,text,uuid,bigint,text,text,text,text,bytea,bytea) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION manage_team_command(uuid,uuid,text,uuid,bigint,text,text,text,text,bytea,bytea) TO ingenium_api;
