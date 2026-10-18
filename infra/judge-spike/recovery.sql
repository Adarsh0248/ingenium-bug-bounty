\set QUIET on
BEGIN;
CREATE SCHEMA ingenium_recovery_v1;
REVOKE ALL ON SCHEMA ingenium_recovery_v1 FROM PUBLIC;
CREATE TABLE ingenium_recovery_v1.attempts (
    attempt_id uuid PRIMARY KEY,
    provider_id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    host_epoch uuid NOT NULL,
    payload_sha256 text NOT NULL CHECK (payload_sha256 ~ '^[0-9a-f]{64}$'),
    manifest_sha256 text NOT NULL CHECK (manifest_sha256 ~ '^[0-9a-f]{64}$'),
    state text NOT NULL DEFAULT 'PREPARED',
    owner_id uuid,
    permit_count integer NOT NULL DEFAULT 0,
    evidence_sha256 text CHECK (evidence_sha256 ~ '^[0-9a-f]{64}$'),
    started_at timestamptz,
    sealed_at timestamptz,
    CHECK (
        (state = 'PREPARED' AND owner_id IS NULL AND permit_count = 0
         AND started_at IS NULL AND sealed_at IS NULL AND evidence_sha256 IS NULL)
        OR (state = 'STARTED' AND owner_id IS NOT NULL AND permit_count = 1
            AND started_at IS NOT NULL AND sealed_at IS NULL AND evidence_sha256 IS NULL)
        OR (state = 'SEALED' AND owner_id IS NOT NULL AND permit_count = 1
            AND started_at IS NOT NULL AND sealed_at IS NOT NULL AND sealed_at >= started_at AND evidence_sha256 IS NOT NULL)
    )
);
REVOKE ALL ON ingenium_recovery_v1.attempts FROM PUBLIC;
CREATE FUNCTION ingenium_recovery_v1.guard_transition() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Lab evidence cannot be deleted';
    END IF;
    IF ROW(NEW.attempt_id, NEW.provider_id, NEW.host_epoch, NEW.payload_sha256, NEW.manifest_sha256)
       IS DISTINCT FROM ROW(OLD.attempt_id, OLD.provider_id, OLD.host_epoch, OLD.payload_sha256, OLD.manifest_sha256) THEN
        RAISE EXCEPTION 'Execution binding is immutable';
    END IF;
    IF NEW IS NOT DISTINCT FROM OLD THEN RETURN NEW; END IF;
    IF OLD.state = 'PREPARED' AND NEW.state = 'STARTED' THEN RETURN NEW; END IF;
    IF OLD.state = 'STARTED' AND NEW.state = 'SEALED'
       AND NEW.owner_id = OLD.owner_id AND NEW.started_at = OLD.started_at THEN RETURN NEW; END IF;
    RAISE EXCEPTION 'Execution cannot be reset or evidence replaced';
END;
$$;
REVOKE ALL ON FUNCTION ingenium_recovery_v1.guard_transition() FROM PUBLIC;
CREATE TRIGGER immutable_execution BEFORE UPDATE OR DELETE ON ingenium_recovery_v1.attempts
FOR EACH ROW EXECUTE FUNCTION ingenium_recovery_v1.guard_transition();
COMMIT;
SELECT json_build_object('created', true);
