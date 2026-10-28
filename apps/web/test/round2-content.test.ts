import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { roundTwoPack, roundTwoBugs } from "../../../content/round-2/load";
import { roundOnePack } from "../../../content/round-1/load";

test("Round 2 contains 100 new four-language missions, with balanced topic and difficulty allocations", () => {
  const qs = roundTwoPack.questions;
  assert.equal(qs.length, 100);
  assert.equal(roundTwoPack.round_type, 2);
  assert.deepEqual(roundTwoPack.languages, ["c", "cpp", "java", "python"]);
  for (const field of ["id", "title", "slug"] as const)
    assert.equal(new Set(qs.map((q) => q[field])).size, 100);
  const old = new Set(
    roundOnePack.questions.flatMap((q) => [q.id, q.title, q.slug]),
  );
  for (const q of qs)
    for (const field of ["id", "title", "slug"] as const)
      assert.ok(!old.has(q[field]), q.title);
  assert.equal(
    new Set(qs.map((q) => q.variants.c.defect_description)).size,
    100,
  );
  for (const category of ["ARRAYS", "SYSTEMS", "GRAPHS", "LOGIC"]) {
    const group = qs.filter((q) => q.category === category);
    assert.equal(group.length, 25);
    assert.deepEqual(
      [
        group.filter((q) => q.difficulty >= 25 && q.difficulty <= 45).length,
        group.filter((q) => q.difficulty >= 46 && q.difficulty <= 65).length,
        group.filter((q) => q.difficulty >= 66 && q.difficulty <= 85).length,
        group.filter((q) => q.difficulty >= 86 && q.difficulty <= 100).length,
      ],
      [8, 9, 5, 3],
    );
  }
  assert.equal(Math.min(...qs.map((q) => q.difficulty)), 25);
  assert.equal(Math.max(...qs.map((q) => q.difficulty)), 100);
});

test("every Round 2 mission has independent prose, progressive hints, private witnesses and a separate paid edge example", () => {
  for (const q of roundTwoPack.questions) {
    assert.equal(q.round_type, 2);
    assert.equal(q.region, "The Kernel Breach");
    assert.equal(q.base_bounty, q.difficulty * 10);
    assert.equal(q.submission_format, "FULL_PROGRAM");
    assert.equal(q.checker_mode, "TOKENS");
    for (const section of [
      "security AI",
      "What the code should do",
      "What's going wrong",
      "How to read the code",
      "Input",
      "Output",
      "Example explained",
      "Limits",
      "You can solve this mission on its own",
    ])
      assert.ok(q.statement.includes(section), `${q.slug}: ${section}`);
    assert.deepEqual(
      q.hints.map((h) => h.level),
      [1, 2, 3],
    );
    assert.equal(new Set(q.hints.map((h) => h.content)).size, 3);
    assert.ok(q.hints.every((h) => h.content.trim().length > 20));
    assert.equal(q.cases.filter((c) => c.visibility === "SAMPLE").length, 2);
    assert.ok(
      q.cases.filter((c) => c.visibility === "HIDDEN").length >= 6 &&
        q.cases.length <= 20,
    );
    const inputKey = (s: string) => s.trim().split(/\s+/).join(" ");
    assert.equal(
      new Set(q.cases.map((c) => inputKey(c.input_data))).size,
      q.cases.length,
      q.slug,
    );
    assert.ok(
      !q.cases.some(
        (c) =>
          inputKey(c.input_data) === inputKey(q.paid_intel.probe.input_data),
      ),
      q.slug,
    );
    assert.deepEqual(Object.keys(q.variants), roundTwoPack.languages);
    for (const [language, v] of Object.entries(q.variants)) {
      assert.notEqual(v.starter_code, v.reference_solution_code, q.slug);
      assert.ok(
        q.cases.some(
          (c) =>
            c.visibility === "HIDDEN" && c.position === v.witness_case_position,
        ),
        q.slug,
      );
      assert.ok(v.defect_description.trim());
      const scanner = q.paid_intel.scanner[language as keyof typeof q.variants];
      assert.ok(
        scanner.from_line >= 1 &&
          scanner.to_line >= scanner.from_line &&
          scanner.to_line <= v.starter_code.split("\n").length,
      );
      for (const code of [v.starter_code, v.reference_solution_code]) {
        assert.ok(code.isWellFormed() && Buffer.byteLength(code) <= 131072);
        assert.doesNotMatch(
          code,
          /\b(ARRAY64|ARRAY|TEXT|READ64|READ|WORD|LEN|CHAR|OUT64|OUT|SAY)\(/,
          q.slug,
        );
        assert.doesNotMatch(code, /\t|\r/, q.slug);
        assert.doesNotMatch(
          code,
          /\b(system|exec|fork|ProcessBuilder|subprocess)\s*\(/,
          q.slug,
        );
        for (const line of code.split("\n")) {
          if (line.trimStart().startsWith("#include")) continue;
          assert.equal(
            (line.match(/^ */)?.[0].length ?? 0) % 4,
            0,
            `${q.slug}/${language}: ${line}`,
          );
          const plain = line.replace(
            /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g,
            "",
          );
          if (language === "python")
            assert.ok(!plain.includes(";"), `${q.slug}: ${line}`);
          else
            assert.doesNotMatch(
              plain.replace(/^\s*for\s*\([^)]*\)/, ""),
              /;\s*(?:int\b|long\b|return\b|if\b|for\b|while\b|printf\b|cout\b|System\b|[a-z_]\w*\s*=(?!=))/,
              `${q.slug}/${language}: ${line}`,
            );
        }
      }
    }
  }
  assert.doesNotMatch(
    JSON.stringify(roundTwoBugs()),
    /reference_solution_code|defect_description|expected_output|paid_intel|hints|HIDDEN/,
  );
});

test("the Round 2 validation summary binds its result to the exact current pack bytes", () => {
  const raw = readFileSync(
    new URL("../../../content/round-2/pack.json", import.meta.url),
  );
  const evidence = JSON.parse(
    readFileSync(
      new URL(
        "../../../content/round-2/validation-summary.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  assert.equal(
    evidence.pack_sha256,
    createHash("sha256").update(raw).digest("hex"),
  );
  assert.equal(evidence.production_judge_validated, false);
  assert.equal(evidence.human_pilot_difficulty_reviewed, false);
  if (evidence.passed) {
    assert.equal(evidence.variant_count, 400);
    assert.equal(evidence.programs_compiled_or_syntax_checked, 800);
    assert.equal(evidence.declared_hidden_witnesses_verified, 400);
    assert.equal(evidence.separate_paid_examples_verified, 400);
  }
});

test("Hex Scanner reveals useful authored subsystems without a predictable faulty-line slot", () => {
  const offsets = new Map<number, number>();
  for (const q of roundTwoPack.questions) {
    const labels = new Set<string>();
    for (const language of roundTwoPack.languages) {
      const variant = q.variants[language],
        lines = variant.starter_code.split("\n"),
        reference = variant.reference_solution_code.split("\n");
      const scanner = q.paid_intel.scanner[language];
      assert.ok(scanner.label.trim().length >= 5, q.slug);
      labels.add(scanner.label);
      let first = 0,
        tail = 0;
      while (first < lines.length && lines[first] === reference[first]) first++;
      while (
        tail < lines.length - first &&
        tail < reference.length - first &&
        lines.at(-1 - tail) === reference.at(-1 - tail)
      )
        tail++;
      const changed = Array.from(
        { length: Math.max(1, lines.length - tail - first) },
        (_, i) => first + i + 1,
      );
      assert.ok(
        changed.length &&
          changed.every(
            (line) => line >= scanner.from_line && line <= scanner.to_line,
          ),
        q.slug,
      );
      const selected = lines.slice(scanner.from_line - 1, scanner.to_line);
      // Small algorithms still need a meaningful phase, without padding it with input helpers.
      assert.ok(
        selected.filter((line) => line.trim() && !/^[\s{}]+$/.test(line))
          .length >= 4,
        q.slug,
      );
      assert.ok(selected.length >= 4 && selected.length < lines.length, q.slug);
      const offset = changed[0] - scanner.from_line + 1;
      offsets.set(offset, (offsets.get(offset) ?? 0) + 1);
    }
    assert.equal(
      labels.size,
      1,
      "Keep the same subsystem meaning across language choices",
    );
  }
  assert.ok(
    offsets.size >= 10,
    `Fault positions collapsed to ${offsets.size} slots`,
  );
  assert.ok(
    Math.max(...offsets.values()) <= 100,
    "A single faulty-line slot dominates the scanner output",
  );
});
