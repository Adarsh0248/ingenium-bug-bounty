import assert from "node:assert/strict";
import test from "node:test";
import { neonBodies } from "../src/neon-creatures";
import { bugSpecies } from "../src/bug-art";
import { circuitLayout } from "../src/neon-circuit";

test("Neon has six distinct circuit-shell drawings for the existing movement types", () => {
  assert.deepEqual(
    Object.keys(neonBodies).sort(),
    bugSpecies.map((b) => b.motion).sort(),
  );
  assert.equal(new Set(Object.values(neonBodies)).size, 6);
  assert.ok(
    Object.values(neonBodies).every(
      (path) => path.startsWith("M128") && path.endsWith("Z"),
    ),
  );
});
test("the circuit world fills different map sizes with bounded modules and valid packet routes", () => {
  for (const [width, height] of [
    [1136, 640],
    [1416, 1744],
    [4024, 2632],
    [6000, 4000],
  ]) {
    const { modules, routes } = circuitLayout(width, height);
    assert.ok(modules.length > 0 && modules.length <= 48);
    assert.ok(routes.length > 0 && routes.length <= 14);
    for (const m of modules) {
      assert.ok(m.x - m.width / 2 >= 0 && m.x + m.width / 2 <= width);
      assert.ok(m.y - m.height / 2 >= 0 && m.y + m.height / 2 <= height);
      assert.ok(m.kind >= 0 && m.kind <= 4);
      assert.ok(
        Math.abs(m.x - width / 2) >= 126 + m.width / 2 ||
          Math.abs(m.y - height / 2) >= 126 + m.height / 2,
      );
      assert.match(m.address, /^0x[0-9A-F]+$/);
    }
    assert.ok(
      routes.every(
        (path) => path.startsWith("M") && !/NaN|Infinity/.test(path),
      ),
    );
    assert.deepEqual(circuitLayout(width, height), { modules, routes });
  }
});
