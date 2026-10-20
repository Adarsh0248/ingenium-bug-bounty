import hashlib
import importlib.util
import os
from pathlib import Path
import platform
import signal
import socket
import sys


HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("verdict_output_seal", HERE / "seal-output.py")
seal = importlib.util.module_from_spec(spec)
spec.loader.exec_module(seal)
output, transport, lab = seal.output, seal.transport, seal.lab
guard, streams, require = output.guard, output.streams, seal.require
bundle = streams.load("verdict_host_bundle", HERE / "verdicts/bundle.py")
cases = streams.load("verdict_host_cases", HERE / "verdicts/cases.py")
rules = streams.load("verdict_host_rules", HERE / "verdicts/rules.py")
DIRECTORY = lab.RUNTIME / "verdicts-v1"
LEGACY_OUTPUT = "1a5526658d9b4504467ad398fa4d79099cb40238cf74f16bc4a852fba99bf13e"
LEGACY_LAUNCHER = "ddc21c7016b3a4d656b4b3c8879ff4c225725585c1aae143e5518efecbc95a6d"
SEAL_SOURCE = "e64162baa88b345926367c1471309ca009ffd92717a43fa928988b44976510ad"
DONE = "PASS: eighteen fixed verdict cases completed with protected output, exact target identity and normal cleanup"


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def completed_output():
    before = output.previous()
    files = {name: transport.private(output.DIRECTORY / name, 2097152) for name in (
        "journal.jsonl", "output.log", "seal-fix-v1/journal.jsonl", "seal-fix-v1/evidence.json")}
    original = [lab.decode_json(line) for line in files["journal.jsonl"].splitlines()]
    repair = [lab.decode_json(line) for line in files["seal-fix-v1/journal.jsonl"].splitlines()]
    require([row.get("event") for row in original] == ["PREPARED", "OUTPUT_STARTED", "OUTPUT_FINISHED"]
            and [row.get("event") for row in repair] == ["VERIFIED_COMPLETED_EXECUTION", "EVIDENCE_SAVED", "COMPLETE"],
            "The protected-output execution and sealing continuation must both be complete.")
    evidence = lab.decode_json(files["seal-fix-v1/evidence.json"])
    old, final = original[0], repair[-1]
    originals = {name: digest(files[name]) for name in ("journal.jsonl", "output.log")}
    policy = digest(transport.runtime.regular(HERE / "namespace-smoke.apparmor", 65536))
    helpers = {"output.py": seal.OLD_ENTRY, "cgroup-smoke.sh": LEGACY_LAUNCHER, "namespace-smoke.apparmor": policy}
    fixed = {**helpers, "output.py": seal.PATCHED_ENTRY, "seal-output.py": SEAL_SOURCE}
    frozen, manifest_sha = guard.manifest()
    require(old.get("bundle_sha256") == LEGACY_OUTPUT and old.get("stream_sha256") == streams.bundle.fingerprint()
            and old.get("helpers_sha256") == helpers and old.get("preserved") == before
            and old.get("image_id") == frozen["image_id"] and old.get("manifest_sha256") == manifest_sha,
            "The earlier protected-output runtime or saved context differs.")
    require(repair[0].get("original_sha256") == originals and repair[0].get("helpers_sha256") == fixed
            and repair[0].get("preserved") == before and repair[0].get("host_epoch") == old["host_epoch"]
            and final.get("original_sha256") == originals and final.get("preserved") == before
            and final.get("cases") == 53 and final.get("new_sandbox_launches") == 0 and final.get("new_provider_records") == 0
            and repair[1].get("evidence_sha256") == final.get("evidence_sha256") == digest(files["seal-fix-v1/evidence.json"])
            and original[-1].get("log_sha256") == originals["output.log"], "Earlier sealing evidence changed.")
    wanted = {"scope": "fixed-protected-output-v1", **{key: old[key] for key in (
        "host_epoch", "image_id", "manifest_sha256", "bundle_sha256", "stream_sha256", "helpers_sha256", "preserved")},
        "results": output.parse_log(output.DIRECTORY / "output.log", frozen, old["stream_sha256"], LEGACY_OUTPUT),
        "log_sha256": originals["output.log"]}
    require(evidence == wanted and all(digest(transport.runtime.regular(HERE / name, 65536)) == value
                                      for name, value in fixed.items() if name != "cgroup-smoke.sh"),
            "The prior sealed results, entry points or policy differ; inspect without replaying.")
    seal.physical_cleanup(files["output.log"])
    return {"earlier": before, "output": {name: digest(raw) for name, raw in files.items()}}


def parse_log(path, frozen, fingerprint):
    raw = transport.private(path, 4194304)
    lines = raw.decode("ascii").splitlines()
    require(lines.count(DONE) == 1 and lines.count("PASS: host test groups and temporary files removed") == 1
            and not any(line.startswith(("FAIL:", "INGENIUM_VERDICT_FAILURE ")) for line in lines), "Verdict batch/cleanup is incomplete.")
    versions = [lab.decode_json(line.removeprefix("INGENIUM_VERDICT_VERSIONS ")) for line in lines if line.startswith("INGENIUM_VERDICT_VERSIONS ")]
    require(versions == [frozen["observed"]], "Verdict runtime versions or binaries changed.")
    values = [lab.decode_json(line.removeprefix("INGENIUM_VERDICT_RESULT ")) for line in lines if line.startswith("INGENIUM_VERDICT_RESULT ")]
    require(len(values) == len(cases.CASES), "Missing/duplicate verdict cases.")
    for case, value in zip(cases.CASES, values):
        require(type(value) is dict and set(value) == {"bundle_sha256", "evidence", "result"} and value["bundle_sha256"] == fingerprint,
                "Wrong fixed verdict bundle/envelope.")
        result = rules.classify(case, value["evidence"], transport.capture, cases.source(case))
        require(value["result"] == result == {"verdict": case["expected"], "recovery_required": case["expected"] is None},
                "The independently checked verdict/cause differs.")
        print(f"PASS: {case['id']} -> {result['verdict'] or 'RECOVERY_REQUIRED'}; protected bytes, cause and cleanup verified", flush=True)
    seal.physical_cleanup(raw)
    return values


def main(argv=None):
    args = sys.argv[1:] if argv is None else argv
    if args or platform.system() != "Linux" or socket.gethostname() != "ingenium-judge-spike-01" or os.geteuid() != 0:
        print("FAIL: run verdicts.py with sudo only on the isolated VM, without arguments.", file=sys.stderr)
        return 1
    try:
        os.umask(0o077)
        signal.signal(signal.SIGTERM, lab.interrupt)
        streams.active.tree.directory(lab.RUNTIME, 0o700)
        require(not os.path.lexists(DIRECTORY), "Verdict checkpoint exists; do not rerun, delete it or reset records.")
        lab.queue.check_services()
        before = completed_output()
        frozen, manifest_sha = guard.manifest()
        fingerprint, stream_sha, output_sha = bundle.fingerprint(), streams.bundle.fingerprint(), output.bundle.fingerprint()
        helpers = {name: digest(transport.runtime.regular(HERE / name, 65536))
                   for name in ("verdicts.py", "cgroup-smoke.sh", "namespace-smoke.apparmor")}
        boot = Path("/proc/sys/kernel/random/boot_id").read_text().strip()
        _, token = lab.prepare_config(transport.failure.private_file(lab.RUNTIME / "judge0.conf", 1000, 999, 0o400, 32768))
        lab.api.check_api(lab.private_ip(lab.queue.API), token)
        journal = lab.Journal(DIRECTORY)
        journal.record("PREPARED", preserved=before, image_id=frozen["image_id"], manifest_sha256=manifest_sha,
                       bundle_sha256=fingerprint, stream_sha256=stream_sha, output_sha256=output_sha, helpers_sha256=helpers, host_epoch=boot)
        path = streams.profiles.logged(journal, "verdicts", ["/bin/bash", str(HERE / "cgroup-smoke.sh"), "--verdicts",
            frozen["image_id"], stream_sha, output_sha, fingerprint], 480)
        results = parse_log(path, frozen, fingerprint)
        require(completed_output() == before and bundle.fingerprint() == fingerprint and streams.bundle.fingerprint() == stream_sha
                and output.bundle.fingerprint() == output_sha and Path("/proc/sys/kernel/random/boot_id").read_text().strip() == boot
                and all(digest(transport.runtime.regular(HERE / name, 65536)) == value for name, value in helpers.items()),
                "Old evidence, preserved state, frozen sources or host boot changed.")
        lab.queue.check_services()
        lab.api.check_api(lab.private_ip(lab.queue.API), token)
        evidence_sha = transport.save(DIRECTORY / "evidence.json", {"scope": "fixed-protected-verdicts-v1", "host_epoch": boot,
            "image_id": frozen["image_id"], "manifest_sha256": manifest_sha, "bundle_sha256": fingerprint,
            "stream_sha256": stream_sha, "output_sha256": output_sha, "helpers_sha256": helpers,
            "results": results, "preserved": before, "log_sha256": digest(transport.private(path, 4194304))})
        journal.record("COMPLETE", evidence_sha256=evidence_sha, cases=18, new_provider_records=0, preserved=before)
        print("PASS: eighteen protected verdict cases sealed; ambiguous kill held for recovery; fifteen provider rows and all old evidence unchanged; queue empty; maintenance enabled", flush=True)
        return 0
    except KeyboardInterrupt:
        print("FAIL: interrupted; preserve verdicts-v1 and any resources without retrying.", file=sys.stderr)
        return 130
    except Exception as error:
        print("FAIL: " + (str(error) if isinstance(error, RuntimeError) else type(error).__name__)
              + " Preserve verdicts-v1 and any sandbox resources. Do not rerun or force-clean.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
