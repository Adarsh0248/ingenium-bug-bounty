from decimal import Decimal
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import platform
import re
import shutil
import signal
import socket
import stat
import subprocess
import sys


HERE = Path(__file__).resolve().parent


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


failure = load("profiles_baseline", HERE / "failure-suite.py")
lab = failure.lab
runtime = load("profile_runtime", HERE / "profiles" / "runtime.py")
# shortcut: synthetic parity only; provider language registration requires the supervised adapter.
CHECKPOINT = "profiles-v2"
TAG = "ingenium/judge0-spike:" + CHECKPOINT
PROFILE_ORDER = ("c", "cpp", "java", "python", "javascript")
CONTEXT_FILES = ("Dockerfile", ".dockerignore", "lock.json", "runtime.py", "limits.c",
                 "fixtures/main.c", "fixtures/main.cpp", "fixtures/Main.java", "fixtures/main.py", "fixtures/main.cjs")
SNAPSHOT_SQL = """SELECT json_build_object(
  'count', count(*), 'complete', bool_and(status_id NOT IN (1, 2) AND finished_at IS NOT NULL),
  'sha256', encode(sha256(convert_to(jsonb_agg(to_jsonb(s) ORDER BY id)::text, 'UTF8')), 'hex')
) FROM submissions s;"""


def snapshot():
    value = lab.db(SNAPSHOT_SQL)
    runtime.require(type(value) is dict and set(value) == {"count", "complete", "sha256"}
                    and type(value["count"]) is int and value["count"] == 9 and value["complete"] is True
                    and type(value["sha256"]) is str and re.fullmatch(r"[0-9a-f]{64}", value["sha256"]),
                    "Expected nine finished, preserved lab records.")
    return value["sha256"]


def completed_baseline():
    token = failure.baseline_token()
    failure.baseline_snapshot(token, 9)
    rows = [lab.decode_json(line) for line in failure.private_file(
        lab.RUNTIME / "failure-suite-v1" / "journal.jsonl", 0, 0, 0o600, 65536).splitlines()]
    runtime.require(rows and rows[-1].get("event") == "COMPLETE"
                    and rows[-1].get("cases") == list(failure.FIXTURES), "The failure-suite checkpoint is not complete.")
    runtime.require(lab.redis(lab.EMPTY, 0) == b"empty", "The lab queue is not idle; preserve its data.")
    return snapshot()


def logged(journal, name, args, timeout):
    journal.record(name.upper() + "_STARTED")
    path = journal.directory / (name + ".log")
    with path.open("xb") as stream:
        os.chmod(path, 0o600)
        result = subprocess.run(args, stdout=stream, stderr=subprocess.STDOUT, check=False, timeout=timeout)
        stream.flush()
        os.fsync(stream.fileno())
    runtime.require(result.returncode == 0 and path.stat().st_size <= 16777216,
                    name + " failed or returned oversized logs; preserve the private checkpoint.")
    journal.record(name.upper() + "_FINISHED", log_sha256=hashlib.sha256(path.read_bytes()).hexdigest())
    return path


def bundle_hash():
    contents = {name: hashlib.sha256(runtime.regular(HERE / "profiles" / name, 65536)).hexdigest() for name in CONTEXT_FILES}
    return failure.canonical_hash(contents)


def build(journal, lock, fingerprint, *, cached=False):
    for role, source in lock["images"].items():
        reference = source["image"]
        runtime.require(re.fullmatch(r"docker\.io/library/[a-z-]+:[a-zA-Z0-9._-]+@sha256:[0-9a-f]{64}", reference), "Unpinned profile source image.")
        if not cached:
            print("Fetching pinned " + role + " " + source["version"] + " image...", flush=True)
            logged(journal, "pull-" + role, ["docker", "pull", "--platform", "linux/amd64", reference], 120)
        runtime.require(lab.run("docker", "image", "inspect", reference, "--format", "{{.Os}}|{{.Architecture}}") == b"linux|amd64",
                        "A source image is not linux/amd64.")
    runtime.require(lab.run("docker", "image", "inspect", lock["legacy_image"], "--format", "{{.Os}}|{{.Architecture}}") == b"linux|amd64",
                    "The existing pinned legacy isolator image is missing; do not replace the old lab.")
    print("Building the separate five-language image without build-step network access...", flush=True)
    logged(journal, "build", ["docker", "build", "--progress=plain", "--network=none", "--pull=false", "--platform=linux/amd64",
                              "--build-arg", "BUNDLE_SHA256=" + fingerprint, "-t", TAG, str(HERE / "profiles")], 600)
    raw = lab.run("docker", "image", "inspect", TAG, "--format",
                  '{{.Id}}|{{.Os}}|{{.Architecture}}|{{.Config.User}}|{{index .Config.Labels "ingenium.lab.profiles"}}|{{index .Config.Labels "ingenium.lab.bundle"}}')
    values = raw.decode("ascii").split("|")
    runtime.require(len(values) == 6 and re.fullmatch(r"sha256:[0-9a-f]{64}", values[0])
                    and values[1:] == ["linux", "amd64", "65534:65534", "1", fingerprint], "Built profile image identity/labels differ.")
    journal.record("IMAGE_BUILT", image=values[0], bundle_sha256=fingerprint)
    return values[0]


def checked_phase(value, cpu, wall, memory, expected):
    runtime.require(type(value) is dict and set(value) == {"stdout_b64", "cpu_ns", "peak_bytes", "wall_seconds", "identity_checked"}, "Incomplete profile phase evidence.")
    for key, cap in (("cpu_ns", cpu * 1000000000), ("peak_bytes", memory)):
        runtime.require(type(value[key]) is int and 0 < value[key] <= cap, "Invalid profile phase accounting.")
    runtime.require(value["identity_checked"] is True and type(value["wall_seconds"]) is str
                    and re.fullmatch(r"[0-9]+(?:\.[0-9]+)?", value["wall_seconds"])
                    and Decimal(value["wall_seconds"]) <= wall, "Invalid identity/wall-time evidence.")
    runtime.require(failure.decode_bytes(value["stdout_b64"], 32) == expected, "Profile output bytes differ.")


def parse_log(path, lock):
    rows = runtime.regular(path, 196608).decode("ascii").splitlines()
    runtime.require(not any("FAIL:" in line for line in rows)
                    and rows.count("PASS: host test groups and temporary files removed") == 1,
                    "Profile sandbox cleanup did not complete.")
    versions = [lab.decode_json(line.removeprefix("INGENIUM_PROFILE_VERSIONS ")) for line in rows if line.startswith("INGENIUM_PROFILE_VERSIONS ")]
    results = [lab.decode_json(line.removeprefix("INGENIUM_PROFILE_RESULT ")) for line in rows if line.startswith("INGENIUM_PROFILE_RESULT ")]
    runtime.require(len(versions) == 1 and len(results) == len(PROFILE_ORDER)
                    and set(lock["profiles"]) == set(PROFILE_ORDER), "Missing/duplicate language-parity evidence.")
    runtime.validate_versions(lock, versions[0])
    # Manifest object keys are sorted on disk; the result array keeps execution order.
    for name, result in zip(PROFILE_ORDER, results):
        profile = lock["profiles"][name]
        runtime.require(type(result) is dict and set(result) == {"profile", "source_sha256", "compile", "cases"}
                        and result["profile"] == name and result["source_sha256"] == profile["sha256"], "Profile source/ordering differs.")
        if profile["compile"] is None:
            runtime.require(result["compile"] is None, "Interpreter invented a compile phase.")
        else:
            checked_phase(result["compile"], 15, 30, 1073741824, b"")
        runtime.require(type(result["cases"]) is list and len(result["cases"]) == 3, "Missing parity cases.")
        for item, (stdin, expected) in zip(result["cases"], runtime.CASES):
            runtime.require(type(item) is dict and "stdin_b64" in item, "Missing profile input identity.")
            runtime.require(failure.decode_bytes(item["stdin_b64"], 32) == stdin, "Parity input bytes differ.")
            checked_phase({key: value for key, value in item.items() if key != "stdin_b64"}, profile["cpu"], profile["wall"], 536870912, expected)
        print(f"PASS: {name} -> three exact answers, observed sandbox identity and accounted normal cleanup", flush=True)
    return versions[0], results


def run(journal, lock, fingerprint, before, *, cached=False):
    image = build(journal, lock, fingerprint, cached=cached)
    path = logged(journal, "parity", ["/bin/bash", str(HERE / "cgroup-smoke.sh"), "--profiles", image], 480)
    observations, cases = parse_log(path, lock)
    runtime.require(snapshot() == before and lab.redis(lab.EMPTY, 0) == b"empty", "Original lab records/queue changed; preserve evidence.")
    _, token = lab.prepare_config(failure.private_file(lab.RUNTIME / "judge0.conf", 1000, 999, 0o400, 32768))
    lab.api.check_api(lab.private_ip(lab.queue.API), token)
    manifest = {"schema": 1, "scope": lock["scope"], "image_id": image, "bundle_sha256": fingerprint,
                "kernel": platform.release(), "source_lock": lock, "observed": observations,
                "parity": cases, "preserved_lab_sha256": before}
    manifest_path = journal.directory / "runtime-manifest.json"
    with manifest_path.open("xb") as stream:
        stream.write(json.dumps(manifest, sort_keys=True, indent=2, allow_nan=False).encode("ascii") + b"\n")
        stream.flush()
        os.fsync(stream.fileno())
    lab.sync_directory(journal.directory)
    journal.record("COMPLETE", image=image, manifest_sha256=hashlib.sha256(manifest_path.read_bytes()).hexdigest())
    print("PASS: pinned runtime manifest saved; all nine old records unchanged; queue empty; maintenance enabled", flush=True)


def main(argv=None):
    args = sys.argv[1:] if argv is None else argv
    if args not in ([], ["--cached-images"]) or platform.system() != "Linux" or socket.gethostname() != "ingenium-judge-spike-01" or os.geteuid() != 0:
        print("FAIL: run sudo python3 -B profiles.py only on the isolated VM, optionally with --cached-images.", file=sys.stderr)
        return 1
    try:
        os.umask(0o077)
        signal.signal(signal.SIGTERM, lab.interrupt)
        root = lab.RUNTIME.lstat()
        runtime.require(root.st_uid == 0 and stat.S_ISDIR(root.st_mode) and stat.S_IMODE(root.st_mode) == 0o700, "Wrong private runtime directory.")
        directory = lab.RUNTIME / CHECKPOINT
        runtime.require(not directory.exists() and not directory.is_symlink(), "An existing profiles checkpoint forbids another run.")
        runtime.require(shutil.disk_usage("/").free >= 12 * 1024**3, "At least 12 GiB free disk is required; do not delete old evidence to make room.")
        lock = runtime.load_lock()
        fingerprint = bundle_hash()
        runtime.require(lab.run("docker", "image", "ls", "-q", TAG) == b"", "The profile image tag already exists; do not overwrite it.")
        lab.queue.check_services()
        before = completed_baseline()
        _, token = lab.prepare_config(failure.private_file(lab.RUNTIME / "judge0.conf", 1000, 999, 0o400, 32768))
        lab.api.check_api(lab.private_ip(lab.queue.API), token)
        journal = lab.Journal(directory)
        journal.record("PREPARED", bundle_sha256=fingerprint, preserved_lab_sha256=before)
        run(journal, lock, fingerprint, before, cached=args == ["--cached-images"])
        return 0
    except KeyboardInterrupt:
        print("FAIL: interrupted; preserve the profile checkpoint and any sandbox resources.", file=sys.stderr)
        return 130
    except Exception as error:
        # Fixed public build inputs only; do not print credential-bearing subprocess output.
        print("FAIL: " + str(error) if isinstance(error, RuntimeError) else "FAIL: profile preparation stopped; inspect the private logs.", file=sys.stderr)
    print("Do not rerun or clear records. Preserve " + str(lab.RUNTIME / CHECKPOINT) + " and any retained sandbox resources.", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
