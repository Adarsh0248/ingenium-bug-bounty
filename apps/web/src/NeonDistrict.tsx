import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { circuitLayout } from "./neon-circuit";

const inks = ["#38e5ff", "#ff4ed6", "#aa87ff"];
const names = [
  "ARRAY BANK",
  "HEAP MEMORY",
  "EXECUTION TRACE",
  "CALL STACK",
  "REGISTER FILE",
];
const code = [
  "for (let i = 0; i < n; i++) {",
  "  next[i] = buffer[i] ^ mask;",
  "  trace.push(next[i]);",
  "}",
  "return checksum(next);",
];

export default function NeonDistrict({ still }: { still: boolean }) {
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
    { modules, routes } = useMemo(() => circuitLayout(w, h), [w, h]);
  return (
    <div
      ref={ref}
      className={`cybercity scene-neon neon-runtime ${still ? "city-still" : ""}`}
      data-region-scene="neon"
      aria-hidden="true"
    >
      <svg
        className="neon-circuit-map"
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
      >
        <defs>
          <pattern
            id={`${id}-grid`}
            width="32"
            height="32"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M32 0H0V32"
              fill="none"
              stroke="#213651"
              strokeWidth=".6"
            />
            <circle cx="1" cy="1" r="1" fill="#45627e" />
          </pattern>
          <radialGradient id={`${id}-board`}>
            <stop stopColor="#122442" />
            <stop offset="1" stopColor="#050c1c" />
          </radialGradient>
          <radialGradient id={`${id}-core`}>
            <stop stopColor="#2961a5" stopOpacity=".35" />
            <stop offset="1" stopColor="#1d2255" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`${id}-glass`} x2="1" y2="1">
            <stop stopColor="#122c49" />
            <stop offset="1" stopColor="#071526" />
          </linearGradient>
        </defs>
        <rect width={w} height={h} fill={`url(#${id}-board)`} />
        <rect width={w} height={h} fill={`url(#${id}-grid)`} opacity=".48" />
        <rect
          x="18"
          y="18"
          width={Math.max(0, w - 36)}
          height={Math.max(0, h - 36)}
          rx="12"
          fill="none"
          stroke="#234765"
        />
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          {routes.map((path, i) => (
            <g key={i}>
              <path d={path} stroke="#0a142a" strokeWidth="12" />
              <path
                d={path}
                stroke={inks[i % 3]}
                strokeWidth="6"
                opacity=".055"
              />
              <path
                d={path}
                stroke={inks[i % 3]}
                strokeWidth="1.4"
                opacity=".38"
              />
            </g>
          ))}
        </g>
        {modules.map((m, i) => {
          const x = m.x - m.width / 2,
            y = m.y - m.height / 2,
            c = inks[i % 3];
          return (
            <g
              key={m.address}
              className="neon-code-module"
              transform={`translate(${x} ${y})`}
            >
              <path
                d={`M12 0H${m.width - 20}l20 20V${m.height - 12}l-12 12H0V12Z`}
                fill={`url(#${id}-glass)`}
                stroke="#294963"
              />
              <path
                d={`M0 36H${m.width}M0 12V0H38M${m.width - 38} ${m.height}h38v-12`}
                stroke={c}
                fill="none"
                opacity=".75"
              />
              <circle
                className={i % 6 === 0 ? "neon-node-light" : undefined}
                cx="13"
                cy="18"
                r="2.5"
                fill={c}
                style={{ animationDelay: `${-i * 0.6}s` }}
              />
              <text x="24" y="22" fill={c} fontSize="9" letterSpacing="1.2">
                {names[m.kind]}
              </text>
              <text x="12" y={m.height - 12} fill="#597f9e" fontSize="9">
                {m.address} / {i.toString(16).padStart(2, "0").toUpperCase()}
              </text>
              {m.kind === 0 && (
                <g transform="translate(12 62)">
                  {Array.from({ length: 8 }, (_, j) => (
                    <g
                      key={j}
                      transform={`translate(${(j * (m.width - 24)) / 8} 0)`}
                    >
                      <rect
                        width={(m.width - 24) / 8 - 4}
                        height="34"
                        rx="2"
                        fill={j === 3 ? "#532550" : "#102b40"}
                        stroke={j === 3 ? "#ff4ed6" : "#315b76"}
                      />
                      <text
                        x="5"
                        y="21"
                        fill={j === 3 ? "#ffc8f4" : "#89d8ed"}
                        fontSize="10"
                      >
                        {[8, 13, 21, 34, 55, 89, 12, 24][j]}
                      </text>
                      <text x="8" y="50" fill="#537f99" fontSize="8">
                        {j}
                      </text>
                    </g>
                  ))}
                </g>
              )}
              {m.kind === 1 && (
                <g transform="translate(12 54)">
                  {Array.from({ length: 12 }, (_, j) => (
                    <rect
                      key={j}
                      x={((j % 6) * (m.width - 24)) / 6}
                      y={Math.floor(j / 6) * 30}
                      width={(m.width - 24) / 6 - 6}
                      height="23"
                      rx="2"
                      fill={j % 4 ? "#15364a" : "#402348"}
                      stroke={j % 4 ? "#2a6a82" : "#a74d9b"}
                    />
                  ))}
                  <text x="0" y="86" fontSize="10" fill="#6a9bb6">
                    alloc[256] free[64]
                  </text>
                </g>
              )}
              {m.kind === 2 && (
                <g transform="translate(12 55)" fontSize="9">
                  {code.map((line, j) => (
                    <text
                      key={line}
                      y={j * 15}
                      fill={
                        j === 0 ? "#c78df1" : j === 4 ? "#ff7acf" : "#7ec5d8"
                      }
                    >
                      {line}
                    </text>
                  ))}
                </g>
              )}
              {m.kind === 3 && (
                <g transform="translate(14 48)">
                  {["main()", "solve(n)", "scan(i)", "compare(a,b)"].map(
                    (frame, j) => (
                      <g
                        key={frame}
                        transform={`translate(${j * 5} ${j * 23})`}
                      >
                        <rect
                          width={m.width - 48 - j * 5}
                          height="20"
                          rx="2"
                          fill={j === 3 ? "#293656" : "#10263b"}
                          stroke="#345672"
                        />
                        <text
                          x="9"
                          y="14"
                          fontSize="10"
                          fill={j === 3 ? "#b697ff" : "#77b0cc"}
                        >
                          {frame}
                        </text>
                      </g>
                    ),
                  )}
                </g>
              )}
              {m.kind === 4 && (
                <g transform="translate(14 52)">
                  {Array.from({ length: 5 }, (_, j) => (
                    <g key={j} transform={`translate(0 ${j * 17})`}>
                      <text y="8" fontSize="9" fill="#76a5bc">
                        R{j}
                      </text>
                      <rect
                        x="24"
                        width={m.width - 54}
                        height="9"
                        rx="2"
                        fill="#10293e"
                      />
                      <rect
                        x="24"
                        width={(m.width - 54) * (0.2 + ((j * 13) % 7) / 10)}
                        height="9"
                        rx="2"
                        fill={j % 2 ? "#685093" : "#286d80"}
                      />
                    </g>
                  ))}
                </g>
              )}
            </g>
          );
        })}
        <g
          transform={`translate(${w / 2} ${h / 2})`}
          className="neon-runtime-core"
        >
          <circle r="230" fill={`url(#${id}-core)`} />
          <g
            className="neon-core-ring"
            fill="none"
            stroke="#8054c9"
            opacity=".5"
          >
            <circle r="164" strokeDasharray="28 20" />
            <circle r="180" strokeDasharray="2 35" strokeWidth="5" />
          </g>
          {Array.from({ length: 10 }, (_, i) => (
            <g key={i} fill="#386c86">
              <rect x={-98 + i * 21} y="-126" width="8" height="14" />
              <rect x={-98 + i * 21} y="112" width="8" height="14" />
              <rect x="-126" y={-98 + i * 21} width="14" height="8" />
              <rect x="112" y={-98 + i * 21} width="14" height="8" />
            </g>
          ))}
          <path
            d="M-96-112H90L112-90V96L96 112H-90L-112 90V-96Z"
            fill="#08182c"
            stroke="#40d9f3"
            strokeWidth="2"
          />
          <path
            d="M-82-88H72L88-72V82H-72L-88 66V-72Z"
            fill="#102c47"
            stroke="#8b55ba"
          />
          <path
            d="M-37-32H-51V-14L-61 0-51 14V32H-37M37-32H51V-14L61 0 51 14V32H37"
            fill="none"
            stroke="#63f3ff"
            strokeWidth="4"
          />
          <path
            className="neon-core-pulse"
            d="M-12-40 13 40"
            stroke="#ff5cdb"
            strokeWidth="3"
          />
          <text
            y="65"
            textAnchor="middle"
            fill="#96a5d5"
            fontSize="10"
            letterSpacing="2"
          >
            RUNTIME / CORE
          </text>
        </g>
        {Array.from({ length: 18 }, (_, i) => (
          <g
            key={i}
            className="neon-data-packet"
            style={{
              offsetPath: `path('${routes[i % routes.length]}')`,
              animationDuration: `${19 + i * 1.8}s`,
              animationDelay: `${-i * 3.7}s`,
            }}
          >
            <rect
              x="-27"
              y="-1"
              width="24"
              height="2"
              fill={inks[i % 3]}
              opacity=".24"
            />
            <rect
              x="-6"
              y="-2.5"
              width="7"
              height="5"
              rx="1"
              fill={i % 2 ? "#ff92e6" : "#99f8ff"}
            />
          </g>
        ))}
      </svg>
    </div>
  );
}
