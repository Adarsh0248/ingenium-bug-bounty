import assert from "node:assert/strict";
import test from "node:test";
import { resultsLabel } from "../src/Results";
import { displayOutput } from "../src/output";

test("results labels never promote provisional or cancelled rounds to a competitive final", () => {
  assert.equal(
    resultsLabel({
      final: false,
      cancelled: false,
      round: { state: "RUNNING" },
    }),
    "Provisional results",
  );
  assert.equal(
    resultsLabel({
      final: false,
      cancelled: false,
      round: { state: "CLOSING" },
    }),
    "Results finalising",
  );
  assert.equal(
    resultsLabel({ final: true, cancelled: false, round: { state: "CLOSED" } }),
    "Final results",
  );
  assert.equal(
    resultsLabel({
      final: false,
      cancelled: true,
      round: { state: "CANCELLED" },
    }),
    "Cancelled round history",
  );
});
test("retained output decoding preserves empty, NUL, UTF-8 and malformed-data handling", () => {
  for (const value of ["", "12\n", "\u0000\r\n\u20ac"])
    assert.equal(displayOutput(Buffer.from(value).toString("base64")), value);
  assert.equal(displayOutput(null), "");
  assert.equal(displayOutput("%%%"), "Output unavailable");
});
