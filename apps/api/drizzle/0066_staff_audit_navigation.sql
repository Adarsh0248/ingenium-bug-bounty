-- Read-only audit navigation indexes; canonical records and privileges are unchanged.
CREATE INDEX audit_nav_round ON competition_outcomes(recorded_at,id) WHERE staff_session_id IS NOT NULL;
CREATE INDEX audit_nav_arena ON arena_setup_outcomes(recorded_at,id);
CREATE INDEX audit_nav_discipline ON discipline_outcomes(recorded_at,id);
CREATE INDEX audit_nav_replacement ON replacement_decisions(recorded_at,id);
CREATE INDEX audit_nav_team ON team_management_outcomes(recorded_at,id);
CREATE INDEX audit_nav_import ON registration_import_outcomes(recorded_at,id);
CREATE INDEX audit_nav_content ON content_outcomes(recorded_at,id);
CREATE INDEX audit_nav_content_read ON content_read_audits(recorded_at,id);
CREATE INDEX audit_nav_preparation ON validation_preparation_outcomes(recorded_at,id);
CREATE INDEX audit_nav_snapshot_read ON validation_snapshot_audits(recorded_at,id);
CREATE INDEX audit_nav_validation ON validation_run_outcomes(recorded_at,id);
CREATE INDEX audit_nav_report_read ON validation_run_audits(recorded_at,id);
CREATE INDEX audit_nav_publication ON content_publication_outcomes(recorded_at,id);
CREATE INDEX audit_nav_submission_review ON submission_review_audits(recorded_at,id);
CREATE INDEX audit_nav_diagnostic ON validation_diagnostic_audits(recorded_at,id);
CREATE INDEX audit_nav_clock ON clock_clearances(recorded_at,id);
CREATE INDEX audit_nav_staff ON staff_management_outcomes(recorded_at,id);
