import contextlib
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock, patch


ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("seal_output_tests", ROOT / "seal-output.py")
seal = importlib.util.module_from_spec(spec)
spec.loader.exec_module(seal)
SHA = "a" * 64
SOURCE = b"fixed-source"
SOURCE_SHA = hashlib.sha256(SOURCE).hexdigest()
RESULTS = {"parity": [{"captures": {f"field-{index}": SHA for index in range(8)}} for _ in range(120)]}


class SealOutputTests(unittest.TestCase):
    def test_only_the_pinned_one_line_writer_patch_is_accepted(self):
        raw = (ROOT / "output.py").read_bytes()
        self.assertEqual(hashlib.sha256(raw).hexdigest(), seal.PATCHED_ENTRY)
        self.assertEqual(len(seal.OLD_ENTRY), 64)
        self.assertIn(b"evidence_sha = transport.save(", raw)

    def test_checkpoint_requires_completed_unchanged_unsealed_execution_and_no_launch(self):
        for scenario in ("ok", "unfinished", "log", "policy", "entry", "patched", "boot", "old_state", "extra", "already_fixed"):
            with self.subTest(scenario=scenario), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                old = {"fifteen": "unchanged"}
                log = b"saved output log\n"
                value = {"event": "PREPARED", "preserved": old, "host_epoch": "old-boot", "image_id": "sha256:" + SHA,
                         "manifest_sha256": SHA, "bundle_sha256": SHA, "stream_sha256": SHA,
                         "helpers_sha256": {"output.py": "changed" if scenario == "entry" else seal.OLD_ENTRY,
                                            "cgroup-smoke.sh": "changed" if scenario == "policy" else SOURCE_SHA,
                                            "namespace-smoke.apparmor": SOURCE_SHA}}
                rows = [value, {"event": "OUTPUT_STARTED"}, {"event": "OUTPUT_FINISHED", "log_sha256": "changed" if scenario == "log" else hashlib.sha256(log).hexdigest()}]
                if scenario == "unfinished": rows.pop()
                (root / "journal.jsonl").write_bytes(b"\n".join(json.dumps(row).encode() for row in rows))
                (root / "output.log").write_bytes(log)
                if scenario == "extra": (root / "evidence.json").write_bytes(b"never overwrite")
                if scenario == "already_fixed": (root / "seal-fix-v1").mkdir()
                with contextlib.ExitStack() as stack:
                    patches = [patch.object(seal.output, "DIRECTORY", root), patch.object(seal, "FIX", root / "seal-fix-v1"),
                               patch.object(seal, "PATCHED_ENTRY", "changed" if scenario == "patched" else SOURCE_SHA),
                               patch.object(seal.output.streams.active.tree, "directory"),
                               patch.object(seal.transport, "private", side_effect=lambda path, *args: path.read_bytes()),
                               patch.object(seal.transport.runtime, "regular", return_value=SOURCE),
                               patch.object(seal.output.guard, "manifest", return_value=({"image_id": "sha256:" + SHA}, SHA)),
                               patch.object(seal.output.bundle, "fingerprint", return_value=SHA), patch.object(seal.output.streams.bundle, "fingerprint", return_value=SHA),
                               patch.object(seal.Path, "read_text", return_value="new-boot" if scenario == "boot" else "old-boot"),
                               patch.object(seal.output, "previous", return_value={"changed": True} if scenario == "old_state" else old),
                               patch.object(seal.output, "parse_log", return_value=RESULTS), patch.object(seal, "physical_cleanup")]
                    for item in patches: stack.enter_context(item)
                    launch = stack.enter_context(patch.object(seal.output.streams.profiles, "logged"))
                    if scenario == "ok":
                        context, evidence, _, original = seal.checkpoint()
                        self.assertEqual(context, value)
                        self.assertEqual(evidence["results"], RESULTS)
                        self.assertEqual(evidence["helpers_sha256"]["output.py"], seal.OLD_ENTRY)
                        self.assertEqual(set(original), {"journal.jsonl", "output.log"})
                    else:
                        with self.assertRaises(RuntimeError): seal.checkpoint()
                    launch.assert_not_called()

    def test_physical_cleanup_requires_absent_container_policy_and_owned_paths(self):
        for scenario in ("ok", "identity", "container", "profile", "path"):
            log = b"completed\ningenium-cg-run-Ab12Cd\n"
            if scenario == "identity": log += b"ingenium-cg-run-Ef34Gh\n"
            with self.subTest(scenario=scenario), patch.object(seal.lab, "run", return_value=b"still-here" if scenario == "container" else b""), \
                    patch.object(seal.Path, "open", return_value=io.BytesIO(b"ingenium-isolate-smoke-v1 (enforce)\n" if scenario == "profile" else b"docker-default (enforce)\n")), \
                    patch.object(seal.output.streams.active, "roots", return_value=[Path("/sys/fs/cgroup/memory")]), \
                    patch.object(seal.os.path, "lexists", return_value=scenario == "path"):
                if scenario == "ok": seal.physical_cleanup(log)
                else:
                    with self.assertRaises(RuntimeError): seal.physical_cleanup(log)

    def test_continuation_saves_once_and_never_invokes_execution_or_completes_after_mismatch(self):
        for scenario in ("ok", "checkpoint", "save", "old_state", "sources"):
            value = {"preserved": {"old": "unchanged"}, "host_epoch": "old-boot", "bundle_sha256": SHA, "stream_sha256": SHA}
            helpers = {"seal-output.py": SOURCE_SHA}
            original = {"journal.jsonl": hashlib.sha256(b"original").hexdigest(), "output.log": hashlib.sha256(b"original").hexdigest()}
            journal = Mock()
            with self.subTest(scenario=scenario), contextlib.ExitStack() as stack:
                patches = [patch.object(seal.platform, "system", return_value="Linux"),
                           patch.object(seal.socket, "gethostname", return_value="ingenium-judge-spike-01"), patch.object(seal.os, "geteuid", return_value=0, create=True),
                           patch.object(seal.os, "umask"), patch.object(seal.signal, "signal"), patch.object(seal.lab.queue, "check_services"),
                           patch.object(seal, "checkpoint", return_value=(value, {"results": RESULTS}, helpers, original), side_effect=RuntimeError("not complete") if scenario == "checkpoint" else None),
                           patch.object(seal.transport.failure, "private_file", return_value=b"synthetic"), patch.object(seal.lab, "prepare_config", return_value=(None, "synthetic-token")),
                           patch.object(seal.lab.api, "check_api"), patch.object(seal.lab, "private_ip", return_value="private"), patch.object(seal.lab, "Journal", return_value=journal),
                           patch.object(seal.output, "previous", return_value={"changed": True} if scenario == "old_state" else value["preserved"]),
                           patch.object(seal.output.bundle, "fingerprint", return_value=SHA), patch.object(seal.output.streams.bundle, "fingerprint", return_value=SHA),
                           patch.object(seal.Path, "read_text", return_value="old-boot"), patch.object(seal.transport.runtime, "regular", return_value=b"changed" if scenario == "sources" else SOURCE),
                           patch.object(seal.transport, "private", return_value=b"original"), patch.object(seal, "physical_cleanup"),
                           contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO())]
                for item in patches: stack.enter_context(item)
                save = stack.enter_context(patch.object(seal.transport, "save", return_value=SHA, side_effect=OSError("disk") if scenario == "save" else None))
                launch = stack.enter_context(patch.object(seal.output.streams.profiles, "logged"))
                self.assertEqual(seal.main([]), 0 if scenario == "ok" else 1)
                launch.assert_not_called()
                if scenario == "checkpoint": save.assert_not_called()
                if scenario == "ok":
                    self.assertEqual(save.call_count, 1)
                    self.assertEqual(journal.record.call_args.args, ("COMPLETE",))
                    self.assertEqual(journal.record.call_args.kwargs["new_sandbox_launches"], 0)
                else: self.assertFalse(any(item.args[0] == "COMPLETE" for item in journal.record.call_args_list))

    def test_wrong_host_or_arguments_block_all_checks_and_writes(self):
        with patch.object(seal.platform, "system", return_value="Linux"), patch.object(seal.socket, "gethostname", return_value="wrong"), \
                patch.object(seal, "checkpoint") as checkpoint, patch.object(seal.transport, "save") as save, contextlib.redirect_stderr(io.StringIO()):
            self.assertEqual(seal.main([]), 1)
            self.assertEqual(seal.main(["unexpected"]), 1)
            checkpoint.assert_not_called()
            save.assert_not_called()


if __name__ == "__main__":
    unittest.main()
