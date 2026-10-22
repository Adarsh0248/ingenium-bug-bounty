import { Component, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  AdditiveBlending,
  CanvasTexture,
  Group,
  InstancedMesh,
  Object3D,
  Vector3,
} from "three";
import type { Bounty, Termination } from "./types";

const accents = ["#baff51", "#49f1ed", "#ffbd5c", "#ff477e"];

export function BugModel({
  color = accents[0],
  still = false,
}: {
  color?: string;
  still?: boolean;
}) {
  const rig = useRef<Group>(null);
  useFrame(({ clock }) => {
    rig.current?.children.forEach((leg, i) => {
      const side = leg.position.x < 0 ? -1 : 1;
      leg.rotation.y =
        side * 0.25 +
        (still ? 0 : Math.sin(clock.elapsedTime * 12 + i * 2.1) * 0.48);
      leg.rotation.z =
        side *
        (0.12 +
          (still
            ? 0
            : Math.max(0, Math.sin(clock.elapsedTime * 12 + i * 2.1)) * 0.28));
    });
  });
  return (
    <group>
      <mesh scale={[0.46, 0.19, 0.85]} rotation={[0, Math.PI / 4, 0]}>
        <cylinderGeometry args={[0.8, 1, 1, 4]} />
        <meshStandardMaterial
          color="#343b46"
          metalness={0.85}
          roughness={0.28}
        />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh
            position={[side * 0.29, 0.22, 0.04]}
            rotation={[0, side * 0.14, side * -0.18]}
          >
            <boxGeometry args={[0.25, 0.12, 1.12]} />
            <meshStandardMaterial
              color="#8f9caa"
              metalness={0.9}
              roughness={0.24}
            />
          </mesh>
          <mesh position={[side * 0.31, 0.29, 0.04]}>
            <boxGeometry args={[0.035, 0.025, 0.8]} />
            <meshBasicMaterial color={color} />
          </mesh>
          <mesh position={[side * 0.13, 0.11, -0.83]}>
            <boxGeometry args={[0.16, 0.045, 0.035]} />
            <meshBasicMaterial color="#ff386b" />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0.06, -0.65]}>
        <boxGeometry args={[0.47, 0.27, 0.35]} />
        <meshStandardMaterial color="#424c59" metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.27, 0.28]} rotation={[0, Math.PI / 4, 0]}>
        <boxGeometry args={[0.16, 0.09, 0.16]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <group ref={rig}>
        {[-1, 1].flatMap((side) =>
          [-0.49, 0, 0.48].map((z) => (
            <group key={`${side}:${z}`} position={[side * 0.39, 0, z]}>
              <mesh
                position={[side * 0.26, 0, 0]}
                rotation={[0, 0, side * -0.3]}
              >
                <boxGeometry args={[0.55, 0.075, 0.1]} />
                <meshStandardMaterial
                  color="#a2aab6"
                  metalness={0.85}
                  roughness={0.35}
                />
              </mesh>
              <mesh
                position={[side * 0.58, -0.17, 0]}
                rotation={[0, 0, side * 0.5]}
              >
                <boxGeometry args={[0.06, 0.4, 0.07]} />
                <meshStandardMaterial
                  color="#6e798c"
                  metalness={0.8}
                  roughness={0.3}
                />
              </mesh>
              <mesh position={[side * 0.66, -0.32, 0]}>
                <boxGeometry args={[0.12, 0.045, 0.14]} />
                <meshBasicMaterial color={color} />
              </mesh>
            </group>
          )),
        )}
      </group>
    </group>
  );
}

function District() {
  const towers = useRef<InstancedMesh>(null),
    roofs = useRef<InstancedMesh>(null);
  const code = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#0c1018";
    ctx.fillRect(0, 0, 1024, 512);
    ctx.font = "18px Consolas, monospace";
    const lines = [
      "SYS://INGENIUM/SECTOR_026",
      "const district = await scan(network);",
      "for (const fault of district) {",
      "  trace(fault.origin);",
      "  patch.verify(testcases);",
      "  // bounty uplink established",
      "}",
      "0x000F  01 11 A0 FF 07 2E",
      "STATUS :: TARGET SIGNALS ACTIVE",
    ];
    lines.forEach((line, i) => {
      ctx.fillStyle = i % 3 === 0 ? "#b4407f" : "#317276";
      ctx.fillText(line, 24, 45 + i * 48);
    });
    return new CanvasTexture(canvas);
  }, []);
  useEffect(() => () => code.dispose(), [code]);
  useEffect(() => {
    const object = new Object3D();
    for (let i = 0; i < 84; i++) {
      const x = ((i % 12) - 5.5) * 1.75,
        y = (Math.floor(i / 12) - 3) * 1.6;
      const height = 0.15 + ((i * 17) % 7) * 0.1;
      object.position.set(x, y, -1.9 + height / 2);
      object.scale.set(0.42 + (i % 3) * 0.13, 0.38 + (i % 4) * 0.11, height);
      object.updateMatrix();
      towers.current!.setMatrixAt(i, object.matrix);
      object.position.z = -1.89 + height;
      object.scale.y = 0.018;
      object.scale.z = 0.018;
      object.updateMatrix();
      roofs.current!.setMatrixAt(i, object.matrix);
    }
    towers.current!.instanceMatrix.needsUpdate = true;
    roofs.current!.instanceMatrix.needsUpdate = true;
  }, []);
  return (
    <group>
      <mesh position={[0, 0, -2.05]}>
        <planeGeometry args={[80, 50]} />
        <meshBasicMaterial color="#080b12" />
      </mesh>
      <gridHelper
        args={[60, 60, "#24454c", "#16232e"]}
        rotation={[Math.PI / 2, 0, 0]}
        position={[0, 0, -2]}
      />
      <instancedMesh ref={towers} args={[undefined, undefined, 84]}>
        <boxGeometry />
        <meshStandardMaterial color="#272d3a" metalness={0.7} roughness={0.4} />
      </instancedMesh>
      <instancedMesh ref={roofs} args={[undefined, undefined, 84]}>
        <boxGeometry />
        <meshBasicMaterial color="#448f9a" />
      </instancedMesh>
      {[-5.5, -1.6, 2.3, 6.2].map((x, i) => (
        <group key={x}>
          <mesh position={[x, 0, -1.8]}>
            <planeGeometry args={[0.025, 26]} />
            <meshBasicMaterial color={i % 2 ? "#6b2755" : "#225e6c"} />
          </mesh>
          <mesh position={[2, x * 0.7, -1.8]}>
            <planeGeometry args={[30, 0.025]} />
            <meshBasicMaterial color="#22545d" />
          </mesh>
        </group>
      ))}
      {[
        [-4.7, 1.8],
        [4.8, -0.8],
        [0.8, 3.8],
      ].map(([x, y]) => (
        <mesh key={x} position={[x, y, -1.7]}>
          <planeGeometry args={[3.6, 1.8]} />
          <meshBasicMaterial map={code} transparent opacity={0.8} />
        </mesh>
      ))}
    </group>
  );
}

function Target({
  bug,
  index,
  count,
  open,
  still,
  frozen,
}: {
  bug: Bounty;
  index: number;
  count: number;
  open: (id: string) => void;
  still: boolean;
  frozen: boolean;
}) {
  const group = useRef<Group>(null),
    time = useRef(0),
    [hover, setHover] = useState(false),
    { viewport, size } = useThree();
  useFrame((_, delta) => {
    if (!group.current || frozen) return;
    if (!still && !hover) time.current += Math.min(delta, 0.05);
    const mobile = size.width <= 720,
      decorative = bug.bounty_id === "entry";
    const left = decorative ? 0 : mobile ? 20 : 350,
      top = decorative ? 0 : mobile ? 300 : 240;
    const width = Math.max(100, size.width - left - (mobile ? 20 : 70));
    const height = Math.max(
      100,
      size.height -
        top -
        (decorative ? 0 : mobile ? size.height * 0.29 + 90 : 110),
    );
    const t = time.current * 0.7 + index * 2.399;
    const u = 0.5 + Math.sin(t * 0.83) * 0.38,
      v = 0.5 + Math.sin(t * 1.13 + index) * 0.34;
    group.current.position.set(
      ((left + u * width) / size.width - 0.5) * viewport.width,
      (0.5 - (top + v * height) / size.height) * viewport.height,
      0.2,
    );
    group.current.rotation.z = Math.atan2(
      -Math.cos(t * 0.83) * width * 0.83 * 0.38,
      -Math.cos(t * 1.13 + index) * height * 1.13 * 0.34,
    );
    group.current.scale.setScalar(
      Math.min(
        0.78,
        ((viewport.width * width) /
          size.width /
          Math.max(3, Math.sqrt(count))) *
          0.19,
        ((viewport.height * height) / size.height) * 0.19,
      ) * (hover ? 1.15 : 1),
    );
  });
  const color =
    accents[
      bug.difficulty < 35
        ? 0
        : bug.difficulty < 65
          ? 1
          : bug.difficulty < 85
            ? 2
            : 3
    ];
  return (
    <group
      ref={group}
      name={`target-${bug.bounty_id}`}
      onClick={(e) => {
        e.stopPropagation();
        open(bug.bounty_id);
      }}
      onPointerOver={() => {
        setHover(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHover(false);
        document.body.style.cursor = "";
      }}
    >
      <group rotation={[Math.PI / 2, 0, 0]}>
        <BugModel color={color} still={still || hover || frozen} />
      </group>
      <mesh position={[0, 0, -0.2]} rotation={[0, 0, Math.PI / 4]}>
        <ringGeometry args={[1.1, hover ? 1.15 : 1.12, 4]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={hover ? 0.8 : 0.25}
        />
      </mesh>
    </group>
  );
}

function Strike({ bountyId }: { bountyId: string }) {
  const group = useRef<Group>(null),
    beam = useRef<Group>(null),
    burst = useRef<Group>(null),
    started = useRef<number | null>(null),
    { viewport, size, scene } = useThree();
  const end = useMemo(() => new Vector3(), []),
    start = useMemo(() => new Vector3(), []),
    direction = useMemo(() => new Vector3(), []),
    up = useMemo(() => new Vector3(0, 1, 0), []);
  useFrame(({ clock }) => {
    // A demand-rendered IDE pause must not count towards a newly mounted shot.
    started.current ??= clock.elapsedTime;
    const elapsed = clock.elapsedTime - started.current;
    const target = scene.getObjectByName(`target-${bountyId}`);
    if (!group.current || !beam.current || !burst.current || !target) return;
    end.copy(target.position);
    start.set(
      0,
      (-0.5 + (size.width <= 720 ? 56 : 96) / size.height) * viewport.height,
      0.2,
    );
    beam.current.position.copy(start).lerp(end, 0.5);
    direction.copy(end).sub(start);
    beam.current.scale.set(1, direction.length(), 1);
    beam.current.quaternion.setFromUnitVectors(up, direction.normalize());
    beam.current.visible = elapsed > 0.35 && elapsed < 1.15;
    burst.current.position.copy(end);
    burst.current.visible = elapsed >= 1;
    const expansion = Math.max(0.01, (elapsed - 1) * 2);
    burst.current.scale.setScalar(expansion);
    target.visible = elapsed < 1.05;
    burst.current.children.forEach((shard) => {
      shard.scale.setScalar(Math.max(0.01, 1 - expansion / 3));
    });
  });
  return (
    <group ref={group}>
      <group ref={beam} visible={false}>
        <mesh>
          <cylinderGeometry args={[0.016, 0.035, 1, 6]} />
          <meshBasicMaterial color="#e5fffd" toneMapped={false} />
        </mesh>
        <mesh>
          <cylinderGeometry args={[0.065, 0.1, 1, 6]} />
          <meshBasicMaterial
            color="#43ffe5"
            blending={AdditiveBlending}
            toneMapped={false}
            transparent
            opacity={0.35}
            depthWrite={false}
          />
        </mesh>
      </group>
      <group ref={burst} visible={false}>
        {Array.from({ length: 14 }, (_, i) => (
          <mesh
            key={i}
            position={[
              Math.cos(i * 2.4) * (0.6 + i * 0.04),
              Math.sin(i * 2.4) * (0.6 + i * 0.04),
              0.4,
            ]}
            rotation={[i, i, i]}
          >
            <boxGeometry args={[0.08, 0.22, 0.04]} />
            <meshBasicMaterial color={i % 2 ? "#49f1ed" : "#ff477e"} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

class Boundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export default function Arena({
  bugs,
  onOpen,
  still,
  strike,
  pending = [],
  onTerminated,
}: {
  bugs: Bounty[];
  onOpen: (id: string) => void;
  still: boolean;
  strike?: Termination;
  pending?: string[];
  onTerminated?: () => void;
}) {
  const finish = useRef(onTerminated);
  finish.current = onTerminated;
  useEffect(() => {
    document.body.style.cursor = "";
    if (!strike) return;
    const timer = setTimeout(() => finish.current?.(), 3500);
    return () => clearTimeout(timer);
  }, [strike?.awardId]);
  const fallback = (
    <div className="arena-fallback" aria-hidden="true">
      <div className="field-cross" />
      <span>INGENIUM / FIELD SYSTEMS</span>
    </div>
  );
  return (
    <>
      <Boundary fallback={fallback}>
        <div
          className="arena-canvas"
          aria-label="Three-dimensional bounty arena"
        >
          <Canvas
            dpr={[1, 1.5]}
            frameloop={still ? "demand" : "always"}
            camera={{ position: new Vector3(0, 0, 10), fov: 48 }}
            gl={{ antialias: true, preserveDrawingBuffer: true }}
            fallback={fallback}
          >
            <color attach="background" args={["#080b12"]} />
            <ambientLight intensity={1.6} />
            <directionalLight position={[4, 7, 9]} intensity={4} />
            <pointLight position={[-4, 2, 4]} intensity={40} color="#49e8ed" />
            <pointLight position={[4, -1, 3]} intensity={30} color="#ef418d" />
            <District />
            {bugs.map(
              (bug, index) =>
                (!bug.claimed || pending.includes(bug.bounty_id)) && (
                  <Target
                    key={bug.bounty_id}
                    bug={bug}
                    index={index}
                    count={bugs.length}
                    open={onOpen}
                    still={still}
                    frozen={strike?.bountyId === bug.bounty_id}
                  />
                ),
            )}
            {strike && !still && (
              <Strike key={strike.awardId} bountyId={strike.bountyId} />
            )}
          </Canvas>
        </div>
      </Boundary>
      {bugs.some((bug) => bug.bounty_id !== "entry") && (
        <div
          className={`field-weapon ${strike ? "firing" : ""}`}
          aria-hidden="true"
        >
          <div />
          <span>ARC // 01</span>
        </div>
      )}
      {strike && (
        <div
          className="termination-banner"
          role="status"
          data-award-id={strike.awardId}
        >
          <span>BOUNTY SECURED</span>
          <strong>TARGET TERMINATED</strong>
          <small>
            {bugs.find((bug) => bug.bounty_id === strike.bountyId)?.title}
          </small>
        </div>
      )}
    </>
  );
}
