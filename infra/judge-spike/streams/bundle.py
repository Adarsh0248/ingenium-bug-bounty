import hashlib
import json
from pathlib import Path


HERE = Path(__file__).resolve().parent
FILES = ("bundle.py", "capture.py", "cases.py", "runtime.py", "fixtures/main.c", "fixtures/main.cpp",
         "fixtures/Main.java", "fixtures/main.py", "fixtures/main.cjs")


def fingerprint():
    entries = {path.relative_to(HERE).as_posix(): path for path in HERE.rglob("*")}
    if set(entries) != set(FILES) | {"fixtures"} or not entries["fixtures"].is_dir() or entries["fixtures"].is_symlink():
        raise RuntimeError("Unexpected stream bundle inventory.")
    hashes = {}
    for name in FILES:
        path = entries[name]
        if not path.is_file() or path.is_symlink() or path.stat().st_size > 32768:
            raise RuntimeError("Missing, linked or oversized stream bundle input.")
        hashes[name] = hashlib.sha256(path.read_bytes()).hexdigest()
    return hashlib.sha256(json.dumps(hashes, sort_keys=True, separators=(",", ":")).encode("ascii")).hexdigest()


if __name__ == "__main__":
    print(fingerprint())
