import assert from "node:assert/strict";
import test from "node:test";
import {
  bugAppearance,
  bugPalette,
  bugPixels,
  bugSpecies,
} from "../src/bug-art";
import { regions, regionField } from "../src/regions";

test("the restored four families retain distinct complete pixel silhouettes", () => {
  assert.equal(new Set(bugSpecies.map((b) => b.pixels.join("\n"))).size, 4);
  for (const bug of bugSpecies) {
    const pixels = bugPixels(bug.pixels),
      palette = bugPalette(bug.region);
    assert.ok(pixels.length > 100);
    assert.ok(bug.pixels.every((row) => row === [...row].reverse().join("")));
    assert.ok(pixels.every((pixel) => palette[pixel.tone]));
    const unseen = new Set(pixels.map((pixel) => `${pixel.x},${pixel.y}`)),
      pending = [unseen.values().next().value!];
    unseen.delete(pending[0]);
    while (pending.length) {
      const [x, y] = pending.pop()!.split(",").map(Number);
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const next = `${x + dx},${y + dy}`;
          if (unseen.delete(next)) pending.push(next);
        }
    }
    assert.equal(unseen.size, 0, bug.name);
  }
});
test("restored region art keeps shared authored categories and deterministic legacy appearance", () => {
  for (const r of regions) {
    const first = bugAppearance("same-bounty", 80, r.category),
      second = bugAppearance("same-bounty", 80, r.category);
    assert.equal(first.region.id, r.id);
    assert.deepEqual(first, second);
    assert.equal(first.name, r.family);
    assert.ok(
      bugAppearance("same-bounty", 95, r.category).size >
        bugAppearance("same-bounty", 20, r.category).size,
    );
  }
  assert.deepEqual(bugAppearance("legacy", 50), bugAppearance("legacy", 50));
});
test("four separate region bounds stay within the field without overlapping", () => {
  for (const [w, h] of [
    [320, 568],
    [390, 844],
    [1440, 1000],
  ]) {
    const field = regionField(w, h, null),
      tiles = regions.map((r) => regionField(w, h, r.id));
    for (const tile of tiles) {
      assert.ok(tile.width > 0 && tile.height > 0);
      assert.ok(tile.left >= field.left && tile.top >= field.top);
      assert.ok(tile.left + tile.width <= field.left + field.width + 0.01);
      assert.ok(tile.top + tile.height <= field.top + field.height + 0.01);
    }
    for (let i = 0; i < tiles.length; i++)
      for (let j = i + 1; j < tiles.length; j++) {
        const a = tiles[i],
          b = tiles[j];
        assert.ok(
          a.left + a.width <= b.left ||
            b.left + b.width <= a.left ||
            a.top + a.height <= b.top ||
            b.top + b.height <= a.top,
        );
      }
  }
});
