#!/bin/bash
set -euo pipefail
if [ "$(id -u)" != 0 ] || [ "$(hostname)" != ingenium-judge-verification-01 ] || [ "$#" != 0 ]; then
  echo 'Prerequisite setup requires the approved clean verification VM and root.' >&2
  exit 1
fi
umask 077
cd -- "$(dirname -- "$(readlink -f -- "$0")")"
sha256sum -c SHA256SUMS
test "$(stat -fc %T /sys/fs/cgroup/memory)" = cgroupfs
test "$(cat /sys/fs/cgroup/memory/memory.use_hierarchy)" = 1
test "$(cat /sys/module/apparmor/parameters/enabled)" = Y
test ! -e /opt/ingenium-host-prerequisites-v1
test ! -e /opt/ingenium
test ! -e /var/lib/ingenium
if grep -q '^ingenium-isolate-executor-v1 ' /sys/kernel/security/apparmor/profiles; then
  echo 'Existing test profile must be inspected, not replaced.' >&2
  exit 1
fi
available="$(df -B1 --output=avail /var/lib | tail -n 1)"
test "$available" -ge 12884901888
base=/opt/ingenium-host-prerequisites-v1
install -d -o 0 -g 0 -m 0700 "$base"
install -o 0 -g 0 -m 0444 check.js package.json observer.sha256 apparmor "$base/"
curl --proto '=https' --tlsv1.2 -fL --max-time 120 \
  https://nodejs.org/dist/v24.22.0/node-v24.22.0-linux-x64.tar.xz -o "$base/node.tar.xz"
echo "cc2f601cee82d9a5a233302fe307abc600727035fd7d2c3a3571755989e95008  $base/node.tar.xz" | sha256sum -c -
tar -xJf "$base/node.tar.xz" -C "$base" --strip-components=2 node-v24.22.0-linux-x64/bin/node
chown 0:0 "$base/node"
chmod 0555 "$base/node"
test "$("$base/node" --version)" = v24.22.0
install -d -o 0 -g 0 -m 0755 /opt/ingenium
install -d -o 0 -g 0 -m 0555 /opt/ingenium/judge-executor
install -o 0 -g 0 -m 0555 host-observe /opt/ingenium/judge-executor/host-observe
echo "$(cat observer.sha256)  /opt/ingenium/judge-executor/host-observe" | sha256sum -c -
apparmor_parser -Q -T -o "$base/apparmor.bin" "$base/apparmor"
chmod 0444 "$base/apparmor.bin"
apparmor_parser -a -B "$base/apparmor.bin"
install -d -o 0 -g 0 -m 0700 /var/lib/ingenium /var/lib/ingenium/judge-executor
backing=/var/lib/ingenium/judge-executor/checkpoints.ext4
install -o 0 -g 0 -m 0600 /dev/null "$backing"
test -f "$backing" && test ! -L "$backing"
test "$(stat -c %F "$backing")" = 'regular empty file'
fallocate -l 8589934592 "$backing"
test "$(stat -c %F "$backing")" = 'regular file'
test "$(stat -c %s "$backing")" = 8589934592
# Format only this newly created regular file; never accept a supplied device or disk path.
mkfs.ext4 -q -F -m 0 -N 65536 -E nodiscard,lazy_itable_init=0,lazy_journal_init=0 "$backing"
install -d -o 0 -g 0 -m 0700 /var/lib/ingenium/judge-executor/checkpoints
mount -t ext4 -o loop,nosuid,nodev,noexec "$backing" /var/lib/ingenium/judge-executor/checkpoints
chmod 0700 /var/lib/ingenium/judge-executor/checkpoints
chmod 0555 "$base"
env -i PATH=/usr/sbin:/usr/bin:/sbin:/bin LANG=C.UTF-8 "$base/node" "$base/check.js"
