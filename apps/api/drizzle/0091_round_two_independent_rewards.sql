-- New Round 2 drafts may keep shop-sized rewards while their difficulty stays beginner-friendly.
ALTER TABLE public.bug_versions DROP CONSTRAINT bug_version_content;
ALTER TABLE public.bug_versions ADD CONSTRAINT bug_version_content CHECK (version_number between 1 and 1000 and content_revision>=1 and content_bytes>=4096
  and octet_length(title) between 1 and 160 and length(btrim(title))>0 and octet_length(statement)<=65536
  and difficulty between 1 and 100 and (base_bounty in (difficulty*10,difficulty*50) or (base_bounty between 250 and 1000 and base_bounty%10=0))
  and submission_format='FULL_PROGRAM' and checker_mode in ('TOKENS','EXACT_TEXT') and checker_version='ingenium-text-v1');
--> statement-breakpoint
ALTER TABLE public.validation_snapshots DROP CONSTRAINT snapshot_metadata;
ALTER TABLE public.validation_snapshots ADD CONSTRAINT snapshot_metadata CHECK (version_number between 1 and 1000 and content_revision>=1 and round_type in (1,2)
  and octet_length(title) between 1 and 160 and length(btrim(title))>0 and octet_length(statement)<=65536
  and difficulty between 1 and 100 and (base_bounty=difficulty*10 or (round_type=1 and base_bounty=difficulty*50)
    or (round_type=2 and base_bounty between 250 and 1000 and base_bounty%10=0))
  and submission_format='FULL_PROGRAM' and checker_mode in ('TOKENS','EXACT_TEXT') and checker_version='ingenium-text-v1');
--> statement-breakpoint
CREATE OR REPLACE FUNCTION guard_bug_reward_round() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE round_kind integer;
BEGIN
  SELECT round_type INTO round_kind FROM public.bug_definitions WHERE id=NEW.definition_id;
  IF NOT (NEW.base_bounty=NEW.difficulty*10 OR (round_kind=1 AND NEW.base_bounty=NEW.difficulty*50)
    OR (round_kind=2 AND NEW.base_bounty BETWEEN 250 AND 1000 AND NEW.base_bounty%10=0)) THEN RAISE EXCEPTION 'Invalid round reward policy'; END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE FUNCTION public.reviewed_content_bounty(d integer,r integer,p jsonb,prior integer) RETURNS integer
LANGUAGE plpgsql STABLE SET search_path=pg_catalog,public AS $$
DECLARE amount integer; multiplier integer;
BEGIN
  IF d IS NULL OR d NOT BETWEEN 1 AND 100 OR r IS NULL OR r NOT IN (1,2) THEN RAISE EXCEPTION 'Invalid reward context'; END IF;
  IF p?'base_bounty' THEN
    IF r<>2 OR jsonb_typeof(p->'base_bounty')<>'number' OR p->>'base_bounty' !~ '^[1-9][0-9]{2,3}$'
      OR (p?'reward_multiplier' AND p->'reward_multiplier'<>'1'::jsonb) THEN RAISE EXCEPTION 'Invalid independent reward'; END IF;
    amount=(p->>'base_bounty')::integer;
    IF amount NOT BETWEEN 250 AND 1000 OR amount%10<>0 THEN RAISE EXCEPTION 'Invalid independent reward'; END IF;
    RETURN amount;
  END IF;
  multiplier=COALESCE((p->>'reward_multiplier')::integer,CASE WHEN r=1 AND prior IS NOT NULL THEN prior ELSE 1 END);
  IF multiplier NOT IN (1,5) OR (r=2 AND multiplier<>1) THEN RAISE EXCEPTION 'Invalid reward multiplier'; END IF;
  RETURN d*10*multiplier;
END $$;
REVOKE ALL ON FUNCTION public.reviewed_content_bounty(integer,integer,jsonb,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reviewed_content_bounty(integer,integer,jsonb,integer) TO ingenium_api;
--> statement-breakpoint
DO $$
DECLARE body text; old text; replacement text;
BEGIN
  body=pg_get_functiondef('public.content_edit_status(text,uuid,jsonb)'::regprocedure);
  old=$old$(p->>'difficulty')::integer*10*COALESCE((p->>'reward_multiplier')::integer,v.base_bounty/(v.difficulty*10))$old$;
  replacement=$new$public.reviewed_content_bounty((p->>'difficulty')::integer,(SELECT round_type FROM public.bug_definitions WHERE id=v.definition_id),p,v.base_bounty/(v.difficulty*10))$new$;
  IF (length(body)-length(replace(body,old,'')))/length(old)<>1 THEN RAISE EXCEPTION 'Reviewed content comparison differs'; END IF;
  EXECUTE replace(body,old,replacement);
  body=pg_get_functiondef('public.apply_content_edit(uuid,text)'::regprocedure);
  old=$old$multiplier=COALESCE((p->>'reward_multiplier')::integer,CASE WHEN s.action='METADATA' THEN v.base_bounty/(v.difficulty*10) ELSE 1 END);$old$;
  replacement=$new$multiplier=COALESCE((p->>'reward_multiplier')::integer,CASE WHEN s.action='METADATA' AND EXISTS(SELECT 1 FROM public.bug_definitions WHERE id=s.result_definition_id AND round_type=1) THEN v.base_bounty/(v.difficulty*10) ELSE 1 END);$new$;
  IF (length(body)-length(replace(body,old,'')))/length(old)<>1 THEN RAISE EXCEPTION 'Reviewed multiplier selection differs'; END IF;
  body=replace(body,old,replacement);
  old=$old$(p->>'difficulty')::integer*10*multiplier$old$;
  replacement=$new$public.reviewed_content_bounty((p->>'difficulty')::integer,(SELECT round_type FROM public.bug_definitions WHERE id=s.result_definition_id),p,multiplier)$new$;
  IF (length(body)-length(replace(body,old,'')))/length(old)<>2 THEN RAISE EXCEPTION 'Reviewed content reward effects differ'; END IF;
  EXECUTE replace(body,old,replacement);
END $$;
