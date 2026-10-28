import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ProblemText, { InlineCode } from "../src/ProblemText";

test("problem text separates sections and marks exact code names without parsing other markup", () => {
  const html = renderToStaticMarkup(
    createElement(ProblemText, {
      text: "Story first.\n\nInput\n1. Read `n`, the number of values.\n2. Read `a[i]`.\n\n## Output\nPrint `YES`.",
    }),
  );
  assert.match(html, /<h4>Input<\/h4>/);
  assert.match(html, /<h4>Output<\/h4>/);
  for (const name of ["n", "a[i]", "YES"])
    assert.ok(html.includes(`<code>${name}</code>`));
  assert.ok(html.includes("\n2. Read"));
  assert.doesNotMatch(html, /`/);
});

test("question and hint markup never creates HTML, links, scripts or code blocks", () => {
  const text =
    "<img src=x onerror=alert(1)> `[bad](javascript:alert(1))` `n < 5` and an unmatched `tick";
  for (const html of [
    renderToStaticMarkup(createElement(ProblemText, { text })),
    renderToStaticMarkup(createElement(InlineCode, { children: text })),
  ]) {
    assert.doesNotMatch(html, /<(?:img|script|a)\b/);
    assert.match(html, /&lt;img/);
    assert.match(html, /<code>n &lt; 5<\/code>/);
    assert.ok(html.includes("unmatched `tick"));
  }
});
