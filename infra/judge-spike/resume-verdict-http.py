import base64
import copy
import importlib.util
import os
from pathlib import Path
import platform
import signal
import socket
import subprocess
import sys
import time


HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("retained_verdict_http", HERE / "verdict-http.py")
batch = importlib.util.module_from_spec(spec)
spec.loader.exec_module(batch)
lab, transport, guard, require = batch.lab, batch.transport, batch.guard, batch.require
FIX = batch.DIRECTORY / "admission-fix-v1"
SCOPE = "resume-eight-unstarted-verdict-admissions-v1"
ORIGINAL_CONTEXT = batch.context
EXISTING = tuple(case["id"] for case in batch.cases.CASES[:8])
ORIGINAL_FILES = ("journal.jsonl", "context.json", "admission-context.json", "creator.log")


def original_files():
    result = {}
    for name in ORIGINAL_FILES:
        path = batch.DIRECTORY / name
        raw = (transport.failure.private_file(path, 1000, 999, 0o400, transport.MAX_WIRE)
               if name == "admission-context.json" else transport.private(path))
        result[name] = batch.previous.digest(raw)
    return result


def corrected(original):
    value = copy.deepcopy(original)
    case = next(case for case in batch.cases.CASES if case["id"] == "cpp-wall")
    item = value["jobs"][case["id"]]
    require(case["wall_ms"] == 300 and item["payload"]["wall_time_limit"] == 0.3,
            "Unexpected wall fixture; this continuation only repairs the rejected 300 ms envelope.")
    # Judge0's model minimum is one second; the frozen sandbox still enforces 300 ms.
    item["payload"]["wall_time_limit"] = 1
    item["binding"]["payload_sha256"] = batch.payload_hash(case, item["payload"], value)
    return value


def verify_journal(original):
    rows = [lab.decode_json(line) for line in transport.private(batch.DIRECTORY / "journal.jsonl").splitlines()]
    events = [(row.get("event"), row.get("case_id")) for row in rows]
    expected = [(name, None) for name in ("PREPARED", "SCHEMA_CREATE_STARTED", "SCHEMA_CREATED", "CREATOR_ALLOCATING", "CREATOR_ALLOCATED")]
    expected += [(event, name) for name in EXISTING for event in ("HTTP_SEND_STARTED", "HTTP_RECONCILED")]
    expected += [("HTTP_SEND_STARTED", "cpp-wall"), ("CREATOR_REMOVED", None)]
    require(events == expected and rows[0]["preserved"] == original["preserved"]
            and rows[0]["fingerprints"] == original["fingerprints"], "Retained journal is not the diagnosed unstarted failure.")
    for row in rows:
        if row["event"] == "HTTP_SEND_STARTED":
            require(row["binding"] == original["jobs"][row["case_id"]]["binding"], "Original send binding differs.")
    container = rows[4]["container"]
    guard.digest(container)
    require(lab.run("docker", "ps", "-a", "--no-trunc", "--filter", "id=" + container, "--format", "{{.ID}}") == b"",
            "Original admission container still exists; inspect without removing it.")
    return {row["case_id"]: {key: row[key] for key in ("token", "submission_id")} for row in rows if row["event"] == "HTTP_RECONCILED"}


def unstarted(value, count):
    sql = ("SELECT json_build_object('count', count(*), 'unstarted', count(*) FILTER (WHERE state = 'PREPARED' "
           "AND permit_count = 0 AND owner_id IS NULL AND started_at IS NULL AND dispatched_at IS NULL "
           "AND evidence_json IS NULL AND evidence_sha256 IS NULL AND sealed_at IS NULL "
           "AND held_evidence_json IS NULL AND held_evidence_sha256 IS NULL AND held_at IS NULL), "
           f"'providers', (SELECT count(*) FROM submissions)) FROM {batch.TABLE};")
    require(lab.db(sql) == {"count": count, "unstarted": count, "providers": 15 + count},
            "Admission inventory or execution state changed; no reset or retry is allowed.")
    rows = {}
    for case in batch.cases.CASES[:count]:
        item = value["jobs"][case["id"]]
        row = transport.flow.row_for(item["binding"])
        predicate = lab.payload_guard(row["token"], payload=item["payload"], total=15 + count)
        require(lab.db("SELECT json_build_object('valid', EXISTS (SELECT 1 FROM submissions WHERE "
                       f"id = {row['submission_id']} AND status_id = 1 AND stdout IS NULL AND stderr IS NULL "
                       "AND compile_output IS NULL AND time IS NULL AND wall_time IS NULL AND memory IS NULL "
                       "AND exit_code IS NULL AND exit_signal IS NULL AND message IS NULL AND " + predicate + "));") == {"valid": True},
                "Queued provider source, limits or status differ.")
        rows[case["id"]] = row
    require(len({row["token"] for row in rows.values()}) == count, "Duplicate provider associations.")
    return rows


def existing_digest(value):
    ids = ", ".join("'" + guard.uuid_value(value["jobs"][name]["binding"]["attempt_id"]) + "'" for name in EXISTING)
    result = lab.db("SELECT json_build_object('count', count(*), 'sha256', "
        "encode(sha256(convert_to(jsonb_agg(jsonb_build_object('attempt', to_jsonb(a), 'provider', to_jsonb(s)) "
        "ORDER BY a.attempt_id)::text, 'UTF8')), 'hex')) "
        f"FROM {batch.TABLE} a JOIN submissions s ON s.id = a.submission_id WHERE a.attempt_id IN ({ids});")
    require(result["count"] == 8, "Missing original eight associations.")
    guard.digest(result["sha256"])
    return result


VALIDATE_RUBY = """require './config/environment'
require 'json'
require 'base64'
abort 'Read-only validation was not enabled' unless ActiveRecord::Base.connection.select_value('SHOW default_transaction_read_only') == 'on'
jobs = JSON.parse(STDIN.read)
abort 'Unexpected fixed inventory' unless jobs.size == 18
jobs.each do |name, item|
  payload = item.fetch('payload').to_h
  %w[source_code stdin].each { |key| payload[key] = Base64.strict_decode64(payload.fetch(key)) }
  record = Submission.new(payload)
  abort "Invalid fixed payload: #{name}: #{record.errors.details.keys.join(',')}" unless record.valid?
end
puts 'PASS: all eighteen corrected payloads satisfy read-only Judge0 model validation'
"""


def validate_payloads(value):
    reply = lab.run("docker", "exec", "-i", "--user", "1000:999", lab.queue.API, "/bin/bash", "-c",
        'set +x; set -euo pipefail; cd /api; source ./scripts/load-config; '
        "export PGOPTIONS='-c default_transaction_read_only=on -c statement_timeout=5000'; exec ruby -e \"$1\"",
        "validate-fixed-verdicts", VALIDATE_RUBY, data=transport.canonical(value["jobs"]))
    success = b"PASS: all eighteen corrected payloads satisfy read-only Judge0 model validation"
    matches = reply.splitlines().count(success)
    require(matches == 1, f"Fixed payload validation reply missing or ambiguous (bytes={len(reply)}, success_lines={matches}); nothing was admitted.")
    print(success.decode("ascii"), flush=True)


def fixed_context():
    original, frozen = ORIGINAL_CONTEXT()
    saved = lab.decode_json(transport.private(FIX / "checkpoint.json"))
    require(set(saved) == {"scope", "original_files", "continuation_sha256", "context_sha256", "existing_rows"}
            and saved["scope"] == SCOPE and saved["original_files"] == original_files()
            and saved["continuation_sha256"] == batch.previous.digest(batch.runtime.regular(HERE / "resume-verdict-http.py", 65536)),
            "Original evidence or continuation source changed.")
    raw = transport.private(FIX / "context.json")
    value = lab.decode_json(raw)
    admission = transport.failure.private_file(FIX / "admission-context.json", 1000, 999, 0o400, transport.MAX_WIRE)
    require(batch.previous.digest(raw) == saved["context_sha256"] and raw == admission
            and transport.canonical(value) == transport.canonical(corrected(original)), "Corrected context differs from the single authorised change.")
    return value, frozen


def lookup(host, token, item, row):
    path = batch.PATH + "/" + item["binding"]["attempt_id"]
    expected = {"token": row["token"], "submission_id": row["submission_id"], "state": "PREPARED", "permit_count": 0,
                "reserved": True, "recovery_required": False, "evidence_sha256": None}
    status, response = transport.request(host, "GET", path, token)
    require(status == 200 and transport.canonical(response) == transport.canonical(expected)
            and transport.request(host, "GET", path + "/evidence", token)[0] == 409, "Unstarted HTTP lookup differs; never POST an uncertain admission again.")


def admit_remaining(host, token, value, rows, journal):
    rows = dict(rows)
    for case in batch.cases.CASES:
        name = case["id"]
        item = value["jobs"][name]
        if name in rows:
            lookup(host, token, item, rows[name])
            journal.record("EXISTING_RECONCILED", case_id=name, **{key: rows[name][key] for key in ("token", "submission_id")})
            continue
        binding = item["binding"]
        require(transport.request(host, "GET", batch.PATH + "/" + binding["attempt_id"], token)[0] == 404
                and lab.db(f"SELECT json_build_object('absent', NOT EXISTS (SELECT 1 FROM {batch.TABLE} WHERE attempt_id = '{binding['attempt_id']}'));") == {"absent": True},
                "Remaining admission is not positively absent; do not POST again.")
        journal.record("HTTP_SEND_STARTED", case_id=name, binding=binding)
        transport.flow.discard_token_reply(host, token, binding)
        row = transport.flow.row_for(binding)
        lookup(host, token, item, row)
        rows[name] = row
        journal.record("HTTP_RECONCILED", case_id=name, token=row["token"], submission_id=row["submission_id"])
    return rows


def dispatch(case, item, row, journal):
    # Keep the frozen dispatch protocol, but start workers through this guarded continuation.
    envelope = lab.db(f"WITH sent AS (UPDATE {batch.TABLE} SET dispatched_at = clock_timestamp() WHERE {guard.where(item['binding'])} "
        "AND dispatched_at IS NULL AND state = 'PREPARED' RETURNING envelope) SELECT COALESCE((SELECT envelope FROM sent), 'null'::jsonb);", write=True)
    require(envelope == row["envelope"], "Outbox send uncertain; do not retry.")
    raw = transport.canonical(envelope)
    journal.record("QUEUE_SEND_STARTED", case_id=case["id"], envelope_sha256=batch.previous.digest(raw))
    require(lab.redis(transport.flow.PUSH_TWO, 0, raw) == b"queued-two", "Queue send uncertain; never repeat it.")
    messages = []
    for count in (2, 1):
        message = lab.redis(lab.PEEK, count)
        lab.validate_message(message, row["submission_id"])
        require(lab.decode_json(message) == envelope and lab.redis(lab.CLAIM, count, message) == b"claimed", "Delivery uncertain; retain evidence.")
        messages.append(message)
    workers = [subprocess.Popen([sys.executable, "-B", str(HERE / "resume-verdict-http.py"), "--worker", case["id"]],
        stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.STDOUT) for _ in messages]
    for process, message in zip(workers, messages):
        process.stdin.write(message + b"\n")
        process.stdin.close()
    codes, deadline = [], time.monotonic() + 510
    for index, process in enumerate(workers):
        code = process.wait(timeout=max(1, deadline - time.monotonic()))
        reply = process.stdout.read(8193)
        guard.private_json(batch.DIRECTORY / f"worker-{case['id']}-{index}.json", {"exit_code": code, "stdout_b64": base64.b64encode(reply).decode("ascii")})
        require(len(reply) <= 8192 and ((code == 75 and reply == b"") or (code == 0 and lab.decode_json(reply) == {"launched": False})), "Worker failed; inspect without retrying.")
        codes.append(code)
    require(sorted(codes) == [0, 75], "Expected one launch and one refused duplicate.")


def main(argv=None):
    args = sys.argv[1:] if argv is None else argv
    if (args != [] and not (len(args) == 2 and args[0] == "--worker" and args[1] in {case["id"] for case in batch.cases.CASES})) or platform.system() != "Linux" or socket.gethostname() != "ingenium-judge-spike-01" or os.geteuid() != 0:
        print("FAIL: fixed continuation modes require sudo on the isolated VM.", file=sys.stderr)
        return 1
    try:
        os.umask(0o077)
        signal.signal(signal.SIGTERM, lab.interrupt)
        batch.previous.streams.active.tree.directory(lab.RUNTIME, 0o700)
        batch.previous.streams.active.tree.directory(batch.DIRECTORY, 0o700)
        if args:
            fixed_context()
            batch.context = fixed_context
            return batch.worker(args[1])
        require(not os.path.lexists(FIX) and {path.name for path in batch.DIRECTORY.iterdir()} == set(ORIGINAL_FILES),
                "Continuation or execution resources already exist; inspect instead of rerunning.")
        lab.queue.check_services()
        require(lab.run("docker", "network", "inspect", lab.NETWORK, "--format", "{{.Internal}}|{{.Driver}}") == b"true|bridge"
                and lab.redis(lab.EMPTY, 0) == b"empty", "Private bridge or idle queue differs.")
        original, frozen = ORIGINAL_CONTEXT()
        files = original_files()
        require(transport.failure.private_file(batch.DIRECTORY / "admission-context.json", 1000, 999, 0o400, transport.MAX_WIRE)
                == transport.private(batch.DIRECTORY / "context.json"), "Original admission context differs.")
        reconciled = verify_journal(original)
        rows = unstarted(original, 8)
        require(reconciled == {name: {key: row[key] for key in ("token", "submission_id")} for name, row in rows.items()}, "Journal associations differ from the database.")
        value = corrected(original)
        existing = existing_digest(original)
        before = original["preserved"]
        require(batch.snapshot(before["files"], owned=True) == before, "Prior fifteen records or evidence changed.")
        config = transport.failure.private_file(lab.RUNTIME / "judge0.conf", 1000, 999, 0o400, 32768)
        _, token = lab.prepare_config(config)
        lab.api.check_api(lab.private_ip(lab.queue.API), token)
        validate_payloads(value)
        journal = lab.Journal(FIX)
        journal.record("PREPARED", original_files=files, existing_rows=existing)
        digest = transport.save(FIX / "context.json", value)
        context_path = FIX / "admission-context.json"
        transport.save(context_path, value)
        os.chown(context_path, 1000, 999)
        os.chmod(context_path, 0o400)
        checkpoint = {"scope": SCOPE, "original_files": files, "continuation_sha256": batch.previous.digest(batch.runtime.regular(HERE / "resume-verdict-http.py", 65536)),
                      "context_sha256": digest, "existing_rows": existing}
        transport.save(FIX / "checkpoint.json", checkpoint)
        fixed_context()
        container, nonce = lab.create_creator(journal, config, server="http-server.sh", mounts=(
            (HERE / "verdict-admission.rb", "/api/config/initializers/ingenium_verdict.rb"), (context_path, "/api/ingenium-verdict-context.json")))
        results = {}
        try:
            lab.run("docker", "start", container)
            host = lab.private_ip(container)
            lab.wait_creator(host, token)
            lab.api.check_api(host, token)
            all_rows = admit_remaining(host, token, value, rows, journal)
            require(unstarted(value, 18) == all_rows and existing_digest(original) == existing, "Original eight rows changed during remaining admissions.")
            journal.record("ADMISSIONS_RECONCILED", existing_rows=existing, count=18)
            print("PASS: eight original unstarted associations unchanged; ten remaining admissions reconciled; no permit reset", flush=True)
            for case in batch.cases.CASES:
                item, row = value["jobs"][case["id"]], all_rows[case["id"]]
                dispatch(case, item, row, journal)
                results[case["id"]] = batch.verify_http(host, token, case, item, row, value, frozen)
        finally:
            lab.stop_creator(container, nonce, journal)
        fixed_context()
        require(batch.snapshot(before["files"], owned=True) == before and lab.redis(lab.EMPTY, 0) == b"empty"
                and lab.db(f"SELECT json_build_object('count', count(*), 'sealed', count(*) FILTER (WHERE state = 'SEALED' AND permit_count = 1 AND evidence_json IS NOT NULL), "
                    "'held', count(*) FILTER (WHERE state = 'STARTED' AND permit_count = 1 AND held_evidence_json IS NOT NULL)) " + f"FROM {batch.TABLE};") == {"count": 18, "sealed": 17, "held": 1},
                "Final verdict inventory, prior evidence or queue differs.")
        lab.queue.check_services()
        lab.api.check_api(lab.private_ip(lab.queue.API), token)
        digest = transport.save(FIX / "evidence.json", {"scope": SCOPE, "checkpoint": checkpoint, "results": results, "preserved": before})
        journal.record("COMPLETE", evidence_sha256=digest, cases=18, new_provider_records=10, sealed=17, held=1)
        print("PASS: thirty-three provider rows retained (fifteen unchanged); seventeen protected verdicts sealed and one uncertain result held; original failed checkpoint preserved; queue empty; maintenance enabled", flush=True)
        return 0
    except KeyboardInterrupt:
        print("FAIL: interrupted; preserve the continuation and all resources without retrying.", file=sys.stderr)
        return 130
    except Exception as error:
        print("FAIL: " + (str(error) if isinstance(error, RuntimeError) else type(error).__name__)
              + " Preserve verdict-http-v1/admission-fix-v1, its records and resources. Do not rerun or reset permits.", file=sys.stderr)
        return 1


if __name__ == "__main__": sys.exit(main())
