import { test } from "node:test";
import assert from "node:assert/strict";
import { createKernelMotion, kernelTail } from "../src/kernel-motion";
import { syncRoamers } from "../src/bug-swarm";
import type { Roamer } from "../src/bug-swarm";
const world = { width: 4096, height: 2560 };
function actor() {
  const map = new Map<string, Roamer>();
  syncRoamers(
    map,
    [
      {
        id: "runner",
        region: "neon",
        seed: 53,
        motion: "DART",
        size: 0.8,
        pace: 1,
        x: 1000,
        y: 1000,
      },
    ],
    world,
  );
  const a = map.get("runner")!;
  a.goalX = 1000;
  a.goalY = 200;
  a.heading = 0;
  a.velocity = 80;
  a.vy = -80;
  return a;
}
test("60 Hz presentation advances smoothly between 20 Hz physics steps with monotonic gait", () => {
  const a = actor(),
    motion = createKernelMotion();
  motion.hold([a]);
  const positions: number[] = [],
    gait: number[] = [];
  for (let i = 0; i < 120; i++) {
    motion.advance([a], 1 / 60, world);
    const p = motion.pose(a);
    positions.push(p.y);
    gait.push(p.distance);
  }
  const gaps = positions.slice(3).map((y, i) => positions[i + 2] - y);
  assert.ok(
    gaps.every((g) => g > 0 && g < 4),
    `uneven movement ${gaps.slice(0, 10)}`,
  );
  assert.ok(gait.every((g, i) => !i || g >= gait[i - 1]));
});
test("physics travels the same distance at 30/60/120 presentation rates and holds without a resume leap", () => {
  const results = [30, 60, 120].map((hz) => {
    const a = actor(),
      m = createKernelMotion();
    m.hold([a]);
    for (let i = 0; i < hz * 2; i++) m.advance([a], 1 / hz, world);
    return a;
  });
  for (const a of results) assert.ok(Math.abs(a.y - results[0].y) < 1e-6);
  const a = actor(),
    m = createKernelMotion();
  m.hold([a]);
  m.advance([a], 0.05, world);
  m.hold([a]);
  const at = a.y;
  for (let i = 0; i < 20; i++) m.hold([a]);
  assert.equal(m.pose(a).y, at);
  m.advance([a], 1 / 60, world);
  assert.equal(m.pose(a).y, at);
  m.advance([a], 0.1, world, "runner");
  assert.equal(a.y, at);
});
test("crawler tail is continuous while crossing saved points and follows turns", () => {
  const history = [
      { x: 0, y: 5 },
      { x: 0, y: 10 },
      { x: 5, y: 10 },
      { x: 10, y: 10 },
    ],
    a = kernelTail({ x: 0, y: 0, heading: 0 }, history, 4, 5),
    b = kernelTail({ x: 0, y: -0.1, heading: 0 }, history, 4, 5);
  assert.deepEqual(a, [
    { x: 0, y: 0 },
    { x: 0, y: 4 },
    { x: 0, y: 8 },
    { x: 2, y: 10 },
    { x: 6, y: 10 },
  ]);
  assert.ok(a.every((p, i) => Math.hypot(p.x - b[i].x, p.y - b[i].y) <= 0.11));
  assert.equal(kernelTail({ x: 0, y: 0, heading: 0 }, [], 4).length, 7);
});
