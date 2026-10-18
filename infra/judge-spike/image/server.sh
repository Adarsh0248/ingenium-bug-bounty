#!/usr/bin/env bash
set +x
set -euo pipefail
umask 077

source ./scripts/load-config

[[ ! -f tmp/pids/server.pid ]] || rm -f -- tmp/pids/server.pid
rails db:create db:migrate db:seed
exec rails s -b 0.0.0.0
