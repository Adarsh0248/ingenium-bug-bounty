import hashlib
import json
from pathlib import Path


HERE = Path(__file__).resolve().parent
FILES = ("bundle.py", "cases.py", "rules.py", "runtime.py")


def fingerprint():
    entries = {path.name: path for path in HERE.iterdir()}
    if set(entries) != set(FILES): raise RuntimeError("Unexpected verdict bundle inventory.")
    hashes = {}
    for name in FILES:
        path = entries[name]
        if not path.is_file() or path.is_symlink() or path.stat().st_size > 32768:
            raise RuntimeError("Missing, linked or oversized verdict source.")
        hashes[name] = hashlib.sha256(path.read_bytes()).hexdigest()
    return hashlib.sha256(json.dumps(hashes, sort_keys=True, separators=(",", ":")).encode("ascii")).hexdigest()


if __name__ == "__main__": print(fingerprint())
