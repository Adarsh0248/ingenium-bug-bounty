#!/usr/bin/env bash
set -euo pipefail
umask 077

[[ "$EUID" -eq 0 ]] || exit 1
for mount in /run /tmp; do
  [[ "$(findmnt -n -o FSTYPE --target "$mount")" == tmpfs && "$(findmnt -n -o TARGET --target "$mount")" == "$mount" ]] || exit 1
done
[[ -z "$(ls -A /run)" ]] || exit 1
source_directory="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
FIXTURE_ROOT="$(mktemp -d /tmp/ingenium-cgroup-preflight-tests.XXXXXX)"
export FIXTURE_ROOT
cleanup_runtime() {
  [[ -f "$FIXTURE_ROOT/runtime-directories" ]] || return 0
  while IFS= read -r directory; do
    [[ "$directory" =~ ^/run/ingenium-cg-check\.[a-zA-Z0-9]{6}$ ]] || exit 1
    if [[ -d "$directory" ]]; then
      command rm -f -- "$directory/isolate.conf"
      command rmdir -- "$directory"
    fi
  done < "$FIXTURE_ROOT/runtime-directories"
}
cleanup() {
  cleanup_runtime
  case "$FIXTURE_ROOT" in /tmp/ingenium-cgroup-preflight-tests.*) command rm -rf -- "$FIXTURE_ROOT" ;; esac
}
trap cleanup EXIT
fail() { printf 'FAIL: %s\n' "$1" >&2; exit 1; }
passed=0
pass() { passed=$((passed + 1)); printf 'PASS: %s\n' "$1"; }

# Exported command stubs keep fixed production paths out of the test filesystem.
hostname() { printf '%s\n' "${STUB_HOST:-ingenium-judge-spike-01}"; }
docker() {
  case "$1" in
    info) printf '%s\n' "${STUB_CGROUP:-1|cgroupfs}" ;;
    image) printf '%s\n' "${STUB_IMAGE-sha256:a0a4768705620218af104c2ad869fd087e1937815b690914512427a4b6135995|linux|amd64|judge0}" ;;
    run)
      printf '%s\n' "$@" > "$FIXTURE_ROOT/args"
      local config
      config="$(command tail -n 1 "$FIXTURE_ROOT/runtime-directories")/isolate.conf"
      command cp -- "$config" "$FIXTURE_ROOT/config"
      command stat -c '%u:%g:%a' "$config" > "$FIXTURE_ROOT/config-mode"
      return "${STUB_RUN_EXIT:-0}"
      ;;
    *) return 98 ;;
  esac
}
readlink() {
  if [[ "$*" == '-f /sys/fs/cgroup/memory' ]]; then printf '%s\n' /sys/fs/cgroup/memory
  elif [[ "$*" == '-f /sys/fs/cgroup/cpuacct' ]]; then printf '%s\n' "${STUB_CPU_PATH:-/sys/fs/cgroup/cpu,cpuacct}"
  else command readlink "$@"; fi
}
stat() {
  if [[ "$1" == -fc && "$3" == /sys/fs/cgroup/* ]]; then printf '%s\n' "${STUB_FILESYSTEM:-cgroupfs}"; else command stat "$@"; fi
}
cat() {
  case "$1" in
    /sys/fs/cgroup/memory/memory.use_hierarchy) printf '%s\n' "${STUB_HIERARCHY-1}" ;;
    /sys/fs/cgroup/*/ingenium-cg-check.*/tasks) [[ "${STUB_TASKS:-0}" -eq 0 ]] || printf '123\n' ;;
    *) command cat "$@" ;;
  esac
}
grep() {
  if [[ "${*: -1}" == /opt/ingenium-judge-spike/judge0.conf ]]; then return "${STUB_MAINTENANCE_EXIT:-0}"; else command grep "$@"; fi
}
mktemp() {
  if [[ "$*" == '-d /sys/fs/cgroup/memory/ingenium-cg-check.XXXXXX' ]]; then
    printf 'memory\n' >> "$FIXTURE_ROOT/created"
    printf '/sys/fs/cgroup/memory/ingenium-cg-check.ABC123\n'
  else
    local directory
    directory="$(command mktemp "$@")"
    printf '%s\n' "$directory" >> "$FIXTURE_ROOT/runtime-directories"
    printf '%s\n' "$directory"
  fi
}
mkdir() {
  [[ "${*: -1}" == /sys/fs/cgroup/cpuacct/ingenium-cg-check.ABC123 ]] || return 98
  printf 'cpu\n' >> "$FIXTURE_ROOT/created"
  return "${STUB_CPU_CREATE_EXIT:-0}"
}
chmod() {
  if [[ "$1" == 0700 && "$2" == /sys/fs/cgroup/* ]]; then return 0; else command chmod "$@"; fi
}
rmdir() {
  local path="${*: -1}"
  if [[ "$path" == /sys/fs/cgroup/*/ingenium-cg-check.ABC123 ]]; then
    printf '%s\n' "$path" >> "$FIXTURE_ROOT/removed"
    return "${STUB_REMOVE_EXIT:-0}"
  fi
  command rmdir "$@"
}
export -f hostname docker readlink stat cat grep mktemp mkdir chmod rmdir

fixture() {
  cleanup_runtime
  command rm -f -- "$FIXTURE_ROOT"/{args,created,removed,config,config-mode,runtime-directories}
  unset STUB_HOST STUB_CGROUP STUB_IMAGE STUB_FILESYSTEM STUB_CPU_PATH STUB_HIERARCHY STUB_MAINTENANCE_EXIT STUB_RUN_EXIT STUB_TASKS STUB_CPU_CREATE_EXIT STUB_REMOVE_EXIT
}
run_script() {
  status=0
  bash "$source_directory/cgroup-preflight.sh" > "$FIXTURE_ROOT/stdout" 2> "$FIXTURE_ROOT/stderr" || status=$?
}
assert_no_creation() { [[ ! -e "$FIXTURE_ROOT/created" && ! -e "$FIXTURE_ROOT/args" ]] || fail 'A guard failure caused mutation.'; }

bash -n "$source_directory/cgroup-preflight.sh"
fixture
run_script
[[ "$status" -eq 0 ]] || fail 'Synthetic normal flow failed.'
[[ "$(command wc -l < "$FIXTURE_ROOT/removed")" -eq 2 ]] || fail 'Fresh parent groups were not cleaned.'
grep -qx 'PASS: host test groups removed' "$FIXTURE_ROOT/stdout" || fail 'Confirmed cleanup was not reported.'
[[ "$(command cat "$FIXTURE_ROOT/config-mode")" == '0:0:444' ]] || fail 'Probe configuration permissions are wrong.'
grep -qx 'cg_root = /run/ingenium-probe-cgroups' "$FIXTURE_ROOT/config" || fail 'Probe cgroup path is wrong.'
grep -qx 'num_boxes = 1' "$FIXTURE_ROOT/config" || fail 'Probe must allow only one box.'
grep -Fqx 'type=bind,src=/sys/fs/cgroup/memory/ingenium-cg-check.ABC123,dst=/run/ingenium-probe-cgroups/memory' "$FIXTURE_ROOT/args" || fail 'Memory bind scope is wrong.'
grep -Fqx 'type=bind,src=/sys/fs/cgroup/cpuacct/ingenium-cg-check.ABC123,dst=/run/ingenium-probe-cgroups/cpuacct' "$FIXTURE_ROOT/args" || fail 'CPU bind scope is wrong.'
[[ "$(grep -c -- '--cap-add' "$FIXTURE_ROOT/args")" -eq 1 ]] || fail 'Unexpected added capability count.'
grep -qx CHOWN "$FIXTURE_ROOT/args" || fail 'Expected CHOWN capability is missing.'
grep -qx no-new-privileges=true "$FIXTURE_ROOT/args" || fail 'Privilege escalation restriction is missing.'
grep -qx -- '--read-only' "$FIXTURE_ROOT/args" || fail 'Root filesystem is not read-only.'
grep -qx none "$FIXTURE_ROOT/args" || fail 'Network isolation is missing.'
grep -qx /usr/bin/timeout "$FIXTURE_ROOT/args" || fail 'The worker entrypoint was not replaced with a timeout.'
[[ "$(grep -c -- '--mount' "$FIXTURE_ROOT/args")" -eq 3 ]] || fail 'Unexpected host bind count.'
grep -q 'dst=/usr/local/etc/isolate,readonly$' "$FIXTURE_ROOT/args" || fail 'Static probe configuration must be read-only.'
if grep -Eq -- '--privileged|unconfined|--run|AUTHN|PASSWORD' "$FIXTURE_ROOT/args"; then fail 'The probe permits execution, broad privileges or credentials.'; fi
pass 'normal flow uses private configuration, scoped binds and only empty-group operations'

for guard in host cgroup image filesystem alias hierarchy no_hierarchy maintenance; do
  fixture
  case "$guard" in
    host) export STUB_HOST=development-host ;;
    cgroup) export STUB_CGROUP='2|systemd' ;;
    image) export STUB_IMAGE='unexpected image' ;;
    filesystem) export STUB_FILESYSTEM=cgroup2fs ;;
    alias) export STUB_CPU_PATH=/unexpected ;;
    hierarchy) export STUB_HIERARCHY='' ;;
    no_hierarchy) export STUB_HIERARCHY=0 ;;
    maintenance) export STUB_MAINTENANCE_EXIT=1 ;;
  esac
  run_script
  [[ "$status" -ne 0 ]] || fail 'An invalid host prerequisite was accepted.'
  assert_no_creation
done
pass 'host, controller, hierarchy and maintenance guards fail before mutation'

fixture
export STUB_CPU_CREATE_EXIT=1
run_script
[[ "$status" -ne 0 && "$(command wc -l < "$FIXTURE_ROOT/removed")" -eq 1 && ! -e "$FIXTURE_ROOT/args" ]] || fail 'A failed CPU-group allocation touched a group it did not create.'
grep -q '/memory/' "$FIXTURE_ROOT/removed" || fail 'The owned memory allocation was not cleaned.'
pass 'failed CPU allocation cleans only the successfully allocated memory group'

fixture
export STUB_RUN_EXIT=17
run_script
[[ "$status" -ne 0 && ! -e "$FIXTURE_ROOT/removed" ]] || fail 'An uncertain Docker outcome caused automatic cleanup.'
grep -q 'Retained for inspection' "$FIXTURE_ROOT/stderr" || fail 'Uncertain state was not reported.'
[[ -f "$(command tail -n 1 "$FIXTURE_ROOT/runtime-directories")/isolate.conf" ]] || fail 'Uncertain configuration evidence was deleted.'
pass 'Docker failure preserves all allocated evidence instead of guessing completion'

fixture
export STUB_TASKS=1
run_script
[[ "$status" -ne 0 && ! -e "$FIXTURE_ROOT/removed" ]] || fail 'Unexpected remaining tasks did not prevent cleanup.'
pass 'nonempty parent task lists prevent teardown'

fixture
export STUB_REMOVE_EXIT=1
run_script
[[ "$status" -ne 0 ]] || fail 'Failed cgroup removal was reported successful.'
[[ -f "$(command tail -n 1 "$FIXTURE_ROOT/runtime-directories")/isolate.conf" ]] || fail 'Failed cleanup discarded configuration evidence.'
pass 'cleanup errors fail visibly and retain diagnostic configuration'

printf '%s cgroup preflight host-orchestration checks passed; only command stubs ran.\n' "$passed"
