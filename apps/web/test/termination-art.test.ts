import assert from "node:assert/strict";
import test from "node:test";
import {
  regionWeapons,
  terminationPose,
  terminationDuration,
} from "../src/termination-art";
import { regions } from "../src/regions";

test("four regional weapons have distinct identities and bounded staged timelines", () => {
  assert.equal(
    new Set(Object.values(regionWeapons).map((w) => w.name)).size,
    4,
  );
  for (const region of regions)
    for (let tier = 0; tier < 4; tier++) {
      const duration = terminationDuration(tier),
        phases = new Set<string>();
      let previous = terminationPose(region.id, 0, tier);
      assert.ok(duration >= 5.5 && duration <= 6.2);
      for (let time = 0; time <= duration + 0.1; time += 0.02) {
        const pose = terminationPose(region.id, time, tier);
        phases.add(pose.phase);
        for (const field of [
          "deploy",
          "charge",
          "fire",
          "destroy",
          "retract",
          "debris",
          "ghost",
          "targetX",
          "targetY",
        ] as const) {
          assert.ok(
            Number.isFinite(pose[field]) &&
              pose[field] >= 0 &&
              pose[field] <= 1,
            field,
          );
          assert.ok(
            Math.abs(pose[field] - previous[field]) < 0.2,
            `${field} should transition without abrupt flashes`,
          );
        }
        if (pose.t < 2)
          assert.equal(
            pose.destroy,
            0,
            "target remains intact during deployment and charge",
          );
        if (pose.t >= 4) assert.equal(pose.targetVisible, false);
        previous = pose;
      }
      assert.deepEqual(
        phases,
        new Set([
          "DEPLOYING",
          "CHARGING",
          "LOCKED ON",
          "TERMINATING",
          regionWeapons[region.id].finish,
          "RETRACTING",
        ]),
      );
      assert.equal(terminationPose(region.id, duration + 0.1, tier).done, true);
    }
});
test("the same target reacts differently to a lance, crusher and nullpoint containment", () => {
  const t = 3.2,
    tier = 2,
    neon = terminationPose("neon", t, tier),
    foundry = terminationPose("foundry", t, tier),
    nullpoint = terminationPose("cryo", t, tier);
  assert.ok(neon.targetY < neon.targetX);
  assert.ok(foundry.targetX < foundry.targetY);
  assert.ok(nullpoint.targetX < 1 && nullpoint.targetY < 1);
  assert.ok(terminationDuration(3) > terminationDuration(0));
});
