import base64
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import platform
import re
import socket
import stat
import sys


HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("profile_repair", HERE / "profiles.py")
profiles = importlib.util.module_from_spec(spec)
spec.loader.exec_module(profiles)
lab, failure = profiles.lab, profiles.failure
require = profiles.runtime.require
NAME = "ingenium-cg-run.zJHkFA"
CONTAINER = "ingenium-cg-run-zJHkFA"
PROFILE = "ingenium-isolate-smoke-v1"
OLD_BUNDLE = "3637c3738f4ef1cd27bcb01a0577340c98026a71f3938f73f4d4b7428ea6a1c2"
POLICY_HASH = "20c07caaefcebcd4b8b8a402952965fd9e41bda18874e3924ed13c6964572818"
INSPECT = '''{"name":{{json .Name}},"id":{{json .Id}},"running":{{json .State.Running}},"restarting":{{json .State.Restarting}},"pid":{{json .State.Pid}},"exit":{{json .State.ExitCode}},"oom":{{json .State.OOMKilled}},"restart":{{json .HostConfig.RestartPolicy.Name}},"image":{{json .Config.Image}},"parent":{{json .HostConfig.CgroupParent}},"profile":{{json .AppArmorProfile}}}'''
LOADER_ERROR = b"/usr/local/java/bin/javac: error while loading shared libraries: libjli.so: cannot open shared object file: No such file or directory\n"


def directory(path, mode=None):
    info = path.lstat()
    require(stat.S_ISDIR(info.st_mode) and info.st_uid == 0
            and (mode is None or stat.S_IMODE(info.st_mode) == mode), "Unexpected retained directory type/owner/mode.")


def failure_record():
    old = lab.RUNTIME / "profiles-v1"
    directory(lab.RUNTIME, 0o700)
    directory(old, 0o700)
    require(not (old / "cleanup-v1").exists() and not (old / "cleanup-v1").is_symlink(), "A cleanup checkpoint already exists; inspect before any further action.")
    rows = [lab.decode_json(line) for line in failure.private_file(old / "journal.jsonl", 0, 0, 0o600, 65536).splitlines()]
    prepared = [row for row in rows if row.get("event") == "PREPARED"]
    built = [row for row in rows if row.get("event") == "IMAGE_BUILT"]
    require(len(prepared) == len(built) == 1 and rows[-1].get("event") == "PARITY_STARTED"
            and prepared[0].get("bundle_sha256") == built[0].get("bundle_sha256") == OLD_BUNDLE,
            "The old journal does not match this failed one-shot build.")
    require(type(built[0].get("image")) is str and re.fullmatch(r"sha256:[0-9a-f]{64}", built[0]["image"]), "Missing original image identity.")
    raw = failure.private_file(old / "parity.log", 0, 0, 0o600, 196608)
    lines = raw.decode("ascii").splitlines()
    diagnostic = [lab.decode_json(line.removeprefix("INGENIUM_PROFILE_DIAGNOSTIC ")) for line in lines if line.startswith("INGENIUM_PROFILE_DIAGNOSTIC ")]
    require(len(diagnostic) == 1, "Missing unique loader diagnostic.")
    error = diagnostic[0]["/var/local/lib/isolate/0/box/stderr"]
    require(error["truncated"] is False and error["observed_bytes"] == len(LOADER_ERROR)
            and failure.decode_bytes(error["prefix_b64"], 4096) == LOADER_ERROR,
            "The failure is not the reported Java loader error.")
    require(f"Container: {CONTAINER}" in lines and f"Parent: /{NAME}" in lines and f"Files: /run/{NAME}" in lines,
            "Retained resource names differ from the reported failure.")
    return old, built[0]["image"], prepared[0]["preserved_lab_sha256"], hashlib.sha256(raw).hexdigest()


def empty_tree(parent, container_id, *, jobs, unified):
    directory(parent)
    allowed = {parent, parent / container_id}
    if jobs:
        allowed |= {parent / "jobs", parent / "jobs" / "box-0"}
    found = [parent]
    for path in found:
        directory(path)
        require(path in allowed and len(found) <= 4, "Unexpected retained cgroup subtree; nothing may be removed.")
        task_file = path / ("cgroup.procs" if unified else "tasks")
        with task_file.open("rb") as stream:
            require(stream.read(1) == b"", "A retained cgroup still has tasks; do not clean or rerun.")
        for child in path.iterdir():
            info = child.lstat()
            require(not stat.S_ISLNK(info.st_mode), "Unexpected cgroup symlink.")
            if stat.S_ISDIR(info.st_mode):
                require(child in allowed, "Unexpected cgroup child.")
                found.append(child)
    return sorted(found, key=lambda path: len(path.parts), reverse=True)


def remove_probe(journal, retained, groups):
    lab.run("docker", "rm", CONTAINER)
    journal.record("CONTAINER_REMOVED")
    lab.run("apparmor_parser", "--remove", "--skip-cache", str(retained / "profile"))
    journal.record("PROFILE_REMOVED")
    for path in groups:
        if path.exists():
            path.rmdir()
    (retained / "profile").unlink()
    (retained / "isolate.conf").unlink()
    retained.rmdir()
    journal.record("COMPLETE")


def cleanup():
    old, image, snapshot, log_hash = failure_record()
    require(not (lab.RUNTIME / profiles.CHECKPOINT).exists() and not (lab.RUNTIME / profiles.CHECKPOINT).is_symlink(), "The corrected parity checkpoint already exists.")
    lab.queue.check_services()
    require(profiles.completed_baseline() == snapshot, "The nine preserved records changed; stop for inspection.")
    require(lab.run("docker", "image", "ls", "-q", profiles.TAG) == b"", "The corrected image tag already exists; do not overwrite it.")
    value = lab.decode_json(lab.run("docker", "inspect", "--type", "container", CONTAINER, "--format", INSPECT))
    expected = {"name": "/" + CONTAINER, "running": False, "restarting": False, "pid": 0, "exit": 1,
                "oom": False, "restart": "no", "image": image, "parent": "/" + NAME, "profile": PROFILE}
    require(type(value) is dict and set(value) == set(expected) | {"id"}
            and all(type(value[key]) is type(wanted) and value[key] == wanted for key, wanted in expected.items())
            and type(value["id"]) is str and re.fullmatch(r"[0-9a-f]{64}", value["id"]),
            "Retained container identity or stopped state differs; nothing was removed.")
    running = lab.run("docker", "ps", "-q").decode("ascii").splitlines()
    if running:
        active_profiles = lab.run("docker", "inspect", "--type", "container", *running, "--format", "{{.AppArmorProfile}}").decode("ascii").splitlines()
        require(PROFILE not in active_profiles, "The retained profile is in use by another running container.")
    retained = Path("/run") / NAME
    directory(retained, 0o700)
    require({path.name for path in retained.iterdir()} == {"profile", "isolate.conf"}, "Unexpected retained private files.")
    policy = failure.private_file(retained / "profile", 0, 0, 0o444, 4096)
    config = failure.private_file(retained / "isolate.conf", 0, 0, 0o444, 4096)
    require(hashlib.sha256(policy).hexdigest() == POLICY_HASH
            and config == b"box_root = /var/local/lib/isolate\ncg_root = /run/ingenium-probe-cgroups\nfirst_uid = 60000\nfirst_gid = 60000\nnum_boxes = 1\n",
            "Retained policy/config changed; nothing was removed.")
    require(Path("/sys/kernel/security/apparmor/profiles").read_text().splitlines().count(PROFILE + " (enforce)") == 1,
            "Expected loaded lab profile is missing or ambiguous.")
    roots = [Path(name) for name in lab.run("findmnt", "-rn", "-t", "cgroup", "-o", "TARGET").decode("ascii").splitlines()]
    require(len(roots) == len(set(roots)) and {Path("/sys/fs/cgroup") / name for name in ("memory", "cpu,cpuacct", "pids", "cpuset")} <= set(roots), "Required controller mount inventory differs.")
    require(all(re.fullmatch(r"/sys/fs/cgroup/[a-z_,]+", str(root)) and root.resolve() == root for root in roots), "Unexpected controller mount path.")
    require(Path("/sys/fs/cgroup/unified/cgroup.controllers").read_bytes().strip() == b"", "Hybrid controller setup changed.")
    roots.append(Path("/sys/fs/cgroup/unified"))
    groups = []
    for root in roots:
        groups += empty_tree(root / NAME, value["id"], jobs=root.name in ("memory", "cpu,cpuacct"), unified=root.name == "unified")
    journal = lab.Journal(old / "cleanup-v1")
    journal.record("VERIFIED", container=CONTAINER, container_id=value["id"], image=image, parent="/" + NAME,
                   old_log_sha256=log_hash, preserved_lab_sha256=snapshot,
                   policy_b64=base64.b64encode(policy).decode("ascii"), config_b64=base64.b64encode(config).decode("ascii"))
    remove_probe(journal, retained, groups)
    print("PASS: exact stopped Java-failure probe removed after empty-task checks; old evidence and all nine records preserved")


def main(argv=None):
    args = sys.argv[1:] if argv is None else argv
    if args or platform.system() != "Linux" or socket.gethostname() != "ingenium-judge-spike-01" or os.geteuid() != 0:
        print("FAIL: run this fixed cleanup only with sudo on the isolated VM, without arguments.", file=sys.stderr)
        return 1
    try:
        os.umask(0o077)
        cleanup()
        return 0
    except RuntimeError as error:
        print("FAIL: " + str(error), file=sys.stderr)
    except Exception:
        print("FAIL: scoped cleanup stopped; preserve all remaining evidence and inspect before continuing.", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
