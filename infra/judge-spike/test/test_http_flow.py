import contextlib
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import Mock, patch
import uuid

spec = importlib.util.spec_from_file_location("http_flow_tests", Path(__file__).resolve().parent.parent / "http-flow.py")
suite = importlib.util.module_from_spec(spec)
spec.loader.exec_module(suite)
spec = importlib.util.spec_from_file_location("http_flow_baseline", Path(__file__).resolve().parent / "test_one_job.py")
baseline = importlib.util.module_from_spec(spec)
spec.loader.exec_module(baseline)
BINDING = {"attempt_id": str(uuid.uuid4()), "host_epoch": str(uuid.uuid4()),
           "payload_sha256": "a" * 64, "manifest_sha256": "b" * 64}
TOKEN, OWNER = str(uuid.uuid4()), str(uuid.uuid4())
ROW = {"token": TOKEN, "submission_id": 71, "envelope": baseline.envelope()}
ROW["envelope"]["args"][0]["arguments"] = [71]


class HttpFlowTests(unittest.TestCase):
    def test_new_guard_instance_does_not_redirect_old_recovery_to_new_schema(self):
        spec = importlib.util.spec_from_file_location("original_guard", suite.HERE / "recovery.py")
        old = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(old)
        self.assertEqual(old.TABLE, "ingenium_recovery_v1.attempts")
        self.assertEqual(suite.guard.TABLE, "ingenium_http_v1.attempts")

    def test_association_requires_real_token_integer_id_and_exact_stock_envelope(self):
        for changed in (ROW, dict(ROW, token="bad"), dict(ROW, submission_id=True), dict(ROW, envelope={}), None):
            with self.subTest(row=changed), patch.object(suite.lab, "db", return_value=changed) as db:
                if changed == ROW:
                    self.assertEqual(suite.row_for(BINDING), ROW)
                    self.assertNotIn("write", db.call_args.kwargs)
                else:
                    with self.assertRaises((RuntimeError, ValueError)):
                        suite.row_for(BINDING)

    def test_lost_token_body_is_never_read_and_post_is_not_retried(self):
        connection = Mock()
        connection.getresponse.return_value.status = 201
        with patch.object(suite.http.client, "HTTPConnection", return_value=connection):
            suite.discard_token_reply("172.20.0.9", "secret", BINDING)
        connection.request.assert_called_once()
        connection.getresponse.return_value.read.assert_not_called()
        connection.close.assert_called_once()
        for failure in (OSError("lost reply"), subprocess.TimeoutExpired("transport", 5)):
            connection = Mock()
            connection.getresponse.side_effect = failure
            with patch.object(suite.http.client, "HTTPConnection", return_value=connection), self.assertRaises(type(failure)):
                suite.discard_token_reply("172.20.0.9", "secret", BINDING)
            connection.request.assert_called_once()
            connection.close.assert_called_once()

    def test_uncertain_or_duplicate_permit_cannot_reach_launcher(self):
        for outcome in (False, RuntimeError("lost permit reply")):
            stream = io.BytesIO(json.dumps(ROW["envelope"]).encode() + b"\n")
            with self.subTest(outcome=outcome), patch.object(suite, "context", return_value={"binding": BINDING}), patch.object(suite, "row_for", return_value=ROW), patch.object(suite.sys, "stdin", Mock(buffer=stream)), patch.object(suite.guard, "claim", side_effect=outcome if isinstance(outcome, Exception) else None, return_value=False), patch.object(suite.lab, "Journal") as journal, patch.object(suite.lab, "execute_fixed_job") as launch, contextlib.redirect_stdout(io.StringIO()) as output:
                if outcome is False:
                    self.assertEqual(suite.worker(), 0)
                    self.assertEqual(json.loads(output.getvalue()), {"launched": False})
                else:
                    with self.assertRaises(RuntimeError):
                        suite.worker()
                journal.assert_not_called()
                launch.assert_not_called()

    def test_queue_tampering_refused_before_claim(self):
        envelope = json.loads(json.dumps(ROW["envelope"]))
        envelope["args"][0]["job_id"] = str(uuid.uuid4())
        stream = io.BytesIO(json.dumps(envelope).encode() + b"\n")
        with patch.object(suite, "context", return_value={"binding": BINDING}), patch.object(suite, "row_for", return_value=ROW), patch.object(suite.sys, "stdin", Mock(buffer=stream)), patch.object(suite.guard, "claim") as claim, self.assertRaises(RuntimeError):
            suite.worker()
        claim.assert_not_called()

    def test_winning_worker_seals_only_saved_cleanup_evidence_and_never_retries(self):
        for scenario in ("success", "sandbox_failure", "lost_seal_reply"):
            with self.subTest(scenario=scenario), tempfile.TemporaryDirectory() as directory:
                target = Path(directory)
                def launch(journal):
                    if scenario == "sandbox_failure":
                        raise RuntimeError("cleanup uncertain")
                    (journal.directory / "sandbox.log").write_bytes(baseline.sandbox_log())
                    return baseline.evidence()[0]
                stream = io.BytesIO(json.dumps(ROW["envelope"]).encode() + b"\n")
                with patch.object(suite, "DIRECTORY", target), patch.object(suite, "context", return_value={"binding": BINDING}), patch.object(suite, "row_for", return_value=ROW), patch.object(suite.sys, "stdin", Mock(buffer=stream)), patch.object(suite.guard, "claim", return_value=True) as claim, patch.object(suite.lab, "db", return_value={"updated": True}), patch.object(suite.lab, "execute_fixed_job", side_effect=launch) as execute, patch.object(suite, "seal_result", side_effect=RuntimeError("lost seal reply") if scenario == "lost_seal_reply" else None) as seal, patch.object(suite.os, "_exit", side_effect=SystemExit(75)) as exit_process, patch.object(suite.lab, "sync_directory"):
                    with self.assertRaises(SystemExit if scenario == "success" else RuntimeError):
                        suite.worker()
                    claim.assert_called_once()
                    execute.assert_called_once()
                    if scenario == "sandbox_failure":
                        seal.assert_not_called()
                        self.assertFalse((target / "execution" / "evidence.json").exists())
                    else:
                        seal.assert_called_once()
                        saved = (target / "execution" / "evidence.json").read_bytes()
                        self.assertEqual(seal.call_args.args[-1], hashlib.sha256(saved).hexdigest())
                        self.assertEqual(json.loads(saved)["binding"], BINDING)
                    self.assertEqual(exit_process.call_count, int(scenario == "success"))

    def test_result_and_seal_are_in_same_atomic_do_block_with_both_row_checks(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(suite, "DIRECTORY", Path(directory)), patch.object(suite.lab, "db", return_value={"sealed": True}) as db:
            execution = Path(directory) / "execution"
            execution.mkdir()
            (execution / "sandbox.log").write_bytes(baseline.sandbox_log())
            suite.seal_result(BINDING, OWNER, ROW, baseline.evidence()[0], "e" * 64)
        sql = db.call_args.args[0]
        self.assertEqual(db.call_args.kwargs, {"write": True})
        self.assertEqual(sql.count("IF NOT FOUND THEN RAISE EXCEPTION"), 2)
        self.assertLess(sql.index("UPDATE ingenium_http_v1"), sql.index("UPDATE submissions"))
        self.assertLess(sql.index("UPDATE submissions"), sql.index("END; $seal$"))
        self.assertIn("AND owner_id = '" + OWNER + "'", sql)
        self.assertIn("(SELECT count(*) FROM submissions) = 10", sql)
        self.assertIn("WHERE id = 71 AND status_id = 2", sql)

    def test_context_boot_helper_payload_and_manifest_are_frozen_before_launch(self):
        helper = b"fixed host helper"
        helper_sha = hashlib.sha256(helper).hexdigest()
        binding = dict(BINDING, payload_sha256=suite.failure.canonical_hash({"scope": suite.SCOPE, "payload": suite.lab.PAYLOAD, "helper_sha256": helper_sha}))
        value = {"scope": suite.SCOPE, "binding": binding, "payload": suite.lab.PAYLOAD, "helper_sha256": helper_sha}
        for changed in (False, True):
            with self.subTest(changed_boot=changed), patch.object(suite.failure, "private_file", return_value=json.dumps(value).encode()), patch.object(suite.runtime, "regular", return_value=helper), patch.object(suite.guard, "manifest", return_value=({}, BINDING["manifest_sha256"])), patch.object(suite, "Path") as path:
                path.return_value.read_text.return_value = "changed" if changed else BINDING["host_epoch"]
                if changed:
                    with self.assertRaises(RuntimeError):
                        suite.context()
                else:
                    self.assertEqual(suite.context(), value)

    def test_changed_result_evidence_cannot_be_persisted(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(suite, "DIRECTORY", Path(directory)), patch.object(suite.lab, "db") as db:
            execution = Path(directory) / "execution"
            execution.mkdir()
            (execution / "sandbox.log").write_bytes(baseline.sandbox_log())
            with self.assertRaises(RuntimeError):
                suite.seal_result(BINDING, OWNER, ROW, dict(baseline.evidence()[0], wall_seconds="0; DROP TABLE submissions"), "e" * 64)
        db.assert_not_called()

    def test_temporary_api_reuses_restrictions_and_mounts_only_read_only_additions(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(suite.lab, "sync_directory"), patch.object(suite.lab.os, "fchown", create=True), patch.object(suite.lab, "run", return_value=b"d" * 64) as run:
            journal = Mock(directory=Path(directory))
            suite.lab.create_creator(journal, b"private config", server="http-server.sh", mounts=((Path("public.rb"), "/api/config/initializers/lab.rb"),))
        argv = run.call_args.args
        self.assertIn("--read-only", argv)
        self.assertIn("ALL", argv)
        self.assertIn("no-new-privileges=true", argv)
        self.assertIn("apparmor=docker-default", argv)
        self.assertNotIn("--publish", argv)
        self.assertTrue(all("readonly" in argv[index + 1] for index, value in enumerate(argv) if value == "--mount"))

    def test_http_schema_preserves_old_tables_and_forbids_outbox_and_binding_reset(self):
        sql = (suite.HERE / "http-admission.sql").read_text()
        self.assertIn("LIKE ingenium_recovery_v1.attempts INCLUDING ALL", sql)
        self.assertIn("REFERENCES public.submissions(id)", sql)
        self.assertIn("NEW.submission_id, NEW.envelope", sql)
        self.assertIn("Outbox send cannot be reset", sql)
        self.assertIn("AND OLD.dispatched_at IS NOT NULL", sql)
        self.assertNotIn("DROP ", sql)
        self.assertNotIn("TRUNCATE ", sql)


if __name__ == "__main__":
    unittest.main()
