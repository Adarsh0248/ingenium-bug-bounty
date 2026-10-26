import { bugAppearance, bugPalette, bugPixels } from "./bug-art";
import type { Category } from "./types";

export default function PixelBugIcon({
  id,
  difficulty,
  category,
}: {
  id: string;
  difficulty: number;
  category?: Category | null;
}) {
  const bug = bugAppearance(id, difficulty, category),
    palette = bugPalette(bug.region);
  return (
    <svg
      className="pixel-bug-icon"
      viewBox={`0 0 ${Math.max(...bug.pixels.map((row) => row.length))} ${bug.pixels.length}`}
      aria-hidden="true"
      shapeRendering="crispEdges"
    >
      {bugPixels(bug.pixels).map((pixel) => (
        <rect
          key={`${pixel.x}:${pixel.y}`}
          x={pixel.x}
          y={pixel.y}
          width="1"
          height="1"
          fill={palette[pixel.tone]}
        />
      ))}
    </svg>
  );
}
