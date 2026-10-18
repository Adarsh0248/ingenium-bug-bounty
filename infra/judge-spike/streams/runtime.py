import base64
import contextlib
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import selectors
import shutil
import stat
import subprocess
import sys
import time
import traceback


HERE = Path(__file__).resolve().parent
# shortcut: fixed trusted fixtures only; protect pipe endpoints and map nonzero phases before participant execution.


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


capture = load("stream_capture", HERE / "capture.py")
cases = load("stream_cases", HERE / "cases.py")
bundle = load("stream_bundle", HERE / "bundle.py")
require = capture.require
TRANSPORT = {"c": (0, 50), "cpp": (2, 54), "java": (3, 62), "python": (5, 71), "javascript": (8, 63)}


def failure_info(error):
    return {"error": type(error).__name__, "frames": [
        {"file": Path(frame.filename).name, "function": frame.name, "line": frame.lineno}
        for frame in traceback.extract_tb(error.__traceback__, limit=8)]}


def collect(runner, args, kinds, names, wall):
    buffers = {kind: capture.Capture(kind) for kind in kinds}
    with contextlib.ExitStack() as stack:
        selector = stack.enter_context(selectors.DefaultSelector())
        keepers = []
        for kind in kinds:
            path = runner.WORK / "box" / kind
            os.mkfifo(path, 0o600)
            reader = os.open(path, os.O_RDONLY | os.O_NONBLOCK | os.O_NOFOLLOW)
            stack.callback(os.close, reader)
            keeper = os.open(path, os.O_WRONLY | os.O_NONBLOCK | os.O_NOFOLLOW)
            keepers.append(keeper)
            require(stat.S_ISFIFO(os.fstat(reader).st_mode) and os.fstat(reader).st_ino == os.fstat(keeper).st_ino,
                    "Stream descriptor is not the owned FIFO.")
            selector.register(reader, selectors.EVENT_READ, kind)
        # Keep a writer until Isolate exits, so pre-launch silence cannot become false EOF.
        try:
            with Path("/tmp/isolate.log").open("wb") as log:
                process = subprocess.Popen(args, stdout=log, stderr=subprocess.STDOUT)
                seen = False
                deadline = time.monotonic() + wall + 5
                while selector.get_map():
                    require(time.monotonic() < deadline, "Capture deadline exceeded; preserve the uncertain workspace.")
                    try:
                        seen = runner.identity_seen(names) or seen
                    except ProcessLookupError:
                        pass  # A vanished task is not a positive identity observation.
                    if process.poll() is not None and keepers:
                        for fd in keepers:
                            os.close(fd)
                        keepers.clear()
                    for key, _ in selector.select(0.005):
                        try:
                            data = os.read(key.fd, 65536)
                        except BlockingIOError:
                            continue
                        if data:
                            buffers[key.data].feed(data)
                        else:
                            require(process.poll() is not None and not keepers, "Unexpected EOF while the owned writer is running.")
                            buffers[key.data].eof = True
                            selector.unregister(key.fd)
                require(process.wait(timeout=1) == 0 and seen, "Phase failed or sandbox identity was not observed.")
        finally:
            for fd in keepers:
                os.close(fd)
    return {kind: value.record() for kind, value in buffers.items()}


def phase(runner, profile, *, compiling, index=0, artifact=None, transport=False):
    print("INGENIUM_STREAM_PHASE " + json.dumps({"source": profile["source"], "phase": "compile" if compiling else "run",
          "case": None if compiling else index}), flush=True)
    require(not runner.WORK.exists() and not runner.MEMORY.exists() and not runner.CPU.exists(), "Previous workspace/job groups remain.")
    require(runner.command([runner.ISOLATE, "--cg", "--box-id=0", "--init"]) == str(runner.WORK), "Unexpected stream workspace.")
    box = runner.WORK / "box"
    source = HERE / "fixtures" / profile["source"]
    raw = runner.regular(source, 8192)
    (box / profile["source"]).write_bytes(raw)
    (box / profile["source"]).chmod(0o444)
    if artifact is not None:
        shutil.copyfile(artifact, box / profile["artifact"])
        (box / profile["artifact"]).chmod(0o555)
    (box / "stdin").write_bytes(b"" if compiling else (str(index) + "\n").encode("ascii"))
    memory = 1073741824 if compiling else 536870912
    cpu, wall = (15, 30) if compiling else (profile["cpu"], profile["wall"])
    stdout, stderr = ("compiler", "compiler") if compiling else ("stdout", "stderr")
    args = [runner.ISOLATE, "--cg", "--box-id=0", "--no-default-dirs", "--dir=/box=./box:rw", "--dir=/usr", "--dir=/lib", "--dir=/lib64:maybe",
            "--env=PATH=/usr/local/java/bin:/usr/local/bin:/usr/bin:/bin", "--env=LD_LIBRARY_PATH=/usr/local/lib64:/usr/local/lib:/usr/local/java/lib:/usr/local/java/lib/server",
            "--env=HOME=/box", "--env=TMPDIR=/box", "--env=LANG=C.UTF-8", "--env=JAVA_HOME=/usr/local/java", "--env=UV_THREADPOOL_SIZE=1",
            "--processes=64", "--stack=65536", "--fsize=16384", f"--time={cpu}", "--extra-time=0", f"--wall-time={wall}", f"--cg-mem={memory // 1024}",
            "--stdin=/box/stdin", "--stdout=/box/" + stdout, "--stderr=/box/" + stderr,
            "--meta=/tmp/profile.meta", "--run", "--", "/usr/local/bin/ingenium-exec",
            *(profile["compile"] if compiling else profile["run"])]
    records = collect(runner, args, ("compiler",) if compiling else ("stdout", "stderr"),
                      profile["compile_comm"] if compiling else profile["run_comm"], wall)
    meta = runner.successful_metadata(runner.regular(Path("/tmp/profile.meta"), 4096))
    usage, peak = int((runner.CPU / "cpuacct.usage").read_text()), int((runner.MEMORY / "memory.max_usage_in_bytes").read_text())
    require(0 < usage <= cpu * 1000000000 and 0 < peak <= memory, "Unexpected stream phase accounting.")
    for field in ("memory.limit_in_bytes", "memory.memsw.limit_in_bytes"):
        require(int((runner.MEMORY / field).read_text()) == memory, "Stream job memory cap differs.")
    for field in ("memory.failcnt", "memory.memsw.failcnt"):
        require(int((runner.MEMORY / field).read_text()) == 0, "A supposedly normal stream phase hit a memory limit.")
    require(not (runner.MEMORY / "tasks").read_text().strip() and not (runner.CPU / "tasks").read_text().strip(), "Stream job tasks remain.")
    wire = json.dumps(records, separators=(",", ":")).encode("ascii")
    require(len(wire) <= 2097152, "Bounded stream envelope exceeded the approved transport ceiling.")
    decoded = json.loads(wire)
    for kind, record in decoded.items():
        capture.validate(record, kind)
    if compiling:
        require(capture.validate(decoded["compiler"], "compiler") == b"", "Unexpected fixed-fixture compiler diagnostics.")
        target = box / profile["artifact"]
        runner.regular(target, 16777216)
        shutil.copyfile(target, Path("/tmp") / profile["artifact"])
        verdicts = None
    else:
        out, err = cases.output(index)
        for kind, data in (("stdout", out), ("stderr", err)):
            wanted = capture.Capture(kind)
            for offset in range(0, len(data), 65536):
                wanted.feed(data[offset:offset + 65536])
            wanted.eof = True
            require(decoded[kind] == wanted.record(), "Captured stream bytes/counts differ from the fixed fixture.")
        verdicts = {mode: capture.check(decoded["stdout"], cases.expected(index), mode) for mode in ("tokens", "exact")}
    runner.command([runner.ISOLATE, "--cg", "--box-id=0", "--cleanup"])
    require(not runner.WORK.exists() and not runner.MEMORY.exists() and not runner.CPU.exists(), "Stream phase cleanup incomplete.")
    return {"cpu_ns": usage, "peak_bytes": peak, "wall_seconds": meta["time-wall"], "identity_checked": True,
            "captures": decoded if transport else {kind: capture.summary(record) for kind, record in decoded.items()},
            "verdicts": verdicts, "cleanup": True}


def bound_job(raw, fingerprint, lock):
    require(len(raw) <= 8192 and hashlib.sha256(raw).hexdigest() == fingerprint, "Bound job fingerprint differs.")
    job = json.loads(raw)
    require(type(job) is dict and set(job) == {"profile", "case", "source_sha256", "stdin_b64", "binding", "owner_id"}
            and type(job["profile"]) is str and job["profile"] in TRANSPORT
            and type(job["case"]) is int and job["case"] == TRANSPORT[job["profile"]][0], "Unknown fixed transport job.")
    profile = lock["profiles"][job["profile"]]
    require(job["source_sha256"] == hashlib.sha256((HERE / "fixtures" / profile["source"]).read_bytes()).hexdigest()
            and job["stdin_b64"] == base64.b64encode((str(job["case"]) + "\n").encode("ascii")).decode("ascii"),
            "Bound source/input differ from the trusted fixture.")
    require(type(job["binding"]) is dict and set(job["binding"]) == {"attempt_id", "host_epoch", "manifest_sha256", "payload_sha256"},
            "Missing transport binding.")
    for key, value in {**job["binding"], "owner_id": job["owner_id"]}.items():
        require(type(value) is str and re.fullmatch(r"[0-9a-f]{64}" if key.endswith("sha256") else r"[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}", value),
                "Invalid bound transport identity.")
    return job, profile


def main():
    args = sys.argv[1:]
    require((args == ["--fixed-suite"] or (len(args) == 2 and args[0] == "--bound-job" and re.fullmatch(r"[0-9a-f]{64}", args[1])))
            and os.geteuid() == 0, "Only the root fixed stream lab is supported.")
    require(Path("/proc/self/attr/current").read_text().strip() == "ingenium-isolate-smoke-v1 (enforce)", "Wrong stream container policy.")
    status = Path("/proc/self/status").read_text()
    require(re.search(r"^NoNewPrivs:\s+1$", status, re.M) and re.search(r"^Seccomp:\s+2$", status, re.M), "Stream container protections changed.")
    parent = os.environ["INGENIUM_CGROUP_PARENT"]
    groups = {controllers: path for _, controllers, path in (line.split(":", 2) for line in Path("/proc/self/cgroup").read_text().splitlines())}
    require(re.fullmatch(re.escape(parent) + r"/[0-9a-f]{64}", groups["memory"])
            and groups.get("cpu,cpuacct", groups.get("cpuacct,cpu")) == groups["memory"] == groups["pids"], "Stream container is outside its bounded parent.")
    fingerprint = bundle.fingerprint()
    runner = load("frozen_profile_runtime", Path("/usr/local/share/ingenium-profiles/runtime.py"))
    lock = runner.load_lock()
    print("INGENIUM_STREAM_VERSIONS " + json.dumps(runner.versions(lock)), flush=True)
    if args[0] == "--bound-job":
        job, profile = bound_job(runner.regular(Path("/run/ingenium-stream-job.json"), 8192), args[1], lock)
        compiled = phase(runner, profile, compiling=True, transport=True) if profile["compile"] else None
        result = phase(runner, profile, compiling=False, index=job["case"], transport=True,
                       artifact=Path("/tmp") / profile["artifact"] if compiled else None)
        print("INGENIUM_BOUND_STREAM_RESULT " + json.dumps({"job": job, "bundle_sha256": fingerprint,
              "compile": compiled, "result": result}, separators=(",", ":")), flush=True)
        print("PASS: bound stream job completed with exact bytes, identity and normal cleanup", flush=True)
        return
    for name in ("c", "cpp", "java", "python", "javascript"):
        profile = lock["profiles"][name]
        compiled = phase(runner, profile, compiling=True) if profile["compile"] else None
        results = [phase(runner, profile, compiling=False, index=index, artifact=Path("/tmp") / profile["artifact"] if compiled else None)
                   for index in range(len(cases.CASES))]
        print("INGENIUM_STREAM_RESULT " + json.dumps({"profile": name, "bundle_sha256": fingerprint,
              "source_sha256": hashlib.sha256((HERE / "fixtures" / profile["source"]).read_bytes()).hexdigest(),
              "compile": compiled, "cases": results}), flush=True)
    print("PASS: fifty fixed stream cases completed with EOF, exact bytes, identities and normal cleanup", flush=True)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print("INGENIUM_STREAM_FAILURE " + json.dumps(failure_info(error)), flush=True)
        print("FAIL: " + (str(error) if isinstance(error, RuntimeError) else type(error).__name__)
              + "; preserve the stream workspace and private log.", file=sys.stderr)
        sys.exit(1)
