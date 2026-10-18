#!/usr/bin/env bash
# The upstream PostgreSQL entrypoint sources this file; keep our flags local.
(
  set +x
  set -euo pipefail
  export LC_ALL=C

  password="$(cat /run/secrets/postgres_password)"
  [[ "$password" =~ ^[0-9a-f]{64}$ ]] || { printf 'Invalid judge database password file.\n' >&2; exit 1; }

  JUDGE0_PASSWORD="$password" psql -v ON_ERROR_STOP=1 \
    --username "$POSTGRES_USER" --dbname postgres <<'SQL'
\getenv judge0_password JUDGE0_PASSWORD
CREATE ROLE judge0 WITH LOGIN NOSUPERUSER NOCREATEROLE NOREPLICATION NOBYPASSRLS CREATEDB PASSWORD :'judge0_password';
CREATE DATABASE judge0 OWNER judge0;
SQL
)
