#!/usr/bin/env bash
set +x
set -euo pipefail
umask 077

fail() {
  printf 'Configuration not created: %s\n' "$1" >&2
  exit 1
}

if [[ "${1:-}" == '--help' ]]; then
  printf 'Usage: bash prepare-config.sh [directory-containing-secrets]\n'
  exit 0
fi

(( $# <= 1 )) || fail 'expected at most one directory argument.'
[[ "$(uname -s)" == 'Linux' ]] || fail 'run this helper on Linux.'
cd -- "${1:-.}" || fail 'cannot open the requested directory.'

output='judge0.spike.conf'
[[ ! -e "$output" && ! -L "$output" ]] || fail "$output already exists; it was not changed."
[[ -d secrets && ! -L secrets ]] || fail 'secrets must be a real directory, not a symbolic link.'
[[ "$(stat -c '%a:%u' secrets)" == "700:$(id -u)" ]] || fail 'secrets must belong to this user and have mode 700.'

names=(postgres-password redis-password api-token admin-token rails-secret)
keys=(POSTGRES_PASSWORD REDIS_PASSWORD AUTHN_TOKEN AUTHZ_TOKEN SECRET_KEY_BASE)
lengths=(64 64 64 64 128)
values=()

for index in "${!names[@]}"; do
  path="secrets/${names[$index]}"
  length="${lengths[$index]}"
  [[ -f "$path" && ! -L "$path" ]] || fail "$path must be a regular file, not a symbolic link."
  [[ "$(stat -c '%a:%u' "$path")" == "600:$(id -u)" ]] || fail "$path must belong to this user and have mode 600."
  size="$(stat -c '%s' "$path")"
  (( size == length || size == length + 1 )) || fail "$path has an unexpected length."
  value="$(<"$path")"
  pattern="^[0-9a-f]{$length}$"
  [[ "$value" =~ $pattern ]] || fail "$path must contain only the expected lowercase hexadecimal value."
  values+=("$value")
done
unset value

# Publish a complete private file without ever replacing an existing destination.
temporary="$(mktemp './.judge0.spike.conf.XXXXXX')"
trap 'rm -f -- "$temporary"' EXIT
settings=(
  '# Local feasibility configuration. Contains credentials; never commit or print.'
  '# Not ready to mount or start until startup, identity and networking review.'
  'JUDGE0_TELEMETRY_ENABLE=false'
  'RESTART_MAX_TRIES=1'
  'MAINTENANCE_MODE=true'
  'ENABLE_WAIT_RESULT=false'
  'ENABLE_COMPILER_OPTIONS=false'
  'ENABLE_COMMAND_LINE_ARGUMENTS=false'
  'ENABLE_SUBMISSION_DELETE=false'
  'ENABLE_BATCHED_SUBMISSIONS=false'
  'ENABLE_CALLBACKS=false'
  'ENABLE_ADDITIONAL_FILES=false'
  'SUBMISSION_CACHE_DURATION=0'
  'COUNT=2'
  'MAX_QUEUE_SIZE=20'
  'AUTHN_HEADER=X-Auth-Token'
  'AUTHZ_HEADER=X-Auth-User'
  'REDIS_HOST=redis'
  'REDIS_PORT=6379'
  'POSTGRES_HOST=db'
  'POSTGRES_PORT=5432'
  'POSTGRES_DB=judge0'
  'POSTGRES_USER=judge0'
  'CPU_TIME_LIMIT=2'
  'MAX_CPU_TIME_LIMIT=4'
  'CPU_EXTRA_TIME=0'
  'MAX_CPU_EXTRA_TIME=0'
  'WALL_TIME_LIMIT=10'
  'MAX_WALL_TIME_LIMIT=15'
  'MEMORY_LIMIT=524288'
  'MAX_MEMORY_LIMIT=524288'
  'STACK_LIMIT=65536'
  'MAX_STACK_LIMIT=65536'
  'MAX_PROCESSES_AND_OR_THREADS=64'
  'MAX_MAX_PROCESSES_AND_OR_THREADS=64'
  'ENABLE_PER_PROCESS_AND_THREAD_TIME_LIMIT=false'
  'ALLOW_ENABLE_PER_PROCESS_AND_THREAD_TIME_LIMIT=false'
  'ENABLE_PER_PROCESS_AND_THREAD_MEMORY_LIMIT=false'
  'ALLOW_ENABLE_PER_PROCESS_AND_THREAD_MEMORY_LIMIT=false'
  'MAX_FILE_SIZE=16384'
  'MAX_MAX_FILE_SIZE=16384'
  'NUMBER_OF_RUNS=1'
  'MAX_NUMBER_OF_RUNS=1'
  'REDIRECT_STDERR_TO_STDOUT=false'
  'ALLOW_ENABLE_NETWORK=false'
  'ENABLE_NETWORK=false'
  'RAILS_ENV=production'
  'RAILS_MAX_THREADS=2'
  'RAILS_SERVER_PROCESSES=1'
)

{
  printf '%s\n' "${settings[@]}"
  for index in "${!keys[@]}"; do
    printf '%s=%s\n' "${keys[$index]}" "${values[$index]}"
  done
} > "$temporary"
unset values

ln -T -- "$temporary" "$output" || fail 'destination could not be created exclusively; no existing configuration was replaced.'
printf 'Created %s with mode 600.\n' "$output"
printf 'Maintenance mode is enabled; no services were started.\n'
printf 'Keep the file private. Runtime ownership, networking and startup patches are still pending.\n'
