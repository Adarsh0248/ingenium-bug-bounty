import assert from "node:assert/strict";
import { test } from "node:test";
import {
  registrationCsv,
  REGISTRATION_COLUMNS,
} from "../src/access/registration-csv.js";

const header = REGISTRATION_COLUMNS.join(",");
test("registration CSV preserves quoted commas, quotes, Unicode and byte identity without coercing IDs", () => {
  const csv = `\ufeff${header}\r\n0001,"Team, A","One ""quoted"" member",\u00e9\r\n\r\n`;
  const parsed = registrationCsv(csv);
  assert.deepEqual(parsed.issues, []);
  assert.deepEqual(parsed.rows, [
    {
      row: 2,
      registration_id: "0001",
      team_name: "Team, A",
      member_1_name: 'One "quoted" member',
      member_2_name: "\u00e9",
    },
  ]);
  assert.match(parsed.digest, /^[0-9a-f]{64}$/);
  assert.notEqual(
    parsed.digest,
    registrationCsv(csv.replaceAll("\r\n", "\n")).digest,
  );
});
test("registration CSV rejects wrong/extra columns, malformed quoting, missing cells and duplicate IDs", () => {
  for (const csv of [
    "",
    `${header},email\nR,Team,One,Two,private@example.test`,
    `${header}\nR,\"bad,One,Two`,
  ])
    assert.ok(registrationCsv(csv).issues.length);
  assert.equal(
    registrationCsv(`${header}\nR,Team,One`).issues[0]!.code,
    "EXPECTED_FOUR_FIELDS",
  );
  assert.equal(
    registrationCsv(`${header}\nR,Team,One,Two\nR,Other,Three,Four`).issues[0]!
      .code,
    "DUPLICATE_REGISTRATION_ID",
  );
  assert.equal(registrationCsv(header).issues[0]!.code, "NO_TEAMS");
});
test("registration limits reject bad IDs, whitespace/control names, NULs, malformed Unicode and UTF-8 byte overflow", () => {
  for (const id of [" R", "=SUM(1)", "x".repeat(65)])
    assert.equal(
      registrationCsv(`${header}\n${id},Team,One,Two`).issues[0]!.code,
      "INVALID_REGISTRATION_ID",
    );
  for (const name of ["  ", "\u00e9".repeat(61), "bad\tname", "bad\u007fname"])
    assert.equal(
      registrationCsv(`${header}\nR,${name},One,Two`).issues[0]!.code,
      "INVALID_NAME",
    );
  assert.equal(
    registrationCsv(`${header}\nR,${"\u00e9".repeat(60)},One,Two`).issues
      .length,
    0,
  );
  assert.equal(registrationCsv("\ud800").issues[0]!.code, "INVALID_UTF8");
  assert.equal(registrationCsv("x\0").issues[0]!.code, "NUL_NOT_ALLOWED");
  assert.equal(
    registrationCsv("x".repeat(1048577)).issues[0]!.code,
    "FILE_TOO_LARGE",
  );
  assert.equal(
    registrationCsv(`${header}\nR,${"x".repeat(2100)},One,Two`).issues[0]!.code,
    "INVALID_CSV",
  );
});
test("a complete 100-team file is accepted but the 101st team is never silently dropped", () => {
  const rows = Array.from({ length: 100 }, (_, i) => `R${i},Team,One,Two`);
  assert.equal(
    registrationCsv(`${header}\n${rows.join("\n")}`).rows.length,
    100,
  );
  assert.equal(
    registrationCsv(`${header}\n${rows.join("\n")}\nR1001,Team,One,Two`)
      .issues[0]!.code,
    "TOO_MANY_TEAMS",
  );
});
