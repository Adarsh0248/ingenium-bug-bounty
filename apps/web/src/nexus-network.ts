export function nexusNetwork(width: number, height: number) {
  const columns = Math.max(2, Math.min(8, Math.ceil(width / 840) * 2)),
    rows = Math.max(2, Math.min(6, Math.ceil(height / 720) * 2)),
    nodes = [{ x: width / 2, y: height / 2, kind: 0, parent: -1 }];
  const cells = Array.from({ length: columns * rows }, (_, i) => ({
    x: (((i % columns) + 0.5 + Math.sin(i * 7) * 0.12) * width) / columns,
    y:
      ((Math.floor(i / columns) + 0.5 + Math.cos(i * 5) * 0.12) * height) /
      rows,
    kind: i % 3,
  }))
    .filter(
      (p) =>
        Math.hypot((p.x - width / 2) / width, (p.y - height / 2) / height) >
        0.08,
    )
    .sort(
      (a, b) =>
        Math.hypot(a.x - width / 2, a.y - height / 2) -
        Math.hypot(b.x - width / 2, b.y - height / 2),
    );
  for (const cell of cells) {
    let parent = 0,
      closest = Infinity;
    for (const [i, node] of nodes.entries()) {
      const distance = Math.hypot(cell.x - node.x, cell.y - node.y);
      if (distance < closest) {
        closest = distance;
        parent = i;
      }
    }
    nodes.push({ ...cell, parent });
  }
  const links = nodes.slice(1).map((node, i) => {
    const from = nodes[node.parent],
      middle = (from.x + node.x) / 2;
    return {
      from: node.parent,
      to: i + 1,
      path: `M${from.x} ${from.y}C${middle} ${from.y} ${middle} ${node.y} ${node.x} ${node.y}`,
    };
  });
  return { nodes, links };
}
