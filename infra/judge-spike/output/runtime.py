import base64
import functools
import importlib.util
import json
from pathlib import Path
import sys


HERE = Path(__file__).resolve().parent


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


bundle = load("output_runtime_bundle", HERE / "bundle.py")


def probe_phase(runner, stream, name):
    require = runner.require
    require(not runner.WORK.exists() and not runner.MEMORY.exists() and not runner.CPU.exists(), "Previous output job resources remain.")
    require(runner.command([runner.ISOLATE, "--cg", "--box-id=0", "--init"]) == str(runner.WORK), "Unexpected output workspace.")
    box = runner.WORK / "box"
    (box / "probe.py").write_bytes(runner.regular(HERE / "probe.py", 16384))
    (box / "probe.py").chmod(0o444)
    (box / "stdin").write_bytes((name + "\n").encode("ascii"))
    args = [runner.ISOLATE, "--cg", "--box-id=0", "--no-default-dirs", "--dir=/box=./box:rw", "--dir=/usr", "--dir=/lib", "--dir=/lib64:maybe",
            "--env=PATH=/usr/local/bin:/usr/bin:/bin", "--env=LD_LIBRARY_PATH=/usr/local/lib64:/usr/local/lib",
            "--env=HOME=/box", "--env=TMPDIR=/box", "--env=LANG=C.UTF-8", "--processes=8", "--stack=65536", "--fsize=16384",
            "--time=4", "--extra-time=0", "--wall-time=15", "--cg-mem=524288", "--stdin=/box/stdin",
            "--stdout=/box/stdout", "--stderr=/box/stderr", "--meta=/tmp/output.meta", "--run", "--",
            "/usr/local/bin/ingenium-exec", "/usr/local/bin/python3.14", "-I", "-B", "/box/probe.py"]
    records = stream.collect(runner, args, ("stdout", "stderr"), ["python3.14"], 15)
    meta = runner.successful_metadata(runner.regular(Path("/tmp/output.meta"), 4096))
    if name == "early-close":
        require(runner.regular(box / "finished", 64) == b"finished after closing output\n", "Capture returned before the program finished.")
    require(all(stream.capture.validate(records[kind], kind) == expected
                for kind, expected in zip(("stdout", "stderr"), bundle.EXPECTED[name])), "Captured probe bytes differ from the real writes.")
    usage, peak = int((runner.CPU / "cpuacct.usage").read_text()), int((runner.MEMORY / "memory.max_usage_in_bytes").read_text())
    require(0 < usage <= 4000000000 and 0 < peak <= 536870912, "Unexpected protected-output accounting.")
    require(all(int((runner.MEMORY / field).read_text()) == 536870912 for field in ("memory.limit_in_bytes", "memory.memsw.limit_in_bytes"))
            and all(int((runner.MEMORY / field).read_text()) == 0 for field in ("memory.failcnt", "memory.memsw.failcnt")), "Output job memory limits differ or were hit.")
    require(not (runner.MEMORY / "tasks").read_text().strip() and not (runner.CPU / "tasks").read_text().strip(), "Output job tasks remain; do not release it.")
    runner.command([runner.ISOLATE, "--cg", "--box-id=0", "--cleanup"])
    require(not runner.WORK.exists() and not runner.MEMORY.exists() and not runner.CPU.exists(), "Output job cleanup is incomplete.")
    return {"case": name, "cpu_ns": usage, "peak_bytes": peak, "wall_seconds": meta["time-wall"], "identity_checked": True,
            "cleanup": True, "captures": {kind: stream.capture.summary(record) for kind, record in records.items()}}


def main():
    if sys.argv[1:] != ["--fixed-output"]:
        raise RuntimeError("Only the fixed protected-output suite is supported.")
    collector = load("protected_output_collector", HERE / "collect.py")
    stream = load("protected_output_fixtures", Path("/run/ingenium-streams/runtime.py"))
    fingerprint = bundle.fingerprint()
    # Reuse the frozen fixtures/checker without modifying their historical bundle.
    stream.collect = functools.partial(collector.collect, capture=stream.capture)
    print("INGENIUM_OUTPUT_BUNDLE " + fingerprint, flush=True)
    sys.argv[1:] = ["--fixed-suite"]
    stream.main()
    runner = stream.load("protected_output_profile_runtime", Path("/usr/local/share/ingenium-profiles/runtime.py"))
    for name in bundle.CASES:
        result = probe_phase(runner, stream, name)
        print("INGENIUM_OUTPUT_RESULT " + json.dumps(result, separators=(",", ":")), flush=True)
    print("PASS: protected output completed fifty language cases and three tampering/EOF probes with normal cleanup", flush=True)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        import traceback
        diagnostic = {}
        for name in ("output-isolate.log", "profile.meta", "output.meta"):
            path = Path("/tmp") / name
            if path.is_file() and not path.is_symlink() and path.stat().st_size <= 4096:
                diagnostic[name + "_b64"] = base64.b64encode(path.read_bytes()).decode("ascii")
        print("INGENIUM_OUTPUT_DIAGNOSTIC " + json.dumps(diagnostic), flush=True)
        frames = [{"file": Path(frame.filename).name, "function": frame.name, "line": frame.lineno} for frame in traceback.extract_tb(error.__traceback__, limit=8)]
        print("INGENIUM_OUTPUT_FAILURE " + json.dumps({"error": type(error).__name__, "frames": frames}), flush=True)
        print("FAIL: protected output or cleanup failed; preserve its private checkpoint and resources.", file=sys.stderr)
        sys.exit(1)
