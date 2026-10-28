import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  CanvasTexture,
  NearestFilter,
  SRGBColorSpace,
  Group,
  Vector3,
} from "three";
import type { Ray } from "three";
import type { ReactNode } from "react";
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
import TerminationSequence from "./TerminationSequence";
import { regionWeapons, terminationDuration } from "./termination-art";
import {
  syncRoamers,
  stepSwarm,
  swarmPixels,
  closestRoamer,
} from "./bug-swarm";
import type { Roamer } from "./bug-swarm";
import {
  mapBounds,
  clampMap,
  centreMap,
  mapExtent,
  regionTarget,
  infoCardPlacement,
} from "./region-map";
import type { RegionMapView, MapBounds } from "./region-map";

function placeInfoCard(
  node: HTMLDivElement,
  bounds: MapBounds,
  point: { x: number; y: number },
  radius: number,
) {
  const width = Math.min(300, bounds.width - 16),
    room = Math.max(
      point.y - radius - 14 - bounds.top,
      bounds.top + bounds.height - point.y - radius - 14,
    ),
    maxHeight = Math.min(290, Math.max(160, room));
  if (node.style.width !== `${width}px`) node.style.width = `${width}px`;
  if (node.style.getPropertyValue("--card-max-height") !== `${maxHeight}px`)
    node.style.setProperty("--card-max-height", `${maxHeight}px`);
  const p = infoCardPlacement(bounds, point, radius, {
    width,
    height: node.offsetHeight,
  });
  if (node.style.left !== `${p.left}px`) node.style.left = `${p.left}px`;
  if (node.style.top !== `${p.top}px`) node.style.top = `${p.top}px`;
  node.style.setProperty("--card-pin", `${p.pin}px`);
  node.dataset.placement = p.side;
  node.dataset.bugX = String(point.x);
  node.dataset.bugY = String(point.y);
  node.style.visibility = "visible";
}

function InspectedTarget({
  request,
  anchor,
  positions,
  mapView,
  locate,
}: {
  request: { bountyId: string };
  anchor: React.RefObject<HTMLDivElement | null>;
  positions: React.RefObject<Map<string, Roamer>>;
  mapView: React.RefObject<RegionMapView>;
  locate: (point: { x: number; y: number }) => void;
}) {
  const { size } = useThree(),
    placed = useRef<{ request: object; width: number; height: number } | null>(
      null,
    );
  useFrame(() => {
    const actor = positions.current.get(request.bountyId),
      node = anchor.current;
    if (!actor || !node) return;
    if (
      placed.current?.request === request &&
      placed.current.width === size.width &&
      placed.current.height === size.height
    )
      return;
    locate(actor);
    placed.current = { request, width: size.width, height: size.height };
    const bounds = mapBounds(size.width, size.height);
    placeInfoCard(
      node,
      bounds,
      {
        x: bounds.left + mapView.current.x + actor.x,
        y: bounds.top + mapView.current.y + actor.y,
      },
      actor.radius,
    );
  });
  return null;
}

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
  const pointer = useMemo(() => new Vector3(), []);
  function ownsPointer(ray: Ray) {
    if (!ray.direction.z) return false;
    ray.at((0.2 - ray.origin.z) / ray.direction.z, pointer);
    const bounds = mapBounds(size.width, size.height),
      view = mapView.current,
      point = {
        x:
          (pointer.x / viewport.width + 0.5) * size.width -
          bounds.left -
          view.x,
        y:
          (0.5 - pointer.y / viewport.height) * size.height -
          bounds.top -
          view.y,
      };
    return (
      closestRoamer(point, positions.current.values(), appearance.region.id) ===
      bug.bounty_id
    );
  }
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
      !group.current.userData.terminationHidden &&
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
        roamer: positions.current.get(bug.bounty_id),
        aura: appearance.rank.tier ? appearance.region.aura : null,
      }}
      onClick={
        active
          ? (e) => {
              if (!ownsPointer(e.ray)) return;
              e.stopPropagation();
              open(bug.bounty_id);
            }
          : undefined
      }
      onPointerOver={
        active
          ? (e) => {
              if (!ownsPointer(e.ray)) return;
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
        <ringGeometry args={[1.3, bug.scan_clear ? 1.39 : hover ? 1.34 : 1.31, bug.scan_clear ? 24 : 4]} />
        <meshBasicMaterial
          color={bug.scan_clear ? "#8effb9" : color}
          transparent
          opacity={bug.scan_clear ? 0.9 : hover ? 0.8 : 0.25}
        />
      </mesh>
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
  inspection,
  infoCard,
  onDismissInfo,
}: {
  bugs: Bounty[];
  onOpen: (id: string) => void;
  still: boolean;
  strike?: Termination;
  pending?: string[];
  onTerminated?: () => void;
  region?: RegionId | null;
  onRegionChange?: (region: RegionId | null) => void;
  inspection?: { bountyId: string } | null;
  infoCard?: ReactNode;
  onDismissInfo?: () => void;
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
  const finish = useRef(onTerminated),
    weaponPanel = useRef<HTMLDivElement>(null);
  const weapon = regionWeapons[focus ?? "neon"];
  const root = useRef<HTMLDivElement>(null),
    card = useRef<HTMLDivElement>(null),
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
  const navigation = useRef({
    focus,
    locked,
    bounds,
    dismissInfo: onDismissInfo,
  });
  navigation.current = { focus, locked, bounds, dismissInfo: onDismissInfo };
  function locateInspected(point: { x: number; y: number; radius?: number }) {
    const radius = point.radius ?? 50,
      targetY = Math.min(
        bounds.height - radius - 24,
        Math.max(bounds.height * 0.65, 290 + radius + 20),
      );
    applyMap(
      clampMap({ x: bounds.width / 2 - point.x, y: targetY - point.y }, bounds),
    );
  }
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
  useLayoutEffect(() => {
    if (!inspection || !focus || !mapSize.width || !card.current) return;
    const node = card.current,
      habitat = habitats[regions.findIndex((r) => r.id === focus)],
      point =
        positions.current.get(inspection.bountyId) ??
        regionTarget(
          Math.max(
            0,
            habitat.findIndex((b) => b.bounty_id === inspection.bountyId),
          ),
          habitat.length,
          bounds,
        ),
      radius = positions.current.get(inspection.bountyId)?.radius ?? 50;
    locateInspected(point);
    const place = () => {
      const current = positions.current.get(inspection.bountyId) ?? point;
      placeInfoCard(
        node,
        bounds,
        {
          x: bounds.left + mapView.current.x + current.x,
          y: bounds.top + mapView.current.y + current.y,
        },
        positions.current.get(inspection.bountyId)?.radius ?? radius,
      );
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(node);
    return () => observer.disconnect();
  }, [inspection, focus, mapSize.width, mapSize.height]);
  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const wheel = (event: WheelEvent) => {
      const n = navigation.current,
        b = n.bounds;
      if (
        !n.focus ||
        n.locked ||
        (event.target as Element).closest(".bug-info-anchor") ||
        event.ctrlKey ||
        event.clientX < b.left ||
        event.clientX > b.left + b.width ||
        event.clientY < b.top ||
        event.clientY > b.top + b.height
      )
        return;
      event.preventDefault();
      n.dismissInfo?.();
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
    navigation.current.dismissInfo?.();
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
    const tier = destination
      ? bugAppearance(
          destination.bounty_id,
          destination.difficulty,
          destination.category,
          destination.base_bounty,
        ).rank.tier
      : 0;
    const timer = setTimeout(
      () => finish.current?.(),
      still || !destination ? 1800 : (terminationDuration(tier) + 2) * 1000,
    );
    return () => clearTimeout(timer);
  }, [strike?.awardId, still]);
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
          onDismissInfo?.();
          applyMap(centreMap(bounds));
        }
      }}
      onPointerDownCapture={(e) => {
        ignoreClick.current = false;
        if (
          !focus ||
          locked ||
          (e.target as Element).closest(
            "button,.region-map-controls,.bug-info-anchor",
          )
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
        onDismissInfo?.();
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
              frozen={strike?.bountyId ?? inspection?.bountyId}
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
                    if (!ignoreClick.current && !strike) onOpen(id);
                  }}
                  still={still}
                  frozen={
                    strike?.bountyId === bug.bounty_id ||
                    inspection?.bountyId === bug.bounty_id
                  }
                  mapView={mapView}
                  positions={positions}
                />
              );
            })}
            {inspection && (
              <InspectedTarget
                request={inspection}
                anchor={card}
                positions={positions}
                mapView={mapView}
                locate={locateInspected}
              />
            )}
            {strike && destination && !still && (
              <TerminationSequence
                key={strike.awardId}
                bug={destination}
                onComplete={() => finish.current?.()}
                panel={weaponPanel}
              />
            )}
          </Canvas>
        </div>
      </Boundary>
      {inspection && infoCard && (
        <div
          ref={card}
          className="bug-info-anchor"
          data-inspect-target={inspection.bountyId}
        >
          {infoCard}
        </div>
      )}
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
              onClick={() => {
                onDismissInfo?.();
                applyMap(centreMap(bounds));
              }}
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
          <span>{weapon.serial}</span>
        </div>
      )}
      {strike && (
        <div
          className="termination-banner"
          ref={weaponPanel}
          role="status"
          data-award-id={strike.awardId}
          data-weapon={weapon.name}
          data-phase={still ? "CONFIRMED" : "DEPLOYING"}
          style={{ "--weapon-colour": weapon.colour } as React.CSSProperties}
        >
          <span>BOUNTY SECURED</span>
          <strong>TARGET TERMINATED</strong>
          <small>
            {bugs.find((bug) => bug.bounty_id === strike.bountyId)?.title}
          </small>
          <div className="weapon-sequence-status">
            <b>{weapon.name.toUpperCase()}</b>
            <span data-weapon-phase>{still ? "CONFIRMED" : "DEPLOYING"}</span>
          </div>
          {!still && (
            <div className="weapon-sequence-progress" aria-hidden="true">
              <i />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
