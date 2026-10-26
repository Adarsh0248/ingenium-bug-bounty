-- Run as the schema owner only after the isolated judge passes eight-slot qualification.
BEGIN;
SET LOCAL lock_timeout = '750ms';
SET LOCAL statement_timeout = '2s';
SELECT id FROM execution_capacity_slots ORDER BY id FOR UPDATE;
INSERT INTO execution_capacity_slots(id) SELECT generate_series(3,8) ON CONFLICT(id) DO NOTHING;
COMMIT;
