import assert from "node:assert/strict";
import { test } from "node:test";
import type { FinalResults } from "../../api/src/competition/results";
import { resultsFile } from "../src/results-export";

const value: FinalResults = {
  format_version: 1,
  state: "FINAL",
  arena_id: "arena",
  round_id: "round",
  round_kind: 1,
  result_id: "result",
  result_version: 1,
  finalised_at: "2026-10-22T00:00:00.000Z",
  standings_sha256: "a".repeat(64),
  qualification_status: "PENDING",
  standings: [
    {
      team_id: "team",
      team_round_id: "enrolment",
      team_name: 'Team "one",\r\ntwo',
      rank: 1,
      points: 200,
      solve_time_ms: 1234,
      penalty_ms: 300000,
      effective_time_ms: 301234,
      difficulties: [95, 80],
      qualified: null,
    },
  ],
};
test("CSV quotes every field, preserves milliseconds, difficulty order and explicit pending qualification", () => {
  const file = resultsFile(value, "csv");
  assert.equal(file.name, "ingenium-arena-round-1-result.csv");
  assert.equal(file.type, "text/csv;charset=utf-8");
  assert.ok(file.text.startsWith('\uFEFF"format_version"'));
  assert.ok(file.text.includes('"Team ""one"",\r\ntwo"'));
  assert.ok(
    file.text.endsWith('"200","1234","300000","301234","95;80",""\r\n'),
  );
  assert.ok(file.text.includes('"PENDING","1"'));
});
test("CSV neutralises formula prefixes, including leading whitespace/control characters, without changing JSON or the source", () => {
  for (const name of [
    '=HYPERLINK("x")',
    "+SUM(1,2)",
    "-1+2",
    "@SUM(1)",
    "  =1",
    "\t=1",
    "\rname",
    "\nname",
    "\u0001=1",
    "\u2003=1",
  ]) {
    const copy = structuredClone(value);
    copy.standings[0]!.team_name = name;
    assert.ok(
      resultsFile(copy, "csv").text.includes(
        `"'${name.replaceAll('"', '""')}"`,
      ),
    );
    assert.equal(
      JSON.parse(resultsFile(copy, "json").text).standings[0].team_name,
      name,
    );
    assert.equal(copy.standings[0]!.team_name, name);
  }
});
test("JSON preserves ties and canonical labels; CSV distinguishes false from unknown and does not invent tie-break order", () => {
  const copy = structuredClone(value);
  copy.qualification_status = "LOCKED";
  copy.standings.push({
    ...copy.standings[0]!,
    team_id: "other",
    team_round_id: "other-round",
    qualified: false,
  });
  copy.standings[0]!.qualified = true;
  const file = resultsFile(copy, "json");
  assert.deepEqual(JSON.parse(file.text), copy);
  assert.deepEqual(
    copy.standings.map((s) => s.rank),
    [1, 1],
  );
  assert.ok(resultsFile(copy, "csv").text.includes('"95;80","true"\r\n'));
  assert.ok(resultsFile(copy, "csv").text.endsWith('"95;80","false"\r\n'));
});
