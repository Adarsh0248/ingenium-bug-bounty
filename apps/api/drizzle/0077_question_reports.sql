CREATE TABLE "question_reports" (
	"id" uuid PRIMARY KEY NOT NULL,
	"round_id" uuid NOT NULL,
	"bounty_id" uuid NOT NULL,
	"team_round_id" uuid NOT NULL,
	"member_round_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"request_key" uuid NOT NULL,
	"fingerprint" "bytea" NOT NULL,
	"message" text NOT NULL,
	"submission_id" uuid,
	"parent_id" uuid,
	"source_digest" "bytea",
	"recorded_at" timestamp (3) with time zone NOT NULL,
	CONSTRAINT "question_report_team_bug" UNIQUE("team_round_id","bounty_id"),
	CONSTRAINT "question_report_intent" UNIQUE("member_round_id","request_key"),
	CONSTRAINT "question_report_shape" CHECK (octet_length("question_reports"."fingerprint")=32 and octet_length("question_reports"."message") between 1 and 1024 and btrim("question_reports"."message")<>''
    and (num_nonnulls("question_reports"."submission_id","question_reports"."parent_id","question_reports"."source_digest")=0 or (num_nonnulls("question_reports"."submission_id","question_reports"."parent_id","question_reports"."source_digest")=3 and octet_length("question_reports"."source_digest")=32)))
);
--> statement-breakpoint
CREATE TABLE "report_decisions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"report_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"request_key" uuid NOT NULL,
	"fingerprint" "bytea" NOT NULL,
	"verdict" text NOT NULL,
	"reason" text NOT NULL,
	"recorded_at" timestamp (3) with time zone NOT NULL,
	CONSTRAINT "question_report_decided_once" UNIQUE("report_id"),
	CONSTRAINT "report_decision_intent" UNIQUE("actor_id","request_key"),
	CONSTRAINT "report_decision_shape" CHECK ("report_decisions"."verdict" in ('UPHELD','DISMISSED') and octet_length("report_decisions"."fingerprint")=32 and octet_length("report_decisions"."reason") between 1 and 1024 and btrim("report_decisions"."reason")<>'')
);
--> statement-breakpoint
CREATE TABLE "score_adjustments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"round_id" uuid NOT NULL,
	"team_round_id" uuid NOT NULL,
	"report_id" uuid,
	"actor_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"request_key" uuid NOT NULL,
	"fingerprint" "bytea" NOT NULL,
	"expected_revision" bigint NOT NULL,
	"delta" integer NOT NULL,
	"reason" text NOT NULL,
	"recorded_at" timestamp (3) with time zone NOT NULL,
	CONSTRAINT "score_adjustment_intent" UNIQUE("actor_id","request_key"),
	CONSTRAINT "score_adjustment_shape" CHECK ("score_adjustments"."expected_revision">0 and "score_adjustments"."delta" between -1000000 and 1000000 and "score_adjustments"."delta"<>0 and octet_length("score_adjustments"."fingerprint")=32 and octet_length("score_adjustments"."reason") between 1 and 1024 and btrim("score_adjustments"."reason")<>'')
);
--> statement-breakpoint
ALTER TABLE "question_reports" ADD CONSTRAINT "question_reports_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_reports" ADD CONSTRAINT "question_reports_bounty_id_bounties_id_fk" FOREIGN KEY ("bounty_id") REFERENCES "public"."bounties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_reports" ADD CONSTRAINT "question_reports_team_round_id_team_rounds_id_fk" FOREIGN KEY ("team_round_id") REFERENCES "public"."team_rounds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_reports" ADD CONSTRAINT "question_reports_member_round_id_member_rounds_id_fk" FOREIGN KEY ("member_round_id") REFERENCES "public"."member_rounds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_reports" ADD CONSTRAINT "question_reports_session_id_participant_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."participant_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_reports" ADD CONSTRAINT "question_reports_submission_id_competition_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."competition_submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_reports" ADD CONSTRAINT "question_reports_parent_id_participant_judging_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."participant_judging"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_decisions" ADD CONSTRAINT "report_decisions_report_id_question_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."question_reports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_decisions" ADD CONSTRAINT "report_decisions_actor_id_staff_identities_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."staff_identities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_decisions" ADD CONSTRAINT "report_decisions_session_id_staff_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."staff_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "score_adjustments" ADD CONSTRAINT "score_adjustments_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "score_adjustments" ADD CONSTRAINT "score_adjustments_team_round_id_team_rounds_id_fk" FOREIGN KEY ("team_round_id") REFERENCES "public"."team_rounds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "score_adjustments" ADD CONSTRAINT "score_adjustments_report_id_question_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."question_reports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "score_adjustments" ADD CONSTRAINT "score_adjustments_actor_id_staff_identities_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."staff_identities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "score_adjustments" ADD CONSTRAINT "score_adjustments_session_id_staff_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."staff_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "question_report_queue" ON "question_reports" USING btree ("round_id","recorded_at","id");--> statement-breakpoint
CREATE INDEX "score_adjustment_round" ON "score_adjustments" USING btree ("round_id","recorded_at","id");
--> statement-breakpoint
CREATE FUNCTION validate_question_report() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE s public.participant_sessions%ROWTYPE;
BEGIN
  s:=public.workbench_authority(NEW.session_id,NEW.round_id,NEW.bounty_id);
  IF s.member_round_id<>NEW.member_round_id OR NOT EXISTS(SELECT 1 FROM public.member_rounds m WHERE m.id=s.member_round_id AND m.team_round_id=NEW.team_round_id)
    OR NEW.recorded_at<s.created_at OR NEW.recorded_at>clock_timestamp() OR (SELECT count(*) FROM public.question_reports)>=100000 THEN
    RAISE EXCEPTION 'Report authority or capacity unavailable'; END IF;
  IF NEW.parent_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.participant_judging p
    WHERE p.id=NEW.parent_id AND p.submission_id=NEW.submission_id AND p.lane='OFFICIAL' AND p.round_id=NEW.round_id
      AND p.bounty_id=NEW.bounty_id AND p.team_round_id=NEW.team_round_id AND p.source IS NOT NULL
      AND sha256(p.source)=NEW.source_digest AND p.created_at<=NEW.recorded_at) THEN RAISE EXCEPTION 'Report submission binding mismatch'; END IF;
  RETURN NEW;
END $$;
CREATE FUNCTION validate_report_staff_write() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE stage uuid; r public.rounds%ROWTYPE; n timestamptz:=date_trunc('milliseconds',clock_timestamp());
BEGIN
  PERFORM id FROM public.security_control WHERE id=1 FOR UPDATE;
  IF TG_TABLE_NAME='report_decisions' THEN SELECT round_id INTO stage FROM public.question_reports WHERE id=NEW.report_id;
  ELSE stage:=NEW.round_id; END IF;
  SELECT * INTO r FROM public.rounds WHERE id=stage FOR UPDATE;
  IF public.restore_is_quarantined() OR (SELECT fault_latched FROM public.clock_health WHERE id=1) OR r.id IS NULL OR NEW.recorded_at<n-interval '3 seconds'
    OR (SELECT count(*) FROM public.report_decisions)+(SELECT count(*) FROM public.score_adjustments)>=100000
    OR NOT EXISTS(SELECT 1 FROM public.staff_sessions s JOIN public.staff_session_slots z ON z.staff_id=s.staff_id AND z.session_id=s.id
    JOIN public.staff_identities i ON i.id=s.staff_id JOIN public.access_credentials c ON c.id=s.credential_id AND c.version=s.credential_version AND c.staff_id=s.staff_id
    WHERE s.id=NEW.session_id AND s.staff_id=NEW.actor_id AND s.mode='NORMAL' AND s.revoked_at IS NULL AND c.revoked_at IS NULL AND i.disabled_at IS NULL
      AND i.role IN ('OWNER','SUPER_ADMIN') AND c.issued_at<=NEW.recorded_at AND s.created_at<=NEW.recorded_at AND s.last_activity_at<=NEW.recorded_at
      AND n<s.absolute_expires_at AND n<s.last_activity_at+interval '15 minutes' AND NEW.recorded_at<=n) THEN
    RAISE EXCEPTION 'Current owner authority required' USING ERRCODE='42501'; END IF;
  IF TG_TABLE_NAME='score_adjustments' THEN
    IF r.state<>'CLOSED' OR r.revision<>NEW.expected_revision OR NOT EXISTS(SELECT 1 FROM public.round_results WHERE round_id=stage)
      OR NOT EXISTS(SELECT 1 FROM public.team_rounds WHERE id=NEW.team_round_id AND round_id=stage)
      OR (NEW.report_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.question_reports q JOIN public.report_decisions d ON d.report_id=q.id
        WHERE q.id=NEW.report_id AND q.round_id=stage AND q.team_round_id=NEW.team_round_id AND d.verdict='UPHELD')) THEN
      RAISE EXCEPTION 'Final score adjustment binding or revision mismatch'; END IF;
  ELSIF NOT EXISTS(SELECT 1 FROM public.question_reports WHERE id=NEW.report_id AND recorded_at<=NEW.recorded_at) THEN
    RAISE EXCEPTION 'Report decision time mismatch';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER question_report_authority BEFORE INSERT ON question_reports FOR EACH ROW EXECUTE FUNCTION validate_question_report();
CREATE TRIGGER report_decision_authority BEFORE INSERT ON report_decisions FOR EACH ROW EXECUTE FUNCTION validate_report_staff_write();
CREATE TRIGGER score_adjustment_authority BEFORE INSERT ON score_adjustments FOR EACH ROW EXECUTE FUNCTION validate_report_staff_write();
CREATE TRIGGER question_report_immutable BEFORE UPDATE OR DELETE ON question_reports FOR EACH ROW EXECUTE FUNCTION immutable_access_history();
CREATE TRIGGER report_decision_immutable BEFORE UPDATE OR DELETE ON report_decisions FOR EACH ROW EXECUTE FUNCTION immutable_access_history();
CREATE TRIGGER score_adjustment_immutable BEFORE UPDATE OR DELETE ON score_adjustments FOR EACH ROW EXECUTE FUNCTION immutable_access_history();
--> statement-breakpoint
CREATE FUNCTION competition_display_standings(stage uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path=pg_catalog,public AS $$
DECLARE original jsonb; adjusted jsonb;
BEGIN
  SELECT standings INTO original FROM public.round_results WHERE round_id=stage;
  IF original IS NULL THEN RETURN public.competition_standings(stage); END IF;
  IF NOT EXISTS(SELECT 1 FROM public.score_adjustments WHERE round_id=stage) THEN RETURN original; END IF;
  WITH totals AS (
    SELECT x.value AS row_data,(x.value->>'points')::bigint+coalesce(a.delta,0) AS points,
      (x.value->>'effective_time_ms')::bigint effective_time_ms,
      ARRAY(SELECT jsonb_array_elements_text(x.value->'difficulties')::integer) difficulties
    FROM jsonb_array_elements(original) x LEFT JOIN (
      SELECT team_round_id,sum(delta)::bigint delta FROM public.score_adjustments WHERE round_id=stage GROUP BY team_round_id
    ) a ON a.team_round_id=(x.value->>'team_round_id')::uuid
  ), positions AS (
    SELECT *,rank() OVER(ORDER BY points DESC,effective_time_ms,difficulties DESC) position FROM totals
  ) SELECT jsonb_agg(row_data||jsonb_build_object('points',points,'rank',position) ORDER BY position,row_data->>'team_round_id') INTO adjusted FROM positions;
  RETURN adjusted;
END $$;
CREATE FUNCTION score_adjustment_changed() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  UPDATE public.rounds SET revision=revision+1 WHERE id=NEW.round_id;
  RETURN NEW;
END $$;
CREATE TRIGGER score_adjustment_delivery AFTER INSERT ON score_adjustments FOR EACH ROW EXECUTE FUNCTION score_adjustment_changed();
--> statement-breakpoint
-- Qualify using corrections present at the locking decision; later corrections never rewrite the locked roster.
DO $$
DECLARE definition text; marker text:='old=public.competition_qualifiers(q.standings,p->''reveal'');';
BEGIN
  SELECT pg_get_functiondef('public.competition_staff_command(uuid,uuid,uuid,bigint,text,jsonb,text,bytea)'::regprocedure) INTO definition;
  IF length(definition)-length(replace(definition,marker,''))<>length(marker) THEN RAISE EXCEPTION 'Unexpected qualification definition'; END IF;
  EXECUTE replace(definition,marker,'old=public.competition_qualifiers(public.competition_display_standings(subject),p->''reveal'');');
END $$;
--> statement-breakpoint
-- Keep submitted code available while its report is awaiting a decision, without making a second code copy.
DO $$
DECLARE definition text; marker text:='  IF public.retention_fields(kind) IS NULL THEN RETURN false; END IF;';
BEGIN
  SELECT pg_get_functiondef('public.retention_eligible(text,uuid,timestamptz)'::regprocedure) INTO definition;
  IF length(definition)-length(replace(definition,marker,''))<>length(marker) THEN RAISE EXCEPTION 'Unexpected retention definition'; END IF;
  EXECUTE replace(definition,marker,marker||E'\n  IF kind IN (''participant_judging'',''competition_submissions'') AND EXISTS(SELECT 1 FROM public.question_reports q WHERE\n    ((kind=''participant_judging'' AND q.parent_id=target) OR (kind=''competition_submissions'' AND q.submission_id=target))\n    AND NOT EXISTS(SELECT 1 FROM public.report_decisions d WHERE d.report_id=q.id)) THEN RETURN false; END IF;');
END $$;
REVOKE ALL ON question_reports,report_decisions,score_adjustments FROM PUBLIC,ingenium_api,ingenium_competition_worker;
GRANT SELECT,INSERT ON question_reports,report_decisions,score_adjustments TO ingenium_api;
REVOKE ALL ON FUNCTION validate_question_report(),validate_report_staff_write(),score_adjustment_changed(),competition_display_standings(uuid) FROM PUBLIC,ingenium_api,ingenium_competition_worker;
GRANT EXECUTE ON FUNCTION competition_display_standings(uuid) TO ingenium_api;
