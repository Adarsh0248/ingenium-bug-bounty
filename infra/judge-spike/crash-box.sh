#!/usr/bin/env bash
set +x
set -euo pipefail
umask 077

# shortcut: fixed trusted shell/sleep pair only; this is not a participant-code supervisor.
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
[[ "${memory_group#"$INGENIUM_CGROUP_PARENT/"}" =~ ^[0-9a-f]{64}$ ]]
test "$cpu_group" = "$memory_group"
test "$pids_group" = "$memory_group"

workspace="$(/usr/local/bin/isolate --cg --box-id=0 --init)"
test "$workspace" = /var/local/lib/isolate/0
: > "$workspace/box/stdin"
sleep_binary="$(command -v sleep)"
case "$sleep_binary" in /bin/sleep|/usr/bin/sleep) ;; *) exit 1 ;; esac
cp -L -- "$sleep_binary" "$workspace/box/sleep"
chmod 0555 "$workspace/box/sleep"
# The host must observe both real UID-60000 processes before killing its worker.
set +e
/usr/local/bin/isolate --cg --box-id=0 --cg-mem=32768 --no-default-dirs \
  --dir=/box=./box:rw --dir=/usr --dir=/lib --dir=/lib64:maybe \
  --processes=4 --time=1 --wall-time=120 --mem=32768 --stack=8192 --fsize=8 \
  --env=PATH=/usr/bin:/bin --stdin=/box/stdin --stdout=/box/stdout --stderr=/box/stderr \
  --meta=/tmp/crash.meta --run -- /usr/local/bash-5.0/bin/bash --noprofile --norc \
  -c '/box/sleep 90 & child=$!; wait "$child"'
status=$?
set -e
printf '%s\n' "$status" > /tmp/ingenium-crash-exited
# Keep the trusted outer process alive for explicit workspace cleanup, then stop.
while :; do sleep 1; done
