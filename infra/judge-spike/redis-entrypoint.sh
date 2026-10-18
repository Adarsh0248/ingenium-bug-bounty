#!/bin/sh
set +x
set -eu
umask 077
export LC_ALL=C

password=$(cat /run/secrets/redis_password)
case "$password" in
  ''|*[!0-9a-f]*) printf 'Invalid Redis password file.\n' >&2; exit 1 ;;
esac
[ "${#password}" -eq 64 ] || { printf 'Invalid Redis password length.\n' >&2; exit 1; }

# Keep authentication out of process arguments and the persistent data volume.
printf 'requirepass %s\n' "$password" > /tmp/ingenium-redis.conf
unset password
exec redis-server /tmp/ingenium-redis.conf \
  --bind 0.0.0.0 --protected-mode yes \
  --dir /data --appendonly yes --appendfsync everysec --save '' \
  --maxmemory 128mb --maxmemory-policy noeviction
