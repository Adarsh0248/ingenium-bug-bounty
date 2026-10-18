#!/usr/bin/env bash
set +x
set -euo pipefail
umask 077

fail() { printf 'FAIL: %s\n' "$1" >&2; exit 1; }
[[ "$EUID" -eq 0 && "$(uname -s)" == Linux && "$(hostname)" == ingenium-judge-spike-01 ]] || fail 'Run only with sudo on the isolated judge VM.'

image=sha256:a0a4768705620218af104c2ad869fd087e1937815b690914512427a4b6135995
memory_root=/sys/fs/cgroup/memory
cpu_root=/sys/fs/cgroup/cpuacct
[[ "$(docker info --format '{{.CgroupVersion}}|{{.CgroupDriver}}')" == '1|cgroupfs' ]] || fail 'Unexpected Docker cgroup configuration.'
[[ "$(docker image inspect "$image" --format '{{.Id}}|{{.Os}}|{{.Architecture}}|{{.Config.User}}')" == "$image|linux|amd64|judge0" ]] || fail 'The expected local worker image is unavailable.'
[[ "$(readlink -f "$memory_root")" == /sys/fs/cgroup/memory && "$(readlink -f "$cpu_root")" == /sys/fs/cgroup/cpu,cpuacct ]] || fail 'Controller paths differ from the reviewed VM layout.'
for controller in "$memory_root" "$cpu_root"; do
  [[ "$(stat -fc %T "$controller")" == cgroupfs ]] || fail 'A required v1 controller is not mounted.'
done
hierarchy="$(cat "$memory_root/memory.use_hierarchy")"
printf 'MemoryHierarchy=%s\n' "$hierarchy"
[[ "$hierarchy" == 1 ]] || fail 'Unexpected memory hierarchy flag; no changes were made.'
grep -qx 'MAINTENANCE_MODE=true' /opt/ingenium-judge-spike/judge0.conf || fail 'Keep API maintenance enabled.'

memory_parent=''
cpu_parent=''
cpu_created=0
runtime_directory=''
safe_to_cleanup=1
probe_completed=0
cleanup() {
  local status=$? cleanup_failed=0
  trap - EXIT
  set +e
  if [[ "$safe_to_cleanup" -ne 1 ]]; then
    printf 'FAIL: probe did not confirm completion; do not rerun. Retained for inspection:\n%s\n%s\n%s\n' "$memory_parent" "$cpu_parent" "$runtime_directory" >&2
    exit 1
  fi
  for parent in "$memory_parent" "$cpu_parent"; do
    [[ -n "$parent" ]] || continue
    [[ "$parent" != "$cpu_parent" || "$cpu_created" -eq 1 ]] || continue
    if [[ -d "$parent/box-0" ]]; then rmdir -- "$parent/box-0" || cleanup_failed=1; fi
    rmdir -- "$parent" || cleanup_failed=1
  done
  if [[ "$cleanup_failed" -eq 0 && -n "$runtime_directory" ]]; then
    rm -f -- "$runtime_directory/isolate.conf" || cleanup_failed=1
    rmdir -- "$runtime_directory" || cleanup_failed=1
  fi
  if [[ "$cleanup_failed" -ne 0 ]]; then
    printf 'FAIL: cleanup needs inspection; do not rerun. Check these paths:\n%s\n%s\n%s\n' "$memory_parent" "$cpu_parent" "$runtime_directory" >&2
    status=1
  elif [[ "$status" -eq 0 && "$probe_completed" -eq 1 ]]; then
    printf 'PASS: host test groups removed\n'
  fi
  exit "$status"
}
trap cleanup EXIT

memory_parent="$(mktemp -d "$memory_root/ingenium-cg-check.XXXXXX")"
if [[ ! "$memory_parent" =~ ^/sys/fs/cgroup/memory/ingenium-cg-check\.[a-zA-Z0-9]{6}$ ]]; then memory_parent=''; fail 'Unexpected temporary cgroup path.'; fi
cpu_parent="$cpu_root/${memory_parent##*/}"
mkdir -m 700 -- "$cpu_parent"
cpu_created=1
chmod 0700 "$memory_parent" "$cpu_parent"
runtime_directory="$(mktemp -d /run/ingenium-cg-check.XXXXXX)"
if [[ ! "$runtime_directory" =~ ^/run/ingenium-cg-check\.[a-zA-Z0-9]{6}$ ]]; then runtime_directory=''; fail 'Unexpected temporary configuration path.'; fi
printf '%s\n' \
  'box_root = /var/local/lib/isolate' \
  'cg_root = /run/ingenium-probe-cgroups' \
  'first_uid = 60000' 'first_gid = 60000' 'num_boxes = 1' \
  > "$runtime_directory/isolate.conf"
chmod 0444 "$runtime_directory/isolate.conf"

# Retain state on any uncertain Docker outcome; never guess that it stopped.
safe_to_cleanup=0
docker run --rm --pull=never --platform linux/amd64 \
  --name "ingenium-cg-check-${memory_parent##*.}" \
  --network none --read-only --user 0:0 \
  --cap-drop ALL --cap-add CHOWN --security-opt no-new-privileges=true \
  --memory 128m --memory-swap 128m --pids-limit 32 --cpus 0.5 \
  --tmpfs /var/local/lib/isolate:rw,nosuid,nodev,noexec,size=16m,uid=0,gid=0,mode=0755 \
  --tmpfs /run/ingenium-probe-cgroups:rw,nosuid,nodev,noexec,size=1m,uid=0,gid=0,mode=0755 \
  --tmpfs /tmp:rw,nosuid,nodev,noexec,size=4m,uid=0,gid=0,mode=0700 \
  --mount "type=bind,src=$memory_parent,dst=/run/ingenium-probe-cgroups/memory" \
  --mount "type=bind,src=$cpu_parent,dst=/run/ingenium-probe-cgroups/cpuacct" \
  --mount "type=bind,src=$runtime_directory/isolate.conf,dst=/usr/local/etc/isolate,readonly" \
  --entrypoint /usr/bin/timeout "$image" \
  --signal=TERM --kill-after=5s 20s /bin/bash -c '
    set -euo pipefail
    workspace="$(/usr/local/bin/isolate --cg --box-id=0 --init)"
    test "$workspace" = /var/local/lib/isolate/0
    test -d "$workspace/box"
    for controller in memory cpuacct; do
      group="/run/ingenium-probe-cgroups/$controller/box-0"
      test -d "$group"
      test -z "$(cat "$group/tasks")"
    done
    printf "PASS: empty memory and CPU-accounting groups created\n"
    /usr/local/bin/isolate --cg --box-id=0 --cleanup
    test ! -e "$workspace"
    test ! -e /run/ingenium-probe-cgroups/memory/box-0
    test ! -e /run/ingenium-probe-cgroups/cpuacct/box-0
    printf "PASS: sandbox workspace and cgroups removed\n"
  '
for parent in "$memory_parent" "$cpu_parent"; do
  [[ -z "$(cat "$parent/tasks")" && ! -d "$parent/box-0" ]] || fail 'Unexpected remaining group state; preserved for inspection.'
done
safe_to_cleanup=1
probe_completed=1
