\set QUIET on
BEGIN;
CREATE SCHEMA ingenium_active_crash_v1;
REVOKE ALL ON SCHEMA ingenium_active_crash_v1 FROM PUBLIC;
CREATE TABLE ingenium_active_crash_v1.attempts (
    LIKE ingenium_recovery_v1.attempts INCLUDING ALL,
    drained_at timestamptz,
    drain_sha256 text CONSTRAINT active_crash_digest_check CHECK (drain_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT active_crash_state_check CHECK (state IN ('PREPARED', 'STARTED')),
    CONSTRAINT active_crash_drain_check CHECK ((drained_at IS NULL AND drain_sha256 IS NULL)
        OR (state = 'STARTED' AND drained_at IS NOT NULL AND drained_at >= started_at AND drain_sha256 IS NOT NULL))
);
REVOKE ALL ON ingenium_active_crash_v1.attempts FROM PUBLIC;
CREATE FUNCTION ingenium_active_crash_v1.guard_transition() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Evidence cannot be deleted'; END IF;
    IF NEW IS NOT DISTINCT FROM OLD THEN RETURN NEW; END IF;
    IF OLD.state = 'PREPARED' AND NEW.state = 'STARTED' AND NEW.drained_at IS NULL
       AND (to_jsonb(NEW) - ARRAY['state','owner_id','permit_count','started_at'])
           = (to_jsonb(OLD) - ARRAY['state','owner_id','permit_count','started_at']) THEN
        RETURN NEW;
    END IF;
    IF OLD.state = 'STARTED' AND OLD.drained_at IS NULL AND NEW.drained_at IS NOT NULL
       AND (to_jsonb(NEW) - ARRAY['drained_at','drain_sha256'])
           = (to_jsonb(OLD) - ARRAY['drained_at','drain_sha256']) THEN
        RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Binding, permit and drain evidence are immutable';
END;
$$;
REVOKE ALL ON FUNCTION ingenium_active_crash_v1.guard_transition() FROM PUBLIC;
CREATE TRIGGER immutable_execution BEFORE UPDATE OR DELETE ON ingenium_active_crash_v1.attempts
FOR EACH ROW EXECUTE FUNCTION ingenium_active_crash_v1.guard_transition();
COMMIT;
SELECT json_build_object('created', true);
