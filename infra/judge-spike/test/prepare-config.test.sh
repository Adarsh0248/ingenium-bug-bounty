#!/usr/bin/env bash
set -euo pipefail
umask 077

helper="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)/prepare-config.sh"
test_root="$(mktemp -d /tmp/ingenium-judge-config-tests.XXXXXX)"
cleanup() {
  case "$test_root" in
    /tmp/ingenium-judge-config-tests.*) rm -rf -- "$test_root" ;;
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

fixture() {
  directory="$(mktemp -d "$test_root/case with spaces.XXXXXX")"
  mkdir -m 700 "$directory/secrets"
  printf '%064d\n' 1 > "$directory/secrets/postgres-password"
  printf '%064d\n' 2 > "$directory/secrets/redis-password"
  printf '%064d\n' 3 > "$directory/secrets/api-token"
  printf '%064d\n' 4 > "$directory/secrets/admin-token"
  printf '%0128d\n' 5 > "$directory/secrets/rails-secret"
}

assert_no_secret_output() {
  for secret in "$directory"/secrets/*; do
    [[ -f "$secret" ]] || continue
    if grep -F -f "$secret" "$directory/stdout" "$directory/stderr" > /dev/null; then
      fail 'a synthetic credential appeared in command output.'
    fi
  done
}

expect_failure() {
  if bash "$helper" "$directory" > "$directory/stdout" 2> "$directory/stderr"; then
    fail 'invalid input unexpectedly succeeded.'
  fi
  [[ ! -e "$directory/judge0.spike.conf" ]] || fail 'invalid input created a configuration.'
}

fixture
bash "$helper" "$directory" > "$directory/stdout" 2> "$directory/stderr"
configuration="$directory/judge0.spike.conf"
[[ "$(stat -c '%a:%u' "$configuration")" == "600:$(id -u)" ]] || fail 'output permissions or owner are incorrect.'
grep -qx 'MAINTENANCE_MODE=true' "$configuration" || fail 'maintenance mode is missing.'
grep -qx 'COUNT=2' "$configuration" || fail 'development worker count is incorrect.'
grep -qx 'ALLOW_ENABLE_NETWORK=false' "$configuration" || fail 'network override is not disabled.'
grep -qx 'MAX_NUMBER_OF_RUNS=1' "$configuration" || fail 'repeated execution is not disabled.'
for name in ENABLE_WAIT_RESULT ENABLE_COMPILER_OPTIONS ENABLE_COMMAND_LINE_ARGUMENTS ENABLE_SUBMISSION_DELETE ENABLE_BATCHED_SUBMISSIONS ENABLE_CALLBACKS ENABLE_ADDITIONAL_FILES; do
  grep -qx "$name=false" "$configuration" || fail 'an optional submission feature is enabled.'
done
bash -n "$configuration"
bash -c 'source "$1"; [[ "$AUTHN_TOKEN" == "$(<"$2/api-token")" && "$POSTGRES_PASSWORD" == "$(<"$2/postgres-password")" && "$REDIS_PASSWORD" == "$(<"$2/redis-password")" && "$AUTHZ_TOKEN" == "$(<"$2/admin-token")" && "$SECRET_KEY_BASE" == "$(<"$2/rails-secret")" ]]' bash "$configuration" "$directory/secrets" || fail 'credential mapping is incorrect.'
assert_no_secret_output
pass 'valid credentials produce a private, parseable configuration without disclosure'

cp -- "$configuration" "$directory/original.conf"
if bash "$helper" "$directory" > "$directory/stdout" 2> "$directory/stderr"; then
  fail 'an existing configuration was overwritten.'
fi
cmp -s "$directory/original.conf" "$configuration" || fail 'existing configuration changed.'
assert_no_secret_output
pass 'repeat execution preserves existing configuration and credentials'

fixture
printf 'not-hex\n' > "$directory/secrets/api-token"
expect_failure
pass 'malformed credential is rejected'

fixture
printf 'g%063d\n' 3 > "$directory/secrets/api-token"
expect_failure
pass 'correct-length non-hexadecimal credential is rejected'

fixture
rm -- "$directory/secrets/redis-password"
expect_failure
pass 'missing credential is rejected before output creation'

fixture
chmod 644 "$directory/secrets/api-token"
expect_failure
pass 'world-readable credential is rejected'

fixture
chmod 755 "$directory/secrets"
expect_failure
pass 'publicly accessible secret directory is rejected'

fixture
mv -- "$directory/secrets/api-token" "$directory/token-original"
ln -s ../token-original "$directory/secrets/api-token"
expect_failure
pass 'symbolic-link credential is rejected'

fixture
mv -- "$directory/secrets" "$directory/secrets-original"
ln -s secrets-original "$directory/secrets"
expect_failure
pass 'symbolic-link secret directory is rejected'

fixture
printf 'preserve\n' > "$directory/protected-file"
ln -s protected-file "$directory/judge0.spike.conf"
if bash "$helper" "$directory" > "$directory/stdout" 2> "$directory/stderr"; then
  fail 'symbolic-link destination was accepted.'
fi
[[ "$(<"$directory/protected-file")" == 'preserve' ]] || fail 'symbolic-link target was changed.'
pass 'symbolic-link destination cannot overwrite another file'

fixture
ln -s missing-target "$directory/judge0.spike.conf"
if bash "$helper" "$directory" > "$directory/stdout" 2> "$directory/stderr"; then
  fail 'dangling symbolic-link destination was accepted.'
fi
[[ ! -e "$directory/missing-target" ]] || fail 'dangling symbolic-link target was created.'
pass 'dangling symbolic-link destination is rejected'

fixture
mkdir "$directory/judge0.spike.conf"
if bash "$helper" "$directory" > "$directory/stdout" 2> "$directory/stderr"; then
  fail 'a directory destination was accepted.'
fi
[[ -z "$(ls -A "$directory/judge0.spike.conf")" ]] || fail 'configuration was written inside the destination directory.'
pass 'directory destination is rejected without publishing credentials inside it'

fixture
bash -x "$helper" "$directory" > "$directory/stdout" 2> "$directory/stderr"
assert_no_secret_output
pass 'shell tracing is disabled before any credential is read'

fixture
printf '%064d' 3 > "$directory/secrets/api-token"
bash "$helper" "$directory" > "$directory/stdout" 2> "$directory/stderr"
assert_no_secret_output
pass 'a valid credential without a final newline is accepted'

printf '%s configuration preparation tests passed.\n' "$passed"
