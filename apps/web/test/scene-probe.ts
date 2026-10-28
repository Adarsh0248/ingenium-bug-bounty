import { _roots } from "@react-three/fiber";
import { Vector3, Matrix4 } from "three";
import type { Object3D, Mesh, InstancedMesh } from "three";

// Advance the real animation callbacks without drawing thousands of intermediate frames.
export function advanceScene(seconds: number) {
  for (let elapsed = 0; elapsed < seconds; elapsed += 0.05)
    for (const root of _roots.values())
      for (const subscription of root.store.getState().internal.subscribers)
        subscription.ref.current(
          subscription.store.getState(),
          0.05,
          undefined,
        );
  for (const root of _roots.values())
    root.store.getState().scene.updateMatrixWorld(true);
}

// Read the renderer's actual objects so animation checks cannot pass on pose math alone.
export function motionState(ids: string[]) {
  const pose = (object?: Object3D) =>
    object
      ? {
          y: object.position.y,
          z: object.position.z,
          scaleY: object.scale.y,
          angle: object.rotation.z,
          fold: object.rotation.y,
          geometry: object.children
            .map((child) => (child as Mesh).geometry?.type)
            .filter(Boolean),
        }
      : null;
  const states = [];
  for (const root of _roots.values()) {
    const { scene, camera, size } = root.store.getState();
    for (const id of ids) {
      const target = scene.getObjectByName(`target-${id}`);
      if (!target) continue;
      const rig = target.getObjectByName("motion-rig"),
        point = new Vector3();
      const legMesh = target.getObjectByName("motion-jointed-legs") as
          InstancedMesh | undefined,
        legs = [];
      if (legMesh)
        for (let i = 0; i < legMesh.count; i += 4) {
          const upper = new Matrix4(),
            lower = new Matrix4();
          legMesh.getMatrixAt(i + 1, upper);
          legMesh.getMatrixAt(i + 3, lower);
          legs.push({
            hip: new Vector3(-0.5, 0, 0).applyMatrix4(upper).toArray(),
            knee: new Vector3(0.5, 0, 0).applyMatrix4(upper).toArray(),
            foot: new Vector3(0.5, 0, 0).applyMatrix4(lower).toArray(),
          });
        }
      const ground = target.getWorldPosition(new Vector3());
      const wheelMesh = target.getObjectByName("motion-wheels") as
          InstancedMesh | undefined,
        wheels = [];
      if (wheelMesh)
        for (let i = 0; i < wheelMesh.count; i++) {
          const matrix = new Matrix4();
          wheelMesh.getMatrixAt(i, matrix);
          wheels.push({
            x: matrix.elements[12],
            y: matrix.elements[13],
            angle: Math.atan2(matrix.elements[6], matrix.elements[5]),
          });
        }
      (rig ?? target).getWorldPosition(point);
      point.project(camera);
      const mount = target.getObjectByName("foundry-weapon"),
        flash = target.getObjectByName("foundry-muzzle-flash"),
        bolt = target.getObjectByName("foundry-projectile"),
        impact = target.getObjectByName("foundry-board-impact"),
        shot = target.getObjectByName("foundry-shot-frame");
      const nexusMesh = target.getObjectByName("nexus-moving-parts") as
          InstancedMesh | undefined,
        nexusReaction = target.getObjectByName("nexus-network-reaction") as
          Mesh | undefined;
      const zeroDayMesh = target.getObjectByName(
          "zero-day-articulated-parts",
        ) as InstancedMesh | undefined,
        zeroDayTrail = target.getObjectByName("zero-day-signal-trail") as
          Mesh | undefined;
      states.push({
        id,
        motion: target.userData.motion,
        roamer: target.userData.roamer
          ? {
              x: target.userData.roamer.x,
              y: target.userData.roamer.y,
              radius: target.userData.roamer.radius,
              heading: target.userData.roamer.heading,
              vx: target.userData.roamer.vx,
              vy: target.userData.roamer.vy,
              distance: target.userData.roamer.distance,
              region: target.userData.roamer.region,
            }
          : null,
        scale: rig?.scale.x,
        weapon: target.userData.weapon,
        zeroDay: zeroDayMesh
          ? {
              parts: Array.from({ length: zeroDayMesh.count }, (_, i) => {
                const matrix = new Matrix4();
                zeroDayMesh.getMatrixAt(i, matrix);
                return matrix.toArray();
              }),
              rippleScale: zeroDayTrail?.scale.x,
              opacity: (
                zeroDayTrail?.material as import("three").MeshBasicMaterial
              )?.opacity,
            }
          : null,
        nexus: nexusMesh
          ? {
              parts: Array.from({ length: nexusMesh.count }, (_, i) => {
                const matrix = new Matrix4();
                nexusMesh.getMatrixAt(i, matrix);
                return matrix.toArray();
              }),
              reactionAngle: nexusReaction?.rotation.z,
              reactionScale: nexusReaction?.scale.x,
              opacity: (
                nexusReaction?.material as import("three").MeshBasicMaterial
              )?.opacity,
            }
          : null,
        fx: mount
          ? {
              flash: !!flash?.visible,
              flight: !!shot?.visible && !!bolt?.visible,
              impact: !!shot?.visible && !!impact?.visible,
              recoil: target.getObjectByName("foundry-gun-recoil")?.position.y,
              impactScale: impact?.scale.x,
              impactPoint: impact?.getWorldPosition(new Vector3()).toArray(),
            }
          : null,
        body: pose(target.getObjectByName("motion-body-pose") ?? rig),
        elevation: pose(target.getObjectByName("motion-elevation")),
        heading: target.getObjectByName("motion-heading")?.rotation.z,
        ground: ground.toArray(),
        legs,
        wheels,
        jet: pose(target.getObjectByName("motion-jet-plumes")),
        left: pose(target.getObjectByName("motion-left")),
        right: pose(target.getObjectByName("motion-right")),
        wing: pose(target.getObjectByName("motion-left-wing")),
        point: {
          x: ((point.x + 1) * size.width) / 2,
          y: ((1 - point.y) * size.height) / 2,
        },
        visible: target.visible,
      });
    }
  }
  return states;
}

export function terminationState() {
  for (const root of _roots.values()) {
    const { scene } = root.store.getState(),
      sequence = scene.getObjectByName("termination-sequence");
    if (!sequence) continue;
    const target = scene.getObjectByName(
        `target-${sequence.userData.bountyId}`,
      ),
      heading = target?.getObjectByName("motion-heading"),
      names: string[] = [];
    sequence.traverse((node) => {
      if (node.name) names.push(node.name);
    });
    return {
      weapon: sequence.userData.weapon,
      region: sequence.userData.region,
      elapsed: sequence.userData.elapsed,
      phase: sequence.userData.phase,
      progress: sequence.userData.progress,
      targetVisible: !!target?.visible,
      scale: heading?.scale.toArray(),
      debrisCount: (
        sequence.getObjectByName("termination-debris") as InstancedMesh
      )?.count,
      names,
    };
  }
  return null;
}
