import base64
import contextlib
import importlib.util
import io
import json
from pathlib import Path
import shutil
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import MagicMock, Mock, patch


spec = importlib.util.spec_from_file_location("profile_suite", Path(__file__).resolve().parent.parent / "profiles.py")
suite = importlib.util.module_from_spec(spec)
spec.loader.exec_module(suite)
runtime = suite.runtime
LOCK = runtime.load_lock()
IMAGE = "sha256:" + "e" * 64


def versions():
    paths = ["/usr/local/bin/gcc", "/usr/local/bin/g++", "/usr/local/bin/python3.14", "/usr/local/bin/node",
             "/usr/local/java/bin/java", "/usr/local/java/bin/javac", runtime.ISOLATE, "/usr/local/bin/ingenium-exec", "/usr/local/lib/libcap.so.2"]
    hashes = dict.fromkeys(paths, "a" * 64)
    hashes[runtime.ISOLATE] = LOCK["isolate_sha256"]
    return {"gcc": "15.3.0", "g++": "15.3.0", "python": "3.14.8", "node": "v24.22.0",
            "javac": "javac 21.0.12.1", "java": "openjdk 21.0.12.1 build 21.0.12.1+1",
            "isolate": "The process isolator 1.8.1", "binary_sha256": hashes}


def phase(output=b""):
    return {"stdout_b64": base64.b64encode(output).decode(), "cpu_ns": 3_000_000,
            "peak_bytes": 4194304, "wall_seconds": "0.100", "identity_checked": True}


def records():
    return [{"profile": name, "source_sha256": profile["sha256"],
             "compile": phase() if profile["compile"] else None,
             "cases": [dict(phase(out), stdin_b64=base64.b64encode(stdin).decode()) for stdin, out in runtime.CASES]}
            for name, profile in LOCK["profiles"].items()]


def log_bytes(results=None, observed=None):
    rows = records() if results is None else results
    return ("INGENIUM_PROFILE_VERSIONS " + json.dumps(versions() if observed is None else observed) + "\n"
            + "\n".join("INGENIUM_PROFILE_RESULT " + json.dumps(row) for row in rows)
            + "\nPASS: host test groups and temporary files removed\n").encode()


META = b"time:0.003\ntime-wall:0.100\nmax-rss:4096\ncsw-voluntary:2\ncsw-forced:1\ncg-mem:4096\nexitcode:0\n"


class ProfileTests(unittest.TestCase):
    def test_all_source_images_are_pinned_amd64_inputs_matching_dockerfile(self):
        dockerfile = (suite.HERE / "profiles" / "Dockerfile").read_text()
        for source in LOCK["images"].values():
            self.assertRegex(source["image"], r"^docker.io/library/[a-z-]+:[\w.-]+@sha256:[0-9a-f]{64}$")
            self.assertIn("FROM " + source["image"].removeprefix("docker.io/library/"), dockerfile)
            self.assertRegex(source["config"], r"^sha256:[0-9a-f]{64}$")
        self.assertNotIn("apt-get", dockerfile)
        self.assertIn('ENTRYPOINT ["/usr/bin/false"]', dockerfile)
        self.assertIn("USER 65534:65534", dockerfile)
        self.assertIn("/usr/local/bin/ingenium-exec", dockerfile)
        self.assertIn("libcap.so.2*", dockerfile)
        self.assertNotIn("EXPOSE", dockerfile)

    def test_fixed_commands_limits_fixtures_and_context_identity(self):
        self.assertEqual(list(LOCK["profiles"]), ["c", "cpp", "java", "python", "javascript"])
        for name, profile in LOCK["profiles"].items():
            self.assertEqual(profile["cpu"], 2 if name in ("c", "cpp") else 4)
            self.assertEqual(profile["wall"], 10 if name in ("c", "cpp") else 15)
            if name in ("c", "cpp"):
                self.assertIn("-O2", profile["compile"])
            if name in ("python", "javascript"):
                self.assertIsNone(profile["compile"])
        self.assertIn("-std=c17", LOCK["profiles"]["c"]["compile"])
        self.assertIn("-std=c++17", LOCK["profiles"]["cpp"]["compile"])
        self.assertIn("-Xmx256m", LOCK["profiles"]["java"]["run"])
        self.assertIn("--max-old-space-size=256", LOCK["profiles"]["javascript"]["run"])
        self.assertRegex(suite.bundle_hash(), r"^[0-9a-f]{64}$")
        with patch.object(runtime.hashlib, "sha256", return_value=Mock(hexdigest=lambda: "0" * 64)), self.assertRaises(RuntimeError):
            runtime.load_lock()

    def test_java_library_search_is_explicit_in_the_build_environment(self):
        dockerfile = (suite.HERE / "profiles" / "Dockerfile").read_text()
        self.assertIn("ENV LD_LIBRARY_PATH=/usr/local/lib64:/usr/local/lib:/usr/local/java/lib:/usr/local/java/lib/server\n", dockerfile)

    def test_exact_versions_and_all_binary_fingerprints_are_required(self):
        runtime.validate_versions(LOCK, versions())
        for key, value in (("gcc", "9.2.0"), ("g++", "15.2.0"), ("node", "v25.0.0"),
                           ("python", "3.13.0"), ("javac", "javac 21.0.12"), ("java", "21.0.12+1")):
            item = versions()
            item[key] = value
            with self.subTest(key=key), self.assertRaises(RuntimeError):
                runtime.validate_versions(LOCK, item)
        item = versions()
        item["binary_sha256"][runtime.ISOLATE] = "0" * 64
        with self.assertRaises(RuntimeError):
            runtime.validate_versions(LOCK, item)
        item = versions()
        item["binary_sha256"].pop("/usr/local/bin/ingenium-exec")
        with self.assertRaises(RuntimeError):
            runtime.validate_versions(LOCK, item)

    def test_metadata_rejects_all_non_success_duplicate_unknown_or_missing_fields(self):
        self.assertEqual(runtime.successful_metadata(META)["exitcode"], "0")
        for raw in (META + b"exitcode:0\n", META + b"status:XX\n", META + b"cg-oom-killed:1\n",
                    META.replace(b"exitcode:0", b"exitcode:1"), META.replace(b"cg-mem:4096\n", b""),
                    META.replace(b"time:0.003", b"time:NaN")):
            with self.subTest(raw=raw), self.assertRaises(RuntimeError):
                runtime.successful_metadata(raw)

    def test_failure_diagnostics_keep_only_labelled_bounded_prefixes_before_tmpfs_disappears(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "box").mkdir()
            (root / "box" / "stderr").write_bytes(b"X" * 8193)
            with patch.object(runtime, "WORK", root), patch.object(runtime, "Path", side_effect=lambda path: root / "absent" / path.rsplit("/", 1)[-1]):
                info = runtime.diagnostics()
            self.assertEqual(len(info), 1)
            item = info[str(root / "box" / "stderr")]
            self.assertEqual(item["observed_bytes"], 8193)
            self.assertTrue(item["truncated"])
            self.assertEqual(base64.b64decode(item["prefix_b64"]), b"X" * 4096)

    def test_observer_requires_real_ids_descriptor_limit_and_both_cgroups(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            memory, cpu, proc = root / "memory", root / "cpu", root / "proc"
            for path in (memory, cpu, proc / "42"):
                path.mkdir(parents=True)
            (memory / "tasks").write_text("42\n")
            status = "Uid:\t60000\t60000\t60000\t60000\nGid:\t60000\t60000\t60000\t60000\n"
            for scenario in ("valid", "wrong_uid", "wrong_gid", "wrong_files", "wrong_cpu", "wrong_command", "exited"):
                (cpu / "tasks").write_text("43\n" if scenario == "wrong_cpu" else "42\n")
                (proc / "42" / "comm").write_text("other\n" if scenario == "wrong_command" else "java\n")
                content = status.replace("Uid:\t60000", "Uid:\t0") if scenario == "wrong_uid" else status
                if scenario == "wrong_gid":
                    content = content.replace("Gid:\t60000", "Gid:\t0")
                (proc / "42" / "status").write_text(content)
                (proc / "42" / "limits").write_text("Max open files            512                  512                  files     \n" if scenario == "wrong_files"
                                                       else "Max open files            256                  256                  files     \n")
                if scenario == "exited":
                    (proc / "42" / "comm").unlink()
                with self.subTest(scenario=scenario), patch.object(runtime, "MEMORY", memory), patch.object(runtime, "CPU", cpu), patch.object(runtime, "Path", side_effect=lambda path: proc if path == "/proc" else Path(path)):
                    if scenario in ("wrong_uid", "wrong_gid", "wrong_files"):
                        with self.assertRaises(RuntimeError):
                            runtime.identity_seen(["java"])
                    else:
                        self.assertEqual(runtime.identity_seen(["java"]), scenario == "valid")

    def test_actual_phase_orchestration_keeps_fresh_groups_fixed_limits_and_launcher(self):
        for name, compiling in (("c", True), ("java", True), ("java", False), ("python", False), ("javascript", False)):
            with self.subTest(name=name), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                memory, cpu, work, temporary = [root / part for part in ("memory", "cpu", "work", "tmp")]
                temporary.mkdir()
                profile = LOCK["profiles"][name]
                calls = []
                def fixed_command(args):
                    calls.append(args)
                    if args[-1] == "--init":
                        for path in (memory, cpu, work / "box"):
                            path.mkdir(parents=True)
                        return str(work)
                    self.assertEqual(args[-1], "--cleanup")
                    for path in (memory, cpu, work):
                        self.assertTrue(path.resolve().is_relative_to(root.resolve()))
                        for file in path.rglob("*"):
                            if file.is_file():
                                file.chmod(0o600)
                        shutil.rmtree(path)
                    return ""
                def fake_popen(args, **kwargs):
                    self.assertIn("/usr/local/bin/ingenium-exec", args)
                    self.assertIn("--processes=64", args)
                    self.assertIn("--extra-time=0", args)
                    self.assertIn("--stack=65536", args)
                    if name == "java":
                        self.assertIn("--env=LD_LIBRARY_PATH=/usr/local/lib64:/usr/local/lib:/usr/local/java/lib:/usr/local/java/lib/server", args)
                        self.assertIn("--dir=/usr", args)
                    self.assertFalse(any(value.startswith("--mem=") for value in args))
                    cap = 1073741824 if compiling else 536870912
                    self.assertIn(f"--cg-mem={cap // 1024}", args)
                    for field, value in {"memory.limit_in_bytes": cap, "memory.memsw.limit_in_bytes": cap,
                                         "memory.max_usage_in_bytes": 4194304, "memory.failcnt": 0,
                                         "memory.memsw.failcnt": 0, "tasks": ""}.items():
                        (memory / field).write_text(str(value))
                    (cpu / "tasks").write_text("")
                    (cpu / "cpuacct.usage").write_text("3000000")
                    (work / "box" / "stdout").write_bytes(b"" if compiling else b"12\n")
                    (work / "box" / "stderr").write_bytes(b"")
                    (temporary / "profile.meta").write_bytes(META)
                    if compiling:
                        (work / "box" / profile["artifact"]).write_bytes(b"fixed artifact not executed")
                    return Mock(poll=Mock(side_effect=[None, 0]), returncode=0)
                def mapped(path):
                    return temporary / str(path)[5:] if str(path).startswith("/tmp/") else temporary if str(path) == "/tmp" else Path(path)
                with patch.object(runtime, "MEMORY", memory), patch.object(runtime, "CPU", cpu), patch.object(runtime, "WORK", work), patch.object(runtime, "Path", side_effect=mapped), patch.object(runtime, "command", side_effect=fixed_command), patch.object(runtime.subprocess, "Popen", side_effect=fake_popen), patch.object(runtime, "identity_seen", return_value=True), patch.object(runtime.time, "sleep"):
                    result = runtime.phase(profile, compiling=compiling, stdin=b"7 5\n")
                self.assertTrue(result["identity_checked"])
                self.assertEqual([call[-1] for call in calls], ["--init", "--cleanup"])
                self.assertFalse(work.exists() or memory.exists() or cpu.exists())
                if compiling:
                    self.assertTrue((temporary / profile["artifact"]).is_file())

    def test_parity_parser_requires_five_profiles_fifteen_exact_answers_and_cleanup(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "parity.log"
            path.write_bytes(log_bytes())
            with contextlib.redirect_stdout(io.StringIO()):
                observed, results = suite.parse_log(path, LOCK)
            self.assertEqual(observed, versions())
            self.assertEqual(len(results), 5)
            for scenario in ("order", "output", "input", "source", "compiler", "counter", "incomplete", "cleanup"):
                rows = records()
                if scenario == "order": rows.reverse()
                elif scenario == "output": rows[0]["cases"][0]["stdout_b64"] = "Mg=="
                elif scenario == "input": rows[0]["cases"][0]["stdin_b64"] = ""
                elif scenario == "source": rows[0]["source_sha256"] = "0" * 64
                elif scenario == "compiler": rows[-1]["compile"] = phase()
                elif scenario == "counter": rows[0]["cases"][0]["cpu_ns"] = True
                elif scenario == "incomplete": rows.pop()
                raw = log_bytes(rows)
                if scenario == "cleanup": raw = raw.replace(b"PASS: host test groups and temporary files removed", b"missing")
                path.write_bytes(raw)
                with self.subTest(scenario=scenario), self.assertRaises(RuntimeError), contextlib.redirect_stdout(io.StringIO()):
                    suite.parse_log(path, LOCK)

    def test_manifest_key_sorting_does_not_change_the_fixed_profile_result_order(self):
        frozen = json.loads(json.dumps(LOCK, sort_keys=True))
        self.assertNotEqual(list(frozen["profiles"]), list(LOCK["profiles"]))
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "saved.log"
            path.write_bytes(log_bytes())
            with contextlib.redirect_stdout(io.StringIO()):
                observed, results = suite.parse_log(path, frozen)
            self.assertEqual(observed, versions())
            self.assertEqual([row["profile"] for row in results], ["c", "cpp", "java", "python", "javascript"])
            path.write_bytes(log_bytes(list(reversed(records()))))
            with self.assertRaises(RuntimeError), contextlib.redirect_stdout(io.StringIO()):
                suite.parse_log(path, frozen)

    def test_read_only_snapshot_requires_nine_finished_records_and_no_writes(self):
        good = {"count": 9, "complete": True, "sha256": "a" * 64}
        with patch.object(suite.lab, "db", return_value=good) as db:
            self.assertEqual(suite.snapshot(), "a" * 64)
            self.assertEqual(db.call_args.kwargs, {})
        self.assertNotIn("UPDATE", suite.SNAPSHOT_SQL)
        for changed in (dict(good, count=10), dict(good, complete=False), dict(good, sha256="wrong")):
            with patch.object(suite.lab, "db", return_value=changed), self.assertRaises(RuntimeError):
                suite.snapshot()

    def test_build_only_pulls_locked_images_and_builds_without_network_or_service_start(self):
        inspected = [b"linux|amd64"] * 5 + [f"{IMAGE}|linux|amd64|65534:65534|1|{'a' * 64}".encode()]
        with patch.object(suite, "logged") as logged, patch.object(suite.lab, "run", side_effect=inspected), contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(suite.build(Mock(), LOCK, "a" * 64), IMAGE)
        self.assertEqual(logged.call_count, 5)
        for call, source in zip(logged.call_args_list, LOCK["images"].values()):
            self.assertEqual(call.args[2], ["docker", "pull", "--platform", "linux/amd64", source["image"]])
        args = logged.call_args_list[-1].args[2]
        self.assertIn("--network=none", args)
        self.assertIn("--pull=false", args)
        self.assertIn("BUNDLE_SHA256=" + "a" * 64, args)
        self.assertNotIn("run", args)

    def test_cached_build_never_pulls_and_keeps_the_old_tag_separate(self):
        inspected = [b"linux|amd64"] * 5 + [f"{IMAGE}|linux|amd64|65534:65534|1|{'a' * 64}".encode()]
        with patch.object(suite, "logged") as logged, patch.object(suite.lab, "run", side_effect=inspected), contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(suite.build(Mock(), LOCK, "a" * 64, cached=True), IMAGE)
        logged.assert_called_once()
        self.assertEqual(logged.call_args.args[1], "build")
        self.assertIn("--network=none", logged.call_args.args[2])
        self.assertIn("--pull=false", logged.call_args.args[2])
        self.assertEqual(suite.TAG, "ingenium/judge0-spike:profiles-v2")
        self.assertEqual(suite.CHECKPOINT, "profiles-v2")

    def test_manifest_is_written_only_after_parity_cleanup_and_unchanged_lab(self):
        for unchanged in (True, False):
            with self.subTest(unchanged=unchanged), tempfile.TemporaryDirectory() as directory:
                journal = Mock(directory=Path(directory))
                with patch.object(suite, "build", return_value=IMAGE) as build, patch.object(suite, "logged", return_value=Path(directory) / "parity.log") as logged, patch.object(suite, "parse_log", return_value=(versions(), records())), patch.object(suite, "snapshot", return_value="old" if unchanged else "changed"), patch.object(suite.lab, "redis", return_value=b"empty"), patch.object(suite.failure, "private_file", return_value=b"MAINTENANCE_MODE=true\nAUTHN_TOKEN=" + b"c" * 64 + b"\n"), patch.object(suite.lab, "private_ip", return_value="172.20.0.4"), patch.object(suite.lab.api, "check_api") as api, patch.object(suite.lab, "sync_directory"), contextlib.redirect_stdout(io.StringIO()):
                    if unchanged:
                        suite.run(journal, LOCK, "a" * 64, "old")
                        manifest = json.loads((Path(directory) / "runtime-manifest.json").read_bytes())
                        self.assertEqual(manifest["image_id"], IMAGE)
                        self.assertEqual(manifest["preserved_lab_sha256"], "old")
                        self.assertEqual(len(manifest["parity"]), 5)
                        self.assertNotIn("c" * 64, json.dumps(manifest))
                        api.assert_called_once()
                        self.assertEqual(journal.record.call_args.args, ("COMPLETE",))
                    else:
                        with self.assertRaises(RuntimeError):
                            suite.run(journal, LOCK, "a" * 64, "old")
                        self.assertFalse((Path(directory) / "runtime-manifest.json").exists())
                    build.assert_called_once()
                    self.assertEqual(logged.call_args.args[2], ["/bin/bash", str(suite.HERE / "cgroup-smoke.sh"), "--profiles", IMAGE])

    def test_existing_profile_checkpoint_blocks_build_before_private_reads(self):
        root = MagicMock()
        root.lstat.return_value = SimpleNamespace(st_uid=0, st_mode=0o40700)
        root.__truediv__.return_value.exists.return_value = True
        with patch.object(suite.platform, "system", return_value="Linux"), patch.object(suite.socket, "gethostname", return_value="ingenium-judge-spike-01"), patch.object(suite.os, "geteuid", return_value=0, create=True), patch.object(suite.os, "umask"), patch.object(suite.signal, "signal"), patch.object(suite.lab, "RUNTIME", root), patch.object(suite, "build") as build, patch.object(suite, "completed_baseline") as baseline, contextlib.redirect_stderr(io.StringIO()):
            self.assertEqual(suite.main([]), 1)
            build.assert_not_called()
            baseline.assert_not_called()

    def test_wrong_machine_or_arguments_cannot_build_or_read_private_files(self):
        for system, host, uid, args in (("Windows", "ingenium-judge-spike-01", 0, []),
                                        ("Linux", "cloudshell", 0, []), ("Linux", "ingenium-judge-spike-01", 1000, []),
                                        ("Linux", "ingenium-judge-spike-01", 0, ["--force"])):
            with self.subTest(host=host), patch.object(suite.platform, "system", return_value=system), patch.object(suite.socket, "gethostname", return_value=host), patch.object(suite.os, "geteuid", return_value=uid, create=True), patch.object(suite, "build") as build, patch.object(suite, "completed_baseline") as baseline, contextlib.redirect_stderr(io.StringIO()):
                self.assertEqual(suite.main(args), 1)
                build.assert_not_called()
                baseline.assert_not_called()


if __name__ == "__main__":
    unittest.main()
