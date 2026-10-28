import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { statementFor } from "./statement.mjs";
import { neon } from "./round-1/neon.mjs";
import { silicon } from "./round-1/silicon.mjs";
import { nexus } from "./round-1/nexus.mjs";
import { core } from "./round-1/core.mjs";
import { arrays } from "./round-2/arrays.mjs";
import { systems } from "./round-2/systems.mjs";
import { graphs } from "./round-2/graphs.mjs";
import { logic } from "./round-2/logic.mjs";

test("both generated packs retain the latest authored statements, hints and readable variable markup", () => {
  const rounds = [
    [
      1,
      [
        [neon, "Neon District"],
        [silicon, "Silicon Hive"],
        [nexus, "Verdant Nexus"],
        [core, "Zero-Day Core"],
      ],
    ],
    [2, [[arrays], [systems], [graphs], [logic]]],
  ];
  for (const [round, groups] of rounds) {
    const pack = JSON.parse(
      readFileSync(new URL(`./round-${round}/pack.json`, import.meta.url)),
    );
    const authored = groups.flatMap(([questions, region]) =>
      questions.map((q) => ({ ...q, region })),
    );
    assert.equal(pack.questions.length, authored.length);
    for (const [i, q] of authored.entries()) {
      assert.equal(pack.questions[i].title, q.title);
      assert.equal(
        pack.questions[i].statement,
        statementFor(q, round),
        q.title,
      );
      assert.deepEqual(
        pack.questions[i].hints,
        q.hints.map((content, i) => ({ level: i + 1, content })),
        q.title,
      );
      assert.match(
        pack.questions[i].statement,
        /`[^`\n]+`/,
        `${q.title}: identify code variables`,
      );
      for (const [, name] of q.guide.matchAll(/`([a-z][a-zA-Z_0-9]*)`/g)) {
        assert.match(
          q.c + "\n" + q.py,
          new RegExp(`\\b${name}\\b`),
          `${q.title}: the code guide names a missing variable`,
        );
      }
      for (const text of [pack.questions[i].statement, ...q.hints]) {
        assert.equal(
          (text.match(/`/g) ?? []).length % 2,
          0,
          `${q.title}: unclosed code marker`,
        );
        assert.ok(Buffer.byteLength(text) <= 65536);
      }
    }
  }
});
