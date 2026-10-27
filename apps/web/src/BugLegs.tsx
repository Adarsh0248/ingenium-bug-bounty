import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, Object3D } from "three";
import type { InstancedMesh } from "three";
import { legChains, legPose } from "./bug-locomotion";
import type { bugAppearance } from "./bug-art";

export default function BugLegs({
  bug,
  distance,
  still,
  chains: suppliedChains,
  thickness = 1,
}: {
  bug: ReturnType<typeof bugAppearance>;
  distance: React.RefObject<number>;
  still: boolean;
  chains?: ReturnType<typeof legChains>;
  thickness?: number;
}) {
  const ref = useRef<InstancedMesh>(null),
    initialized = useRef(false),
    lastDistance = useRef(Number.NaN),
    chains = useMemo(
      () => suppliedChains ?? legChains(bug.motion),
      [bug.motion, suppliedChains],
    ),
    object = useMemo(() => new Object3D(), []);
  useLayoutEffect(() => {
    const dark = new Color("#102739"),
      light = new Color(bug.region.limb);
    for (let i = 0; i < chains.length * 4; i++)
      ref.current!.setColorAt(i, i % 2 ? light : dark);
    ref.current!.instanceColor!.needsUpdate = true;
    initialized.current = false;
  }, [bug.region.limb, chains]);
  useFrame(() => {
    if (
      !ref.current ||
      ((still || lastDistance.current === distance.current) &&
        initialized.current)
    )
      return;
    chains.forEach((chain, i) => {
      const pose = legPose(chain, bug.motion, distance.current, bug.seed);
      const segments = [
        [pose.hip, pose.knee],
        [pose.knee, pose.foot],
      ];
      segments.forEach(([a, b], j) => {
        for (let layer = 0; layer < 2; layer++) {
          object.position.set(
            (a.x + b.x) / 2,
            (a.y + b.y) / 2,
            0.015 + layer * 0.002,
          );
          object.rotation.set(0, 0, Math.atan2(b.y - a.y, b.x - a.x));
          object.scale.set(
            Math.hypot(b.x - a.x, b.y - a.y),
            (layer ? 0.018 : 0.038) * thickness,
            1,
          );
          object.updateMatrix();
          ref.current!.setMatrixAt(i * 4 + j * 2 + layer, object.matrix);
        }
      });
    });
    ref.current.instanceMatrix.needsUpdate = true;
    initialized.current = true;
    lastDistance.current = distance.current;
  });
  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, chains.length * 4]}
      frustumCulled={false}
      name="motion-jointed-legs"
    >
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}
