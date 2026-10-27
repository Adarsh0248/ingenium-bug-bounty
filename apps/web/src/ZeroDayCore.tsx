import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { zeroDayLayout } from "./zero-day-layout";

const inks = ["#b9ff4f", "#51e5fa", "#b28aff", "#ff9d45"],
  labels = ["PROCESS ISOLATION", "ACCESS BARRIER", "RACE MONITOR"];
export default function ZeroDayCore({ still }: { still: boolean }) {
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
    { modules, channels } = useMemo(() => zeroDayLayout(w, h), [w, h]),
    r = Math.min(132, w * 0.14, h * 0.2),
    k = Math.min(91, w / 12, h / 8),
    fracture = `M${-w * 0.1} ${h * 0.25}L${w * 0.28} ${h * 0.4} ${w * 0.39} ${h * 0.37} ${w * 0.62} ${h * 0.62} ${w * 0.75} ${h * 0.58} ${w * 1.1} ${h * 0.78}`;
  return (
    <div
      ref={ref}
      className={`cybercity scene-cryo zero-day-core ${still ? "city-still" : ""}`}
      data-region-scene="cryo"
      aria-hidden="true"
    >
      <svg
        className="zero-day-map"
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
      >
        <defs>
          <radialGradient id={`${id}-floor`}>
            <stop stopColor="#162535" />
            <stop offset=".65" stopColor="#0a121c" />
            <stop offset="1" stopColor="#05090f" />
          </radialGradient>
          <linearGradient id={`${id}-glass`} x2="1" y2="1">
            <stop stopColor="#33424e" />
            <stop offset=".18" stopColor="#17232e" />
            <stop offset=".65" stopColor="#0a121c" />
            <stop offset="1" stopColor="#253441" />
          </linearGradient>
          <linearGradient id={`${id}-fracture`} x2="1" y2="1">
            <stop stopColor="#4be7e1" />
            <stop offset=".45" stopColor="#b9ff4f" />
            <stop offset="1" stopColor="#32bdd3" />
          </linearGradient>
          <linearGradient id={`${id}-barrier`}>
            <stop stopColor="#ff5a45" stopOpacity=".65" />
            <stop offset=".5" stopColor="#ff5a45" stopOpacity=".08" />
            <stop offset="1" stopColor="#ff9d45" stopOpacity=".6" />
          </linearGradient>
          <pattern
            id={`${id}-seams`}
            width="200"
            height="160"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M0 0H175L200 25V160M18 0V130L48 160M0 142H110l18-18h72"
              stroke="#2c3b48"
              strokeWidth="1"
              fill="none"
            />
            <path
              d="M185 20v25M24 130l12 12"
              stroke="#6c8897"
              strokeWidth="2"
            />
          </pattern>
        </defs>
        <rect width={w} height={h} fill={`url(#${id}-floor)`} />
        <rect width={w} height={h} fill={`url(#${id}-seams)`} opacity=".65" />
        <g fill="none" strokeLinejoin="bevel">
          <path d={fracture} stroke="#020509" strokeWidth="134" />
          <path d={fracture} stroke="#4b6874" strokeWidth="109" />
          <path d={fracture} stroke="#051c24" strokeWidth="102" />
          <path
            d={fracture}
            stroke={`url(#${id}-fracture)`}
            strokeWidth="69"
            opacity=".7"
          />
          <path d={fracture} stroke="#dcffcc" strokeWidth="2" />
          <path
            className="zero-day-fracture-flow"
            d={fracture}
            pathLength="100"
            stroke="#eaffec"
            strokeWidth="8"
            strokeDasharray=".3 1 .3 3"
          />
        </g>
        <g fill="none" strokeLinejoin="bevel">
          {channels.map((path, i) => (
            <g key={i} className="zero-day-channel">
              <path d={path} stroke="#02070d" strokeWidth="24" />
              <path
                d={path}
                stroke={inks[i % 4]}
                strokeWidth="13"
                opacity=".12"
              />
              <path
                d={path}
                stroke={inks[i % 4]}
                strokeWidth="2"
                opacity=".75"
              />
              <path
                className="zero-day-data-flow"
                d={path}
                pathLength="100"
                stroke={inks[i % 4]}
                strokeWidth="5"
                strokeDasharray=".4 3 .8 8"
                style={{
                  animationDuration: `${10 + i}s`,
                  animationDelay: `${-i * 1.3}s`,
                }}
              />
            </g>
          ))}
        </g>
        {modules.map((m, i) => {
          const c = inks[i % 4],
            wide = k * (m.kind === 1 ? 1.2 : 1);
          return (
            <g
              className="zero-day-module"
              key={i}
              transform={`translate(${m.x} ${m.y})`}
            >
              <path
                d={`M${-wide - 7} ${-k * 0.65 + 12}H${wide - 12}l19 19V${k * 0.65}l-19 19H${-wide + 12}l-19-19V${-k * 0.65 + 31}Z`}
                fill="#02070c"
              />
              <path
                d={`M${-wide} ${-k * 0.7}H${wide - 18}l18 18V${k * 0.6}l-18 18H${-wide + 18}l-18-18Z`}
                fill={`url(#${id}-glass)`}
                stroke="#5c717f"
                strokeWidth="1.2"
              />
              <path
                d={`M${-wide + 8} ${-k * 0.55}H${wide - 23}l14 14M${-wide + 12} ${k * 0.55}H${wide - 20}`}
                stroke={c}
                strokeWidth="2"
                fill="none"
              />
              {[0, 1, 2, 3].map((j) => (
                <path
                  key={j}
                  d={`M${j % 2 ? wide - 8 : -wide + 8} ${j < 2 ? -k * 0.38 : k * 0.35}h${j % 2 ? -8 : 8}`}
                  stroke="#c5d3d8"
                  strokeWidth="2"
                />
              ))}
              {m.kind === 0 ? (
                <g>
                  {[0, 1, 2, 3].map((j) => (
                    <g
                      key={j}
                      transform={`translate(${-k * 0.65 + j * k * 0.43} 0)`}
                    >
                      <path
                        d={`M0 ${-k * 0.36}h${k * 0.25}v${k * 0.7}H0Z`}
                        fill="#06151e"
                        stroke="#577988"
                      />
                      <path
                        d={`M${k * 0.06} ${-k * 0.28}v${k * 0.44}`}
                        stroke={j % 2 ? "#51e5fa" : "#b9ff4f"}
                        strokeWidth="5"
                      />
                      <path
                        d={`M${k * 0.15} ${-k * 0.28}v${k * 0.24}`}
                        stroke="#a6c8ce"
                        strokeWidth="1"
                      />
                      <text x="2" y={k * 0.27} fill="#acc0c7" fontSize="6">
                        0{j}
                      </text>
                    </g>
                  ))}
                </g>
              ) : m.kind === 1 ? (
                <g>
                  <path
                    d={`M${-wide * 0.72} ${-k * 0.33}H${wide * 0.72}V${k * 0.3}H${-wide * 0.72}Z`}
                    fill={`url(#${id}-barrier)`}
                    stroke="#ff704c"
                  />
                  <g className="zero-day-gate-scan">
                    <path
                      d={`M${-wide * 0.67} 0H${wide * 0.67}`}
                      stroke="#ffc297"
                      strokeWidth="2"
                    />
                  </g>
                  {[-1, 1].map((side) => (
                    <path
                      key={side}
                      d={`M${side * wide * 0.84} ${-k * 0.4}v${k * 0.78}`}
                      stroke="#e4a061"
                      strokeWidth="5"
                    />
                  ))}
                  <text
                    y={-k * 0.45}
                    textAnchor="middle"
                    fontSize="8"
                    fill="#ffb77c"
                    letterSpacing="2"
                  >
                    MUTEX / WAIT QUEUE
                  </text>
                </g>
              ) : (
                <g>
                  <path
                    d={`M${-k * 0.72} ${-k * 0.34}H${k * 0.72}V${k * 0.32}H${-k * 0.72}Z`}
                    fill="#07111c"
                    stroke="#4b6983"
                  />
                  <path
                    d={`M${-k * 0.62} ${k * 0.1}h${k * 0.22}v${-k * 0.3}h${k * 0.23}v${k * 0.45}h${k * 0.25}v${-k * 0.25}h${k * 0.25}v${k * 0.16}h${k * 0.25}`}
                    stroke="#60def7"
                    strokeWidth="1.5"
                    fill="none"
                  />
                  <path
                    d={`M${-k * 0.62} ${-k * 0.12}h${k * 0.16}v${k * 0.35}h${k * 0.28}v${-k * 0.5}h${k * 0.22}v${k * 0.3}h${k * 0.26}`}
                    stroke="#b28aff"
                    strokeWidth="1.5"
                    fill="none"
                  />
                  <text x={-k * 0.6} y={k * 0.53} fill="#b1c6d3" fontSize="7">
                    T0:0xA7 / T1:0x3F
                  </text>
                </g>
              )}
              <text
                y={k * 0.98}
                textAnchor="middle"
                fill="#99b6c2"
                fontSize={Math.max(7, k * 0.1)}
                letterSpacing="1.5"
              >
                {labels[m.kind]}
              </text>
              <text
                y={k * 1.15}
                textAnchor="middle"
                fill={c}
                fontSize="7"
                letterSpacing="1"
              >
                SECTOR {String(i + 1).padStart(2, "0")} / 0x
                {(4096 + i * 256).toString(16).toUpperCase()}
              </text>
            </g>
          );
        })}
        <g className="zero-day-seal" transform={`translate(${w / 2} ${h / 2})`}>
          <path
            d={`M${-r * 1.3} ${-r * 0.7}L${-r * 0.7} ${-r * 1.2}H${r * 0.7}L${r * 1.3} ${-r * 0.7}V${r * 0.7}L${r * 0.7} ${r * 1.2}H${-r * 0.7}L${-r * 1.3} ${r * 0.7}Z`}
            fill="#050c13"
            stroke="#4e6879"
            strokeWidth="3"
          />
          <circle
            r={r * 1.06}
            fill="#14212c"
            stroke="#90a8b6"
            strokeWidth="2"
          />
          <g className="zero-day-lock-ring">
            <circle
              r={r * 0.93}
              stroke="#b9ff4f"
              strokeWidth="5"
              strokeDasharray="24 13 3 13"
              fill="none"
            />
            {Array.from({ length: 8 }, (_, i) => (
              <path
                key={i}
                transform={`rotate(${i * 45})`}
                d={`M${-r * 0.06} ${-r * 0.99}H${r * 0.06}V${-r * 0.79}H${-r * 0.06}Z`}
                fill="#14212c"
                stroke="#d1e7d5"
              />
            ))}
          </g>
          <g className="zero-day-lock-inner">
            <circle
              r={r * 0.68}
              fill="none"
              stroke="#4ddbf5"
              strokeWidth="2"
              strokeDasharray="60 12 10 12"
            />
          </g>
          <path
            d={`M0 ${-r * 0.52}L${r * 0.45} ${-r * 0.26}V${r * 0.26}L0 ${r * 0.52} ${-r * 0.45} ${r * 0.26}V${-r * 0.26}Z`}
            fill="#07121a"
            stroke="#b9ff4f"
            strokeWidth="2"
          />
          <path
            d={`M${-r * 0.18} ${r * 0.06}V${-r * 0.18}Q0 ${-r * 0.43} ${r * 0.18} ${-r * 0.18}V${r * 0.06}M${-r * 0.25} ${r * 0.02}H${r * 0.25}V${r * 0.29}H${-r * 0.25}Z`}
            fill="none"
            stroke="#ddf6ec"
            strokeWidth="4"
          />
          <circle r={r * 0.035} cy={r * 0.14} fill="#ff9d45" />
          <text
            y={r * 1.4}
            textAnchor="middle"
            fill="#c5ff79"
            fontSize={Math.max(9, r * 0.105)}
            letterSpacing="2"
          >
            ENCRYPTION SEAL
          </text>
          <text
            y={r * 1.6}
            textAnchor="middle"
            fill="#7d9cae"
            fontSize="8"
            letterSpacing="1.4"
          >
            ZERO-DAY CORE / BREACH TRACE
          </text>
        </g>
      </svg>
    </div>
  );
}
