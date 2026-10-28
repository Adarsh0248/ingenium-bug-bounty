import assert from "node:assert/strict";
import test from "node:test";
import { syncRoamers, stepSwarm, closestRoamer } from "../src/bug-swarm";
import type { Roamer, RoamerSpec } from "../src/bug-swarm";
import { bugSpecies, bugAppearance } from "../src/bug-art";
import { mapBounds, mapExtent, regionTarget } from "../src/region-map";
import { regions } from "../src/regions";
import { travelHeading } from "../src/bug-locomotion";

const world = { width: 3000, height: 2200 };
function spec(id: string, x: number, y: number, index = 0): RoamerSpec {
  return {
    id,
    x,
    y,
    region: "neon",
    motion: bugSpecies[index % 6].motion,
    seed: 100 + index * 7919,
    size: 0.9 + (index % 5) * 0.12,
    pace: 0.8 + (index % 4) * 0.15,
  };
}
function clear(actors: Roamer[]) {
  for (let i = 0; i < actors.length; i++)
    for (let j = i + 1; j < actors.length; j++)
      assert.ok(
        Math.hypot(actors[i].x - actors[j].x, actors[i].y - actors[j].y) >=
          actors[i].radius + actors[j].radius + 2.9,
        `${actors[i].id}/${actors[j].id} overlap`,
      );
}
test("thirty mixed bodies steer without overlaps, teleporting or sliding sideways", () => {
  const memory = new Map<string, Roamer>(),
    specs = Array.from({ length: 30 }, (_, i) =>
      spec(String(i), 350 + (i % 6) * 430, 300 + Math.floor(i / 6) * 360, i),
    );
  syncRoamers(memory, specs, world);
  const actors = [...memory.values()],
    initial = actors.map((a) => ({ x: a.x, y: a.y }));
  for (let step = 0; step < 1600; step++) {
    const previous = actors.map((a) => ({ x: a.x, y: a.y }));
    stepSwarm(actors, 0.05, world);
    clear(actors);
    actors.forEach((a, i) => {
      const dx = a.x - previous[i].x,
        dy = a.y - previous[i].y,
        distance = Math.hypot(dx, dy);
      assert.ok(distance <= 11.001);
      assert.ok(
        a.x >= a.radius + 12 - 1e-6 &&
          a.x <= world.width - a.radius - 12 + 1e-6,
      );
      assert.ok(
        a.y >= a.radius + 12 - 1e-6 &&
          a.y <= world.height - a.radius - 12 + 1e-6,
      );
      if (distance > 1e-6)
        assert.ok(
          (dx * -Math.sin(a.heading) + dy * -Math.cos(a.heading)) / distance >
            0.999999,
        );
    });
  }
  assert.ok(
    actors.every(
      (a, i) => Math.hypot(a.x - initial[i].x, a.y - initial[i].y) > 100,
    ),
  );
});
test("head-on walkers turn past each other and a held body stays fixed while another passes", () => {
  for (const held of [false, true]) {
    const memory = new Map<string, Roamer>();
    syncRoamers(
      memory,
      [spec("a", 900, 1000, 1), spec("b", 1900, 1000, 7)],
      world,
    );
    const [a, b] = [...memory.values()];
    a.goalX = 2300;
    a.goalY = 1000;
    a.heading = travelHeading(1, 0);
    b.goalX = 500;
    b.goalY = 1000;
    b.heading = travelHeading(-1, 0);
    b.held = held;
    let deviated = false,
      furthest = a.x;
    for (let i = 0; i < 1000; i++) {
      stepSwarm([a, b], 0.05, world);
      clear([a, b]);
      deviated ||= Math.abs(a.y - 1000) > 20;
      furthest = Math.max(furthest, a.x);
    }
    assert.ok(deviated);
    assert.ok(furthest > 2000, "walker should pass the obstruction");
    if (held) {
      assert.equal(b.x, 1900);
      assert.equal(b.y, 1000);
    }
  }
});
test("reconciling captures retains movement memory, removes retired targets and fits a resized map", () => {
  const memory = new Map<string, Roamer>(),
    specs = [
      spec("a", 800, 800),
      { ...spec("b", 900, 900), region: "foundry" as const },
    ];
  syncRoamers(memory, specs, world);
  const a = memory.get("a")!,
    b = memory.get("b")!,
    savedB = { ...b };
  for (let i = 0; i < 100; i++) stepSwarm([a], 0.05, world);
  const savedA = { ...a };
  syncRoamers(
    memory,
    specs.map((s) => ({ ...s })),
    world,
  );
  assert.equal(memory.get("a"), a);
  assert.deepEqual(a, savedA);
  assert.deepEqual(b, savedB);
  stepSwarm([b], 0.05, world);
  assert.deepEqual(a, savedA);
  syncRoamers(memory, [specs[0]], { width: 1500, height: 1100 });
  assert.equal(memory.size, 1);
  assert.ok(
    Math.abs(a.x - savedA.x / 2) < 1e-6 && Math.abs(a.y - savedA.y / 2) < 1e-6,
  );
  assert.equal(a.distance, savedA.distance);
  syncRoamers(memory, [{ ...specs[0], region: "foundry" }], world);
  assert.notEqual(memory.get("a"), a);
  assert.equal(memory.get("a")!.region, "foundry");
});
test("thirty actual creature footprints also fit compact screens in each region", () => {
  const bounds = mapBounds(320, 568),
    smallWorld = mapExtent(bounds);
  for (const region of regions) {
    const memory = new Map<string, Roamer>(),
      specs = Array.from({ length: 30 }, (_, i) => {
        const id = `00000000-0000-4000-8000-${String(2000 + i).padStart(12, "0")}`,
          art = bugAppearance(id, 10 + i * 3, region.category),
          p = regionTarget(i, 30, bounds);
        return {
          id,
          region: region.id,
          motion: art.motion,
          seed: art.seed,
          size: art.size,
          pace: art.speed,
          x: p.x,
          y: p.y,
        };
      });
    syncRoamers(memory, specs, smallWorld);
    const actors = [...memory.values()];
    clear(actors);
    for (let step = 0; step < 100; step++) {
      stepSwarm(actors, 0.05, smallWorld);
      clear(actors);
    }
  }
});
test("transparent drawing rectangles do not steal selection from a neighbouring body", () => {
  const memory = new Map<string, Roamer>();
  syncRoamers(memory, [spec("a", 800, 800), spec("b", 950, 800)], world);
  const a = memory.get("a")!,
    b = memory.get("b")!;
  assert.equal(closestRoamer({ x: a.x, y: a.y }, memory.values(), "neon"), "a");
  assert.equal(closestRoamer({ x: b.x, y: b.y }, memory.values(), "neon"), "b");
  assert.equal(
    closestRoamer({ x: 10, y: 10 }, memory.values(), "neon"),
    undefined,
  );
  assert.equal(
    closestRoamer({ x: a.x, y: a.y }, memory.values(), "foundry"),
    undefined,
  );
});

test("indexed avoidance finds the same opposing pair as exhaustive neighbours at low and high speed", () => {
  const large = { width: 20000, height: 20000 };
  for (const speed of [0, 220]) {
    const memory = new Map<string, Roamer>();
    syncRoamers(
      memory,
      Array.from({ length: 39 }, (_, i) =>
        spec(
          String(i),
          i === 1 ? 1250 : 1000 + (i % 7) * 2200,
          1000 + Math.floor(i / 7) * 2200,
          i,
        ),
      ),
      large,
    );
    const brute = [...memory.values()];
    brute[0].heading = travelHeading(1, 0);
    brute[0].goalX = 3000;
    brute[0].goalY = 1000;
    brute[1].heading = travelHeading(-1, 0);
    brute[1].goalX = 400;
    brute[1].goalY = 1000;
    for (const a of brute) {
      a.held = Number(a.id) > 1;
      a.velocity = speed;
      a.vx = -Math.sin(a.heading) * speed;
      a.vy = -Math.cos(a.heading) * speed;
    }
    const indexed = structuredClone(brute);
    indexed.push({
      ...indexed[0],
      id: "far-away",
      x: 19000,
      y: 19000,
      held: true,
    });
    for (let tick = 0; tick < 100; tick++) {
      stepSwarm(brute, 0.05, large, "3");
      stepSwarm(indexed, 0.05, large, "3");
      brute.forEach((a, i) =>
        assert.ok(
          Math.hypot(a.x - indexed[i].x, a.y - indexed[i].y) < 1e-7,
          `missed neighbour for ${a.id} at speed ${speed}`,
        ),
      );
    }
  }
});
