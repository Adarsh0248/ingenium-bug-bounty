import contextlib
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import subprocess
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import MagicMock, Mock, patch
import uuid


spec = importlib.util.spec_from_file_location("recovery_suite", Path(__file__).resolve().parent.parent / "recovery.py")
suite = importlib.util.module_from_spec(spec)
spec.loader.exec_module(suite)
spec = importlib.util.spec_from_file_location("recovery_test_profiles", Path(__file__).resolve().parent / "test_profiles.py")
profile_tests = importlib.util.module_from_spec(spec)
spec.loader.exec_module(profile_tests)
ATTEMPT, EPOCH, OWNER, PROVIDER = [str(uuid.uuid4()) for _ in range(4)]
BINDING = {"attempt_id": ATTEMPT, "host_epoch": EPOCH, "payload_sha256": "a" * 64, "manifest_sha256": "b" * 64}
FROZEN = {"image_id": "sha256:" + "d" * 64, "source_lock": suite.runtime.load_lock(), "observed": profile_tests.versions()}


def state(name="PREPARED"):
    return {"provider_id": PROVIDER, "state": name, "owner_id": None if name == "PREPARED" else OWNER,
            "permit_count": 0 if name == "PREPARED" else 1, "reserved": name != "SEALED",
            "evidence_sha256": "e" * 64 if name == "SEALED" else None}


class RecoveryTests(unittest.TestCase):
    def test_binding_rejects_unknown_missing_noncanonical_and_injectable_values_before_sql(self):
        bad = [dict(BINDING, extra="x"), {key: value for key, value in BINDING.items() if key != "host_epoch"},
               dict(BINDING, host_epoch="bad' OR true --"), dict(BINDING, manifest_sha256="F" * 64),
               dict(BINDING, attempt_id=True), dict(BINDING, payload_sha256="a" * 65)]
        with patch.object(suite.lab, "db") as db:
            for binding in bad:
                with self.subTest(binding=binding), self.assertRaises((RuntimeError, ValueError)):
                    suite.register(binding)
            db.assert_not_called()

    def test_registration_upsert_keeps_all_binding_fields_and_returns_the_existing_provider(self):
        with patch.object(suite.lab, "db", side_effect=[{"provider_id": PROVIDER}, None, {"provider_id": "bad"}]) as db:
            self.assertEqual(suite.register(BINDING), PROVIDER)
            self.assertIsNone(suite.register(BINDING))
            with self.assertRaises(ValueError):
                suite.register(BINDING)
        sql = db.call_args_list[0].args[0]
        self.assertIn("ON CONFLICT (attempt_id) DO UPDATE SET attempt_id = a.attempt_id", sql)
        for key in suite.BINDING:
            self.assertIn(f"a.{key} = EXCLUDED.{key}", sql)
        self.assertEqual(db.call_args_list[0].kwargs, {"write": True})

    def test_mismatched_registration_preserves_json_null_through_the_actual_db_reader(self):
        def psql(*args, data):
            # psql renders SQL NULL as an empty field, unlike the JSON value null.
            return b"null" if b"COALESCE((SELECT json_build_object('provider_id'" in data else b""
        with patch.object(suite.lab, "run", side_effect=psql) as transport:
            self.assertIsNone(suite.register(BINDING))
            self.assertEqual(transport.call_count, 1)
        with patch.object(suite.lab, "run", return_value=b""), self.assertRaises(json.JSONDecodeError):
            suite.register(BINDING)

    def test_claim_is_one_conditional_transition_and_never_retries_a_lost_reply(self):
        with patch.object(suite.lab, "db", side_effect=[{"granted": True}, {"granted": False}, subprocess.TimeoutExpired("psql", 5)]) as db:
            self.assertTrue(suite.claim(BINDING, OWNER))
            self.assertFalse(suite.claim(BINDING, OWNER))
            with self.assertRaises(subprocess.TimeoutExpired):
                suite.claim(BINDING, OWNER)
            self.assertEqual(db.call_count, 3)
        sql = db.call_args.args[0]
        self.assertIn("AND state = 'PREPARED' RETURNING", sql)
        self.assertIn("permit_count = 1", sql)
        self.assertIn("clock_timestamp()", sql)
        for value in BINDING.values():
            self.assertIn(value, sql)
        for reply in ({"granted": 1}, {}, None, {"granted": True, "extra": True}):
            with self.subTest(reply=reply), patch.object(suite.lab, "db", return_value=reply), self.assertRaises(RuntimeError):
                suite.claim(BINDING, OWNER)

    def test_observation_requires_exact_state_identity_count_and_reservation_semantics(self):
        for name in ("PREPARED", "STARTED", "SEALED"):
            row = state(name)
            with patch.object(suite.lab, "db", return_value=row) as db:
                self.assertEqual(suite.observe(BINDING), row)
                self.assertEqual(db.call_args.kwargs, {})
        for change in ({"state": "UNKNOWN"}, {"permit_count": True}, {"reserved": 0}, {"owner_id": OWNER},
                       {"evidence_sha256": "a" * 64}, {"provider_id": str(uuid.uuid1())}):
            with self.subTest(change=change), patch.object(suite.lab, "db", return_value=dict(state(), **change)), self.assertRaises((RuntimeError, ValueError)):
                suite.observe(BINDING)

    def test_seal_is_bound_to_the_started_owner_and_cannot_overwrite_another_result(self):
        for reply in ({"sealed": True}, {"sealed": False}, {"sealed": 1}, {}):
            with self.subTest(reply=reply), patch.object(suite.lab, "db", return_value=reply) as db:
                if reply == {"sealed": True} and type(reply["sealed"]) is bool:
                    suite.seal(BINDING, OWNER, "e" * 64)
                else:
                    with self.assertRaises(RuntimeError):
                        suite.seal(BINDING, OWNER, "e" * 64)
                self.assertIn("AND state = 'STARTED' AND owner_id = '" + OWNER + "'", db.call_args.args[0])

    def test_fresh_private_evidence_is_fsynced_and_never_overwritten(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(suite.lab, "sync_directory") as sync:
            path = Path(directory) / "evidence.json"
            expected = suite.private_json(path, {"fixed": True})
            self.assertEqual(expected, hashlib.sha256(path.read_bytes()).hexdigest())
            sync.assert_called_once_with(path.parent)
            with self.assertRaises(FileExistsError):
                suite.private_json(path, {"changed": True})
            self.assertEqual(json.loads(path.read_bytes()), {"fixed": True})

    def test_manifest_requires_completed_digest_source_lock_kernel_and_exact_cached_image(self):
        value = dict(FROZEN, schema=1, scope="synthetic-profile-parity-only", bundle_sha256=suite.profiles.bundle_hash(), kernel="test-kernel")
        raw = json.dumps(value).encode()
        fingerprint = hashlib.sha256(raw).hexdigest()
        journal = json.dumps({"event": "COMPLETE", "manifest_sha256": fingerprint}).encode()
        image_reply = f'{value["image_id"]}|linux|amd64|65534:65534|1|{value["bundle_sha256"]}'.encode()
        for scenario in ("valid", "unfinished", "wrong_hash", "wrong_image", "wrong_kernel"):
            rows = journal if scenario not in ("unfinished", "wrong_hash") else json.dumps({"event": "PARITY_STARTED", "manifest_sha256": "0" * 64}).encode()
            with self.subTest(scenario=scenario), patch.object(suite.failure, "private_file", side_effect=[rows, raw]), patch.object(suite.platform, "release", return_value="changed" if scenario == "wrong_kernel" else "test-kernel"), patch.object(suite.lab, "run", return_value=b"changed" if scenario == "wrong_image" else image_reply) as run:
                if scenario == "valid":
                    self.assertEqual(suite.manifest(), (value, fingerprint))
                    self.assertEqual(run.call_args.args[:3], ("docker", "image", "inspect"))
                else:
                    with self.assertRaises(RuntimeError):
                        suite.manifest()

    def test_context_refuses_another_boot_changed_payload_or_wrong_manifest_before_claim(self):
        fingerprint = "b" * 64
        helper = b"reviewed fixed host helper"
        payload = {"scope": suite.SCOPE, "image_id": FROZEN["image_id"], "manifest_sha256": fingerprint,
                   "helper_sha256": hashlib.sha256(helper).hexdigest()}
        value = {"scope": suite.SCOPE, "host_epoch": EPOCH, "manifest_sha256": fingerprint,
                 "payload_sha256": suite.failure.canonical_hash(payload),
                 "attempts": {"normal": ATTEMPT, "crash": str(uuid.uuid4())}}
        for scenario in ("valid", "wrong_boot", "wrong_payload", "wrong_manifest", "unknown_fields", "same_attempt"):
            changed = json.loads(json.dumps(value))
            if scenario == "wrong_payload":
                changed["payload_sha256"] = "0" * 64
            if scenario == "wrong_manifest":
                changed["manifest_sha256"] = "0" * 64
            if scenario == "unknown_fields":
                changed["extra"] = True
            if scenario == "same_attempt":
                changed["attempts"]["crash"] = ATTEMPT
            with self.subTest(scenario=scenario), patch.object(suite.failure, "private_file", return_value=json.dumps(changed).encode()), patch.object(suite, "manifest", return_value=(FROZEN, fingerprint)), patch.object(suite, "Path") as path, patch.object(suite.runtime, "regular", return_value=helper), patch.object(suite, "claim") as claim:
                path.return_value.read_text.return_value = str(uuid.uuid4()) if scenario == "wrong_boot" else EPOCH
                if scenario == "valid":
                    self.assertEqual(suite.context(), (value, FROZEN))
                else:
                    with self.assertRaises(RuntimeError):
                        suite.context()
                claim.assert_not_called()

    def test_duplicate_or_uncertain_claim_never_reaches_the_sandbox_or_a_new_journal(self):
        for outcome in (False, RuntimeError("lost reply")):
            with self.subTest(outcome=outcome), patch.object(suite, "claim", side_effect=outcome if isinstance(outcome, Exception) else None, return_value=False), patch.object(suite.lab, "Journal") as journal, patch.object(suite.profiles, "logged") as launch:
                if isinstance(outcome, Exception):
                    with self.assertRaises(RuntimeError):
                        suite.deliver(BINDING, FROZEN)
                else:
                    self.assertEqual(suite.deliver(BINDING, FROZEN), {"launched": False})
                journal.assert_not_called()
                launch.assert_not_called()

    def test_only_normal_cleanup_and_matching_runtime_can_seal_evidence(self):
        for scenario in ("success", "sandbox_failed", "bad_cleanup", "changed_binaries", "file_failed", "lost_seal_reply"):
            with self.subTest(scenario=scenario), tempfile.TemporaryDirectory() as directory:
                log = Path(directory) / "sandbox.log"
                log.write_bytes(b"fixed accounted sandbox log")
                journal = Mock(directory=Path(directory))
                observed = dict(FROZEN["observed"], gcc="wrong") if scenario == "changed_binaries" else FROZEN["observed"]
                with patch.object(suite, "claim", return_value=True), patch.object(suite.lab, "Journal", return_value=journal), patch.object(suite.profiles, "logged", return_value=log, side_effect=RuntimeError("sandbox failed") if scenario == "sandbox_failed" else None) as logged, patch.object(suite.profiles, "parse_log", return_value=(observed, profile_tests.records()), side_effect=RuntimeError("cleanup failed") if scenario == "bad_cleanup" else None), patch.object(suite, "private_json", return_value="e" * 64, side_effect=OSError("disk") if scenario == "file_failed" else None) as save, patch.object(suite, "seal", side_effect=subprocess.TimeoutExpired("psql", 5) if scenario == "lost_seal_reply" else None) as seal:
                    if scenario == "success":
                        self.assertEqual(suite.deliver(BINDING, FROZEN), {"launched": True})
                        seal.assert_called_once()
                        evidence = save.call_args.args[1]
                        self.assertEqual(evidence["binding"], BINDING)
                        self.assertEqual(evidence["owner_id"], seal.call_args.args[1])
                        self.assertTrue(evidence["normal_cleanup_verified"])
                    else:
                        with self.assertRaises((RuntimeError, OSError, subprocess.TimeoutExpired)):
                            suite.deliver(BINDING, FROZEN)
                        self.assertEqual(seal.call_count, 1 if scenario == "lost_seal_reply" else 0)
                    self.assertEqual(logged.call_count, 1)
                    self.assertEqual(logged.call_args.args[2], ["/bin/bash", str(suite.HERE / "cgroup-smoke.sh"), "--profiles", FROZEN["image_id"]])

    def test_actual_delivery_parser_accepts_a_canonical_manifest_roundtrip_without_running_any_program(self):
        frozen = json.loads(json.dumps(FROZEN, sort_keys=True))
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            log = root / "sandbox.log"
            log.write_bytes(profile_tests.log_bytes())
            journal = Mock(directory=root)
            with patch.object(suite, "claim", return_value=True), patch.object(suite.lab, "Journal", return_value=journal), patch.object(suite.profiles, "logged", return_value=log) as launch, patch.object(suite.lab, "sync_directory"), patch.object(suite, "seal") as seal, contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(suite.deliver(BINDING, frozen), {"launched": True})
            raw = (root / "evidence.json").read_bytes()
            evidence = json.loads(raw)
            self.assertEqual([row["profile"] for row in evidence["parity"]], list(suite.profiles.PROFILE_ORDER))
            self.assertEqual(sum(len(row["cases"]) for row in evidence["parity"]), 15)
            self.assertEqual(seal.call_args.args, (BINDING, evidence["owner_id"], hashlib.sha256(raw).hexdigest()))
            launch.assert_called_once()

    def test_duplicate_only_mode_never_calls_the_launcher_even_if_a_permit_is_unexpectedly_granted(self):
        value = {"host_epoch": EPOCH, "payload_sha256": "a" * 64, "manifest_sha256": "b" * 64,
                 "attempts": {"normal": ATTEMPT, "crash": str(uuid.uuid4())}}
        for name, granted, barrier in (("STARTED", False, b"go\n"), ("SEALED", False, b"go\n"),
                                      ("PREPARED", False, b"go\n"), ("STARTED", True, b"go\n"), ("STARTED", False, b"bad")):
            with self.subTest(state=name, granted=granted), patch.object(suite, "context", return_value=(value, FROZEN)), patch.object(suite, "observe", return_value={"state": name}), patch.object(suite, "claim", return_value=granted) as claim, patch.object(suite, "deliver") as deliver, patch.object(suite.profiles, "logged") as launch, patch.object(suite.sys, "stdin", SimpleNamespace(buffer=io.BytesIO(barrier))), contextlib.redirect_stdout(io.StringIO()):
                if name in ("STARTED", "SEALED") and not granted and barrier == b"go\n":
                    self.assertEqual(suite.child("--duplicate-only"), 0)
                else:
                    with self.assertRaises(RuntimeError):
                        suite.child("--duplicate-only")
                deliver.assert_not_called()
                launch.assert_not_called()
                self.assertEqual(claim.call_count, int(name != "PREPARED" and barrier == b"go\n"))

    def test_seal_saved_mode_revalidates_the_saved_log_and_drops_only_the_seal_reply(self):
        value = {"host_epoch": EPOCH, "payload_sha256": "a" * 64, "manifest_sha256": "b" * 64,
                 "attempts": {"normal": ATTEMPT, "crash": str(uuid.uuid4())}}
        expected = {"scope": suite.SCOPE, "binding": BINDING, "owner_id": OWNER, "normal_cleanup_verified": True}
        for scenario in ("valid", "already_sealed", "different_evidence", "bad_log", "lost_database_reply"):
            saved = dict(expected, normal_cleanup_verified=False) if scenario == "different_evidence" else expected
            raw = json.dumps(saved).encode()
            row = dict(state("SEALED" if scenario == "already_sealed" else "STARTED"))
            with self.subTest(scenario=scenario), patch.object(suite, "context", return_value=(value, FROZEN)), patch.object(suite, "observe", return_value=row), patch.object(suite.failure, "private_file", return_value=raw), patch.object(suite, "execution_evidence", return_value=expected, side_effect=RuntimeError("bad log") if scenario == "bad_log" else None), patch.object(suite, "seal", side_effect=RuntimeError("lost reply") if scenario == "lost_database_reply" else None) as seal, patch.object(suite, "claim") as claim, patch.object(suite, "deliver") as launch, patch.object(suite.os, "_exit", side_effect=SystemExit) as exit:
                if scenario == "valid":
                    with self.assertRaises(SystemExit):
                        suite.child("--seal-saved")
                    seal.assert_called_once_with(BINDING, OWNER, hashlib.sha256(raw).hexdigest())
                    exit.assert_called_once_with(75)
                else:
                    with self.assertRaises(RuntimeError):
                        suite.child("--seal-saved")
                    exit.assert_not_called()
                claim.assert_not_called()
                launch.assert_not_called()

    def test_fault_children_drop_acknowledgements_and_never_launch_on_claim_loss(self):
        value = {"host_epoch": EPOCH, "payload_sha256": "a" * 64, "manifest_sha256": "b" * 64,
                 "attempts": {"normal": ATTEMPT, "crash": str(uuid.uuid4())}}
        for mode, code in (("--register-lost", 73), ("--claim-lost", 74), ("--deliver", 75)):
            with self.subTest(mode=mode), patch.object(suite, "context", return_value=(value, FROZEN)), patch.object(suite, "register", return_value=PROVIDER) as register, patch.object(suite, "claim", return_value=True) as claim, patch.object(suite, "deliver", return_value={"launched": True}) as deliver, patch.object(suite.sys, "stdin", SimpleNamespace(buffer=io.BytesIO(b"go\n"))), patch.object(suite.os, "_exit", side_effect=SystemExit) as exit:
                with self.assertRaises(SystemExit):
                    suite.child(mode)
                exit.assert_called_once_with(code)
                self.assertEqual(register.call_count, 1 if code == 73 else 0)
                self.assertEqual(claim.call_count, 1 if code == 74 else 0)
                self.assertEqual(deliver.call_count, 1 if code == 75 else 0)

    def test_competing_workers_are_distinct_processes_started_before_waiting(self):
        events = []
        workers = []
        for code in (75, 0, 0, 0):
            worker = Mock(stdout=io.BytesIO(b"" if code else b'{"launched":false}\n'))
            worker.wait.side_effect = lambda timeout, code=code: events.append("wait") or code
            worker.stdin.write.side_effect = lambda raw: events.append("barrier")
            workers.append(worker)
        with patch.object(suite.subprocess, "Popen", side_effect=workers) as popen, patch.object(suite, "private_json") as saved:
            suite.children("--deliver", 4, [75, 0, 0, 0])
        self.assertEqual(events, ["barrier"] * 4 + ["wait"] * 4)
        self.assertEqual(popen.call_count, 4)
        self.assertEqual(saved.call_count, 4)
        self.assertTrue(all(call.args[0][-1] == "--deliver" for call in popen.call_args_list))

    def test_missing_or_failed_worker_replies_never_start_another_process(self):
        for status, raw in ((1, b"FAIL: worker failed"), (0, b'{"launched":true}'), (75, b"X" * 8193)):
            worker = Mock(stdout=io.BytesIO(raw))
            worker.wait.return_value = status
            with self.subTest(status=status), patch.object(suite.subprocess, "Popen", return_value=worker) as spawn, patch.object(suite, "private_json"), self.assertRaises(RuntimeError):
                suite.children("--deliver", 1, [75])
            self.assertEqual(spawn.call_count, 1)

    def test_parent_preserves_uncertainty_and_verifies_old_data_before_completing(self):
        for unchanged in (True, False):
            with self.subTest(unchanged=unchanged), tempfile.TemporaryDirectory() as directory:
                root = MagicMock()
                root.lstat.return_value = SimpleNamespace(st_uid=0, st_mode=0o40700)
                frozen = dict(FROZEN, preserved_lab_sha256="old")
                journal = Mock()
                db = Mock(side_effect=[{"absent": True}, {"created": True}, {"count": 2}])
                api, exercise, path = Mock(), Mock(), Mock()
                path.return_value.read_text.return_value = EPOCH
                patches = [patch.object(suite.platform, "system", return_value="Linux"),
                           patch.object(suite.socket, "gethostname", return_value="ingenium-judge-spike-01"),
                           patch.object(suite.os, "geteuid", return_value=0, create=True),
                           patch.object(suite.os, "umask"), patch.object(suite.signal, "signal"),
                           patch.object(suite.lab, "RUNTIME", root),
                           patch.object(suite, "DIRECTORY", Path(directory) / "fresh-checkpoint"),
                           patch.object(suite.lab.queue, "check_services"),
                           patch.object(suite, "manifest", return_value=(frozen, "b" * 64)),
                           patch.object(suite.profiles, "completed_baseline", return_value="old"),
                           patch.object(suite.lab, "db", db), patch.object(suite.failure, "private_file", return_value=b"config"),
                           patch.object(suite.lab, "prepare_config", return_value=(b"config", "secret")),
                           patch.object(suite.lab, "private_ip", return_value="172.20.0.4"),
                           patch.object(suite.lab.api, "check_api", api), patch.object(suite, "Path", path),
                           patch.object(suite.lab, "Journal", return_value=journal), patch.object(suite, "private_json"),
                           patch.object(suite, "exercise", exercise),
                           patch.object(suite.profiles, "snapshot", return_value="old" if unchanged else "changed"),
                           patch.object(suite.lab, "redis", return_value=b"empty")]
                with contextlib.ExitStack() as stack:
                    for mock in patches:
                        stack.enter_context(mock)
                    stack.enter_context(contextlib.redirect_stdout(io.StringIO()))
                    errors = stack.enter_context(contextlib.redirect_stderr(io.StringIO()))
                    result = suite.main([])
                    diagnostics = (errors.getvalue(), db.call_args_list, api.call_args_list, journal.record.call_args_list)
                    self.assertEqual(result, 0 if unchanged else 1, diagnostics)
                    self.assertEqual(exercise.call_count, 1, diagnostics)
                    self.assertEqual(api.call_count, 2 if unchanged else 1)
                    ddl = db.call_args_list[1]
                    self.assertEqual(ddl.kwargs, {"write": True})
                    self.assertIn("CREATE SCHEMA ingenium_recovery_v1", ddl.args[0])
                    self.assertFalse(any("DROP " in call.args[0] for call in db.call_args_list))
                    events = [call.args[0] for call in journal.record.call_args_list]
                    self.assertEqual("COMPLETE" in events, unchanged)
                    if unchanged:
                        self.assertEqual(journal.record.call_args.kwargs["uncertain_lab_reservations"], 1)

    def test_database_guard_rejections_roll_back_even_if_an_invalid_mutation_would_succeed(self):
        with patch.object(suite.lab, "db", return_value={"rejected": True}) as db:
            suite.forbidden_change("UPDATE fixed SET state = 'PREPARED'")
        sql = db.call_args.args[0]
        self.assertIn("USING ERRCODE = 'P0002'", sql)
        self.assertIn("EXCEPTION WHEN check_violation OR raise_exception", sql)
        self.assertNotIn("WHEN OTHERS", sql)
        ddl = (suite.HERE / "recovery.sql").read_text()
        self.assertIn("SEALED'", ddl)
        self.assertIn("sealed_at IS NOT NULL", ddl)
        self.assertIn("NEW.owner_id = OLD.owner_id", ddl)
        self.assertIn("REVOKE ALL ON SCHEMA", ddl)
        self.assertNotIn("DROP ", ddl)
        self.assertNotIn("IF NOT EXISTS", ddl)
        self.assertNotIn("submissions", ddl)

    def test_complete_batch_requires_preserved_sealed_evidence_and_retains_uncertain_work(self):
        value = dict(BINDING, scope=suite.SCOPE, attempts={"normal": ATTEMPT, "crash": str(uuid.uuid4())})
        value.pop("attempt_id")
        normal = suite.binding_for(value, "normal")
        for scenario in ("valid", "wrong_cleanup", "wrong_hash", "replaced_result", "released_uncertainty"):
            with self.subTest(scenario=scenario), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                (root / "execution").mkdir()
                evidence = {"binding": normal, "owner_id": OWNER, "normal_cleanup_verified": scenario != "wrong_cleanup"}
                raw = json.dumps(evidence).encode()
                (root / "execution" / "evidence.json").write_bytes(raw)
                sealed = dict(state("SEALED"), evidence_sha256="0" * 64 if scenario == "wrong_hash" else hashlib.sha256(raw).hexdigest())
                uncertain = state("STARTED")
                if scenario == "released_uncertainty":
                    uncertain["reserved"] = False
                observations = [state(), sealed, dict(sealed, evidence_sha256="1" * 64) if scenario == "replaced_result" else sealed,
                                uncertain, uncertain]
                journal = Mock()
                with patch.object(suite, "DIRECTORY", root), patch.object(suite, "children") as children, patch.object(suite, "register", side_effect=[PROVIDER, None, None, None, PROVIDER]), patch.object(suite, "observe", side_effect=observations), patch.object(suite, "claim", return_value=False), patch.object(suite, "seal", side_effect=RuntimeError("stale")), patch.object(suite, "forbidden_change") as forbidden, patch.object(suite.failure, "private_file", return_value=raw), contextlib.redirect_stdout(io.StringIO()):
                    if scenario == "valid":
                        suite.exercise(journal, value, FROZEN)
                        self.assertEqual([call.args for call in children.call_args_list],
                                         [("--register-lost", 1, [73]), ("--deliver", 4, [75, 0, 0, 0]), ("--claim-lost", 1, [74])])
                        self.assertEqual(forbidden.call_count, 3)
                        self.assertEqual(journal.record.call_args.args, ("CRASH_RESERVATION_RETAINED",))
                    else:
                        with self.assertRaises(RuntimeError):
                            suite.exercise(journal, value, FROZEN)
                        self.assertNotIn("CRASH_RESERVATION_RETAINED", [call.args[0] for call in journal.record.call_args_list])

    def test_wrong_machine_arguments_or_existing_checkpoint_cannot_read_the_database(self):
        for system, host, uid, args, exists in (("Windows", "ingenium-judge-spike-01", 0, [], False),
                                               ("Linux", "cloudshell", 0, [], False), ("Linux", "ingenium-judge-spike-01", 1000, [], False),
                                               ("Linux", "ingenium-judge-spike-01", 0, ["--force"], False),
                                               ("Linux", "ingenium-judge-spike-01", 0, [], True)):
            with self.subTest(host=host, args=args), patch.object(suite.platform, "system", return_value=system), patch.object(suite.socket, "gethostname", return_value=host), patch.object(suite.os, "geteuid", return_value=uid, create=True), patch.object(suite.os, "umask"), patch.object(suite.signal, "signal"), patch.object(suite.lab, "RUNTIME") as root, patch.object(suite, "DIRECTORY") as directory, patch.object(suite.lab, "db") as db, patch.object(suite, "manifest") as manifest, contextlib.redirect_stderr(io.StringIO()):
                root.lstat.return_value = SimpleNamespace(st_uid=0, st_mode=0o40700)
                directory.exists.return_value = exists
                self.assertEqual(suite.main(args), 1)
                db.assert_not_called()
                manifest.assert_not_called()


if __name__ == "__main__":
    unittest.main()
