import { memo, useId } from "react";
import { regions } from "./regions";
import type { RegionId } from "./regions";

const range = (count: number) => Array.from({ length: count }, (_, i) => i);

export default memo(function CyberCity({
  still,
  region = "neon",
}: {
  still: boolean;
  region?: RegionId;
}) {
  const id = useId(),
    theme = regions.find((item) => item.id === region)!;
  return (
    <div
      className={`cybercity scene-${region} ${still ? "city-still" : ""}`}
      data-region-scene={region}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 1600 1000"
        preserveAspectRatio="xMidYMid slice"
        shapeRendering="crispEdges"
      >
        <defs>
          <linearGradient id={`${id}-sky`} x2="0" y2="1">
            <stop stopColor={theme.dark} />
            <stop offset=".62" stopColor={theme.sky} />
            <stop offset="1" stopColor={theme.dark} />
          </linearGradient>
          <linearGradient id={`${id}-fade`} x2="0" y2="1">
            <stop stopColor={theme.dark} stopOpacity="0" />
            <stop offset="1" stopColor={theme.dark} />
          </linearGradient>
          <radialGradient id={`${id}-glow`}>
            <stop stopColor={theme.color} stopOpacity=".22" />
            <stop offset="1" stopColor={theme.color} stopOpacity="0" />
          </radialGradient>
          <pattern
            id={`${id}-windows`}
            width="22"
            height="29"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M4 5h4v7H4zm11 0h3v7h-3z"
              fill={theme.color}
              opacity=".45"
            />
          </pattern>
        </defs>
        <rect width="1600" height="1000" fill={`url(#${id}-sky)`} />
        <ellipse
          cx="1080"
          cy="510"
          rx="650"
          ry="470"
          fill={`url(#${id}-glow)`}
        />
        <g fill={theme.color} opacity=".38">
          {range(55).map((i) => (
            <rect
              key={i}
              x={(i * 137 + 23) % 1600}
              y={(i * 71 + 34) % 600}
              width={i % 7 ? 2 : 4}
              height="2"
            />
          ))}
        </g>
        {region === "neon" && (
          <>
            <g fill="#dc8cc8" opacity=".45">
              {range(27).map((i) => {
                const y = i * 6 - 78,
                  half = Math.sqrt(82 ** 2 - y ** 2);
                return (
                  <rect
                    key={i}
                    x={1130 - half}
                    y={300 + y}
                    width={half * 2}
                    height="3"
                  />
                );
              })}
            </g>
            <g className="city-far" fill="#302542">
              {range(31).map((i) => {
                const x = i * 56 - 20,
                  h = 100 + ((i * 47) % 200);
                return (
                  <g key={i}>
                    <path
                      d={`M${x} 740V${680 - h}h26v-18h15v38h15v38h10v${h + 42}Z`}
                    />
                    <path
                      d={`M${x + 12} ${702 - h}v${h - 20}`}
                      stroke="#70507c"
                      strokeWidth="3"
                    />
                  </g>
                );
              })}
            </g>
            <g className="city-middle">
              {range(18).map((i) => {
                const x = i * 100 - 40,
                  h = 180 + ((i * 67) % 290),
                  w = 65 + ((i * 17) % 26);
                return (
                  <g key={i}>
                    <path
                      d={`M${x} 900V${900 - h}h${w - 14}v24h14V900Z`}
                      fill={i % 2 ? "#16162b" : "#221b35"}
                      stroke="#54405d"
                      strokeWidth="2"
                    />
                    <rect
                      x={x + 7}
                      y={935 - h}
                      width={w - 16}
                      height={h - 44}
                      fill={`url(#${id}-windows)`}
                      opacity=".65"
                    />
                    <rect
                      x={x + w - 7}
                      y={945 - h}
                      width="3"
                      height={h - 62}
                      fill={i % 2 ? "#e577c4" : "#6acedb"}
                      opacity=".65"
                    />
                    {i % 3 === 0 && (
                      <g>
                        <rect
                          x={x + 14}
                          y={955 - h}
                          width="24"
                          height="62"
                          fill="#422641"
                          stroke="#bc659e"
                          strokeWidth="2"
                        />
                        <path
                          d={`M${x + 20} ${967 - h}h12m-12 12h12m-12 12h12m-12 12h12`}
                          stroke="#f9b4da"
                          strokeWidth="3"
                        />
                      </g>
                    )}
                  </g>
                );
              })}
            </g>
            <g stroke="#87638f" fill="none" opacity=".6">
              <path d="M0 450Q800 640 1600 380M0 462Q800 650 1600 397M100 660Q760 740 1600 540" />
              <path d="M100 480v390m35-380v380" strokeWidth="3" />
            </g>
            <g className="city-billboard">
              <path
                d="M1110 475h148v145h-148z"
                fill="#21162f"
                stroke="#cc70b0"
                strokeWidth="3"
              />
              <path d="M1120 485h128v125h-128z" fill="none" stroke="#633958" />
              <text
                x="1184"
                y="512"
                textAnchor="middle"
                fill="#e8aedc"
                fontFamily="Consolas,monospace"
                fontSize="13"
                letterSpacing="3"
              >
                SIGNAL
              </text>
              <path
                d="M1136 554h16v-18h12v46h12v-60h14v78h12v-52h12v24h16"
                stroke="#f39ed5"
                strokeWidth="4"
                fill="none"
              />
            </g>
            <g className="city-train">
              <path
                d="M340 775h250l20 14v23H330v-25z"
                fill="#402947"
                stroke="#b17cb1"
                strokeWidth="2"
              />
              {range(12).map((i) => (
                <rect
                  key={i}
                  x={344 + i * 20}
                  y="785"
                  width="13"
                  height="9"
                  fill="#78dee7"
                />
              ))}
              <path d="M332 806h277" stroke="#d97cc0" strokeWidth="3" />
            </g>
            <g className="city-rain" stroke="#c9b8ed" opacity=".16">
              {range(55).map((i) => (
                <path
                  key={i}
                  d={`M${(i * 173) % 1600} ${(i * 97) % 980}l-6 26`}
                />
              ))}
            </g>
          </>
        )}
        {region === "foundry" && (
          <>
            <g className="city-far" fill="#43252b">
              {range(13).map((i) => (
                <path
                  key={i}
                  d={`M${i * 140 - 30} 900v-${170 + ((i * 67) % 180)}h45v-100h32v100h40v350Z`}
                />
              ))}
            </g>
            <g className="foundry-steam" fill="#a37a70" opacity=".17">
              {range(14).map((i) => (
                <path
                  key={i}
                  d={`M${i * 123 - 40} ${390 + ((i * 31) % 110)}h30v-22h42v-25h-56v-18h-42v24h-26v20h52z`}
                />
              ))}
            </g>
            <g stroke="#935645" strokeWidth="3" fill="#2c1b23">
              <path d="M-30 880V550l90-60 90 60 90-60 90 60 90-60 90 60v330Z" />
              <path d="M600 900V640h80V330h75v310h100v260Z" />
              <path d="M1160 900V545h90V250h58v295h220v355Z" />
              <path d="M680 330h75v40h-75zm570-80h58v36h-58z" fill="#70453d" />
              <path d="M770 530h360v350H770z" />
              <path d="M796 564h306v300H796z" fill="#1e161d" />
              <path
                className="furnace-core"
                d="M860 655h190v185H860z"
                fill="#df6e3a"
                stroke="#ffb46c"
              />
              <path d="M885 680h140v160H885z" fill="#ffbf6a" stroke="#ffdda2" />
              <path
                d="M830 625h245m-245 30h245m-215-30v215m40-215v215m40-215v215m40-215v215m40-215v215"
                stroke="#6d3c32"
                strokeWidth="9"
              />
            </g>
            <g fill={`url(#${id}-windows)`}>
              <rect x="0" y="605" width="505" height="220" />
              <rect x="1360" y="590" width="160" height="280" />
            </g>
            <g stroke="#ba7f57" fill="none" strokeWidth="7">
              <path d="M1050 520V210h370m-370 5l170 110 200-110M1185 215v250m-20-10h40v25h-40" />
              <path
                d="M70 580V430h510v270H445"
                stroke="#a27052"
                strokeWidth="14"
              />
              <path d="M112 580V480h420v220" stroke="#5d3b36" />
            </g>
            <g className="city-conveyor">
              <path d="M0 858H1600" stroke="#b47a50" strokeWidth="12" />
              {range(36).map((i) => (
                <rect
                  key={i}
                  x={i * 48}
                  y="847"
                  width="23"
                  height="14"
                  fill="#452c2a"
                  stroke="#bc875a"
                />
              ))}
            </g>
            <g className="city-embers" fill="#ffc98b">
              {range(38).map((i) => (
                <rect
                  key={i}
                  x={(i * 139) % 1600}
                  y={420 + ((i * 41) % 430)}
                  width={i % 3 ? 3 : 5}
                  height="3"
                  opacity=".6"
                />
              ))}
            </g>
            <text
              x="690"
              y="420"
              fill="#d79b6b"
              fontFamily="Consolas,monospace"
              fontSize="16"
              letterSpacing="3"
              transform="rotate(90 690 420)"
            >
              CORE // 04
            </text>
          </>
        )}
        {region === "verdant" && (
          <>
            <g className="city-far" fill="#1b3c38">
              <path d="M0 640 180 330 300 480 480 280 720 600 920 370 1190 560 1420 300 1600 540V1000H0Z" />
            </g>
            <g className="city-middle">
              {range(12).map((i) => {
                const x = i * 150 - 50,
                  y = 400 + ((i * 53) % 180);
                return (
                  <g key={i}>
                    <path
                      d={`M${x + 56} 900V${y}h20v500Z`}
                      fill="#203f3b"
                      stroke="#48785b"
                      strokeWidth="3"
                    />
                    <path
                      d={`M${x + 66} 850V${y + 80}l-55-45m55 90 55-65`}
                      fill="none"
                      stroke="#799f68"
                      strokeWidth="4"
                    />
                    {range(5).map((j) => (
                      <path
                        key={j}
                        d={`M${x - 15 + j * 17} ${y - 25 + (j % 2) * 32}h65v-20h40v36h35v30h-35v20h-90v-20h-35z`}
                        fill={j % 2 ? "#335c45" : "#244b40"}
                        stroke="#50815d"
                        strokeWidth="2"
                      />
                    ))}
                    <path
                      d={`M${x + 65} ${y + 45}v110h-26v55m26-70h38v70`}
                      stroke="#9cda8e"
                      strokeWidth="2"
                      fill="none"
                      opacity=".55"
                    />
                  </g>
                );
              })}
            </g>
            <g fill="#162f30" stroke="#61967c" strokeWidth="3">
              <path d="M1010 880V475h90v-80h92v80h94v405Z" />
              <path d="M1010 520h276m-276 90h276m-276 90h276" />
              <rect
                x="1040"
                y="555"
                width="65"
                height="80"
                fill={`url(#${id}-windows)`}
              />
              <rect
                x="1160"
                y="555"
                width="65"
                height="80"
                fill={`url(#${id}-windows)`}
              />
              <path d="M1115 450h55v300h-55z" fill="#72ac80" stroke="#a5dea1" />
            </g>
            <g
              className="city-vines"
              stroke="#70a878"
              strokeWidth="5"
              fill="none"
            >
              <path d="M0 230Q200 450 360 270T740 310T1180 230T1600 350M0 245Q200 465 360 285T740 325" />
              {range(10).map((i) => (
                <path
                  key={i}
                  d={`M${100 + i * 170} ${280 + (i % 3) * 22}v${80 + ((i * 23) % 160)}l-12 16`}
                />
              ))}
            </g>
            <g fill="#58895e">
              {range(24).map((i) => (
                <path
                  key={i}
                  d={`M${i * 73 - 30} ${290 + (i % 4) * 20}h24v12h-12v16h-12z`}
                />
              ))}
            </g>
            <path d="M0 850Q400 770 760 870T1600 840V1000H0Z" fill="#122d30" />
            <g
              className="city-river"
              stroke="#69b8a9"
              strokeWidth="3"
              opacity=".6"
            >
              <path d="M0 901h150m65 18h250m90-30h190m150 42h210m120-24h280M45 954h220m210-15h350m200 30h440" />
            </g>
            <g className="city-fireflies" fill="#c5ef9e">
              {range(32).map((i) => (
                <rect
                  key={i}
                  x={(i * 173) % 1600}
                  y={350 + ((i * 79) % 520)}
                  width="4"
                  height="4"
                />
              ))}
            </g>
          </>
        )}
        {region === "cryo" && (
          <>
            <g
              className="city-aurora"
              fill="none"
              strokeWidth="44"
              opacity=".17"
            >
              <path d="M-150 250Q330 80 750 330T1780 240" stroke="#9f8cec" />
              <path d="M-150 300Q330 130 750 380T1780 290" stroke="#7de5db" />
              <path
                d="M-150 340Q330 170 750 420T1780 330"
                stroke="#b3d8f3"
                strokeWidth="16"
              />
            </g>
            <g
              className="city-far"
              fill="#29445b"
              stroke="#5c7b91"
              strokeWidth="2"
            >
              <path d="M-40 890 150 400 315 690 480 300 740 790 1000 410 1160 660 1460 280 1640 710v300H-40Z" />
              <path
                d="m150 400-30 90 42-28 25 42zm330-100-44 110 40-40 55 46zm980-20-35 92 38-21 30 30z"
                fill="#7796ac"
                stroke="none"
              />
            </g>
            <g
              className="city-middle"
              fill="#172a40"
              stroke="#63869c"
              strokeWidth="3"
            >
              <path d="M310 900V600l70-50h110v350ZM1230 900V500h90l60 80v320Z" />
              <path d="M620 900V500l95-105h300l110 105v400Z" />
              <path d="M650 900V520l85-90h265l95 90v380Z" fill="#263e54" />
              <path
                d="M755 515h220l70 70v165l-70 70H755l-70-70V585Z"
                fill="#13273d"
                stroke="#8cb5cc"
                strokeWidth="7"
              />
              <path
                d="M790 560h150l60 60v100l-60 60H790l-60-60V620Z"
                fill="#2c4961"
              />
              <path
                d="M865 560v220m-120-110h240"
                stroke="#b6e8f3"
                strokeWidth="5"
              />
              <path d="M826 630h80v80h-80z" fill="#79b5c9" stroke="#c3f0f5" />
              <path
                d="M330 615h140m-140 25h140m780-95h130m-130 25h130"
                stroke="#a6d6e9"
              />
            </g>
            <g fill="#5c859d" stroke="#9dc1cf" strokeWidth="2">
              {range(11).map((i) => {
                const x = i * 165 - 60,
                  y = 820 - ((i * 43) % 115);
                return (
                  <path key={i} d={`M${x} 1000V${y}l28-65 38 25 25 80v180Z`} />
                );
              })}
            </g>
            <g className="city-snow" fill="#d8f5ff" opacity=".65">
              {range(48).map((i) => (
                <rect
                  key={i}
                  x={(i * 173) % 1600}
                  y={(i * 97) % 1000}
                  width={i % 3 ? 2 : 4}
                  height={i % 3 ? 2 : 4}
                />
              ))}
            </g>
          </>
        )}
        <rect y="830" width="1600" height="170" fill={`url(#${id}-fade)`} />
        <path d="M0 944H1600v9H0z" fill={theme.dark} />
        <path
          d="M0 946H1600"
          stroke={theme.color}
          opacity=".3"
          strokeWidth="2"
        />
        <g className="city-traffic" fill={theme.color} opacity=".6">
          <path d="M430 370h24v3h-24zm-20 1h12v1h-12zM1190 700h32v3h-32z" />
        </g>
      </svg>
      <div className="city-vignette" />
    </div>
  );
});
