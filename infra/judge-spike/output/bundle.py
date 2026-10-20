import hashlib
import json
from pathlib import Path


HERE = Path(__file__).resolve().parent
FILES = ("bundle.py", "collect.py", "runtime.py", "probe.py")
CASES = ("replace-paths", "read-and-leak", "early-close")
EXPECTED = {"replace-paths": (b"REAL ANSWER\n", b"REAL DIAGNOSTIC\n"),
            "read-and-leak": (b"WRITE_ONLY_NO_LEAKS\n", b""),
            "early-close": (b"CLOSED_BEFORE_EXIT\n", b"")}


def fingerprint():
    entries = {path.name: path for path in HERE.iterdir()}
    if set(entries) != set(FILES):
        raise RuntimeError("Unexpected protected-output bundle inventory.")
    hashes = {}
    for name in FILES:
        path = entries[name]
        if not path.is_file() or path.is_symlink() or path.stat().st_size > 32768:
            raise RuntimeError("Missing, linked or oversized protected-output source.")
        hashes[name] = hashlib.sha256(path.read_bytes()).hexdigest()
    return hashlib.sha256(json.dumps(hashes, sort_keys=True, separators=(",", ":")).encode("ascii")).hexdigest()


if __name__ == "__main__":
    print(fingerprint())
