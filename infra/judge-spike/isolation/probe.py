import ctypes
import errno
import json
import os
from pathlib import Path
import resource
import socket
import sys
import time


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def denied(operation, expected):
    try:
        result = operation()
    except OSError as error:
        require(error.errno in expected, "Unexpected denial cause: errno " + str(error.errno))
        return error.errno
    if isinstance(result, int):
        os.close(result)
    elif hasattr(result, "close"):
        result.close()
    raise RuntimeError("A protected operation unexpectedly succeeded.")


def identity():
    require(os.getresuid() == (60000, 60000, 60000) and os.getresgid() == (60000, 60000, 60000)
            and os.getgroups() == [], "Wrong sandbox identity/groups.")
    require(resource.getrlimit(resource.RLIMIT_NOFILE) == (256, 256)
            and resource.getrlimit(resource.RLIMIT_CORE) == (0, 0)
            and resource.getrlimit(resource.RLIMIT_NPROC) == (8, 8), "Wrong descriptor/core/process limits.")
    class Header(ctypes.Structure):
        _fields_ = [("version", ctypes.c_uint32), ("pid", ctypes.c_int)]
    class Data(ctypes.Structure):
        _fields_ = [("effective", ctypes.c_uint32), ("permitted", ctypes.c_uint32), ("inheritable", ctypes.c_uint32)]
    header, data = Header(0x20080522, 0), (Data * 2)()
    # Linux x86-64 capget syscall; the VM/image architecture is pinned before execution.
    require(ctypes.CDLL(None, use_errno=True).syscall(ctypes.c_long(125), ctypes.byref(header), ctypes.byref(data)) == 0,
            "Capability inspection failed.")
    require(all(item.effective == item.permitted == item.inheritable == 0 for item in data), "Sandbox retained capabilities.")
    denied(lambda: os.setuid(0), (errno.EPERM,))
    require(os.getresuid() == (60000, 60000, 60000), "Sandbox identity changed.")


def boundary():
    forbidden = ("INGENIUM_PRIVATE_CANARY", "INGENIUM_CGROUP_PARENT", "AUTHN_TOKEN", "POSTGRES_PASSWORD",
                 "REDIS_PASSWORD", "SECRET_KEY_BASE", "GOOGLE_APPLICATION_CREDENTIALS")
    require(not any(name in os.environ for name in forbidden), "Private environment leaked.")
    sockets = []
    for family in (socket.AF_INET, socket.AF_INET6):
        for kind in (socket.SOCK_STREAM, socket.SOCK_DGRAM):
            sockets.append(denied(lambda: socket.socket(family, kind), (errno.EACCES, errno.EPERM)))
    paths = ("/tmp/ingenium-isolation-canary", "/api/judge0.conf", "/opt/ingenium-judge-spike/judge0.conf",
             "/run/ingenium-probe-cgroups/memory/box-0/tasks", "/proc/self/status", "/sys/fs/cgroup",
             "/var/run/docker.sock", "/box/../../tmp/ingenium-isolation-canary")
    files = [denied(lambda path=path: os.open(path, os.O_RDONLY | os.O_NONBLOCK),
                    (errno.ENOENT, errno.EACCES, errno.ENOTDIR)) for path in paths]
    write = denied(lambda: os.open("/usr/ingenium-isolation-write-probe", os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600),
                   (errno.EROFS, errno.EACCES, errno.EPERM))
    return {"sockets": sockets, "hidden_paths": files, "usr_write": write, "private_env_absent": True}


def fork_limit():
    read, write = os.pipe()
    children, failure = [], None
    try:
        for _ in range(9):
            try:
                child = os.fork()
            except OSError as error:
                require(error.errno == errno.EAGAIN, "Fork failed for a reason other than the process cap.")
                failure = error.errno
                break
            if child == 0:
                os.close(write)
                try:
                    os.read(read, 1)
                finally:
                    os._exit(0)
            children.append(child)
        time.sleep(0.3)
    finally:
        os.close(write)
        os.close(read)
        statuses = [os.waitpid(child, 0)[1] for child in children]
    require(len(children) == 7 and failure == errno.EAGAIN and statuses == [0] * 7,
            "Expected exactly seven bounded children and rejection of the next fork.")
    return {"children": 7, "fork_errno": failure, "joined": True}


def detached_child():
    read, write = os.pipe()
    child = os.fork()
    if child == 0:
        os.close(read)
        os.setsid()
        os.write(write, b"ready")
        os.close(write)
        time.sleep(30)
        os._exit(0)
    os.close(write)
    require(os.read(read, 6) == b"ready", "Detached child did not acknowledge startup.")
    os.close(read)
    time.sleep(0.3)
    return {"child_detached": True}


def main():
    require(sys.platform == "linux" and os.uname().machine == "x86_64" and sys.argv[1:] == [], "Only the fixed Linux/amd64 probe is allowed.")
    mode = sys.stdin.buffer.readline(32).decode("ascii").strip()
    require(mode in ("boundary", "fork-limit", "detached-child"), "Unknown fixed isolation case.")
    identity()
    time.sleep(0.15)
    result = {"boundary": boundary, "fork-limit": fork_limit, "detached-child": detached_child}[mode]()
    print(json.dumps({"case": mode, "identity": True, "result": result}, separators=(",", ":")), flush=True)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        value = {"error": type(error).__name__, "reason": str(error)[:512] if isinstance(error, RuntimeError) else ""}
        with Path("/box/probe-failure.json").open("x", encoding="ascii") as output:
            json.dump(value, output)
        raise
