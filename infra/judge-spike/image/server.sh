#!/usr/bin/env bash
# Judge0 startup adaptation; GPL-3.0, see LICENSE.judge0 and root THIRD_PARTY_NOTICES.md.
set +x
set -euo pipefail
umask 077

source ./scripts/load-config

[[ ! -f tmp/pids/server.pid ]] || rm -f -- tmp/pids/server.pid
rails db:create db:migrate db:seed
exec rails s -b 0.0.0.0
