#!/bin/bash
set -euo pipefail
if [ "$(id -u)" != 0 ] || [ "$(hostname)" != ingenium-judge-verification-01 ] || [ "$#" != 0 ]; then
  echo 'Registry rehearsal requires the approved verification VM and root.' >&2
  exit 1
fi
umask 077
cd -- "$(dirname -- "$(readlink -f -- "$0")")"
sha256sum -c SHA256SUMS
test ! -e /opt/ingenium-host-registry-v1
test ! -L /opt/ingenium-host-registry-v1
test ! -e /etc/ingenium/judge-launcher.json
test ! -L /etc/ingenium/judge-launcher.json
install -d -o 0 -g 0 -m 0555 /opt/ingenium-host-registry-v1
install -o 0 -g 0 -m 0444 registry-check.js package.json ./*.sql /opt/ingenium-host-registry-v1/
exec env -i PATH=/usr/bin:/bin HOME=/root LANG=C.UTF-8 \
  /opt/ingenium/judge-executor/node /opt/ingenium-host-registry-v1/registry-check.js
