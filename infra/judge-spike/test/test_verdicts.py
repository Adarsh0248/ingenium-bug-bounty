import base64
import contextlib
import importlib.util
import io
import json
from pathlib import Path
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


suite = load("verdict_tests", ROOT / "verdicts.py")
inside = load("verdict_runtime_tests", ROOT / "verdicts/runtime.py")
capture, rules, cases = suite.transport.capture, suite.rules, suite.cases
SHA = "a" * 64
FROZEN = {"image_id": "sha256:" + SHA, "observed": {"fixed": "versions"}}


def encode(value): return json.dumps(value, separators=(",", ":")).encode("ascii")


def phase(case, compiling=False):
    limits = {"cpu_ms": 15000, "wall_ms": 30000, "memory_bytes": 1073741824} if compiling else {key: case[key] for key in ("cpu_ms", "wall_ms", "memory_bytes")}
    value = {"rc": 0, "cpu_ns": 10000000, "peak_bytes": 1048576, "ram_hits": 0, "combined_hits": 0,
             "limits": limits, "identity_checked": True, "command_checked": True, "cleanup": True}
    meta = {"time": "0.010", "time-wall": "0.150", "max-rss": "1024", "csw-voluntary": "1", "csw-forced": "2", "cg-mem": "1024", "exitcode": "0"}
    payload = {"compiler": b""} if compiling else {"stdout": b"12\n", "stderr": b""}
    mode = case["mode"]
    if compiling and mode == "compile-error":
        meta.update(status="RE", exitcode="1", message="Exited with error status 1")
        value["rc"] = 1
        payload["compiler"] = b"INGENIUM_EXPECTED_COMPILE_ERROR " + b"x" * 70000
    if not compiling:
        if mode == "wrong": payload["stdout"] = b"13\n"
        if mode in ("nonzero", "syntax"):
            code = "1" if mode == "syntax" else "7"
            value["rc"] = 1
            meta.update(status="RE", exitcode=code, message="Exited with error status " + code)
            payload = {"stdout": b"", "stderr": b"fixed error\n"}
        if mode in ("signal", "ambiguous", "memory"):
            value["rc"] = 1
            meta.pop("exitcode")
            signal = "11" if mode == "signal" else "9"
            meta.update(status="SG", exitsig=signal, message="Caught fatal signal " + signal)
            if mode == "memory":
                meta["cg-oom-killed"] = "1"
                value["combined_hits"] = 5
        if mode in ("cpu", "wall"):
            value["rc"] = 1
            meta.pop("exitcode")
            meta.update(status="TO", killed="1", message="Time limit exceeded" + (" (wall clock)" if mode == "wall" else ""))
            if mode == "cpu":
                meta["time"] = "0.250"
                value["cpu_ns"] = 250000000
            else: meta["time-wall"] = "0.350"
        if mode == "overflow": payload["stdout"] = b"X" * 2097152
    value["meta_b64"] = base64.b64encode(b"".join(f"{key}:{item}\n".encode() for key, item in meta.items())).decode()
    value["captures"] = {kind: suite.streams.record_for(kind, data) for kind, data in payload.items()}
    return value


def evidence(case):
    return {"case": case["id"], "profile": case["profile"], "source_sha256": suite.digest(cases.source(case)),
            "compile": phase(case, True) if case["profile"] in ("c", "cpp", "java") else None,
            "run": None if case["mode"] == "compile-error" else phase(case)}


def change_meta(value, **changes):
    meta = rules.metadata(value["meta_b64"])
    for key, item in changes.items():
        if item is None: meta.pop(key, None)
        else: meta[key] = item
    value["meta_b64"] = base64.b64encode(b"".join(f"{key}:{item}\n".encode() for key, item in meta.items())).decode()


class VerdictRulesTests(unittest.TestCase):
    def test_eighteen_fixed_sources_and_expected_verdicts(self):
        self.assertEqual(len(cases.CASES), 18)
        self.assertEqual(len({case["id"] for case in cases.CASES}), 18)
        for case in cases.CASES:
            with self.subTest(case=case["id"]):
                raw = cases.source(case)
                self.assertTrue(0 < len(raw) <= 32768)
                self.assertTrue(raw.isascii())
                self.assertEqual(rules.classify(case, evidence(case), capture, raw), {"verdict": case["expected"], "recovery_required": case["expected"] is None})

    def test_missing_forged_malformed_or_infrastructure_proof_never_becomes_a_verdict(self):
        case = next(case for case in cases.CASES if case["mode"] == "pass")
        for scenario in ("identity", "command", "cleanup", "source", "profile", "rc", "bool_rc", "cpu", "peak", "limit", "channels", "eof", "XX", "unknown", "duplicate", "invalid_b64", "interrupt", "exit", "oom"):
            value = evidence(case)
            run = value["run"]
            if scenario in ("identity", "command", "cleanup"): run[{"identity": "identity_checked", "command": "command_checked", "cleanup": "cleanup"}[scenario]] = False
            if scenario == "source": value["source_sha256"] = "changed"
            if scenario == "profile": value["profile"] = "other"
            if scenario == "rc": run["rc"] = 2
            if scenario == "bool_rc": run["rc"] = False
            if scenario == "cpu": run["cpu_ns"] = 0
            if scenario == "peak": run["peak_bytes"] = run["limits"]["memory_bytes"] + 1
            if scenario == "limit": run["limits"]["wall_ms"] += 1
            if scenario == "channels": run["captures"].pop("stderr")
            if scenario == "eof": run["captures"]["stdout"]["complete"] = False
            if scenario == "XX": change_meta(run, status="XX", message="infrastructure")
            if scenario == "unknown": change_meta(run, arbitrary="field")
            if scenario == "duplicate": run["meta_b64"] = base64.b64encode(base64.b64decode(run["meta_b64"]) + b"exitcode:0\n").decode()
            if scenario == "invalid_b64": run["meta_b64"] = "not base64"
            if scenario == "interrupt": change_meta(run, status="SG", exitsig="15", message="Interrupted", exitcode=None)
            if scenario == "exit": change_meta(run, exitcode="7")
            if scenario == "oom": change_meta(run, **{"cg-oom-killed": "1"})
            with self.subTest(scenario=scenario), self.assertRaises((RuntimeError, ValueError)):
                rules.classify(case, value, capture, cases.source(case))

    def test_limit_cause_requires_accounting_not_stderr_or_a_bare_signal(self):
        for case in cases.CASES:
            if case["mode"] not in ("cpu", "wall", "memory"): continue
            value = evidence(case)
            if case["mode"] == "cpu": value["run"]["cpu_ns"] = 1
            if case["mode"] == "wall": change_meta(value["run"], **{"time-wall": "0.010"})
            if case["mode"] == "memory": value["run"]["combined_hits"] = 0
            with self.subTest(case=case["id"]), self.assertRaises(RuntimeError): rules.classify(case, value, capture, cases.source(case))
        case = next(case for case in cases.CASES if case["mode"] == "pass")
        value = evidence(case)
        value["run"]["captures"]["stderr"] = suite.streams.record_for("stderr", b"Out of memory! Time limit exceeded!" * 4000)
        self.assertEqual(rules.classify(case, value, capture, cases.source(case))["verdict"], "PASSED")

    def test_output_memory_time_precedence_and_ambiguous_kill(self):
        case = next(case for case in cases.CASES if case["mode"] == "memory")
        value = evidence(case)
        value["run"]["captures"]["stdout"] = suite.streams.record_for("stdout", b"x" * 1048577)
        self.assertEqual(rules.classify(case, value, capture, cases.source(case))["verdict"], "OUTPUT_LIMIT_EXCEEDED")
        value["run"]["captures"]["stdout"] = suite.streams.record_for("stdout", b"")
        change_meta(value["run"], status="TO", message="Time limit exceeded (wall clock)", exitsig=None, killed="1", **{"time-wall": "10.001"})
        self.assertEqual(rules.classify(case, value, capture, cases.source(case))["verdict"], "MEMORY_LIMIT_EXCEEDED")
        for signal in ("9", "15", "25"):
            value = evidence(case)
            value["run"]["combined_hits"] = 0
            change_meta(value["run"], exitsig=signal, message="Caught fatal signal " + signal, **{"cg-oom-killed": None})
            self.assertEqual(rules.classify(case, value, capture, cases.source(case)), {"verdict": None, "recovery_required": True})

    def test_compile_failure_requires_frozen_witness_clipping_and_no_runtime(self):
        case = next(case for case in cases.CASES if case["mode"] == "compile-error")
        for scenario in ("missing_marker", "short", "executed", "limit_hit", "different_exit"):
            value = evidence(case)
            if scenario == "missing_marker": value["compile"]["captures"]["compiler"] = suite.streams.record_for("compiler", b"x" * 70000)
            if scenario == "short": value["compile"]["captures"]["compiler"] = suite.streams.record_for("compiler", b"INGENIUM_EXPECTED_COMPILE_ERROR")
            if scenario == "executed": value["run"] = phase(case)
            if scenario == "limit_hit": value["compile"]["ram_hits"] = 1
            if scenario == "different_exit": change_meta(value["compile"], exitcode="2", message="Exited with error status 2")
            with self.subTest(scenario=scenario), self.assertRaises(RuntimeError): rules.classify(case, value, capture, cases.source(case))

    def test_exact_target_not_bootstrap_must_have_all_protections_in_both_job_groups(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for name in ("memory", "cpu", "proc/42"): (root / name).mkdir(parents=True)
            status = "Uid:\t60000\t60000\t60000\t60000\nGid:\t60000\t60000\t60000\t60000\nCapEff:\t0000\nCapPrm:\t0000\nCapInh:\t0000\nCapAmb:\t0000\nNoNewPrivs:\t1\nSeccomp:\t2\n"
            runner = SimpleNamespace(MEMORY=root / "memory", CPU=root / "cpu", require=rules.require)
            for scenario in ("ok", "bootstrap", "other_group", "vanished", "root", "capability", "nnp", "fd_limit"):
                (runner.MEMORY / "tasks").write_text("42\n")
                (runner.CPU / "tasks").write_text("43\n" if scenario == "other_group" else "42\n")
                (root / "proc/42/cmdline").write_bytes(b"/usr/local/bin/python3.14\0-c\0bootstrap\0" if scenario == "bootstrap" else b"/box/main\0")
                actual = status.replace("60000", "0") if scenario == "root" else status
                if scenario == "capability": actual = actual.replace("CapEff:\t0000", "CapEff:\t0001")
                if scenario == "nnp": actual = actual.replace("NoNewPrivs:\t1", "NoNewPrivs:\t0")
                (root / "proc/42/status").write_text(actual)
                (root / "proc/42/limits").write_text("Max open files   256   " + ("257" if scenario == "fd_limit" else "256") + "   files\n")
                if scenario == "vanished": (root / "proc/42/cmdline").unlink()
                with self.subTest(scenario=scenario), patch.object(inside, "Path", side_effect=lambda value: root / "proc" if value == "/proc" else Path(value)):
                    if scenario in ("root", "capability", "nnp", "fd_limit"):
                        with self.assertRaises(RuntimeError): inside.target_seen(runner, ["/box/main"])
                    else: self.assertEqual(inside.target_seen(runner, ["/box/main"]), scenario == "ok")


class VerdictHostTests(unittest.TestCase):
    def test_phase_uses_fresh_groups_precise_limits_and_requires_normal_cleanup(self):
        case = next(case for case in cases.CASES if case["mode"] == "wall")
        for scenario in ("ok", "wrong_limit", "cleanup", "unknown_meta"):
            with self.subTest(scenario=scenario), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                runner = SimpleNamespace(WORK=root / "work", MEMORY=root / "memory", CPU=root / "cpu", ISOLATE="/usr/local/bin/isolate", require=rules.require)
                def command(args):
                    if "--init" in args:
                        (runner.WORK / "box").mkdir(parents=True)
                        runner.MEMORY.mkdir()
                        runner.CPU.mkdir()
                        for key, value in {"tasks": "", "memory.limit_in_bytes": str(case["memory_bytes"] + int(scenario == "wrong_limit")), "memory.memsw.limit_in_bytes": str(case["memory_bytes"]),
                                           "memory.max_usage_in_bytes": "1048576", "memory.failcnt": "0", "memory.memsw.failcnt": "0"}.items(): (runner.MEMORY / key).write_text(value)
                        (runner.CPU / "tasks").write_text("")
                        (runner.CPU / "cpuacct.usage").write_text("10000000")
                        return str(runner.WORK)
                    self.assertIn("--cleanup", args)
                    if scenario == "cleanup": return
                    for owned in (runner.WORK / "box", runner.WORK, runner.MEMORY, runner.CPU):
                        self.assertTrue(owned.resolve().is_relative_to(root.resolve()))
                        for path in owned.iterdir():
                            path.chmod(0o600)
                            path.unlink()
                        owned.rmdir()
                runner.command = Mock(side_effect=command)
                record = phase(case)
                if scenario == "unknown_meta": change_meta(record, status="XX")
                runner.regular = lambda path, limit: base64.b64decode(record["meta_b64"])
                collector = SimpleNamespace(capture_phase=Mock(return_value={key: record[key] for key in ("rc", "identity_checked", "captures")}))
                profile = {"source": "main.cpp", "artifact": "main", "compile": ["/fixed/g++"], "run": ["/box/main"]}
                try:
                    if scenario == "ok":
                        self.assertTrue(inside.phase(runner, collector, capture, profile, cases.source(case), record["limits"], compiling=False, mode=case["mode"])["cleanup"])
                    else:
                        with self.assertRaises(RuntimeError): inside.phase(runner, collector, capture, profile, cases.source(case), record["limits"], compiling=False, mode=case["mode"])
                        self.assertTrue(runner.WORK.exists())
                    argv = collector.capture_phase.call_args.args[1]
                    self.assertIn("--wall-time=0.300", argv)
                    self.assertIn("--cg-mem=524288", argv)
                    self.assertNotIn("--share-net", argv)
                finally:
                    if runner.WORK.exists():
                        for path in (runner.WORK / "box").iterdir(): path.chmod(0o600)

    def test_bundle_inventory_is_fixed_and_fingerprinted(self):
        self.assertEqual(len(suite.bundle.fingerprint()), 64)
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for name in suite.bundle.FILES: (root / name).write_bytes((ROOT / "verdicts" / name).read_bytes())
            with patch.object(suite.bundle, "HERE", root):
                self.assertEqual(suite.bundle.fingerprint(), suite.bundle.fingerprint())
                (root / "unexpected").write_bytes(b"extra")
                with self.assertRaises(RuntimeError): suite.bundle.fingerprint()

    def test_log_binds_all_eighteen_sources_results_versions_and_cleanup_within_report_budget(self):
        rows = [{"bundle_sha256": SHA, "evidence": evidence(case), "result": {"verdict": case["expected"], "recovery_required": case["expected"] is None}} for case in cases.CASES]
        good = [b"INGENIUM_VERDICT_VERSIONS " + encode(FROZEN["observed"]), *[b"INGENIUM_VERDICT_RESULT " + encode(row) for row in rows], suite.DONE.encode(), b"PASS: host test groups and temporary files removed"]
        self.assertLess(len(encode({"results": rows})), suite.transport.MAX_WIRE - 65536)
        for scenario in ("ok", "missing", "duplicate", "bundle", "versions", "verdict", "cleanup", "failure"):
            lines = list(good)
            if scenario == "missing": lines.pop(2)
            if scenario == "duplicate": lines.append(good[1])
            if scenario == "bundle": lines[1] = lines[1].replace(SHA.encode(), b"b" * 64)
            if scenario == "versions": lines[0] = b"INGENIUM_VERDICT_VERSIONS {}"
            if scenario == "verdict": lines[1] = lines[1].replace(b"COMPILATION_ERROR", b"PASSED")
            if scenario == "cleanup": lines.pop()
            if scenario == "failure": lines.append(b"INGENIUM_VERDICT_FAILURE {}")
            with self.subTest(scenario=scenario), patch.object(suite.transport, "private", return_value=b"\n".join(lines)), patch.object(suite.seal, "physical_cleanup") as clean, contextlib.redirect_stdout(io.StringIO()):
                if scenario == "ok": self.assertEqual(suite.parse_log(Path("unused"), FROZEN, SHA), rows)
                else:
                    with self.assertRaises(RuntimeError): suite.parse_log(Path("unused"), FROZEN, SHA)
                self.assertEqual(clean.call_count, int(scenario == "ok"))

    def test_completed_output_is_read_only_and_pinned_to_legacy_execution_not_new_collector(self):
        before = {"fifteen": "unchanged"}
        policy = (ROOT / "namespace-smoke.apparmor").read_bytes()
        helpers = {"output.py": suite.seal.OLD_ENTRY, "cgroup-smoke.sh": suite.LEGACY_LAUNCHER, "namespace-smoke.apparmor": suite.digest(policy)}
        for scenario in ("ok", "incomplete", "seal", "prior", "source", "legacy", "results"):
            old = {"event": "PREPARED", "preserved": before, "host_epoch": "old-boot", "image_id": FROZEN["image_id"], "manifest_sha256": SHA,
                   "bundle_sha256": suite.LEGACY_OUTPUT, "stream_sha256": SHA, "helpers_sha256": helpers}
            if scenario == "legacy": old["bundle_sha256"] = "changed"
            if scenario == "prior": old["preserved"] = {}
            log = b"completed-output-log"
            original = b"\n".join(encode(row) for row in (old, {"event": "OUTPUT_STARTED"}, {"event": "OUTPUT_FINISHED", "log_sha256": suite.digest(log)}))
            originals = {"journal.jsonl": suite.digest(original), "output.log": suite.digest(log)}
            saved = {"scope": "fixed-protected-output-v1", **{key: old[key] for key in old if key != "event"}, "results": ["saved"], "log_sha256": suite.digest(log)}
            raw = encode(saved)
            repair = [dict(event="VERIFIED_COMPLETED_EXECUTION", original_sha256=originals, helpers_sha256={**helpers, "output.py": suite.seal.PATCHED_ENTRY, "seal-output.py": suite.SEAL_SOURCE}, preserved=before, host_epoch="old-boot"),
                      dict(event="EVIDENCE_SAVED", evidence_sha256=suite.digest(raw)), dict(event="COMPLETE", evidence_sha256=suite.digest(raw), original_sha256=originals, preserved=before, cases=53, new_provider_records=0, new_sandbox_launches=0)]
            if scenario == "incomplete": repair[-1]["event"] = "NOT_COMPLETE"
            if scenario == "seal": repair[-1]["evidence_sha256"] = "changed"
            files = {"journal.jsonl": original, "output.log": log, "seal-fix-v1/journal.jsonl": b"\n".join(map(encode, repair)), "seal-fix-v1/evidence.json": raw}
            def regular(path, limit): return b"changed" if scenario == "source" and path.name == "output.py" else path.read_bytes()
            with self.subTest(scenario=scenario), contextlib.ExitStack() as stack:
                stack.enter_context(patch.object(suite.output, "previous", return_value=before))
                stack.enter_context(patch.object(suite.transport, "private", side_effect=lambda path, limit: files[path.relative_to(suite.output.DIRECTORY).as_posix()]))
                stack.enter_context(patch.object(suite.transport.runtime, "regular", side_effect=regular))
                stack.enter_context(patch.object(suite.guard, "manifest", return_value=(FROZEN, SHA)))
                stack.enter_context(patch.object(suite.streams.bundle, "fingerprint", return_value=SHA))
                stack.enter_context(patch.object(suite.output.bundle, "fingerprint", side_effect=AssertionError("Do not compare the new collector with the old seal")))
                stack.enter_context(patch.object(suite.output, "parse_log", return_value=["changed"] if scenario == "results" else ["saved"]))
                clean = stack.enter_context(patch.object(suite.seal, "physical_cleanup"))
                launch = stack.enter_context(patch.object(suite.streams.profiles, "logged"))
                if scenario == "ok": self.assertEqual(suite.completed_output()["earlier"], before)
                else:
                    with self.assertRaises(RuntimeError): suite.completed_output()
                launch.assert_not_called()
                self.assertEqual(clean.call_count, int(scenario == "ok"))

    def test_wrong_host_arguments_or_existing_checkpoint_never_launches(self):
        for scenario in ("host", "args", "root", "existing"):
            with self.subTest(scenario=scenario), contextlib.ExitStack() as stack:
                for target, name, value in ((suite.platform, "system", "Linux"), (suite.socket, "gethostname", "wrong" if scenario == "host" else "ingenium-judge-spike-01"),
                    (suite.os, "geteuid", 1 if scenario == "root" else 0), (suite.os.path, "lexists", True)):
                    stack.enter_context(patch.object(target, name, return_value=value, create=True))
                for target, name in ((suite.os, "umask"), (suite.signal, "signal"), (suite.streams.active.tree, "directory")):
                    stack.enter_context(patch.object(target, name))
                launch = stack.enter_context(patch.object(suite.streams.profiles, "logged"))
                previous = stack.enter_context(patch.object(suite, "completed_output"))
                stack.enter_context(contextlib.redirect_stderr(io.StringIO()))
                self.assertEqual(suite.main(["unexpected"] if scenario == "args" else []), 1)
                launch.assert_not_called()
                previous.assert_not_called()

    def test_batch_launches_once_and_seals_only_after_stable_evidence_source_and_boot(self):
        for scenario in ("ok", "launch", "parse", "old_state", "bundle", "boot", "source"):
            journal, before = Mock(), {"old-evidence": "unchanged"}
            with self.subTest(scenario=scenario), contextlib.ExitStack() as stack:
                patches = [patch.object(suite.platform, "system", return_value="Linux"),
                    patch.object(suite.socket, "gethostname", return_value="ingenium-judge-spike-01"), patch.object(suite.os, "geteuid", return_value=0, create=True),
                    patch.object(suite.os, "umask"), patch.object(suite.signal, "signal"), patch.object(suite.os.path, "lexists", return_value=False),
                    patch.object(suite.streams.active.tree, "directory"), patch.object(suite.lab.queue, "check_services"),
                    patch.object(suite, "completed_output", side_effect=[before, {}] if scenario == "old_state" else None, return_value=before),
                    patch.object(suite.guard, "manifest", return_value=(FROZEN, SHA)),
                    patch.object(suite.bundle, "fingerprint", side_effect=[SHA, "changed"] if scenario == "bundle" else None, return_value=SHA),
                    patch.object(suite.streams.bundle, "fingerprint", return_value=SHA), patch.object(suite.output.bundle, "fingerprint", return_value=SHA),
                    patch.object(suite.transport.runtime, "regular", side_effect=[b"fixed", b"fixed", b"fixed", b"changed"] if scenario == "source" else None, return_value=b"fixed"),
                    patch.object(suite.Path, "read_text", side_effect=["boot", "changed"] if scenario == "boot" else None, return_value="boot"),
                    patch.object(suite.transport, "private", return_value=b"saved-log"), patch.object(suite.transport.failure, "private_file", return_value=b"private-config"),
                    patch.object(suite.lab, "prepare_config", return_value=(None, "synthetic-token")), patch.object(suite.lab.api, "check_api"),
                    patch.object(suite.lab, "private_ip", return_value="private"), patch.object(suite.lab, "Journal", return_value=journal),
                    patch.object(suite, "parse_log", return_value=["checked"], side_effect=RuntimeError("failed proof") if scenario == "parse" else None),
                    contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO())]
                for item in patches: stack.enter_context(item)
                launch = stack.enter_context(patch.object(suite.streams.profiles, "logged", return_value=Path("private-unit-only/verdicts.log"), side_effect=RuntimeError("failed launch") if scenario == "launch" else None))
                save = stack.enter_context(patch.object(suite.transport, "save", return_value=SHA))
                self.assertEqual(suite.main([]), 0 if scenario == "ok" else 1)
                self.assertEqual(launch.call_count, 1)
                self.assertIn("--verdicts", launch.call_args.args[2])
                if scenario == "ok":
                    self.assertEqual(save.call_count, 1)
                    self.assertEqual(journal.record.call_args.args, ("COMPLETE",))
                    self.assertEqual(journal.record.call_args.kwargs["new_provider_records"], 0)
                else: save.assert_not_called()


if __name__ == "__main__": unittest.main()
