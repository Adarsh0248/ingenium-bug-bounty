import type { RegionId } from "./regions";

export const regionWeapons = {
  neon: {
    name: "Vector Lance",
    serial: "VL / 01",
    colour: "#51eafa",
    accent: "#ff76dc",
    finish: "SIGNAL COLLAPSED",
  },
  foundry: {
    name: "Polarity Crusher",
    serial: "PC / 02",
    colour: "#ffd185",
    accent: "#74f3d2",
    finish: "CHASSIS DISMANTLED",
  },
  verdant: {
    name: "Graph Reaper",
    serial: "GR / 03",
    colour: "#9affc8",
    accent: "#ba9cff",
    finish: "CONNECTIONS SEVERED",
  },
  cryo: {
    name: "Nullpoint Cannon",
    serial: "NC / 04",
    colour: "#c1ff66",
    accent: "#65def8",
    finish: "PROCESS PURGED",
  },
} as const;

const clamp = (n: number) => Math.max(0, Math.min(1, n)),
  smooth = (n: number) => {
    const t = clamp(n);
    return t * t * (3 - 2 * t);
  };
export const terminationDuration = (tier: number) =>
  5.5 + Math.max(0, Math.min(3, tier)) * 0.2;
export function terminationPose(
  region: RegionId,
  seconds: number,
  tier: number,
) {
  const duration = terminationDuration(tier),
    t = (Math.max(0, seconds) * 5.5) / duration,
    deploy = smooth(t / 0.85),
    charge = smooth((t - 0.85) / 1.15),
    fire = smooth((t - 2) / 0.22) * (1 - smooth((t - 3.25) / 0.5)),
    destroy = smooth((t - 2.45) / 1.5),
    retract = smooth((t - 4.65) / 0.8),
    phase =
      t < 0.85
        ? "DEPLOYING"
        : t < 2
          ? "CHARGING"
          : t < 2.45
            ? "LOCKED ON"
            : t < 3.95
              ? "TERMINATING"
              : t < 4.65
                ? regionWeapons[region].finish
                : "RETRACTING";
  return {
    t,
    duration,
    deploy,
    charge,
    fire,
    destroy,
    retract,
    phase,
    debris: smooth((t - 2.65) / 1.7),
    ghost: Math.sin(Math.PI * smooth((t - 2.3) / 1.8)),
    shake: Math.sin(t * 38) * Math.sin(Math.PI * destroy) * 0.035,
    targetX:
      region === "foundry"
        ? 1 - destroy * 0.86
        : region === "cryo"
          ? 1 - destroy * 0.98
          : 1 - destroy * 0.28,
    targetY:
      region === "neon"
        ? 1 - destroy * 0.93
        : region === "cryo"
          ? 1 - destroy * 0.95
          : 1 - destroy * 0.26,
    targetVisible: t < 3.95,
    done: seconds >= duration,
  };
}

export type WeaponPart = "device" | "moving" | "reticle";
const plates = new Map<string, HTMLCanvasElement>();
export function weaponPlate(region: RegionId, part: WeaponPart = "device") {
  const key = `${region}:${part}`;
  if (plates.has(key)) return plates.get(key)!;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const c = canvas.getContext("2d")!,
    ink = regionWeapons[region];
  c.lineJoin = "bevel";
  c.lineCap = "square";
  const fill = (d: string, colour: string | CanvasGradient) => {
      c.fillStyle = colour;
      c.fill(new Path2D(d));
    },
    line = (d: string, colour: string = ink.colour, width = 2) => {
      c.strokeStyle = colour;
      c.lineWidth = width;
      c.stroke(new Path2D(d));
    },
    ring = (
      x: number,
      y: number,
      r: number,
      colour: string = ink.colour,
      width = 2,
    ) => {
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.strokeStyle = colour;
      c.lineWidth = width;
      c.stroke();
    },
    text = (
      value: string,
      x: number,
      y: number,
      size = 10,
      colour: string = ink.colour,
    ) => {
      c.font = `${size}px Consolas,monospace`;
      c.fillStyle = colour;
      c.fillText(value, x, y);
    },
    metal = c.createLinearGradient(65, 120, 400, 340);
  metal.addColorStop(0, "#718793");
  metal.addColorStop(0.2, "#1a2c39");
  metal.addColorStop(0.45, "#09151f");
  metal.addColorStop(0.7, "#263c4b");
  metal.addColorStop(1, "#8295a0");
  if (part === "reticle") {
    c.setLineDash([28, 12, 3, 12]);
    ring(256, 256, 185, ink.colour, 2);
    c.setLineDash([]);
    ring(256, 256, 161, "#7c98a6", 1);
    for (let i = 0; i < 8; i++) {
      c.save();
      c.translate(256, 256);
      c.rotate((i * Math.PI) / 4);
      line("M0-199V-173", ink.accent, 3);
      line("M-5-203H5", ink.colour, 1);
      c.restore();
    }
    line(
      "M163 80H101V142M349 80H411V142M411 370V432H349M163 432H101V370",
      ink.colour,
      3,
    );
    text(ink.serial, 198, 59, 11);
    text("BINDING VERIFIED", 182, 462, 10, "#b2ccd8");
  } else if (region === "neon") {
    if (part === "device") {
      const hull = "M167 147L188 111H326L347 147 378 314 350 383H162L134 314Z";
      fill(hull, metal);
      line(hull, "#849dad", 2);
      fill("M195 159H317V328H195Z", "#06131d");
      fill("M218 175H294V311H218Z", "#122b3d");
      line("M225 182H287V304H225Z", ink.colour, 1);
      for (let i = 0; i < 7; i++) {
        const y = 183 + i * 17;
        line(`M231 ${y}H281`, i % 2 ? ink.accent : ink.colour, 3);
      }
      for (const x of [161, 324]) {
        fill(`M${x} 178h25v135h-25Z`, metal);
        for (let i = 0; i < 5; i++)
          line(`M${x + 4} ${192 + i * 23}h17`, ink.colour, 3);
      }
      line("M157 326L174 359H338L356 326", "#b9c9cf", 3);
      text("VECTOR LANCE", 206, 344, 11);
      text("VL-01 // COHERENCE ARRAY", 180, 375, 8, "#91abb9");
      fill("M217 119H295V147H217Z", "#d3e4e9");
      line("M229 125H283", ink.colour, 6);
      for (const [x, y] of [
        [171, 163],
        [341, 163],
        [165, 322],
        [346, 322],
      ]) {
        ring(x, y, 4, "#b9cfd9", 1);
        line(`M${x - 2} ${y}h4`, "#08121b", 1);
      }
    } else {
      const rail = "M216 71L243 49H270L292 71V375L275 405H233L216 375Z";
      fill(rail, metal);
      line(rail, "#9cb2bf", 2);
      fill("M245 73H264V363H245Z", "#071a25");
      line("M254 80V350", ink.colour, 4);
      for (let i = 0; i < 6; i++)
        line(`M224 ${120 + i * 35}h16M271 ${120 + i * 35}h13`, ink.accent, 2);
      fill("M237 53H273V79H237Z", "#d1eff4");
      text("ION / RAIL", 226, 385, 7);
    }
  } else if (region === "foundry") {
    if (part === "device") {
      const frame = "M88 126H205L242 167V345L205 386H88L63 350V161Z";
      fill(frame, metal);
      line(frame, "#b6b5a1", 2);
      fill("M90 165H177V348H90Z", "#0c1c24");
      for (let i = 0; i < 7; i++)
        line(`M101 ${182 + i * 22}H166`, i % 2 ? ink.accent : ink.colour, 3);
      fill("M182 192H329V320H182Z", "#38494f");
      line("M189 203H320M189 309H320", "#a6bec0", 4);
      for (const y of [218, 287]) {
        fill(`M202 ${y}H358V${y + 10}H202Z`, metal);
        line(`M214 ${y + 3}H348`, "#c9e1d9", 2);
      }
      fill("M256 229H335V281H256Z", "#102a2d");
      line("M262 239H327M262 249H327M262 259H327", ink.accent, 2);
      text("POLARITY", 91, 143, 11);
      text("PC / 02", 99, 372, 9);
      text("180 kN", 188, 338, 8, "#d3ddc6");
      for (let i = 0; i < 5; i++)
        fill(
          `M${84 + i * 18} 154l8-12h8l-8 12Z`,
          i % 2 ? "#27353c" : ink.colour,
        );
    } else {
      const jaw =
        "M216 112H310L360 155V191H300V321H360V357L310 400H216L199 374V138Z";
      fill(jaw, metal);
      line(jaw, "#b6c1b7", 2);
      line("M228 136H300L336 164M228 374H300L336 346", ink.colour, 4);
      line("M280 204V306", ink.accent, 4);
      for (let i = 0; i < 4; i++) {
        fill(`M298 ${207 + i * 25}h17v12h-17Z`, i % 2 ? "#9cafa8" : ink.colour);
      }
      fill("M216 172H256V338H216Z", "#111f25");
      for (let i = 0; i < 6; i++)
        line(`M224 ${188 + i * 23}h24`, ink.accent, 1.5);
      text("MAG / GRIP", 213, 363, 7);
      ring(246, 155, 8, "#a6b4a6", 2);
      ring(246, 354, 8, "#a6b4a6", 2);
    }
  } else if (region === "verdant") {
    if (part === "device") {
      const anchor = "M256 89L372 174 348 308 256 394 164 308 140 174Z";
      fill(anchor, metal);
      line(anchor, "#86b1ae", 2);
      fill("M256 128L335 187 320 284 256 350 192 284 177 187Z", "#0b252b");
      line(
        "M256 137V340M184 198L256 238 328 198M256 238L194 281M256 238L318 281",
        ink.colour,
        2,
      );
      for (const [x, y] of [
        [256, 170],
        [208, 269],
        [304, 269],
      ]) {
        ring(x, y, 19, ink.accent, 2);
        fill(`M${x - 7} ${y - 7}h14v14h-14Z`, ink.colour);
      }
      text("GRAPH REAPER", 211, 322, 9);
      text("GR / 03", 221, 374, 9);
    } else {
      const cutter =
        "M256 97L319 172 291 226 307 315 256 390 205 315 221 226 193 172Z";
      fill(cutter, metal);
      line(cutter, ink.colour, 2);
      line("M256 119V364", ink.accent, 4);
      line("M215 174L256 220 297 174M222 301L256 348 290 301", ink.colour, 2);
      fill("M245 222H267V294H245Z", "#d5ffdf");
      text("CUT / EDGE", 223, 326, 7);
    }
  } else {
    if (part === "device") {
      const cannon = "M183 95H329L363 136V342L331 397H181L149 342V136Z";
      fill(cannon, metal);
      line(cannon, "#829ca9", 2);
      fill("M188 144H324V333H188Z", "#061018");
      line("M208 155V323M304 155V323", ink.colour, 4);
      line("M226 164V306M286 164V306", ink.accent, 2);
      fill("M237 174H275V289H237Z", "#152833");
      for (let i = 0; i < 6; i++)
        line(`M244 ${184 + i * 16}H268`, i % 2 ? "#e8ffdf" : ink.colour, 2);
      fill("M187 111H325V144H187Z", "#263c49");
      line("M201 125H311", ink.colour, 5);
      line("M171 337L190 370H322L341 337", "#acc2cc", 3);
      text("NULLPOINT", 222, 349, 11);
      text("NC-04 / PROCESS PURGE", 190, 385, 8, "#94acb8");
      for (const x of [166, 334])
        for (let i = 0; i < 4; i++)
          line(`M${x} ${172 + i * 38}h12`, ink.accent, 3);
    } else {
      const shutter =
        "M256 80L328 171 280 256 328 341 256 432 222 341 246 256 222 171Z";
      fill(shutter, metal);
      line(shutter, "#738c9b", 2);
      line("M256 101L307 172 265 256 307 340 256 409", ink.colour, 3);
      line("M249 137V202M249 310V375", ink.accent, 1);
      text("NULL", 250, 247, 7);
      text("SEAL", 250, 266, 7);
    }
  }
  plates.set(key, canvas);
  return canvas;
}
