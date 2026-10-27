import type { BugMotion } from "./bug-art";
import { stanceFraction, stepLength } from "./bug-locomotion";

export const zeroDayKinds = {
  FLY: {
    name: "Spectre",
    colour: "#55e9f3",
    accent: "#a2d5dd",
    light: "#e5ffff",
    scale: 0.88,
    signature: "Phased scan echoes",
    body: "M137 24L152 89 139 119 146 169 116 211 105 153 115 108 105 69Z",
  },
  WALK: {
    name: "Rootkit",
    colour: "#bbf36a",
    accent: "#8baf96",
    light: "#e9f9dc",
    scale: 1.12,
    signature: "Articulated ground scanner",
    body: "M92 68H154L181 94 169 143 143 169H99L76 143 82 91Z",
  },
  HOP: {
    name: "Deadlock",
    colour: "#ffa15b",
    accent: "#718b9e",
    light: "#ffdfad",
    scale: 1.25,
    signature: "Opposing lock frames",
    body: "M112 67H151L159 83V161L144 176H104L97 151V86Z",
  },
  SKITTER: {
    name: "Racewire",
    colour: "#f96c75",
    accent: "#45def4",
    light: "#f3fbff",
    scale: 0.73,
    signature: "Interleaved signal bursts",
    body: "M139 28L153 68 143 102 149 157 119 204 107 158 116 111 101 76Z",
  },
  DRAG: {
    name: "Heap Eater",
    colour: "#ad96ff",
    accent: "#6cf6c2",
    light: "#e9e7ff",
    scale: 1.3,
    signature: "Contracting memory intake",
    body: "M99 39H151L174 65V105L152 128H101L83 106V63Z",
  },
  DART: {
    name: "Kernel Wraith",
    colour: "#a5ff4d",
    accent: "#71bce5",
    light: "#edffe0",
    scale: 0.96,
    signature: "Assembling blade fragments",
    body: "M144 21L156 62 141 104 151 139 121 221 112 159 97 127 116 84 108 53Z",
  },
} satisfies Record<
  BugMotion,
  {
    name: string;
    colour: string;
    accent: string;
    light: string;
    scale: number;
    signature: string;
    body: string;
  }
>;

export function zeroDayPose(
  motion: BugMotion,
  time: number,
  distance: number,
  seed: number,
  moving: boolean,
) {
  const phase = time * (motion === "DART" ? 3.4 : 2.2) + (seed % 19),
    cycle =
      (((distance / stepLength("HOP") + seed / (Math.PI * 2)) % 1) + 1) % 1,
    surge =
      motion === "HOP" && moving && cycle > stanceFraction
        ? Math.sin(
            (Math.PI * (cycle - stanceFraction)) / (1 - stanceFraction),
          ) * 0.11
        : 0;
  return {
    phase,
    cycle,
    lift:
      motion === "FLY" || motion === "DART"
        ? 0.11 + Math.sin(phase) * 0.02
        : surge,
    wing: 0.08 + (Math.sin(phase) + 1) * 0.22,
    squash: 1,
    wave: Math.sin(distance * 4) * 0.06,
    ripple: cycle <= stanceFraction ? cycle / stanceFraction : 1,
  };
}
export function zeroDayLegs() {
  return [-1, 1].flatMap((side) =>
    [-1, 1].map((row, index) => ({
      hip: { x: side * 0.32, y: row * 0.38 },
      home: { x: side * 0.91, y: row * 0.68 },
      upper: 0.51,
      lower: 0.58,
      bend: side * row,
      side,
      offset: ((index + (side > 0 ? 1 : 0)) % 2) * 0.5,
    })),
  );
}
export function zeroDayParts(
  motion: BugMotion,
  pose: ReturnType<typeof zeroDayPose>,
  distance: number,
) {
  const count =
    motion === "DRAG"
      ? 5
      : motion === "DART"
        ? 4
        : motion === "FLY"
          ? 3
          : motion === "HOP" || motion === "SKITTER"
            ? 2
            : 1;
  return Array.from({ length: count }, (_, i) => {
    if (motion === "DRAG")
      return {
        x: Math.sin(distance * 4 - i * 0.65) * 0.09,
        y: -0.24 - i * 0.28 + Math.cos(distance * 4 - i * 0.65) * 0.04,
        angle: Math.sin(distance * 4 - i * 0.65) * 0.07,
        sx: 0.85 - i * 0.07,
        sy: 0.82 - i * 0.06,
      };
    if (motion === "FLY" || motion === "DART") {
      const side = i % 2 ? 1 : -1,
        spread =
          motion === "DART"
            ? 0.22 + (0.5 + Math.sin(pose.phase) * 0.5) * 0.3
            : 0.2;
      return {
        x: side * spread,
        y: 0.4 - i * 0.38,
        angle: side * (0.13 + Math.sin(pose.phase - i * 0.8) * 0.1),
        sx: 0.5 - i * 0.055,
        sy: 0.75 - i * 0.08,
      };
    }
    if (motion === "SKITTER")
      return {
        x: (i ? 1 : -1) * (0.27 + Math.sin(pose.phase + i * Math.PI) * 0.05),
        y: Math.sin(pose.phase + i * Math.PI) * 0.11,
        angle: (i ? 1 : -1) * 0.06,
        sx: i ? -0.75 : 0.75,
        sy: 1,
      };
    if (motion === "HOP")
      return {
        x: (i ? 1 : -1) * (0.35 + Math.sin(pose.phase) * 0.07),
        y: (i ? 1 : -1) * 0.06,
        angle: (i ? 1 : -1) * (0.06 + Math.sin(pose.phase) * 0.04),
        sx: i ? -0.9 : 0.9,
        sy: 0.95,
      };
    return { x: 0.08, y: -0.1, angle: -distance * 0.55, sx: 0.58, sy: 0.58 };
  });
}

export type ZeroDayPart =
  "body" | "moving" | "leftWing" | "rightWing" | "reaction" | "all";
const plates = new Map<string, HTMLCanvasElement>();
export function zeroDayPlate(motion: BugMotion, part: ZeroDayPart = "all") {
  const key = `${motion}:${part}`;
  if (plates.has(key)) return plates.get(key)!;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const c = canvas.getContext("2d")!,
    ink = zeroDayKinds[motion];
  c.lineJoin = "bevel";
  c.lineCap = "butt";
  const fill = (d: string, colour: string | CanvasGradient) => {
      c.fillStyle = colour;
      c.fill(new Path2D(d));
    },
    line = (d: string, colour = ink.colour, width = 1.3) => {
      c.strokeStyle = colour;
      c.lineWidth = width;
      c.stroke(new Path2D(d));
    },
    ring = (
      x: number,
      y: number,
      r: number,
      colour = ink.colour,
      width = 1,
    ) => {
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.strokeStyle = colour;
      c.lineWidth = width;
      c.stroke();
    },
    metal = c.createLinearGradient(80, 35, 173, 176);
  metal.addColorStop(0, "#8294a0");
  metal.addColorStop(0.17, "#30424f");
  metal.addColorStop(0.36, "#121f2a");
  metal.addColorStop(0.64, "#050c13");
  metal.addColorStop(0.86, "#2d414f");
  metal.addColorStop(1, "#596c78");
  if (part === "all") {
    if (motion === "DRAG") {
      c.translate(128, 113);
      c.scale(0.86, 0.86);
      c.translate(-128, -128);
    }
    if (motion === "WALK")
      for (const leg of zeroDayLegs()) {
        const x = 128 + (leg.hip.x * 256) / 3,
          y = 128 - (leg.hip.y * 256) / 3,
          fx = 128 + (leg.home.x * 256) / 3,
          fy = 128 - (leg.home.y * 256) / 3,
          d = `M${x} ${y}L${(x + fx) / 2 + leg.side * 15} ${(y + fy) / 2} ${fx} ${fy}`;
        line(d, "#0a1520", 12);
        line(d, "#81949d", 7);
        line(d, ink.colour, 1.5);
        fill(`M${fx - 4} ${fy - 4}h8v8h-8Z`, ink.light);
      }
    if (motion === "FLY" || motion === "DART")
      for (const wing of ["leftWing", "rightWing"] as const)
        c.drawImage(zeroDayPlate(motion, wing), 0, 0);
    if (motion === "WALK") c.drawImage(zeroDayPlate(motion, "body"), 0, 0);
    for (const p of zeroDayParts(
      motion,
      zeroDayPose(motion, 0, 0, 0, false),
      0,
    )) {
      c.save();
      c.translate(128 + (p.x * 256) / 3, 128 - (p.y * 256) / 3);
      c.rotate(-p.angle);
      c.scale(p.sx, p.sy);
      c.drawImage(zeroDayPlate(motion, "moving"), -128, -128);
      c.restore();
    }
    if (motion !== "WALK") c.drawImage(zeroDayPlate(motion, "body"), 0, 0);
  } else if (part === "leftWing" || part === "rightWing") {
    if (part === "rightWing") {
      c.translate(256, 0);
      c.scale(-1, 1);
    }
    const path =
      motion === "FLY"
        ? "M100 43L92 109 65 166 41 191 59 125 64 71Z"
        : "M99 51L84 110 98 143 62 188 72 131 44 110 66 74Z";
    fill(path, metal);
    line(path, "#7797a5", 1.6);
    line(
      motion === "FLY" ? "M91 56L80 110 53 171" : "M88 64L58 107 83 133 69 169",
      ink.colour,
      2,
    );
    line("M71 88L65 107M59 138L55 149", ink.light, 1);
    c.font = "7px monospace";
    c.fillStyle = ink.accent;
    c.fillText(motion === "FLY" ? "PHASE" : "K-0", 69, 118);
  } else if (part === "body") {
    c.shadowColor = ink.colour;
    c.shadowBlur = 4;
    fill(ink.body, metal);
    line(ink.body, "#91a4af", 1.8);
    c.shadowBlur = 0;
    if (motion === "FLY" || motion === "DART") {
      fill(
        motion === "FLY"
          ? "M137 43L141 91 129 120 135 163 119 192 116 151 125 108 116 69Z"
          : "M142 42L143 62 128 109 138 137 122 188 123 150 109 124 128 82 120 56Z",
        "#08131d",
      );
      line(
        motion === "FLY"
          ? "M135 46L132 91 124 114 126 156 119 180"
          : "M139 48L124 105 130 137 121 178",
        ink.colour,
        2,
      );
      line("M117 104L132 109M118 132L132 137", ink.light, 1);
      c.font = "7px monospace";
      c.fillStyle = ink.accent;
      c.save();
      c.translate(144, 108);
      c.rotate(Math.PI / 2);
      c.fillText(motion === "FLY" ? "RX / ECHO" : "0x00 KERNEL", 0, 0);
      c.restore();
    } else if (motion === "WALK") {
      fill("M94 81H149L166 98 155 139 139 153H104L90 136Z", "#101f2b");
      fill("M97 87H130V99H97Z", "#051116");
      line("M99 91H126", ink.colour, 3);
      fill("M141 91L158 103 149 120 137 108Z", "#5d737c");
      line("M146 96L153 103 148 112", ink.light, 1);
      for (let i = 0; i < 5; i++)
        line(`M${97 + i * 6} 117v22`, i % 2 ? "#688f8d" : "#243e42", 2);
      line("M87 105L85 134 102 157H130M159 82L171 96", ink.colour, 1);
      c.font = "6px monospace";
      c.fillStyle = ink.light;
      c.fillText("ROOT / 04", 110, 146);
    } else if (motion === "HOP") {
      fill("M119 79H143V162H112V92Z", "#06131a");
      line("M124 84V158", ink.colour, 3);
      line("M135 94V148", "#5ce5ef", 1.5);
      for (let i = 0; i < 4; i++)
        line(`M117 ${102 + i * 13}H140`, ink.light, 1);
      c.font = "6px monospace";
      c.fillStyle = ink.accent;
      c.save();
      c.translate(148, 112);
      c.rotate(Math.PI / 2);
      c.fillText("CONTENTION", 0, 0);
      c.restore();
    } else if (motion === "SKITTER") {
      fill(
        "M136 46L143 69 132 105 138 154 121 180 119 154 125 107 113 77Z",
        "#0a1520",
      );
      line("M135 52L134 88 125 108 129 148 120 172", ink.accent, 2);
      line("M145 77L136 102M139 143L132 162", ink.colour, 2);
      for (let i = 0; i < 5; i++)
        line(`M${115 + (i % 2) * 8} ${111 + i * 8}h7`, ink.light, 0.8);
    } else {
      fill("M104 53H145L160 69V99L145 113H108L96 98V66Z", "#050b12");
      line("M108 60H142L152 71V95L142 105H111L104 95V70Z", ink.accent, 1.6);
      fill("M113 69H140V94H113Z", "#152d34");
      line("M116 72H137V90H116Z", ink.light, 1);
      for (let i = 0; i < 3; i++) line(`M${117 + i * 8} 76v10`, ink.colour, 2);
      line("M90 69V97L104 116M163 63V97", ink.colour, 1);
      c.font = "6px monospace";
      c.fillStyle = ink.light;
      c.fillText("HEAP / ALLOC", 107, 121);
    }
    for (const [x, y] of [
      [111, 64],
      [143, 73],
      [111, 151],
    ]) {
      c.fillStyle = "#b3c3c9";
      c.fillRect(x, y, 2, 2);
    }
  } else if (part === "moving") {
    if (motion === "WALK") {
      c.fillStyle = "#092119";
      c.beginPath();
      c.moveTo(128, 128);
      c.arc(128, 128, 44, -0.6, 0.6);
      c.closePath();
      c.fill();
      ring(128, 128, 42, "#5a7480", 2);
      c.setLineDash([6, 11]);
      ring(128, 128, 35, ink.colour, 2);
      c.setLineDash([]);
      line("M128 128L164 106M128 128L164 150", ink.colour, 1);
      fill("M123 123h10v10h-10Z", ink.light);
    } else if (motion === "HOP") {
      const frame = "M95 68H143V84H112V171H145V188H95Z";
      fill(frame, metal);
      line(frame, "#c5ad93", 1.5);
      line("M104 75H136M104 88V169M104 180H136", ink.colour, 2);
      for (let i = 0; i < 3; i++)
        fill(`M114 ${107 + i * 17}h10v8h-10Z`, i % 2 ? ink.light : ink.colour);
    } else if (motion === "DRAG") {
      const path = "M100 91H151L169 109V150L151 168H100L86 150V109Z";
      fill(path, metal);
      line(path, "#8b96af", 1.5);
      fill("M103 108H147V148H103Z", "#060d16");
      line("M107 113H142V143H107Z", ink.accent, 1);
      for (let i = 0; i < 3; i++)
        line(`M${113 + i * 9} 118v17`, i % 2 ? ink.colour : ink.light, 2);
      line("M95 102H152M95 155H152", ink.colour, 1);
    } else if (motion === "SKITTER") {
      const path = "M125 57C86 85 156 108 120 132S144 178 122 200";
      line(path, "#071722", 9);
      line(path, ink.accent, 3);
      line(path, ink.colour, 1);
      line("M122 69L120 83M126 171L125 187", ink.light, 1);
    } else {
      const path =
        motion === "FLY"
          ? "M131 66L145 118 118 181 119 127 110 103Z"
          : "M139 63L148 119 119 188 123 130 111 107Z";
      fill(path, metal);
      line(path, "#7c9aa7", 1.5);
      line("M132 84L135 118 123 158", ink.colour, 2);
    }
  } else {
    c.globalAlpha = 0.8;
    if (motion === "WALK") {
      c.fillStyle = "#9cff5222";
      c.beginPath();
      c.moveTo(128, 128);
      c.arc(128, 128, 96, -1.1, -0.2);
      c.closePath();
      c.fill();
      c.setLineDash([4, 9]);
      ring(128, 128, 83, ink.colour, 1);
      c.setLineDash([]);
      line("M128 128L171 41M128 128L223 108", ink.colour, 1);
    } else if (motion === "HOP") {
      line(
        "M51 85V51H85M171 51H205V85M205 171V205H171M85 205H51V171",
        ink.colour,
        2,
      );
      c.font = "10px monospace";
      c.textAlign = "center";
      c.fillStyle = ink.light;
      c.fillText("LOCK // WAIT", 128, 218);
    } else if (motion === "DRAG") {
      for (let i = 0; i < 5; i++) {
        line(`M104 ${70 + i * 32}h48`, i % 2 ? ink.accent : ink.colour, 1.5);
        c.font = "7px monospace";
        c.fillStyle = ink.accent;
        c.fillText(
          ["0xA0", "0xB8", "0xD1", "0xF3", "0xFF"][i],
          115,
          82 + i * 32,
        );
      }
    } else if (motion === "SKITTER") {
      line("M106 61Q165 121 111 191T146 249", ink.colour, 1.5);
      line("M147 61Q88 121 144 191T109 249", ink.accent, 1.5);
      for (let i = 0; i < 5; i++) {
        c.fillStyle = i % 2 ? ink.colour : ink.accent;
        c.fillRect(113 + (i % 2) * 24, 83 + i * 29, 12, 2);
      }
    } else {
      for (let i = 0; i < 4; i++) {
        c.globalAlpha = 0.75 - i * 0.14;
        line(
          `M${89 + i * 15} ${58 + i * 14}h30v50h-15v40h-15`,
          i % 2 ? ink.accent : ink.colour,
          1,
        );
      }
      c.globalAlpha = 0.8;
      c.font = "8px monospace";
      c.fillStyle = ink.light;
      c.fillText(motion === "FLY" ? "ECHO // 0xD7" : "KERNEL // 0x00", 84, 215);
    }
  }
  plates.set(key, canvas);
  return canvas;
}
