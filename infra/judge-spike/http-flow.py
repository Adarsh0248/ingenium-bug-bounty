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
import stat
import subprocess
import sys
import uuid

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("http_recovery", HERE / "recovery.py")
guard = importlib.util.module_from_spec(spec)
spec.loader.exec_module(guard)
lab, profiles, failure, runtime = guard.lab, guard.profiles, guard.failure, guard.runtime
# This separately loaded module instance cannot change the older recovery schema.
guard.TABLE = "ingenium_http_v1.attempts"
DIRECTORY = lab.RUNTIME / "http-v1"
SCOPE = "trusted-cpp-http-association-v1"
PATH = "/ingenium-lab/attempts"
FIELDS = "token,stdout,stderr,compile_output,message,status,exit_code,exit_signal,time,memory,wall_time"
PUSH_TWO = lab.QUEUE_GUARD + """redis.call('RPUSH', 'resque:queue:1.13.1', ARGV[2], ARGV[2])
return 'queued-two'
"""


def old_recovery_snapshot():
    return lab.db("SELECT json_build_object('count', count(*), 'sealed', count(*) FILTER (WHERE state = 'SEALED'), "
                  "'held', count(*) FILTER (WHERE state = 'STARTED'), "
                  "'sha256', encode(sha256(convert_to(jsonb_agg(to_jsonb(a) ORDER BY attempt_id)::text, 'UTF8')), 'hex')) "
                  "FROM ingenium_recovery_v1.attempts a;")


def context():
    value = lab.decode_json(failure.private_file(DIRECTORY / "context.json", 0, 0, 0o600, 65536))
    runtime.require(set(value) == {"binding", "payload", "helper_sha256", "scope"} and value["scope"] == SCOPE
                    and value["payload"] == lab.PAYLOAD, "Changed fixed HTTP context.")
    binding = value["binding"]
    guard.where(binding)
    runtime.require(binding["host_epoch"] == Path("/proc/sys/kernel/random/boot_id").read_text().strip()
                    and value["helper_sha256"] == hashlib.sha256(runtime.regular(HERE / "cgroup-smoke.sh", 65536)).hexdigest(),
                    "Host boot or sandbox helper changed; no launch is authorised.")
    _, manifest_sha = guard.manifest()
    payload = {"scope": SCOPE, "payload": lab.PAYLOAD, "helper_sha256": value["helper_sha256"]}
    runtime.require(binding["manifest_sha256"] == manifest_sha
                    and binding["payload_sha256"] == failure.canonical_hash(payload), "Frozen HTTP execution binding differs.")
    return value


def row_for(binding):
    row = lab.db(f"SELECT json_build_object('token', provider_id, 'submission_id', submission_id, 'envelope', envelope) "
                 f"FROM {guard.TABLE} WHERE {guard.where(binding)};")
    runtime.require(type(row) is dict and set(row) == {"token", "submission_id", "envelope"}
                    and type(row["submission_id"]) is int and row["submission_id"] > 0, "Missing provider association.")
    lab.valid_uuid(row["token"])
    lab.validate_message(json.dumps(row["envelope"]).encode("ascii"), row["submission_id"])
    return row


def seal_result(binding, owner, row, evidence, evidence_sha):
    guard.uuid_value(owner)
    guard.digest(evidence_sha)
    # Validate numeric/output fields before embedding only the fixed, trusted evidence in SQL.
    runtime.require(evidence == lab.parse_sandbox_log((DIRECTORY / "execution" / "sandbox.log").read_bytes()),
                    "Result differs from the retained sandbox log.")
    cpu = Decimal(evidence["cpu_ns"]) / 1_000_000_000
    memory = (evidence["peak_bytes"] + 1023) // 1024
    sql = ("\\set QUIET on\nDO $seal$ BEGIN "
           f"UPDATE {guard.TABLE} SET state = 'SEALED', evidence_sha256 = '{evidence_sha}', sealed_at = clock_timestamp() "
           f"WHERE {guard.where(binding)} AND state = 'STARTED' AND owner_id = '{owner}' "
           f"AND provider_id = '{row['token']}' AND submission_id = {row['submission_id']}; "
           "IF NOT FOUND THEN RAISE EXCEPTION 'Seal owner differs'; END IF; "
           "UPDATE submissions SET status_id = 3, finished_at = clock_timestamp(), "
           f"stdout = E'{evidence['stdout_b64']}\\n', stderr = NULL, compile_output = NULL, message = NULL, "
           f"exit_code = 0, exit_signal = NULL, time = {cpu}, memory = {memory}, wall_time = {evidence['wall_seconds']} "
           f"WHERE id = {row['submission_id']} AND status_id = 2 AND " + lab.payload_guard(row["token"], total=10) + "; "
           "IF NOT FOUND THEN RAISE EXCEPTION 'Provider payload differs'; END IF; "
           "END; $seal$; SELECT json_build_object('sealed', true);")
    runtime.require(lab.db(sql, write=True) == {"sealed": True}, "Uncertain result commit; resolve, never execute again.")


def worker():
    value = context()
    binding = value["binding"]
    row = row_for(binding)
    envelope = sys.stdin.buffer.readline(8193)
    runtime.require(len(envelope) <= 8192, "Oversized queue envelope.")
    lab.validate_message(envelope, row["submission_id"])
    runtime.require(lab.decode_json(envelope) == row["envelope"], "Queue message does not match the frozen outbox.")
    owner = str(uuid.uuid4())
    if not guard.claim(binding, owner):
        print('{"launched":false}', flush=True)
        return 0
    journal = lab.Journal(DIRECTORY / "execution")
    journal.record("LAUNCH_AUTHORISED", binding=binding, owner_id=owner, token=row["token"])
    changed = lab.db("WITH changed AS (UPDATE submissions SET status_id = 2 "
                     f"WHERE id = {row['submission_id']} AND status_id = 1 AND " + lab.payload_guard(row["token"], total=10) +
                     " RETURNING id) SELECT json_build_object('updated', count(*) = 1) FROM changed;", write=True)
    runtime.require(changed == {"updated": True}, "Provider processing transition uncertain; preserve reservation.")
    evidence = lab.execute_fixed_job(journal)
    saved = {"scope": SCOPE, "binding": binding, "owner_id": owner, "token": row["token"],
             "result": evidence, "normal_cleanup_verified": True,
             "sandbox_log_sha256": hashlib.sha256((journal.directory / "sandbox.log").read_bytes()).hexdigest()}
    fingerprint = guard.private_json(journal.directory / "evidence.json", saved)
    journal.record("EVIDENCE_SAVED", evidence_sha256=fingerprint)
    seal_result(binding, owner, row, evidence, fingerprint)
    journal.record("SEALED", evidence_sha256=fingerprint)
    os._exit(75)  # Deliberately lose the committed worker reply, not the evidence.


def request(host, method, path, token=None, value=None):
    body = None if value is None else json.dumps(value, sort_keys=True, separators=(",", ":")).encode("ascii")
    status, raw = lab.api.request(host, method, path, token, body)
    return status, lab.decode_json(raw)


def discard_token_reply(host, token, binding):
    connection = http.client.HTTPConnection(host, 2358, timeout=10)
    try:
        connection.request("POST", PATH, json.dumps(binding).encode("ascii"),
                           {"Content-Type": "application/json", "X-Auth-Token": token})
        response = connection.getresponse()
        runtime.require(response.status == 201, "Admission was not acknowledged; resolve by attempt ID, do not POST again.")
        # The server has committed, but the caller receives no token body.
    finally:
        connection.close()


def exercise(host, token, value, journal):
    binding = value["binding"]
    lookup = PATH + "/" + binding["attempt_id"]
    runtime.require(request(host, "POST", PATH, value=binding)[0] == 401, "Private admission accepted an unauthenticated request.")
    runtime.require(request(host, "GET", lookup, token)[0] == 404, "Unexpected pre-existing association.")
    runtime.require(request(host, "POST", PATH, token, dict(binding, payload_sha256="0" * 64))[0] == 409,
                    "Admission accepted a changed payload binding.")
    journal.record("HTTP_SEND_STARTED", binding=binding)
    discard_token_reply(host, token, binding)
    status, resolved = request(host, "GET", lookup, token)
    runtime.require(status == 200 and resolved["state"] == "PREPARED" and resolved["permit_count"] == 0,
                    "Lost token body could not be reconciled to an unstarted provider record.")
    row = row_for(binding)
    runtime.require(resolved["token"] == row["token"] and resolved["submission_id"] == row["submission_id"],
                    "HTTP lookup and durable association disagree.")
    runtime.require(request(host, "POST", PATH, token, binding) == (201, resolved),
                    "Explicit duplicate-injection created a different provider association.")
    journal.record("HTTP_RECONCILED", token=row["token"], submission_id=row["submission_id"])
    print("PASS: authenticated HTTP admission committed one real provider record and outbox; lost token body and duplicate POST resolved", flush=True)
    # The send marker commits before Redis; an uncertain send is never automatically repeated.
    envelope = lab.db(f"WITH sent AS (UPDATE {guard.TABLE} SET dispatched_at = clock_timestamp() "
                      f"WHERE {guard.where(binding)} AND dispatched_at IS NULL AND state = 'PREPARED' RETURNING envelope) "
                      "SELECT COALESCE((SELECT envelope FROM sent), 'null'::jsonb);", write=True)
    runtime.require(envelope == row["envelope"], "Outbox send was not positively authorised.")
    raw = json.dumps(envelope, separators=(",", ":")).encode("ascii")
    journal.record("QUEUE_SEND_STARTED", envelope_sha256=hashlib.sha256(raw).hexdigest())
    runtime.require(lab.redis(PUSH_TWO, 0, raw) == b"queued-two", "Queue send uncertain; never repeat it.")
    deliveries = []
    for count in (2, 1):
        delivery = lab.redis(lab.PEEK, count)
        lab.validate_message(delivery, row["submission_id"])
        runtime.require(lab.decode_json(delivery) == envelope and lab.redis(lab.CLAIM, count, delivery) == b"claimed",
                        "Queue delivery uncertain; preserve outbox and reservation.")
        deliveries.append(delivery)
    workers = [subprocess.Popen([sys.executable, "-B", str(HERE / "http-flow.py"), "--worker"],
                                stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.STDOUT) for _ in deliveries]
    for process, delivery in zip(workers, deliveries):
        process.stdin.write(delivery + b"\n")
        process.stdin.close()
    codes = []
    for index, process in enumerate(workers):
        code = process.wait(timeout=150)
        reply = process.stdout.read(8193)
        guard.private_json(DIRECTORY / f"worker-{index}.json", {"exit_code": code, "stdout_b64": base64.b64encode(reply).decode("ascii")})
        runtime.require((code == 75 and reply == b"") or (code == 0 and lab.decode_json(reply) == {"launched": False}),
                        "A worker failed; inspect the private checkpoint, never redeliver.")
        codes.append(code)
    runtime.require(sorted(codes) == [0, 75], "Expected one launch and one refused duplicate.")
    print("PASS: two real Redis deliveries reached separate guarded workers; only one compiled and executed the fixture", flush=True)
    saved_raw = failure.private_file(DIRECTORY / "execution" / "evidence.json", 0, 0, 0o600, 65536)
    saved = lab.decode_json(saved_raw)
    evidence = lab.parse_sandbox_log((DIRECTORY / "execution" / "sandbox.log").read_bytes())
    state = guard.observe(binding)
    runtime.require(state["state"] == "SEALED" and not state["reserved"] and state["permit_count"] == 1
                    and state["provider_id"] == row["token"] and saved["binding"] == binding
                    and state["evidence_sha256"] == hashlib.sha256(saved_raw).hexdigest()
                    and saved["owner_id"] == state["owner_id"] and saved["result"] == evidence
                    and saved["normal_cleanup_verified"] is True
                    and saved["sandbox_log_sha256"] == hashlib.sha256((DIRECTORY / "execution" / "sandbox.log").read_bytes()).hexdigest(),
                    "Result/cleanup association is not proven.")
    runtime.require(not guard.claim(binding, str(uuid.uuid4())), "Sealed attempt obtained a new permit.")
    for mutation in ("dispatched_at = NULL", "submission_id = submission_id + 1", "envelope = '{}'::jsonb"):
        guard.forbidden_change(f"UPDATE {guard.TABLE} SET {mutation} WHERE {guard.where(binding)}")
    guard.forbidden_change(f"DELETE FROM {guard.TABLE} WHERE {guard.where(binding)}")
    runtime.require(guard.observe(binding) == state, "Forbidden mutation changed the sealed association.")
    status, result = lab.api.request(lab.private_ip(lab.queue.API), "GET",
                                   f"/submissions/{row['token']}?base64_encoded=true&fields={FIELDS}", token)
    runtime.require(status == 200, "Original Judge0 result read failed.")
    lab.verify_result(result, row["token"], evidence)
    status, resolved = request(host, "GET", lookup, token)
    runtime.require(status == 200 and resolved["state"] == "SEALED" and resolved["reserved"] is False
                    and resolved["evidence_sha256"] == state["evidence_sha256"], "HTTP recovery lost the committed evidence.")
    print("PASS: lost worker reply recovered through HTTP; original Judge0 API returns real stdout 12 plus newline and matching accounting", flush=True)
    return row["token"]


def main(argv=None):
    args = sys.argv[1:] if argv is None else argv
    if args not in ([], ["--worker"]) or platform.system() != "Linux" or socket.gethostname() != "ingenium-judge-spike-01" or os.geteuid() != 0:
        print("FAIL: run only with sudo on the isolated VM, in a fixed HTTP lab mode.", file=sys.stderr)
        return 1
    try:
        os.umask(0o077)
        signal.signal(signal.SIGTERM, lab.interrupt)
        if args:
            return worker()
        root = lab.RUNTIME.lstat()
        runtime.require(stat.S_ISDIR(root.st_mode) and root.st_uid == 0 and stat.S_IMODE(root.st_mode) == 0o700,
                        "Unexpected private runtime directory ownership/mode.")
        runtime.require(not DIRECTORY.exists() and not DIRECTORY.is_symlink(), "HTTP checkpoint exists; do not rerun or remove it.")
        runtime.require(lab.run("docker", "network", "inspect", lab.NETWORK, "--format", "{{.Internal}}|{{.Driver}}") == b"true|bridge",
                        "Expected the existing internal lab bridge.")
        lab.queue.check_services()
        runtime.require(lab.db(lab.queue.SQL) == {"read_only": True, "cpp_profile_matches": True, "submissions_empty": False},
                        "Stock C++ language mapping or existing provider inventory changed.")
        frozen, manifest_sha = guard.manifest()
        before = profiles.completed_baseline()
        runtime.require(before == frozen["preserved_lab_sha256"], "Original nine records changed.")
        recovered = lab.decode_json(failure.private_file(lab.RUNTIME / "recovery-v1" / "evidence-fix-v1" / "journal.jsonl", 0, 0, 0o600, 65536).splitlines()[-1])
        runtime.require(recovered.get("event") == "COMPLETE", "Prior recovery checkpoint is incomplete.")
        old_recovery = old_recovery_snapshot()
        runtime.require(old_recovery["count"] == 2 and old_recovery["sealed"] == 1 and old_recovery["held"] == 1,
                        "Prior recovery rows differ; do not reset the held reservation.")
        runtime.require(lab.db("SELECT json_build_object('absent', NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'ingenium_http_v1'));") == {"absent": True},
                        "HTTP schema already exists; do not reset it.")
        config = failure.private_file(lab.RUNTIME / "judge0.conf", 1000, 999, 0o400, 32768)
        _, token = lab.prepare_config(config)
        lab.api.check_api(lab.private_ip(lab.queue.API), token)
        ruby_test = runtime.regular(HERE / "test" / "http-admission.test.rb", 16384)
        ruby_source = runtime.regular(HERE / "http-admission.rb", 16384)
        expected = b"PASS: private admission Ruby stub checks passed (auth, bounds, bindings, rollback and duplicate association)"
        runtime.require(lab.run("docker", "exec", "-i", "--user", "1000:999", lab.queue.API, "ruby", "-",
                                data=ruby_test + ruby_source) == expected, "Ruby admission self-check failed before any HTTP schema changes.")
        helper_sha = hashlib.sha256(runtime.regular(HERE / "cgroup-smoke.sh", 65536)).hexdigest()
        binding = {"attempt_id": str(uuid.uuid4()), "host_epoch": Path("/proc/sys/kernel/random/boot_id").read_text().strip(),
                   "manifest_sha256": manifest_sha,
                   "payload_sha256": failure.canonical_hash({"scope": SCOPE, "payload": lab.PAYLOAD, "helper_sha256": helper_sha})}
        guard.where(binding)
        value = {"scope": SCOPE, "binding": binding, "payload": lab.PAYLOAD, "helper_sha256": helper_sha}
        journal = lab.Journal(DIRECTORY)
        journal.record("PREPARED", preserved_lab_sha256=before, preserved_recovery=old_recovery)
        guard.private_json(DIRECTORY / "context.json", value)
        mount_context = DIRECTORY / "admission-context.json"
        guard.private_json(mount_context, value)
        os.chown(mount_context, 1000, 999)
        os.chmod(mount_context, 0o400)
        runtime.require(lab.db(runtime.regular(HERE / "http-admission.sql", 16384).decode("ascii"), write=True) == {"created": True},
                        "HTTP schema creation uncertain; preserve the checkpoint.")
        container, nonce = lab.create_creator(journal, config, server="http-server.sh", mounts=(
            (HERE / "http-admission.rb", "/api/config/initializers/ingenium_lab.rb"),
            (mount_context, "/api/ingenium-http-context.json")))
        try:
            lab.run("docker", "start", container)
            host = lab.private_ip(container)
            lab.wait_creator(host, token)
            lab.api.check_api(host, token)
            provider_token = exercise(host, token, value, journal)
        finally:
            lab.stop_creator(container, nonce, journal)
        after_sql = profiles.SNAPSHOT_SQL.replace("FROM submissions s;", f"FROM submissions s WHERE token <> '{provider_token}';")
        after = lab.db(after_sql)
        runtime.require(after == {"count": 9, "complete": True, "sha256": before}
                        and old_recovery_snapshot() == old_recovery
                        and lab.db(f"SELECT json_build_object('count', count(*)) FROM {guard.TABLE};") == {"count": 1}
                        and lab.db("SELECT json_build_object('count', count(*)) FROM submissions;") == {"count": 10}
                        and lab.redis(lab.EMPTY, 0) == b"empty", "Preserved records, provider count or queue differ.")
        lab.queue.check_services()
        lab.api.check_api(lab.private_ip(lab.queue.API), token)
        journal.record("COMPLETE", provider_token=provider_token, preserved_lab_sha256=before, preserved_recovery=old_recovery)
        print("PASS: ten provider records retained (nine unchanged); old held reservation unchanged; queue empty; original API in maintenance", flush=True)
        return 0
    except KeyboardInterrupt:
        print("FAIL: interrupted; preserve HTTP records and any sandbox resources.", file=sys.stderr)
        return 130
    except Exception as error:
        detail = str(error) if isinstance(error, RuntimeError) else type(error).__name__
        print("FAIL: " + detail + " Preserve /opt/ingenium-judge-spike/http-v1 and its schema. Do not rerun or clear records.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
