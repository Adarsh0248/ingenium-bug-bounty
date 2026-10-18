import base64
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
import time
import uuid

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("recovery_profiles", HERE / "profiles.py")
profiles = importlib.util.module_from_spec(spec)
spec.loader.exec_module(profiles)
lab, runtime, failure = profiles.lab, profiles.runtime, profiles.failure
DIRECTORY = lab.RUNTIME / "recovery-v1"
TABLE = "ingenium_recovery_v1.attempts"
# shortcut: fixed profile-batch lab only; Judge0 HTTP association and host retirement are not implemented here.
SCOPE = "synthetic-profile-batch-recovery-v1"
BINDING = ("attempt_id", "host_epoch", "payload_sha256", "manifest_sha256")


def uuid_value(value):
    runtime.require(type(value) is str and str(uuid.UUID(value)) == value and uuid.UUID(value).version == 4,
                    "Invalid fixed recovery identity.")
    return value


def digest(value):
    runtime.require(type(value) is str and re.fullmatch(r"[0-9a-f]{64}", value), "Invalid recovery fingerprint.")
    return value


def where(binding):
    runtime.require(type(binding) is dict and set(binding) == set(BINDING), "Unexpected execution binding fields.")
    for key, value in binding.items():
        (uuid_value if key.endswith("_id") or key == "host_epoch" else digest)(value)
    return " AND ".join(f"{key} = '{binding[key]}'" for key in BINDING)


def register(binding):
    where(binding)
    columns = ", ".join(BINDING)
    values = ", ".join("'" + binding[key] + "'" for key in BINDING)
    match = " AND ".join(f"a.{key} = EXCLUDED.{key}" for key in BINDING)
    row = lab.db(f"WITH saved AS (INSERT INTO {TABLE} AS a ({columns}) VALUES ({values}) "
                 f"ON CONFLICT (attempt_id) DO UPDATE SET attempt_id = a.attempt_id WHERE {match} "
                 "RETURNING provider_id) SELECT COALESCE((SELECT json_build_object('provider_id', provider_id) FROM saved), 'null'::json);", write=True)
    if row is None:
        return None
    runtime.require(type(row) is dict and set(row) == {"provider_id"}, "Attempt already has a different immutable binding.")
    return uuid_value(row["provider_id"])


def claim(binding, owner):
    guard = where(binding)
    uuid_value(owner)
    value = lab.db(f"WITH changed AS (UPDATE {TABLE} SET state = 'STARTED', owner_id = '{owner}', "
                   "permit_count = 1, started_at = clock_timestamp() "
                   f"WHERE {guard} AND state = 'PREPARED' RETURNING provider_id) "
                   "SELECT json_build_object('granted', count(*) = 1) FROM changed;", write=True)
    runtime.require(type(value) is dict and set(value) == {"granted"} and type(value["granted"]) is bool,
                    "Uncertain permit reply; do not launch or retry execution.")
    return value["granted"]


def observe(binding):
    value = lab.db(f"SELECT json_build_object('provider_id', provider_id, 'state', state, 'owner_id', owner_id, "
                   "'permit_count', permit_count, 'reserved', state <> 'SEALED', 'evidence_sha256', evidence_sha256) "
                   f"FROM {TABLE} WHERE {where(binding)};")
    runtime.require(type(value) is dict and set(value) == {"provider_id", "state", "owner_id", "permit_count", "reserved", "evidence_sha256"},
                    "Missing or ambiguous owned recovery record.")
    uuid_value(value["provider_id"])
    state = value["state"]
    runtime.require(state in ("PREPARED", "STARTED", "SEALED") and type(value["permit_count"]) is int
                    and value["permit_count"] == (0 if state == "PREPARED" else 1)
                    and type(value["reserved"]) is bool and value["reserved"] == (state != "SEALED"),
                    "Inconsistent durable permit/reservation.")
    if state == "PREPARED":
        runtime.require(value["owner_id"] is None, "Unstarted execution has an owner.")
    else:
        uuid_value(value["owner_id"])
    if state == "SEALED":
        digest(value["evidence_sha256"])
    else:
        runtime.require(value["evidence_sha256"] is None, "Unsealed execution has invented evidence.")
    return value


def seal(binding, owner, evidence_sha256):
    uuid_value(owner)
    digest(evidence_sha256)
    result = lab.db(f"WITH changed AS (UPDATE {TABLE} SET state = 'SEALED', "
                    f"evidence_sha256 = '{evidence_sha256}', sealed_at = clock_timestamp() "
                    f"WHERE {where(binding)} AND state = 'STARTED' AND owner_id = '{owner}' RETURNING provider_id) "
                    "SELECT json_build_object('sealed', count(*) = 1) FROM changed;", write=True)
    runtime.require(type(result) is dict and set(result) == {"sealed"} and result["sealed"] is True,
                    "Result seal unconfirmed; observe the same record, never rerun.")


def private_json(path, value):
    raw = json.dumps(value, sort_keys=True, indent=2, allow_nan=False).encode("ascii") + b"\n"
    runtime.require(len(raw) <= 65536, "Oversized fixed recovery evidence.")
    with path.open("xb") as stream:
        os.fchmod(stream.fileno(), 0o600)
        stream.write(raw)
        stream.flush()
        os.fsync(stream.fileno())
    lab.sync_directory(path.parent)
    return hashlib.sha256(raw).hexdigest()


def manifest():
    directory = lab.RUNTIME / "profiles-v2"
    rows = [lab.decode_json(line) for line in failure.private_file(directory / "journal.jsonl", 0, 0, 0o600, 65536).splitlines()]
    raw = failure.private_file(directory / "runtime-manifest.json", 0, 0, 0o600, 65536)
    value = lab.decode_json(raw)
    fingerprint = hashlib.sha256(raw).hexdigest()
    runtime.require(rows and rows[-1].get("event") == "COMPLETE" and rows[-1].get("manifest_sha256") == fingerprint,
                    "Five-language checkpoint is not complete or its manifest changed.")
    runtime.require(type(value) is dict and value.get("scope") == "synthetic-profile-parity-only"
                    and value.get("schema") == 1 and value.get("source_lock") == runtime.load_lock()
                    and value.get("bundle_sha256") == profiles.bundle_hash()
                    and value.get("kernel") == platform.release(), "Frozen profile/kernel identity differs.")
    runtime.validate_versions(value["source_lock"], value["observed"])
    image = value["image_id"]
    runtime.require(type(image) is str and re.fullmatch(r"sha256:[0-9a-f]{64}", image), "Invalid cached image identity.")
    expected = f'{image}|linux|amd64|65534:65534|1|{value["bundle_sha256"]}'.encode("ascii")
    runtime.require(lab.run("docker", "image", "inspect", image, "--format",
                           '{{.Id}}|{{.Os}}|{{.Architecture}}|{{.Config.User}}|{{index .Config.Labels "ingenium.lab.profiles"}}|{{index .Config.Labels "ingenium.lab.bundle"}}') == expected,
                    "The completed cached runtime image is missing or changed; do not pull/build a replacement.")
    return value, fingerprint


def context():
    value = lab.decode_json(failure.private_file(DIRECTORY / "context.json", 0, 0, 0o600, 65536))
    frozen, fingerprint = manifest()
    runtime.require(type(value) is dict and set(value) == {"scope", "host_epoch", "manifest_sha256", "payload_sha256", "attempts"}
                    and value["scope"] == SCOPE and value["manifest_sha256"] == fingerprint
                    and value["host_epoch"] == Path("/proc/sys/kernel/random/boot_id").read_text().strip(),
                    "Wrong recovery context or host boot; no execution is authorised.")
    uuid_value(value["host_epoch"])
    runtime.require(type(value["attempts"]) is dict and set(value["attempts"]) == {"normal", "crash"}
                    and len(set(value["attempts"].values())) == 2, "Invalid fixed recovery cases.")
    for attempt in value["attempts"].values():
        uuid_value(attempt)
    payload = {"scope": SCOPE, "image_id": frozen["image_id"], "manifest_sha256": fingerprint,
               "helper_sha256": hashlib.sha256(runtime.regular(HERE / "cgroup-smoke.sh", 65536)).hexdigest()}
    runtime.require(value["payload_sha256"] == failure.canonical_hash(payload), "Changed fixed recovery payload.")
    return value, frozen


def binding_for(value, name):
    return {"attempt_id": value["attempts"][name], **{key: value[key] for key in BINDING if key != "attempt_id"}}


def execution_evidence(binding, owner, frozen, path):
    observed, results = profiles.parse_log(path, frozen["source_lock"])
    runtime.require(observed == frozen["observed"], "Runtime binaries differ from the frozen manifest.")
    return {"scope": SCOPE, "binding": binding, "owner_id": owner, "image_id": frozen["image_id"],
            "sandbox_log_sha256": hashlib.sha256(path.read_bytes()).hexdigest(), "parity": results,
            "normal_cleanup_verified": True}


def deliver(binding, frozen):
    owner = str(uuid.uuid4())
    if not claim(binding, owner):
        return {"launched": False}
    # Only a positively acknowledged atomic claim can reach the sandbox launcher.
    journal = lab.Journal(DIRECTORY / "execution")
    journal.record("LAUNCH_AUTHORISED", binding=binding, owner_id=owner, image_id=frozen["image_id"])
    path = profiles.logged(journal, "sandbox", ["/bin/bash", str(HERE / "cgroup-smoke.sh"), "--profiles", frozen["image_id"]], 480)
    evidence = execution_evidence(binding, owner, frozen, path)
    fingerprint = private_json(journal.directory / "evidence.json", evidence)
    journal.record("EVIDENCE_SAVED", evidence_sha256=fingerprint)
    seal(binding, owner, fingerprint)
    journal.record("SEALED", evidence_sha256=fingerprint)
    return {"launched": True}


def child(mode):
    value, frozen = context()
    binding = binding_for(value, "crash" if mode == "--claim-lost" else "normal")
    if mode == "--register-lost":
        runtime.require(register(binding) is not None, "Registration binding did not match.")
        os._exit(73)  # Drop the committed registration acknowledgement.
    if mode == "--claim-lost":
        runtime.require(claim(binding, str(uuid.uuid4())), "Crash fixture permit was already consumed.")
        os._exit(74)  # No launch: successor still cannot assume the permit is reusable.
    if mode == "--seal-saved":
        row = observe(binding)
        runtime.require(row["state"] == "STARTED", "Saved-result record is not awaiting a seal.")
        path = DIRECTORY / "execution"
        raw = failure.private_file(path / "evidence.json", 0, 0, 0o600, 65536)
        runtime.require(lab.decode_json(raw) == execution_evidence(binding, row["owner_id"], frozen, path / "sandbox.log"),
                        "Saved evidence differs from the retained execution.")
        seal(binding, row["owner_id"], hashlib.sha256(raw).hexdigest())
        os._exit(75)  # Drop only the seal acknowledgement; this mode cannot launch code.
    if mode in ("--deliver", "--duplicate-only"):
        runtime.require(sys.stdin.buffer.readline(4) == b"go\n", "Missing bounded worker start barrier.")
        if mode == "--duplicate-only":
            runtime.require(observe(binding)["state"] in ("STARTED", "SEALED"), "Duplicate-only probe requires a consumed permit.")
            runtime.require(not claim(binding, str(uuid.uuid4())), "Duplicate-only probe obtained an unexpected permit; do not launch.")
            result = {"launched": False}
        else:
            result = deliver(binding, frozen)
        if result["launched"]:
            os._exit(75)  # Drop the seal reply after real execution and completed cleanup.
        print(json.dumps(result), flush=True)
        return 0
    raise RuntimeError("Unknown fixed recovery child mode.")


def children(mode, count, expected):
    workers = []
    for _ in range(count):
        workers.append(subprocess.Popen([sys.executable, "-B", str(HERE / "recovery.py"), mode],
                                        stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.STDOUT))
    if mode in ("--deliver", "--duplicate-only"):
        for worker in workers:
            worker.stdin.write(b"go\n")
            worker.stdin.flush()
    for worker in workers:
        worker.stdin.close()
    deadline = time.monotonic() + (540 if mode == "--deliver" else 45)
    statuses = []
    for index, worker in enumerate(workers):
        status = worker.wait(timeout=max(1, deadline - time.monotonic()))
        raw = worker.stdout.read(8193)
        private_json(DIRECTORY / (mode.removeprefix("--") + f"-{index}.json"),
                     {"pid": worker.pid, "exit_code": status, "stdout_b64": base64.b64encode(raw).decode("ascii"),
                      "oversized": len(raw) > 8192})
        runtime.require(len(raw) <= 8192, "Oversized recovery worker response; preserve evidence.")
        if status == 0:
            runtime.require(lab.decode_json(raw) == {"launched": False}, "Unexpected duplicate-delivery response.")
        else:
            runtime.require(raw == b"" or status == 75, "A recovery worker failed; inspect its private checkpoint.")
        statuses.append(status)
    runtime.require(sorted(statuses) == sorted(expected), "Unexpected recovery worker exits; do not redeliver.")


def forbidden_change(sql):
    # The inner exception block rolls back even an unexpectedly accepted mutation.
    probe = ("\\set QUIET on\nDO $probe$ BEGIN BEGIN " + sql
             + "; RAISE EXCEPTION 'Forbidden mutation accepted' USING ERRCODE = 'P0002'; "
             "EXCEPTION WHEN check_violation OR raise_exception THEN NULL; END; END; $probe$; "
             "SELECT json_build_object('rejected', true);")
    runtime.require(lab.db(probe, write=True) == {"rejected": True}, "Database transition guard failed.")


def exercise(journal, value, frozen):
    children("--register-lost", 1, [73])
    continue_registered(journal, value)


def continue_registered(journal, value):
    normal = binding_for(value, "normal")
    first = observe(normal)
    runtime.require(first["state"] == "PREPARED" and register(normal) == first["provider_id"], "Lost registration reply was not reconciled.")
    for key in ("host_epoch", "payload_sha256", "manifest_sha256"):
        wrong = dict(normal, **{key: str(uuid.uuid4()) if key == "host_epoch" else "0" * 64})
        runtime.require(register(wrong) is None, "A mismatched registration binding was accepted.")
        runtime.require(not claim(wrong, str(uuid.uuid4())), "A mismatched binding obtained a launch permit.")
    journal.record("REGISTRATION_RECONCILED", provider_id=first["provider_id"])
    print("PASS: lost registration acknowledgement reconciled to one bound lab record; mismatches rejected", flush=True)
    children("--deliver", 4, [75, 0, 0, 0])
    finish_delivered(journal, value, first["provider_id"])


def finish_delivered(journal, value, provider_id):
    normal, crash = (binding_for(value, name) for name in ("normal", "crash"))
    row = observe(normal)
    raw = failure.private_file(DIRECTORY / "execution" / "evidence.json", 0, 0, 0o600, 65536)
    evidence = lab.decode_json(raw)
    runtime.require(row["state"] == "SEALED" and not row["reserved"]
                    and row["provider_id"] == provider_id
                    and row["evidence_sha256"] == hashlib.sha256(raw).hexdigest()
                    and evidence["binding"] == normal and evidence["owner_id"] == row["owner_id"]
                    and evidence["normal_cleanup_verified"] is True, "Sealed result/cleanup association differs.")
    runtime.require(not claim(normal, str(uuid.uuid4())), "Sealed execution was replayed.")
    try:
        seal(normal, str(uuid.uuid4()), "0" * 64)
    except RuntimeError:
        pass
    else:
        raise RuntimeError("Sealed evidence was replaceable.")
    for sql in (f"UPDATE {TABLE} SET state = 'PREPARED', owner_id = NULL, permit_count = 0, "
                f"started_at = NULL, sealed_at = NULL, evidence_sha256 = NULL WHERE {where(normal)}",
                f"UPDATE {TABLE} SET payload_sha256 = '{'0' * 64}' WHERE {where(normal)}",
                f"DELETE FROM {TABLE} WHERE {where(normal)}"):
        forbidden_change(sql)
    runtime.require(observe(normal) == row, "Forbidden mutation changed the sealed evidence.")
    journal.record("NORMAL_RECONCILED", evidence_sha256=row["evidence_sha256"])
    print("PASS: one consumed permit is bound to all five profile results and normal cleanup", flush=True)
    print("PASS: lost seal acknowledgement recovered the same evidence without another launch; stale seal rejected", flush=True)
    runtime.require(register(crash) is not None, "Crash-fixture binding did not match.")
    children("--claim-lost", 1, [74])
    row = observe(crash)
    runtime.require(row["state"] == "STARTED" and row["reserved"] and row["permit_count"] == 1
                    and not claim(crash, str(uuid.uuid4())), "Uncertain permit was reused or its reservation released.")
    try:
        seal(crash, str(uuid.uuid4()), "0" * 64)
    except RuntimeError:
        pass
    else:
        raise RuntimeError("Another owner sealed uncertain work.")
    runtime.require(observe(crash) == row, "Stale owner changed the uncertain execution.")
    journal.record("CRASH_RESERVATION_RETAINED", binding=crash)
    print("PASS: worker exited after permit commit; replacement cannot relaunch and the uncertain reservation stays held", flush=True)


def main(argv=None):
    args = sys.argv[1:] if argv is None else argv
    if args not in ([], ["--register-lost"], ["--claim-lost"], ["--deliver"], ["--seal-saved"], ["--duplicate-only"]) or platform.system() != "Linux" or socket.gethostname() != "ingenium-judge-spike-01" or os.geteuid() != 0:
        print("FAIL: run recovery.py only with sudo on the isolated VM in a fixed lab mode.", file=sys.stderr)
        return 1
    try:
        os.umask(0o077)
        signal.signal(signal.SIGTERM, lab.interrupt)
        root = lab.RUNTIME.lstat()
        runtime.require(stat.S_ISDIR(root.st_mode) and root.st_uid == 0 and stat.S_IMODE(root.st_mode) == 0o700,
                        "Unexpected private lab directory.")
        if args:
            return child(args[0])
        runtime.require(not DIRECTORY.exists() and not DIRECTORY.is_symlink(), "Recovery checkpoint exists; do not rerun or remove it.")
        lab.queue.check_services()
        frozen, fingerprint = manifest()
        before = profiles.completed_baseline()
        runtime.require(frozen["preserved_lab_sha256"] == before, "Original nine lab records changed.")
        runtime.require(lab.db("SELECT json_build_object('absent', NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'ingenium_recovery_v1')); ") == {"absent": True},
                        "Recovery schema exists; do not reset it.")
        _, token = lab.prepare_config(failure.private_file(lab.RUNTIME / "judge0.conf", 1000, 999, 0o400, 32768))
        lab.api.check_api(lab.private_ip(lab.queue.API), token)
        payload = {"scope": SCOPE, "image_id": frozen["image_id"], "manifest_sha256": fingerprint,
                   "helper_sha256": hashlib.sha256(runtime.regular(HERE / "cgroup-smoke.sh", 65536)).hexdigest()}
        value = {"scope": SCOPE, "host_epoch": uuid_value(Path("/proc/sys/kernel/random/boot_id").read_text().strip()),
                 "manifest_sha256": fingerprint, "payload_sha256": failure.canonical_hash(payload),
                 "attempts": {"normal": str(uuid.uuid4()), "crash": str(uuid.uuid4())}}
        journal = lab.Journal(DIRECTORY)
        journal.record("PREPARED", preserved_lab_sha256=before, manifest_sha256=fingerprint)
        private_json(DIRECTORY / "context.json", value)
        ddl = runtime.regular(HERE / "recovery.sql", 16384).decode("ascii")
        journal.record("SCHEMA_CREATE_STARTED", schema_sha256=hashlib.sha256(ddl.encode("ascii")).hexdigest())
        runtime.require(lab.db(ddl, write=True) == {"created": True}, "Schema creation reply uncertain; preserve the checkpoint.")
        journal.record("SCHEMA_CREATED")
        exercise(journal, value, frozen)
        runtime.require(lab.db(f"SELECT json_build_object('count', count(*)) FROM {TABLE};") == {"count": 2}, "Unexpected recovery record count.")
        runtime.require(profiles.snapshot() == before and lab.redis(lab.EMPTY, 0) == b"empty", "Old records or queue changed.")
        lab.api.check_api(lab.private_ip(lab.queue.API), token)
        journal.record("COMPLETE", preserved_lab_sha256=before, uncertain_lab_reservations=1)
        print("PASS: recovery checkpoint saved; nine old records unchanged; queue empty; maintenance enabled", flush=True)
        return 0
    except KeyboardInterrupt:
        print("FAIL: interrupted; retain recovery records and any execution resources.", file=sys.stderr)
        return 130
    except Exception as error:
        detail = str(error) if isinstance(error, RuntimeError) else type(error).__name__
        print("FAIL: " + detail + " Preserve recovery-v1, its schema and any retained sandbox resources. Do not rerun or reset records.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
