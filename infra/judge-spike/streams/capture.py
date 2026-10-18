import base64
import binascii
import hashlib
import re


LIMITS = {"stdout": (1048576, 1048577), "stderr": (65536, 65536), "compiler": (65536, 65536)}
FIELDS = {"kind", "observed_bytes", "retained_bytes", "eof", "complete", "truncated", "sha256", "data_b64"}
CHECKER_VERSION = 1


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


class Capture:
    def __init__(self, kind):
        require(type(kind) is str and kind in LIMITS, "Unknown stream kind.")
        self.kind = kind
        self.observed = 0
        self.prefix = bytearray()
        self.eof = False

    def feed(self, data):
        require(type(data) is bytes and len(data) <= 65536 and not self.eof, "Invalid/late capture chunk.")
        self.observed += len(data)
        require(self.observed < 2 ** 64, "Stream byte counter exceeded its bound.")
        remaining = LIMITS[self.kind][1] - len(self.prefix)
        self.prefix.extend(data[:remaining])

    def record(self):
        require(self.eof is True, "Missing stream EOF; output is not proven complete.")
        raw = bytes(self.prefix)
        return {"kind": self.kind, "observed_bytes": self.observed, "retained_bytes": len(raw),
                "eof": True, "complete": len(raw) == self.observed, "truncated": len(raw) < self.observed,
                "sha256": hashlib.sha256(raw).hexdigest(), "data_b64": base64.b64encode(raw).decode("ascii")}


def validate(record, kind):
    require(type(kind) is str and kind in LIMITS and type(record) is dict and set(record) == FIELDS and record["kind"] == kind,
            "Missing or mismatched stream evidence.")
    count, retained = record["observed_bytes"], record["retained_bytes"]
    maximum = LIMITS[kind][1]
    require(type(count) is int and 0 <= count < 2 ** 64 and type(retained) is int
            and retained == min(count, maximum) and record["eof"] is True
            and type(record["complete"]) is bool and record["complete"] == (count == retained)
            and type(record["truncated"]) is bool and record["truncated"] == (count > retained),
            "Inconsistent stream byte counts or completion evidence.")
    encoded = record["data_b64"]
    require(type(encoded) is str and len(encoded) <= 4 * ((maximum + 2) // 3), "Oversized/malformed stream transport.")
    try:
        raw = base64.b64decode(encoded, validate=True)
    except (ValueError, binascii.Error):
        raise RuntimeError("Malformed stream Base64.") from None
    require(len(raw) == retained and base64.b64encode(raw).decode("ascii") == encoded
            and type(record["sha256"]) is str and hashlib.sha256(raw).hexdigest() == record["sha256"],
            "Corrupt/noncanonical stream transport.")
    return raw


def summary(record):
    require(type(record) is dict, "Missing stream summary.")
    validate(record, record.get("kind"))
    return {key: value for key, value in record.items() if key != "data_b64"}


def check(record, expected, mode):
    require(mode in ("tokens", "exact") and type(expected) is bytes and len(expected) <= LIMITS["stdout"][0],
            "Invalid frozen checker configuration.")
    try:
        reference = expected.decode("utf-8", errors="strict")
    except UnicodeDecodeError:
        raise RuntimeError("Expected output is not valid UTF-8.") from None
    raw = validate(record, "stdout")
    if record["observed_bytes"] > LIMITS["stdout"][0]:
        return "OUTPUT_LIMIT_EXCEEDED"
    try:
        actual = raw.decode("utf-8", errors="strict")
    except UnicodeDecodeError:
        return "WRONG_ANSWER"
    if mode == "tokens":
        actual = [part for part in re.split(r"[ \t\n\r\f\v]+", actual) if part]
        reference = [part for part in re.split(r"[ \t\n\r\f\v]+", reference) if part]
    return "PASSED" if actual == reference else "WRONG_ANSWER"
