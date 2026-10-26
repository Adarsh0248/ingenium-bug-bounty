#!/bin/bash
set -euo pipefail
if [ "$(id -u)" != 0 ] || [ "$(hostname)" != ingenium-judge-verification-01 ] || [ "$#" != 0 ]; then
  echo 'Release rehearsal requires the approved verification VM and root.' >&2
  exit 1
fi
umask 077
cd -- "$(dirname -- "$(readlink -f -- "$0")")"
sha256sum -c SHA256SUMS
test ! -e /opt/ingenium-release-rehearsal-v1
test ! -L /opt/ingenium-release-rehearsal-v1
install -d -o 0 -g 0 -m 0555 /opt/ingenium-release-rehearsal-v1
install -o 0 -g 0 -m 0444 release-check.js host-cli.js package.json ./*.sql /opt/ingenium-release-rehearsal-v1/
exec env -i PATH=/usr/bin:/bin HOME=/root LANG=C.UTF-8 \
  /opt/ingenium/judge-executor/node /opt/ingenium-release-rehearsal-v1/release-check.js
