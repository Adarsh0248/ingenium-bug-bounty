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


spec = importlib.util.spec_from_file_location("resume_registration_test", Path(__file__).resolve().parent.parent / "resume-registration.py")
resume = importlib.util.module_from_spec(spec)
spec.loader.exec_module(resume)
suite = resume.recovery
EPOCH, ATTEMPT, PROVIDER = [str(uuid.uuid4()) for _ in range(3)]
VALUE = {"host_epoch": EPOCH, "manifest_sha256": "a" * 64, "payload_sha256": "b" * 64,
         "attempts": {"normal": ATTEMPT, "crash": str(uuid.uuid4())}}
FROZEN = {"preserved_lab_sha256": "c" * 64}
ROW = {"provider_id": PROVIDER, "state": "PREPARED", "owner_id": None,
       "permit_count": 0, "reserved": True, "evidence_sha256": None}


class ResumeRegistrationTests(unittest.TestCase):
    def test_checkpoint_allows_only_the_exact_unstarted_prelaunch_failure_without_mutation(self):
        for scenario in ("valid", "wrong_stage", "wrong_schema", "changed_manifest", "bad_worker_exit", "extra_files",
                         "started", "extra_rows", "already_repaired", "wrong_owner", "linked_directory"):
            with self.subTest(scenario=scenario), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                old = root / "recovery-v1"
                old.mkdir()
                repair = old / "registration-fix-v1"
                ddl = (resume.HERE / "recovery.sql").read_bytes()
                rows = [{"event": "PREPARED", "manifest_sha256": "a" * 64, "preserved_lab_sha256": "c" * 64},
                        {"event": "SCHEMA_CREATE_STARTED", "schema_sha256": hashlib.sha256(ddl).hexdigest()},
                        {"event": "SCHEMA_CREATED"}]
                reply = {"pid": 123, "exit_code": 73, "stdout_b64": "", "oversized": False}
                if scenario == "wrong_stage":
                    rows.append({"event": "REGISTRATION_RECONCILED"})
                if scenario == "wrong_schema":
                    rows[1]["schema_sha256"] = "0" * 64
                if scenario == "changed_manifest":
                    rows[0]["manifest_sha256"] = "0" * 64
                if scenario == "bad_worker_exit":
                    reply["exit_code"] = 1
                files = {"journal.jsonl": b"\n".join(json.dumps(row).encode() for row in rows) + b"\n",
                         "context.json": b"fixed old context", "register-lost-0.json": json.dumps(reply).encode()}
                for name, raw in files.items():
                    (old / name).write_bytes(raw)
                if scenario == "extra_files":
                    (old / "execution").mkdir()
                if scenario == "already_repaired":
                    repair.mkdir()
                real_lstat = Path.lstat
                def info(path):
                    if path in (root, old):
                        return SimpleNamespace(st_uid=1000 if scenario == "wrong_owner" else 0, st_gid=0,
                                               st_mode=(stat.S_IFLNK if scenario == "linked_directory" else stat.S_IFDIR) | 0o700)
                    return real_lstat(path)
                def private(path, *args):
                    return files[path.name]
                observed = dict(ROW, state="STARTED", permit_count=1) if scenario == "started" else ROW
                with patch.object(resume.lab, "RUNTIME", root), patch.object(suite, "DIRECTORY", old), patch.object(resume, "REPAIR", repair), patch.object(Path, "lstat", info), patch.object(resume.failure, "private_file", side_effect=private), patch.object(suite, "context", return_value=(VALUE, FROZEN)), patch.object(suite, "observe", return_value=observed), patch.object(resume.lab, "db", return_value={"count": 2 if scenario == "extra_rows" else 1}) as db, patch.object(suite, "claim") as claim, patch.object(resume.lab, "Journal") as journal:
                    if scenario == "valid":
                        value, frozen, row, hashes = resume.checkpoint()
                        self.assertEqual((value, frozen, row), (VALUE, FROZEN, ROW))
                        self.assertEqual(hashes["original_journal_sha256"], hashlib.sha256(files["journal.jsonl"]).hexdigest())
                        self.assertEqual(hashes["original_worker_reply_sha256"], hashlib.sha256(files["register-lost-0.json"]).hexdigest())
                    else:
                        with self.assertRaises(RuntimeError):
                            resume.checkpoint()
                    self.assertTrue(all(call.kwargs == {} for call in db.call_args_list))
                    claim.assert_not_called()
                    journal.assert_not_called()
                self.assertTrue(all((old / name).read_bytes() == raw for name, raw in files.items()))

    def test_null_transport_reproduction_is_read_only_and_does_not_treat_unknown_empty_output_as_success(self):
        error = json.JSONDecodeError("Expected JSON", "", 0)
        for replies, success in (([error, None], True), ([{}, None], False), ([error, {}], False)):
            with self.subTest(success=success), patch.object(resume.lab, "db", side_effect=replies) as db:
                if success:
                    resume.check_null_transport()
                    self.assertEqual(db.call_count, 2)
                else:
                    with self.assertRaises(RuntimeError):
                        resume.check_null_transport()
                self.assertTrue(all(call.kwargs == {} for call in db.call_args_list))

    def test_continuation_cannot_start_until_all_preflight_checks_pass_and_never_recreates_schema(self):
        for scenario in ("valid", "wrong_checkpoint", "changed_baseline", "unexpected_transport", "continuation_failed", "changed_final_data"):
            with self.subTest(scenario=scenario):
                journal = Mock()
                raw = b"original failed journal\n"
                hashes = {"original_journal_sha256": hashlib.sha256(raw).hexdigest(), "original_worker_reply_sha256": "d" * 64}
                continue_work, create_journal = Mock(), Mock(return_value=journal)
                if scenario == "continuation_failed":
                    continue_work.side_effect = RuntimeError("fixed failure")
                db = Mock(return_value={"count": 2})
                patches = [patch.object(resume.platform, "system", return_value="Linux"),
                           patch.object(resume.socket, "gethostname", return_value="ingenium-judge-spike-01"),
                           patch.object(resume.os, "geteuid", return_value=0, create=True),
                           patch.object(resume.os, "umask"), patch.object(resume.signal, "signal"),
                           patch.object(resume.lab.queue, "check_services"),
                           patch.object(resume, "checkpoint", return_value=(VALUE, FROZEN, ROW, hashes),
                                        side_effect=RuntimeError("guard refused") if scenario == "wrong_checkpoint" else None),
                           patch.object(suite.profiles, "completed_baseline", return_value="changed" if scenario == "changed_baseline" else "c" * 64),
                           patch.object(resume.failure, "private_file", return_value=raw),
                           patch.object(resume.lab, "prepare_config", return_value=(b"config", "private-token")),
                           patch.object(resume.lab, "private_ip", return_value="172.20.0.4"),
                           patch.object(resume.lab.api, "check_api"),
                           patch.object(resume, "check_null_transport", side_effect=RuntimeError("unknown transport") if scenario == "unexpected_transport" else None),
                           patch.object(resume.lab, "Journal", create_journal),
                           patch.object(suite, "continue_registered", continue_work),
                           patch.object(resume.lab, "db", db),
                           patch.object(suite.profiles, "snapshot", return_value="changed" if scenario == "changed_final_data" else "c" * 64),
                           patch.object(resume.lab, "redis", return_value=b"empty")]
                with contextlib.ExitStack() as stack:
                    for item in patches:
                        stack.enter_context(item)
                    stack.enter_context(contextlib.redirect_stdout(io.StringIO()))
                    stack.enter_context(contextlib.redirect_stderr(io.StringIO()))
                    self.assertEqual(resume.main([]), 0 if scenario == "valid" else 1)
                allowed = scenario in ("valid", "continuation_failed", "changed_final_data")
                self.assertEqual(create_journal.call_count, int(allowed))
                self.assertEqual(continue_work.call_count, int(allowed))
                if allowed:
                    continue_work.assert_called_once_with(journal, VALUE)
                self.assertTrue(all(call.kwargs == {} and "CREATE " not in call.args[0] for call in db.call_args_list))
                events = [call.args[0] for call in journal.record.call_args_list]
                self.assertEqual("COMPLETE" in events, scenario == "valid")

    def test_wrong_machine_user_or_arguments_cannot_inspect_or_continue(self):
        for system, host, uid, args in (("Windows", "ingenium-judge-spike-01", 0, []), ("Linux", "cloudshell", 0, []),
                                        ("Linux", "ingenium-judge-spike-01", 1000, []), ("Linux", "ingenium-judge-spike-01", 0, ["--force"])):
            with self.subTest(host=host, uid=uid, args=args), patch.object(resume.platform, "system", return_value=system), patch.object(resume.socket, "gethostname", return_value=host), patch.object(resume.os, "geteuid", return_value=uid, create=True), patch.object(resume, "checkpoint") as inspect, patch.object(suite, "continue_registered") as run, patch.object(resume.lab, "db") as db, contextlib.redirect_stderr(io.StringIO()):
                self.assertEqual(resume.main(args), 1)
                inspect.assert_not_called()
                run.assert_not_called()
                db.assert_not_called()


if __name__ == "__main__":
    unittest.main()
