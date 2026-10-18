import hashlib
import importlib.util
import os
from pathlib import Path
import platform
import signal
import socket
import sys


HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("crash_schema_repair", HERE / "active-crash.py")
active = importlib.util.module_from_spec(spec)
spec.loader.exec_module(active)
lab, failure, require = active.lab, active.failure, active.runtime.require


def checkpoint(before):
    active.tree.directory(active.DIRECTORY, 0o700)
    require({path.name for path in active.DIRECTORY.iterdir()} == {"context.json", "journal.jsonl"},
            "Checkpoint advanced or a repair already started; no continuation is allowed.")
    raw = failure.private_file(active.DIRECTORY / "journal.jsonl", 0, 0, 0o600, 65536)
    rows = [lab.decode_json(line) for line in raw.splitlines()]
    require(rows == [{"event": "PREPARED", "preserved": before}],
            "Not the reported unstarted schema failure, or preserved records changed.")
    value = active.context()
    require(lab.db("SELECT json_build_object('absent', NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'ingenium_active_crash_v1'));") == {"absent": True},
            "Schema may already be committed; do not retry or reset execution.")
    active.absent(value)
    hashes = {name: hashlib.sha256(failure.private_file(active.DIRECTORY / name, 0, 0, 0o600, 65536)).hexdigest()
              for name in ("context.json", "journal.jsonl")}
    require(hashes["journal.jsonl"] == hashlib.sha256(raw).hexdigest(), "Original journal changed during inspection.")
    return value, hashes


def continue_schema(before, token):
    value, hashes = checkpoint(before)
    ddl = active.runtime.regular(HERE / "active-crash.sql", 16384).decode("ascii")
    journal = lab.Journal(active.DIRECTORY / "schema-fix-v1")
    journal.record("VERIFIED_UNSTARTED", binding=value["binding"], original_sha256=hashes, preserved=before)
    journal.record("SCHEMA_CREATE_STARTED", schema_sha256=hashlib.sha256(ddl.encode("ascii")).hexdigest())
    result = lab.db(ddl, write=True)
    require(type(result) is dict and set(result) == {"created"} and result["created"] is True,
            "Schema creation is uncertain; preserve the repair checkpoint without retrying.")
    journal.record("SCHEMA_CREATED")
    print("PASS: corrected named constraints created; original unstarted context retained; no permit reset", flush=True)
    active.exercise(value, journal)
    for name, fingerprint in hashes.items():
        require(hashlib.sha256(failure.private_file(active.DIRECTORY / name, 0, 0, 0o600, 65536)).hexdigest() == fingerprint,
                "Original checkpoint changed during continuation.")
    require(active.baseline() == before and lab.db(f"SELECT json_build_object('count', count(*)) FROM {active.guard.TABLE};") == {"count": 1},
            "Existing records or new crash attempt count changed.")
    lab.queue.check_services()
    lab.api.check_api(lab.private_ip(lab.queue.API), token)
    journal.record("COMPLETE", preserved=before, original_sha256=hashes, new_provider_records=0)
    print("PASS: guarded crash continuation completed; original journal/context and ten provider rows unchanged; maintenance enabled", flush=True)


def main(argv=None):
    args = sys.argv[1:] if argv is None else argv
    if args or platform.system() != "Linux" or socket.gethostname() != "ingenium-judge-spike-01" or os.geteuid() != 0:
        print("FAIL: run resume-crash-schema.py with sudo only on the isolated VM, without arguments.", file=sys.stderr)
        return 1
    try:
        os.umask(0o077)
        signal.signal(signal.SIGTERM, lab.interrupt)
        active.tree.directory(lab.RUNTIME, 0o700)
        require(hasattr(os, "pidfd_open") and hasattr(signal, "pidfd_send_signal"), "Stable process signalling is unavailable.")
        lab.queue.check_services()
        before = active.baseline()
        _, token = lab.prepare_config(failure.private_file(lab.RUNTIME / "judge0.conf", 1000, 999, 0o400, 32768))
        lab.api.check_api(lab.private_ip(lab.queue.API), token)
        continue_schema(before, token)
        return 0
    except KeyboardInterrupt:
        print("FAIL: interrupted; preserve all active-crash resources and reservations.", file=sys.stderr)
        return 130
    except Exception as error:
        detail = str(error) if isinstance(error, RuntimeError) else type(error).__name__
        print("FAIL: " + detail + " Preserve active-crash-v1, schema-fix-v1 and the schema. Do not rerun, reset permits or force-clean resources.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
