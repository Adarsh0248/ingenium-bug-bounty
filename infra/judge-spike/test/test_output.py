import contextlib
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import selectors
import subprocess
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch


ROOT = Path(__file__).resolve().parent.parent


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


suite = load("protected_output_tests", ROOT / "output.py")
collector = load("protected_collector_tests", ROOT / "output/collect.py")
inside = load("protected_runtime_tests", ROOT / "output/runtime.py")
capture = suite.transport.capture
SHA = "a" * 64
FROZEN = {"image_id": "sha256:" + SHA, "observed": {"fixed": "versions"}}


def command(kinds=("stdout", "stderr"), program="/fixed/program"):
    out, err = ("compiler", "compiler") if kinds == ("compiler",) else kinds
    return ["/usr/local/bin/isolate", "--cg", "--stdin=/box/stdin", "--stdout=/box/" + out,
            "--stderr=/box/" + err, "--meta=/tmp/profile.meta", "--run", "--", "/usr/local/bin/ingenium-exec", program]


def probe_record(name):
    return {"case": name, "cpu_ns": 1000000, "peak_bytes": 1048576, "wall_seconds": "0.5", "identity_checked": True,
            "cleanup": True, "captures": {kind: capture.summary(suite.streams.record_for(kind, data))
                                          for kind, data in zip(("stdout", "stderr"), suite.bundle.EXPECTED[name])}}


class Selector:
    def __init__(self): self.items = {}
    def __enter__(self): return self
    def __exit__(self, *args): return False
    def register(self, fd, events, data): self.items[fd] = SimpleNamespace(fd=fd, data=data)
    def unregister(self, fd): del self.items[fd]
    def get_map(self): return self.items
    def select(self, timeout): return [(key, selectors.EVENT_READ) for key in list(self.items.values())]


class ProtectedOutputTests(unittest.TestCase):
    def test_handoff_only_inherits_the_selected_writer_and_closes_extras_before_exec(self):
        for kinds in (("stdout", "stderr"), ("compiler",)):
            result = collector.launch_args(command(kinds), kinds, 13)
            self.assertIn("--inherit-fds", result)
            self.assertFalse(any(arg.startswith(("--stdout", "--stderr")) for arg in result))
            self.assertEqual(result[-2:], ["13", "/fixed/program"])
            self.assertIn("os.dup2(fd, 2)", result[result.index("-c") + 1])
            self.assertIn("os.closerange(3, 256)", collector.HANDOFF)
            self.assertIn("os.getresuid() != (60000, 60000, 60000)", collector.HANDOFF)

    def test_unreviewed_inheritance_redirection_and_commands_are_rejected(self):
        for scenario in ("writer_low", "writer_high", "bool", "kind", "inherit", "network", "env", "merge", "path", "duplicate", "short", "program", "binary", "delimiter"):
            args, kinds, writer = command(), ("stdout", "stderr"), 13
            if scenario == "writer_low": writer = 2
            if scenario == "writer_high": writer = 64
            if scenario == "bool": writer = True
            if scenario == "kind": kinds = ("stdout",)
            if scenario in ("inherit", "network", "env", "merge"):
                args.insert(1, {"inherit": "--inherit-fds", "network": "--share-net", "env": "--full-env", "merge": "--stderr-to-stdout"}[scenario])
            if scenario == "path": args[3] = "--stdout=/tmp/unowned"
            if scenario == "duplicate": args.insert(3, args[3])
            if scenario == "short": args.insert(1, "-e")
            if scenario == "program": args[-2] = "/not-the-trusted-handoff"
            if scenario == "binary": args[0] = "isolate"
            if scenario == "delimiter": args.remove("--")
            with self.subTest(scenario=scenario), self.assertRaises(RuntimeError):
                collector.launch_args(args, kinds, writer)

    def test_collector_bounds_streams_closes_handles_and_refuses_uncertain_results(self):
        for scenario in ("ok", "compiler", "vanished", "no_identity", "failed", "capture_failed", "runner_error", "deadline", "permission", "spawn", "mismatch", "early_close", "would_block"):
            kinds = ("compiler",) if scenario == "compiler" else ("stdout", "stderr")
            process = Mock()
            process.poll.side_effect = [None, None, 0] if scenario == "early_close" else None
            process.poll.return_value = 0
            process.wait.return_value = 2 if scenario == "runner_error" else 1 if scenario in ("failed", "capture_failed") else 0
            observed = Mock(return_value=scenario != "no_identity")
            if scenario == "vanished": observed.side_effect = [ProcessLookupError(), True]
            if scenario == "permission": observed.side_effect = PermissionError("do not swallow")
            pending = {10: [b"answer\n", b""], 12: [b"diagnostic\n", b""]}
            if scenario == "early_close": pending = {10: [b""], 12: [b""]}
            if scenario == "would_block": pending[10].insert(0, BlockingIOError())
            def read(fd, amount):
                item = pending[fd].pop(0)
                if isinstance(item, Exception): raise item
                return item
            log = Mock()
            log.__enter__ = Mock(return_value=log)
            log.__exit__ = Mock(return_value=False)
            info = SimpleNamespace(st_mode=0o010600, st_ino=1)
            stats = [info, info, info, SimpleNamespace(st_mode=0o010600, st_ino=2)] if scenario == "mismatch" else None
            with self.subTest(scenario=scenario), patch.object(collector.os, "name", "posix"), \
                    patch.object(collector.selectors, "DefaultSelector", return_value=Selector()), \
                    patch.object(collector.os, "pipe", side_effect=[(10, 11), (12, 13)]), \
                    patch.object(collector.os, "fstat", return_value=info, side_effect=stats), \
                    patch.object(collector.os, "set_blocking"), patch.object(collector.os, "fchmod", create=True), \
                    patch.object(collector.os, "close") as close, patch.object(collector.os, "read", side_effect=read), \
                    patch.object(collector.LOG.__class__, "open", return_value=log), \
                    patch.object(collector.subprocess, "Popen", return_value=process, side_effect=OSError("spawn") if scenario == "spawn" else None) as launch, \
                    patch.object(collector.time, "monotonic", side_effect=[0, 100] if scenario == "deadline" else None, return_value=0), \
                    patch.object(collector.time, "sleep") as sleep, contextlib.redirect_stdout(io.StringIO()) as diagnostics:
                if scenario in ("no_identity", "failed", "runner_error", "deadline", "permission", "spawn", "mismatch"):
                    with self.assertRaises((RuntimeError, OSError)):
                        collector.collect(SimpleNamespace(identity_seen=observed), command(kinds), kinds, ["main"], 10, capture=capture)
                    process.kill.assert_not_called()
                    if scenario in ("failed", "no_identity"): self.assertIn("INGENIUM_OUTPUT_CAPTURE_DIAGNOSTIC", diagnostics.getvalue())
                else:
                    if scenario == "capture_failed":
                        phase = collector.capture_phase(SimpleNamespace(identity_seen=observed), command(kinds), kinds, ["main"], 10, capture=capture)
                        self.assertEqual(phase["rc"], 1)
                        self.assertIs(phase["identity_checked"], True)
                        records = phase["captures"]
                    else:
                        records = collector.collect(SimpleNamespace(identity_seen=observed), command(kinds), kinds, ["main"], 10, capture=capture)
                    self.assertEqual(capture.validate(records[kinds[0]], kinds[0]), b"" if scenario == "early_close" else b"answer\n")
                    self.assertEqual(launch.call_args.kwargs["pass_fds"], (11,) if scenario == "compiler" else (13,))
                    self.assertTrue(launch.call_args.kwargs["close_fds"])
                    self.assertEqual(launch.call_args.kwargs["stdout"], 11)
                    if scenario == "early_close": sleep.assert_called()
                self.assertEqual(sorted(call.args[0] for call in close.call_args_list), [10, 11] if scenario == "compiler" or scenario == "mismatch" else [10, 11, 12, 13])

    def test_platform_and_deadline_guards_precede_pipe_allocation(self):
        for wall in (0, -1, 61, True, float("nan")):
            with self.subTest(wall=wall), patch.object(collector.os, "name", "posix"), patch.object(collector.os, "pipe") as pipe, self.assertRaises(RuntimeError):
                collector.collect(None, command(), ("stdout", "stderr"), ["fixed"], wall, capture=capture)
            pipe.assert_not_called()
        with patch.object(collector.os, "name", "nt"), patch.object(collector.os, "pipe") as pipe, self.assertRaises(RuntimeError):
            collector.collect(None, command(), ("stdout", "stderr"), ["fixed"], 10, capture=capture)
        pipe.assert_not_called()

    @unittest.skipUnless(os.name == "posix", "Real anonymous-pipe exercise needs POSIX.")
    def test_real_pipes_drain_large_bytes_and_wait_after_early_eof_without_leaking_parent_handles(self):
        real_popen = subprocess.Popen
        for early in (False, True):
            with self.subTest(early=early), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                marker = root / "finished"
                code = ("import os,time\n"
                        "for fd in range(3,256):\n"
                        " try: os.fstat(fd)\n"
                        " except OSError: continue\n"
                        " raise RuntimeError('leaked descriptor')\n"
                        "def send(fd,data):\n"
                        " while data:\n"
                        "  n=os.write(fd,data); data=data[n:]\n")
                if early:
                    code += "os.write(1,b'early\\n'); os.close(1); os.close(2); time.sleep(.05)\n"
                else:
                    code += "send(1,b'x'*2097169); send(2,b'd'*131089)\n"
                code += "with open(" + repr(str(marker)) + ",'xb') as f: f.write(b'complete')\n"
                args = command(program=sys.executable) + ["-I", "-B", "-S", "-c", code]
                def start(argv, **kwargs):
                    argv = argv[argv.index("/usr/local/bin/ingenium-exec") + 1:]
                    argv[0] = sys.executable
                    index = argv.index(collector.HANDOFF)
                    # This is an FD unit test, not a native UID-isolation test.
                    argv[index] = "import os\nos.getresuid=lambda:(60000,)*3\nos.getresgid=lambda:(60000,)*3\n" + collector.HANDOFF
                    return real_popen(argv, **kwargs)
                with patch.object(collector, "LOG", root / "isolate.log"), patch.object(collector.subprocess, "Popen", side_effect=start):
                    records = collector.collect(SimpleNamespace(identity_seen=lambda names: True), args, ("stdout", "stderr"), ["fixed"], 10, capture=capture)
                self.assertEqual(marker.read_bytes(), b"complete")
                self.assertEqual(records["stdout"]["observed_bytes"], 6 if early else 2097169)
                self.assertEqual(records["stderr"]["observed_bytes"], 0 if early else 131089)
                self.assertEqual(records["stdout"]["retained_bytes"], 6 if early else 1048577)
                self.assertEqual(records["stderr"]["retained_bytes"], 0 if early else 65536)

    def test_probe_results_require_exact_bytes_types_limits_and_cleanup(self):
        for name in suite.bundle.CASES:
            suite.checked_probe(probe_record(name), name)
            for scenario in ("count", "complete", "identity", "cleanup", "cpu", "channels", "case"):
                value = probe_record(name)
                if scenario == "count": value["captures"]["stdout"]["observed_bytes"] += 1
                if scenario == "complete": value["captures"]["stdout"]["complete"] = 1
                if scenario == "identity": value["identity_checked"] = False
                if scenario == "cleanup": value["cleanup"] = False
                if scenario == "cpu": value["cpu_ns"] = 4000000001
                if scenario == "channels": value["captures"]["stderr"] = value["captures"]["stdout"]
                if scenario == "case": value["case"] = "other"
                with self.subTest(case=name, scenario=scenario), self.assertRaises(RuntimeError): suite.checked_probe(value, name)

    def test_bundle_has_only_fixed_regular_sources(self):
        self.assertEqual(len(suite.bundle.fingerprint()), 64)
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for name in suite.bundle.FILES: (root / name).write_bytes((ROOT / "output" / name).read_bytes())
            with patch.object(suite.bundle, "HERE", root):
                self.assertEqual(len(suite.bundle.fingerprint()), 64)
                (root / "unexpected").write_bytes(b"extra")
                with self.assertRaises(RuntimeError): suite.bundle.fingerprint()

    def test_saved_isolation_proof_is_checked_read_only_and_mismatches_block_new_work(self):
        before = {"fifteen": "preserved"}
        fixed = b"public-source"
        policy_sha = hashlib.sha256(fixed).hexdigest()
        for scenario in ("ok", "unfinished", "seal", "preserved", "manifest", "log", "policy", "results"):
            evidence = {"scope": "fixed-shared-isolation-boundary-v1", "preserved": before, "image_id": FROZEN["image_id"],
                        "manifest_sha256": SHA, "bundle_sha256": SHA, "stream_sha256": SHA,
                        "log_sha256": hashlib.sha256(b"saved-log").hexdigest(), "results": ["three"],
                        "helpers_sha256": {"isolation.py": policy_sha, "namespace-smoke.apparmor": policy_sha, "cgroup-smoke.sh": "old-launcher"}}
            if scenario == "preserved": evidence["preserved"] = {"changed": True}
            if scenario == "manifest": evidence["manifest_sha256"] = "changed"
            if scenario == "log": evidence["log_sha256"] = "changed"
            if scenario == "policy": evidence["helpers_sha256"]["namespace-smoke.apparmor"] = "changed"
            raw = json.dumps(evidence).encode()
            journal = json.dumps({"event": "PREPARED" if scenario == "unfinished" else "COMPLETE", "evidence_sha256": "changed" if scenario == "seal" else hashlib.sha256(raw).hexdigest(),
                                  "preserved": before, "cases": 3, "new_provider_records": 0}).encode()
            def private(path, *args): return {"evidence.json": raw, "journal.jsonl": journal, "isolation.log": b"saved-log"}[path.name]
            with self.subTest(scenario=scenario), patch.object(suite.isolation, "completed_transport", return_value=before), \
                    patch.object(suite.transport, "private", side_effect=private), patch.object(suite.guard, "manifest", return_value=(FROZEN, SHA)), \
                    patch.object(suite.streams.bundle, "fingerprint", return_value=SHA), patch.object(suite.isolation.bundle, "fingerprint", return_value=SHA), \
                    patch.object(suite.transport.runtime, "regular", return_value=fixed), \
                    patch.object(suite.isolation, "parse_log", return_value=["different"] if scenario == "results" else ["three"]), \
                    patch.object(suite.lab, "db") as db:
                if scenario == "ok": self.assertEqual(suite.previous()["earlier"], before)
                else:
                    with self.assertRaises(RuntimeError): suite.previous()
                db.assert_not_called()

    def test_wrong_host_arguments_or_existing_checkpoint_prevent_launch(self):
        for scenario in ("host", "args", "root", "existing"):
            with self.subTest(scenario=scenario), patch.object(suite.platform, "system", return_value="Linux"), \
                    patch.object(suite.socket, "gethostname", return_value="wrong" if scenario == "host" else "ingenium-judge-spike-01"), \
                    patch.object(suite.os, "geteuid", return_value=1 if scenario == "root" else 0, create=True), patch.object(suite.os, "umask"), \
                    patch.object(suite.signal, "signal"), patch.object(suite.streams.active.tree, "directory"), patch.object(suite.os.path, "lexists", return_value=True), \
                    patch.object(suite, "previous") as previous, patch.object(suite.streams.profiles, "logged") as launch, contextlib.redirect_stderr(io.StringIO()):
                self.assertEqual(suite.main(["unexpected"] if scenario == "args" else []), 1)
                previous.assert_not_called()
                launch.assert_not_called()

    def test_log_requires_one_complete_bundle_and_all_three_exact_probe_results(self):
        for scenario in ("ok", "bundle", "duplicate", "missing", "changed", "failed"):
            lines = ["INGENIUM_OUTPUT_BUNDLE " + SHA,
                     "PASS: protected output completed fifty language cases and three tampering/EOF probes with normal cleanup"]
            results = [probe_record(name) for name in suite.bundle.CASES]
            if scenario == "bundle": lines[0] = "INGENIUM_OUTPUT_BUNDLE changed"
            if scenario == "duplicate": results.append(results[0])
            if scenario == "missing": results.pop()
            if scenario == "changed": results[0]["captures"]["stdout"]["sha256"] = "changed"
            if scenario == "failed": lines.append("INGENIUM_OUTPUT_FAILURE {}")
            lines += ["INGENIUM_OUTPUT_RESULT " + json.dumps(value) for value in results]
            with self.subTest(scenario=scenario), patch.object(suite.transport, "private", return_value="\n".join(lines).encode()), \
                    patch.object(suite.streams, "parse_log", return_value=["checked-parity"]), contextlib.redirect_stdout(io.StringIO()):
                if scenario == "ok": self.assertEqual(suite.parse_log(Path("not-read"), FROZEN, SHA, SHA)["probes"], results)
                else:
                    with self.assertRaises(RuntimeError): suite.parse_log(Path("not-read"), FROZEN, SHA, SHA)

    def test_probe_phase_checks_output_accounting_liveness_and_cleanup_before_returning(self):
        for scenario in ("ok", "bytes", "memory", "tasks", "cleanup", "early_close", "missing_marker"):
            with self.subTest(scenario=scenario), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                runner = SimpleNamespace(WORK=root / "work", MEMORY=root / "memory", CPU=root / "cpu", ISOLATE="/usr/local/bin/isolate", require=capture.require)
                name = "early-close" if scenario in ("early_close", "missing_marker") else "read-and-leak"
                def run(args):
                    if "--init" in args:
                        (runner.WORK / "box").mkdir(parents=True)
                        runner.MEMORY.mkdir()
                        runner.CPU.mkdir()
                        for field, value in {"memory.limit_in_bytes": "536870912", "memory.memsw.limit_in_bytes": "536870912",
                                             "memory.max_usage_in_bytes": "1048576", "memory.failcnt": "1" if scenario == "memory" else "0",
                                             "memory.memsw.failcnt": "0", "tasks": "123" if scenario == "tasks" else ""}.items():
                            (runner.MEMORY / field).write_text(value)
                        (runner.CPU / "cpuacct.usage").write_text("1000000")
                        (runner.CPU / "tasks").write_text("")
                        return str(runner.WORK)
                    self.assertIn("--cleanup", args)
                    if scenario != "cleanup":
                        for owned in (runner.WORK / "box", runner.WORK, runner.MEMORY, runner.CPU):
                            self.assertTrue(owned.resolve().is_relative_to(root.resolve()))
                            for path in owned.iterdir():
                                path.chmod(0o600)
                                path.unlink()
                            owned.rmdir()
                def collect(*args):
                    if scenario == "early_close": (runner.WORK / "box/finished").write_bytes(b"finished after closing output\n")
                    return {kind: suite.streams.record_for(kind, b"changed" if scenario == "bytes" else data)
                            for kind, data in zip(("stdout", "stderr"), suite.bundle.EXPECTED[name])}
                runner.command = Mock(side_effect=run)
                runner.regular = lambda path, cap: b"fixed-meta" if path.as_posix() == "/tmp/output.meta" else path.read_bytes()
                runner.successful_metadata = Mock(return_value={"time-wall": "0.5"})
                stream = SimpleNamespace(collect=Mock(side_effect=collect), capture=capture)
                if scenario in ("ok", "early_close"):
                    self.assertTrue(inside.probe_phase(runner, stream, name)["cleanup"])
                else:
                    with self.assertRaises(FileNotFoundError if scenario == "missing_marker" else RuntimeError): inside.probe_phase(runner, stream, name)
                    self.assertTrue(runner.WORK.exists())
                    for path in (runner.WORK / "box").iterdir(): path.chmod(0o600)

    def test_seal_requires_stable_old_evidence_sources_host_and_successful_execution(self):
        for scenario in ("ok", "launch", "parse", "old_state", "bundle", "boot", "source"):
            journal = Mock()
            journal.directory = Path("private-unit-only")
            before = {"fifteen": "unchanged"}
            with self.subTest(scenario=scenario), contextlib.ExitStack() as stack:
                patches = [patch.object(suite.platform, "system", return_value="Linux"),
                           patch.object(suite.socket, "gethostname", return_value="ingenium-judge-spike-01"),
                           patch.object(suite.os, "geteuid", return_value=0, create=True), patch.object(suite.os, "umask"),
                           patch.object(suite.signal, "signal"), patch.object(suite.os.path, "lexists", return_value=False),
                           patch.object(suite.streams.active.tree, "directory"), patch.object(suite.lab.queue, "check_services"),
                           patch.object(suite, "previous", side_effect=[before, {"changed": True}] if scenario == "old_state" else None, return_value=before),
                           patch.object(suite.guard, "manifest", return_value=(FROZEN, SHA)),
                           patch.object(suite.bundle, "fingerprint", side_effect=[SHA, "changed"] if scenario == "bundle" else None, return_value=SHA),
                           patch.object(suite.streams.bundle, "fingerprint", return_value=SHA),
                           patch.object(suite.transport.runtime, "regular", side_effect=[b"fixed", b"fixed", b"fixed", b"changed"] if scenario == "source" else None, return_value=b"fixed"),
                           patch.object(suite.Path, "read_text", side_effect=["boot", "other"] if scenario == "boot" else None, return_value="boot"),
                           patch.object(suite.Path, "read_bytes", return_value=b"saved-log"),
                           patch.object(suite.transport.failure, "private_file", return_value=b"private-config-never-printed"),
                           patch.object(suite.lab, "prepare_config", return_value=(None, "synthetic-token")),
                           patch.object(suite.lab.api, "check_api"), patch.object(suite.lab, "private_ip", return_value="private"),
                           patch.object(suite.lab, "Journal", return_value=journal),
                           patch.object(suite, "parse_log", return_value={"checked": True}, side_effect=RuntimeError("failed proof") if scenario == "parse" else None),
                           contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO())]
                for item in patches: stack.enter_context(item)
                launch = stack.enter_context(patch.object(suite.streams.profiles, "logged", return_value=Path("private-unit-only/output.log"),
                                                          side_effect=RuntimeError("failed launch") if scenario == "launch" else None))
                seal = stack.enter_context(patch.object(suite.transport, "save", return_value=SHA))
                self.assertEqual(suite.main([]), 0 if scenario == "ok" else 1)
                self.assertEqual(launch.call_count, 1)
                if scenario == "ok":
                    self.assertEqual(seal.call_count, 1)
                    self.assertEqual(journal.record.call_args.args, ("COMPLETE",))
                    self.assertEqual(journal.record.call_args.kwargs["new_provider_records"], 0)
                else: seal.assert_not_called()

    def test_large_report_uses_existing_compact_bounded_writer_without_changing_small_recovery_limit(self):
        value = {"results": {"parity": [{"cases": [probe_record("read-and-leak") for _ in range(10)]} for _ in range(5)],
                             "probes": [probe_record(name) for name in suite.bundle.CASES]},
                 "preserved": {"files": {f"saved-{index:03d}.json": SHA for index in range(200)}}}
        pretty = json.dumps(value, sort_keys=True, indent=2).encode("ascii") + b"\n"
        compact = suite.transport.canonical(value)
        self.assertGreater(len(pretty), 65536)
        self.assertLess(len(compact), 65536)
        with tempfile.TemporaryDirectory() as directory, patch.object(suite.lab, "sync_directory"):
            path = Path(directory) / "evidence.json"
            with self.assertRaisesRegex(RuntimeError, "Oversized fixed recovery evidence"):
                suite.guard.private_json(path, value)
            self.assertFalse(path.exists())
            self.assertEqual(suite.transport.save(path, value), hashlib.sha256(compact).hexdigest())
            self.assertEqual(path.read_bytes(), compact)
            with self.assertRaises(FileExistsError): suite.transport.save(path, value)
            huge = Path(directory) / "too-large.json"
            with self.assertRaisesRegex(RuntimeError, "private storage budget"):
                suite.transport.save(huge, {"data": "x" * suite.transport.MAX_WIRE})
            self.assertFalse(huge.exists())


if __name__ == "__main__":
    unittest.main()
