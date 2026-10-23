CREATE FUNCTION operations_observation() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
  SELECT jsonb_build_object(
    'observed_at',date_trunc('milliseconds',statement_timestamp()),
    'quarantined',public.restore_is_quarantined(),
    'clock_state',(SELECT state FROM public.clock_health WHERE id=1),
    'clock_fault',(SELECT fault_latched FROM public.clock_health WHERE id=1),
    'clock_running',(SELECT running FROM public.clock_health WHERE id=1),
    'database_bytes',pg_database_size(current_database())::text,
    'connections',(SELECT coalesce(sum(numbackends),0)::bigint::text FROM pg_stat_database),
    'connection_limit',current_setting('max_connections'),
    'waiting_locks',(SELECT count(*)::text FROM pg_locks WHERE database=(SELECT oid FROM pg_database WHERE datname=current_database()) AND NOT granted),
    'official_pending',(SELECT count(*)::text FROM public.participant_judging WHERE lane='OFFICIAL' AND completed_at IS NULL AND status<>'CANCELLED'),
    'sample_pending',(SELECT count(*)::text FROM public.participant_judging WHERE lane='SAMPLE' AND completed_at IS NULL AND status<>'CANCELLED'),
    'official_age_ms',(SELECT coalesce(floor(extract(epoch FROM statement_timestamp()-min(created_at))*1000),0)::bigint::text FROM public.participant_judging WHERE lane='OFFICIAL' AND completed_at IS NULL AND status<>'CANCELLED'),
    'validation_pending',(SELECT count(*)::text FROM public.validation_runs WHERE status IN ('QUEUED','RUNNING')),
    'physical_holds',(SELECT count(*)::text FROM public.execution_capacity_slots WHERE num_nonnulls(authoring_attempt_id,participant_attempt_id)>0),
    'physical_slots',(SELECT count(*)::text FROM public.execution_capacity_slots),
    'quarantined_epochs',(SELECT count(*)::text FROM public.judge_host_epochs WHERE state='QUARANTINED'),
    'outbox_rows',(SELECT rows::text FROM public.live_control WHERE id=1),
    'outbox_reserved',(SELECT reserved::text FROM public.live_control WHERE id=1),
    'outbox_unpublished',(SELECT count(*)::text FROM public.live_deliveries WHERE published_at IS NULL),
    'outbox_age_ms',(SELECT coalesce(floor(extract(epoch FROM statement_timestamp()-min(created_at))*1000),0)::bigint::text FROM public.live_deliveries WHERE published_at IS NULL),
    'participant_accounted_bytes',public.workbench_usage(NULL)::text,
    'quota_keys',(SELECT count(*)::text FROM public.quota_buckets),
    'retention_age_ms',(SELECT CASE WHEN count(*)=2 AND bool_and(last_completed_at IS NOT NULL)
      THEN floor(extract(epoch FROM statement_timestamp()-min(last_completed_at))*1000)::bigint::text ELSE NULL END FROM public.retention_progress)
  )
$$;
REVOKE ALL ON FUNCTION operations_observation() FROM PUBLIC,ingenium_competition_worker;
GRANT EXECUTE ON FUNCTION operations_observation() TO ingenium_api;
