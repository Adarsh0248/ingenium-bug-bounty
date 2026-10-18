import base64
import contextlib
import importlib.util
import io
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import MagicMock, Mock, patch


spec = importlib.util.spec_from_file_location("cleanup_profiles", Path(__file__).resolve().parent.parent / "cleanup-profiles-v1.py")
cleanup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cleanup)
IMAGE = "sha256:" + "a" * 64
ID = "b" * 64


def inspection():
    return {"name": "/" + cleanup.CONTAINER, "id": ID, "running": False, "restarting": False,
            "pid": 0, "exit": 1, "oom": False, "restart": "no", "image": IMAGE,
            "parent": "/" + cleanup.NAME, "profile": cleanup.PROFILE}


class CleanupProfileTests(unittest.TestCase):
    def test_only_empty_owned_directories_are_returned_deepest_first(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            parent = root / "parent"
            paths = [parent, parent / "jobs", parent / "jobs" / "box-0", parent / ID]
            for path in paths:
                path.mkdir(parents=True, exist_ok=True)
                (path / "tasks").write_bytes(b"")
            result = cleanup.empty_tree(parent, ID, jobs=True, unified=False)
            self.assertEqual(set(result), set(paths))
            self.assertLess(result.index(parent / "jobs" / "box-0"), result.index(parent / "jobs"))
            self.assertEqual(result[-1], parent)
            (parent / "jobs" / "box-0" / "tasks").write_bytes(b"123\n")
            with self.assertRaises(RuntimeError):
                cleanup.empty_tree(parent, ID, jobs=True, unified=False)
            self.assertTrue(all(path.exists() for path in paths))

    def test_unexpected_children_or_absent_task_files_block_cleanup_without_mutation(self):
        for scenario in ("unexpected", "nested", "missing"):
            with self.subTest(scenario=scenario), tempfile.TemporaryDirectory() as directory:
                parent = Path(directory) / "parent"
                parent.mkdir()
                (parent / "tasks").write_bytes(b"")
                if scenario == "unexpected":
                    (parent / "someone-else").mkdir()
                elif scenario == "nested":
                    (parent / ID / "other").mkdir(parents=True)
                    (parent / ID / "tasks").write_bytes(b"")
                else:
                    (parent / "tasks").unlink()
                with self.assertRaises((RuntimeError, OSError)):
                    cleanup.empty_tree(parent, ID, jobs=False, unified=False)
                self.assertTrue(parent.exists())

    def test_unified_hierarchy_uses_cgroup_procs(self):
        with tempfile.TemporaryDirectory() as directory:
            parent = Path(directory)
            (parent / "cgroup.procs").write_bytes(b"")
            self.assertEqual(cleanup.empty_tree(parent, ID, jobs=False, unified=True), [parent])

    def test_failure_record_requires_exact_original_bundle_loader_error_and_resource_names(self):
        self.assertEqual(len(cleanup.LOADER_ERROR), 134)
        self.assertEqual(cleanup.LOADER_ERROR, base64.b64decode("L3Vzci9sb2NhbC9qYXZhL2Jpbi9qYXZhYzogZXJyb3Igd2hpbGUgbG9hZGluZyBzaGFyZWQgbGlicmFyaWVzOiBsaWJqbGkuc286IGNhbm5vdCBvcGVuIHNoYXJlZCBvYmplY3QgZmlsZTogTm8gc3VjaCBmaWxlIG9yIGRpcmVjdG9yeQo="))
        journal = [{"event": "PREPARED", "bundle_sha256": cleanup.OLD_BUNDLE, "preserved_lab_sha256": "snapshot"},
                   {"event": "IMAGE_BUILT", "bundle_sha256": cleanup.OLD_BUNDLE, "image": IMAGE},
                   {"event": "PARITY_STARTED"}]
        for scenario in ("valid", "wrong_bundle", "completed", "wrong_error", "different_container"):
            rows = json.loads(json.dumps(journal))
            error = cleanup.LOADER_ERROR
            if scenario == "wrong_bundle": rows[0]["bundle_sha256"] = "0" * 64
            elif scenario == "completed": rows[-1]["event"] = "COMPLETE"
            elif scenario == "wrong_error": error = b"different failure\n"
            diagnostic = {"/var/local/lib/isolate/0/box/stderr": {"prefix_b64": base64.b64encode(error).decode(),
                          "observed_bytes": len(error), "truncated": False}}
            container = "other" if scenario == "different_container" else cleanup.CONTAINER
            log = ("INGENIUM_PROFILE_DIAGNOSTIC " + json.dumps(diagnostic) + f"\nContainer: {container}\nParent: /{cleanup.NAME}\nFiles: /run/{cleanup.NAME}\n").encode()
            with self.subTest(scenario=scenario), patch.object(cleanup, "directory"), patch.object(Path, "exists", return_value=False), patch.object(Path, "is_symlink", return_value=False), patch.object(cleanup.failure, "private_file", side_effect=["\n".join(json.dumps(row) for row in rows).encode(), log]):
                if scenario == "valid":
                    old, image, snapshot, fingerprint = cleanup.failure_record()
                    self.assertEqual((old.name, image, snapshot), ("profiles-v1", IMAGE, "snapshot"))
                    self.assertEqual(len(fingerprint), 64)
                else:
                    with self.assertRaises(RuntimeError):
                        cleanup.failure_record()

    def test_changed_container_identity_or_live_state_cannot_reach_any_removal(self):
        for field, value in (("running", True), ("restarting", True), ("pid", 42), ("exit", 0),
                             ("oom", True), ("restart", "always"), ("image", "other"), ("parent", "/other"),
                             ("profile", "docker-default"), ("id", "not-an-id")):
            state = inspection()
            state[field] = value
            with self.subTest(field=field), patch.object(cleanup, "failure_record", return_value=(Path("unused"), IMAGE, "snapshot", "hash")), patch.object(Path, "exists", return_value=False), patch.object(Path, "is_symlink", return_value=False), patch.object(cleanup.lab.queue, "check_services"), patch.object(cleanup.profiles, "completed_baseline", return_value="snapshot"), patch.object(cleanup.lab, "run", side_effect=[b"", json.dumps(state).encode()]) as run, patch.object(cleanup, "remove_probe") as remove:
                with self.assertRaises(RuntimeError):
                    cleanup.cleanup()
                remove.assert_not_called()
                self.assertEqual(run.call_count, 2)

    def test_removal_failure_stops_before_policy_or_group_cleanup(self):
        for fail_step in (0, 1, None):
            journal, retained, group = Mock(), MagicMock(), Mock()
            group.exists.return_value = True
            results = [b"", b""]
            if fail_step is not None:
                results[fail_step] = subprocess.CalledProcessError(1, "fixed-command")
            with self.subTest(fail_step=fail_step), patch.object(cleanup.lab, "run", side_effect=results) as run:
                if fail_step is None:
                    cleanup.remove_probe(journal, retained, [group])
                    group.rmdir.assert_called_once()
                    self.assertEqual(journal.record.call_args.args, ("COMPLETE",))
                else:
                    with self.assertRaises(subprocess.CalledProcessError):
                        cleanup.remove_probe(journal, retained, [group])
                    group.rmdir.assert_not_called()
                    retained.rmdir.assert_not_called()
                    self.assertEqual(run.call_count, fail_step + 1)
                self.assertEqual(run.call_args_list[0].args, ("docker", "rm", cleanup.CONTAINER))
                self.assertFalse(any("--force" in call.args or "-f" in call.args for call in run.call_args_list))

    def test_wrong_machine_user_or_arguments_cannot_inspect_or_clean(self):
        for system, host, uid, args in (("Windows", "ingenium-judge-spike-01", 0, []),
                                        ("Linux", "cloudshell", 0, []), ("Linux", "ingenium-judge-spike-01", 1000, []),
                                        ("Linux", "ingenium-judge-spike-01", 0, ["--force"])):
            with self.subTest(host=host), patch.object(cleanup.platform, "system", return_value=system), patch.object(cleanup.socket, "gethostname", return_value=host), patch.object(cleanup.os, "geteuid", return_value=uid, create=True), patch.object(cleanup, "cleanup") as action, contextlib.redirect_stderr(io.StringIO()):
                self.assertEqual(cleanup.main(args), 1)
                action.assert_not_called()


if __name__ == "__main__":
    unittest.main()
