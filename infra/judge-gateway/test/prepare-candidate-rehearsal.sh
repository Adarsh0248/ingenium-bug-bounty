#!/bin/bash
set -euo pipefail
if [ "$(id -u)" != 0 ] || [ "$(hostname)" != ingenium-judge-verification-01 ] || [ "$#" != 0 ]; then
  echo 'Pinned candidate rehearsal requires the verification VM and root.' >&2
  exit 1
fi
umask 077
cd -- "$(dirname -- "$(readlink -f -- "$0")")"
sha256sum -c SHA256SUMS
test ! -e /opt/ingenium-candidate-rehearsal-v19
test ! -L /opt/ingenium-candidate-rehearsal-v19
install -d -o 0 -g 0 -m 0555 /opt/ingenium-candidate-rehearsal-v19
install -o 0 -g 0 -m 0444 candidate-check.js candidate.json host-cli.js capsule-cli.js package.json ./*.sql /opt/ingenium-candidate-rehearsal-v19/
exec env -i PATH=/usr/bin:/bin HOME=/root LANG=C.UTF-8 \
  /opt/ingenium/judge-executor/node /opt/ingenium-candidate-rehearsal-v19/candidate-check.js
