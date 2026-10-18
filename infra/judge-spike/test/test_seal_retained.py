import base64
import contextlib
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import stat
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch
import uuid


HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("seal_retained_test", HERE.parent / "seal-retained.py")
suite = importlib.util.module_from_spec(spec)
spec.loader.exec_module(suite)
r = suite.recovery
spec = importlib.util.spec_from_file_location("seal_profile_fixtures", HERE / "test_profiles.py")
fixtures = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fixtures)
OWNER, PROVIDER = str(uuid.uuid4()), str(uuid.uuid4())
VALUE = {"host_epoch": str(uuid.uuid4()), "payload_sha256": "a" * 64, "manifest_sha256": "b" * 64,
         "attempts": {"normal": str(uuid.uuid4()), "crash": str(uuid.uuid4())}}
BINDING = r.binding_for(VALUE, "normal")
FROZEN = json.loads(json.dumps({"image_id": "sha256:" + "d" * 64, "preserved_lab_sha256": "c" * 64,
                               "observed": fixtures.versions(), "source_lock": r.runtime.load_lock()}, sort_keys=True))
ROW = {"provider_id": PROVIDER, "owner_id": OWNER, "state": "STARTED", "permit_count": 1,
       "reserved": True, "evidence_sha256": None}


def json_bytes(value):
    return json.dumps(value).encode()


def journal(rows):
    return b"\n".join(json_bytes(row) for row in rows) + b"\n"


def retained_files():
    registration = json_bytes({"pid": 31, "exit_code": 73, "stdout_b64": "", "oversized": False})
    old = journal([{"event": "PREPARED", "manifest_sha256": VALUE["manifest_sha256"], "preserved_lab_sha256": "c" * 64},
                   {"event": "SCHEMA_CREATE_STARTED", "schema_sha256": hashlib.sha256((r.HERE / "recovery.sql").read_bytes()).hexdigest()},
                   {"event": "SCHEMA_CREATED"}])
    repair = journal([{"event": "VERIFIED_UNSTARTED", "binding": BINDING, "provider_id": PROVIDER,
                       "preserved_lab_sha256": "c" * 64, "original_journal_sha256": hashlib.sha256(old).hexdigest(),
                       "original_worker_reply_sha256": hashlib.sha256(registration).hexdigest()},
                      {"event": "REGISTRATION_RECONCILED", "provider_id": PROVIDER}])
    log = fixtures.log_bytes().replace(b"PASS: host test groups", suite.CONTAINER.encode() + b"\nPASS: host test groups")
    execution = journal([{"event": "LAUNCH_AUTHORISED", "binding": BINDING, "owner_id": OWNER, "image_id": FROZEN["image_id"]},
                         {"event": "SANDBOX_STARTED"}, {"event": "SANDBOX_FINISHED", "log_sha256": hashlib.sha256(log).hexdigest()}])
    return {"context.json": json_bytes(VALUE), "journal.jsonl": old, "register-lost-0.json": registration,
            "registration-fix-v1/journal.jsonl": repair, "execution/journal.jsonl": execution, "execution/sandbox.log": log,
            "deliver-0.json": json_bytes({"pid": 42, "exit_code": 1, "oversized": False,
                                          "stdout_b64": base64.b64encode(b"FAIL: Profile source/ordering differs. Preserve evidence.\n").decode()})}


class SealRetainedTests(unittest.TestCase):
    def test_checkpoint_accepts_only_the_bound_completed_unsealed_run_and_does_not_mutate(self):
        for scenario in ("valid", "different_error", "different_owner", "already_sealed", "extra_evidence", "changed_log",
                         "missing_cleanup", "extra_stage", "old_evidence_changed", "existing_repair", "active_execution"):
            with self.subTest(scenario=scenario), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                old = root / "recovery-v1"
                files = retained_files()
                if scenario == "different_error":
                    worker = json.loads(files["deliver-0.json"])
                    worker["stdout_b64"] = base64.b64encode(b"FAIL: another error").decode()
                    files["deliver-0.json"] = json_bytes(worker)
                if scenario == "extra_stage":
                    files["execution/journal.jsonl"] += json_bytes({"event": "EVIDENCE_SAVED"}) + b"\n"
                if scenario == "old_evidence_changed":
                    files["journal.jsonl"] = files["journal.jsonl"].replace(b"{", b"{ ", 1)
                if scenario == "changed_log":
                    files["execution/sandbox.log"] += b"changed\n"
                if scenario == "missing_cleanup":
                    files["execution/sandbox.log"] = files["execution/sandbox.log"].replace(b"PASS: host test groups and temporary files removed", b"cleanup missing")
                    events = [json.loads(line) for line in files["execution/journal.jsonl"].splitlines()]
                    events[-1]["log_sha256"] = hashlib.sha256(files["execution/sandbox.log"]).hexdigest()
                    files["execution/journal.jsonl"] = journal(events)
                for name, raw in files.items():
                    path = old / name
                    path.parent.mkdir(parents=True, exist_ok=True)
                    path.write_bytes(raw)
                if scenario == "extra_evidence":
                    (old / "execution/evidence.json").write_bytes(b"existing")
                if scenario == "existing_repair":
                    (old / "evidence-fix-v1").mkdir()
                real_lstat = Path.lstat
                def info(path):
                    if path in (root, old, old / "registration-fix-v1", old / "execution"):
                        return SimpleNamespace(st_uid=0, st_gid=0, st_mode=stat.S_IFDIR | 0o700)
                    return real_lstat(path)
                row = dict(ROW, owner_id=str(uuid.uuid4())) if scenario == "different_owner" else dict(ROW, state="SEALED") if scenario == "already_sealed" else ROW
                with patch.object(suite.lab, "RUNTIME", root), patch.object(r, "DIRECTORY", old), patch.object(suite, "REPAIR", old / "evidence-fix-v1"), patch.object(Path, "lstat", info), patch.object(suite.failure, "private_file", side_effect=lambda path, *args: path.read_bytes()), patch.object(r, "context", return_value=(VALUE, FROZEN)), patch.object(r, "observe", return_value=row), patch.object(suite.lab, "db", return_value={"count": 1}) as db, patch.object(suite, "no_active_execution", side_effect=RuntimeError("active") if scenario == "active_execution" else None), patch.object(suite.lab, "Journal") as create, contextlib.redirect_stdout(io.StringIO()):
                    if scenario == "valid":
                        value, frozen, observed, evidence, hashes = suite.checkpoint()
                        self.assertEqual((value, frozen, observed), (VALUE, FROZEN, ROW))
                        self.assertEqual(evidence["binding"], BINDING)
                        self.assertEqual([item["profile"] for item in evidence["parity"]], list(r.profiles.PROFILE_ORDER))
                        self.assertEqual(hashes, {name: hashlib.sha256(raw).hexdigest() for name, raw in files.items()})
                    else:
                        with self.assertRaises(RuntimeError):
                            suite.checkpoint()
                    create.assert_not_called()
                    self.assertTrue(all(call.kwargs == {} for call in db.call_args_list))
                self.assertTrue(all((old / name).read_bytes() == raw for name, raw in files.items()))

    def test_physical_guard_requires_no_containers_policy_groups_files_or_old_workers(self):
        mounts = ["/sys/fs/cgroup/" + name for name in ("memory", "cpu,cpuacct", "pids", "cpuset", "unified")]
        for scenario in ("valid", "container", "policy", "group", "temporary", "worker", "oversized_identity", "missing_process", "bad_mounts"):
            with self.subTest(scenario=scenario), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                def mapped(name):
                    return root / str(name).lstrip("/")
                for name in mounts + ["/proc/123", "/run", "/sys/kernel/security/apparmor"]:
                    mapped(name).mkdir(parents=True, exist_ok=True)
                mapped("/sys/kernel/security/apparmor/profiles").write_text(suite.PROFILE + " (enforce)\n" if scenario == "policy" else "docker-default (enforce)\n")
                command = b"/usr/bin/python3\0/home/vm/recovery.py\0--deliver\0" if scenario == "worker" else b"X" * 32769 if scenario == "oversized_identity" else b""
                if scenario != "missing_process":
                    mapped("/proc/123/cmdline").write_bytes(command)
                if scenario == "group":
                    (mapped(mounts[0]) / suite.PARENT).mkdir()
                if scenario == "temporary":
                    (mapped("/run") / suite.PARENT).mkdir()
                inventory = mounts + [mounts[0]] if scenario == "bad_mounts" else mounts
                with patch.object(suite, "Path", side_effect=mapped), patch.object(suite.lab, "run", side_effect=[suite.CONTAINER.encode() if scenario == "container" else b"", "\n".join(inventory).encode()]) as run:
                    if scenario in ("valid", "missing_process"):
                        suite.no_active_execution()
                    else:
                        with self.assertRaises(RuntimeError):
                            suite.no_active_execution()
                    self.assertTrue(all(call.args[0] in ("docker", "findmnt") for call in run.call_args_list))
                    self.assertFalse(any("rm" in call.args or "stop" in call.args for call in run.call_args_list))

    def test_repair_only_seals_saved_evidence_and_never_calls_a_sandbox_launcher(self):
        for scenario in ("valid", "bad_checkpoint", "changed_baseline", "duplicate_failed", "seal_failed", "old_file_changed"):
            with self.subTest(scenario=scenario):
                original = b"original file\n"
                hashes = {"execution/sandbox.log": hashlib.sha256(original).hexdigest()}
                evidence = {"binding": BINDING, "owner_id": OWNER}
                record = Mock()
                children = Mock()
                if scenario in ("duplicate_failed", "seal_failed"):
                    children.side_effect = lambda mode, *args: (_ for _ in ()).throw(RuntimeError("child failed")) if mode == ("--duplicate-only" if scenario == "duplicate_failed" else "--seal-saved") else None
                create, finish = Mock(return_value=record), Mock()
                patches = [patch.object(suite.platform, "system", return_value="Linux"),
                           patch.object(suite.socket, "gethostname", return_value="ingenium-judge-spike-01"),
                           patch.object(suite.os, "geteuid", return_value=0, create=True), patch.object(suite.os, "umask"),
                           patch.object(suite.signal, "signal"), patch.object(suite.lab.queue, "check_services"),
                           patch.object(suite, "checkpoint", return_value=(VALUE, FROZEN, ROW, evidence, hashes), side_effect=RuntimeError("guard failed") if scenario == "bad_checkpoint" else None),
                           patch.object(r.profiles, "completed_baseline", return_value="changed" if scenario == "changed_baseline" else "c" * 64),
                           patch.object(suite.failure, "private_file", return_value=b"changed" if scenario == "old_file_changed" else original),
                           patch.object(suite.lab, "prepare_config", return_value=(b"config", "private-token")),
                           patch.object(suite.lab, "private_ip", return_value="172.20.0.4"), patch.object(suite.lab.api, "check_api"),
                           patch.object(suite.lab, "Journal", create), patch.object(r, "private_json", return_value="e" * 64),
                           patch.object(r, "children", children), patch.object(r, "finish_delivered", finish),
                           patch.object(suite.lab, "db", return_value={"count": 2}),
                           patch.object(r.profiles, "snapshot", return_value="c" * 64), patch.object(suite.lab, "redis", return_value=b"empty"),
                           patch.object(suite, "no_active_execution")]
                with contextlib.ExitStack() as stack:
                    for item in patches:
                        stack.enter_context(item)
                    launch = stack.enter_context(patch.object(r.profiles, "logged"))
                    deliver = stack.enter_context(patch.object(r, "deliver"))
                    stack.enter_context(contextlib.redirect_stdout(io.StringIO()))
                    stack.enter_context(contextlib.redirect_stderr(io.StringIO()))
                    self.assertEqual(suite.main([]), 0 if scenario == "valid" else 1)
                    launch.assert_not_called()
                    deliver.assert_not_called()
                if scenario == "valid":
                    self.assertEqual([call.args for call in children.call_args_list], [("--duplicate-only", 4, [0, 0, 0, 0]), ("--seal-saved", 1, [75])])
                    finish.assert_called_once_with(record, VALUE, PROVIDER)
                    self.assertEqual(record.record.call_args.kwargs["new_sandbox_launches"], 0)
                if scenario in ("bad_checkpoint", "changed_baseline"):
                    create.assert_not_called()
                    children.assert_not_called()
                self.assertEqual("COMPLETE" in [call.args[0] for call in record.record.call_args_list], scenario == "valid")
                self.assertTrue(all(call.args[0] != "--deliver" for call in children.call_args_list))

    def test_wrong_host_user_or_arguments_cannot_inspect_or_seal(self):
        for system, host, uid, args in (("Windows", "ingenium-judge-spike-01", 0, []), ("Linux", "cloudshell", 0, []),
                                        ("Linux", "ingenium-judge-spike-01", 1000, []), ("Linux", "ingenium-judge-spike-01", 0, ["--force"])):
            with self.subTest(host=host, uid=uid), patch.object(suite.platform, "system", return_value=system), patch.object(suite.socket, "gethostname", return_value=host), patch.object(suite.os, "geteuid", return_value=uid, create=True), patch.object(suite, "checkpoint") as inspect, patch.object(r, "children") as children, contextlib.redirect_stderr(io.StringIO()):
                self.assertEqual(suite.main(args), 1)
                inspect.assert_not_called()
                children.assert_not_called()


if __name__ == "__main__":
    unittest.main()
