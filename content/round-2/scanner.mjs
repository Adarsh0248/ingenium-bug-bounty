import assert from "node:assert/strict";
import { mutate, program } from "../programs.mjs";

// Author the subsystem boundaries; the reference diff only verifies coverage below.
export function scannerSection(question, language, starter, authored) {
  assert.ok(
    authored?.label?.trim(),
    `${question.title}: missing scanner label`,
  );
  const python = language === "python";
  const originalBody = (python ? question.py : question.c).trim();
  const patch = python ? question.pybug : question.cbug;
  const body = mutate(originalBody, patch);
  const [from, to] = authored[python ? "python" : "c"] ?? [];
  const lines = body.split("\n");
  assert.ok(
    Number.isInteger(from) &&
      Number.isInteger(to) &&
      from >= 1 &&
      to <= lines.length &&
      to - from >= 3,
    `${question.title}/${language}: invalid authored scanner bounds`,
  );
  const marker = python
    ? "# INGENIUM_SCANNER_BODY"
    : "// INGENIUM_SCANNER_BODY";
  const marked = program(marker + "\n" + body, language).split("\n");
  const offset = marked.findIndex((line) => line.trim() === marker);
  assert.ok(offset >= 0);
  assert.equal(
    marked.filter((_, i) => i !== offset).join("\n"),
    starter,
    `${question.title}/${language}: scanner source mapping changed`,
  );
  const fromLine = offset + from,
    toLine = offset + to;
  const changedStart = originalBody
    .slice(0, originalBody.indexOf(patch[0]))
    .split("\n").length;
  const changedEnd = changedStart + patch[1].split("\n").length - 1;
  assert.ok(
    changedStart >= from && changedEnd <= to,
    `${question.title}/${language}: authored subsystem misses the fault`,
  );
  return { label: authored.label, from_line: fromLine, to_line: toLine };
}
