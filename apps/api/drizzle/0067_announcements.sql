CREATE TABLE "announcements" (
	"id" uuid PRIMARY KEY NOT NULL,
	"arena_id" uuid NOT NULL,
	"scope" text NOT NULL,
	"round_id" uuid,
	"team_id" uuid,
	"actor_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"credential_id" uuid NOT NULL,
	"credential_version" bigint NOT NULL,
	"request_key" uuid NOT NULL,
	"fingerprint" "bytea" NOT NULL,
	"message" text NOT NULL,
	"reason" text NOT NULL,
	"outcome" text NOT NULL,
	"denial_reason" text,
	"recorded_at" timestamp (3) with time zone NOT NULL,
	CONSTRAINT "announcement_intent" UNIQUE("actor_id","arena_id","request_key"),
	CONSTRAINT "announcement_shape" CHECK (octet_length("announcements"."fingerprint")=32 and octet_length("announcements"."message") between 1 and 4096 and length(btrim("announcements"."message"))>0
    and octet_length("announcements"."reason") between 1 and 1024 and length(btrim("announcements"."reason"))>0
    and (("announcements"."scope"='EVENT' and num_nonnulls("announcements"."round_id","announcements"."team_id")=0)
      or ("announcements"."scope"='ROUND' and "announcements"."round_id" is not null and "announcements"."team_id" is null)
      or ("announcements"."scope"='TEAM' and "announcements"."team_id" is not null and "announcements"."round_id" is null))
    and (("announcements"."outcome"='APPLIED' and "announcements"."denial_reason" is null) or ("announcements"."outcome"='REJECTED' and "announcements"."denial_reason" is not null and "announcements"."denial_reason"='ARENA_CLOSED')))
);
--> statement-breakpoint
ALTER TABLE "live_effects" DROP CONSTRAINT "live_effect_source";--> statement-breakpoint
ALTER TABLE "live_effects" ADD COLUMN "announcement_id" uuid;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_arena_id_arena_instances_id_fk" FOREIGN KEY ("arena_id") REFERENCES "public"."arena_instances"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcement_session" FOREIGN KEY ("session_id","actor_id") REFERENCES "public"."staff_sessions"("id","staff_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcement_credential" FOREIGN KEY ("credential_id","credential_version","actor_id") REFERENCES "public"."access_credentials"("id","version","staff_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "announcement_history" ON "announcements" USING btree ("arena_id","recorded_at","id");--> statement-breakpoint
ALTER TABLE "live_effects" ADD CONSTRAINT "live_effects_announcement_id_announcements_id_fk" FOREIGN KEY ("announcement_id") REFERENCES "public"."announcements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_effects" ADD CONSTRAINT "live_effect_source" CHECK (num_nonnulls("live_effects"."competition_sequence","live_effects"."parent_id","live_effects"."round_id","live_effects"."arena_id","live_effects"."participant_session_id","live_effects"."staff_session_id","live_effects"."staff_id","live_effects"."credential_id","live_effects"."block_id","live_effects"."validation_run_id","live_effects"."version_id","live_effects"."draft_outcome_id","live_effects"."announcement_id")=1);
--> statement-breakpoint
CREATE TRIGGER announcement_immutable BEFORE UPDATE OR DELETE ON announcements FOR EACH ROW EXECUTE FUNCTION immutable_access_history();
CREATE FUNCTION validate_announcement() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE current_arena uuid; arena_status text; applied boolean;
BEGIN
  PERFORM id FROM public.security_control WHERE id=1 FOR UPDATE;
  SELECT current_instance_id INTO current_arena FROM public.lock_arena_control(true);
  PERFORM id FROM public.rounds WHERE arena_instance_id=NEW.arena_id ORDER BY id FOR UPDATE;
  IF NOT EXISTS(SELECT 1 FROM public.staff_sessions s
    JOIN public.staff_session_slots x ON x.staff_id=s.staff_id AND x.session_id=s.id
    JOIN public.staff_identities i ON i.id=s.staff_id
    JOIN public.access_credentials c ON c.id=s.credential_id AND c.staff_id=s.staff_id AND c.version=s.credential_version
    WHERE s.id=NEW.session_id AND s.staff_id=NEW.actor_id AND s.credential_id=NEW.credential_id AND s.credential_version=NEW.credential_version
      AND s.mode='NORMAL' AND s.revoked_at IS NULL AND i.disabled_at IS NULL AND i.role IN ('OWNER','ORGANISER','SUPER_ADMIN') AND c.revoked_at IS NULL
      AND c.issued_at<=NEW.recorded_at AND s.created_at<=NEW.recorded_at AND s.last_activity_at<=NEW.recorded_at
      AND NEW.recorded_at<s.absolute_expires_at AND NEW.recorded_at<s.last_activity_at+interval '15 minutes') THEN
    RAISE EXCEPTION 'Current announcement authority required'; END IF;
  SELECT status INTO arena_status FROM public.arena_instances WHERE id=NEW.arena_id;
  IF arena_status IS NULL OR (NEW.round_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.rounds WHERE id=NEW.round_id AND arena_instance_id=NEW.arena_id))
    OR (NEW.team_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.rounds r WHERE r.arena_instance_id=NEW.arena_id AND
      (EXISTS(SELECT 1 FROM public.round_draft_teams d WHERE d.round_id=r.id AND d.team_id=NEW.team_id)
      OR EXISTS(SELECT 1 FROM public.team_rounds t WHERE t.round_id=r.id AND t.team_id=NEW.team_id)))) THEN
    RAISE EXCEPTION 'Announcement target unavailable'; END IF;
  applied:=coalesce(current_arena=NEW.arena_id AND arena_status IN ('SETUP','IN_PROGRESS'),false);
  IF (NEW.outcome='APPLIED')<>applied THEN RAISE EXCEPTION 'Announcement lifecycle mismatch'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER announcement_authority BEFORE INSERT ON announcements FOR EACH ROW EXECUTE FUNCTION validate_announcement();
CREATE FUNCTION live_announcement_created() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE effect uuid; streams uuid[];
BEGIN
  IF NEW.outcome<>'APPLIED' THEN RETURN NEW; END IF;
  INSERT INTO public.live_effects(announcement_id) VALUES(NEW.id) RETURNING id INTO effect;
  SELECT array_agg(s.id) INTO streams FROM public.live_streams s LEFT JOIN public.rounds r ON r.id=s.round_id
    LEFT JOIN public.team_rounds t ON t.id=s.team_round_id WHERE s.kind='STAFF_OPS' OR (r.arena_instance_id=NEW.arena_id AND
      ((NEW.scope='EVENT' AND s.kind='ROUND') OR (NEW.scope='ROUND' AND s.kind='ROUND' AND s.round_id=NEW.round_id)
      OR (NEW.scope='TEAM' AND s.kind='TEAM' AND t.team_id=NEW.team_id)));
  PERFORM public.live_emit(effect,streams,jsonb_build_object('type','INVALIDATE','projection','announcements','announcement_id',NEW.id));
  RETURN NEW;
END;
$$;
CREATE TRIGGER announcement_delivery AFTER INSERT ON announcements FOR EACH ROW EXECUTE FUNCTION live_announcement_created();
REVOKE ALL ON FUNCTION validate_announcement(),live_announcement_created() FROM PUBLIC,ingenium_api,ingenium_competition_worker;
GRANT SELECT,INSERT ON announcements TO ingenium_api;
