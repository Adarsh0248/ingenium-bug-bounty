import base64
import importlib.util
import json
import os
from pathlib import Path
import re
import stat
import sys
import time
from types import SimpleNamespace


HERE = Path(__file__).resolve().parent


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


bundle = load("isolation_bundle", HERE / "bundle.py")


def await_empty(runner):
    deadline = time.monotonic() + 2
    while (runner.MEMORY / "tasks").read_text().strip() or (runner.CPU / "tasks").read_text().strip():
        runner.require(time.monotonic() < deadline, "Sandbox children remain; do not release capacity.")
        time.sleep(0.01)


def observed_tasks(runner):
    tasks = set((runner.MEMORY / "tasks").read_text().splitlines())
    cpu = set((runner.CPU / "tasks").read_text().splitlines())
    count = 0
    for pid in tasks:
        runner.require(pid.isdecimal(), "Invalid observed task ID.")
        try:
            path = Path("/proc") / pid
            if (path / "comm").read_text().strip() != "python3.14":
                continue
            status = (path / "status").read_text()
            limits = (path / "limits").read_text()
            runner.require(all(re.search(r"^" + field + r":[ \t]+60000[ \t]+60000[ \t]+60000[ \t]+60000$", status, re.M)
                               for field in ("Uid", "Gid"))
                           and all(re.search(r"^" + field + r":[ \t]+0+$", status, re.M) for field in ("CapEff", "CapPrm", "CapInh", "CapAmb"))
                           and re.search(r"^NoNewPrivs:\s+1$", status, re.M) and re.search(r"^Seccomp:\s+2$", status, re.M)
                           and re.search(r"^Max processes[ \t]+8[ \t]+8[ \t]+processes[ \t]*$", limits, re.M),
                           "Unexpected process in owned job groups.")
            if pid in cpu:
                count += 1
        except (FileNotFoundError, ProcessLookupError):
            continue
    runner.require(count <= 8, "Observed more sandbox tasks than the bounded probe permits.")
    return count


def phase(runner, stream, name):
    require = runner.require
    require(not runner.WORK.exists() and not runner.MEMORY.exists() and not runner.CPU.exists(), "Old job resources remain.")
    require(runner.command([runner.ISOLATE, "--cg", "--box-id=0", "--init"]) == str(runner.WORK), "Unexpected isolation workspace.")
    box = runner.WORK / "box"
    (box / "probe.py").write_bytes(runner.regular(HERE / "probe.py", 16384))
    (box / "probe.py").chmod(0o444)
    (box / "stdin").write_bytes((name + "\n").encode("ascii"))
    maximum = 0
    def observe(names):
        nonlocal maximum
        maximum = max(maximum, observed_tasks(runner))
        return runner.identity_seen(names)
    args = [runner.ISOLATE, "--cg", "--box-id=0", "--no-default-dirs", "--dir=/box=./box:rw", "--dir=/usr", "--dir=/lib", "--dir=/lib64:maybe",
            "--env=PATH=/usr/local/bin:/usr/bin:/bin", "--env=LD_LIBRARY_PATH=/usr/local/lib64:/usr/local/lib",
            "--env=HOME=/box", "--env=TMPDIR=/box", "--env=LANG=C.UTF-8", "--processes=8", "--stack=65536", "--fsize=16384",
            "--time=4", "--extra-time=0", "--wall-time=15", "--cg-mem=524288", "--stdin=/box/stdin",
            "--stdout=/box/stdout", "--stderr=/box/stderr", "--meta=/tmp/isolation.meta", "--run", "--",
            "/usr/local/bin/ingenium-exec", "/usr/local/bin/python3.14", "-I", "-B", "/box/probe.py"]
    try:
        records = stream.collect(SimpleNamespace(WORK=runner.WORK, identity_seen=observe), args, ("stdout", "stderr"), ["python3.14"], 15)
    except Exception:
        diagnostic = {}
        for key, path in (("probe", box / "probe-failure.json"), ("metadata", Path("/tmp/isolation.meta"))):
            if path.exists() and not path.is_symlink() and path.is_file() and path.stat().st_size <= 4096:
                diagnostic[key + "_b64"] = base64.b64encode(runner.regular(path, 4096)).decode("ascii")
        print("INGENIUM_ISOLATION_DIAGNOSTIC " + json.dumps(diagnostic), flush=True)
        raise
    meta = runner.successful_metadata(runner.regular(Path("/tmp/isolation.meta"), 4096))
    stdout = stream.capture.validate(records["stdout"], "stdout")
    require(len(stdout) <= 4096 and stream.capture.validate(records["stderr"], "stderr") == b"", "Unexpected probe output or diagnostics.")
    result = json.loads(stdout)
    minimum = {"boundary": 1, "fork-limit": 8, "detached-child": 2}[name]
    require(maximum >= minimum, "Expected live parent/children were not independently observed.")
    await_empty(runner)
    usage, peak = int((runner.CPU / "cpuacct.usage").read_text()), int((runner.MEMORY / "memory.max_usage_in_bytes").read_text())
    require(0 < usage <= 4000000000 and 0 < peak <= 536870912, "Unexpected job accounting.")
    for field in ("memory.limit_in_bytes", "memory.memsw.limit_in_bytes"):
        require(int((runner.MEMORY / field).read_text()) == 536870912, "Job memory limits changed.")
    for field in ("memory.failcnt", "memory.memsw.failcnt"):
        require(int((runner.MEMORY / field).read_text()) == 0, "Normal isolation probe hit a memory limit.")
    require(not (runner.MEMORY / "tasks").read_text().strip() and not (runner.CPU / "tasks").read_text().strip(), "Sandbox children remain; do not release capacity.")
    runner.command([runner.ISOLATE, "--cg", "--box-id=0", "--cleanup"])
    require(not runner.WORK.exists() and not runner.MEMORY.exists() and not runner.CPU.exists(), "Workspace/job-group cleanup failed.")
    return {"case": name, "probe": result, "observed_tasks": maximum, "cpu_ns": usage, "peak_bytes": peak,
            "wall_seconds": meta["time-wall"], "identity_checked": True, "cleanup": True,
            "captures": {kind: stream.capture.summary(value) for kind, value in records.items()}}


def main():
    stream = load("isolation_stream_runtime", Path("/run/ingenium-streams/runtime.py"))
    runner = stream.load("isolation_profile_runtime", Path("/usr/local/share/ingenium-profiles/runtime.py"))
    require = runner.require
    require(os.geteuid() == 0 and sys.argv[1:] == ["--fixed-security"], "Only the root fixed isolation suite is allowed.")
    require(Path("/proc/self/attr/current").read_text().strip() == "ingenium-isolate-smoke-v1 (enforce)", "Wrong isolation profile.")
    status = Path("/proc/self/status").read_text()
    require(re.search(r"^NoNewPrivs:\s+1$", status, re.M) and re.search(r"^Seccomp:\s+2$", status, re.M), "Container protections changed.")
    parent = os.environ["INGENIUM_CGROUP_PARENT"]
    groups = {controllers: path for _, controllers, path in (line.split(":", 2) for line in Path("/proc/self/cgroup").read_text().splitlines())}
    require(re.fullmatch(re.escape(parent) + r"/[0-9a-f]{64}", groups["memory"])
            and groups.get("cpu,cpuacct", groups.get("cpuacct,cpu")) == groups["memory"] == groups["pids"], "Unexpected container membership.")
    load("fixed_isolation_probe_import_check", HERE / "probe.py")
    fingerprint = bundle.fingerprint()
    canary = Path("/tmp/ingenium-isolation-canary")
    marker = b"synthetic-isolation-canary-not-a-secret\n"
    with canary.open("xb") as output:
        os.fchmod(output.fileno(), 0o600)
        output.write(marker)
    os.environ["INGENIUM_PRIVATE_CANARY"] = "synthetic-not-a-secret"
    print("INGENIUM_ISOLATION_VERSIONS " + json.dumps(runner.versions(runner.load_lock())), flush=True)
    for name in bundle.CASES:
        print("INGENIUM_ISOLATION_PHASE " + name, flush=True)
        result = phase(runner, stream, name)
        require(canary.read_bytes() == marker and stat.S_IMODE(canary.stat().st_mode) == 0o600, "Synthetic canary changed.")
        print("INGENIUM_ISOLATION_RESULT " + json.dumps({"bundle_sha256": fingerprint, "result": result}, separators=(",", ":")), flush=True)
    canary.unlink()
    print("PASS: three fixed isolation cases completed with observed identity, accounted children and normal cleanup", flush=True)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        import traceback
        frames = [{"file": Path(frame.filename).name, "function": frame.name, "line": frame.lineno} for frame in traceback.extract_tb(error.__traceback__, limit=8)]
        print("INGENIUM_ISOLATION_FAILURE " + json.dumps({"error": type(error).__name__, "frames": frames}), flush=True)
        print("FAIL: fixed isolation probe or cleanup failed; preserve its private log and resources.", file=sys.stderr)
        sys.exit(1)
