#!/usr/bin/env bash
set +x
set -euo pipefail
umask 077

fail() { printf 'FAIL: %s\n' "$1" >&2; exit 1; }
[[ "$EUID" -eq 0 && "$(uname -s)" == Linux && "$(hostname)" == ingenium-judge-spike-01 ]] || fail 'Run only with sudo on the isolated judge VM.'
image=sha256:a0a4768705620218af104c2ad869fd087e1937815b690914512427a4b6135995
profile=ingenium-isolate-smoke-v1
source_directory="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
failure=''
profile_mode=0
stream_mode=0
stream_job=''
stream_job_hash=''
isolation_mode=0
crash_nonce=''
image_user=judge0
parent_bytes=268435456 parent_mib=256 parent_tasks=32 container_memory=256m
workspace_options='size=16m' temporary_size=4m deadline=60s
if [[ $# -ne 0 ]]; then
  if { [[ $# -eq 2 && "$1" == --profiles ]] || [[ $# -eq 3 && "$1" == --streams && "$3" =~ ^[0-9a-f]{64}$ ]] || [[ $# -eq 5 && "$1" == --stream-job && "$3" =~ ^[0-9a-f]{64}$ && "$5" =~ ^[0-9a-f]{64}$ ]] || [[ $# -eq 4 && "$1" == --isolation && "$3" =~ ^[0-9a-f]{64}$ && "$4" =~ ^[0-9a-f]{64}$ ]]; } && [[ "$2" =~ ^sha256:[0-9a-f]{64}$ ]]; then
    profile_mode=1 image="$2" image_user=65534:65534
    parent_bytes=1610612736 parent_mib=1536 parent_tasks=128 container_memory=1536m
    workspace_options='size=64m,nr_inodes=4096' temporary_size=16m deadline=420s
    [[ "$(docker image inspect "$image" --format '{{index .Config.Labels "ingenium.lab.profiles"}}')" == 1 ]] || fail 'Missing fixed language-profile image label.'
    if [[ "$1" == --streams || "$1" == --stream-job || "$1" == --isolation ]]; then
      [[ -f "$source_directory/streams/bundle.py" && ! -L "$source_directory/streams/bundle.py" ]] || fail 'Missing regular stream bundle helper.'
      [[ "$(python3 -B "$source_directory/streams/bundle.py")" == "$3" ]] || fail 'Fixed stream bundle fingerprint differs.'
      stream_mode=1
      if [[ "$1" == --isolation ]]; then
        [[ -f "$source_directory/isolation/bundle.py" && ! -L "$source_directory/isolation/bundle.py" ]] || fail 'Missing fixed isolation bundle.'
        [[ "$(python3 -B "$source_directory/isolation/bundle.py")" == "$4" ]] || fail 'Fixed isolation bundle fingerprint differs.'
        isolation_mode=1
      fi
      if [[ "$1" == --stream-job ]]; then
        [[ "$4" =~ ^/opt/ingenium-judge-spike/transport-v1/execution-[0-9a-f-]{36}/job.json$ && -f "$4" && ! -L "$4" && "$(readlink -f "$4")" == "$4" ]] || fail 'Invalid private bound-job path.'
        [[ "$(stat -c '%u:%g:%a:%s' "$4")" =~ ^0:0:600:[0-9]+$ && "$(stat -c %s "$4")" -le 8192 ]] || fail 'Invalid private bound-job ownership/size.'
        actual_hash="$(sha256sum "$4")"
        [[ "${actual_hash%% *}" == "$5" ]] || fail 'Bound job fingerprint differs.'
        stream_job="$4" stream_job_hash="$5"
      fi
    fi
  elif [[ $# -eq 3 && "$1" == --crash && "$2" =~ ^[0-9a-f]{6}$ && "$3" =~ ^[0-9a-f]{64}$ ]]; then
    crash_nonce="$2" deadline=150s
    [[ -f "$source_directory/crash-box.sh" && ! -L "$source_directory/crash-box.sh" ]] || fail 'Missing regular trusted crash fixture.'
    actual_hash="$(sha256sum "$source_directory/crash-box.sh")"
    [[ "${actual_hash%% *}" == "$3" ]] || fail 'Trusted crash fixture fingerprint differs.'
  else
    [[ $# -eq 3 && "$1" == --failure && "$3" =~ ^[0-9a-f]{64}$ ]] || fail 'Only a fixed, fingerprinted lab mode is supported.'
    failure="$2"
    expected_hash="$3"
    case "$failure" in
      wrong-output|compile-error|signal-crash|nonzero-exit|cpu-limit|memory-limit|output-limit|output-boundary) ;;
      *) fail 'Unknown fixed failure fixture.' ;;
    esac
    for file in "$source_directory/failure-box.sh" "$source_directory/fixtures/$failure.cpp"; do
      [[ -f "$file" && ! -L "$file" ]] || fail 'Missing regular fixed failure source/helper.'
    done
    actual_hash="$(sha256sum "$source_directory/fixtures/$failure.cpp")"
    [[ "${actual_hash%% *}" == "$expected_hash" ]] || fail 'Fixed failure source fingerprint differs.'
  fi
fi
[[ -f "$source_directory/namespace-smoke.apparmor" && ! -L "$source_directory/namespace-smoke.apparmor" ]] || fail 'Missing regular test profile.'
[[ "$(cat /sys/module/apparmor/parameters/enabled)" == Y ]] || fail 'AppArmor is not enabled.'
profiles="$(cat /sys/kernel/security/apparmor/profiles)"
if grep -q "^$profile " <<< "$profiles"; then fail 'A previous test profile remains; inspect before rerunning.'; else [[ "$?" -eq 1 ]] || fail 'Profile inspection failed.'; fi
[[ "$(docker info --format '{{.CgroupVersion}}|{{.CgroupDriver}}')" == '1|cgroupfs' ]] || fail 'Unexpected Docker cgroup configuration.'
[[ "$(docker image inspect "$image" --format '{{.Id}}|{{.Os}}|{{.Architecture}}|{{.Config.User}}')" == "$image|linux|amd64|$image_user" ]] || fail 'The expected local worker image is unavailable.'
[[ "$(docker inspect --type container ingenium-judge-spike-api-1 --format '{{.AppArmorProfile}}')" == docker-default ]] || fail 'The API profile changed.'
grep -qx 'MAINTENANCE_MODE=true' /opt/ingenium-judge-spike/judge0.conf || fail 'Keep API maintenance enabled.'

controller_text="$(findmnt -rn -t cgroup -o TARGET)"
mapfile -t controllers <<< "$controller_text"
declare -A seen=()
for root in "${controllers[@]}"; do
  [[ "$root" =~ ^/sys/fs/cgroup/[a-z_,]+$ && "$(readlink -f "$root")" == "$root" ]] || fail 'Unexpected controller mount path.'
  [[ -z "${seen[$root]:-}" && "$(stat -fc %T "$root")" == cgroupfs ]] || fail 'Duplicate or non-v1 controller mount.'
  seen[$root]=1
done
for required in memory cpu,cpuacct pids cpuset; do
  [[ "${seen[/sys/fs/cgroup/$required]:-}" == 1 ]] || fail 'A required controller is unavailable.'
done
[[ "$(stat -fc %T /sys/fs/cgroup/unified)" == cgroup2fs && -z "$(cat /sys/fs/cgroup/unified/cgroup.controllers)" ]] || fail 'Unexpected hybrid v2 hierarchy.'
controllers+=(/sys/fs/cgroup/unified)
[[ "$(readlink -f /sys/fs/cgroup/cpuacct)" == /sys/fs/cgroup/cpu,cpuacct ]] || fail 'Unexpected CPU-accounting alias.'
[[ "$(cat /sys/fs/cgroup/memory/memory.use_hierarchy)" == 1 ]] || fail 'Unexpected memory hierarchy; do not change it.'
[[ "$(cat /sys/fs/cgroup/memory/memory.memsw.limit_in_bytes)" =~ ^[0-9]+$ ]] || fail 'Memory/swap controller metadata is unavailable.'
cpus="$(cat /sys/fs/cgroup/cpuset/cpuset.cpus)"
mems="$(cat /sys/fs/cgroup/cpuset/cpuset.mems)"
[[ "$cpus" =~ ^[0-9,-]+$ && "$mems" =~ ^[0-9,-]+$ ]] || fail 'Unexpected root cpuset; no changes were made.'

runtime_directory=''
container='not-created'
parent='not-created'
owned_parents=()
owned_jobs=()
safe_to_cleanup=1
completed=0
cleanup() {
  local status=$? cleanup_failed=0 path
  trap - EXIT
  set +e
  if [[ "$safe_to_cleanup" -ne 1 ]]; then
    printf 'FAIL: uncertain probe; do not rerun or weaken restrictions. Retained for inspection:\nContainer: %s\nProfile: %s\nParent: %s\nFiles: %s\n' "$container" "$profile" "$parent" "$runtime_directory" >&2
    exit 1
  fi
  for path in "${owned_jobs[@]}" "${owned_parents[@]}"; do
    rmdir -- "$path" || cleanup_failed=1
  done
  if [[ "$cleanup_failed" -eq 0 && -n "$runtime_directory" ]]; then
    rm -f -- "$runtime_directory/profile" "$runtime_directory/isolate.conf" || cleanup_failed=1
    rmdir -- "$runtime_directory" || cleanup_failed=1
  fi
  if [[ "$cleanup_failed" -ne 0 ]]; then
    printf 'FAIL: empty-group cleanup needs inspection. Parent: %s Files: %s\n' "$parent" "$runtime_directory" >&2
    status=1
  elif [[ "$status" -eq 0 && "$completed" -eq 1 ]]; then
    printf 'PASS: host test groups and temporary files removed\n'
  fi
  exit "$status"
}
trap cleanup EXIT
if [[ -n "$crash_nonce" ]]; then
  candidate="/run/ingenium-cg-run.$crash_nonce"
  mkdir -m 700 -- "$candidate"
  runtime_directory="$candidate"
else
  runtime_directory="$(mktemp -d /run/ingenium-cg-run.XXXXXX)"
fi
if [[ ! "$runtime_directory" =~ ^/run/ingenium-cg-run\.[a-zA-Z0-9]{6}$ ]]; then runtime_directory=''; fail 'Unexpected temporary directory.'; fi
name="${runtime_directory##*/}"
parent="/$name"
install -m 0444 -- "$source_directory/namespace-smoke.apparmor" "$runtime_directory/profile"
printf '%s\n' 'box_root = /var/local/lib/isolate' 'cg_root = /run/ingenium-probe-cgroups' \
  'first_uid = 60000' 'first_gid = 60000' 'num_boxes = 1' > "$runtime_directory/isolate.conf"
chmod 0444 "$runtime_directory/isolate.conf"
apparmor_parser --skip-kernel-load --skip-cache "$runtime_directory/profile"
printf 'PASS: test AppArmor profile compiled\n'

# Exclusive allocation in every v1 hierarchy also makes Docker parent cleanup explicit.
for root in "${controllers[@]}"; do
  mkdir -m 700 -- "$root/$name"
  owned_parents+=("$root/$name")
done
memory="/sys/fs/cgroup/memory/$name"
cpu="/sys/fs/cgroup/cpu,cpuacct/$name"
pids="/sys/fs/cgroup/pids/$name"
printf '%s\n' "$parent_bytes" | tee "$memory/memory.limit_in_bytes" > /dev/null
printf '%s\n' "$parent_bytes" | tee "$memory/memory.memsw.limit_in_bytes" > /dev/null
printf '100000\n' | tee "$cpu/cpu.cfs_period_us" > /dev/null
printf '50000\n' | tee "$cpu/cpu.cfs_quota_us" > /dev/null
printf '%s\n' "$parent_tasks" | tee "$pids/pids.max" > /dev/null
printf '%s\n' "$cpus" | tee "/sys/fs/cgroup/cpuset/$name/cpuset.cpus" > /dev/null
printf '%s\n' "$mems" | tee "/sys/fs/cgroup/cpuset/$name/cpuset.mems" > /dev/null
for path in "$memory/jobs" "$cpu/jobs"; do
  mkdir -m 700 -- "$path"
  owned_jobs+=("$path")
done
check_budgets() {
  [[ "$(cat "$memory/memory.limit_in_bytes")" == "$parent_bytes" && "$(cat "$memory/memory.memsw.limit_in_bytes")" == "$parent_bytes" && "$(cat "$memory/memory.use_hierarchy")" == 1 && "$(cat "$memory/jobs/memory.use_hierarchy")" == 1 ]] || fail 'Aggregate memory settings differ from the bounded plan.'
  [[ "$(cat "$memory/memory.failcnt")" == 0 && "$(cat "$memory/memory.memsw.failcnt")" == 0 ]] || fail 'The aggregate memory budget was hit; inspect instead of accepting a job-limit result.'
  [[ "$(cat "$cpu/cpu.cfs_quota_us")" == 50000 && "$(cat "$cpu/cpu.cfs_period_us")" == 100000 && "$(cat "$pids/pids.max")" == "$parent_tasks" ]] || fail 'Aggregate CPU/PID settings differ from the bounded plan.'
}
check_budgets
printf 'PASS: bounded parent verified (%s MiB, 0.5 CPU, %s tasks)\n' "$parent_mib" "$parent_tasks"

safe_to_cleanup=0
apparmor_parser --add --skip-cache "$runtime_directory/profile"
container="ingenium-cg-run-${name##*.}"
sandbox_command=(/bin/bash -c '
    set -euo pipefail
    test "$(cat /proc/self/attr/current)" = "ingenium-isolate-smoke-v1 (enforce)"
    grep -Eq "^NoNewPrivs:[[:space:]]+1$" /proc/self/status
    grep -Eq "^Seccomp:[[:space:]]+2$" /proc/self/status
    memory_group= cpu_group= pids_group=
    while IFS=: read -r hierarchy controllers group; do
      case "$controllers" in
        memory) memory_group="$group" ;;
        cpu,cpuacct|cpuacct,cpu) cpu_group="$group" ;;
        pids) pids_group="$group" ;;
      esac
    done < /proc/self/cgroup
    [[ "$memory_group" == "$INGENIUM_CGROUP_PARENT/"* ]]
    suffix="${memory_group#"$INGENIUM_CGROUP_PARENT/"}"
    [[ "$suffix" =~ ^[0-9a-f]{64}$ ]]
    test "$cpu_group" = "$memory_group"
    test "$pids_group" = "$memory_group"
    printf "PASS: container membership verified below bounded parent\n"
    workspace="$(/usr/local/bin/isolate --cg --box-id=0 --init)"
    test "$workspace" = /var/local/lib/isolate/0
    : > "$workspace/box/stdin"
    /usr/local/bin/isolate --cg --box-id=0 --cg-mem=32768 --no-default-dirs \
      --dir=/box=./box:rw --dir=/usr --dir=/lib --dir=/lib64:maybe \
      --time=1 --wall-time=3 --mem=32768 --stack=8192 --fsize=8 \
      --stdin=/box/stdin --stdout=/box/stdout --stderr=/box/stderr \
      --meta=/tmp/isolate.meta --run -- /usr/bin/id -u
    test "$(cat "$workspace/box/stdout")" = 60000
    test ! -s "$workspace/box/stderr"
    grep -qx "exitcode:0" /tmp/isolate.meta
    if grep -Eq "^(status|message|exitsig|killed|cg-oom-killed):" /tmp/isolate.meta; then exit 1; fi
    memory=/run/ingenium-probe-cgroups/memory/box-0
    cpu=/run/ingenium-probe-cgroups/cpuacct/box-0
    test "$(cat "$memory/memory.limit_in_bytes")" = 33554432
    test "$(cat "$memory/memory.memsw.limit_in_bytes")" = 33554432
    peak="$(cat "$memory/memory.max_usage_in_bytes")"
    usage="$(cat "$cpu/cpuacct.usage")"
    [[ "$peak" =~ ^[0-9]+$ && "$usage" =~ ^[0-9]+$ ]]
    test "$peak" -gt 0
    test "$peak" -le 33554432
    test "$usage" -gt 0
    test -z "$(cat "$memory/tasks")"
    test -z "$(cat "$cpu/tasks")"
    printf "JobPeakBytes=%s JobCpuNs=%s\n" "$peak" "$usage"
    printf "PASS: UID 60000 command ran in accounted job cgroups\n"
    /usr/local/bin/isolate --cg --box-id=0 --cleanup
    test ! -e "$workspace"
    test ! -e "$memory"
    test ! -e "$cpu"

    check_limit_result() {
      local kind="$1" rc="$2" meta="$3" usage="$4" failures="$5" memsw_failures="$6"
      [[ "$rc" == 1 && "$usage" =~ ^[0-9]+$ && "$failures" =~ ^[0-9]+$ && "$memsw_failures" =~ ^[0-9]+$ ]] || return 1
      [[ "$(grep -c "^status:" "$meta")" == 1 && "$(grep -c "^message:" "$meta")" == 1 ]] || return 1
      case "$kind" in
        cpu)
          grep -qx "status:TO" "$meta" &&
            grep -qx "message:Time limit exceeded" "$meta" &&
            [[ "$(grep -c "^killed:" "$meta")" == 1 ]] &&
            grep -qx "killed:1" "$meta" &&
            ! grep -Eq "^(exitcode|exitsig|cg-oom-killed):" "$meta" &&
            [[ "$usage" -ge 200000000 && "$failures" -eq 0 && "$memsw_failures" -eq 0 ]]
          ;;
        memory)
          grep -qx "status:SG" "$meta" &&
            grep -qx "message:Caught fatal signal 9" "$meta" &&
            [[ "$(grep -c "^exitsig:" "$meta")" == 1 && "$(grep -c "^cg-oom-killed:" "$meta")" == 1 ]] &&
            grep -qx "exitsig:9" "$meta" &&
            grep -qx "cg-oom-killed:1" "$meta" &&
            ! grep -Eq "^(exitcode|killed):" "$meta" &&
            [[ "$usage" -gt 0 && ( "$failures" -gt 0 || "$memsw_failures" -gt 0 ) ]]
          ;;
        *) return 1 ;;
      esac
    }

    test -x /usr/local/bash-5.0/bin/bash
    for kind in cpu memory; do
      test ! -e "$workspace"
      test ! -e "$memory"
      test ! -e "$cpu"
      workspace="$(/usr/local/bin/isolate --cg --box-id=0 --init)"
      test "$workspace" = /var/local/lib/isolate/0
      grep -qx "oom_kill_disable 0" "$memory/memory.oom_control"
      grep -qx "oom_kill 0" "$memory/memory.oom_control"
      test "$(cat "$memory/memory.failcnt")" = 0
      test "$(cat "$memory/memory.memsw.failcnt")" = 0
      : > "$workspace/box/stdin"
      case "$kind" in
        cpu)
          job_kib=32768 address_kib=32768 cpu_seconds=0.2 wall_seconds=5
          body="(( UID == 60000 && EUID == 60000 )) || exit 3; while :; do :; done"
          ;;
        memory)
          job_kib=16384 address_kib=262144 cpu_seconds=3 wall_seconds=8
          # Larger address space ensures the job cgroup, not malloc/RLIMIT_AS, stops allocation.
          body="(( UID == 60000 && EUID == 60000 )) || exit 3; printf -v buffer \"%33554432s\" x"
          ;;
      esac
      rc=0
      /usr/local/bin/isolate --cg --box-id=0 --cg-mem="$job_kib" --no-default-dirs \
        --dir=/box=./box:rw --dir=/usr --dir=/lib --dir=/lib64:maybe \
        --time="$cpu_seconds" --wall-time="$wall_seconds" --mem="$address_kib" \
        --processes=1 --stack=8192 --fsize=8 \
        --stdin=/box/stdin --stdout=/box/stdout --stderr=/box/stderr \
        --meta="/tmp/$kind.meta" --run -- \
        /usr/local/bash-5.0/bin/bash --noprofile --norc -c "$body" || rc=$?
      test "$(cat "$memory/memory.limit_in_bytes")" = "$((job_kib * 1024))"
      test "$(cat "$memory/memory.memsw.limit_in_bytes")" = "$((job_kib * 1024))"
      usage="$(cat "$cpu/cpuacct.usage")"
      failures="$(cat "$memory/memory.failcnt")"
      # The kernel can reject the combined-memory charge before checking RAM alone.
      memsw_failures="$(cat "$memory/memory.memsw.failcnt")"
      printf "Limit=%s JobCpuNs=%s MemoryLimitHits=%s CombinedLimitHits=%s\n" "$kind" "$usage" "$failures" "$memsw_failures"
      check_limit_result "$kind" "$rc" "/tmp/$kind.meta" "$usage" "$failures" "$memsw_failures" || {
        printf "FAIL: unexpected %s limit result (rc=%s); retained metadata:\n" "$kind" "$rc" >&2
        cat "/tmp/$kind.meta" >&2
        exit 1
      }
      test ! -s "$workspace/box/stdout"
      test ! -s "$workspace/box/stderr"
      test -z "$(cat "$memory/tasks")"
      test -z "$(cat "$cpu/tasks")"
      /usr/local/bin/isolate --cg --box-id=0 --cleanup
      test ! -e "$workspace"
      test ! -e "$memory"
      test ! -e "$cpu"
      printf "PASS: %s job limit stopped the trusted program and cleanup succeeded\n" "$kind"
    done
    compiler=/usr/local/gcc-9.2.0/bin/g++
    test "$("$compiler" -dumpfullversion)" = 9.2.0
    test "$("$compiler" -dumpmachine)" = x86_64-pc-linux-gnu
    test -x /usr/bin/as
    test -x /usr/bin/ld
    workspace="$(/usr/local/bin/isolate --cg --box-id=0 --init)"
    test "$workspace" = /var/local/lib/isolate/0
    : > "$workspace/box/stdin"
    cat > "$workspace/box/main.cpp" <<"CPP"
#include <iostream>
#include <unistd.h>
int main() {
    if (getuid() != 60000 || geteuid() != 60000 ||
        getgid() != 60000 || getegid() != 60000) return 3;
    long long a = 0, b = 0;
    if (!(std::cin >> a >> b)) return 2;
    std::cout << a + b << "\n";
    return 0;
}
CPP
    run_cpp_in_box() {
      /usr/local/bin/isolate --cg --box-id=0 --no-default-dirs \
        --dir=/box=./box:rw --dir=/usr --dir=/lib --dir=/lib64:maybe \
        --env=PATH=/usr/bin --env=TMPDIR=/box \
        --env=LD_LIBRARY_PATH=/usr/local/gcc-9.2.0/lib64 \
        --stdin=/box/stdin --stdout=/box/stdout --stderr=/box/stderr "$@"
    }
    check_success_metadata() {
      local metadata="$1"
      [[ "$(grep -c "^exitcode:" "$metadata")" == 1 ]] || return 1
      grep -qx "exitcode:0" "$metadata" || return 1
      if grep -Eq "^(status|message|exitsig|killed|cg-oom-killed):" "$metadata"; then return 1; fi
    }
    check_cpp_accounting() {
      local label="$1" limit="$2" peak usage
      test "$(cat "$memory/memory.limit_in_bytes")" = "$limit"
      test "$(cat "$memory/memory.memsw.limit_in_bytes")" = "$limit"
      test "$(cat "$memory/memory.failcnt")" = 0
      test "$(cat "$memory/memory.memsw.failcnt")" = 0
      peak="$(cat "$memory/memory.max_usage_in_bytes")"
      usage="$(cat "$cpu/cpuacct.usage")"
      [[ "$peak" =~ ^[0-9]+$ && "$usage" =~ ^[0-9]+$ ]]
      test "$peak" -gt 0
      test "$peak" -le "$limit"
      test "$usage" -gt 0
      test -z "$(cat "$memory/tasks")"
      test -z "$(cat "$cpu/tasks")"
      printf "CppPhase=%s JobPeakBytes=%s JobCpuNs=%s\n" "$label" "$peak" "$usage"
    }
    compiler_child_is_accounted() {
      local pid="$1" command_name
      [[ "$pid" =~ ^[1-9][0-9]*$ ]] || return 1
      IFS= read -r command_name < "/proc/$pid/comm" || return 1
      [[ "$command_name" == cc1plus ]] || return 1
      grep -qx "$pid" "$memory/tasks" && grep -qx "$pid" "$cpu/tasks"
    }

    run_cpp_in_box --processes=8 --time=5 --wall-time=15 --mem=131072 \
      --cg-mem=131072 --stack=16384 --fsize=1024 --meta=/tmp/compile.meta --run -- \
      "$compiler" -std=c++17 -O0 -Wall -Wextra -Werror /box/main.cpp -o /box/main &
    compile_pid=$!
    child_seen=0
    # Observe outside the inner sandbox; it receives no /proc or cgroup mounts.
    while kill -0 "$compile_pid" 2>/dev/null; do
      while IFS= read -r pid; do
        if compiler_child_is_accounted "$pid" 2>/dev/null; then
          child_seen=1
          printf "CompilerChildPid=%s Command=cc1plus MemoryAndCpuGroups=verified\n" "$pid"
          break
        fi
      done < "$memory/tasks"
      [[ "$child_seen" -eq 0 ]] || break
      sleep 0.02
    done
    wait "$compile_pid"
    test "$child_seen" -eq 1
    check_success_metadata /tmp/compile.meta
    test ! -s "$workspace/box/stdout"
    test ! -s "$workspace/box/stderr"
    test -x "$workspace/box/main"
    check_cpp_accounting compile 134217728
    printf "PASS: trusted C++17 program compiled with an accounted compiler child\n"

    check_sum() {
      printf "%s %s\n" "$1" "$2" > "$workspace/box/stdin"
      printf "%s\n" "$3" > /tmp/expected
      run_cpp_in_box --processes=1 --time=1 --wall-time=3 --mem=32768 \
        --cg-mem=32768 --stack=8192 --fsize=8 --meta=/tmp/run.meta --run -- /box/main
      check_success_metadata /tmp/run.meta
      test ! -s "$workspace/box/stderr"
      cmp /tmp/expected "$workspace/box/stdout"
      check_cpp_accounting run 33554432
      emit_cpp_result
    }
    emit_cpp_result() {
      local source_hash input output wall
      source_hash="$(sha256sum "$workspace/box/main.cpp")"
      source_hash="${source_hash%% *}"
      input="$(base64 -w 0 "$workspace/box/stdin")"
      output="$(base64 -w 0 "$workspace/box/stdout")"
      wall="$(sed -n "s/^time-wall://p" /tmp/run.meta)"
      printf "INGENIUM_LAB_RESULT {\"source_sha256\":\"%s\",\"stdin_b64\":\"%s\",\"stdout_b64\":\"%s\",\"cpu_ns\":%s,\"peak_bytes\":%s,\"wall_seconds\":\"%s\"}\n" \
        "$source_hash" "$input" "$output" "$(cat "$cpu/cpuacct.usage")" \
        "$(cat "$memory/memory.max_usage_in_bytes")" "$wall"
    }
    check_sum 7 5 12
    check_sum -9 4 -5
    check_sum 2147483647 1 2147483648
    printf "PASS: three exact C++ answers and UID/GID checks passed in accounted job cgroups\n"
    /usr/local/bin/isolate --cg --box-id=0 --cleanup
    test ! -e "$workspace"
    test ! -e "$memory"
    test ! -e "$cpu"
    printf "PASS: all workspaces and job cgroups removed\n"
  ')
extra_mounts=()
extra_options=()
if [[ -n "$failure" ]]; then
  sandbox_command=(/bin/bash /run/ingenium-failure-box.sh "$failure" "$expected_hash")
  extra_mounts=(
    --mount "type=bind,src=$source_directory/failure-box.sh,dst=/run/ingenium-failure-box.sh,readonly"
    --mount "type=bind,src=$source_directory/fixtures/$failure.cpp,dst=/run/ingenium-fixture.cpp,readonly"
  )
fi
if [[ "$profile_mode" -eq 1 ]]; then
  sandbox_command=(/usr/local/bin/python3.14 -I -B /usr/local/share/ingenium-profiles/runtime.py --parity)
fi
if [[ "$stream_mode" -eq 1 ]]; then
  sandbox_command=(/usr/local/bin/python3.14 -I -B /run/ingenium-streams/runtime.py --fixed-suite)
  extra_mounts=(--mount "type=bind,src=$source_directory/streams,dst=/run/ingenium-streams,readonly")
  if [[ -n "$stream_job" ]]; then
    sandbox_command=(/usr/local/bin/python3.14 -I -B /run/ingenium-streams/runtime.py --bound-job "$stream_job_hash")
    extra_mounts+=(--mount "type=bind,src=$stream_job,dst=/run/ingenium-stream-job.json,readonly")
    extra_options=(--log-driver json-file --log-opt max-size=2m --log-opt max-file=1)
  fi
fi
if [[ "$isolation_mode" -eq 1 ]]; then
  sandbox_command=(/usr/local/bin/python3.14 -I -B /run/ingenium-isolation/runtime.py --fixed-security)
  extra_mounts+=(--mount "type=bind,src=$source_directory/isolation,dst=/run/ingenium-isolation,readonly")
  extra_options=(--log-driver json-file --log-opt max-size=1m --log-opt max-file=1)
fi
if [[ -n "$crash_nonce" ]]; then
  sandbox_command=(/bin/bash /run/ingenium-crash-box.sh)
  extra_mounts=(--mount "type=bind,src=$source_directory/crash-box.sh,dst=/run/ingenium-crash-box.sh,readonly")
  extra_options=(--label "ingenium.lab.crash=$crash_nonce")
fi
docker run --pull=never --platform linux/amd64 --name "$container" \
  --restart no --network none --read-only --user 0:0 \
  --cgroupns host --cgroup-parent "$parent" --env "INGENIUM_CGROUP_PARENT=$parent" \
  --cap-drop ALL --cap-add CHOWN --cap-add DAC_OVERRIDE --cap-add KILL \
  --cap-add SETGID --cap-add SETUID --cap-add SYS_ADMIN --cap-add SYS_CHROOT \
  --security-opt no-new-privileges=true --security-opt "apparmor=$profile" \
  --memory "$container_memory" --memory-swap "$container_memory" --pids-limit "$parent_tasks" --cpus 0.5 \
  --tmpfs "/var/local/lib/isolate:rw,exec,nosuid,nodev,$workspace_options,uid=0,gid=0,mode=0755" \
  --tmpfs /run/ingenium-probe-cgroups:rw,nosuid,nodev,noexec,size=1m,uid=0,gid=0,mode=0755 \
  --tmpfs "/tmp:rw,nosuid,nodev,noexec,size=$temporary_size,uid=0,gid=0,mode=0700" \
  --mount "type=bind,src=$memory/jobs,dst=/run/ingenium-probe-cgroups/memory" \
  --mount "type=bind,src=/sys/fs/cgroup/cpuacct/$name/jobs,dst=/run/ingenium-probe-cgroups/cpuacct" \
  --mount "type=bind,src=$runtime_directory/isolate.conf,dst=/usr/local/etc/isolate,readonly" \
  "${extra_mounts[@]}" "${extra_options[@]}" --entrypoint /usr/bin/timeout "$image" \
  --signal=TERM --kill-after=5s "$deadline" "${sandbox_command[@]}"
[[ "$(docker inspect --type container "$container" --format '{{.State.Running}}|{{.State.ExitCode}}|{{.State.OOMKilled}}|{{.AppArmorProfile}}|{{.HostConfig.CgroupParent}}')" == "false|0|false|$profile|$parent" ]] || fail 'Container completion/parent without container OOM was not confirmed.'
check_budgets
for path in "${owned_jobs[@]}" "${owned_parents[@]}"; do
  membership=tasks
  [[ "$path" != /sys/fs/cgroup/unified/* ]] || membership=cgroup.procs
  [[ -z "$(cat "$path/$membership")" ]] || fail 'Unexpected remaining tasks; retain evidence.'
done
docker rm -v "$container"
apparmor_parser --remove --skip-cache "$runtime_directory/profile"
printf 'PASS: stopped test container and profile removed\n'
safe_to_cleanup=1
completed=1
