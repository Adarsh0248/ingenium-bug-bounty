INSERT INTO clock_health(id) VALUES (1);
--> statement-breakpoint
CREATE FUNCTION guard_clock_health() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE'
    OR (OLD.fault_latched AND (NOT NEW.fault_latched OR ROW(NEW.fault_generation,NEW.fault_reason) IS DISTINCT FROM ROW(OLD.fault_generation,OLD.fault_reason)))
    OR (NOT OLD.fault_latched AND NEW.fault_generation <> OLD.fault_generation + CASE WHEN NEW.fault_latched THEN 1 ELSE 0 END)
    OR (NEW.runtime_id IS NOT DISTINCT FROM OLD.runtime_id AND NEW.sequence<OLD.sequence)
    OR (OLD.running AND NEW.runtime_id IS DISTINCT FROM OLD.runtime_id AND NOT NEW.fault_latched) THEN
    RAISE EXCEPTION 'Clock faults and report generations cannot be reset';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER clock_health_guard BEFORE UPDATE OR DELETE ON clock_health FOR EACH ROW EXECUTE FUNCTION guard_clock_health();
CREATE TRIGGER clock_event_immutable BEFORE UPDATE OR DELETE ON clock_events FOR EACH ROW EXECUTE FUNCTION immutable_access_history();
--> statement-breakpoint
CREATE FUNCTION guard_clock_run() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' OR ROW(NEW.id,NEW.boot_id,NEW.started_observed_at) IS DISTINCT FROM ROW(OLD.id,OLD.boot_id,OLD.started_observed_at)
    OR (OLD.stopped_observed_at IS NOT NULL AND NEW IS DISTINCT FROM OLD) THEN
    RAISE EXCEPTION 'Clock runtime history is immutable except once-only stop';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER clock_run_guard BEFORE UPDATE OR DELETE ON clock_runs FOR EACH ROW EXECUTE FUNCTION guard_clock_run();
--> statement-breakpoint
CREATE FUNCTION guard_round_watermark() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.trusted_time_at IS NOT NULL AND (NEW.trusted_time_at IS NULL OR NEW.trusted_time_at<OLD.trusted_time_at) THEN
    RAISE EXCEPTION 'Round trusted time cannot go backward';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER round_watermark_guard BEFORE UPDATE ON rounds FOR EACH ROW EXECUTE FUNCTION guard_round_watermark();
REVOKE ALL ON FUNCTION guard_clock_health(),guard_clock_run(),guard_round_watermark() FROM PUBLIC;
GRANT SELECT,INSERT ON clock_runs,clock_events TO ingenium_api;
GRANT UPDATE(stopped_observed_at) ON clock_runs TO ingenium_api;
GRANT SELECT ON clock_health TO ingenium_api;
GRANT UPDATE(runtime_id,boot_id,running,fault_latched,fault_generation,fault_reason,sequence,received_ns,report,healthy_count,healthy_since_ns,healthy_last_ns,state) ON clock_health TO ingenium_api;
GRANT UPDATE(trusted_time_at) ON rounds TO ingenium_api;
