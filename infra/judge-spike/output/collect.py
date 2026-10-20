import base64
import contextlib
import json
import os
from pathlib import Path
import selectors
import stat
import subprocess
import time


LOG = Path("/tmp/output-isolate.log")
# shortcut: fixed lab phases only; add durable supervisor cancellation/recovery before participant use.
HANDOFF = """import os, sys
fd = int(sys.argv[1])
if not 3 <= fd < 64 or os.getresuid() != (60000, 60000, 60000) or os.getresgid() != (60000, 60000, 60000):
    raise SystemExit(125)
os.dup2(fd, 2)
os.closerange(3, 256)
os.execv(sys.argv[2], sys.argv[2:])
"""


def launch_args(args, kinds, writer):
    if (type(args) is not list or not args or not all(type(arg) is str for arg in args)
            or args[0] != "/usr/local/bin/isolate" or args.count("--") != 1
            or kinds not in (("stdout", "stderr"), ("compiler",))
            or type(writer) is not int or not 3 <= writer < 64):
        raise RuntimeError("Unsupported protected-output command or pipe descriptor.")
    split = args.index("--")
    header, command = args[1:split], args[split + 1:]
    out, err = ("compiler", "compiler") if kinds == ("compiler",) else kinds
    expected = ["--stdout=/box/" + out, "--stderr=/box/" + err]
    if (not header or header[-1] != "--run" or len(command) < 2
            or command[0] != "/usr/local/bin/ingenium-exec" or not command[1].startswith("/")
            or any(not arg.startswith("--") for arg in header)
            or any(arg.split("=", 1)[0] in ("--inherit-fds", "--full-env", "--share-net", "--stderr-to-stdout") for arg in header)
            or [arg for arg in header if arg.startswith(("--stdout", "--stderr"))] != expected):
        raise RuntimeError("Unexpected output redirection, inheritance or sandbox command.")
    clean = [arg for arg in header if arg not in expected]
    return [args[0], *clean[:-1], "--inherit-fds", clean[-1], "--", command[0],
            "/usr/local/bin/python3.14", "-I", "-B", "-S", "-c", HANDOFF, str(writer), *command[1:]]


def capture_phase(runner, args, kinds, names, wall, *, capture):
    require = capture.require
    require(os.name == "posix" and type(wall) in (int, float) and 0 < wall <= 60,
            "Protected output requires a bounded POSIX phase.")
    require(kinds in (("stdout", "stderr"), ("compiler",)), "Unsupported protected stream set.")
    buffers = {kind: capture.Capture(kind) for kind in kinds}
    with contextlib.ExitStack() as stack:
        selector = stack.enter_context(selectors.DefaultSelector())
        writers = stack.enter_context(contextlib.ExitStack())
        endpoints = {}
        for kind in kinds:
            reader, writer = os.pipe()
            stack.callback(os.close, reader)
            writers.callback(os.close, writer)
            require(stat.S_ISFIFO(os.fstat(reader).st_mode) and stat.S_ISFIFO(os.fstat(writer).st_mode)
                    and os.fstat(reader).st_ino == os.fstat(writer).st_ino, "Anonymous pipe endpoints differ.")
            os.set_blocking(reader, False)
            selector.register(reader, selectors.EVENT_READ, kind)
            endpoints[kind] = writer
        error_writer = endpoints["compiler" if kinds == ("compiler",) else "stderr"]
        command = launch_args(args, kinds, error_writer)
        with LOG.open("wb") as log:
            os.fchmod(log.fileno(), 0o600)
            # Only this writer crosses exec; the UID-60000 handoff closes every extra descriptor.
            process = subprocess.Popen(command, stdin=subprocess.DEVNULL, stdout=endpoints[kinds[0]],
                                       stderr=log, close_fds=True, pass_fds=(error_writer,))
            writers.close()
            deadline, seen = time.monotonic() + wall + 5, False
            while selector.get_map() or process.poll() is None:
                require(time.monotonic() < deadline, "Output deadline exceeded; retain the uncertain phase.")
                try:
                    seen = runner.identity_seen(names) or seen
                except ProcessLookupError:
                    pass  # A vanished process is not positive identity evidence.
                if not selector.get_map():
                    time.sleep(0.005)
                    continue
                for key, _ in selector.select(0.005):
                    try:
                        data = os.read(key.fd, 65536)
                    except BlockingIOError:
                        continue
                    if data:
                        buffers[key.data].feed(data)
                    else:
                        buffers[key.data].eof = True
                        selector.unregister(key.fd)
            code = process.wait(timeout=1)
            if code != 0 or not seen:
                diagnostic = {kind: {"observed_bytes": item.observed, "eof": item.eof,
                                     "prefix_b64": base64.b64encode(item.prefix[:2048]).decode("ascii")}
                              for kind, item in buffers.items()}
                diagnostic["isolate"] = {"exitcode": code, "identity_seen": seen}
                print("INGENIUM_OUTPUT_CAPTURE_DIAGNOSTIC " + json.dumps(diagnostic), flush=True)
            require(code in (0, 1) and seen, "Protected phase failed or sandbox identity was not observed.")
    return {"rc": code, "identity_checked": True, "captures": {kind: value.record() for kind, value in buffers.items()}}


def collect(runner, args, kinds, names, wall, *, capture):
    result = capture_phase(runner, args, kinds, names, wall, capture=capture)
    capture.require(result["rc"] == 0, "Protected phase failed or sandbox identity was not observed.")
    return result["captures"]
