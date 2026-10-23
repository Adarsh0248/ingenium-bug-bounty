CREATE TABLE "restore_quarantine" (
	"id" integer PRIMARY KEY NOT NULL,
	"request_key" uuid NOT NULL,
	"fingerprint" "bytea" NOT NULL,
	"backup_ref" text NOT NULL,
	"operator" text NOT NULL,
	"os_user" text NOT NULL,
	"reason" text NOT NULL,
	"observed_at" timestamp (3) with time zone NOT NULL,
	"effects" jsonb NOT NULL,
	CONSTRAINT "restore_quarantine_request_key_unique" UNIQUE("request_key"),
	CONSTRAINT "restore_quarantine_shape" CHECK ("restore_quarantine"."id"=1 and octet_length("restore_quarantine"."fingerprint")=32
  and octet_length("restore_quarantine"."backup_ref") between 1 and 256 and length(btrim("restore_quarantine"."backup_ref"))>0
  and octet_length("restore_quarantine"."operator") between 1 and 120 and length(btrim("restore_quarantine"."operator"))>0
  and octet_length("restore_quarantine"."os_user") between 1 and 120 and length(btrim("restore_quarantine"."os_user"))>0
  and octet_length("restore_quarantine"."reason") between 1 and 1024 and length(btrim("restore_quarantine"."reason"))>0
  and jsonb_typeof("restore_quarantine"."effects")='object' and octet_length("restore_quarantine"."effects"::text) between 1 and 4096)
);
--> statement-breakpoint
REVOKE ALL ON restore_quarantine FROM PUBLIC,ingenium_api,ingenium_competition_worker;
CREATE TRIGGER restore_quarantine_immutable BEFORE UPDATE OR DELETE ON restore_quarantine FOR EACH ROW EXECUTE FUNCTION immutable_access_history();
CREATE FUNCTION restore_is_quarantined() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
  SELECT EXISTS(SELECT 1 FROM public.restore_quarantine WHERE id=1)
$$;
CREATE FUNCTION guard_restored_clock() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF NEW.running AND public.restore_is_quarantined() THEN RAISE EXCEPTION 'Restore quarantine requires offline recovery' USING ERRCODE='55000'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER restored_clock_offline BEFORE INSERT OR UPDATE ON clock_health FOR EACH ROW EXECUTE FUNCTION guard_restored_clock();
CREATE OR REPLACE FUNCTION lock_arena_control(exclusive_lock boolean) RETURNS SETOF public.arena_control LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  IF exclusive_lock THEN
    PERFORM id FROM public.security_control WHERE id=1 FOR UPDATE;
  ELSE PERFORM id FROM public.security_control WHERE id=1 FOR SHARE; END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'Security anchor is missing'; END IF;
  IF public.restore_is_quarantined() THEN RAISE EXCEPTION 'Restore quarantine requires offline recovery' USING ERRCODE='55000'; END IF;
  IF exclusive_lock THEN
    RETURN QUERY SELECT * FROM public.arena_control WHERE id=1 FOR UPDATE;
  ELSE RETURN QUERY SELECT * FROM public.arena_control WHERE id=1 FOR SHARE; END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'Arena reservation anchor is missing'; END IF;
END $$;
--> statement-breakpoint
CREATE FUNCTION quarantine_restored_database(request uuid,backup text,actor text,os_actor text,audit_reason text)
RETURNS jsonb LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE prior public.restore_quarantine%ROWTYPE; digest bytea; n timestamptz;
  effects jsonb='{}'; changed integer; target text;
BEGIN
  IF current_user<>pg_get_userbyid((SELECT relowner FROM pg_class WHERE oid='public.restore_quarantine'::regclass))
    THEN RAISE EXCEPTION 'Actual schema owner required' USING ERRCODE='42501'; END IF;
  IF num_nonnulls(request,backup,actor,os_actor,audit_reason)<>5
    OR octet_length(backup) NOT BETWEEN 1 AND 256 OR length(btrim(backup))=0
    OR octet_length(actor) NOT BETWEEN 1 AND 120 OR length(btrim(actor))=0
    OR octet_length(os_actor) NOT BETWEEN 1 AND 120 OR length(btrim(os_actor))=0
    OR octet_length(audit_reason) NOT BETWEEN 1 AND 1024 OR length(btrim(audit_reason))=0
    THEN RAISE EXCEPTION 'Bounded restore intent required' USING ERRCODE='22023'; END IF;
  digest=sha256(convert_to(jsonb_build_array(request,backup,actor,os_actor,audit_reason)::text,'UTF8'));
  PERFORM id FROM public.security_control WHERE id=1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Missing security anchor'; END IF;
  SELECT * INTO prior FROM public.restore_quarantine WHERE id=1;
  IF FOUND THEN
    IF prior.request_key<>request OR prior.fingerprint<>digest THEN
      RAISE EXCEPTION 'Original restore intent required' USING ERRCODE='P0002';
    END IF;
    RETURN jsonb_build_object('request_key',prior.request_key,'state','QUARANTINED','observed_at',prior.observed_at,'effects',prior.effects,'admission_authorised',false);
  END IF;
  PERFORM id FROM public.clock_health WHERE id=1 AND NOT running FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Stop protected services before isolated restore quarantine' USING ERRCODE='55000'; END IF;
  -- This is an untrusted observation, never a sporting timestamp or retirement proof.
  n=date_trunc('milliseconds',clock_timestamp());
  UPDATE public.participant_sessions SET revoked_at=GREATEST(n,created_at,last_activity_at),revocation_reason='BACKUP_RESTORE' WHERE revoked_at IS NULL;
  GET DIAGNOSTICS changed=ROW_COUNT; effects=effects||jsonb_build_object('participant_sessions',changed);
  UPDATE public.staff_sessions SET revoked_at=GREATEST(n,created_at,last_activity_at),revocation_reason='BACKUP_RESTORE' WHERE revoked_at IS NULL;
  GET DIAGNOSTICS changed=ROW_COUNT; effects=effects||jsonb_build_object('staff_sessions',changed);
  FOREACH target IN ARRAY ARRAY['entry_flows','staff_entry_flows'] LOOP
    EXECUTE format('UPDATE public.%I SET state=''REVOKED'' WHERE state IN (''OPEN'',''ACTIVATED'')',target);
    GET DIAGNOSTICS changed=ROW_COUNT; effects=effects||jsonb_build_object(target,changed);
  END LOOP;
  UPDATE public.replacement_requests SET state=CASE WHEN state IN ('PENDING','APPROVED','ACTIVATED') THEN 'SUPERSEDED' ELSE state END,
    proof_ciphertext=NULL,proof_purged_at=COALESCE(proof_purged_at,n)
    WHERE state IN ('PENDING','APPROVED','ACTIVATED') OR proof_ciphertext IS NOT NULL;
  GET DIAGNOSTICS changed=ROW_COUNT; effects=effects||jsonb_build_object('replacement_requests',changed);
  FOREACH target IN ARRAY ARRAY['session_deliveries','staff_session_deliveries'] LOOP
    EXECUTE format('UPDATE public.%I SET ciphertext=NULL,purged_at=$1 WHERE ciphertext IS NOT NULL',target) USING n;
    GET DIAGNOSTICS changed=ROW_COUNT; effects=effects||jsonb_build_object(target,changed);
  END LOOP;
  UPDATE public.member_session_slots SET session_id=NULL,reservation_flow_id=NULL,revision=revision+1 WHERE session_id IS NOT NULL OR reservation_flow_id IS NOT NULL;
  GET DIAGNOSTICS changed=ROW_COUNT; effects=effects||jsonb_build_object('member_slots',changed);
  UPDATE public.staff_session_slots SET session_id=NULL,revision=revision+1 WHERE session_id IS NOT NULL;
  GET DIAGNOSTICS changed=ROW_COUNT; effects=effects||jsonb_build_object('staff_slots',changed);
  UPDATE public.judge_host_epochs SET state='QUARANTINED' WHERE state='ACTIVE';
  GET DIAGNOSTICS changed=ROW_COUNT; effects=effects||jsonb_build_object('judge_epochs',changed);
  INSERT INTO public.restore_quarantine(id,request_key,fingerprint,backup_ref,operator,os_user,reason,observed_at,effects)
    VALUES(1,request,digest,backup,actor,os_actor,audit_reason,n,effects);
  UPDATE public.security_control SET revision=revision+1 WHERE id=1;
  RETURN jsonb_build_object('request_key',request,'state','QUARANTINED','observed_at',n,'effects',effects,'admission_authorised',false);
END $$;
REVOKE ALL ON FUNCTION restore_is_quarantined(),guard_restored_clock(),quarantine_restored_database(uuid,text,text,text,text) FROM PUBLIC,ingenium_api,ingenium_competition_worker;
GRANT EXECUTE ON FUNCTION restore_is_quarantined() TO ingenium_api,ingenium_competition_worker;
