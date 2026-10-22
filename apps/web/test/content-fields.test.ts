import test from "node:test";
import assert from "node:assert/strict";
import { contentTextError, decodeContentFile } from "../src/content-fields";

test("authoring files preserve BOM, CRLF, NUL and exact UTF-8 bytes", () => {
  const text = "\ufeffA\r\n\0\u00e9",
    encoded = new TextEncoder().encode(text);
  assert.equal(decodeContentFile(encoded, encoded.length), text);
  assert.deepEqual(
    new TextEncoder().encode(decodeContentFile(encoded, encoded.length)),
    encoded,
  );
  assert.throws(() => decodeContentFile(encoded, encoded.length - 1));
  assert.throws(() => decodeContentFile(new Uint8Array([0xc3, 0x28]), 10));
});
test("authoring text rejects invalid Unicode and byte overflow without changing data", () => {
  assert.equal(contentTextError("\u00e9", 2), false);
  assert.equal(contentTextError("\u00e9", 1), true);
  assert.equal(contentTextError("\ud800", 10), true);
  assert.equal(contentTextError("\0", 10), false);
  assert.equal(contentTextError("\0", 10, true), true);
  assert.equal(contentTextError("", 0), false);
});
