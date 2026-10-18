import base64
from decimal import Decimal, DecimalException
import hashlib
import http.client
import importlib.util
import ipaddress
import json
import os
from pathlib import Path
import platform
import re
import signal
import socket
import stat
import subprocess
import sys
import time
import uuid


HERE = Path(__file__).resolve().parent
RUNTIME = Path("/opt/ingenium-judge-spike")
IMAGE = "sha256:1e91aa8647a728487bcc7259bc87762b06306193ba13d90fa6881b13462b8a54"
NETWORK = "ingenium-judge-spike_judge_private"
# shortcut: fixed trusted sum job only; use the reviewed supervisor before participant code.
CPP = b'''#include <iostream>
#include <unistd.h>
int main() {
    if (getuid() != 60000 || geteuid() != 60000 ||
        getgid() != 60000 || getegid() != 60000) return 3;
    long long a = 0, b = 0;
    if (!(std::cin >> a >> b)) return 2;
    std::cout << a + b << "\\n";
    return 0;
}
'''
SOURCE_HASH = hashlib.sha256(CPP).hexdigest()
CASES = [(b"7 5\n", b"12\n"), (b"-9 4\n", b"-5\n"), (b"2147483647 1\n", b"2147483648\n")]
PAYLOAD = {
    "source_code": base64.b64encode(CPP).decode("ascii"), "language_id": 54,
    "stdin": base64.b64encode(CASES[0][0]).decode("ascii"),
    "number_of_runs": 1, "cpu_time_limit": 1, "cpu_extra_time": 0,
    "wall_time_limit": 3, "memory_limit": 32768, "stack_limit": 8192,
    "max_processes_and_or_threads": 1, "max_file_size": 8,
    "enable_per_process_and_thread_time_limit": False,
    "enable_per_process_and_thread_memory_limit": False,
    "redirect_stderr_to_stdout": False, "enable_network": False,
}


def load_helper(name, filename):
    spec = importlib.util.spec_from_file_location(name, HERE / filename)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


queue = load_helper("lab_queue", "probe-queue.py")
api = load_helper("lab_api", "probe-api.py")
run = queue.run


def decode_json(raw):
    return json.loads(raw, object_pairs_hook=queue.unique_object)


def valid_uuid(value):
    if type(value) is not str or str(uuid.UUID(value)) != value or uuid.UUID(value).version != 4:
        raise RuntimeError("Unexpected lab token/job identity.")
    return value


def private_ip(container):
    raw = run("docker", "inspect", "--type", "container", container, "--format",
              '{{(index .NetworkSettings.Networks "' + NETWORK + '").IPAddress}}')
    address = ipaddress.IPv4Address(raw.decode("ascii"))
    if not any(address in ipaddress.IPv4Network(cidr) for cidr in ("10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16")):
        raise RuntimeError("Expected a private lab container address.")
    return str(address)


def db(sql, write=False):
    return decode_json(run(
        "docker", "exec", "-i", "--user", "999:999", "--env", "PGCONNECT_TIMEOUT=5",
        "--env", "PGOPTIONS=-c default_transaction_read_only=" + ("off" if write else "on")
        + " -c statement_timeout=5000 -c lock_timeout=1000",
        queue.DB, "/bin/sh", "-ec",
        'PGPASSWORD="$(cat /run/secrets/postgres_password)"; export PGPASSWORD; '
        'exec psql -X --no-password -h 127.0.0.1 -U judge0 -d judge0 -At -v ON_ERROR_STOP=1 -f -',
        data=sql.encode("ascii"),
    ))


QUEUE_GUARD = """if redis.call('DBSIZE') > 32 then return redis.error_reply('unexpected keyspace') end
local allowed = {['resque:queues']=true, ['resque:queue:1.13.1']=true,
                 ['resque:workers']=true, ['resque:failed']=true}
for _, key in ipairs(redis.call('KEYS', '*')) do
  if not allowed[key] then return redis.error_reply('unexpected key') end
end
if redis.call('SCARD', 'resque:queues') ~= 1 then return redis.error_reply('unexpected queues') end
local names = redis.call('SMEMBERS', 'resque:queues')
if names[1] ~= '1.13.1' or redis.call('SCARD', 'resque:workers') ~= 0
  or redis.call('LLEN', 'resque:failed') ~= 0
  or redis.call('LLEN', 'resque:queue:1.13.1') ~= tonumber(ARGV[1]) then
  return redis.error_reply('unexpected queue state')
end
"""
PEEK = QUEUE_GUARD + "return redis.call('LINDEX', 'resque:queue:1.13.1', 0)"
CLAIM = QUEUE_GUARD + """local head = redis.call('LINDEX', 'resque:queue:1.13.1', 0)
if head ~= ARGV[2] then return redis.error_reply('job changed') end
redis.call('LPOP', 'resque:queue:1.13.1')
return 'claimed'
"""
EMPTY = QUEUE_GUARD + "return 'empty'"


def redis(script, count, envelope=None):
    return run(
        "docker", "exec", "--user", "999:999", queue.REDIS, "/bin/sh", "-ec",
        'REDISCLI_AUTH="$(cat /run/secrets/redis_password)"; export REDISCLI_AUTH; '
        'exec redis-cli -h 127.0.0.1 -p 6379 --raw -e "$@"',
        "one-job", "EVAL" if envelope is not None else "EVAL_RO", script, "0", str(count),
        *([] if envelope is None else [envelope.decode("utf-8")]),
    )


def payload_guard(token, *, payload=None, total=1, finished=False):
    valid_uuid(token)
    payload = PAYLOAD if payload is None else payload
    if type(total) is not int or total < 1 or type(finished) is not bool:
        raise RuntimeError("Invalid fixed lab record scope.")
    clauses = [f"token = '{token}'", "finished_at IS NOT NULL" if finished else "finished_at IS NULL", "expected_output IS NULL",
               "callback_url IS NULL", "additional_files IS NULL", "compiler_options IS NULL",
               "command_line_arguments IS NULL",
               f"decode(source_code, 'base64') = decode('{payload['source_code']}', 'base64')",
               f"decode(stdin, 'base64') = decode('{payload['stdin']}', 'base64')"]
    for key, value in payload.items():
        if key not in ("source_code", "stdin"):
            clauses.append(f"{key} = {str(value).lower()}")
    clauses.append(f"(SELECT count(*) FROM submissions) = {total}")
    return " AND ".join(clauses)


def validate_message(raw, submission_id):
    message = decode_json(raw)
    if type(message) is not dict or set(message) != {"class", "args"}:
        raise RuntimeError("Unexpected queued job envelope.")
    if message["class"] != "ActiveJob::QueueAdapters::ResqueAdapter::JobWrapper" or type(message["args"]) is not list or len(message["args"]) != 1:
        raise RuntimeError("Unexpected queue adapter.")
    job = message["args"][0]
    expected = {"job_class": "IsolateJob", "queue_name": "1.13.1", "provider_job_id": None,
                "priority": None, "arguments": [submission_id], "executions": 0, "locale": "en"}
    if type(job) is not dict or set(job) != set(expected) | {"job_id"}:
        raise RuntimeError("Unexpected queued job fields.")
    valid_uuid(job["job_id"])
    for key, value in expected.items():
        if type(job[key]) is not type(value) or job[key] != value:
            raise RuntimeError("Queued job does not match the fixed lab submission.")
    if type(job["arguments"][0]) is not int or type(submission_id) is not int or submission_id <= 0:
        raise RuntimeError("Unexpected queued submission ID.")
    return job["job_id"]


def parse_sandbox_log(raw):
    text = raw.decode("ascii")
    prefix = "INGENIUM_LAB_RESULT "
    results = [decode_json(line[len(prefix):]) for line in text.splitlines() if line.startswith(prefix)]
    if (len(results) != 3 or "FAIL:" in text
            or text.splitlines().count("PASS: host test groups and temporary files removed") != 1):
        raise RuntimeError("Sandbox result or completed cleanup evidence is missing.")
    for result, (stdin, stdout) in zip(results, CASES):
        if type(result) is not dict or set(result) != {"source_sha256", "stdin_b64", "stdout_b64", "cpu_ns", "peak_bytes", "wall_seconds"}:
            raise RuntimeError("Unexpected sandbox evidence fields.")
        if (result["source_sha256"] != SOURCE_HASH
                or result["stdin_b64"] != base64.b64encode(stdin).decode("ascii")
                or result["stdout_b64"] != base64.b64encode(stdout).decode("ascii")
                or type(result["cpu_ns"]) is not int or not 0 < result["cpu_ns"] <= 1_000_000_000
                or type(result["peak_bytes"]) is not int or not 0 < result["peak_bytes"] <= 33554432
                or type(result["wall_seconds"]) is not str
                or re.fullmatch(r"[0-9]+(?:\.[0-9]+)?", result["wall_seconds"]) is None
                or not Decimal(0) <= Decimal(result["wall_seconds"]) <= Decimal(3)):
            raise RuntimeError("Fixed C++ output, identity or accounting evidence did not match.")
    return results[0]


def prepare_config(raw):
    lines = raw.split(b"\n")
    if lines.count(b"MAINTENANCE_MODE=true") != 1 or b"MAINTENANCE_MODE=false" in lines:
        raise RuntimeError("Original API maintenance configuration changed.")
    matches = re.findall(rb"^AUTHN_TOKEN=([0-9a-f]{64})$", raw, re.MULTILINE)
    if len(matches) != 1:
        raise RuntimeError("Invalid private API credential configuration.")
    return b"\n".join(b"MAINTENANCE_MODE=false" if line == b"MAINTENANCE_MODE=true" else line
                      for line in lines), matches[0].decode("ascii")


def sync_directory(path):
    fd = os.open(path, os.O_RDONLY | os.O_DIRECTORY)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


class Journal:
    def __init__(self, directory):
        self.directory = directory
        directory.mkdir(mode=0o700)
        sync_directory(directory.parent)
        fd = os.open(directory / "journal.jsonl", os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        os.close(fd)
        sync_directory(directory)

    def record(self, event, **fields):
        with (self.directory / "journal.jsonl").open("ab") as stream:
            stream.write(json.dumps({"event": event, **fields}, allow_nan=False).encode("ascii") + b"\n")
            stream.flush()
            os.fsync(stream.fileno())


def create_creator(journal, config, *, server="lab-server.sh", mounts=()):
    config_path = journal.directory / "creator.conf"
    fd = os.open(config_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "wb") as stream:
        stream.write(config)
        stream.flush()
        os.fchown(stream.fileno(), 1000, 999)
        os.fchmod(stream.fileno(), 0o400)
        os.fsync(stream.fileno())
    sync_directory(journal.directory)
    nonce = uuid.uuid4().hex
    name = "ingenium-lab-api-" + nonce
    journal.record("CREATOR_ALLOCATING", name=name, nonce=nonce)
    container = run(
        "docker", "create", "--pull=never", "--platform", "linux/amd64", "--name", name,
        "--label", "ingenium.lab.run=" + nonce, "--restart", "no", "--network", NETWORK,
        "--read-only", "--user", "1000:999", "--cap-drop", "ALL",
        "--security-opt", "no-new-privileges=true", "--security-opt", "apparmor=docker-default",
        "--memory", "768m", "--memory-swap", "768m", "--pids-limit", "128", "--cpus", "0.5",
        "--tmpfs", "/tmp:rw,nosuid,nodev,noexec,size=64m,uid=1000,gid=999,mode=0700",
        "--tmpfs", "/api/tmp:rw,nosuid,nodev,noexec,size=64m,uid=1000,gid=999,mode=0700",
        "--mount", f"type=bind,src={config_path},dst=/api/judge0.conf,readonly",
        "--mount", f"type=bind,src={HERE / server},dst=/api/scripts/server,readonly",
        *[argument for source, target in mounts for argument in
          ("--mount", f"type=bind,src={source},dst={target},readonly")],
        "--log-driver", "json-file", "--log-opt", "max-size=1m", "--log-opt", "max-file=1",
        IMAGE, "/api/scripts/server",
    ).decode("ascii")
    if re.fullmatch(r"[0-9a-f]{64}", container) is None:
        raise RuntimeError("Creator allocation is uncertain; inspect the retained run record.")
    journal.record("CREATOR_ALLOCATED", container=container)
    return container, nonce


def stop_creator(container, nonce, journal):
    identity = run("docker", "inspect", "--type", "container", container, "--format",
                   '{{.Config.Image}}|{{index .Config.Labels "ingenium.lab.run"}}')
    if identity != f"{IMAGE}|{nonce}".encode("ascii"):
        raise RuntimeError("Temporary API ownership could not be verified; no container was removed.")
    run("docker", "stop", "--time", "10", container)
    if run("docker", "inspect", "--type", "container", container, "--format", "{{.State.Running}}") != b"false":
        raise RuntimeError("Temporary API shutdown is uncertain.")
    log = journal.directory / "creator.log"
    with log.open("xb") as stream:
        os.chmod(log, 0o600)
        subprocess.run(["docker", "logs", "--tail", "80", container], stdout=stream,
                       stderr=subprocess.STDOUT, check=True, timeout=10)
        stream.flush()
        os.fsync(stream.fileno())
    run("docker", "rm", container)
    (journal.directory / "creator.conf").unlink()
    sync_directory(journal.directory)
    journal.record("CREATOR_REMOVED")


def wait_creator(host, token):
    deadline = time.monotonic() + 60
    while time.monotonic() < deadline:
        try:
            status, raw = api.request(host, "GET", "/about", token)
        except (OSError, http.client.HTTPException):
            time.sleep(1)
            continue
        if status != 200 or decode_json(raw).get("version") != "1.13.1":
            raise RuntimeError("Temporary API metadata/authentication check failed.")
        if api.request(host, "GET", "/about")[0] != 401:
            raise RuntimeError("Temporary API did not reject unauthenticated access.")
        return
    raise RuntimeError("Temporary API startup timed out.")


def create_submission(journal, config, token):
    container, nonce = create_creator(journal, config)
    try:
        run("docker", "start", container)
        host = private_ip(container)
        wait_creator(host, token)
        journal.record("CREATE_STARTED", source_sha256=SOURCE_HASH)
        # Never retry this POST: a lost reply can still mean one persisted/queued job.
        status, raw = api.request(host, "POST", "/submissions?base64_encoded=true&wait=false",
                                  token, json.dumps(PAYLOAD).encode("ascii"))
        reply = decode_json(raw)
        if status != 201 or type(reply) is not dict or set(reply) != {"token"}:
            raise RuntimeError("Submission creation was not confirmed; do not repeat it.")
        submission_token = valid_uuid(reply["token"])
        journal.record("CREATED", token=submission_token)
        return submission_token
    finally:
        stop_creator(container, nonce, journal)


def execute_fixed_job(journal):
    journal.record("RUN_STARTED")
    log = journal.directory / "sandbox.log"
    with log.open("xb") as stream:
        os.chmod(log, 0o600)
        result = subprocess.run(["/bin/bash", str(HERE / "cgroup-smoke.sh")],
                                stdout=stream, stderr=subprocess.STDOUT, timeout=90, check=False)
        stream.flush()
        os.fsync(stream.fileno())
    if result.returncode != 0 or log.stat().st_size > 65536:
        raise RuntimeError("Sandbox execution or cleanup failed; retain its resources and private log.")
    evidence = parse_sandbox_log(log.read_bytes())
    journal.record("RUN_FINISHED", evidence=evidence)
    return evidence


def verify_result(raw, token, evidence):
    result = decode_json(raw)
    expected = {"token": token, "status": {"id": 3, "description": "Accepted"},
                "stderr": None, "compile_output": None, "message": None,
                "exit_code": 0, "exit_signal": None}
    if type(result) is not dict or set(result) != set(expected) | {"stdout", "time", "wall_time", "memory"}:
        raise RuntimeError("Unexpected final API result fields.")
    for key, value in expected.items():
        if type(result[key]) is not type(value) or result[key] != value:
            raise RuntimeError("Final API result did not match the controlled execution.")
    if type(result["status"]["id"]) is not int or type(result["stdout"]) is not str:
        raise RuntimeError("Invalid final API result types.")
    encoded = result["stdout"].replace("\n", "")
    if (base64.b64decode(encoded, validate=True) != CASES[0][1]
            or type(result["memory"]) is not int or result["memory"] != (evidence["peak_bytes"] + 1023) // 1024
            or Decimal(str(result["time"])) != Decimal(evidence["cpu_ns"]) / 1_000_000_000
            or Decimal(str(result["wall_time"])) != Decimal(evidence["wall_seconds"])):
        raise RuntimeError("Final API output/accounting differs from the sandbox evidence.")


def run_experiment(journal, config, token):
    original_host = private_ip(queue.API)
    api.check_api(original_host, token)
    submission_token = create_submission(journal, config, token)
    print("PASS: one API submission created; temporary private API stopped and removed")
    guard = payload_guard(submission_token)
    row = db("SELECT json_build_object('id', id) FROM submissions WHERE status_id = 1 AND " + guard + ";")
    if type(row) is not dict or set(row) != {"id"} or type(row["id"]) is not int or row["id"] <= 0:
        raise RuntimeError("Persisted submission does not match the fixed source/input/limits.")
    guard += f" AND id = {row['id']}"
    raw = redis(PEEK, 1)
    job_id = validate_message(raw, row["id"])
    journal.record("CLAIM_STARTED", token=submission_token, job_id=job_id, envelope_sha256=hashlib.sha256(raw).hexdigest())
    if redis(CLAIM, 1, raw) != b"claimed":
        raise RuntimeError("Queue claim is uncertain; do not repeat it.")
    journal.record("CLAIMED")
    queue.expect_json(json.dumps(db("WITH changed AS (UPDATE submissions SET status_id = 2 WHERE status_id = 1 AND "
                                   + guard + " RETURNING id) SELECT json_build_object('updated', count(*) = 1) FROM changed;", write=True)),
                      {"updated": True}, "Submission processing transition was not confirmed.")
    print("PASS: exact queue envelope and persisted payload validated; one job claimed without retry")
    evidence = execute_fixed_job(journal)
    print("PASS: fixed C++ job executed with exact output and confirmed normal sandbox cleanup")
    cpu_seconds = Decimal(evidence["cpu_ns"]) / 1_000_000_000
    memory_kib = (evidence["peak_bytes"] + 1023) // 1024
    sql = ("WITH changed AS (UPDATE submissions SET status_id = 3, finished_at = clock_timestamp(), "
           f"stdout = E'{evidence['stdout_b64']}\\n', stderr = NULL, compile_output = NULL, message = NULL, "
           f"exit_code = 0, exit_signal = NULL, time = {cpu_seconds}, memory = {memory_kib}, "
           f"wall_time = {evidence['wall_seconds']} WHERE status_id = 2 AND " + guard
           + " RETURNING id) SELECT json_build_object('updated', count(*) = 1) FROM changed;")
    journal.record("RESULT_SAVE_STARTED")
    queue.expect_json(json.dumps(db(sql, write=True)), {"updated": True}, "Result save was not confirmed; do not replay execution.")
    journal.record("RESULT_SAVED")
    fields = "token,stdout,stderr,compile_output,message,status,exit_code,exit_signal,time,memory,wall_time"
    status, raw = api.request(original_host, "GET", f"/submissions/{submission_token}?base64_encoded=true&fields={fields}", token)
    if status != 200:
        raise RuntimeError("Final result lookup failed; do not replay execution.")
    verify_result(raw, submission_token, evidence)
    if redis(EMPTY, 0) != b"empty":
        raise RuntimeError("Post-run queue state was not confirmed.")
    api.check_api(original_host, token)
    journal.record("COMPLETE")
    print("PASS: result read through the original API matches real stdout 12 plus newline")
    print("PASS: queue empty; original API still in maintenance; no stock worker started")


def interrupt(signum, frame):
    raise KeyboardInterrupt


def main(argv=None):
    args = sys.argv[1:] if argv is None else argv
    if args or platform.system() != "Linux" or socket.gethostname() != "ingenium-judge-spike-01" or os.geteuid() != 0:
        print("FAIL: run sudo python3 -B one-job.py only on the isolated judge VM, without arguments.", file=sys.stderr)
        return 1
    try:
        os.umask(0o077)
        signal.signal(signal.SIGTERM, interrupt)
        root = RUNTIME.lstat()
        if not stat.S_ISDIR(root.st_mode) or root.st_uid != 0 or stat.S_IMODE(root.st_mode) != 0o700:
            raise RuntimeError("Unexpected private runtime directory ownership/mode.")
        if (RUNTIME / "one-job-v1").exists() or (RUNTIME / "one-job-v1").is_symlink():
            raise RuntimeError("A one-job run record already exists; do not remove it or rerun.")
        config_path = RUNTIME / "judge0.conf"
        info = config_path.lstat()
        if not stat.S_ISREG(info.st_mode) or (info.st_uid, info.st_gid, stat.S_IMODE(info.st_mode)) != (1000, 999, 0o400) or info.st_size > 32768:
            raise RuntimeError("Unexpected original runtime configuration ownership/mode.")
        config, token = prepare_config(config_path.read_bytes())
        helper = (HERE / "cgroup-smoke.sh").read_bytes()
        if helper.count(b'<<"CPP"\n' + CPP + b'CPP\n') != 1:
            raise RuntimeError("Sandbox helper no longer contains the reviewed fixed C++ source.")
        if run("docker", "network", "inspect", NETWORK, "--format", "{{.Internal}}|{{.Driver}}") != b"true|bridge":
            raise RuntimeError("The lab network is not the expected internal bridge.")
        if run("docker", "image", "inspect", IMAGE, "--format", "{{.Id}}|{{.Os}}|{{.Architecture}}|{{.Config.User}}") != f"{IMAGE}|linux|amd64|judge0".encode("ascii"):
            raise RuntimeError("The reviewed API image is unavailable.")
        queue.check_queue()
        journal = Journal(RUNTIME / "one-job-v1")
        journal.record("PREPARED", source_sha256=SOURCE_HASH)
        run_experiment(journal, config, token)
        return 0
    except KeyboardInterrupt:
        print("FAIL: interrupted; preserve the run record and inspect before any further execution.", file=sys.stderr)
        return 130
    except RuntimeError as error:
        print(f"FAIL: {error}", file=sys.stderr)
    except (OSError, ValueError, TypeError, KeyError, AttributeError, DecimalException,
            subprocess.SubprocessError, http.client.HTTPException):
        print("FAIL: one-job experiment stopped; raw credentials/diagnostics were not printed.", file=sys.stderr)
    print("Do not rerun, delete the run record or clear lab data. Inspect /opt/ingenium-judge-spike/one-job-v1 and any retained sandbox resources.", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
