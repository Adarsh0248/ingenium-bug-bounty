\set QUIET on
BEGIN;
CREATE SCHEMA ingenium_verdict_http_v1;
REVOKE ALL ON SCHEMA ingenium_verdict_http_v1 FROM PUBLIC;
CREATE TABLE ingenium_verdict_http_v1.attempts (
    LIKE ingenium_transport_v1.attempts INCLUDING ALL,
    held_evidence_sha256 text,
    held_evidence_json jsonb,
    held_at timestamptz,
    CONSTRAINT verdict_held_evidence CHECK (
        (held_evidence_sha256 IS NULL AND held_evidence_json IS NULL AND held_at IS NULL)
        OR (state = 'STARTED' AND evidence_json IS NULL AND held_at IS NOT NULL
            AND held_evidence_sha256 IS NOT NULL AND held_evidence_sha256 ~ '^[0-9a-f]{64}$'
            AND held_evidence_json IS NOT NULL AND jsonb_typeof(held_evidence_json) = 'object'
            AND octet_length(held_evidence_json::text) <= 2097152)
    ),
    CONSTRAINT verdict_provider_fk FOREIGN KEY (submission_id) REFERENCES public.submissions(id)
);
REVOKE ALL ON ingenium_verdict_http_v1.attempts FROM PUBLIC;
CREATE FUNCTION ingenium_verdict_http_v1.guard_transition() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Evidence cannot be deleted'; END IF;
    IF NEW IS NOT DISTINCT FROM OLD THEN RETURN NEW; END IF;
    IF OLD.dispatched_at IS NULL AND NEW.dispatched_at IS NOT NULL AND OLD.state = 'PREPARED'
       AND (to_jsonb(NEW) - 'dispatched_at') = (to_jsonb(OLD) - 'dispatched_at') THEN RETURN NEW; END IF;
    IF OLD.state = 'PREPARED' AND NEW.state = 'STARTED' AND OLD.dispatched_at IS NOT NULL
       AND (to_jsonb(NEW) - ARRAY['state','owner_id','permit_count','started_at'])
           = (to_jsonb(OLD) - ARRAY['state','owner_id','permit_count','started_at']) THEN RETURN NEW; END IF;
    IF OLD.state = 'STARTED' AND OLD.held_evidence_json IS NULL AND NEW.state = 'SEALED'
       AND (to_jsonb(NEW) - ARRAY['state','evidence_sha256','evidence_json','sealed_at'])
           = (to_jsonb(OLD) - ARRAY['state','evidence_sha256','evidence_json','sealed_at']) THEN RETURN NEW; END IF;
    IF OLD.state = 'STARTED' AND NEW.state = 'STARTED' AND OLD.held_evidence_json IS NULL AND NEW.held_evidence_json IS NOT NULL
       AND (to_jsonb(NEW) - ARRAY['held_evidence_sha256','held_evidence_json','held_at'])
           = (to_jsonb(OLD) - ARRAY['held_evidence_sha256','held_evidence_json','held_at']) THEN RETURN NEW; END IF;
    RAISE EXCEPTION 'Execution, association, held reservation and evidence are immutable';
END;
$$;
REVOKE ALL ON FUNCTION ingenium_verdict_http_v1.guard_transition() FROM PUBLIC;
CREATE TRIGGER immutable_execution BEFORE UPDATE OR DELETE ON ingenium_verdict_http_v1.attempts
FOR EACH ROW EXECUTE FUNCTION ingenium_verdict_http_v1.guard_transition();
COMMIT;
SELECT json_build_object('created', true);
