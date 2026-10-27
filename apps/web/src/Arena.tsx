import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  AdditiveBlending,
  CanvasTexture,
  NearestFilter,
  SRGBColorSpace,
  Group,
  Vector3,
} from "three";
import type { Bounty, Termination } from "./types";
import { Boundary } from "./ui";
import WorldScenery from "./WorldScenery";
import { regions } from "./regions";
import type { RegionId } from "./regions";
import { bugAppearance } from "./bug-art";
import BugAura from "./BugAura";
import NeonCreature from "./NeonCreature";
import FoundryCreature from "./FoundryCreature";
import NexusCreature from "./NexusCreature";
import ZeroDayEntity from "./ZeroDayEntity";
import { syncRoamers, stepSwarm, swarmPixels } from "./bug-swarm";
import type { Roamer } from "./bug-swarm";
import {
  mapBounds,
  clampMap,
  centreMap,
  mapExtent,
  regionTarget,
} from "./region-map";
import type { RegionMapView } from "./region-map";

function SwarmController({
  bugs,
  pending,
  focus,
  still,
  frozen,
  memory,
}: {
  bugs: Bounty[];
  pending: string[];
  focus: RegionId | null;
  still: boolean;
  frozen?: string;
  memory: React.RefObject<Map<string, Roamer>>;
}) {
  const { size } = useThree(),
    world = useMemo(
      () => mapExtent(mapBounds(size.width, size.height)),
      [size.width, size.height],
    );
  const specs = useMemo(() => {
    const appearances = bugs.map((b) =>
      bugAppearance(b.bounty_id, b.difficulty, b.category, b.base_bounty),
    );
    return bugs.flatMap((bug, index) => {
      if (bug.claimed && !pending.includes(bug.bounty_id)) return [];
      const art = appearances[index],
        habitat = bugs.filter(
          (_, i) => appearances[i].region.id === art.region.id,
        ),
        point = regionTarget(
          habitat.findIndex((b) => b.bounty_id === bug.bounty_id),
          habitat.length,
          mapBounds(size.width, size.height),
        );
      return [
        {
          id: bug.bounty_id,
          region: art.region.id,
          motion: art.motion,
          seed: art.seed,
          size: art.size,
          pace: art.speed,
          x: point.x,
          y: point.y,
        },
      ];
    });
  }, [bugs, pending, size.width, size.height]);
  useLayoutEffect(
    () => syncRoamers(memory.current, specs, world),
    [memory, specs, world],
  );
  useFrame((_, delta) => {
    if (still || !focus) return;
    const actors = [...memory.current.values()].filter(
      (a) => a.region === focus,
    );
    stepSwarm(actors, delta, world, frozen);
  }, -2);
  return null;
}

function TargetTag({
  label,
  color,
  offset = 1.5,
}: {
  label: string;
  color: string;
  offset?: number;
}) {
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
    <sprite position={[0, -offset, 0.3]} scale={[2.65, 0.35, 1]}>
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
  active,
  open,
  still,
  frozen,
  mapView,
  positions,
}: {
  bug: Bounty;
  index: number;
  active: boolean;
  open: (id: string) => void;
  still: boolean;
  frozen: boolean;
  mapView: React.RefObject<RegionMapView>;
  positions: React.RefObject<Map<string, Roamer>>;
}) {
  const appearance = useMemo(
    () =>
      bugAppearance(
        bug.bounty_id,
        bug.difficulty,
        bug.category,
        bug.base_bounty,
      ),
    [bug.bounty_id, bug.difficulty, bug.category, bug.base_bounty],
  );
  const group = useRef<Group>(null),
    model = useRef<Group>(null),
    moving = useRef(false),
    distance = useRef(0),
    [hover, setHover] = useState(false),
    { viewport, size } = useThree();
  useEffect(() => {
    if (!active) {
      const actor = positions.current.get(bug.bounty_id);
      if (actor) actor.held = false;
      setHover(false);
      document.body.style.cursor = "";
    }
  }, [active, positions, bug.bounty_id]);
  useFrame(() => {
    if (!group.current) return;
    const actor = positions.current.get(bug.bounty_id);
    if (!actor) {
      group.current.visible = false;
      return;
    }
    const bounds = mapBounds(size.width, size.height),
      view = mapView.current,
      x = bounds.left + view.x + actor.x,
      y = bounds.top + view.y + actor.y;
    group.current.userData.roamer = actor;
    if (model.current) model.current.rotation.z = actor.heading;
    moving.current = active && !still && actor.moving;
    distance.current = actor.distance;
    group.current.position.set(
      (x / size.width - 0.5) * viewport.width,
      (0.5 - y / size.height) * viewport.height,
      0.2,
    );
    group.current.scale.setScalar(
      (viewport.width / size.width) * swarmPixels(mapExtent(bounds)),
    );
    group.current.visible =
      active &&
      x > bounds.left - actor.radius &&
      x < bounds.left + bounds.width + actor.radius &&
      y > bounds.top - actor.radius &&
      y < bounds.top + bounds.height + actor.radius;
  }, -1);
  const paused = still || !active || hover || frozen;
  const color = appearance.color;
  return (
    <group
      ref={group}
      visible={false}
      name={`target-${bug.bounty_id}`}
      userData={{
        species: appearance.name,
        region: appearance.region.id,
        pixelSize: appearance.size,
        motion: appearance.motion,
        bountyTier: appearance.rank.label,
        weapon: appearance.weapon,
        aura: appearance.rank.tier ? appearance.region.aura : null,
      }}
      onClick={
        active
          ? (e) => {
              e.stopPropagation();
              open(bug.bounty_id);
            }
          : undefined
      }
      onPointerOver={
        active
          ? (e) => {
              e.stopPropagation();
              const actor = positions.current.get(bug.bounty_id);
              if (actor) actor.held = true;
              setHover(true);
              document.body.style.cursor = "pointer";
            }
          : undefined
      }
      onPointerOut={
        active
          ? () => {
              const actor = positions.current.get(bug.bounty_id);
              if (actor) actor.held = false;
              setHover(false);
              document.body.style.cursor = "";
            }
          : undefined
      }
    >
      {appearance.rank.tier > 0 && <BugAura bug={appearance} still={paused} />}
      <group ref={model} name="motion-heading">
        {appearance.region.id === "neon" ? (
          <NeonCreature
            bug={appearance}
            still={paused}
            moving={moving}
            distance={distance}
          />
        ) : appearance.region.id === "foundry" ? (
          <FoundryCreature
            bug={appearance}
            still={paused}
            distance={distance}
            pan={mapView}
          />
        ) : appearance.region.id === "verdant" ? (
          <NexusCreature
            bug={appearance}
            still={paused}
            moving={moving}
            distance={distance}
          />
        ) : (
          <ZeroDayEntity
            bug={appearance}
            still={paused}
            moving={moving}
            distance={distance}
          />
        )}
      </group>
      <TargetTag
        label={
          bug.bounty_id.startsWith("entry")
            ? appearance.name.toUpperCase()
            : `${appearance.rank.label.toUpperCase()} T-${String(index + 1).padStart(2, "0")} / ${bug.base_bounty} CR`
        }
        color={color}
        offset={
          appearance.region.id !== "neon"
            ? Math.max(1.5, appearance.size * 1.65)
            : 1.5
        }
      />
      <mesh
        position={[0, 0, -0.2]}
        rotation={[0, 0, Math.PI / 4]}
        scale={
          appearance.region.id !== "neon" ? Math.max(0.48, appearance.size) : 1
        }
      >
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
  const destination = strike
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
  const visited = useRef(new Set<RegionId>());
  if (focus) visited.current.add(focus);
  const finish = useRef(onTerminated);
  const root = useRef<HTMLDivElement>(null),
    scenery = useRef<HTMLDivElement>(null),
    mapView = useRef<RegionMapView>({ x: 0, y: 0 }),
    positions = useRef(new Map<string, Roamer>()),
    ignoreClick = useRef(false);
  const savedViews = useRef(new Map<RegionId, RegionMapView>()),
    invalidate = useRef<() => void>(() => {}),
    gesture = useRef<{
      x: number;
      y: number;
      view: RegionMapView;
      dragged: boolean;
    } | null>(null);
  const [mapSize, setMapSize] = useState({ width: 0, height: 0 });
  const bounds = mapBounds(mapSize.width, mapSize.height),
    locked = !onRegionChange || !!strike;
  const navigation = useRef({ focus, locked, bounds });
  navigation.current = { focus, locked, bounds };
  function applyMap(next: RegionMapView, save = true) {
    const n = navigation.current,
      view = clampMap(next, n.bounds);
    mapView.current = view;
    if (save && n.focus) savedViews.current.set(n.focus, view);
    if (scenery.current)
      scenery.current.style.transform = `translate(${view.x}px,${view.y}px)`;
    if (root.current) {
      root.current.dataset.mapX = String(view.x);
      root.current.dataset.mapY = String(view.y);
    }
    invalidate.current();
  }
  useLayoutEffect(() => {
    if (!root.current) return;
    const observer = new ResizeObserver(([entry]) =>
      setMapSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      }),
    );
    observer.observe(root.current);
    return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => {
    if (!focus || !mapSize.width) return;
    const stored = savedViews.current.get(focus) ?? centreMap(bounds);
    const habitat = habitats[regions.findIndex((r) => r.id === focus)],
      target =
        strike && habitat.findIndex((b) => b.bounty_id === strike.bountyId);
    applyMap(
      typeof target === "number" && target >= 0
        ? centreMap(
            bounds,
            positions.current.get(strike!.bountyId) ??
              regionTarget(target, habitat.length, bounds),
          )
        : stored,
      false,
    );
  }, [focus, mapSize.width, mapSize.height, strike?.awardId]);
  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const wheel = (event: WheelEvent) => {
      const n = navigation.current,
        b = n.bounds;
      if (
        !n.focus ||
        n.locked ||
        event.ctrlKey ||
        event.clientX < b.left ||
        event.clientX > b.left + b.width ||
        event.clientY < b.top ||
        event.clientY > b.top + b.height
      )
        return;
      event.preventDefault();
      const unit =
        event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? b.height : 1;
      applyMap({
        x:
          mapView.current.x -
          (event.shiftKey ? event.deltaX || event.deltaY : event.deltaX) * unit,
        y: mapView.current.y - (event.shiftKey ? 0 : event.deltaY) * unit,
      });
    };
    node.addEventListener("wheel", wheel, { passive: false });
    return () => node.removeEventListener("wheel", wheel);
  }, []);
  function pan(dx: number, dy: number) {
    applyMap({
      ...mapView.current,
      x: mapView.current.x + dx,
      y: mapView.current.y + dy,
    });
  }
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
    <div
      ref={root}
      className="region-arena"
      data-map-region={focus ?? "all"}
      tabIndex={focus ? 0 : -1}
      aria-label={focus ? "Explorable region map" : "Region overview"}
      onKeyDown={(e) => {
        if (e.target !== root.current || !focus || locked) return;
        const moves: Record<string, [number, number]> = {
          ArrowLeft: [140, 0],
          ArrowRight: [-140, 0],
          ArrowUp: [0, 140],
          ArrowDown: [0, -140],
        };
        if (moves[e.key]) {
          e.preventDefault();
          pan(...moves[e.key]);
        } else if (e.key === "Home") {
          e.preventDefault();
          applyMap(centreMap(bounds));
        }
      }}
      onPointerDownCapture={(e) => {
        ignoreClick.current = false;
        if (
          !focus ||
          locked ||
          (e.target as Element).closest("button,.region-map-controls")
        )
          return;
        const b = bounds;
        if (
          e.clientX < b.left ||
          e.clientX > b.left + b.width ||
          e.clientY < b.top ||
          e.clientY > b.top + b.height
        )
          return;
        gesture.current = {
          x: e.clientX,
          y: e.clientY,
          view: { ...mapView.current },
          dragged: false,
        };
      }}
      onPointerMoveCapture={(e) => {
        const g = gesture.current;
        if (!g) return;
        const dx = e.clientX - g.x,
          dy = e.clientY - g.y;
        if (!g.dragged && Math.hypot(dx, dy) < 6) return;
        g.dragged = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        e.stopPropagation();
        applyMap({ ...g.view, x: g.view.x + dx, y: g.view.y + dy });
      }}
      onPointerUpCapture={(e) => {
        ignoreClick.current = !!gesture.current?.dragged;
        if (ignoreClick.current) e.stopPropagation();
        gesture.current = null;
        if (e.currentTarget.hasPointerCapture(e.pointerId))
          e.currentTarget.releasePointerCapture(e.pointerId);
      }}
      onClickCapture={(e) => {
        if (ignoreClick.current) e.stopPropagation();
      }}
      onPointerCancel={() => {
        gesture.current = null;
      }}
    >
      <WorldScenery
        region={focus}
        still={still}
        bugs={bugs}
        enter={onRegionChange}
        locked={!!strike}
        mapRef={scenery}
      />
      <Boundary fallback={fallback}>
        <div
          className="arena-canvas"
          aria-label="Three-dimensional bounty arena"
          aria-hidden={!focus}
          style={
            focus
              ? {
                  clipPath: `inset(${bounds.top}px ${Math.max(0, mapSize.width - bounds.left - bounds.width)}px ${Math.max(0, mapSize.height - bounds.top - bounds.height)}px ${bounds.left}px)`,
                }
              : { visibility: "hidden", pointerEvents: "none" }
          }
        >
          <Canvas
            dpr={[1, 1.5]}
            frameloop={still || !focus ? "demand" : "always"}
            camera={{ position: new Vector3(0, 0, 10), fov: 48 }}
            gl={{ antialias: false, alpha: true, preserveDrawingBuffer: true }}
            fallback={fallback}
            onCreated={(state) => {
              invalidate.current = state.invalidate;
            }}
          >
            <SwarmController
              bugs={bugs}
              pending={pending}
              focus={focus}
              still={still}
              frozen={strike?.bountyId}
              memory={positions}
            />
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
                !visited.current.has(appearance.region.id) ||
                (bug.claimed && !pending.includes(bug.bounty_id))
              )
                return null;
              return (
                <Target
                  key={bug.bounty_id}
                  bug={bug}
                  index={index}
                  active={focus === appearance.region.id}
                  open={(id) => {
                    if (!ignoreClick.current) onOpen(id);
                  }}
                  still={still}
                  frozen={strike?.bountyId === bug.bounty_id}
                  mapView={mapView}
                  positions={positions}
                />
              );
            })}
            {strike && !still && (
              <Strike key={strike.awardId} bountyId={strike.bountyId} />
            )}
          </Canvas>
        </div>
      </Boundary>
      {focus && (
        <div
          className="region-map-controls"
          role="group"
          aria-label="Region map controls"
        >
          <div>
            <button
              type="button"
              aria-label="Pan region left"
              disabled={locked}
              onClick={() => pan(180, 0)}
            >
              ←
            </button>
            <button
              type="button"
              aria-label="Pan region up"
              disabled={locked}
              onClick={() => pan(0, 140)}
            >
              ↑
            </button>
            <button
              type="button"
              aria-label="Pan region down"
              disabled={locked}
              onClick={() => pan(0, -140)}
            >
              ↓
            </button>
            <button
              type="button"
              aria-label="Pan region right"
              disabled={locked}
              onClick={() => pan(-180, 0)}
            >
              →
            </button>
            <button
              type="button"
              disabled={locked}
              onClick={() => applyMap(centreMap(bounds))}
            >
              Centre
            </button>
          </div>
          <small>Drag or scroll to pan · Shift+scroll sideways</small>
        </div>
      )}
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
    </div>
  );
}
