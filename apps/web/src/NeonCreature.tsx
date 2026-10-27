import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { CanvasTexture, SRGBColorSpace } from "three";
import type { Group } from "three";
import { bugPose } from "./bug-art";
import type { bugAppearance, BugMotion } from "./bug-art";
import { neonPlate } from "./neon-creatures";
import type { NeonPart } from "./neon-creatures";
import BugLegs from "./BugLegs";

type Appearance = ReturnType<typeof bugAppearance>;
const textures = new Map<string, CanvasTexture>();
function plateTexture(motion: BugMotion, part: NeonPart) {
  const key = `${motion}:${part}`;
  if (!textures.has(key)) {
    const texture = new CanvasTexture(neonPlate(motion, part));
    texture.colorSpace = SRGBColorSpace;
    textures.set(key, texture);
  }
  return textures.get(key)!;
}
if (import.meta.hot)
  import.meta.hot.dispose(() => {
    for (const texture of textures.values()) texture.dispose();
    textures.clear();
  });

export default function NeonCreature({
  bug,
  still,
  moving,
  distance,
}: {
  bug: Appearance;
  still: boolean;
  moving: React.RefObject<boolean>;
  distance: React.RefObject<number>;
}) {
  const body = useRef<Group>(null),
    elevation = useRef<Group>(null),
    leftWing = useRef<Group>(null),
    rightWing = useRef<Group>(null),
    time = useRef(0);
  const maps = useMemo(
    () => [
      plateTexture(bug.motion, "body"),
      ...(bug.flying
        ? [
            plateTexture(bug.motion, "leftWing"),
            plateTexture(bug.motion, "rightWing"),
          ]
        : []),
    ],
    [bug.motion],
  );
  useFrame((_, delta) => {
    if (!body.current || !elevation.current || still) return;
    if (bug.flying) time.current += Math.min(delta, 0.05) * bug.speed;
    const pose = bugPose(
        bug.motion,
        bug.flying ? time.current : distance.current,
        bug.seed,
      ),
      height = bug.flying || moving.current ? pose.lift : 0;
    body.current.scale.set(1 - pose.stretch * 0.2, 1 + pose.stretch, 1);
    body.current.rotation.z = pose.rock;
    elevation.current.position.z +=
      (height - elevation.current.position.z) * Math.min(1, delta * 14);
    elevation.current.scale.setScalar(1 + elevation.current.position.z * 0.25);
    if (leftWing.current && rightWing.current) {
      leftWing.current.rotation.y = pose.wing;
      rightWing.current.rotation.y = -pose.wing;
    }
  });
  return (
    <group scale={bug.size} name="motion-rig">
      {bug.motion === "HOP" && (
        <mesh position={[0, 0, -0.035]} scale={[0.85, 0.55, 1]}>
          <circleGeometry args={[0.7, 16]} />
          <meshBasicMaterial
            color="#020711"
            transparent
            opacity={0.24}
            depthWrite={false}
          />
        </mesh>
      )}
      <group ref={elevation} name="motion-elevation">
        <group ref={body} name="motion-body-pose">
          <mesh position={[0, 0, 0.08]}>
            <planeGeometry args={[3, 3]} />
            <meshBasicMaterial
              map={maps[0]}
              transparent
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        </group>
        <BugLegs bug={bug} distance={distance} still={still} />
        {bug.flying && (
          <>
            <group
              ref={leftWing}
              position={[-0.12, 0.22, 0.02]}
              name="motion-left-wing"
            >
              <mesh position={[0.12, -0.22, 0]}>
                <planeGeometry args={[3, 3]} />
                <meshBasicMaterial
                  map={maps[1]}
                  transparent
                  depthWrite={false}
                  toneMapped={false}
                />
              </mesh>
            </group>
            <group
              ref={rightWing}
              position={[0.12, 0.22, 0.02]}
              name="motion-right-wing"
            >
              <mesh position={[-0.12, -0.22, 0]}>
                <planeGeometry args={[3, 3]} />
                <meshBasicMaterial
                  map={maps[2]}
                  transparent
                  depthWrite={false}
                  toneMapped={false}
                />
              </mesh>
            </group>
          </>
        )}
      </group>
    </group>
  );
}
