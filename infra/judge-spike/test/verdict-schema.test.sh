#!/usr/bin/env bash
set -euo pipefail
[[ "$EUID" -ne 0 && "$(findmnt -n -o FSTYPE --target /tmp)" == tmpfs ]] || exit 1
root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
work="$(mktemp -d /tmp/ingenium-verdict-schema.XXXXXX)"
mkdir "$work/socket"
initdb -D "$work/data" --auth=trust --no-locale --encoding=UTF8 > /dev/null
pg_ctl -D "$work/data" -l "$work/server.log" -o "-k $work/socket -h '' -F -c shared_buffers=16MB -c max_connections=10" -w start > /dev/null
trap 'pg_ctl -D "$work/data" -m immediate -w stop > /dev/null' EXIT
psql -X -h "$work/socket" -U postgres -d postgres -At -f "$root/verdict-schema.test.sql"
