#!/usr/bin/env bash
set -euo pipefail
umask 077
[[ "$EUID" -eq 0 && "$(findmnt -n -o FSTYPE --target /run)" == tmpfs && "$(findmnt -n -o TARGET --target /run)" == /run && -z "$(ls -A /run)" ]] || exit 1
source_directory="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
FIXTURE_ROOT="$(mktemp -d /tmp/ingenium-namespace-tests.XXXXXX)"
export FIXTURE_ROOT
cleanup_runtime() {
  local directory
  for directory in /run/ingenium-namespace-check.*; do
    [[ -d "$directory" && "$directory" =~ ^/run/ingenium-namespace-check\.[a-zA-Z0-9]{6}$ ]] || continue
    command rm -f -- "$directory/profile"
    command rmdir -- "$directory"
  done
}
cleanup() {
  cleanup_runtime
  case "$FIXTURE_ROOT" in /tmp/ingenium-namespace-tests.*) command rm -rf -- "$FIXTURE_ROOT" ;; esac
}
trap cleanup EXIT
fail() { printf 'FAIL: %s\n' "$1" >&2; exit 1; }
hostname() { printf '%s\n' "${STUB_HOST:-ingenium-judge-spike-01}"; }
cat() {
  case "$1" in
    /sys/module/apparmor/parameters/enabled) printf '%s\n' "${STUB_ENABLED:-Y}" ;;
    /sys/kernel/security/apparmor/profiles) printf '%s\n' "${STUB_LOADED:-docker-default (enforce)}"; return "${STUB_LIST_EXIT:-0}" ;;
    *) command cat "$@" ;;
  esac
}
grep() {
  if [[ "${*: -1}" == /opt/ingenium-judge-spike/judge0.conf ]]; then return "${STUB_MAINTENANCE_EXIT:-0}"; else command grep "$@"; fi
}
apparmor_parser() {
  printf '%s\n' "$1" >> "$FIXTURE_ROOT/sequence"
  command stat -c '%u:%g:%a' "${*: -1}" > "$FIXTURE_ROOT/profile-mode"
  case "$1" in
    --skip-kernel-load) return "${STUB_PARSE_EXIT:-0}" ;;
    --add) return "${STUB_LOAD_EXIT:-0}" ;;
    --remove) return "${STUB_UNLOAD_EXIT:-0}" ;;
    *) return 98 ;;
  esac
}
docker() {
  case "$1" in
    info) printf '%s\n' "${STUB_CGROUP:-1|cgroupfs}" ;;
    image) printf '%s\n' "${STUB_IMAGE-sha256:a0a4768705620218af104c2ad869fd087e1937815b690914512427a4b6135995|linux|amd64|judge0}" ;;
    inspect)
      if [[ "$4" == ingenium-judge-spike-api-1 ]]; then printf '%s\n' "${STUB_API_PROFILE:-docker-default}"
      else printf '%s\n' "${STUB_STATE:-false|0|ingenium-isolate-smoke-v1}"; fi
      ;;
    run)
      printf 'run\n' >> "$FIXTURE_ROOT/sequence"
      printf '%s\n' "$@" > "$FIXTURE_ROOT/args"
      printf '%s\n' "${*: -1}" > "$FIXTURE_ROOT/inner.sh"
      bash -n "$FIXTURE_ROOT/inner.sh"
      return "${STUB_RUN_EXIT:-0}"
      ;;
    rm) printf 'rm\n' >> "$FIXTURE_ROOT/sequence"; return "${STUB_REMOVE_EXIT:-0}" ;;
    *) return 98 ;;
  esac
}
export -f hostname cat grep apparmor_parser docker
fixture() {
  cleanup_runtime
  command rm -f -- "$FIXTURE_ROOT"/{sequence,args,profile-mode,inner.sh}
  unset STUB_HOST STUB_ENABLED STUB_LOADED STUB_LIST_EXIT STUB_MAINTENANCE_EXIT STUB_PARSE_EXIT STUB_LOAD_EXIT STUB_UNLOAD_EXIT STUB_CGROUP STUB_IMAGE STUB_API_PROFILE STUB_STATE STUB_RUN_EXIT STUB_REMOVE_EXIT
}
run_script() {
  status=0
  bash "$source_directory/namespace-smoke.sh" > "$FIXTURE_ROOT/stdout" 2> "$FIXTURE_ROOT/stderr" || status=$?
}
bash -n "$source_directory/namespace-smoke.sh"
fixture
run_script
[[ "$status" -eq 0 ]] || fail 'Normal stubbed flow failed.'
[[ "$(command cat "$FIXTURE_ROOT/sequence")" == $'--skip-kernel-load\n--add\nrun\nrm\n--remove' ]] || fail 'Parse/load/run/removal ordering changed.'
[[ "$(command cat "$FIXTURE_ROOT/profile-mode")" == 0:0:444 && -z "$(ls -A /run)" ]] || fail 'Private policy permissions or cleanup failed.'
grep -qx -- '--read-only' "$FIXTURE_ROOT/args"
grep -qx none "$FIXTURE_ROOT/args"
grep -qx apparmor=ingenium-isolate-smoke-v1 "$FIXTURE_ROOT/args"
grep -qx no-new-privileges=true "$FIXTURE_ROOT/args"
grep -qx /usr/bin/timeout "$FIXTURE_ROOT/args"
grep -qx 256m "$FIXTURE_ROOT/args"
grep -qx 45s "$FIXTURE_ROOT/args"
grep -q 'nosuid,nodev,exec,size=32m' "$FIXTURE_ROOT/args"
grep -qx -- '--pids-limit' "$FIXTURE_ROOT/args"
[[ "$(grep -c -- '--cap-add' "$FIXTURE_ROOT/args")" -eq 7 ]] || fail 'Unexpected capability count.'
if grep -Eq -- '--privileged|unconfined|--mount|--volume|--cg|seccomp=|PASSWORD|AUTHN' "$FIXTURE_ROOT/args"; then fail 'Unexpected host bind, credential, cgroup or security bypass.'; fi
grep -Fq -- '--run -- /usr/bin/id -u' "$FIXTURE_ROOT/inner.sh"
grep -Fq 'test "$(cat "$workspace/box/stdout")" = 60000' "$FIXTURE_ROOT/inner.sh"
grep -Fq 'test ! -s "$workspace/box/stderr"' "$FIXTURE_ROOT/inner.sh"
grep -Fq '^Seccomp:[[:space:]]+2$' "$FIXTURE_ROOT/inner.sh"
grep -Fq -- '--processes=8 --time=5 --wall-time=15 --mem=131072' "$FIXTURE_ROOT/inner.sh"
grep -Fq -- '"$compiler" -std=c++17 -O0 -Wall -Wextra -Werror /box/main.cpp -o /box/main' "$FIXTURE_ROOT/inner.sh"
grep -Fq -- '--env=TMPDIR=/box' "$FIXTURE_ROOT/inner.sh"
grep -Fq -- '--env=LD_LIBRARY_PATH=/usr/local/gcc-9.2.0/lib64' "$FIXTURE_ROOT/inner.sh"
grep -Fq 'cmp /tmp/expected "$workspace/box/stdout"' "$FIXTURE_ROOT/inner.sh"
grep -Fq 'check_sum 7 5 12' "$FIXTURE_ROOT/inner.sh"
grep -Fq 'check_sum -9 4 -5' "$FIXTURE_ROOT/inner.sh"
grep -Fq 'check_sum 2147483647 1 2147483648' "$FIXTURE_ROOT/inner.sh"
grep -Fq 'getuid() != 60000 || geteuid() != 60000' "$FIXTURE_ROOT/inner.sh"
grep -Fq 'getgid() != 60000 || getegid() != 60000' "$FIXTURE_ROOT/inner.sh"
printf 'PASS: fixed command, named policy, bounded container and ordered teardown\n'

metadata_check="$(sed -n "/^    check_metadata() {$/,/^    }$/p" "$FIXTURE_ROOT/inner.sh")"
[[ "$metadata_check" == *check_metadata* ]] || fail 'Metadata checker was not extracted.'
for result in clean nonzero status message signal killed empty missing; do
  metadata_file="$FIXTURE_ROOT/metadata"
  printf "time:0.004\nexitcode:0\n" > "$metadata_file"
  case "$result" in
    nonzero) printf "exitcode:2\n" > "$metadata_file" ;;
    status) printf "status:RE\n" >> "$metadata_file" ;;
    message) printf "message:Failed\n" >> "$metadata_file" ;;
    signal) printf "exitsig:9\n" >> "$metadata_file" ;;
    killed) printf "killed:1\n" >> "$metadata_file" ;;
    empty) : > "$metadata_file" ;;
    missing) command rm -- "$metadata_file" ;;
  esac
  metadata_status=0
  bash -c "$metadata_check; check_metadata \"\$1\"" bash "$metadata_file" > /dev/null 2>&1 || metadata_status=$?
  if [[ "$result" == clean ]]; then
    [[ "$metadata_status" -eq 0 ]] || fail 'Clean metadata was rejected.'
  else
    [[ "$metadata_status" -ne 0 ]] || fail 'Bad or missing metadata was accepted.'
  fi
done
printf 'PASS: metadata checker rejects nonzero, error, signal, empty and missing results\n'

for guard in host disabled unreadable existing cgroup image api maintenance; do
  fixture
  case "$guard" in
    host) export STUB_HOST=development-host ;;
    disabled) export STUB_ENABLED=N ;;
    unreadable) export STUB_LIST_EXIT=1 ;;
    existing) export STUB_LOADED='ingenium-isolate-smoke-v1 (enforce)' ;;
    cgroup) export STUB_CGROUP='2|systemd' ;;
    image) export STUB_IMAGE=wrong ;;
    api) export STUB_API_PROFILE=unconfined ;;
    maintenance) export STUB_MAINTENANCE_EXIT=1 ;;
  esac
  run_script
  [[ "$status" -ne 0 && ! -e "$FIXTURE_ROOT/sequence" && -z "$(ls -A /run)" ]] || fail 'A prerequisite failure caused mutation.'
done
printf 'PASS: host, AppArmor, image, API and maintenance guards fail before mutation\n'

fixture
export STUB_PARSE_EXIT=1
run_script
[[ "$status" -ne 0 && "$(command cat "$FIXTURE_ROOT/sequence")" == --skip-kernel-load && -z "$(ls -A /run)" ]] || fail 'A compile error loaded a profile or leaked temporary files.'
printf 'PASS: policy compile failure prevents loading and cleans private copy\n'

for failure in load run running wrong_profile remove unload; do
  fixture
  case "$failure" in
    load) export STUB_LOAD_EXIT=1 ;;
    run) export STUB_RUN_EXIT=17 ;;
    running) export STUB_STATE='true|0|ingenium-isolate-smoke-v1' ;;
    wrong_profile) export STUB_STATE='false|0|docker-default' ;;
    remove) export STUB_REMOVE_EXIT=1 ;;
    unload) export STUB_UNLOAD_EXIT=1 ;;
  esac
  run_script
  [[ "$status" -ne 0 && -n "$(ls -A /run)" ]] || fail 'An uncertain attempt discarded policy evidence.'
  grep -q 'Retained for inspection' "$FIXTURE_ROOT/stderr"
  if [[ "$failure" != unload ]] && grep -qx -- '--remove' "$FIXTURE_ROOT/sequence"; then fail 'An uncertain container caused automatic profile removal.'; fi
  if [[ "$failure" == run || "$failure" == running || "$failure" == wrong_profile ]] && grep -qx rm "$FIXTURE_ROOT/sequence"; then fail 'An uncertain container was automatically removed.'; fi
done
printf 'PASS: load, run, state and cleanup failures retain evidence without guessing\n'

grep -Fqx 'profile ingenium-isolate-smoke-v1 flags=(attach_disconnected,mediate_deleted) {' "$source_directory/namespace-smoke.apparmor"
[[ "$(grep -c '^[[:space:]]*mount ' "$source_directory/namespace-smoke.apparmor")" -eq 3 ]] || fail 'Unexpected mount-rule count.'
grep -Fqx '  mount options=(rw,rprivate) -> /,' "$source_directory/namespace-smoke.apparmor"
grep -Fqx '  mount fstype=tmpfs -> /var/local/lib/isolate/0/root/,' "$source_directory/namespace-smoke.apparmor"
grep -Fqx '  mount options in (rw,ro,bind,rbind,remount,nosuid,nodev) -> /var/local/lib/isolate/0/root/{box,usr,lib,lib64}/,' "$source_directory/namespace-smoke.apparmor"
grep -Fqx '  deny network,' "$source_directory/namespace-smoke.apparmor"
printf 'PASS: policy mount targets are limited to private propagation and box-zero root\n'
printf '6 namespace smoke orchestration/checker groups passed; no Judge0/compiler ran.\n'
