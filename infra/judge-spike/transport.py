import base64
from decimal import Decimal
import hashlib
import http.client
import importlib.util
import json
import os
from pathlib import Path
import platform
import signal
import socket
import subprocess
import sys
import time
import uuid


HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("transport_streams", HERE / "streams.py")
streams = importlib.util.module_from_spec(spec)
spec.loader.exec_module(streams)
flow = streams.load("transport_http", HERE / "http-flow.py")
lab, guard, failure, runtime = flow.lab, flow.guard, flow.failure, flow.runtime
require = runtime.require
capture = streams.capture
runner = streams.load("transport_runtime", HERE / "streams/runtime.py")
DIRECTORY = lab.RUNTIME / "transport-v1"
TABLE = "ingenium_transport_v1.attempts"
guard.TABLE = TABLE
PATH = "/ingenium-transport/attempts"
flow.PATH = PATH
SCOPE = "five-fixed-profile-http-streams-v1"
MAX_WIRE = 2097152
FILES = ("transport.py", "transport-admission.rb", "transport-admission.sql", "http-server.sh", "cgroup-smoke.sh", "namespace-smoke.apparmor",
         "streams.py", "http-flow.py", "recovery.py", "profiles.py", "active-crash.py", "cleanup-profiles-v1.py", "failure-suite.py",
         "one-job.py", "probe-queue.py", "probe-api.py")
OLD_FILES = ("streams-v1/journal.jsonl", "streams-v1/streams.log", "streams-v1/cleanup-v1/journal.jsonl",
             "streams-v2/journal.jsonl", "streams-v2/streams.log", "streams-v2/evidence.json",
             "http-v1/journal.jsonl", "active-crash-v1/context.json", "active-crash-v1/journal.jsonl",
             "active-crash-v1/drain-evidence.json", "active-crash-v1/schema-fix-v1/journal.jsonl")


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False).encode("ascii")


def private(path, limit=MAX_WIRE):
    return failure.private_file(path, 0, 0, 0o600, limit)


def save(path, value):
    raw = canonical(value)
    require(len(raw) <= MAX_WIRE, "Evidence exceeded its private storage budget.")
    with path.open("xb") as stream:
        os.fchmod(stream.fileno(), 0o600)
        stream.write(raw)
        stream.flush()
        os.fsync(stream.fileno())
    lab.sync_directory(path.parent)
    return hashlib.sha256(raw).hexdigest()


def helpers():
    return {name: hashlib.sha256(runtime.regular(HERE / name, 65536)).hexdigest() for name in FILES}


def payload(name, frozen):
    require(type(name) is str and name in runner.TRANSPORT, "Unknown fixed profile.")
    index, language_id = runner.TRANSPORT[name]
    profile = frozen["source_lock"]["profiles"][name]
    return {**lab.PAYLOAD, "language_id": language_id,
            "source_code": base64.b64encode(runtime.regular(HERE / "streams/fixtures" / profile["source"], 8192)).decode("ascii"),
            "stdin": base64.b64encode((str(index) + "\n").encode("ascii")).decode("ascii"),
            "cpu_time_limit": profile["cpu"], "wall_time_limit": profile["wall"], "memory_limit": 524288,
            "stack_limit": 65536, "max_processes_and_or_threads": 64, "max_file_size": 16384}


def payload_hash(name, data, value):
    return failure.canonical_hash({"scope": SCOPE, "profile": name, "payload": data, "bundle_sha256": value["bundle_sha256"],
                                   "helpers_sha256": value["helpers_sha256"], "manifest_sha256": value["manifest_sha256"]})


def context():
    value = lab.decode_json(private(DIRECTORY / "context.json", 65536))
    frozen, manifest_sha = guard.manifest()
    require(type(value) is dict and set(value) == {"scope", "manifest_sha256", "image_id", "bundle_sha256", "helpers_sha256", "jobs"}
            and value["scope"] == SCOPE and value["manifest_sha256"] == manifest_sha and value["image_id"] == frozen["image_id"]
            and value["bundle_sha256"] == streams.bundle.fingerprint() and value["helpers_sha256"] == helpers(), "Transport context/runtime changed.")
    require(type(value["jobs"]) is dict and set(value["jobs"]) == set(runner.TRANSPORT), "Fixed job inventory differs.")
    attempts = set()
    for name, job in value["jobs"].items():
        require(type(job) is dict and set(job) == {"binding", "payload"} and canonical(job["payload"]) == canonical(payload(name, frozen)), "Fixed payload differs.")
        binding = job["binding"]
        guard.where(binding)
        require(binding["host_epoch"] == Path("/proc/sys/kernel/random/boot_id").read_text().strip()
                and binding["manifest_sha256"] == manifest_sha and binding["payload_sha256"] == payload_hash(name, job["payload"], value),
                "Boot or bound execution payload changed; no launch is authorised.")
        attempts.add(binding["attempt_id"])
    require(len(attempts) == 5, "Duplicate fixed attempt identities.")
    return value, frozen


def preserved(owned=False):
    sql = streams.profiles.SNAPSHOT_SQL
    if owned:
        sql = sql.replace("FROM submissions s;", f"FROM submissions s WHERE NOT EXISTS (SELECT 1 FROM {TABLE} a WHERE a.submission_id = s.id);")
    tables = {}
    for name in ("ingenium_recovery_v1", "ingenium_http_v1", "ingenium_active_crash_v1"):
        tables[name] = lab.db("SELECT json_build_object('count', count(*), "
                             "'sha256', encode(sha256(convert_to(jsonb_agg(to_jsonb(a) ORDER BY attempt_id)::text, 'UTF8')), 'hex')) "
                             f"FROM {name}.attempts a;")
    return {"providers": lab.db(sql), "tables": tables,
            "files": {name: hashlib.sha256(private(lab.RUNTIME / name, 262144)).hexdigest() for name in OLD_FILES}}


def completed_streams(frozen):
    directory = lab.RUNTIME / "streams-v2"
    rows = [lab.decode_json(line) for line in private(directory / "journal.jsonl", 65536).splitlines()]
    raw = private(directory / "evidence.json", 65536)
    require(rows and rows[-1].get("event") == "COMPLETE" and rows[-1].get("cases") == 50
            and rows[-1].get("evidence_sha256") == hashlib.sha256(raw).hexdigest(), "Prior stream checkpoint is not sealed.")
    value = lab.decode_json(raw)
    require(value["scope"] == "trusted-fixed-stream-suite-v2" and value["checker_version"] == capture.CHECKER_VERSION
            and value["preserved"] == streams.baseline()
            and value["manifest_sha256"] == hashlib.sha256(private(lab.RUNTIME / "profiles-v2/runtime-manifest.json", 65536)).hexdigest()
            and value["previous_cleanup_sha256"] == hashlib.sha256(private(lab.RUNTIME / "streams-v1/cleanup-v1/journal.jsonl", 65536)).hexdigest()
            and value["image_id"] == frozen["image_id"] and value["log_sha256"] == hashlib.sha256(private(directory / "streams.log", 262144)).hexdigest()
            and value["results"] == streams.parse_log(directory / "streams.log", frozen, value["bundle_sha256"]), "Prior stream evidence differs.")


def request(host, method, path, token=None, value=None):
    require(type(host) is str and lab.api.ipaddress.IPv4Address(host).is_private
            and any(lab.api.ipaddress.IPv4Address(host) in lab.api.ipaddress.IPv4Network(cidr) for cidr in ("10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16")),
            "Only the lab's RFC1918 container address is allowed.")
    body = None if value is None else canonical(value)
    require(body is None or len(body) <= 4096, "Oversized admission request.")
    headers = {"Content-Type": "application/json"}
    if token is not None:
        headers["X-Auth-Token"] = token
    connection = http.client.HTTPConnection(host, 2358, timeout=10)
    try:
        connection.request(method, path, body, headers)
        response = connection.getresponse()
        raw = response.read(MAX_WIRE + 1)
        require(len(raw) <= MAX_WIRE, "Oversized HTTP evidence; never accept a partial body.")
        return response.status, lab.decode_json(raw)
    finally:
        connection.close()


def checked_result(value, job, frozen, bundle_sha):
    require(type(value) is dict and set(value) == {"job", "bundle_sha256", "compile", "result"}
            and canonical(value["job"]) == canonical(job) and value["bundle_sha256"] == bundle_sha, "Result is not bound to this execution.")
    profile = frozen["source_lock"]["profiles"][job["profile"]]
    phases = [(value["result"], False)]
    if profile["compile"]:
        phases.append((value["compile"], True))
    else:
        require(value["compile"] is None, "Interpreter invented compiler evidence.")
    for phase, compiling in phases:
        require(type(phase) is dict and type(phase.get("captures")) is dict, "Missing capture evidence.")
        summary = {**phase, "captures": {kind: capture.summary(record) for kind, record in phase["captures"].items()}}
        streams.checked_phase(summary, profile, compiling=compiling, index=job["case"])
    out = value["result"]["captures"]["stdout"]
    verdicts = {mode: capture.check(out, streams.cases.expected(job["case"]), mode) for mode in ("tokens", "exact")}
    require(value["result"]["verdicts"] == verdicts, "Backend comparison differs from execution evidence.")
    return verdicts


def parse_execution(path, job, frozen, bundle_sha):
    lines = private(path).decode("ascii").splitlines()
    prefix = "INGENIUM_BOUND_STREAM_RESULT "
    values = [lab.decode_json(line[len(prefix):]) for line in lines if line.startswith(prefix)]
    versions = [lab.decode_json(line[len("INGENIUM_STREAM_VERSIONS "):]) for line in lines if line.startswith("INGENIUM_STREAM_VERSIONS ")]
    require(len(values) == 1 and versions == [frozen["observed"]] and not any("FAIL:" in line for line in lines)
            and lines.count("PASS: bound stream job completed with exact bytes, identity and normal cleanup") == 1
            and lines.count("PASS: host test groups and temporary files removed") == 1, "Bound execution/cleanup did not complete.")
    checked_result(values[0], job, frozen, bundle_sha)
    return values[0]


def provider_guard(item, row, finished=False):
    require(type(row["submission_id"]) is int and row["submission_id"] > 0, "Invalid provider row identity.")
    return f"id = {row['submission_id']} AND " + lab.payload_guard(row["token"], payload=item["payload"], total=15, finished=finished)


def job_for(name, item, owner):
    guard.uuid_value(owner)
    return {"profile": name, "case": runner.TRANSPORT[name][0],
            "source_sha256": hashlib.sha256(base64.b64decode(item["payload"]["source_code"], validate=True)).hexdigest(),
            "stdin_b64": item["payload"]["stdin"], "binding": item["binding"], "owner_id": owner}


def seal(name, item, row, owner, result, digest, encoded, frozen, bundle_sha):
    guard.uuid_value(owner)
    guard.digest(digest)
    require(encoded == canonical(result) and hashlib.sha256(encoded).hexdigest() == digest and len(encoded) <= MAX_WIRE, "Changed seal evidence.")
    checked_result(result, job_for(name, item, owner), frozen, bundle_sha)
    phase = result["result"]
    out, err = (phase["captures"][kind]["data_b64"] for kind in ("stdout", "stderr"))
    compiler = "NULL" if result["compile"] is None else "'" + result["compile"]["captures"]["compiler"]["data_b64"] + "'"
    cpu, wall, memory = Decimal(phase["cpu_ns"]) / 1_000_000_000, Decimal(phase["wall_seconds"]), (phase["peak_bytes"] + 1023) // 1024
    wire = base64.b64encode(encoded).decode("ascii")
    sql = ("\\set QUIET on\nDO $seal$ BEGIN "
           f"UPDATE {TABLE} SET state = 'SEALED', evidence_sha256 = '{digest}', sealed_at = clock_timestamp(), "
           f"evidence_json = convert_from(decode('{wire}', 'base64'), 'UTF8')::jsonb "
           f"WHERE {guard.where(item['binding'])} AND state = 'STARTED' AND owner_id = '{owner}' "
           f"AND provider_id = '{row['token']}' AND submission_id = {row['submission_id']}; "
           "IF NOT FOUND THEN RAISE EXCEPTION 'Seal owner differs'; END IF; "
           f"UPDATE submissions SET status_id = 3, finished_at = clock_timestamp(), stdout = '{out}', stderr = '{err}', "
           f"compile_output = {compiler}, message = NULL, exit_code = 0, exit_signal = NULL, time = {cpu}, wall_time = {wall}, memory = {memory} "
           "WHERE status_id = 2 AND " + provider_guard(item, row) + "; "
           "IF NOT FOUND THEN RAISE EXCEPTION 'Provider payload differs'; END IF; END; $seal$; "
           "SELECT json_build_object('sealed', true);")
    require(lab.db(sql, write=True) == {"sealed": True}, "Seal reply uncertain; recover evidence, never launch again.")


def worker(name):
    value, frozen = context()
    require(name in value["jobs"], "Unknown worker profile.")
    item = value["jobs"][name]
    row = flow.row_for(item["binding"])
    raw = sys.stdin.buffer.readline(8193)
    require(len(raw) <= 8192, "Oversized queue envelope.")
    lab.validate_message(raw, row["submission_id"])
    require(lab.decode_json(raw) == row["envelope"], "Delivery differs from the frozen outbox.")
    owner = str(uuid.uuid4())
    if not guard.claim(item["binding"], owner):
        print('{"launched":false}', flush=True)
        return 0
    journal = lab.Journal(DIRECTORY / ("execution-" + item["binding"]["attempt_id"]))
    job = job_for(name, item, owner)
    journal.record("LAUNCH_AUTHORISED", job=job, token=row["token"])
    job_sha = save(journal.directory / "job.json", job)
    changed = lab.db("WITH changed AS (UPDATE submissions SET status_id = 2 WHERE status_id = 1 AND " + provider_guard(item, row)
                     + " RETURNING id) SELECT json_build_object('updated', count(*) = 1) FROM changed;", write=True)
    require(changed == {"updated": True}, "Provider transition uncertain; keep the reservation.")
    path = streams.profiles.logged(journal, "sandbox", ["/bin/bash", str(HERE / "cgroup-smoke.sh"), "--stream-job", frozen["image_id"],
                                  value["bundle_sha256"], str(journal.directory / "job.json"), job_sha], 180)
    result = parse_execution(path, job, frozen, value["bundle_sha256"])
    digest = save(journal.directory / "evidence.json", result)
    journal.record("EVIDENCE_SAVED", evidence_sha256=digest)
    seal(name, item, row, owner, result, digest, private(journal.directory / "evidence.json"), frozen, value["bundle_sha256"])
    journal.record("SEALED", evidence_sha256=digest)
    os._exit(75)  # Lose only the committed reply, after positive cleanup and sealing.


def decode_provider(encoded, record, kind):
    wanted = capture.validate(record, kind)
    require(type(encoded) is str and len(encoded) <= MAX_WIRE, "Missing/big provider stream.")
    compact = encoded.replace("\n", "")
    try:
        raw = base64.b64decode(compact, validate=True)
    except (ValueError, base64.binascii.Error):
        raise RuntimeError("Invalid provider Base64.") from None
    require(base64.b64encode(raw).decode("ascii") == compact and raw == wanted, "Provider bytes differ from bound evidence.")


def verify_http(host, token, name, item, row, value, frozen):
    binding = item["binding"]
    path = DIRECTORY / ("execution-" + binding["attempt_id"])
    raw = private(path / "evidence.json")
    local = lab.decode_json(raw)
    state = guard.observe(binding)
    require(state["state"] == "SEALED" and state["permit_count"] == 1 and state["reserved"] is False
            and state["provider_id"] == row["token"] and state["evidence_sha256"] == hashlib.sha256(raw).hexdigest()
            and state["owner_id"] == local["job"]["owner_id"] and local["job"]["binding"] == binding
            and local["job"]["profile"] == name, "Lost worker reply cannot be resolved to this seal.")
    expected_job = job_for(name, item, state["owner_id"])
    require(local == parse_execution(path / "sandbox.log", expected_job, frozen, value["bundle_sha256"]), "Retained execution changed.")
    status, response = request(host, "GET", PATH + "/" + binding["attempt_id"] + "/evidence", token)
    require(status == 200 and set(response) == {"token", "submission_id", "state", "permit_count", "reserved", "evidence_sha256", "evidence"}
            and response["token"] == row["token"] and response["submission_id"] == row["submission_id"]
            and type(response["submission_id"]) is int and response["state"] == "SEALED"
            and type(response["permit_count"]) is int and response["permit_count"] == 1 and response["reserved"] is False
            and response["evidence_sha256"] == state["evidence_sha256"] and canonical(response["evidence"]) == raw,
            "HTTP seal/transport identity differs.")
    verdicts = checked_result(response["evidence"], local["job"], frozen, value["bundle_sha256"])
    status, provider = request(lab.private_ip(lab.queue.API), "GET", "/submissions/" + row["token"] + "?base64_encoded=true&fields=" + flow.FIELDS, token)
    phase = local["result"]
    require(status == 200 and set(provider) == set(flow.FIELDS.split(",")) and provider["token"] == row["token"]
            and provider["status"] == {"id": 3, "description": "Accepted"} and type(provider["status"]["id"]) is int
            and provider["exit_code"] == 0 and type(provider["exit_code"]) is int and provider["exit_signal"] is None and provider["message"] is None
            and type(provider["memory"]) is int and provider["memory"] == (phase["peak_bytes"] + 1023) // 1024
            and Decimal(str(provider["time"])) == Decimal(phase["cpu_ns"]) / 1_000_000_000
            and Decimal(str(provider["wall_time"])) == Decimal(phase["wall_seconds"]), "Original provider result/accounting differs.")
    for kind in ("stdout", "stderr"):
        decode_provider(provider[kind], phase["captures"][kind], kind)
    if local["compile"] is None:
        require(provider["compile_output"] is None, "Interpreter has invented compiler output.")
    else:
        decode_provider(provider["compile_output"], local["compile"]["captures"]["compiler"], "compiler")
    require(not guard.claim(binding, str(uuid.uuid4())), "Sealed attempt obtained another permit.")
    for mutation in ("dispatched_at = NULL", "evidence_json = '{}'::jsonb", "submission_id = submission_id + 1"):
        guard.forbidden_change(f"UPDATE {TABLE} SET {mutation} WHERE {guard.where(binding)}")
    guard.forbidden_change(f"DELETE FROM {TABLE} WHERE {guard.where(binding)}")
    require(guard.observe(binding) == state, "Forbidden mutation changed sealed evidence.")
    print(f"PASS: {name} -> one execution, lost reply recovered, real HTTP bytes/accounting and backend {verdicts['tokens']}/{verdicts['exact']} verified", flush=True)


def dispatch(name, item, row, journal):
    envelope = lab.db(f"WITH sent AS (UPDATE {TABLE} SET dispatched_at = clock_timestamp() WHERE {guard.where(item['binding'])} "
                      "AND dispatched_at IS NULL AND state = 'PREPARED' RETURNING envelope) "
                      "SELECT COALESCE((SELECT envelope FROM sent), 'null'::jsonb);", write=True)
    require(envelope == row["envelope"], "Outbox send uncertain; do not retry.")
    raw = canonical(envelope)
    journal.record("QUEUE_SEND_STARTED", profile=name, envelope_sha256=hashlib.sha256(raw).hexdigest())
    require(lab.redis(flow.PUSH_TWO, 0, raw) == b"queued-two", "Redis send uncertain; never repeat it.")
    deliveries = []
    for count in (2, 1):
        message = lab.redis(lab.PEEK, count)
        lab.validate_message(message, row["submission_id"])
        require(lab.decode_json(message) == envelope and lab.redis(lab.CLAIM, count, message) == b"claimed", "Delivery uncertain; retain all evidence.")
        deliveries.append(message)
    workers = [subprocess.Popen([sys.executable, "-B", str(HERE / "transport.py"), "--worker", name], stdin=subprocess.PIPE,
                                stdout=subprocess.PIPE, stderr=subprocess.STDOUT) for _ in deliveries]
    for process, message in zip(workers, deliveries):
        process.stdin.write(message + b"\n")
        process.stdin.close()
    codes = []
    deadline = time.monotonic() + 210
    for index, process in enumerate(workers):
        code = process.wait(timeout=max(1, deadline - time.monotonic()))
        reply = process.stdout.read(8193)
        guard.private_json(DIRECTORY / f"worker-{name}-{index}.json", {"exit_code": code, "stdout_b64": base64.b64encode(reply).decode("ascii")})
        require(len(reply) <= 8192 and ((code == 75 and reply == b"") or (code == 0 and lab.decode_json(reply) == {"launched": False})),
                "Worker failed; inspect checkpoint without retrying execution.")
        codes.append(code)
    require(sorted(codes) == [0, 75], "Expected exactly one launch and one refused duplicate.")


def admit(host, token, value, journal):
    rows = {}
    for name, item in value["jobs"].items():
        binding = item["binding"]
        lookup = PATH + "/" + binding["attempt_id"]
        require(request(host, "POST", PATH, value=binding)[0] == 401 and request(host, "GET", lookup, token)[0] == 404
                and request(host, "POST", PATH, token, dict(binding, payload_sha256="0" * 64))[0] == 409,
                "Admission auth/identity/pre-existing checks failed.")
        journal.record("HTTP_SEND_STARTED", profile=name, binding=binding)
        flow.discard_token_reply(host, token, binding)
        status, resolved = request(host, "GET", lookup, token)
        require(status == 200 and resolved["state"] == "PREPARED" and resolved["permit_count"] == 0,
                "Lost token body not reconciled; do not POST again.")
        row = flow.row_for(binding)
        require(resolved["token"] == row["token"] and resolved["submission_id"] == row["submission_id"]
                and request(host, "POST", PATH, token, binding) == (201, resolved), "Explicit duplicate changed the association.")
        rows[name] = row
        journal.record("HTTP_RECONCILED", profile=name, token=row["token"], submission_id=row["submission_id"])
    require(len({row["token"] for row in rows.values()}) == 5 and lab.db("SELECT json_build_object('count', count(*)) FROM submissions;") == {"count": 15},
            "Expected five new provider associations and ten old records.")
    print("PASS: five authenticated real provider/outbox records admitted once; lost token bodies and explicit duplicate POSTs reconciled", flush=True)
    return rows


def main(argv=None):
    args = sys.argv[1:] if argv is None else argv
    if (args != [] and not (len(args) == 2 and args[0] == "--worker" and args[1] in runner.TRANSPORT)) or platform.system() != "Linux" or socket.gethostname() != "ingenium-judge-spike-01" or os.geteuid() != 0:
        print("FAIL: fixed transport modes require sudo on the isolated VM.", file=sys.stderr)
        return 1
    try:
        os.umask(0o077)
        signal.signal(signal.SIGTERM, lab.interrupt)
        streams.active.tree.directory(lab.RUNTIME, 0o700)
        if args:
            return worker(args[1])
        require(not os.path.lexists(DIRECTORY), "Transport checkpoint exists; never rerun or reset it.")
        lab.queue.check_services()
        require(lab.run("docker", "network", "inspect", lab.NETWORK, "--format", "{{.Internal}}|{{.Driver}}") == b"true|bridge", "Private bridge differs.")
        streams.baseline()
        frozen, manifest_sha = guard.manifest()
        completed_streams(frozen)
        before = preserved()
        require(lab.db("SELECT json_build_object('absent', NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'ingenium_transport_v1'));") == {"absent": True},
                "Transport schema already exists; never reset it.")
        languages = lab.db("SELECT json_agg(json_build_object('id', id, 'name', name, 'archived', is_archived) ORDER BY id) FROM languages WHERE id IN (50, 54, 62, 63, 71);")
        require(languages == [{"id": number, "name": name, "archived": False} for number, name in (
            (50, "C (GCC 9.2.0)"), (54, "C++ (GCC 9.2.0)"), (62, "Java (OpenJDK 13.0.1)"), (63, "JavaScript (Node.js 12.14.0)"), (71, "Python (3.8.1)"))],
            "Provider language descriptors differ; never substitute runtime mappings.")
        config = failure.private_file(lab.RUNTIME / "judge0.conf", 1000, 999, 0o400, 32768)
        _, token = lab.prepare_config(config)
        lab.api.check_api(lab.private_ip(lab.queue.API), token)
        ruby = runtime.regular(HERE / "test/transport-admission.test.rb", 16384) + runtime.regular(HERE / "transport-admission.rb", 16384)
        require(lab.run("docker", "exec", "-i", "--user", "1000:999", lab.queue.API, "ruby", "-", data=ruby)
                == b"PASS: fixed transport admission stub checks passed", "Ruby self-check failed before schema/admission changes.")
        value = {"scope": SCOPE, "manifest_sha256": manifest_sha, "image_id": frozen["image_id"], "bundle_sha256": streams.bundle.fingerprint(),
                 "helpers_sha256": helpers(), "jobs": {}}
        for name in runner.TRANSPORT:
            data = payload(name, frozen)
            value["jobs"][name] = {"payload": data, "binding": {"attempt_id": str(uuid.uuid4()),
                "host_epoch": Path("/proc/sys/kernel/random/boot_id").read_text().strip(), "manifest_sha256": manifest_sha,
                "payload_sha256": payload_hash(name, data, value)}}
        journal = lab.Journal(DIRECTORY)
        journal.record("PREPARED", preserved=before)
        guard.private_json(DIRECTORY / "context.json", value)
        context_path = DIRECTORY / "admission-context.json"
        guard.private_json(context_path, value)
        os.chown(context_path, 1000, 999)
        os.chmod(context_path, 0o400)
        context()
        require(lab.db(runtime.regular(HERE / "transport-admission.sql", 16384).decode("ascii"), write=True) == {"created": True}, "Schema creation uncertain.")
        container, nonce = lab.create_creator(journal, config, server="http-server.sh", mounts=(
            (HERE / "transport-admission.rb", "/api/config/initializers/ingenium_transport.rb"), (context_path, "/api/ingenium-transport-context.json")))
        try:
            lab.run("docker", "start", container)
            host = lab.private_ip(container)
            lab.wait_creator(host, token)
            lab.api.check_api(host, token)
            rows = admit(host, token, value, journal)
            for name, item in value["jobs"].items():
                dispatch(name, item, rows[name], journal)
                verify_http(host, token, name, item, rows[name], value, frozen)
        finally:
            lab.stop_creator(container, nonce, journal)
        context()
        require(preserved(owned=True) == before and lab.redis(lab.EMPTY, 0) == b"empty"
                and lab.db(f"SELECT json_build_object('count', count(*), 'sealed', bool_and(state = 'SEALED' AND permit_count = 1 AND evidence_json IS NOT NULL)) FROM {TABLE};")
                == {"count": 5, "sealed": True}, "Old records/evidence, completed inventory or queue changed.")
        lab.queue.check_services()
        lab.api.check_api(lab.private_ip(lab.queue.API), token)
        journal.record("COMPLETE", provider_tokens={name: row["token"] for name, row in rows.items()}, preserved=before)
        print("PASS: fifteen provider rows retained (ten unchanged); five bound HTTP/checker results sealed; queue empty; maintenance enabled", flush=True)
        return 0
    except KeyboardInterrupt:
        print("FAIL: interrupted; preserve transport-v1 and all retained resources.", file=sys.stderr)
        return 130
    except Exception as error:
        print("FAIL: " + (str(error) if isinstance(error, RuntimeError) else type(error).__name__)
              + " Preserve transport-v1, its schema and resources. Do not rerun, reset permits or force-clean.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
