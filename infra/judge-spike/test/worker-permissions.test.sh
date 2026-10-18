#!/usr/bin/env bash
set -euo pipefail
umask 077

[[ "$EUID" -eq 0 ]] || { printf 'Use the documented isolated root test container.\n' >&2; exit 1; }
[[ "$(findmnt -n -o FSTYPE --target /tmp)" == tmpfs ]] || { printf 'Tests require a disposable /tmp tmpfs.\n' >&2; exit 1; }
image_directory="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../image" && pwd)"
mode="$(sed -n 's/^    && chmod \([0-7]*\) \/var\/local .*/\1/p' "$image_directory/Dockerfile")"
[[ "$mode" =~ ^[0-7]{3,5}$ ]] || { printf 'Expected one numeric worker directory chmod instruction.\n' >&2; exit 1; }
test_root="$(mktemp -d /tmp/ingenium-worker-permissions-tests.XXXXXX)"
cleanup() {
  case "$test_root" in
    /tmp/ingenium-worker-permissions-tests.*) rm -rf -- "$test_root" ;;
  esac
}
trap cleanup EXIT

fail() { printf 'FAIL: %s\n' "$1" >&2; exit 1; }

mkdir -p "$test_root/local/lib/isolate"
directories=("$test_root/local" "$test_root/local/lib" "$test_root/local/lib/isolate")
chgrp 50 "${directories[@]}"
chmod 2775 "${directories[0]}"
chmod 2755 "${directories[1]}"
chown 0:0 "${directories[@]}"
[[ "$(stat -c %a "${directories[0]}")" == 2775 ]] || fail 'Fixture requires CHOWN and FSETID capabilities to preserve directory setgid.'

chmod 0755 "${directories[@]}"
[[ "$(stat -c %a "${directories[0]}")" == 2755 && "$(stat -c %a "${directories[1]}")" == 2755 ]] || fail 'The original directory setgid regression was not reproduced.'
printf 'PASS: reproduced 0755 preserving directory setgid after chown\n'

chmod "$mode" "${directories[@]}"
for directory in "${directories[@]}"; do
  [[ "$(stat -c '%u:%g:%a' "$directory")" == '0:0:755' ]] || fail 'The worker chmod instruction did not produce root:root mode 755.'
done
printf 'PASS: actual worker chmod instruction clears inherited setgid\n'

chmod 7755 "${directories[0]}"
chmod "$mode" "${directories[0]}"
[[ "$(stat -c %a "${directories[0]}")" == 755 ]] || fail 'The worker chmod instruction retained special permission bits.'
printf 'PASS: worker chmod also clears other pre-existing special bits\n'
