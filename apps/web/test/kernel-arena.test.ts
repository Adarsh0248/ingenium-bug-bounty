import assert from "node:assert/strict";
import { test } from "node:test";
import {
  kernelAppearance,
  kernelSpecs,
  kernelWorld,
  kernelCamera,
  kernelCreatures,
  kernelFoot,
  kernelBodyScale,
} from "../src/kernel-art";
import { syncRoamers, stepSwarm } from "../src/bug-swarm";
import type { Roamer } from "../src/bug-swarm";
import { roundTwoBugs, roundTwoQuestion } from "../../../content/round-2/load";
const roundTwoBounties = roundTwoBugs();

test("walker support feet stay planted during forward travel and lift on their return stroke", () => {
  const start = 0.05,
    travel = 0.05,
    foot = kernelFoot(start, 0),
    next = kernelFoot(start + travel, 0);
  assert.ok(Math.abs((next.y - foot.y) * kernelBodyScale - travel * 48) < 1e-9);
  assert.equal(foot.lift, 0);
  assert.equal(next.lift, 0);
  assert.ok(kernelFoot((0.8 * Math.PI * 2) / 10, 0).lift > 0);
  assert.notDeepEqual(kernelFoot(0.15, 0), kernelFoot(0.15, 1));
});

test("100 authored questions cover all eight different silhouettes, sizes, speeds and four supported languages", () => {
  assert.equal(roundTwoBounties.length, 100);
  assert.equal(new Set(roundTwoBounties.map((b) => b.bounty_id)).size, 100);
  const art = roundTwoBounties.map((b) =>
    kernelAppearance(b.bounty_id, b.base_bounty),
  );
  assert.equal(new Set(art.map((a) => a.kind)).size, 8);
  assert.ok(new Set(art.map((a) => a.size)).size >= 8);
  assert.ok(new Set(kernelCreatures.map((a) => a.pace)).size >= 6);
  assert.deepEqual([...new Set(art.map((a) => a.tier))].sort(), [0, 1, 2, 3]);
  assert.deepEqual(
    [0, 1, 2, 3].map((tier) => art.filter((a) => a.tier === tier).length),
    [32, 36, 20, 12],
  );
  for (const b of roundTwoBounties)
    for (const language of ["c", "cpp", "java", "python"] as const)
      assert.ok(roundTwoQuestion(b.bounty_id)?.variants[language].starter_code);
});
test("hundred-body steering stays bounded without intersections and retains all positions across reconciliation", () => {
  const memory = new Map<string, Roamer>(),
    specs = kernelSpecs(roundTwoBounties);
  syncRoamers(memory, specs, kernelWorld);
  for (let i = 0; i < 400; i++)
    stepSwarm([...memory.values()], 0.05, kernelWorld);
  const actors = [...memory.values()];
  for (let i = 0; i < actors.length; i++) {
    const a = actors[i];
    assert.ok(Number.isFinite(a.x + a.y + a.distance));
    assert.ok(
      a.x >= a.radius &&
        a.x <= 4096 - a.radius &&
        a.y >= a.radius &&
        a.y <= 2560 - a.radius,
    );
    for (let j = i + 1; j < actors.length; j++)
      assert.ok(
        Math.hypot(a.x - actors[j].x, a.y - actors[j].y) >=
          a.radius + actors[j].radius - 1,
        `overlapping ${a.id}/${actors[j].id}`,
      );
  }
  const before = actors.map((a) => [a.id, a.x, a.y, a.heading]);
  syncRoamers(memory, specs, kernelWorld);
  assert.deepEqual(
    [...memory.values()].map((a) => [a.id, a.x, a.y, a.heading]),
    before,
  );
});
test("panning clamps to the fixed world without resizing creature coordinates", () => {
  assert.deepEqual(kernelCamera({ x: -100, y: -20 }, 1024, 640), {
    x: 0,
    y: 0,
  });
  assert.deepEqual(kernelCamera({ x: 9000, y: 9000 }, 1024, 640), {
    x: 3072,
    y: 1920,
  });
  assert.deepEqual(kernelCamera({ x: 0, y: 0 }, 8000, 4000), { x: 0, y: 0 });
  assert.equal(kernelWorld.width / 1024, 4);
  assert.equal(kernelWorld.height / 640, 4);
});
