#!/bin/bash
set -euo pipefail
if [ "$(id -u)" != 0 ] || [ "$(hostname)" != ingenium-judge-verification-01 ] || [ "$#" != 0 ]; then
  echo 'Host installation probe requires the approved verification VM and root.' >&2
  exit 1
fi
umask 077
cd -- "$(dirname -- "$(readlink -f -- "$0")")"
sha256sum -c SHA256SUMS
root=/opt/ingenium/judge-executor
test ! -L "$root"
test "$(stat -c '%u:%g:%a' "$root")" = 0:0:555
for path in "$root/app" "$root/security" "$root/node" "$root/launch" /opt/ingenium-host-installation-v1 /var/lib/ingenium/judge-executor/capsules; do
  test ! -e "$path"
  test ! -L "$path"
done
install -d -o 0 -g 0 -m 0700 /var/lib/ingenium/judge-executor/capsules
echo 'c6252002e37b279e37fbddad7e1f0cfa0cae7c1c1d49bcbaca6fcb3001ed683e  /opt/ingenium-host-prerequisites-v1/apparmor.bin' | sha256sum -c -
install -d -o 0 -g 0 -m 0555 "$root/app/judge" "$root/security" /opt/ingenium-host-installation-v1
install -o 0 -g 0 -m 0444 release/app/judge/host-cli.js release/app/judge/capsule-cli.js "$root/app/judge/"
install -o 0 -g 0 -m 0444 release/app/package.json "$root/app/package.json"
install -o 0 -g 0 -m 0444 release/security/apparmor release/security/isolate release/security/seccomp.json release/security/LICENSE.moby release/security/SOURCE.md "$root/security/"
install -o 0 -g 0 -m 0444 /opt/ingenium-host-prerequisites-v1/apparmor.bin "$root/security/apparmor.bin"
install -o 0 -g 0 -m 0555 /opt/ingenium-host-prerequisites-v1/node "$root/node"
install -o 0 -g 0 -m 0555 release/launch "$root/launch"
chmod 0555 "$root/app" "$root/app/judge" "$root/security"
install -o 0 -g 0 -m 0444 installation-check.js package.json /opt/ingenium-host-installation-v1/
exec env -i PATH=/usr/bin:/bin HOME=/root LANG=C.UTF-8 \
  /opt/ingenium-host-prerequisites-v1/node /opt/ingenium-host-installation-v1/installation-check.js
