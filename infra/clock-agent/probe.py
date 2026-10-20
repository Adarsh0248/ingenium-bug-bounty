"""Read-only Linux/chrony probe. Its parent-owned stdout pipe is its only report channel."""

import csv
import io
import json
import os
import re
import selectors
import subprocess
import sys
import time
from decimal import Decimal, ROUND_CEILING, ROUND_FLOOR
from pathlib import Path


def rows(text):
    if len(text.encode("ascii")) > 4096:
        raise ValueError("Oversized chrony report")
    return list(csv.reader(io.StringIO(text), strict=True))


def nanos(value, signed=False):
    if len(value) > 64:
        raise ValueError("Oversized chrony number")
    number = Decimal(value)
    if not number.is_finite() or abs(number) > 1000000000 or (not signed and number < 0):
        raise ValueError("Invalid chrony number")
    scaled = number * 1000000000
    rounding = ROUND_FLOOR if scaled < 0 else ROUND_CEILING
    return str(int(scaled.to_integral_value(rounding=rounding)))


def tracking(text, sources):
    data, peers = rows(text), rows(sources)
    if len(data) != 1 or len(data[0]) != 14 or not data[0][2].isdigit():
        raise ValueError("Unsupported chrony tracking report")
    r = data[0]
    allowed = ("metadata.google.internal", "metadata.google")
    source_ok = r[1] in allowed and len(peers) == 1 and len(peers[0]) == 10 and peers[0][:2] == ["^", "*"] and peers[0][2] in allowed
    return {"system_offset_ns": nanos(r[4], True), "root_delay_ns": nanos(r[10]), "root_dispersion_ns": nanos(r[11]),
            "synchronised": r[13] == "Normal" and 1 <= int(r[2]) <= 15, "source_ok": source_ok}


def chrony(command):
    argv = ["/usr/bin/chronyc", "-h", "127.0.0.1", "-c", "-N", command]
    process = subprocess.Popen(argv, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, close_fds=True)
    data = bytearray()
    try:
        with selectors.DefaultSelector() as selector:
            selector.register(process.stdout, selectors.EVENT_READ)
            deadline = time.clock_gettime_ns(time.CLOCK_BOOTTIME) + 700000000
            while True:
                if time.clock_gettime_ns(time.CLOCK_BOOTTIME) >= deadline:
                    raise TimeoutError("Chrony timeout")
                if not selector.select(0.05):
                    continue
                chunk = os.read(process.stdout.fileno(), 4097 - len(data))
                if not chunk:
                    break
                data.extend(chunk)
                if len(data) > 4096:
                    raise ValueError("Oversized chrony output")
        if process.wait(timeout=0.1) != 0:
            raise ValueError("Chrony failed")
        return data.decode("ascii")
    finally:
        if process.poll() is None:
            process.kill()
        process.wait()
        process.stdout.close()


def main():
    if sys.platform != "linux" or not hasattr(time, "CLOCK_BOOTTIME") or len(sys.argv) != 3:
        raise ValueError("Linux clock support is required")
    nonce, sequence = sys.argv[1:]
    if not re.fullmatch(r"[A-Za-z0-9_-]{43}", nonce) or not re.fullmatch(r"[1-9][0-9]{0,18}", sequence) or int(sequence) > 9223372036854775807:
        raise ValueError("Invalid probe binding")
    measured = tracking(chrony("tracking"), chrony("sources -a"))
    before = time.clock_gettime_ns(time.CLOCK_BOOTTIME)
    realtime = time.time_ns()
    after = time.clock_gettime_ns(time.CLOCK_BOOTTIME)
    result = {"policy": 1, "boot_id": Path("/proc/sys/kernel/random/boot_id").read_text(encoding="ascii").strip(),
              "nonce": nonce, "sequence": sequence, "boottime_before_ns": str(before), "boottime_after_ns": str(after),
              "realtime_ns": str(realtime), **measured}
    print(json.dumps(result, separators=(",", ":")), flush=True)


if __name__ == "__main__":
    try:
        main()
    except Exception:
        print('{"error":"PROBE_FAILED"}', flush=True)
        sys.exit(1)
