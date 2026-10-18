import contextlib
import copy
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import selectors
import tempfile
import threading
import types
import unittest
from unittest.mock import Mock, patch


ROOT = Path(__file__).resolve().parent.parent


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


suite = load("streams_tests_host", ROOT / "streams.py")
runtime = load("streams_tests_runtime", ROOT / "streams/runtime.py")
capture, cases = suite.capture, suite.cases


class CaptureTests(unittest.TestCase):
    def test_empty_is_proven_only_by_eof(self):
        stream = capture.Capture("stdout")
        with self.assertRaises(RuntimeError):
            stream.record()
        stream.eof = True
        self.assertEqual(capture.validate(stream.record(), "stdout"), b"")
        self.assertEqual(capture.check(stream.record(), b"", "exact"), "PASSED")
        with self.assertRaises(RuntimeError):
            stream.feed(b"late")

    def test_large_capture_retains_only_cap_plus_stdout_sentinel(self):
        for kind in capture.LIMITS:
            with self.subTest(kind=kind):
                stream = capture.Capture(kind)
                for _ in range(40):
                    stream.feed(b"x" * 65536)
                self.assertEqual(stream.observed, 2621440)
                self.assertEqual(len(stream.prefix), capture.LIMITS[kind][1])
                stream.eof = True
                record = stream.record()
                self.assertTrue(record["truncated"])
                self.assertFalse(record["complete"])
                self.assertEqual(capture.validate(record, kind), b"x" * capture.LIMITS[kind][1])

    def test_boundaries_are_inclusive_and_stdout_overflow_precedes_comparison(self):
        for size in (0, 1048575, 1048576, 1048577, 2097169):
            with self.subTest(size=size):
                record = suite.record_for("stdout", b"x" * size)
                expected = b"x" * min(size, 1048576)
                self.assertEqual(capture.check(record, expected, "exact"), "PASSED" if size <= 1048576 else "OUTPUT_LIMIT_EXCEEDED")
        record = suite.record_for("stdout", b"42" + b" " * 1048576)
        self.assertEqual(capture.check(record, b"42", "tokens"), "OUTPUT_LIMIT_EXCEEDED")

    def test_all_fixed_cases_have_independent_expected_verdicts(self):
        expected = [("PASSED", "PASSED"), ("PASSED", "PASSED"), ("PASSED", "PASSED"),
                    ("WRONG_ANSWER", "WRONG_ANSWER"), ("PASSED", "PASSED"),
                    ("OUTPUT_LIMIT_EXCEEDED", "OUTPUT_LIMIT_EXCEEDED"), ("OUTPUT_LIMIT_EXCEEDED", "OUTPUT_LIMIT_EXCEEDED"),
                    ("WRONG_ANSWER", "WRONG_ANSWER"), ("PASSED", "WRONG_ANSWER"), ("WRONG_ANSWER", "WRONG_ANSWER")]
        for index, verdicts in enumerate(expected):
            with self.subTest(case=cases.CASES[index]):
                out, err = cases.output(index)
                record = suite.record_for("stdout", out)
                self.assertEqual(tuple(capture.check(record, cases.expected(index), mode) for mode in ("tokens", "exact")), verdicts)
                diagnostic = suite.record_for("stderr", err)
                capture.validate(diagnostic, "stderr")
                self.assertLessEqual(diagnostic["retained_bytes"], 65536)

    def test_only_six_ascii_separators_and_no_numeric_or_unicode_normalization(self):
        for actual, expected, mode, verdict in (
            (b" \t\n\r\f\v42 \t\n\r\f\v", b"42", "tokens", "PASSED"),
            (b"42\n", b"42", "exact", "WRONG_ANSWER"),
            (b"1\r\n2", b"1\n2", "exact", "WRONG_ANSWER"),
            (b"1\n2", b"1 2", "tokens", "PASSED"),
            (b"1.0", b"1", "tokens", "WRONG_ANSWER"),
            (b"\xef\xbb\xbf42", b"42", "tokens", "WRONG_ANSWER"),
            (b"e\xcc\x81", b"\xc3\xa9", "exact", "WRONG_ANSWER"),
            (b"\0", b"\0", "exact", "PASSED"),
            (b"\xff", b"", "tokens", "WRONG_ANSWER"),
        ):
            with self.subTest(actual=actual, mode=mode):
                self.assertEqual(capture.check(suite.record_for("stdout", actual), expected, mode), verdict)

    def test_missing_null_and_inconsistent_evidence_never_become_empty_or_wrong_answer(self):
        empty = suite.record_for("stdout", b"")
        changes = ({"eof": False}, {"eof": 1}, {"observed_bytes": True}, {"observed_bytes": -1},
                   {"observed_bytes": 2 ** 64}, {"retained_bytes": True}, {"retained_bytes": 1},
                   {"complete": 1}, {"truncated": True}, {"sha256": "a" * 64}, {"kind": "stderr"},
                   {"data_b64": None}, {"data_b64": "\u00e9"}, {"extra": 0})
        for record in (None, {}, *[dict(empty, **change) for change in changes]):
            with self.subTest(record=record), self.assertRaises(RuntimeError):
                capture.check(record, b"", "exact")

    def test_transport_is_strict_bounded_canonical_and_byte_preserving(self):
        record = suite.record_for("stdout", b"\xff\0\r\n")
        self.assertEqual(capture.validate(json.loads(json.dumps(record)), "stdout"), b"\xff\0\r\n")
        for encoded in ("!!!!", "Zg==\n", "Zh==", "Zg===", "A" * 1398105):
            with self.subTest(encoded=encoded[:12]), self.assertRaises(RuntimeError):
                capture.validate(dict(suite.record_for("stdout", b"f"), data_b64=encoded), "stdout")

    def test_configuration_and_chunk_bounds_fail_closed(self):
        for kind in (None, [], "unknown", True):
            with self.subTest(kind=kind), self.assertRaises(RuntimeError):
                capture.Capture(kind)
        stream = capture.Capture("stdout")
        for chunk in (None, "text", bytearray(b"x"), b"x" * 65537):
            with self.subTest(chunk_type=type(chunk)), self.assertRaises(RuntimeError):
                stream.feed(chunk)
        for expected, mode in ((b"x" * 1048577, "exact"), (b"\xff", "tokens"), (None, "tokens"), (b"", "loose")):
            with self.subTest(mode=mode), self.assertRaises(RuntimeError):
                capture.check(suite.record_for("stdout", b""), expected, mode)

    def test_diagnostic_clipping_and_invalid_bytes_do_not_affect_stdout_checker(self):
        out = suite.record_for("stdout", b"42\n")
        for kind in ("stderr", "compiler"):
            for size in (0, 65536, 65537, 131089):
                record = suite.record_for(kind, b"\xff" * size)
                self.assertEqual(capture.validate(record, kind), b"\xff" * min(size, 65536))
                self.assertEqual(record["complete"], size <= 65536)
                self.assertEqual(capture.check(out, b"42", "tokens"), "PASSED")

    def test_complete_bad_utf8_is_wrong_but_corrupt_transport_is_infrastructure(self):
        record = suite.record_for("stdout", b"\xff")
        self.assertEqual(capture.check(record, b"42", "tokens"), "WRONG_ANSWER")
        with self.assertRaises(RuntimeError):
            capture.check(dict(record, data_b64="/g=="), b"42", "tokens")

    def test_wire_stays_below_two_mib_including_full_sentinel_and_diagnostics(self):
        value = {"stdout": suite.record_for("stdout", b"x" * 1048577), "stderr": suite.record_for("stderr", b"d" * 65537)}
        self.assertLessEqual(len(json.dumps(value).encode("ascii")), 2097152)


class StreamLabTests(unittest.TestCase):
    @unittest.skipUnless(os.name == "posix", "Actual FIFO descriptor test runs on the Linux VM, not Windows.")
    def test_real_fifos_drain_both_channels_with_bounded_retention(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "box").mkdir()
            payload = {"stdout": b"x" * 2097169, "stderr": b"d" * 131089}
            errors = []
            def writer():
                try:
                    for kind, data in payload.items():
                        fd = os.open(root / "box" / kind, os.O_WRONLY)
                        try:
                            offset = 0
                            while offset < len(data):
                                offset += os.write(fd, data[offset:offset + 65536])
                        finally:
                            os.close(fd)
                except Exception as error:
                    errors.append(error)
            thread = threading.Thread(target=writer, daemon=True)
            process = Mock()
            process.poll.side_effect = lambda: None if thread.is_alive() else (1 if errors else 0)
            def waited(timeout):
                thread.join(timeout)
                return None if thread.is_alive() else (1 if errors else 0)
            process.wait.side_effect = waited
            def started(*args, **kwargs):
                thread.start()
                return process
            runner = Mock(WORK=root)
            runner.identity_seen.return_value = True
            with patch.object(runtime, "Path", side_effect=lambda path: root / "isolate.log" if str(path) == "/tmp/isolate.log" else Path(path)), patch.object(runtime.subprocess, "Popen", side_effect=started):
                try:
                    records = runtime.collect(runner, ["not-executed"], tuple(payload), ["main"], 10)
                finally:
                    thread.join(2)
            self.assertFalse(thread.is_alive())
            self.assertEqual(errors, [])
            for kind, raw in payload.items():
                self.assertEqual(records[kind], suite.record_for(kind, raw))

    def test_bundle_freezes_inventory_and_refuses_extra_linked_or_changed_files(self):
        original = suite.bundle.fingerprint()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "fixtures").mkdir()
            for name in suite.bundle.FILES:
                (root / name).write_bytes((suite.bundle.HERE / name).read_bytes())
            with patch.object(suite.bundle, "HERE", root):
                self.assertEqual(suite.bundle.fingerprint(), original)
                (root / "capture.py").write_bytes(b"changed")
                self.assertNotEqual(suite.bundle.fingerprint(), original)
                (root / "secret").write_bytes(b"not allowed")
                with self.assertRaises(RuntimeError):
                    suite.bundle.fingerprint()
                (root / "secret").unlink()
                (root / "runtime.py").unlink()
                with self.assertRaises(RuntimeError):
                    suite.bundle.fingerprint()

    def test_host_rejects_missing_cleanup_wrong_counts_mixed_channels_or_verdict(self):
        profile = {"cpu": 2, "wall": 10}
        out, err = cases.output(1)
        phase = {"cpu_ns": 1000, "peak_bytes": 4096, "wall_seconds": "0.1", "identity_checked": True, "cleanup": True,
                 "captures": {"stdout": capture.summary(suite.record_for("stdout", out)), "stderr": capture.summary(suite.record_for("stderr", err))},
                 "verdicts": {"tokens": "PASSED", "exact": "PASSED"}}
        for scenario in ("ok", "cleanup", "byte_count", "channels", "verdict", "identity", "usage", "integer_complete", "integer_count"):
            value = copy.deepcopy(phase)
            if scenario == "cleanup": value["cleanup"] = False
            if scenario == "byte_count": value["captures"]["stdout"]["observed_bytes"] += 1
            if scenario == "channels": value["captures"]["stdout"] = value["captures"]["stderr"]
            if scenario == "verdict": value["verdicts"]["exact"] = "WRONG_ANSWER"
            if scenario == "identity": value["identity_checked"] = False
            if scenario == "usage": value["cpu_ns"] = 3000000000
            if scenario == "integer_complete": value["captures"]["stdout"]["complete"] = 1
            if scenario == "integer_count": value["captures"]["stderr"]["observed_bytes"] = 6.0
            with self.subTest(scenario=scenario):
                if scenario == "ok": suite.checked_phase(value, profile, compiling=False, index=1)
                else:
                    with self.assertRaises(RuntimeError):
                        suite.checked_phase(value, profile, compiling=False, index=1)

    def test_collector_retains_prelaunch_writer_then_requires_real_eof_and_success(self):
        for scenario in ("ok", "phase_failed", "identity_missing", "early_eof", "deadline", "vanished_then_seen", "seen_then_vanished", "only_vanished", "wrong_identity", "permission_error"):
            with self.subTest(scenario=scenario), tempfile.TemporaryDirectory() as directory:
                box = Path(directory) / "box"
                box.mkdir()
                runner = Mock(WORK=Path(directory))
                runner.identity_seen.return_value = scenario != "identity_missing"
                if scenario == "vanished_then_seen": runner.identity_seen.side_effect = [ProcessLookupError(), True]
                if scenario == "seen_then_vanished": runner.identity_seen.side_effect = [True, ProcessLookupError()]
                if scenario == "only_vanished": runner.identity_seen.side_effect = ProcessLookupError()
                if scenario == "wrong_identity": runner.identity_seen.side_effect = RuntimeError("Wrong sandbox identity")
                if scenario == "permission_error": runner.identity_seen.side_effect = PermissionError("Not authorised to inspect task")
                process = Mock()
                process.poll.side_effect = [None, 0, 0]
                if scenario == "early_eof": process.poll.side_effect = [None, None]
                process.wait.return_value = 1 if scenario == "phase_failed" else 0
                selector = Mock()
                selector.__enter__ = Mock(return_value=selector)
                selector.__exit__ = Mock(return_value=False)
                selector.get_map.side_effect = [True, True, False]
                key = types.SimpleNamespace(fd=10, data="stdout")
                selector.select.return_value = [(key, selectors.EVENT_READ)]
                with patch.object(runtime.selectors, "DefaultSelector", return_value=selector), patch.object(runtime.os, "mkfifo", create=True), patch.object(runtime.os, "O_NOFOLLOW", 0, create=True), patch.object(runtime.os, "O_NONBLOCK", 0, create=True), patch.object(runtime.os, "open", side_effect=[10, 11]), patch.object(runtime.os, "fstat", return_value=types.SimpleNamespace(st_mode=0o010600, st_ino=77)), patch.object(runtime.os, "close") as close, patch.object(runtime.os, "read", side_effect=[b"42\n", b""] if scenario != "early_eof" else [b""]), patch.object(runtime.subprocess, "Popen", return_value=process), patch.object(runtime.Path, "open", return_value=io.BytesIO()), patch.object(runtime.time, "monotonic", side_effect=[0, 100] if scenario == "deadline" else [0, 0, 0]):
                    if scenario in ("ok", "vanished_then_seen", "seen_then_vanished"):
                        result = runtime.collect(runner, ["not-executed"], ("stdout",), ["main"], 10)
                        self.assertEqual(runtime.capture.validate(result["stdout"], "stdout"), b"42\n")
                        self.assertEqual(close.call_args_list[0].args, (11,))
                    else:
                        with self.assertRaises(PermissionError if scenario == "permission_error" else RuntimeError):
                            runtime.collect(runner, ["not-executed"], ("stdout",), ["main"], 10)

    def test_pinned_observer_reproduces_esrch_when_task_dies_during_proc_read(self):
        observer = suite.active.runtime
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for name in ("memory", "cpu", "proc/42"):
                (root / name).mkdir(parents=True)
            (root / "memory/tasks").write_text("42\n")
            (root / "cpu/tasks").write_text("42\n")
            (root / "proc/42/comm").write_text("java\n")
            (root / "proc/42/status").write_text("Uid:\t60000\t60000\t60000\t60000\nGid:\t60000\t60000\t60000\t60000\n")
            original = Path.read_text
            def read(path, *args, **kwargs):
                if path == root / "proc/42/limits":
                    raise ProcessLookupError("Task disappeared during read")
                return original(path, *args, **kwargs)
            with patch.object(observer, "MEMORY", root / "memory"), patch.object(observer, "CPU", root / "cpu"), patch.object(observer, "Path", side_effect=lambda path: root / "proc" if str(path) == "/proc" else Path(path)), patch.object(Path, "read_text", read):
                try:
                    observer.identity_seen(["java"])
                except ProcessLookupError as error:
                    info = runtime.failure_info(error)
                else:
                    self.fail("Pinned observer must reproduce the disappearing-task failure")
            self.assertEqual(info["error"], "ProcessLookupError")
            self.assertTrue(any(frame["function"] == "identity_seen" for frame in info["frames"]))
            self.assertLessEqual(len(info["frames"]), 8)
            self.assertEqual(set(info), {"error", "frames"})
            for frame in info["frames"]:
                self.assertEqual(set(frame), {"file", "function", "line"})
                self.assertNotIn("/", frame["file"])
                self.assertNotIn("\\", frame["file"])
            self.assertLessEqual(len(json.dumps(info)), 4096)

    def test_baseline_refuses_unfinished_crash_before_touching_schema(self):
        with patch.object(suite.active, "baseline", return_value={}), patch.object(suite.active.failure, "private_file", return_value=b'{"event":"SCHEMA_CREATED"}\n'), patch.object(suite.lab, "db") as db, self.assertRaises(RuntimeError):
            suite.baseline()
        db.assert_not_called()

    def test_host_log_binds_all_profiles_and_refuses_missing_duplicate_or_tampered_evidence(self):
        lock = suite.active.runtime.load_lock()
        fingerprint = "a" * 64
        results = []
        for name in suite.profiles.PROFILE_ORDER:
            profile = lock["profiles"][name]
            compiled = {"cpu_ns": 1000, "peak_bytes": 4096, "wall_seconds": "0.1", "identity_checked": True, "cleanup": True,
                        "captures": {"compiler": capture.summary(suite.record_for("compiler", b""))}, "verdicts": None} if profile["compile"] else None
            values = []
            for index in range(len(cases.CASES)):
                out, err = cases.output(index)
                record = suite.record_for("stdout", out)
                values.append({"cpu_ns": 1000, "peak_bytes": 4096, "wall_seconds": "0.1", "identity_checked": True, "cleanup": True,
                    "captures": {"stdout": capture.summary(record), "stderr": capture.summary(suite.record_for("stderr", err))},
                    "verdicts": {mode: capture.check(record, cases.expected(index), mode) for mode in ("tokens", "exact")}})
            results.append({"profile": name, "bundle_sha256": fingerprint,
                "source_sha256": hashlib.sha256((ROOT / "streams/fixtures" / profile["source"]).read_bytes()).hexdigest(),
                "compile": compiled, "cases": values})
        versions = {"fixed": "not-a-real-runtime"}
        # Reserve ample room for the frozen host/runtime identity and old-state hashes.
        self.assertLessEqual(len(json.dumps({"results": results, "identity_overhead": "x" * 8192}, indent=2).encode("ascii")), 65536)
        for scenario in ("ok", "missing", "duplicate_version", "duplicate_profile", "wrong_bundle", "wrong_source", "missing_cleanup", "wrong_verdict"):
            current = copy.deepcopy(results)
            if scenario == "missing": current.pop()
            if scenario == "duplicate_profile": current[4] = current[3]
            if scenario == "wrong_bundle": current[0]["bundle_sha256"] = "b" * 64
            if scenario == "wrong_source": current[0]["source_sha256"] = "b" * 64
            if scenario == "wrong_verdict": current[0]["cases"][0]["verdicts"]["exact"] = "WRONG_ANSWER"
            lines = ["INGENIUM_STREAM_VERSIONS " + json.dumps(versions)] * (2 if scenario == "duplicate_version" else 1)
            lines += ["INGENIUM_STREAM_RESULT " + json.dumps(value) for value in current]
            lines += ["PASS: fifty fixed stream cases completed with EOF, exact bytes, identities and normal cleanup"]
            if scenario != "missing_cleanup": lines += ["PASS: host test groups and temporary files removed"]
            with self.subTest(scenario=scenario), patch.object(suite.active.runtime, "regular", return_value="\n".join(lines).encode("ascii")), contextlib.redirect_stdout(io.StringIO()):
                if scenario == "ok":
                    self.assertEqual(suite.parse_log(Path("not-read"), {"source_lock": lock, "observed": versions}, fingerprint), results)
                else:
                    with self.assertRaises(RuntimeError):
                        suite.parse_log(Path("not-read"), {"source_lock": lock, "observed": versions}, fingerprint)

    def test_existing_checkpoint_never_dispatches_or_mutates_database(self):
        with patch.object(suite.platform, "system", return_value="Linux"), patch.object(suite.socket, "gethostname", return_value="ingenium-judge-spike-01"), patch.object(suite.os, "geteuid", return_value=0, create=True), patch.object(suite.os, "umask"), patch.object(suite.signal, "signal"), patch.object(suite.active.tree, "directory"), patch.object(suite.os.path, "lexists", return_value=True), patch.object(suite.lab, "db") as db, patch.object(suite.profiles, "logged") as launch, contextlib.redirect_stderr(io.StringIO()):
            self.assertEqual(suite.main([]), 1)
        db.assert_not_called()
        launch.assert_not_called()


if __name__ == "__main__":
    unittest.main()
