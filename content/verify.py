"""Validate only the selected trusted organiser-authored pack, never submissions."""
import concurrent.futures
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

round_arg = next((a for a in sys.argv[1:] if a.startswith("--round=")), "--round=1")
assert round_arg in ("--round=1", "--round=2"), "Choose round 1 or 2"
sys.argv = [a for a in sys.argv if not a.startswith("--round=")]
root = Path(__file__).resolve().parent / ("round-" + round_arg.split("=")[1])
pack_arg = next((a.split("=", 1)[1] for a in sys.argv[1:] if a.startswith("--pack=")), None)
sys.argv = [a for a in sys.argv if not a.startswith("--pack=")]
pack_path = Path(pack_arg).resolve() if pack_arg else root / "pack.json"
raw = pack_path.read_bytes()
pack = json.loads(raw)
assert pack["round_type"] == int(round_arg.split("=")[1]), "Pack must match the selected round"
evidence_name = "round" + str(pack["round_type"]) + "-validation" + ("-" + pack_path.parent.name if pack_arg else "")
out = Path(os.environ.get("INGENIUM_CONTENT_EVIDENCE", str(root.parent.parent / "apps" / "api" / "test-results" / evidence_name)))
out.mkdir(parents=True, exist_ok=True)
tools = {key: shutil.which(name) for key, name in {"c": "gcc", "cpp": "g++", "java": "javac"}.items()}
tools["python"] = sys.executable
java = shutil.which("java")
assert all(tools.values()) and java, "Install local C, C++, Java and Python tools."
versions = {}
for language, tool in tools.items():
    r = subprocess.run([tool, "-version" if language == "java" else "--version"], capture_output=True, text=True, timeout=10)
    versions[language] = (r.stdout + r.stderr).strip().splitlines()[0]
language_filter = next((arg.split("=", 1)[1] for arg in sys.argv[1:] if arg.startswith("--language=")), None)
assert language_filter is None or language_filter in pack["languages"], "Unknown language filter"
sanitizers = "--sanitizers" in sys.argv
selected = {arg for arg in sys.argv[1:] if not arg.startswith("--language=") and arg != "--sanitizers"}
assert selected.issubset({q["slug"] for q in pack["questions"]}), "Unknown mission filter"
jobs = [(q, language) for q in pack["questions"] for language in pack["languages"] if (not selected or q["slug"] in selected) and (language_filter is None or language == language_filter)]
assert jobs, "No content selected"

def check(job):
    q, language = job
    folder = out / q["slug"] / language
    folder.mkdir(parents=True, exist_ok=True)
    result = {"slug": q["slug"], "language": language, "references_passed": 0, "programs_compiled_or_syntax_checked": 0, "probe_passed": None, "starter_failures": [], "source_sha256": {}, "errors": []}
    for role, field in [("reference", "reference_solution_code"), ("starter", "starter_code")]:
        work = folder / role
        work.mkdir(exist_ok=True)
        filename = {"c": "main.c", "cpp": "main.cpp", "java": "Main.java", "python": "main.py"}[language]
        text = q["variants"][language][field]
        source = work / filename
        source.write_text(text, encoding="utf-8", newline="\n")
        result["source_sha256"][role] = hashlib.sha256(text.encode()).hexdigest()
        if language in ("c", "cpp"):
            executable = work / ("program.exe" if os.name == "nt" else "program")
            compile_args = [tools[language], "-std=c17" if language == "c" else "-std=c++17", "-O2", str(source), "-o", str(executable)]
            if sanitizers:
                compile_args[1:1] = ["-fsanitize=undefined,bounds", "-fno-sanitize-recover=all"]
            command = [str(executable)]
        elif language == "java":
            compile_args = [tools[language], "-encoding", "UTF-8", str(source)]
            command = [java, "-Xmx128m", "-cp", str(work), "Main"]
        else:
            compile_args = [tools[language], "-m", "py_compile", str(source)]
            command = [tools[language], str(source)]
        try:
            built = subprocess.run(compile_args, capture_output=True, timeout=60)
        except (OSError, subprocess.TimeoutExpired) as e:
            result["errors"].append({"role": role, "stage": "compile", "error": str(e)})
            continue
        if built.returncode:
            result["errors"].append({"role": role, "stage": "compile", "stderr": built.stderr.decode(errors="replace")[:8192]})
            continue
        result["programs_compiled_or_syntax_checked"] += 1
        checks = list(q["cases"])
        if "paid_intel" in q:
            checks.append({"position": "PROBE", **q["paid_intel"]["probe"]})
        for case in checks:
            try:
                r = subprocess.run(command, input=case["input_data"].encode(), capture_output=True, timeout=8)
                actual = r.stdout.decode("utf-8", errors="strict").replace("\t", " ").replace("\n", " ").replace("\r", " ").replace("\v", " ").replace("\f", " ").split(" ")
                actual = [token for token in actual if token != ""]
                expected = [token for token in case["expected_output"].replace("\t", " ").replace("\n", " ").replace("\r", " ").replace("\v", " ").replace("\f", " ").split(" ") if token != ""]
                matches = r.returncode == 0 and actual == expected
            except (OSError, subprocess.TimeoutExpired, UnicodeDecodeError) as e:
                result["errors"].append({"role": role, "case": case["position"], "error": type(e).__name__})
                continue
            if role == "reference":
                if matches:
                    if case["position"] == "PROBE":
                        result["probe_passed"] = True
                    else:
                        result["references_passed"] += 1
                else:
                    result["errors"].append({"role": role, "case": case["position"], "returncode": r.returncode, "actual": actual[:100], "expected": expected[:100], "stderr": r.stderr.decode(errors="replace")[:2048]})
            else:
                if r.returncode != 0:
                    result["errors"].append({"role": role, "case": case["position"], "returncode": r.returncode, "stderr": r.stderr.decode(errors="replace")[:2048]})
                elif not matches and case["position"] != "PROBE":
                    result["starter_failures"].append(case["position"])
        if role == "starter" and not any(i > 2 for i in result["starter_failures"]):
            result["errors"].append({"role": role, "error": "No intended wrong-output hidden witness"})
        if role == "starter" and q["variants"][language].get("witness_case_position") not in result["starter_failures"]:
            result["errors"].append({"role": role, "error": "Declared hidden witness did not expose the defect"})
    result["passed"] = not result["errors"] and result["references_passed"] == len(q["cases"]) and ("paid_intel" not in q or result["probe_passed"] is True)
    return result

results = []
worker_count = int(os.environ.get("INGENIUM_CONTENT_WORKERS", "4"))
assert 1 <= worker_count <= 8, "Content worker count must be between 1 and 8"
with concurrent.futures.ThreadPoolExecutor(max_workers=worker_count) as workers:
    for result in workers.map(check, jobs):
        results.append(result)
        print(("PASS" if result["passed"] else "FAIL") + ": " + result["slug"] + "/" + result["language"], flush=True)
        if result["errors"]:
            print(json.dumps(result["errors"])[:4096], flush=True)
report = {
    "pack_sha256": hashlib.sha256(raw).hexdigest(),
    "scope": "TRUSTED_LOCAL_CONTENT_CHECKS",
    "production_judge_validated": False,
    "human_pilot_difficulty_reviewed": False,
    "tools": versions,
    "c_cpp_undefined_behavior_checks": sanitizers,
    "question_count": len({r["slug"] for r in results}),
    "variant_count": len(results),
    "programs_compiled_or_syntax_checked": sum(r["programs_compiled_or_syntax_checked"] for r in results),
    "declared_hidden_witnesses_verified": sum(q["variants"][language]["witness_case_position"] in r["starter_failures"] for (q, language), r in zip(jobs, results)),
    "reference_case_runs": sum(r["references_passed"] for r in results),
    "separate_paid_examples_verified": sum(r["probe_passed"] is True for r in results),
    "passed": all(r["passed"] for r in results),
    "results": results,
}
(out / ("report.json" if not selected and language_filter is None else "targeted-report.json")).write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
print(json.dumps({k: v for k, v in report.items() if k != "results"}), flush=True)
raise SystemExit(0 if report["passed"] else 1)
