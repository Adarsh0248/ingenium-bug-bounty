CREATE TRIGGER registration_import_immutable BEFORE UPDATE OR DELETE ON registration_import_outcomes
  FOR EACH ROW EXECUTE FUNCTION immutable_access_history();
CREATE TRIGGER registration_source_immutable BEFORE UPDATE OR DELETE ON registration_sources
  FOR EACH ROW EXECUTE FUNCTION immutable_access_history();
--> statement-breakpoint
CREATE FUNCTION registration_import_preview(rows jsonb) RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path=pg_catalog,public AS $$
DECLARE r jsonb;
BEGIN
  IF rows IS NULL OR jsonb_typeof(rows)<>'array' OR jsonb_array_length(rows) NOT BETWEEN 1 AND 100 OR octet_length(rows::text)>1048576 THEN
    RAISE EXCEPTION 'Invalid registration rows' USING ERRCODE='22023'; END IF;
  FOR r IN SELECT value FROM jsonb_array_elements(rows) LOOP
    IF jsonb_typeof(r)<>'object' OR (SELECT count(*) FROM jsonb_object_keys(r))<>5
      OR NOT (r ?& ARRAY['row','registration_id','team_name','member_1_name','member_2_name'])
      OR jsonb_typeof(r->'row')<>'number' OR (r->>'row') !~ '^[0-9]{1,4}$'
      OR jsonb_typeof(r->'registration_id')<>'string' OR (r->>'registration_id') !~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'
      OR EXISTS(SELECT 1 FROM jsonb_each(r) e WHERE e.key IN ('team_name','member_1_name','member_2_name') AND
        (jsonb_typeof(e.value)<>'string' OR octet_length(e.value #>> '{}') NOT BETWEEN 1 AND 120
          OR (e.value #>> '{}') !~ '[^[:space:]]' OR (e.value #>> '{}') ~ '[[:cntrl:]]')) THEN
      RAISE EXCEPTION 'Invalid registration fields' USING ERRCODE='22023'; END IF;
  END LOOP;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(rows) WITH ORDINALITY a(value,n) WHERE (value->>'row')::integer<>n+1)
    OR (SELECT count(DISTINCT value->>'registration_id') FROM jsonb_array_elements(rows))<>jsonb_array_length(rows) THEN
    RAISE EXCEPTION 'Duplicate registration ID or changed row order' USING ERRCODE='22023'; END IF;
  RETURN (SELECT jsonb_agg(a.value || jsonb_build_object('team_id',s.team_id,'status',CASE WHEN s.team_id IS NULL THEN 'NEW'
    WHEN t.display_name=a.value->>'team_name' AND 2=(SELECT count(*) FROM public.team_members WHERE team_id=s.team_id)
      AND EXISTS(SELECT 1 FROM public.team_members WHERE team_id=s.team_id AND position=1 AND display_name=a.value->>'member_1_name')
      AND EXISTS(SELECT 1 FROM public.team_members WHERE team_id=s.team_id AND position=2 AND display_name=a.value->>'member_2_name') THEN 'EXISTING'
    ELSE 'CONFLICT' END) ORDER BY a.n)
    FROM jsonb_array_elements(rows) WITH ORDINALITY a(value,n)
    LEFT JOIN public.registration_sources s ON s.registration_id=a.value->>'registration_id' LEFT JOIN public.teams t ON t.id=s.team_id);
END $$;
--> statement-breakpoint
CREATE FUNCTION import_registrations_command(sid uuid,request uuid,expected bigint,csv_hash bytea,rows jsonb,audit_reason text,own_verifier bytea,new_verifiers jsonb)
RETURNS registration_import_outcomes LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE actor uuid; credential uuid; credential_version bigint; code bytea; n timestamptz; observed_revision bigint; old public.registration_import_outcomes%ROWTYPE;
  preview jsonb; plan jsonb; results jsonb; fp bytea; denial text; fresh integer; source uuid;
BEGIN
  SELECT c.revision INTO observed_revision FROM public.security_control c WHERE id=1 FOR UPDATE;
  n=date_trunc('milliseconds',clock_timestamp());
  SELECT s.staff_id,s.credential_id,s.credential_version,c.verifier INTO actor,credential,credential_version,code
    FROM public.staff_sessions s JOIN public.staff_session_slots z ON z.staff_id=s.staff_id AND z.session_id=s.id
    JOIN public.staff_identities i ON i.id=s.staff_id JOIN public.access_credentials c ON c.id=s.credential_id AND c.version=s.credential_version AND c.staff_id=s.staff_id
    WHERE s.id=sid AND s.mode='NORMAL' AND s.revoked_at IS NULL AND i.role IN ('OWNER','SUPER_ADMIN') AND i.disabled_at IS NULL AND c.revoked_at IS NULL
      AND n>=s.created_at AND n>=s.last_activity_at AND c.issued_at<=n AND n<s.absolute_expires_at AND n<s.last_activity_at+interval '15 minutes';
  IF actor IS NULL OR own_verifier IS DISTINCT FROM code THEN RAISE EXCEPTION 'Current confirmed registration authority required' USING ERRCODE='42501'; END IF;
  IF request IS NULL OR expected IS NULL OR expected<0 OR csv_hash IS NULL OR octet_length(csv_hash)<>32
    OR audit_reason IS NULL OR octet_length(audit_reason) NOT BETWEEN 1 AND 1024 OR btrim(audit_reason)='' THEN
    RAISE EXCEPTION 'Invalid import command' USING ERRCODE='22023'; END IF;
  preview=public.registration_import_preview(rows);
  fp=sha256(convert_to(jsonb_build_array('REGISTRATION_IMPORT_V1',expected::text,encode(csv_hash,'hex'),rows,audit_reason)::text,'UTF8'));
  SELECT * INTO old FROM public.registration_import_outcomes WHERE actor_id=actor AND request_key=request;
  IF FOUND THEN
    IF old.fingerprint<>fp THEN RAISE EXCEPTION 'Import intent changed' USING ERRCODE='P0002'; END IF;
    RETURN old;
  END IF;
  IF new_verifiers IS NULL OR jsonb_typeof(new_verifiers)<>'array' OR jsonb_array_length(new_verifiers)<>jsonb_array_length(rows)
    OR octet_length(new_verifiers::text)>262144 THEN RAISE EXCEPTION 'Invalid import code allocation' USING ERRCODE='22023'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(new_verifiers) v WHERE jsonb_typeof(v)<>'object'
    OR (SELECT count(*) FROM jsonb_object_keys(v))<>2 OR NOT (v ?& ARRAY['registration_id','verifier'])
    OR jsonb_typeof(v->'verifier')<>'string' OR (v->>'verifier') !~ '^[0-9a-f]{64}$'
    OR jsonb_typeof(v->'registration_id')<>'string'
    OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(rows) r WHERE r->>'registration_id'=v->>'registration_id'))
    OR (SELECT count(DISTINCT v->>'registration_id') FROM jsonb_array_elements(new_verifiers) v)<>jsonb_array_length(rows)
    OR (SELECT count(DISTINCT v->>'verifier') FROM jsonb_array_elements(new_verifiers) v)<>jsonb_array_length(rows) THEN
    RAISE EXCEPTION 'Invalid import verifier binding' USING ERRCODE='22023'; END IF;
  SELECT count(*) INTO fresh FROM jsonb_array_elements(preview) r WHERE r->>'status'='NEW';
  IF observed_revision<>expected THEN denial='STALE_VERSION';
  ELSIF EXISTS(SELECT 1 FROM jsonb_array_elements(preview) r WHERE r->>'status'='CONFLICT') THEN denial='REGISTRATION_CONFLICT';
  ELSIF fresh+(SELECT count(*) FROM public.teams)>1000 THEN denial='TEAM_CAPACITY'; END IF;
  IF (SELECT count(*) FROM public.registration_import_outcomes)>=100000 THEN RAISE EXCEPTION 'Registration history capacity' USING ERRCODE='54000'; END IF;
  SELECT jsonb_agg(r || CASE WHEN denial IS NULL AND r->>'status'='NEW' THEN jsonb_build_object('team_id',gen_random_uuid(),'status','CREATED') ELSE '{}'::jsonb END ORDER BY p.n)
    INTO plan FROM jsonb_array_elements(preview) WITH ORDINALITY p(r,n);
  SELECT jsonb_agg(jsonb_build_object('row',r->'row','registration_id',r->'registration_id','team_id',r->'team_id','status',r->'status') ORDER BY p.n)
    INTO results FROM jsonb_array_elements(plan) WITH ORDINALITY p(r,n);
  source=gen_random_uuid();
  INSERT INTO public.registration_import_outcomes VALUES(source,actor,sid,credential,credential_version,request,expected,csv_hash,fp,audit_reason,
    CASE WHEN denial IS NOT NULL THEN 'REJECTED' WHEN fresh=0 THEN 'UNCHANGED' ELSE 'APPLIED' END,denial,results,n) RETURNING * INTO old;
  IF denial IS NULL AND fresh>0 THEN
    INSERT INTO public.teams(id,display_name,created_at)
      SELECT (p->>'team_id')::uuid,p->>'team_name',n FROM jsonb_array_elements(plan) p WHERE p->>'status'='CREATED';
    INSERT INTO public.team_members(id,team_id,position,display_name,created_at)
      SELECT gen_random_uuid(),(p->>'team_id')::uuid,m.position,p->>m.field,n FROM jsonb_array_elements(plan) p
        CROSS JOIN (VALUES(1,'member_1_name'),(2,'member_2_name')) m(position,field) WHERE p->>'status'='CREATED';
    INSERT INTO public.access_credentials(id,team_id,verifier,version,issued_at)
      SELECT gen_random_uuid(),(p->>'team_id')::uuid,decode(v->>'verifier','hex'),1,n
        FROM jsonb_array_elements(plan) p JOIN jsonb_array_elements(new_verifiers) v ON v->>'registration_id'=p->>'registration_id' WHERE p->>'status'='CREATED';
    INSERT INTO public.registration_sources
      SELECT p->>'registration_id',(p->>'team_id')::uuid,source FROM jsonb_array_elements(plan) p WHERE p->>'status'='CREATED';
    UPDATE public.security_control SET revision=revision+1 WHERE id=1;
    UPDATE public.staff_sessions SET last_activity_at=n WHERE id=sid;
  END IF;
  RETURN old;
END $$;
--> statement-breakpoint
REVOKE ALL ON registration_import_outcomes,registration_sources FROM PUBLIC,ingenium_api;
GRANT SELECT ON registration_import_outcomes,registration_sources TO ingenium_api;
REVOKE ALL ON FUNCTION registration_import_preview(jsonb),import_registrations_command(uuid,uuid,bigint,bytea,jsonb,text,bytea,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION registration_import_preview(jsonb),import_registrations_command(uuid,uuid,bigint,bytea,jsonb,text,bytea,jsonb) TO ingenium_api;
