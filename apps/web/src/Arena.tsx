import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  NearestFilter,
  SRGBColorSpace,
  Group,
  InstancedMesh,
  Object3D,
  Vector3,
} from "three";
import type { Bounty, Termination } from "./types";
import { Boundary } from "./ui";
import WorldScenery from "./WorldScenery";
import { regions, regionField } from "./regions";
import type { RegionId } from "./regions";
import { bugAppearance, bugPalette, bugPixels } from "./bug-art";

type Appearance = ReturnType<typeof bugAppearance>;

function PixelPart({
  bug,
  part,
  meshRef,
}: {
  bug: Appearance;
  part: string;
  meshRef?: React.RefObject<InstancedMesh | null>;
}) {
  const ownRef = useRef<InstancedMesh>(null),
    ref = meshRef ?? ownRef;
  const width = Math.max(...bug.pixels.map((row) => row.length));
  const pixels = useMemo(
    () =>
      bugPixels(bug.pixels).filter((pixel) => {
        const movingPart =
          bug.flying && Math.abs(pixel.x - (width - 1) / 2) > 3
            ? pixel.x < width / 2
              ? "left"
              : "right"
            : pixel.part;
        return movingPart === part;
      }),
    [bug.name, part, width],
  );
  useLayoutEffect(() => {
    if (!ref.current) return;
    const object = new Object3D(),
      color = new Color(),
      palette = bugPalette(bug.region);
    pixels.forEach((pixel, i) => {
      object.position.set(
        (pixel.x - (width - 1) / 2) * 0.08,
        ((bug.pixels.length - 1) / 2 - pixel.y) * 0.08,
        pixel.tone === "h" || pixel.tone === "a" ? 0.035 : 0,
      );
      object.updateMatrix();
      ref.current!.setMatrixAt(i, object.matrix);
      ref.current!.setColorAt(i, color.set(palette[pixel.tone]));
    });
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
  }, [bug.color, bug.name, pixels, ref, width]);
  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, pixels.length]}
      frustumCulled={false}
    >
      <boxGeometry args={[0.08, 0.08, 0.065]} />
      <meshStandardMaterial
        roughness={0.65}
        metalness={0.15}
        emissive={bug.color}
        emissiveIntensity={0.035}
      />
    </instancedMesh>
  );
}

function BugModel({ bug, still }: { bug: Appearance; still: boolean }) {
  const body = useRef<Group>(null),
    left = useRef<InstancedMesh>(null),
    right = useRef<InstancedMesh>(null);
  useFrame(({ clock }) => {
    if (!body.current) return;
    const phase = still
      ? 0
      : Math.sin(clock.elapsedTime * (bug.flying ? 8 : 9) + bug.seed);
    body.current.rotation.x = 0.08;
    body.current.position.y = phase * (bug.flying ? 0.035 : 0.008);
    if (left.current && right.current) {
      left.current.position.y = phase * (bug.flying ? 0 : 0.012);
      right.current.position.y = -phase * (bug.flying ? 0 : 0.012);
      left.current.rotation.y = bug.flying ? phase * 0.18 : 0;
      right.current.rotation.y = bug.flying ? -phase * 0.18 : 0;
    }
  });
  return (
    <group ref={body} scale={bug.size}>
      <PixelPart bug={bug} part="body" />
      <PixelPart bug={bug} part="left" meshRef={left} />
      <PixelPart bug={bug} part="right" meshRef={right} />
    </group>
  );
}

function TargetTag({ label, color }: { label: string; color: string }) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 44;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#130f24e8";
    context.fillRect(0, 0, 320, 44);
    context.fillStyle = color;
    context.fillRect(0, 0, 3, 44);
    context.fillRect(317, 0, 3, 44);
    context.font = "bold 17px Consolas, monospace";
    context.textAlign = "center";
    context.fillText(label, 160, 28);
    const map = new CanvasTexture(canvas);
    map.colorSpace = SRGBColorSpace;
    map.magFilter = NearestFilter;
    return map;
  }, [label, color]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <sprite position={[0, -1.5, 0.3]} scale={[2.65, 0.35, 1]}>
      <spriteMaterial
        map={texture}
        depthTest={false}
        transparent
        toneMapped={false}
      />
    </sprite>
  );
}

function Target({
  bug,
  index,
  slot,
  count,
  overview,
  open,
  still,
  frozen,
}: {
  bug: Bounty;
  index: number;
  slot: number;
  count: number;
  overview: boolean;
  open: (id: string) => void;
  still: boolean;
  frozen: boolean;
}) {
  const appearance = useMemo(
    () => bugAppearance(bug.bounty_id, bug.difficulty, bug.category),
    [bug.bounty_id, bug.difficulty, bug.category],
  );
  const group = useRef<Group>(null),
    model = useRef<Group>(null),
    placed = useRef(false),
    time = useRef(0),
    [hover, setHover] = useState(false),
    { viewport, size } = useThree();
  useFrame((_, delta) => {
    if (!group.current || (frozen && placed.current)) return;
    if (!still && !hover && !frozen) time.current += Math.min(delta, 0.05);
    const field = regionField(
      size.width,
      size.height,
      overview ? appearance.region.id : null,
      bug.bounty_id.startsWith("entry"),
    );
    const header = overview
      ? Math.min(size.width <= 720 ? 34 : 46, field.height * 0.55)
      : 20;
    const left = field.left + 12,
      top = field.top + header + 3,
      width = Math.max(12, field.width - 24),
      height = Math.max(4, field.height - header - 18);
    const t = time.current * (appearance.flying ? 0.7 : 0.48) + slot * 2.399;
    const columns = Math.min(
        count || 1,
        Math.max(1, Math.round(Math.sqrt((count * width) / height))),
      ),
      rows = Math.max(1, Math.ceil(count / columns)),
      cellWidth = width / columns,
      cellHeight = height / rows;
    const u = ((slot % columns) + 0.5 + Math.sin(t * 0.83) * 0.14) / columns,
      v =
        (Math.floor(slot / columns) + 0.5 + Math.sin(t * 1.13 + slot) * 0.14) /
        rows;
    group.current.position.set(
      ((left + u * width) / size.width - 0.5) * viewport.width,
      (0.5 - (top + v * height) / size.height) * viewport.height,
      0.2,
    );
    if (model.current)
      model.current.rotation.z =
        0.09 *
        Math.atan2(
          -Math.cos(t * 0.83) * cellWidth * 0.83,
          -Math.cos(t * 1.13 + index) * cellHeight * 1.13,
        );
    group.current.scale.setScalar(
      Math.min(
        0.65,
        (viewport.width / size.width) * 48,
        (viewport.width / size.width) * cellWidth * 0.24,
        (viewport.height / size.height) * cellHeight * 0.25,
      ) * (hover ? 1.15 : 1),
    );
    placed.current = true;
  });
  const color = appearance.color;
  return (
    <group
      ref={group}
      name={`target-${bug.bounty_id}`}
      userData={{
        species: appearance.name,
        region: appearance.region.id,
        pixelSize: appearance.size,
      }}
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
      <group ref={model}>
        <BugModel bug={appearance} still={still || hover || frozen} />
      </group>
      <TargetTag
        label={
          bug.bounty_id.startsWith("entry")
            ? appearance.name.toUpperCase()
            : `T-${String(index + 1).padStart(2, "0")} / ${bug.base_bounty} CR`
        }
        color={color}
      />
      <mesh position={[0, 0, -0.2]} rotation={[0, 0, Math.PI / 4]}>
        <ringGeometry args={[1.3, hover ? 1.34 : 1.31, 4]} />
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

export default function Arena({
  bugs,
  onOpen,
  still,
  strike,
  pending = [],
  onTerminated,
  region = "neon",
  onRegionChange,
}: {
  bugs: Bounty[];
  onOpen: (id: string) => void;
  still: boolean;
  strike?: Termination;
  pending?: string[];
  onTerminated?: () => void;
  region?: RegionId | null;
  onRegionChange?: (region: RegionId | null) => void;
}) {
  const destination =
    strike && region
      ? bugs.find((bug) => bug.bounty_id === strike.bountyId)
      : null;
  const focus = destination
    ? bugAppearance(
        destination.bounty_id,
        destination.difficulty,
        destination.category,
      ).region.id
    : region;
  const habitats = regions.map((item) =>
    bugs.filter(
      (bug) =>
        bugAppearance(bug.bounty_id, bug.difficulty, bug.category).region.id ===
        item.id,
    ),
  );
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
      <WorldScenery
        region={focus}
        still={still}
        bugs={bugs}
        enter={onRegionChange}
        locked={!!strike}
      />
      <Boundary fallback={fallback}>
        <div
          className="arena-canvas"
          aria-label="Three-dimensional bounty arena"
        >
          <Canvas
            dpr={[1, 1.5]}
            frameloop={still ? "demand" : "always"}
            camera={{ position: new Vector3(0, 0, 10), fov: 48 }}
            gl={{ antialias: false, alpha: true, preserveDrawingBuffer: true }}
            fallback={fallback}
          >
            <ambientLight intensity={0.9} />
            <directionalLight position={[4, 7, 9]} intensity={1.8} />
            <pointLight position={[-4, 2, 4]} intensity={7} color="#49e8ed" />
            <pointLight position={[4, -1, 3]} intensity={6} color="#ef418d" />
            {bugs.map((bug, index) => {
              const appearance = bugAppearance(
                bug.bounty_id,
                bug.difficulty,
                bug.category,
              );
              if (
                (focus && appearance.region.id !== focus) ||
                (bug.claimed && !pending.includes(bug.bounty_id))
              )
                return null;
              const habitat =
                habitats[
                  regions.findIndex((item) => item.id === appearance.region.id)
                ];
              return (
                <Target
                  key={bug.bounty_id}
                  bug={bug}
                  index={index}
                  slot={habitat.findIndex(
                    (item) => item.bounty_id === bug.bounty_id,
                  )}
                  count={habitat.length}
                  overview={focus === null}
                  open={onOpen}
                  still={still}
                  frozen={strike?.bountyId === bug.bounty_id}
                />
              );
            })}
            {strike && !still && (
              <Strike key={strike.awardId} bountyId={strike.bountyId} />
            )}
          </Canvas>
        </div>
      </Boundary>
      {bugs.some((bug) => !bug.bounty_id.startsWith("entry")) && (
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
