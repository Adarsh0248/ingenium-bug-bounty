import base64
import contextlib
import importlib.util
import io
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import Mock, patch


spec = importlib.util.spec_from_file_location("one_job", Path(__file__).resolve().parent.parent / "one-job.py")
lab = importlib.util.module_from_spec(spec)
spec.loader.exec_module(lab)
TOKEN = "a1234567-1234-4123-8123-123456789abc"
JOB = "b1234567-1234-4123-8123-123456789abc"
AUTH = "a" * 64
CONFIG = b"MAINTENANCE_MODE=true\nAUTHN_TOKEN=" + AUTH.encode() + b"\n"
CONTAINER = "c" * 64
NONCE = "d" * 32


def envelope():
    return {"class": "ActiveJob::QueueAdapters::ResqueAdapter::JobWrapper", "args": [{
        "job_class": "IsolateJob", "job_id": JOB, "provider_job_id": None, "queue_name": "1.13.1",
        "priority": None, "arguments": [1], "executions": 0, "locale": "en",
    }]}


def evidence():
    return [{"source_sha256": lab.SOURCE_HASH, "stdin_b64": base64.b64encode(stdin).decode(),
             "stdout_b64": base64.b64encode(stdout).decode(), "cpu_ns": 3000000,
             "peak_bytes": 30000000, "wall_seconds": "0.010"} for stdin, stdout in lab.CASES]


def sandbox_log(results=None):
    records = evidence() if results is None else results
    return ("\n".join("INGENIUM_LAB_RESULT " + json.dumps(row) for row in records)
            + "\nPASS: host test groups and temporary files removed\n").encode()


def api_result():
    return {"token": TOKEN, "stdout": "MTIK\n", "stderr": None, "compile_output": None,
            "message": None, "status": {"id": 3, "description": "Accepted"},
            "exit_code": 0, "exit_signal": None, "time": "0.003", "wall_time": "0.010",
            "memory": (30000000 + 1023) // 1024}


class OneJobTests(unittest.TestCase):
    def test_fixed_payload_matches_the_actual_helper_source_and_run_limits(self):
        source = (lab.HERE / "cgroup-smoke.sh").read_bytes()
        self.assertEqual(source.count(b'<<"CPP"\n' + lab.CPP + b'CPP\n'), 1)
        self.assertEqual(base64.b64decode(lab.PAYLOAD["source_code"]), lab.CPP)
        self.assertEqual(base64.b64decode(lab.PAYLOAD["stdin"]), b"7 5\n")
        self.assertNotIn("expected_output", lab.PAYLOAD)
        self.assertNotIn("callback_url", lab.PAYLOAD)
        self.assertFalse(lab.PAYLOAD["enable_network"])
        self.assertEqual(lab.PAYLOAD["memory_limit"], 32768)
        self.assertEqual(lab.PAYLOAD["max_file_size"], 8)

    def test_creator_config_changes_only_the_exact_maintenance_line(self):
        raw = b"# MAINTENANCE_MODE=true is documented here\n" + CONFIG
        changed, auth = lab.prepare_config(raw)
        self.assertEqual(changed, b"# MAINTENANCE_MODE=true is documented here\n" + CONFIG.replace(b"MAINTENANCE_MODE=true", b"MAINTENANCE_MODE=false"))
        self.assertEqual(auth, AUTH)
        self.assertIn(b"MAINTENANCE_MODE=true\n", raw)
        for invalid in (b"", CONFIG + b"MAINTENANCE_MODE=true\n", CONFIG + b"MAINTENANCE_MODE=false\n",
                        CONFIG + b"AUTHN_TOKEN=" + AUTH.encode() + b"\n", CONFIG.replace(b"a" * 64, b"wrong")):
            with self.subTest(raw=invalid), self.assertRaises(RuntimeError):
                lab.prepare_config(invalid)

    def test_queue_envelope_requires_the_exact_adapter_job_and_submission(self):
        self.assertEqual(lab.validate_message(json.dumps(envelope()), 1), JOB)
        invalid = [{}, [], {"class": "IsolateJob", "args": [1]}, dict(envelope(), extra=True)]
        for field, value in {"job_class": "OtherJob", "queue_name": "other", "executions": 1,
                             "priority": 5, "arguments": [2], "locale": "other", "provider_job_id": JOB,
                             "job_id": "not-a-uuid"}.items():
            item = envelope()
            item["args"][0][field] = value
            invalid.append(item)
        for field, value in (("executions", False), ("arguments", [True]), ("arguments", [1, 2]), ("arguments", [])):
            item = envelope()
            item["args"][0][field] = value
            invalid.append(item)
        item = envelope()
        item["args"][0]["unknown"] = True
        invalid.append(item)
        for item in invalid:
            with self.subTest(item=item), self.assertRaises((RuntimeError, ValueError)):
                lab.validate_message(json.dumps(item), 1)

    def test_sql_guard_binds_exact_source_input_limits_and_one_record(self):
        guard = lab.payload_guard(TOKEN)
        for required in (TOKEN, "decode(source_code, 'base64')", "decode(stdin, 'base64')",
                         "finished_at IS NULL", "expected_output IS NULL", "callback_url IS NULL",
                         "max_file_size = 8", "memory_limit = 32768", "enable_network = false",
                         "(SELECT count(*) FROM submissions) = 1"):
            self.assertIn(required, guard)
        for token in ("' OR true --", "not-a-token", None, TOKEN.upper()):
            with self.subTest(token=token), self.assertRaises((RuntimeError, ValueError)):
                lab.payload_guard(token)

    def test_real_stdout_evidence_requires_all_three_cases_and_completed_cleanup(self):
        self.assertEqual(lab.parse_sandbox_log(sandbox_log()), evidence()[0])
        invalid = [sandbox_log([]), sandbox_log(evidence()[:1]), sandbox_log(evidence() + evidence()),
                   sandbox_log().replace(b"PASS: host test groups and temporary files removed", b"missing"),
                   sandbox_log() + b"FAIL: cleanup failed\n"]
        for field, value in (("source_sha256", "f" * 64), ("stdin_b64", ""), ("stdout_b64", "MTM="),
                             ("cpu_ns", 0), ("cpu_ns", True), ("cpu_ns", 1000000001),
                             ("peak_bytes", 33554433), ("peak_bytes", -1), ("peak_bytes", True),
                             ("wall_seconds", "NaN"), ("wall_seconds", "3.001"),
                             ("wall_seconds", 0.1), ("wall_seconds", "-0.1")):
            rows = evidence()
            rows[0][field] = value
            invalid.append(sandbox_log(rows))
        rows = evidence()
        rows[1]["extra"] = 0
        invalid.append(sandbox_log(rows))
        for raw in invalid:
            with self.subTest(raw=raw), self.assertRaises((RuntimeError, ValueError)):
                lab.parse_sandbox_log(raw)

    def test_api_result_matches_stdout_and_the_same_execution_metrics(self):
        lab.verify_result(json.dumps(api_result()), TOKEN, evidence()[0])
        for key, value in (("token", JOB), ("stdout", "MTMK"), ("memory", 0), ("time", "0.004"),
                           ("wall_time", "0.011"), ("exit_code", False), ("stderr", "hidden"),
                           ("status", {"id": 2, "description": "Processing"}), ("stdout", None)):
            item = api_result()
            item[key] = value
            with self.subTest(key=key, value=value), self.assertRaises(RuntimeError):
                lab.verify_result(json.dumps(item), TOKEN, evidence()[0])

    def test_database_and_redis_use_only_existing_clients_and_private_credentials(self):
        with patch.object(lab, "run", return_value=b'{"ok":true}') as run:
            self.assertEqual(lab.db("SELECT true;"), {"ok": True})
            self.assertIn("default_transaction_read_only=on", " ".join(run.call_args.args))
            self.assertEqual(run.call_args.kwargs["data"], b"SELECT true;")
            lab.db("SELECT true;", write=True)
            self.assertIn("default_transaction_read_only=off", " ".join(run.call_args.args))
        with patch.object(lab, "run", return_value=b"claimed") as run:
            lab.redis(lab.CLAIM, 1, b"fixed-envelope")
            self.assertIn("EVAL", run.call_args.args)
            self.assertNotIn("EVAL_RO", run.call_args.args)
            self.assertEqual(run.call_args.args[-1], "fixed-envelope")
            lab.redis(lab.PEEK, 1)
            self.assertIn("EVAL_RO", run.call_args.args)
        self.assertLess(lab.CLAIM.index("head ~= ARGV[2]"), lab.CLAIM.index("'LPOP'"))
        for forbidden in ("'DEL'", "'FLUSHDB'", "'LPUSH'", "'RPUSH'"):
            self.assertNotIn(forbidden, lab.CLAIM)

    def test_create_reply_loss_still_stops_creator_and_never_reposts(self):
        for reply in ((201, json.dumps({"token": TOKEN}).encode()),
                      (500, b'{"error":"private diagnostic"}'), TimeoutError("private diagnostic")):
            journal = Mock()
            with self.subTest(reply=reply), patch.object(lab, "create_creator", return_value=(CONTAINER, NONCE)), patch.object(lab, "run"), patch.object(lab, "private_ip", return_value="172.20.0.8"), patch.object(lab, "wait_creator"), patch.object(lab, "stop_creator") as stop, patch.object(lab.api, "request") as request:
                if isinstance(reply, Exception):
                    request.side_effect = reply
                else:
                    request.return_value = reply
                if isinstance(reply, tuple) and reply[0] == 201:
                    self.assertEqual(lab.create_submission(journal, CONFIG, AUTH), TOKEN)
                else:
                    with self.assertRaises((RuntimeError, TimeoutError)):
                        lab.create_submission(journal, CONFIG, AUTH)
                stop.assert_called_once_with(CONTAINER, NONCE, journal)
                request.assert_called_once()
                self.assertEqual(request.call_args.args[1], "POST")
                self.assertEqual(json.loads(request.call_args.args[4]), lab.PAYLOAD)
                self.assertEqual(journal.record.call_args_list[0].args, ("CREATE_STARTED",))

    def test_creator_is_nonprivileged_private_and_uses_the_original_entrypoint(self):
        with tempfile.TemporaryDirectory() as directory:
            journal = Mock(directory=Path(directory))
            with patch.object(lab, "sync_directory"), patch.object(lab.os, "fchown", create=True), patch.object(lab, "run", return_value=CONTAINER.encode()) as run:
                container, nonce = lab.create_creator(journal, CONFIG)
            args = run.call_args.args
            self.assertEqual(container, CONTAINER)
            self.assertEqual(len(nonce), 32)
            self.assertIn(lab.IMAGE, args)
            self.assertIn(lab.NETWORK, args)
            self.assertIn("1000:999", args)
            for forbidden in ("--entrypoint", "--privileged", "--publish", "-p", "--network=host", "--restart=always"):
                self.assertNotIn(forbidden, args)
            self.assertIn("--read-only", args)
            self.assertIn("ALL", args)
            self.assertIn("no-new-privileges=true", args)
            self.assertIn("apparmor=docker-default", args)
            self.assertTrue(any("/api/judge0.conf,readonly" in arg for arg in args))
            self.assertTrue(any("/api/scripts/server,readonly" in arg for arg in args))
            self.assertNotIn(AUTH, " ".join(args))
            self.assertEqual((Path(directory) / "creator.conf").read_bytes(), CONFIG)

    def test_creator_cleanup_checks_ownership_and_stopped_state_before_removal(self):
        journal = Mock()
        with patch.object(lab, "run", return_value=b"wrong identity") as run, self.assertRaises(RuntimeError):
            lab.stop_creator(CONTAINER, NONCE, journal)
        self.assertEqual(run.call_count, 1)
        with patch.object(lab, "run", side_effect=[f"{lab.IMAGE}|{NONCE}".encode(), b"", b"true"]) as run, self.assertRaises(RuntimeError):
            lab.stop_creator(CONTAINER, NONCE, journal)
        self.assertFalse(any("rm" in call.args for call in run.call_args_list))
        with tempfile.TemporaryDirectory() as directory:
            journal = Mock(directory=Path(directory))
            config = Path(directory) / "creator.conf"
            config.write_bytes(CONFIG)
            with patch.object(lab, "sync_directory"), patch.object(lab.subprocess, "run", return_value=subprocess.CompletedProcess([], 0)) as logs, patch.object(lab, "run", side_effect=[f"{lab.IMAGE}|{NONCE}".encode(), b"", b"false", CONTAINER.encode()]) as run:
                lab.stop_creator(CONTAINER, NONCE, journal)
            self.assertEqual(run.call_args.args, ("docker", "rm", CONTAINER))
            self.assertEqual(logs.call_args.args[0], ["docker", "logs", "--tail", "80", CONTAINER])
            self.assertTrue((Path(directory) / "creator.log").exists())
            self.assertFalse(config.exists())

    def test_journal_is_exclusive_and_each_stage_is_fsynced(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(lab, "sync_directory") as sync:
            path = Path(directory) / "one-job-v1"
            journal = lab.Journal(path)
            with patch.object(lab.os, "fsync", wraps=lab.os.fsync) as fsync:
                journal.record("PREPARED", source_sha256=lab.SOURCE_HASH)
                journal.record("CREATE_STARTED")
            self.assertEqual(fsync.call_count, 2)
            events = [json.loads(row) for row in (path / "journal.jsonl").read_text().splitlines()]
            self.assertEqual([item["event"] for item in events], ["PREPARED", "CREATE_STARTED"])
            with self.assertRaises(FileExistsError):
                lab.Journal(path)
            self.assertEqual(sync.call_count, 2)

    def test_fixed_executor_accepts_evidence_only_after_successful_host_cleanup(self):
        with tempfile.TemporaryDirectory() as directory:
            journal = Mock(directory=Path(directory))
            def fake_run(args, **kwargs):
                self.assertEqual(args, ["/bin/bash", str(lab.HERE / "cgroup-smoke.sh")])
                self.assertEqual(kwargs["timeout"], 90)
                kwargs["stdout"].write(sandbox_log())
                return subprocess.CompletedProcess(args, 0)
            with patch.object(lab.subprocess, "run", side_effect=fake_run):
                self.assertEqual(lab.execute_fixed_job(journal), evidence()[0])
            self.assertEqual(journal.record.call_args_list[0].args, ("RUN_STARTED",))
            self.assertEqual(journal.record.call_args_list[-1].args, ("RUN_FINISHED",))

    def test_full_pipeline_claims_executes_saves_and_reads_once(self):
        journal = Mock()
        with patch.object(lab, "private_ip", return_value="172.20.0.4"), patch.object(lab.api, "check_api") as maintenance, patch.object(lab, "create_submission", return_value=TOKEN) as create, patch.object(lab, "db", side_effect=[{"id": 1}, {"updated": True}, {"updated": True}]) as db, patch.object(lab, "redis", side_effect=[json.dumps(envelope()).encode(), b"claimed", b"empty"]) as redis, patch.object(lab, "execute_fixed_job", return_value=evidence()[0]) as execute, patch.object(lab.api, "request", return_value=(200, json.dumps(api_result()).encode())) as request, contextlib.redirect_stdout(io.StringIO()):
            lab.run_experiment(journal, CONFIG, AUTH)
        create.assert_called_once()
        execute.assert_called_once_with(journal)
        self.assertEqual(maintenance.call_count, 2)
        self.assertEqual(db.call_count, 3)
        self.assertIn("status_id = 2", db.call_args_list[1].args[0])
        self.assertIn("status_id = 3", db.call_args_list[2].args[0])
        self.assertIn("AND id = 1", db.call_args_list[1].args[0])
        self.assertIn("AND id = 1", db.call_args_list[2].args[0])
        self.assertIn("stdout = E'MTIK\\n'", db.call_args_list[2].args[0])
        self.assertEqual(redis.call_count, 3)
        request.assert_called_once()
        self.assertEqual(request.call_args.args[1], "GET")
        events = [call.args[0] for call in journal.record.call_args_list]
        self.assertEqual(events, ["CLAIM_STARTED", "CLAIMED", "RESULT_SAVE_STARTED", "RESULT_SAVED", "COMPLETE"])

    def test_failed_claim_or_processing_transition_never_executes_or_requeues(self):
        for claimed, updated in ((b"unexpected", True), (b"claimed", False)):
            with self.subTest(claimed=claimed, updated=updated), patch.object(lab, "private_ip", return_value="172.20.0.4"), patch.object(lab.api, "check_api"), patch.object(lab, "create_submission", return_value=TOKEN), patch.object(lab, "db", side_effect=[{"id": 1}, {"updated": updated}]), patch.object(lab, "redis", side_effect=[json.dumps(envelope()).encode(), claimed]) as redis, patch.object(lab, "execute_fixed_job") as execute, contextlib.redirect_stdout(io.StringIO()):
                with self.assertRaises(RuntimeError):
                    lab.run_experiment(Mock(), CONFIG, AUTH)
                execute.assert_not_called()
                self.assertEqual(redis.call_count, 2)

    def test_failed_result_save_or_lookup_never_reexecutes(self):
        for saved, status in ((False, 200), (True, 500)):
            with self.subTest(saved=saved, status=status), patch.object(lab, "private_ip", return_value="172.20.0.4"), patch.object(lab.api, "check_api"), patch.object(lab, "create_submission", return_value=TOKEN) as create, patch.object(lab, "db", side_effect=[{"id": 1}, {"updated": True}, {"updated": saved}]), patch.object(lab, "redis", side_effect=[json.dumps(envelope()).encode(), b"claimed"]), patch.object(lab, "execute_fixed_job", return_value=evidence()[0]) as execute, patch.object(lab.api, "request", return_value=(status, b"{}")), contextlib.redirect_stdout(io.StringIO()):
                with self.assertRaises(RuntimeError):
                    lab.run_experiment(Mock(), CONFIG, AUTH)
                create.assert_called_once()
                execute.assert_called_once()

    def test_wrong_machine_or_arguments_cannot_reach_docker_or_private_files(self):
        for system, hostname, uid, args in (("Windows", "ingenium-judge-spike-01", 0, []),
                                          ("Linux", "cloudshell", 0, []),
                                          ("Linux", "ingenium-judge-spike-01", 1000, []),
                                          ("Linux", "ingenium-judge-spike-01", 0, ["--force"])):
            with self.subTest(system=system, hostname=hostname, uid=uid), patch.object(lab.platform, "system", return_value=system), patch.object(lab.socket, "gethostname", return_value=hostname), patch.object(lab.os, "geteuid", return_value=uid, create=True), patch.object(lab, "run") as run, contextlib.redirect_stderr(io.StringIO()):
                self.assertEqual(lab.main(args), 1)
                run.assert_not_called()


if __name__ == "__main__":
    unittest.main()
