import type { BugMotion } from "./bug-art";
import { stanceFraction, stepLength } from "./bug-locomotion";

export const nexusKinds = {
  FLY: {
    name: "Fork Phantom",
    colour: "#b294ff",
    light: "#eee2ff",
    scale: 1,
    signature: "Branching echo",
    body: "M128 45L160 91 151 142 128 177 105 142 96 91Z",
  },
  WALK: {
    name: "Null Crawler",
    colour: "#d2eadb",
    light: "#ffffff",
    scale: 0.88,
    signature: "Signal suppression",
    body: "M96 48Q128 32 160 48L173 84 156 111H100L83 84Z",
  },
  HOP: {
    name: "Pulse Jumper",
    colour: "#ffc75b",
    light: "#fff3c6",
    scale: 0.78,
    signature: "Landing pulse",
    body: "M128 73C168 73 178 113 158 149L128 177 98 149C78 113 88 73 128 73Z",
  },
  SKITTER: {
    name: "Loop Warden",
    colour: "#8df5c4",
    light: "#dcfff0",
    scale: 1.08,
    signature: "Counter-flow rings",
    body: "M128 80C193 80 193 176 128 176C63 176 63 80 128 80Z",
  },
  DRAG: {
    name: "Root Leviathan",
    colour: "#65dbcf",
    light: "#d4ffab",
    scale: 1.25,
    signature: "Linked memory strands",
    body: "M128 31L170 59 166 99 144 123H112L90 99 86 59Z",
  },
  DART: {
    name: "Bitrunner",
    colour: "#57dfff",
    light: "#ecffff",
    scale: 0.7,
    signature: "Checksum wake",
    body: "M128 27L178 145 145 129 128 170 111 129 78 145Z",
  },
} satisfies Record<
  BugMotion,
  {
    name: string;
    colour: string;
    light: string;
    scale: number;
    signature: string;
    body: string;
  }
>;

export function nexusPose(
  motion: BugMotion,
  time: number,
  distance: number,
  seed: number,
  moving: boolean,
) {
  const phase = time * 2 + (seed % 31),
    cycle =
      (((distance / stepLength("HOP") + seed / (Math.PI * 2)) % 1) + 1) % 1,
    hop =
      motion === "HOP" && moving && cycle > stanceFraction
        ? Math.sin(
            (Math.PI * (cycle - stanceFraction)) / (1 - stanceFraction),
          ) * 0.3
        : 0;
  return {
    phase,
    lift:
      motion === "FLY" || motion === "DART"
        ? 0.14 + Math.sin(phase) * 0.025
        : hop,
    spread: 0.9 + (Math.sin(phase * 0.8) + 1) * 0.22,
    compression:
      motion === "HOP"
        ? 1 - hop * 0.65
        : motion === "WALK"
          ? 1 + Math.sin(distance * 5) * 0.07
          : 1,
    signal: 0.55 + (Math.sin(phase * 1.7) + 1) * 0.2,
    ripple: cycle <= stanceFraction ? cycle / stanceFraction : 1,
  };
}

export function nexusParts(
  motion: BugMotion,
  pose: ReturnType<typeof nexusPose>,
  distance: number,
) {
  const count =
    motion === "DRAG"
      ? 5
      : motion === "WALK"
        ? 4
        : motion === "FLY" || motion === "SKITTER"
          ? 3
          : 1;
  return Array.from({ length: count }, (_, i) => {
    if (motion === "FLY") {
      const angle = (i * Math.PI * 2) / 3 + Math.PI / 2;
      return {
        x: Math.cos(angle) * pose.spread * 0.52,
        y: Math.sin(angle) * pose.spread * 0.52,
        angle: -angle + Math.PI / 2,
        sx: 0.8,
        sy: 0.8,
      };
    }
    if (motion === "SKITTER")
      return {
        x: 0,
        y: 0,
        angle: pose.phase * (i % 2 ? -0.7 : 0.55) + i,
        sx: 0.85 + i * 0.27,
        sy: 0.85 + i * 0.27,
      };
    if (motion === "DRAG" || motion === "WALK")
      return {
        x:
          Math.sin(distance * 4 - i * 0.8) * (motion === "DRAG" ? 0.09 : 0.035),
        y: 0.12 - i * (motion === "DRAG" ? 0.3 : 0.24) * pose.compression,
        angle: Math.sin(distance * 4 - i * 0.8) * 0.1,
        sx: (motion === "DRAG" ? 0.85 : 0.9) - i * 0.08,
        sy: 0.75 - i * 0.06,
      };
    return {
      x: 0,
      y: motion === "DART" ? -0.62 : 0,
      angle: motion === "HOP" ? Math.sin(pose.phase) * 0.12 : 0,
      sx: motion === "HOP" ? pose.spread : 0.85,
      sy:
        motion === "HOP"
          ? pose.compression
          : 0.8 + Math.sin(pose.phase * 7) * 0.12,
    };
  });
}

export type NexusPart = "body" | "moving" | "reaction" | "all";
const plates = new Map<string, HTMLCanvasElement>();
export function nexusPlate(motion: BugMotion, part: NexusPart = "all") {
  const key = `${motion}:${part}`;
  if (plates.has(key)) return plates.get(key)!;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const c = canvas.getContext("2d")!,
    ink = nexusKinds[motion];
  c.lineCap = c.lineJoin = "round";
  const line = (path: string, colour = ink.colour, width = 2) => {
      c.strokeStyle = colour;
      c.lineWidth = width;
      c.stroke(new Path2D(path));
    },
    fill = (path: string, colour: string | CanvasGradient) => {
      c.fillStyle = colour;
      c.fill(new Path2D(path));
    },
    ring = (
      x: number,
      y: number,
      radius: number,
      colour = ink.colour,
      width = 2,
    ) => {
      c.beginPath();
      c.arc(x, y, radius, 0, Math.PI * 2);
      c.strokeStyle = colour;
      c.lineWidth = width;
      c.stroke();
    };
  if (part === "all") {
    const pose = nexusPose(motion, 0, 0, 0, false);
    for (const p of nexusParts(motion, pose, 0)) {
      c.save();
      c.translate(128 + (p.x * 256) / 3, 128 - (p.y * 256) / 3);
      c.rotate(-p.angle);
      c.scale(p.sx, p.sy);
      c.drawImage(nexusPlate(motion, "moving"), -128, -128);
      c.restore();
    }
    c.drawImage(nexusPlate(motion, "body"), 0, 0);
  } else if (part === "body") {
    const gradient = c.createLinearGradient(78, 42, 175, 176);
    gradient.addColorStop(0, "#405268");
    gradient.addColorStop(0.35, "#152f3b");
    gradient.addColorStop(0.7, "#07131f");
    gradient.addColorStop(1, ink.colour);
    c.shadowColor = ink.colour;
    c.shadowBlur = 9;
    fill(ink.body, gradient);
    line(ink.body, ink.colour, 2.4);
    c.shadowBlur = 0;
    const y =
      motion === "DRAG" || motion === "WALK"
        ? 75
        : motion === "DART"
          ? 106
          : 123;
    ring(128, y, motion === "SKITTER" ? 24 : 15, ink.light, 1.4);
    fill(`M128 ${y - 11}L137 ${y} 128 ${y + 11} 119 ${y}Z`, ink.colour);
    line(
      `M128 ${y - 20}V${y - 32}M109 ${y}H98M147 ${y}H158M128 ${y + 20}V${y + 31}`,
      ink.light,
      1,
    );
    if (motion === "DART") {
      line("M128 45L94 130 120 118M128 45L162 130 136 118");
      line("M120 145L128 156 136 145", ink.light, 3);
    } else if (motion === "FLY") {
      line(
        "M128 56V87M111 102L106 124 117 141M145 102L150 124 139 141",
        ink.light,
        1,
      );
      fill("M122 69L128 61 134 69 128 78Z", ink.colour);
    } else if (motion === "HOP") {
      line("M111 89Q91 117 113 148M145 89Q165 117 143 148", ink.light, 3);
      for (let i = 0; i < 3; i++) line(`M${117 + i * 9} 153v7`, ink.colour, 3);
    } else if (motion === "SKITTER") {
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        c.fillStyle = ink.light;
        c.fillRect(126 + Math.sin(a) * 36, 126 + Math.cos(a) * 36, 3, 3);
      }
      ring(128, 128, 37, "#4c897e", 1);
    } else {
      line("M102 63L112 52H144L154 63M98 86H111M145 86H158", ink.light, 1);
      for (let i = 0; i < 4; i++) line(`M${115 + i * 9} 94v8`, ink.colour, 2);
    }
  } else if (part === "moving") {
    c.shadowBlur = 5;
    c.shadowColor = ink.colour;
    if (motion === "SKITTER") {
      c.setLineDash([31, 12, 3, 12]);
      ring(128, 128, 62, ink.colour, 3);
      c.setLineDash([]);
      ring(128, 128, 57, "#315c5e", 1);
      for (let i = 0; i < 4; i++) {
        c.save();
        c.translate(128, 128);
        c.rotate((i * Math.PI) / 2);
        fill("M-5-68H5V-57H-5Z", ink.light);
        c.restore();
      }
    } else if (motion === "FLY") {
      fill("M128 75L155 139 128 162 101 139Z", "#20334f");
      line("M128 75L155 139 128 162 101 139Z", ink.colour, 2);
      line("M128 89V145M109 137H147", ink.light, 1);
    } else if (motion === "HOP") {
      line("M128 55L192 166H64ZM128 61L182 161H74Z", ink.colour, 3);
      for (const [x, y] of [
        [128, 55],
        [192, 166],
        [64, 166],
      ])
        ring(x, y, 7, ink.light, 2);
    } else if (motion === "DART") {
      line(
        "M103 103L128 118 153 103M110 124L128 135 146 124M118 145L128 151 138 145",
        ink.colour,
        3,
      );
      c.font = "10px monospace";
      c.textAlign = "center";
      c.fillStyle = ink.light;
      c.fillText("0x7F", 128, 175);
    } else {
      const gradient = c.createLinearGradient(90, 100, 160, 154);
      gradient.addColorStop(0, motion === "WALK" ? "#cedcd4" : "#4b8d88");
      gradient.addColorStop(0.4, "#142834");
      gradient.addColorStop(1, "#040e19");
      const path = "M96 99L128 88 160 99 167 137 147 155H109L89 137Z";
      fill(path, gradient);
      line(path, ink.colour, 1.8);
      line("M102 110H118V134H138V110H154", ink.colour, 1);
      fill("M122 113H134V126H122Z", ink.light);
      if (motion === "DRAG")
        line("M92 119H73L61 138M164 119H183L195 138", ink.colour, 2);
    }
  } else {
    if (motion === "WALK") {
      const shade = c.createRadialGradient(128, 128, 20, 128, 128, 118);
      shade.addColorStop(0, "#000710dd");
      shade.addColorStop(0.55, "#00071099");
      shade.addColorStop(1, "#00071000");
      c.fillStyle = shade;
      c.fillRect(0, 0, 256, 256);
      c.setLineDash([5, 13]);
      ring(128, 128, 82, "#bddec5", 1);
    } else if (motion === "FLY") {
      line("M128 160V124L57 62M128 124L199 62", ink.colour, 1.5);
      for (const [x, y] of [
        [57, 62],
        [199, 62],
        [128, 160],
      ])
        ring(x, y, 8, ink.colour, 2);
    } else if (motion === "DRAG") {
      line("M128 68V131L48 185M128 131L208 185M128 131V219", ink.colour, 2);
      for (const [x, y] of [
        [48, 185],
        [208, 185],
        [128, 219],
      ]) {
        ring(x, y, 9, ink.colour, 2);
        fill(`M${x - 3} ${y - 3}h6v6h-6Z`, ink.light);
      }
    } else if (motion === "DART") {
      c.font = "12px monospace";
      c.textAlign = "center";
      c.fillStyle = ink.colour;
      for (let i = 0; i < 5; i++) {
        c.globalAlpha = 1 - i * 0.16;
        c.fillText(["7F", "01", "A2", "10", "FF"][i], 128, 100 + i * 28);
      }
      c.globalAlpha = 1;
      line("M92 92V66H110M164 92V66H146", ink.colour, 1);
    } else {
      c.setLineDash(motion === "SKITTER" ? [14, 6] : [6, 12]);
      ring(128, 128, 83, ink.colour, 2);
      ring(128, 128, 61, ink.colour, 1);
      c.setLineDash([]);
      for (let i = 0; i < 6; i++) {
        c.save();
        c.translate(128, 128);
        c.rotate((i * Math.PI) / 3);
        line("M0-65V-87H10", ink.colour, 1.5);
        c.restore();
      }
    }
  }
  plates.set(key, canvas);
  return canvas;
}
