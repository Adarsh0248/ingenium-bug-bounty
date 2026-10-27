import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Matrix4 } from "three";
import type { Group, Mesh, MeshBasicMaterial } from "three";
import type { bugAppearance } from "./bug-art";
import type { RegionMapView } from "./region-map";
import { mapBounds, mapExtent } from "./region-map";
import { foundryAttack, foundryPaint } from "./foundry-creatures";

const noHit = () => {};
export default function FoundryWeapon({
  bug,
  still,
  pan,
}: {
  bug: ReturnType<typeof bugAppearance>;
  still: boolean;
  pan?: React.RefObject<RegionMapView>;
}) {
  const root = useRef<Group>(null),
    turret = useRef<Group>(null),
    barrels = useRef<Group>(null),
    flash = useRef<Mesh>(null),
    effect = useRef<Group>(null),
    bolt = useRef<Mesh>(null),
    impact = useRef<Mesh>(null),
    time = useRef(0),
    shot = useRef({
      cycle: -1,
      ready: false,
      x: 0,
      y: 0,
      ground: 0,
      width: 0,
      height: 0,
      reach: 0,
    }),
    { size, viewport } = useThree(),
    frame = useMemo(() => new Matrix4(), []),
    inverse = useMemo(() => new Matrix4(), []),
    anchored = useMemo(() => new Matrix4(), []),
    paint = foundryPaint[bug.motion];
  useFrame((_, delta) => {
    if (
      !root.current ||
      !turret.current ||
      !barrels.current ||
      !effect.current ||
      !flash.current ||
      !bolt.current ||
      !impact.current
    )
      return;
    if (!pan) {
      effect.current.visible = false;
      flash.current.visible = false;
      return;
    }
    if (!still) time.current += Math.min(delta, 0.05);
    const state = foundryAttack(bug.seed, time.current, bug.weapon);
    if (!still) {
      const difference = Math.atan2(
        Math.sin(state.aim - turret.current.rotation.z),
        Math.cos(state.aim - turret.current.rotation.z),
      );
      turret.current.rotation.z += difference * Math.min(1, delta * 5);
      barrels.current.position.y = -state.recoil;
    }
    if (shot.current.cycle !== state.cycle) {
      shot.current.cycle = state.cycle;
      shot.current.ready = false;
    }
    const firing = state.flash || state.flight >= 0 || state.impact >= 0;
    if (!still && firing && !shot.current.ready) {
      turret.current.updateWorldMatrix(true, false);
      frame.copy(turret.current.matrixWorld);
      const bounds = mapBounds(size.width, size.height),
        world = mapExtent(bounds),
        x =
          (frame.elements[12] / viewport.width + 0.5) * size.width -
          bounds.left -
          pan.current.x,
        y =
          (0.5 - frame.elements[13] / viewport.height) * size.height -
          bounds.top -
          pan.current.y,
        dx = (frame.elements[4] * size.width) / viewport.width,
        dy = (-frame.elements[5] * size.height) / viewport.height,
        edgeX =
          dx > 0
            ? (world.width - 28 - x) / dx
            : dx < 0
              ? (28 - x) / dx
              : Infinity,
        edgeY =
          dy > 0
            ? (world.height - 28 - y) / dy
            : dy < 0
              ? (28 - y) / dy
              : Infinity,
        reach = Math.max(0.15, Math.min(state.reach, edgeX - 0.9, edgeY - 0.9));
      shot.current = {
        cycle: state.cycle,
        ready: true,
        x: pan?.current.x ?? 0,
        y: pan?.current.y ?? 0,
        ground:
          (-0.15 - frame.elements[14]) /
          Math.hypot(frame.elements[8], frame.elements[9], frame.elements[10]),
        width: size.width,
        height: size.height,
        reach,
      };
    }
    const ready =
      shot.current.ready &&
      shot.current.width === size.width &&
      shot.current.height === size.height;
    flash.current.visible = ready && state.flash;
    effect.current.visible = ready && firing;
    if (!ready) return;
    // Keep a fired shot attached to the board while its bot moves and the map pans.
    root.current.updateWorldMatrix(true, false);
    inverse.copy(root.current.matrixWorld).invert();
    anchored.copy(frame);
    anchored.elements[12] +=
      (((pan?.current.x ?? 0) - shot.current.x) * viewport.width) / size.width;
    anchored.elements[13] -=
      (((pan?.current.y ?? 0) - shot.current.y) * viewport.height) /
      size.height;
    effect.current.matrix.multiplyMatrices(inverse, anchored);
    bolt.current.visible = state.flight >= 0;
    bolt.current.position.set(
      0,
      0.9 + Math.max(0, state.flight) * shot.current.reach,
      Math.max(0, state.flight) * shot.current.ground,
    );
    impact.current.visible = state.impact >= 0;
    impact.current.position.set(
      0,
      0.9 + shot.current.reach,
      shot.current.ground,
    );
    impact.current.scale.setScalar(0.6 + Math.max(0, state.impact) * 2.5);
    (impact.current.material as MeshBasicMaterial).opacity =
      0.8 * (1 - Math.max(0, state.impact));
  });
  return (
    <group ref={root} position={[0, 0.12, 0.21]} name="foundry-weapon">
      <group ref={turret} name="foundry-turret">
        <mesh raycast={noHit}>
          <circleGeometry args={[0.32, 8]} />
          <meshBasicMaterial color={paint.dark} toneMapped={false} />
        </mesh>
        <mesh position={[0, 0, 0.01]} raycast={noHit}>
          <ringGeometry args={[0.27, 0.32, 8]} />
          <meshBasicMaterial color={paint.light} toneMapped={false} />
        </mesh>
        <group ref={barrels} name="foundry-gun-recoil">
          {(bug.weapon === "siege" ? [-0.13, 0.13] : [0]).map((x) => (
            <group key={x}>
              <mesh position={[x, 0.4, 0.04]} raycast={noHit}>
                <boxGeometry args={[0.14, 0.78, 0.12]} />
                <meshBasicMaterial color={paint.light} toneMapped={false} />
              </mesh>
              <mesh position={[x, 0.78, 0.04]} raycast={noHit}>
                <boxGeometry args={[0.19, 0.17, 0.16]} />
                <meshBasicMaterial color={paint.accent} toneMapped={false} />
              </mesh>
            </group>
          ))}
        </group>
        <mesh
          ref={flash}
          position={[0, 0.93, 0.04]}
          visible={false}
          raycast={noHit}
          name="foundry-muzzle-flash"
        >
          <octahedronGeometry args={[0.23, 0]} />
          <meshBasicMaterial color={paint.accent} toneMapped={false} />
        </mesh>
      </group>
      <group
        ref={effect}
        matrixAutoUpdate={false}
        visible={false}
        name="foundry-shot-frame"
      >
        <mesh ref={bolt} raycast={noHit} name="foundry-projectile">
          <boxGeometry args={[0.07, 0.42, 0.07]} />
          <meshBasicMaterial color={paint.accent} toneMapped={false} />
        </mesh>
        <mesh ref={impact} raycast={noHit} name="foundry-board-impact">
          <ringGeometry args={[0.13, 0.22, 12]} />
          <meshBasicMaterial
            color={paint.accent}
            transparent
            opacity={0.8}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      </group>
    </group>
  );
}
