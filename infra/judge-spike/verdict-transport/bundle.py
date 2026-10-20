import hashlib
import json
from pathlib import Path
import re
import uuid


HERE = Path(__file__).resolve().parent
FILES = ("bundle.py", "runtime.py")


def require(condition, message):
    if not condition: raise RuntimeError(message)


def fingerprint():
    entries = {path.name: path for path in HERE.iterdir()}
    require(set(entries) == set(FILES), "Unexpected bound-verdict source inventory.")
    hashes = {}
    for name, path in entries.items():
        require(path.is_file() and not path.is_symlink() and path.stat().st_size <= 32768, "Missing/linked/oversized bound-verdict source.")
        hashes[name] = hashlib.sha256(path.read_bytes()).hexdigest()
    return hashlib.sha256(json.dumps(hashes, sort_keys=True, separators=(",", ":")).encode("ascii")).hexdigest()


def checked_job(value, cases):
    require(type(value) is dict and set(value) == {"case_id", "binding", "owner_id", "provider_token", "submission_id", "stream_sha256", "output_sha256", "verdict_sha256"}, "Wrong bound-verdict job fields.")
    case = next((case for case in cases if case["id"] == value["case_id"]), None)
    require(case is not None and type(value["submission_id"]) is int and value["submission_id"] > 0, "Unknown fixed case/provider identity.")
    binding = value["binding"]
    require(type(binding) is dict and set(binding) == {"attempt_id", "host_epoch", "manifest_sha256", "payload_sha256"}, "Wrong bound execution identity.")
    for item in (value["owner_id"], value["provider_token"], binding["attempt_id"], binding["host_epoch"]):
        require(type(item) is str and str(uuid.UUID(item)) == item and uuid.UUID(item).version == 4, "Noncanonical execution UUID.")
    for item in (binding["manifest_sha256"], binding["payload_sha256"], value["stream_sha256"], value["output_sha256"], value["verdict_sha256"]):
        require(type(item) is str and re.fullmatch(r"[0-9a-f]{64}", item), "Invalid frozen execution fingerprint.")
    return case


if __name__ == "__main__": print(fingerprint())
