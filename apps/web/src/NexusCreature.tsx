import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { CanvasTexture, Object3D, SRGBColorSpace } from "three";
import type { Group, InstancedMesh, Mesh, MeshBasicMaterial } from "three";
import type { bugAppearance, BugMotion } from "./bug-art";
import { nexusParts, nexusPlate, nexusPose } from "./nexus-creatures";
import type { NexusPart } from "./nexus-creatures";

const textures = new Map<string, CanvasTexture>(),
  ignoreRaycast = () => {};
function texture(motion: BugMotion, part: NexusPart) {
  const key = `${motion}:${part}`;
  if (!textures.has(key)) {
    const map = new CanvasTexture(nexusPlate(motion, part));
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

export default function NexusCreature({
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
  const body = useRef<Group>(null),
    elevation = useRef<Group>(null),
    parts = useRef<InstancedMesh>(null),
    reaction = useRef<Mesh>(null),
    time = useRef(0),
    initialized = useRef(false),
    object = useMemo(() => new Object3D(), []),
    maps = useMemo(
      () => [
        texture(bug.motion, "body"),
        texture(bug.motion, "moving"),
        texture(bug.motion, "reaction"),
      ],
      [bug.motion],
    ),
    count = nexusParts(
      bug.motion,
      nexusPose(bug.motion, 0, 0, bug.seed, false),
      0,
    ).length;
  useFrame((_, delta) => {
    if (
      !body.current ||
      !parts.current ||
      !elevation.current ||
      !reaction.current ||
      (still && initialized.current)
    )
      return;
    if (!still) time.current += Math.min(delta, 0.05) * bug.speed;
    const pose = nexusPose(
      bug.motion,
      time.current,
      distance.current,
      bug.seed,
      moving.current,
    );
    elevation.current.position.z = pose.lift;
    body.current.scale.y = pose.compression;
    const pieces = nexusParts(bug.motion, pose, distance.current);
    pieces.forEach((p, i) => {
      object.position.set(p.x, p.y, bug.motion === "SKITTER" ? 0.04 : 0.02);
      object.rotation.set(0, 0, p.angle);
      object.scale.set(p.sx, p.sy, 1);
      object.updateMatrix();
      parts.current!.setMatrixAt(i, object.matrix);
    });
    parts.current.instanceMatrix.needsUpdate = true;
    reaction.current.rotation.z =
      bug.motion === "SKITTER" ? -pose.phase * 0.22 : 0;
    reaction.current.position.y =
      bug.motion === "DART" ? -0.85 : bug.motion === "DRAG" ? -0.45 : 0;
    const ripple = bug.motion === "HOP" ? 0.8 + pose.ripple * 0.7 : 1;
    reaction.current.scale.set(ripple, ripple, 1);
    (reaction.current.material as MeshBasicMaterial).opacity =
      bug.motion === "HOP" ? 0.7 * (1 - pose.ripple) : pose.signal * 0.65;
    initialized.current = true;
  }, -0.5);
  return (
    <group scale={bug.size} name="motion-rig" userData={{ nexus: true }}>
      <mesh
        ref={reaction}
        position={[0, 0, -0.12]}
        raycast={ignoreRaycast}
        name="nexus-network-reaction"
      >
        <planeGeometry args={[4.2, 4.2]} />
        <meshBasicMaterial
          map={maps[2]}
          transparent
          opacity={0.5}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <group ref={elevation} name="motion-elevation">
        <instancedMesh
          ref={parts}
          args={[undefined, undefined, count]}
          frustumCulled={false}
          name="nexus-moving-parts"
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
      </group>
    </group>
  );
}
