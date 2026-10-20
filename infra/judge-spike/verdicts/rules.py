import base64
from decimal import Decimal
import hashlib
import re


# shortcut: reviewed source-bound fixtures only; generic compiler-failure attribution needs its own proof before participants.
def require(condition, message):
    if not condition: raise RuntimeError(message)


def metadata(encoded):
    require(type(encoded) is str and len(encoded) <= 5464, "Oversized/invalid metadata transport.")
    raw = base64.b64decode(encoded, validate=True)
    require(len(raw) <= 4096 and base64.b64encode(raw).decode("ascii") == encoded, "Noncanonical metadata.")
    value = {}
    for line in raw.decode("ascii").splitlines():
        key, separator, item = line.partition(":")
        require(separator and key not in value, "Malformed/duplicate phase metadata.")
        value[key] = item
    numeric = {"max-rss", "csw-voluntary", "csw-forced", "cg-mem"}
    required = numeric | {"time", "time-wall"}
    controls = {"status", "message", "exitcode", "exitsig", "killed", "cg-oom-killed"}
    require(required <= value.keys() and not value.keys() - required - controls, "Missing/unknown phase metadata.")
    for key in numeric | ({"exitcode", "exitsig", "killed", "cg-oom-killed"} & value.keys()):
        require(re.fullmatch(r"[0-9]+", value[key]) is not None, "Invalid numeric phase metadata.")
    for key in ("time", "time-wall"):
        require(re.fullmatch(r"[0-9]+(?:\.[0-9]+)?", value[key]) is not None, "Invalid phase time.")
    require(value.get("status") != "XX", "Runner failure requires infrastructure recovery.")
    return value


def phase(value, compiling, capture):
    require(type(value) is dict and set(value) == {"rc", "meta_b64", "cpu_ns", "peak_bytes", "ram_hits", "combined_hits", "limits",
                                                "captures", "identity_checked", "command_checked", "cleanup"}, "Wrong verdict phase shape.")
    require(value["identity_checked"] is True and value["command_checked"] is True and value["cleanup"] is True,
            "Missing target execution/identity or normal cleanup proof.")
    limits = value["limits"]
    require(type(limits) is dict and set(limits) == {"cpu_ms", "wall_ms", "memory_bytes"}
            and all(type(item) is int and item > 0 for item in limits.values())
            and limits["cpu_ms"] <= 15000 and limits["wall_ms"] <= 30000 and limits["memory_bytes"] <= 1073741824, "Invalid frozen phase limits.")
    require(type(value["rc"]) is int and value["rc"] in (0, 1), "Runner failure is not a participant verdict.")
    for key in ("cpu_ns", "peak_bytes", "ram_hits", "combined_hits"):
        require(type(value[key]) is int and value[key] >= 0, "Invalid aggregate phase counter.")
    require(0 < value["cpu_ns"] <= (limits["cpu_ms"] + 1000) * 1000000 and 0 < value["peak_bytes"] <= limits["memory_bytes"], "Phase accounting is outside the bounded probe.")
    meta = metadata(value["meta_b64"])
    require(Decimal(meta["time-wall"]) <= Decimal(limits["wall_ms"] + 2000) / 1000, "Unexpected wall-time accounting.")
    kinds = ("compiler",) if compiling else ("stdout", "stderr")
    require(type(value["captures"]) is dict and set(value["captures"]) == set(kinds), "Missing/mixed output channels.")
    raw = {kind: capture.validate(value["captures"][kind], kind) for kind in kinds}
    controls = {key: meta[key] for key in ("status", "message", "exitcode", "exitsig", "killed") if key in meta}
    status = meta.get("status")
    if status is None:
        require(value["rc"] == 0 and controls == {"exitcode": "0"}, "Success metadata/return code differs.")
    elif status == "RE":
        code = int(meta.get("exitcode", "0"))
        require(value["rc"] == 1 and 0 < code <= 255 and controls == {"status": "RE", "exitcode": str(code), "message": f"Exited with error status {code}"}, "Nonzero-exit evidence differs.")
    elif status == "SG":
        signal = int(meta.get("exitsig", "0"))
        require(value["rc"] == 1 and 0 < signal <= 64 and controls == {"status": "SG", "exitsig": str(signal), "message": f"Caught fatal signal {signal}"}, "Signal/interrupt cause is ambiguous.")
    elif status == "TO":
        require(value["rc"] == 1 and controls.keys() <= {"status", "message", "killed"} and meta.get("killed", "1") == "1", "Time-limit controls differ.")
        if meta.get("message") == "Time limit exceeded":
            require(Decimal(meta["time"]) >= Decimal(limits["cpu_ms"]) / 1000 and value["cpu_ns"] >= limits["cpu_ms"] * 1000000, "CPU limit lacks accounting support.")
        else:
            require(meta.get("message") == "Time limit exceeded (wall clock)" and Decimal(meta["time-wall"]) >= Decimal(limits["wall_ms"]) / 1000, "Wall limit was not established.")
    else: raise RuntimeError("Unknown phase status requires infrastructure recovery.")
    require(meta.get("cg-oom-killed", "0") in ("0", "1"), "Unknown OOM flag.")
    if meta.get("cg-oom-killed") == "1":
        require(value["ram_hits"] + value["combined_hits"] > 0, "OOM flag lacks job limit-counter support.")
    return meta, raw


def classify(case, evidence, capture, source):
    require(type(evidence) is dict and set(evidence) == {"case", "profile", "source_sha256", "compile", "run"}
            and evidence["case"] == case["id"] and evidence["profile"] == case["profile"]
            and evidence["source_sha256"] == hashlib.sha256(source).hexdigest(), "Fixed source/case attribution differs.")
    if case["profile"] in ("c", "cpp", "java"):
        meta, raw = phase(evidence["compile"], True, capture)
        require(evidence["compile"]["limits"] == {"cpu_ms": 15000, "wall_ms": 30000, "memory_bytes": 1073741824}, "Compiler limits changed.")
        if case["mode"] == "compile-error":
            require(meta.get("status") == "RE" and meta.get("exitcode") == "1" and meta.get("cg-oom-killed", "0") == "0"
                    and not evidence["compile"]["ram_hits"] and not evidence["compile"]["combined_hits"]
                    and b"INGENIUM_EXPECTED_COMPILE_ERROR" in raw["compiler"] and evidence["run"] is None
                    and evidence["compile"]["captures"]["compiler"]["observed_bytes"] > 65536,
                    "The reviewed compiler-error witness/diagnostic clipping was not established.")
            return {"verdict": "COMPILATION_ERROR", "recovery_required": False}
        require(evidence["compile"]["rc"] == 0 and not evidence["compile"]["ram_hits"] and not evidence["compile"]["combined_hits"], "Runtime fixture did not compile normally.")
    else: require(evidence["compile"] is None, "Interpreter invented a compilation phase.")
    run = evidence["run"]
    meta, raw = phase(run, False, capture)
    require(run["limits"] == {key: case[key] for key in ("cpu_ms", "wall_ms", "memory_bytes")}, "Run limits changed.")
    if run["captures"]["stdout"]["observed_bytes"] > 1048576: verdict = "OUTPUT_LIMIT_EXCEEDED"
    elif meta.get("cg-oom-killed") == "1": verdict = "MEMORY_LIMIT_EXCEEDED"
    elif meta.get("status") == "TO": verdict = "TIME_LIMIT_EXCEEDED"
    elif meta.get("status") == "SG" and meta["exitsig"] in ("9", "15", "25"):
        return {"verdict": None, "recovery_required": True}
    elif run["rc"] != 0: verdict = "RUNTIME_ERROR"
    else: verdict = capture.check(run["captures"]["stdout"], b"12\n", "exact")
    return {"verdict": verdict, "recovery_required": False}
