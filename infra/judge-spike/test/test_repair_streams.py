import contextlib
import copy
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock, patch


ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("repair_stream_tests", ROOT / "repair-streams.py")
repair = importlib.util.module_from_spec(spec)
spec.loader.exec_module(repair)
s = repair.streams
IMAGE, ID, MANIFEST = "sha256:" + "a" * 64, "b" * 64, "c" * 64
FROZEN = {"image_id": IMAGE, "observed": {"fixed": "versions"}}
BEFORE = {"old": "unchanged"}
BOOT = "83b530ed-72d5-4d91-9220-a30c68de2f56"
HASHES = {"journal.jsonl": "d" * 64, "streams.log": "e" * 64}


def inspection():
    return {"name": "/" + repair.CONTAINER, "id": ID, "image": IMAGE, "user": "0:0", "running": False, "restarting": False,
            "pid": 0, "exit": 1, "oom": False, "restart": "no", "parent": "/" + repair.NAME, "profile": repair.active.PROFILE,
            "privileged": False, "readonly": True, "network": "none", "pidmode": "", "cgroupns": "host", "memory": 1610612736,
            "swap": 1610612736, "cpus": 500000000, "tasks": 128,
            "caps": ["CAP_" + cap for cap in ("CHOWN", "DAC_OVERRIDE", "KILL", "SETGID", "SETUID", "SYS_ADMIN", "SYS_CHROOT")],
            "drop": ["ALL"], "security": ["no-new-privileges:true", "apparmor=" + repair.active.PROFILE], "ports": {},
            "mounts": [{"Destination": target, "Source": source, "Type": "bind", "RW": rw} for target, source, rw in (
                ("/run/ingenium-probe-cgroups/memory", "/sys/fs/cgroup/memory/" + repair.NAME + "/jobs", True),
                ("/run/ingenium-probe-cgroups/cpuacct", "/sys/fs/cgroup/cpu,cpuacct/" + repair.NAME + "/jobs", True),
                ("/usr/local/etc/isolate", "/run/" + repair.NAME + "/isolate.conf", False),
                ("/run/ingenium-streams", str(repair.HERE.parent / "streams-check-v1/streams"), False))]}


class RepairStreamTests(unittest.TestCase):
    def test_failure_record_requires_exact_old_stage_boot_bundle_runtime_and_resource_names(self):
        helpers = {name: hashlib.sha256((ROOT / name).read_bytes()).hexdigest() for name in ("cgroup-smoke.sh", "namespace-smoke.apparmor")}
        prepared = {"event": "PREPARED", "preserved": BEFORE, "image_id": IMAGE, "manifest_sha256": MANIFEST,
                    "bundle_sha256": repair.OLD_BUNDLE, "helpers_sha256": helpers, "host_epoch": BOOT, "checker_version": 1}
        for scenario in ("ok", "advanced", "old_records", "boot", "bundle", "manifest", "image", "wrong_error", "wrong_container", "completed", "cleanup_exists"):
            with self.subTest(scenario=scenario), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                row = copy.deepcopy(prepared)
                for label, field in (("old_records", "preserved"), ("boot", "host_epoch"), ("bundle", "bundle_sha256"), ("manifest", "manifest_sha256"), ("image", "image_id")):
                    if scenario == label: row[field] = "changed"
                rows = [row, {"event": "STREAMS_FINISHED" if scenario == "advanced" else "STREAMS_STARTED"}]
                lines = ["INGENIUM_STREAM_VERSIONS " + json.dumps(FROZEN["observed"]),
                         "FAIL: " + ("RuntimeError" if scenario == "wrong_error" else "ProcessLookupError") + "; preserve the stream workspace and private log.",
                         "Container: " + ("other" if scenario == "wrong_container" else repair.CONTAINER),
                         "Profile: " + repair.active.PROFILE, "Parent: /" + repair.NAME, "Files: /run/" + repair.NAME]
                if scenario == "completed": lines.append("PASS: host test groups and temporary files removed")
                (root / "journal.jsonl").write_bytes(b"\n".join(json.dumps(value).encode() for value in rows))
                (root / "streams.log").write_bytes("\n".join(lines).encode())
                if scenario == "cleanup_exists": (root / "cleanup-v1").mkdir()
                with patch.object(s, "OLD_DIRECTORY", root), patch.object(repair.tree, "directory"), patch.object(repair.os.path, "lexists", return_value=False), patch.object(repair.active.failure, "private_file", side_effect=lambda path, *args: path.read_bytes()), patch.object(repair, "Path") as path, patch.object(repair.lab, "db") as db:
                    path.return_value.read_text.return_value = BOOT
                    if scenario == "ok":
                        saved, hashes = repair.failure_record(BEFORE, FROZEN, MANIFEST)
                        self.assertEqual(saved, prepared)
                        self.assertEqual(hashes, {name: hashlib.sha256((root / name).read_bytes()).hexdigest() for name in HASHES})
                    else:
                        with self.assertRaises(RuntimeError):
                            repair.failure_record(BEFORE, FROZEN, MANIFEST)
                    db.assert_not_called()

    def test_owned_container_validation_refuses_changed_identity_security_mounts_and_source(self):
        for scenario in ("ok", "running", "pid", "oom", "image", "restart", "parent", "profile", "privileged", "memory", "tasks", "caps", "ports", "mounts", "writable_bundle", "changed_bundle", "profile_in_use"):
            value = inspection()
            changes = {"running": True, "pid": 42, "oom": True, "image": "other", "restart": "always", "parent": "/other",
                       "profile": "docker-default", "privileged": True, "memory": 1, "tasks": 1, "caps": [], "ports": {"1/tcp": []}, "mounts": []}
            if scenario in changes: value[scenario] = changes[scenario]
            if scenario == "writable_bundle": value["mounts"][-1]["RW"] = True
            def command(*args):
                if args[:2] == ("docker", "inspect") and args[4] == repair.CONTAINER:
                    return json.dumps(value).encode()
                if args == ("docker", "ps", "-q"):
                    return b"known-running" if scenario == "profile_in_use" else b""
                if args[:2] == ("docker", "inspect"):
                    return repair.active.PROFILE.encode()
                raise AssertionError(args)
            original = s.bundle.HERE
            with self.subTest(scenario=scenario), patch.object(repair.lab, "run", side_effect=command), patch.object(Path, "resolve", lambda self: self), patch.object(s.bundle, "fingerprint", return_value="changed" if scenario == "changed_bundle" else repair.OLD_BUNDLE), patch.object(repair.tree, "remove_probe") as remove:
                if scenario == "ok": self.assertEqual(repair.inspect_owned(FROZEN), value)
                else:
                    with self.assertRaises(RuntimeError):
                        repair.inspect_owned(FROZEN)
                self.assertEqual(s.bundle.HERE, original)
                remove.assert_not_called()

    def test_cleanup_reaches_removal_only_after_every_owned_tree_is_empty(self):
        policy = b"fixed AppArmor policy"
        prepared = {"helpers_sha256": {"namespace-smoke.apparmor": hashlib.sha256(policy).hexdigest()}, "host_epoch": BOOT}
        roots = [Path("/sys/fs/cgroup") / name for name in ("memory", "cpu,cpuacct", "pids", "cpuset", "devices", "unified")]
        for scenario in ("ok", "live_task", "wrong_policy", "wrong_config", "new_runtime_file", "records_changed", "old_log_changed", "remove_failed"):
            def private(path, *args):
                if path.name == "judge0.conf": return b"not-a-real-config"
                if path.name == "profile": return b"changed" if scenario == "wrong_policy" else policy
                if path.name == "isolate.conf": return b"changed" if scenario == "wrong_config" else repair.CONFIG
                raise AssertionError(path)
            files = [Path("profile"), Path("isolate.conf")]
            if scenario == "new_runtime_file": files.append(Path("other"))
            with self.subTest(scenario=scenario), contextlib.ExitStack() as stack, contextlib.redirect_stdout(io.StringIO()):
                for context in (
                    patch.object(repair.lab.queue, "check_services"),
                    patch.object(s, "baseline", side_effect=[BEFORE, {"changed": True} if scenario == "records_changed" else BEFORE]),
                    patch.object(s.guard, "manifest", return_value=(FROZEN, MANIFEST)),
                    patch.object(repair, "failure_record", return_value=(prepared, HASHES)),
                    patch.object(repair.active.failure, "private_file", side_effect=private),
                    patch.object(repair.lab, "prepare_config", return_value=(b"", "not-a-real-token")),
                    patch.object(repair.lab.api, "check_api"), patch.object(repair.lab, "private_ip"),
                    patch.object(repair, "inspect_owned", return_value=inspection()), patch.object(repair.tree, "directory"),
                    patch.object(Path, "iterdir", return_value=iter(files)),
                    patch.object(Path, "read_text", side_effect=[repair.active.PROFILE + " (enforce)\n", ""]),
                    patch.object(repair.active, "roots", return_value=roots),
                    patch.object(s, "failed_hashes", return_value={"changed": True} if scenario == "old_log_changed" else HASHES),
                    patch.object(repair.lab, "run", return_value=b""), patch.object(repair.os.path, "lexists", return_value=False),
                    patch.object(s, "cleaned_failure"),
                ):
                    stack.enter_context(context)
                empty = stack.enter_context(patch.object(repair.tree, "empty_tree", return_value=[Mock()], side_effect=RuntimeError("live task") if scenario == "live_task" else None))
                journal = stack.enter_context(patch.object(repair.lab, "Journal"))
                remove = stack.enter_context(patch.object(repair.tree, "remove_probe", side_effect=RuntimeError("remove failed") if scenario == "remove_failed" else None))
                if scenario == "ok":
                    repair.cleanup()
                    self.assertEqual(empty.call_count, len(roots))
                    remove.assert_called_once()
                    self.assertEqual(journal.return_value.record.call_args.args, ("READY_FOR_CORRECTED_SUITE",))
                else:
                    with self.assertRaises(RuntimeError):
                        repair.cleanup()
                    ready = [call for call in journal.return_value.record.call_args_list if call.args[0] == "READY_FOR_CORRECTED_SUITE"]
                    self.assertEqual(ready, [])
                    if scenario in ("live_task", "wrong_policy", "wrong_config", "new_runtime_file"):
                        remove.assert_not_called()
                        journal.assert_not_called()

    def test_ready_proof_requires_complete_cleanup_same_boot_old_hashes_and_absent_resources(self):
        ready = {"event": "READY_FOR_CORRECTED_SUITE", "preserved": BEFORE, "old_sha256": HASHES,
                 "container": repair.CONTAINER, "parent": "/" + repair.NAME, "host_epoch": BOOT,
                 "controllers": [str(Path("/sys/fs/cgroup/memory"))]}
        events = ["VERIFIED_EMPTY", "CONTAINER_REMOVED", "PROFILE_REMOVED", "COMPLETE"]
        for scenario in ("ok", "incomplete", "old_rows", "old_hashes", "boot", "controllers", "container_remains", "group_remains", "profile_remains"):
            current = copy.deepcopy(ready)
            if scenario == "old_rows": current["preserved"] = {}
            if scenario == "old_hashes": current["old_sha256"] = {}
            if scenario == "boot": current["host_epoch"] = "old-boot"
            if scenario == "controllers": current["controllers"] = []
            rows = [{"event": event} for event in events] + ([] if scenario == "incomplete" else [current])
            raw = b"\n".join(json.dumps(row).encode() for row in rows)
            def read(path):
                return BOOT if str(path).endswith("boot_id") else repair.active.PROFILE + " (enforce)\n" if scenario == "profile_remains" else ""
            with self.subTest(scenario=scenario), patch.object(repair.tree, "directory"), patch.object(repair.active.failure, "private_file", return_value=raw), patch.object(s, "failed_hashes", return_value=HASHES), patch.object(Path, "read_text", read), patch.object(repair.active, "roots", return_value=[Path("/sys/fs/cgroup/memory")]), patch.object(repair.os.path, "lexists", return_value=scenario == "group_remains"), patch.object(repair.lab, "run", return_value=b"container" if scenario == "container_remains" else b"") as run:
                if scenario == "ok": self.assertEqual(s.cleaned_failure(BEFORE), hashlib.sha256(raw).hexdigest())
                else:
                    with self.assertRaises(RuntimeError):
                        s.cleaned_failure(BEFORE)
                self.assertTrue(all(call.args[:3] == ("docker", "ps", "-aq") for call in run.call_args_list))

    def test_repair_failure_never_dispatches_and_success_invokes_new_one_shot_once(self):
        for failed in (False, True):
            with self.subTest(failed=failed), patch.object(repair.platform, "system", return_value="Linux"), patch.object(repair.socket, "gethostname", return_value="ingenium-judge-spike-01"), patch.object(repair.os, "geteuid", return_value=0, create=True), patch.object(repair.os, "umask"), patch.object(repair.signal, "signal"), patch.object(repair.tree, "directory"), patch.object(repair, "cleanup", side_effect=RuntimeError("unsafe") if failed else None), patch.object(s, "main", return_value=0) as execute, contextlib.redirect_stderr(io.StringIO()):
                self.assertEqual(repair.main([]), int(failed))
                self.assertEqual(execute.call_count, int(not failed))
                if not failed: execute.assert_called_once_with([])

    def test_wrong_machine_user_or_arguments_cannot_clean_or_execute(self):
        for system, host, uid, args in (("Windows", "ingenium-judge-spike-01", 0, []), ("Linux", "cloudshell", 0, []),
                                        ("Linux", "ingenium-judge-spike-01", 1000, []), ("Linux", "ingenium-judge-spike-01", 0, ["--force"])):
            with self.subTest(system=system, host=host), patch.object(repair.platform, "system", return_value=system), patch.object(repair.socket, "gethostname", return_value=host), patch.object(repair.os, "geteuid", return_value=uid, create=True), patch.object(repair, "cleanup") as cleanup, patch.object(s, "main") as execute, contextlib.redirect_stderr(io.StringIO()):
                self.assertEqual(repair.main(args), 1)
                cleanup.assert_not_called()
                execute.assert_not_called()


if __name__ == "__main__":
    unittest.main()
