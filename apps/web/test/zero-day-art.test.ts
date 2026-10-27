import assert from "node:assert/strict";
import test from "node:test";
import { zeroDayLayout } from "../src/zero-day-layout";
import {
  zeroDayKinds,
  zeroDayPose,
  zeroDayParts,
  zeroDayLegs,
} from "../src/zero-day-entities";
import { bugAppearance, bugSpecies } from "../src/bug-art";
import { legPose } from "../src/bug-locomotion";
import { previewBugs } from "./preview-bugs";

test("Zero-Day architecture covers phone, overview and full maps with bounded modules and channels", () => {
  for (const [w, h] of [
    [160, 90],
    [490, 320],
    [1416, 1744],
    [4024, 2632],
    [6000, 4000],
  ]) {
    const result = zeroDayLayout(w, h);
    assert.ok(result.modules.length >= 4 && result.modules.length <= 48);
    assert.ok(result.channels.length >= 4 && result.channels.length <= 8);
    assert.ok(parseFloat(result.channels[0].slice(1)) < w * 0.15);
    assert.ok(parseFloat(result.channels.at(-1)!.slice(1)) > w * 0.85);
    assert.ok(
      result.modules.every(
        (p) =>
          p.x >= 0 &&
          p.x <= w &&
          p.y >= 0 &&
          p.y <= h &&
          p.kind >= 0 &&
          p.kind <= 2,
      ),
    );
    assert.ok(
      result.channels.every(
        (p) => p.startsWith("M") && !/NaN|Infinity/.test(p),
      ),
    );
    assert.deepEqual(zeroDayLayout(w, h), result);
  }
});
test("Zero-Day has six mechanical identities, distinct proportions and rarity sizes without changing category", () => {
  assert.deepEqual(
    Object.keys(zeroDayKinds).sort(),
    bugSpecies.map((b) => b.motion).sort(),
  );
  for (const field of ["name", "body", "colour", "signature"] as const)
    assert.equal(
      new Set(Object.values(zeroDayKinds).map((p) => p[field])).size,
      6,
    );
  for (const bug of previewBugs().filter((b) => b.category === "LOGIC")) {
    const art = bugAppearance(
      bug.bounty_id,
      bug.difficulty,
      "LOGIC",
      bug.base_bounty,
    );
    assert.equal(art.region.name, "Zero-Day Core");
    assert.equal(art.region.category, "LOGIC");
    assert.equal(art.name, zeroDayKinds[art.motion].name);
    assert.equal(art.movement, zeroDayKinds[art.motion].signature);
    assert.ok(
      bugAppearance(bug.bounty_id, 95, "LOGIC", 950).size >
        bugAppearance(bug.bounty_id, 10, "LOGIC", 100).size,
    );
  }
});
test("Zero-Day phase panels, clamps, filaments and chambers articulate; landing ripples occur on the ground", () => {
  for (const motion of bugSpecies.map((b) => b.motion)) {
    const shapes = new Set();
    for (let i = 0; i < 80; i++) {
      const p = zeroDayPose(motion, i / 10, i / 10, 17, true),
        parts = zeroDayParts(motion, p, i / 10);
      assert.ok(Object.values(p).every(Number.isFinite));
      assert.ok(p.lift >= 0 && p.lift <= 0.3);
      assert.ok(
        parts.length <= 5 &&
          parts.every(
            (part) =>
              Object.values(part).every(Number.isFinite) &&
              Math.abs(part.sx) > 0.1 &&
              part.sy > 0.1,
          ),
      );
      if (motion === "HOP" && p.lift > 0) assert.equal(p.ripple, 1);
      shapes.add(JSON.stringify(parts));
    }
    assert.ok(shapes.size > 10, motion);
  }
  assert.equal(zeroDayPose("HOP", 10, 10, 17, false).lift, 0);
});
test("Rootkit has four fixed hip joints and two-bone legs with alternating stance", () => {
  const legs = zeroDayLegs();
  assert.equal(legs.length, 4);
  for (const leg of legs)
    for (let i = 0; i < 40; i++) {
      const p = legPose(leg, "WALK", i / 40, 17);
      assert.deepEqual(p.hip, leg.hip);
      assert.ok(
        Math.abs(
          Math.hypot(p.hip.x - p.knee.x, p.hip.y - p.knee.y) - leg.upper,
        ) < 1e-6,
      );
      assert.ok(
        Math.abs(
          Math.hypot(p.foot.x - p.knee.x, p.foot.y - p.knee.y) - leg.lower,
        ) < 1e-6,
      );
    }
  assert.equal(new Set(legs.map((l) => l.offset)).size, 2);
});
