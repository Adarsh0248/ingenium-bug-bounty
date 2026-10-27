import type { BugMotion } from "./bug-art";
import { legPaths } from "./neon-creatures";

export const stanceFraction = 0.62;
export const stepLength = (motion: BugMotion) =>
  motion === "DRAG" ? 0.18 : motion === "SKITTER" ? 0.36 : 0.42;
export function turnTowards(current: number, target: number, limit: number) {
  const difference = Math.atan2(
    Math.sin(target - current),
    Math.cos(target - current),
  );
  return current + Math.max(-limit, Math.min(limit, difference));
}
export function travelHeading(dx: number, dy: number) {
  return Math.atan2(-dx, -dy);
}
type Point = { x: number; y: number };
export function solveLeg(
  hip: Point,
  target: Point,
  upper: number,
  lower: number,
  bend: number,
) {
  const dx = target.x - hip.x,
    dy = target.y - hip.y,
    requested = Math.hypot(dx, dy),
    reach = Math.max(
      Math.abs(upper - lower) + 1e-6,
      Math.min(upper + lower - 1e-6, requested),
    ),
    ux = requested ? dx / requested : 1,
    uy = requested ? dy / requested : 0,
    along = (upper * upper - lower * lower + reach * reach) / (2 * reach),
    across = Math.sqrt(Math.max(0, upper * upper - along * along)) * bend;
  return {
    hip,
    knee: {
      x: hip.x + ux * along - uy * across,
      y: hip.y + uy * along + ux * across,
    },
    foot: { x: hip.x + ux * reach, y: hip.y + uy * reach },
  };
}
export function legChains(motion: BugMotion) {
  return [false, true].flatMap((right) =>
    legPaths[motion].map((path, index) => {
      const coordinates = path.match(/-?\d+(?:\.\d+)?/g)!.map(Number),
        point = (i: number) => ({
          x: (((coordinates[i] - 128) * 3) / 256) * (right ? -1 : 1),
          y: ((128 - coordinates[i + 1]) * 3) / 256,
        }),
        hip = point(0),
        knee = point(2),
        end = point(coordinates.length - 2),
        upper = Math.hypot(knee.x - hip.x, knee.y - hip.y),
        lower = Math.hypot(end.x - knee.x, end.y - knee.y);
      return {
        hip,
        home: {
          x: hip.x + (end.x - hip.x) * 0.8,
          y: hip.y + (end.y - hip.y) * 0.8,
        },
        upper,
        lower,
        bend:
          Math.sign(
            (end.x - hip.x) * (knee.y - hip.y) -
              (end.y - hip.y) * (knee.x - hip.x),
          ) || 1,
        side: right ? 1 : -1,
        offset: motion === "HOP" ? 0 : (index % 2) * 0.5 + (right ? 0.5 : 0),
      };
    }),
  );
}
export function legPose(
  chain: ReturnType<typeof legChains>[number],
  motion: BugMotion,
  distance: number,
  seed: number,
) {
  const flying = motion === "FLY" || motion === "DART",
    length = stepLength(motion),
    cycle = distance / length + seed / (Math.PI * 2) + chain.offset,
    phase = cycle - Math.floor(cycle),
    planted = !flying && phase < stanceFraction,
    recovery = Math.max(0, (phase - stanceFraction) / (1 - stanceFraction)),
    smooth = recovery * recovery * (3 - 2 * recovery),
    lift = flying ? 0 : Math.sin(recovery * Math.PI),
    stride = flying
      ? 0
      : planted
        ? length * (stanceFraction / 2 - phase)
        : length * stanceFraction * (smooth - 0.5),
    foot = {
      x: chain.home.x + chain.side * lift * 0.055,
      y: chain.home.y + stride,
    };
  return {
    ...solveLeg(chain.hip, foot, chain.upper, chain.lower, chain.bend),
    planted,
    lift,
  };
}
