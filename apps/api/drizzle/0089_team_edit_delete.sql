ALTER TABLE public.teams ADD COLUMN deleted_at timestamptz(3);
--> statement-breakpoint
ALTER TABLE public.team_management_outcomes DROP CONSTRAINT team_management_shape;
ALTER TABLE public.team_management_outcomes ADD CONSTRAINT team_management_shape CHECK (
 expected_revision>=0 AND octet_length(fingerprint)=32 AND octet_length(reason) BETWEEN 1 AND 1024 AND btrim(reason)<>''
 AND ((action='CREATE' AND target_team_id IS NULL) OR (action IN ('ROTATE','ISSUE','REVOKE','EDIT','DELETE') AND target_team_id IS NOT NULL))
 AND ((outcome='APPLIED' AND denial_reason IS NULL AND result_team_id IS NOT NULL
   AND ((action IN ('EDIT','DELETE') AND result_credential_id IS NULL AND code_version IS NULL)
     OR (action IN ('CREATE','ROTATE','ISSUE','REVOKE') AND result_credential_id IS NOT NULL AND code_version>0)))
 OR (outcome='REJECTED' AND denial_reason IN ('STALE_VERSION','TEAM_CAPACITY','TEAM_INCOMPLETE','CODE_INACTIVE','CODE_ACTIVE','TEAM_DELETED','TEAM_IN_USE')
   AND result_team_id IS NULL AND result_credential_id IS NULL AND code_version IS NULL)));
--> statement-breakpoint
CREATE FUNCTION change_team_profile(sid uuid,request uuid,operation text,target uuid,expected bigint,
 team_name text,member_one text,member_two text,audit_reason text,own_verifier bytea,new_verifier bytea)
RETURNS public.team_management_outcomes LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE actor uuid; credential uuid; credential_version bigint; code bytea; n timestamptz; observed bigint;
 old public.team_management_outcomes%ROWTYPE; fp bytea; denial text; subject public.teams%ROWTYPE; revoked public.team_management_outcomes%ROWTYPE;
BEGIN
 PERFORM id FROM public.security_control WHERE id=1 FOR UPDATE;
 n=date_trunc('milliseconds',clock_timestamp());
 SELECT s.staff_id,s.credential_id,s.credential_version,c.verifier INTO actor,credential,credential_version,code
 FROM public.staff_sessions s JOIN public.staff_session_slots z ON z.staff_id=s.staff_id AND z.session_id=s.id
 JOIN public.staff_identities i ON i.id=s.staff_id JOIN public.access_credentials c ON c.id=s.credential_id AND c.version=s.credential_version AND c.staff_id=s.staff_id
 WHERE s.id=sid AND s.mode='NORMAL' AND s.revoked_at IS NULL AND i.role IN ('OWNER','ORGANISER','SUPER_ADMIN')
 AND i.disabled_at IS NULL AND c.revoked_at IS NULL AND n>=s.created_at AND n>=s.last_activity_at AND c.issued_at<=n
 AND n<s.absolute_expires_at AND n<s.last_activity_at+interval '15 minutes';
 IF actor IS NULL OR own_verifier IS DISTINCT FROM code THEN RAISE EXCEPTION 'Current team management authority required' USING ERRCODE='42501'; END IF;
 IF request IS NULL OR target IS NULL OR expected IS NULL OR expected<0 OR operation IS NULL OR operation NOT IN ('EDIT','DELETE') OR new_verifier IS NOT NULL
 OR audit_reason IS NULL OR octet_length(audit_reason) NOT BETWEEN 1 AND 1024 OR btrim(audit_reason)=''
 OR (operation='EDIT' AND (team_name IS NULL OR member_one IS NULL OR member_two IS NULL OR octet_length(team_name) NOT BETWEEN 1 AND 120
  OR octet_length(member_one) NOT BETWEEN 1 AND 120 OR octet_length(member_two) NOT BETWEEN 1 AND 120
  OR btrim(team_name)='' OR btrim(member_one)='' OR btrim(member_two)=''))
 OR (operation='DELETE' AND num_nonnulls(team_name,member_one,member_two)<>0) THEN RAISE EXCEPTION 'Invalid team change' USING ERRCODE='22023'; END IF;
 fp=sha256(convert_to(jsonb_build_array('TEAM_PROFILE_V1',operation,target,expected::text,team_name,member_one,member_two,audit_reason)::text,'UTF8'));
 SELECT * INTO old FROM public.team_management_outcomes WHERE actor_id=actor AND request_key=request;
 IF FOUND THEN
  IF old.fingerprint<>fp THEN RAISE EXCEPTION 'Team intent changed' USING ERRCODE='P0002'; END IF;
  RETURN old;
 END IF;
 SELECT revision INTO observed FROM public.security_control WHERE id=1;
 SELECT * INTO subject FROM public.teams WHERE id=target FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Team unavailable' USING ERRCODE='22023'; END IF;
 IF observed<>expected THEN denial='STALE_VERSION';
 ELSIF subject.deleted_at IS NOT NULL THEN denial='TEAM_DELETED';
 ELSIF EXISTS(SELECT 1 FROM public.team_rounds t JOIN public.rounds r ON r.id=t.round_id WHERE t.team_id=target AND r.state IN ('RUNNING','PAUSED','CLOSING','CANCELLING'))
  OR (operation='DELETE' AND EXISTS(SELECT 1 FROM public.round_draft_teams t JOIN public.rounds r ON r.id=t.round_id
    JOIN public.arena_instances a ON a.id=r.arena_instance_id WHERE t.team_id=target AND a.status IN ('SETUP','IN_PROGRESS'))) THEN denial='TEAM_IN_USE';
 ELSIF (SELECT count(*) FROM public.team_members WHERE team_id=target)<>2 THEN denial='TEAM_INCOMPLETE'; END IF;
 IF (SELECT count(*) FROM public.team_management_outcomes)>=99999 THEN RAISE EXCEPTION 'Team history capacity' USING ERRCODE='54000'; END IF;
 IF denial IS NULL THEN
  IF operation='EDIT' THEN
   UPDATE public.teams SET display_name=team_name WHERE id=target;
   UPDATE public.team_members SET display_name=CASE position WHEN 1 THEN member_one ELSE member_two END WHERE team_id=target;
  ELSE
   IF EXISTS(SELECT 1 FROM public.access_credentials WHERE team_id=target AND revoked_at IS NULL) THEN
    SELECT * INTO revoked FROM public.manage_team_command(sid,gen_random_uuid(),'REVOKE',target,
     (SELECT max(version) FROM public.access_credentials WHERE team_id=target),NULL,NULL,NULL,audit_reason,own_verifier,NULL);
    IF revoked.outcome<>'APPLIED' THEN RAISE EXCEPTION 'Team access revocation failed'; END IF;
   END IF;
   UPDATE public.teams SET deleted_at=n WHERE id=target;
  END IF;
  UPDATE public.security_control SET revision=revision+1 WHERE id=1;
 END IF;
 INSERT INTO public.team_management_outcomes VALUES(gen_random_uuid(),actor,sid,credential,credential_version,request,operation,target,expected,fp,audit_reason,
  CASE WHEN denial IS NULL THEN 'APPLIED' ELSE 'REJECTED' END,denial,CASE WHEN denial IS NULL THEN target END,NULL,NULL,n) RETURNING * INTO old;
 IF denial IS NULL THEN UPDATE public.staff_sessions SET last_activity_at=GREATEST(last_activity_at,n) WHERE id=sid; END IF;
 RETURN old;
END $$;
REVOKE ALL ON FUNCTION public.change_team_profile(uuid,uuid,text,uuid,bigint,text,text,text,text,bytea,bytea) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.change_team_profile(uuid,uuid,text,uuid,bigint,text,text,text,text,bytea,bytea) TO ingenium_api;
--> statement-breakpoint
DO $$
DECLARE definition text;
BEGIN
 definition=pg_get_functiondef('public.manage_team_command(uuid,uuid,text,uuid,bigint,text,text,text,text,bytea,bytea)'::regprocedure);
 IF strpos(definition,'PERFORM id FROM public.teams WHERE id=target FOR UPDATE;')=0 THEN RAISE EXCEPTION 'Reviewed team access guard missing'; END IF;
 definition=replace(definition,'PERFORM id FROM public.teams WHERE id=target FOR UPDATE;','PERFORM id FROM public.teams WHERE id=target AND deleted_at IS NULL FOR UPDATE;');
 definition=replace(definition,'(SELECT count(*) FROM public.teams)>=1000','(SELECT count(*) FROM public.teams WHERE deleted_at IS NULL)>=1000');
 EXECUTE definition;
 definition=pg_get_functiondef('public.import_registrations_command(uuid,uuid,bigint,bytea,jsonb,text,bytea,jsonb)'::regprocedure);
 definition=replace(definition,'fresh+(SELECT count(*) FROM public.teams)>1000','fresh+(SELECT count(*) FROM public.teams WHERE deleted_at IS NULL)>1000');
 EXECUTE definition;
 definition=pg_get_functiondef('public.registration_import_preview(jsonb)'::regprocedure);
 IF strpos(definition,'WHEN t.display_name=')=0 THEN RAISE EXCEPTION 'Reviewed registration match missing'; END IF;
 EXECUTE replace(definition,'WHEN t.display_name=','WHEN t.deleted_at IS NULL AND t.display_name=');
END $$;
--> statement-breakpoint
CREATE FUNCTION guard_active_draft_team() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.teams WHERE id=NEW.team_id AND deleted_at IS NULL) THEN RAISE EXCEPTION 'Deleted team cannot join an arena'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER active_draft_team BEFORE INSERT OR UPDATE ON public.round_draft_teams FOR EACH ROW EXECUTE FUNCTION guard_active_draft_team();
REVOKE ALL ON FUNCTION guard_active_draft_team() FROM PUBLIC;
