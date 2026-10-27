import { bugAppearance } from "./bug-art";
import type { Category } from "./types";
import type { CSSProperties } from "react";
import { useLayoutEffect, useRef } from "react";
import { neonPlate } from "./neon-creatures";
import { foundryPlate } from "./foundry-creatures";
import { nexusPlate } from "./nexus-creatures";
import { zeroDayPlate } from "./zero-day-entities";

function CreatureIcon({ bug }: { bug: ReturnType<typeof bugAppearance> }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const c = ref.current!.getContext("2d")!;
    c.clearRect(0, 0, 64, 64);
    const size =
      bug.region.id !== "neon" ? Math.min(64, 24 + bug.size * 19) : 64;
    c.drawImage(
      bug.region.id === "foundry"
        ? foundryPlate(bug.motion, "all", bug.weapon)
        : bug.region.id === "verdant"
          ? nexusPlate(bug.motion)
          : bug.region.id === "cryo"
            ? zeroDayPlate(bug.motion)
            : neonPlate(bug.motion),
      (64 - size) / 2,
      (64 - size) / 2,
      size,
      size,
    );
  }, [bug.motion, bug.region.id, bug.size, bug.weapon]);
  return (
    <canvas
      ref={ref}
      width={64}
      height={64}
      className="pixel-bug-icon painted-creature-icon"
      style={
        {
          "--aura-color": bug.color,
          "--aura-blur": `${bug.rank.tier + 1}px`,
        } as CSSProperties
      }
      data-neon-creature={bug.region.id === "neon" ? bug.motion : undefined}
      data-foundry-creature={
        bug.region.id === "foundry" ? bug.motion : undefined
      }
      data-nexus-creature={bug.region.id === "verdant" ? bug.motion : undefined}
      data-zero-day-entity={bug.region.id === "cryo" ? bug.motion : undefined}
      data-motion={bug.motion}
      data-rank={bug.rank.label}
      aria-hidden="true"
    />
  );
}

export default function PixelBugIcon({
  id,
  difficulty,
  category,
  baseBounty,
}: {
  id: string;
  difficulty: number;
  category?: Category | null;
  baseBounty: number;
}) {
  return (
    <CreatureIcon bug={bugAppearance(id, difficulty, category, baseBounty)} />
  );
}
