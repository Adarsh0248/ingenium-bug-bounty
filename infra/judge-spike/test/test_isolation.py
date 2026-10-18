import contextlib
import copy
import ctypes
import errno
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, call, patch
import uuid


ROOT = Path(__file__).resolve().parent.parent


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


suite = load("isolation_host_tests", ROOT / "isolation.py")
inside = load("isolation_runtime_tests", ROOT / "isolation/runtime.py")
resources = SimpleNamespace(RLIMIT_NOFILE=1, RLIMIT_CORE=2, RLIMIT_NPROC=3)
with patch.dict(sys.modules, {"resource": resources}):
    probe = load("isolation_probe_tests", ROOT / "isolation/probe.py")
SHA = "a" * 64
FROZEN = {"source_lock": json.loads((ROOT / "profiles/lock.json").read_text()), "image_id": "sha256:" + SHA, "observed": {"fixed": "versions"}}


def result(name):
    data = {"boundary": {"sockets": [errno.EACCES] * 4, "hidden_paths": [errno.ENOENT] * len(suite.bundle.HIDDEN_PATHS),
                          "usr_write": errno.EROFS, "private_env_absent": True},
            "fork-limit": {"children": 7, "fork_errno": errno.EAGAIN, "joined": True},
            "detached-child": {"child_detached": True}}[name]
    value = {"case": name, "identity": True, "result": data}
    raw = json.dumps(value, separators=(",", ":")).encode() + b"\n"
    return {"case": name, "probe": value, "observed_tasks": {"boundary": 1, "fork-limit": 8, "detached-child": 2}[name],
            "cpu_ns": 1000000, "peak_bytes": 1048576, "wall_seconds": "0.5", "identity_checked": True, "cleanup": True,
            "captures": {kind: suite.transport.capture.summary(suite.transport.streams.record_for(kind, data)) for kind, data in (("stdout", raw), ("stderr", b""))}}


class IsolationTests(unittest.TestCase):
    def test_denial_requires_expected_errno_and_closes_any_unexpected_open_handle(self):
        for code in (errno.EPERM, errno.EACCES):
            self.assertEqual(probe.denied(Mock(side_effect=OSError(code, "denied")), (errno.EPERM, errno.EACCES)), code)
        with self.assertRaises(RuntimeError): probe.denied(Mock(side_effect=OSError(errno.EMFILE, "not isolation")), (errno.EPERM,))
        handle = Mock()
        with self.assertRaises(RuntimeError): probe.denied(Mock(return_value=handle), (errno.EPERM,))
        handle.close.assert_called_once()
        with patch.object(probe.os, "close") as close, self.assertRaises(RuntimeError):
            probe.denied(Mock(return_value=42), (errno.EPERM,))
        close.assert_called_once_with(42)

    def test_boundary_attempts_socket_creation_only_and_never_reads_secret_bytes(self):
        with patch.object(probe.os, "environ", {}), patch.object(probe.os, "O_NONBLOCK", 0, create=True), patch.object(probe.socket, "socket", side_effect=PermissionError(errno.EACCES, "denied")) as sockets, patch.object(probe.os, "open", side_effect=PermissionError(errno.EACCES, "denied")) as opens, patch.object(probe.os, "read") as read:
            value = probe.boundary()
        self.assertEqual(len(value["sockets"]), 4)
        self.assertEqual(len(value["hidden_paths"]), len(suite.bundle.HIDDEN_PATHS))
        self.assertEqual(sockets.call_count, 4)
        self.assertEqual([entry.args[0] for entry in opens.call_args_list[:-1]], list(suite.bundle.HIDDEN_PATHS))
        read.assert_not_called()
        for name in suite.bundle.FORBIDDEN_ENV:
            with patch.object(probe.os, "environ", {name: "synthetic"}), patch.object(probe.socket, "socket") as connect, self.assertRaises(RuntimeError):
                probe.boundary()
            connect.assert_not_called()

    def test_fork_probe_is_bounded_and_joins_only_its_own_children(self):
        for count, code in ((7, errno.EAGAIN), (6, errno.EAGAIN), (7, errno.EPERM), (9, None)):
            children = list(range(101, 101 + count))
            outcomes = children + ([] if code is None else [OSError(code, "fork denied")])
            with patch.object(probe.os, "pipe", return_value=(3, 4)), patch.object(probe.os, "fork", create=True, side_effect=outcomes) as fork, patch.object(probe.os, "close") as close, patch.object(probe.os, "waitpid", create=True, side_effect=lambda pid, _: (pid, 0)) as wait, patch.object(probe.time, "sleep"):
                if count == 7 and code == errno.EAGAIN:
                    self.assertEqual(probe.fork_limit(), {"children": 7, "fork_errno": errno.EAGAIN, "joined": True})
                else:
                    with self.assertRaises(RuntimeError): probe.fork_limit()
                self.assertLessEqual(fork.call_count, 9)
                self.assertEqual([entry.args[0] for entry in wait.call_args_list], children)
                self.assertEqual(close.call_args_list, [call(4), call(3)])

    def test_identity_limits_and_capability_inspection_fail_closed_without_native_calls(self):
        for scenario in ("ok", "uid", "groups", "limits", "capget", "capability", "setuid_allowed"):
            def limit(resource):
                return (1, 1) if scenario == "limits" else {1: (256, 256), 2: (0, 0), 3: (8, 8)}[resource]
            def syscall(number, header, data):
                self.assertEqual(number.value, 125)
                if scenario == "capability": data._obj[0].effective = 1
                return -1 if scenario == "capget" else 0
            with self.subTest(scenario=scenario), contextlib.ExitStack() as stack:
                stack.enter_context(patch.object(probe.os, "getresuid", create=True, return_value=(0, 0, 0) if scenario == "uid" else (60000,) * 3))
                stack.enter_context(patch.object(probe.os, "getresgid", create=True, return_value=(60000,) * 3))
                stack.enter_context(patch.object(probe.os, "getgroups", create=True, return_value=[999] if scenario == "groups" else []))
                stack.enter_context(patch.object(probe.resource, "getrlimit", create=True, side_effect=limit))
                stack.enter_context(patch.object(probe.ctypes, "CDLL", return_value=Mock(syscall=Mock(side_effect=syscall))))
                stack.enter_context(patch.object(probe.os, "setuid", create=True, side_effect=None if scenario == "setuid_allowed" else PermissionError(errno.EPERM, "denied")))
                if scenario == "ok": probe.identity()
                else:
                    with self.assertRaises(RuntimeError): probe.identity()

    def test_host_results_require_real_denial_causes_live_observations_and_exact_captured_bytes(self):
        for name in suite.bundle.CASES:
            good = result(name)
            suite.checked_result(good, name)
            for scenario in ("identity", "cleanup", "missing_child", "too_many", "accounting", "capture", "boolean_count", "probe_failure"):
                value = copy.deepcopy(good)
                if scenario == "identity": value["identity_checked"] = False
                if scenario == "cleanup": value["cleanup"] = False
                if scenario == "missing_child": value["observed_tasks"] = 0
                if scenario == "too_many": value["observed_tasks"] = 9
                if scenario == "accounting": value["cpu_ns"] = 4000000001
                if scenario == "capture": value["captures"]["stdout"]["sha256"] = "0" * 64
                if scenario == "boolean_count": value["captures"]["stderr"]["observed_bytes"] = False
                if scenario == "probe_failure": value["probe"]["identity"] = False
                with self.subTest(name=name, scenario=scenario), self.assertRaises(RuntimeError): suite.checked_result(value, name)
        for field, changed in (("sockets", [errno.EMFILE] * 4), ("hidden_paths", [errno.EIO] * len(suite.bundle.HIDDEN_PATHS)), ("usr_write", 0), ("private_env_absent", False)):
            value = result("boundary")
            value["probe"]["result"][field] = changed
            with self.assertRaises(RuntimeError): suite.checked_result(value, "boundary")

    def test_parser_requires_all_cases_correct_frozen_versions_bundle_and_final_cleanup(self):
        rows = [{"bundle_sha256": SHA, "result": result(name)} for name in suite.bundle.CASES]
        for scenario in ("ok", "missing", "duplicate", "bundle", "versions", "failure", "cleanup"):
            current = copy.deepcopy(rows)
            if scenario == "missing": current.pop()
            if scenario == "duplicate": current[-1] = current[0]
            if scenario == "bundle": current[0]["bundle_sha256"] = "b" * 64
            lines = ["INGENIUM_ISOLATION_VERSIONS " + json.dumps({} if scenario == "versions" else FROZEN["observed"])]
            lines += ["INGENIUM_ISOLATION_RESULT " + json.dumps(row) for row in current]
            lines.append("PASS: three fixed isolation cases completed with observed identity, accounted children and normal cleanup")
            if scenario != "cleanup": lines.append("PASS: host test groups and temporary files removed")
            if scenario == "failure": lines.append("INGENIUM_ISOLATION_FAILURE {}")
            with patch.object(suite.transport, "private", return_value="\n".join(lines).encode()), contextlib.redirect_stdout(io.StringIO()):
                if scenario == "ok": self.assertEqual(suite.parse_log(Path("unused"), FROZEN, SHA), rows)
                else:
                    with self.assertRaises(RuntimeError): suite.parse_log(Path("unused"), FROZEN, SHA)

    def test_observer_skips_preexec_and_vanished_tasks_but_checks_caps_limits_and_accounting(self):
        for scenario in ("ok", "preexec", "vanished", "capability", "wrong_uid", "wrong_limit", "unaccounted"):
            def read(path):
                if path == Path("/memory/tasks"): return "42\n"
                if path == Path("/cpu/tasks"): return "" if scenario == "unaccounted" else "42\n"
                if path.name == "comm": return "isolate\n" if scenario == "preexec" else "python3.14\n"
                if scenario == "vanished": raise ProcessLookupError()
                if path.name == "status":
                    status = "Uid:\t60000\t60000\t60000\t60000\nGid:\t60000\t60000\t60000\t60000\nCapEff:\t0000\nCapPrm:\t0000\nCapInh:\t0000\nCapAmb:\t0000\nNoNewPrivs:\t1\nSeccomp:\t2\n"
                    if scenario == "capability": status = status.replace("CapEff:\t0000", "CapEff:\t0001")
                    if scenario == "wrong_uid": status = status.replace("60000", "1000")
                    return status
                if path.name == "limits": return "Max processes             " + ("9    9" if scenario == "wrong_limit" else "8    8") + "    processes\n"
                raise AssertionError(path)
            runner = SimpleNamespace(MEMORY=Path("/memory"), CPU=Path("/cpu"), require=suite.require)
            with self.subTest(scenario=scenario), patch.object(Path, "read_text", read):
                if scenario in ("capability", "wrong_uid", "wrong_limit"):
                    with self.assertRaises(RuntimeError): inside.observed_tasks(runner)
                else: self.assertEqual(inside.observed_tasks(runner), int(scenario == "ok"))

    def test_bounded_drain_wait_requires_both_controllers_empty_before_return(self):
        runner = SimpleNamespace(MEMORY=Path("/memory"), CPU=Path("/cpu"), require=suite.require)
        with patch.object(Path, "read_text", side_effect=["42\n", "", "", "", ""]), patch.object(inside.time, "monotonic", side_effect=[0, 0.5]), patch.object(inside.time, "sleep") as sleep:
            inside.await_empty(runner)
            sleep.assert_called_once_with(0.01)
        with patch.object(Path, "read_text", return_value="42\n"), patch.object(inside.time, "monotonic", side_effect=[0, 3]), patch.object(inside.time, "sleep") as sleep, self.assertRaises(RuntimeError):
            inside.await_empty(runner)
        sleep.assert_not_called()

    def test_bundle_is_exact_regular_bounded_and_content_fingerprinted(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for name in suite.bundle.FILES: (root / name).write_bytes(b"fixed\n")
            with patch.object(suite.bundle, "HERE", root):
                first = suite.bundle.fingerprint()
                (root / "probe.py").write_bytes(b"changed\n")
                self.assertNotEqual(suite.bundle.fingerprint(), first)
                (root / "extra.py").write_bytes(b"extra\n")
                with self.assertRaises(RuntimeError): suite.bundle.fingerprint()

    def test_old_checkpoint_gate_requires_five_seals_and_reads_database_only(self):
        tokens = {name: str(uuid.uuid4()) for name in suite.transport.runner.TRANSPORT}
        context = {"scope": suite.transport.SCOPE, "manifest_sha256": SHA, "image_id": FROZEN["image_id"], "bundle_sha256": SHA,
                   "helpers_sha256": {"cgroup-smoke.sh": "old", "fixed": SHA}, "jobs": {}}
        owners = {}
        for name in tokens:
            owners[name] = str(uuid.uuid4())
            context["jobs"][name] = {"binding": {"attempt_id": str(uuid.uuid4()), "host_epoch": str(uuid.uuid4()), "manifest_sha256": SHA, "payload_sha256": SHA},
                                     "payload": suite.transport.payload(name, FROZEN)}
        completed = {"event": "COMPLETE", "provider_tokens": tokens, "preserved": {"old": "snapshot"}}
        for scenario in ("ok", "unfinished", "old_rows", "missing_seal", "changed_evidence", "wrong_payload"):
            value = copy.deepcopy(completed)
            current = copy.deepcopy(context)
            if scenario == "unfinished": value["event"] = "PREPARED"
            if scenario == "wrong_payload": current["jobs"]["c"]["payload"]["stdin"] = "changed"
            def private(path, *args):
                if path.parent.name == "transport-v1" and path.name == "journal.jsonl": return json.dumps(value).encode()
                if path.name == "context.json": return json.dumps(current).encode()
                if path.name == "evidence.json": return b"changed" if scenario == "changed_evidence" else b"{}"
                return b"preserved-fixed-log"
            def database(sql):
                if "FROM submissions s;" in sql: return {"count": 15, "complete": True, "sha256": SHA}
                if "bool_and(state" in sql: return {"count": 5, "sealed": scenario != "missing_seal", "tokens": sorted(tokens.values()), "sha256": SHA}
                for name in tokens:
                    if current["jobs"][name]["binding"]["attempt_id"] in sql:
                        return {"owner": owners[name], "sha256": hashlib.sha256(b"{}").hexdigest(), "provider": tokens[name]}
                raise AssertionError(sql)
            with self.subTest(scenario=scenario), contextlib.ExitStack() as stack:
                stack.enter_context(patch.object(suite.transport, "private", side_effect=private))
                stack.enter_context(patch.object(suite.transport, "preserved", return_value={} if scenario == "old_rows" else completed["preserved"]))
                stack.enter_context(patch.object(suite.guard, "manifest", return_value=(FROZEN, SHA)))
                stack.enter_context(patch.object(suite.transport.streams.bundle, "fingerprint", return_value=SHA))
                stack.enter_context(patch.object(suite.transport, "helpers", return_value={"cgroup-smoke.sh": "new", "fixed": SHA}))
                stack.enter_context(patch.object(suite.transport, "checked_result"))
                db = stack.enter_context(patch.object(suite.lab, "db", side_effect=database))
                stack.enter_context(patch.object(suite.lab, "redis", return_value=b"empty"))
                if scenario == "ok": self.assertEqual(suite.completed_transport()["providers"]["count"], 15)
                else:
                    with self.assertRaises(RuntimeError): suite.completed_transport()
                self.assertTrue(all(not entry.kwargs.get("write", False) and entry.args[0].startswith("SELECT ") for entry in db.call_args_list))

    def test_wrong_machine_user_arguments_or_existing_checkpoint_cannot_launch(self):
        for system, host, uid, args, exists in (("Windows", "vm", 0, [], False), ("Linux", "cloudshell", 0, [], False),
                ("Linux", "ingenium-judge-spike-01", 1000, [], False), ("Linux", "ingenium-judge-spike-01", 0, ["--force"], False),
                ("Linux", "ingenium-judge-spike-01", 0, [], True)):
            with patch.object(suite.platform, "system", return_value=system), patch.object(suite.socket, "gethostname", return_value=host), patch.object(suite.os, "geteuid", create=True, return_value=uid), patch.object(suite.os, "umask"), patch.object(suite.signal, "signal"), patch.object(suite.transport.streams.active.tree, "directory"), patch.object(suite.os.path, "lexists", return_value=exists), patch.object(suite.lab, "db") as db, patch.object(suite.transport.streams.profiles, "logged") as launch, contextlib.redirect_stderr(io.StringIO()):
                self.assertEqual(suite.main(args), 1)
                db.assert_not_called()
                launch.assert_not_called()

    def test_phase_checks_accounting_children_and_cleanup_without_running_a_program(self):
        for scenario in ("ok", "live_tasks", "memory_limit", "diagnostics", "missing_child", "collector_failure"):
            with self.subTest(scenario=scenario), tempfile.TemporaryDirectory() as directory, contextlib.ExitStack() as stack, contextlib.redirect_stdout(io.StringIO()) as output:
                root = Path(directory)
                work, memory, cpu = root / "workspace", root / "memory", root / "cpu"
                commands = []
                def command(args):
                    commands.append(args)
                    if args[-1] == "--init":
                        (work / "box").mkdir(parents=True)
                        memory.mkdir()
                        cpu.mkdir()
                        for field, value in {"memory.limit_in_bytes": 536870911 if scenario == "memory_limit" else 536870912,
                                "memory.memsw.limit_in_bytes": 536870912, "memory.failcnt": 0, "memory.memsw.failcnt": 0,
                                "memory.max_usage_in_bytes": 1048576, "tasks": "42" if scenario == "live_tasks" else ""}.items():
                            (memory / field).write_text(str(value))
                        (cpu / "cpuacct.usage").write_text("1000000")
                        (cpu / "tasks").write_text("")
                        return str(work)
                    self.assertEqual(args[-1], "--cleanup")
                    for path in (work / "box").iterdir():
                        path.chmod(0o600)
                        path.unlink()
                    (work / "box").rmdir()
                    work.rmdir()
                    for folder in (memory, cpu):
                        for path in folder.iterdir(): path.unlink()
                        folder.rmdir()
                    return ""
                runner = SimpleNamespace(WORK=work, MEMORY=memory, CPU=cpu, ISOLATE="not-executed", require=suite.require,
                    command=command, identity_seen=Mock(return_value=True), successful_metadata=Mock(return_value={"time-wall": "0.5"}),
                    regular=lambda path, cap: b"fixed-metadata" if path.name == "isolation.meta" else path.read_bytes())
                probe_value = result("fork-limit")["probe"]
                stdout = json.dumps(probe_value, separators=(",", ":")).encode() + b"\n"
                records = {kind: suite.transport.streams.record_for(kind, data) for kind, data in
                           (("stdout", stdout), ("stderr", b"debug" if scenario == "diagnostics" else b""))}
                def collect(observer, args, kinds, names, wall):
                    self.assertIn("--processes=8", args)
                    self.assertIn("--cg-mem=524288", args)
                    self.assertIn("--no-default-dirs", args)
                    self.assertNotIn("--share-net", args)
                    self.assertFalse(any("INGENIUM_PRIVATE_CANARY" in arg for arg in args))
                    if scenario == "collector_failure":
                        (work / "box/probe-failure.json").write_bytes(b'{"error":"RuntimeError","reason":"fixed failure"}')
                        raise RuntimeError("failed probe")
                    observer.identity_seen(names)
                    return records
                stream = SimpleNamespace(collect=Mock(side_effect=collect), capture=suite.transport.capture)
                stack.enter_context(patch.object(inside, "observed_tasks", return_value=7 if scenario == "missing_child" else 8))
                stack.enter_context(patch.object(inside.time, "monotonic", side_effect=[0, 3]))
                stack.enter_context(patch.object(inside.time, "sleep"))
                if scenario == "ok":
                    value = inside.phase(runner, stream, "fork-limit")
                    suite.checked_result(value, "fork-limit")
                    self.assertEqual(commands[-1][-1], "--cleanup")
                    self.assertFalse(work.exists())
                else:
                    with self.assertRaises(RuntimeError): inside.phase(runner, stream, "fork-limit")
                    self.assertNotIn("--cleanup", [args[-1] for args in commands])
                    self.assertTrue(work.exists())
                    if scenario == "collector_failure": self.assertIn("INGENIUM_ISOLATION_DIAGNOSTIC", output.getvalue())


if __name__ == "__main__":
    unittest.main()
