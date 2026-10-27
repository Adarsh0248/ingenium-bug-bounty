import assert from "node:assert/strict";
import test from "node:test";
import { nexusNetwork } from "../src/nexus-network";
import { nexusKinds, nexusParts, nexusPose } from "../src/nexus-creatures";
import { bugAppearance, bugSpecies } from "../src/bug-art";
import { previewBugs } from "./preview-bugs";

test("Nexus is a bounded connected acyclic graph at overview, phone and full map sizes", () => {
  for (const [w, h] of [
    [160, 90],
    [490, 320],
    [1416, 1744],
    [4024, 2632],
    [6000, 4000],
  ]) {
    const { nodes, links } = nexusNetwork(w, h);
    assert.ok(nodes.length >= 5 && nodes.length <= 49);
    assert.equal(links.length, nodes.length - 1);
    nodes.forEach((node, i) => {
      assert.ok(node.x >= 0 && node.x <= w && node.y >= 0 && node.y <= h);
      if (i) assert.ok(node.parent >= 0 && node.parent < i);
    });
    assert.ok(
      links.every(
        (l) => l.path.startsWith("M") && !/NaN|Infinity/.test(l.path),
      ),
    );
    assert.deepEqual(nexusNetwork(w, h), { nodes, links });
  }
});
test("six cyber-anomalies have unique silhouettes, palettes and signal identities", () => {
  assert.deepEqual(
    Object.keys(nexusKinds).sort(),
    bugSpecies.map((b) => b.motion).sort(),
  );
  for (const field of ["name", "body", "colour", "signature"] as const)
    assert.equal(
      new Set(Object.values(nexusKinds).map((b) => b[field])).size,
      6,
    );
  for (const bug of previewBugs().filter((b) => b.category === "GRAPHS")) {
    const art = bugAppearance(
      bug.bounty_id,
      bug.difficulty,
      "GRAPHS",
      bug.base_bounty,
    );
    assert.equal(art.name, nexusKinds[art.motion].name);
    assert.equal(art.movement, nexusKinds[art.motion].signature);
    assert.equal(art.region.name, "Verdant Nexus");
    assert.ok(
      bugAppearance(bug.bounty_id, 90, "GRAPHS", 950).size >
        bugAppearance(bug.bounty_id, 10, "GRAPHS", 100).size,
    );
  }
});
test("Nexus joints are bounded, hopping is grounded at rest and each family articulates", () => {
  for (const motion of bugSpecies.map((b) => b.motion)) {
    const states = Array.from({ length: 80 }, (_, i) => {
      const pose = nexusPose(motion, i / 10, i / 10, 17, true),
        parts = nexusParts(motion, pose, i / 10);
      assert.ok(Object.values(pose).every(Number.isFinite));
      assert.ok(
        parts.length <= 5 &&
          parts.every(
            (p) =>
              Object.values(p).every(Number.isFinite) && p.sx > 0 && p.sy > 0,
          ),
      );
      assert.ok(pose.lift >= 0 && pose.lift <= 0.31);
      if (motion === "HOP" && pose.lift > 0) assert.equal(pose.ripple, 1);
      return JSON.stringify(parts);
    });
    assert.ok(new Set(states).size > 10, motion);
  }
  assert.equal(nexusPose("HOP", 10, 10, 17, false).lift, 0);
  assert.notEqual(
    nexusPose("HOP", 0, 0, 17, true).lift,
    nexusPose("HOP", 0, 0.2, 17, true).lift,
  );
});
