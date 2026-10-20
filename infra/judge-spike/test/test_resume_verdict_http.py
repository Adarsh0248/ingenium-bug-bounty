import contextlib
import copy
import importlib.util
import io
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch


ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("resume_verdict_tests", ROOT / "resume-verdict-http.py")
resume = importlib.util.module_from_spec(spec)
spec.loader.exec_module(resume)
batch = resume.batch
SHA = "a" * 64
FROZEN = {"image_id": "sha256:" + SHA}
OLD = {name: SHA for name in resume.ORIGINAL_FILES}
EXISTING = {"count": 8, "sha256": SHA}


def context():
    value = {"scope": batch.SCOPE, "manifest_sha256": SHA, "image_id": FROZEN["image_id"], "fingerprints": batch.fingerprints(),
             "preserved": {"files": {"profiles-v2/journal.jsonl": SHA}}, "jobs": {}}
    for index, case in enumerate(batch.cases.CASES):
        data = batch.payload(case)
        value["jobs"][case["id"]] = {"payload": data, "binding": {
            "attempt_id": f"8cf9f0bd-8374-4d81-bbf5-{index:012d}", "host_epoch": "53cb2405-35a8-4f72-909a-7fb9aab466e3",
            "manifest_sha256": SHA, "payload_sha256": batch.payload_hash(case, data, value)}}
    return value


def rows_for(value, count=8):
    return {case["id"]: {"token": f"9cf9f0bd-8374-4d81-bbf5-{index:012d}", "submission_id": index + 16, "envelope": {"fixed": index}}
            for index, case in enumerate(batch.cases.CASES[:count])}


def journal_for(value):
    rows = [{"event": name} for name in ("PREPARED", "SCHEMA_CREATE_STARTED", "SCHEMA_CREATED", "CREATOR_ALLOCATING", "CREATOR_ALLOCATED")]
    rows[0].update(preserved=value["preserved"], fingerprints=value["fingerprints"])
    rows[4]["container"] = SHA
    for name, row in rows_for(value).items():
        rows += [{"event": "HTTP_SEND_STARTED", "case_id": name, "binding": value["jobs"][name]["binding"]},
                 {"event": "HTTP_RECONCILED", "case_id": name, "token": row["token"], "submission_id": row["submission_id"]}]
    return rows + [{"event": "HTTP_SEND_STARTED", "case_id": "cpp-wall", "binding": value["jobs"]["cpp-wall"]["binding"]}, {"event": "CREATOR_REMOVED"}]


class ResumeTests(unittest.TestCase):
    def test_only_absent_wall_payload_and_hash_change_not_source_limits_or_eight_bindings(self):
        original = context()
        before = copy.deepcopy(original)
        value = resume.corrected(original)
        self.assertEqual(original, before)
        for name, item in original["jobs"].items():
            if name == "cpp-wall":
                changed = copy.deepcopy(item)
                changed["payload"]["wall_time_limit"] = 1
                changed["binding"]["payload_sha256"] = batch.payload_hash(next(c for c in batch.cases.CASES if c["id"] == name), changed["payload"], value)
                self.assertEqual(value["jobs"][name], changed)
                self.assertNotEqual(item["binding"]["payload_sha256"], changed["binding"]["payload_sha256"])
            else: self.assertEqual(value["jobs"][name], item)
        self.assertEqual(next(c for c in batch.cases.CASES if c["id"] == "cpp-wall")["wall_ms"], 300)
        original["jobs"]["cpp-wall"]["payload"]["wall_time_limit"] = 1
        with self.assertRaises(RuntimeError): resume.corrected(original)

    def test_journal_must_match_exact_failure_and_removed_creator_before_mutations(self):
        original = context()
        for scenario in ("ok", "executed", "binding", "snapshot", "creator"):
            rows = journal_for(original)
            if scenario == "executed": rows.append({"event": "QUEUE_SEND_STARTED"})
            if scenario == "binding": rows[-2]["binding"] = {}
            if scenario == "snapshot": rows[0]["preserved"] = {}
            with self.subTest(scenario=scenario), patch.object(resume.transport, "private", return_value=b"\n".join(map(resume.transport.canonical, rows))), \
                    patch.object(resume.lab, "run", return_value=SHA.encode() if scenario == "creator" else b"") as run, patch.object(resume.lab, "db") as db:
                if scenario == "ok":
                    result = resume.verify_journal(original)
                    self.assertEqual(set(result), set(resume.EXISTING))
                    self.assertIn("id=" + SHA, run.call_args.args)
                else:
                    with self.assertRaises(RuntimeError): resume.verify_journal(original)
                db.assert_not_called()

    def test_unstarted_inventory_checks_source_and_provider_limits_without_writing(self):
        value = context()
        for scenario in ("ok", "permit", "provider", "source"):
            inventory = {"count": 8, "unstarted": 7 if scenario == "permit" else 8, "providers": 24 if scenario == "provider" else 23}
            replies = [inventory] + [{"valid": scenario != "source"}] * 8
            rows = list(rows_for(value).values())
            with self.subTest(scenario=scenario), patch.object(resume.lab, "db", side_effect=replies) as db, \
                    patch.object(resume.transport.flow, "row_for", side_effect=rows):
                if scenario == "ok":
                    self.assertEqual(resume.unstarted(value, 8), rows_for(value))
                    for call in db.call_args_list: self.assertNotIn("write", call.kwargs)
                    self.assertIn("held_evidence_json IS NULL", db.call_args_list[0].args[0])
                    self.assertIn("count(*) FROM submissions) = 23", db.call_args_list[1].args[0])
                else:
                    with self.assertRaises(RuntimeError): resume.unstarted(value, 8)

    def test_existing_digest_includes_complete_provider_and_attempt_rows_only_for_eight_ids(self):
        with patch.object(resume.lab, "db", return_value=EXISTING) as db:
            self.assertEqual(resume.existing_digest(context()), EXISTING)
            sql = db.call_args.args[0]
            self.assertIn("to_jsonb(a)", sql)
            self.assertIn("to_jsonb(s)", sql)
            self.assertEqual(sql.count("8cf9f0bd-8374-4d81-bbf5-"), 8)
            self.assertNotIn("write", db.call_args.kwargs)

    def test_model_preflight_is_read_only_without_saving_or_execution(self):
        value = resume.corrected(context())
        with patch.object(resume.lab, "run", return_value=b"PASS: all eighteen corrected payloads satisfy read-only Judge0 model validation") as run, contextlib.redirect_stdout(io.StringIO()):
            resume.validate_payloads(value)
            self.assertIn("default_transaction_read_only=on", run.call_args.args[-3])
            self.assertEqual(run.call_args.kwargs["data"], resume.transport.canonical(value["jobs"]))
            self.assertIn("record.valid?", resume.VALIDATE_RUBY)
            self.assertNotIn(".save", resume.VALIDATE_RUBY)
            self.assertNotIn(".create", resume.VALIDATE_RUBY)
        with patch.object(resume.lab, "run", return_value=b""), self.assertRaises(RuntimeError): resume.validate_payloads(value)

    def test_model_preflight_accepts_logs_only_with_one_exact_success_line(self):
        value = resume.corrected(context())
        success = b"PASS: all eighteen corrected payloads satisfy read-only Judge0 model validation"
        for reply, valid in ((success, True), (b"Rails startup log\n" + success, True),
                             (b"SQL validation log\r\n" + success + b"\r\nshutdown log", True),
                             (b"startup log only", False), (success + b"\n" + success, False),
                             (b"not a result: " + success, False), (success + b" incomplete", False)):
            with self.subTest(reply=reply), patch.object(resume.lab, "run", return_value=reply), contextlib.redirect_stdout(io.StringIO()) as output:
                if valid:
                    resume.validate_payloads(value)
                    self.assertEqual(output.getvalue(), success.decode("ascii") + "\n")
                else:
                    with self.assertRaises(RuntimeError): resume.validate_payloads(value)
                    self.assertEqual(output.getvalue(), "")
        with patch.object(resume.lab, "run", side_effect=resume.subprocess.CalledProcessError(1, "validation", output=success)), self.assertRaises(resume.subprocess.CalledProcessError):
            resume.validate_payloads(value)

    def test_guarded_context_requires_original_evidence_unchanged_and_exact_single_correction(self):
        original = context()
        value = resume.corrected(original)
        for scenario in ("ok", "original", "source", "context", "admission", "extra"):
            saved_value = copy.deepcopy(value)
            if scenario == "context": saved_value["jobs"][resume.EXISTING[0]]["payload"]["enable_network"] = True
            raw = resume.transport.canonical(saved_value)
            checkpoint = {"scope": resume.SCOPE, "original_files": {} if scenario == "original" else OLD,
                "continuation_sha256": "b" * 64 if scenario == "source" else batch.previous.digest((ROOT / "resume-verdict-http.py").read_bytes()),
                "context_sha256": batch.previous.digest(raw), "existing_rows": EXISTING}
            if scenario == "extra": checkpoint["extra"] = True
            with self.subTest(scenario=scenario), patch.object(resume, "ORIGINAL_CONTEXT", return_value=(original, FROZEN)), \
                    patch.object(resume, "original_files", return_value=OLD), \
                    patch.object(resume.transport, "private", side_effect=lambda path: resume.transport.canonical(checkpoint) if path.name == "checkpoint.json" else raw), \
                    patch.object(resume.transport.failure, "private_file", return_value=b"changed" if scenario == "admission" else raw):
                if scenario == "ok": self.assertEqual(resume.fixed_context(), (value, FROZEN))
                else:
                    with self.assertRaises(RuntimeError): resume.fixed_context()

    def test_existing_eight_are_get_only_and_only_ten_absent_jobs_are_posted(self):
        value = resume.corrected(context())
        initial, all_rows = rows_for(value), rows_for(value, 18)
        for scenario in ("ok", "not_absent", "lost_post"):
            requests = Mock(return_value=(404, {}))
            with self.subTest(scenario=scenario), patch.object(resume, "lookup") as lookup, \
                    patch.object(resume.transport, "request", requests), patch.object(resume.lab, "db", return_value={"absent": scenario != "not_absent"}) as db, \
                    patch.object(resume.transport.flow, "discard_token_reply", side_effect=RuntimeError("lost") if scenario == "lost_post" else None) as post, \
                    patch.object(resume.transport.flow, "row_for", side_effect=list(all_rows.values())[8:]):
                if scenario == "ok": self.assertEqual(resume.admit_remaining("private", "token", value, initial, Mock()), all_rows)
                else:
                    with self.assertRaises(RuntimeError): resume.admit_remaining("private", "token", value, initial, Mock())
                self.assertEqual(post.call_count, 10 if scenario == "ok" else 0 if scenario == "not_absent" else 1)
                self.assertEqual(lookup.call_count, 18 if scenario == "ok" else 8)
                self.assertEqual(initial, rows_for(value))
                for call in requests.call_args_list: self.assertEqual(call.args[1], "GET")
                for call in db.call_args_list: self.assertNotIn("write", call.kwargs)

    def test_http_lookup_rejects_bool_permits_changed_identity_or_released_reservation(self):
        value = context()
        name = resume.EXISTING[0]
        item, row = value["jobs"][name], rows_for(value)[name]
        for scenario in ("ok", "bool", "released", "identity", "status"):
            response = {"token": row["token"], "submission_id": row["submission_id"], "state": "PREPARED", "permit_count": 0,
                        "reserved": True, "recovery_required": False, "evidence_sha256": None}
            if scenario == "bool": response["permit_count"] = False
            if scenario == "released": response["reserved"] = False
            if scenario == "identity": response["submission_id"] += 1
            with self.subTest(scenario=scenario), patch.object(resume.transport, "request", side_effect=[(404 if scenario == "status" else 200, response), (409, {})]):
                if scenario == "ok": resume.lookup("private", "token", item, row)
                else:
                    with self.assertRaises(RuntimeError): resume.lookup("private", "token", item, row)

    def test_dispatch_keeps_two_deliveries_one_permit_protocol_and_guarded_worker_entry(self):
        value = context()
        case = batch.cases.CASES[0]
        row, item = rows_for(value)[case["id"]], value["jobs"][case["id"]]
        for codes in ((75, 0), (0, 75), (75, 75), (0, 0), (1, 0)):
            workers = [SimpleNamespace(stdin=Mock(), stdout=Mock(read=Mock(return_value=b'{"launched":false}' if code == 0 else b"")),
                                       wait=Mock(return_value=code)) for code in codes]
            raw = resume.transport.canonical(row["envelope"])
            with self.subTest(codes=codes), patch.object(resume.lab, "db", return_value=row["envelope"]), \
                    patch.object(resume.lab, "redis", side_effect=[b"queued-two", raw, b"claimed", raw, b"claimed"]), \
                    patch.object(resume.lab, "validate_message"), patch.object(resume.subprocess, "Popen", side_effect=workers) as launch, \
                    patch.object(resume.guard, "private_json"):
                if sorted(codes) == [0, 75]: resume.dispatch(case, item, row, Mock())
                else:
                    with self.assertRaises(RuntimeError): resume.dispatch(case, item, row, Mock())
                self.assertEqual(launch.call_count, 2)
                self.assertTrue(launch.call_args.args[0][2].endswith("resume-verdict-http.py"))

    def test_controller_reuses_existing_schema_and_never_finishes_after_changed_state(self):
        original = context()
        original_raw = resume.transport.canonical(original)
        value = resume.corrected(original)
        for scenario in ("ok", "validation", "eight_changed", "prior_changed", "dispatch"):
            with self.subTest(scenario=scenario), contextlib.ExitStack() as stack:
                patches = [patch.object(resume.platform, "system", return_value="Linux"), patch.object(resume.socket, "gethostname", return_value="ingenium-judge-spike-01"),
                    patch.object(resume.os, "geteuid", return_value=0, create=True), patch.object(resume.os, "umask"), patch.object(resume.signal, "signal"),
                    patch.object(resume.os.path, "lexists", return_value=False), patch.object(resume.os, "chown", create=True), patch.object(resume.os, "chmod"),
                    patch.object(resume.Path, "iterdir", return_value=[Path(name) for name in resume.ORIGINAL_FILES]),
                    patch.object(batch.previous.streams.active.tree, "directory"), patch.object(resume.lab.queue, "check_services"),
                    patch.object(resume.lab, "run", side_effect=lambda *a, **k: b"true|bridge" if "network" in a else b""), patch.object(resume.lab, "redis", return_value=b"empty"),
                    patch.object(resume, "ORIGINAL_CONTEXT", return_value=(original, FROZEN)), patch.object(resume, "original_files", return_value=OLD),
                    patch.object(resume.transport, "private", return_value=original_raw), patch.object(resume.transport.failure, "private_file", return_value=original_raw),
                    patch.object(resume, "verify_journal", return_value={name: {key: row[key] for key in ("token", "submission_id")} for name, row in rows_for(value).items()}),
                    patch.object(resume, "unstarted", side_effect=[rows_for(value), rows_for(value, 18)]),
                    patch.object(resume, "existing_digest", side_effect=[EXISTING, {}] if scenario == "eight_changed" else None, return_value=EXISTING),
                    patch.object(batch, "snapshot", side_effect=[original["preserved"], {}] if scenario == "prior_changed" else None, return_value=original["preserved"]),
                    patch.object(resume.lab, "prepare_config", return_value=(b"private", "token")), patch.object(resume.lab.api, "check_api"), patch.object(resume.lab, "private_ip", return_value="private"),
                    patch.object(resume, "validate_payloads", side_effect=RuntimeError("invalid") if scenario == "validation" else None),
                    patch.object(resume, "fixed_context", return_value=(value, FROZEN)), patch.object(resume.lab, "create_creator", return_value=("creator", "nonce")),
                    patch.object(resume.lab, "wait_creator"), patch.object(resume.lab, "stop_creator"),
                    patch.object(resume, "admit_remaining", return_value=rows_for(value, 18)), patch.object(batch, "verify_http", return_value={"verified": True}),
                    contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO())]
                for item in patches: stack.enter_context(item)
                journal = stack.enter_context(patch.object(resume.lab, "Journal", return_value=Mock()))
                save = stack.enter_context(patch.object(resume.transport, "save", return_value=SHA))
                dispatch = stack.enter_context(patch.object(resume, "dispatch", side_effect=RuntimeError("failed") if scenario == "dispatch" else None))
                db = stack.enter_context(patch.object(resume.lab, "db", return_value={"count": 18, "sealed": 17, "held": 1}))
                self.assertEqual(resume.main([]), 0 if scenario == "ok" else 1)
                self.assertEqual(dispatch.call_count, 0 if scenario in ("eight_changed", "validation") else 1 if scenario == "dispatch" else 18)
                self.assertEqual(journal.call_count, 0 if scenario == "validation" else 1)
                for call in db.call_args_list:
                    self.assertNotIn("CREATE", call.args[0])
                    self.assertNotIn("write", call.kwargs)
                self.assertEqual(len([call for call in save.call_args_list if call.args[0].name == "evidence.json"]), int(scenario == "ok"))

    def test_bad_mode_host_root_or_existing_fix_cannot_mutate(self):
        for scenario in ("mode", "host", "root", "existing"):
            with self.subTest(scenario=scenario), contextlib.ExitStack() as stack:
                for target, name, value in ((resume.platform, "system", "Linux"), (resume.socket, "gethostname", "wrong" if scenario == "host" else "ingenium-judge-spike-01"),
                    (resume.os, "geteuid", 1 if scenario == "root" else 0), (resume.os.path, "lexists", True)):
                    stack.enter_context(patch.object(target, name, return_value=value, create=True))
                for target, name in ((resume.os, "umask"), (resume.signal, "signal"), (batch.previous.streams.active.tree, "directory")):
                    stack.enter_context(patch.object(target, name))
                journal = stack.enter_context(patch.object(resume.lab, "Journal"))
                db = stack.enter_context(patch.object(resume.lab, "db"))
                stack.enter_context(contextlib.redirect_stderr(io.StringIO()))
                self.assertEqual(resume.main(["--worker", "unknown"] if scenario == "mode" else []), 1)
                db.assert_not_called()
                journal.assert_not_called()

    def test_every_worker_validates_continuation_before_calling_existing_worker(self):
        for valid in (True, False):
            with self.subTest(valid=valid), contextlib.ExitStack() as stack:
                for target, name, value in ((resume.platform, "system", "Linux"), (resume.socket, "gethostname", "ingenium-judge-spike-01"),
                    (resume.os, "geteuid", 0)):
                    stack.enter_context(patch.object(target, name, return_value=value, create=True))
                for target, name in ((resume.os, "umask"), (resume.signal, "signal"), (batch.previous.streams.active.tree, "directory")):
                    stack.enter_context(patch.object(target, name))
                fixed = stack.enter_context(patch.object(resume, "fixed_context", side_effect=None if valid else RuntimeError("changed source")))
                stack.enter_context(patch.object(batch, "context"))
                worker = stack.enter_context(patch.object(batch, "worker", return_value=0))
                stack.enter_context(contextlib.redirect_stderr(io.StringIO()))
                self.assertEqual(resume.main(["--worker", resume.EXISTING[0]]), 0 if valid else 1)
                fixed.assert_called_once_with()
                if valid:
                    worker.assert_called_once_with(resume.EXISTING[0])
                    self.assertIs(batch.context, fixed)
                else: worker.assert_not_called()


if __name__ == "__main__": unittest.main()
