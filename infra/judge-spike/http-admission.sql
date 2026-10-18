\set QUIET on
BEGIN;
CREATE SCHEMA ingenium_http_v1;
REVOKE ALL ON SCHEMA ingenium_http_v1 FROM PUBLIC;
CREATE TABLE ingenium_http_v1.attempts (
    LIKE ingenium_recovery_v1.attempts INCLUDING ALL,
    submission_id bigint NOT NULL UNIQUE REFERENCES public.submissions(id),
    envelope jsonb NOT NULL CHECK (jsonb_typeof(envelope) = 'object'),
    dispatched_at timestamptz
);
REVOKE ALL ON ingenium_http_v1.attempts FROM PUBLIC;
CREATE FUNCTION ingenium_http_v1.guard_transition() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Evidence cannot be deleted'; END IF;
    IF ROW(NEW.attempt_id, NEW.provider_id, NEW.host_epoch, NEW.payload_sha256,
           NEW.manifest_sha256, NEW.submission_id, NEW.envelope)
       IS DISTINCT FROM ROW(OLD.attempt_id, OLD.provider_id, OLD.host_epoch, OLD.payload_sha256,
                            OLD.manifest_sha256, OLD.submission_id, OLD.envelope) THEN
        RAISE EXCEPTION 'Provider association is immutable';
    END IF;
    IF NEW IS NOT DISTINCT FROM OLD THEN RETURN NEW; END IF;
    IF OLD.dispatched_at IS NULL AND NEW.dispatched_at IS NOT NULL
       AND OLD.state = 'PREPARED'
       AND (to_jsonb(NEW) - 'dispatched_at') = (to_jsonb(OLD) - 'dispatched_at') THEN
        RETURN NEW;
    END IF;
    IF NEW.dispatched_at IS DISTINCT FROM OLD.dispatched_at THEN
        RAISE EXCEPTION 'Outbox send cannot be reset';
    END IF;
    IF OLD.state = 'PREPARED' AND NEW.state = 'STARTED' AND OLD.dispatched_at IS NOT NULL THEN
        RETURN NEW;
    END IF;
    IF OLD.state = 'STARTED' AND NEW.state = 'SEALED'
       AND NEW.owner_id = OLD.owner_id AND NEW.started_at = OLD.started_at THEN
        RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Execution cannot be reset or evidence replaced';
END;
$$;
REVOKE ALL ON FUNCTION ingenium_http_v1.guard_transition() FROM PUBLIC;
CREATE TRIGGER immutable_execution BEFORE UPDATE OR DELETE ON ingenium_http_v1.attempts
FOR EACH ROW EXECUTE FUNCTION ingenium_http_v1.guard_transition();
COMMIT;
SELECT json_build_object('created', true);
