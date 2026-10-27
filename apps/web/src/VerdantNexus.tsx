import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { nexusNetwork } from "./nexus-network";

const colours = ["#86f7c3", "#9b94ff", "#50d4e4"],
  labels = [
    "VISITED SET",
    "PARENT LINK",
    "BFS QUEUE",
    "EDGE INDEX",
    "TRAVERSAL CACHE",
    "LEAF BUFFER",
  ];

export default function VerdantNexus({ still }: { still: boolean }) {
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
    { nodes, links } = useMemo(() => nexusNetwork(w, h), [w, h]),
    radius = Math.min(125, w * 0.12, h * 0.2),
    pod = Math.min(76, w / 15, h / 10);
  return (
    <div
      ref={ref}
      className={`cybercity scene-verdant nexus-network ${still ? "city-still" : ""}`}
      data-region-scene="verdant"
      aria-hidden="true"
    >
      <svg
        className="nexus-map"
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
      >
        <defs>
          <radialGradient id={`${id}-floor`}>
            <stop stopColor="#153d47" />
            <stop offset="1" stopColor="#06181f" />
          </radialGradient>
          <linearGradient id={`${id}-glass`} x2="1" y2="1">
            <stop stopColor="#244e56" stopOpacity=".9" />
            <stop offset=".5" stopColor="#0b2633" stopOpacity=".92" />
            <stop offset="1" stopColor="#183840" />
          </linearGradient>
          <radialGradient id={`${id}-core`}>
            <stop stopColor="#ccffe4" />
            <stop offset=".3" stopColor="#78e8bf" />
            <stop offset=".7" stopColor="#268b82" />
            <stop offset="1" stopColor="#14303e" />
          </radialGradient>
          <pattern
            id={`${id}-substrate`}
            width="68"
            height="60"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M17 0h34l17 30-17 30H17L0 30Z"
              stroke="#2f535c"
              strokeWidth=".6"
              fill="none"
            />
            <circle cx="17" r="1.4" fill="#49737a" />
          </pattern>
        </defs>
        <rect width={w} height={h} fill={`url(#${id}-floor)`} />
        <rect
          width={w}
          height={h}
          fill={`url(#${id}-substrate)`}
          opacity=".35"
        />
        <rect
          x="16"
          y="16"
          width={Math.max(0, w - 32)}
          height={Math.max(0, h - 32)}
          rx="24"
          fill="none"
          stroke="#326369"
        />
        <g fill="none" strokeLinecap="round">
          {links.map((link, i) => (
            <g key={link.to} className="nexus-link">
              <path d={link.path} stroke="#031118" strokeWidth="17" />
              <path
                d={link.path}
                stroke={colours[i % 3]}
                strokeWidth="8"
                opacity=".07"
              />
              <path
                d={link.path}
                stroke={colours[i % 3]}
                strokeWidth="1.5"
                opacity=".45"
              />
              <path
                d={link.path}
                stroke="#517074"
                strokeWidth=".7"
                strokeDasharray="2 13"
              />
              {i % Math.ceil(links.length / 12) === 0 && (
                <path
                  className="nexus-data-pulse"
                  d={link.path}
                  pathLength="100"
                  stroke={colours[i % 3]}
                  strokeWidth="3"
                  strokeDasharray="2 98"
                  style={{
                    animationDuration: `${5 + (i % 4)}s`,
                    animationDelay: `${-i * 0.67}s`,
                  }}
                />
              )}
            </g>
          ))}
        </g>
        {nodes.slice(1).map((node, i) => {
          const r = pod * (node.kind === 1 ? 1.15 : 0.9),
            colour = colours[node.kind];
          return (
            <g
              key={i}
              className="nexus-node"
              transform={`translate(${node.x} ${node.y})`}
            >
              <ellipse
                cy={r * 0.62}
                rx={r * 1.2}
                ry={r * 0.55}
                fill="#03151b"
                opacity=".8"
              />
              <path
                d={`M${-r} ${-r * 0.48}L${-r * 0.55} ${-r * 0.86}H${r * 0.55}L${r} ${-r * 0.48}V${r * 0.48}L${r * 0.55} ${r * 0.86}H${-r * 0.55}L${-r} ${r * 0.48}Z`}
                fill={`url(#${id}-glass)`}
                stroke="#47777d"
                strokeWidth="2"
              />
              <path
                d={`M${-r} ${r * 0.15}L${-r * 0.55} ${r * 0.53}H${r * 0.55}L${r} ${r * 0.15}M${-r * 0.66} ${-r * 0.65}H${r * 0.4}`}
                stroke={colour}
                opacity=".6"
                fill="none"
              />
              {node.kind === 0 ? (
                <g fill="none" stroke={colour}>
                  <circle r={r * 0.48} strokeDasharray="6 6" />
                  <path
                    d={`M0 ${-r * 0.35}L${r * 0.35} 0 0 ${r * 0.35} ${-r * 0.35} 0Z`}
                  />
                  <circle r={r * 0.12} fill={colour} />
                </g>
              ) : node.kind === 1 ? (
                <g fill={colour} opacity=".7">
                  {[0, 1, 2].map((j) => (
                    <rect
                      key={j}
                      x={-r * 0.42 + j * r * 0.3}
                      y={-r * 0.35 + (j % 2) * r * 0.15}
                      width={r * 0.17}
                      height={r * 0.55}
                      rx="3"
                    />
                  ))}
                </g>
              ) : (
                <g stroke={colour} fill="#163c48">
                  <path
                    d={`M${-r * 0.4} ${r * 0.2}L0 ${-r * 0.3} ${r * 0.4} ${r * 0.2}`}
                    fill="none"
                  />
                  {[-1, 0, 1].map((j) => (
                    <circle
                      key={j}
                      cx={j * r * 0.4}
                      cy={j === 0 ? -r * 0.3 : r * 0.2}
                      r={r * 0.1}
                      fill={colour}
                    />
                  ))}
                </g>
              )}
              <circle
                className={i % 4 === 0 ? "nexus-node-breath" : undefined}
                cx={r * 0.64}
                cy={-r * 0.5}
                r="3"
                fill={colour}
                style={{ animationDelay: `${-i * 0.4}s` }}
              />
              <text
                x="0"
                y={r + 15}
                fill="#8cb8b8"
                fontSize={Math.max(7, pod * 0.12)}
                textAnchor="middle"
                letterSpacing="1"
              >
                {labels[i % labels.length]}
              </text>
              <text
                x="0"
                y={r + 29}
                fill="#4b8287"
                fontSize="8"
                textAnchor="middle"
              >
                N/{String(i + 1).padStart(2, "0")} · LINK ESTABLISHED
              </text>
            </g>
          );
        })}
        <g className="nexus-root" transform={`translate(${w / 2} ${h / 2})`}>
          <circle
            r={radius * 1.3}
            stroke="#3c777b"
            strokeDasharray="1 10"
            fill="#0a2531"
            strokeWidth="4"
          />
          <circle
            r={radius * 1.1}
            fill="none"
            stroke="#9eeed0"
            strokeWidth="2"
            opacity=".5"
          />
          <g className="nexus-root-orbit">
            <circle
              r={radius * 0.94}
              fill="none"
              stroke="#a59df9"
              strokeWidth="3"
              strokeDasharray="30 45 5 20"
            />
          </g>
          <circle
            className="nexus-node-breath"
            r={radius * 0.66}
            fill={`url(#${id}-core)`}
            opacity=".85"
          />
          <path
            d={`M0 ${-radius * 0.5}L${radius * 0.46} 0 0 ${radius * 0.5} ${-radius * 0.46} 0ZM0 ${-radius * 0.5}V${radius * 0.5}M${-radius * 0.46} 0H${radius * 0.46}`}
            fill="#0c343b"
            stroke="#bcffe7"
            strokeWidth="2"
          />
          <circle r={radius * 0.14} fill="#dcffef" />
          <text
            y={radius * 0.87}
            textAnchor="middle"
            fontSize={Math.max(8, radius * 0.11)}
            fill="#c9ffe6"
            letterSpacing="2"
          >
            ROOT CORE
          </text>
          <text
            y={radius * 1.6}
            textAnchor="middle"
            fontSize={Math.max(8, radius * 0.09)}
            fill="#91d2c6"
            letterSpacing="3"
          >
            VERDANT NEXUS / LIVE GRAPH
          </text>
        </g>
      </svg>
    </div>
  );
}
