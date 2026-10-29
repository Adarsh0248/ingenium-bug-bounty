import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { brotliDecompressSync, gunzipSync } from "node:zlib";
test("production assets exclude fixture data and include the self-hosted entry policy and editor worker", async () => {
  const root = new URL("../dist/", import.meta.url);
  const html = await readFile(new URL("index.html", root), "utf8");
  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /script-src &#39;self&#39;/);
  assert.match(html, /worker-src &#39;self&#39;/);
  assert.doesNotMatch(html, /unsafe-eval|https?:\/\//);
  const files = await readdir(new URL("assets/", root));
  assert.ok(
    files.some(
      (name) => name.startsWith("editor.worker") && name.endsWith(".js"),
    ),
  );
  const roundTwo = JSON.parse(
    await readFile(
      new URL("../../../content/round-2/pack.json", import.meta.url),
      "utf8",
    ),
  );
  for (const name of files.filter((name) => name.endsWith(".js"))) {
    const text = await readFile(new URL(`assets/${name}`, root), "utf8");
    assert.doesNotMatch(
      text,
      /synthetic-csrf|synthetic-participant-csrf|\/api\/v1\/_fixture|Segfault Society|LOCAL PREVIEW|Cipher Multiplicity|Critical Link Audit/,
    );
  }
  for (const name of files.filter((name) => name.endsWith(".js"))) {
    const text = await readFile(new URL(`assets/${name}`, root), "utf8");
    for (const q of roundTwo.questions)
      assert.ok(
        !text.includes(q.id),
        "Private Round 2 catalogue reached public assets",
      );
  }
});

test("public text has correct smaller Brotli and gzip copies for the edge", async () => {
  const root = new URL("../dist/", import.meta.url);
  const files = (await readdir(new URL("assets/", root))).filter((name) =>
    /\.(js|css)$/.test(name),
  );
  let raw = 0,
    compressed = 0;
  for (const name of files) {
    const source = await readFile(new URL(`assets/${name}`, root));
    const br = await readFile(new URL(`assets/${name}.br`, root));
    const gz = await readFile(new URL(`assets/${name}.gz`, root));
    assert.deepEqual(brotliDecompressSync(br), source);
    assert.deepEqual(gunzipSync(gz), source);
    assert.ok(br.length < source.length);
    assert.ok(gz.length < source.length);
    raw += source.length;
    compressed += br.length;
  }
  assert.ok(files.length > 0);
  assert.ok(
    compressed < raw / 2,
    "Public text should transfer at less than half its original size",
  );
});
