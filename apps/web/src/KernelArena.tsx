import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Bounty, Termination } from "./types";
import type { Roamer } from "./bug-swarm";
import { syncRoamers, closestRoamer } from "./bug-swarm";
import { createKernelMotion, kernelSimulationHz } from "./kernel-motion";
import { createKernelSprites } from "./kernel-sprites";
import { mapBounds, infoCardPlacement } from "./region-map";
import {
  kernelWorld,
  kernelLandmarks,
  kernelCamera,
  kernelAppearance,
  kernelSpecs,
  drawKernelTile,
  drawKernelTraffic,
  drawKernelPurge,
} from "./kernel-art";
import "./kernel.css";

export default function KernelArena(props: {
  bugs: Bounty[];
  onOpen: (id: string) => void;
  still: boolean;
  pending: string[];
  suspended?: boolean;
  strike?: Termination;
  onTerminated: () => void;
  inspection: { bountyId: string } | null;
  onDismissInfo: () => void;
  infoCard: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null),
    canvas = useRef<HTMLCanvasElement>(null),
    floor = useRef<HTMLCanvasElement>(null),
    actorLayer = useRef<HTMLDivElement>(null),
    card = useRef<HTMLDivElement>(null),
    rect = useRef<SVGRectElement>(null),
    memory = useRef(new Map<string, Roamer>()),
    camera = useRef({ x: 1536, y: 960 }),
    latest = useRef(props),
    hover = useRef<string | undefined>(undefined),
    viewport = useRef({ left: 0, top: 0, width: 1, height: 1 }),
    locate = useRef((x: number, y: number) => {}),
    [bounds, setBounds] = useState({ left: 0, top: 0, width: 1, height: 1 });
  latest.current = props;
  useEffect(() => {
    const resize = new ResizeObserver(([entry]) => {
      const b = mapBounds(entry.contentRect.width, entry.contentRect.height);
      viewport.current = b;
      setBounds(b);
      camera.current = kernelCamera(camera.current, b.width, b.height);
      const node = canvas.current!;
      const dpr = Math.min(devicePixelRatio || 1, 1.25);
      node.width = Math.ceil(b.width * dpr);
      node.height = Math.ceil(b.height * dpr);
      floor.current!.width = node.width;
      floor.current!.height = node.height;
    });
    resize.observe(root.current!);
    return () => resize.disconnect();
  }, []);
  useEffect(() => {
    const eligible = props.bugs.filter(
      (b) => !b.claimed || props.pending.includes(b.bounty_id),
    );
    syncRoamers(memory.current, kernelSpecs(eligible), kernelWorld);
  }, [props.bugs, props.pending.join(",")]);
  useEffect(() => {
    const node = canvas.current!,
      c = node.getContext("2d")!,
      floorContext = floor.current!.getContext("2d", { alpha: false })!;
    const tiles = new Map<string, HTMLCanvasElement>(),
      trails = new Map<string, { x: number; y: number }[]>(),
      artworks = new Map<string, ReturnType<typeof kernelAppearance>>(),
      poses = new Map<string, number>(),
      presented = new Map<string, Roamer>(),
      motionClock = createKernelMotion(),
      sprites = createKernelSprites();
    const bodies = new Map<string, HTMLDivElement>();
    const shownBodies = new Set<string>();
    let raf = 0,
      last = 0,
      lastSimulation = 0,
      lastEffects = 0,
      clock = 0,
      frames = 0,
      paintMs = 0,
      metricsAt = 0,
      dirty = true,
      inspected = "",
      strikeId = "",
      strikeStarted = 0,
      strikeDone = false,
      previous = latest.current;
    let floorView = "";
    let minimapView = "",
      reportedView = "",
      reportedActors = 0;
    let dirtyAreas: { x: number; y: number; width: number; height: number }[] =
      [];
    const move = (x: number, y: number) => {
      const b = viewport.current;
      camera.current = kernelCamera(
        { x: x - b.width / 2, y: y - b.height / 2 },
        b.width,
        b.height,
      );
      dirty = true;
    };
    locate.current = move;
    let dragging = false,
      pointer: {
        x: number;
        y: number;
        cx: number;
        cy: number;
        id: number;
      } | null = null;
    function point(e: PointerEvent) {
      const r = node.getBoundingClientRect();
      return {
        x: e.clientX - r.left + camera.current.x,
        y: e.clientY - r.top + camera.current.y,
      };
    }
    function down(e: PointerEvent) {
      if (e.button !== 0 || latest.current.strike) return;
      node.focus({ preventScroll: true });
      pointer = {
        x: e.clientX,
        y: e.clientY,
        cx: camera.current.x,
        cy: camera.current.y,
        id: e.pointerId,
      };
      dragging = false;
      node.setPointerCapture(e.pointerId);
    }
    function motion(e: PointerEvent) {
      if (pointer) {
        const dx = e.clientX - pointer.x,
          dy = e.clientY - pointer.y;
        if (Math.hypot(dx, dy) > 5) dragging = true;
        if (dragging) {
          const b = viewport.current;
          camera.current = kernelCamera(
            { x: pointer.cx - dx, y: pointer.cy - dy },
            b.width,
            b.height,
          );
          hover.current = undefined;
          node.style.cursor = "grabbing";
          dirty = true;
        }
      } else {
        hover.current = closestRoamer(
          point(e),
          presented.size ? presented.values() : memory.current.values(),
          "neon",
        );
        node.style.cursor = hover.current ? "pointer" : "grab";
      }
    }
    function up(e: PointerEvent) {
      if (!pointer || pointer.id !== e.pointerId) return;
      if (e.type !== "pointercancel" && !dragging) {
        const id = closestRoamer(
          point(e),
          presented.size ? presented.values() : memory.current.values(),
          "neon",
        );
        if (id) latest.current.onOpen(id);
        else latest.current.onDismissInfo();
      }
      pointer = null;
      dragging = false;
      node.style.cursor = "grab";
      if (node.hasPointerCapture(e.pointerId))
        node.releasePointerCapture(e.pointerId);
    }
    function wheel(e: WheelEvent) {
      e.preventDefault();
      if (latest.current.strike) return;
      const b = viewport.current;
      camera.current = kernelCamera(
        {
          x: camera.current.x + (e.shiftKey ? e.deltaY : e.deltaX),
          y: camera.current.y + (e.shiftKey ? 0 : e.deltaY),
        },
        b.width,
        b.height,
      );
      dirty = true;
    }
    function key(e: KeyboardEvent) {
      const dx =
          e.key === "ArrowLeft" ? -150 : e.key === "ArrowRight" ? 150 : 0,
        dy = e.key === "ArrowUp" ? -150 : e.key === "ArrowDown" ? 150 : 0;
      if ((dx || dy) && !latest.current.strike) {
        e.preventDefault();
        const b = viewport.current;
        camera.current = kernelCamera(
          { x: camera.current.x + dx, y: camera.current.y + dy },
          b.width,
          b.height,
        );
        dirty = true;
      }
      if (e.key === "Home") {
        e.preventDefault();
        move(2048, 1280);
      }
      if (e.key === "Escape") latest.current.onDismissInfo();
    }
    const leave = () => {
      hover.current = undefined;
    };
    node.addEventListener("pointerdown", down);
    node.addEventListener("pointermove", motion);
    node.addEventListener("pointerup", up);
    node.addEventListener("pointercancel", up);
    node.addEventListener("pointerleave", leave);
    node.addEventListener("wheel", wheel, { passive: false });
    node.addEventListener("keydown", key);
    const tile = (x: number, y: number) => {
      const key = `${x},${y}`;
      let t = tiles.get(key);
      if (!t) {
        t = document.createElement("canvas");
        t.width = t.height = 512;
        drawKernelTile(t.getContext("2d")!, x, y);
      }
      tiles.delete(key);
      tiles.set(key, t);
      if (tiles.size > 48) {
        const oldest = tiles.keys().next().value!;
        tiles.get(oldest)!.width = 0;
        tiles.delete(oldest);
      }
      return t;
    };
    function render(now: number) {
      raf = requestAnimationFrame(render);
      const p = latest.current,
        b = viewport.current;
      if (p !== previous) {
        dirty = true;
        previous = p;
      }
      if (document.hidden || p.suspended) {
        last = now;
        lastSimulation = now;
        return;
      }
      const actors = [...memory.current.values()],
        frozen = p.inspection?.bountyId ?? p.strike?.bountyId ?? hover.current,
        seconds = Math.min(0.1, (now - (lastSimulation || now)) / 1000);
      lastSimulation = now;
      if (p.still) motionClock.hold(actors);
      else {
        motionClock.advance(actors, seconds, kernelWorld, frozen);
        clock += seconds;
      }
      const target = p.inspection?.bountyId ?? "";
      if (target !== inspected) {
        inspected = target;
        const actor = memory.current.get(target);
        if (actor) move(actor.x, actor.y);
        dirty = true;
      }
      const nextStrike = p.strike?.awardId ?? "";
      if (nextStrike !== strikeId) {
        strikeId = nextStrike;
        strikeStarted = now;
        strikeDone = false;
        const a = memory.current.get(p.strike?.bountyId ?? "");
        if (a) move(a.x, a.y);
        dirty = true;
      }
      const elapsed = now - strikeStarted;
      if (p.strike && !strikeDone && elapsed >= 2600) {
        strikeDone = true;
        p.onTerminated();
      }
      const gap = now - last;
      const interval = 1000 / 60;
      if (gap < interval - 0.2) return;
      const start = performance.now();
      last = gap < interval ? now : now - (gap % interval);
      const signature = `${camera.current.x},${camera.current.y},${b.width},${b.height},${p.bugs.length},${p.pending.join()}`;
      if (node.dataset.view !== signature) {
        dirty = true;
        node.dataset.view = signature;
      }
      if (p.still && !dirty && !p.strike) return;
      // Keep body transforms fluid; the separate glow/packet/crawler layer only needs 30 Hz.
      const paintEffects = dirty || now - lastEffects >= 1000 / 30 - 0.2;
      dirty = false;
      const dpr = node.width / b.width;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      const v = { ...camera.current, width: b.width, height: b.height };
      const backgroundKey = `${v.x},${v.y},${b.width},${b.height}`;
      if (backgroundKey !== floorView) c.clearRect(0, 0, b.width, b.height);
      else if (paintEffects)
        for (const area of dirtyAreas)
          c.clearRect(
            area.x - v.x - 2,
            area.y - v.y - 2,
            area.width + 4,
            area.height + 4,
          );
      c.save();
      c.translate(-v.x, -v.y);
      if (backgroundKey !== floorView) {
        floorView = backgroundKey;
        floorContext.setTransform(dpr, 0, 0, dpr, 0, 0);
        floorContext.fillStyle = "#07121f";
        floorContext.fillRect(0, 0, b.width, b.height);
        floorContext.save();
        floorContext.translate(-v.x, -v.y);
        for (
          let y = Math.floor(v.y / 512);
          y <= Math.floor((v.y + b.height) / 512);
          y++
        )
          for (
            let x = Math.floor(v.x / 512);
            x <= Math.floor((v.x + b.width) / 512);
            x++
          )
            if (x >= 0 && x < 8 && y >= 0 && y < 5)
              floorContext.drawImage(tile(x, y), x * 512, y * 512);
        floorContext.restore();
      }
      const nextAreas = paintEffects
        ? drawKernelTraffic(c, clock, v)
        : dirtyAreas;
      if (paintEffects) lastEffects = now;
      const visibleBodies = new Set<string>();
      let drawn = 0;
      const bugs = new Map(p.bugs.map((bug) => [bug.bounty_id, bug]));
      presented.clear();
      for (const actor of actors) {
        const a = motionClock.pose(actor, frozen);
        presented.set(a.id, a);
        const bug = bugs.get(a.id);
        if (!bug) continue;
        let art = artworks.get(a.id);
        if (!art) {
          art = kernelAppearance(a.id, bug.base_bounty);
          artworks.set(a.id, art);
        }
        if (art.kind === 1) {
          const path = trails.get(a.id) ?? [];
          if (
            !path.length ||
            Math.hypot(path[0].x - a.x, path[0].y - a.y) > 3
          ) {
            path.unshift({ x: a.x, y: a.y });
            path.length = Math.min(path.length, 36);
            trails.set(a.id, path);
          }
        }
        if (
          a.x + a.radius < v.x ||
          a.x - a.radius > v.x + b.width ||
          a.y + a.radius < v.y ||
          a.y - a.radius > v.y + b.height
        )
          continue;
        drawn++;
        const margin =
          p.strike?.bountyId === a.id ? a.radius * 3.6 + 10 : a.radius + 10;
        if (paintEffects)
          nextAreas.push({
            x: a.x - margin,
            y: a.y - margin,
            width: margin * 2,
            height: margin * 2,
          });
        if (
          paintEffects &&
          (bug.scan_clear || a.id === hover.current || a.id === target)
        ) {
          c.strokeStyle = bug.scan_clear ? "#9fffba" : art.color;
          c.lineWidth = 1.5;
          c.setLineDash([5, 5]);
          c.beginPath();
          c.ellipse(
            a.x,
            a.y + 5,
            a.radius * 0.9,
            a.radius * 0.55,
            0,
            0,
            Math.PI * 2,
          );
          c.stroke();
          c.setLineDash([]);
        }
        if (
          a.id !== target &&
          a.id !== hover.current &&
          a.id !== p.strike?.bountyId &&
          !p.still
        )
          poses.set(a.id, clock);
        if (!poses.has(a.id)) poses.set(a.id, clock);
        if (p.strike?.bountyId !== a.id || elapsed < 1872) {
          let surface: HTMLDivElement | undefined;
          if (art.kind !== 1) {
            surface = bodies.get(a.id);
            if (!surface) {
              surface = document.createElement("div");
              surface.className = "kernel-body";
              actorLayer.current!.append(surface);
              bodies.set(a.id, surface);
            }
            visibleBodies.add(a.id);
            if (!shownBodies.has(a.id)) {
              surface.style.display = "block";
              shownBodies.add(a.id);
            }
            const lift =
              art.motion === "FLY"
                ? 5 + Math.sin(poses.get(a.id)! * 2) * 1.5
                : 0;
            surface.style.transform = `translate3d(${(a.x - v.x - 64).toFixed(2)}px,${(a.y - v.y - 64 - lift).toFixed(2)}px,0) rotate(${a.heading.toFixed(4)}rad) scale(${art.size.toFixed(3)})`;
          }
          sprites.draw(
            c,
            a,
            art,
            poses.get(a.id)!,
            trails.get(a.id) ?? [],
            surface,
            paintEffects,
          );
        }
        if (paintEffects && p.strike?.bountyId === a.id)
          drawKernelPurge(c, a.x, a.y, elapsed, a.radius, art.color);
      }
      c.restore();
      for (const [id, surface] of bodies) {
        if (!memory.current.has(id)) {
          surface.remove();
          bodies.delete(id);
          shownBodies.delete(id);
        } else if (!visibleBodies.has(id) && shownBodies.has(id)) {
          surface.style.display = "none";
          shownBodies.delete(id);
        }
      }
      dirtyAreas = nextAreas;
      if (
        now - metricsAt >= 1000 ||
        reportedView !== backgroundKey ||
        reportedActors !== memory.current.size
      ) {
        node.dataset.drawn = String(drawn);
        node.dataset.actors = String(memory.current.size);
        node.dataset.tiles = String(tiles.size);
        node.dataset.camera = `${Math.round(v.x)},${Math.round(v.y)}`;
        reportedView = backgroundKey;
        reportedActors = memory.current.size;
      }
      if (rect.current && minimapView !== backgroundKey) {
        minimapView = backgroundKey;
        for (const [key, value] of Object.entries({
          x: String((v.x / 4096) * 160),
          y: String((v.y / 2560) * 100),
          width: String((b.width / 4096) * 160),
          height: String((b.height / 2560) * 100),
        }))
          rect.current.setAttribute(key, value);
      }
      const actor = memory.current.get(target);
      if (actor && card.current) {
        const el = card.current,
          width = Math.min(300, b.width - 16);
        el.style.width = `${width}px`;
        el.style.setProperty(
          "--card-max-height",
          `${Math.min(290, b.height)}px`,
        );
        const position = infoCardPlacement(
          b,
          { x: b.left + actor.x - v.x, y: b.top + actor.y - v.y },
          actor.radius,
          { width, height: el.offsetHeight },
        );
        el.style.left = `${position.left}px`;
        el.style.top = `${position.top}px`;
        el.style.setProperty("--card-pin", `${position.pin}px`);
        el.dataset.placement = position.side;
      }
      frames++;
      const cost = performance.now() - start;
      paintMs += cost;
      if (now - metricsAt >= 1000) {
        node.dataset.paintMs = (paintMs / frames).toFixed(2);
        node.dataset.fps = ((frames * 1000) / (now - metricsAt)).toFixed(1);
        node.dataset.targetFps = "60";
        node.dataset.simulationHz = String(kernelSimulationHz);
        node.dataset.spriteFrames = String(sprites.count());
        metricsAt = now;
        frames = paintMs = 0;
      }
    }
    raf = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(raf);
      node.removeEventListener("pointerdown", down);
      node.removeEventListener("pointermove", motion);
      node.removeEventListener("pointerup", up);
      node.removeEventListener("pointercancel", up);
      node.removeEventListener("pointerleave", leave);
      node.removeEventListener("wheel", wheel);
      node.removeEventListener("keydown", key);
      for (const t of tiles.values()) t.width = 0;
      tiles.clear();
      sprites.clear();
      for (const body of bodies.values()) body.remove();
      bodies.clear();
    };
  }, []);
  return (
    <div ref={root} className="kernel-arena" data-world-view="kernel">
      <canvas
        ref={floor}
        className="kernel-floor"
        style={bounds}
        aria-hidden="true"
      />
      <canvas
        ref={canvas}
        className="kernel-canvas"
        style={bounds}
        tabIndex={0}
        aria-label="Kernel Breach arena. Drag or use arrow keys to pan; click a creature to open its question. Home centres the map."
      />
      <div
        ref={actorLayer}
        className="kernel-actors"
        style={{ ...bounds, left: bounds.left + 1, top: bounds.top + 1 }}
        aria-hidden="true"
      />
      <div
        className="kernel-map-tools"
        style={{
          right: Math.max(18, innerWidth - bounds.left - bounds.width),
          top: bounds.top + 12,
        }}
      >
        <span>THE KERNEL BREACH</span>
        <small>DRAG TO EXPLORE · NO ZOOM</small>
        <button
          className="kernel-minimap"
          aria-label="Navigate the Kernel Breach map"
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            locate.current(
              ((e.clientX - r.left) / r.width) * 4096,
              ((e.clientY - r.top) / r.height) * 2560,
            );
          }}
        >
          <svg viewBox="0 0 160 100" aria-hidden="true">
            <rect width="160" height="100" fill="#091928" />
            {[10, 40, 70, 100, 130].map((x) => (
              <path key={x} d={`M${x} 0V100`} stroke="#205d71" />
            ))}
            {[10, 35, 60, 85].map((y) => (
              <path key={y} d={`M0 ${y}H160`} stroke="#67305d" />
            ))}
            {kernelLandmarks.map((m) => (
              <rect
                key={m.name}
                x={(m.x / 4096) * 160 - 4}
                y={(m.y / 2560) * 100 - 3}
                width="8"
                height="6"
                fill={m.color}
              />
            ))}
            <rect
              ref={rect}
              className="kernel-camera-rect"
              fill="#b3eaff17"
              stroke="#d4faff"
              strokeWidth="1"
            />
          </svg>
        </button>
        <button
          className="kernel-centre"
          onClick={() => locate.current(2048, 1280)}
        >
          Centre on core
        </button>
      </div>
      {props.inspection && props.infoCard && (
        <div ref={card} className="kernel-info">
          {props.infoCard}
        </div>
      )}
    </div>
  );
}
