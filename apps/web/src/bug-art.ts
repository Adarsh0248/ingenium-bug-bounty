import { regions } from "./regions";
import type { Category } from "./types";

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
] as const;

export function bugAppearance(
  id: string,
  difficulty: number,
  category?: Category | null,
) {
  let seed = 0;
  for (const character of id)
    seed = (Math.imul(seed, 31) + character.charCodeAt(0)) >>> 0;
  const assigned = bugSpecies.find((item) => item.region.category === category);
  const species = assigned ?? bugSpecies[seed % bugSpecies.length];
  return {
    ...species,
    seed,
    color: species.region.color,
    size: species.scale * (0.82 + Math.max(0, Math.min(100, difficulty)) / 340),
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
