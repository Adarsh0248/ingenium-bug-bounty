\set ON_ERROR_STOP on
CREATE TABLE public.submissions (id bigint PRIMARY KEY);
INSERT INTO submissions VALUES (1), (2);
\ir ../recovery.sql
\ir ../http-admission.sql
\ir ../transport-admission.sql
\ir ../verdict-admission.sql

INSERT INTO ingenium_verdict_http_v1.attempts (attempt_id, host_epoch, payload_sha256, manifest_sha256, submission_id, envelope)
VALUES ('8cf9f0bd-8374-4d81-bbf5-405d0df22441', '53cb2405-35a8-4f72-909a-7fb9aab466e3', repeat('a',64), repeat('b',64), 1, '{}'),
       ('8cf9f0bd-8374-4d81-bbf5-405d0df22442', '53cb2405-35a8-4f72-909a-7fb9aab466e3', repeat('a',64), repeat('b',64), 2, '{}');
UPDATE ingenium_verdict_http_v1.attempts SET dispatched_at = clock_timestamp();
UPDATE ingenium_verdict_http_v1.attempts SET state = 'STARTED', owner_id = gen_random_uuid(), permit_count = 1, started_at = clock_timestamp();
UPDATE ingenium_verdict_http_v1.attempts SET state = 'SEALED', evidence_sha256 = repeat('c',64), evidence_json = '{"result":"fixed"}', sealed_at = clock_timestamp() WHERE submission_id = 1;
UPDATE ingenium_verdict_http_v1.attempts SET held_evidence_sha256 = repeat('d',64), held_evidence_json = '{"verdict":null,"recovery_required":true}', held_at = clock_timestamp() WHERE submission_id = 2;

DO $test$
DECLARE mutation text;
BEGIN
  FOREACH mutation IN ARRAY ARRAY[
    'UPDATE ingenium_verdict_http_v1.attempts SET permit_count = 0',
    'UPDATE ingenium_verdict_http_v1.attempts SET dispatched_at = NULL',
    'UPDATE ingenium_verdict_http_v1.attempts SET owner_id = gen_random_uuid()',
    'UPDATE ingenium_verdict_http_v1.attempts SET provider_id = gen_random_uuid()',
    'UPDATE ingenium_verdict_http_v1.attempts SET envelope = ''{"changed":true}''',
    'UPDATE ingenium_verdict_http_v1.attempts SET evidence_json = ''{}'' WHERE submission_id = 1',
    'UPDATE ingenium_verdict_http_v1.attempts SET held_evidence_json = ''{}'' WHERE submission_id = 2',
    'UPDATE ingenium_verdict_http_v1.attempts SET held_evidence_sha256 = NULL, held_evidence_json = NULL, held_at = NULL WHERE submission_id = 2',
    'UPDATE ingenium_verdict_http_v1.attempts SET state = ''SEALED'', evidence_json = ''{}'', evidence_sha256 = repeat(''e'',64), sealed_at = clock_timestamp() WHERE submission_id = 2',
    'DELETE FROM ingenium_verdict_http_v1.attempts'
  ] LOOP
    BEGIN
      EXECUTE mutation;
      RAISE EXCEPTION 'Forbidden mutation accepted' USING ERRCODE = 'P0002';
    EXCEPTION WHEN raise_exception OR check_violation THEN NULL;
    END;
  END LOOP;
  IF (SELECT count(*) FROM ingenium_verdict_http_v1.attempts WHERE permit_count = 1) <> 2
     OR (SELECT count(*) FROM ingenium_verdict_http_v1.attempts WHERE state = 'SEALED') <> 1
     OR (SELECT count(*) FROM ingenium_verdict_http_v1.attempts WHERE state = 'STARTED' AND held_evidence_json IS NOT NULL) <> 1 THEN
    RAISE EXCEPTION 'Sealed/held inventory changed';
  END IF;
END;
$test$;
SELECT 'PASS: real PostgreSQL inheritance, sealed/held transitions and ten forbidden mutations verified';
