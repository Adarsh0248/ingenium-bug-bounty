import hashlib
import importlib.util
import json
import os
from pathlib import Path
import platform
import re
import signal
import socket
import sys


HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("retained_output", HERE / "output.py")
output = importlib.util.module_from_spec(spec)
spec.loader.exec_module(output)
lab, transport, require = output.lab, output.transport, output.require
FIX = output.DIRECTORY / "seal-fix-v1"
OLD_ENTRY = "168da3f5105506e93d931d959c0562cc2a7afe619f4d9b7029fe0f2c734d12de"
PATCHED_ENTRY = "3a77780c820c202dd734b4b8da7f02ea9cec8ac3fe9f8918e77105dd16a9ca15"


def physical_cleanup(log):
    names = [line for line in log.decode("ascii").splitlines() if re.fullmatch(r"ingenium-cg-run-[A-Za-z0-9]{6}", line)]
    require(len(names) == 1, "Missing/duplicate completed sandbox identity.")
    require(lab.run("docker", "ps", "-aq", "--filter", "name=ingenium-cg-run-") == b"", "A sandbox container remains; do not seal or clean it.")
    parent = names[0].replace("ingenium-cg-run-", "ingenium-cg-run.")
    with Path("/sys/kernel/security/apparmor/profiles").open("rb") as stream:
        profiles = stream.read(262145)
    require(len(profiles) <= 262144 and not any(line.startswith(b"ingenium-isolate-smoke-v1 ") for line in profiles.splitlines()),
            "The sandbox policy is still loaded or its inventory is uncertain.")
    require(not os.path.lexists(Path("/run") / parent)
            and not any(os.path.lexists(root / parent) for root in output.streams.active.roots()),
            "An owned workspace/controller parent remains; retain it without cleanup.")


def checkpoint():
    output.streams.active.tree.directory(lab.RUNTIME, 0o700)
    output.streams.active.tree.directory(output.DIRECTORY, 0o700)
    require(not os.path.lexists(FIX), "Output sealing continuation already exists; do not repeat it.")
    require({path.name for path in output.DIRECTORY.iterdir()} == {"journal.jsonl", "output.log"},
            "Expected only the original journal and completed log; inspect without deleting anything.")
    raw = transport.private(output.DIRECTORY / "journal.jsonl", 65536)
    rows = [lab.decode_json(line) for line in raw.splitlines()]
    require([row.get("event") for row in rows] == ["PREPARED", "OUTPUT_STARTED", "OUTPUT_FINISHED"],
            "The original run is not at the completed, unsealed stage.")
    value = rows[0]
    require(set(value) == {"event", "preserved", "image_id", "manifest_sha256", "bundle_sha256", "stream_sha256", "helpers_sha256", "host_epoch"},
            "Unexpected original output context.")
    hashes = {name: hashlib.sha256(transport.runtime.regular(HERE / name, 65536)).hexdigest()
              for name in ("output.py", "cgroup-smoke.sh", "namespace-smoke.apparmor", "seal-output.py")}
    require(hashes["output.py"] == PATCHED_ENTRY
            and value["helpers_sha256"] == {"output.py": OLD_ENTRY, "cgroup-smoke.sh": hashes["cgroup-smoke.sh"],
                                             "namespace-smoke.apparmor": hashes["namespace-smoke.apparmor"]},
            "The original sources differ; only the pinned evidence-writer patch may change.")
    frozen, manifest_sha = output.guard.manifest()
    require(value["image_id"] == frozen["image_id"] and value["manifest_sha256"] == manifest_sha
            and value["bundle_sha256"] == output.bundle.fingerprint() and value["stream_sha256"] == output.streams.bundle.fingerprint()
            and value["host_epoch"] == Path("/proc/sys/kernel/random/boot_id").read_text().strip()
            and value["preserved"] == output.previous(), "Runtime, host boot or earlier saved state changed.")
    log = transport.private(output.DIRECTORY / "output.log", 262144)
    fingerprint = hashlib.sha256(log).hexdigest()
    require(rows[-1].get("log_sha256") == fingerprint, "Completed output log changed.")
    results = output.parse_log(output.DIRECTORY / "output.log", frozen, value["stream_sha256"], value["bundle_sha256"])
    evidence = {"scope": "fixed-protected-output-v1", **{key: value[key] for key in (
        "host_epoch", "image_id", "manifest_sha256", "bundle_sha256", "stream_sha256", "helpers_sha256", "preserved")},
        "results": results, "log_sha256": fingerprint}
    pretty = json.dumps(evidence, sort_keys=True, indent=2, allow_nan=False).encode("ascii") + b"\n"
    require(len(pretty) > 65536 and len(transport.canonical(evidence)) <= transport.MAX_WIRE,
            "The retained report does not reproduce the bounded-writer failure.")
    physical_cleanup(log)
    return value, evidence, hashes, {"journal.jsonl": hashlib.sha256(raw).hexdigest(), "output.log": fingerprint}


def main(argv=None):
    args = sys.argv[1:] if argv is None else argv
    if args or platform.system() != "Linux" or socket.gethostname() != "ingenium-judge-spike-01" or os.geteuid() != 0:
        print("FAIL: run seal-output.py with sudo only on the isolated VM, without arguments.", file=sys.stderr)
        return 1
    try:
        os.umask(0o077)
        signal.signal(signal.SIGTERM, lab.interrupt)
        lab.queue.check_services()
        value, evidence, helpers, original = checkpoint()
        _, token = lab.prepare_config(transport.failure.private_file(lab.RUNTIME / "judge0.conf", 1000, 999, 0o400, 32768))
        lab.api.check_api(lab.private_ip(lab.queue.API), token)
        journal = lab.Journal(FIX)
        journal.record("VERIFIED_COMPLETED_EXECUTION", original_sha256=original, helpers_sha256=helpers,
                       host_epoch=value["host_epoch"], preserved=value["preserved"])
        fingerprint = transport.save(FIX / "evidence.json", evidence)
        journal.record("EVIDENCE_SAVED", evidence_sha256=fingerprint)
        require(output.previous() == value["preserved"] and output.bundle.fingerprint() == value["bundle_sha256"]
                and output.streams.bundle.fingerprint() == value["stream_sha256"]
                and Path("/proc/sys/kernel/random/boot_id").read_text().strip() == value["host_epoch"]
                and all(hashlib.sha256(transport.runtime.regular(HERE / name, 65536)).hexdigest() == digest for name, digest in helpers.items())
                and all(hashlib.sha256(transport.private(output.DIRECTORY / name, 262144)).hexdigest() == digest for name, digest in original.items()),
                "Old evidence, sources, host or prior state changed during sealing.")
        physical_cleanup(transport.private(output.DIRECTORY / "output.log", 262144))
        lab.queue.check_services()
        lab.api.check_api(lab.private_ip(lab.queue.API), token)
        journal.record("COMPLETE", evidence_sha256=fingerprint, original_sha256=original, cases=53,
                       new_sandbox_launches=0, new_provider_records=0, preserved=value["preserved"])
        print("PASS: fifty language cases and three tampering probes reconstructed from the completed log; no code rerun", flush=True)
        print("PASS: compact evidence sealed; original journal/log and fifteen provider rows unchanged; queue empty; maintenance enabled", flush=True)
        return 0
    except KeyboardInterrupt:
        print("FAIL: interrupted; preserve output-v1 and seal-fix-v1 without retrying.", file=sys.stderr)
        return 130
    except Exception as error:
        print("FAIL: " + (str(error) if isinstance(error, RuntimeError) else type(error).__name__)
              + " Preserve output-v1, seal-fix-v1 and any resources. Do not rerun or force-clean.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
