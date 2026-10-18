import hashlib
import importlib.util
import os
from pathlib import Path
import platform
import signal
import socket
import sys


HERE = Path(__file__).resolve().parent


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


active = load("streams_previous_lab", HERE / "active-crash.py")
lab, profiles, guard = active.lab, active.profiles, active.guard
capture = load("streams_host_capture", HERE / "streams/capture.py")
cases = load("streams_host_cases", HERE / "streams/cases.py")
bundle = load("streams_host_bundle", HERE / "streams/bundle.py")
require = capture.require
OLD_DIRECTORY = lab.RUNTIME / "streams-v1"
DIRECTORY = lab.RUNTIME / "streams-v2"
RETAINED_NAME = "ingenium-cg-run.w7KHlq"
RETAINED_CONTAINER = "ingenium-cg-run-w7KHlq"


def baseline():
    previous = active.baseline()
    journal = [lab.decode_json(line) for line in active.failure.private_file(
        active.DIRECTORY / "schema-fix-v1/journal.jsonl", 0, 0, 0o600, 65536).splitlines()]
    require(journal and journal[-1].get("event") == "COMPLETE" and journal[-1].get("preserved") == previous,
            "Active crash continuation is not complete or its old records changed.")
    hashes = journal[-1]["original_sha256"]
    require(type(hashes) is dict and set(hashes) == {"context.json", "journal.jsonl"}, "Missing original crash checkpoint hashes.")
    for name, fingerprint in hashes.items():
        require(hashlib.sha256(active.failure.private_file(active.DIRECTORY / name, 0, 0, 0o600, 65536)).hexdigest() == fingerprint,
                "Original active-crash checkpoint changed.")
    proof = active.failure.private_file(active.DIRECTORY / "drain-evidence.json", 0, 0, 0o600, 65536)
    snapshot = lab.db("SELECT json_build_object('count', count(*), "
                      "'drained', bool_and(state = 'STARTED' AND permit_count = 1 AND drained_at IS NOT NULL "
                      f"AND drain_sha256 = '{hashlib.sha256(proof).hexdigest()}'), "
                      "'sha256', encode(sha256(convert_to(jsonb_agg(to_jsonb(a) ORDER BY attempt_id)::text, 'UTF8')), 'hex')) "
                      "FROM ingenium_active_crash_v1.attempts a;")
    require(type(snapshot) is dict and snapshot.get("count") == 1 and snapshot.get("drained") is True,
            "Prior crash permit/drain proof differs; never reset it.")
    return {"previous": previous, "active_crash": snapshot,
            "crash_journal_sha256": hashlib.sha256(active.failure.private_file(
                active.DIRECTORY / "schema-fix-v1/journal.jsonl", 0, 0, 0o600, 65536)).hexdigest()}


def failed_hashes():
    return {name: hashlib.sha256(active.failure.private_file(OLD_DIRECTORY / name, 0, 0, 0o600, 262144)).hexdigest()
            for name in ("journal.jsonl", "streams.log")}


def cleaned_failure(before):
    active.tree.directory(OLD_DIRECTORY / "cleanup-v1", 0o700)
    raw = active.failure.private_file(OLD_DIRECTORY / "cleanup-v1/journal.jsonl", 0, 0, 0o600, 65536)
    rows = [lab.decode_json(line) for line in raw.splitlines()]
    require([row.get("event") for row in rows] == ["VERIFIED_EMPTY", "CONTAINER_REMOVED", "PROFILE_REMOVED", "COMPLETE", "READY_FOR_CORRECTED_SUITE"],
            "Failed stream probe cleanup is incomplete; do not execute another suite.")
    ready = rows[-1]
    require(ready.get("preserved") == before and ready.get("old_sha256") == failed_hashes()
            and ready.get("parent") == "/" + RETAINED_NAME and ready.get("container") == RETAINED_CONTAINER
            and ready.get("host_epoch") == Path("/proc/sys/kernel/random/boot_id").read_text().strip(),
            "Old evidence, cleanup binding or host boot changed.")
    roots = active.roots()
    require(ready.get("controllers") == sorted(str(root) for root in roots)
            and not any(os.path.lexists(root / RETAINED_NAME) for root in roots)
            and not os.path.lexists(Path("/run") / RETAINED_NAME)
            and lab.run("docker", "ps", "-aq", "--filter", "name=^/" + RETAINED_CONTAINER + "$") == b""
            and not any(line.startswith(active.PROFILE + " ") for line in Path("/sys/kernel/security/apparmor/profiles").read_text().splitlines()),
            "An old owned resource/profile remains; corrected execution is blocked.")
    return hashlib.sha256(raw).hexdigest()


def record_for(kind, raw):
    value = capture.Capture(kind)
    for offset in range(0, len(raw), 65536):
        value.feed(raw[offset:offset + 65536])
    value.eof = True
    return value.record()


def checked_phase(value, profile, *, compiling, index=0):
    require(type(value) is dict and set(value) == {"cpu_ns", "peak_bytes", "wall_seconds", "identity_checked", "captures", "verdicts", "cleanup"}
            and value["cleanup"] is True, "Missing stream phase/cleanup evidence.")
    cpu, wall, memory = (15, 30, 1073741824) if compiling else (profile["cpu"], profile["wall"], 536870912)
    profiles.checked_phase({key: value[key] for key in ("cpu_ns", "peak_bytes", "wall_seconds", "identity_checked")}
                           | {"stdout_b64": ""}, cpu, wall, memory, b"")
    if compiling:
        wanted = {"compiler": capture.summary(record_for("compiler", b""))}
        verdicts = None
    else:
        out, err = cases.output(index)
        record = record_for("stdout", out)
        wanted = {"stdout": capture.summary(record), "stderr": capture.summary(record_for("stderr", err))}
        verdicts = {mode: capture.check(record, cases.expected(index), mode) for mode in ("tokens", "exact")}
    require(type(value["captures"]) is dict and set(value["captures"]) == set(wanted), "Missing/mixed stream channels.")
    for kind, summary in wanted.items():
        actual = value["captures"][kind]
        require(type(actual) is dict and set(actual) == set(summary)
                and all(type(actual[key]) is type(expected) and actual[key] == expected for key, expected in summary.items()),
                "Stream counts/digests or completion types differ.")
    require(value["verdicts"] == verdicts, "Stream checker verdicts differ.")


def parse_log(path, frozen, fingerprint):
    lines = active.runtime.regular(path, 262144).decode("ascii").splitlines()
    require(not any("FAIL:" in line for line in lines)
            and lines.count("PASS: host test groups and temporary files removed") == 1
            and lines.count("PASS: fifty fixed stream cases completed with EOF, exact bytes, identities and normal cleanup") == 1,
            "Stream suite or owned cleanup did not complete.")
    versions = [lab.decode_json(line[len("INGENIUM_STREAM_VERSIONS "):]) for line in lines if line.startswith("INGENIUM_STREAM_VERSIONS ")]
    results = [lab.decode_json(line[len("INGENIUM_STREAM_RESULT "):]) for line in lines if line.startswith("INGENIUM_STREAM_RESULT ")]
    require(versions == [frozen["observed"]] and len(results) == 5, "Stream runtime binary identity/profile count differs.")
    for name, result in zip(profiles.PROFILE_ORDER, results):
        profile = frozen["source_lock"]["profiles"][name]
        require(type(result) is dict and set(result) == {"profile", "bundle_sha256", "source_sha256", "compile", "cases"}
                and result["profile"] == name and result["bundle_sha256"] == fingerprint
                and result["source_sha256"] == hashlib.sha256((HERE / "streams/fixtures" / profile["source"]).read_bytes()).hexdigest(),
                "Stream profile/source/bundle identity differs.")
        if profile["compile"]:
            checked_phase(result["compile"], profile, compiling=True)
        else:
            require(result["compile"] is None, "Interpreter invented compilation evidence.")
        require(type(result["cases"]) is list and len(result["cases"]) == len(cases.CASES), "Missing fixed stream cases.")
        for index, value in enumerate(result["cases"]):
            checked_phase(value, profile, compiling=False, index=index)
        print(f"PASS: {name} -> ten stream/checker cases, bounded retention, EOF, identity and cleanup verified", flush=True)
    return results


def main(argv=None):
    args = sys.argv[1:] if argv is None else argv
    if args or platform.system() != "Linux" or socket.gethostname() != "ingenium-judge-spike-01" or os.geteuid() != 0:
        print("FAIL: run streams.py with sudo only on the isolated VM, without arguments.", file=sys.stderr)
        return 1
    try:
        os.umask(0o077)
        signal.signal(signal.SIGTERM, lab.interrupt)
        active.tree.directory(lab.RUNTIME, 0o700)
        require(not os.path.lexists(DIRECTORY), "Stream checkpoint exists; do not rerun or remove it.")
        lab.queue.check_services()
        before = baseline()
        cleanup_sha = cleaned_failure(before)
        frozen, manifest_sha = guard.manifest()
        fingerprint = bundle.fingerprint()
        helpers = {name: hashlib.sha256(active.runtime.regular(HERE / name, 65536)).hexdigest()
                   for name in ("cgroup-smoke.sh", "namespace-smoke.apparmor")}
        boot = Path("/proc/sys/kernel/random/boot_id").read_text().strip()
        _, token = lab.prepare_config(active.failure.private_file(lab.RUNTIME / "judge0.conf", 1000, 999, 0o400, 32768))
        lab.api.check_api(lab.private_ip(lab.queue.API), token)
        journal = lab.Journal(DIRECTORY)
        journal.record("PREPARED", preserved=before, image_id=frozen["image_id"], manifest_sha256=manifest_sha,
                       bundle_sha256=fingerprint, helpers_sha256=helpers, host_epoch=boot, checker_version=capture.CHECKER_VERSION,
                       previous_cleanup_sha256=cleanup_sha)
        path = profiles.logged(journal, "streams", ["/bin/bash", str(HERE / "cgroup-smoke.sh"), "--streams", frozen["image_id"], fingerprint], 480)
        results = parse_log(path, frozen, fingerprint)
        require(bundle.fingerprint() == fingerprint and all(hashlib.sha256(active.runtime.regular(HERE / name, 65536)).hexdigest() == value
                for name, value in helpers.items()) and Path("/proc/sys/kernel/random/boot_id").read_text().strip() == boot,
                "Trusted suite, helper or host epoch changed during execution.")
        require(baseline() == before and cleaned_failure(before) == cleanup_sha, "Existing records or earlier evidence changed.")
        lab.queue.check_services()
        lab.api.check_api(lab.private_ip(lab.queue.API), token)
        evidence_sha = guard.private_json(DIRECTORY / "evidence.json", {"scope": "trusted-fixed-stream-suite-v2", "host_epoch": boot,
            "image_id": frozen["image_id"], "manifest_sha256": manifest_sha, "bundle_sha256": fingerprint, "helpers_sha256": helpers,
            "checker_version": capture.CHECKER_VERSION, "cases": list(cases.CASES), "results": results,
            "log_sha256": hashlib.sha256(path.read_bytes()).hexdigest(), "preserved": before, "previous_cleanup_sha256": cleanup_sha})
        journal.record("COMPLETE", evidence_sha256=evidence_sha, cases=50, new_provider_records=0, preserved=before)
        print("PASS: fifty stream cases sealed; ten provider rows and all old schemas/evidence unchanged; queue empty; maintenance enabled", flush=True)
        return 0
    except KeyboardInterrupt:
        print("FAIL: interrupted; preserve stream evidence and any sandbox resources.", file=sys.stderr)
        return 130
    except Exception as error:
        print("FAIL: " + (str(error) if isinstance(error, RuntimeError) else type(error).__name__)
              + " Preserve streams-v1, streams-v2 and any sandbox resources. Do not rerun or force-clean.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
