import assert from "node:assert/strict";
import test from "node:test";
import { bugSpecies } from "../src/bug-art";
import {
  mapBounds,
  mapExtent,
  clampMap,
  centreMap,
  regionTarget,
  bugWander,
  infoCardPlacement,
} from "../src/region-map";

test("bug cards stay inside the field and flip below a target without room above", () => {
  const bounds = { left: 350, top: 236, width: 800, height: 500 },
    card = { width: 300, height: 240 };
  const above = infoCardPlacement(bounds, { x: 700, y: 650 }, 50, card);
  assert.equal(above.side, "above");
  assert.ok(above.top + card.height < 600);
  const tight = infoCardPlacement(
    { left: 18, top: 338, width: 354, height: 436 },
    { x: 195, y: 650 },
    30,
    { width: 300, height: 270 },
  );
  assert.equal(
    tight.side,
    "above",
    "a few pixels of top padding must not force the card over the bug",
  );
  assert.ok(tight.top + 270 < 650 - 30);
  const below = infoCardPlacement(bounds, { x: 380, y: 255 }, 40, card);
  assert.equal(below.side, "below");
  assert.ok(below.left >= bounds.left);
  assert.ok(below.top > 255);
  for (const point of [
    { x: 380, y: 260 },
    { x: 1130, y: 700 },
  ]) {
    const p = infoCardPlacement(bounds, point, 50, card);
    assert.ok(
      p.left >= bounds.left &&
        p.left + card.width <= bounds.left + bounds.width,
    );
    assert.ok(
      p.top >= bounds.top && p.top + card.height <= bounds.top + bounds.height,
    );
    assert.ok(p.pin >= 16 && p.pin <= card.width - 16);
  }
});

test("thirty targets start spread out, then roam within the entire region on desktop and mobile", () => {
  for (const [width, height] of [
    [1440, 1000],
    [320, 568],
    [390, 844],
  ]) {
    const bounds = mapBounds(width, height),
      world = mapExtent(bounds);
    const initial = Array.from({ length: 30 }, (_, slot) =>
      regionTarget(slot, 30, bounds),
    );
    for (let a = 0; a < initial.length; a++)
      for (let b = a + 1; b < initial.length; b++)
        assert.ok(
          Math.hypot(initial[a].x - initial[b].x, initial[a].y - initial[b].y) >
            70,
        );
    for (let slot = 0; slot < 30; slot++) {
      const origin = initial[slot],
        start = { x: origin.u * 2 - 1, y: origin.v * 2 - 1 },
        scale = Math.max(world.width, world.height) / 300,
        points = [];
      for (let t = 0; t <= 3600; t += 5) {
        const p = regionTarget(
          slot,
          30,
          bounds,
          bugWander(
            slot,
            t,
            bugSpecies[slot % 6].motion,
            0.75 + slot / 60,
            start,
            scale,
          ),
        );
        assert.ok(p.x >= 80 && p.x <= world.width - 80);
        assert.ok(p.y >= 80 && p.y <= world.height - 80);
        points.push(p);
      }
      assert.ok(Math.abs(points[0].x - origin.x) < 1e-9);
      assert.ok(Math.abs(points[0].y - origin.y) < 1e-9);
      assert.ok(
        Math.max(...points.map((p) => p.x)) -
          Math.min(...points.map((p) => p.x)) >
          (world.width - 160) * 0.7,
      );
      assert.ok(
        Math.max(...points.map((p) => p.y)) -
          Math.min(...points.map((p) => p.y)) >
          (world.height - 160) * 0.7,
      );
    }
  }
});

test("full-region routes stay continuous and retain short rests and aspect-correct travel headings", () => {
  const bounds = mapBounds(1440, 1000),
    world = mapExtent(bounds),
    scale = Math.max(world.width, world.height) / 300;
  for (let slot = 0; slot < 6; slot++) {
    const origin = regionTarget(slot, 6, bounds),
      start = { x: origin.u * 2 - 1, y: origin.v * 2 - 1 },
      motion = bugSpecies[slot].motion;
    for (let t = 0; t < 600; t += 0.05) {
      const a = bugWander(slot, t, motion, 1, start, scale),
        b = bugWander(slot, t + 0.05, motion, 1, start, scale),
        p = regionTarget(slot, 6, bounds, a),
        q = regionTarget(slot, 6, bounds, b),
        dx = q.x - p.x,
        dy = q.y - p.y,
        step = Math.hypot(dx, dy);
      assert.ok(
        step < 12,
        "large routes must not jump or accelerate across the map",
      );
      if (!a.moving && !b.moving) assert.equal(step, 0);
      if (step > 1e-5 && a.moving && b.moving)
        assert.ok(
          (dx * -Math.sin(p.heading) + dy * -Math.cos(p.heading)) / step >
            0.999,
        );
    }
    assert.ok(
      bugWander(slot, 4, motion, 1, start, scale).moving,
      "map size must not turn short pauses into long waits",
    );
  }
});

test("bugs wander independently through fresh destinations, varied speeds and pauses without jumps", () => {
  const paths = new Set<string>();
  for (let seed = 0; seed < 30; seed++) {
    const motion = bugSpecies[seed % 6].motion;
    let paused = false,
      moved = false;
    const samples = [];
    for (let t = 0; t <= 120; t += 0.05) {
      const point = bugWander(seed, t, motion),
        next = bugWander(seed, t + 0.05, motion);
      assert.ok(Math.abs(point.x) <= 1 && Math.abs(point.y) <= 1);
      const step = Math.hypot(next.x - point.x, next.y - point.y);
      if (!point.moving && !next.moving) assert.equal(step, 0);
      assert.ok(step < 0.2, "turns and pauses must not teleport the bug");
      if (t > 10) {
        paused ||= step === 0;
        moved ||= step > 0.001;
      }
      if (Math.round(t * 20) % 100 === 0) samples.push([point.x, point.y]);
    }
    assert.ok(paused && moved, "every bug both wanders and rests");
    assert.notDeepEqual(bugWander(seed, 20, "FLY"), bugWander(seed, 40, "FLY"));
    assert.notDeepEqual(
      bugWander(seed, 20, "DART"),
      bugWander(seed, 20, "DRAG"),
    );
    assert.notDeepEqual(
      bugWander(seed, 20, motion, 0.75),
      bugWander(seed, 20, motion, 1.25),
    );
    paths.add(JSON.stringify(samples));
  }
  assert.equal(paths.size, 30, "bugs must not share a translated loop");
});
test("a 100 by 100 viewport sees one section of a 400 by 400 map, bounded at every edge", () => {
  const bounds = { left: 0, top: 0, width: 100, height: 100 };
  assert.deepEqual(mapExtent(bounds), { width: 400, height: 400 });
  assert.deepEqual(centreMap(bounds), { x: -150, y: -150 });
  assert.deepEqual(clampMap({ x: 1e8, y: 1e8 }, bounds), { x: 0, y: 0 });
  assert.deepEqual(clampMap({ x: -1e8, y: -1e8 }, bounds), {
    x: -300,
    y: -300,
  });
  assert.deepEqual(clampMap({ x: -30, y: -60 }, bounds), { x: -30, y: -60 });
  assert.deepEqual(centreMap(bounds, { x: 360, y: 50 }), { x: -300, y: 0 });
});
test("every viewport keeps a four by four world at a fixed scale", () => {
  for (const [w, h] of [
    [320, 568],
    [390, 844],
    [768, 1024],
    [1920, 1080],
  ]) {
    const b = mapBounds(w, h),
      world = mapExtent(b),
      view = centreMap(b);
    assert.ok(b.width > 0 && b.height > 0);
    assert.ok(b.left + b.width <= w);
    assert.ok(b.top + b.height <= h);
    assert.equal(world.width / b.width, 4);
    assert.equal(world.height / b.height, 4);
    assert.deepEqual(view, { x: -1.5 * b.width, y: -1.5 * b.height });
    assert.deepEqual(Object.keys(view).sort(), ["x", "y"]);
  }
});
