export function circuitLayout(width: number, height: number) {
  const columns = Math.max(2, Math.min(8, Math.ceil(width / 440))),
    rows = Math.max(1, Math.min(6, Math.ceil(height / 360))),
    cellWidth = width / columns,
    cellHeight = height / rows;
  const modules = Array.from({ length: columns * rows }, (_, i) => ({
    x: ((i % columns) + 0.5) * cellWidth,
    y: (Math.floor(i / columns) + 0.5) * cellHeight,
    width: Math.min(280, cellWidth * 0.76),
    height: Math.min(184, cellHeight * 0.6),
    kind: i % 5,
    address: `0x${(0x1000 + i * 256).toString(16).toUpperCase()}`,
  })).filter(
    (m) =>
      Math.abs(m.x - width / 2) >= 126 + m.width / 2 ||
      Math.abs(m.y - height / 2) >= 126 + m.height / 2,
  );
  const routes = [
    ...Array.from({ length: rows }, (_, i) => {
      const y = (i + 0.16) * cellHeight;
      return `M20 ${y}H${width * 0.32}l18 18H${width * 0.67}l18-18H${width - 20}`;
    }),
    ...Array.from({ length: columns }, (_, i) => {
      const x = (i + 0.13) * cellWidth;
      return `M${x} 20V${height * 0.32}l18 18V${height * 0.7}l-18 18V${height - 20}`;
    }),
  ];
  return { modules, routes };
}
