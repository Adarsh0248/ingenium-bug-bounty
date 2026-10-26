-- Structural test fixture only: not a reviewed installation of the Judge0 engine/schema.
CREATE TABLE public.languages(id serial PRIMARY KEY,name text,compile_cmd text,run_cmd text,source_file text,is_archived boolean DEFAULT false);
CREATE TABLE public.submissions(id serial PRIMARY KEY,source_code text,language_id integer,stdin text,expected_output text,status_id integer,created_at timestamp,
  token text,number_of_runs integer,cpu_time_limit numeric,cpu_extra_time numeric,wall_time_limit numeric,memory_limit integer,stack_limit integer,max_processes_and_or_threads integer,
  enable_per_process_and_thread_time_limit boolean,enable_per_process_and_thread_memory_limit boolean,max_file_size integer,redirect_stderr_to_stdout boolean,enable_network boolean);
