import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { CanvasTexture, Object3D, SRGBColorSpace } from "three";
import type { Group, InstancedMesh, Mesh, MeshBasicMaterial } from "three";
import type { bugAppearance, BugMotion } from "./bug-art";
import {
  zeroDayLegs,
  zeroDayParts,
  zeroDayPlate,
  zeroDayPose,
} from "./zero-day-entities";
import type { ZeroDayPart } from "./zero-day-entities";
import BugLegs from "./BugLegs";

const textures = new Map<string, CanvasTexture>(),
  ignoreRaycast = () => {};
function texture(motion: BugMotion, part: ZeroDayPart) {
  const key = `${motion}:${part}`;
  if (!textures.has(key)) {
    const map = new CanvasTexture(zeroDayPlate(motion, part));
    map.colorSpace = SRGBColorSpace;
    textures.set(key, map);
  }
  return textures.get(key)!;
}
if (import.meta.hot)
  import.meta.hot.dispose(() => {
    textures.forEach((t) => t.dispose());
    textures.clear();
  });
export default function ZeroDayEntity({
  bug,
  still,
  moving,
  distance,
}: {
  bug: ReturnType<typeof bugAppearance>;
  still: boolean;
  moving: React.RefObject<boolean>;
  distance: React.RefObject<number>;
}) {
  const elevation = useRef<Group>(null),
    body = useRef<Group>(null),
    left = useRef<Group>(null),
    right = useRef<Group>(null),
    parts = useRef<InstancedMesh>(null),
    reaction = useRef<Mesh>(null),
    time = useRef(0),
    initialized = useRef(false),
    object = useMemo(() => new Object3D(), []),
    legs = useMemo(() => zeroDayLegs(), []),
    maps = useMemo(
      () => [
        texture(bug.motion, "body"),
        texture(bug.motion, "moving"),
        texture(bug.motion, "reaction"),
        ...(bug.flying
          ? [texture(bug.motion, "leftWing"), texture(bug.motion, "rightWing")]
          : []),
      ],
      [bug.motion, bug.flying],
    ),
    count = zeroDayParts(
      bug.motion,
      zeroDayPose(bug.motion, 0, 0, bug.seed, false),
      0,
    ).length;
  useFrame((_, delta) => {
    if (
      !elevation.current ||
      !body.current ||
      !parts.current ||
      !reaction.current ||
      (still && initialized.current)
    )
      return;
    if (!still) time.current += Math.min(delta, 0.05) * bug.speed;
    const pose = zeroDayPose(
      bug.motion,
      time.current,
      distance.current,
      bug.seed,
      moving.current,
    );
    elevation.current.position.z = pose.lift;
    body.current.scale.y = pose.squash;
    if (left.current && right.current) {
      left.current.rotation.y = pose.wing;
      right.current.rotation.y = -pose.wing;
    }
    zeroDayParts(bug.motion, pose, distance.current).forEach((p, i) => {
      object.position.set(p.x, p.y, bug.motion === "WALK" ? 0.12 : 0.015);
      object.rotation.set(0, 0, p.angle);
      object.scale.set(p.sx, p.sy, 1);
      object.updateMatrix();
      parts.current!.setMatrixAt(i, object.matrix);
    });
    parts.current.instanceMatrix.needsUpdate = true;
    reaction.current.position.y =
      bug.motion === "FLY" || bug.motion === "DART"
        ? -0.8
        : bug.motion === "DRAG"
          ? -0.7
          : 0;
    const ripple = bug.motion === "HOP" ? 0.75 + pose.ripple * 0.85 : 1;
    reaction.current.scale.set(ripple, ripple, 1);
    (reaction.current.material as MeshBasicMaterial).opacity =
      bug.motion === "HOP"
        ? 0.75 * (1 - pose.ripple)
        : 0.45 + Math.sin(pose.phase * 0.4) * 0.08;
    initialized.current = true;
  }, -0.5);
  return (
    <group scale={bug.size} name="motion-rig">
      <mesh
        ref={reaction}
        position={[0, 0, -0.12]}
        name="zero-day-signal-trail"
        raycast={ignoreRaycast}
      >
        <planeGeometry args={[4, 4]} />
        <meshBasicMaterial
          map={maps[2]}
          transparent
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <group ref={elevation} name="motion-elevation">
        <instancedMesh
          ref={parts}
          args={[undefined, undefined, count]}
          frustumCulled={false}
          name="zero-day-articulated-parts"
          renderOrder={bug.motion === "WALK" ? 1 : 0}
          raycast={ignoreRaycast}
        >
          <planeGeometry args={[3, 3]} />
          <meshBasicMaterial
            map={maps[1]}
            transparent
            depthWrite={false}
            toneMapped={false}
          />
        </instancedMesh>
        <group ref={body} name="motion-body-pose">
          <mesh position={[0, 0, 0.09]}>
            <planeGeometry args={[3, 3]} />
            <meshBasicMaterial
              map={maps[0]}
              transparent
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        </group>
        {bug.motion === "WALK" && (
          <BugLegs
            bug={bug}
            distance={distance}
            still={still}
            chains={legs}
            thickness={2.5}
          />
        )}
        {bug.flying && (
          <>
            <group
              ref={left}
              position={[-0.12, 0.22, 0.02]}
              name="motion-left-wing"
            >
              <mesh position={[0.12, -0.22, 0]}>
                <planeGeometry args={[3, 3]} />
                <meshBasicMaterial
                  map={maps[3]}
                  transparent
                  depthWrite={false}
                  toneMapped={false}
                />
              </mesh>
            </group>
            <group
              ref={right}
              position={[0.12, 0.22, 0.02]}
              name="motion-right-wing"
            >
              <mesh position={[-0.12, -0.22, 0]}>
                <planeGeometry args={[3, 3]} />
                <meshBasicMaterial
                  map={maps[4]}
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
