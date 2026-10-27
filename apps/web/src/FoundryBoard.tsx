import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { foundryLayout } from "./foundry-circuit";

const names = [
  "DIMM / BUFFER",
  "SECURE I/O",
  "POWER / VRM",
  "PCIe / BUS",
  "NETWORK / PHY",
];
const hex = ["7F A2 9C", "D8 31 E0", "4B F6 82", "A9 0D C4"];

export default function FoundryBoard({ still }: { still: boolean }) {
  const id = useId(),
    ref = useRef<HTMLDivElement>(null),
    [size, setSize] = useState({ width: 1600, height: 1000 });
  useLayoutEffect(() => {
    const observer = new ResizeObserver(([entry]) =>
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      }),
    );
    observer.observe(ref.current!);
    return () => observer.disconnect();
  }, []);
  const { width: w, height: h } = size,
    { modules, routes, links } = useMemo(() => foundryLayout(w, h), [w, h]);
  return (
    <div
      ref={ref}
      className={`cybercity scene-foundry foundry-board ${still ? "city-still" : ""}`}
      data-region-scene="foundry"
      aria-hidden="true"
    >
      <svg
        className="foundry-pcb"
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
      >
        <defs>
          <pattern
            id={`${id}-vias`}
            width="48"
            height="48"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M0 8H18L32 22V48M48 8H37L23 0"
              stroke="#48745e"
              strokeWidth=".7"
              fill="none"
            />
            <circle
              cx="18"
              cy="8"
              r="2.5"
              fill="#0e2623"
              stroke="#857b47"
              strokeWidth=".7"
            />
          </pattern>
          <radialGradient id={`${id}-pcb`}>
            <stop stopColor="#244c3d" />
            <stop offset="1" stopColor="#071d1a" />
          </radialGradient>
          <linearGradient id={`${id}-metal`} x2="1" y2="1">
            <stop stopColor="#526764" />
            <stop offset=".3" stopColor="#203637" />
            <stop offset="1" stopColor="#0d2025" />
          </linearGradient>
          <linearGradient id={`${id}-gold`}>
            <stop stopColor="#b0773d" />
            <stop offset=".5" stopColor="#f4ce7d" />
            <stop offset="1" stopColor="#906334" />
          </linearGradient>
        </defs>
        <rect width={w} height={h} fill={`url(#${id}-pcb)`} />
        <rect width={w} height={h} fill={`url(#${id}-vias)`} opacity=".3" />
        <rect
          x="16"
          y="16"
          width={Math.max(0, w - 32)}
          height={Math.max(0, h - 32)}
          rx="14"
          fill="none"
          stroke="#749172"
          strokeWidth="2"
        />
        {[
          [34, 34],
          [w - 34, 34],
          [34, h - 34],
          [w - 34, h - 34],
        ].map(([x, y], i) => (
          <g key={i} transform={`translate(${x} ${y})`}>
            <circle r="11" fill="#162c2b" stroke="#829084" strokeWidth="4" />
            <path d="M-4-4 4 4M-4 4 4-4" stroke="#071615" strokeWidth="2" />
          </g>
        ))}
        <g fill="none" stroke="#ab7b48" strokeWidth="1.1" opacity=".3">
          {routes.map((path, i) => (
            <path key={i} d={path} />
          ))}
        </g>
        <g fill="none" strokeLinejoin="round">
          {links.map((link, i) => (
            <g key={i}>
              <path d={link.path} stroke="#061715" strokeWidth="11" />
              <path d={link.path} stroke="#b8894c" strokeWidth="4" />
              <path
                d={link.path}
                stroke="#f3cb80"
                strokeWidth="1"
                opacity=".7"
              />
            </g>
          ))}
        </g>
        {modules.map((m, i) => {
          const x = m.x - m.width / 2,
            y = m.y - m.height / 2;
          return (
            <g
              key={m.address}
              className="foundry-component"
              transform={`translate(${x} ${y})`}
            >
              <rect
                x="-7"
                y="-7"
                width={m.width + 14}
                height={m.height + 14}
                rx="5"
                fill="#0b2521"
                stroke="#58745b"
              />
              {Array.from({ length: 8 }, (_, j) => (
                <g key={j} fill={`url(#${id}-gold)`}>
                  <rect
                    x={13 + (j * (m.width - 26)) / 8}
                    y="-9"
                    width="8"
                    height="14"
                  />
                  <rect
                    x={13 + (j * (m.width - 26)) / 8}
                    y={m.height - 4}
                    width="8"
                    height="14"
                  />
                </g>
              ))}
              <rect
                width={m.width}
                height={m.height}
                rx="4"
                fill={`url(#${id}-metal)`}
                stroke="#74968c"
              />
              <path d={`M0 30H${m.width}`} stroke="#5b766b" />
              <text
                x="12"
                y="19"
                fill="#e5ba79"
                fontSize="10"
                letterSpacing="1"
              >
                {names[m.kind]}
              </text>
              <circle
                className={i % 5 === 0 ? "foundry-status-led" : undefined}
                cx={m.width - 14}
                cy="15"
                r="3"
                fill="#9ee7ab"
              />
              <svg
                x="0"
                y="32"
                width={m.width}
                height={Math.max(1, m.height - 50)}
                viewBox={`0 32 ${m.width} 112`}
                preserveAspectRatio="none"
              >
                {m.kind === 0 ? (
                  <g>
                    {Array.from({ length: 3 }, (_, j) => (
                      <g key={j}>
                        <rect
                          x="14"
                          y={44 + j * 30}
                          width={m.width - 28}
                          height="22"
                          rx="2"
                          fill="#0a191c"
                          stroke="#a68e55"
                        />
                        {Array.from({ length: 6 }, (_, k) => (
                          <rect
                            key={k}
                            x={20 + (k * (m.width - 40)) / 6}
                            y={48 + j * 30}
                            width={(m.width - 40) / 6 - 5}
                            height="14"
                            fill="#314e43"
                          />
                        ))}
                      </g>
                    ))}
                  </g>
                ) : m.kind === 1 ? (
                  <g>
                    {Array.from({ length: 8 }, (_, j) => (
                      <g
                        key={j}
                        transform={`translate(${24 + ((j % 4) * (m.width - 38)) / 4} ${57 + Math.floor(j / 4) * 40})`}
                      >
                        <rect
                          x="-10"
                          y="-12"
                          width="24"
                          height="28"
                          rx="3"
                          fill="#0c171c"
                          stroke="#aa834c"
                        />
                        <rect
                          x="-4"
                          y="-6"
                          width="12"
                          height="16"
                          fill="#cf9b58"
                        />
                      </g>
                    ))}
                  </g>
                ) : m.kind === 2 ? (
                  <g>
                    {Array.from({ length: 8 }, (_, j) => (
                      <g
                        key={j}
                        transform={`translate(${25 + ((j % 4) * (m.width - 40)) / 4} ${61 + Math.floor(j / 4) * 46})`}
                      >
                        <circle
                          r="14"
                          fill="#14292a"
                          stroke="#708c7d"
                          strokeWidth="3"
                        />
                        <ellipse cy="-3" rx="10" ry="8" fill="#8faaa0" />
                        <path d="M-5-3H5M0-8V2" stroke="#455a51" />
                      </g>
                    ))}
                  </g>
                ) : m.kind === 3 ? (
                  <g>
                    {[57, 102].map((y) => (
                      <g key={y}>
                        <rect
                          x="14"
                          y={y}
                          width={m.width - 28}
                          height="24"
                          rx="2"
                          fill="#bc9c57"
                          stroke="#edce89"
                        />
                        {Array.from({ length: 20 }, (_, j) => (
                          <rect
                            key={j}
                            x={20 + (j * (m.width - 40)) / 20}
                            y={y + 5}
                            width="3"
                            height="14"
                            fill="#0b201e"
                          />
                        ))}
                      </g>
                    ))}
                  </g>
                ) : (
                  <g>
                    <rect
                      x="19"
                      y="49"
                      width={m.width - 38}
                      height="82"
                      rx="5"
                      fill="#17272b"
                      stroke="#79968a"
                      strokeWidth="3"
                    />
                    <rect
                      x="33"
                      y="62"
                      width={m.width - 66}
                      height="50"
                      fill="#071719"
                      stroke="#a77c47"
                    />
                    {Array.from({ length: 8 }, (_, j) => (
                      <rect
                        key={j}
                        x={42 + (j * (m.width - 87)) / 8}
                        y="68"
                        width="5"
                        height="18"
                        fill="#dab373"
                      />
                    ))}
                    <text x="35" y="103" fill="#8bc9aa" fontSize="9">
                      LINK / AES-256
                    </text>
                  </g>
                )}
              </svg>
              <text x="12" y={m.height - 12} fill="#8ea58b" fontSize="9">
                {m.address} · AUTH BUS
              </text>
              {[0, m.width].map((px, j) => (
                <g
                  key={j}
                  className="foundry-port"
                  transform={`translate(${px} ${m.height / 2})`}
                >
                  <circle
                    r="7"
                    fill="#0b1b19"
                    stroke="#d7a15e"
                    strokeWidth="2"
                  />
                  <circle r="2.5" fill="#a4edb8" />
                </g>
              ))}
            </g>
          );
        })}
        <g className="foundry-cpu" transform={`translate(${w / 2} ${h / 2})`}>
          <rect
            x="-120"
            y="-120"
            width="240"
            height="240"
            rx="8"
            fill="#0b1c1f"
            stroke="#ac894e"
            strokeWidth="5"
          />
          {Array.from({ length: 12 }, (_, i) => (
            <g key={i} fill="#57766b">
              <rect x={-108 + i * 18} y="-133" width="8" height="13" />
              <rect x={-108 + i * 18} y="120" width="8" height="13" />
            </g>
          ))}
          {Array.from({ length: 17 }, (_, i) => (
            <path
              key={i}
              d={`M${-102 + i * 12}-103V103`}
              stroke={i % 2 ? "#54716a" : "#283e3c"}
              strokeWidth="7"
            />
          ))}
          <circle r="86" fill="#0d2426" stroke="#98a69a" strokeWidth="5" />
          <g
            className="foundry-fan"
            fill="#58756f"
            stroke="#8da79a"
            strokeWidth="1.5"
          >
            {Array.from({ length: 6 }, (_, i) => (
              <path
                key={i}
                transform={`rotate(${i * 60})`}
                d="M-12-13Q-69-55-40-68Q-5-83 14-28L9-11Z"
              />
            ))}
          </g>
          <circle r="24" fill="#203c38" stroke="#d9a55c" strokeWidth="3" />
          <text
            textAnchor="middle"
            y="4"
            fill="#ffd497"
            fontSize="10"
            fontWeight="bold"
          >
            E / 04
          </text>
          <rect
            x="-109"
            y="96"
            width="218"
            height="30"
            rx="2"
            fill="#0b1d1c"
            stroke="#6e8365"
          />
          <text
            textAnchor="middle"
            y="115"
            fill="#e3ba80"
            fontSize="10"
            letterSpacing="1"
          >
            HIVE / SECURE PROCESSOR
          </text>
        </g>
        {links.map((link, i) => (
          <g
            key={i}
            className="foundry-data-packet"
            style={{
              offsetPath: `path('${link.path}')`,
              animationDuration: `${12 + i * 1.7}s`,
              animationDelay: `${-i * 4.1}s`,
            }}
          >
            <rect
              x="-25"
              y="-9"
              width="50"
              height="18"
              rx="3"
              fill="#102e29"
              stroke="#e4bb76"
              strokeWidth=".8"
            />
            <path d="M-19-3h5v6h-5z" fill="#9cf5c6" />
            <text x="-10" y="3" fill="#ffe4a6" fontSize="7">
              {hex[i % 4]}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
