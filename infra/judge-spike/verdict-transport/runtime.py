import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import sys


HERE = Path(__file__).resolve().parent


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


bundle = load("bound_verdict_bundle", HERE / "bundle.py")
verdict = load("bound_verdict_runtime", Path("/run/ingenium-verdicts/runtime.py")) if __name__ == "__main__" else None


def main():
    require = bundle.require
    require(len(sys.argv) == 2 and re.fullmatch(r"[0-9a-f]{64}", sys.argv[1]) and os.geteuid() == 0, "Only a fixed fingerprinted job is supported.")
    require(Path("/proc/self/attr/current").read_text().strip() == "ingenium-isolate-smoke-v1 (enforce)", "Wrong bound-verdict policy.")
    status = Path("/proc/self/status").read_text()
    require(re.search(r"^NoNewPrivs:\s+1$", status, re.M) and re.search(r"^Seccomp:\s+2$", status, re.M), "Container protections changed.")
    parent = os.environ["INGENIUM_CGROUP_PARENT"]
    groups = {keys: path for _, keys, path in (line.split(":", 2) for line in Path("/proc/self/cgroup").read_text().splitlines())}
    require(re.fullmatch(re.escape(parent) + r"/[0-9a-f]{64}", groups["memory"])
            and groups.get("cpu,cpuacct", groups.get("cpuacct,cpu")) == groups["memory"] == groups["pids"], "Bound verdict escaped its budget parent.")
    runner = load("bound_profile_runtime", Path("/usr/local/share/ingenium-profiles/runtime.py"))
    path = Path("/run/ingenium-verdict-job.json")
    raw = runner.regular(path, 8192)
    require(hashlib.sha256(raw).hexdigest() == sys.argv[1] and path.stat().st_uid == 0 and path.stat().st_mode & 0o777 == 0o600, "Private bound job changed.")
    job = json.loads(raw)
    case = bundle.checked_job(job, verdict.cases.CASES)
    require(job["verdict_sha256"] == verdict.bundle.fingerprint(), "Fixed verdict sources changed.")
    output_bundle = load("bound_output_bundle", Path("/run/ingenium-output/bundle.py"))
    stream_bundle = load("bound_stream_bundle", Path("/run/ingenium-streams/bundle.py"))
    require(job["output_sha256"] == output_bundle.fingerprint() and job["stream_sha256"] == stream_bundle.fingerprint(), "Protected collector/checker changed.")
    collector = load("bound_output_collector", Path("/run/ingenium-output/collect.py"))
    capture = load("bound_output_capture", Path("/run/ingenium-streams/capture.py"))
    lock, source = runner.load_lock(), verdict.cases.source(case)
    profile = lock["profiles"][case["profile"]]
    print("INGENIUM_BOUND_VERDICT_VERSIONS " + json.dumps(runner.versions(lock)), flush=True)
    evidence = {"case": case["id"], "profile": case["profile"], "source_sha256": hashlib.sha256(source).hexdigest(), "compile": None, "run": None}
    if profile["compile"]:
        evidence["compile"] = verdict.phase(runner, collector, capture, profile, source,
            {"cpu_ms": 15000, "wall_ms": 30000, "memory_bytes": 1073741824}, compiling=True, mode=case["mode"])
    if evidence["compile"] is None or evidence["compile"]["rc"] == 0:
        evidence["run"] = verdict.phase(runner, collector, capture, profile, source,
            {key: case[key] for key in ("cpu_ms", "wall_ms", "memory_bytes")}, compiling=False, mode=case["mode"],
            artifact=Path("/tmp") / profile["artifact"] if profile["compile"] else None)
    result = verdict.rules.classify(case, evidence, capture, source)
    require(result == {"verdict": case["expected"], "recovery_required": case["expected"] is None}, "Bound case/cause differs from expectation.")
    print("INGENIUM_BOUND_VERDICT_RESULT " + json.dumps({"job": job, "bundle_sha256": bundle.fingerprint(), "evidence": evidence, "result": result}, separators=(",", ":")), flush=True)
    print("PASS: bound verdict completed with protected bytes, cause, exact target identity and normal cleanup", flush=True)


if __name__ == "__main__":
    try: main()
    except Exception as error:
        print("FAIL: " + type(error).__name__ + "; preserve the bound-verdict log, workspace and resources.", file=sys.stderr)
        sys.exit(1)
