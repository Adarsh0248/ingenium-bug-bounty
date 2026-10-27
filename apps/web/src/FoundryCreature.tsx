import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  CanvasTexture,
  CylinderGeometry,
  Object3D,
  SRGBColorSpace,
} from "three";
import type { Group, InstancedMesh } from "three";
import type { bugAppearance, BugMotion } from "./bug-art";
import {
  foundryPlate,
  foundryWheels,
  foundryWheelRoll,
} from "./foundry-creatures";
import type { FoundryPart } from "./foundry-creatures";
import FoundryWeapon from "./FoundryWeapon";
import type { RegionMapView } from "./region-map";

const textures = new Map<string, CanvasTexture>();
function texture(motion: BugMotion, part: FoundryPart) {
  const key = `${motion}:${part}`;
  if (!textures.has(key)) {
    const map = new CanvasTexture(foundryPlate(motion, part));
    map.colorSpace = SRGBColorSpace;
    textures.set(key, map);
  }
  return textures.get(key)!;
}
const tyre = new CylinderGeometry(0.22, 0.22, 0.2, 10).rotateZ(Math.PI / 2);
if (import.meta.hot)
  import.meta.hot.dispose(() => {
    textures.forEach((t) => t.dispose());
    textures.clear();
    tyre.dispose();
  });

export default function FoundryCreature({
  bug,
  still,
  distance,
  pan,
}: {
  bug: ReturnType<typeof bugAppearance>;
  still: boolean;
  distance: React.RefObject<number>;
  pan?: React.RefObject<RegionMapView>;
}) {
  const rig = useRef<Group>(null),
    body = useRef<Group>(null),
    jets = useRef<Group>(null),
    wheels = useRef<InstancedMesh>(null),
    treads = useRef<InstancedMesh>(null),
    time = useRef(0),
    last = useRef({ distance: 0, heading: 0, ready: false }),
    roll = useRef([0, 0]),
    initialized = useRef(false);
  const points = useMemo(() => foundryWheels(bug.motion), [bug.motion]),
    object = useMemo(() => new Object3D(), []),
    maps = useMemo(
      () => [
        texture(bug.motion, "body"),
        ...(bug.flying ? [texture(bug.motion, "jet")] : []),
      ],
      [bug.motion],
    );
  useFrame((_, delta) => {
    if (!rig.current || !body.current || (still && initialized.current)) return;
    const heading = rig.current.parent?.rotation.z ?? 0,
      turn = last.current.ready ? heading - last.current.heading : 0,
      travel = last.current.ready
        ? Math.max(
            0,
            distance.current - last.current.distance - Math.abs(turn) * 0.3,
          )
        : 0;
    last.current = { distance: distance.current, heading, ready: true };
    if (!still) time.current += Math.min(delta, 0.05) * bug.speed;
    if (bug.flying) {
      body.current.position.z =
        0.16 + Math.sin(time.current * 3 + bug.seed) * 0.025;
      if (jets.current)
        jets.current.scale.y =
          0.92 + Math.sin(time.current * 19 + bug.seed) * 0.14;
    } else if (
      wheels.current &&
      treads.current &&
      (!initialized.current || travel || turn)
    ) {
      for (let side = 0; side < 2; side++)
        roll.current[side] += foundryWheelRoll(
          travel,
          turn,
          side ? 0.93 : -0.93,
        );
      points.forEach((p, i) => {
        const angle = roll.current[i % 2];
        object.position.set(p.x, p.y, 0);
        object.rotation.set(angle, 0, 0);
        object.scale.set(1, 1, 1);
        object.updateMatrix();
        wheels.current!.setMatrixAt(i, object.matrix);
        for (let j = 0; j < 6; j++) {
          const a = angle + (j * Math.PI) / 3;
          object.position.set(
            p.x,
            p.y - Math.sin(a) * 0.224,
            Math.cos(a) * 0.224,
          );
          object.rotation.set(a, 0, 0);
          object.updateMatrix();
          treads.current!.setMatrixAt(i * 6 + j, object.matrix);
        }
      });
      wheels.current.instanceMatrix.needsUpdate = true;
      treads.current.instanceMatrix.needsUpdate = true;
    }
    initialized.current = true;
  }, -0.5);
  return (
    <group ref={rig} scale={bug.size} name="motion-rig">
      <group ref={body} name="motion-body-pose">
        <mesh position={[0, 0, 0.14]}>
          <planeGeometry args={[3, 3]} />
          <meshBasicMaterial
            map={maps[0]}
            transparent
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
        {bug.flying && (
          <group
            ref={jets}
            position={[0, -0.375, 0.02]}
            name="motion-jet-plumes"
          >
            <mesh position={[0, 0.375, 0]}>
              <planeGeometry args={[3, 3]} />
              <meshBasicMaterial
                map={maps[1]}
                transparent
                depthWrite={false}
                toneMapped={false}
              />
            </mesh>
          </group>
        )}
        {bug.weapon !== "none" && (
          <FoundryWeapon bug={bug} still={still} pan={pan} />
        )}
      </group>
      {!bug.flying && (
        <>
          <instancedMesh
            ref={wheels}
            args={[undefined, undefined, points.length]}
            frustumCulled={false}
            name="motion-wheels"
          >
            <primitive object={tyre} attach="geometry" />
            <meshStandardMaterial color="#35454b" roughness={0.9} />
          </instancedMesh>
          <instancedMesh
            ref={treads}
            args={[undefined, undefined, points.length * 6]}
            frustumCulled={false}
            name="motion-wheel-treads"
          >
            <boxGeometry args={[0.18, 0.055, 0.025]} />
            <meshBasicMaterial color="#bbab84" toneMapped={false} />
          </instancedMesh>
        </>
      )}
    </group>
  );
}
