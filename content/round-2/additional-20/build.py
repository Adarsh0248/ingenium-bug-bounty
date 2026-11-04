"""Prepare archived organiser questions locally; no database or network access."""
import copy
import hashlib
import json
from pathlib import Path

folder = Path(__file__).resolve().parent
repo = folder.parents[2]
archive = repo / "content" / "round-2" / "archive" / "pack-original.json"
source_hash = "331237452da97700b928b07e9fb9b186643a85c3aa5778b55664be02faaf48cf"
positions = [1, 2, 6, 7, 13, 26, 27, 29, 32, 35, 51, 52, 55, 58, 59, 76, 78, 80, 82, 85]
protected = [repo / "content" / "round-2" / name for name in ("pack.json", "validation-summary.json", "questions.md")]
before = {p: p.read_bytes() for p in protected}
raw = archive.read_bytes()
assert hashlib.sha256(raw).hexdigest() == source_hash, "Archived draft changed"
original = json.loads(raw)
current = json.loads(before[protected[0]])
questions, sources = [], []
for i, position in enumerate(positions, 101):
    source = original["questions"][position - 1]
    q = copy.deepcopy(source)
    # Old draft definitions also contain the current easy versions; future import needs separate definitions.
    q["id"] = f"22000000-0000-4000-8000-{i:012d}"
    assert 20 <= q["difficulty"] <= 50
    assert q["base_bounty"] == 10 * q["difficulty"]
    assert q["round_type"] == 2 and len(q["cases"]) == 8
    assert [c["visibility"] for c in q["cases"]] == ["SAMPLE"] * 2 + ["HIDDEN"] * 6
    assert [h["level"] for h in q["hints"]] == [1, 2, 3]
    assert set(q["variants"]) == set(original["languages"]) == {"c", "cpp", "java", "python"}
    assert q["paid_intel"]["probe"]["input_data"].split() not in [c["input_data"].split() for c in q["cases"]]
    for language in original["languages"]:
        variant = q["variants"][language]
        assert variant["starter_code"] != variant["reference_solution_code"]
        assert variant["witness_case_position"] in range(3, 9)
        scanner = q["paid_intel"]["scanner"][language]
        assert 1 <= scanner["from_line"] <= scanner["to_line"] <= len(variant["starter_code"].splitlines())
    assert {k: v for k, v in q.items() if k != "id"} == {k: v for k, v in source.items() if k != "id"}
    questions.append(q)
    sources.append({"proposed_number": i, "source_position": position, "source_id": source["id"], "import_source_id": q["id"], "slug": q["slug"], "title": q["title"], "category": q["category"], "difficulty": q["difficulty"], "base_bounty": q["base_bounty"]})
assert len(questions) == 20
for key in ("id", "slug", "title"):
    values = {q[key] for q in questions}
    assert len(values) == 20 and not values.intersection(q[key] for q in current["questions"])
assert {category: sum(q["category"] == category for q in questions) for category in ("ARRAYS", "SYSTEMS", "GRAPHS", "LOGIC")} == dict.fromkeys(("ARRAYS", "SYSTEMS", "GRAPHS", "LOGIC"), 5)

def write_json(name, value):
    (folder / name).write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

write_json("pack.json", {"title": "Protocol Rebellion: Additional 20 Archived Missions", "round_type": 2, "languages": original["languages"], "questions": questions})
digest = hashlib.sha256((folder / "pack.json").read_bytes()).hexdigest()
write_json("selection.json", {"state": "LOCAL_ONLY_NOT_IMPORTED", "requested_difficulty": [20, 50], "actual_difficulty": [min(q["difficulty"] for q in questions), max(q["difficulty"] for q in questions)], "source_archive": str(archive.relative_to(repo)).replace("\\", "/"), "source_pack_sha256": source_hash, "pack_sha256": digest, "existing_100_pack_sha256": hashlib.sha256(before[protected[0]]).hexdigest(), "import_policy": "CREATE_NEW_DEFINITIONS_PRESERVE_EXISTING_VERSIONS", "proposed_numbers_are_not_live_ids": True, "questions": sources})
summary = folder / "validation-summary.json"
previous = json.loads(summary.read_text(encoding="utf-8")) if summary.exists() else None
if not previous or previous.get("pack_sha256") != digest:
    write_json("validation-summary.json", {"scope": "TRUSTED_LOCAL_CONTENT_CHECKS", "state": "RECHECK_REQUIRED", "pack_sha256": digest, "passed": False, "production_judge_validated": False, "human_pilot_difficulty_reviewed": False})
table = "\n".join(f'| {s["proposed_number"]} | {s["source_position"]} | {s["category"]} | {s["title"]} | {s["difficulty"]} | {s["base_bounty"]} |' for s in sources)
(folder / "README.md").write_text(f'''# Additional 20 Round 2 questions

Private organiser pack, prepared locally from the preserved earlier draft. Nothing is imported, published or added to the running event. The existing 100-question pack is unchanged.

Difficulty is 25–50, within the requested 20–50 band. Original difficulty and bounty ratings are preserved: 250–500 coins, five questions per topic. Each question has C, C++, Java and Python, two samples, six hidden cases, three progressive hints and separate paid intel. All have eight judging cases to retain the current batch shape. Ratings have not been measured in participant pilots.

Numbers 101–120 are proposed display positions only. The archived definitions were also used for easy replacement versions, so future import must create separate definitions and preserve every existing version. Local import-source IDs do not represent database IDs or validation receipts. See selection.json for exact provenance and SHA256s.

This pack still needs protected judge validation/publication before any live release. The active-round authoring restriction has not been changed. No live rollout is authorised.

Rebuild locally: `python content/round-2/additional-20/build.py`.

Verify with local compilers: `python content/verify.py --round=2 --pack=content/round-2/additional-20/pack.json --sanitizers`. Set `INGENIUM_CONTENT_EVIDENCE` to a separate evidence directory so previous evidence stays intact.

| Proposed # | Earlier draft # | Topic | Question | Difficulty | Bounty |
| --- | --- | --- | --- | ---: | ---: |
{table}
''', encoding="utf-8")
book = []
for s, q in zip(sources, questions):
    text = f'## {s["proposed_number"]}. {q["title"]}\n\n{q["category"]} · Difficulty {q["difficulty"]} · Bounty {q["base_bounty"]}\n\n{q["statement"]}\n\n### Samples\n\n'
    for c in q["cases"][:2]:
        text += f'Input:\n\n```text\n{c["input_data"]}```\n\nOutput:\n\n```text\n{c["expected_output"]}```\n\n'
    text += "### Progressive hints (private)\n\n" + "\n".join(f'{h["level"]}. {h["content"]}' for h in q["hints"]) + "\n\n"
    for language in original["languages"]:
        text += f'### {language} starter\n\n```{language}\n{q["variants"][language]["starter_code"]}```\n\n'
    book.append(text)
(folder / "questions.md").write_text("# Additional 20 — private review book\n\nUnpublished local content; contains paid hints.\n\n" + "\n---\n\n".join(book).rstrip() + "\n", encoding="utf-8")
assert all(p.read_bytes() == value for p, value in before.items()), "Existing content changed"
print(f"Prepared 20 archived questions, difficulty 25–50, SHA256={digest}")
