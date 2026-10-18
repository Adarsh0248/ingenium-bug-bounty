import base64
import hashlib
import importlib.util
import os
from pathlib import Path
import platform
import re
import signal
import socket
import sys


HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("stream_repair", HERE / "streams.py")
streams = importlib.util.module_from_spec(spec)
spec.loader.exec_module(streams)
lab, active, require = streams.lab, streams.active, streams.require
tree = active.tree
OLD_BUNDLE = "96d2f2600c5b43fe701fcb0b6bbc5606f84e93b078822153d043e774fe762272"
NAME, CONTAINER = streams.RETAINED_NAME, streams.RETAINED_CONTAINER
CONFIG = b"box_root = /var/local/lib/isolate\ncg_root = /run/ingenium-probe-cgroups\nfirst_uid = 60000\nfirst_gid = 60000\nnum_boxes = 1\n"
INSPECT = '''{"name":{{json .Name}},"id":{{json .Id}},"image":{{json .Config.Image}},"user":{{json .Config.User}},"running":{{json .State.Running}},"restarting":{{json .State.Restarting}},"pid":{{json .State.Pid}},"exit":{{json .State.ExitCode}},"oom":{{json .State.OOMKilled}},"restart":{{json .HostConfig.RestartPolicy.Name}},"parent":{{json .HostConfig.CgroupParent}},"profile":{{json .AppArmorProfile}},"privileged":{{json .HostConfig.Privileged}},"readonly":{{json .HostConfig.ReadonlyRootfs}},"network":{{json .HostConfig.NetworkMode}},"pidmode":{{json .HostConfig.PidMode}},"cgroupns":{{json .HostConfig.CgroupnsMode}},"memory":{{json .HostConfig.Memory}},"swap":{{json .HostConfig.MemorySwap}},"cpus":{{json .HostConfig.NanoCpus}},"tasks":{{json .HostConfig.PidsLimit}},"caps":{{json .HostConfig.CapAdd}},"drop":{{json .HostConfig.CapDrop}},"security":{{json .HostConfig.SecurityOpt}},"ports":{{json .HostConfig.PortBindings}},"mounts":{{json .Mounts}}}'''


def failure_record(before, frozen, manifest_sha):
    tree.directory(streams.OLD_DIRECTORY, 0o700)
    require(not os.path.lexists(streams.DIRECTORY)
            and {path.name for path in streams.OLD_DIRECTORY.iterdir()} == {"journal.jsonl", "streams.log"},
            "Old checkpoint progressed or a cleanup/corrected run exists; do not repeat recovery.")
    rows = [lab.decode_json(line) for line in active.failure.private_file(streams.OLD_DIRECTORY / "journal.jsonl", 0, 0, 0o600, 65536).splitlines()]
    require([row.get("event") for row in rows] == ["PREPARED", "STREAMS_STARTED"], "Not the reported unsealed stream batch.")
    prepared = rows[0]
    helpers = {name: hashlib.sha256(active.runtime.regular(HERE / name, 65536)).hexdigest()
               for name in ("cgroup-smoke.sh", "namespace-smoke.apparmor")}
    require(prepared.get("preserved") == before and prepared.get("image_id") == frozen["image_id"]
            and prepared.get("manifest_sha256") == manifest_sha and prepared.get("bundle_sha256") == OLD_BUNDLE
            and prepared.get("helpers_sha256") == helpers and prepared.get("checker_version") == 1
            and type(prepared["checker_version"]) is int
            and prepared.get("host_epoch") == Path("/proc/sys/kernel/random/boot_id").read_text().strip(),
            "Original records, image, helpers, runtime manifest or boot changed; no cleanup is authorised.")
    raw = active.failure.private_file(streams.OLD_DIRECTORY / "streams.log", 0, 0, 0o600, 262144)
    lines = raw.decode("ascii").splitlines()
    for expected in ("FAIL: ProcessLookupError; preserve the stream workspace and private log.",
                     "Container: " + CONTAINER, "Profile: " + active.PROFILE, "Parent: /" + NAME, "Files: /run/" + NAME):
        require(lines.count(expected) == 1, "Reported failure/resource identity differs; do not clean.")
    require("PASS: host test groups and temporary files removed" not in lines
            and "PASS: fifty fixed stream cases completed with EOF, exact bytes, identities and normal cleanup" not in lines,
            "Failed suite already reports completion; inspect instead of repeating.")
    observed = [lab.decode_json(line[len("INGENIUM_STREAM_VERSIONS "):]) for line in lines if line.startswith("INGENIUM_STREAM_VERSIONS ")]
    require(observed == [frozen["observed"]], "Old runtime binary observations differ.")
    hashes = streams.failed_hashes()
    require(hashes["streams.log"] == hashlib.sha256(raw).hexdigest(), "Failed log changed during inspection.")
    return prepared, hashes


def inspect_owned(frozen):
    value = lab.decode_json(lab.run("docker", "inspect", "--type", "container", CONTAINER, "--format", INSPECT))
    wanted = {"name": "/" + CONTAINER, "image": frozen["image_id"], "user": "0:0", "running": False,
              "restarting": False, "pid": 0, "exit": 1, "oom": False, "restart": "no", "parent": "/" + NAME,
              "profile": active.PROFILE, "privileged": False, "readonly": True, "network": "none", "pidmode": "", "cgroupns": "host",
              "memory": 1610612736, "swap": 1610612736, "cpus": 500000000, "tasks": 128}
    require(type(value) is dict and all(type(value.get(key)) is type(expected) and value[key] == expected for key, expected in wanted.items())
            and type(value.get("id")) is str and re.fullmatch(r"[0-9a-f]{64}", value["id"]),
            "Retained container identity, stopped state or limits changed; nothing was removed.")
    require({cap.removeprefix("CAP_") for cap in value["caps"]} == {"CHOWN", "DAC_OVERRIDE", "KILL", "SETGID", "SETUID", "SYS_ADMIN", "SYS_CHROOT"}
            and value["drop"] == ["ALL"] and value["ports"] in (None, {})
            and {option.replace("=", ":", 1) for option in value["security"]} == {"no-new-privileges:true", "apparmor:" + active.PROFILE},
            "Retained sandbox security settings differ.")
    original_source = (HERE.parent / "streams-check-v1/streams").resolve()
    mounts = {"/run/ingenium-probe-cgroups/memory": (Path("/sys/fs/cgroup/memory") / NAME / "jobs", True),
              "/run/ingenium-probe-cgroups/cpuacct": (Path("/sys/fs/cgroup/cpu,cpuacct") / NAME / "jobs", True),
              "/usr/local/etc/isolate": (Path("/run") / NAME / "isolate.conf", False),
              "/run/ingenium-streams": (original_source, False)}
    require(len(value["mounts"]) == len(mounts) and {item["Destination"] for item in value["mounts"]} == set(mounts), "Retained sandbox mounts differ.")
    for item in value["mounts"]:
        require(item["Type"] == "bind" and type(item["RW"]) is bool
                and (Path(item["Source"]).resolve(), item["RW"]) == mounts[item["Destination"]], "Unexpected retained writable/source mount.")
    current = streams.bundle.HERE
    try:
        streams.bundle.HERE = original_source
        require(streams.bundle.fingerprint() == OLD_BUNDLE, "Original mounted stream bundle changed; preserve it.")
    finally:
        streams.bundle.HERE = current
    running = lab.run("docker", "ps", "-q").decode("ascii").splitlines()
    if running:
        require(active.PROFILE not in lab.run("docker", "inspect", "--type", "container", *running, "--format", "{{.AppArmorProfile}}").decode("ascii").splitlines(),
                "The retained profile is still in use by another running container.")
    return value


def cleanup():
    lab.queue.check_services()
    before = streams.baseline()
    frozen, manifest_sha = streams.guard.manifest()
    prepared, hashes = failure_record(before, frozen, manifest_sha)
    _, token = lab.prepare_config(active.failure.private_file(lab.RUNTIME / "judge0.conf", 1000, 999, 0o400, 32768))
    lab.api.check_api(lab.private_ip(lab.queue.API), token)
    value = inspect_owned(frozen)
    retained = Path("/run") / NAME
    tree.directory(retained, 0o700)
    require({path.name for path in retained.iterdir()} == {"profile", "isolate.conf"}, "Unexpected retained runtime files.")
    policy = active.failure.private_file(retained / "profile", 0, 0, 0o444, 4096)
    config = active.failure.private_file(retained / "isolate.conf", 0, 0, 0o444, 4096)
    require(hashlib.sha256(policy).hexdigest() == prepared["helpers_sha256"]["namespace-smoke.apparmor"] and config == CONFIG,
            "Retained policy/config changed; nothing may be removed.")
    require(Path("/sys/kernel/security/apparmor/profiles").read_text().splitlines().count(active.PROFILE + " (enforce)") == 1,
            "Expected loaded profile is missing or ambiguous.")
    roots = active.roots()
    groups = []
    for root in roots:
        groups += tree.empty_tree(root / NAME, value["id"], jobs=root.name in ("memory", "cpu,cpuacct"), unified=root.name == "unified")
    journal = lab.Journal(streams.OLD_DIRECTORY / "cleanup-v1")
    journal.record("VERIFIED_EMPTY", container=CONTAINER, container_id=value["id"], parent="/" + NAME, image_id=frozen["image_id"],
                   old_sha256=hashes, preserved=before, host_epoch=prepared["host_epoch"], controllers=sorted(str(root) for root in roots),
                   policy_b64=base64.b64encode(policy).decode("ascii"), config_b64=base64.b64encode(config).decode("ascii"))
    tree.CONTAINER = CONTAINER
    tree.remove_probe(journal, retained, groups)
    require(streams.failed_hashes() == hashes and streams.baseline() == before, "Old evidence/records changed; do not start a corrected suite.")
    require(lab.run("docker", "ps", "-aq", "--filter", "name=^/" + CONTAINER + "$") == b""
            and not os.path.lexists(retained) and not any(os.path.lexists(root / NAME) for root in roots)
            and not any(line.startswith(active.PROFILE + " ") for line in Path("/sys/kernel/security/apparmor/profiles").read_text().splitlines()),
            "An owned resource/profile remains after cleanup.")
    journal.record("READY_FOR_CORRECTED_SUITE", container=CONTAINER, parent="/" + NAME, old_sha256=hashes, preserved=before,
                   host_epoch=prepared["host_epoch"], controllers=sorted(str(root) for root in roots))
    streams.cleaned_failure(before)
    print("PASS: exact stopped stream probe removed after all-controller empty-task checks; old logs and ten provider rows preserved", flush=True)


def main(argv=None):
    args = sys.argv[1:] if argv is None else argv
    if args or platform.system() != "Linux" or socket.gethostname() != "ingenium-judge-spike-01" or os.geteuid() != 0:
        print("FAIL: run repair-streams.py with sudo only on the isolated VM, without arguments.", file=sys.stderr)
        return 1
    try:
        os.umask(0o077)
        signal.signal(signal.SIGTERM, lab.interrupt)
        tree.directory(lab.RUNTIME, 0o700)
        cleanup()
        return streams.main([])
    except KeyboardInterrupt:
        print("FAIL: interrupted; preserve both stream checkpoints and retained resources.", file=sys.stderr)
        return 130
    except Exception as error:
        print("FAIL: " + (str(error) if isinstance(error, RuntimeError) else type(error).__name__)
              + " Preserve streams-v1/cleanup-v1, streams-v2 and any resources. Do not rerun or force-clean.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
