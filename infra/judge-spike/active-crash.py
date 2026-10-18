import hashlib
import importlib.util
import json
import os
from pathlib import Path
import platform
import re
import signal
import socket
import stat
import subprocess
import sys
import time
import uuid

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("active_crash_guard", HERE / "recovery.py")
guard = importlib.util.module_from_spec(spec)
spec.loader.exec_module(guard)
lab, profiles, failure, runtime = guard.lab, guard.profiles, guard.failure, guard.runtime
tree = profiles.load("active_crash_tree", HERE / "cleanup-profiles-v1.py")
guard.TABLE = "ingenium_active_crash_v1.attempts"
DIRECTORY = lab.RUNTIME / "active-crash-v1"
IMAGE = "sha256:a0a4768705620218af104c2ad869fd087e1937815b690914512427a4b6135995"
PROFILE = "ingenium-isolate-smoke-v1"
SCOPE = "trusted-active-worker-crash-drain-v1"
FILES = ("cgroup-smoke.sh", "crash-box.sh", "namespace-smoke.apparmor")
INSPECT = '''{"id":{{json .Id}},"name":{{json .Name}},"image":{{json .Config.Image}},"user":{{json .Config.User}},"running":{{json .State.Running}},"restarting":{{json .State.Restarting}},"pid":{{json .State.Pid}},"oom":{{json .State.OOMKilled}},"profile":{{json .AppArmorProfile}},"nonce":{{json (index .Config.Labels "ingenium.lab.crash")}},"parent":{{json .HostConfig.CgroupParent}},"restart":{{json .HostConfig.RestartPolicy.Name}},"network":{{json .HostConfig.NetworkMode}},"cgroupns":{{json .HostConfig.CgroupnsMode}},"pidmode":{{json .HostConfig.PidMode}},"privileged":{{json .HostConfig.Privileged}},"readonly":{{json .HostConfig.ReadonlyRootfs}},"memory":{{json .HostConfig.Memory}},"swap":{{json .HostConfig.MemorySwap}},"cpus":{{json .HostConfig.NanoCpus}},"tasks":{{json .HostConfig.PidsLimit}},"caps":{{json .HostConfig.CapAdd}},"drop":{{json .HostConfig.CapDrop}},"security":{{json .HostConfig.SecurityOpt}},"ports":{{json .HostConfig.PortBindings}},"mounts":{{json .Mounts}},"tmpfs":{{json .HostConfig.Tmpfs}}}'''
CLEAN_WORKSPACE = '''set -euo pipefail
test -f /tmp/ingenium-crash-exited
test -z "$(cat /run/ingenium-probe-cgroups/memory/box-0/tasks)"
test -z "$(cat /run/ingenium-probe-cgroups/cpuacct/box-0/tasks)"
/usr/local/bin/isolate --cg --box-id=0 --cleanup
test ! -e /var/local/lib/isolate/0
test ! -e /run/ingenium-probe-cgroups/memory/box-0
test ! -e /run/ingenium-probe-cgroups/cpuacct/box-0
printf 'workspace-and-job-groups-removed\n'
'''


def names(value):
    nonce = value["nonce"]
    runtime.require(type(nonce) is str and re.fullmatch(r"[0-9a-f]{6}", nonce), "Invalid owned crash resource name.")
    return "ingenium-cg-run." + nonce, "ingenium-cg-run-" + nonce


def baseline():
    rows = failure.private_file(lab.RUNTIME / "http-v1" / "journal.jsonl", 0, 0, 0o600, 65536).splitlines()
    completed = lab.decode_json(rows[-1])
    runtime.require(completed.get("event") == "COMPLETE", "HTTP checkpoint is not complete.")
    token = lab.valid_uuid(completed["provider_token"])
    old = lab.db(profiles.SNAPSHOT_SQL.replace("FROM submissions s;", f"FROM submissions s WHERE token <> '{token}';"))
    runtime.require(old == {"count": 9, "complete": True, "sha256": completed["preserved_lab_sha256"]}, "Original nine provider records changed.")
    all_rows = lab.db(profiles.SNAPSHOT_SQL)
    runtime.require(all_rows["count"] == 10 and all_rows["complete"] is True, "Expected ten completed provider records.")
    recovery = lab.db("SELECT json_build_object('count', count(*), 'sealed', count(*) FILTER (WHERE state = 'SEALED'), "
                      "'held', count(*) FILTER (WHERE state = 'STARTED'), "
                      "'sha256', encode(sha256(convert_to(jsonb_agg(to_jsonb(a) ORDER BY attempt_id)::text, 'UTF8')), 'hex')) "
                      "FROM ingenium_recovery_v1.attempts a;")
    runtime.require(recovery == completed["preserved_recovery"], "Prior recovery rows or held reservation changed.")
    http = lab.db("SELECT json_build_object('count', count(*), 'sealed', bool_and(state = 'SEALED' AND permit_count = 1), "
                  f"'token_matches', bool_and(provider_id = '{token}'::uuid), "
                  "'sha256', encode(sha256(convert_to(jsonb_agg(to_jsonb(a) ORDER BY attempt_id)::text, 'UTF8')), 'hex')) "
                  "FROM ingenium_http_v1.attempts a;")
    runtime.require(http["count"] == 1 and http["sealed"] is True and http["token_matches"] is True,
                    "Completed HTTP association differs.")
    runtime.require(lab.redis(lab.EMPTY, 0) == b"empty", "Existing queue is not empty.")
    return {"providers": all_rows, "recovery": recovery, "http": http}


def context():
    value = lab.decode_json(failure.private_file(DIRECTORY / "context.json", 0, 0, 0o600, 65536))
    runtime.require(type(value) is dict and set(value) == {"scope", "binding", "owner_id", "nonce", "files", "controllers"}
                    and value["scope"] == SCOPE, "Wrong active-crash context.")
    guard.where(value["binding"])
    guard.uuid_value(value["owner_id"])
    names(value)
    hashes = {name: hashlib.sha256(runtime.regular(HERE / name, 65536)).hexdigest() for name in FILES}
    runtime.require(value["files"] == hashes and value["binding"]["host_epoch"] == Path("/proc/sys/kernel/random/boot_id").read_text().strip(),
                    "Host boot or trusted crash fixture changed; no action is authorised.")
    _, manifest_sha = guard.manifest()
    runtime.require(value["controllers"] == sorted(str(root) for root in roots()), "Captured controller inventory changed.")
    payload = {"scope": SCOPE, "nonce": value["nonce"], "image": IMAGE, "files": hashes, "controllers": value["controllers"]}
    runtime.require(value["binding"]["manifest_sha256"] == manifest_sha
                    and value["binding"]["payload_sha256"] == failure.canonical_hash(payload), "Crash payload/runtime binding differs.")
    return value


def observe(value):
    row = lab.db(f"SELECT json_build_object('state', state, 'owner_id', owner_id, 'permit_count', permit_count, "
                 f"'reserved', drained_at IS NULL, 'drain_sha256', drain_sha256) FROM {guard.TABLE} "
                 f"WHERE {guard.where(value['binding'])};")
    runtime.require(type(row) is dict and set(row) == {"state", "owner_id", "permit_count", "reserved", "drain_sha256"}
                    and row["state"] == "STARTED" and row["owner_id"] == value["owner_id"]
                    and type(row["permit_count"]) is int and row["permit_count"] == 1
                    and type(row["reserved"]) is bool
                    and ((row["reserved"] and row["drain_sha256"] is None)
                         or (not row["reserved"] and guard.digest(row["drain_sha256"]))), "Inconsistent consumed permit/drain reservation.")
    return row


def roots():
    values = [Path(name) for name in lab.run("findmnt", "-rn", "-t", "cgroup", "-o", "TARGET").decode("ascii").splitlines()]
    runtime.require(len(values) == len(set(values)) and {Path("/sys/fs/cgroup") / name for name in ("memory", "cpu,cpuacct", "pids", "cpuset")} <= set(values)
                    and all(re.fullmatch(r"/sys/fs/cgroup/[a-z_,]+", str(path)) and path.resolve() == path for path in values),
                    "Controller inventory changed.")
    runtime.require(Path("/sys/fs/cgroup/unified/cgroup.controllers").read_bytes().strip() == b"", "Hybrid controller setup changed.")
    return values + [Path("/sys/fs/cgroup/unified")]


def inspect_owned(value, *, running):
    name, container = names(value)
    info = lab.decode_json(lab.run("docker", "inspect", "--type", "container", container, "--format", INSPECT))
    expected = {"name": "/" + container, "image": IMAGE, "user": "0:0", "running": running, "restarting": False,
                "oom": False, "profile": PROFILE, "nonce": value["nonce"], "parent": "/" + name,
                "restart": "no", "network": "none", "cgroupns": "host", "pidmode": "", "privileged": False,
                "readonly": True, "memory": 268435456, "swap": 268435456, "cpus": 500000000, "tasks": 32}
    runtime.require(all(type(info.get(key)) is type(wanted) and info[key] == wanted for key, wanted in expected.items())
                    and type(info.get("id")) is str and re.fullmatch(r"[0-9a-f]{64}", info["id"])
                    and type(info.get("pid")) is int and (info["pid"] > 0 if running else info["pid"] == 0),
                    "Owned sandbox identity, state or limits differ.")
    runtime.require({cap.removeprefix("CAP_") for cap in info["caps"]} == {"CHOWN", "DAC_OVERRIDE", "KILL", "SETGID", "SETUID", "SYS_ADMIN", "SYS_CHROOT"}
                    and info["drop"] == ["ALL"] and info["ports"] in (None, {})
                    and {option.replace("=", ":", 1) for option in info["security"]} == {"no-new-privileges:true", "apparmor:" + PROFILE},
                    "Sandbox capabilities or security policy changed.")
    wanted = {"/run/ingenium-probe-cgroups/memory": (Path("/sys/fs/cgroup/memory") / name / "jobs", True),
              "/run/ingenium-probe-cgroups/cpuacct": (Path("/sys/fs/cgroup/cpu,cpuacct") / name / "jobs", True),
              "/usr/local/etc/isolate": (Path("/run") / name / "isolate.conf", False),
              "/run/ingenium-crash-box.sh": (HERE / "crash-box.sh", False)}
    runtime.require(len(info["mounts"]) == len(wanted) and {mount["Destination"] for mount in info["mounts"]} == set(wanted), "Unexpected sandbox mount count/targets.")
    for mount in info["mounts"]:
        target = mount["Destination"]
        runtime.require(target in wanted and mount["Type"] == "bind" and type(mount["RW"]) is bool
                        and (Path(mount["Source"]).resolve(), mount["RW"]) == wanted[target], "Unexpected writable sandbox mount.")
    runtime.require(set(info["tmpfs"]) == {"/var/local/lib/isolate", "/run/ingenium-probe-cgroups", "/tmp"}, "Unexpected tmpfs paths.")
    return info


def process(pid):
    runtime.require(type(pid) is int and pid > 1, "Invalid owned process ID.")
    root = Path("/proc") / str(pid)
    # After the parenthesized command, index 0 is stat field 3; start time is field 22.
    fields = (root / "stat").read_text().rpartition(") ")[2].split()
    status = dict(line.split(":", 1) for line in (root / "status").read_text().splitlines() if ":" in line)
    groups = {}
    for line in (root / "cgroup").read_text().splitlines():
        _, controllers, group = line.split(":", 2)
        for controller in controllers.split(","):
            runtime.require(controller not in groups, "Duplicate process cgroup controller.")
            groups[controller] = group
    return {"pid": pid, "comm": (root / "comm").read_text().strip(), "state": fields[0], "ppid": int(fields[1]),
            "pgid": int(fields[2]), "session": int(fields[3]), "start_ticks": int(fields[19]),
            "uid": [int(part) for part in status["Uid"].split()], "gid": [int(part) for part in status["Gid"].split()],
            "groups": groups}


def identities(pair):
    return [{key: value for key, value in item.items() if key != "state"} for item in pair]


def live_pair(value, container_id):
    name, _ = names(value)
    memory = Path("/sys/fs/cgroup/memory") / name / "jobs" / "box-0"
    cpu = Path("/sys/fs/cgroup/cpu,cpuacct") / name / "jobs" / "box-0"
    pids = [int(part) for part in (memory / "tasks").read_text().split()]
    runtime.require(len(pids) == 2 and set(pids) == {int(part) for part in (cpu / "tasks").read_text().split()}, "Trusted pair is not ready in both controllers.")
    observed = sorted([process(pid) for pid in pids], key=lambda item: item["comm"])
    runtime.require([item["comm"] for item in observed] == ["bash", "sleep"] and observed[1]["ppid"] == observed[0]["pid"],
                    "Expected a live shell and its sleeping child.")
    for item in observed:
        runtime.require(item["state"] in ("R", "S") and item["uid"] == item["gid"] == [60000] * 4
                        and item["groups"]["memory"] == item["groups"]["cpuacct"] == "/" + name + "/jobs/box-0"
                        and item["groups"]["pids"] == "/" + name + "/" + container_id, "Sandbox identity or process membership differs.")
    runtime.require((memory / "memory.limit_in_bytes").read_text().strip() == (memory / "memory.memsw.limit_in_bytes").read_text().strip() == "33554432",
                    "Job memory budget changed.")
    return observed


def wait_live(value, worker):
    deadline = time.monotonic() + 35
    while time.monotonic() < deadline:
        runtime.require(worker.poll() is None, "Worker exited before the active crash injection; inspect its private log.")
        try:
            info = inspect_owned(value, running=True)
            pair = live_pair(value, info["id"])
            return info, pair
        except (RuntimeError, OSError, KeyError, subprocess.SubprocessError):
            time.sleep(0.1)
    raise RuntimeError("Live trusted pair was not confirmed; preserve the consumed permit and resources.")


def absent(value):
    name, container = names(value)
    runtime.require(lab.run("docker", "ps", "-aq", "--filter", "name=^/" + container + "$") == b"", "Owned sandbox still exists; reservation must remain held.")
    controllers = roots()
    runtime.require(sorted(str(root) for root in controllers) == value["controllers"], "Captured controller inventory changed.")
    runtime.require(not os.path.lexists(Path("/run") / name)
                    and not any(os.path.lexists(root / name) for root in controllers)
                    and not any(line.startswith(PROFILE + " ") for line in Path("/sys/kernel/security/apparmor/profiles").read_text().splitlines()),
                    "Owned sandbox resources remain; reservation must remain held.")


def release(value):
    absent(value)
    proof_raw = failure.private_file(DIRECTORY / "drain-evidence.json", 0, 0, 0o600, 65536)
    proof = lab.decode_json(proof_raw)
    runtime.require(proof["scope"] == SCOPE and proof["binding"] == value["binding"] and proof["owner_id"] == value["owner_id"]
                    and proof["normal_result"] is None and proof["workspace_cleaned"] is True and proof["all_groups_removed"] is True,
                    "Missing trusted drain evidence; no result may be invented.")
    rows = failure.private_file(DIRECTORY / "drain" / "journal.jsonl", 0, 0, 0o600, 65536).splitlines()
    runtime.require(lab.decode_json(rows[-1]).get("event") == "COMPLETE", "Owned cleanup journal is incomplete.")
    worker = proof["worker"]
    runtime.require(type(worker["pid"]) is int and worker["pid"] > 1 and worker["pgid"] == worker["session"] == worker["pid"],
                    "Missing owned worker process-group evidence.")
    try:
        os.killpg(worker["pid"], 0)
    except ProcessLookupError:
        pass
    else:
        raise RuntimeError("Owned worker process group remains; reservation must remain held.")
    fingerprint = hashlib.sha256(proof_raw).hexdigest()
    result = lab.db(f"WITH changed AS (UPDATE {guard.TABLE} SET drained_at = clock_timestamp(), drain_sha256 = '{fingerprint}' "
                    f"WHERE {guard.where(value['binding'])} AND state = 'STARTED' AND owner_id = '{value['owner_id']}' "
                    "AND drained_at IS NULL RETURNING attempt_id) SELECT json_build_object('released', count(*) = 1) FROM changed;", write=True)
    runtime.require(type(result) is dict and set(result) == {"released"} and type(result["released"]) is bool and result["released"] is True,
                    "Drain release reply uncertain/already committed; observe the same row, never relaunch.")


def stop_pair(value, info, pair):
    # Open stable process handles before signalling; a recycled numeric PID is not authority.
    descriptors = []
    try:
        for item in pair:
            fd = os.pidfd_open(item["pid"])
            descriptors.append(fd)
            current = process(item["pid"])
            runtime.require(identities([current]) == identities([item]), "Owned process identity changed before drain.")
        runtime.require(identities(live_pair(value, info["id"])) == identities(pair), "Owned task membership changed before drain.")
        for fd in reversed(descriptors):
            try:
                signal.pidfd_send_signal(fd, signal.SIGKILL)
            except ProcessLookupError:
                pass
    finally:
        for fd in descriptors:
            os.close(fd)
    name, container = names(value)
    deadline = time.monotonic() + 15
    while time.monotonic() < deadline:
        try:
            exited = lab.run("docker", "exec", "--user", "0:0", container, "/bin/bash", "-c",
                             "test -f /tmp/ingenium-crash-exited && printf exited")
            if exited == b"exited":
                break
        except subprocess.SubprocessError:
            pass
        time.sleep(0.1)
    else:
        raise RuntimeError("Isolate completion was not confirmed; preserve workspace and reservation.")
    runtime.require(lab.run("docker", "exec", "--user", "0:0", container, "/bin/bash", "-c", CLEAN_WORKSPACE) == b"workspace-and-job-groups-removed",
                    "Explicit workspace cleanup was not confirmed.")
    runtime.require(not (Path("/sys/fs/cgroup/memory") / name / "jobs" / "box-0").exists()
                    and not (Path("/sys/fs/cgroup/cpu,cpuacct") / name / "jobs" / "box-0").exists(), "Job groups remain after workspace cleanup.")


def drain(value, info, pair, worker_identity, journal):
    stop_pair(value, info, pair)
    name, container = names(value)
    journal.record("WORKSPACE_CLEANED")
    lab.run("docker", "stop", "--time", "5", container)
    stopped = inspect_owned(value, running=False)
    runtime.require(stopped["id"] == info["id"], "Stopped container ownership changed.")
    retained = Path("/run") / name
    tree.directory(retained, 0o700)
    runtime.require({path.name for path in retained.iterdir()} == {"profile", "isolate.conf"}, "Unexpected owned runtime files.")
    policy = failure.private_file(retained / "profile", 0, 0, 0o444, 4096)
    config = failure.private_file(retained / "isolate.conf", 0, 0, 0o444, 4096)
    runtime.require(hashlib.sha256(policy).hexdigest() == value["files"]["namespace-smoke.apparmor"]
                    and config == b"box_root = /var/local/lib/isolate\ncg_root = /run/ingenium-probe-cgroups\nfirst_uid = 60000\nfirst_gid = 60000\nnum_boxes = 1\n", "Owned sandbox policy/config changed.")
    groups = []
    for root in roots():
        groups += tree.empty_tree(root / name, info["id"], jobs=root.name in ("memory", "cpu,cpuacct"), unified=root.name == "unified")
    cleanup = lab.Journal(DIRECTORY / "drain")
    cleanup.record("EMPTY_TREES_VERIFIED", container_id=info["id"], parent="/" + name)
    tree.CONTAINER = container
    tree.remove_probe(cleanup, retained, groups)
    absent(value)
    guard.private_json(DIRECTORY / "drain-evidence.json", {"scope": SCOPE, "binding": value["binding"], "owner_id": value["owner_id"],
                       "container_id": info["id"], "image_id": IMAGE, "parent": "/" + name, "observed_live_pair": pair, "worker": worker_identity,
                       "workspace_cleaned": True, "all_groups_removed": True, "normal_result": None})
    journal.record("DRAIN_PROVEN")


def child(mode):
    value = context()
    if mode == "--duplicate-only":
        runtime.require(not guard.claim(value["binding"], str(uuid.uuid4())), "Consumed permit was unexpectedly reusable; never launch.")
        print('{"launched":false}', flush=True)
        return 0
    if mode == "--release-lost":
        release(value)
        os._exit(76)
    runtime.require(guard.claim(value["binding"], value["owner_id"]), "Launch permit was not positively acknowledged.")
    journal = lab.Journal(DIRECTORY / "worker")
    journal.record("LAUNCH_AUTHORISED", binding=value["binding"], owner_id=value["owner_id"])
    profiles.logged(journal, "sandbox", ["/bin/bash", str(HERE / "cgroup-smoke.sh"), "--crash", value["nonce"], value["files"]["crash-box.sh"]], 180)
    raise RuntimeError("Crash worker completed unexpectedly; no physical reservation was released.")


def exercise(value, journal):
    runtime.require(guard.register(value["binding"]) is not None, "Crash registration did not commit.")
    path = DIRECTORY / "worker-output.log"
    with path.open("xb") as stream:
        os.fchmod(stream.fileno(), 0o600)
        worker = subprocess.Popen([sys.executable, "-B", str(HERE / "active-crash.py"), "--worker"],
                                  stdout=stream, stderr=subprocess.STDOUT, start_new_session=True)
        info, pair = wait_live(value, worker)
        runtime.require(observe(value)["reserved"] is True, "Active work lost its physical reservation.")
        identity = process(worker.pid)
        runtime.require(worker.poll() is None and identity["pgid"] == identity["session"] == worker.pid
                        and os.getpgid(worker.pid) == worker.pid, "Owned worker process-group identity differs.")
        journal.record("LIVE_WORKLOAD_VERIFIED", worker=identity, container_id=info["id"], pair=pair)
        os.killpg(worker.pid, signal.SIGKILL)
        runtime.require(worker.wait(timeout=10) == -signal.SIGKILL, "Injected worker crash was not confirmed.")
        stream.flush()
        os.fsync(stream.fileno())
    runtime.require(identities(live_pair(value, info["id"])) == identities(pair) and observe(value)["reserved"] is True,
                    "The crash did not leave the expected live pair with a held reservation.")
    try:
        release(value)
    except RuntimeError as error:
        runtime.require(str(error) == "Owned sandbox still exists; reservation must remain held.", "Early-release rejection was inconclusive.")
    else:
        raise RuntimeError("A live sandbox released physical capacity.")
    runtime.require(lab.decode_json(lab.run(sys.executable, "-B", str(HERE / "active-crash.py"), "--duplicate-only")) == {"launched": False},
                    "Replacement worker did not refuse replay.")
    runtime.require(observe(value)["reserved"] is True and identities(live_pair(value, info["id"])) == identities(pair), "Replay check changed live work or its reservation.")
    journal.record("CRASH_HELD_AND_REPLAY_REFUSED")
    print("PASS: worker and launcher killed while two UID-60000 processes remain alive; reservation held and replacement cannot relaunch", flush=True)
    drain(value, info, pair, identity, journal)
    runtime.require(observe(value)["reserved"] is True, "Cleanup alone released capacity without a durable proof commit.")
    print("PASS: original processes stopped through stable PID handles; workspace, container, profile and every empty owned cgroup removed", flush=True)
    result = subprocess.run([sys.executable, "-B", str(HERE / "active-crash.py"), "--release-lost"], stdout=subprocess.PIPE,
                            stderr=subprocess.STDOUT, timeout=30, check=False)
    runtime.require(result.returncode == 76 and result.stdout == b"", "Drain-release reply loss was not confirmed; inspect without relaunching.")
    state = observe(value)
    fingerprint = hashlib.sha256(failure.private_file(DIRECTORY / "drain-evidence.json", 0, 0, 0o600, 65536)).hexdigest()
    runtime.require(state["reserved"] is False and state["drain_sha256"] == fingerprint
                    and not guard.claim(value["binding"], str(uuid.uuid4())), "Drain proof/replay disposition differs.")
    guard.forbidden_change(f"UPDATE {guard.TABLE} SET drained_at = NULL, drain_sha256 = NULL WHERE {guard.where(value['binding'])}")
    guard.forbidden_change(f"DELETE FROM {guard.TABLE} WHERE {guard.where(value['binding'])}")
    runtime.require(observe(value) == state, "Released evidence was reset or replaced.")
    print("PASS: one durable drain release recovered after lost acknowledgement; permit stays consumed and no participant verdict was invented", flush=True)


def main(argv=None):
    args = sys.argv[1:] if argv is None else argv
    if args not in ([], ["--worker"], ["--duplicate-only"], ["--release-lost"]) or platform.system() != "Linux" or socket.gethostname() != "ingenium-judge-spike-01" or os.geteuid() != 0:
        print("FAIL: run only with sudo on the isolated VM, in a fixed active-crash lab mode.", file=sys.stderr)
        return 1
    try:
        os.umask(0o077)
        signal.signal(signal.SIGTERM, lab.interrupt)
        tree.directory(lab.RUNTIME, 0o700)
        if args:
            return child(args[0])
        runtime.require(not DIRECTORY.exists() and not DIRECTORY.is_symlink(), "Active-crash checkpoint exists; never rerun or remove it.")
        runtime.require(hasattr(os, "pidfd_open") and hasattr(signal, "pidfd_send_signal"), "Stable process signalling is unavailable.")
        lab.queue.check_services()
        before = baseline()
        _, manifest_sha = guard.manifest()
        runtime.require(lab.db("SELECT json_build_object('absent', NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'ingenium_active_crash_v1'));") == {"absent": True}, "Active-crash schema exists; never reset it.")
        _, token = lab.prepare_config(failure.private_file(lab.RUNTIME / "judge0.conf", 1000, 999, 0o400, 32768))
        lab.api.check_api(lab.private_ip(lab.queue.API), token)
        nonce = uuid.uuid4().hex[:6]
        hashes = {name: hashlib.sha256(runtime.regular(HERE / name, 65536)).hexdigest() for name in FILES}
        controllers = sorted(str(root) for root in roots())
        value = {"scope": SCOPE, "nonce": nonce, "owner_id": str(uuid.uuid4()), "files": hashes, "controllers": controllers,
                 "binding": {"attempt_id": str(uuid.uuid4()), "host_epoch": Path("/proc/sys/kernel/random/boot_id").read_text().strip(),
                             "manifest_sha256": manifest_sha,
                             "payload_sha256": failure.canonical_hash({"scope": SCOPE, "nonce": nonce, "image": IMAGE, "files": hashes, "controllers": controllers})}}
        name, container = names(value)
        runtime.require(lab.run("docker", "ps", "-aq", "--filter", "name=^/" + container + "$") == b""
                        and not os.path.lexists(Path("/run") / name) and not any(os.path.lexists(root / name) for root in roots())
                        and not any(line.startswith(PROFILE + " ") for line in Path("/sys/kernel/security/apparmor/profiles").read_text().splitlines()),
                        "A prior sandbox resource exists; inspect without cleanup.")
        journal = lab.Journal(DIRECTORY)
        journal.record("PREPARED", preserved=before)
        guard.private_json(DIRECTORY / "context.json", value)
        runtime.require(lab.db(runtime.regular(HERE / "active-crash.sql", 16384).decode("ascii"), write=True) == {"created": True}, "Crash schema creation uncertain; preserve the checkpoint.")
        exercise(value, journal)
        runtime.require(baseline() == before and lab.db(f"SELECT json_build_object('count', count(*)) FROM {guard.TABLE};") == {"count": 1},
                        "Existing records or new crash attempt count changed.")
        lab.queue.check_services()
        lab.api.check_api(lab.private_ip(lab.queue.API), token)
        journal.record("COMPLETE", preserved=before, new_provider_records=0)
        print("PASS: ten provider rows and both earlier recovery schemas unchanged; queue empty; maintenance enabled; active crash evidence saved", flush=True)
        return 0
    except KeyboardInterrupt:
        print("FAIL: interrupted; preserve all active-crash resources and reservations.", file=sys.stderr)
        return 130
    except Exception as error:
        detail = str(error) if isinstance(error, RuntimeError) else type(error).__name__
        print("FAIL: " + detail + " Preserve /opt/ingenium-judge-spike/active-crash-v1 and its schema. Do not rerun, reset permits or force-clean resources.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
