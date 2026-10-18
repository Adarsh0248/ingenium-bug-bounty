#!/usr/bin/env bash
set +x
set -euo pipefail
umask 077

fail() { printf 'FAIL: %s\n' "$1" >&2; exit 1; }
[[ "$EUID" -eq 0 && "$(uname -s)" == Linux && "$(hostname)" == ingenium-judge-spike-01 ]] || fail 'Run only with sudo on the isolated judge VM.'
image=sha256:a0a4768705620218af104c2ad869fd087e1937815b690914512427a4b6135995
profile=ingenium-isolate-smoke-v1
profile_list=/sys/kernel/security/apparmor/profiles
source_directory="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
[[ -f "$source_directory/namespace-smoke.apparmor" && ! -L "$source_directory/namespace-smoke.apparmor" ]] || fail 'Missing regular test profile.'
[[ "$(cat /sys/module/apparmor/parameters/enabled)" == Y ]] || fail 'AppArmor is not enabled.'
loaded_profiles="$(cat "$profile_list")" || fail 'AppArmor enforcement metadata is unavailable.'
if grep -q "^$profile " <<< "$loaded_profiles"; then
  fail 'The test profile already exists; inspect the earlier attempt before rerunning.'
else
  [[ "$?" -eq 1 ]] || fail 'Could not inspect loaded profiles.'
fi
[[ "$(docker info --format '{{.CgroupVersion}}|{{.CgroupDriver}}')" == '1|cgroupfs' ]] || fail 'Unexpected Docker cgroup configuration.'
[[ "$(docker image inspect "$image" --format '{{.Id}}|{{.Os}}|{{.Architecture}}|{{.Config.User}}')" == "$image|linux|amd64|judge0" ]] || fail 'The expected local worker image is unavailable.'
[[ "$(docker inspect --type container ingenium-judge-spike-api-1 --format '{{.AppArmorProfile}}')" == docker-default ]] || fail 'The API profile changed; inspect before proceeding.'
grep -qx 'MAINTENANCE_MODE=true' /opt/ingenium-judge-spike/judge0.conf || fail 'Keep API maintenance enabled.'

runtime_directory=''
container='not-created'
safe_to_cleanup=1
cleanup() {
  local status=$?
  trap - EXIT
  if [[ "$safe_to_cleanup" -ne 1 ]]; then
    printf 'FAIL: incomplete probe; do not rerun or weaken restrictions. Retained for inspection:\nContainer: %s\nProfile: %s\nFiles: %s\n' "$container" "$profile" "$runtime_directory" >&2
    exit 1
  fi
  if [[ -n "$runtime_directory" ]]; then
    rm -f -- "$runtime_directory/profile" || status=1
    rmdir -- "$runtime_directory" || status=1
  fi
  exit "$status"
}
trap cleanup EXIT
runtime_directory="$(mktemp -d /run/ingenium-namespace-check.XXXXXX)"
if [[ ! "$runtime_directory" =~ ^/run/ingenium-namespace-check\.[a-zA-Z0-9]{6}$ ]]; then runtime_directory=''; fail 'Unexpected temporary policy path.'; fi
install -m 0444 -- "$source_directory/namespace-smoke.apparmor" "$runtime_directory/profile"
apparmor_parser --skip-kernel-load --skip-cache "$runtime_directory/profile"
printf 'PASS: test AppArmor profile compiled\n'

# Keep the policy and container evidence on any uncertain load/run/remove result.
safe_to_cleanup=0
apparmor_parser --add --skip-cache "$runtime_directory/profile"
container="ingenium-namespace-check-${runtime_directory##*.}"
docker run --pull=never --platform linux/amd64 --name "$container" \
  --restart no --network none --read-only --user 0:0 \
  --cap-drop ALL --cap-add CHOWN --cap-add DAC_OVERRIDE \
  --cap-add KILL --cap-add SETGID --cap-add SETUID --cap-add SYS_ADMIN --cap-add SYS_CHROOT \
  --security-opt no-new-privileges=true --security-opt "apparmor=$profile" \
  --memory 256m --memory-swap 256m --pids-limit 64 --cpus 1 \
  --tmpfs /var/local/lib/isolate:rw,nosuid,nodev,exec,size=32m,uid=0,gid=0,mode=0755 \
  --tmpfs /tmp:rw,nosuid,nodev,noexec,size=4m,uid=0,gid=0,mode=0700 \
  --entrypoint /usr/bin/timeout "$image" \
  --signal=TERM --kill-after=5s 45s /bin/bash -c '
    set -euo pipefail
    test "$(cat /proc/self/attr/current)" = "ingenium-isolate-smoke-v1 (enforce)"
    grep -Eq "^NoNewPrivs:[[:space:]]+1$" /proc/self/status
    grep -Eq "^Seccomp:[[:space:]]+2$" /proc/self/status
    test -x /usr/bin/id
    compiler=/usr/local/gcc-9.2.0/bin/g++
    test "$("$compiler" -dumpfullversion)" = 9.2.0
    test "$("$compiler" -dumpmachine)" = x86_64-pc-linux-gnu
    test -x /usr/bin/as
    test -x /usr/bin/ld
    workspace="$(/usr/local/bin/isolate --box-id=0 --init)"
    test "$workspace" = /var/local/lib/isolate/0
    : > "$workspace/box/stdin"
    run_in_box() {
      /usr/local/bin/isolate --box-id=0 --no-default-dirs \
        --dir=/box=./box:rw --dir=/usr --dir=/lib --dir=/lib64:maybe \
        --env=PATH=/usr/bin --env=TMPDIR=/box \
        --env=LD_LIBRARY_PATH=/usr/local/gcc-9.2.0/lib64 \
        --stdin=/box/stdin --stdout=/box/stdout --stderr=/box/stderr "$@"
    }
    check_metadata() {
      local metadata
      metadata="$(cat "$1")" || return 1
      grep -qx "exitcode:0" <<< "$metadata" || return 1
      if grep -Eq "^(status|message|exitsig|killed):" <<< "$metadata"; then return 1; fi
    }
    run_in_box --time=1 --wall-time=3 --mem=32768 --stack=8192 --fsize=8 \
      --meta=/tmp/identity.meta --run -- /usr/bin/id -u
    test "$(cat "$workspace/box/stdout")" = 60000
    test ! -s "$workspace/box/stderr"
    check_metadata /tmp/identity.meta
    printf "PASS: trusted command ran as sandbox UID 60000\n"
    cat > "$workspace/box/main.cpp" <<"CPP"
#include <iostream>
#include <unistd.h>
int main() {
    if (getuid() != 60000 || geteuid() != 60000 ||
        getgid() != 60000 || getegid() != 60000) return 3;
    long long a = 0, b = 0;
    if (!(std::cin >> a >> b)) return 2;
    std::cout << a + b << "\n";
    return 0;
}
CPP
    run_in_box --processes=8 --time=5 --wall-time=15 --mem=131072 \
      --stack=16384 --fsize=1024 --meta=/tmp/compile.meta --run -- \
      "$compiler" -std=c++17 -O0 -Wall -Wextra -Werror /box/main.cpp -o /box/main
    check_metadata /tmp/compile.meta
    test ! -s "$workspace/box/stdout"
    test ! -s "$workspace/box/stderr"
    test -x "$workspace/box/main"
    printf "PASS: trusted C++17 program compiled\n"
    check_sum() {
      printf "%s %s\n" "$1" "$2" > "$workspace/box/stdin"
      printf "%s\n" "$3" > /tmp/expected
      run_in_box --processes=1 --time=1 --wall-time=3 --mem=32768 \
        --stack=8192 --fsize=8 --meta=/tmp/run.meta --run -- /box/main
      check_metadata /tmp/run.meta
      test ! -s "$workspace/box/stderr"
      cmp /tmp/expected "$workspace/box/stdout"
    }
    check_sum 7 5 12
    check_sum -9 4 -5
    check_sum 2147483647 1 2147483648
    printf "PASS: three C++ outputs match exactly, including sandbox UID/GID checks\n"
    /usr/local/bin/isolate --box-id=0 --cleanup
    test ! -e "$workspace"
    printf "PASS: sandbox workspace removed\n"
  '
[[ "$(docker inspect --type container "$container" --format '{{.State.Running}}|{{.State.ExitCode}}|{{.AppArmorProfile}}')" == "false|0|$profile" ]] || fail 'Container completion was not confirmed.'
docker rm -v "$container"
apparmor_parser --remove --skip-cache "$runtime_directory/profile"
safe_to_cleanup=1
printf 'PASS: stopped test container and temporary AppArmor profile removed\n'
