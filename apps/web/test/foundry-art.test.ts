import assert from "node:assert/strict";
import test from "node:test";
import { foundryLayout } from "../src/foundry-circuit";
import {
  foundryBodies,
  foundryWheels,
  foundryWheelRoll,
  foundryPaint,
  foundryTraits,
  foundryAttack,
} from "../src/foundry-creatures";
import { bugSpecies, bugAppearance } from "../src/bug-art";
import {
  bugWander,
  mapBounds,
  mapExtent,
  regionTarget,
} from "../src/region-map";

test("Foundry has six armoured chassis and hardware-specific names without changing categories or bounty", () => {
  assert.deepEqual(
    Object.keys(foundryBodies).sort(),
    bugSpecies.map((b) => b.motion).sort(),
  );
  assert.equal(new Set(Object.values(foundryBodies)).size, 6);
  assert.equal(
    new Set(Object.values(foundryPaint).map((p) => p.paint)).size,
    6,
  );
  assert.ok(
    Object.values(foundryBodies).every(
      (d) => d.startsWith("M128") && d.endsWith("Z"),
    ),
  );
  const fleet = Array.from({ length: 60 }, (_, i) =>
    bugAppearance(`rover-${i}`, 75, "SYSTEMS", 750),
  );
  assert.equal(new Set(fleet.map((b) => b.motion)).size, 6);
  assert.ok(
    fleet.every((b) => b.region.id === "foundry" && b.rank.label === "Elite"),
  );
  assert.ok(
    fleet.every(
      (b) => !/[Ww]alk|[Ww]ing|[Cc]rawl|[Hh]opp|[Dd]ragg/.test(b.movement),
    ),
  );
});

test("Foundry bounty makes the same chassis clearly larger and slower, with weapons only on high-value targets", () => {
  for (const species of bugSpecies) {
    const seed = 173,
      low = foundryTraits(species.motion, 100, seed),
      rare = foundryTraits(species.motion, 400, seed),
      elite = foundryTraits(species.motion, 700, seed),
      apex = foundryTraits(species.motion, 1000, seed);
    assert.ok(apex.size > low.size * 4);
    assert.ok(
      low.size < rare.size && rare.size < elite.size && elite.size < apex.size,
    );
    assert.ok(
      low.speed > rare.speed &&
        rare.speed > elite.speed &&
        elite.speed > apex.speed,
    );
    assert.deepEqual(
      [low.weapon, rare.weapon, elite.weapon, apex.weapon],
      ["none", "none", "pulse", "siege"],
    );
    const a = bugWander(seed, 8, species.motion, low.speed, { x: 0, y: 0 }, 15),
      b = bugWander(seed, 8, species.motion, apex.speed, { x: 0, y: 0 }, 15);
    assert.ok(
      Math.hypot(a.x, a.y) > Math.hypot(b.x, b.y) * 2,
      "small units must travel faster, not merely have a different label",
    );
  }
  const a = bugAppearance("same-machine", 50, "SYSTEMS", 100),
    b = bugAppearance("same-machine", 50, "SYSTEMS", 1000);
  assert.equal(a.motion, b.motion);
  assert.ok(b.size > a.size * 4);
  assert.ok(a.speed > b.speed);
  const bounds = mapBounds(390, 844),
    world = mapExtent(bounds),
    inset = b.size * 76;
  for (let slot = 0; slot < 30; slot++)
    for (const wander of [
      undefined,
      { x: -1, y: -1, dx: 1, dy: 1 },
      { x: 1, y: 1, dx: 1, dy: 1 },
    ]) {
      const p = regionTarget(slot, 30, bounds, wander, inset);
      assert.ok(
        p.x >= inset &&
          p.x <= world.width - inset &&
          p.y >= inset &&
          p.y <= world.height - inset,
      );
    }
});

test("mounted weapons have bounded staggered recoil, projectile and impact phases without arming common bots", () => {
  for (const weapon of ["pulse", "siege"] as const) {
    let flash = false,
      flight = false,
      impact = false,
      recoil = false,
      idle = false;
    for (let t = 0; t < 25; t += 0.025) {
      const p = foundryAttack(197, t, weapon);
      assert.ok(p.recoil >= 0 && p.recoil <= 0.14 && Math.abs(p.aim) <= 0.85);
      assert.ok(p.flight === -1 || (p.flight >= 0 && p.flight < 1));
      assert.ok(p.impact === -1 || (p.impact >= 0 && p.impact < 1));
      assert.ok(!(p.flight >= 0 && p.impact >= 0));
      flash ||= p.flash;
      flight ||= p.flight >= 0;
      impact ||= p.impact >= 0;
      recoil ||= p.recoil > 0;
      idle ||= !p.flash && p.flight < 0 && p.impact < 0;
      const unarmed = foundryAttack(197, t, "none");
      assert.equal(unarmed.flash, false);
      assert.equal(unarmed.flight, -1);
      assert.equal(unarmed.impact, -1);
      assert.equal(unarmed.recoil, 0);
    }
    assert.ok(flash && flight && impact && recoil && idle);
  }
  assert.notDeepEqual(
    foundryAttack(1, 2, "siege"),
    foundryAttack(2, 2, "siege"),
  );
});
test("wheels roll with distance, counter-rotate for steering and stay stopped without movement", () => {
  for (const [motion, count] of [
    ["FLY", 0],
    ["DART", 0],
    ["WALK", 4],
    ["HOP", 4],
    ["SKITTER", 6],
    ["DRAG", 8],
  ] as const) {
    const wheels = foundryWheels(motion);
    assert.equal(wheels.length, count);
    assert.ok(wheels.every((p) => Math.abs(p.x) === 0.93 && Math.abs(p.y) < 1));
    assert.equal(new Set(wheels.map((p) => `${p.x},${p.y}`)).size, count);
  }
  assert.equal(Math.abs(foundryWheelRoll(0, 0, 0.93)), 0);
  assert.ok(
    Math.abs(foundryWheelRoll(2 * Math.PI * 0.22, 0, 0.93) + 2 * Math.PI) <
      1e-9,
  );
  assert.ok(foundryWheelRoll(0, 0.2, -0.93) > 0);
  assert.ok(foundryWheelRoll(0, 0.2, 0.93) < 0);
  assert.equal(foundryWheelRoll(0.5, 0, -0.93), foundryWheelRoll(0.5, 0, 0.93));
});
test("motherboard traffic links terminate on actual module ports and keep scenery bounded", () => {
  for (const [w, h] of [
    [1136, 640],
    [1416, 1744],
    [4024, 2632],
    [6000, 4000],
  ]) {
    const layout = foundryLayout(w, h),
      { modules, links, routes } = layout;
    assert.ok(modules.length > 0 && modules.length <= 48);
    assert.ok(links.length > 0 && links.length <= 12 && routes.length <= 14);
    for (const { from, to, path } of links) {
      assert.ok(
        modules.some((m) => m.y === from.y && m.x + m.width / 2 === from.x),
      );
      assert.ok(
        modules.some((m) => m.y === to.y && m.x - m.width / 2 === to.x),
      );
      assert.ok(
        [from, to].every((p) => p.x >= 0 && p.x <= w && p.y >= 0 && p.y <= h),
      );
      assert.ok(
        path.startsWith(`M${from.x} ${from.y}`) && path.endsWith(`H${to.x}`),
      );
      assert.ok(!/NaN|Infinity/.test(path));
    }
    assert.deepEqual(foundryLayout(w, h), layout);
  }
});
