import { parse } from "csv-parse/sync";
import { sha256 } from "./credentials.js";

export const REGISTRATION_COLUMNS = [
  "registration_id",
  "team_name",
  "member_1_name",
  "member_2_name",
] as const;
export const REGISTRATION_CSV_BYTES = 1048576;
export const REGISTRATION_BATCH_TEAMS = 100;
export interface RegistrationRow {
  row: number;
  registration_id: string;
  team_name: string;
  member_1_name: string;
  member_2_name: string;
}
export interface RegistrationIssue {
  row: number;
  field: string;
  code: string;
}
export function registrationCsv(csv: unknown): {
  rows: RegistrationRow[];
  issues: RegistrationIssue[];
  digest: string;
} {
  const fail = (code: string, row = 0, field = "file") => ({
    rows: [],
    issues: [{ row, field, code }],
    digest: "",
  });
  if (typeof csv !== "string" || !csv.isWellFormed())
    return fail("INVALID_UTF8");
  if (Buffer.byteLength(csv) > REGISTRATION_CSV_BYTES)
    return fail("FILE_TOO_LARGE");
  if (csv.includes("\0")) return fail("NUL_NOT_ALLOWED");
  let records: string[][];
  try {
    records = parse(csv, {
      bom: true,
      skip_empty_lines: true,
      max_record_size: 2048,
      to: REGISTRATION_BATCH_TEAMS + 2,
      relax_column_count: true,
      cast: false,
    }) as string[][];
  } catch {
    return fail("INVALID_CSV");
  }
  if (
    !records.length ||
    records[0]!.length !== 4 ||
    REGISTRATION_COLUMNS.some((c, i) => records[0]![i] !== c)
  )
    return fail("EXPECTED_COLUMNS", 1, "header");
  if (records.length === 1) return fail("NO_TEAMS");
  if (records.length > REGISTRATION_BATCH_TEAMS + 1)
    return fail("TOO_MANY_TEAMS");
  const rows: RegistrationRow[] = [],
    issues: RegistrationIssue[] = [],
    seen = new Map<string, number>();
  for (const [index, values] of records.slice(1).entries()) {
    const row = index + 2;
    if (values.length !== 4) {
      issues.push({ row, field: "row", code: "EXPECTED_FOUR_FIELDS" });
      continue;
    }
    const [id, name, one, two] = values as [string, string, string, string];
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(id))
      issues.push({
        row,
        field: "registration_id",
        code: "INVALID_REGISTRATION_ID",
      });
    if (seen.has(id))
      issues.push({
        row,
        field: "registration_id",
        code: "DUPLICATE_REGISTRATION_ID",
      });
    seen.set(id, row);
    for (const [i, value] of [name, one, two].entries()) {
      if (
        !value.trim() ||
        Buffer.byteLength(value) > 120 ||
        /[\x00-\x1f\x7f]/.test(value)
      )
        issues.push({
          row,
          field: REGISTRATION_COLUMNS[i + 1]!,
          code: "INVALID_NAME",
        });
    }
    rows.push({
      row,
      registration_id: id,
      team_name: name,
      member_1_name: one,
      member_2_name: two,
    });
  }
  return { rows, issues, digest: sha256(csv).toString("hex") };
}
