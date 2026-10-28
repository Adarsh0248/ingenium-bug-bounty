import { regionField } from "./regions";
import type { BugMotion } from "./bug-art";

export type RegionMapView = { x: number; y: number };
export type MapBounds = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export function mapBounds(width: number, height: number): MapBounds {
  const field = regionField(width, height, null);
  return width <= 720
    ? { ...field, height: Math.max(90, height - field.top - 70) }
    : field;
}
export function clampMap(
  view: RegionMapView,
  bounds: MapBounds,
): RegionMapView {
  return {
    x: Math.max(-3 * bounds.width, Math.min(0, view.x)),
    y: Math.max(-3 * bounds.height, Math.min(0, view.y)),
  };
}
export function mapExtent(bounds: MapBounds) {
  return { width: bounds.width * 4, height: bounds.height * 4 };
}
export function centreMap(
  bounds: MapBounds,
  point = { x: bounds.width * 2, y: bounds.height * 2 },
): RegionMapView {
  return clampMap(
    {
      x: bounds.width / 2 - point.x,
      y: bounds.height / 2 - point.y,
    },
    bounds,
  );
}
export function infoCardPlacement(
  bounds: MapBounds,
  point: { x: number; y: number },
  radius: number,
  card: { width: number; height: number },
) {
  const left = Math.max(
      bounds.left + 8,
      Math.min(
        point.x - card.width / 2,
        bounds.left + bounds.width - card.width - 8,
      ),
    ),
    above = point.y - radius - 14 - card.height,
    aboveRoom = point.y - radius - 14 - bounds.top,
    belowRoom = bounds.top + bounds.height - point.y - radius - 14,
    side =
      aboveRoom >= card.height || aboveRoom >= belowRoom ? "above" : "below",
    top = Math.max(
      bounds.top,
      Math.min(
        side === "above" ? above : point.y + radius + 14,
        bounds.top + bounds.height - card.height,
      ),
    );
  return {
    left,
    top,
    side,
    pin: Math.max(16, Math.min(card.width - 16, point.x - left)),
  };
}
export function bugWander(
  seed: number,
  seconds: number,
  motion: BugMotion,
  speed = 1,
  start = { x: 0, y: 0 },
  travelScale = 1,
) {
  const sample = (index: number) => {
    let value = Math.imul(seed ^ index, 0x45d9f3b);
    value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
    return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
  };
  const duration =
    motion === "DRAG"
      ? 9
      : motion === "DART"
        ? 2.5
        : motion === "SKITTER"
          ? 3.5
          : motion === "FLY"
            ? 4
            : 6;
  const clock =
      (Math.max(0, seconds) * speed) /
      ((duration + sample(0) * 2) * travelScale),
    leg = Math.floor(clock),
    pause =
      (motion === "DART" || motion === "HOP" ? 0.25 : 0.05) +
      sample(leg * 3 + 1) * 0.25,
    rest = pause / travelScale,
    progress = Math.max(0, (clock - leg - rest) / (1 - rest)),
    blend = progress * progress * (3 - 2 * progress);
  const waypoint = (index: number) => ({
    x: index === 0 ? start.x : sample(index * 3 + 2) * 2 - 1,
    y: index === 0 ? start.y : sample(index * 3 + 3) * 2 - 1,
  });
  const from = waypoint(leg),
    to = waypoint(leg + 1);
  return {
    x: from.x + (to.x - from.x) * blend,
    y: from.y + (to.y - from.y) * blend,
    heading: Math.atan2(from.x - to.x, from.y - to.y),
    moving: progress > 0,
    dx: to.x - from.x,
    dy: to.y - from.y,
  };
}
export function regionTarget(
  slot: number,
  count: number,
  bounds: MapBounds,
  wander?: { x: number; y: number; dx: number; dy: number },
  inset = 80,
) {
  const columns = Math.min(
      6,
      Math.max(1, Math.ceil(Math.sqrt(Math.max(1, count) * 1.4))),
    ),
    rows = Math.max(1, Math.ceil(count / columns));
  const world = mapExtent(bounds),
    cellWidth = Math.min(bounds.width * 0.7, (world.width - 120) / columns),
    cellHeight = Math.min(bounds.height * 0.7, (world.height - 120) / rows),
    spanX = world.width - inset * 2,
    spanY = world.height - inset * 2,
    u = wander
      ? (wander.x + 1) / 2
      : Math.max(
          0,
          Math.min(
            1,
            0.5 + (((slot % columns) - (columns - 1) / 2) * cellWidth) / spanX,
          ),
        ),
    v = wander
      ? (wander.y + 1) / 2
      : Math.max(
          0,
          Math.min(
            1,
            0.5 +
              ((Math.floor(slot / columns) - (rows - 1) / 2) * cellHeight) /
                spanY,
          ),
        );
  return {
    x: inset + u * spanX,
    y: inset + v * spanY,
    u,
    v,
    heading: wander ? Math.atan2(-wander.dx * spanX, -wander.dy * spanY) : 0,
  };
}
