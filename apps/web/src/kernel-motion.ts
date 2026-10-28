import { stepSwarm } from "./bug-swarm";
import type { Roamer, SwarmWorld } from "./bug-swarm";

type Pose = Pick<Roamer, "x" | "y" | "heading" | "distance">;
export const kernelSimulationHz = 20;
const step = 1 / kernelSimulationHz;
export function createKernelMotion() {
  const previous = new Map<string, Pose>();
  const displayed = new Map<string, Roamer>();
  let remainder = 0;
  function remember(a: Roamer) {
    let pose = previous.get(a.id);
    if (!pose) {
      pose = { x: a.x, y: a.y, heading: a.heading, distance: a.distance };
      previous.set(a.id, pose);
    } else {
      pose.x = a.x;
      pose.y = a.y;
      pose.heading = a.heading;
      pose.distance = a.distance;
    }
  }
  return {
    hold(actors: Roamer[]) {
      remainder = 0;
      for (const a of actors) remember(a);
    },
    advance(
      actors: Roamer[],
      seconds: number,
      world: SwarmWorld,
      frozen?: string,
    ) {
      remainder += Math.max(0, Math.min(0.1, seconds));
      while (remainder + 1e-9 >= step) {
        for (const a of actors) remember(a);
        stepSwarm(actors, step, world, frozen);
        remainder = Math.max(0, remainder - step);
      }
    },
    pose(a: Roamer, frozen?: string): Roamer {
      const p = previous.get(a.id);
      if (!p || a.id === frozen) return a;
      const t = Math.min(1, remainder / step),
        angle = Math.atan2(
          Math.sin(a.heading - p.heading),
          Math.cos(a.heading - p.heading),
        );
      let out = displayed.get(a.id);
      if (!out) {
        out = { ...a };
        displayed.set(a.id, out);
      }
      out.x = p.x + (a.x - p.x) * t;
      out.y = p.y + (a.y - p.y) * t;
      out.heading = p.heading + angle * t;
      out.distance = p.distance + (a.distance - p.distance) * t;
      out.moving = a.moving;
      out.velocity = a.velocity;
      out.radius = a.radius;
      return out;
    },
  };
}

// Resample the travelled path, so the crawler's segments do not jump whenever a history point is saved.
export function kernelTail(
  head: { x: number; y: number; heading: number },
  history: { x: number; y: number }[],
  spacing: number,
  count = 7,
) {
  const points = [head, ...history],
    result: { x: number; y: number }[] = [];
  let index = 0,
    walked = 0;
  for (let i = 0; i < count; i++) {
    const target = i * spacing;
    while (index < points.length - 1) {
      const from = points[index],
        to = points[index + 1],
        length = Math.hypot(to.x - from.x, to.y - from.y);
      if (length > 1e-6 && walked + length >= target) break;
      walked += length;
      index++;
    }
    const from = points[index],
      to = points[index + 1];
    if (to) {
      const t = (target - walked) / Math.hypot(to.x - from.x, to.y - from.y);
      result.push({
        x: from.x + (to.x - from.x) * t,
        y: from.y + (to.y - from.y) * t,
      });
    } else
      result.push({
        x: from.x + Math.sin(head.heading) * (target - walked),
        y: from.y + Math.cos(head.heading) * (target - walked),
      });
  }
  return result;
}
