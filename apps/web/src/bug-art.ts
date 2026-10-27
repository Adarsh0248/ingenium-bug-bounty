import { regions } from "./regions";
import type { Category } from "./types";
import { stepLength, stanceFraction } from "./bug-locomotion";
import { foundryTraits } from "./foundry-creatures";
import { nexusKinds } from "./nexus-creatures";
import { zeroDayKinds } from "./zero-day-entities";

// Original half-sprites are mirrored around one centre pixel for clean silhouettes.
const mirror = (rows: string[]) =>
  rows.map((row) => {
    const half = row.padEnd(16, ".");
    return half + [...half.slice(0, -1)].reverse().join("");
  });

export const bugSpecies = [
  {
    name: "Relay wasp",
    region: regions[0],
    scale: 0.94,
    flying: true,
    motion: "FLY",
    pixels: mirror([
      "...........a....",
      "............a...",
      ".............dd.",
      "............deea",
      "..wwww......dhaa",
      ".wbbbhww....dssa",
      ".wbbbhhww...dssa",
      "..wbbbshww..dssa",
      "...wbbbshww.ddaa",
      "....wbbbhwwdssaa",
      ".....wwbbwwdshaa",
      ".......wwwwdssaa",
      "......www..dssaa",
      ".....wbhww.ddaaa",
      "....wbbhhwwdssaa",
      "....wbbbww.dshaa",
      ".....www...dssaa",
      ".........ll.ddaa",
      "........l...dssa",
      ".......l....dhaa",
      "............ddaa",
      ".............daa",
      "..............da",
    ]),
  },
  {
    name: "Furnace scarab",
    region: regions[1],
    scale: 1.06,
    flying: false,
    motion: "WALK",
    pixels: mirror([
      "...........a....",
      "............a...",
      ".............ddd",
      "...........ddeea",
      "..........ddssaa",
      ".........dshhsaa",
      "....lllldahhssaa",
      "...l...dahsssdaa",
      "..l...dahsssddaa",
      "......dashssddaa",
      "......dassssddaa",
      "...llldashssddaa",
      "..l...dassssddaa",
      "......dassssddaa",
      "......dashssddaa",
      "......dassssddaa",
      "...llldassssddaa",
      "..l....dasssddaa",
      "........dasssdaa",
      ".......l.ddssdaa",
      "......l....dddaa",
      ".............ddd",
    ]),
  },
  {
    name: "Prism mantis",
    region: regions[2],
    scale: 1.02,
    flying: false,
    motion: "HOP",
    pixels: mirror([
      "...........a....",
      "............a...",
      ".............a..",
      "...........dddd.",
      "..........deehha",
      "...........dssaa",
      "............dssa",
      "...aaa......dssa",
      "..ahssa.....dssa",
      "..ahdss.....dsaa",
      "...d.ss.....dssa",
      ".....ss....ddssa",
      ".....sss..dshssa",
      "......sssdhssssa",
      ".......dddssasaa",
      "..........dssssa",
      ".........ldssssa",
      "........l.dssssa",
      ".......l..dssssa",
      "......l....dssaa",
      ".....l.....dssaa",
      ".....a......dssa",
      ".............dda",
      "..............da",
    ]),
  },
  {
    name: "Crystal weaver",
    region: regions[3],
    scale: 0.96,
    flying: false,
    motion: "SKITTER",
    pixels: mirror([
      "...l............",
      "....ll..........",
      "......ll........",
      "........ldddddd.",
      "..l......dhhaaaa",
      "...ll...dhsssaaa",
      ".....lldhssssaah",
      ".......dssassaaa",
      ".......dssssaahh",
      "....ll.dassssaaa",
      "..ll..ldssssssaa",
      ".......dssassaaa",
      ".......dhssssaah",
      ".....ll.ddssaaaa",
      "....l.....dddddd",
      "...l......deeeea",
      "..l.......dssaaa",
      "..........adssda",
      ".........a..ddda",
      ".........a......",
    ]),
  },
  {
    name: "Cable grub",
    region: regions[0],
    scale: 1.02,
    flying: false,
    motion: "DRAG",
    pixels: mirror([
      "..............dd",
      ".............dee",
      "............ddhh",
      "............dssa",
      "...........ddaaa",
      "..........ldsssa",
      "..........ldhhss",
      "...........ddaaa",
      ".........lldsssa",
      "..........ldhhss",
      "...........ddaaa",
      ".........lldsssa",
      "..........ldhhss",
      "...........ddaaa",
      ".........lldsssa",
      "..........ldhhss",
      "...........ddaaa",
      "..........ldsssa",
      "...........ldhhs",
      "............ddaa",
      ".............dds",
      "..............dd",
      "...............d",
    ]),
  },
  {
    name: "Arc dragonfly",
    region: regions[2],
    scale: 0.9,
    flying: true,
    motion: "DART",
    pixels: mirror([
      "..............aa",
      ".............dee",
      "..............dh",
      "..............ds",
      "...wwww.......da",
      "..wbbbhww.....da",
      "...wbbbhhww...ds",
      "....wwbbbhhww.dd",
      "......wwbbbhhwds",
      "........wwbbbwaa",
      "..........www.ds",
      "..............da",
      ".....wwww.....ds",
      "....wbbbhwww.dds",
      ".....wbbbhhwwdaa",
      "......wwbbbhhwds",
      "........wwbbbwaa",
      "..........www.ds",
      "..............da",
      "..............ds",
      "..............da",
      "..............ds",
      "..............da",
      "...............d",
    ]),
  },
] as const;

export type BugMotion = (typeof bugSpecies)[number]["motion"];
const motionLabels: Record<BugMotion, string> = {
  FLY: "Hovering flyer",
  WALK: "Walker",
  HOP: "Hopper",
  SKITTER: "Fast crawler",
  DRAG: "Slow dragger",
  DART: "Darting flyer",
};
const regionalNames = {
  neon: [
    "Relay wasp",
    "Chrome beetle",
    "Signal mantis",
    "Wire runner",
    "Cable grub",
    "Arc dragonfly",
  ],
  foundry: [
    "Ion orb",
    "Magma dozer",
    "Volt buggy",
    "Phase interceptor",
    "Bastion carrier",
    "Azure dart",
  ],
  verdant: [
    nexusKinds.FLY.name,
    nexusKinds.WALK.name,
    nexusKinds.HOP.name,
    nexusKinds.SKITTER.name,
    nexusKinds.DRAG.name,
    nexusKinds.DART.name,
  ],
  cryo: [
    zeroDayKinds.FLY.name,
    zeroDayKinds.WALK.name,
    zeroDayKinds.HOP.name,
    zeroDayKinds.SKITTER.name,
    zeroDayKinds.DRAG.name,
    zeroDayKinds.DART.name,
  ],
};
export const bountyRanks = [
  { label: "Common", minimum: 10, tier: 0, scale: 0.88 },
  { label: "Rare", minimum: 400, tier: 1, scale: 1 },
  { label: "Elite", minimum: 700, tier: 2, scale: 1.14 },
  { label: "Apex", minimum: 900, tier: 3, scale: 1.3 },
] as const;
export function bountyRank(value: number) {
  return bountyRanks[
    value >= 900 ? 3 : value >= 700 ? 2 : value >= 400 ? 1 : 0
  ];
}

export function bugPose(
  motion: BugMotion,
  progress: number,
  seed: number,
  still = false,
) {
  const rate = motion === "DART" ? 17 : 8;
  const flying = motion === "FLY" || motion === "DART",
    angle =
      progress * (flying ? rate : (Math.PI * 2) / stepLength(motion)) + seed,
    phase = still ? 0 : Math.sin(angle),
    cycle = (((angle / (Math.PI * 2)) % 1) + 1) % 1;
  return {
    lift: flying
      ? 0.09 + phase * 0.035
      : motion === "HOP"
        ? still || cycle < stanceFraction
          ? 0
          : Math.sin(
              (Math.PI * (cycle - stanceFraction)) / (1 - stanceFraction),
            ) * 0.3
        : 0,
    rock: flying ? phase * 0.035 : 0,
    stretch: motion === "DRAG" ? phase * 0.14 : 0,
    wing: flying && !still ? 0.25 + (phase + 1) * 0.45 : 0,
  };
}

export function bugAppearance(
  id: string,
  difficulty: number,
  category?: Category | null,
  baseBounty = difficulty * 10,
) {
  let seed = 0;
  for (const character of id)
    seed = (Math.imul(seed, 31) + character.charCodeAt(0)) >>> 0;
  let variety = Math.imul(seed ^ (seed >>> 16), 0x45d9f3b);
  variety = (variety ^ (variety >>> 16)) >>> 0;
  const region =
      regions.find((item) => item.category === category) ??
      regions[seed % regions.length],
    index = variety % bugSpecies.length,
    species = bugSpecies[index],
    rank = bountyRank(baseBounty),
    machine =
      region.id === "foundry"
        ? foundryTraits(species.motion, baseBounty, seed)
        : null;
  return {
    ...species,
    region,
    name: regionalNames[region.id][index],
    movement:
      region.id === "foundry"
        ? {
            FLY: "Jet hoverer",
            WALK: "Wheeled rover",
            HOP: "Light buggy",
            SKITTER: "Fast interceptor",
            DRAG: "Heavy hauler",
            DART: "Jet interceptor",
          }[species.motion]
        : region.id === "verdant"
          ? nexusKinds[species.motion].signature
          : region.id === "cryo"
            ? zeroDayKinds[species.motion].signature
            : motionLabels[species.motion],
    seed,
    rank,
    speed: machine?.speed ?? 0.75 + ((variety >>> 8) % 51) / 100,
    weapon: machine?.weapon ?? "none",
    color: region.color,
    size:
      machine?.size ??
      (region.id === "verdant"
        ? nexusKinds[species.motion].scale
        : region.id === "cryo"
          ? zeroDayKinds[species.motion].scale
          : species.scale) *
        rank.scale *
        (0.9 + Math.max(0, Math.min(100, difficulty)) / 500),
  };
}

export function bugPixels(pixels: readonly string[]) {
  const width = Math.max(...pixels.map((row) => row.length));
  return pixels.flatMap((row, y) =>
    [...row].flatMap((tone, x) =>
      tone === "."
        ? []
        : [
            {
              x,
              y,
              tone,
              part:
                tone === "l" || tone === "w" || tone === "b"
                  ? x < width / 2
                    ? "left"
                    : "right"
                  : "body",
            },
          ],
    ),
  );
}

export function bugPalette(
  region: (typeof regions)[number],
): Record<string, string> {
  return {
    d: "#11172b",
    s: region.shell,
    a: region.color,
    h: "#d6e5ef",
    e: "#fff0bf",
    l: region.limb,
    w: "#303c5f",
    b: "#80b8ce",
  };
}
