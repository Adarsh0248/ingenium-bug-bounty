import hashlib
import json
from pathlib import Path


HERE = Path(__file__).resolve().parent
FILES = ("bundle.py", "runtime.py", "probe.py")
CASES = ("boundary", "fork-limit", "detached-child")
FORBIDDEN_ENV = ("INGENIUM_PRIVATE_CANARY", "INGENIUM_CGROUP_PARENT", "AUTHN_TOKEN", "POSTGRES_PASSWORD",
                 "REDIS_PASSWORD", "SECRET_KEY_BASE", "GOOGLE_APPLICATION_CREDENTIALS")
HIDDEN_PATHS = ("/tmp/ingenium-isolation-canary", "/api/judge0.conf", "/opt/ingenium-judge-spike/judge0.conf",
                "/run/ingenium-probe-cgroups/memory/box-0/tasks", "/proc/self/status", "/sys/fs/cgroup",
                "/var/run/docker.sock", "/box/../../tmp/ingenium-isolation-canary")


def fingerprint():
    paths = {path.name: path for path in HERE.iterdir()}
    if set(paths) != set(FILES) or any(not path.is_file() or path.is_symlink() or path.stat().st_size > 32768 for path in paths.values()):
        raise RuntimeError("Unexpected fixed isolation bundle.")
    hashes = {name: hashlib.sha256(paths[name].read_bytes()).hexdigest() for name in FILES}
    return hashlib.sha256(json.dumps(hashes, sort_keys=True, separators=(",", ":")).encode("ascii")).hexdigest()


if __name__ == "__main__":
    print(fingerprint())
