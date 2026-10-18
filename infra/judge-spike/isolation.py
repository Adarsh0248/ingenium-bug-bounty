import errno
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import platform
import signal
import socket
import sys


HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("isolation_transport", HERE / "transport.py")
transport = importlib.util.module_from_spec(spec)
spec.loader.exec_module(transport)
lab, guard, runtime, require = transport.lab, transport.guard, transport.runtime, transport.require
bundle = transport.streams.load("isolation_host_bundle", HERE / "isolation/bundle.py")
DIRECTORY = lab.RUNTIME / "isolation-v1"


def completed_transport():
    root = lab.RUNTIME / "transport-v1"
    raw = transport.private(root / "journal.jsonl", 65536)
    rows = [lab.decode_json(line) for line in raw.splitlines()]
    require(rows and rows[-1].get("event") == "COMPLETE", "Five-profile HTTP checkpoint is not complete.")
    completed = rows[-1]
    require(type(completed.get("provider_tokens")) is dict and set(completed["provider_tokens"]) == set(transport.runner.TRANSPORT), "Missing completed job identities.")
    tokens = [lab.valid_uuid(value) for value in completed["provider_tokens"].values()]
    require(len(set(tokens)) == 5 and transport.preserved(owned=True) == completed["preserved"], "Earlier records/evidence or held reservation changed.")
    providers = lab.db(transport.streams.profiles.SNAPSHOT_SQL)
    require(type(providers) is dict and providers.get("count") == 15 and providers.get("complete") is True, "Expected fifteen completed provider records.")
    snapshot = lab.db("SELECT json_build_object('count', count(*), 'sealed', bool_and(state = 'SEALED' AND permit_count = 1 AND evidence_json IS NOT NULL), "
                      "'tokens', json_agg(provider_id::text ORDER BY provider_id::text), "
                      "'sha256', encode(sha256(convert_to(jsonb_agg(to_jsonb(a) ORDER BY attempt_id)::text, 'UTF8')), 'hex')) "
                      "FROM ingenium_transport_v1.attempts a;")
    require(type(snapshot) is dict and snapshot.get("count") == 5 and snapshot.get("sealed") is True and snapshot.get("tokens") == sorted(tokens),
            "The five sealed provider associations differ; do not reset them.")
    require(lab.redis(lab.EMPTY, 0) == b"empty", "Queue is not idle; preserve pending work.")
    files = {"journal.jsonl": hashlib.sha256(raw).hexdigest(), "context.json": hashlib.sha256(transport.private(root / "context.json", 65536)).hexdigest()}
    context = lab.decode_json(transport.private(root / "context.json", 65536))
    frozen, manifest_sha = guard.manifest()
    require(context.get("scope") == transport.SCOPE and context.get("manifest_sha256") == manifest_sha
            and context.get("image_id") == frozen["image_id"] and context.get("bundle_sha256") == transport.streams.bundle.fingerprint()
            and {key: value for key, value in context["helpers_sha256"].items() if key != "cgroup-smoke.sh"}
                == {key: value for key, value in transport.helpers().items() if key != "cgroup-smoke.sh"},
            "Completed HTTP runtime/checker sources changed; only the separately frozen new launcher may differ.")
    for name in transport.runner.TRANSPORT:
        item = context["jobs"][name]
        require(transport.canonical(item["payload"]) == transport.canonical(transport.payload(name, frozen)), "Completed fixed source/input differs.")
        binding = item["binding"]
        guard.where(binding)
        row = lab.db("SELECT json_build_object('owner', owner_id, 'sha256', evidence_sha256, 'provider', provider_id) "
                     "FROM ingenium_transport_v1.attempts WHERE " + guard.where(binding) + ";")
        require(type(row) is dict and row.get("provider") == completed["provider_tokens"][name], "Completed execution binding differs.")
        job = transport.job_for(name, item, row["owner"])
        execution = root / ("execution-" + binding["attempt_id"])
        evidence = transport.private(execution / "evidence.json")
        require(hashlib.sha256(evidence).hexdigest() == row["sha256"], "Saved sealed evidence changed.")
        transport.checked_result(lab.decode_json(evidence), job, frozen, context["bundle_sha256"])
        for filename in ("journal.jsonl", "job.json", "sandbox.log", "evidence.json"):
            path = execution / filename
            files[path.relative_to(root).as_posix()] = hashlib.sha256(transport.private(path)).hexdigest()
        for index in (0, 1):
            name_on_disk = f"worker-{name}-{index}.json"
            files[name_on_disk] = hashlib.sha256(transport.private(root / name_on_disk, 65536)).hexdigest()
    return {"preserved": completed["preserved"], "providers": providers, "transport": snapshot, "files": files}


def checked_result(value, name):
    require(type(value) is dict and set(value) == {"case", "probe", "observed_tasks", "cpu_ns", "peak_bytes", "wall_seconds", "identity_checked", "cleanup", "captures"}
            and value["case"] == name and value["cleanup"] is True, "Missing isolation phase/cleanup evidence.")
    transport.streams.profiles.checked_phase({key: value[key] for key in ("cpu_ns", "peak_bytes", "wall_seconds", "identity_checked")} | {"stdout_b64": ""},
                                            4, 15, 536870912, b"")
    minimum = {"boundary": 1, "fork-limit": 8, "detached-child": 2}[name]
    require(type(value["observed_tasks"]) is int and minimum <= value["observed_tasks"] <= 8, "Required live child observation missing.")
    probe = value["probe"]
    require(type(probe) is dict and set(probe) == {"case", "identity", "result"} and probe["case"] == name and probe["identity"] is True, "Wrong probe identity/case.")
    result = probe["result"]
    if name == "boundary":
        require(type(result) is dict and set(result) == {"sockets", "hidden_paths", "usr_write", "private_env_absent"}
                and result["private_env_absent"] is True and type(result["sockets"]) is list and len(result["sockets"]) == 4
                and all(type(code) is int and code in (errno.EPERM, errno.EACCES) for code in result["sockets"])
                and type(result["hidden_paths"]) is list and len(result["hidden_paths"]) == len(bundle.HIDDEN_PATHS)
                and all(type(code) is int and code in (errno.ENOENT, errno.EACCES, errno.ENOTDIR) for code in result["hidden_paths"])
                and type(result["usr_write"]) is int and result["usr_write"] in (errno.EACCES, errno.EPERM, errno.EROFS),
                "Network/files/environment protections did not deny the fixed operations.")
    elif name == "fork-limit":
        require(type(result) is dict and set(result) == {"children", "fork_errno", "joined"} and type(result["children"]) is int and result["children"] == 7
                and type(result["fork_errno"]) is int and result["fork_errno"] == errno.EAGAIN and result["joined"] is True, "Fork-limit or joined-child proof differs.")
    else:
        require(type(result) is dict and set(result) == {"child_detached"} and result["child_detached"] is True, "Detached child was not started.")
    raw = json.dumps(probe, separators=(",", ":")).encode("ascii") + b"\n"
    wanted = {kind: transport.capture.summary(transport.streams.record_for(kind, data)) for kind, data in (("stdout", raw), ("stderr", b""))}
    require(len(raw) <= 4096 and type(value["captures"]) is dict and set(value["captures"]) == set(wanted), "Probe capture channels differ.")
    for kind, summary in wanted.items():
        actual = value["captures"][kind]
        require(type(actual) is dict and set(actual) == set(summary)
                and all(type(actual[key]) is type(expected) and actual[key] == expected for key, expected in summary.items()),
                "Probe data differs from captured stream bytes/counts.")


def parse_log(path, frozen, fingerprint):
    lines = transport.private(path, 131072).decode("ascii").splitlines()
    prefix = "INGENIUM_ISOLATION_RESULT "
    results = [lab.decode_json(line[len(prefix):]) for line in lines if line.startswith(prefix)]
    versions = [lab.decode_json(line[len("INGENIUM_ISOLATION_VERSIONS "):]) for line in lines if line.startswith("INGENIUM_ISOLATION_VERSIONS ")]
    require(not any("FAIL:" in line or line.startswith("INGENIUM_ISOLATION_FAILURE ") for line in lines)
            and versions == [frozen["observed"]] and len(results) == 3
            and lines.count("PASS: three fixed isolation cases completed with observed identity, accounted children and normal cleanup") == 1
            and lines.count("PASS: host test groups and temporary files removed") == 1, "Isolation suite or owned cleanup did not complete.")
    for name, row in zip(bundle.CASES, results):
        require(type(row) is dict and set(row) == {"bundle_sha256", "result"} and row["bundle_sha256"] == fingerprint, "Wrong fixed isolation bundle.")
        checked_result(row["result"], name)
        print(f"PASS: {name} -> fixed denials/child observations, accounting and normal cleanup verified", flush=True)
    return results


def main(argv=None):
    args = sys.argv[1:] if argv is None else argv
    if args or platform.system() != "Linux" or socket.gethostname() != "ingenium-judge-spike-01" or os.geteuid() != 0:
        print("FAIL: run isolation.py with sudo only on the isolated VM, without arguments.", file=sys.stderr)
        return 1
    try:
        os.umask(0o077)
        signal.signal(signal.SIGTERM, lab.interrupt)
        transport.streams.active.tree.directory(lab.RUNTIME, 0o700)
        require(not os.path.lexists(DIRECTORY), "Isolation checkpoint exists; do not rerun or clear it.")
        lab.queue.check_services()
        before = completed_transport()
        frozen, manifest_sha = guard.manifest()
        fingerprint, stream_sha = bundle.fingerprint(), transport.streams.bundle.fingerprint()
        helpers = {name: hashlib.sha256(runtime.regular(HERE / name, 65536)).hexdigest() for name in ("isolation.py", "cgroup-smoke.sh", "namespace-smoke.apparmor")}
        boot = Path("/proc/sys/kernel/random/boot_id").read_text().strip()
        config = transport.failure.private_file(lab.RUNTIME / "judge0.conf", 1000, 999, 0o400, 32768)
        _, token = lab.prepare_config(config)
        lab.api.check_api(lab.private_ip(lab.queue.API), token)
        journal = lab.Journal(DIRECTORY)
        journal.record("PREPARED", preserved=before, image_id=frozen["image_id"], manifest_sha256=manifest_sha,
                       bundle_sha256=fingerprint, stream_sha256=stream_sha, helpers_sha256=helpers, host_epoch=boot)
        path = transport.streams.profiles.logged(journal, "isolation", ["/bin/bash", str(HERE / "cgroup-smoke.sh"), "--isolation",
                                                  frozen["image_id"], stream_sha, fingerprint], 120)
        results = parse_log(path, frozen, fingerprint)
        require(completed_transport() == before and bundle.fingerprint() == fingerprint and transport.streams.bundle.fingerprint() == stream_sha
                and Path("/proc/sys/kernel/random/boot_id").read_text().strip() == boot
                and all(hashlib.sha256(runtime.regular(HERE / name, 65536)).hexdigest() == value for name, value in helpers.items()),
                "Earlier state, fixed sources or host boot changed.")
        lab.queue.check_services()
        lab.api.check_api(lab.private_ip(lab.queue.API), token)
        evidence_sha = guard.private_json(DIRECTORY / "evidence.json", {"scope": "fixed-shared-isolation-boundary-v1", "host_epoch": boot,
            "image_id": frozen["image_id"], "manifest_sha256": manifest_sha, "bundle_sha256": fingerprint, "stream_sha256": stream_sha,
            "helpers_sha256": helpers, "results": results, "preserved": before, "log_sha256": hashlib.sha256(path.read_bytes()).hexdigest()})
        journal.record("COMPLETE", evidence_sha256=evidence_sha, cases=3, new_provider_records=0, preserved=before)
        print("PASS: three shared-boundary probes sealed; fifteen provider rows and previous evidence unchanged; queue empty; maintenance enabled", flush=True)
        return 0
    except KeyboardInterrupt:
        print("FAIL: interrupted; preserve isolation-v1 and all retained resources.", file=sys.stderr)
        return 130
    except Exception as error:
        print("FAIL: " + (str(error) if isinstance(error, RuntimeError) else type(error).__name__)
              + " Preserve isolation-v1 and any probe resources. Do not rerun or force-clean.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
