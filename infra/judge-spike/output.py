import hashlib
import importlib.util
import os
from pathlib import Path
import platform
import signal
import socket
import sys


HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("output_previous_isolation", HERE / "isolation.py")
isolation = importlib.util.module_from_spec(spec)
spec.loader.exec_module(isolation)
transport, lab, guard, require = isolation.transport, isolation.lab, isolation.guard, isolation.require
streams = transport.streams
bundle = streams.load("output_host_bundle", HERE / "output/bundle.py")
DIRECTORY = lab.RUNTIME / "output-v1"


def previous():
    before = isolation.completed_transport()
    root = isolation.DIRECTORY
    raw = transport.private(root / "journal.jsonl", 65536)
    rows = [lab.decode_json(line) for line in raw.splitlines()]
    require(rows and rows[-1].get("event") == "COMPLETE", "The earlier isolation checkpoint is not complete.")
    saved = transport.private(root / "evidence.json")
    require(hashlib.sha256(saved).hexdigest() == rows[-1].get("evidence_sha256"), "Sealed isolation evidence changed.")
    evidence = lab.decode_json(saved)
    frozen, manifest_sha = guard.manifest()
    stream_sha, isolation_sha = streams.bundle.fingerprint(), isolation.bundle.fingerprint()
    log = root / "isolation.log"
    require(evidence.get("scope") == "fixed-shared-isolation-boundary-v1" and evidence.get("preserved") == before
            and rows[-1].get("preserved") == before and rows[-1].get("cases") == 3 and rows[-1].get("new_provider_records") == 0
            and evidence.get("image_id") == frozen["image_id"] and evidence.get("manifest_sha256") == manifest_sha
            and evidence.get("bundle_sha256") == isolation_sha and evidence.get("stream_sha256") == stream_sha
            and evidence.get("log_sha256") == hashlib.sha256(transport.private(log, 131072)).hexdigest(),
            "The completed isolation runtime, log or preserved state differs.")
    require(type(evidence.get("helpers_sha256")) is dict
            and set(evidence["helpers_sha256"]) == {"isolation.py", "cgroup-smoke.sh", "namespace-smoke.apparmor"}
            and all(hashlib.sha256(transport.runtime.regular(HERE / name, 65536)).hexdigest() == value
                    for name, value in evidence["helpers_sha256"].items() if name != "cgroup-smoke.sh"),
            "Earlier isolation helpers/policy changed; only the separately frozen launcher may differ.")
    require(isolation.parse_log(log, frozen, isolation_sha) == evidence.get("results"), "Earlier isolation results differ.")
    return {"earlier": before, "isolation": {name: hashlib.sha256(transport.private(root / name, 131072)).hexdigest()
                                             for name in ("journal.jsonl", "evidence.json", "isolation.log")}}


def checked_probe(value, name):
    require(type(value) is dict and set(value) == {"case", "cpu_ns", "peak_bytes", "wall_seconds", "identity_checked", "cleanup", "captures"}
            and value["case"] == name and value["cleanup"] is True, "Missing protected-output probe or cleanup.")
    streams.profiles.checked_phase({key: value[key] for key in ("cpu_ns", "peak_bytes", "wall_seconds", "identity_checked")}
                                   | {"stdout_b64": ""}, 4, 15, 536870912, b"")
    wanted = {kind: transport.capture.summary(streams.record_for(kind, raw))
              for kind, raw in zip(("stdout", "stderr"), bundle.EXPECTED[name])}
    require(type(value["captures"]) is dict and set(value["captures"]) == set(wanted), "Output probe channels differ.")
    for kind, summary in wanted.items():
        actual = value["captures"][kind]
        require(type(actual) is dict and set(actual) == set(summary)
                and all(type(actual[key]) is type(expected) and actual[key] == expected for key, expected in summary.items()),
                "Output probe bytes/counts or completion evidence differ.")


def parse_log(path, frozen, stream_sha, fingerprint):
    lines = transport.private(path, 262144).decode("ascii").splitlines()
    require(lines.count("INGENIUM_OUTPUT_BUNDLE " + fingerprint) == 1
            and lines.count("PASS: protected output completed fifty language cases and three tampering/EOF probes with normal cleanup") == 1
            and not any(line.startswith("INGENIUM_OUTPUT_FAILURE ") for line in lines), "Protected-output suite is incomplete.")
    parity = streams.parse_log(path, frozen, stream_sha)
    prefix = "INGENIUM_OUTPUT_RESULT "
    probes = [lab.decode_json(line[len(prefix):]) for line in lines if line.startswith(prefix)]
    require(len(probes) == len(bundle.CASES), "Missing/duplicate output tampering cases.")
    for name, value in zip(bundle.CASES, probes):
        checked_probe(value, name)
        print(f"PASS: {name} -> protected pipes, exact captured bytes and normal cleanup verified", flush=True)
    return {"parity": parity, "probes": probes}


def main(argv=None):
    args = sys.argv[1:] if argv is None else argv
    if args or platform.system() != "Linux" or socket.gethostname() != "ingenium-judge-spike-01" or os.geteuid() != 0:
        print("FAIL: run output.py with sudo only on the isolated VM, without arguments.", file=sys.stderr)
        return 1
    try:
        os.umask(0o077)
        signal.signal(signal.SIGTERM, lab.interrupt)
        streams.active.tree.directory(lab.RUNTIME, 0o700)
        require(not os.path.lexists(DIRECTORY), "Protected-output checkpoint exists; do not rerun or clear it.")
        lab.queue.check_services()
        before = previous()
        frozen, manifest_sha = guard.manifest()
        fingerprint, stream_sha = bundle.fingerprint(), streams.bundle.fingerprint()
        helpers = {name: hashlib.sha256(transport.runtime.regular(HERE / name, 65536)).hexdigest()
                   for name in ("output.py", "cgroup-smoke.sh", "namespace-smoke.apparmor")}
        boot = Path("/proc/sys/kernel/random/boot_id").read_text().strip()
        _, token = lab.prepare_config(transport.failure.private_file(lab.RUNTIME / "judge0.conf", 1000, 999, 0o400, 32768))
        lab.api.check_api(lab.private_ip(lab.queue.API), token)
        journal = lab.Journal(DIRECTORY)
        journal.record("PREPARED", preserved=before, image_id=frozen["image_id"], manifest_sha256=manifest_sha,
                       bundle_sha256=fingerprint, stream_sha256=stream_sha, helpers_sha256=helpers, host_epoch=boot)
        path = streams.profiles.logged(journal, "output", ["/bin/bash", str(HERE / "cgroup-smoke.sh"), "--output",
                                      frozen["image_id"], stream_sha, fingerprint], 480)
        results = parse_log(path, frozen, stream_sha, fingerprint)
        require(previous() == before and bundle.fingerprint() == fingerprint and streams.bundle.fingerprint() == stream_sha
                and Path("/proc/sys/kernel/random/boot_id").read_text().strip() == boot
                and all(hashlib.sha256(transport.runtime.regular(HERE / name, 65536)).hexdigest() == value for name, value in helpers.items()),
                "Earlier state, protected sources, launcher or host boot changed.")
        lab.queue.check_services()
        lab.api.check_api(lab.private_ip(lab.queue.API), token)
        evidence_sha = transport.save(DIRECTORY / "evidence.json", {"scope": "fixed-protected-output-v1", "host_epoch": boot,
            "image_id": frozen["image_id"], "manifest_sha256": manifest_sha, "bundle_sha256": fingerprint, "stream_sha256": stream_sha,
            "helpers_sha256": helpers, "results": results, "preserved": before, "log_sha256": hashlib.sha256(path.read_bytes()).hexdigest()})
        journal.record("COMPLETE", evidence_sha256=evidence_sha, cases=53, new_provider_records=0, preserved=before)
        print("PASS: protected-output evidence sealed; fifty language cases and three tampering probes passed; fifteen provider rows unchanged; queue empty; maintenance enabled", flush=True)
        return 0
    except KeyboardInterrupt:
        print("FAIL: interrupted; preserve output-v1 and any retained sandbox resources.", file=sys.stderr)
        return 130
    except Exception as error:
        print("FAIL: " + (str(error) if isinstance(error, RuntimeError) else type(error).__name__)
              + " Preserve output-v1 and its resources. Do not rerun or force-clean.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
