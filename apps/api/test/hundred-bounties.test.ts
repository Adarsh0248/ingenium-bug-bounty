import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import Fastify from "fastify";
import { controlRoom, finalResults, publishedPage, receipt, state, standings } from "../src/competition/http-schemas.js";
import { overview, attempts, wallet } from "../src/workbench/history-schemas.js";

const id = randomUUID(), time = new Date().toISOString();
const difficulties = Array.from({ length: 120 }, (_, i) => 100 - i % 100);
const bounties = difficulties.map(difficulty => ({ bounty_id: randomUUID(), title: `Bounty ${difficulty}`, difficulty,
  base_bounty: difficulty * 10, category: "ARRAYS", captured: false, claimed: false, hint_tier: 0 }));
const rows = difficulties.slice(0, 100).map(() => ({ team_round_id: randomUUID(), team_id: randomUUID(), team_name: "Team", points: 50500,
  solve_time_ms: 100, penalty_ms: 0, effective_time_ms: 100, difficulties, rank: 1 }));
const round = { round_id: id, arena_instance_id: id, kind: 2, state: "RUNNING", duration_ms: "18000000", started_at: time,
  closes_at: time, revision: "1", draw_commitment: null, draw_reveal: null, final: false };
const selected = bounties.map(bounty => ({ snapshot_id: bounty.bounty_id, definition_id: randomUUID(), title: bounty.title,
  difficulty: bounty.difficulty, base_bounty: bounty.base_bounty, round_type: 2 }));

for (const [name, schema, value] of [
  ["live release receipt", receipt, { outcome_id: id, round_id: id, request_key: id, action: "APPEND_QUESTIONS", recorded_at: time,
    result: { status: "APPLIED", added_count: 20, total_count: 120, additions: selected.slice(0, 20).map((b, i) => ({ bounty_id: randomUUID(), snapshot_id: b.snapshot_id, definition_id: b.definition_id, position: 101 + i })) } }],
  ["participant state", state, { round, bounties, pauses: [], wallet: 0 }],
  ["standings", standings, { final: false, cancelled: false, standings: rows }],
  ["final results", finalResults, { format_version: 1, state: "FINAL", arena_id: id, round_id: id, round_kind: 2,
    result_id: id, result_version: 1, finalised_at: time, standings_sha256: "a".repeat(64), qualification_status: "NOT_APPLICABLE",
    standings: rows.map(row => ({ ...row, qualified: null })) }],
  ["history", overview, { final: false, cancelled: false, round: { round_id: id, kind: 2, state: "RUNNING", language: "cpp" },
    wallet: 0, standings: rows, bounties: bounties.map(({ category: _category, captured: _captured, ...bounty }) =>
      ({ ...bounty, draft_saved: false, awarded_points: null })) }],
  ["staff selections", controlRoom, { server_time: time, session_id: id, role: "OWNER", control_revision: "1",
    instance: { instance_id: id, status: "IN_PROGRESS", current: true }, qualified_team_ids: null,
    rounds: [{ round_id: id, kind: 2, state: "RUNNING", duration_ms: "18000000", revision: "1", configuration_revision: "1",
      selected, teams: rows.map(row => ({ team_id: row.team_id, team_name: row.team_name, team_round_id: row.team_round_id, members: [] })) }] }],
] as const) {
  test(`${name} HTTP serialization preserves all 120 bounties/difficulty entries and 100 teams`, async () => {
    const app = Fastify();
    app.get("/", { schema: { response: { 200: schema } } }, async () => value);
    try {
      const response = await app.inject("/");
      assert.equal(response.statusCode, 200, response.body);
      assert.deepEqual(response.json(), value);
    } finally { await app.close(); }
  });
}

test("bounty arrays are bounded at 120 while public pages and qualification retain their 50-item caps", () => {
  for (const [schema, path, expected] of [
    [state, "properties.bounties", 120],
    [standings, "properties.standings", 100],
    [standings, "properties.standings.items.properties.difficulties", 120],
    [finalResults, "properties.standings.items.properties.difficulties", 120],
    [overview, "properties.bounties", 120],
    [controlRoom, "properties.rounds.items.properties.selected", 120],
    [controlRoom, "properties.rounds.items.properties.teams", 100],
    [controlRoom, "properties.qualified_team_ids.anyOf.0", 50],
    [publishedPage, "properties.items", 50],
    [attempts, "properties.items", 50],
    [wallet, "properties.items", 50],
  ] as const) {
    let value: unknown = schema;
    for (const key of path.split(".")) value = (value as Record<string, unknown>)[key];
    assert.equal((value as { maxItems: number }).maxItems, expected, path);
  }
});
