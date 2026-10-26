#!/bin/bash
set -euo pipefail
if [ "$(id -u)" != 0 ] || [ "$(hostname)" != ingenium-judge-verification-01 ] || [ "$#" != 0 ]; then
  echo 'Host resumption requires the approved verification VM and root.' >&2
  exit 1
fi
umask 077
test "$(stat -fc %T /sys/fs/cgroup/memory)" = cgroupfs
test "$(cat /sys/fs/cgroup/memory/memory.use_hierarchy)" = 1
test "$(cat /sys/module/apparmor/parameters/enabled)" = Y
backing=/var/lib/ingenium/judge-executor/checkpoints.ext4
test ! -L "$backing"
test "$(stat -c '%u:%g:%a:%s' "$backing")" = 0:0:600:8589934592
test "$(stat -c %h "$backing")" = 1
if ! mountpoint -q /var/lib/ingenium/judge-executor/checkpoints; then
  mount -t ext4 -o loop,nosuid,nodev,noexec "$backing" /var/lib/ingenium/judge-executor/checkpoints
fi
test "$(stat -c '%u:%g:%a' /var/lib/ingenium/judge-executor/checkpoints)" = 0:0:700
echo 'c6252002e37b279e37fbddad7e1f0cfa0cae7c1c1d49bcbaca6fcb3001ed683e  /opt/ingenium/judge-executor/security/apparmor.bin' | sha256sum -c -
if ! grep -q '^ingenium-isolate-executor-v1 ' /sys/kernel/security/apparmor/profiles; then
  apparmor_parser -a -B /opt/ingenium/judge-executor/security/apparmor.bin
fi
systemctl start ingenium-judge-docker.service
test "$(stat -c '%u:%g:%a' /run/docker.sock)" = 0:0:600
systemctl is-active ingenium-judge-docker.service
cat /proc/sys/kernel/random/boot_id
echo 'PASS: existing checkpoint filesystem remounted without formatting; policy and dedicated daemon available for fresh verification'
