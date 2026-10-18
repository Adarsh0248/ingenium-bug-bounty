#!/usr/bin/env bash
set -euo pipefail
umask 077
[[ "$EUID" -eq 0 ]] || exit 1
for path in /run /tmp /opt; do
  [[ "$(findmnt -n -o FSTYPE --target "$path")" == tmpfs && "$(findmnt -n -o TARGET --target "$path")" == "$path" ]] || exit 1
done
[[ -z "$(ls -A /run)" ]] || exit 1
source_directory="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
FIXTURE_ROOT="$(mktemp -d /tmp/ingenium-cg-smoke-tests.XXXXXX)"
export FIXTURE_ROOT
cleanup_runtime() {
  local directory
  for directory in /run/ingenium-cg-run.*; do
    [[ -d "$directory" && "$directory" =~ ^/run/ingenium-cg-run\.[a-zA-Z0-9]{6}$ ]] || continue
    command rm -f -- "$directory/profile" "$directory/isolate.conf"
    command rmdir -- "$directory"
  done
}
cleanup() {
  cleanup_runtime
  case "$FIXTURE_ROOT" in /tmp/ingenium-cg-smoke-tests.*) command rm -rf -- "$FIXTURE_ROOT" ;; esac
}
trap cleanup EXIT
fail() { printf 'FAIL: %s\n' "$1" >&2; exit 1; }
model_path() {
  local relative="${1#/sys/fs/cgroup/}"
  [[ "$relative" != cpuacct/* ]] || relative="cpu,cpuacct/${relative#cpuacct/}"
  printf '%s/cgroups/%s\n' "$FIXTURE_ROOT" "$relative"
}
hostname() { printf '%s\n' "${STUB_HOST:-ingenium-judge-spike-01}"; }
python3() {
  case "$*" in
    "-B $source_directory/streams/bundle.py") printf '%s\n' "${STUB_STREAM_HASH:-unreviewed}" ;;
    "-B $source_directory/isolation/bundle.py") printf '%s\n' "${STUB_ISOLATION_HASH:-unreviewed}" ;;
    *) return 98 ;;
  esac
}
findmnt() { printf '%s\n' "${STUB_CONTROLLERS-/sys/fs/cgroup/memory
/sys/fs/cgroup/cpu,cpuacct
/sys/fs/cgroup/pids
/sys/fs/cgroup/cpuset
/sys/fs/cgroup/devices
/sys/fs/cgroup/systemd}"; }
readlink() {
  if [[ "$2" == /sys/fs/cgroup/cpuacct ]]; then printf '%s\n' /sys/fs/cgroup/cpu,cpuacct; else printf '%s\n' "$2"; fi
}
stat() {
  if [[ "$1" == -fc && "$3" == /sys/fs/cgroup/* ]]; then
    if [[ "$3" == /sys/fs/cgroup/unified ]]; then printf '%s\n' "${STUB_UNIFIED_FS:-cgroup2fs}"; else printf '%s\n' "${STUB_FS:-cgroupfs}"; fi
  else command stat "$@"; fi
}
cat() {
  case "$1" in
    /sys/module/apparmor/parameters/enabled) printf '%s\n' "${STUB_ENABLED:-Y}" ;;
    /sys/kernel/security/apparmor/profiles) printf '%s\n' "${STUB_PROFILES:-docker-default (enforce)}" ;;
    /sys/fs/cgroup/unified/cgroup.controllers) printf '%s' "${STUB_V2_CONTROLLERS-}" ;;
    /sys/fs/cgroup/memory/memory.use_hierarchy) printf '%s\n' "${STUB_HIERARCHY:-1}" ;;
    /sys/fs/cgroup/memory/memory.memsw.limit_in_bytes) printf '9223372036854771712\n' ;;
    /sys/fs/cgroup/cpuset/cpuset.cpus) printf '%s\n' "${STUB_CPUS-0-1}" ;;
    /sys/fs/cgroup/cpuset/cpuset.mems) printf '0\n' ;;
    /sys/fs/cgroup/*/ingenium-cg-run.*/*)
      if [[ "$1" == */cpu.cfs_quota_us && ( "${STUB_BAD_BUDGET:-0}" -eq 1 || ( "${STUB_POST_BAD_BUDGET:-0}" -eq 1 && -e "$FIXTURE_ROOT/run_attempted" ) ) ]]; then printf '75000\n'
      elif [[ "$1" == */memory.failcnt && "${STUB_PARENT_PRESSURE:-0}" -eq 1 && -e "$FIXTURE_ROOT/run_attempted" ]]; then printf '1\n'
      elif [[ "$1" == */tasks && "${STUB_TASKS:-0}" -eq 1 && -e "$FIXTURE_ROOT/run_attempted" ]]; then printf '123\n'
      else command cat "$(model_path "$1")"; fi
      ;;
    *) command cat "$@" ;;
  esac
}
grep() {
  if [[ "${*: -1}" == /opt/ingenium-judge-spike/judge0.conf ]]; then return "${STUB_MAINTENANCE_EXIT:-0}"; else command grep "$@"; fi
}
mkdir() {
  local path="${*: -1}" mapped
  if [[ "$path" =~ ^/run/ingenium-cg-run\.[a-zA-Z0-9]{6}$ ]]; then command mkdir "$@"; return; fi
  [[ "$path" =~ ^/sys/fs/cgroup/[a-z_,]+/ingenium-cg-run\.[a-zA-Z0-9]{6}(/jobs)?$ ]] || return 98
  [[ "$path" != "${STUB_COLLISION_ROOT:-absent}"/ingenium-cg-run.* ]] || return 1
  mapped="$(model_path "$path")"
  command mkdir -p -- "$(dirname "$mapped")"
  command mkdir -m 700 -- "$mapped"
  printf '%s\n' "$path" >> "$FIXTURE_ROOT/created"
  : > "$mapped/tasks"
  : > "$mapped/cgroup.procs"
  printf '1\n' > "$mapped/memory.use_hierarchy"
  printf '0\n' > "$mapped/memory.failcnt"
  printf '0\n' > "$mapped/memory.memsw.failcnt"
}
tee() {
  local path="$1" mapped
  [[ "$path" =~ ^/sys/fs/cgroup/[a-z_,]+/ingenium-cg-run\.[a-zA-Z0-9]{6}/[a-z_.]+$ ]] || return 98
  [[ "${STUB_WRITE_EXIT:-0}" -eq 0 ]] || return 1
  mapped="$(model_path "$path")"
  [[ -d "$(dirname "$mapped")" ]] || return 98
  command cat > "$mapped"
  printf '%s\n' "$path" >> "$FIXTURE_ROOT/writes"
}
rmdir() {
  local path="${*: -1}" mapped
  if [[ "$path" == /sys/fs/cgroup/* ]]; then
    [[ "${STUB_REMOVE_EXIT:-0}" -eq 0 ]] || return 1
    mapped="$(model_path "$path")"
    [[ -z "$(command cat "$mapped/tasks")" ]] || return 1
    [[ -z "$(command find "$mapped" -mindepth 1 -maxdepth 1 -type d -print -quit)" ]] || return 1
    command find "$mapped" -mindepth 1 -maxdepth 1 -type f -delete
    command rmdir -- "$mapped"
    printf '%s\n' "$path" >> "$FIXTURE_ROOT/removed"
  else command rmdir "$@"; fi
}
apparmor_parser() {
  printf '%s\n' "$1" >> "$FIXTURE_ROOT/sequence"
  case "$1" in
    --skip-kernel-load) return "${STUB_PARSE_EXIT:-0}" ;;
    --add) return "${STUB_LOAD_EXIT:-0}" ;;
    --remove) return "${STUB_UNLOAD_EXIT:-0}" ;;
    *) return 98 ;;
  esac
}
docker() {
  case "$1" in
    info) printf '%s\n' "${STUB_DOCKER_CGROUP:-1|cgroupfs}" ;;
    image)
      if [[ "$*" == *ingenium.lab.profiles* ]]; then printf '%s\n' "${STUB_PROFILE_LABEL:-1}"
      else printf '%s\n' "${STUB_IMAGE-$image|linux|amd64|$image_user}"; fi
      ;;
    inspect)
      if [[ "$4" == ingenium-judge-spike-api-1 ]]; then printf '%s\n' docker-default
      else printf '%s\n' "${STUB_STATE-false|0|${STUB_OOM:-false}|ingenium-isolate-smoke-v1|$parent}"; fi
      ;;
    run)
      printf 'run\n' >> "$FIXTURE_ROOT/sequence"
      : > "$FIXTURE_ROOT/run_attempted"
      printf '%s\n' "$@" > "$FIXTURE_ROOT/args"
      if [[ " $* " == *' --parity '* || " $* " == *' --fixed-suite '* || " $* " == *' --bound-job '* || " $* " == *' --fixed-security '* ]]; then
        printf '%s\n' 'profile-runtime-command-not-executed' > "$FIXTURE_ROOT/inner.sh"
      elif [[ " $* " == *' /run/ingenium-failure-box.sh '* ]]; then
        command cp "$source_directory/failure-box.sh" "$FIXTURE_ROOT/inner.sh"
      elif [[ " $* " == *' /run/ingenium-crash-box.sh '* ]]; then
        command cp "$source_directory/crash-box.sh" "$FIXTURE_ROOT/inner.sh"
      else
        printf '%s\n' "${*: -1}" > "$FIXTURE_ROOT/inner.sh"
      fi
      command cat "$runtime_directory/isolate.conf" > "$FIXTURE_ROOT/config"
      command stat -c '%u:%g:%a' "$runtime_directory/isolate.conf" > "$FIXTURE_ROOT/config-mode"
      bash -n "$FIXTURE_ROOT/inner.sh"
      return "${STUB_RUN_EXIT:-0}"
      ;;
    rm) printf 'rm\n' >> "$FIXTURE_ROOT/sequence"; return "${STUB_RM_EXIT:-0}" ;;
    *) return 98 ;;
  esac
}
export -f model_path hostname python3 findmnt readlink stat cat grep mkdir tee rmdir apparmor_parser docker
fixture() {
  cleanup_runtime
  command rm -rf -- "$FIXTURE_ROOT/cgroups"
  command rm -f -- "$FIXTURE_ROOT"/{created,writes,removed,sequence,args,inner.sh,config,config-mode,run_attempted}
  unset STUB_HOST STUB_CONTROLLERS STUB_UNIFIED_FS STUB_FS STUB_ENABLED STUB_PROFILES STUB_V2_CONTROLLERS STUB_HIERARCHY STUB_CPUS STUB_BAD_BUDGET STUB_POST_BAD_BUDGET STUB_PARENT_PRESSURE STUB_TASKS STUB_MAINTENANCE_EXIT STUB_COLLISION_ROOT STUB_WRITE_EXIT STUB_REMOVE_EXIT STUB_PARSE_EXIT STUB_LOAD_EXIT STUB_UNLOAD_EXIT STUB_DOCKER_CGROUP STUB_IMAGE STUB_STATE STUB_OOM STUB_RUN_EXIT STUB_RM_EXIT STUB_PROFILE_LABEL
  unset STUB_STREAM_HASH STUB_ISOLATION_HASH
}
run_script() {
  status=0
  bash "$source_directory/cgroup-smoke.sh" "$@" > "$FIXTURE_ROOT/stdout" 2> "$FIXTURE_ROOT/stderr" || status=$?
}
bash -n "$source_directory/cgroup-smoke.sh"
fixture
run_script
[[ "$status" -eq 0 ]] || { command cat "$FIXTURE_ROOT/stderr"; fail 'Normal stubbed flow failed.'; }
[[ "$(command cat "$FIXTURE_ROOT/created")" == "$(command cat "$FIXTURE_ROOT/removed")" ]] || {
  [[ "$(command sort "$FIXTURE_ROOT/created")" == "$(command sort "$FIXTURE_ROOT/removed")" ]] || fail 'Owned groups were not all removed.'
}
[[ "$(command wc -l < "$FIXTURE_ROOT/created")" -eq 9 && "$(command wc -l < "$FIXTURE_ROOT/writes")" -eq 7 ]] || fail 'Wrong parent/job allocation or budget-write count.'
[[ "$(command cat "$FIXTURE_ROOT/sequence")" == $'--skip-kernel-load\n--add\nrun\nrm\n--remove' ]] || fail 'Unsafe load/run/removal ordering.'
[[ "$(command cat "$FIXTURE_ROOT/config-mode")" == 0:0:444 && -z "$(ls -A /run)" ]] || fail 'Private configuration mode or cleanup failed.'
grep -qx 'num_boxes = 1' "$FIXTURE_ROOT/config"
grep -qx -- '--cgroup-parent' "$FIXTURE_ROOT/args"
grep -qx -- '--cgroupns' "$FIXTURE_ROOT/args"
[[ "$(grep -c -- '--mount' "$FIXTURE_ROOT/args")" -eq 3 && "$(grep -c -- '--cap-add' "$FIXTURE_ROOT/args")" -eq 7 ]] || fail 'Unexpected mount/capability count.'
grep -Eq 'src=/sys/fs/cgroup/memory/ingenium-cg-run\.[a-zA-Z0-9]{6}/jobs,dst=' "$FIXTURE_ROOT/args"
grep -Eq 'src=/sys/fs/cgroup/cpuacct/ingenium-cg-run\.[a-zA-Z0-9]{6}/jobs,dst=' "$FIXTURE_ROOT/args"
grep -q 'dst=/usr/local/etc/isolate,readonly$' "$FIXTURE_ROOT/args"
grep -Fq -- '--cg-mem=32768' "$FIXTURE_ROOT/inner.sh"
grep -Fq 'test "$cpu_group" = "$memory_group"' "$FIXTURE_ROOT/inner.sh"
grep -Fq 'test "$usage" -gt 0' "$FIXTURE_ROOT/inner.sh"
grep -Fq 'test "$peak" -gt 0' "$FIXTURE_ROOT/inner.sh"
grep -qx '60s' "$FIXTURE_ROOT/args"
[[ "$(grep -cx '256m' "$FIXTURE_ROOT/args")" -eq 2 ]] || fail 'Outer memory/swap caps differ.'
grep -qx '/var/local/lib/isolate:rw,exec,nosuid,nodev,size=16m,uid=0,gid=0,mode=0755' "$FIXTURE_ROOT/args"
grep -Fq -- '--processes=1' "$FIXTURE_ROOT/inner.sh"
grep -Fq 'job_kib=16384 address_kib=262144' "$FIXTURE_ROOT/inner.sh"
grep -Fq 'while :; do :; done' "$FIXTURE_ROOT/inner.sh"
grep -Fq 'printf -v buffer' "$FIXTURE_ROOT/inner.sh"
grep -Fq 'oom_kill_disable 0' "$FIXTURE_ROOT/inner.sh"
grep -Fq -- '--processes=8 --time=5 --wall-time=15 --mem=131072' "$FIXTURE_ROOT/inner.sh"
grep -Fq -- '--cg-mem=131072' "$FIXTURE_ROOT/inner.sh"
grep -Fq -- '--env=TMPDIR=/box' "$FIXTURE_ROOT/inner.sh"
grep -Fq -- '--env=LD_LIBRARY_PATH=/usr/local/gcc-9.2.0/lib64' "$FIXTURE_ROOT/inner.sh"
grep -Fq 'wait "$compile_pid"' "$FIXTURE_ROOT/inner.sh"
grep -Fq 'test "$child_seen" -eq 1' "$FIXTURE_ROOT/inner.sh"
grep -Fq 'cmp /tmp/expected "$workspace/box/stdout"' "$FIXTURE_ROOT/inner.sh"
grep -Fq 'check_sum 7 5 12' "$FIXTURE_ROOT/inner.sh"
grep -Fq 'check_sum -9 4 -5' "$FIXTURE_ROOT/inner.sh"
grep -Fq 'check_sum 2147483647 1 2147483648' "$FIXTURE_ROOT/inner.sh"
grep -Fq 'getuid() != 60000 || geteuid() != 60000' "$FIXTURE_ROOT/inner.sh"
grep -Fq 'getgid() != 60000 || getegid() != 60000' "$FIXTURE_ROOT/inner.sh"
if grep -Eq -- '--privileged|unconfined|seccomp=|docker.sock|PASSWORD|AUTHN' "$FIXTURE_ROOT/args"; then fail 'Unexpected privilege/credential exposure.'; fi
printf 'PASS: bounded common parent, scoped job binds, kernel-setting checks and owned cleanup\n'

membership_check="$(sed -n "/^    memory_group=/,/^    printf \"PASS: container membership/p" "$FIXTURE_ROOT/inner.sh")"
[[ "$membership_check" == *'/proc/self/cgroup'* ]] || fail 'Membership self-check was not extracted.'
membership_check="${membership_check/'done < /proc/self/cgroup'/'done <<< "$STUB_MEMBERSHIP"'}"
export INGENIUM_CGROUP_PARENT=/ingenium-cg-run.ABC123
member="$INGENIUM_CGROUP_PARENT/0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
for membership_case in valid reversed_cpu wrong_parent nested_leaf wrong_cpu wrong_pids missing; do
  memory_member="$member" cpu_member="$member" pids_member="$member" cpu_names=cpu,cpuacct
  case "$membership_case" in
    reversed_cpu) cpu_names=cpuacct,cpu ;;
    wrong_parent) memory_member="/other/${member##*/}" ;;
    nested_leaf) memory_member="$INGENIUM_CGROUP_PARENT/nested/${member##*/}" ;;
    wrong_cpu) cpu_member=/other ;;
    wrong_pids) pids_member=/other ;;
    missing) memory_member='' ;;
  esac
  STUB_MEMBERSHIP="$(printf '8:memory:%s\n6:%s:%s\n11:pids:%s\n0::/ignored\n' "$memory_member" "$cpu_names" "$cpu_member" "$pids_member")"
  export STUB_MEMBERSHIP
  membership_status=0
  bash -euo pipefail -c "$membership_check" > /dev/null 2>&1 || membership_status=$?
  if [[ "$membership_case" == valid || "$membership_case" == reversed_cpu ]]; then
    [[ "$membership_status" -eq 0 ]] || fail 'Valid bounded membership was rejected.'
  else
    [[ "$membership_status" -ne 0 ]] || fail 'Wrong/missing parent membership was accepted.'
  fi
done
printf 'PASS: actual membership self-check rejects wrong parents, nested leaves and mismatched controllers\n'

limit_check="$(sed -n '/^    check_limit_result() {/,/^    }/p' "$FIXTURE_ROOT/inner.sh")"
[[ "$limit_check" == *'cg-oom-killed:1'* && "$limit_check" == *'message:Time limit exceeded'* ]] || fail 'Limit-result checker was not extracted.'
for kind in cpu memory; do
  for scenario in valid memsw_only both_limits reported_counters wrong_exit empty missing duplicate_status duplicate_message wrong_message bad_counter bad_memsw_counter missing_memsw_counter unexpected_exitcode wrong_signal missing_marker no_accounting wrong_memory_counter; do
    meta="$FIXTURE_ROOT/limit.meta"
    rc=1 usage=300000000 failures=0 memsw_failures=0
    if [[ "$kind" == cpu ]]; then
      printf 'status:TO\nmessage:Time limit exceeded\nkilled:1\n' > "$meta"
    else
      failures=1
      printf 'status:SG\nmessage:Caught fatal signal 9\nexitsig:9\ncg-oom-killed:1\n' > "$meta"
    fi
    case "$scenario" in
      memsw_only) failures=0 memsw_failures=1 ;;
      both_limits) failures=1 memsw_failures=1 ;;
      reported_counters)
        usage=41170605 failures=0 memsw_failures=38
        printf 'time:0.041\ntime-wall:0.094\nmax-rss:18816\ncg-mem:16384\n' >> "$meta"
        ;;
      wrong_exit) rc=2 ;;
      empty) : > "$meta" ;;
      missing) command rm -- "$meta" ;;
      duplicate_status) printf 'status:XX\n' >> "$meta" ;;
      duplicate_message) printf 'message:another error\n' >> "$meta" ;;
      wrong_message) command sed -i 's/^message:.*/message:Time limit exceeded (wall clock)/' "$meta" ;;
      bad_counter) usage=unknown ;;
      bad_memsw_counter) memsw_failures=unknown ;;
      missing_memsw_counter) memsw_failures='' ;;
      unexpected_exitcode) printf 'exitcode:0\n' >> "$meta" ;;
      wrong_signal) printf 'exitsig:15\n' >> "$meta" ;;
      missing_marker) command sed -i '/^killed:/d; /^cg-oom-killed:/d' "$meta" ;;
      no_accounting) usage=0 failures=0 ;;
      wrong_memory_counter) if [[ "$kind" == cpu ]]; then failures=1; else failures=0; fi ;;
    esac
    checker_status=0
    bash -euo pipefail -c "$limit_check; check_limit_result \"\$@\"" -- "$kind" "$rc" "$meta" "$usage" "$failures" "$memsw_failures" > /dev/null 2>&1 || checker_status=$?
    if [[ "$scenario" == valid || ( "$kind" == memory && ( "$scenario" == memsw_only || "$scenario" == both_limits || "$scenario" == reported_counters ) ) ]]; then
      [[ "$checker_status" -eq 0 ]] || fail "Valid $kind limit metadata was rejected."
    else
      [[ "$checker_status" -ne 0 ]] || fail "Invalid $kind/$scenario limit metadata was accepted."
    fi
  done
done
printf 'PASS: actual limit checker rejects unrelated failures, incomplete evidence and wall-clock timeouts\n'

metadata_check="$(sed -n '/^    check_success_metadata() {/,/^    }/p' "$FIXTURE_ROOT/inner.sh")"
[[ "$metadata_check" == *'cg-oom-killed'* ]] || fail 'Success metadata checker was not extracted.'
for scenario in clean nonzero duplicate status message signal killed oom empty missing; do
  meta="$FIXTURE_ROOT/success.meta"
  printf 'exitcode:0\ntime:0.004\n' > "$meta"
  case "$scenario" in
    nonzero) printf 'exitcode:2\n' > "$meta" ;;
    duplicate) printf 'exitcode:0\n' >> "$meta" ;;
    status) printf 'status:XX\n' >> "$meta" ;;
    message) printf 'message:error\n' >> "$meta" ;;
    signal) printf 'exitsig:9\n' >> "$meta" ;;
    killed) printf 'killed:1\n' >> "$meta" ;;
    oom) printf 'cg-oom-killed:1\n' >> "$meta" ;;
    empty) : > "$meta" ;;
    missing) command rm -- "$meta" ;;
  esac
  checker_status=0
  bash -euo pipefail -c "$metadata_check; check_success_metadata \"\$1\"" -- "$meta" > /dev/null 2>&1 || checker_status=$?
  if [[ "$scenario" == clean ]]; then
    [[ "$checker_status" -eq 0 ]] || fail 'Clean C++ metadata was rejected.'
  else
    [[ "$checker_status" -ne 0 ]] || fail "Bad C++ metadata was accepted: $scenario."
  fi
done
printf 'PASS: C++ success checker rejects failures, OOMs and duplicate/missing exit status\n'

child_check="$(sed -n '/^    compiler_child_is_accounted() {/,/^    }/p' "$FIXTURE_ROOT/inner.sh")"
[[ "$child_check" == *'"/proc/$pid/comm"'* ]] || fail 'Compiler-child checker was not extracted.'
child_check="${child_check/'"/proc/$pid/comm"'/'"$FIXTURE_ROOT/proc/$pid/comm"'}"
command mkdir -p "$FIXTURE_ROOT/proc/42" "$FIXTURE_ROOT/cpp-memory" "$FIXTURE_ROOT/cpp-cpu"
export memory="$FIXTURE_ROOT/cpp-memory" cpu="$FIXTURE_ROOT/cpp-cpu"
for scenario in valid wrong_command wrong_memory wrong_cpu missing_proc zero_pid bad_pid; do
  pid=42
  printf 'cc1plus\n' > "$FIXTURE_ROOT/proc/42/comm"
  printf '42\n' > "$memory/tasks"
  printf '42\n' > "$cpu/tasks"
  case "$scenario" in
    wrong_command) printf 'as\n' > "$FIXTURE_ROOT/proc/42/comm" ;;
    wrong_memory) printf '43\n' > "$memory/tasks" ;;
    wrong_cpu) printf '43\n' > "$cpu/tasks" ;;
    missing_proc) command rm -- "$FIXTURE_ROOT/proc/42/comm" ;;
    zero_pid) pid=0 ;;
    bad_pid) pid=../42 ;;
  esac
  checker_status=0
  bash -euo pipefail -c "$child_check; compiler_child_is_accounted \"\$1\"" -- "$pid" > /dev/null 2>&1 || checker_status=$?
  if [[ "$scenario" == valid ]]; then
    [[ "$checker_status" -eq 0 ]] || fail 'Accounted compiler child was rejected.'
  else
    [[ "$checker_status" -ne 0 ]] || fail "Wrong compiler-child membership was accepted: $scenario."
  fi
done
printf 'PASS: actual compiler-child checker requires cc1plus in both job controllers\n'

accounting_check="$(sed -n '/^    check_cpp_accounting() {/,/^    }/p' "$FIXTURE_ROOT/inner.sh")"
[[ "$accounting_check" == *'memory.memsw.failcnt'* ]] || fail 'C++ accounting checker was not extracted.'
for scenario in valid wrong_limit wrong_combined_limit memory_hit combined_hit bad_peak zero_peak over_peak bad_cpu zero_cpu memory_tasks cpu_tasks; do
  printf '134217728\n' > "$memory/memory.limit_in_bytes"
  printf '134217728\n' > "$memory/memory.memsw.limit_in_bytes"
  printf '0\n' > "$memory/memory.failcnt"
  printf '0\n' > "$memory/memory.memsw.failcnt"
  printf '4194304\n' > "$memory/memory.max_usage_in_bytes"
  printf '123456\n' > "$cpu/cpuacct.usage"
  : > "$memory/tasks"
  : > "$cpu/tasks"
  case "$scenario" in
    wrong_limit) printf '268435456\n' > "$memory/memory.limit_in_bytes" ;;
    wrong_combined_limit) printf '268435456\n' > "$memory/memory.memsw.limit_in_bytes" ;;
    memory_hit) printf '1\n' > "$memory/memory.failcnt" ;;
    combined_hit) printf '1\n' > "$memory/memory.memsw.failcnt" ;;
    bad_peak) printf 'unknown\n' > "$memory/memory.max_usage_in_bytes" ;;
    zero_peak) printf '0\n' > "$memory/memory.max_usage_in_bytes" ;;
    over_peak) printf '134217729\n' > "$memory/memory.max_usage_in_bytes" ;;
    bad_cpu) printf 'unknown\n' > "$cpu/cpuacct.usage" ;;
    zero_cpu) printf '0\n' > "$cpu/cpuacct.usage" ;;
    memory_tasks) printf '42\n' > "$memory/tasks" ;;
    cpu_tasks) printf '42\n' > "$cpu/tasks" ;;
  esac
  checker_status=0
  bash -euo pipefail -c "$accounting_check; check_cpp_accounting test 134217728" > /dev/null 2>&1 || checker_status=$?
  if [[ "$scenario" == valid ]]; then
    [[ "$checker_status" -eq 0 ]] || fail 'Valid C++ accounting was rejected.'
  else
    [[ "$checker_status" -ne 0 ]] || fail "Invalid C++ accounting was accepted: $scenario."
  fi
done
printf 'PASS: actual C++ accounting checker requires exact limits, positive usage and empty task lists\n'

emitter="$(sed -n '/^    emit_cpp_result() {/,/^    }/p' "$FIXTURE_ROOT/inner.sh")"
[[ "$emitter" == *INGENIUM_LAB_RESULT* ]] || fail 'C++ evidence emitter was not extracted.'
emitter="${emitter/'/tmp/run.meta'/'"$FIXTURE_ROOT/run.meta"'}"
export workspace="$FIXTURE_ROOT/cpp-workspace"
command mkdir -p "$workspace/box"
printf 'trusted C++ fixture\n' > "$workspace/box/main.cpp"
printf '7 5\n' > "$workspace/box/stdin"
printf '12\n' > "$workspace/box/stdout"
printf 'time-wall:0.015\n' > "$FIXTURE_ROOT/run.meta"
printf '123456\n' > "$cpu/cpuacct.usage"
printf '4194304\n' > "$memory/memory.max_usage_in_bytes"
source_hash="$(sha256sum "$workspace/box/main.cpp")"
source_hash="${source_hash%% *}"
actual="$(bash -euo pipefail -c "$emitter; emit_cpp_result")"
expected="INGENIUM_LAB_RESULT {\"source_sha256\":\"$source_hash\",\"stdin_b64\":\"NyA1Cg==\",\"stdout_b64\":\"MTIK\",\"cpu_ns\":123456,\"peak_bytes\":4194304,\"wall_seconds\":\"0.015\"}"
[[ "$actual" == "$expected" ]] || fail 'Emitter did not preserve exact source/input/output bytes and accounting.'
printf 'PASS: actual evidence emitter preserves exact bytes and measured cgroup metadata\n'

for guard in host v2 fs hierarchy cpus controllers profile image maintenance; do
  fixture
  case "$guard" in
    host) export STUB_HOST=development-host ;;
    v2) export STUB_V2_CONTROLLERS=memory ;;
    fs) export STUB_FS=cgroup2fs ;;
    hierarchy) export STUB_HIERARCHY=0 ;;
    cpus) export STUB_CPUS='' ;;
    controllers) export STUB_CONTROLLERS='/sys/fs/cgroup/memory/unsafe-child' ;;
    profile) export STUB_PROFILES='ingenium-isolate-smoke-v1 (enforce)' ;;
    image) export STUB_IMAGE=wrong ;;
    maintenance) export STUB_MAINTENANCE_EXIT=1 ;;
  esac
  run_script
  [[ "$status" -ne 0 && ! -e "$FIXTURE_ROOT/created" && ! -e "$FIXTURE_ROOT/run_attempted" && -z "$(ls -A /run)" ]] || fail 'A prerequisite failure caused mutation.'
done
printf 'PASS: host, hybrid-controller, image, profile and maintenance guards precede mutation\n'

for failure in parse collision write budget; do
  fixture
  case "$failure" in
    parse) export STUB_PARSE_EXIT=1 ;;
    collision) export STUB_COLLISION_ROOT=/sys/fs/cgroup/pids ;;
    write) export STUB_WRITE_EXIT=1 ;;
    budget) export STUB_BAD_BUDGET=1 ;;
  esac
  run_script
  [[ "$status" -ne 0 && ! -e "$FIXTURE_ROOT/run_attempted" && -z "$(ls -A /run)" ]] || fail 'An allocation/budget failure started execution or leaked private files.'
  if [[ -e "$FIXTURE_ROOT/created" ]]; then
    [[ "$(command sort "$FIXTURE_ROOT/created")" == "$(command sort "$FIXTURE_ROOT/removed")" ]] || fail 'A pre-start failure removed unowned groups or left owned groups.'
  fi
done
printf 'PASS: compile, allocation and budget failures clean only successfully allocated groups\n'

for failure in load run state container_oom budget parent_pressure tasks rm unload; do
  fixture
  case "$failure" in
    load) export STUB_LOAD_EXIT=1 ;;
    run) export STUB_RUN_EXIT=17 ;;
    state) export STUB_STATE='true|0|false|ingenium-isolate-smoke-v1|wrong' ;;
    container_oom) export STUB_OOM=true ;;
    budget) export STUB_POST_BAD_BUDGET=1 ;;
    parent_pressure) export STUB_PARENT_PRESSURE=1 ;;
    tasks) export STUB_TASKS=1 ;;
    rm) export STUB_RM_EXIT=1 ;;
    unload) export STUB_UNLOAD_EXIT=1 ;;
  esac
  run_script
  [[ "$status" -ne 0 && ! -e "$FIXTURE_ROOT/removed" && -n "$(ls -A /run)" ]] || fail 'An uncertain attempt removed group/configuration evidence.'
  grep -q 'Retained for inspection' "$FIXTURE_ROOT/stderr"
done
printf 'PASS: uncertain load/run/state/accounting/teardown results retain all group evidence\n'

fixture
export STUB_REMOVE_EXIT=1
run_script
[[ "$status" -ne 0 && -n "$(ls -A /run)" ]] || fail 'Failed empty-group cleanup was reported successful.'
grep -q 'cleanup needs inspection' "$FIXTURE_ROOT/stderr"
printf 'PASS: empty-group removal failure is visible and preserves private diagnostic files\n'
for name in wrong-output compile-error signal-crash nonzero-exit cpu-limit memory-limit output-limit output-boundary; do
  fixture
  hash="$(sha256sum "$source_directory/fixtures/$name.cpp")"
  hash="${hash%% *}"
  run_script --failure "$name" "$hash"
  [[ "$status" -eq 0 && -z "$(ls -A /run)" ]] || fail "Fixed failure mode did not clean up: $name."
  [[ "$(grep -c -- '--mount' "$FIXTURE_ROOT/args")" -eq 5 && "$(grep -c -- '--cap-add' "$FIXTURE_ROOT/args")" -eq 7 ]] || fail 'Failure mode changed capability/mount scope.'
  [[ "$(tail -n 4 "$FIXTURE_ROOT/args")" == "$(printf '/bin/bash\n/run/ingenium-failure-box.sh\n%s\n%s' "$name" "$hash")" ]] || fail 'Fixed name/source identity was not passed to the trusted helper.'
  grep -q 'dst=/run/ingenium-fixture.cpp,readonly$' "$FIXTURE_ROOT/args"
  grep -q 'dst=/run/ingenium-failure-box.sh,readonly$' "$FIXTURE_ROOT/args"
  grep -qx 'ulimit -c 0' "$FIXTURE_ROOT/inner.sh"
  if grep -Eq -- '--privileged|unconfined|seccomp=|docker.sock|PASSWORD|AUTHN' "$FIXTURE_ROOT/args"; then fail 'Failure mode exposed privilege/credentials.'; fi
done
printf 'PASS: all eight failure modes keep fixed source identity, read-only fixture binds and existing capabilities\n'

for scenario in missing unknown malformed wrong_hash; do
  fixture
  args=(--failure wrong-output "$(printf '%064d' 0)")
  case "$scenario" in
    missing) args=(--failure) ;;
    unknown) args[1]='../unknown' ;;
    malformed) args[2]=unreviewed ;;
  esac
  run_script "${args[@]}"
  [[ "$status" -ne 0 && ! -e "$FIXTURE_ROOT/created" && ! -e "$FIXTURE_ROOT/run_attempted" && -z "$(ls -A /run)" ]] || fail 'Unknown or changed fixture reached allocation/execution.'
done
printf 'PASS: incomplete, unknown and changed failure fixtures are rejected before mutation\n'

fixture
export workspace="$FIXTURE_ROOT/failure-workspace" memory="$FIXTURE_ROOT/failure-memory" cpu="$FIXTURE_ROOT/failure-cpu"
command mkdir -p "$workspace/box" "$memory" "$cpu"
printf 'exact output\n' > "$workspace/box/stdout"
: > "$workspace/box/stderr"
printf 'exitcode:0\n' > "$FIXTURE_ROOT/failure.meta"
printf '123456\n' > "$cpu/cpuacct.usage"
printf '4194304\n' > "$memory/memory.max_usage_in_bytes"
printf '0\n' > "$memory/memory.failcnt"
printf '38\n' > "$memory/memory.memsw.failcnt"
phase_check="$(sed -n '/^phase_data() {/,/^}/p' "$source_directory/failure-box.sh")"
actual="$(bash -euo pipefail -c "$phase_check; phase_data 1 8192 \"\$1\"" -- "$FIXTURE_ROOT/failure.meta")"
[[ "$actual" == '{"rc":1,"meta_b64":"ZXhpdGNvZGU6MAo=","stdout_b64":"ZXhhY3Qgb3V0cHV0Cg==","stderr_b64":"","cpu_ns":123456,"peak_bytes":4194304,"ram_hits":0,"combined_hits":38}' ]] || fail 'Failure evidence changed exact bytes or cgroup counters.'
for scenario in oversized missing symlink; do
  printf 'exact output\n' > "$workspace/box/stdout"
  case "$scenario" in
    oversized) head -c 8193 /dev/zero > "$workspace/box/stdout" ;;
    missing) command rm "$workspace/box/stdout" ;;
    symlink) command rm "$workspace/box/stdout"; ln -s "$FIXTURE_ROOT/failure.meta" "$workspace/box/stdout" ;;
  esac
  checker_status=0
  bash -euo pipefail -c "shopt -s inherit_errexit; $phase_check; result=\"\$(phase_data 1 8192 \"\$1\")\"; printf '%s' \"\$result\"" -- "$FIXTURE_ROOT/failure.meta" > /dev/null 2>&1 || checker_status=$?
  [[ "$checker_status" -ne 0 ]] || fail 'Missing/linked/oversized output was accepted.'
  command rm -f "$workspace/box/stdout"
done
printf 'PASS: actual failure evidence emitter bounds files, rejects links and preserves combined-limit counters\n'
fixture
profile_image="sha256:$(printf 'e%.0s' {1..64})"
run_script --profiles "$profile_image"
[[ "$status" -eq 0 && -z "$(ls -A /run)" ]] || fail 'Profile image mode did not complete owned cleanup.'
grep -qx '420s' "$FIXTURE_ROOT/args"
[[ "$(grep -cx '1536m' "$FIXTURE_ROOT/args")" -eq 2 && "$(grep -c -- '--mount' "$FIXTURE_ROOT/args")" -eq 3 && "$(grep -c -- '--cap-add' "$FIXTURE_ROOT/args")" -eq 7 ]] || fail 'Profile mode memory/mount/capability scope differs.'
grep -qx '128' "$FIXTURE_ROOT/args"
grep -qx '/var/local/lib/isolate:rw,exec,nosuid,nodev,size=64m,nr_inodes=4096,uid=0,gid=0,mode=0755' "$FIXTURE_ROOT/args"
[[ "$(tail -n 5 "$FIXTURE_ROOT/args")" == $'/usr/local/bin/python3.14\n-I\n-B\n/usr/local/share/ingenium-profiles/runtime.py\n--parity' ]] || fail 'Profile mode did not dispatch only the fixed runtime helper.'
printf 'PASS: profile mode uses its separate bounded budget, image ID and fixed command without new capabilities or mounts\n'
for scenario in bad_label bad_id wrong_user; do
  fixture
  image_argument="$profile_image"
  case "$scenario" in
    bad_label) export STUB_PROFILE_LABEL=other ;;
    bad_id) image_argument=latest ;;
    wrong_user) export STUB_IMAGE="$profile_image|linux|amd64|root" ;;
  esac
  run_script --profiles "$image_argument"
  [[ "$status" -ne 0 && ! -e "$FIXTURE_ROOT/created" && ! -e "$FIXTURE_ROOT/run_attempted" && -z "$(ls -A /run)" ]] || fail 'Unknown profile image reached allocation/execution.'
done
printf 'PASS: mutable/incorrectly labelled or root-default profile images fail before mutation\n'
fixture
crash_hash="$(sha256sum "$source_directory/crash-box.sh")"
crash_hash="${crash_hash%% *}"
export STUB_RUN_EXIT=137
run_script --crash abc123 "$crash_hash"
[[ "$status" -ne 0 && ! -e "$FIXTURE_ROOT/removed" && -d /run/ingenium-cg-run.abc123 ]] || fail 'Crash mode discarded uncertain sandbox resources.'
[[ "$(grep -c -- '--mount' "$FIXTURE_ROOT/args")" -eq 4 && "$(grep -c -- '--cap-add' "$FIXTURE_ROOT/args")" -eq 7 ]] || fail 'Crash mode changed capability or mount scope.'
grep -qx '150s' "$FIXTURE_ROOT/args"
grep -qx 'ingenium.lab.crash=abc123' "$FIXTURE_ROOT/args"
grep -q 'dst=/run/ingenium-crash-box.sh,readonly$' "$FIXTURE_ROOT/args"
grep -Fq -- '--processes=4 --time=1 --wall-time=120' "$FIXTURE_ROOT/inner.sh"
grep -Fq '/box/sleep 90 & child=$!; wait "$child"' "$FIXTURE_ROOT/inner.sh"
grep -Fq 'while :; do sleep 1; done' "$FIXTURE_ROOT/inner.sh"
printf 'PASS: fixed crash mode retains owned evidence after failure with unchanged isolation and only one extra read-only script mount\n'

for scenario in nonce hash collision; do
  fixture
  args=(--crash abc123 "$crash_hash")
  case "$scenario" in
    nonce) args[1]='../bad' ;;
    hash) args[2]="$(printf '%064d' 0)" ;;
    collision)
      command mkdir -m 700 /run/ingenium-cg-run.abc123
      printf 'existing evidence\n' > /run/ingenium-cg-run.abc123/profile
      ;;
  esac
  run_script "${args[@]}"
  [[ "$status" -ne 0 && ! -e "$FIXTURE_ROOT/created" && ! -e "$FIXTURE_ROOT/run_attempted" ]] || fail 'Invalid/colliding crash mode reached allocation or execution.'
  if [[ "$scenario" == collision ]]; then
    [[ "$(command cat /run/ingenium-cg-run.abc123/profile)" == 'existing evidence' ]] || fail 'A failed exclusive allocation removed preexisting evidence.'
  fi
done
printf 'PASS: invalid crash identities/hashes and resource-name collisions cannot overwrite or remove prior evidence\n'
fixture
export STUB_STREAM_HASH="$(printf 'a%.0s' {1..64})"
run_script --streams "$profile_image" "$STUB_STREAM_HASH"
[[ "$status" -eq 0 && -z "$(ls -A /run)" ]] || fail 'Stream mode did not complete owned cleanup.'
[[ "$(grep -c -- '--mount' "$FIXTURE_ROOT/args")" -eq 4 && "$(grep -c -- '--cap-add' "$FIXTURE_ROOT/args")" -eq 7 ]] || fail 'Stream mode changed capability or mount scope.'
grep -q 'dst=/run/ingenium-streams,readonly$' "$FIXTURE_ROOT/args"
grep -qx '420s' "$FIXTURE_ROOT/args"
[[ "$(grep -cx '1536m' "$FIXTURE_ROOT/args")" -eq 2 ]] || fail 'Stream mode changed its bounded memory.'
[[ "$(tail -n 5 "$FIXTURE_ROOT/args")" == $'/usr/local/bin/python3.14\n-I\n-B\n/run/ingenium-streams/runtime.py\n--fixed-suite' ]] || fail 'Stream mode did not use the fixed trusted entrypoint.'
printf 'PASS: stream mode reuses the frozen profile image with one read-only bundle mount and unchanged capability limits\n'
for scenario in missing bad_id bad_hash changed_hash; do
  fixture
  export STUB_STREAM_HASH="$(printf 'a%.0s' {1..64})"
  args=(--streams "$profile_image" "$STUB_STREAM_HASH")
  case "$scenario" in
    missing) args=(--streams "$profile_image") ;;
    bad_id) args[1]=latest ;;
    bad_hash) args[2]=unreviewed ;;
    changed_hash) args[2]="$(printf 'b%.0s' {1..64})" ;;
  esac
  run_script "${args[@]}"
  [[ "$status" -ne 0 && ! -e "$FIXTURE_ROOT/created" && ! -e "$FIXTURE_ROOT/run_attempted" ]] || fail 'Invalid stream bundle reached allocation/execution.'
done
printf 'PASS: incomplete, mutable or changed stream identity is rejected before allocation\n'
fixture
export STUB_STREAM_HASH="$(printf 'a%.0s' {1..64})"
job_directory=/opt/ingenium-judge-spike/transport-v1/execution-8cf9f0bd-8374-4d81-bbf5-405d0df22442
command mkdir -p -m 700 "$job_directory"
printf '{"fixed":"job"}' > "$job_directory/job.json"
job_hash="$(sha256sum "$job_directory/job.json")"
job_hash="${job_hash%% *}"
run_script --stream-job "$profile_image" "$STUB_STREAM_HASH" "$job_directory/job.json" "$job_hash"
[[ "$status" -eq 0 && -z "$(ls -A /run)" ]] || fail 'Bound stream job did not complete owned cleanup.'
[[ "$(grep -c -- '--mount' "$FIXTURE_ROOT/args")" -eq 5 && "$(grep -c -- '--cap-add' "$FIXTURE_ROOT/args")" -eq 7 ]] || fail 'Bound job changed mount/capability scope.'
grep -qx -- '--bound-job' "$FIXTURE_ROOT/args"
grep -qx "$job_hash" "$FIXTURE_ROOT/args"
grep -qx 'max-size=2m' "$FIXTURE_ROOT/args"
grep -q 'dst=/run/ingenium-stream-job.json,readonly$' "$FIXTURE_ROOT/args"
printf 'PASS: bound stream mode adds only one private read-only job mount and bounded logs with unchanged isolation\n'
for scenario in path hash missing oversized mode; do
  fixture
  export STUB_STREAM_HASH="$(printf 'a%.0s' {1..64})"
  args=(--stream-job "$profile_image" "$STUB_STREAM_HASH" "$job_directory/job.json" "$job_hash")
  case "$scenario" in
    path) args[3]=/tmp/job.json ;;
    hash) args[4]="$(printf '%064d' 0)" ;;
    missing) args[3]="$job_directory/absent.json" ;;
    oversized) head -c 8193 /dev/zero > "$job_directory/job.json" ;;
    mode) printf '{"fixed":"job"}' > "$job_directory/job.json"; chmod 644 "$job_directory/job.json" ;;
  esac
  run_script "${args[@]}"
  [[ "$status" -ne 0 && ! -e "$FIXTURE_ROOT/created" && ! -e "$FIXTURE_ROOT/run_attempted" ]] || fail 'Invalid private job reached allocation/execution.'
done
printf 'PASS: invalid private paths, changed job bytes, absent/oversized files and loose permissions fail before allocation\n'
fixture
export STUB_STREAM_HASH="$(printf 'a%.0s' {1..64})" STUB_ISOLATION_HASH="$(printf 'b%.0s' {1..64})"
run_script --isolation "$profile_image" "$STUB_STREAM_HASH" "$STUB_ISOLATION_HASH"
[[ "$status" -eq 0 && -z "$(ls -A /run)" ]] || fail 'Fixed isolation mode did not complete owned cleanup.'
[[ "$(grep -c -- '--mount' "$FIXTURE_ROOT/args")" -eq 5 && "$(grep -c -- '--cap-add' "$FIXTURE_ROOT/args")" -eq 7 ]] || fail 'Isolation mode changed capability/mount scope.'
grep -q 'dst=/run/ingenium-isolation,readonly$' "$FIXTURE_ROOT/args"
grep -qx 'max-size=1m' "$FIXTURE_ROOT/args"
grep -qx -- '--fixed-security' "$FIXTURE_ROOT/args"
[[ "$(grep -cx '1536m' "$FIXTURE_ROOT/args")" -eq 2 ]] || fail 'Isolation mode changed its bounded parent memory.'
printf 'PASS: fixed isolation mode reuses unchanged policy/capabilities with two read-only source bundles and bounded logs\n'
for scenario in missing bad_image bad_bundle changed_bundle; do
  fixture
  export STUB_STREAM_HASH="$(printf 'a%.0s' {1..64})" STUB_ISOLATION_HASH="$(printf 'b%.0s' {1..64})"
  args=(--isolation "$profile_image" "$STUB_STREAM_HASH" "$STUB_ISOLATION_HASH")
  case "$scenario" in
    missing) args=(--isolation "$profile_image" "$STUB_STREAM_HASH") ;;
    bad_image) args[1]=latest ;;
    bad_bundle) args[3]=unreviewed ;;
    changed_bundle) args[3]="$(printf 'c%.0s' {1..64})" ;;
  esac
  run_script "${args[@]}"
  [[ "$status" -ne 0 && ! -e "$FIXTURE_ROOT/created" && ! -e "$FIXTURE_ROOT/run_attempted" ]] || fail 'Unreviewed isolation mode reached allocation/execution.'
done
printf 'PASS: changed or incomplete isolation bundle/image identities fail before allocation\n'
printf '24 cgroup smoke orchestration/membership/result groups passed; no Docker/Judge0 call or host cgroup write occurred.\n'
