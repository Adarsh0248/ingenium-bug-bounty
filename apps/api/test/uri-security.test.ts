import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
for (const [name, load] of [
  ["serializer", require],
  ["validator", createRequire(require.resolve("ajv"))],
] as const) {
  const uri = load("fast-uri");
  test(`${name} URI parsing never decodes an encoded scheme into an executable scheme`, () => {
    for (const input of ["%6Aavascript:alert(1)", "%u006Aavascript:alert(1)"]) {
      assert.notEqual(uri.parse(input).scheme, "javascript");
      assert.notEqual(uri.normalize(input), "javascript:alert(1)");
    }
  });
  test(`${name} URI equality preserves relative-reference boundaries`, () => {
    assert.equal(uri.equal("a/../b", "/b"), false);
    assert.equal(uri.equal("../x", "x"), false);
  });
}
