import type { BugMotion } from "./bug-art";

export const foundryBodies: Record<BugMotion, string> = {
  FLY: "M128 49C169 49 190 78 190 111C190 150 165 175 128 175C91 175 66 150 66 111C66 78 87 49 128 49Z",
  WALK: "M128 39H174L188 62V165L175 183H81L68 165V62L82 39Z",
  HOP: "M128 70L144 59 161 73 155 104 143 115 149 159 170 187 158 211H98L86 187 107 159 113 115 101 104 95 73 112 59Z",
  SKITTER: "M128 30L177 78 185 126 162 191H94L71 126 79 78Z",
  DRAG: "M128 25H166L177 39V76L164 88 177 100V201L162 222H94L79 201V100L92 88 79 76V39L90 25Z",
  DART: "M128 17L142 67 163 93 171 58 190 145 166 177 146 163 137 198H119L110 163 90 177 66 145 85 58 93 93 114 67Z",
};
export const foundryPaint = {
  FLY: {
    paint: "#35cdb8",
    light: "#c1fff1",
    dark: "#123f48",
    accent: "#78ffcd",
    scale: 0.86,
  },
  WALK: {
    paint: "#dd514b",
    light: "#ffc4a2",
    dark: "#502936",
    accent: "#ffc05b",
    scale: 1.08,
  },
  HOP: {
    paint: "#ffd14c",
    light: "#fff5ba",
    dark: "#665434",
    accent: "#77dfff",
    scale: 0.84,
  },
  SKITTER: {
    paint: "#a47bfa",
    light: "#e4d5ff",
    dark: "#35275d",
    accent: "#f58eff",
    scale: 1,
  },
  DRAG: {
    paint: "#91ad58",
    light: "#e2e9b6",
    dark: "#3c4b36",
    accent: "#ffad62",
    scale: 1.15,
  },
  DART: {
    paint: "#519cf5",
    light: "#d2eeff",
    dark: "#1f3963",
    accent: "#8befff",
    scale: 0.94,
  },
} as const;
export type FoundryWeapon = "none" | "pulse" | "siege";
export function foundryTraits(motion: BugMotion, bounty: number, seed: number) {
  const value = Math.max(10, Math.min(1000, bounty)),
    tier = value >= 900 ? 3 : value >= 700 ? 2 : value >= 400 ? 1 : 0,
    size =
      tier === 0
        ? 0.38 + ((value - 10) / 380) * 0.22
        : tier === 1
          ? 0.78 + ((value - 400) / 290) * 0.18
          : tier === 2
            ? 1.14 + ((value - 700) / 190) * 0.24
            : 1.7 + ((value - 900) / 100) * 0.25,
    duration =
      motion === "DRAG"
        ? 9
        : motion === "DART"
          ? 2.5
          : motion === "SKITTER"
            ? 3.5
            : motion === "FLY"
              ? 4
              : 6;
  return {
    size: size * foundryPaint[motion].scale,
    speed:
      [2.8, 1.65, 1, 0.6][tier] * (duration / 6) * (0.95 + (seed % 11) / 100),
    weapon: (tier === 3
      ? "siege"
      : tier === 2
        ? "pulse"
        : "none") as FoundryWeapon,
  };
}
export function foundryAttack(
  seed: number,
  seconds: number,
  weapon: FoundryWeapon,
) {
  const cycle = (seconds + (seed % 97) * 0.37) / (8 + (seed % 5)),
    phase = (cycle - Math.floor(cycle)) * (8 + (seed % 5)) - 0.6;
  return {
    cycle: Math.floor(cycle),
    aim: Math.sin(Math.floor(cycle) * 1.7 + (seed % 61)) * 0.85,
    recoil:
      weapon !== "none" && phase >= 0 && phase < 0.22
        ? Math.sin((phase / 0.22) * Math.PI) * 0.14
        : 0,
    flash: weapon !== "none" && phase >= 0 && phase < 0.09,
    flight: weapon !== "none" && phase >= 0 && phase < 0.5 ? phase / 0.5 : -1,
    impact:
      weapon !== "none" && phase >= 0.5 && phase < 1.1
        ? (phase - 0.5) / 0.6
        : -1,
    reach: weapon === "siege" ? 5.8 : 4.3,
  };
}
export function foundryWheels(motion: BugMotion) {
  const count =
    motion === "DRAG"
      ? 4
      : motion === "SKITTER"
        ? 3
        : motion === "FLY" || motion === "DART"
          ? 0
          : 2;
  return Array.from({ length: count * 2 }, (_, i) => ({
    x: i % 2 ? 0.93 : -0.93,
    y:
      count === 4
        ? 0.82 - Math.floor(i / 2) * 0.53
        : count === 3
          ? 0.68 - Math.floor(i / 2) * 0.68
          : 0.63 - Math.floor(i / 2) * 1.4,
  }));
}
export function foundryWheelRoll(advance: number, turn: number, side: number) {
  return -(advance + turn * side) / 0.22;
}

export type FoundryPart = "body" | "jet" | "all";
const plates = new Map<string, HTMLCanvasElement>();
export function foundryPlate(
  motion: BugMotion,
  part: FoundryPart = "all",
  weapon: FoundryWeapon = "none",
) {
  const key = `${motion}:${part}:${part === "all" ? weapon : "none"}`;
  if (plates.has(key)) return plates.get(key)!;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const c = canvas.getContext("2d")!,
    flying = motion === "FLY" || motion === "DART",
    palette = foundryPaint[motion];
  c.lineJoin = "round";
  c.lineCap = "round";
  const fill = (d: string, colour: string | CanvasGradient) => {
    c.fillStyle = colour;
    c.fill(new Path2D(d));
  };
  const line = (d: string, colour: string, width = 2) => {
    c.strokeStyle = colour;
    c.lineWidth = width;
    c.stroke(new Path2D(d));
  };
  if ((part === "all" || part === "jet") && flying) {
    const flame = c.createLinearGradient(0, 158, 0, 252);
    flame.addColorStop(0, "#f4ffff");
    flame.addColorStop(0.28, "#7feaff");
    flame.addColorStop(0.65, "#ffa448c0");
    flame.addColorStop(1, "#ed632600");
    for (const x of [80, 176]) {
      fill(
        `M${x - 8} 160Q${x - 19} 200 ${x} 251Q${x + 19} 200 ${x + 8} 160Z`,
        flame,
      );
      fill(`M${x - 3} 160L${x} 218 ${x + 3} 160Z`, "#e5ffffbf");
    }
  }
  if (part !== "jet") {
    for (const wheel of foundryWheels(motion)) {
      const x = 128 + (wheel.x * 256) / 3,
        y = 128 - (wheel.y * 256) / 3;
      line(`M128 ${y}H${x}`, "#0a171d", 11);
      line(`M128 ${y}H${x}`, "#738c83", 5);
    }
    if (part === "all")
      for (const wheel of foundryWheels(motion)) {
        const x = 128 + (wheel.x * 256) / 3,
          y = 128 - (wheel.y * 256) / 3;
        c.beginPath();
        c.roundRect(x - 11, y - 20, 22, 40, 5);
        c.fillStyle = "#35454b";
        c.fill();
        c.strokeStyle = "#8a9c94";
        c.lineWidth = 1.4;
        c.stroke();
        for (let t = -13; t <= 13; t += 7) {
          c.fillStyle = "#0b1c22";
          c.fillRect(x - 8, y + t, 16, 3);
        }
      }
    const metal = c.createLinearGradient(75, 38, 180, 213);
    metal.addColorStop(0, palette.light);
    metal.addColorStop(0.18, palette.paint);
    metal.addColorStop(0.6, palette.dark);
    metal.addColorStop(1, palette.paint);
    const copper = c.createLinearGradient(85, 68, 165, 198);
    copper.addColorStop(0, palette.light);
    copper.addColorStop(0.3, palette.paint);
    copper.addColorStop(0.7, palette.dark);
    copper.addColorStop(1, palette.paint);
    if (flying)
      for (const x of [80, 176]) {
        fill(
          `M${x - 13} 96L${x - 18} 112V155L${x - 10} 167H${x + 10}L${x + 18} 155V112L${x + 13} 96Z`,
          metal,
        );
        line(
          `M${x - 11} 112H${x + 11}M${x - 11} 120H${x + 11}M${x - 10} 157H${x + 10}`,
          "#d1b385",
          3,
        );
        fill(`M${x - 8} 150H${x + 8}V160H${x - 8}Z`, "#7cdff2");
      }
    if (motion === "WALK") {
      fill("M64 25L80 18H176L192 25V54H64Z", metal);
      line("M69 27H187M73 48H183", palette.light, 2);
      for (let x = 80; x < 181; x += 19)
        line(`M${x} 26l-9 14`, x % 2 ? palette.light : "#222b32", 7);
    }
    line(foundryBodies[motion], "#050d16", 7);
    fill(foundryBodies[motion], metal);
    line(foundryBodies[motion], "#b5bcb0", 1.3);
    const body = new Path2D(foundryBodies[motion]);
    c.save();
    c.clip(body);
    if (motion === "DRAG") {
      fill("M89 32H167V72H89Z", palette.light);
      fill("M103 41H153V58H103Z", "#142b35");
      line("M111 45H145", palette.accent, 2);
      for (let y = 99; y < 201; y += 38) {
        fill(`M89 ${y}L99 ${y - 7}H157L167 ${y}V${y + 23}H89Z`, "#25352d");
        fill(`M98 ${y}H158V${y + 19}H98Z`, copper);
        line(
          `M110 ${y + 2}V${y + 16}M146 ${y + 2}V${y + 16}`,
          palette.light,
          3,
        );
      }
    } else if (motion === "DART") {
      fill("M128 29L141 86 135 154H121L115 86Z", palette.light);
      fill("M128 47L135 93 128 123 121 93Z", palette.accent);
      fill("M85 75L103 119 112 159 89 148 75 136Z", copper);
      fill("M171 75L153 119 144 159 167 148 181 136Z", copper);
      line("M80 130L101 145M176 130L155 145", palette.light, 4);
    } else if (motion === "HOP") {
      fill("M110 75H146L141 104H115Z", palette.accent);
      fill("M117 114H139V161H117Z", "#0c2633");
      line(
        "M110 73L115 108 111 163 99 188H157L145 163 141 108 146 73",
        palette.light,
        5,
      );
      line("M117 170H139M114 180H142M116 190H140", palette.dark, 4);
    } else if (motion === "FLY") {
      c.beginPath();
      c.arc(128, 110, 48, 0, Math.PI * 2);
      c.fillStyle = palette.dark;
      c.fill();
      c.strokeStyle = palette.light;
      c.lineWidth = 5;
      c.stroke();
      for (let a = 0; a < 6; a++) {
        c.save();
        c.translate(128, 110);
        c.rotate((a * Math.PI) / 3);
        fill("M-6-43H6V-32H-6Z", palette.paint);
        c.restore();
      }
      c.beginPath();
      c.arc(128, 110, 26, 0, Math.PI * 2);
      c.fillStyle = palette.accent;
      c.fill();
      c.beginPath();
      c.arc(128, 110, 16, 0, Math.PI * 2);
      c.fillStyle = "#12364c";
      c.fill();
      fill("M119 95L129 93 126 104 117 105Z", palette.light);
    } else if (motion === "SKITTER") {
      fill("M128 47L162 86 156 159 128 183 100 159 94 86Z", copper);
      fill("M128 77L154 111 128 149 102 111Z", palette.dark);
      fill("M128 88L143 111 128 134 113 111Z", palette.accent);
      line("M81 124L98 151 111 172M175 124L158 151 145 172", palette.light, 4);
      line("M115 62H119M126 59H130M137 62H141", palette.light, 3);
    } else {
      fill("M91 63H165L170 129 157 162H99L86 129Z", copper);
      fill("M104 65H152V93H104Z", "#142d35");
      line("M110 70H146", palette.accent, 3);
      line("M97 111L111 101V147M159 111L145 101V147", palette.light, 4);
    }
    for (const x of [98, 158])
      for (const y of [83, 176]) {
        c.beginPath();
        c.arc(x, y, 3, 0, Math.PI * 2);
        c.fillStyle = "#bec6b5";
        c.fill();
        line(`M${x - 1} ${y - 1}l2 2`, "#283b3c", 1);
      }
    if (motion === "WALK" || motion === "DRAG")
      for (let i = 0; i < 4; i++)
        line(`M${111 + i * 9} 187l-4 12`, i % 2 ? "#182d30" : palette.light, 4);
    c.restore();
    if (part === "all" && weapon !== "none") {
      c.beginPath();
      c.arc(128, 117, 20, 0, Math.PI * 2);
      c.fillStyle = palette.dark;
      c.fill();
      c.strokeStyle = palette.light;
      c.lineWidth = 3;
      c.stroke();
      for (const x of weapon === "siege" ? [117, 139] : [128]) {
        fill(`M${x - 5} 51H${x + 5}V119H${x - 5}Z`, "#112631");
        line(`M${x} 55V104`, palette.light, 3);
        fill(`M${x - 7} 48H${x + 7}V60H${x - 7}Z`, palette.accent);
      }
    }
  }
  plates.set(key, canvas);
  return canvas;
}
