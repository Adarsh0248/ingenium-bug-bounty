import assert from "node:assert/strict";
import test from "node:test";
import {
  bugAppearance,
  bugPalette,
  bugPixels,
  bugSpecies,
  bugPose,
  bountyRank,
} from "../src/bug-art";
import { regions, regionField } from "../src/regions";

test("six creature families have distinct complete pixel silhouettes", () => {
  assert.equal(new Set(bugSpecies.map((b) => b.pixels.join("\n"))).size, 6);
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
    assert.ok(first.name.length > 5);
    assert.ok(
      bugAppearance("same-bounty", 95, r.category).size >
        bugAppearance("same-bounty", 20, r.category).size,
    );
  }
  assert.deepEqual(bugAppearance("legacy", 50), bugAppearance("legacy", 50));
});

test("every region mixes all six motions without changing authored or legacy habitats", () => {
  for (const region of regions) {
    const creatures = Array.from({ length: 60 }, (_, i) =>
      bugAppearance(`bounty-${i}`, 50, region.category),
    );
    assert.equal(new Set(creatures.map((b) => b.motion)).size, 6);
    assert.equal(new Set(creatures.map((b) => b.name)).size, 6);
    assert.equal(new Set(creatures.map((b) => b.pixels.join("\n"))).size, 6);
    assert.ok(
      creatures.every(
        (b) => b.region.id === region.id && b.color === region.color,
      ),
    );
    assert.ok(
      creatures.every((b) =>
        region.id === "foundry"
          ? b.speed > 0 && b.speed < 5
          : b.speed >= 0.75 && b.speed <= 1.25,
      ),
    );
    assert.ok(new Set(creatures.map((b) => b.speed)).size > 1);
    for (let i = 0; i < 60; i++) {
      const legacy = bugAppearance(`bounty-${i}`, 50);
      assert.equal(legacy.region.id, regions[legacy.seed % 4].id);
    }
  }
  assert.equal(new Set(regions.map((r) => r.aura)).size, 4);
});

test("rarity and aura use actual base bounty with stable thresholds and stronger high-value silhouettes", () => {
  for (const [value, label] of [
    [10, "Common"],
    [390, "Common"],
    [400, "Rare"],
    [690, "Rare"],
    [700, "Elite"],
    [890, "Elite"],
    [900, "Apex"],
    [1000, "Apex"],
  ] as const)
    assert.equal(bountyRank(value).label, label);
  const low = bugAppearance("same-bug", 90, "ARRAYS", 100),
    high = bugAppearance("same-bug", 10, "ARRAYS", 950);
  assert.equal(low.rank.tier, 0);
  assert.equal(high.rank.tier, 3);
  assert.ok(high.size > low.size);
  assert.equal(high.motion, low.motion);
  assert.equal(high.speed, low.speed);
});

test("body animation distinguishes wings, legs, hopping and dragging and honours reduced motion", () => {
  for (const species of bugSpecies) {
    const poses = Array.from({ length: 40 }, (_, i) =>
      bugPose(species.motion, i / 20, 17),
    );
    assert.ok(poses.every((p) => Object.values(p).every(Number.isFinite)));
    assert.equal(
      poses.some((p) => Math.abs(p.wing) > 1),
      species.flying,
    );
    assert.equal(
      poses.some((p) => Math.abs(p.stretch) > 0.12),
      species.motion === "DRAG",
    );
    if (species.motion === "HOP") assert.ok(poses.some((p) => p.lift > 0.25));
    if (!species.flying) {
      assert.ok(poses.every((p) => p.rock === 0));
    }
    assert.deepEqual(
      bugPose(species.motion, 0, 17, true),
      bugPose(species.motion, 500, 17, true),
    );
  }
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
