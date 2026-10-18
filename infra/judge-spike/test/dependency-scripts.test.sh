#!/usr/bin/env bash
set -euo pipefail
umask 077

source_directory="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
[[ "$EUID" -eq 999 ]] || { printf 'Use the disposable UID-999 test container.\n' >&2; exit 1; }
[[ "$(findmnt -n -o FSTYPE --target /run/secrets)" == tmpfs && "$(findmnt -n -o TARGET --target /run/secrets)" == /run/secrets ]] || exit 1
[[ -z "$(ls -A /run/secrets)" ]] || exit 1
test_root="$(mktemp -d /tmp/ingenium-dependencies-tests.XXXXXX)"
cleanup() {
  case "$test_root" in
    /tmp/ingenium-dependencies-tests.*) rm -rf -- "$test_root" ;;
  esac
}
trap cleanup EXIT

fail() { printf 'FAIL: %s\n' "$1" >&2; exit 1; }
passed=0
pass() { passed=$((passed + 1)); printf 'PASS: %s\n' "$1"; }

mkdir "$test_root/bin"
printf '%s\n' '#!/bin/bash' 'printf "%s\n" "$@" > "$TEST_ROOT/args"' 'printf "%s" "${JUDGE0_PASSWORD:-}" > "$TEST_ROOT/environment"' 'if [[ "${0##*/}" == psql ]]; then cat > "$TEST_ROOT/sql"; fi' 'exit "${STUB_EXIT:-0}"' > "$test_root/bin/stub"
chmod 500 "$test_root/bin/stub"
ln -s stub "$test_root/bin/psql"
ln -s stub "$test_root/bin/redis-server"
export PATH="$test_root/bin:$PATH" TEST_ROOT="$test_root" POSTGRES_USER=postgres
synthetic="$(printf '%064d' 123)"

fixture() {
  printf '%s\n' "$synthetic" > /run/secrets/postgres_password
  printf '%s\n' "$synthetic" > /run/secrets/redis_password
  rm -f -- "$test_root/args" "$test_root/environment" "$test_root/sql" /tmp/ingenium-redis.conf
}

run_script() {
  status=0
  "$@" > "$test_root/stdout" 2> "$test_root/stderr" || status=$?
  if grep -Fq "$synthetic" "$test_root/stdout" "$test_root/stderr"; then fail 'credential was printed.'; fi
  if [[ -f "$test_root/args" ]] && grep -Fq "$synthetic" "$test_root/args"; then fail 'credential appeared in process arguments.'; fi
}

sh -n "$source_directory/redis-entrypoint.sh"
bash -n "$source_directory/init-db.sh"
pass 'both dependency scripts parse'

fixture
run_script sh "$source_directory/redis-entrypoint.sh"
[[ "$status" -eq 0 ]] || fail 'valid Redis startup failed.'
[[ "$(stat -c '%a:%u' /tmp/ingenium-redis.conf)" == '600:999' ]] || fail 'Redis config is not private.'
[[ "$(</tmp/ingenium-redis.conf)" == "requirepass $synthetic" ]] || fail 'Redis config mapping is incorrect.'
[[ ! -s "$test_root/environment" ]] || fail 'password leaked to Redis environment.'
grep -qx noeviction "$test_root/args" || fail 'queue eviction was not disabled.'
pass 'Redis receives a private config without credentials in arguments, logs or environment'

fixture
run_script bash "$source_directory/init-db.sh"
[[ "$status" -eq 0 && "$(<"$test_root/environment")" == "$synthetic" ]] || fail 'database password mapping is incorrect.'
grep -Fq "PASSWORD :'judge0_password'" "$test_root/sql" || fail 'psql password quoting is missing.'
grep -Fq 'NOSUPERUSER NOCREATEROLE NOREPLICATION NOBYPASSRLS CREATEDB' "$test_root/sql" || fail 'database role privileges are incorrect.'
grep -Fq 'CREATE DATABASE judge0 OWNER judge0;' "$test_root/sql" || fail 'database owner is incorrect.'
pass 'database initialization uses quoted psql data and a non-superuser judge role'

for name in redis-entrypoint init-db; do
  fixture
  if [[ "$name" == redis-entrypoint ]]; then shell=sh; secret=redis_password; else shell=bash; secret=postgres_password; fi
  printf 'g%063d\n' 123 > "/run/secrets/$secret"
  run_script "$shell" "$source_directory/$name.sh"
  [[ "$status" -ne 0 && ! -e "$test_root/args" ]] || fail 'invalid password started a service.'
done
pass 'both scripts reject non-hexadecimal credentials before service calls'

for name in redis-entrypoint init-db; do
  fixture
  if [[ "$name" == redis-entrypoint ]]; then shell=sh; secret=redis_password; else shell=bash; secret=postgres_password; fi
  printf '%s\n' short > "/run/secrets/$secret"
  run_script "$shell" "$source_directory/$name.sh"
  [[ "$status" -ne 0 && ! -e "$test_root/args" ]] || fail 'short password started a service.'
done
pass 'both scripts reject wrong-length credentials'

for name in redis-entrypoint init-db; do
  fixture
  if [[ "$name" == redis-entrypoint ]]; then shell=sh; secret=redis_password; else shell=bash; secret=postgres_password; fi
  rm -- "/run/secrets/$secret"
  run_script "$shell" "$source_directory/$name.sh"
  [[ "$status" -ne 0 && ! -e "$test_root/args" ]] || fail 'missing password started a service.'
done
pass 'both scripts stop on missing credentials'

for name in redis-entrypoint init-db; do
  fixture
  export STUB_EXIT=23
  if [[ "$name" == redis-entrypoint ]]; then shell=sh; else shell=bash; fi
  run_script "$shell" -x "$source_directory/$name.sh"
  [[ "$status" -eq 23 ]] || fail 'service failure was not propagated.'
  unset STUB_EXIT
done
pass 'tracing is suppressed and service failure status propagates'

printf '%s dependency script tests passed; only command stubs ran.\n' "$passed"
