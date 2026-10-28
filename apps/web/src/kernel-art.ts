import type { Bounty } from "./types";
import type { Roamer, RoamerSpec } from "./bug-swarm";
import { kernelTail } from "./kernel-motion";

export const kernelWorld = { width: 4096, height: 2560 };
export const kernelBodyScale = 26;
export const kernelBountyRanks = [
  { label: "Common", minimum: 0 },
  { label: "Enhanced", minimum: 460 },
  { label: "Elite", minimum: 660 },
  { label: "Apex", minimum: 860 },
] as const;
export const kernelCreatures = [
  {
    name: "Packet Runner",
    color: "#57edff",
    motion: "DART",
    size: 0.58,
    pace: 1.15,
  },
  {
    name: "Stack Crawler",
    color: "#ffc25e",
    motion: "DRAG",
    size: 0.88,
    pace: 0.75,
  },
  {
    name: "Proxy Twin",
    color: "#ba8dff",
    motion: "FLY",
    size: 0.82,
    pace: 0.8,
  },
  {
    name: "Cipher Ray",
    color: "#ff6dcc",
    motion: "FLY",
    size: 1.12,
    pace: 0.72,
  },
  {
    name: "Deadlock Walker",
    color: "#ff6a70",
    motion: "WALK",
    size: 1.04,
    pace: 0.72,
  },
  {
    name: "Fork Wraith",
    color: "#bdff69",
    motion: "SKITTER",
    size: 0.74,
    pace: 1.15,
  },
  {
    name: "Cache Mimic",
    color: "#ffac60",
    motion: "HOP",
    size: 0.94,
    pace: 0.65,
  },
  {
    name: "Rootkit Sentinel",
    color: "#eff9ff",
    motion: "WALK",
    size: 1.35,
    pace: 0.5,
  },
] as const;
export function kernelAppearance(id: string, bounty: number) {
  let seed = 2166136261;
  for (let i = 0; i < id.length; i++)
    seed = Math.imul(seed ^ id.charCodeAt(i), 16777619) >>> 0;
  const kind = seed % 8,
    family = kernelCreatures[kind],
    tier = Math.max(
      0,
      kernelBountyRanks.findLastIndex((rank) => bounty >= rank.minimum),
    );
  return { ...family, kind, seed, tier, size: family.size * (1 + tier * 0.18) };
}
export function kernelSpecs(bugs: Bounty[]): RoamerSpec[] {
  return bugs.map((b) => {
    const a = kernelAppearance(b.bounty_id, b.base_bounty);
    return {
      id: b.bounty_id,
      region: "neon",
      seed: a.seed,
      motion: a.motion,
      size: a.size,
      pace: a.pace,
      x: 160 + ((a.seed >>> 8) % 3700),
      y: 160 + ((a.seed >>> 17) % 2200),
    };
  });
}
export function kernelCamera(
  view: { x: number; y: number },
  width: number,
  height: number,
) {
  return {
    x: Math.max(0, Math.min(kernelWorld.width - width, view.x)),
    y: Math.max(0, Math.min(kernelWorld.height - height, view.y)),
  };
}
export const kernelLandmarks = [
  { x: 2048, y: 1280, name: "PROCESSING CORE", color: "#ff66ce" },
  { x: 680, y: 640, name: "MEMORY VAULT 07", color: "#5be8ff" },
  { x: 3400, y: 650, name: "FIREWALL RELAY", color: "#ffb862" },
  { x: 820, y: 1980, name: "PACKET EXCHANGE", color: "#aeff79" },
  { x: 3330, y: 1950, name: "BUFFER ARRAY", color: "#a88aff" },
];
export function kernelFoot(distance: number, index: number) {
  const phase =
      ((distance * 10) / (Math.PI * 2) +
        (index === 0 || index === 3 ? 0 : 0.5)) %
      1,
    stance = 0.65,
    stride = (Math.PI * 2 * 48) / (10 * kernelBodyScale),
    y =
      (phase < stance
        ? phase - stance / 2
        : stance / 2 - ((phase - stance) / (1 - stance)) * stance) * stride;
  return {
    y,
    lift:
      phase < stance
        ? 0
        : Math.sin(((phase - stance) / (1 - stance)) * Math.PI) * 0.16,
  };
}
function polygon(
  c: CanvasRenderingContext2D,
  p: number[],
  fill: string,
  stroke?: string,
) {
  c.beginPath();
  c.moveTo(p[0], p[1]);
  for (let i = 2; i < p.length; i += 2) c.lineTo(p[i], p[i + 1]);
  c.closePath();
  c.fillStyle = fill;
  c.fill();
  if (stroke) {
    c.strokeStyle = stroke;
    c.stroke();
  }
}
function line(
  c: CanvasRenderingContext2D,
  p: number[],
  color: string,
  width = 1,
) {
  c.beginPath();
  c.moveTo(p[0], p[1]);
  for (let i = 2; i < p.length; i += 2) c.lineTo(p[i], p[i + 1]);
  c.strokeStyle = color;
  c.lineWidth = width;
  c.stroke();
}
function disc(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
) {
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fillStyle = color;
  c.fill();
}

// Each cached tile is only 512px; the arena keeps a bounded working set while panning.
export function drawKernelTile(
  c: CanvasRenderingContext2D,
  tx: number,
  ty: number,
) {
  const ox = tx * 512,
    oy = ty * 512;
  c.fillStyle = "#081321";
  c.fillRect(0, 0, 512, 512);
  c.save();
  c.translate(-ox, -oy);
  for (let y = oy; y < oy + 512; y += 128)
    for (let x = ox; x < ox + 512; x += 128) {
      c.fillStyle = (x / 128 + y / 128) % 2 ? "#152b3d" : "#102438";
      c.fillRect(x + 2, y + 2, 124, 124);
      line(c, [x + 4, y + 123, x + 123, y + 123, x + 123, y + 4], "#040b15", 3);
      line(c, [x + 5, y + 110, x + 5, y + 5, x + 110, y + 5], "#395669", 1);
      c.strokeStyle = "#152b3e";
      c.strokeRect(x + 11, y + 11, 104, 104);
      for (const [sx, sy] of [
        [10, 10],
        [118, 10],
        [10, 118],
        [118, 118],
      ]) {
        disc(c, x + sx, y + sy, 2.2, "#557488");
        line(c, [x + sx - 1, y + sy, x + sx + 1, y + sy], "#081321");
      }
      if ((x / 128 + y / 128) % 3 === 0) {
        c.fillStyle = "#345266";
        for (let j = 0; j < 8; j++) c.fillRect(x + 26 + j * 8, y + 99, 3, 8);
      }
    }
  for (const m of kernelLandmarks) {
    const glow = c.createRadialGradient(m.x, m.y, 40, m.x, m.y, 450);
    glow.addColorStop(0, m.color + "25");
    glow.addColorStop(1, m.color + "00");
    c.fillStyle = glow;
    c.fillRect(ox, oy, 512, 512);
  }
  // Parallel buses and junctions form one navigable floor, not district screens.
  for (let x = 256; x < 4096; x += 768) {
    c.fillStyle = "#06101b";
    c.fillRect(x - 38, oy, 76, 512);
    for (const d of [-28, -16, 16, 28])
      line(
        c,
        [x + d, oy, x + d, oy + 512],
        Math.abs(d) === 28 ? "#205969" : "#137784",
        2,
      );
  }
  for (let y = 256; y < 2560; y += 640) {
    c.fillStyle = "#07101f";
    c.fillRect(ox, y - 30, 512, 60);
    line(c, [ox, y - 24, ox + 512, y - 24], "#5c285e", 2);
    line(c, [ox, y + 24, ox + 512, y + 24], "#612b69", 2);
    for (let x = ox + 16; x < ox + 512; x += 48) {
      c.fillStyle = "#346674";
      c.fillRect(x, y - 3, 19, 2);
    }
  }
  // Cable trunks, sockets and recessed electronics are baked into the cached floor.
  for (const m of kernelLandmarks.slice(1)) {
    const route = [m.x, m.y, m.x, 1280, 2048, 1280];
    line(c, route, "#020911", 34);
    line(c, route, "#273d51", 28);
    line(c, route, "#0a1726", 21);
    line(c, route, m.color + "77", 4);
    for (const d of [-10, 10])
      line(c, [m.x + d, m.y, m.x + d, 1280 + d, 2048, 1280 + d], "#69828f", 1);
  }
  for (let y = oy + 100; y < oy + 512; y += 256)
    for (let x = ox + 120; x < ox + 512; x += 256) {
      const colour = (tx + ty) % 2 ? "#1c8094" : "#6e337b";
      line(
        c,
        [x - 24, y - 12, x, y - 12, x + 10, y - 2, x + 30, y - 2],
        colour,
      );
      disc(c, x - 24, y - 12, 3, colour);
      c.font = "8px monospace";
      c.fillStyle = "#42616b";
      c.fillText(
        `0x${((x * 17 + y * 3) & 65535).toString(16).toUpperCase()}`,
        x - 25,
        y + 12,
      );
      c.save();
      c.translate(x + 60, y - 45);
      const kind = (tx * 3 + ty + Math.floor(x / 256)) % 4;
      if (kind === 0) {
        c.fillStyle = "#040b12";
        c.fillRect(-33, -20, 72, 49);
        c.fillStyle = "#233b4a";
        c.fillRect(-30, -23, 67, 44);
        for (let i = 0; i < 8; i++) {
          c.fillStyle = i % 2 ? "#071422" : "#587382";
          c.fillRect(-23 + i * 7, -17, 3, 31);
        }
        line(c, [-30, -23, 35, -23], "#7c9ca3", 2);
      } else if (kind === 1) {
        for (let i = 0; i < 3; i++) {
          polygon(
            c,
            [
              -28 + i * 23,
              -23,
              -10 + i * 23,
              -23,
              -5 + i * 23,
              -17,
              -5 + i * 23,
              18,
              -23 + i * 23,
              18,
              -28 + i * 23,
              12,
            ],
            "#122d42",
            "#496e7f",
          );
          c.fillStyle = i === 1 ? "#73dbca" : "#385764";
          c.fillRect(-23 + i * 23, -15, 12, 4);
          c.fillStyle = "#071322";
          c.fillRect(-23 + i * 23, -4, 12, 18);
        }
      } else if (kind === 2) {
        polygon(
          c,
          [-29, -23, 26, -23, 33, -16, 33, 21, -23, 21, -29, 15],
          "#081626",
          "#426277",
        );
        for (let i = 0; i < 5; i++) {
          line(c, [-24 + i * 11, -26, -24 + i * 11, -34], "#8b9590", 3);
          line(c, [-24 + i * 11, 24, -24 + i * 11, 32], "#8b9590", 3);
        }
        c.font = "9px monospace";
        c.fillStyle = "#99afbf";
        c.fillText("DMA-" + ((tx * 7 + ty) % 16).toString(16), -22, 3);
      } else {
        for (let i = 0; i < 2; i++) {
          disc(c, -14 + i * 31, 0, 18, "#020810");
          disc(c, -16 + i * 31, -3, 15, "#294759");
          disc(c, -16 + i * 31, -3, 10, "#071725");
          line(c, [-22 + i * 31, -11, -13 + i * 31, -14], "#74a0ad", 2);
        }
      }
      c.restore();
    }
  for (const m of kernelLandmarks) {
    if (Math.abs(m.x - (ox + 256)) < 600 && Math.abs(m.y - (oy + 256)) < 530)
      drawKernelModule(c, m);
  }
  c.restore();
}
function drawKernelModule(
  c: CanvasRenderingContext2D,
  m: (typeof kernelLandmarks)[number],
) {
  c.save();
  c.translate(m.x, m.y);
  const outline = [
    -211, -126, 173, -126, 222, -78, 222, 115, -174, 115, -219, 71,
  ];
  c.save();
  c.translate(10, 16);
  polygon(c, outline, "#02060daa");
  c.restore();
  polygon(c, outline, "#23384c", "#4c697a");
  polygon(
    c,
    [-201, -115, 169, -115, 209, -73, 209, 102, -169, 102, -207, 66],
    "#081321",
    "#020b15",
  );
  line(c, [-211, 62, -211, -122, 173, -122, 214, -82], "#6b8797", 2);
  line(c, [-195, -102, 164, -102, 196, -69], m.color, 3);
  line(c, [-196, 64, -162, 91, 193, 91], m.color + "aa", 2);
  for (const [x, y] of [
    [-192, -105],
    [183, -67],
    [-179, 80],
    [193, 82],
  ]) {
    disc(c, x, y, 5, "#536c7c");
    line(c, [x - 2, y, x + 2, y], "#142332", 1.5);
  }
  if (m.name === "PROCESSING CORE") {
    for (let i = 4; i >= 0; i--) {
      c.beginPath();
      c.ellipse(0, -3, 91 + i * 20, 49 + i * 12, 0, 0, Math.PI * 2);
      c.fillStyle = ["#030914", "#103443", "#0a1928", "#345164", "#050d17"][i];
      c.fill();
      c.strokeStyle = i % 2 ? "#639095" : "#213d54";
      c.lineWidth = 3;
      c.stroke();
    }
    for (let i = 0; i < 24; i++) {
      const a = (i * Math.PI) / 12;
      c.save();
      c.translate(Math.cos(a) * 155, Math.sin(a) * 86 - 3);
      c.rotate(a);
      c.fillStyle = i % 3 ? "#284a59" : "#6abfc4";
      c.fillRect(-7, -3, 14, 6);
      c.restore();
    }
    for (let i = -5; i < 6; i++)
      for (const side of [-1, 1]) {
        polygon(
          c,
          [
            i * 12 - 3,
            side * 48,
            i * 12 + 3,
            side * 48,
            i * 12 + 3,
            side * 74,
            i * 12 - 3,
            side * 74,
          ],
          "#9cabab",
          "#304959",
        );
      }
    polygon(
      c,
      [-67, -48, 44, -48, 72, -22, 72, 33, -44, 33, -72, 7],
      "#080f20",
      "#628596",
    );
    polygon(
      c,
      [-60, -47, 42, -47, 65, -24, 65, 25, -42, 25, -65, 4],
      "#37475d",
      m.color,
    );
    polygon(
      c,
      [-45, -35, 35, -35, 50, -19, 50, 16, -34, 16, -50, 1],
      "#112339",
      "#54ceec",
    );
    const glow = c.createLinearGradient(-40, -25, 35, 17);
    glow.addColorStop(0, "#37b2c0");
    glow.addColorStop(0.5, "#34467c");
    glow.addColorStop(1, "#b13588");
    c.fillStyle = glow;
    c.fillRect(-32, -25, 61, 31);
    c.font = "bold 12px monospace";
    c.fillStyle = "#d5f9ff";
    c.fillText("AI / K-026", -34, -4);
    for (let i = 0; i < 3; i++) {
      c.fillStyle = "#ff62c8";
      c.fillRect(104, -26 + i * 15, 19, 4);
      c.fillStyle = "#6dceda";
      c.fillRect(-130, -26 + i * 15, 19, 4);
    }
  } else if (m.name === "MEMORY VAULT 07") {
    for (let i = 0; i < 5; i++) {
      const x = -151 + i * 65;
      polygon(
        c,
        [x, -65, x + 35, -65, x + 47, -52, x + 47, 51, x + 9, 51, x, 40],
        "#0b1725",
        "#385c70",
      );
      polygon(
        c,
        [x + 2, -67, x + 36, -67, x + 46, -55, x + 12, -55],
        "#658493",
      );
      for (let j = 0; j < 6; j++) {
        c.fillStyle = j % 2 ? "#2e4b61" : "#142d42";
        c.fillRect(x + 10, -43 + j * 13, 26, 8);
        c.fillStyle = j % 3 ? "#3f7c91" : "#75f4e3";
        c.fillRect(x + 12, -42 + j * 13, 3, 5);
      }
      line(c, [x + 45, -48, x + 45, 37], m.color, 2);
    }
  } else if (m.name === "FIREWALL RELAY") {
    polygon(
      c,
      [-151, -52, 122, -52, 154, -22, 154, 47, -128, 47, -156, 18],
      "#203546",
      "#6b7e80",
    );
    c.fillStyle = "#07111f";
    c.fillRect(-116, -38, 230, 69);
    for (let i = 0; i < 12; i++) {
      const x = -111 + i * 20;
      polygon(
        c,
        [x, -35, x + 10, -35, x + 4, 28, x - 6, 28],
        i % 2 ? "#6b503d" : "#d49552",
      );
    }
    for (const side of [-1, 1]) {
      polygon(
        c,
        [side * 134, -67, side * 164, -48, side * 164, 60, side * 134, 44],
        "#405361",
        "#9a9e8c",
      );
      c.fillStyle = "#ff7551";
      c.fillRect(side * 146 - 3, -41, 6, 62);
    }
    c.font = "bold 10px monospace";
    c.fillStyle = "#ffc077";
    c.fillText("QUARANTINE BUS // ACTIVE", -91, 70);
  } else if (m.name === "PACKET EXCHANGE") {
    for (let i = 0; i < 3; i++) {
      const x = -115 + i * 112;
      for (const side of [-1, 1]) {
        c.beginPath();
        c.ellipse(x, side * 41, 37, 21, 0, 0, Math.PI * 2);
        c.fillStyle = "#0b1a2a";
        c.fill();
        c.strokeStyle = "#577d80";
        c.lineWidth = 4;
        c.stroke();
        c.beginPath();
        c.ellipse(x, side * 41, 25, 13, 0, 0, Math.PI * 2);
        c.strokeStyle = m.color;
        c.lineWidth = 3;
        c.stroke();
      }
      line(c, [x - 15, -20, x - 15, 19], "#486b6e", 12);
      line(c, [x + 13, -20, x + 13, 19], "#213b44", 8);
    }
  } else {
    for (let row = 0; row < 2; row++)
      for (let col = 0; col < 4; col++) {
        const x = -147 + col * 80,
          y = -64 + row * 65;
        polygon(
          c,
          [
            x,
            y,
            x + 50,
            y,
            x + 62,
            y + 13,
            x + 62,
            y + 48,
            x + 11,
            y + 48,
            x,
            y + 36,
          ],
          "#30445a",
          "#738699",
        );
        c.fillStyle = "#091524";
        c.fillRect(x + 10, y + 9, 41, 29);
        c.strokeStyle = m.color;
        c.strokeRect(x + 15, y + 14, 30, 18);
        for (let j = 0; j < 3; j++) {
          c.fillStyle = "#637d94";
          c.fillRect(x + 13 + j * 14, y + 42, 7, 4);
        }
      }
  }
  c.font = "bold 11px monospace";
  c.textAlign = "center";
  c.fillStyle = m.color;
  c.fillText(m.name, 0, 142);
  c.font = "8px monospace";
  c.fillStyle = "#7293a4";
  c.fillText(
    "ROOT BUS  //  ENCRYPTED LINK  //  0x" + m.x.toString(16).toUpperCase(),
    0,
    157,
  );
  c.textAlign = "left";
  c.restore();
}
export function drawKernelTraffic(
  c: CanvasRenderingContext2D,
  t: number,
  view: { x: number; y: number; width: number; height: number },
) {
  const bounds: { x: number; y: number; width: number; height: number }[] = [];
  for (let lane = 0; lane < 5; lane++)
    for (let n = 0; n < 6; n++) {
      const x = 256 + lane * 768,
        y = (t * (lane % 2 ? 72 : 95) + n * 440 + lane * 115) % 2560;
      if (
        x < view.x - 40 ||
        x > view.x + view.width + 40 ||
        y < view.y - 30 ||
        y > view.y + view.height + 30
      )
        continue;
      c.fillStyle = "#65eeff";
      c.fillRect(x - 4, y, 8, 18);
      c.fillStyle = "#1c7588";
      c.fillRect(x - 3, y + 23, 6, 21);
      c.fillStyle = "#d8fbff";
      c.fillRect(x - 2, y + 2, 4, 3);
      bounds.push({ x: x - 6, y: y - 3, width: 12, height: 50 });
    }
  for (let lane = 0; lane < 4; lane++)
    for (let n = 0; n < 5; n++) {
      const y = 256 + lane * 640,
        x = (t * 84 + n * 850 + lane * 270) % 4096;
      if (
        x < view.x - 30 ||
        x > view.x + view.width + 30 ||
        y < view.y - 30 ||
        y > view.y + view.height + 30
      )
        continue;
      c.fillStyle = "#f86fcf";
      c.fillRect(x, y - 4, 20, 8);
      c.fillStyle = "#643264";
      c.fillRect(x - 22, y - 3, 16, 6);
      bounds.push({ x: x - 24, y: y - 6, width: 47, height: 13 });
    }
  const m = kernelLandmarks[0];
  if (
    Math.abs(m.x - view.x - view.width / 2) < view.width / 2 + 170 &&
    Math.abs(m.y - view.y - view.height / 2) < view.height / 2 + 100
  ) {
    c.save();
    c.translate(m.x, m.y);
    c.scale(1, 0.56);
    c.strokeStyle = "#ff82d7";
    c.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      c.beginPath();
      c.arc(0, 0, 117, t * 0.3 + i * 2.1, t * 0.3 + i * 2.1 + 0.7);
      c.stroke();
    }
    c.restore();
    bounds.push({ x: m.x - 121, y: m.y - 71, width: 242, height: 142 });
  }
  return bounds;
}

export function drawKernelGround(
  c: CanvasRenderingContext2D,
  a: Roamer,
  art: ReturnType<typeof kernelAppearance>,
  t: number,
) {
  const scale = kernelBodyScale * art.size,
    colour = art.color;
  c.save();
  c.translate(a.x, a.y);
  c.save();
  c.scale(1, 0.47);
  disc(c, 0, 14, scale * 1.04, "#00000070");
  c.restore();
  if (art.tier) {
    c.strokeStyle = colour;
    c.lineWidth = art.tier === 3 ? 2 : 1;
    c.globalAlpha = 0.2 + art.tier * 0.12;
    c.beginPath();
    c.ellipse(
      0,
      7,
      scale * (1.25 + art.tier * 0.12),
      scale * 0.65,
      0,
      0,
      Math.PI * 2,
    );
    c.stroke();
    c.globalAlpha = 1;
    for (let i = 0; i < art.tier + 1; i++)
      disc(
        c,
        Math.cos(i * 2.4 + t * 0.3) * scale * 1.4,
        Math.sin(i * 2.4 + t * 0.3) * scale * 0.6,
        2,
        colour,
      );
  }
  c.restore();
}
export function drawKernelBug(
  c: CanvasRenderingContext2D,
  a: Roamer,
  art: ReturnType<typeof kernelAppearance>,
  t: number,
  trail: { x: number; y: number }[] = [],
  bodyOnly = false,
) {
  const scale = kernelBodyScale * art.size,
    colour = art.color,
    gait = a.distance * 2.8;
  if (!bodyOnly) drawKernelGround(c, a, art, t);
  c.save();
  c.translate(
    a.x,
    a.y - (!bodyOnly && art.motion === "FLY" ? 5 + Math.sin(t * 2) * 1.5 : 0),
  );
  c.rotate(a.heading);
  c.scale(scale, scale);
  c.lineJoin = "round";
  c.lineCap = "round";
  const plate = (p: number[], fill = "#334b63") => {
    c.save();
    c.translate(0.04, 0.085);
    polygon(c, p, "#010812");
    c.restore();
    c.lineWidth = 0.045;
    polygon(c, p, fill, "#07111d");
    line(c, p.slice(0, Math.min(6, p.length)), "#c7e7f266", 0.035);
  };
  const eye = (x: number, y: number, r: number, hue: string = colour) => {
    disc(c, x, y, r * 1.4, "#050b15");
    disc(c, x, y, r, hue);
    disc(c, x - r * 0.2, y - r * 0.25, r * 0.32, "#e9ffff");
  };
  const vents = (x: number, y: number, n: number, hue: string = colour) => {
    for (let i = 0; i < n; i++)
      line(c, [x, y + i * 0.13, x + 0.22, y + i * 0.13], hue, 0.045);
  };
  c.lineWidth = 0.045;
  switch (art.kind) {
    case 0:
      for (const s of [-1, 1]) {
        plate(
          [
            s * 0.23,
            -0.6,
            s * 0.83,
            -0.2,
            s * 1.02,
            0.5,
            s * 0.53,
            0.33,
            s * 0.28,
            0.7,
          ],
          "#2b455b",
        );
        plate(
          [s * 0.47, -0.14, s * 0.8, 0.18, s * 0.81, 0.3, s * 0.46, 0.14],
          "#5a7889",
        );
        line(c, [s * 0.42, 0.4, s * 0.52, 0.8], colour, 0.11);
        if (a.moving) {
          c.globalAlpha = 0.55;
          polygon(
            c,
            [
              s * 0.4,
              0.68,
              s * 0.63,
              0.68,
              s * 0.51,
              1.22 + Math.sin(t * 25) * 0.08,
            ],
            colour,
          );
          c.globalAlpha = 1;
        }
      }
      plate([
        0, -1.25, 0.36, -0.26, 0.8, 0.64, 0.16, 0.38, 0, 0.76, -0.16, 0.38,
        -0.8, 0.64, -0.36, -0.26,
      ]);
      plate(
        [0, -1.12, 0.2, -0.19, 0.12, 0.4, 0, 0.55, -0.12, 0.4, -0.2, -0.19],
        "#4e6f88",
      );
      line(c, [-0.14, -0.36, 0.14, -0.36], colour, 0.11);
      eye(0, -0.15, 0.1);
      for (const side of [-1, 1])
        line(
          c,
          [
            side * 0.3,
            0.55,
            side * 0.38,
            1.05 + (a.moving ? 0.25 * Math.sin(gait) : 0),
          ],
          colour,
          0.06,
        );
      break;
    case 1: {
      const points = kernelTail(a, trail, scale * 0.31);
      for (let i = 6; i >= 0; i--) {
        const p = points[i],
          dx = p ? p.x - a.x : Math.sin(gait - i * 0.7) * 4,
          dy = p ? p.y - a.y : i * scale * 0.3;
        const x = p
            ? (dx * Math.cos(a.heading) + dy * Math.sin(a.heading)) / scale
            : dx / scale,
          y = p
            ? (-dx * Math.sin(a.heading) + dy * Math.cos(a.heading)) / scale
            : dy / scale;
        c.save();
        c.translate(x, y);
        const ahead = points[Math.max(0, i - 1)],
          behind = points[Math.min(points.length - 1, i + 1)];
        c.rotate(
          Math.atan2(-(ahead.x - behind.x), -(ahead.y - behind.y)) - a.heading,
        );
        const pulse = 1 + 0.08 * Math.sin(gait - i * 0.7),
          w = 0.58 - i * 0.035;
        c.scale(1, pulse);
        plate(
          [-w, -0.2, w, -0.2, w * 0.84, 0.23, -w * 0.84, 0.23],
          i % 2 ? "#463323" : "#26313a",
        );
        line(c, [-w * 0.5, 0, w * 0.5, 0], colour, 0.04);
        polygon(
          c,
          [-w * 0.7, -0.13, w * 0.65, -0.13, w * 0.42, -0.01, -w * 0.7, -0.01],
          "#c49a65",
        );
        for (const side of [-1, 1])
          polygon(
            c,
            [side * w, -0.1, side * (w + 0.16), 0.06, side * w, 0.15],
            "#7d725d",
          );
        c.restore();
      }
      plate([-0.45, -0.45, 0, -0.75, 0.45, -0.45, 0.4, -0.05, -0.4, -0.05]);
      disc(c, -0.19, -0.45, 0.075, colour);
      disc(c, 0.19, -0.45, 0.075, colour);
      for (const side of [-1, 1])
        plate(
          [
            side * 0.24,
            -0.4,
            side * 0.52,
            -0.82,
            side * 0.27,
            -0.96,
            side * 0.34,
            -0.67,
          ],
          "#8c9b97",
        );
      break;
    }
    case 2:
      for (let i = 0; i < 2; i++) {
        const angle = t * 1.5 + i * Math.PI,
          x = Math.cos(angle) * 0.64,
          y = Math.sin(angle) * 0.55;
        line(c, [0, 0, x, y], "#665b9d", 0.05);
        c.save();
        c.translate(x, y);
        c.rotate(-angle);
        plate(
          [0, -0.6, 0.4, -0.18, 0.3, 0.35, -0.3, 0.35, -0.4, -0.18],
          i ? "#342852" : "#25233d",
        );
        plate(
          [
            -0.3, -0.22, -0.12, -0.45, 0.12, -0.45, 0.3, -0.22, 0.21, 0.19,
            -0.21, 0.19,
          ],
          "#62557d",
        );
        eye(0, -0.05, i ? 0.14 : 0.2);
        vents(-0.13, 0.23, 2, "#a48cc3");
        line(c, [-0.28, -0.3, -0.45, -0.65], colour, 0.06);
        line(c, [0.28, -0.3, 0.45, -0.65], colour, 0.06);
        c.restore();
      }
      disc(c, 0, 0, 0.1, "#f4dcff");
      break;
    case 3: {
      const flex = 0.12 * Math.sin(t * 4);
      for (const side of [-1, 1])
        plate(
          [
            side * 0.12,
            -0.75,
            side * (1.3 + flex),
            -0.15,
            side * 1.1,
            0.7,
            side * 0.45,
            0.35,
            side * 0.12,
            0.7,
          ],
          "#42516c",
        );
      plate(
        [0, -1.1, 0.22, -0.45, 0.12, 1.1, 0, 1.55, -0.12, 1.1, -0.22, -0.45],
        "#152d48",
      );
      for (const s of [-1, 1])
        line(
          c,
          [s * 0.3, -0.3, s * 0.95, 0.25, s * 0.55, 0.3],
          "#ff99e9",
          0.035,
        );
      for (const s of [-1, 1]) {
        plate(
          [s * 0.25, -0.55, s * 1.2, -0.13, s * 0.93, 0.14, s * 0.25, 0.15],
          "#65768d",
        );
        plate(
          [s * 0.3, 0.18, s * 0.87, 0.27, s * 1.02, 0.58, s * 0.45, 0.39],
          "#25374b",
        );
        line(
          c,
          [s * 0.35, -0.26, s * 0.92, 0.01, s * 0.78, 0.15],
          colour,
          0.07,
        );
        vents(s * 0.45, 0.32, 3, "#a27eb1");
      }
      plate(
        [-0.18, -0.82, 0, -1.2, 0.18, -0.82, 0.12, -0.44, -0.12, -0.44],
        "#798da4",
      );
      line(c, [-0.14, -0.65, 0.14, -0.65], colour, 0.09);
      break;
    }
    case 4:
      for (let i = 0; i < 4; i++) {
        const side = i < 2 ? -1 : 1,
          front = i % 2 === 0 ? -1 : 1,
          step = a.moving ? kernelFoot(a.distance, i) : { y: 0, lift: 0 },
          stride = step.y,
          knee = side * 0.92,
          foot = side * (1.2 - step.lift);
        line(
          c,
          [
            side * 0.3,
            front * 0.43,
            knee,
            front * 0.62 + stride,
            foot,
            front * 0.86 + stride,
          ],
          "#09121c",
          0.18,
        );
        line(
          c,
          [
            side * 0.3,
            front * 0.43,
            knee,
            front * 0.62 + stride,
            foot,
            front * 0.86 + stride,
          ],
          "#697585",
          0.1,
        );
        disc(c, knee, front * 0.62 + stride, 0.1, colour);
        polygon(
          c,
          [
            foot - 0.13,
            front * 0.86 + stride - 0.09,
            foot + 0.13,
            front * 0.86 + stride - 0.09,
            foot + 0.16,
            front * 0.86 + stride + 0.12,
            foot - 0.16,
            front * 0.86 + stride + 0.12,
          ],
          "#71818b",
          "#0b1722",
        );
        line(
          c,
          [
            foot - 0.09,
            front * 0.86 + stride,
            foot + 0.09,
            front * 0.86 + stride,
          ],
          colour,
          0.07,
        );
      }
      plate(
        [
          -0.47, -0.72, 0.47, -0.72, 0.63, -0.18, 0.47, 0.68, -0.47, 0.68,
          -0.63, -0.18,
        ],
        "#65505b",
      );
      for (const s of [-1, 1]) {
        plate(
          [
            s * 0.29,
            -0.65,
            s * 0.55,
            -0.57,
            s * 0.64,
            -0.08,
            s * 0.38,
            0.12,
            s * 0.25,
            -0.18,
          ],
          "#8b6470",
        );
        plate(
          [s * 0.3, 0.28, s * 0.55, 0.13, s * 0.49, 0.64, s * 0.2, 0.79],
          "#384353",
        );
      }
      plate(
        [
          -0.28, -0.45, 0.28, -0.45, 0.34, -0.23, 0.22, 0.33, -0.22, 0.33,
          -0.34, -0.23,
        ],
        "#152333",
      );
      line(c, [-0.23, -0.33, 0.23, -0.33], colour, 0.12);
      eye(0, -0.05, 0.15);
      vents(-0.12, 0.42, 2, "#e4a196");
      break;
    case 5:
      for (let i = a.moving ? 2 : 0; i >= 0; i--) {
        c.globalAlpha = i ? 0.18 : 1;
        plate(
          [
            0,
            -1.05 + i * 0.35,
            0.42,
            0.3 + i * 0.35,
            0,
            0.05 + i * 0.35,
            -0.42,
            0.3 + i * 0.35,
          ],
          i ? "#193632" : "#46575b",
        );
      }
      c.globalAlpha = 1;
      for (const s of [-1, 1])
        plate(
          [s * 0.14, -0.32, s * 0.66, 0.12, s * 0.74, 0.65, s * 0.25, 0.42],
          "#253d42",
        );
      plate(
        [0, -0.89, 0.16, -0.22, 0.11, 0.5, -0.11, 0.5, -0.16, -0.22],
        "#7b9181",
      );
      line(c, [-0.17, -0.18, 0.17, -0.18], colour, 0.1);
      vents(-0.1, 0.16, 3, colour);
      break;
    case 6: {
      const unfold = a.moving ? 0.12 : 0.3 + 0.06 * Math.sin(t * 2);
      for (let i = 0; i < 6; i++) {
        c.save();
        c.rotate((i * Math.PI) / 3);
        plate(
          [
            -0.33,
            -0.36 - unfold,
            0,
            -0.69 - unfold,
            0.33,
            -0.36 - unfold,
            0.18,
            -0.12,
            -0.18,
            -0.12,
          ],
          "#42576a",
        );
        c.restore();
      }
      disc(c, 0, 0, 0.47, "#8b9d9f");
      disc(c, 0, 0, 0.4, "#0c1b29");
      eye(0, 0, 0.23);
      c.save();
      c.rotate(bodyOnly ? 0 : t * 0.6);
      line(c, [-0.29, -0.18, -0.29, 0.18, 0.12, 0.32], colour, 0.05);
      c.restore();
      line(c, [-0.1, 0, 0.1, 0], "#fff0cd", 0.05);
      break;
    }
    case 7:
      for (const s of [-1, 1]) {
        plate(
          [s * 0.45, -0.7, s * 0.92, -0.5, s * 0.92, 0.67, s * 0.45, 0.82],
          "#516674",
        );
        for (let j = 0; j < 3; j++) {
          disc(c, s * 0.73, -0.32 + j * 0.4, 0.16, "#0b1722");
          disc(c, s * 0.73, -0.32 + j * 0.4, 0.09, "#728791");
        }
        for (let j = 0; j < 4; j++)
          line(
            c,
            [
              s * 0.5,
              -0.53 + ((j * 0.28 + (a.distance * 48) / kernelBodyScale) % 1.12),
              s * 0.88,
              -0.53 + ((j * 0.28 + (a.distance * 48) / kernelBodyScale) % 1.12),
            ],
            "#7892a6",
            0.06,
          );
      }
      plate(
        [-0.52, -0.8, 0, -1.1, 0.52, -0.8, 0.48, 0.6, 0, 0.9, -0.48, 0.6],
        "#bccbd2",
      );
      disc(c, 0, -0.1, 0.37, "#152338");
      for (const s of [-1, 1]) {
        plate(
          [s * 0.17, -0.84, s * 0.43, -0.72, s * 0.39, -0.24, s * 0.17, -0.35],
          "#526a7a",
        );
        plate(
          [s * 0.31, -0.65, s * 0.48, -0.65, s * 0.48, -1.22, s * 0.31, -1.22],
          "#263d50",
        );
        line(c, [s * 0.32, -1.2, s * 0.47, -1.2], "#f17f94", 0.08);
        vents(s * 0.2, 0.34, 3, "#667f8c");
      }
      eye(0, -0.1, 0.2, "#ff536b");
      if (!bodyOnly) {
        c.save();
        c.translate(0, -0.1);
        c.rotate(t * 0.7);
        c.strokeStyle = colour;
        c.lineWidth = 0.045;
        c.strokeRect(-0.48, -0.48, 0.96, 0.96);
        c.restore();
      }
      break;
  }
  c.restore();
}

export function drawKernelPurge(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  elapsed: number,
  radius: number,
  colour: string,
) {
  const p = Math.min(1, elapsed / 2600),
    r = radius * 1.5;
  c.save();
  c.translate(x, y);
  c.strokeStyle = colour;
  c.lineWidth = 2;
  if (p < 0.72) {
    const close = Math.min(1, p * 4),
      reach = r * (2 - close * 0.8);
    for (let i = 0; i < 4; i++) {
      c.save();
      c.rotate((i * Math.PI) / 2);
      line(c, [-12, -reach, 12, -reach, 12, -reach + 16], colour, 3);
      c.restore();
    }
    c.globalAlpha = Math.min(1, p * 5);
    c.beginPath();
    c.arc(0, 0, r, p * 8, p * 8 + Math.PI * 1.7);
    c.stroke();
    if (p > 0.2) {
      c.globalAlpha = 0.8;
      line(
        c,
        [
          -r * 2,
          -r + r * 2 * ((p - 0.2) / 0.52),
          r * 2,
          -r + r * 2 * ((p - 0.2) / 0.52),
        ],
        "#e4ffff",
        3,
      );
    }
  } else {
    c.globalAlpha = (1 - p) / 0.28;
    for (let i = 0; i < 16; i++) {
      const angle = i * 2.399,
        travel = (p - 0.72) * r * 8,
        dx = Math.cos(angle) * travel,
        dy = Math.sin(angle) * travel;
      c.fillStyle = i % 2 ? colour : "#d5ffff";
      c.fillRect(dx, dy, 3 + (i % 3), 3 + (i % 2));
    }
    c.beginPath();
    c.ellipse(
      0,
      0,
      r * (1 + (p - 0.72) * 4),
      r * 0.65 * (1 + (p - 0.72) * 4),
      0,
      0,
      Math.PI * 2,
    );
    c.stroke();
  }
  c.restore();
}
