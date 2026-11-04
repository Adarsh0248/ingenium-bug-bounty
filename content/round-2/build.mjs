import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { languages, program, mutate } from "../programs.mjs";
import { statementFor } from "../statement.mjs";
import { arrays } from "./revision-easy/arrays.mjs";
import { systems } from "./revision-easy/systems.mjs";
import { graphs } from "./revision-easy/graphs.mjs";
import { logic } from "./revision-easy/logic.mjs";
import { scannerSection } from "./scanner.mjs";
import { arraysScanner } from "./revision-easy/scanner-arrays.mjs";
import { systemsScanner } from "./revision-easy/scanner-systems.mjs";
import { graphsScanner } from "./revision-easy/scanner-graphs.mjs";
import { logicScanner } from "./revision-easy/scanner-logic.mjs";

const scannerSections = {
  ...arraysScanner,
  ...systemsScanner,
  ...graphsScanner,
  ...logicScanner,
};

const groups = [
  ["ARRAYS", arrays],
  ["SYSTEMS", systems],
  ["GRAPHS", graphs],
  ["LOGIC", logic],
];
const originals = JSON.parse(
  await readFile(new URL("../round-1/pack.json", import.meta.url), "utf8"),
);
const authored = groups.flatMap(([category, questions], group) => {
  assert.equal(questions.length, 25, category);
  assert.deepEqual(
    [
      questions.filter((q) => q.difficulty >= 1 && q.difficulty <= 20).length,
      questions.filter((q) => q.difficulty >= 21 && q.difficulty <= 30).length,
      questions.filter((q) => q.difficulty >= 31 && q.difficulty <= 40).length,
    ],
    group < 2 ? [18, 5, 2] : [17, 5, 3],
    category,
  );
  return questions.map((q) => ({ ...q, category }));
});
const questions = authored.map((q, index) => {
  const slug = q.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-$/, "");
  for (const field of [
    "title",
    "guide",
    "incident",
    "symptom",
    "task",
    "input",
    "output",
    "example",
    "constraints",
    "defect",
  ])
    assert.ok(
      typeof q[field] === "string" && q[field].trim(),
      `${q.title}: ${field}`,
    );
  assert.ok(
    Number.isInteger(q.difficulty) && q.difficulty >= 1 && q.difficulty <= 40,
  );
  assert.equal(q.hints.length, 3);
  assert.equal(new Set(q.hints).size, 3);
  assert.ok(q.cases.length >= 8 && q.cases.length <= 20, q.title);
  assert.ok(
    Number.isInteger(q.witness) && q.witness > 2 && q.witness <= q.cases.length,
    `${q.title}: hidden witness`,
  );
  assert.equal(
    new Set(q.cases.map(([input]) => input.trim())).size,
    q.cases.length,
    `${q.title}: duplicate inputs`,
  );
  assert.ok(
    Array.isArray(q.probe) &&
      q.probe.length === 2 &&
      q.probe.every((v) => typeof v === "string"),
    `${q.title}: separate paid edge example`,
  );
  const tokens = (input) => input.trim().split(/\s+/).join(" ");
  assert.ok(
    !q.cases.some(([input]) => tokens(input) === tokens(q.probe[0])),
    `${q.title}: paid example must not reuse a judging input`,
  );
  const variants = Object.fromEntries(
    languages.map((language) => {
      const body = language === "python" ? q.py : q.c;
      return [
        language,
        {
          starter_code: program(
            mutate(body, language === "python" ? q.pybug : q.cbug),
            language,
          ),
          reference_solution_code: program(body, language),
          defect_description: q.defect,
          witness_case_position: q.witness,
        },
      ];
    }),
  );
  return {
    id: `21000000-0000-4000-8000-${String(1000 + index).padStart(12, "0")}`,
    slug,
    title: q.title,
    round_type: 2,
    category: q.category,
    region: "The Kernel Breach",
    difficulty: q.difficulty,
    base_bounty: 250 + 10 * Math.round((q.difficulty - Math.min(...authored.map(q => q.difficulty))) * 75 / (40 - Math.min(...authored.map(q => q.difficulty)))),
    submission_format: "FULL_PROGRAM",
    checker_mode: "TOKENS",
    statement: statementFor(q, 2),
    hints: q.hints.map((content, i) => ({ level: i + 1, content })),
    variants,
    paid_intel: {
      probe: {
        input_data: q.probe[0].trimEnd() + "\n",
        expected_output: q.probe[1].trimEnd() + "\n",
      },
      scanner: Object.fromEntries(
        languages.map((language) => [
          language,
          scannerSection(
            q,
            language,
            variants[language].starter_code,
            scannerSections[slug],
          ),
        ]),
      ),
    },
    cases: q.cases.map(([input_data, expected_output], i) => ({
      position: i + 1,
      visibility: i < 2 ? "SAMPLE" : "HIDDEN",
      input_data: input_data.trimEnd() + "\n",
      expected_output: expected_output.trimEnd() + "\n",
    })),
  };
});
assert.equal(
  Object.keys(scannerSections).length,
  questions.length,
  "Scanner catalogue must match the missions",
);
for (const field of ["id", "slug", "title"])
  assert.equal(
    new Set(questions.map((q) => q[field])).size,
    100,
    `Repeated ${field}`,
  );
assert.equal(
  new Set(questions.map((q) => q.variants.c.defect_description)).size,
  100,
  "Repeated defect descriptions",
);
const oldTitles = new Set(originals.questions.map((q) => q.title));
for (const q of questions)
  assert.ok(!oldTitles.has(q.title), `Round 1 title reused: ${q.title}`);
const packed =
  JSON.stringify(
    {
      title: "Protocol Rebellion: The Kernel Breach",
      round_type: 2,
      languages,
      questions,
    },
    null,
    2,
  ) + "\n";
const digest = createHash("sha256").update(packed).digest("hex");
await writeFile(new URL("pack.json", import.meta.url), packed);
const previous = JSON.parse(
  await readFile(
    new URL("validation-summary.json", import.meta.url),
    "utf8",
  ).catch((error) => {
    if (error.code === "ENOENT") return "null";
    throw error;
  }),
);
if (previous?.pack_sha256 !== digest)
  await writeFile(
    new URL("validation-summary.json", import.meta.url),
    JSON.stringify(
      {
        scope: "TRUSTED_LOCAL_CONTENT_CHECKS",
        pack_sha256: digest,
        passed: false,
        state: "RECHECK_REQUIRED",
        production_judge_validated: false,
        human_pilot_difficulty_reviewed: false,
      },
      null,
      2,
    ) + "\n",
  );
const table = questions
  .map(
    (q, i) =>
      `| ${i + 1} | ${q.category} | ${q.title} | ${q.difficulty} | ${q.base_bounty} | ${q.variants.c.defect_description} |`,
  )
  .join("\n");
await writeFile(
  new URL("README.md", import.meta.url),
  `# Protocol Rebellion — Round 2\n\nPrivate organiser content. Never copy this directory into public assets.\n\n100 independent debugging missions in The Kernel Breach, with 25 per topic and four equivalent language variants: C, C++, Java and Python. There are 70 questions at 1–20, 20 at 21–30 and 10 at 31–40, matching the easier Round 1 style requested after the first event. Ratings are authoring targets, not measured pilot difficulty.\n\nEach mission provides a plain-English incident, exact expected behaviour, buggy program, code-reading guide, two samples, at least six hidden tests and three progressive hints. Bounties range from 250–1,000 coins independently of difficulty so Round 2 shop items remain affordable. Round 2's additional hint costs stay 10%, 30%, 80%, with winning score multipliers 90%, 70%, 50%. Existing hint percentages, winning score multipliers and shop prices stay unchanged.\n\nUse the [question book](questions.md) for review and [validation summary](validation-summary.json) for exact local check scope. Local compiler checks do not publish questions or verify the production judge. Organiser review, language-fairness pilots and protected publication validation are still required.\n\nRebuild: \`npm.cmd run content:round2:build\`. Authored bodies keep explicit four-space blocks and one statement per line; no external formatter is required. Verify all organiser-authored programs: \`npm.cmd run content:round2:verify\` (GCC, G++, Java and Python required). Detailed reports and temporary binaries go under ignored \`apps/api/test-results/round2-validation/\`.\n\n| # | Topic | Mission | Difficulty | Bounty | Private defect |\n| --- | --- | --- | ---: | ---: | --- |\n${table}\n`,
);
const book = questions
  .map(
    (q, i) =>
      `## ${i + 1}. ${q.title}\n\n${q.category} · Difficulty ${q.difficulty} · Bounty ${q.base_bounty}\n\n${q.statement}\n\n### Public samples\n\n` +
      q.cases
        .filter((c) => c.visibility === "SAMPLE")
        .map(
          (c, n) =>
            `Sample ${n + 1} input:\n\n\`\`\`text\n${c.input_data}\`\`\`\n\nExpected output:\n\n\`\`\`text\n${c.expected_output}\`\`\`\n`,
        )
        .join("\n") +
      "\n### Progressive hints (private until purchased)\n\n" +
      q.hints.map((h) => `${h.level}. ${h.content}`).join("\n") +
      "\n\n" +
      languages
        .map(
          (language) =>
            `### ${language} buggy starter\n\n\`\`\`${language}\n${q.variants[language].starter_code}\`\`\`\n`,
        )
        .join("\n"),
  )
  .join("\n---\n\n");
await writeFile(
  new URL("questions.md", import.meta.url),
  "# Protocol Rebellion — Round 2 organiser review book\n\nPrivate draft: includes unpurchased hints. References and hidden cases are in pack.json.\n\n" +
    book.trimEnd() +
    "\n",
);
console.log(
  `Built ${questions.length} missions, ${questions.length * languages.length} starter/reference pairs; SHA256=${digest}`,
);
