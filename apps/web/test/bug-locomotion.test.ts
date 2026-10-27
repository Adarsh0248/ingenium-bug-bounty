import assert from "node:assert/strict";
import test from "node:test";
import { bugSpecies } from "../src/bug-art";
import {
  legChains,
  legPose,
  travelHeading,
  turnTowards,
} from "../src/bug-locomotion";

test("a bug faces its actual travel direction and turns along the shortest bounded arc", () => {
  assert.equal(travelHeading(1, 0), -Math.PI / 2);
  assert.ok(Math.abs(travelHeading(0, -1)) < 1e-10);
  const current = Math.PI - 0.05,
    next = turnTowards(current, -Math.PI + 0.1, 0.04);
  assert.ok(Math.abs(next - current) <= 0.040001);
  assert.ok(next > current);
  let heading = 0;
  for (let i = 0; i < 40; i++)
    heading = turnTowards(heading, -Math.PI / 2, 0.05);
  assert.ok(Math.abs(heading + Math.PI / 2) < 1e-10);
});
test("jointed legs keep fixed hips and bone lengths, with planted feet staying on the ground", () => {
  for (const species of bugSpecies)
    for (const chain of legChains(species.motion)) {
      for (let distance = 0; distance < 2; distance += 0.003) {
        const pose = legPose(chain, species.motion, distance, 0),
          next = legPose(chain, species.motion, distance + 0.0001, 0);
        assert.deepEqual(pose.hip, chain.hip);
        assert.ok(
          Math.abs(
            Math.hypot(pose.knee.x - pose.hip.x, pose.knee.y - pose.hip.y) -
              chain.upper,
          ) < 1e-8,
        );
        assert.ok(
          Math.abs(
            Math.hypot(pose.foot.x - pose.knee.x, pose.foot.y - pose.knee.y) -
              chain.lower,
          ) < 1e-8,
        );
        if (pose.planted && next.planted) {
          assert.ok(Math.abs(pose.foot.x - next.foot.x) < 1e-6);
          assert.ok(
            Math.abs(pose.foot.y + distance - next.foot.y - distance - 0.0001) <
              1e-6,
            `${species.motion} foot must not skate during stance`,
          );
        }
      }
    }
});
test("walking uses alternating support groups and hovering legs do not flap with wings", () => {
  const legs = legChains("WALK");
  assert.equal(legs.length, 6);
  let sawSwing = false;
  for (let d = 0; d < 1; d += 0.002) {
    const poses = legs.map((leg) => legPose(leg, "WALK", d, 0));
    assert.ok(poses.filter((p) => p.planted).length >= 3);
    sawSwing ||= poses.some((p) => !p.planted && p.lift > 0);
  }
  assert.ok(sawSwing);
  for (const motion of ["FLY", "DART"] as const)
    for (const leg of legChains(motion))
      assert.deepEqual(legPose(leg, motion, 0, 0), legPose(leg, motion, 10, 0));
});
