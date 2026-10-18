#!/usr/bin/env bash
set +x
set -euo pipefail
shopt -s inherit_errexit
umask 077
ulimit -c 0
[[ "$EUID" -eq 0 && $# -eq 2 && "$2" =~ ^[0-9a-f]{64}$ ]]
fixture="$1"
case "$fixture" in
  wrong-output|compile-error|signal-crash|nonzero-exit|cpu-limit|memory-limit|output-limit|output-boundary) ;;
  *) exit 1 ;;
esac
test "$(cat /proc/self/attr/current)" = 'ingenium-isolate-smoke-v1 (enforce)'
grep -Eq '^NoNewPrivs:[[:space:]]+1$' /proc/self/status
grep -Eq '^Seccomp:[[:space:]]+2$' /proc/self/status
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
compiler=/usr/local/gcc-9.2.0/bin/g++
test "$("$compiler" -dumpfullversion)" = 9.2.0
test "$("$compiler" -dumpmachine)" = x86_64-pc-linux-gnu
memory=/run/ingenium-probe-cgroups/memory/box-0
cpu=/run/ingenium-probe-cgroups/cpuacct/box-0
init_box() {
  test ! -e /var/local/lib/isolate/0
  test ! -e "$memory"
  test ! -e "$cpu"
  workspace="$(/usr/local/bin/isolate --cg --box-id=0 --init)"
  test "$workspace" = /var/local/lib/isolate/0
  printf '7 5\n' > "$workspace/box/stdin"
}
clean_box() {
  test -z "$(cat "$memory/tasks")"
  test -z "$(cat "$cpu/tasks")"
  /usr/local/bin/isolate --cg --box-id=0 --cleanup
  test ! -e "$workspace"
  test ! -e "$memory"
  test ! -e "$cpu"
}
run_box() {
  /usr/local/bin/isolate --cg --box-id=0 --no-default-dirs \
    --dir=/box=./box:rw --dir=/usr --dir=/lib --dir=/lib64:maybe \
    --env=PATH=/usr/bin --env=TMPDIR=/box \
    --env=LD_LIBRARY_PATH=/usr/local/gcc-9.2.0/lib64 \
    --stdin=/box/stdin --stdout=/box/stdout --stderr=/box/stderr "$@"
}
check_limits() {
  test "$(cat "$memory/memory.limit_in_bytes")" = "$1"
  test "$(cat "$memory/memory.memsw.limit_in_bytes")" = "$1"
  test -z "$(cat "$memory/tasks")"
  test -z "$(cat "$cpu/tasks")"
}
phase_data() {
  local rc="$1" cap="$2" meta="$3" path
  for path in "$workspace/box/stdout" "$workspace/box/stderr" "$meta"; do
    [[ -f "$path" && ! -L "$path" ]]
    test "$(stat -c %s "$path")" -le "$cap"
  done
  test "$(stat -c %s "$meta")" -le 4096
  printf '{"rc":%s,"meta_b64":"%s","stdout_b64":"%s","stderr_b64":"%s","cpu_ns":%s,"peak_bytes":%s,"ram_hits":%s,"combined_hits":%s}' \
    "$rc" "$(base64 -w 0 "$meta")" "$(base64 -w 0 "$workspace/box/stdout")" \
    "$(base64 -w 0 "$workspace/box/stderr")" "$(cat "$cpu/cpuacct.usage")" \
    "$(cat "$memory/memory.max_usage_in_bytes")" "$(cat "$memory/memory.failcnt")" \
    "$(cat "$memory/memory.memsw.failcnt")"
}
init_box
install -m 0444 /run/ingenium-fixture.cpp "$workspace/box/main.cpp"
source_hash="$(sha256sum "$workspace/box/main.cpp")"
source_hash="${source_hash%% *}"
test "$source_hash" = "$2"
rc=0
run_box --processes=8 --time=5 --wall-time=15 --mem=131072 --cg-mem=131072 \
  --stack=16384 --fsize=1024 --meta=/tmp/compile.meta --run -- \
  "$compiler" -std=c++17 -O0 -Wall -Wextra -Werror /box/main.cpp -o /box/main || rc=$?
check_limits 134217728
compile_data="$(phase_data "$rc" 65536 /tmp/compile.meta)"
run_data=null
if [[ "$fixture" != compile-error ]]; then
  test "$rc" -eq 0
  test "$(grep -c '^exitcode:' /tmp/compile.meta)" = 1
  grep -qx 'exitcode:0' /tmp/compile.meta
  if grep -Eq '^(status|message|exitsig|killed|cg-oom-killed):' /tmp/compile.meta; then exit 1; fi
  test -f "$workspace/box/main"
  test ! -L "$workspace/box/main"
  test -x "$workspace/box/main"
  # Fresh runtime groups keep compile-cache charges out of the 16 MiB OOM probe.
  install -m 0555 "$workspace/box/main" /tmp/compiled
  clean_box
  init_box
  install -m 0555 /tmp/compiled "$workspace/box/main"
  job_kib=32768 address_kib=32768 cpu_seconds=1 wall_seconds=3
  if [[ "$fixture" == cpu-limit ]]; then cpu_seconds=0.2; wall_seconds=5; fi
  if [[ "$fixture" == memory-limit ]]; then job_kib=16384; address_kib=262144; fi
  rc=0
  run_box --processes=1 --time="$cpu_seconds" --wall-time="$wall_seconds" \
    --mem="$address_kib" --cg-mem="$job_kib" --stack=8192 --fsize=8 \
    --meta=/tmp/run.meta --run -- /box/main || rc=$?
  check_limits "$((job_kib * 1024))"
  run_data="$(phase_data "$rc" 8192 /tmp/run.meta)"
fi
clean_box
printf 'INGENIUM_FAILURE_RESULT {"fixture":"%s","source_sha256":"%s","compile":%s,"run":%s}\n' \
  "$fixture" "$source_hash" "$compile_data" "$run_data"
printf 'PASS: fixed failure fixture workspace and job groups removed\n'
