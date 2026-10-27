import { circuitLayout } from "./neon-circuit";

export function foundryLayout(width: number, height: number) {
  const { modules, routes } = circuitLayout(width, height);
  const links = modules
    .slice(0, -1)
    .filter((_, i) => i % 2 === 0)
    .slice(0, 12)
    .map((a, i) => {
      const b = modules[i * 2 + 1],
        from = { x: a.x + a.width / 2, y: a.y },
        to = { x: b.x - b.width / 2, y: b.y },
        bus = a.y === b.y ? a.y + 24 : (a.y + b.y) / 2;
      return {
        from,
        to,
        path: `M${from.x} ${from.y}h12V${bus}H${to.x - 12}V${to.y}H${to.x}`,
      };
    });
  return { modules, routes, links };
}
