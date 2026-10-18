import contextlib
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import signal
import tempfile
import unittest
from unittest.mock import Mock, patch
import uuid

spec = importlib.util.spec_from_file_location("active_crash_tests", Path(__file__).resolve().parent.parent / "active-crash.py")
suite = importlib.util.module_from_spec(spec)
spec.loader.exec_module(suite)
spec = importlib.util.spec_from_file_location("crash_schema_tests", suite.HERE / "resume-crash-schema.py")
repair = importlib.util.module_from_spec(spec)
spec.loader.exec_module(repair)
BINDING = {"attempt_id": str(uuid.uuid4()), "host_epoch": str(uuid.uuid4()), "payload_sha256": "a" * 64, "manifest_sha256": "b" * 64}
VALUE = {"scope": suite.SCOPE, "binding": BINDING, "owner_id": str(uuid.uuid4()), "nonce": "abc123", "files": {name: "d" * 64 for name in suite.FILES}}
WORKER = {"pid": 8123, "pgid": 8123, "session": 8123}
PAIR = [{"pid": 41, "comm": "bash", "state": "S", "start_ticks": 9}, {"pid": 42, "comm": "sleep", "state": "S", "start_ticks": 10}]


def reserved(released=False):
    return {"state": "STARTED", "owner_id": VALUE["owner_id"], "permit_count": 1,
            "reserved": not released, "drain_sha256": "e" * 64 if released else None}


def inspection():
    name, container = suite.names(VALUE)
    return {"id": "f" * 64, "name": "/" + container, "image": suite.IMAGE, "user": "0:0", "running": True, "restarting": False,
            "pid": 500, "oom": False, "profile": suite.PROFILE, "nonce": VALUE["nonce"], "parent": "/" + name, "restart": "no",
            "network": "none", "cgroupns": "host", "pidmode": "", "privileged": False, "readonly": True,
            "memory": 268435456, "swap": 268435456, "cpus": 500000000, "tasks": 32,
            "caps": ["CAP_" + cap for cap in ("CHOWN", "DAC_OVERRIDE", "KILL", "SETGID", "SETUID", "SYS_ADMIN", "SYS_CHROOT")],
            "drop": ["ALL"], "security": ["no-new-privileges:true", "apparmor=" + suite.PROFILE], "ports": {},
            "mounts": [{"Destination": target, "Source": source, "RW": rw, "Type": "bind"} for target, source, rw in (
                ("/run/ingenium-probe-cgroups/memory", "/sys/fs/cgroup/memory/" + name + "/jobs", True),
                ("/run/ingenium-probe-cgroups/cpuacct", "/sys/fs/cgroup/cpu,cpuacct/" + name + "/jobs", True),
                ("/usr/local/etc/isolate", "/run/" + name + "/isolate.conf", False),
                ("/run/ingenium-crash-box.sh", str(suite.HERE / "crash-box.sh"), False))],
            "tmpfs": {"/var/local/lib/isolate": "exec,size=16m", "/run/ingenium-probe-cgroups": "noexec,size=1m", "/tmp": "noexec,size=4m"}}


class ActiveCrashTests(unittest.TestCase):
    def test_owned_names_reject_paths_and_unbounded_suffixes(self):
        self.assertEqual(suite.names(VALUE), ("ingenium-cg-run.abc123", "ingenium-cg-run-abc123"))
        for nonce in ("../abc", "ABCDEF", "a" * 7, True):
            with self.subTest(nonce=nonce), self.assertRaises(RuntimeError):
                suite.names(dict(VALUE, nonce=nonce))

    def test_identity_comparison_ignores_scheduler_state_not_pid_reuse(self):
        changed = [dict(item, state="R") for item in PAIR]
        self.assertEqual(suite.identities(PAIR), suite.identities(changed))
        changed[0]["start_ticks"] += 1
        self.assertNotEqual(suite.identities(PAIR), suite.identities(changed))

    def test_context_freezes_boot_runtime_controller_inventory_and_fixture_bytes(self):
        contents = {name: ("fixed " + name).encode() for name in suite.FILES}
        hashes = {name: hashlib.sha256(raw).hexdigest() for name, raw in contents.items()}
        controllers = sorted(str(Path(item)) for item in ("/sys/fs/cgroup/memory", "/sys/fs/cgroup/cpu,cpuacct", "/sys/fs/cgroup/unified"))
        payload = {"scope": suite.SCOPE, "nonce": VALUE["nonce"], "image": suite.IMAGE, "files": hashes, "controllers": controllers}
        binding = dict(BINDING, payload_sha256=suite.failure.canonical_hash(payload))
        value = dict(VALUE, binding=binding, files=hashes, controllers=controllers)
        for scenario in ("ok", "new_boot", "missing_controller", "changed_fixture"):
            with self.subTest(scenario=scenario), patch.object(suite.failure, "private_file", return_value=json.dumps(value).encode()), patch.object(suite, "Path") as path, patch.object(suite, "roots", return_value=[Path(item) for item in (controllers[:-1] if scenario == "missing_controller" else controllers)]), patch.object(suite.guard, "manifest", return_value=({}, BINDING["manifest_sha256"])), patch.object(suite.runtime, "regular", side_effect=lambda path, cap: b"changed" if scenario == "changed_fixture" else contents[path.name]):
                path.return_value.read_text.return_value = str(uuid.uuid4()) if scenario == "new_boot" else BINDING["host_epoch"]
                if scenario == "ok":
                    self.assertEqual(suite.context(), value)
                else:
                    with self.assertRaises(RuntimeError):
                        suite.context()

    def test_container_identity_security_mount_and_budget_tampering_is_rejected(self):
        for change in ({}, {"nonce": "000000"}, {"memory": 1}, {"privileged": True}, {"pidmode": "host"},
                       {"running": 1}, {"network": "bridge"}, {"caps": []}, {"security": []},
                       {"ports": {"22/tcp": []}}, {"mounts": []}):
            value = dict(inspection(), **change)
            with self.subTest(change=change), patch.object(suite.lab, "run", return_value=json.dumps(value).encode()), patch.object(suite.Path, "resolve", lambda self: self):
                if change:
                    with self.assertRaises(RuntimeError):
                        suite.inspect_owned(VALUE, running=True)
                else:
                    self.assertEqual(suite.inspect_owned(VALUE, running=True), value)

    def test_observation_never_invents_success_or_releases_without_digest(self):
        for value in (reserved(), reserved(True), dict(reserved(), permit_count=True), dict(reserved(), state="SEALED"),
                      dict(reserved(), reserved=False), dict(reserved(), owner_id=str(uuid.uuid4()))):
            with self.subTest(row=value), patch.object(suite.lab, "db", return_value=value):
                if value in (reserved(), reserved(True)) and type(value["permit_count"]) is int:
                    self.assertEqual(suite.observe(VALUE), value)
                else:
                    with self.assertRaises(RuntimeError):
                        suite.observe(VALUE)

    def test_duplicate_mode_cannot_launch_even_if_a_guard_erroneously_grants(self):
        for granted in (False, True):
            with patch.object(suite, "context", return_value=VALUE), patch.object(suite.guard, "claim", return_value=granted), patch.object(suite.profiles, "logged") as launch, patch.object(suite.lab, "Journal") as journal, contextlib.redirect_stdout(io.StringIO()) as output:
                if granted:
                    with self.assertRaises(RuntimeError):
                        suite.child("--duplicate-only")
                else:
                    self.assertEqual(suite.child("--duplicate-only"), 0)
                    self.assertEqual(json.loads(output.getvalue()), {"launched": False})
                launch.assert_not_called()
                journal.assert_not_called()

    def test_unacknowledged_permit_never_reaches_the_launcher(self):
        with patch.object(suite, "context", return_value=VALUE), patch.object(suite.guard, "claim", side_effect=RuntimeError("lost reply")), patch.object(suite.profiles, "logged") as launch, patch.object(suite.lab, "Journal") as journal, self.assertRaises(RuntimeError):
            suite.child("--worker")
        launch.assert_not_called()
        journal.assert_not_called()

    def test_live_or_unclean_resources_refuse_release_before_database_mutation(self):
        with patch.object(suite, "absent", side_effect=RuntimeError("still live")), patch.object(suite.lab, "db") as db, patch.object(suite.failure, "private_file") as read, self.assertRaises(RuntimeError):
            suite.release(VALUE)
        db.assert_not_called()
        read.assert_not_called()

    def test_release_requires_owned_proof_cleanup_and_dead_worker_group(self):
        proof = {"scope": suite.SCOPE, "binding": BINDING, "owner_id": VALUE["owner_id"], "normal_result": None,
                 "workspace_cleaned": True, "all_groups_removed": True, "worker": WORKER}
        complete = json.dumps({"event": "COMPLETE"}).encode()
        for scenario in ("ok", "still_live_worker", "incomplete_cleanup", "invented_result", "lost_reply", "integer_reply"):
            value = dict(proof, normal_result="Accepted") if scenario == "invented_result" else proof
            raw = json.dumps(value).encode()
            journal = b'{"event":"EMPTY_TREES_VERIFIED"}' if scenario == "incomplete_cleanup" else complete
            response = {"released": 1} if scenario == "integer_reply" else {"released": True}
            with self.subTest(scenario=scenario), patch.object(suite, "absent"), patch.object(suite.failure, "private_file", side_effect=[raw, journal]), patch.object(suite.os, "killpg", create=True, side_effect=None if scenario == "still_live_worker" else ProcessLookupError), patch.object(suite.lab, "db", return_value=response, side_effect=OSError("lost reply") if scenario == "lost_reply" else None) as db:
                if scenario == "ok":
                    suite.release(VALUE)
                    sql = db.call_args.args[0]
                    self.assertIn("AND drained_at IS NULL", sql)
                    self.assertIn("owner_id = '" + VALUE["owner_id"] + "'", sql)
                    self.assertIn(hashlib.sha256(raw).hexdigest(), sql)
                    self.assertEqual(db.call_count, 1)
                else:
                    with self.assertRaises((RuntimeError, OSError)):
                        suite.release(VALUE)
                    self.assertEqual(db.call_count, int(scenario in ("lost_reply", "integer_reply")))

    def test_pid_reuse_or_identity_change_prevents_every_signal(self):
        changed = dict(PAIR[0], start_ticks=99)
        with patch.object(suite.os, "pidfd_open", create=True, return_value=50), patch.object(suite.os, "close") as close, patch.object(suite, "process", return_value=changed), patch.object(suite.signal, "pidfd_send_signal", create=True) as send, self.assertRaises(RuntimeError):
            suite.stop_pair(VALUE, {"id": "f" * 64}, PAIR)
        send.assert_not_called()
        close.assert_called_once_with(50)

    def test_real_proc_and_cgroup_parsers_require_exact_identity_and_parent_child_pair(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            name, _ = suite.names(VALUE)
            group = "/" + name + "/jobs/box-0"
            mapped = {"/proc": root / "proc", "/sys/fs/cgroup/memory": root / "memory", "/sys/fs/cgroup/cpu,cpuacct": root / "cpu"}
            for controller in ("memory", "cpu"):
                path = root / controller / name / "jobs" / "box-0"
                path.mkdir(parents=True)
                (path / "tasks").write_text("41\n42\n")
                for field in ("memory.limit_in_bytes", "memory.memsw.limit_in_bytes"):
                    (path / field).write_text("33554432\n")
            for pid, comm, ppid in ((41, "bash", 39), (42, "sleep", 41)):
                path = root / "proc" / str(pid)
                path.mkdir(parents=True)
                fields = ["S", str(ppid), "30", "30"] + ["0"] * 15 + [str(900 + pid)]
                (path / "stat").write_text(str(pid) + " (" + comm + ") " + " ".join(fields) + "\n")
                (path / "comm").write_text(comm + "\n")
                (path / "status").write_text("Uid:\t60000 60000 60000 60000\nGid:\t60000 60000 60000 60000\n")
                (path / "cgroup").write_text("3:memory:" + group + "\n2:cpu,cpuacct:" + group + "\n1:pids:/" + name + "/" + "f" * 64 + "\n")
            with patch.object(suite, "Path", side_effect=lambda path: mapped[str(path)]):
                pair = suite.live_pair(VALUE, "f" * 64)
                self.assertEqual([item["start_ticks"] for item in pair], [941, 942])
                self.assertEqual(pair[1]["ppid"], pair[0]["pid"])
                (root / "proc" / "42" / "status").write_text("Uid:\t0 0 0 0\nGid:\t0 0 0 0\n")
                with self.assertRaises(RuntimeError):
                    suite.live_pair(VALUE, "f" * 64)

    def test_pid_handles_all_open_before_signals_and_cleanup_is_explicit(self):
        order = []
        def opened(pid):
            order.append("open:" + str(pid))
            return pid + 100
        def sent(fd, sig):
            order.append("signal:" + str(fd))
            self.assertEqual(sig, signal.SIGKILL)
        with patch.object(suite.os, "pidfd_open", create=True, side_effect=opened), patch.object(suite.os, "close") as close, patch.object(suite, "process", side_effect=PAIR), patch.object(suite, "live_pair", return_value=PAIR), patch.object(suite.signal, "SIGKILL", 9, create=True), patch.object(suite.signal, "pidfd_send_signal", create=True, side_effect=sent), patch.object(suite.lab, "run", side_effect=[b"exited", b"workspace-and-job-groups-removed"]) as run, patch.object(suite.Path, "exists", return_value=False):
            suite.stop_pair(VALUE, {"id": "f" * 64}, PAIR)
        self.assertEqual(order, ["open:41", "open:42", "signal:142", "signal:141"])
        self.assertEqual(close.call_count, 2)
        self.assertEqual(run.call_args.args[-1], suite.CLEAN_WORKSPACE)

    def test_explicit_workspace_cleanup_must_succeed_before_container_removal(self):
        info = {"id": "f" * 64}
        with patch.object(suite, "stop_pair", side_effect=RuntimeError("cleanup failed")), patch.object(suite.lab, "run") as run, patch.object(suite.tree, "remove_probe") as remove, self.assertRaises(RuntimeError):
            suite.drain(VALUE, info, PAIR, WORKER, Mock())
        run.assert_not_called()
        remove.assert_not_called()

    def test_release_ack_loss_has_no_launch_path(self):
        with patch.object(suite, "context", return_value=VALUE), patch.object(suite, "release") as release, patch.object(suite.os, "_exit", side_effect=SystemExit(76)), patch.object(suite.guard, "claim") as claim, self.assertRaises(SystemExit) as exit_code:
            suite.child("--release-lost")
        self.assertEqual(exit_code.exception.code, 76)
        release.assert_called_once_with(VALUE)
        claim.assert_not_called()

    def test_schema_allows_drain_without_a_fabricated_result_but_no_reset(self):
        sql = (suite.HERE / "active-crash.sql").read_text()
        self.assertIn("LIKE ingenium_recovery_v1.attempts INCLUDING ALL", sql)
        self.assertEqual(sql.count("CHECK ("), 3)
        for name in ("digest", "state", "drain"):
            self.assertIn("CONSTRAINT active_crash_" + name + "_check CHECK (", sql)
        self.assertIn("CHECK (state IN ('PREPARED', 'STARTED'))", sql)
        self.assertIn("drained_at IS NOT NULL AND drained_at >= started_at", sql)
        self.assertIn("OLD.drained_at IS NULL AND NEW.drained_at IS NOT NULL", sql)
        self.assertIn("Evidence cannot be deleted", sql)
        self.assertNotIn("DROP ", sql)
        self.assertNotIn("TRUNCATE ", sql)

    def test_schema_repair_accepts_only_unchanged_prepared_checkpoint_and_absent_schema(self):
        before = {"providers": "unchanged", "recovery": "unchanged", "http": "unchanged"}
        prepared = json.dumps({"event": "PREPARED", "preserved": before}).encode() + b"\n"
        for scenario in ("ok", "worker_exists", "already_repaired", "journal_advanced", "records_changed", "schema_exists", "context_changed", "resources_remain"):
            with self.subTest(scenario=scenario), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                (root / "context.json").write_bytes(b"original context")
                raw = prepared
                if scenario == "journal_advanced":
                    raw += b'{"event":"LIVE_WORKLOAD_VERIFIED"}\n'
                if scenario == "records_changed":
                    raw = b'{"event":"PREPARED","preserved":{}}\n'
                (root / "journal.jsonl").write_bytes(raw)
                if scenario in ("worker_exists", "already_repaired"):
                    (root / ("worker" if scenario == "worker_exists" else "schema-fix-v1")).mkdir()
                with patch.object(repair.active, "DIRECTORY", root), patch.object(repair.active.tree, "directory"), patch.object(repair.failure, "private_file", side_effect=lambda path, *args: path.read_bytes()), patch.object(repair.active, "context", return_value=VALUE, side_effect=RuntimeError("changed boot or fixture") if scenario == "context_changed" else None), patch.object(repair.lab, "db", return_value={"absent": scenario != "schema_exists"}) as db, patch.object(repair.active, "absent", side_effect=RuntimeError("still live") if scenario == "resources_remain" else None), patch.object(repair.lab, "Journal") as journal, patch.object(repair.active, "exercise") as launch:
                    if scenario == "ok":
                        value, hashes = repair.checkpoint(before)
                        self.assertEqual(value, VALUE)
                        self.assertEqual(hashes, {name: hashlib.sha256((root / name).read_bytes()).hexdigest() for name in ("context.json", "journal.jsonl")})
                    else:
                        with self.assertRaises(RuntimeError):
                            repair.checkpoint(before)
                    self.assertTrue(all(not call.kwargs.get("write", False) for call in db.call_args_list))
                    journal.assert_not_called()
                    launch.assert_not_called()

    def test_schema_reply_must_be_positive_before_any_execution_and_never_retried(self):
        for response in ({"created": True}, {"created": 1}, {"created": False}, None, {"created": True, "extra": 0}, OSError("lost reply")):
            with self.subTest(response=response), patch.object(repair, "checkpoint", return_value=(VALUE, {})), patch.object(repair.active.runtime, "regular", return_value=b"fixed DDL"), patch.object(repair.lab, "Journal"), patch.object(repair.lab, "db", return_value=response, side_effect=response if isinstance(response, OSError) else None) as db, patch.object(repair.active, "exercise", side_effect=RuntimeError("test stops after launch gate")) as launch:
                with self.assertRaises((RuntimeError, OSError)):
                    repair.continue_schema({}, "not-a-real-token")
                self.assertEqual(db.call_count, 1)
                self.assertEqual(db.call_args.args, ("fixed DDL",))
                self.assertEqual(db.call_args.kwargs, {"write": True})
                self.assertEqual(launch.call_count, int(type(response) is dict and set(response) == {"created"} and response["created"] is True))

    def test_repair_rejection_or_duplicate_marker_cannot_write_schema_or_launch(self):
        for boundary in ("checkpoint", "marker"):
            with self.subTest(boundary=boundary), patch.object(repair, "checkpoint", return_value=(VALUE, {}), side_effect=RuntimeError("unstarted guard failed") if boundary == "checkpoint" else None), patch.object(repair.active.runtime, "regular", return_value=b"fixed DDL"), patch.object(repair.lab, "Journal", side_effect=FileExistsError), patch.object(repair.lab, "db") as db, patch.object(repair.active, "exercise") as launch, self.assertRaises((RuntimeError, FileExistsError)):
                repair.continue_schema({}, "not-a-real-token")
            db.assert_not_called()
            launch.assert_not_called()

    def test_repair_checks_original_hashes_and_old_data_before_complete(self):
        raw = b"saved original checkpoint"
        hashes = {"journal.jsonl": hashlib.sha256(raw).hexdigest()}
        for scenario in ("ok", "old_checkpoint_changed", "old_rows_changed", "extra_attempt"):
            with self.subTest(scenario=scenario), patch.object(repair, "checkpoint", return_value=(VALUE, hashes)), patch.object(repair.active.runtime, "regular", return_value=b"fixed DDL"), patch.object(repair.lab, "Journal") as journal, patch.object(repair.lab, "db", side_effect=[{"created": True}, {"count": 2 if scenario == "extra_attempt" else 1}]), patch.object(repair.active, "exercise"), patch.object(repair.failure, "private_file", return_value=b"changed" if scenario == "old_checkpoint_changed" else raw), patch.object(repair.active, "baseline", return_value={"changed": True} if scenario == "old_rows_changed" else {}), patch.object(repair.lab.queue, "check_services"), patch.object(repair.lab.api, "check_api"), patch.object(repair.lab, "private_ip"), contextlib.redirect_stdout(io.StringIO()):
                if scenario == "ok":
                    repair.continue_schema({}, "not-a-real-token")
                else:
                    with self.assertRaises(RuntimeError):
                        repair.continue_schema({}, "not-a-real-token")
                completed = [call for call in journal.return_value.record.call_args_list if call.args[0] == "COMPLETE"]
                self.assertEqual(len(completed), int(scenario == "ok"))


if __name__ == "__main__":
    unittest.main()
