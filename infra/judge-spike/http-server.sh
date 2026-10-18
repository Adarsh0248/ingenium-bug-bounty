#!/bin/bash
set +x
set -euo pipefail
umask 077
source ./scripts/load-config
test "$EUID" = 1000
test "$MAINTENANCE_MODE" = true
test "$ENABLE_WAIT_RESULT" = false
test "$ENABLE_BATCHED_SUBMISSIONS" = false
test "$ENABLE_CALLBACKS" = false
test "$ENABLE_ADDITIONAL_FILES" = false
test "$ALLOW_ENABLE_NETWORK" = false
test "$ENABLE_NETWORK" = false
# The private endpoint uses the existing database without migrations or reseeding.
exec rails s -b 0.0.0.0
