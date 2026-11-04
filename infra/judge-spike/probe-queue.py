import json
import os
import platform
import socket
import subprocess
import sys


API = "ingenium-judge-spike-api-1"  # gitleaks:allow -- Docker service name
DB = "ingenium-judge-spike-db-1"
REDIS = "ingenium-judge-spike-redis-1"

API_CHECK = """set +x
set -euo pipefail
test "$(id -u)" = 1000
test ! -L /api/judge0.conf
test "$(stat -c '%a:%u:%g' /api/judge0.conf)" = 400:1000:999
for setting in MAINTENANCE_MODE=true ENABLE_WAIT_RESULT=false \
  ENABLE_BATCHED_SUBMISSIONS=false ENABLE_CALLBACKS=false \
  ENABLE_ADDITIONAL_FILES=false ENABLE_COMPILER_OPTIONS=false \
  ENABLE_COMMAND_LINE_ARGUMENTS=false ENABLE_NETWORK=false \
  ALLOW_ENABLE_NETWORK=false; do
  grep -qx -- "$setting" /api/judge0.conf
done
test "${JUDGE0_VERSION:-}" = 1.13.1
printf 'maintenance-on|queue=1.13.1\\n'
"""

# Only booleans leave PostgreSQL; source, tokens and language commands stay private.
SQL = """SELECT json_build_object(
  'read_only', current_setting('transaction_read_only') = 'on',
  'cpp_profile_matches', EXISTS (
    SELECT 1 FROM languages WHERE id = 54
      AND name = 'C++ (GCC 9.2.0)' AND is_archived = false
      AND source_file = 'main.cpp'
      AND compile_cmd = '/usr/local/gcc-9.2.0/bin/g++ %s main.cpp'
      AND run_cmd = 'LD_LIBRARY_PATH=/usr/local/gcc-9.2.0/lib64 ./a.out'
  ),
  'submissions_empty', NOT EXISTS (SELECT 1 FROM submissions)
);
"""

# EVAL_RO forbids dataset writes. Bound the keyspace before enumerating names.
QUEUE_CHECK = """if redis.call('DBSIZE') > 32 then
  return cjson.encode({keyspace_ok=false})
end
local allowed = {
  ['resque:queues']=true, ['resque:queue:1.13.1']=true,
  ['resque:workers']=true, ['resque:failed']=true
}
for _, key in ipairs(redis.call('KEYS', '*')) do
  if not allowed[key] then return cjson.encode({keyspace_ok=false}) end
end
local count = redis.call('SCARD', 'resque:queues')
if count > 1 then return cjson.encode({queue_only=false}) end
local names = redis.call('SMEMBERS', 'resque:queues')
return cjson.encode({
  queue_only=(count == 0 or names[1] == '1.13.1'),
  pending=redis.call('LLEN', 'resque:queue:1.13.1'),
  workers=redis.call('SCARD', 'resque:workers'),
  failed=redis.call('LLEN', 'resque:failed')
})
"""


def run(*args, data=None):
    result = subprocess.run(
        args, input=data, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
        check=True, timeout=20,
    )
    if len(result.stdout) > 8192:
        raise RuntimeError("A status response exceeded the probe limit.")
    return result.stdout.strip()


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("Duplicate status field.")
        result[key] = value
    return result


def expect_json(raw, expected, message):
    actual = json.loads(raw, object_pairs_hook=unique_object)
    if (type(actual) is not dict or actual.keys() != expected.keys()
            or any(type(actual[key]) is not type(value) or actual[key] != value
                   for key, value in expected.items())):
        raise RuntimeError(message)


def check_services():
    names = run(
        "docker", "ps", "--filter",
        "label=com.docker.compose.project=ingenium-judge-spike", "--format", "{{.Names}}",
    ).splitlines()
    if len(names) != 3 or set(names) != {API.encode(), DB.encode(), REDIS.encode()}:
        raise RuntimeError("Expected only the three running lab services; inspect without restarting or deleting anything.")
    print("PASS: only the existing API, database and Redis lab services are running")

    if run("docker", "exec", "--user", "1000:999", API, "/bin/bash", "-c", API_CHECK) != b"maintenance-on|queue=1.13.1":
        raise RuntimeError("The private API configuration check failed.")
    print("PASS: API restrictions remain set and the queue version is 1.13.1")


# shortcut: idle-lab snapshot only; dispatch still needs atomic ownership checks.
def check_queue():
    check_services()
    raw = run(
        "docker", "exec", "-i", "--user", "999:999",
        "--env", "PGCONNECT_TIMEOUT=5",
        "--env", "PGOPTIONS=-c default_transaction_read_only=on -c statement_timeout=5000 -c lock_timeout=1000",
        DB, "/bin/sh", "-ec",
        'PGPASSWORD="$(cat /run/secrets/postgres_password)"; export PGPASSWORD; '
        'exec psql -X --no-password -h 127.0.0.1 -U judge0 -d judge0 -At -v ON_ERROR_STOP=1 -f -',
        data=SQL.encode("ascii"),
    )
    expect_json(raw, {
        "read_only": True, "cpp_profile_matches": True, "submissions_empty": True,
    }, "The C++ language definition or empty lab-submission check failed; preserve the data for inspection.")
    print("PASS: read-only database check matches the stock C++ profile and finds no submissions")

    raw = run(
        "docker", "exec", "--user", "999:999", REDIS, "/bin/sh", "-ec",
        'REDISCLI_AUTH="$(cat /run/secrets/redis_password)"; export REDISCLI_AUTH; '
        'exec redis-cli -h 127.0.0.1 -p 6379 --raw -e EVAL_RO "$1" 0',
        "probe-queue", QUEUE_CHECK,
    )
    expect_json(raw, {"queue_only": True, "pending": 0, "workers": 0, "failed": 0},
                "Unexpected Redis keys, queue, jobs or worker registrations; preserve them for inspection.")
    print("PASS: read-only Redis check finds no pending jobs, registered workers or failures")


def main(argv=None):
    args = sys.argv[1:] if argv is None else argv
    if args or platform.system() != "Linux" or socket.gethostname() != "ingenium-judge-spike-01" or os.geteuid() != 0:
        print("FAIL: run sudo python3 -B probe-queue.py only on the isolated judge VM, without arguments.", file=sys.stderr)
        return 1
    try:
        check_queue()
    except RuntimeError as error:
        print(f"FAIL: {error}", file=sys.stderr)
        return 1
    except subprocess.TimeoutExpired:
        print("FAIL: a read-only status command timed out; inspect before continuing.", file=sys.stderr)
        return 1
    except (OSError, subprocess.CalledProcessError, ValueError, TypeError):
        print("FAIL: a read-only status command or response check failed; raw diagnostics were not printed.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
