#!/bin/bash
set -euo pipefail
if [ "$(id -u)" != 0 ] || [ "$(hostname)" != ingenium-judge-verification-01 ] || [ "$#" != 1 ] || [[ ! "$1" =~ ^sha256:[0-9a-f]{64}$ ]]; then
  echo 'Toolchain probe requires the verification VM, root and one immutable image ID.' >&2
  exit 1
fi
umask 077
docker=/opt/ingenium/judge-executor/docker
nonce="$(cat /proc/sys/kernel/random/uuid)"
evidence="/var/lib/ingenium/host-toolchains-$nonce"
mkdir -m 0700 "$evidence"
printf '%s\n' "$1" > "$evidence/image-id"
id="$("$docker" create --pull=never --name "ingenium-toolchains-$nonce" --label "ingenium.host-toolchain-check=$nonce" \
  --restart no --network none --read-only --user 65534:65534 --cap-drop ALL --security-opt no-new-privileges=true \
  --memory 768m --memory-swap 768m --cpus 0.75 --pids-limit 64 --log-driver none \
  --tmpfs /work:rw,nosuid,nodev,exec,size=64m,nr_inodes=256,uid=65534,gid=65534,mode=0700 \
  --tmpfs /tmp:rw,nosuid,nodev,noexec,size=4m,nr_inodes=64,uid=65534,gid=65534,mode=0700 \
  --mount type=bind,src=/opt/ingenium-host-peer-v1/toolchains-linux.mjs,dst=/fixture/toolchains-linux.mjs,readonly \
  --entrypoint /usr/local/bin/node "$1" /fixture/toolchains-linux.mjs)"
[[ "$id" =~ ^[0-9a-f]{64}$ ]]
printf '%s\n' "$id" > "$evidence/container-id"
"$docker" start --attach "$id" | tee "$evidence/output"
test "$(wc -l < "$evidence/output")" = 1
grep -q '^INGENIUM_TOOLCHAIN_REPORT ' "$evidence/output"
test "$("$docker" inspect --format '{{index .Config.Labels "ingenium.host-toolchain-check"}}|{{.State.Running}}|{{.State.Pid}}|{{.State.ExitCode}}|{{.Config.Image}}' "$id")" = "$nonce|false|0|0|$1"
"$docker" rm "$id"
printf 'PASS: fifteen fixed toolchain answers; original exited test container removed; evidence retained at %s\n' "$evidence"
