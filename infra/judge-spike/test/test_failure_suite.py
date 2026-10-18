import base64
import contextlib
import importlib.util
import io
import json
from pathlib import Path
import subprocess
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import MagicMock, Mock, patch


spec = importlib.util.spec_from_file_location("failure_suite", Path(__file__).resolve().parent.parent / "failure-suite.py")
suite = importlib.util.module_from_spec(spec)
spec.loader.exec_module(suite)
lab = suite.lab
TOKEN = "a1234567-1234-4123-8123-123456789abc"
JOB = "b1234567-1234-4123-8123-123456789abc"
AUTH = "a" * 64
CONFIG = b"MAINTENANCE_MODE=false\nAUTHN_TOKEN=" + AUTH.encode() + b"\n"


def encoded(raw):
    return base64.b64encode(raw).decode("ascii")


def phase(controls=None, *, rc=0, stdout=b"", stderr=b"", cpu=3_000_000, hits=0):
    meta = {"time": "0.003", "time-wall": "0.010", "max-rss": "4096",
            "csw-voluntary": "2", "csw-forced": "1", "cg-mem": "4096"}
    meta.update({"exitcode": "0"} if controls is None else controls)
    return {"rc": rc, "meta_b64": encoded("".join(f"{key}:{value}\n" for key, value in meta.items()).encode()),
            "stdout_b64": encoded(stdout), "stderr_b64": encoded(stderr), "cpu_ns": cpu,
            "peak_bytes": 4194304, "ram_hits": 0, "combined_hits": hits}


def evidence(name):
    compiled = phase()
    if name == "compile-error":
        compiled = phase({"exitcode": "1", "status": "RE", "message": "Exited with error status 1"},
                         rc=1, stderr=b"main.cpp:1: error: INGENIUM_EXPECTED_COMPILE_ERROR\n")
        executed = None
    elif name in ("wrong-output", "output-boundary"):
        executed = phase(stdout=b"2\n" if name == "wrong-output" else b"X" * 8192)
    elif name == "cpu-limit":
        executed = phase({"status": "TO", "message": "Time limit exceeded", "killed": "1"}, rc=1, cpu=250_000_000)
    elif name == "nonzero-exit":
        executed = phase({"exitcode": "7", "status": "RE", "message": "Exited with error status 7"}, rc=1)
    else:
        signal = {"signal-crash": 11, "memory-limit": 9, "output-limit": 25}[name]
        controls = {"status": "SG", "message": f"Caught fatal signal {signal}", "exitsig": str(signal)}
        if name == "memory-limit":
            controls["cg-oom-killed"] = "1"
        executed = phase(controls, rc=1, stdout=b"X" * 8192 if name == "output-limit" else b"",
                         hits=38 if name == "memory-limit" else 0)
    return {"fixture": name, "source_sha256": suite.FIXTURES[name], "compile": compiled, "run": executed}


def api_result(token, result):
    return {"token": token, "status": {"id": result["status"], "description": suite.STATUS_NAMES[result["status"]]},
            "stdout": None if result["stdout"] is None else encoded(result["stdout"]) + "\n",
            "compile_output": None if result["compile_output"] is None else encoded(result["compile_output"]) + "\n",
            "stderr": None, "message": None,
            **{key: result[key] for key in ("exit_code", "exit_signal", "time", "wall_time", "memory")}}


def envelope(submission_id):
    return json.dumps({"class": "ActiveJob::QueueAdapters::ResqueAdapter::JobWrapper", "args": [{
        "job_class": "IsolateJob", "job_id": JOB, "provider_job_id": None, "queue_name": "1.13.1",
        "priority": None, "arguments": [submission_id], "executions": 0, "locale": "en"}]}).encode()


class FailureSuiteTests(unittest.TestCase):
    def test_eight_reviewed_fixtures_have_exact_hashes_and_matching_payload_limits(self):
        payloads = suite.fixture_payloads()
        self.assertEqual(list(payloads), list(suite.FIXTURES))
        self.assertEqual(len(payloads), 8)
        for name, payload in payloads.items():
            self.assertEqual(base64.b64decode(payload["source_code"]), (suite.HERE / "fixtures" / (name + ".cpp")).read_bytes())
            self.assertNotIn("expected_output", payload)
            self.assertFalse(payload["enable_network"])
            self.assertEqual(payload["memory_limit"], 16384 if name == "memory-limit" else 32768)
            self.assertEqual(payload["cpu_time_limit"], 0.2 if name == "cpu-limit" else 1)
            self.assertEqual(payload["max_file_size"], 8)
        with patch.object(suite.hashlib, "sha256", return_value=Mock(hexdigest=lambda: "0" * 64)), self.assertRaises(RuntimeError):
            suite.fixture_payloads()

    def test_all_eight_classifications_and_private_wrong_answer_check(self):
        expected = [("WRONG_OUTPUT", 3), ("COMPILATION_ERROR", 6), ("SIGNAL_CRASH", 7),
                    ("NONZERO_EXIT", 11), ("CPU_TIME_LIMIT", 5), ("MEMORY_LIMIT", 12),
                    ("OUTPUT_LIMIT", 8), ("EXACT_OUTPUT_BOUNDARY", 3)]
        for name, (outcome, status) in zip(suite.FIXTURES, expected):
            with self.subTest(name=name):
                result = suite.classify(name, evidence(name))
                self.assertEqual((result["outcome"], result["status"]), (outcome, status))
                suite.verify_api(json.dumps(api_result(TOKEN, result)), TOKEN, result)
        wrong = suite.classify("wrong-output", evidence("wrong-output"))
        self.assertEqual(wrong["stdout"], b"2\n")
        self.assertNotEqual(wrong["stdout"], b"12\n")
        compiled = suite.classify("compile-error", evidence("compile-error"))
        self.assertTrue(all(compiled[key] is None for key in ("time", "wall_time", "memory", "stdout", "exit_code", "exit_signal")))

    def test_output_at_cap_is_complete_but_signal_killed_output_is_withheld(self):
        boundary = suite.classify("output-boundary", evidence("output-boundary"))
        overflow = suite.classify("output-limit", evidence("output-limit"))
        self.assertEqual(boundary["stdout"], b"X" * 8192)
        self.assertTrue(boundary["stdout_complete"])
        self.assertIsNone(overflow["stdout"])
        self.assertFalse(overflow["stdout_complete"])
        self.assertIn("stdout = NULL", suite.result_sql(overflow, "fixed_guard"))

    def test_metadata_rejects_duplicate_missing_unknown_non_numeric_and_infrastructure_fields(self):
        valid = base64.b64decode(phase()["meta_b64"])
        invalid = [valid + b"exitcode:0\n", valid.replace(b"cg-mem:4096\n", b""), valid + b"unknown:1\n",
                   valid + b"status:XX\n", valid.replace(b"time:0.003", b"time:NaN"),
                   valid.replace(b"max-rss:4096", b"max-rss:-1"), valid + b"malformed\n"]
        for raw in invalid:
            with self.subTest(raw=raw), self.assertRaises(RuntimeError):
                suite.metadata(raw)

    def test_phase_rejects_bad_schemas_counters_and_noncanonical_or_oversized_base64(self):
        for key, value in (("rc", 2), ("rc", False), ("cpu_ns", 0), ("cpu_ns", 2_000_000_001),
                           ("peak_bytes", 0), ("peak_bytes", 33554433), ("ram_hits", -1),
                           ("combined_hits", True), ("stdout_b64", "Zh=="), ("stderr_b64", "!"),
                           ("stdout_b64", encoded(b"X" * 8193))):
            item = phase()
            item[key] = value
            with self.subTest(key=key, value=str(value)[:30]), self.assertRaises((RuntimeError, ValueError)):
                suite.phase(item)
        with self.assertRaises(RuntimeError):
            suite.phase(dict(phase(), extra=1))

    def test_ambiguous_or_wrong_failure_causes_never_become_verdicts(self):
        changes = [("cpu-limit", "message:Time limit exceeded", "message:Time limit exceeded (wall clock)"),
                   ("cpu-limit", "killed:1", "killed:0"), ("memory-limit", "cg-oom-killed:1", "cg-oom-killed:0"),
                   ("signal-crash", "exitsig:11", "exitsig:9"), ("output-limit", "exitsig:25", "exitsig:9"),
                   ("wrong-output", "exitcode:0", "exitcode:7")]
        for name, old, new in changes:
            item = evidence(name)
            item["run"]["meta_b64"] = encoded(base64.b64decode(item["run"]["meta_b64"]).replace(old.encode(), new.encode()))
            with self.subTest(name=name), self.assertRaises(RuntimeError):
                suite.classify(name, item)
        for name, mutate in (("memory-limit", lambda item: item["run"].update(combined_hits=0)),
                             ("cpu-limit", lambda item: item["run"].update(cpu_ns=199_999_999)),
                             ("compile-error", lambda item: item.update(run=phase())),
                             ("wrong-output", lambda item: item["compile"].update(combined_hits=1)),
                             ("signal-crash", lambda item: item["run"].update(stderr_b64=encoded(b"unexpected"))),
                             ("wrong-output", lambda item: item.update(source_sha256="0" * 64))):
            item = evidence(name)
            mutate(item)
            with self.subTest(name=name), self.assertRaises(RuntimeError):
                suite.classify(name, item)

    def test_api_rejects_changed_output_status_identity_metrics_and_fabricated_runtime(self):
        for name in suite.FIXTURES:
            result = suite.classify(name, evidence(name))
            invalid = [("token", JOB), ("status", {"id": 2, "description": "Processing"}),
                       ("stdout", "MTIK"), ("time", "NaN"), ("memory", True), ("wall_time", "5.001")]
            if name == "compile-error":
                invalid.append(("compile_output", None))
            for key, value in invalid:
                reply = api_result(TOKEN, result)
                reply[key] = value
                with self.subTest(name=name, key=key), self.assertRaises((RuntimeError, ArithmeticError)):
                    suite.verify_api(json.dumps(reply), TOKEN, result)

    def test_extended_payload_guard_keeps_baseline_defaults_and_binds_each_new_fixture(self):
        payloads = suite.fixture_payloads()
        for name, payload in payloads.items():
            guard = lab.payload_guard(TOKEN, payload=payload, total=9)
            self.assertIn("(SELECT count(*) FROM submissions) = 9", guard)
            self.assertIn(payload["source_code"], guard)
            self.assertIn("finished_at IS NULL", guard)
        self.assertIn("finished_at IS NOT NULL", lab.payload_guard(TOKEN, finished=True))
        self.assertIn("(SELECT count(*) FROM submissions) = 1", lab.payload_guard(TOKEN))
        for total in (True, 0, -1):
            with self.assertRaises(RuntimeError):
                lab.payload_guard(TOKEN, total=total)

    def test_creation_is_once_per_fixture_and_stops_private_creator_on_partial_reply_loss(self):
        payloads = suite.fixture_payloads()
        journals = {name: Mock() for name in suite.FIXTURES}
        tokens = [f"a1234567-1234-4123-8123-{index:012d}" for index in range(8)]
        replies = [(201, json.dumps({"token": token}).encode()) for token in tokens]
        for lost_reply in (False, True):
            with self.subTest(lost_reply=lost_reply), patch.object(lab, "create_creator", return_value=("container", "nonce")), patch.object(lab, "run"), patch.object(lab, "private_ip", return_value="172.20.0.8"), patch.object(lab, "wait_creator"), patch.object(lab, "stop_creator") as stop, patch.object(lab.api, "request", side_effect=replies[:2] + [TimeoutError()] if lost_reply else replies) as request:
                journal = Mock()
                if lost_reply:
                    with self.assertRaises(TimeoutError):
                        suite.create_cases(journal, journals, CONFIG, AUTH, payloads)
                else:
                    self.assertEqual(list(suite.create_cases(journal, journals, CONFIG, AUTH, payloads).values()), tokens)
                stop.assert_called_once_with("container", "nonce", journal)
                self.assertEqual(request.call_count, 3 if lost_reply else 8)
                for call, payload in zip(request.call_args_list, payloads.values()):
                    self.assertEqual(call.args[1], "POST")
                    self.assertEqual(json.loads(call.args[4]), payload)

    def test_case_execution_requires_source_identity_unique_evidence_and_completed_cleanup(self):
        name = "wrong-output"
        record = "INGENIUM_FAILURE_RESULT " + json.dumps(evidence(name)) + "\n"
        complete = "PASS: host test groups and temporary files removed\n"
        for text, code, accepted in ((record + complete, 0, True), (record, 0, False),
                                     (record * 2 + complete, 0, False), (record + complete, 1, False),
                                     (record + complete + "FAIL: cleanup\n", 0, False)):
            with tempfile.TemporaryDirectory() as directory:
                journal = Mock(directory=Path(directory))
                def fake_run(args, **kwargs):
                    self.assertEqual(args[-3:], ["--failure", name, suite.FIXTURES[name]])
                    kwargs["stdout"].write(text.encode())
                    return subprocess.CompletedProcess(args, code)
                with patch.object(suite.subprocess, "run", side_effect=fake_run), self.subTest(code=code, accepted=accepted):
                    if accepted:
                        self.assertEqual(suite.execute_case(journal, name)["outcome"], "WRONG_OUTPUT")
                    else:
                        with self.assertRaises(RuntimeError):
                            suite.execute_case(journal, name)

    def test_full_batch_claims_saves_reads_each_job_once_and_preserves_baseline(self):
        payloads = suite.fixture_payloads()
        created = {name: f"a1234567-1234-4123-8123-{index:012d}" for index, name in enumerate(suite.FIXTURES)}
        results = [suite.classify(name, evidence(name)) for name in suite.FIXTURES]
        db_replies = [reply for index in range(8) for reply in ({"id": index + 2}, {"updated": True}, {"updated": True})]
        redis_replies = [reply for index in range(8) for reply in (envelope(index + 2), b"claimed")] + [b"empty"]
        api_replies = [(200, json.dumps(api_result(token, result)).encode()) for token, result in zip(created.values(), results)]
        with patch.object(lab, "private_ip", return_value="172.20.0.4"), patch.object(lab.api, "check_api") as maintenance, patch.object(lab, "Journal", side_effect=lambda path: Mock(directory=path)), patch.object(suite, "create_cases", return_value=created), patch.object(lab, "db", side_effect=db_replies) as db, patch.object(lab, "redis", side_effect=redis_replies) as redis, patch.object(suite, "execute_case", side_effect=results) as execute, patch.object(lab.api, "request", side_effect=api_replies) as request, patch.object(suite, "baseline_snapshot", return_value="old-hash") as baseline, contextlib.redirect_stdout(io.StringIO()):
            journal = Mock(directory=Path("unused"))
            suite.run_suite(journal, CONFIG, AUTH, payloads, TOKEN, "old-hash")
        self.assertEqual(execute.call_count, 8)
        self.assertEqual(db.call_count, 24)
        self.assertEqual(request.call_count, 8)
        self.assertEqual(maintenance.call_count, 2)
        baseline.assert_called_once_with(TOKEN, 9)
        for index in range(8):
            self.assertEqual(redis.call_args_list[index * 2].args, (lab.PEEK, 8 - index))
            self.assertEqual(redis.call_args_list[index * 2 + 1].args, (lab.CLAIM, 8 - index, envelope(index + 2)))
            for call in db.call_args_list[index * 3 + 1:index * 3 + 3]:
                self.assertIn(f"AND id = {index + 2}", call.args[0])
                self.assertIn("(SELECT count(*) FROM submissions) = 9", call.args[0])
        self.assertEqual(journal.record.call_args.args, ("COMPLETE",))

    def test_uncertain_claim_or_result_save_stops_batch_without_retry(self):
        payloads = suite.fixture_payloads()
        created = dict.fromkeys(suite.FIXTURES, TOKEN)
        result = suite.classify("wrong-output", evidence("wrong-output"))
        for claimed, saved in ((b"wrong", True), (b"claimed", False)):
            with self.subTest(claimed=claimed), patch.object(lab, "private_ip", return_value="172.20.0.4"), patch.object(lab.api, "check_api"), patch.object(lab, "Journal", return_value=Mock()), patch.object(suite, "create_cases", return_value=created), patch.object(lab, "db", side_effect=[{"id": 2}, {"updated": True}, {"updated": saved}]), patch.object(lab, "redis", side_effect=[envelope(2), claimed]) as redis, patch.object(suite, "execute_case", return_value=result) as execute, contextlib.redirect_stdout(io.StringIO()):
                with self.assertRaises(RuntimeError):
                    suite.run_suite(Mock(directory=Path("unused")), CONFIG, AUTH, payloads, TOKEN, "old-hash")
                self.assertEqual(execute.call_count, int(claimed == b"claimed"))
                self.assertEqual(redis.call_count, 2)

    def test_baseline_is_read_only_and_fingerprinted_without_touching_its_record(self):
        row = {"id": 1, "token": TOKEN, "source_code": "preserved", "status_id": 3}
        with patch.object(lab, "db", return_value=row) as db:
            first = suite.baseline_snapshot(TOKEN, 1)
            self.assertEqual(first, suite.baseline_snapshot(TOKEN, 9))
        self.assertNotIn("write", db.call_args.kwargs)
        self.assertIn("finished_at IS NOT NULL", db.call_args.args[0])
        self.assertIn("decode(stdout, 'base64')", db.call_args.args[0])
        self.assertNotEqual(first, suite.canonical_hash(dict(row, status_id=2)))

    def test_completed_baseline_journal_must_bind_exact_old_source_and_one_token(self):
        rows = [{"event": "PREPARED", "source_sha256": lab.SOURCE_HASH},
                {"event": "CREATED", "token": TOKEN}, {"event": "COMPLETE"}]
        for scenario in ("valid", "incomplete", "wrong_source", "duplicate_creation"):
            items = json.loads(json.dumps(rows))
            if scenario == "incomplete":
                items.pop()
            elif scenario == "wrong_source":
                items[0]["source_sha256"] = "0" * 64
            elif scenario == "duplicate_creation":
                items.insert(2, items[1])
            raw = "\n".join(json.dumps(item) for item in items).encode()
            with self.subTest(scenario=scenario), patch.object(Path, "lstat", return_value=SimpleNamespace(st_mode=0o40700, st_uid=0)), patch.object(suite, "private_file", return_value=raw):
                if scenario == "valid":
                    self.assertEqual(suite.baseline_token(), TOKEN)
                else:
                    with self.assertRaises(RuntimeError):
                        suite.baseline_token()

    def test_existing_suite_record_blocks_new_creation_even_after_vm_restart(self):
        runtime = MagicMock()
        runtime.lstat.return_value = SimpleNamespace(st_mode=0o40700, st_uid=0)
        runtime.__truediv__.return_value.exists.return_value = True
        with patch.object(suite.platform, "system", return_value="Linux"), patch.object(suite.socket, "gethostname", return_value="ingenium-judge-spike-01"), patch.object(suite.os, "geteuid", return_value=0, create=True), patch.object(suite.os, "umask"), patch.object(suite.signal, "signal"), patch.object(lab, "RUNTIME", runtime), patch.object(suite, "private_file") as private, patch.object(lab, "run") as run, contextlib.redirect_stderr(io.StringIO()):
            self.assertEqual(suite.main([]), 1)
            private.assert_not_called()
            run.assert_not_called()

    def test_wrong_host_user_or_arguments_never_reach_private_files_or_docker(self):
        for system, host, uid, args in (("Windows", "ingenium-judge-spike-01", 0, []),
                                        ("Linux", "cloudshell", 0, []),
                                        ("Linux", "ingenium-judge-spike-01", 1000, []),
                                        ("Linux", "ingenium-judge-spike-01", 0, ["--force"])):
            with self.subTest(host=host, uid=uid), patch.object(suite.platform, "system", return_value=system), patch.object(suite.socket, "gethostname", return_value=host), patch.object(suite.os, "geteuid", return_value=uid, create=True), patch.object(lab, "run") as run, patch.object(suite, "private_file") as private, contextlib.redirect_stderr(io.StringIO()):
                self.assertEqual(suite.main(args), 1)
                run.assert_not_called()
                private.assert_not_called()


if __name__ == "__main__":
    unittest.main()
