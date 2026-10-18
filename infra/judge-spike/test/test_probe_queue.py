import contextlib
import copy
import importlib.util
import io
import json
from pathlib import Path
import subprocess
import unittest
from unittest.mock import patch


spec = importlib.util.spec_from_file_location("probe_queue", Path(__file__).resolve().parent.parent / "probe-queue.py")
probe = importlib.util.module_from_spec(spec)
spec.loader.exec_module(probe)
DB_STATUS = {"read_only": True, "cpp_profile_matches": True, "submissions_empty": True}
QUEUE_STATUS = {"queue_only": True, "pending": 0, "workers": 0, "failed": 0}
RESPONSES = [
    f"{probe.API}\n{probe.DB}\n{probe.REDIS}".encode(),
    b"maintenance-on|queue=1.13.1",
    json.dumps(DB_STATUS).encode(),
    json.dumps(QUEUE_STATUS).encode(),
]


class QueueProbeTests(unittest.TestCase):
    def test_happy_path_is_four_read_only_checks(self):
        with patch.object(probe, "run", side_effect=RESPONSES) as run, contextlib.redirect_stdout(io.StringIO()) as output:
            probe.check_queue()
        self.assertEqual(output.getvalue().count("PASS:"), 4)
        calls = run.call_args_list
        self.assertEqual(len(calls), 4)
        self.assertEqual(calls[0].args[:2], ("docker", "ps"))
        self.assertIn(probe.API, calls[1].args)
        self.assertIn("1000:999", calls[1].args)
        self.assertIn(probe.DB, calls[2].args)
        self.assertIn("default_transaction_read_only=on", " ".join(calls[2].args))
        self.assertEqual(calls[2].kwargs, {"data": probe.SQL.encode("ascii")})
        self.assertTrue(probe.SQL.startswith("SELECT "))
        self.assertIn("transaction_read_only", probe.SQL)
        self.assertIn("NOT EXISTS (SELECT 1 FROM submissions)", probe.SQL)
        self.assertIn(probe.REDIS, calls[3].args)
        self.assertIn('EVAL_RO "$1" 0', calls[3].args[-3])
        self.assertIn("DBSIZE", probe.QUEUE_CHECK)
        self.assertIn("count > 1", probe.QUEUE_CHECK)
        self.assertLess(probe.QUEUE_CHECK.index("DBSIZE"), probe.QUEUE_CHECK.index("KEYS"))
        self.assertLess(probe.QUEUE_CHECK.index("count > 1"), probe.QUEUE_CHECK.index("SMEMBERS"))
        for call in calls:
            self.assertNotIn("sudo", call.args)
            self.assertNotIn("run", call.args)
            self.assertNotIn("start", call.args)
            self.assertNotIn("rm", call.args)
        for forbidden in ("LPOP", "RPOP", "DEL", "FLUSH", "RPUSH", "LPUSH", "SET"):
            self.assertNotIn(f"'{forbidden}'", probe.QUEUE_CHECK)

    def test_missing_extra_duplicate_or_stopped_lab_services_stop_before_exec(self):
        for names in (b"", RESPONSES[0] + b"\nworker", RESPONSES[0] + f"\n{probe.API}".encode(),
                      f"{probe.API}\n{probe.DB}".encode()):
            with self.subTest(names=names), patch.object(probe, "run", return_value=names) as run:
                with self.assertRaises(RuntimeError):
                    probe.check_queue()
                self.assertEqual(run.call_count, 1)

    def test_changed_configuration_stops_before_database_or_redis_reads(self):
        with patch.object(probe, "run", side_effect=[RESPONSES[0], b"wrong version"]) as run, contextlib.redirect_stdout(io.StringIO()):
            with self.assertRaises(RuntimeError):
                probe.check_queue()
        self.assertEqual(run.call_count, 2)
        self.assertIn("MAINTENANCE_MODE=true", probe.API_CHECK)
        self.assertIn("ENABLE_WAIT_RESULT=false", probe.API_CHECK)
        self.assertIn("ENABLE_BATCHED_SUBMISSIONS=false", probe.API_CHECK)
        self.assertNotIn("source ", probe.API_CHECK)

    def test_database_mismatch_or_existing_submissions_do_not_reach_redis(self):
        for key in DB_STATUS:
            status = dict(DB_STATUS, **{key: False})
            with self.subTest(key=key), patch.object(probe, "run", side_effect=[*RESPONSES[:2], json.dumps(status).encode()]) as run, contextlib.redirect_stdout(io.StringIO()):
                with self.assertRaises(RuntimeError):
                    probe.check_queue()
                self.assertEqual(run.call_count, 3)

    def test_redis_mismatch_or_existing_work_fails_without_consuming_it(self):
        for key in QUEUE_STATUS:
            status = dict(QUEUE_STATUS, **{key: False if key == "queue_only" else 1})
            with self.subTest(key=key), patch.object(probe, "run", side_effect=[*RESPONSES[:3], json.dumps(status).encode()]), contextlib.redirect_stdout(io.StringIO()):
                with self.assertRaises(RuntimeError):
                    probe.check_queue()
        with self.assertRaises(RuntimeError):
            probe.expect_json(b'{"keyspace_ok":false}', QUEUE_STATUS, "Unexpected keys")

    def test_status_schemas_are_exact_and_boolean_integer_confusion_is_rejected(self):
        for expected in (DB_STATUS, QUEUE_STATUS):
            invalid = [None, [], {}, dict(expected, unexpected=True)]
            for key, value in expected.items():
                status = copy.deepcopy(expected)
                del status[key]
                invalid.append(status)
                invalid.append(dict(expected, **{key: str(value)}))
                invalid.append(dict(expected, **{key: int(value) if type(value) is bool else False}))
            for status in invalid:
                with self.subTest(status=status), self.assertRaises(RuntimeError):
                    probe.expect_json(json.dumps(status), expected, "Invalid snapshot")
        for raw in (b"not json", b'{"pending":0,"pending":1}', b'{"x":{"x":1,"x":2}}'):
            with self.subTest(raw=raw), self.assertRaises(ValueError):
                probe.expect_json(raw, QUEUE_STATUS, "Invalid snapshot")

    def test_wrong_host_os_user_or_arguments_never_run_commands(self):
        for system, host, uid, args in (
            ("Windows", "ingenium-judge-spike-01", 0, []),
            ("Linux", "cloudshell", 0, []), ("Linux", "ingenium-judge-spike-01", 1000, []),
            ("Linux", "ingenium-judge-spike-01", 0, ["--force"]),
        ):
            with self.subTest(system=system, host=host, uid=uid, args=args), patch.object(probe.platform, "system", return_value=system), patch.object(probe.socket, "gethostname", return_value=host), patch.object(probe.os, "geteuid", return_value=uid, create=True), patch.object(probe, "run") as run, contextlib.redirect_stderr(io.StringIO()):
                self.assertEqual(probe.main(args), 1)
                run.assert_not_called()

    def test_command_transport_is_bounded_and_never_uses_a_host_shell(self):
        result = subprocess.CompletedProcess(["docker"], 0, b"{}\n")
        with patch.object(probe.subprocess, "run", return_value=result) as run:
            self.assertEqual(probe.run("docker", "ps", data=b"fixed input"), b"{}")
        run.assert_called_once_with(("docker", "ps"), input=b"fixed input", stdout=subprocess.PIPE,
                                    stderr=subprocess.DEVNULL, check=True, timeout=20)
        result.stdout = b"x" * 8193
        with patch.object(probe.subprocess, "run", return_value=result), self.assertRaises(RuntimeError):
            probe.run("docker", "ps")

    def test_main_never_prints_private_command_diagnostics(self):
        failures = [subprocess.CalledProcessError(1, "docker", output=b"private token", stderr=b"private token"),
                    subprocess.TimeoutExpired("docker private token", 20), OSError("private token"),
                    ValueError("private token"), TypeError("private token")]
        for failure in failures:
            with self.subTest(failure=type(failure)), patch.object(probe.platform, "system", return_value="Linux"), patch.object(probe.socket, "gethostname", return_value="ingenium-judge-spike-01"), patch.object(probe.os, "geteuid", return_value=0, create=True), patch.object(probe, "check_queue", side_effect=failure), contextlib.redirect_stderr(io.StringIO()) as error:
                self.assertEqual(probe.main([]), 1)
                self.assertNotIn("private token", error.getvalue())
                self.assertIn("FAIL:", error.getvalue())

    def test_main_success_and_safe_failure_messages(self):
        with patch.object(probe.platform, "system", return_value="Linux"), patch.object(probe.socket, "gethostname", return_value="ingenium-judge-spike-01"), patch.object(probe.os, "geteuid", return_value=0, create=True), patch.object(probe, "check_queue") as check:
            self.assertEqual(probe.main([]), 0)
            check.assert_called_once_with()
        with patch.object(probe.platform, "system", return_value="Linux"), patch.object(probe.socket, "gethostname", return_value="ingenium-judge-spike-01"), patch.object(probe.os, "geteuid", return_value=0, create=True), patch.object(probe, "check_queue", side_effect=RuntimeError("Known status mismatch")), contextlib.redirect_stderr(io.StringIO()) as error:
            self.assertEqual(probe.main([]), 1)
            self.assertIn("Known status mismatch", error.getvalue())


if __name__ == "__main__":
    unittest.main()
