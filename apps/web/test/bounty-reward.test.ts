import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import BountyReward from "../src/BountyReward";

test("confirmed bounty amounts select four progressively larger Tecnoesis coin arrangements", () => {
  for (const [amount, layout, coins] of [
    [350, "single", 1],
    [400, "pile", 3],
    [700, "stack", 6],
    [1000, "heap", 14],
  ] as const) {
    const html = renderToStaticMarkup(
      createElement(BountyReward, {
        amount,
        title: "<script>not markup</script>",
      }),
    );
    assert.ok(html.includes(`data-coins="${layout}"`));
    assert.equal((html.match(/class="tecnoesis-coin"/g) ?? []).length, coins);
    assert.ok(html.includes(`+${amount.toLocaleString()}`));
    assert.ok(html.includes('role="status"'));
    assert.ok(html.includes("&lt;script&gt;not markup&lt;/script&gt;"));
  }
});
