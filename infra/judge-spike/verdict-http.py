import base64
from decimal import Decimal
import hashlib
import importlib.util
import os
from pathlib import Path, PurePosixPath
import platform
import signal
import socket
import subprocess
import sys
import time
import uuid


HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("verdict_http_previous", HERE / "verdicts.py")
previous = importlib.util.module_from_spec(spec)
spec.loader.exec_module(previous)
# Separate module instances keep the completed transport/recovery controllers frozen.
transport = previous.streams.load("verdict_http_transport", HERE / "transport.py")
lab, guard, runtime, require = transport.lab, transport.guard, transport.runtime, transport.require
bundle = previous.streams.load("verdict_http_bundle", HERE / "verdict-transport/bundle.py")
cases, rules, capture = previous.cases, previous.rules, transport.capture
DIRECTORY = lab.RUNTIME / "verdict-http-v1"
TABLE = "ingenium_verdict_http_v1.attempts"
PATH = "/ingenium-verdict/attempts"
SCOPE = "eighteen-fixed-protected-http-verdicts-v1"
TOTAL = 15 + len(cases.CASES)
guard.TABLE = TABLE
transport.flow.PATH = PATH
LANGUAGES = {"c": 50, "cpp": 54, "java": 62, "python": 71, "javascript": 63}
LEGACY_ENTRY = "2563c39b9e09735f5b111b6a5f4fcb7d19d293e57624e12e808f36b0177b655d"
LEGACY_LAUNCHER = "dca74fdc0661e386c17e25382b00491164963220d13f644bc295faa725b2a308"
FILES = (*transport.FILES, "verdicts.py", "output.py", "seal-output.py", "isolation.py", "verdict-http.py", "verdict-admission.rb", "verdict-admission.sql", "test/verdict-admission.test.rb")


def fingerprints():
    return {"helpers": {name: previous.digest(runtime.regular(HERE / name, 65536)) for name in FILES},
            "stream": previous.streams.bundle.fingerprint(), "output": previous.output.bundle.fingerprint(),
            "verdict": previous.bundle.fingerprint(), "bound": bundle.fingerprint()}


def completed_verdicts():
    past = previous.completed_output()
    root = previous.DIRECTORY
    raw = {name: transport.private(root / name, 4194304) for name in ("journal.jsonl", "verdicts.log", "evidence.json")}
    rows = [lab.decode_json(line) for line in raw["journal.jsonl"].splitlines()]
    require([row.get("event") for row in rows] == ["PREPARED", "VERDICTS_STARTED", "VERDICTS_FINISHED", "COMPLETE"], "Earlier verdict checkpoint is incomplete.")
    context, final = rows[0], rows[-1]
    frozen, manifest_sha = guard.manifest()
    policy = previous.digest(runtime.regular(HERE / "namespace-smoke.apparmor", 65536))
    helpers = {"verdicts.py": LEGACY_ENTRY, "cgroup-smoke.sh": LEGACY_LAUNCHER, "namespace-smoke.apparmor": policy}
    require(context["preserved"] == past and context["helpers_sha256"] == helpers
            and previous.digest(runtime.regular(HERE / "verdicts.py", 65536)) == LEGACY_ENTRY
            and context["bundle_sha256"] == previous.bundle.fingerprint() and context["stream_sha256"] == previous.streams.bundle.fingerprint()
            and context["output_sha256"] == previous.output.bundle.fingerprint() and context["image_id"] == frozen["image_id"]
            and context["manifest_sha256"] == manifest_sha and final.get("cases") == 18 and final.get("new_provider_records") == 0
            and final.get("preserved") == past and final.get("evidence_sha256") == previous.digest(raw["evidence.json"])
            and rows[2].get("log_sha256") == previous.digest(raw["verdicts.log"]), "Earlier protected verdict source, seal or state changed.")
    saved = lab.decode_json(raw["evidence.json"])
    expected = {"scope": "fixed-protected-verdicts-v1", **{key: context[key] for key in (
        "host_epoch", "image_id", "manifest_sha256", "bundle_sha256", "stream_sha256", "output_sha256", "helpers_sha256", "preserved")},
        "results": previous.parse_log(root / "verdicts.log", frozen, context["bundle_sha256"]), "log_sha256": previous.digest(raw["verdicts.log"])}
    require(saved == expected, "Earlier protected verdict evidence differs.")
    names = set(transport.OLD_FILES) | {"profiles-v2/journal.jsonl", "profiles-v2/runtime-manifest.json"}
    names.update("transport-v1/" + name for name in past["earlier"]["earlier"]["files"])
    names.update("isolation-v1/" + name for name in past["earlier"]["isolation"])
    names.update("output-v1/" + name for name in past["output"])
    names.update("verdicts-v1/" + name for name in raw)
    return {name: previous.digest(transport.private(lab.RUNTIME / name, 4194304)) for name in sorted(names)}


def snapshot(files, owned=False):
    require(type(files) is dict and 10 <= len(files) <= 128, "Unexpected prior-evidence inventory.")
    roots = {"profiles-v2", "recovery-v1", "http-v1", "active-crash-v1", "streams-v1", "streams-v2", "transport-v1", "isolation-v1", "output-v1", "verdicts-v1"}
    for name, digest in files.items():
        path = PurePosixPath(name)
        require(not path.is_absolute() and path.parts and path.parts[0] in roots and ".." not in path.parts and "\\" not in name, "Untrusted prior-evidence path.")
        guard.digest(digest)
        parent = lab.RUNTIME
        for part in path.parts[:-1]:
            parent = parent / part
            require(parent.is_dir() and not parent.is_symlink(), "Linked/missing prior-evidence directory.")
    sql = previous.streams.profiles.SNAPSHOT_SQL
    if owned:
        sql = sql.replace("FROM submissions s;", f"FROM submissions s WHERE NOT EXISTS (SELECT 1 FROM {TABLE} a WHERE a.submission_id = s.id);")
    providers = lab.db(sql)
    require(providers.get("count") == 15 and providers.get("complete") is True, "Expected the unchanged fifteen completed prior provider rows.")
    tables = {name: lab.db("SELECT json_build_object('count', count(*), 'sha256', "
              "encode(sha256(convert_to(jsonb_agg(to_jsonb(a) ORDER BY attempt_id)::text, 'UTF8')), 'hex')) "
              f"FROM {name}.attempts a;") for name in ("ingenium_recovery_v1", "ingenium_http_v1", "ingenium_active_crash_v1", "ingenium_transport_v1")}
    return {"providers": providers, "tables": tables, "files": {name: previous.digest(transport.private(lab.RUNTIME / name, 4194304)) for name in files}}


def payload(case):
    raw = cases.source(case)
    require(0 < len(raw) <= 32768, "Fixed source exceeds its budget.")
    return {**lab.PAYLOAD, "source_code": base64.b64encode(raw).decode("ascii"), "language_id": LANGUAGES[case["profile"]],
            "stdin": base64.b64encode((case["mode"] + "\n").encode("ascii")).decode("ascii"), "cpu_time_limit": case["cpu_ms"] / 1000,
            "wall_time_limit": case["wall_ms"] / 1000, "memory_limit": case["memory_bytes"] // 1024, "stack_limit": 65536,
            "max_processes_and_or_threads": 64, "max_file_size": 16384}


def payload_hash(case, data, value):
    return previous.digest(transport.canonical({"scope": SCOPE, "case_id": case["id"], "payload": data,
        "fingerprints": value["fingerprints"], "manifest_sha256": value["manifest_sha256"]}))


def context():
    value = lab.decode_json(transport.private(DIRECTORY / "context.json"))
    frozen, manifest_sha = guard.manifest()
    require(type(value) is dict and set(value) == {"scope", "manifest_sha256", "image_id", "fingerprints", "preserved", "jobs"}
            and value["scope"] == SCOPE and value["manifest_sha256"] == manifest_sha and value["image_id"] == frozen["image_id"]
            and value["fingerprints"] == fingerprints() and type(value["jobs"]) is dict
            and set(value["jobs"]) == {case["id"] for case in cases.CASES}, "Bound verdict context/runtime differs.")
    attempts = set()
    for case in cases.CASES:
        item = value["jobs"][case["id"]]
        require(type(item) is dict and set(item) == {"payload", "binding"} and transport.canonical(item["payload"]) == transport.canonical(payload(case)), "Fixed HTTP payload differs.")
        binding = item["binding"]
        guard.where(binding)
        require(binding["host_epoch"] == Path("/proc/sys/kernel/random/boot_id").read_text().strip()
                and binding["manifest_sha256"] == manifest_sha and binding["payload_sha256"] == payload_hash(case, item["payload"], value), "Binding, boot or source changed; no launch permitted.")
        attempts.add(binding["attempt_id"])
    require(len(attempts) == 18, "Duplicate bound verdict attempts.")
    return value, frozen


def job_for(case, item, row, owner, value):
    job = {"case_id": case["id"], "binding": item["binding"], "owner_id": owner, "provider_token": row["token"], "submission_id": row["submission_id"],
           **{key + "_sha256": value["fingerprints"][key] for key in ("stream", "output", "verdict")}}
    bundle.checked_job(job, cases.CASES)
    return job


def checked_result(result, job, value):
    case = bundle.checked_job(job, cases.CASES)
    require(type(result) is dict and set(result) == {"job", "bundle_sha256", "evidence", "result"}
            and transport.canonical(result["job"]) == transport.canonical(job) and result["bundle_sha256"] == value["fingerprints"]["bound"], "Evidence belongs to another bound execution.")
    verdict = rules.classify(case, result["evidence"], capture, cases.source(case))
    require(result["result"] == verdict == {"verdict": case["expected"], "recovery_required": case["expected"] is None}, "Backend protected verdict differs.")
    return verdict


def parse_execution(path, job, value, frozen):
    raw = transport.private(path)
    lines = raw.decode("ascii").splitlines()
    values = [lab.decode_json(line.removeprefix("INGENIUM_BOUND_VERDICT_RESULT ")) for line in lines if line.startswith("INGENIUM_BOUND_VERDICT_RESULT ")]
    versions = [lab.decode_json(line.removeprefix("INGENIUM_BOUND_VERDICT_VERSIONS ")) for line in lines if line.startswith("INGENIUM_BOUND_VERDICT_VERSIONS ")]
    require(len(values) == 1 and versions == [frozen["observed"]] and not any(line.startswith("FAIL:") for line in lines)
            and lines.count("PASS: bound verdict completed with protected bytes, cause, exact target identity and normal cleanup") == 1
            and lines.count("PASS: host test groups and temporary files removed") == 1, "Bound verdict/cleanup incomplete.")
    checked_result(values[0], job, value)
    previous.seal.physical_cleanup(raw)
    return values[0]


def provider_guard(item, row, finished=False):
    require(type(row["submission_id"]) is int and row["submission_id"] > 0, "Wrong provider row identity.")
    return f"id = {row['submission_id']} AND " + lab.payload_guard(row["token"], payload=item["payload"], total=TOTAL, finished=finished)


def projection(result):
    verdict = result["result"]
    if verdict["recovery_required"]: return None
    evidence = result["evidence"]
    phase = evidence["run"] or evidence["compile"]
    meta = rules.metadata(phase["meta_b64"])
    code = int(meta["exitcode"]) if "exitcode" in meta else None
    signum = int(meta["exitsig"]) if "exitsig" in meta else None
    # Legacy provider status describes execution, never the backend's competition verdict.
    status = 6 if evidence["run"] is None else {"TO": 5, "RE": 11, "SG": {11: 7, 25: 8, 8: 9, 6: 10}.get(signum, 12)}.get(meta.get("status"), 3)
    return {"status_id": status, "exit_code": code, "exit_signal": signum,
            "time": str(Decimal(phase["cpu_ns"]) / 1000000000), "wall_time": meta["time-wall"], "memory": (phase["peak_bytes"] + 1023) // 1024,
            "stdout": None if evidence["run"] is None else phase["captures"]["stdout"]["data_b64"],
            "stderr": None if evidence["run"] is None else phase["captures"]["stderr"]["data_b64"],
            "compile_output": None if evidence["compile"] is None else evidence["compile"]["captures"]["compiler"]["data_b64"]}


def seal_result(case, item, row, owner, result, raw, value):
    expected_job = job_for(case, item, row, owner, value)
    verdict = checked_result(result, expected_job, value)
    require(raw == transport.canonical(result) and len(raw) <= transport.MAX_WIRE, "Changed/oversized bound result.")
    digest, wire = previous.digest(raw), base64.b64encode(raw).decode("ascii")
    held = verdict["recovery_required"]
    assignments = (f"held_evidence_sha256 = '{digest}', held_at = clock_timestamp(), held_evidence_json" if held else
                   f"state = 'SEALED', evidence_sha256 = '{digest}', sealed_at = clock_timestamp(), evidence_json") + f" = convert_from(decode('{wire}', 'base64'), 'UTF8')::jsonb"
    sql = ("\\set QUIET on\nDO $seal$ BEGIN " + f"UPDATE {TABLE} SET {assignments} WHERE {guard.where(item['binding'])} "
           f"AND state = 'STARTED' AND held_evidence_json IS NULL AND owner_id = '{owner}' AND provider_id = '{row['token']}' AND submission_id = {row['submission_id']}; "
           "IF NOT FOUND THEN RAISE EXCEPTION 'Result owner differs'; END IF; ")
    if held:
        sql += "PERFORM id FROM submissions WHERE status_id = 2 AND stdout IS NULL AND stderr IS NULL AND compile_output IS NULL AND " + provider_guard(item, row) + "; "
    else:
        fields = projection(result)
        def literal(value): return "NULL" if value is None else "'" + value + "'" if type(value) is str else str(value)
        sql += "UPDATE submissions SET finished_at = clock_timestamp(), message = NULL, " + ", ".join(key + " = " + literal(value) for key, value in fields.items())
        sql += " WHERE status_id = 2 AND " + provider_guard(item, row) + "; "
    sql += "IF NOT FOUND THEN RAISE EXCEPTION 'Provider state/payload differs'; END IF; END; $seal$; SELECT json_build_object('committed', true);"
    require(lab.db(sql, write=True) == {"committed": True}, "Commit reply uncertain; resolve evidence, never execute again.")


def worker(name):
    value, frozen = context()
    case = next(case for case in cases.CASES if case["id"] == name)
    item = value["jobs"][name]
    row = transport.flow.row_for(item["binding"])
    raw = sys.stdin.buffer.readline(8193)
    require(len(raw) <= 8192, "Oversized queue envelope.")
    lab.validate_message(raw, row["submission_id"])
    require(lab.decode_json(raw) == row["envelope"], "Delivery differs from immutable outbox.")
    owner = str(uuid.uuid4())
    if not guard.claim(item["binding"], owner):
        print('{"launched":false}', flush=True)
        return 0
    journal = lab.Journal(DIRECTORY / ("execution-" + item["binding"]["attempt_id"]))
    job = job_for(case, item, row, owner, value)
    journal.record("LAUNCH_AUTHORISED", job=job)
    digest = transport.save(journal.directory / "job.json", job)
    changed = lab.db("WITH changed AS (UPDATE submissions SET status_id = 2 WHERE status_id = 1 AND " + provider_guard(item, row) +
                     " RETURNING id) SELECT json_build_object('updated', count(*) = 1) FROM changed;", write=True)
    require(changed == {"updated": True}, "Provider processing transition uncertain; keep the reservation.")
    hashes = value["fingerprints"]
    path = previous.streams.profiles.logged(journal, "sandbox", ["/bin/bash", str(HERE / "cgroup-smoke.sh"), "--verdict-job", frozen["image_id"],
        hashes["stream"], hashes["output"], hashes["verdict"], hashes["bound"], str(journal.directory / "job.json"), digest], 480)
    result = parse_execution(path, job, value, frozen)
    digest = transport.save(journal.directory / "evidence.json", result)
    journal.record("EVIDENCE_SAVED", evidence_sha256=digest)
    seal_result(case, item, row, owner, result, transport.private(journal.directory / "evidence.json"), value)
    journal.record("RECOVERY_HELD" if result["result"]["recovery_required"] else "SEALED", evidence_sha256=digest)
    os._exit(75)  # Lose only the committed response after physical cleanup, never an execution permit.


def dispatch(case, item, row, journal):
    envelope = lab.db(f"WITH sent AS (UPDATE {TABLE} SET dispatched_at = clock_timestamp() WHERE {guard.where(item['binding'])} "
        "AND dispatched_at IS NULL AND state = 'PREPARED' RETURNING envelope) SELECT COALESCE((SELECT envelope FROM sent), 'null'::jsonb);", write=True)
    require(envelope == row["envelope"], "Outbox send uncertain; do not retry.")
    raw = transport.canonical(envelope)
    journal.record("QUEUE_SEND_STARTED", case_id=case["id"], envelope_sha256=previous.digest(raw))
    require(lab.redis(transport.flow.PUSH_TWO, 0, raw) == b"queued-two", "Queue send uncertain; never repeat it.")
    messages = []
    for count in (2, 1):
        message = lab.redis(lab.PEEK, count)
        lab.validate_message(message, row["submission_id"])
        require(lab.decode_json(message) == envelope and lab.redis(lab.CLAIM, count, message) == b"claimed", "Delivery uncertain; retain evidence.")
        messages.append(message)
    workers = [subprocess.Popen([sys.executable, "-B", str(HERE / "verdict-http.py"), "--worker", case["id"]], stdin=subprocess.PIPE,
                stdout=subprocess.PIPE, stderr=subprocess.STDOUT) for _ in messages]
    for process, message in zip(workers, messages):
        process.stdin.write(message + b"\n")
        process.stdin.close()
    codes, deadline = [], time.monotonic() + 510
    for index, process in enumerate(workers):
        code = process.wait(timeout=max(1, deadline - time.monotonic()))
        reply = process.stdout.read(8193)
        guard.private_json(DIRECTORY / f"worker-{case['id']}-{index}.json", {"exit_code": code, "stdout_b64": base64.b64encode(reply).decode("ascii")})
        require(len(reply) <= 8192 and ((code == 75 and reply == b"") or (code == 0 and lab.decode_json(reply) == {"launched": False})), "Worker failed; inspect without retrying.")
        codes.append(code)
    require(sorted(codes) == [0, 75], "Expected one launch and one refused duplicate.")


def verify_http(host, token, case, item, row, value, frozen):
    root = DIRECTORY / ("execution-" + item["binding"]["attempt_id"])
    raw = transport.private(root / "evidence.json")
    local = lab.decode_json(raw)
    state = guard.observe(item["binding"])
    held = case["expected"] is None
    job = job_for(case, item, row, state["owner_id"], value)
    require(local == parse_execution(root / "sandbox.log", job, value, frozen) and state["permit_count"] == 1
            and state["state"] == ("STARTED" if held else "SEALED") and state["reserved"] is held and state["provider_id"] == row["token"]
            and state["evidence_sha256"] == (None if held else previous.digest(raw)), "Lost reply cannot be bound to the committed execution.")
    lookup = PATH + "/" + item["binding"]["attempt_id"]
    status, response = transport.request(host, "GET", lookup + "/evidence", token)
    require(status == 200 and type(response) is dict and set(response) == {"token", "submission_id", "state", "permit_count", "reserved", "recovery_required", "evidence_sha256", "evidence"}
            and response["token"] == row["token"] and type(response["submission_id"]) is int and response["submission_id"] == row["submission_id"]
            and response["state"] == state["state"] and type(response["permit_count"]) is int and response["permit_count"] == 1
            and response["reserved"] is held and response["recovery_required"] is held and response["evidence_sha256"] == previous.digest(raw)
            and transport.canonical(response["evidence"]) == raw, "HTTP recovery changed bound evidence/reservation semantics.")
    verdict = checked_result(response["evidence"], job, value)
    require(transport.request(host, "GET", lookup + "/evidence")[0] == 401, "Evidence accepted unauthenticated access.")
    status, provider = transport.request(lab.private_ip(lab.queue.API), "GET", "/submissions/" + row["token"] + "?base64_encoded=true&fields=" + transport.flow.FIELDS, token)
    require(status == 200 and set(provider) == set(transport.flow.FIELDS.split(",")) and provider["token"] == row["token"] and provider["message"] is None,
            "Original provider response differs.")
    fields = projection(local)
    if held:
        require(provider["status"] == {"id": 2, "description": "Processing"} and all(provider[key] is None for key in (
            "stdout", "stderr", "compile_output", "exit_code", "exit_signal", "time", "memory", "wall_time")), "Uncertain execution invented a final provider result.")
    else:
        require(type(provider["status"]) is dict and set(provider["status"]) == {"id", "description"} and type(provider["status"]["id"]) is int
                and provider["status"]["id"] == fields["status_id"] and type(provider["status"]["description"]) is str
                and all(type(provider[key]) is type(fields[key]) and provider[key] == fields[key] for key in ("exit_code", "exit_signal", "memory"))
                and Decimal(str(provider["time"])) == Decimal(fields["time"]) and Decimal(str(provider["wall_time"])) == Decimal(fields["wall_time"]),
                "Provider execution status/accounting differs from trusted evidence.")
        for key, kind in (("stdout", "stdout"), ("stderr", "stderr"), ("compile_output", "compiler")):
            if fields[key] is None: require(provider[key] is None, "Invented provider stream.")
            else:
                phase = local["evidence"]["compile" if kind == "compiler" else "run"]
                transport.decode_provider(provider[key], phase["captures"][kind], kind)
    require(not guard.claim(item["binding"], str(uuid.uuid4())), "Completed/held attempt obtained another permit.")
    for mutation in ("dispatched_at = NULL", "held_evidence_json = '{}'::jsonb" if held else "evidence_json = '{}'::jsonb", "submission_id = submission_id + 1"):
        guard.forbidden_change(f"UPDATE {TABLE} SET {mutation} WHERE {guard.where(item['binding'])}")
    guard.forbidden_change(f"DELETE FROM {TABLE} WHERE {guard.where(item['binding'])}")
    require(guard.observe(item["binding"]) == state and transport.request(host, "GET", lookup + "/evidence", token) == (200, response), "Forbidden changes modified held/sealed evidence.")
    print(f"PASS: {case['id']} -> {verdict['verdict'] or 'RECOVERY_REQUIRED'}; one execution, lost HTTP reply recovered, bytes/accounting and reservation verified", flush=True)
    return {"token": row["token"], "submission_id": row["submission_id"], "evidence_sha256": previous.digest(raw), **verdict}


def admit(host, token, value, journal):
    rows = {}
    for case in cases.CASES:
        item = value["jobs"][case["id"]]
        binding = item["binding"]
        lookup = PATH + "/" + binding["attempt_id"]
        require(transport.request(host, "POST", PATH, value=binding)[0] == 401 and transport.request(host, "GET", lookup, token)[0] == 404
                and transport.request(host, "POST", PATH, token, dict(binding, payload_sha256="0" * 64))[0] == 409, "Admission identity/auth gates failed.")
        journal.record("HTTP_SEND_STARTED", case_id=case["id"], binding=binding)
        transport.flow.discard_token_reply(host, token, binding)
        status, resolved = transport.request(host, "GET", lookup, token)
        require(status == 200 and type(resolved) is dict and set(resolved) == {"token", "submission_id", "state", "permit_count", "reserved", "recovery_required", "evidence_sha256"}
                and resolved["state"] == "PREPARED" and type(resolved["permit_count"]) is int and resolved["permit_count"] == 0
                and type(resolved["submission_id"]) is int and resolved["reserved"] is True and resolved["recovery_required"] is False
                and resolved["evidence_sha256"] is None, "Lost token body could not be reconciled; do not POST again.")
        row = transport.flow.row_for(binding)
        require(resolved["token"] == row["token"] and resolved["submission_id"] == row["submission_id"]
                and transport.request(host, "POST", PATH, token, binding) == (201, resolved)
                and transport.request(host, "GET", lookup + "/evidence", token)[0] == 409, "Explicit duplicate or premature evidence differs.")
        rows[case["id"]] = row
        journal.record("HTTP_RECONCILED", case_id=case["id"], token=row["token"], submission_id=row["submission_id"])
    require(len({row["token"] for row in rows.values()}) == 18 and lab.db("SELECT json_build_object('count', count(*)) FROM submissions;") == {"count": TOTAL}, "Expected eighteen fresh records and fifteen unchanged prior rows.")
    print("PASS: eighteen fixed provider/outbox associations admitted once; lost token bodies and explicit duplicate POSTs reconciled", flush=True)
    return rows


def main(argv=None):
    args = sys.argv[1:] if argv is None else argv
    if (args != [] and not (len(args) == 2 and args[0] == "--worker" and args[1] in {case["id"] for case in cases.CASES})) or platform.system() != "Linux" or socket.gethostname() != "ingenium-judge-spike-01" or os.geteuid() != 0:
        print("FAIL: fixed verdict HTTP modes require sudo on the isolated VM.", file=sys.stderr)
        return 1
    try:
        os.umask(0o077)
        signal.signal(signal.SIGTERM, lab.interrupt)
        previous.streams.active.tree.directory(lab.RUNTIME, 0o700)
        if args: return worker(args[1])
        require(not os.path.lexists(DIRECTORY), "Verdict HTTP checkpoint exists; do not rerun or reset it.")
        lab.queue.check_services()
        require(lab.run("docker", "network", "inspect", lab.NETWORK, "--format", "{{.Internal}}|{{.Driver}}") == b"true|bridge", "Private bridge differs.")
        files = completed_verdicts()
        before = snapshot(files)
        require(before["files"] == files and lab.db("SELECT json_build_object('absent', NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'ingenium_verdict_http_v1'));") == {"absent": True}, "New schema exists or earlier evidence changed; never reset it.")
        frozen, manifest_sha = guard.manifest()
        config = transport.failure.private_file(lab.RUNTIME / "judge0.conf", 1000, 999, 0o400, 32768)
        _, token = lab.prepare_config(config)
        lab.api.check_api(lab.private_ip(lab.queue.API), token)
        ruby = runtime.regular(HERE / "test/verdict-admission.test.rb", 16384) + runtime.regular(HERE / "verdict-admission.rb", 16384)
        require(lab.run("docker", "exec", "-i", "--user", "1000:999", lab.queue.API, "ruby", "-", data=ruby) == b"PASS: fixed verdict admission stub checks passed", "Ruby self-check failed before changes.")
        value = {"scope": SCOPE, "manifest_sha256": manifest_sha, "image_id": frozen["image_id"], "fingerprints": fingerprints(), "preserved": before, "jobs": {}}
        boot = Path("/proc/sys/kernel/random/boot_id").read_text().strip()
        for case in cases.CASES:
            data = payload(case)
            value["jobs"][case["id"]] = {"payload": data, "binding": {"attempt_id": str(uuid.uuid4()), "host_epoch": boot,
                "manifest_sha256": manifest_sha, "payload_sha256": payload_hash(case, data, value)}}
        journal = lab.Journal(DIRECTORY)
        journal.record("PREPARED", preserved=before, fingerprints=value["fingerprints"])
        transport.save(DIRECTORY / "context.json", value)
        context_path = DIRECTORY / "admission-context.json"
        transport.save(context_path, value)
        os.chown(context_path, 1000, 999)
        os.chmod(context_path, 0o400)
        context()
        journal.record("SCHEMA_CREATE_STARTED")
        require(lab.db(runtime.regular(HERE / "verdict-admission.sql", 16384).decode("ascii"), write=True) == {"created": True}, "Schema creation uncertain; preserve it.")
        journal.record("SCHEMA_CREATED")
        container, nonce = lab.create_creator(journal, config, server="http-server.sh", mounts=(
            (HERE / "verdict-admission.rb", "/api/config/initializers/ingenium_verdict.rb"), (context_path, "/api/ingenium-verdict-context.json")))
        results = {}
        try:
            lab.run("docker", "start", container)
            host = lab.private_ip(container)
            lab.wait_creator(host, token)
            lab.api.check_api(host, token)
            rows = admit(host, token, value, journal)
            for case in cases.CASES:
                item, row = value["jobs"][case["id"]], rows[case["id"]]
                dispatch(case, item, row, journal)
                results[case["id"]] = verify_http(host, token, case, item, row, value, frozen)
        finally: lab.stop_creator(container, nonce, journal)
        context()
        require(snapshot(files, owned=True) == before and lab.redis(lab.EMPTY, 0) == b"empty"
                and lab.db(f"SELECT json_build_object('count', count(*), 'sealed', count(*) FILTER (WHERE state = 'SEALED' AND permit_count = 1 AND evidence_json IS NOT NULL), "
                    "'held', count(*) FILTER (WHERE state = 'STARTED' AND permit_count = 1 AND held_evidence_json IS NOT NULL)) " + f"FROM {TABLE};") == {"count": 18, "sealed": 17, "held": 1}, "Prior evidence, completed inventory, reservation or queue differs.")
        lab.queue.check_services()
        lab.api.check_api(lab.private_ip(lab.queue.API), token)
        digest = transport.save(DIRECTORY / "evidence.json", {"scope": SCOPE, "results": results, "preserved": before, "fingerprints": value["fingerprints"]})
        journal.record("COMPLETE", evidence_sha256=digest, cases=18, new_provider_records=18, sealed=17, held=1, preserved=before)
        print("PASS: thirty-three provider rows retained (fifteen unchanged); seventeen protected verdicts sealed and one uncertain result held without a verdict; queue empty; maintenance enabled", flush=True)
        return 0
    except KeyboardInterrupt:
        print("FAIL: interrupted; preserve verdict-http-v1 and all resources without retrying.", file=sys.stderr)
        return 130
    except Exception as error:
        print("FAIL: " + (str(error) if isinstance(error, RuntimeError) else type(error).__name__)
              + " Preserve verdict-http-v1, its schema and resources. Do not rerun, reset permits or force-clean.", file=sys.stderr)
        return 1


if __name__ == "__main__": sys.exit(main())
