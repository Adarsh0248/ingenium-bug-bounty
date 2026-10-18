#!/usr/bin/env bash
set -euo pipefail
umask 077

image_directory="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../image" && pwd)"
[[ "$EUID" -eq 1000 ]] || { printf 'Use the documented isolated test container with UID 1000.\n' >&2; exit 1; }
[[ "$(findmnt -n -o FSTYPE --target /api)" == tmpfs && "$(findmnt -n -o TARGET --target /api)" == /api ]] || { printf 'Tests require /api to be its own disposable tmpfs mount.\n' >&2; exit 1; }
[[ -d /api && -w /api && -z "$(ls -A /api)" ]] || { printf 'Tests require an empty, disposable /api tmpfs.\n' >&2; exit 1; }
test_root="$(mktemp -d /tmp/ingenium-judge-startup-tests.XXXXXX)"
cleanup() {
  case "$test_root" in
    /tmp/ingenium-judge-startup-tests.*) rm -rf -- "$test_root" ;;
  esac
}
trap cleanup EXIT

fail() {
  printf 'FAIL: %s\n' "$1" >&2
  exit 1
}

passed=0
pass() {
  passed=$((passed + 1))
  printf 'PASS: %s\n' "$1"
}

for script in "$image_directory"/*.sh; do bash -n "$script"; done
pass 'all patched startup scripts parse as Bash'

mkdir -p /api/scripts /api/tmp/pids "$test_root/bin"
cp -- "$image_directory/server.sh" /api/scripts/server
printf '%s\n' 'AUTHN_TOKEN=synthetic-startup-token-not-a-real-credential' > /api/judge0.conf
printf '%s\n' 'set -o allexport' 'source ./judge0.conf' 'set +o allexport' > /api/scripts/load-config
printf '%s\n' '#!/bin/bash' 'printf "Synthetic worker role reached.\n"' > /api/scripts/workers
printf '%s\n' \
  '#!/bin/bash' \
  'printf "%s\n" "$*" >> "$TEST_CALL_LOG"' \
  'if [[ "$1" == db:create ]]; then exit "${TEST_MIGRATION_EXIT:-0}"; fi' \
  'if [[ "$1" == s ]]; then printf "Synthetic API stub reached.\n"; exit "${TEST_SERVER_EXIT:-0}"; fi' \
  'exit 99' > "$test_root/bin/rails"
chmod 500 "$test_root/bin/rails"
export PATH="$test_root/bin:$PATH"
export TEST_CALL_LOG="$test_root/calls"

assert_no_disclosure() {
  if grep -Fq 'synthetic-startup-token-not-a-real-credential' "$test_root/stdout" "$test_root/stderr"; then
    fail 'a synthetic credential appeared in startup output.'
  fi
  [[ ! -e /api/environment ]] || fail 'an exported-environment file was created.'
}

run_entrypoint() {
  status=0
  bash "$image_directory/entrypoint.sh" "$@" > "$test_root/stdout" 2> "$test_root/stderr" || status=$?
  assert_no_disclosure
}

run_entrypoint /api/scripts/server
[[ "$status" -eq 0 ]] || fail 'server startup was rejected.'
printf '%s\n' 'db:create db:migrate db:seed' 's -b 0.0.0.0' > "$test_root/expected-calls"
cmp -s "$test_root/expected-calls" "$TEST_CALL_LOG" || fail 'server startup commands were incorrect.'
grep -qx 'Synthetic API stub reached.' "$test_root/stdout" || fail 'the synthetic server was not reached.'
pass 'server startup loads configuration without exporting credentials to logs or disk'

chmod 400 /api/judge0.conf
run_entrypoint /api/scripts/workers
[[ "$status" -eq 0 ]] || fail 'read-only private runtime configuration was rejected.'
grep -qx 'Synthetic worker role reached.' "$test_root/stdout" || fail 'the worker role was not dispatched.'
pass 'worker role dispatch accepts a private read-only configuration'
chmod 600 /api/judge0.conf

: > "$TEST_CALL_LOG"
export TEST_MIGRATION_EXIT=23
run_entrypoint /api/scripts/server
[[ "$status" -eq 23 ]] || fail 'migration failure was not propagated.'
[[ "$(wc -l < "$TEST_CALL_LOG")" -eq 1 ]] || fail 'a server started after a failed migration.'
unset TEST_MIGRATION_EXIT
pass 'migration failure prevents API startup and is not retried'

: > "$TEST_CALL_LOG"
export TEST_SERVER_EXIT=19
run_entrypoint /api/scripts/server
[[ "$status" -eq 19 ]] || fail 'server exit status was not propagated.'
[[ "$(wc -l < "$TEST_CALL_LOG")" -eq 2 ]] || fail 'a failed API process was retried.'
unset TEST_SERVER_EXIT
pass 'the API exit status propagates without an automatic startup retry'

for role in /bin/bash /api/scripts/other; do
  run_entrypoint "$role"
  [[ "$status" -ne 0 ]] || fail 'an unsupported startup role was accepted.'
done
run_entrypoint
[[ "$status" -ne 0 ]] || fail 'an empty role was accepted.'
run_entrypoint /api/scripts/server extra
[[ "$status" -ne 0 ]] || fail 'extra arguments were accepted.'
pass 'arbitrary commands and ambiguous roles are refused'

chmod 644 /api/judge0.conf
run_entrypoint /api/scripts/server
[[ "$status" -ne 0 ]] || fail 'a world-readable configuration was accepted.'
chmod 600 /api/judge0.conf
pass 'world-readable runtime configuration is refused'

mv -- /api/judge0.conf /api/private-original.conf
ln -s private-original.conf /api/judge0.conf
run_entrypoint /api/scripts/server
[[ "$status" -ne 0 ]] || fail 'a symbolic-link configuration was accepted.'
rm -- /api/judge0.conf
pass 'symbolic-link runtime configuration is refused'

run_entrypoint /api/scripts/server
[[ "$status" -ne 0 ]] || fail 'a missing configuration was accepted.'
mv -- /api/private-original.conf /api/judge0.conf
pass 'missing runtime configuration is refused'

status=0
bash -x "$image_directory/entrypoint.sh" /api/scripts/server > "$test_root/stdout" 2> "$test_root/stderr" || status=$?
[[ "$status" -eq 0 ]] || fail 'traced startup failed.'
assert_no_disclosure
pass 'tracing is disabled before loading synthetic credentials'

printf '%s\n' 'return 17' > /api/scripts/load-config
for script in server workers; do
  status=0
  (cd /api && bash "$image_directory/$script.sh") > "$test_root/stdout" 2> "$test_root/stderr" || status=$?
  [[ "$status" -eq 17 ]] || fail 'configuration loading failure was not propagated.'
  [[ ! -s "$test_root/stdout" ]] || fail 'a role started after configuration loading failed.'
  assert_no_disclosure
done
pass 'both real startup scripts stop when configuration loading fails'

cp -- "$image_directory/../lab-server.sh" /api/scripts/server
printf '%s\n' 'set -o allexport' 'source ./judge0.conf' 'set +o allexport' > /api/scripts/load-config
write_lab_config() {
  chmod 600 /api/judge0.conf
  printf '%s\n' 'AUTHN_TOKEN=synthetic-startup-token-not-a-real-credential' \
    'MAINTENANCE_MODE=false' 'ENABLE_WAIT_RESULT=false' 'ENABLE_BATCHED_SUBMISSIONS=false' \
    'ENABLE_CALLBACKS=false' 'ENABLE_ADDITIONAL_FILES=false' 'ENABLE_NETWORK=false' \
    'ALLOW_ENABLE_NETWORK=false' > /api/judge0.conf
  chmod 400 /api/judge0.conf
}
write_lab_config
: > "$TEST_CALL_LOG"
run_entrypoint /api/scripts/server
[[ "$status" -eq 0 && "$(cat "$TEST_CALL_LOG")" == 's -b 0.0.0.0' ]] || fail 'Temporary API did not start only the server.'
pass 'temporary API keeps the original entrypoint guards and skips DB migration/seeding'

for setting in MAINTENANCE_MODE ENABLE_WAIT_RESULT ENABLE_BATCHED_SUBMISSIONS ENABLE_CALLBACKS ENABLE_ADDITIONAL_FILES ENABLE_NETWORK ALLOW_ENABLE_NETWORK; do
  write_lab_config
  chmod 600 /api/judge0.conf
  sed -i "s/^$setting=false$/$setting=true/" /api/judge0.conf
  chmod 400 /api/judge0.conf
  : > "$TEST_CALL_LOG"
  run_entrypoint /api/scripts/server
  [[ "$status" -ne 0 && ! -s "$TEST_CALL_LOG" ]] || fail 'Temporary API accepted an unexpected config flag.'
done
pass 'temporary API rejects changed maintenance, wait/batch, callback, file and network flags'

cp -- "$image_directory/../http-server.sh" /api/scripts/server
write_lab_config
chmod 600 /api/judge0.conf
sed -i 's/^MAINTENANCE_MODE=false$/MAINTENANCE_MODE=true/' /api/judge0.conf
chmod 400 /api/judge0.conf
: > "$TEST_CALL_LOG"
run_entrypoint /api/scripts/server
[[ "$status" -eq 0 && "$(cat "$TEST_CALL_LOG")" == 's -b 0.0.0.0' ]] || fail 'HTTP lab did not retain maintenance or skipped startup guards.'
pass 'HTTP admission copy starts without migration/seeding while stock submission creation stays in maintenance'

for setting in MAINTENANCE_MODE ENABLE_WAIT_RESULT ENABLE_BATCHED_SUBMISSIONS ENABLE_CALLBACKS ENABLE_ADDITIONAL_FILES ENABLE_NETWORK ALLOW_ENABLE_NETWORK; do
  write_lab_config
  chmod 600 /api/judge0.conf
  if [[ "$setting" != MAINTENANCE_MODE ]]; then
    sed -i 's/^MAINTENANCE_MODE=false$/MAINTENANCE_MODE=true/' /api/judge0.conf
    sed -i "s/^$setting=false$/$setting=true/" /api/judge0.conf
  fi
  chmod 400 /api/judge0.conf
  : > "$TEST_CALL_LOG"
  run_entrypoint /api/scripts/server
  [[ "$status" -ne 0 && ! -s "$TEST_CALL_LOG" ]] || fail 'HTTP lab accepted a relaxed runtime flag.'
done
pass 'HTTP admission copy rejects relaxed maintenance, wait/batch, callback, file and network flags'

printf '%s startup preparation tests passed. No Judge0 or database process was executed.\n' "$passed"
