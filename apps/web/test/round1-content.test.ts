import assert from "node:assert/strict";
import { test } from "node:test";
import { roundOnePack, roundOneBugs } from "../../../content/round-1/load";
test("Protocol Rebellion has 50 distinct four-language missions and the approachable three-hour difficulty bands", () => {
  const qs = roundOnePack.questions;
  assert.equal(qs.length, 50);
  assert.deepEqual(roundOnePack.languages, ["c", "cpp", "java", "python"]);
  for (const field of ["id", "title", "slug"] as const)
    assert.equal(new Set(qs.map((q) => q[field])).size, 50);
  assert.deepEqual(
    ["ARRAYS", "SYSTEMS", "GRAPHS", "LOGIC"].map(
      (c) => qs.filter((q) => q.category === c).length,
    ),
    [13, 13, 12, 12],
  );
  assert.deepEqual(
    [
      qs.filter((q) => q.difficulty <= 20).length,
      qs.filter((q) => q.difficulty > 20 && q.difficulty <= 30).length,
      qs.filter((q) => q.difficulty > 30 && q.difficulty <= 40).length,
    ],
    [35, 10, 5],
  );
  for (const category of ["ARRAYS", "SYSTEMS", "GRAPHS", "LOGIC"])
    assert.ok(
      qs.filter((q) => q.category === category && q.difficulty <= 20).length >=
        7,
    );
  assert.equal(
    new Set(qs.map((q) => q.variants.c.defect_description)).size,
    50,
  );
  for (const q of qs) {
    assert.equal(q.base_bounty, q.difficulty * 50);
    assert.ok(q.difficulty >= 1 && q.difficulty <= 40);
    assert.equal(q.round_type, 1);
    assert.equal(q.submission_format, "FULL_PROGRAM");
    for (const section of [
      "PROTOCOL REBELLION",
      "What the code should do",
      "What's going wrong",
      "How to read the code",
      "Repair the program",
      "Input",
      "Output",
      "Example explained",
      "Limits",
      "You can solve this mission on its own",
    ])
      assert.ok(q.statement.includes(section), q.slug + section);
    assert.match(q.statement, /AEGIS/);
    assert.match(q.statement, /security AI/);
    assert.match(
      q.statement,
      /do not need to write a new program or a faster algorithm/,
    );
    assert.equal(q.hints.length, 3);
    assert.deepEqual(
      q.hints.map((h) => h.level),
      [1, 2, 3],
    );
    assert.equal(new Set(q.hints.map((h) => h.content)).size, 3);
    assert.equal(q.cases.filter((c) => c.visibility === "SAMPLE").length, 2);
    assert.ok(q.cases.filter((c) => c.visibility === "HIDDEN").length >= 4);
    assert.deepEqual(Object.keys(q.variants), roundOnePack.languages);
    for (const v of Object.values(q.variants)) {
      assert.ok(
        q.cases.some(
          (c) =>
            c.position === v.witness_case_position && c.visibility === "HIDDEN",
        ),
      );
      assert.notEqual(v.starter_code, v.reference_solution_code, q.slug);
      assert.ok(v.defect_description.trim());
      for (const code of [v.starter_code, v.reference_solution_code]) {
        assert.ok(code.isWellFormed() && Buffer.byteLength(code) <= 131072);
        assert.doesNotMatch(code, /\b(ARRAY|READ|WORD|OUT|SAY|LEN|CHAR)\(/);
      }
    }
    assert.match(q.variants.java.starter_code, /public class Main/);
    assert.match(q.variants.c.starter_code, /int main\(void\)/);
  }
});

test("all starter/reference variants use readable blocks and one statement per line", () => {
  for (const q of roundOnePack.questions) {
    for (const [language, variant] of Object.entries(q.variants)) {
      for (const source of [
        variant.starter_code,
        variant.reference_solution_code,
      ]) {
        assert.doesNotMatch(source, /\t|\r/, q.slug + "/" + language);
        for (const line of source.split("\n")) {
          const withoutStrings = line.replace(
            /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g,
            "",
          );
          if (language === "python") {
            assert.ok(!withoutStrings.includes(";"), q.slug + ": " + line);
            assert.equal((line.match(/^ */)?.[0].length ?? 0) % 4, 0);
          } else {
            assert.doesNotMatch(
              withoutStrings,
              /;\s*(?:int\b|return\b|if\b|for\b|while\b|printf\b|cout\b|System\b|[a-z_]\w*\s*=(?!=))/,
              q.slug + ": " + line,
            );
          }
        }
      }
    }
  }
});
test("content previews receive independent metadata without solutions, hidden cases or unpurchased hints", () => {
  const one = roundOneBugs(),
    two = roundOneBugs();
  assert.equal(one.length, 50);
  assert.doesNotMatch(
    JSON.stringify(one),
    /reference_solution|defect_description|HIDDEN|hints|starter_code/,
  );
  one[0].captured = true;
  one[1].claimed = true;
  assert.ok(two.every((b) => !b.captured && !b.claimed && b.hint_tier === 0));
});
