import assert from "node:assert/strict";
import { test } from "node:test";
import { languages, program, mutate } from "../programs.mjs";
import { scannerSection } from "./scanner.mjs";

const q = {
  title: "Scanner boundary fixture",
  c: "int n;\nREAD(n);\nint total = 0;\nint previous = 0;\nfor (int i = 0; i < n; i++) {\n    int value;\n    READ(value);\n    total += value;\n    previous = value;\n}\nOUT(total);",
  py: "n = read_int()\ntotal = 0\nprevious = 0\nfor i in range(n):\n    value = read_int()\n    total += value\n    previous = value\nprint(total)",
  cbug: ["total += value;", "total -= value;"],
  pybug: ["total += value", "total -= value"],
};
const authored = { label: "Accumulation state", c: [3, 10], python: [2, 7] };
const starter = (question, language) =>
  program(
    mutate(
      language === "python" ? question.py : question.c,
      language === "python" ? question.pybug : question.cbug,
    ),
    language,
  );

test("authored scanner bounds follow the same subsystem through all language wrappers", () => {
  for (const language of languages) {
    const source = starter(q, language),
      section = scannerSection(q, language, source, authored);
    const snippet = source
      .split("\n")
      .slice(section.from_line - 1, section.to_line)
      .join("\n");
    assert.equal(section.label, authored.label);
    assert.ok(snippet.includes("total = 0"));
    assert.ok(snippet.includes("previous = value"));
    assert.ok(snippet.includes("total -= value"));
    assert.doesNotMatch(snippet, /INGENIUM_SCANNER_BODY|total \+= value/);
  }
});
test("moving a fault inside the same authored subsystem never moves its scanner boundaries", () => {
  const another = {
    ...q,
    cbug: ["previous = value;", "previous = 0;"],
    pybug: ["previous = value", "previous = 0"],
  };
  for (const language of languages)
    assert.deepEqual(
      scannerSection(q, language, starter(q, language), authored),
      scannerSection(another, language, starter(another, language), authored),
    );
});

test("a multiline mutation checks its actual span without treating the shifted suffix as faulty", () => {
  const expanded = {
    ...q,
    cbug: ["total += value;", "total -= value;\n    total += 0;"],
    pybug: ["total += value", "total -= value\n    total += 0"],
  };
  const section = { ...authored, c: [3, 11], python: [2, 8] };
  for (const language of languages) {
    const source = starter(expanded, language);
    assert.equal(
      scannerSection(expanded, language, source, section).label,
      authored.label,
    );
    assert.throws(
      () =>
        scannerSection(expanded, language, source, {
          ...section,
          c: [3, 8],
          python: [2, 6],
        }),
      /misses the fault/,
    );
  }
});
test("missing, narrow, out-of-range or stale scanner definitions fail the private build", () => {
  const source = starter(q, "c");
  for (const scope of [
    undefined,
    { ...authored, label: " " },
    { ...authored, c: [4, 6] },
    { ...authored, c: [3, 99] },
    { ...authored, c: [1, 6] },
  ])
    assert.throws(() => scannerSection(q, "c", source, scope));
  assert.throws(
    () => scannerSection(q, "c", source + "edited", authored),
    /source mapping changed/,
  );
});
