import hashlib
import importlib.util
import os
from pathlib import Path
import platform
import re
import signal
import socket
import stat
import sys


HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("retained_evidence_repair", HERE / "recovery.py")
recovery = importlib.util.module_from_spec(spec)
spec.loader.exec_module(recovery)
lab, failure, require = recovery.lab, recovery.failure, recovery.runtime.require
REPAIR = recovery.DIRECTORY / "evidence-fix-v1"
CONTAINER = "ingenium-cg-run-icLa6c"
PARENT = "ingenium-cg-run.icLa6c"
PROFILE = "ingenium-isolate-smoke-v1"


def no_active_execution():
    require(lab.run("docker", "ps", "-a", "--filter", "name=ingenium-cg-run-", "--format", "{{.Names}}") == b"",
            "A lab sandbox container remains; preserve it without cleanup or replay.")
    with Path("/sys/kernel/security/apparmor/profiles").open("rb") as stream:
        raw_profiles = stream.read(262145)
    require(len(raw_profiles) <= 262144, "Oversized policy inventory; physical state is uncertain.")
    profiles = raw_profiles.decode("ascii")
    require(not any(line.startswith(PROFILE + " ") for line in profiles.splitlines()), "The sandbox policy is still loaded.")
    mounts = lab.run("findmnt", "-rn", "-t", "cgroup,cgroup2", "-o", "TARGET").decode("ascii").splitlines()
    require(len(mounts) == len(set(mounts)) and {"/sys/fs/cgroup/" + name for name in ("memory", "cpu,cpuacct", "pids", "cpuset", "unified")} <= set(mounts),
            "The expected controller inventory changed.")
    for name in mounts:
        require(re.fullmatch(r"/sys/fs/cgroup/[a-z_,]+", name) and Path(name).resolve() == Path(name), "Unexpected controller mount.")
        path = Path(name) / PARENT
        require(not path.exists() and not path.is_symlink(), "An old execution cgroup remains; no capacity release is allowed.")
    temporary = Path("/run") / PARENT
    require(not temporary.exists() and not temporary.is_symlink(), "Old temporary execution files remain.")
    for process in Path("/proc").iterdir():
        if not process.name.isdecimal():
            continue
        try:
            with (process / "cmdline").open("rb") as stream:
                command = stream.read(32769)
        except (FileNotFoundError, ProcessLookupError):
            continue
        require(len(command) <= 32768, "Oversized process identity; physical state is uncertain.")
        require(not any(part.rsplit(b"/", 1)[-1] in (b"recovery.py", b"resume-registration.py") for part in command.split(b"\0")),
                "An earlier recovery worker is still active; do not continue yet.")


def checkpoint():
    root = recovery.DIRECTORY
    for directory in (lab.RUNTIME, root, root / "registration-fix-v1", root / "execution"):
        info = directory.lstat()
        require(stat.S_ISDIR(info.st_mode) and (info.st_uid, info.st_gid, stat.S_IMODE(info.st_mode)) == (0, 0, 0o700),
                "Unexpected retained evidence directory.")
    require(not REPAIR.exists() and not REPAIR.is_symlink(), "Evidence repair already exists; do not repeat it.")
    require({path.name for path in root.iterdir()} == {"context.json", "journal.jsonl", "register-lost-0.json", "registration-fix-v1", "deliver-0.json", "execution"}
            and {path.name for path in (root / "execution").iterdir()} == {"journal.jsonl", "sandbox.log"}
            and {path.name for path in (root / "registration-fix-v1").iterdir()} == {"journal.jsonl"},
            "Retained files differ from the reported post-execution failure.")
    names = ("context.json", "journal.jsonl", "register-lost-0.json", "registration-fix-v1/journal.jsonl",
             "deliver-0.json", "execution/journal.jsonl", "execution/sandbox.log")
    raw = {name: failure.private_file(root / name, 0, 0, 0o600, 196608 if name.endswith(".log") else 65536) for name in names}
    journal = lambda name: [lab.decode_json(line) for line in raw[name].splitlines()]
    old, repair, execution = (journal(name) for name in ("journal.jsonl", "registration-fix-v1/journal.jsonl", "execution/journal.jsonl"))
    require([row.get("event") for row in old] == ["PREPARED", "SCHEMA_CREATE_STARTED", "SCHEMA_CREATED"]
            and [row.get("event") for row in repair] == ["VERIFIED_UNSTARTED", "REGISTRATION_RECONCILED"]
            and [row.get("event") for row in execution] == ["LAUNCH_AUTHORISED", "SANDBOX_STARTED", "SANDBOX_FINISHED"],
            "The saved execution has an unexpected stage; no result will be sealed.")
    require(old[1].get("schema_sha256") == hashlib.sha256(recovery.runtime.regular(HERE / "recovery.sql", 16384)).hexdigest(),
            "The original schema definition changed.")
    require(repair[0].get("original_journal_sha256") == hashlib.sha256(raw["journal.jsonl"]).hexdigest()
            and repair[0].get("original_worker_reply_sha256") == hashlib.sha256(raw["register-lost-0.json"]).hexdigest(),
            "The failed registration evidence changed.")
    worker = lab.decode_json(raw["deliver-0.json"])
    require(type(worker) is dict and set(worker) == {"pid", "exit_code", "stdout_b64", "oversized"}
            and type(worker["pid"]) is int and worker["pid"] > 0 and worker["exit_code"] == 1 and worker["oversized"] is False
            and b"FAIL: Profile source/ordering differs." in failure.decode_bytes(worker["stdout_b64"], 8192),
            "The worker failure is not the reproduced manifest-order checker error.")
    value, frozen = recovery.context()
    binding = recovery.binding_for(value, "normal")
    row = recovery.observe(binding)
    require(row["state"] == "STARTED" and row["permit_count"] == 1 and row["reserved"] is True
            and lab.db(f"SELECT json_build_object('count', count(*)) FROM {recovery.TABLE};") == {"count": 1},
            "The original consumed permit or record count differs.")
    require(execution[0].get("binding") == repair[0].get("binding") == binding
            and execution[0].get("owner_id") == row["owner_id"] and execution[0].get("image_id") == frozen["image_id"]
            and repair[0].get("provider_id") == repair[1].get("provider_id") == row["provider_id"]
            and old[0].get("manifest_sha256") == value["manifest_sha256"]
            and old[0].get("preserved_lab_sha256") == repair[0].get("preserved_lab_sha256") == frozen["preserved_lab_sha256"],
            "Retained execution/owner/provider identity does not match the immutable binding.")
    require(execution[-1].get("log_sha256") == hashlib.sha256(raw["execution/sandbox.log"]).hexdigest()
            and raw["execution/sandbox.log"].splitlines().count(CONTAINER.encode("ascii")) == 1,
            "The completed sandbox log or reported container identity differs.")
    evidence = recovery.execution_evidence(binding, row["owner_id"], frozen, root / "execution/sandbox.log")
    no_active_execution()
    return value, frozen, row, evidence, {name: hashlib.sha256(contents).hexdigest() for name, contents in raw.items()}


def main(argv=None):
    args = sys.argv[1:] if argv is None else argv
    if args or platform.system() != "Linux" or socket.gethostname() != "ingenium-judge-spike-01" or os.geteuid() != 0:
        print("FAIL: run seal-retained.py with sudo only on the isolated VM, without arguments.", file=sys.stderr)
        return 1
    try:
        os.umask(0o077)
        signal.signal(signal.SIGTERM, lab.interrupt)
        lab.queue.check_services()
        value, frozen, row, evidence, hashes = checkpoint()
        before = recovery.profiles.completed_baseline()
        require(before == frozen["preserved_lab_sha256"], "The nine old records changed; retain all evidence.")
        _, token = lab.prepare_config(failure.private_file(lab.RUNTIME / "judge0.conf", 1000, 999, 0o400, 32768))
        lab.api.check_api(lab.private_ip(lab.queue.API), token)
        journal = lab.Journal(REPAIR)
        journal.record("VERIFIED_COMPLETED_EXECUTION", binding=evidence["binding"], owner_id=row["owner_id"],
                       provider_id=row["provider_id"], original_file_sha256=hashes, preserved_lab_sha256=before)
        fingerprint = recovery.private_json(recovery.DIRECTORY / "execution/evidence.json", evidence)
        journal.record("EVIDENCE_SAVED", evidence_sha256=fingerprint)
        print("PASS: all fifteen saved answers and normal cleanup verified; evidence reconstructed without rerunning fixtures", flush=True)
        recovery.children("--duplicate-only", 4, [0, 0, 0, 0])
        print("PASS: four duplicate-only worker processes refused the consumed permit; none can launch code", flush=True)
        journal.record("SEAL_STARTED", evidence_sha256=fingerprint)
        recovery.children("--seal-saved", 1, [75])
        recovery.finish_delivered(journal, value, row["provider_id"])
        require(lab.db(f"SELECT json_build_object('count', count(*)) FROM {recovery.TABLE};") == {"count": 2}
                and recovery.profiles.snapshot() == before and lab.redis(lab.EMPTY, 0) == b"empty", "Old records, queue or final recovery rows differ.")
        for name, fingerprint in hashes.items():
            raw = failure.private_file(recovery.DIRECTORY / name, 0, 0, 0o600, 196608 if name.endswith(".log") else 65536)
            require(hashlib.sha256(raw).hexdigest() == fingerprint, "An original evidence file changed.")
        no_active_execution()
        lab.api.check_api(lab.private_ip(lab.queue.API), token)
        journal.record("COMPLETE", preserved_lab_sha256=before, uncertain_lab_reservations=1, new_sandbox_launches=0)
        print("PASS: retained execution sealed with no new sandbox launch; old evidence and nine records preserved; queue empty; maintenance enabled", flush=True)
        return 0
    except KeyboardInterrupt:
        print("FAIL: interrupted; preserve all original and evidence-repair checkpoints.", file=sys.stderr)
        return 130
    except Exception as error:
        detail = str(error) if isinstance(error, RuntimeError) else type(error).__name__
        print("FAIL: " + detail + " Preserve recovery-v1, schema and resources. Do not retry or reset any permit.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
