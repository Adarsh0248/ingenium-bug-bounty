-- GPL-3.0 Judge0-derived schema; see ../judge-spike/image/LICENSE.judge0.
-- Judge0 1.13.1 association schema, translated from the pinned db/schema.rb.
-- Source: https://github.com/judge0/judge0/blob/v1.13.1/db/schema.rb
-- Only the protected executor runs code; no stock Judge0 worker or public API.
-- Apply once to a NEW, empty judge database, before 001_registry.sql.
BEGIN;
CREATE TABLE public.clients (id varchar PRIMARY KEY);
CREATE TABLE public.languages (
  id serial PRIMARY KEY, name varchar, compile_cmd varchar, run_cmd varchar,
  source_file varchar, is_archived boolean DEFAULT false
);
CREATE TABLE public.submissions (
  id serial PRIMARY KEY, source_code text, language_id integer, stdin text,
  expected_output text, stdout text, status_id integer, created_at timestamp,
  finished_at timestamp, time numeric, memory integer, stderr text, token varchar,
  number_of_runs integer, cpu_time_limit numeric, cpu_extra_time numeric,
  wall_time_limit numeric, memory_limit integer, stack_limit integer,
  max_processes_and_or_threads integer,
  enable_per_process_and_thread_time_limit boolean,
  enable_per_process_and_thread_memory_limit boolean, max_file_size integer,
  compile_output text, exit_code integer, exit_signal integer, message text,
  wall_time numeric, compiler_options varchar, command_line_arguments varchar,
  redirect_stderr_to_stdout boolean, callback_url varchar, additional_files bytea,
  enable_network boolean
);
CREATE INDEX index_submissions_on_token ON public.submissions(token);
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
COMMIT;
