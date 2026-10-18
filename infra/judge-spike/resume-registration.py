import hashlib
import importlib.util
import json
import os
from pathlib import Path
import platform
import signal
import socket
import stat
import sys


HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("registration_repair", HERE / "recovery.py")
recovery = importlib.util.module_from_spec(spec)
spec.loader.exec_module(recovery)
lab, failure, require = recovery.lab, recovery.failure, recovery.runtime.require
REPAIR = recovery.DIRECTORY / "registration-fix-v1"


def checkpoint():
    for directory in (lab.RUNTIME, recovery.DIRECTORY):
        info = directory.lstat()
        require(stat.S_ISDIR(info.st_mode) and (info.st_uid, info.st_gid, stat.S_IMODE(info.st_mode)) == (0, 0, 0o700),
                "Unexpected retained recovery directory.")
    require(not REPAIR.exists() and not REPAIR.is_symlink(), "Repair checkpoint exists; do not repeat the continuation.")
    require({path.name for path in recovery.DIRECTORY.iterdir()} == {"context.json", "journal.jsonl", "register-lost-0.json"},
            "Retained files differ from the unstarted registration failure; no continuation is allowed.")
    raw = failure.private_file(recovery.DIRECTORY / "journal.jsonl", 0, 0, 0o600, 65536)
    rows = [lab.decode_json(line) for line in raw.splitlines()]
    require([row.get("event") for row in rows] == ["PREPARED", "SCHEMA_CREATE_STARTED", "SCHEMA_CREATED"],
            "Journal progressed beyond the known registration failure or schema creation is uncertain.")
    ddl = recovery.runtime.regular(HERE / "recovery.sql", 16384)
    require(rows[1].get("schema_sha256") == hashlib.sha256(ddl).hexdigest(), "Original lab schema definition differs.")
    value, frozen = recovery.context()
    require(rows[0].get("manifest_sha256") == value["manifest_sha256"]
            and rows[0].get("preserved_lab_sha256") == frozen["preserved_lab_sha256"], "Original checkpoint binding differs.")
    reply_raw = failure.private_file(recovery.DIRECTORY / "register-lost-0.json", 0, 0, 0o600, 16384)
    reply = lab.decode_json(reply_raw)
    require(type(reply) is dict and set(reply) == {"pid", "exit_code", "stdout_b64", "oversized"}
            and type(reply["pid"]) is int and reply["pid"] > 0 and reply["exit_code"] == 73
            and reply["stdout_b64"] == "" and reply["oversized"] is False, "Original registration worker exit is not confirmed.")
    normal = recovery.binding_for(value, "normal")
    row = recovery.observe(normal)
    require(row["state"] == "PREPARED" and row["permit_count"] == 0 and row["reserved"] is True,
            "A launch permit may already be consumed; no continuation is allowed.")
    require(lab.db(f"SELECT json_build_object('count', count(*)) FROM {recovery.TABLE};") == {"count": 1},
            "Unexpected recovery rows; preserve the existing state.")
    hashes = {"original_journal_sha256": hashlib.sha256(raw).hexdigest(),
              "original_worker_reply_sha256": hashlib.sha256(reply_raw).hexdigest()}
    return value, frozen, row, hashes


def check_null_transport():
    try:
        lab.db("SELECT NULL::json;")
    except json.JSONDecodeError:
        pass
    else:
        raise RuntimeError("Unexpected SQL NULL transport; this repair does not match the failure.")
    require(lab.db("SELECT COALESCE(NULL::json, 'null'::json);") is None, "JSON null transport is still invalid.")


def main(argv=None):
    args = sys.argv[1:] if argv is None else argv
    if args or platform.system() != "Linux" or socket.gethostname() != "ingenium-judge-spike-01" or os.geteuid() != 0:
        print("FAIL: run resume-registration.py with sudo only on the isolated VM, without arguments.", file=sys.stderr)
        return 1
    try:
        os.umask(0o077)
        signal.signal(signal.SIGTERM, lab.interrupt)
        lab.queue.check_services()
        value, frozen, row, hashes = checkpoint()
        before = recovery.profiles.completed_baseline()
        require(before == frozen["preserved_lab_sha256"], "The nine original lab rows changed; preserve them.")
        _, token = lab.prepare_config(failure.private_file(lab.RUNTIME / "judge0.conf", 1000, 999, 0o400, 32768))
        lab.api.check_api(lab.private_ip(lab.queue.API), token)
        check_null_transport()
        print("PASS: SQL NULL transport reproduced; one unstarted bound record verified; no execution permit consumed", flush=True)
        journal = lab.Journal(REPAIR)
        journal.record("VERIFIED_UNSTARTED", binding=recovery.binding_for(value, "normal"), provider_id=row["provider_id"],
                       preserved_lab_sha256=before, **hashes)
        recovery.continue_registered(journal, value)
        require(lab.db(f"SELECT json_build_object('count', count(*)) FROM {recovery.TABLE};") == {"count": 2},
                "Unexpected final recovery rows.")
        require(recovery.profiles.snapshot() == before and lab.redis(lab.EMPTY, 0) == b"empty", "Old records or queue changed.")
        require(hashlib.sha256(failure.private_file(recovery.DIRECTORY / "journal.jsonl", 0, 0, 0o600, 65536)).hexdigest()
                == hashes["original_journal_sha256"], "Original failed journal changed.")
        lab.api.check_api(lab.private_ip(lab.queue.API), token)
        journal.record("COMPLETE", preserved_lab_sha256=before, uncertain_lab_reservations=1)
        print("PASS: guarded recovery continuation completed; old journal and nine records preserved; queue empty; maintenance enabled", flush=True)
        return 0
    except KeyboardInterrupt:
        print("FAIL: interrupted; preserve original/repair checkpoints and any execution resources.", file=sys.stderr)
        return 130
    except Exception as error:
        detail = str(error) if isinstance(error, RuntimeError) else type(error).__name__
        print("FAIL: " + detail + " Preserve recovery-v1, its schema and resources. Do not rerun or reset records.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
