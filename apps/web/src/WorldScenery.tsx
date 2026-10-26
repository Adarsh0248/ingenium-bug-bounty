import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import CyberCity from "./CyberCity";
import { regions, regionField } from "./regions";
import type { RegionId } from "./regions";
import { bugAppearance } from "./bug-art";
import type { Bounty } from "./types";

export default function WorldScenery({
  region,
  still,
  bugs,
  enter,
  locked,
}: {
  region: RegionId | null;
  still: boolean;
  bugs: Bounty[];
  enter?: (region: RegionId) => void;
  locked: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) =>
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      }),
    );
    observer.observe(ref.current!);
    return () => observer.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={`world-scenery ${region ? "world-focused" : "world-overview"}`}
      data-world-view={region ?? "all"}
    >
      {region ? (
        <CyberCity region={region} still={still} />
      ) : (
        <>
          <div className="world-grid" aria-hidden="true" />
          {size.width > 0 &&
            regions.map((item, index) => {
              const count = bugs.filter(
                (bug) =>
                  !bug.claimed &&
                  bugAppearance(bug.bounty_id, bug.difficulty, bug.category)
                    .region.id === item.id,
              ).length;
              return (
                <div
                  className="world-region"
                  key={item.id}
                  data-region-tile={item.id}
                  style={
                    {
                      ...regionField(size.width, size.height, item.id),
                      "--region-color": item.color,
                    } as CSSProperties
                  }
                >
                  <CyberCity region={item.id} still={still} />
                  <button
                    className="world-region-heading"
                    type="button"
                    onClick={() => enter?.(item.id)}
                    disabled={locked || !enter}
                    aria-label={`Enter ${item.name}`}
                  >
                    <span className="region-number">0{index + 1}</span>
                    <span>
                      <strong>{item.name}</strong>
                      <small>{item.specialty}</small>
                    </span>
                    <span className="region-count">
                      {count}
                      <small>ACTIVE</small>
                    </span>
                  </button>
                  <span className="world-region-family" aria-hidden="true">
                    {item.family.toUpperCase()} TERRITORY
                  </span>
                </div>
              );
            })}
        </>
      )}
    </div>
  );
}
