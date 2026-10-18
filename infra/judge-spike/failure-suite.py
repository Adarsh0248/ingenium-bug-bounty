import base64
from decimal import Decimal, DecimalException
import hashlib
import importlib.util
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
import http.client


HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("failure_lab", HERE / "one-job.py")
lab = importlib.util.module_from_spec(spec)
spec.loader.exec_module(lab)
# shortcut: reviewed synthetic fixtures only; not a participant-source execution API.
FIXTURES = {
    "wrong-output": "b087f6c48546a242f4aec71eede072bf84bedd2b76698e3ae56ebdf7222898e4",
    "compile-error": "3289bdb98b7dba7ccf783332195b6a6f2ac8bf7b62d4d1cf3332424178c2d6a1",
    "signal-crash": "dd2ea001eb802fc2fae5aa60816e9393cde59cd483a7a78816a96e6989ef6995",
    "nonzero-exit": "72c893f67f2901b8d6dc3e4a97430afea181b5acc44ccd3da0d877eb4cabe09f",
    "cpu-limit": "3578ed8563b395a8a7c8a4aca9eb8feddb27e84397ea79b4d6c66b135e55958d",
    "memory-limit": "f69cae09a911dd27b99ce14136b9b675dc684bdc2b0ba63d9095740b67773bac",
    "output-limit": "e82fd61b1df7b514b35e8fdfcd4f22fcb68944b3abab08155e3b240496327555",
    "output-boundary": "c148b177ebcf4ad45bace012d65b7548b80ed64bd207c36d64447e5a656a5a00",
}
STATUS_NAMES = {3: "Accepted", 5: "Time Limit Exceeded", 6: "Compilation Error",
                7: "Runtime Error (SIGSEGV)", 8: "Runtime Error (SIGXFSZ)",
                11: "Runtime Error (NZEC)", 12: "Runtime Error (Other)"}
FIELDS = "token,stdout,stderr,compile_output,message,status,exit_code,exit_signal,time,memory,wall_time"


def fixture_payloads():
    payloads = {}
    for name, expected in FIXTURES.items():
        path = HERE / "fixtures" / (name + ".cpp")
        if not path.is_file() or path.is_symlink() or path.stat().st_size > 4096:
            raise RuntimeError("Missing regular reviewed fixture.")
        source = path.read_bytes()
        if hashlib.sha256(source).hexdigest() != expected:
            raise RuntimeError("Fixture fingerprint changed; no job may be created.")
        payload = dict(lab.PAYLOAD, source_code=base64.b64encode(source).decode("ascii"))
        if name == "cpu-limit":
            payload.update(cpu_time_limit=0.2, wall_time_limit=5)
        if name == "memory-limit":
            payload.update(memory_limit=16384)
        payloads[name] = payload
    return payloads


def decode_bytes(value, cap):
    if type(value) is not str or len(value) > 4 * ((cap + 2) // 3):
        raise RuntimeError("Invalid or oversized encoded execution evidence.")
    raw = base64.b64decode(value, validate=True)
    if len(raw) > cap or base64.b64encode(raw).decode("ascii") != value:
        raise RuntimeError("Noncanonical execution evidence.")
    return raw


def metadata(raw):
    values = {}
    for line in raw.decode("ascii").splitlines():
        key, separator, value = line.partition(":")
        if not separator or key in values:
            raise RuntimeError("Malformed or duplicate sandbox metadata.")
        values[key] = value
    numeric = {"max-rss", "csw-voluntary", "csw-forced", "cg-mem"}
    controls = {"status", "message", "exitcode", "exitsig", "killed", "cg-oom-killed"}
    required = numeric | {"time", "time-wall"}
    if not required <= values.keys() or values.keys() - required - controls:
        raise RuntimeError("Missing or unknown sandbox metadata fields.")
    for key in numeric | ({"exitcode", "exitsig", "killed", "cg-oom-killed"} & values.keys()):
        if re.fullmatch(r"[0-9]+", values[key]) is None:
            raise RuntimeError("Invalid numeric sandbox metadata.")
    for key in ("time", "time-wall"):
        if re.fullmatch(r"[0-9]+(?:\.[0-9]+)?", values[key]) is None:
            raise RuntimeError("Invalid sandbox time metadata.")
    if values.get("status") == "XX":
        raise RuntimeError("Sandbox infrastructure failure is not a program verdict.")
    return values


def phase(value, *, compile_phase=False, memory_case=False):
    fields = {"rc", "meta_b64", "stdout_b64", "stderr_b64", "cpu_ns", "peak_bytes", "ram_hits", "combined_hits"}
    if type(value) is not dict or set(value) != fields:
        raise RuntimeError("Unexpected phase evidence fields.")
    for key in ("rc", "cpu_ns", "peak_bytes", "ram_hits", "combined_hits"):
        if type(value[key]) is not int or value[key] < 0:
            raise RuntimeError("Invalid phase counters.")
    if value["rc"] not in (0, 1) or not 0 < value["cpu_ns"] <= (5_000_000_000 if compile_phase else 2_000_000_000):
        raise RuntimeError("Invalid phase execution/accounting result.")
    cap = 134217728 if compile_phase else (268435456 if memory_case else 33554432)
    if not 0 < value["peak_bytes"] <= cap:
        raise RuntimeError("Invalid phase memory accounting.")
    meta = metadata(decode_bytes(value["meta_b64"], 4096))
    if Decimal(meta["time-wall"]) > (15 if compile_phase else 5):
        raise RuntimeError("Unexpected wall-time evidence.")
    limit = 65536 if compile_phase else 8192
    stdout = decode_bytes(value["stdout_b64"], limit)
    stderr = decode_bytes(value["stderr_b64"], limit)
    return meta, stdout, stderr


def control_fields(meta):
    return {key: meta[key] for key in ("status", "message", "exitcode", "exitsig", "killed", "cg-oom-killed") if key in meta}


def classify(name, evidence):
    if name not in FIXTURES or type(evidence) is not dict or set(evidence) != {"fixture", "source_sha256", "compile", "run"}:
        raise RuntimeError("Unexpected fixed-fixture result.")
    if evidence["fixture"] != name or evidence["source_sha256"] != FIXTURES[name]:
        raise RuntimeError("Fixture execution identity mismatch.")
    compiled = evidence["compile"]
    cm, co, ce = phase(compiled, compile_phase=True)
    if compiled["ram_hits"] or compiled["combined_hits"] or co:
        raise RuntimeError("Unexpected compilation resource/output failure.")
    if name == "compile-error":
        if (compiled["rc"] != 1 or control_fields(cm) != {"exitcode": "1", "status": "RE", "message": "Exited with error status 1"}
                or b"INGENIUM_EXPECTED_COMPILE_ERROR" not in ce or evidence["run"] is not None):
            raise RuntimeError("Compilation-error cause or skipped execution was not proved.")
        return {"outcome": "COMPILATION_ERROR", "status": 6, "stdout": None, "compile_output": ce,
                "exit_code": None, "exit_signal": None, "time": None, "wall_time": None, "memory": None,
                "stdout_complete": False}
    if compiled["rc"] != 0 or control_fields(cm) != {"exitcode": "0"} or ce:
        raise RuntimeError("The reviewed runtime fixture did not compile cleanly.")
    executed = evidence["run"]
    rm, out, err = phase(executed, memory_case=name == "memory-limit")
    if err or (name != "memory-limit" and (executed["ram_hits"] or executed["combined_hits"])):
        raise RuntimeError("Unexpected runtime diagnostics or memory-limit cause.")
    controls = control_fields(rm)
    outcome, status, exit_code, exit_signal = "", 0, None, None
    complete = False
    if name in ("wrong-output", "output-boundary"):
        expected = b"2\n" if name == "wrong-output" else b"X" * 8192
        if executed["rc"] != 0 or controls != {"exitcode": "0"} or out != expected:
            raise RuntimeError("Normal-exit output/boundary control did not match.")
        outcome = "WRONG_OUTPUT" if name == "wrong-output" else "EXACT_OUTPUT_BOUNDARY"
        if name == "wrong-output" and out == b"12\n":
            raise RuntimeError("Wrong-output fixture unexpectedly passed its private answer check.")
        status, exit_code, complete = 3, 0, True
    elif name == "nonzero-exit":
        if executed["rc"] != 1 or controls != {"exitcode": "7", "status": "RE", "message": "Exited with error status 7"} or out:
            raise RuntimeError("Nonzero-exit cause did not match.")
        outcome, status, exit_code = "NONZERO_EXIT", 11, 7
    elif name == "cpu-limit":
        if (executed["rc"] != 1 or controls != {"status": "TO", "message": "Time limit exceeded", "killed": "1"}
                or executed["cpu_ns"] < 200_000_000 or out):
            raise RuntimeError("CPU limit was not distinguished from wall/infrastructure failure.")
        outcome, status = "CPU_TIME_LIMIT", 5
    else:
        exit_signal = {"signal-crash": 11, "memory-limit": 9, "output-limit": 25}[name]
        expected_controls = {"status": "SG", "message": f"Caught fatal signal {exit_signal}", "exitsig": str(exit_signal)}
        if name == "memory-limit":
            expected_controls["cg-oom-killed"] = "1"
            if executed["ram_hits"] + executed["combined_hits"] == 0:
                raise RuntimeError("Memory-limit hits were not observed.")
        expected_output = b"X" * 8192 if name == "output-limit" else b""
        if executed["rc"] != 1 or controls != expected_controls or out != expected_output:
            raise RuntimeError("Signal/output-limit cause did not match.")
        outcome, status = {"signal-crash": ("SIGNAL_CRASH", 7), "memory-limit": ("MEMORY_LIMIT", 12),
                           "output-limit": ("OUTPUT_LIMIT", 8)}[name]
    return {"outcome": outcome, "status": status, "stdout": out if complete else None,
            "compile_output": None, "exit_code": exit_code, "exit_signal": exit_signal,
            "time": str(Decimal(executed["cpu_ns"]) / 1_000_000_000), "wall_time": rm["time-wall"],
            "memory": (executed["peak_bytes"] + 1023) // 1024, "stdout_complete": complete}


def execute_case(journal, name):
    journal.record("RUN_STARTED", fixture=name, source_sha256=FIXTURES[name])
    log = journal.directory / "sandbox.log"
    with log.open("xb") as stream:
        os.chmod(log, 0o600)
        process = subprocess.run(["/bin/bash", str(HERE / "cgroup-smoke.sh"), "--failure", name, FIXTURES[name]],
                                 stdout=stream, stderr=subprocess.STDOUT, timeout=90, check=False)
        stream.flush()
        os.fsync(stream.fileno())
    if process.returncode != 0 or log.stat().st_size > 196608:
        raise RuntimeError("Failure-case sandbox/cleanup did not complete; retain its evidence.")
    lines = log.read_bytes().decode("ascii").splitlines()
    prefix = "INGENIUM_FAILURE_RESULT "
    matches = [line[len(prefix):] for line in lines if line.startswith(prefix)]
    if (len(matches) != 1 or any("FAIL:" in line for line in lines)
            or lines.count("PASS: host test groups and temporary files removed") != 1):
        raise RuntimeError("Missing unique result or normal host cleanup evidence.")
    evidence = lab.decode_json(matches[0])
    result = classify(name, evidence)
    journal.record("RUN_FINISHED", evidence=evidence, outcome=result["outcome"], stdout_complete=result["stdout_complete"])
    return result


def canonical_hash(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False).encode("ascii")).hexdigest()


def private_file(path, uid, gid, mode, cap):
    info = path.lstat()
    if (not stat.S_ISREG(info.st_mode) or (info.st_uid, info.st_gid, stat.S_IMODE(info.st_mode)) != (uid, gid, mode)
            or info.st_size > cap):
        raise RuntimeError("Unexpected private checkpoint/config file ownership, mode or size.")
    return path.read_bytes()


def baseline_token():
    directory = lab.RUNTIME / "one-job-v1"
    info = directory.lstat()
    if not stat.S_ISDIR(info.st_mode) or info.st_uid != 0 or stat.S_IMODE(info.st_mode) != 0o700:
        raise RuntimeError("The completed baseline checkpoint is unavailable.")
    rows = [lab.decode_json(line) for line in private_file(directory / "journal.jsonl", 0, 0, 0o600, 65536).splitlines()]
    if not rows or any(type(row) is not dict for row in rows) or rows[-1].get("event") != "COMPLETE":
        raise RuntimeError("The baseline run is not complete; do not start the failure suite.")
    created = [row for row in rows if row.get("event") == "CREATED"]
    prepared = [row for row in rows if row.get("event") == "PREPARED"]
    if len(created) != 1 or len(prepared) != 1 or prepared[0].get("source_sha256") != lab.SOURCE_HASH:
        raise RuntimeError("The baseline checkpoint identity did not match.")
    return lab.valid_uuid(created[0].get("token"))


def baseline_snapshot(token, total):
    guard = lab.payload_guard(token, total=total, finished=True)
    row = lab.db("SELECT row_to_json(s) FROM submissions s WHERE status_id = 3 AND " + guard
                 + " AND decode(stdout, 'base64') = decode('MTIK', 'base64') AND exit_code = 0"
                 + " AND exit_signal IS NULL AND stderr IS NULL AND compile_output IS NULL AND message IS NULL;")
    if type(row) is not dict or type(row.get("id")) is not int or row["id"] <= 0 or row.get("token") != token:
        raise RuntimeError("Successful baseline record did not match; no prior data may be cleared.")
    return canonical_hash(row)


def create_cases(journal, journals, config, token, payloads):
    container, nonce = lab.create_creator(journal, config)
    created = {}
    try:
        lab.run("docker", "start", container)
        host = lab.private_ip(container)
        lab.wait_creator(host, token)
        for name, payload in payloads.items():
            journals[name].record("CREATE_STARTED", fixture=name, source_sha256=FIXTURES[name])
            status, raw = lab.api.request(host, "POST", "/submissions?base64_encoded=true&wait=false",
                                          token, json.dumps(payload).encode("ascii"))
            reply = lab.decode_json(raw)
            if status != 201 or type(reply) is not dict or set(reply) != {"token"}:
                raise RuntimeError("Failure-case creation was not confirmed; do not POST again.")
            created[name] = lab.valid_uuid(reply["token"])
            if len(set(created.values())) != len(created):
                raise RuntimeError("Duplicate created token; stop without claiming anything.")
            journals[name].record("CREATED", token=created[name])
        return created
    finally:
        lab.stop_creator(container, nonce, journal)


def encoded_sql(raw):
    return "NULL" if raw is None else "E'" + base64.b64encode(raw).decode("ascii") + "\\n'"


def result_sql(result, guard):
    metric = lambda key: "NULL" if result[key] is None else str(result[key])
    return (f"WITH changed AS (UPDATE submissions SET status_id = {result['status']}, finished_at = clock_timestamp(), "
            f"stdout = {encoded_sql(result['stdout'])}, stderr = NULL, compile_output = {encoded_sql(result['compile_output'])}, "
            f"message = NULL, exit_code = {metric('exit_code')}, exit_signal = {metric('exit_signal')}, "
            f"time = {metric('time')}, wall_time = {metric('wall_time')}, memory = {metric('memory')} "
            "WHERE status_id = 2 AND " + guard
            + " RETURNING id) SELECT json_build_object('updated', count(*) = 1) FROM changed;")


def verify_api(raw, token, expected):
    result = lab.decode_json(raw)
    fixed = {"token": token, "status": {"id": expected["status"], "description": STATUS_NAMES[expected["status"]]},
             "message": None, "stderr": None, "exit_code": expected["exit_code"], "exit_signal": expected["exit_signal"]}
    if type(result) is not dict or set(result) != set(fixed) | {"stdout", "compile_output", "time", "wall_time", "memory"}:
        raise RuntimeError("Unexpected failure-case API fields.")
    for key, value in fixed.items():
        if type(result[key]) is not type(value) or result[key] != value:
            raise RuntimeError("Failure-case API status/identity did not match.")
    if type(result["status"]["id"]) is not int:
        raise RuntimeError("Invalid failure-case API status type.")
    for key in ("stdout", "compile_output"):
        if expected[key] is None:
            if result[key] is not None:
                raise RuntimeError("Incomplete or absent output must not be forwarded.")
        elif type(result[key]) is not str or base64.b64decode(result[key].replace("\n", ""), validate=True) != expected[key]:
            raise RuntimeError("Failure-case API output bytes did not match.")
    for key in ("time", "wall_time", "memory"):
        if expected[key] is None:
            if result[key] is not None:
                raise RuntimeError("Compile-only failure must not fabricate runtime metrics.")
        elif key == "memory":
            if type(result[key]) is not int or result[key] != expected[key]:
                raise RuntimeError("Failure-case API memory evidence differs.")
        elif type(result[key]) not in (str, float, int) or Decimal(str(result[key])) != Decimal(expected[key]):
            raise RuntimeError("Failure-case API timing evidence differs.")


def run_suite(journal, config, token, payloads, old_token, old_hash):
    original_host = lab.private_ip(lab.queue.API)
    lab.api.check_api(original_host, token)
    journals = {name: lab.Journal(journal.directory / name) for name in FIXTURES}
    created = create_cases(journal, journals, config, token, payloads)
    print("PASS: eight fixed API jobs created once; temporary private API removed")
    total = 1 + len(FIXTURES)
    for position, name in enumerate(FIXTURES):
        case = journals[name]
        submission_token = created[name]
        guard = lab.payload_guard(submission_token, payload=payloads[name], total=total)
        row = lab.db("SELECT json_build_object('id', id) FROM submissions WHERE status_id = 1 AND " + guard + ";")
        if type(row) is not dict or set(row) != {"id"} or type(row["id"]) is not int or row["id"] <= 0:
            raise RuntimeError("A queued failure-case record differs from its fixed payload.")
        guard += f" AND id = {row['id']}"
        pending = len(FIXTURES) - position
        raw = lab.redis(lab.PEEK, pending)
        job_id = lab.validate_message(raw, row["id"])
        case.record("CLAIM_STARTED", token=submission_token, job_id=job_id, envelope_sha256=hashlib.sha256(raw).hexdigest())
        if lab.redis(lab.CLAIM, pending, raw) != b"claimed":
            raise RuntimeError("A queue claim is uncertain; do not repeat it.")
        case.record("CLAIMED")
        lab.queue.expect_json(json.dumps(lab.db("WITH changed AS (UPDATE submissions SET status_id = 2 WHERE status_id = 1 AND "
                                             + guard + " RETURNING id) SELECT json_build_object('updated', count(*) = 1) FROM changed;", write=True)),
                              {"updated": True}, "A processing transition was not confirmed.")
        result = execute_case(case, name)
        case.record("RESULT_SAVE_STARTED")
        lab.queue.expect_json(json.dumps(lab.db(result_sql(result, guard), write=True)), {"updated": True},
                              "A failure-case result save was not confirmed; do not reexecute.")
        case.record("RESULT_SAVED")
        status, raw = lab.api.request(original_host, "GET", f"/submissions/{submission_token}?base64_encoded=true&fields={FIELDS}", token)
        if status != 200:
            raise RuntimeError("A failure-case result lookup failed; do not reexecute.")
        verify_api(raw, submission_token, result)
        case.record("COMPLETE", outcome=result["outcome"])
        print(f"PASS: {name} -> {result['outcome']}; API result and normal cleanup checked")
    if lab.redis(lab.EMPTY, 0) != b"empty" or baseline_snapshot(old_token, total) != old_hash:
        raise RuntimeError("The final queue or preserved baseline differs.")
    lab.api.check_api(original_host, token)
    journal.record("COMPLETE", cases=list(FIXTURES), baseline_sha256=old_hash)
    print("PASS: all eight cases completed; successful baseline unchanged; queue empty; maintenance remains enabled")


def main(argv=None):
    args = sys.argv[1:] if argv is None else argv
    if args or platform.system() != "Linux" or socket.gethostname() != "ingenium-judge-spike-01" or os.geteuid() != 0:
        print("FAIL: run sudo python3 -B failure-suite.py only on the isolated judge VM, without arguments.", file=sys.stderr)
        return 1
    try:
        os.umask(0o077)
        signal.signal(signal.SIGTERM, lab.interrupt)
        root = lab.RUNTIME.lstat()
        if not stat.S_ISDIR(root.st_mode) or root.st_uid != 0 or stat.S_IMODE(root.st_mode) != 0o700:
            raise RuntimeError("Unexpected private runtime directory.")
        directory = lab.RUNTIME / "failure-suite-v1"
        if directory.exists() or directory.is_symlink():
            raise RuntimeError("A failure-suite run record exists; do not delete it or rerun.")
        config, token = lab.prepare_config(private_file(lab.RUNTIME / "judge0.conf", 1000, 999, 0o400, 32768))
        payloads = fixture_payloads()
        old_token = baseline_token()
        lab.queue.check_services()
        old_hash = baseline_snapshot(old_token, 1)
        if lab.redis(lab.EMPTY, 0) != b"empty":
            raise RuntimeError("The lab queue is not idle; preserve its data.")
        if lab.run("docker", "network", "inspect", lab.NETWORK, "--format", "{{.Internal}}|{{.Driver}}") != b"true|bridge":
            raise RuntimeError("The expected internal lab network is unavailable.")
        if lab.run("docker", "image", "inspect", lab.IMAGE, "--format", "{{.Id}}|{{.Os}}|{{.Architecture}}|{{.Config.User}}") != f"{lab.IMAGE}|linux|amd64|judge0".encode("ascii"):
            raise RuntimeError("The reviewed local API image is unavailable.")
        journal = lab.Journal(directory)
        journal.record("PREPARED", fixtures=FIXTURES, baseline_token=old_token, baseline_sha256=old_hash)
        run_suite(journal, config, token, payloads, old_token, old_hash)
        return 0
    except KeyboardInterrupt:
        print("FAIL: interrupted; preserve all run records and inspect before continuing.", file=sys.stderr)
        return 130
    except RuntimeError as error:
        print(f"FAIL: {error}", file=sys.stderr)
    except (OSError, ValueError, TypeError, KeyError, AttributeError, DecimalException,
            subprocess.SubprocessError, http.client.HTTPException):
        print("FAIL: failure-suite stopped; raw credentials/diagnostics were not printed.", file=sys.stderr)
    print("Do not rerun, clear queues or delete records. Preserve /opt/ingenium-judge-spike/failure-suite-v1 and any retained sandbox resources.", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
