import type { BugMotion } from "./bug-art";
import type { RegionId } from "./regions";
import { travelHeading, turnTowards } from "./bug-locomotion";

export type SwarmWorld = { width: number; height: number };
export const swarmPixels = (world: SwarmWorld) =>
  Math.min(48, Math.max(24, Math.min(world.width, world.height) * 0.045));
export type RoamerSpec = {
  id: string;
  region: RegionId;
  motion: BugMotion;
  seed: number;
  size: number;
  pace: number;
  x: number;
  y: number;
};
export type Roamer = RoamerSpec & {
  radius: number;
  heading: number;
  velocity: number;
  vx: number;
  vy: number;
  distance: number;
  moving: boolean;
  goalX: number;
  goalY: number;
  rest: number;
  trip: number;
  held: boolean;
  worldWidth: number;
  worldHeight: number;
};
const sample = (seed: number, index: number) => {
  let value = Math.imul(seed ^ Math.imul(index + 1, 0x9e3779b1), 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
};
const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, n));
function goal(a: Roamer, world: SwarmWorld) {
  const margin = a.radius + 14;
  a.goalX = margin + sample(a.seed, a.trip * 2) * (world.width - margin * 2);
  a.goalY =
    margin + sample(a.seed, a.trip * 2 + 1) * (world.height - margin * 2);
  if (Math.hypot(a.goalX - a.x, a.goalY - a.y) < a.radius * 3) {
    a.goalX = clamp(world.width - a.x, margin, world.width - margin);
    a.goalY = clamp(world.height - a.y, margin, world.height - margin);
  }
  a.trip++;
}
function place(a: Roamer, others: Roamer[], world: SwarmWorld) {
  const margin = a.radius + 12,
    origin = { x: a.x, y: a.y };
  let best = -Infinity;
  for (let i = 0; i < 256; i++) {
    const spiral = i < 64,
      angle = i * 2.399963229728653,
      x = clamp(
        i === 0
          ? origin.x
          : spiral
            ? origin.x + Math.cos(angle) * Math.sqrt(i) * a.radius
            : sample(a.seed, i * 2) * world.width,
        margin,
        world.width - margin,
      ),
      y = clamp(
        i === 0
          ? origin.y
          : spiral
            ? origin.y + Math.sin(angle) * Math.sqrt(i) * a.radius
            : sample(a.seed, i * 2 + 1) * world.height,
        margin,
        world.height - margin,
      );
    let clearance = Infinity;
    for (const b of others)
      if (a.region === b.region)
        clearance = Math.min(
          clearance,
          Math.hypot(x - b.x, y - b.y) - a.radius - b.radius - 6,
        );
    if (clearance > best) {
      a.x = x;
      a.y = y;
      best = clearance;
    }
    if (clearance >= 0) break;
  }
}

export function syncRoamers(
  memory: Map<string, Roamer>,
  specs: RoamerSpec[],
  world: SwarmWorld,
) {
  const ids = new Set(specs.map((s) => s.id));
  for (const id of memory.keys()) if (!ids.has(id)) memory.delete(id);
  const placed: Roamer[] = [];
  for (const spec of specs) {
    let a = memory.get(spec.id);
    const radius =
        swarmPixels(world) *
        spec.size *
        (spec.motion === "DRAG"
          ? 1.55
          : spec.motion === "FLY" || spec.motion === "DART"
            ? 1.18
            : 1),
      resized =
        a && (a.worldWidth !== world.width || a.worldHeight !== world.height);
    if (!a || a.region !== spec.region) {
      a = {
        ...spec,
        radius,
        heading: sample(spec.seed, 99) * Math.PI * 2,
        velocity: 0,
        vx: 0,
        vy: 0,
        distance: 0,
        moving: false,
        goalX: 0,
        goalY: 0,
        rest: 0,
        trip: 0,
        held: false,
        worldWidth: world.width,
        worldHeight: world.height,
      };
      place(a, placed, world);
      goal(a, world);
      memory.set(spec.id, a);
    } else {
      if (resized) {
        a.x *= world.width / a.worldWidth;
        a.y *= world.height / a.worldHeight;
        a.goalX *= world.width / a.worldWidth;
        a.goalY *= world.height / a.worldHeight;
      }
      a.radius = radius;
      a.pace = spec.pace;
      a.size = spec.size;
      a.motion = spec.motion;
      if (resized) place(a, placed, world);
      a.worldWidth = world.width;
      a.worldHeight = world.height;
    }
    placed.push(a);
  }
}

export function stepSwarm(
  actors: Roamer[],
  seconds: number,
  world: SwarmWorld,
  frozen?: string,
) {
  const dt = Math.max(0, Math.min(seconds, 0.05));
  if (!dt) return;
  const proposals = actors.map((a) => {
    if (a.held || a.id === frozen)
      return { a, dx: 0, dy: 0, turn: 0, velocity: 0, held: true, factor: 1 };
    const gx = a.goalX - a.x,
      gy = a.goalY - a.y,
      length = Math.hypot(gx, gy),
      acceleration = a.motion === "DRAG" ? 55 : a.motion === "DART" ? 230 : 110;
    if (
      length < Math.max(14, a.radius * 0.3) &&
      a.velocity < 12 &&
      a.rest <= 0
    ) {
      a.rest =
        0.18 + sample(a.seed, a.trip + 80) * (a.motion === "DART" ? 0.65 : 0.8);
      goal(a, world);
    }
    a.rest = Math.max(0, a.rest - dt);
    let sx = length ? gx / length : 0,
      sy = length ? gy / length : 0;
    for (const b of actors) {
      if (a === b) continue;
      const dx = a.x - b.x,
        dy = a.y - b.y,
        distance = Math.hypot(dx, dy),
        safe = a.radius + b.radius + 5,
        px = dx + (a.vx - (b.held || b.id === frozen ? 0 : b.vx)) * 0.4,
        py = dy + (a.vy - (b.held || b.id === frozen ? 0 : b.vy)) * 0.4,
        predicted = Math.hypot(px, py),
        influence = safe * 2.3 + Math.max(a.velocity, b.velocity) * 0.25;
      if (Math.min(distance, predicted) >= influence) continue;
      const nx = distance ? dx / distance : a.id < b.id ? 1 : -1,
        ny = distance ? dy / distance : 0,
        facing = -(sx * nx + sy * ny),
        near = distance < safe * 1.3;
      if (!near && facing < -0.1) continue;
      const weight = Math.min(
        1.8,
        (influence - Math.min(distance, predicted)) / (influence - safe * 0.7),
      );
      sx += nx * weight * 2.2 - ny * weight * 1.25;
      sy += ny * weight * 2.2 + nx * weight * 1.25;
    }
    const margin = a.radius + 14;
    sx +=
      Math.max(0, (margin * 1.8 - a.x) / margin) -
      Math.max(0, (a.x - (world.width - margin * 1.8)) / margin);
    sy +=
      Math.max(0, (margin * 1.8 - a.y) / margin) -
      Math.max(0, (a.y - (world.height - margin * 1.8)) / margin);
    const desired = a.rest > 0 ? a.heading : travelHeading(sx, sy),
      next = turnTowards(
        a.heading,
        desired,
        dt *
          (a.motion === "DRAG"
            ? 1.4
            : a.motion === "DART"
              ? 5
              : a.motion === "SKITTER"
                ? 3.6
                : 2.6),
      ),
      error = Math.atan2(Math.sin(desired - next), Math.cos(desired - next)),
      cruise = Math.min(
        220,
        { FLY: 68, WALK: 44, HOP: 55, SKITTER: 82, DRAG: 29, DART: 128 }[
          a.motion
        ] * a.pace,
      ),
      arrival = Math.sqrt(
        Math.max(0, 2 * acceleration * (length - Math.max(10, a.radius * 0.2))),
      ),
      target =
        a.rest > 0
          ? 0
          : Math.min(cruise, arrival) * Math.max(0, Math.cos(error)),
      velocity =
        a.velocity +
        clamp(target - a.velocity, -acceleration * dt, acceleration * dt),
      dx = -Math.sin(next) * velocity * dt,
      dy = -Math.cos(next) * velocity * dt;
    return {
      a,
      dx,
      dy,
      turn: next - a.heading,
      velocity,
      held: false,
      factor: 1,
    };
  });
  // Reserve half the free gap for each moving neighbour; braking cannot push a body sideways.
  for (const p of proposals)
    if (!p.held)
      for (const q of proposals) {
        if (p === q) continue;
        const dx = q.a.x - p.a.x,
          dy = q.a.y - p.a.y,
          distance = Math.hypot(dx, dy);
        if (!distance) continue;
        const closing = (p.dx * dx + p.dy * dy) / distance;
        if (closing > 0) {
          const gap = Math.max(0, distance - p.a.radius - q.a.radius - 3);
          p.factor = Math.min(p.factor, (gap * (q.held ? 1 : 0.5)) / closing);
        }
      }
  for (const p of proposals) {
    const a = p.a;
    if (p.held) {
      a.moving = false;
      continue;
    }
    const dx = p.dx * p.factor,
      dy = p.dy * p.factor,
      margin = a.radius + 12,
      edge = Math.max(
        0,
        Math.min(
          1,
          dx < 0
            ? (a.x - margin) / -dx
            : dx > 0
              ? (world.width - margin - a.x) / dx
              : 1,
          dy < 0
            ? (a.y - margin) / -dy
            : dy > 0
              ? (world.height - margin - a.y) / dy
              : 1,
        ),
      ),
      x = a.x + dx * edge,
      y = a.y + dy * edge,
      travelled = Math.hypot(x - a.x, y - a.y);
    a.heading += p.turn;
    a.vx = (x - a.x) / dt;
    a.vy = (y - a.y) / dt;
    a.velocity = p.velocity * p.factor * edge;
    a.distance +=
      travelled / (swarmPixels(world) * a.size) + Math.abs(p.turn) * 0.3;
    a.moving = travelled > 1e-6 || Math.abs(p.turn) > 1e-6;
    a.x = x;
    a.y = y;
  }
}
