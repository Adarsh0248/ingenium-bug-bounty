import base64
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import shutil
import sys
import time
from types import SimpleNamespace


HERE = Path(__file__).resolve().parent


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


bundle = load("verdict_bundle", HERE / "bundle.py")
cases = load("verdict_cases", HERE / "cases.py")
rules = load("verdict_rules", HERE / "rules.py")


def target_seen(runner, command):
    require = runner.require
    tasks = set((runner.MEMORY / "tasks").read_text().splitlines()) & set((runner.CPU / "tasks").read_text().splitlines())
    wanted = b"\0".join(item.encode("ascii") for item in command) + b"\0"
    for pid in tasks:
        require(pid.isdecimal(), "Invalid target PID.")
        try:
            process = Path("/proc") / pid
            with (process / "cmdline").open("rb") as stream:
                actual = stream.read(8193)
            require(len(actual) <= 8192, "Oversized target command observation.")
            if actual != wanted: continue
            status, limits = (process / "status").read_text(), (process / "limits").read_text()
            require(all(re.search(r"^" + key + r":[ \t]+60000[ \t]+60000[ \t]+60000[ \t]+60000$", status, re.M) for key in ("Uid", "Gid"))
                    and all(re.search(r"^" + key + r":[ \t]+0+$", status, re.M) for key in ("CapEff", "CapPrm", "CapInh", "CapAmb"))
                    and re.search(r"^NoNewPrivs:\s+1$", status, re.M) and re.search(r"^Seccomp:\s+2$", status, re.M)
                    and re.search(r"^Max open files[ \t]+256[ \t]+256[ \t]+files[ \t]*$", limits, re.M), "Target protections/identity changed.")
            return True
        except (FileNotFoundError, ProcessLookupError):
            continue
    return False


def phase(runner, collector, capture, profile, source, limits, *, compiling, mode, artifact=None):
    require = runner.require
    require(not runner.WORK.exists() and not runner.MEMORY.exists() and not runner.CPU.exists(), "Previous verdict job remains.")
    require(runner.command([runner.ISOLATE, "--cg", "--box-id=0", "--init"]) == str(runner.WORK), "Unexpected verdict workspace.")
    require(0 < len(source) <= 32768, "Fixture source exceeds its fixed budget.")
    box = runner.WORK / "box"
    (box / profile["source"]).write_bytes(source)
    (box / profile["source"]).chmod(0o444)
    if artifact is not None:
        shutil.copyfile(artifact, box / profile["artifact"])
        (box / profile["artifact"]).chmod(0o555)
    (box / "stdin").write_bytes(b"" if compiling else (mode + "\n").encode("ascii"))
    target = profile["compile"] if compiling else profile["run"]
    kinds = ("compiler",) if compiling else ("stdout", "stderr")
    out, err = ("compiler", "compiler") if compiling else kinds
    seconds = lambda milliseconds: f"{milliseconds // 1000}.{milliseconds % 1000:03d}"
    args = [runner.ISOLATE, "--cg", "--box-id=0", "--no-default-dirs", "--dir=/box=./box:rw", "--dir=/usr", "--dir=/lib", "--dir=/lib64:maybe",
            "--env=PATH=/usr/local/java/bin:/usr/local/bin:/usr/bin:/bin", "--env=LD_LIBRARY_PATH=/usr/local/lib64:/usr/local/lib:/usr/local/java/lib:/usr/local/java/lib/server",
            "--env=HOME=/box", "--env=TMPDIR=/box", "--env=LANG=C.UTF-8", "--env=JAVA_HOME=/usr/local/java", "--env=UV_THREADPOOL_SIZE=1",
            "--processes=64", "--stack=65536", "--fsize=16384", "--time=" + seconds(limits["cpu_ms"]), "--extra-time=0",
            "--wall-time=" + seconds(limits["wall_ms"]), f"--cg-mem={limits['memory_bytes'] // 1024}", "--stdin=/box/stdin",
            "--stdout=/box/" + out, "--stderr=/box/" + err, "--meta=/tmp/verdict.meta", "--run", "--", "/usr/local/bin/ingenium-exec", *target]
    observed = SimpleNamespace(identity_seen=lambda names: target_seen(runner, target))
    result = collector.capture_phase(observed, args, kinds, [], limits["wall_ms"] / 1000, capture=capture)
    meta = runner.regular(Path("/tmp/verdict.meta"), 4096)
    rules.metadata(base64.b64encode(meta).decode("ascii"))
    deadline = time.monotonic() + 2
    while (runner.MEMORY / "tasks").read_text().strip() or (runner.CPU / "tasks").read_text().strip():
        require(time.monotonic() < deadline, "Verdict job children remain; retain resources.")
        time.sleep(0.01)
    require(all(int((runner.MEMORY / name).read_text()) == limits["memory_bytes"] for name in ("memory.limit_in_bytes", "memory.memsw.limit_in_bytes")),
            "Job memory limit differs from the frozen test.")
    evidence = {**result, "meta_b64": base64.b64encode(meta).decode("ascii"), "limits": limits,
                "cpu_ns": int((runner.CPU / "cpuacct.usage").read_text()), "peak_bytes": int((runner.MEMORY / "memory.max_usage_in_bytes").read_text()),
                "ram_hits": int((runner.MEMORY / "memory.failcnt").read_text()), "combined_hits": int((runner.MEMORY / "memory.memsw.failcnt").read_text()),
                "command_checked": True, "cleanup": False}
    if compiling and result["rc"] == 0:
        target_file = box / profile["artifact"]
        runner.regular(target_file, 16777216)
        shutil.copyfile(target_file, Path("/tmp") / profile["artifact"])
    runner.command([runner.ISOLATE, "--cg", "--box-id=0", "--cleanup"])
    require(not runner.WORK.exists() and not runner.MEMORY.exists() and not runner.CPU.exists(), "Verdict job cleanup is incomplete.")
    evidence["cleanup"] = True
    return evidence


def main():
    rules.require(sys.argv[1:] == ["--fixed-verdicts"] and os.geteuid() == 0, "Only the fixed root verdict batch is supported.")
    rules.require(Path("/proc/self/attr/current").read_text().strip() == "ingenium-isolate-smoke-v1 (enforce)", "Wrong verdict container policy.")
    status = Path("/proc/self/status").read_text()
    rules.require(re.search(r"^NoNewPrivs:\s+1$", status, re.M) and re.search(r"^Seccomp:\s+2$", status, re.M), "Container protections changed.")
    parent = os.environ["INGENIUM_CGROUP_PARENT"]
    groups = {keys: path for _, keys, path in (line.split(":", 2) for line in Path("/proc/self/cgroup").read_text().splitlines())}
    rules.require(re.fullmatch(re.escape(parent) + r"/[0-9a-f]{64}", groups["memory"])
                  and groups.get("cpu,cpuacct", groups.get("cpuacct,cpu")) == groups["memory"] == groups["pids"], "Verdict container escaped its parent.")
    collector = load("failure_output_collector", Path("/run/ingenium-output/collect.py"))
    capture = load("failure_output_capture", Path("/run/ingenium-streams/capture.py"))
    runner = load("failure_profile_runtime", Path("/usr/local/share/ingenium-profiles/runtime.py"))
    lock, fingerprint = runner.load_lock(), bundle.fingerprint()
    print("INGENIUM_VERDICT_VERSIONS " + json.dumps(runner.versions(lock)), flush=True)
    compiled = {}
    for case in cases.CASES:
        print("INGENIUM_VERDICT_PHASE " + case["id"], flush=True)
        profile, raw = lock["profiles"][case["profile"]], cases.source(case)
        evidence = {"case": case["id"], "profile": case["profile"], "source_sha256": hashlib.sha256(raw).hexdigest(), "compile": None, "run": None}
        key = (case["profile"], evidence["source_sha256"])
        if profile["compile"]:
            if key not in compiled:
                compiled[key] = phase(runner, collector, capture, profile, raw, {"cpu_ms": 15000, "wall_ms": 30000, "memory_bytes": 1073741824},
                                      compiling=True, mode=case["mode"])
            evidence["compile"] = compiled[key]
        if evidence["compile"] is None or evidence["compile"]["rc"] == 0:
            evidence["run"] = phase(runner, collector, capture, profile, raw, {key: case[key] for key in ("cpu_ms", "wall_ms", "memory_bytes")},
                                    compiling=False, mode=case["mode"], artifact=Path("/tmp") / profile["artifact"] if profile["compile"] else None)
        result = rules.classify(case, evidence, capture, raw)
        rules.require(result == {"verdict": case["expected"], "recovery_required": case["expected"] is None}, "Fixed verdict/cause differs from expectation.")
        print("INGENIUM_VERDICT_RESULT " + json.dumps({"bundle_sha256": fingerprint, "evidence": evidence, "result": result}, separators=(",", ":")), flush=True)
    print("PASS: eighteen fixed verdict cases completed with protected output, exact target identity and normal cleanup", flush=True)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        import traceback
        details = {}
        for name in ("output-isolate.log", "verdict.meta"):
            path = Path("/tmp") / name
            if path.is_file() and not path.is_symlink() and path.stat().st_size <= 4096:
                details[name] = base64.b64encode(path.read_bytes()).decode("ascii")
        details["error"] = type(error).__name__
        details["frames"] = [{"file": Path(frame.filename).name, "function": frame.name, "line": frame.lineno}
                             for frame in traceback.extract_tb(error.__traceback__, limit=8)]
        print("INGENIUM_VERDICT_FAILURE " + json.dumps(details), flush=True)
        print("FAIL: verdict cause, identity, output or cleanup unproved; preserve the private checkpoint and resources.", file=sys.stderr)
        sys.exit(1)
