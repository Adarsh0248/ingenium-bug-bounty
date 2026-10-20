import base64
import contextlib
import copy
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


suite = load("verdict_http_tests", ROOT / "verdict-http.py")
fixtures = load("verdict_http_fixtures", ROOT / "test/test_verdicts.py")
inside = load("bound_verdict_runtime_tests", ROOT / "verdict-transport/runtime.py")
SHA = "a" * 64
BINDING = {"attempt_id": "8cf9f0bd-8374-4d81-bbf5-405d0df22442", "host_epoch": "53cb2405-35a8-4f72-909a-7fb9aab466e3", "manifest_sha256": SHA, "payload_sha256": SHA}
OWNER = "f552aef0-df03-4d5d-9586-ac86d783b224"
TOKEN = "f552aef0-df03-4d5d-9586-ac86d783b225"
FROZEN = {"image_id": "sha256:" + SHA, "observed": {"fixed": "versions"}}


def data_for(case):
    value = {"fingerprints": {key: SHA for key in ("stream", "output", "verdict", "bound")}}
    item = {"payload": suite.payload(case), "binding": dict(BINDING)}
    row = {"token": TOKEN, "submission_id": 16, "envelope": {"fixed": "outbox"}}
    job = suite.job_for(case, item, row, OWNER, value)
    result = {"job": job, "bundle_sha256": SHA, "evidence": fixtures.evidence(case),
              "result": {"verdict": case["expected"], "recovery_required": case["expected"] is None}}
    return value, item, row, job, result


class BoundVerdictTests(unittest.TestCase):
    def test_bound_runtime_executes_only_the_fingerprinted_fixed_case_and_never_runs_after_compile_failure(self):
        for mode in ("compile-error", "pass"):
            case = next(case for case in suite.cases.CASES if case["mode"] == mode)
            value, _, _, job, result = data_for(case)
            raw = suite.transport.canonical(job)
            runner = SimpleNamespace(regular=Mock(return_value=raw), load_lock=Mock(return_value={"profiles": {case["profile"]: {
                "compile": ["/fixed/compiler"], "artifact": "main", "source": "main.cpp"}}}), versions=Mock(return_value=FROZEN["observed"]))
            verdict = SimpleNamespace(cases=suite.cases, rules=suite.rules, bundle=SimpleNamespace(fingerprint=lambda: SHA),
                                      phase=Mock(side_effect=[result["evidence"]["compile"], result["evidence"]["run"]]))
            def load_runtime(name, path):
                if name == "bound_profile_runtime": return runner
                if name == "bound_output_capture": return suite.capture
                if name == "bound_output_collector": return SimpleNamespace()
                return SimpleNamespace(fingerprint=lambda: SHA)
            def read_text(path, *args, **kwargs):
                if path.as_posix().endswith("attr/current"): return "ingenium-isolate-smoke-v1 (enforce)"
                if path.name == "status": return "NoNewPrivs:\t1\nSeccomp:\t2\n"
                return "1:memory:/ingenium-cg-run.abc123/" + SHA + "\n2:cpu,cpuacct:/ingenium-cg-run.abc123/" + SHA + "\n3:pids:/ingenium-cg-run.abc123/" + SHA + "\n"
            with self.subTest(mode=mode), contextlib.ExitStack() as stack:
                stack.enter_context(patch.object(inside, "verdict", verdict))
                stack.enter_context(patch.object(inside, "load", side_effect=load_runtime))
                stack.enter_context(patch.object(inside.sys, "argv", ["runtime.py", suite.previous.digest(raw)]))
                stack.enter_context(patch.object(inside.os, "geteuid", return_value=0, create=True))
                stack.enter_context(patch.dict(inside.os.environ, {"INGENIUM_CGROUP_PARENT": "/ingenium-cg-run.abc123"}))
                stack.enter_context(patch.object(inside.Path, "read_text", autospec=True, side_effect=read_text))
                stack.enter_context(patch.object(inside.Path, "stat", return_value=SimpleNamespace(st_uid=0, st_mode=0o100600)))
                stack.enter_context(patch.object(inside.bundle, "fingerprint", return_value=SHA))
                output = stack.enter_context(contextlib.redirect_stdout(io.StringIO()))
                inside.main()
                self.assertEqual(verdict.phase.call_count, 1 if mode == "compile-error" else 2)
                records = [line.removeprefix("INGENIUM_BOUND_VERDICT_RESULT ") for line in output.getvalue().splitlines() if line.startswith("INGENIUM_BOUND_VERDICT_RESULT ")]
                self.assertEqual(json.loads(records[0]), result)
                runner.regular.return_value = raw + b" "
                verdict.phase.reset_mock()
                with self.assertRaises(RuntimeError): inside.main()
                verdict.phase.assert_not_called()

    def test_job_inventory_sources_limits_and_module_isolation(self):
        self.assertEqual(len(suite.bundle.fingerprint()), 64)
        self.assertEqual(suite.guard.TABLE, suite.TABLE)
        self.assertEqual(suite.previous.guard.TABLE, "ingenium_transport_v1.attempts")
        self.assertEqual(suite.transport.flow.PATH, suite.PATH)
        self.assertEqual(suite.previous.transport.flow.PATH, "/ingenium-transport/attempts")
        for case in suite.cases.CASES:
            value, item, row, job, result = data_for(case)
            self.assertEqual(base64.b64decode(item["payload"]["source_code"]), suite.cases.source(case))
            self.assertEqual(base64.b64decode(item["payload"]["stdin"]), (case["mode"] + "\n").encode())
            self.assertFalse(item["payload"]["enable_network"])
            self.assertEqual(suite.bundle.checked_job(job, suite.cases.CASES), case)
            self.assertEqual(suite.checked_result(result, job, value), result["result"])
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for name in suite.bundle.FILES: (root / name).write_bytes((ROOT / "verdict-transport" / name).read_bytes())
            with patch.object(suite.bundle, "HERE", root):
                self.assertEqual(len(suite.bundle.fingerprint()), 64)
                (root / "extra").write_bytes(b"extra")
                with self.assertRaises(RuntimeError): suite.bundle.fingerprint()

    def test_wrong_job_binding_owner_profile_source_or_result_cannot_be_relabelled(self):
        case = suite.cases.CASES[0]
        for scenario in ("case", "owner", "provider", "submission", "bool", "binding", "hash", "extra", "result", "source", "bundle"):
            value, _, _, job, result = data_for(case)
            if scenario == "case": job["case_id"] = "unknown"
            if scenario == "owner": job["owner_id"] = "not-uuid"
            if scenario == "provider": job["provider_token"] = TOKEN.upper()
            if scenario == "submission": job["submission_id"] = 0
            if scenario == "bool": job["submission_id"] = True
            if scenario == "binding": job["binding"]["extra"] = "field"
            if scenario == "hash": job["output_sha256"] = "unreviewed"
            if scenario == "extra": result["extra"] = True
            if scenario == "result": result["result"]["verdict"] = "PASSED"
            if scenario == "source": result["evidence"]["source_sha256"] = "b" * 64
            if scenario == "bundle": result["bundle_sha256"] = "b" * 64
            with self.subTest(scenario=scenario), self.assertRaises((RuntimeError, ValueError)):
                suite.checked_result(result, job, value)

    def test_legacy_status_describes_execution_and_never_substitutes_for_verdict(self):
        expected = {"compile-error": 6, "pass": 3, "wrong": 3, "nonzero": 11, "signal": 7, "cpu": 5, "wall": 5, "memory": 12, "overflow": 3, "syntax": 11}
        for case in suite.cases.CASES:
            result = data_for(case)[-1]
            fields = suite.projection(result)
            with self.subTest(case=case["id"]):
                if case["expected"] is None: self.assertIsNone(fields)
                else:
                    self.assertEqual(fields["status_id"], expected[case["mode"]])
                    self.assertEqual(fields["compile_output"] is None, case["profile"] in ("python", "javascript"))
                    self.assertEqual(fields["stdout"] is None, case["mode"] == "compile-error")

    def test_result_commit_is_atomic_and_held_result_never_finishes_provider_or_releases_permit(self):
        for case in suite.cases.CASES:
            value, item, row, _, result = data_for(case)
            raw = suite.transport.canonical(result)
            with self.subTest(case=case["id"]), patch.object(suite.lab, "db", return_value={"committed": True}) as db:
                suite.seal_result(case, item, row, OWNER, result, raw, value)
                sql = db.call_args.args[0]
                self.assertTrue(db.call_args.kwargs["write"])
                self.assertIn("DO $seal$ BEGIN", sql)
                self.assertIn("count(*) FROM submissions) = 33", sql)
                self.assertIn("AND owner_id = '" + OWNER, sql)
                self.assertIn("held_evidence_json IS NULL", sql)
                if case["expected"] is None:
                    self.assertIn("held_evidence_json =", sql)
                    self.assertIn("PERFORM id FROM submissions WHERE status_id = 2", sql)
                    self.assertNotIn("UPDATE submissions", sql)
                    self.assertNotIn("state = 'SEALED'", sql)
                else:
                    self.assertIn("UPDATE submissions SET finished_at", sql)
                    self.assertIn("state = 'SEALED'", sql)
        value, item, row, _, result = data_for(suite.cases.CASES[0])
        for raw in (b"changed", suite.transport.canonical(result) + b" "):
            with patch.object(suite.lab, "db") as db, self.assertRaises(RuntimeError):
                suite.seal_result(suite.cases.CASES[0], item, row, OWNER, result, raw, value)
            db.assert_not_called()

    def test_parse_log_binds_one_result_versions_and_physical_cleanup(self):
        case = suite.cases.CASES[0]
        value, _, _, job, result = data_for(case)
        good = ["INGENIUM_BOUND_VERDICT_VERSIONS " + json.dumps(FROZEN["observed"]), "INGENIUM_BOUND_VERDICT_RESULT " + json.dumps(result),
                "PASS: bound verdict completed with protected bytes, cause, exact target identity and normal cleanup", "PASS: host test groups and temporary files removed"]
        for scenario in ("ok", "duplicate", "missing", "version", "cleanup", "failure", "swapped"):
            lines, expected_job = list(good), copy.deepcopy(job)
            if scenario == "duplicate": lines.append(good[1])
            if scenario == "missing": lines.pop(1)
            if scenario == "version": lines[0] = "INGENIUM_BOUND_VERDICT_VERSIONS {}"
            if scenario == "cleanup": lines.pop()
            if scenario == "failure": lines.append("FAIL: uncertain")
            if scenario == "swapped": expected_job["provider_token"] = OWNER
            with self.subTest(scenario=scenario), patch.object(suite.transport, "private", return_value="\n".join(lines).encode()), patch.object(suite.previous.seal, "physical_cleanup") as clean:
                if scenario == "ok": self.assertEqual(suite.parse_execution(Path("unused"), expected_job, value, FROZEN), result)
                else:
                    with self.assertRaises(RuntimeError): suite.parse_execution(Path("unused"), expected_job, value, FROZEN)
                self.assertEqual(clean.call_count, int(scenario == "ok"))

    def test_duplicate_worker_does_not_allocate_or_launch_and_bad_delivery_never_claims(self):
        case = suite.cases.CASES[0]
        value, item, row, _, _ = data_for(case)
        value["jobs"] = {case["id"]: item}
        for scenario in ("duplicate", "bad_delivery", "oversized"):
            body = b"x" * 8193 if scenario == "oversized" else json.dumps(row["envelope"]).encode() + b"\n"
            with self.subTest(scenario=scenario), contextlib.ExitStack() as stack:
                stack.enter_context(patch.object(suite, "context", return_value=(value, FROZEN)))
                stack.enter_context(patch.object(suite.transport.flow, "row_for", return_value=row))
                stack.enter_context(patch.object(suite.sys, "stdin", buffer=io.BytesIO(body)))
                stack.enter_context(patch.object(suite.lab, "validate_message", side_effect=RuntimeError("bad envelope") if scenario == "bad_delivery" else None))
                claim = stack.enter_context(patch.object(suite.guard, "claim", return_value=False))
                journal = stack.enter_context(patch.object(suite.lab, "Journal"))
                launch = stack.enter_context(patch.object(suite.previous.streams.profiles, "logged"))
                stack.enter_context(contextlib.redirect_stdout(io.StringIO()))
                if scenario == "duplicate": self.assertEqual(suite.worker(case["id"]), 0)
                else:
                    with self.assertRaises(RuntimeError): suite.worker(case["id"])
                    claim.assert_not_called()
                journal.assert_not_called()
                launch.assert_not_called()

    def test_two_deliveries_start_two_workers_but_require_exactly_one_lost_reply(self):
        case = suite.cases.CASES[0]
        _, item, row, _, _ = data_for(case)
        for codes in ((75, 0), (0, 75), (75, 75), (0, 0), (1, 0)):
            workers = []
            for code in codes:
                process = Mock()
                process.wait.return_value = code
                process.stdout.read.return_value = b'{"launched":false}' if code == 0 else b""
                workers.append(process)
            message = suite.transport.canonical(row["envelope"])
            with self.subTest(codes=codes), patch.object(suite.lab, "db", return_value=row["envelope"]), \
                    patch.object(suite.lab, "redis", side_effect=[b"queued-two", message, b"claimed", message, b"claimed"]), \
                    patch.object(suite.lab, "validate_message"), patch.object(suite.subprocess, "Popen", side_effect=workers) as launch, \
                    patch.object(suite.guard, "private_json"), patch.object(suite.time, "monotonic", return_value=1):
                if sorted(codes) == [0, 75]: suite.dispatch(case, item, row, Mock())
                else:
                    with self.assertRaises(RuntimeError): suite.dispatch(case, item, row, Mock())
                self.assertEqual(launch.call_count, 2)
                self.assertIn("verdict-http.py", launch.call_args.args[0][2])

    def test_http_recovery_matches_every_case_and_refuses_forged_evidence_or_provider_verdict(self):
        for case in suite.cases.CASES:
            for scenario in ("ok", "wire", "provider", "reservation"):
                value, item, row, job, result = data_for(case)
                raw = suite.transport.canonical(result)
                held = case["expected"] is None
                state = {"state": "STARTED" if held else "SEALED", "permit_count": 1, "reserved": held, "provider_id": TOKEN,
                         "owner_id": OWNER, "evidence_sha256": None if held else suite.previous.digest(raw)}
                reply = {"token": TOKEN, "submission_id": 16, "state": state["state"], "permit_count": 1, "reserved": held,
                         "recovery_required": held, "evidence_sha256": suite.previous.digest(raw), "evidence": copy.deepcopy(result)}
                projected = suite.projection(result)
                provider = {"token": TOKEN, "message": None, **{key: None for key in ("stdout", "stderr", "compile_output", "exit_code", "exit_signal", "time", "memory", "wall_time")}}
                provider["status"] = {"id": 2, "description": "Processing"}
                if not held:
                    provider.update({key: value for key, value in projected.items() if key != "status_id"})
                    provider["status"] = {"id": projected["status_id"], "description": "fixed execution status"}
                if scenario == "wire": reply["evidence"]["result"]["verdict"] = "forged"
                if scenario == "provider": provider["status"]["id"] = 99
                if scenario == "reservation": reply["reserved"] = not held
                responses = [(200, reply), (401, {}), (200, provider), (200, reply)]
                with self.subTest(case=case["id"], scenario=scenario), contextlib.ExitStack() as stack:
                    stack.enter_context(patch.object(suite.transport, "private", return_value=raw))
                    stack.enter_context(patch.object(suite, "parse_execution", return_value=result))
                    stack.enter_context(patch.object(suite.guard, "observe", return_value=state))
                    stack.enter_context(patch.object(suite.guard, "claim", return_value=False))
                    stack.enter_context(patch.object(suite.guard, "forbidden_change"))
                    stack.enter_context(patch.object(suite.lab, "private_ip", return_value="private"))
                    stack.enter_context(patch.object(suite.transport, "request", side_effect=responses))
                    stack.enter_context(contextlib.redirect_stdout(io.StringIO()))
                    if scenario == "ok": self.assertEqual(suite.verify_http("private", "synthetic", case, item, row, value, FROZEN)["verdict"], case["expected"])
                    else:
                        with self.assertRaises(RuntimeError): suite.verify_http("private", "synthetic", case, item, row, value, FROZEN)

    def test_wrong_host_mode_or_existing_checkpoint_cannot_mutate(self):
        for scenario in ("host", "mode", "root", "existing"):
            with self.subTest(scenario=scenario), contextlib.ExitStack() as stack:
                for target, name, value in ((suite.platform, "system", "Linux"), (suite.socket, "gethostname", "wrong" if scenario == "host" else "ingenium-judge-spike-01"),
                    (suite.os, "geteuid", 1 if scenario == "root" else 0), (suite.os.path, "lexists", True)):
                    stack.enter_context(patch.object(target, name, return_value=value, create=True))
                for target, name in ((suite.os, "umask"), (suite.signal, "signal"), (suite.previous.streams.active.tree, "directory")):
                    stack.enter_context(patch.object(target, name))
                prior = stack.enter_context(patch.object(suite, "completed_verdicts"))
                db = stack.enter_context(patch.object(suite.lab, "db"))
                stack.enter_context(contextlib.redirect_stderr(io.StringIO()))
                self.assertEqual(suite.main(["--worker", "unknown"] if scenario == "mode" else []), 1)
                prior.assert_not_called()
                db.assert_not_called()

    def test_completed_checkpoint_is_read_only_and_checks_legacy_sources_seal_and_saved_results(self):
        past = {"earlier": {"earlier": {"files": {"context.json": SHA}}, "isolation": {"journal.jsonl": SHA}}, "output": {"journal.jsonl": SHA}}
        policy = (ROOT / "namespace-smoke.apparmor").read_bytes()
        for scenario in ("ok", "unfinished", "seal", "prior", "launcher", "source", "results"):
            context = {"event": "PREPARED", "preserved": past, "host_epoch": "old-boot", "image_id": FROZEN["image_id"], "manifest_sha256": SHA,
                "bundle_sha256": SHA, "stream_sha256": SHA, "output_sha256": SHA,
                "helpers_sha256": {"verdicts.py": suite.LEGACY_ENTRY, "cgroup-smoke.sh": suite.LEGACY_LAUNCHER, "namespace-smoke.apparmor": suite.previous.digest(policy)}}
            saved = {"scope": "fixed-protected-verdicts-v1", **{key: value for key, value in context.items() if key != "event"}, "results": [], "log_sha256": suite.previous.digest(b"saved-log")}
            evidence = suite.transport.canonical(saved)
            if scenario == "launcher": context["helpers_sha256"]["cgroup-smoke.sh"] = "changed"
            rows = [context, {"event": "VERDICTS_STARTED"}, {"event": "VERDICTS_FINISHED", "log_sha256": suite.previous.digest(b"saved-log")},
                    {"event": "COMPLETE", "cases": 18, "new_provider_records": 0, "preserved": {} if scenario == "prior" else past,
                     "evidence_sha256": "changed" if scenario == "seal" else suite.previous.digest(evidence)}]
            if scenario == "unfinished": rows.pop()
            files = {"journal.jsonl": b"\n".join(map(suite.transport.canonical, rows)), "evidence.json": evidence, "verdicts.log": b"saved-log"}
            def private(path, limit): return files[path.name] if path.parent == suite.previous.DIRECTORY else b"old-file"
            def regular(path, limit): return b"changed" if scenario == "source" and path.name == "verdicts.py" else path.read_bytes()
            with self.subTest(scenario=scenario), contextlib.ExitStack() as stack:
                stack.enter_context(patch.object(suite.previous, "completed_output", return_value=past))
                stack.enter_context(patch.object(suite.transport, "private", side_effect=private))
                stack.enter_context(patch.object(suite.runtime, "regular", side_effect=regular))
                stack.enter_context(patch.object(suite.guard, "manifest", return_value=(FROZEN, SHA)))
                for target in (suite.previous.bundle, suite.previous.streams.bundle, suite.previous.output.bundle):
                    stack.enter_context(patch.object(target, "fingerprint", return_value=SHA))
                stack.enter_context(patch.object(suite.previous, "parse_log", return_value=["changed"] if scenario == "results" else []))
                launch = stack.enter_context(patch.object(suite.previous.streams.profiles, "logged"))
                db = stack.enter_context(patch.object(suite.lab, "db"))
                if scenario == "ok": self.assertIn("verdicts-v1/evidence.json", suite.completed_verdicts())
                else:
                    with self.assertRaises(RuntimeError): suite.completed_verdicts()
                launch.assert_not_called()
                db.assert_not_called()

    def test_context_freezes_all_eighteen_payloads_helpers_bundles_boot_and_bindings(self):
        for scenario in ("ok", "fingerprints", "payload", "boot", "manifest", "duplicate", "binding", "extra"):
            value = {"scope": suite.SCOPE, "manifest_sha256": SHA, "image_id": FROZEN["image_id"], "fingerprints": {"fixed": SHA}, "preserved": {}, "jobs": {}}
            for index, case in enumerate(suite.cases.CASES):
                data = suite.payload(case)
                binding = {**BINDING, "attempt_id": f"8cf9f0bd-8374-4d81-bbf5-{index:012d}", "payload_sha256": suite.payload_hash(case, data, value)}
                value["jobs"][case["id"]] = {"payload": data, "binding": binding}
            first = value["jobs"][suite.cases.CASES[0]["id"]]
            if scenario == "fingerprints": value["fingerprints"] = {}
            if scenario == "payload": first["payload"]["enable_network"] = True
            if scenario == "boot": first["binding"]["host_epoch"] = OWNER
            if scenario == "manifest": value["manifest_sha256"] = "b" * 64
            if scenario == "duplicate": value["jobs"][suite.cases.CASES[1]["id"]]["binding"]["attempt_id"] = first["binding"]["attempt_id"]
            if scenario == "binding": first["binding"]["payload_sha256"] = "b" * 64
            if scenario == "extra": value["extra"] = True
            raw = suite.transport.canonical(value)
            self.assertLess(len(raw), suite.transport.MAX_WIRE)
            with self.subTest(scenario=scenario), patch.object(suite.transport, "private", return_value=raw), patch.object(suite.guard, "manifest", return_value=(FROZEN, SHA)), \
                    patch.object(suite, "fingerprints", return_value={"fixed": SHA}), patch.object(suite.Path, "read_text", return_value=BINDING["host_epoch"]):
                if scenario == "ok": self.assertEqual(suite.context(), (value, FROZEN))
                else:
                    with self.assertRaises(RuntimeError): suite.context()

    def test_prior_snapshot_excludes_only_owned_new_rows_and_rejects_unsafe_paths(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "profiles-v2").mkdir()
            files = {}
            for index in range(10):
                name = f"profiles-v2/saved-{index}.json"
                (root / name).write_bytes(b"old-file")
                files[name] = suite.previous.digest(b"old-file")
            for owned in (False, True):
                db = Mock(side_effect=[{"count": 15, "complete": True, "sha256": SHA}, *[{"count": 1, "sha256": SHA}] * 4])
                with patch.object(suite.lab, "RUNTIME", root), patch.object(suite.lab, "db", db), patch.object(suite.transport, "private", side_effect=lambda path, limit: path.read_bytes()):
                    self.assertEqual(suite.snapshot(files, owned)["files"], files)
                    self.assertEqual("WHERE NOT EXISTS" in db.call_args_list[0].args[0], owned)
                    if owned: self.assertIn(suite.TABLE, db.call_args_list[0].args[0])
            for name in ("../judge0.conf", "/opt/private", "unknown/journal.jsonl", "profiles-v2/../../judge0.conf", "profiles-v2\\escape"):
                bad = {**files, name: SHA}
                with patch.object(suite.lab, "RUNTIME", root), patch.object(suite.lab, "db") as db, self.assertRaises(RuntimeError): suite.snapshot(bad)
                db.assert_not_called()

    def test_admission_reconciles_eighteen_unique_tokens_and_rejects_inconsistent_lookup(self):
        for scenario in ("ok", "bool_permit", "released", "invented_evidence", "wrong_token"):
            value = {"jobs": {}}
            rows, requests = [], []
            for index, case in enumerate(suite.cases.CASES):
                _, item, row, _, _ = data_for(case)
                row["token"] = f"8cf9f0bd-8374-4d81-bbf5-{index:012d}"
                row["submission_id"] = index + 16
                value["jobs"][case["id"]] = item
                resolved = {"token": row["token"], "submission_id": row["submission_id"], "state": "PREPARED", "permit_count": 0, "reserved": True,
                            "recovery_required": False, "evidence_sha256": None}
                if index == 0:
                    if scenario == "bool_permit": resolved["permit_count"] = False
                    if scenario == "released": resolved["reserved"] = False
                    if scenario == "invented_evidence": resolved["evidence_sha256"] = SHA
                    if scenario == "wrong_token": resolved["token"] = OWNER
                requests.extend([(401, {}), (404, {}), (409, {}), (200, resolved), (201, resolved), (409, {})])
                rows.append(row)
            with self.subTest(scenario=scenario), patch.object(suite.transport, "request", side_effect=requests), \
                    patch.object(suite.transport.flow, "discard_token_reply") as discard, patch.object(suite.transport.flow, "row_for", side_effect=rows), \
                    patch.object(suite.lab, "db", return_value={"count": 33}), contextlib.redirect_stdout(io.StringIO()):
                if scenario == "ok": self.assertEqual(len(suite.admit("private", "synthetic", value, Mock())), 18)
                else:
                    with self.assertRaises(RuntimeError): suite.admit("private", "synthetic", value, Mock())
                self.assertEqual(discard.call_count, 18 if scenario == "ok" else 1)

    def test_full_controller_uses_fresh_context_and_never_seals_after_changed_prior_state(self):
        for scenario in ("ok", "prior_changed", "dispatch_failed"):
            journal, files = Mock(), {"profiles-v2/saved.json": SHA}
            before = {"files": files, "providers": {"count": 15}, "tables": {}}
            def db(sql, write=False):
                if "'absent'" in sql: return {"absent": True}
                if "CREATE SCHEMA" in sql: return {"created": True}
                return {"count": 18, "sealed": 17, "held": 1}
            with self.subTest(scenario=scenario), contextlib.ExitStack() as stack:
                patches = [patch.object(suite.platform, "system", return_value="Linux"), patch.object(suite.socket, "gethostname", return_value="ingenium-judge-spike-01"),
                    patch.object(suite.os, "geteuid", return_value=0, create=True), patch.object(suite.os, "umask"), patch.object(suite.signal, "signal"),
                    patch.object(suite.os.path, "lexists", return_value=False), patch.object(suite.os, "chown", create=True), patch.object(suite.os, "chmod"),
                    patch.object(suite.previous.streams.active.tree, "directory"), patch.object(suite.lab.queue, "check_services"), patch.object(suite, "completed_verdicts", return_value=files),
                    patch.object(suite, "snapshot", side_effect=[before, {}] if scenario == "prior_changed" else None, return_value=before),
                    patch.object(suite.lab, "db", side_effect=db), patch.object(suite.guard, "manifest", return_value=(FROZEN, SHA)),
                    patch.object(suite.transport.failure, "private_file", return_value=b"private-config"), patch.object(suite.lab, "prepare_config", return_value=(b"private-config", "synthetic-token")),
                    patch.object(suite.lab.api, "check_api"), patch.object(suite.lab, "private_ip", return_value="private"),
                    patch.object(suite.runtime, "regular", side_effect=lambda path, limit: path.read_bytes()), patch.object(suite, "fingerprints", return_value={"fixed": SHA}),
                    patch.object(suite.Path, "read_text", return_value=BINDING["host_epoch"]), patch.object(suite.lab, "Journal", return_value=journal),
                    patch.object(suite, "context"), patch.object(suite.lab, "create_creator", return_value=("container", "nonce")), patch.object(suite.lab, "stop_creator"),
                    patch.object(suite.lab, "wait_creator"), patch.object(suite.lab, "redis", return_value=b"empty"),
                    patch.object(suite, "verify_http", return_value={"verified": True}), contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO())]
                for item in patches: stack.enter_context(item)
                stack.enter_context(patch.object(suite.lab, "run", side_effect=lambda *args, **kwargs: b"true|bridge" if "network" in args else b"PASS: fixed verdict admission stub checks passed" if "ruby" in args else b""))
                rows = {case["id"]: {"token": TOKEN} for case in suite.cases.CASES}
                stack.enter_context(patch.object(suite, "admit", return_value=rows))
                dispatch = stack.enter_context(patch.object(suite, "dispatch", side_effect=RuntimeError("failed") if scenario == "dispatch_failed" else None))
                save = stack.enter_context(patch.object(suite.transport, "save", return_value=SHA))
                self.assertEqual(suite.main([]), 0 if scenario == "ok" else 1)
                self.assertEqual(dispatch.call_count, 1 if scenario == "dispatch_failed" else 18)
                evidence_saves = [call for call in save.call_args_list if call.args[0].name == "evidence.json"]
                self.assertEqual(len(evidence_saves), int(scenario == "ok"))


if __name__ == "__main__": unittest.main()
