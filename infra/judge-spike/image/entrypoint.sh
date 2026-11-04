#!/usr/bin/env bash
# Judge0 startup adaptation; GPL-3.0, see LICENSE.judge0 and root THIRD_PARTY_NOTICES.md.
set +x
set -euo pipefail
umask 077

fail() {
  printf 'Judge spike startup refused: %s\n' "$1" >&2
  exit 1
}

[[ $# -eq 1 ]] || fail 'choose exactly one server or workers role.'
case "$1" in
  /api/scripts/server|/api/scripts/workers) ;;
  *) fail 'unsupported startup role.' ;;
esac

[[ "$EUID" -eq 1000 ]] || fail 'the runtime must use the reviewed UID 1000.'
cd /api
[[ -f judge0.conf && ! -L judge0.conf && -r judge0.conf ]] || fail 'a readable, regular runtime configuration is required.'
case "$(stat -c '%u:%a' judge0.conf)" in
  1000:400|1000:600) ;;
  *) fail 'runtime configuration must belong to UID 1000 with mode 400 or 600.' ;;
esac

# No cron daemon or exported-environment file in this bounded lab image.
exec /bin/bash "$1"
