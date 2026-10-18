#!/usr/bin/env bash
set +x
set -euo pipefail
umask 077

source ./scripts/load-config
[[ "$EUID" -eq 1000 && "$MAINTENANCE_MODE" == false ]]
[[ "$ENABLE_WAIT_RESULT" == false && "$ENABLE_BATCHED_SUBMISSIONS" == false ]]
[[ "$ENABLE_CALLBACKS" == false && "$ENABLE_ADDITIONAL_FILES" == false ]]
[[ "$ENABLE_NETWORK" == false && "$ALLOW_ENABLE_NETWORK" == false ]]

# The existing lab DB is already seeded; this temporary API must not reseed it.
exec rails s -b 0.0.0.0
