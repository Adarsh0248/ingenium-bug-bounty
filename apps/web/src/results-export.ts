import type { FinalResults } from "../../api/src/competition/results";

export type ResultsFormat = "csv" | "json";
export function resultsFile(value: FinalResults, format: ResultsFormat) {
  const name = `ingenium-${value.arena_id}-round-${value.round_kind}-${value.result_id}.${format}`;
  if (format === "json")
    return {
      name,
      type: "application/json;charset=utf-8",
      text: JSON.stringify(value, null, 2) + "\n",
    };
  function cell(value: string | number | boolean | null) {
    let text = value === null ? "" : String(value);
    // Quoting CSV alone does not stop spreadsheet formulas in registration names.
    if (/^[\s\p{Cc}]*[=+\-@]|^[\t\r\n]/u.test(text)) text = "'" + text;
    return `"${text.replaceAll('"', '""')}"`;
  }
  const header = [
    "format_version",
    "state",
    "arena_id",
    "round_id",
    "round_kind",
    "result_id",
    "result_version",
    "finalised_at",
    "standings_sha256",
    "qualification_status",
    "rank",
    "team_id",
    "team_round_id",
    "team_name",
    "points",
    "solve_time_ms",
    "penalty_ms",
    "effective_time_ms",
    "difficulties_desc",
    "qualified",
  ];
  const rows = value.standings.map((s) => [
    value.format_version,
    value.state,
    value.arena_id,
    value.round_id,
    value.round_kind,
    value.result_id,
    value.result_version,
    value.finalised_at,
    value.standings_sha256,
    value.qualification_status,
    s.rank,
    s.team_id,
    s.team_round_id,
    s.team_name,
    s.points,
    s.solve_time_ms,
    s.penalty_ms,
    s.effective_time_ms,
    s.difficulties.join(";"),
    s.qualified,
  ]);
  return {
    name,
    type: "text/csv;charset=utf-8",
    text:
      "\uFEFF" +
      [header, ...rows].map((row) => row.map(cell).join(",")).join("\r\n") +
      "\r\n",
  };
}
