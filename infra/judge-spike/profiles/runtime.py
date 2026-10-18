import base64
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import stat
import subprocess
import sys
import time


HERE = Path(__file__).resolve().parent
ISOLATE = "/usr/local/bin/isolate"
MEMORY = Path("/run/ingenium-probe-cgroups/memory/box-0")
CPU = Path("/run/ingenium-probe-cgroups/cpuacct/box-0")
WORK = Path("/var/local/lib/isolate/0")
CASES = [(b"7 5\n", b"12\n"), (b"-9 4\n", b"-5\n"), (b"2147483647 1\n", b"2147483648\n")]


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def regular(path, cap):
    require(path.is_file() and not path.is_symlink() and path.stat().st_size <= cap, "Missing/linked/oversized runtime file.")
    return path.read_bytes()


def diagnostics():
    result = {}
    for path in (Path("/tmp/isolate.log"), Path("/tmp/profile.meta"), WORK / "box" / "stderr", WORK / "box" / "stdout"):
        try:
            info = path.lstat()
            if not stat.S_ISREG(info.st_mode):
                continue
            with path.open("rb") as stream:
                prefix = stream.read(4096)
            result[str(path)] = {"prefix_b64": base64.b64encode(prefix).decode("ascii"),
                                 "observed_bytes": info.st_size, "truncated": info.st_size > len(prefix)}
        except OSError:
            continue
    return result


def load_lock():
    lock = json.loads(regular(HERE / "lock.json", 16384))
    require(type(lock["schema"]) is int and lock["schema"] == 1 and lock["platform"] == "linux/amd64"
            and list(lock["profiles"]) == ["c", "cpp", "java", "python", "javascript"], "Unexpected fixed profile set.")
    for profile in lock["profiles"].values():
        name = profile["source"]
        require(re.fullmatch(r"(?:main\.(?:c|cpp|py|cjs)|Main\.java)", name) is not None, "Unexpected fixture path.")
        require(hashlib.sha256(regular(HERE / "fixtures" / name, 4096)).hexdigest() == profile["sha256"], "Changed fixed source.")
    return lock


def command(args):
    result = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, check=True, timeout=30)
    require(len(result.stdout) <= 16384, "Oversized toolchain observation.")
    return result.stdout.decode("ascii").strip()


def versions(lock):
    observed = {
        "gcc": command(["/usr/local/bin/gcc", "-dumpfullversion"]),
        "g++": command(["/usr/local/bin/g++", "-dumpfullversion"]),
        "python": command(["/usr/local/bin/python3.14", "-I", "-B", "-c", "import sys; print(sys.version.split()[0])"]),
        "node": command(["/usr/local/bin/node", "--version"]),
        "javac": command(["/usr/local/java/bin/javac", "--version"]),
        "java": command(["/usr/local/java/bin/java", "--version"]),
        "isolate": command([ISOLATE, "--version"]),
    }
    binaries = ["/usr/local/bin/gcc", "/usr/local/bin/g++", "/usr/local/bin/python3.14", "/usr/local/bin/node",
                "/usr/local/java/bin/java", "/usr/local/java/bin/javac", ISOLATE, "/usr/local/bin/ingenium-exec",
                "/usr/local/lib/libcap.so.2"]
    observed["binary_sha256"] = {name: hashlib.sha256(regular(Path(name).resolve(), 268435456)).hexdigest() for name in binaries}
    validate_versions(lock, observed)
    require(command(["/usr/local/bin/python3.14", "-I", "-B", "-c",
                     "import ssl,sqlite3,bz2,lzma,ctypes,math,zlib,decimal,compression.zstd; print('stdlib-ok')"]) == "stdlib-ok", "Missing console standard-library dependency.")
    return observed


def validate_versions(lock, observed):
    require(type(observed) is dict and set(observed) == {"gcc", "g++", "python", "node", "java", "javac", "isolate", "binary_sha256"}, "Incomplete toolchain observations.")
    expected = lock["images"]
    require(all(type(observed[key]) is str for key in observed if key != "binary_sha256"), "Invalid toolchain version text.")
    require(observed["gcc"] == observed["g++"] == expected["gcc"]["version"], "Wrong C/C++ patch.")
    require(observed["python"] == expected["python"]["version"], "Wrong Python patch.")
    require(observed["node"] == "v" + expected["node"]["version"], "Wrong Node patch.")
    require(observed["javac"] == "javac " + expected["java"]["version"].split("+")[0]
            and expected["java"]["version"] in observed["java"], "Wrong JDK build.")
    hashes = observed["binary_sha256"]
    paths = {"/usr/local/bin/gcc", "/usr/local/bin/g++", "/usr/local/bin/python3.14", "/usr/local/bin/node",
             "/usr/local/java/bin/java", "/usr/local/java/bin/javac", ISOLATE, "/usr/local/bin/ingenium-exec", "/usr/local/lib/libcap.so.2"}
    require(type(hashes) is dict and set(hashes) == paths and hashes.get(ISOLATE) == lock["isolate_sha256"]
            and all(type(value) is str and re.fullmatch(r"[0-9a-f]{64}", value) for value in hashes.values()), "Missing/changed binary fingerprints.")


def successful_metadata(raw):
    values = {}
    for line in raw.decode("ascii").splitlines():
        key, separator, value = line.partition(":")
        require(separator and key not in values, "Malformed/duplicate phase metadata.")
        values[key] = value
    require(set(values) == {"time", "time-wall", "max-rss", "csw-voluntary", "csw-forced", "cg-mem", "exitcode"}
            and values["exitcode"] == "0", "Phase is not a clean success.")
    for key, value in values.items():
        require(re.fullmatch(r"[0-9]+(?:\.[0-9]+)?" if key in ("time", "time-wall") else r"[0-9]+", value) is not None,
                "Malformed phase metric.")
    return values


def identity_seen(names):
    try:
        for pid in (MEMORY / "tasks").read_text().splitlines():
            require(pid.isdecimal(), "Invalid controller task ID.")
            process = Path("/proc") / pid
            try:
                if process.joinpath("comm").read_text().strip() not in names:
                    continue
                status = process.joinpath("status").read_text()
                limits = process.joinpath("limits").read_text()
                require(all(re.search(r"^" + field + r":[ \t]+60000[ \t]+60000[ \t]+60000[ \t]+60000$", status, re.M)
                            for field in ("Uid", "Gid")), "Observed executable has the wrong sandbox identity.")
                require(re.search(r"^Max open files[ \t]+256[ \t]+256[ \t]+files[ \t]*$", limits, re.M), "Observed executable has wrong descriptor limits.")
                if pid in (CPU / "tasks").read_text().splitlines():
                    return True
            except FileNotFoundError:
                continue
    except FileNotFoundError:
        return False
    return False


def phase(profile, *, compiling, stdin, artifact=None):
    require(not WORK.exists() and not MEMORY.exists() and not CPU.exists(), "Previous workspace/groups remain.")
    require(command([ISOLATE, "--cg", "--box-id=0", "--init"]) == str(WORK), "Unexpected sandbox workspace.")
    box = WORK / "box"
    source = box / profile["source"]
    source.write_bytes(regular(HERE / "fixtures" / profile["source"], 4096))
    source.chmod(0o444)
    require(hashlib.sha256(source.read_bytes()).hexdigest() == profile["sha256"], "Copied source hash differs.")
    if artifact is not None:
        shutil.copyfile(artifact, box / profile["artifact"])
        (box / profile["artifact"]).chmod(0o555)
    (box / "stdin").write_bytes(stdin)
    memory = 1073741824 if compiling else 536870912
    cpu_seconds, wall_seconds = (15, 30) if compiling else (profile["cpu"], profile["wall"])
    args = [ISOLATE, "--cg", "--box-id=0", "--no-default-dirs", "--dir=/box=./box:rw", "--dir=/usr", "--dir=/lib", "--dir=/lib64:maybe",
            "--env=PATH=/usr/local/java/bin:/usr/local/bin:/usr/bin:/bin", "--env=LD_LIBRARY_PATH=/usr/local/lib64:/usr/local/lib:/usr/local/java/lib:/usr/local/java/lib/server",
            "--env=HOME=/box", "--env=TMPDIR=/box", "--env=LANG=C.UTF-8", "--env=JAVA_HOME=/usr/local/java", "--env=UV_THREADPOOL_SIZE=1",
            "--processes=64", "--stack=65536", "--fsize=16384", f"--time={cpu_seconds}", "--extra-time=0",
            f"--wall-time={wall_seconds}", f"--cg-mem={memory // 1024}", "--stdin=/box/stdin", "--stdout=/box/stdout",
            "--stderr=/box/stderr", "--meta=/tmp/profile.meta", "--run", "--", "/usr/local/bin/ingenium-exec",
            *(profile["compile"] if compiling else profile["run"])]
    # No RLIMIT_AS: JVM/V8 reservations are not resident memory; cgroups enforce RAM.
    seen = False
    with Path("/tmp/isolate.log").open("wb") as log:
        process = subprocess.Popen(args, stdout=log, stderr=subprocess.STDOUT)
        deadline = time.monotonic() + wall_seconds + 5
        while process.poll() is None:
            seen = identity_seen(profile["compile_comm"] if compiling else profile["run_comm"]) or seen
            require(time.monotonic() < deadline, "Isolate exceeded the trusted phase deadline; retain evidence.")
            time.sleep(0.005)
        require(process.returncode == 0, "Isolate phase failed; inspect the retained profile log/workspace.")
    require(seen, "Expected executable identity/accounting was not observed.")
    meta = successful_metadata(regular(Path("/tmp/profile.meta"), 4096))
    usage = int((CPU / "cpuacct.usage").read_text())
    peak = int((MEMORY / "memory.max_usage_in_bytes").read_text())
    require(0 < usage <= cpu_seconds * 1000000000 and 0 < peak <= memory, "Unexpected phase accounting.")
    for field in ("memory.limit_in_bytes", "memory.memsw.limit_in_bytes"):
        require(int((MEMORY / field).read_text()) == memory, "Job memory cap differs.")
    for field in ("memory.failcnt", "memory.memsw.failcnt"):
        require(int((MEMORY / field).read_text()) == 0, "Successful phase hit a memory limit.")
    require(not (MEMORY / "tasks").read_text().strip() and not (CPU / "tasks").read_text().strip(), "Phase tasks remain.")
    stdout = regular(box / "stdout", 65536)
    require(regular(box / "stderr", 65536) == b"" and (not compiling or stdout == b""), "Unexpected successful-phase diagnostics.")
    if compiling:
        target = box / profile["artifact"]
        regular(target, 16777216)
        shutil.copyfile(target, Path("/tmp") / profile["artifact"])
    command([ISOLATE, "--cg", "--box-id=0", "--cleanup"])
    require(not WORK.exists() and not MEMORY.exists() and not CPU.exists(), "Phase cleanup incomplete.")
    return {"stdout_b64": base64.b64encode(stdout).decode("ascii"), "cpu_ns": usage, "peak_bytes": peak,
            "wall_seconds": meta["time-wall"], "identity_checked": True}


def parity(lock):
    require(os.geteuid() == 0 and Path("/proc/self/attr/current").read_text().strip() == "ingenium-isolate-smoke-v1 (enforce)", "Wrong trusted container context.")
    status = Path("/proc/self/status").read_text()
    require(re.search(r"^NoNewPrivs:\s+1$", status, re.M) and re.search(r"^Seccomp:\s+2$", status, re.M), "Container protections changed.")
    parent = os.environ["INGENIUM_CGROUP_PARENT"]
    groups = {controllers: path for _, controllers, path in (line.split(":", 2) for line in Path("/proc/self/cgroup").read_text().splitlines())}
    member = groups["memory"]
    require(re.fullmatch(re.escape(parent) + r"/[0-9a-f]{64}", member) is not None
            and groups.get("cpu,cpuacct", groups.get("cpuacct,cpu")) == member and groups["pids"] == member,
            "Runtime container is outside the bounded common parent.")
    print("INGENIUM_PROFILE_VERSIONS " + json.dumps(versions(lock)), flush=True)
    for name, profile in lock["profiles"].items():
        compiled = phase(profile, compiling=True, stdin=b"") if profile["compile"] else None
        results = []
        for stdin, expected in CASES:
            result = phase(profile, compiling=False, stdin=stdin,
                           artifact=Path("/tmp") / profile["artifact"] if compiled else None)
            require(base64.b64decode(result["stdout_b64"]) == expected, "A fixed language answer differs.")
            results.append(dict(result, stdin_b64=base64.b64encode(stdin).decode("ascii")))
        print("INGENIUM_PROFILE_RESULT " + json.dumps({"profile": name, "source_sha256": profile["sha256"], "compile": compiled, "cases": results}), flush=True)
    print("PASS: all five profiles completed with fresh job groups and exact answers", flush=True)


if __name__ == "__main__":
    try:
        require(sys.argv[1:] in (["--versions"], ["--parity"]), "Only fixed version/parity modes are supported.")
        config = load_lock()
        if sys.argv[1] == "--versions":
            print("INGENIUM_PROFILE_VERSIONS " + json.dumps(versions(config)))
        else:
            parity(config)
    except (RuntimeError, OSError, ValueError, KeyError, subprocess.SubprocessError) as error:
        print("INGENIUM_PROFILE_DIAGNOSTIC " + json.dumps(diagnostics()), flush=True)
        print("FAIL: " + str(error), file=sys.stderr)
        sys.exit(1)
