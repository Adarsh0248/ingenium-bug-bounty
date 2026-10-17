\set ON_ERROR_STOP on
\getenv api_password POSTGRES_API_PASSWORD

SELECT format(
  'CREATE ROLE ingenium_api LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD %L',
  :'api_password'
)
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ingenium_api')
\gexec

SELECT format('GRANT CONNECT ON DATABASE %I TO ingenium_api', current_database())
\gexec

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO ingenium_api;
