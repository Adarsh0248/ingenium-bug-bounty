import contextlib
import copy
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock, patch
import uuid


ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("transport_tests", ROOT / "transport.py")
suite = importlib.util.module_from_spec(spec)
spec.loader.exec_module(suite)
LOCK = json.loads((ROOT / "profiles/lock.json").read_text())
FROZEN = {"source_lock": LOCK, "observed": {"fixed": "versions"}, "image_id": "sha256:" + "a" * 64}
BINDING = {"attempt_id": str(uuid.uuid4()), "host_epoch": str(uuid.uuid4()), "payload_sha256": "b" * 64, "manifest_sha256": "c" * 64}
OWNER, TOKEN = str(uuid.uuid4()), str(uuid.uuid4())
BUNDLE = "d" * 64


def item(name):
    return {"binding": dict(BINDING), "payload": suite.payload(name, FROZEN)}


def phase(name, compiling=False):
    index = suite.runner.TRANSPORT[name][0]
    out, err = suite.streams.cases.output(index)
    captures = {"compiler": suite.streams.record_for("compiler", b"")} if compiling else {
        "stdout": suite.streams.record_for("stdout", out), "stderr": suite.streams.record_for("stderr", err)}
    return {"cpu_ns": 10000000, "peak_bytes": 131072, "wall_seconds": "0.1", "identity_checked": True, "cleanup": True,
            "captures": captures, "verdicts": None if compiling else {mode: suite.capture.check(captures["stdout"], suite.streams.cases.expected(index), mode) for mode in ("tokens", "exact")}}


def result(name):
    return {"job": suite.job_for(name, item(name), OWNER), "bundle_sha256": BUNDLE,
            "compile": phase(name, True) if LOCK["profiles"][name]["compile"] else None, "result": phase(name)}


def envelope():
    return {"class": "ActiveJob::QueueAdapters::ResqueAdapter::JobWrapper", "args": [
        {"job_class": "IsolateJob", "queue_name": "1.13.1", "provider_job_id": None, "priority": None,
         "arguments": [71], "executions": 0, "locale": "en", "job_id": str(uuid.uuid4())}]}


class TransportTests(unittest.TestCase):
    def test_five_fixed_payloads_pin_real_source_stdin_language_and_limits(self):
        for name, (index, number) in suite.runner.TRANSPORT.items():
            data = suite.payload(name, FROZEN)
            self.assertEqual(data["language_id"], number)
            self.assertEqual(suite.base64.b64decode(data["stdin"]), f"{index}\n".encode())
            source = ROOT / "streams/fixtures" / LOCK["profiles"][name]["source"]
            self.assertEqual(suite.base64.b64decode(data["source_code"]), source.read_bytes())
            self.assertFalse(data["enable_network"])
            self.assertEqual(data["max_processes_and_or_threads"], 64)
            self.assertEqual(data["memory_limit"], 524288)
        with self.assertRaises(RuntimeError):
            suite.payload("other", FROZEN)

    def test_bound_runtime_refuses_changed_source_case_stdin_identity_and_hash(self):
        for name in suite.runner.TRANSPORT:
            good = result(name)["job"]
            for mutation in (None, "source_sha256", "case", "stdin_b64", "owner_id", "binding", "extra", "fingerprint"):
                job = copy.deepcopy(good)
                if mutation == "case": job["case"] = (job["case"] + 1) % 10
                elif mutation == "binding": job["binding"] = {}
                elif mutation == "extra": job["extra"] = True
                elif mutation not in (None, "fingerprint"): job[mutation] = "changed"
                raw = suite.canonical(job)
                fingerprint = "0" * 64 if mutation == "fingerprint" else hashlib.sha256(raw).hexdigest()
                with self.subTest(name=name, mutation=mutation):
                    if mutation is None:
                        self.assertEqual(suite.runner.bound_job(raw, fingerprint, LOCK), (good, LOCK["profiles"][name]))
                    else:
                        with self.assertRaises(RuntimeError):
                            suite.runner.bound_job(raw, fingerprint, LOCK)

    def test_raw_evidence_checker_covers_empty_unicode_invalid_overflow_and_tokens(self):
        wanted = {"c": ("PASSED", "PASSED"), "cpp": ("PASSED", "PASSED"), "java": ("WRONG_ANSWER", "WRONG_ANSWER"),
                  "python": ("OUTPUT_LIMIT_EXCEEDED", "OUTPUT_LIMIT_EXCEEDED"), "javascript": ("PASSED", "WRONG_ANSWER")}
        for name in suite.runner.TRANSPORT:
            value = result(name)
            self.assertEqual(tuple(suite.checked_result(value, value["job"], FROZEN, BUNDLE).values()), wanted[name])
            self.assertLess(len(suite.canonical(value)), suite.MAX_WIRE)
            for mutation in ("identity", "cleanup", "digest", "eof", "bundle", "job", "counter", "verdict", "extra"):
                bad = copy.deepcopy(value)
                if mutation == "identity": bad["result"]["identity_checked"] = False
                if mutation == "cleanup": bad["result"]["cleanup"] = False
                if mutation == "digest": bad["result"]["captures"]["stdout"]["sha256"] = "0" * 64
                if mutation == "eof": bad["result"]["captures"]["stdout"]["eof"] = False
                if mutation == "counter": bad["result"]["captures"]["stdout"]["observed_bytes"] += 1
                if mutation == "bundle": bad["bundle_sha256"] = "0" * 64
                if mutation == "job": bad["job"]["owner_id"] = str(uuid.uuid4())
                if mutation == "verdict": bad["result"]["verdicts"] = {}
                if mutation == "extra": bad["extra"] = "unexpected"
                with self.subTest(name=name, mutation=mutation), self.assertRaises(RuntimeError):
                    suite.checked_result(bad, value["job"], FROZEN, BUNDLE)

    def test_provider_bytes_are_lossless_strict_bounded_and_never_null(self):
        for raw in (b"", b"\xc3\xa9\0\xff\n", b"x" * 1048577):
            record = suite.streams.record_for("stdout", raw)
            encoded = suite.base64.b64encode(raw).decode()
            suite.decode_provider(encoded + "\n", record, "stdout")
            for bad in (None, True, encoded + " ", "!", "x" * (suite.MAX_WIRE + 1)):
                with self.subTest(size=len(raw), bad_type=type(bad).__name__), self.assertRaises(RuntimeError):
                    suite.decode_provider(bad, record, "stdout")

    def test_http_bounds_body_rejects_nonprivate_addresses_and_closes_on_errors(self):
        for raw in (b'{"ok":true}', b"x" * (suite.MAX_WIRE + 1), b"{", b'{"same":1,"same":2}'):
            connection = Mock()
            connection.getresponse.return_value.status = 200
            connection.getresponse.return_value.read.return_value = raw
            with patch.object(suite.http.client, "HTTPConnection", return_value=connection):
                if raw == b'{"ok":true}': self.assertEqual(suite.request("172.20.0.9", "GET", "/fixed", "secret"), (200, {"ok": True}))
                else:
                    with self.assertRaises((RuntimeError, ValueError)):
                        suite.request("172.20.0.9", "GET", "/fixed", "secret")
            connection.getresponse.return_value.read.assert_called_once_with(suite.MAX_WIRE + 1)
            connection.close.assert_called_once()
        for host in ("127.0.0.1", "169.254.169.254", "8.8.8.8", "example.com"):
            with patch.object(suite.http.client, "HTTPConnection") as connect, self.assertRaises((RuntimeError, ValueError)):
                suite.request(host, "GET", "/fixed")
            connect.assert_not_called()
        with patch.object(suite.http.client, "HTTPConnection") as connect, self.assertRaises(RuntimeError):
            suite.request("172.20.0.9", "POST", "/fixed", value={"oversized": "x" * 4097})
        connect.assert_not_called()

    def test_uncertain_duplicate_or_tampered_delivery_cannot_launch(self):
        for scenario in ("duplicate", "uncertain", "wrong_envelope"):
            row = {"token": TOKEN, "submission_id": 71, "envelope": envelope()}
            message = copy.deepcopy(row["envelope"])
            if scenario == "wrong_envelope": message["args"][0]["job_id"] = str(uuid.uuid4())
            stdin = Mock(buffer=io.BytesIO(suite.canonical(message) + b"\n"))
            with contextlib.ExitStack() as stack, contextlib.redirect_stdout(io.StringIO()) as output:
                stack.enter_context(patch.object(suite, "context", return_value=({"jobs": {"c": item("c")}}, FROZEN)))
                stack.enter_context(patch.object(suite.flow, "row_for", return_value=row))
                stack.enter_context(patch.object(suite.sys, "stdin", stdin))
                claim = stack.enter_context(patch.object(suite.guard, "claim", return_value=False, side_effect=RuntimeError("lost ack") if scenario == "uncertain" else None))
                launch = stack.enter_context(patch.object(suite.streams.profiles, "logged"))
                journal = stack.enter_context(patch.object(suite.lab, "Journal"))
                if scenario == "duplicate":
                    self.assertEqual(suite.worker("c"), 0)
                    self.assertEqual(json.loads(output.getvalue()), {"launched": False})
                else:
                    with self.assertRaises(RuntimeError): suite.worker("c")
                launch.assert_not_called()
                journal.assert_not_called()
                self.assertEqual(claim.call_count, int(scenario != "wrong_envelope"))

    def test_execution_parser_requires_real_completion_versions_binding_and_cleanup(self):
        value = result("cpp")
        good = ["INGENIUM_STREAM_VERSIONS " + json.dumps(FROZEN["observed"]), "INGENIUM_BOUND_STREAM_RESULT " + json.dumps(value),
                "PASS: bound stream job completed with exact bytes, identity and normal cleanup", "PASS: host test groups and temporary files removed"]
        for lines in (good, good[:-1], good + [good[1]], good + ["FAIL: uncertain"], good[1:]):
            with patch.object(suite, "private", return_value="\n".join(lines).encode()):
                if lines is good: self.assertEqual(suite.parse_execution(Path("unused"), value["job"], FROZEN, BUNDLE), value)
                else:
                    with self.assertRaises(RuntimeError): suite.parse_execution(Path("unused"), value["job"], FROZEN, BUNDLE)

    def test_seal_updates_result_and_full_evidence_atomically_only_for_owner_and_payload(self):
        value = result("c")
        raw = suite.canonical(value)
        fingerprint = hashlib.sha256(raw).hexdigest()
        row = {"token": TOKEN, "submission_id": 71}
        with patch.object(suite.lab, "db", return_value={"sealed": True}) as db:
            suite.seal("c", item("c"), row, OWNER, value, fingerprint, raw, FROZEN, BUNDLE)
        sql = db.call_args.args[0]
        self.assertEqual(db.call_args.kwargs, {"write": True})
        self.assertEqual(sql.count("IF NOT FOUND THEN RAISE EXCEPTION"), 2)
        self.assertLess(sql.index("UPDATE ingenium_transport_v1"), sql.index("UPDATE submissions"))
        self.assertIn("stdout = '', stderr = ''", sql)
        self.assertIn("count(*) FROM submissions) = 15", sql)
        self.assertIn("AND owner_id = '" + OWNER + "'", sql)
        for scenario in ("digest", "wrong_owner", "identity", "accounting"):
            bad = copy.deepcopy(value)
            if scenario == "identity": bad["result"]["identity_checked"] = False
            if scenario == "accounting": bad["result"]["wall_seconds"] = "0; SELECT 1"
            encoded = suite.canonical(bad)
            with patch.object(suite.lab, "db") as db, self.assertRaises(RuntimeError):
                suite.seal("c", item("c"), row, str(uuid.uuid4()) if scenario == "wrong_owner" else OWNER, bad,
                           "0" * 64 if scenario == "digest" else hashlib.sha256(encoded).hexdigest(), encoded, FROZEN, BUNDLE)
            db.assert_not_called()

    def test_private_evidence_is_exclusive_bounded_and_parent_synced(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(suite.lab, "sync_directory") as sync:
            path = Path(directory) / "evidence.json"
            value = {"empty": "", "observed": 0}
            self.assertEqual(suite.save(path, value), hashlib.sha256(suite.canonical(value)).hexdigest())
            self.assertEqual(path.read_bytes(), suite.canonical(value))
            with self.assertRaises(FileExistsError): suite.save(path, value)
            with self.assertRaises(RuntimeError): suite.save(Path(directory) / "oversized.json", {"data": "x" * suite.MAX_WIRE})
            sync.assert_called_once_with(path.parent)

    def test_old_records_snapshots_exclude_only_new_owned_provider_ids_and_never_write(self):
        with patch.object(suite.lab, "db", return_value={"fixed": True}) as db, patch.object(suite, "private", return_value=b"old-evidence"):
            suite.preserved(owned=True)
        self.assertEqual(db.call_count, 4)
        self.assertTrue(all(not call.kwargs.get("write", False) for call in db.call_args_list))
        sql = db.call_args_list[-1].args[0]
        self.assertIn("NOT EXISTS (SELECT 1 FROM ingenium_transport_v1.attempts a WHERE a.submission_id = s.id)", sql)
        self.assertNotIn("DELETE", sql)

    def test_schema_has_new_named_constraints_and_no_permit_outbox_or_evidence_reset(self):
        sql = (ROOT / "transport-admission.sql").read_text()
        self.assertIn("LIKE ingenium_http_v1.attempts INCLUDING ALL", sql)
        self.assertIn("CONSTRAINT transport_evidence_state", sql)
        self.assertIn("CONSTRAINT transport_provider_fk", sql)
        self.assertIn("octet_length(evidence_json::text) <= 2097152", sql)
        self.assertIn("AND OLD.dispatched_at IS NOT NULL", sql)
        for forbidden in ("DROP ", "TRUNCATE ", "DELETE FROM", "permit_count = 0"):
            self.assertNotIn(forbidden, sql)

    def test_wrong_host_user_or_arguments_cannot_reach_worker_or_database(self):
        for system, host, uid, args in (("Windows", "ingenium-judge-spike-01", 0, []), ("Linux", "cloudshell", 0, []),
                                       ("Linux", "ingenium-judge-spike-01", 1000, []), ("Linux", "ingenium-judge-spike-01", 0, ["--worker", "unknown"])):
            with patch.object(suite.platform, "system", return_value=system), patch.object(suite.socket, "gethostname", return_value=host), patch.object(suite.os, "geteuid", return_value=uid, create=True), patch.object(suite, "worker") as worker, patch.object(suite.lab, "db") as db, contextlib.redirect_stderr(io.StringIO()):
                self.assertEqual(suite.main(args), 1)
                worker.assert_not_called()
                db.assert_not_called()

    def test_new_schema_guard_does_not_redirect_completed_http_guard(self):
        self.assertEqual(suite.guard.TABLE, "ingenium_transport_v1.attempts")
        self.assertEqual(suite.streams.guard.TABLE, "ingenium_active_crash_v1.attempts")
        original = suite.streams.load("unchanged_http_guard", ROOT / "http-flow.py")
        self.assertEqual(original.guard.TABLE, "ingenium_http_v1.attempts")

    def test_winning_worker_launches_once_and_never_seals_uncertain_cleanup(self):
        for scenario in ("success", "sandbox_failure", "lost_seal_reply"):
            with self.subTest(scenario=scenario), tempfile.TemporaryDirectory() as directory, contextlib.ExitStack() as stack:
                target = Path(directory)
                value = {"jobs": {"c": item("c")}, "bundle_sha256": BUNDLE}
                row = {"token": TOKEN, "submission_id": 71, "envelope": envelope()}
                stack.enter_context(patch.object(suite, "DIRECTORY", target))
                stack.enter_context(patch.object(suite, "context", return_value=(value, FROZEN)))
                stack.enter_context(patch.object(suite.flow, "row_for", return_value=row))
                stack.enter_context(patch.object(suite.sys, "stdin", Mock(buffer=io.BytesIO(suite.canonical(row["envelope"]) + b"\n"))))
                claim = stack.enter_context(patch.object(suite.guard, "claim", return_value=True))
                stack.enter_context(patch.object(suite.uuid, "uuid4", return_value=uuid.UUID(OWNER)))
                stack.enter_context(patch.object(suite.lab, "sync_directory"))
                stack.enter_context(patch.object(suite, "private", side_effect=lambda path, *args: path.read_bytes()))
                stack.enter_context(patch.object(suite.lab, "db", return_value={"updated": True}))
                def launch(journal, name, args, timeout):
                    self.assertIn("--stream-job", args)
                    if scenario == "sandbox_failure": raise RuntimeError("uncertain cleanup")
                    path = journal.directory / "sandbox.log"
                    path.write_bytes(b"fixed-private-log")
                    return path
                execute = stack.enter_context(patch.object(suite.streams.profiles, "logged", side_effect=launch))
                stack.enter_context(patch.object(suite, "parse_execution", return_value=result("c")))
                seal = stack.enter_context(patch.object(suite, "seal", side_effect=RuntimeError("lost seal ack") if scenario == "lost_seal_reply" else None))
                lost = stack.enter_context(patch.object(suite.os, "_exit", side_effect=SystemExit(75)))
                with self.assertRaises(SystemExit if scenario == "success" else RuntimeError): suite.worker("c")
                claim.assert_called_once()
                execute.assert_called_once()
                self.assertEqual(seal.call_count, int(scenario != "sandbox_failure"))
                self.assertEqual(lost.call_count, int(scenario == "success"))
                checkpoint = target / ("execution-" + BINDING["attempt_id"])
                self.assertEqual((checkpoint / "evidence.json").exists(), scenario != "sandbox_failure")
                if scenario != "sandbox_failure":
                    saved = (checkpoint / "evidence.json").read_bytes()
                    self.assertEqual(seal.call_args.args[5], hashlib.sha256(saved).hexdigest())
                    self.assertEqual(seal.call_args.args[6], saved)

    def test_frozen_context_rejects_changed_boot_sources_helpers_and_bindings(self):
        value = {"scope": suite.SCOPE, "manifest_sha256": BINDING["manifest_sha256"], "image_id": FROZEN["image_id"],
                 "bundle_sha256": BUNDLE, "helpers_sha256": {"fixed": "hash"}, "jobs": {}}
        for name in suite.runner.TRANSPORT:
            data = item(name)
            data["binding"]["attempt_id"] = str(uuid.uuid4())
            data["binding"]["payload_sha256"] = suite.payload_hash(name, data["payload"], value)
            value["jobs"][name] = data
        for scenario in ("ok", "boot", "source", "helpers", "bundle", "binding", "duplicate"):
            changed = copy.deepcopy(value)
            if scenario == "source": changed["jobs"]["c"]["payload"]["source_code"] = "Y2hhbmdlZA=="
            if scenario == "helpers": changed["helpers_sha256"] = {}
            if scenario == "bundle": changed["bundle_sha256"] = "0" * 64
            if scenario == "binding": changed["jobs"]["c"]["binding"]["payload_sha256"] = "0" * 64
            if scenario == "duplicate": changed["jobs"]["cpp"]["binding"]["attempt_id"] = changed["jobs"]["c"]["binding"]["attempt_id"]
            with patch.object(suite, "private", return_value=suite.canonical(changed)), patch.object(suite.guard, "manifest", return_value=(FROZEN, BINDING["manifest_sha256"])), patch.object(suite.streams.bundle, "fingerprint", return_value=BUNDLE), patch.object(suite, "helpers", return_value=value["helpers_sha256"]), patch.object(Path, "read_text", return_value="changed-boot" if scenario == "boot" else BINDING["host_epoch"]):
                if scenario == "ok": self.assertEqual(suite.context(), (value, FROZEN))
                else:
                    with self.assertRaises(RuntimeError): suite.context()

    def test_lost_reply_recovery_requires_all_http_bytes_and_same_owner_without_launch(self):
        name = "cpp"
        value = {"bundle_sha256": BUNDLE}
        row = {"token": TOKEN, "submission_id": 71}
        evidence = result(name)
        raw = suite.canonical(evidence)
        state = {"state": "SEALED", "permit_count": 1, "reserved": False, "provider_id": TOKEN,
                 "evidence_sha256": hashlib.sha256(raw).hexdigest(), "owner_id": OWNER}
        response = {"state": "SEALED", "permit_count": 1, "reserved": False, "token": TOKEN, "submission_id": 71,
                    "evidence_sha256": state["evidence_sha256"], "evidence": evidence}
        phase_data = evidence["result"]
        provider = {"token": TOKEN, "stdout": phase_data["captures"]["stdout"]["data_b64"],
                    "stderr": phase_data["captures"]["stderr"]["data_b64"], "compile_output": "", "message": None,
                    "status": {"id": 3, "description": "Accepted"}, "exit_code": 0, "exit_signal": None, "time": "0.01", "wall_time": "0.1", "memory": 128}
        for scenario in ("ok", "wrong_owner", "missing_evidence", "changed_bytes", "partial", "null_stdout", "wrong_provider", "new_permit", "boolean_permit"):
            current, http, original = copy.deepcopy(state), copy.deepcopy(response), copy.deepcopy(provider)
            if scenario == "wrong_owner": current["owner_id"] = str(uuid.uuid4())
            if scenario == "missing_evidence": http.pop("evidence")
            if scenario == "changed_bytes": http["evidence"]["result"]["captures"]["stdout"]["data_b64"] = "Y2hhbmdlZA=="
            if scenario == "partial": http["evidence"]["result"]["captures"]["stdout"]["eof"] = False
            if scenario == "null_stdout": original["stdout"] = None
            if scenario == "wrong_provider": original["token"] = str(uuid.uuid4())
            if scenario == "boolean_permit": http["permit_count"] = True
            with self.subTest(scenario=scenario), contextlib.ExitStack() as stack, contextlib.redirect_stdout(io.StringIO()):
                stack.enter_context(patch.object(suite, "private", return_value=raw))
                stack.enter_context(patch.object(suite.guard, "observe", return_value=current))
                stack.enter_context(patch.object(suite, "parse_execution", return_value=evidence))
                stack.enter_context(patch.object(suite, "request", side_effect=[(200, http), (200, original)]))
                stack.enter_context(patch.object(suite.lab, "private_ip", return_value="172.20.0.9"))
                stack.enter_context(patch.object(suite.guard, "claim", return_value=scenario == "new_permit"))
                forbidden = stack.enter_context(patch.object(suite.guard, "forbidden_change"))
                launch = stack.enter_context(patch.object(suite.streams.profiles, "logged"))
                if scenario == "ok":
                    suite.verify_http("172.20.0.8", "secret", name, item(name), row, value, FROZEN)
                    self.assertEqual(forbidden.call_count, 4)
                else:
                    with self.assertRaises(RuntimeError): suite.verify_http("172.20.0.8", "secret", name, item(name), row, value, FROZEN)
                launch.assert_not_called()

    def test_real_queue_deliveries_need_exact_envelopes_and_one_winner_without_redelivery(self):
        row = {"token": TOKEN, "submission_id": 71, "envelope": envelope()}
        raw = suite.canonical(row["envelope"])
        for scenario in ("ok", "wrong_envelope", "uncertain_send", "bad_worker", "two_launches"):
            message = copy.deepcopy(row["envelope"])
            if scenario == "wrong_envelope": message["args"][0]["job_id"] = str(uuid.uuid4())
            message_raw = suite.canonical(message)
            codes = [75, 0] if scenario not in ("bad_worker", "two_launches") else [1, 0] if scenario == "bad_worker" else [75, 75]
            workers = [Mock(stdin=io.BytesIO(), stdout=io.BytesIO(b"" if code == 75 else b'{"launched":false}'), wait=Mock(return_value=code)) for code in codes]
            outcomes = [b"uncertain" if scenario == "uncertain_send" else b"queued-two", message_raw, b"claimed", raw, b"claimed"]
            with self.subTest(scenario=scenario), patch.object(suite.lab, "db", return_value=row["envelope"]), patch.object(suite.lab, "redis", side_effect=outcomes) as redis, patch.object(suite.subprocess, "Popen", side_effect=workers) as start, patch.object(suite.guard, "private_json"):
                if scenario == "ok":
                    suite.dispatch("c", item("c"), row, Mock())
                    self.assertEqual(start.call_count, 2)
                    self.assertTrue(all(call.args[0][-2:] == ["--worker", "c"] for call in start.call_args_list))
                else:
                    with self.assertRaises(RuntimeError): suite.dispatch("c", item("c"), row, Mock())
                    if scenario in ("wrong_envelope", "uncertain_send"): start.assert_not_called()
                self.assertEqual(sum(call.args[0] == suite.flow.PUSH_TWO for call in redis.call_args_list), 1)

    def test_previous_stream_seal_requires_current_records_manifest_cleanup_and_exact_log(self):
        log, manifest, cleanup = b"completed-private-stream-log", b"frozen-manifest", b"completed-cleanup-proof"
        base = {"scope": "trusted-fixed-stream-suite-v2", "checker_version": 1, "preserved": {"old": "unchanged"},
                "manifest_sha256": hashlib.sha256(manifest).hexdigest(), "previous_cleanup_sha256": hashlib.sha256(cleanup).hexdigest(),
                "image_id": FROZEN["image_id"], "log_sha256": hashlib.sha256(log).hexdigest(), "bundle_sha256": BUNDLE, "results": ["fixed-parity"]}
        for scenario in ("ok", "old_records", "manifest", "cleanup", "log", "image", "unsealed"):
            value = copy.deepcopy(base)
            for label, field in (("old_records", "preserved"), ("manifest", "manifest_sha256"), ("cleanup", "previous_cleanup_sha256"), ("log", "log_sha256"), ("image", "image_id")):
                if scenario == label: value[field] = "changed"
            evidence = suite.canonical(value)
            journal = suite.canonical({"event": "PREPARED" if scenario == "unsealed" else "COMPLETE", "cases": 50,
                                       "evidence_sha256": hashlib.sha256(evidence).hexdigest()})
            def private(path, *args):
                if path.name == "evidence.json": return evidence
                if path.name == "runtime-manifest.json": return manifest
                if path.name == "streams.log": return log
                if path.parent.name == "cleanup-v1": return cleanup
                if path.name == "journal.jsonl": return journal
                raise AssertionError(path)
            with self.subTest(scenario=scenario), patch.object(suite, "private", side_effect=private), patch.object(suite.streams, "baseline", return_value=base["preserved"]), patch.object(suite.streams, "parse_log", return_value=base["results"]):
                if scenario == "ok": suite.completed_streams(FROZEN)
                else:
                    with self.assertRaises(RuntimeError): suite.completed_streams(FROZEN)

    def test_existing_checkpoint_stops_before_services_database_or_execution(self):
        with patch.object(suite.platform, "system", return_value="Linux"), patch.object(suite.socket, "gethostname", return_value="ingenium-judge-spike-01"), patch.object(suite.os, "geteuid", return_value=0, create=True), patch.object(suite.os, "umask"), patch.object(suite.signal, "signal"), patch.object(suite.streams.active.tree, "directory"), patch.object(suite.os.path, "lexists", return_value=True), patch.object(suite.lab, "db") as db, patch.object(suite.lab.queue, "check_services") as services, contextlib.redirect_stderr(io.StringIO()):
            self.assertEqual(suite.main([]), 1)
            db.assert_not_called()
            services.assert_not_called()


if __name__ == "__main__":
    unittest.main()
