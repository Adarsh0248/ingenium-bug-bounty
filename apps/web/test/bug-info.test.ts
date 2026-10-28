import assert from "node:assert/strict";
import test from "node:test";
import { statementPreview } from "../src/BugInfoCard";

test("question previews contain only a bounded first paragraph with normalised whitespace", () => {
  assert.equal(
    statementPreview("  Find  the\n corrupted value.\r\n\r\nInput\nN values"),
    "Find the corrupted value.",
  );
  assert.equal(statementPreview("  \n "), "");
  const text = statementPreview("Repair this program. ".repeat(30));
  assert.ok(text.length <= 180);
  assert.ok(text.endsWith("…"));
  assert.equal(
    statementPreview("<img src=x onerror=alert(1)>"),
    "<img src=x onerror=alert(1)>",
  );
});
