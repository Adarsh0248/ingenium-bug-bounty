CREATE TRIGGER content_publication_immutable BEFORE UPDATE OR DELETE ON content_publication_outcomes
  FOR EACH ROW EXECUTE FUNCTION immutable_access_history();
--> statement-breakpoint
CREATE FUNCTION publish_content_command(sid uuid,snapshot uuid,validation uuid,request uuid,expected bigint,review text,own_verifier bytea)
RETURNS content_publication_outcomes LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE actor uuid; credential uuid; credential_version bigint; code bytea; n timestamptz;
  v public.validation_snapshots%ROWTYPE; old public.content_publication_outcomes%ROWTYPE; fp bytea; denial text; stage uuid;
BEGIN
  PERFORM id FROM public.security_control WHERE id=1 FOR UPDATE;
  SELECT current_instance_id INTO stage FROM public.arena_control WHERE id=1 FOR UPDATE;
  PERFORM id FROM public.rounds WHERE arena_instance_id=stage ORDER BY id FOR UPDATE;
  PERFORM id FROM public.catalogue_control WHERE id=1 FOR UPDATE;
  n=date_trunc('milliseconds',clock_timestamp());
  SELECT s.staff_id,s.credential_id,s.credential_version,c.verifier INTO actor,credential,credential_version,code
    FROM public.staff_sessions s JOIN public.staff_session_slots z ON z.staff_id=s.staff_id AND z.session_id=s.id
    JOIN public.staff_identities i ON i.id=s.staff_id JOIN public.access_credentials c ON c.id=s.credential_id AND c.version=s.credential_version AND c.staff_id=s.staff_id
    WHERE s.id=sid AND s.mode='NORMAL' AND s.revoked_at IS NULL AND i.role IN ('OWNER','SUPER_ADMIN') AND i.disabled_at IS NULL AND c.revoked_at IS NULL
      AND n>=s.last_activity_at AND n<s.absolute_expires_at AND n<s.last_activity_at+interval '15 minutes';
  IF actor IS NULL OR own_verifier IS DISTINCT FROM code THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Current confirmed publication authority required'; END IF;
  IF snapshot IS NULL OR validation IS NULL OR request IS NULL OR expected IS NULL OR expected<1 OR review IS NULL
    OR octet_length(review) NOT BETWEEN 1 AND 1024 OR btrim(review)='' THEN RAISE EXCEPTION 'Invalid publication command' USING ERRCODE='22023'; END IF;
  fp=sha256(convert_to(jsonb_build_array('CONTENT_PUBLISH_V1',snapshot,validation,expected::text,review)::text,'UTF8'));
  SELECT * INTO old FROM public.content_publication_outcomes WHERE actor_id=actor AND snapshot_id=snapshot AND request_key=request;
  IF FOUND THEN
    IF old.fingerprint<>fp THEN RAISE EXCEPTION 'Publication intent changed' USING ERRCODE='P0002'; END IF;
    RETURN old;
  END IF;
  SELECT * INTO v FROM public.validation_snapshots WHERE id=snapshot;
  IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.validation_runs WHERE id=validation) THEN RAISE EXCEPTION 'Publication content unavailable' USING ERRCODE='22023'; END IF;
  IF expected<>v.content_revision OR NOT EXISTS(SELECT 1 FROM public.bug_versions WHERE id=v.version_id AND content_revision=v.content_revision) THEN denial='STALE_VERSION';
  ELSIF EXISTS(SELECT 1 FROM public.bug_versions WHERE id=v.version_id AND publication_status<>'DRAFT') THEN denial='CONTENT_LOCKED';
  ELSIF EXISTS(SELECT 1 FROM public.rounds WHERE state IN ('RUNNING','PAUSED','CLOSING','CANCELLING')) THEN denial='ARENA_ACTIVE';
  ELSIF NOT EXISTS(SELECT 1 FROM public.validation_runs WHERE id=validation AND snapshot_id=snapshot AND configuration_fingerprint=v.fingerprint AND status='PASSED') THEN denial='VALIDATION_NOT_PASSED';
  ELSIF EXISTS(SELECT 1 FROM public.authoring_attempts a JOIN public.authoring_checks c ON c.id=a.check_id WHERE c.run_id=validation AND a.released_at IS NULL) THEN denial='CLEANUP_PENDING'; END IF;
  IF (SELECT count(*) FROM public.content_publication_outcomes)>=100000 THEN RAISE EXCEPTION 'Publication history capacity' USING ERRCODE='54000'; END IF;
  INSERT INTO public.content_publication_outcomes VALUES(gen_random_uuid(),snapshot,validation,actor,sid,credential,credential_version,request,expected,fp,review,
    CASE WHEN denial IS NULL THEN 'APPLIED' ELSE 'REJECTED' END,denial,n) RETURNING * INTO old;
  IF denial IS NULL THEN
    INSERT INTO public.competition_publications VALUES(snapshot,v.version_id,validation,actor,n,review);
    UPDATE public.bug_versions SET publication_status='PUBLISHED',published_by=actor,published_at=n WHERE id=v.version_id;
    UPDATE public.staff_sessions SET last_activity_at=n WHERE id=sid;
  END IF;
  RETURN old;
END $$;
--> statement-breakpoint
REVOKE ALL ON content_publication_outcomes FROM PUBLIC,ingenium_api;
GRANT SELECT ON content_publication_outcomes TO ingenium_api;
REVOKE ALL ON FUNCTION publish_content_command(uuid,uuid,uuid,uuid,bigint,text,bytea) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION publish_content_command(uuid,uuid,uuid,uuid,bigint,text,bytea) TO ingenium_api;
DROP FUNCTION competition_publish(uuid,uuid,uuid,text);
