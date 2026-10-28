import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  CanvasTexture,
  DoubleSide,
  Object3D,
  SRGBColorSpace,
  Color,
} from "three";
import type { Group, Mesh, InstancedMesh, MeshBasicMaterial } from "three";
import type { Bounty } from "./types";
import type { RegionId } from "./regions";
import { bugAppearance } from "./bug-art";
import { regionWeapons, terminationPose, weaponPlate } from "./termination-art";
import type { WeaponPart } from "./termination-art";
import { neonPlate } from "./neon-creatures";
import { foundryPlate } from "./foundry-creatures";
import { nexusPlate } from "./nexus-creatures";
import { zeroDayPlate } from "./zero-day-entities";
import { mapBounds } from "./region-map";

const textures = new Map<string, CanvasTexture>(),
  noHit = () => {};
function texture(region: RegionId, part: WeaponPart) {
  const key = `${region}:${part}`;
  if (!textures.has(key)) {
    const t = new CanvasTexture(weaponPlate(region, part));
    t.colorSpace = SRGBColorSpace;
    textures.set(key, t);
  }
  return textures.get(key)!;
}
if (import.meta.hot)
  import.meta.hot.dispose(() => {
    textures.forEach((t) => t.dispose());
    textures.clear();
  });
function Plate({
  map,
  name,
  size = 3,
  position = [0, 0, 0.1],
}: {
  map: CanvasTexture;
  name: string;
  size?: number;
  position?: [number, number, number];
}) {
  return (
    <mesh name={name} position={position} raycast={noHit}>
      <planeGeometry args={[size, size]} />
      <meshBasicMaterial
        map={map}
        transparent
        depthWrite={false}
        toneMapped={false}
        side={DoubleSide}
      />
    </mesh>
  );
}
function Beam({
  name,
  colour,
  width = 0.035,
}: {
  name: string;
  colour: string;
  width?: number;
}) {
  return (
    <mesh name={name} raycast={noHit}>
      <planeGeometry args={[width, 1]} />
      <meshBasicMaterial
        color={colour}
        transparent
        opacity={0.8}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}
function segment(
  mesh: Mesh,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  opacity: number,
) {
  mesh.position.set((ax + bx) / 2, (ay + by) / 2, 0.18);
  mesh.rotation.z = Math.atan2(by - ay, bx - ax) - Math.PI / 2;
  mesh.scale.y = Math.max(0.001, Math.hypot(bx - ax, by - ay));
  (mesh.material as MeshBasicMaterial).opacity = opacity;
  mesh.visible = opacity > 0.005;
}
function ghostTexture(art: ReturnType<typeof bugAppearance>) {
  const source =
      art.region.id === "neon"
        ? neonPlate(art.motion)
        : art.region.id === "foundry"
          ? foundryPlate(art.motion, "all", art.weapon)
          : art.region.id === "verdant"
            ? nexusPlate(art.motion)
            : zeroDayPlate(art.motion),
    canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const c = canvas.getContext("2d")!;
  c.drawImage(source, 0, 0);
  c.globalCompositeOperation = "source-in";
  c.fillStyle = regionWeapons[art.region.id].colour;
  c.fillRect(0, 0, 256, 256);
  c.globalCompositeOperation = "destination-out";
  for (let y = 0; y < 256; y += 7) c.clearRect(0, y, 256, 4);
  c.globalCompositeOperation = "source-over";
  const map = new CanvasTexture(canvas);
  map.colorSpace = SRGBColorSpace;
  return map;
}

export default function TerminationSequence({
  bug,
  onComplete,
  panel,
}: {
  bug: Bounty;
  onComplete: () => void;
  panel: React.RefObject<HTMLDivElement | null>;
}) {
  const art = useMemo(
      () =>
        bugAppearance(
          bug.bounty_id,
          bug.difficulty,
          bug.category,
          bug.base_bounty,
        ),
      [bug.bounty_id, bug.difficulty, bug.category, bug.base_bounty],
    ),
    region = art.region.id,
    ink = regionWeapons[region],
    root = useRef<Group>(null),
    time = useRef(0),
    completed = useRef(false),
    object = useMemo(() => new Object3D(), []),
    colour = useMemo(() => new Color(), []),
    maps = useMemo(
      () => ({
        device: texture(region, "device"),
        moving: texture(region, "moving"),
        reticle: texture(region, "reticle"),
        ghost: ghostTexture(art),
      }),
      [art, region],
    ),
    { scene, viewport, size } = useThree(),
    count = 16 + art.rank.tier * 4;
  useEffect(() => () => maps.ghost.dispose(), [maps]);
  useEffect(
    () => () => {
      const target = scene.getObjectByName(`target-${bug.bounty_id}`),
        heading = target?.getObjectByName("motion-heading");
      if (heading) {
        heading.scale.set(1, 1, 1);
        heading.position.x = 0;
        heading.visible = true;
      }
      if (target) {
        target.userData.terminationHidden = false;
        target.userData.terminationTime = undefined;
      }
    },
    [scene, bug.bounty_id],
  );
  useFrame((_, delta) => {
    const target = scene.getObjectByName(`target-${bug.bounty_id}`),
      node = root.current;
    if (!node || !target || completed.current) return;
    if (!document.hidden) time.current += Math.min(delta, 0.08);
    const p = terminationPose(region, time.current, art.rank.tier),
      bounds = mapBounds(size.width, size.height),
      unit = Math.min(
        54 + art.rank.tier * 2,
        bounds.width / 7.8,
        bounds.height / 7.5,
      ),
      worldUnit = (viewport.width / size.width) * unit,
      reach = Math.max(1.1, (art.size * 48) / Math.max(1, unit));
    node.position.copy(target.position);
    node.position.z = 0.8;
    node.scale.setScalar(worldUnit);
    node.userData.elapsed = time.current;
    node.userData.phase = p.phase;
    node.userData.progress = p.destroy;
    if (panel.current) {
      panel.current.dataset.phase = p.phase;
      panel.current.style.setProperty(
        "--strike-progress",
        `${Math.min(100, (time.current / p.duration) * 100)}%`,
      );
      const status = panel.current.querySelector("[data-weapon-phase]");
      if (status && status.textContent !== p.phase)
        status.textContent = p.phase;
    }
    const heading = target.getObjectByName("motion-heading"),
      ghost = node.getObjectByName("termination-ghost") as Mesh,
      reticle = node.getObjectByName("termination-reticle")!,
      remains = node.getObjectByName("termination-debris") as InstancedMesh;
    target.userData.terminationTime = time.current;
    target.userData.terminationHidden = !p.targetVisible;
    target.visible = p.targetVisible;
    if (heading) {
      heading.scale.set(p.targetX, p.targetY, 1);
      heading.position.x = p.shake;
      heading.visible = p.targetVisible && p.destroy < 0.87;
      for (const side of ["left", "right"]) {
        const wing = heading.getObjectByName(`motion-${side}-wing`);
        if (wing)
          wing.rotation.y =
            (side === "left" ? 1 : -1) * (0.4 + p.destroy * 0.9);
      }
    }
    ghost.visible = p.ghost > 0.01;
    ghost.rotation.z = heading?.rotation.z ?? 0;
    const ghostSize = reach * 3;
    ghost.scale.set(
      ghostSize * (region === "cryo" ? p.targetX : 1),
      ghostSize * (region === "neon" ? p.targetY : 1),
      1,
    );
    (ghost.material as MeshBasicMaterial).opacity = p.ghost * 0.55;
    reticle.scale.setScalar((0.8 + p.deploy * 0.2) * (1 - p.retract * 0.35));
    reticle.rotation.z = region === "cryo" ? -p.t * 0.12 : p.t * 0.09;
    const reticleMesh = reticle as Mesh;
    (reticleMesh.material as MeshBasicMaterial).opacity =
      p.deploy * (1 - p.retract) * 0.6;
    const arrival = 1 - p.deploy,
      leave = p.retract,
      shock = node.getObjectByName("termination-shockwave") as Mesh;
    shock.visible = p.destroy > 0.05 && p.destroy < 0.99;
    shock.scale.setScalar((1 + p.destroy * 2.8) * reach);
    (shock.material as MeshBasicMaterial).opacity = (1 - p.destroy) * 0.3;
    const cells = node.getObjectByName(
      "termination-charge-cells",
    ) as InstancedMesh;
    for (let i = 0; i < 12; i++) {
      const angle = Math.PI / 2 - (i * Math.PI) / 6,
        lit = p.charge * 12 > i,
        visible = p.deploy > 0.7 && p.t < 3.4 && lit;
      object.position.set(Math.cos(angle) * 2.15, Math.sin(angle) * 2.15, 0.05);
      object.rotation.set(0, 0, angle - Math.PI / 2);
      object.scale.set(visible ? 0.07 : 0.001, visible ? 0.24 : 0.001, 1);
      object.updateMatrix();
      cells.setMatrixAt(i, object.matrix);
      colour.set(i % 3 === 0 ? ink.accent : ink.colour);
      cells.setColorAt(i, colour);
    }
    cells.instanceMatrix.needsUpdate = true;
    if (cells.instanceColor) cells.instanceColor.needsUpdate = true;
    if (region === "neon") {
      const gun = node.getObjectByName("termination-device")!,
        rails = node.getObjectByName("termination-rails")!;
      gun.position.set(-3.1 - arrival * 2.7 - leave * 2.5, -1, 0.2);
      gun.rotation.z = -Math.PI / 2;
      gun.scale.setScalar(1 - leave * 0.3);
      rails.position.y = 0.65 + p.charge * 0.15 - p.fire * 0.12;
      for (const side of [-1, 1]) {
        const rail = node.getObjectByName(`termination-rail-${side}`)!;
        rail.position.x = side * (0.54 - p.charge * 0.12);
      }
      segment(
        node.getObjectByName("termination-beam-glow") as Mesh,
        -1.9,
        -1,
        0,
        0,
        p.fire * 0.24,
      );
      segment(
        node.getObjectByName("termination-beam") as Mesh,
        -1.9,
        -1,
        0,
        0,
        p.fire * 0.95,
      );
      const scanner = node.getObjectByName("termination-scanner") as Mesh;
      scanner.visible = p.destroy > 0 && p.destroy < 1;
      scanner.position.y = (1 - p.destroy * 2) * reach;
      scanner.scale.x = reach * 2.5;
      (scanner.material as MeshBasicMaterial).opacity = 0.65;
    } else if (region === "foundry") {
      for (const side of [-1, 1]) {
        const base = node.getObjectByName(`termination-base-${side}`)!,
          jaw = node.getObjectByName(`termination-jaw-${side}`)!;
        base.position.x = side * (2.5 + arrival * 2 + leave * 2);
        base.scale.x = -side;
        jaw.position.x =
          side * ((1.8 - p.destroy * 1.2) * reach + arrival * 1.8 + leave * 2);
        jaw.scale.x = -side;
        jaw.position.y = p.shake;
        segment(
          node.getObjectByName(`termination-arc-${side}`) as Mesh,
          side * 1.1 * reach,
          0.4,
          0,
          0,
          p.fire * 0.6,
        );
      }
    } else if (region === "verdant") {
      for (let i = 0; i < 3; i++) {
        const angle = Math.PI / 2 + (i * Math.PI * 2) / 3,
          r = (2.5 + arrival * 2 + leave * 2) * Math.max(1, reach * 0.8),
          x = Math.cos(angle) * r,
          y = Math.sin(angle) * r,
          anchor = node.getObjectByName(`termination-anchor-${i}`)!,
          cut = Math.max(0, Math.min(1, (p.t - 2.1 - i * 0.36) / 0.65)),
          cutter = node.getObjectByName(`termination-cutter-${i}`)!;
        anchor.position.set(x, y, 0.25);
        anchor.rotation.z = angle - Math.PI / 2;
        const tail =
          p.t > 2.9 + i * 0.32 ? Math.min(1, (p.t - 2.9 - i * 0.32) * 1.7) : 0;
        segment(
          node.getObjectByName(`termination-link-${i}`) as Mesh,
          x,
          y,
          x * tail,
          y * tail,
          p.deploy * (1 - leave) * (1 - tail) * 0.8,
        );
        cutter.position.set(x * (1 - cut), y * (1 - cut), 0.35);
        cutter.rotation.z = angle + p.t;
        cutter.visible = p.t > 2.1 + i * 0.36 && cut < 1;
      }
    } else {
      const cannon = node.getObjectByName("termination-device")!;
      cannon.position.set(0, 3 + arrival * 2.4 + leave * 2.4, 0.2);
      cannon.rotation.z = Math.PI;
      segment(
        node.getObjectByName("termination-beam") as Mesh,
        0,
        1.65,
        0,
        0,
        p.fire * 0.65,
      );
      for (let i = 0; i < 4; i++) {
        const angle = (i * Math.PI) / 2 + p.t * 0.15,
          r = (1.85 - p.destroy * 1.45) * reach + arrival * 2,
          wedge = node.getObjectByName(`termination-shutter-${i}`)!;
        wedge.position.set(Math.cos(angle) * r, Math.sin(angle) * r, 0.25);
        wedge.rotation.z = angle - Math.PI / 2;
        wedge.scale.setScalar(1 - p.retract);
      }
      const slit = node.getObjectByName("termination-null-slit") as Mesh;
      slit.visible = p.destroy > 0.15 && p.t < 4.8;
      slit.scale.set(
        Math.max(0.018, (1 - p.destroy) * 1.5) * reach,
        Math.max(0.02, 1 - p.retract * 1.5) * reach * 2.5,
        1,
      );
    }
    remains.visible = p.debris > 0 && p.t < 4.9;
    for (let i = 0; i < count; i++) {
      const angle = i * 2.399963229728653 + (art.seed % 7),
        start = 0.4 + (i % 5) * 0.16,
        r =
          region === "cryo"
            ? (1 - p.debris) * start * reach
            : region === "foundry"
              ? start * reach + p.debris * (0.65 + (i % 4) * 0.16)
              : start * reach + p.debris * (0.9 + (i % 6) * 0.18),
        spin =
          region === "cryo" ? angle + p.debris * 4 : angle + p.debris * 0.6;
      const branch = Math.PI / 2 + ((i % 3) * Math.PI * 2) / 3;
      object.position.set(
        region === "verdant"
          ? Math.cos(branch) * (start + p.debris * 1.7) + Math.sin(angle) * 0.1
          : region === "foundry"
            ? Math.sign(Math.cos(angle)) * (start * reach + p.debris * 0.9)
            : Math.cos(spin) * r,
        region === "neon"
          ? Math.sin(angle) * start + p.debris * 1.9
          : region === "foundry"
            ? Math.sin(angle) * start * reach -
              p.debris * 0.9 +
              Math.sin(Math.PI * p.debris) * 0.45
            : region === "verdant"
              ? Math.sin(branch) * (start + p.debris * 1.7) +
                Math.cos(angle) * 0.1
              : Math.sin(spin) * r,
        0.3 + (i % 3) * 0.02,
      );
      object.rotation.set(0, 0, angle + p.debris * (i % 2 ? 2 : -2));
      const shrink = Math.max(
        0.001,
        Math.sin(Math.PI * p.debris) * (region === "neon" ? 0.12 : 0.13),
      );
      object.scale.set(
        shrink * ((i % 3) + 1),
        shrink * (region === "neon" ? 3 : 1),
        1,
      );
      object.updateMatrix();
      remains.setMatrixAt(i, object.matrix);
      colour.set(
        i % 4 === 0
          ? ink.colour
          : i % 4 === 1
            ? ink.accent
            : region === "foundry"
              ? "#879c9d"
              : "#d0edf0",
      );
      remains.setColorAt(i, colour);
    }
    remains.instanceMatrix.needsUpdate = true;
    if (remains.instanceColor) remains.instanceColor.needsUpdate = true;
    if (p.done) {
      completed.current = true;
      onComplete();
    }
  });
  return (
    <group
      ref={root}
      name="termination-sequence"
      userData={{ weapon: ink.name, region, bountyId: bug.bounty_id }}
    >
      <instancedMesh
        name="termination-charge-cells"
        args={[undefined, undefined, 12]}
        frustumCulled={false}
        raycast={noHit}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          toneMapped={false}
          transparent
          opacity={0.9}
          depthWrite={false}
        />
      </instancedMesh>
      <Plate
        map={maps.reticle}
        name="termination-reticle"
        size={4.8}
        position={[0, 0, -0.1]}
      />
      <mesh name="termination-ghost" raycast={noHit} visible={false}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          map={maps.ghost}
          transparent
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh name="termination-shockwave" raycast={noHit} visible={false}>
        <ringGeometry args={[0.95, 1, 48]} />
        <meshBasicMaterial
          color={ink.colour}
          transparent
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      {region === "neon" && (
        <>
          <group name="termination-device">
            <Plate map={maps.device} name="termination-housing" size={3.8} />
            <group name="termination-rails">
              {[-1, 1].map((side) => (
                <group key={side} name={`termination-rail-${side}`}>
                  <Plate
                    map={maps.moving}
                    name={`lance-rail-${side}`}
                    size={3}
                  />
                </group>
              ))}
            </group>
          </group>
          <Beam name="termination-beam-glow" colour={ink.colour} width={0.24} />
          <Beam name="termination-beam" colour="#e6ffff" width={0.045} />
          <mesh name="termination-scanner" raycast={noHit}>
            <planeGeometry args={[1, 0.025]} />
            <meshBasicMaterial
              color={ink.accent}
              transparent
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        </>
      )}
      {region === "foundry" &&
        [-1, 1].map((side) => (
          <group key={side}>
            <group name={`termination-base-${side}`}>
              <Plate
                map={maps.device}
                name={`crusher-piston-${side}`}
                size={3.8}
              />
            </group>
            <group name={`termination-jaw-${side}`}>
              <Plate
                map={maps.moving}
                name={`crusher-grip-${side}`}
                size={3.4}
              />
            </group>
            <Beam
              name={`termination-arc-${side}`}
              colour={ink.accent}
              width={0.035}
            />
          </group>
        ))}
      {region === "verdant" &&
        [0, 1, 2].map((i) => (
          <group key={i}>
            <group name={`termination-anchor-${i}`}>
              <Plate map={maps.device} name={`reaper-pod-${i}`} size={1.8} />
            </group>
            <Beam
              name={`termination-link-${i}`}
              colour={i % 2 ? ink.accent : ink.colour}
              width={0.035}
            />
            <group name={`termination-cutter-${i}`}>
              <Plate map={maps.moving} name={`reaper-edge-${i}`} size={1.1} />
            </group>
          </group>
        ))}
      {region === "cryo" && (
        <>
          <group name="termination-device">
            <Plate map={maps.device} name="nullpoint-housing" size={3.4} />
          </group>
          <Beam name="termination-beam" colour={ink.accent} width={0.025} />
          {[0, 1, 2, 3].map((i) => (
            <group name={`termination-shutter-${i}`} key={i}>
              <Plate map={maps.moving} name={`nullpoint-wedge-${i}`} size={2} />
            </group>
          ))}
          <mesh
            name="termination-null-slit"
            position={[0, 0, 0.4]}
            raycast={noHit}
          >
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial color="#010407" toneMapped={false} />
          </mesh>
        </>
      )}
      <instancedMesh
        name="termination-debris"
        args={[undefined, undefined, count]}
        frustumCulled={false}
        raycast={noHit}
        visible={false}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          transparent
          opacity={0.85}
          depthWrite={false}
          toneMapped={false}
          side={DoubleSide}
        />
      </instancedMesh>
    </group>
  );
}
