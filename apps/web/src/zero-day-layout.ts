export function zeroDayLayout(width: number, height: number) {
  const columns = Math.max(2, Math.min(8, Math.ceil(width / 1000) * 2)),
    rows = Math.max(2, Math.min(6, Math.ceil(height / 900) * 2)),
    modules = Array.from({ length: columns * rows }, (_, i) => ({
      x: (((i % columns) + 0.5 + Math.sin(i * 3) * 0.08) * width) / columns,
      y:
        ((Math.floor(i / columns) + 0.5 + Math.cos(i * 5) * 0.08) * height) /
        rows,
      kind: i % 3,
    })).filter(
      (p) =>
        Math.hypot((p.x - width / 2) / width, (p.y - height / 2) / height) >
        0.09,
    ),
    count = Math.min(8, columns + 2),
    channels = Array.from({ length: count }, (_, i) => {
      const x = ((i + 0.5) * width) / count,
        bend = Math.min(110, width * 0.06);
      return `M${x} -30V${height * 0.28}l${i % 2 ? bend : -bend} ${height * 0.08}V${height * 0.65}l${i % 2 ? -bend : bend} ${height * 0.08}V${height + 30}`;
    });
  return { modules, channels };
}
