import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { checkLinks } from "./check-docs.mjs";

test("documentation links resolve per file, skip examples/remote URLs, and reject missing or escaping paths", async () => {
  const root = await mkdtemp(join(tmpdir(), "ingenium-doc-links-"));
  try {
    await mkdir(join(root, "docs"));
    await writeFile(join(root, "README.md"), "# Test\n");
    await writeFile(join(root, "docs", "a.md"), '[root](../README.md#test) [missing](absent.md) [outside](../../private.md) [remote](https://example.com/) [self](#here)\n```md\n[example](example-only.md)\n```\n');
    const result = await checkLinks(root, ["README.md", "docs/a.md"]);
    assert.equal(result.links, 3);
    assert.equal(result.errors.length, 2);
    assert.ok(result.errors.some(error => error.includes("missing local target: absent.md")));
    assert.ok(result.errors.some(error => error.includes("link escapes repository")));
  } finally { await rm(root, { recursive: true, force: true }); }
});
