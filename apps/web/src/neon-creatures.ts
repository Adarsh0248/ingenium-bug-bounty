import type { BugMotion } from "./bug-art";

export const neonBodies: Record<BugMotion, string> = {
  FLY: "M128 41C113 41 108 54 114 70L112 86C105 101 108 120 117 130L116 152Q116 185 128 209Q140 185 140 152L139 130C148 120 151 101 144 86L142 70C148 54 143 41 128 41Z",
  WALK: "M128 34C109 34 98 46 102 66L94 78C82 91 76 119 78 150C80 191 96 220 128 231C160 220 176 191 178 150C180 119 174 91 162 78L154 66C158 46 147 34 128 34Z",
  HOP: "M128 38L153 53Q151 65 137 73L140 108 150 136 144 176 128 223 112 176 106 136 116 108 119 73Q105 65 103 53Z",
  SKITTER:
    "M128 57C111 57 102 69 104 84L110 94C94 99 80 122 80 150C80 188 99 214 128 223C157 214 176 188 176 150C176 122 162 99 146 94L152 84C154 69 145 57 128 57Z",
  DRAG: "M128 39C109 39 102 53 106 71C96 81 95 95 101 108C93 121 94 137 101 149C98 162 101 178 108 187C108 206 116 220 128 229C140 220 148 206 148 187C155 178 158 162 155 149C162 137 163 121 155 108C161 95 160 81 150 71C154 53 147 39 128 39Z",
  DART: "M128 29C116 25 103 32 104 44Q104 55 119 59L117 75C110 89 113 111 121 124L121 169 124 224 128 239 132 224 135 169 135 124C143 111 146 89 139 75L137 59Q152 55 152 44C153 32 140 25 128 29Z",
};
const accents: Record<BugMotion, string> = {
  FLY: "#ff57dd",
  WALK: "#44ffc2",
  HOP: "#ba8aff",
  SKITTER: "#31eaff",
  DRAG: "#7bffae",
  DART: "#3bebff",
};
const mothWings = [
  "M119 98C98 66 64 24 34 27Q14 29 22 53C34 86 72 119 117 130Z",
  "M117 126C87 113 41 120 38 146C36 169 57 186 77 175L117 148Z",
];
const dragonWings = [
  "M120 85C90 57 44 40 22 48Q11 53 24 65C47 85 88 100 121 104Z",
  "M120 109C85 99 41 111 26 128Q18 139 35 140C62 139 94 128 122 126Z",
];
const armour: Record<BugMotion, string[]> = {
  FLY: [
    "M128 77Q109 84 116 113L128 128 140 113Q147 84 128 77Z",
    "M121 136L135 136 136 155 128 170 120 155Z",
    "M121 165L135 165Q134 187 128 198Q122 187 121 165Z",
  ],
  WALK: [
    "M123 83C98 80 85 105 86 145C87 179 99 205 123 219Z",
    "M133 83C158 80 171 105 170 145C169 179 157 205 133 219Z",
    "M103 68Q128 58 153 68L159 82Q128 73 97 82Z",
  ],
  HOP: [
    "M128 77L135 108 128 124 121 108Z",
    "M128 119L144 138 138 168 128 181 118 168 112 138Z",
    "M119 180L128 190 137 180 128 214Z",
  ],
  SKITTER: [
    "M123 107C104 105 87 124 89 152Q91 190 123 209Z",
    "M133 107C152 105 169 124 167 152Q165 190 133 209Z",
  ],
  DRAG: [
    "M107 81Q128 72 149 81L151 98Q128 108 105 98Z",
    "M104 115Q128 106 152 115L151 135Q128 146 105 135Z",
    "M107 151Q128 144 149 151L146 171Q128 181 110 171Z",
    "M114 187Q128 181 142 187Q141 207 128 218Q115 207 114 187Z",
  ],
  DART: [
    "M128 65Q114 80 119 102L128 118 137 102Q142 80 128 65Z",
    "M124 127L132 127 132 170 128 185 124 170Z",
  ],
};
const faces: Record<
  BugMotion,
  { head: string; eyes: string; antennae: string }
> = {
  FLY: {
    head: "M128 45Q111 44 115 62L122 71 134 71 141 62Q145 44 128 45Z",
    eyes: "M115 51L123 54 121 62 116 59ZM141 51L133 54 135 62 140 59Z",
    antennae: "M119 47Q110 28 96 29M137 47Q146 28 160 29",
  },
  WALK: {
    head: "M128 38Q103 39 107 60L117 67 139 67 149 60Q153 39 128 38Z",
    eyes: "M108 49L120 52 118 58 110 55ZM148 49L136 52 138 58 146 55Z",
    antennae: "M110 44L99 29 89 31M146 44L157 29 167 31",
  },
  HOP: {
    head: "M128 42L148 55 135 67 121 67 108 55Z",
    eyes: "M109 54L121 55 117 61ZM147 54L135 55 139 61Z",
    antennae: "M120 45L112 23 104 15M136 45L144 23 152 15",
  },
  SKITTER: {
    head: "M128 61L143 67 148 81 137 94 119 94 108 81 113 67Z",
    eyes: "M114 73H120V79H114ZM124 69H132V76H124ZM136 73H142V79H136Z",
    antennae: "M117 91L111 101M139 91L145 101",
  },
  DRAG: {
    head: "M128 43Q109 43 110 61L118 73 138 73 146 61Q147 43 128 43Z",
    eyes: "M112 55L122 57 121 63 114 61ZM144 55L134 57 135 63 142 61Z",
    antennae: "M116 47Q108 32 103 36M140 47Q148 32 153 36",
  },
  DART: {
    head: "M128 33C115 29 107 36 109 45L120 54 136 54 147 45C149 36 141 29 128 33Z",
    eyes: "M110 38Q117 31 123 38L121 47 114 47ZM146 38Q139 31 133 38L135 47 142 47Z",
    antennae: "M124 32L120 21M132 32L136 21",
  },
};
export const legPaths: Record<BugMotion, string[]> = {
  FLY: [
    "M118 111 91 102 74 117",
    "M119 122 92 128 79 152",
    "M119 130 86 151 77 178",
  ],
  DART: [
    "M120 90 99 72 90 49",
    "M120 109 91 123 85 154",
    "M122 128 105 157 97 190",
  ],
  WALK: [
    "M100 84 72 72 49 36",
    "M82 119 53 108 32 130",
    "M85 167 55 188 47 224",
  ],
  HOP: [
    "M119 73 83 59 68 88 92 112",
    "M114 117 74 132 49 98",
    "M114 162 62 192 46 232",
  ],
  SKITTER: [
    "M111 92 77 66 36 58",
    "M94 111 61 96 25 118",
    "M88 147 58 156 31 190",
    "M102 181 76 200 68 236",
  ],
  DRAG: [
    "M105 94 85 100 81 111",
    "M101 132 83 141 83 151",
    "M109 175 91 183 94 197",
  ],
};
export type NeonPart =
  "body" | "left" | "right" | "leftWing" | "rightWing" | "all";
const plates = new Map<string, HTMLCanvasElement>();

export function neonPlate(motion: BugMotion, part: NeonPart = "all") {
  const key = `${motion}:${part}`;
  if (plates.has(key)) return plates.get(key)!;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const c = canvas.getContext("2d")!,
    accent = accents[motion];
  c.lineJoin = "round";
  c.lineCap = "round";
  const trace = (d: string, colour: string, width = 1.5) => {
    c.strokeStyle = colour;
    c.lineWidth = width;
    c.stroke(new Path2D(d));
  };
  const paint = (d: string, fill: string | CanvasGradient) => {
    c.fillStyle = fill;
    c.fill(new Path2D(d));
  };
  const limb = (right: boolean, wingOnly = false) => {
    c.save();
    if (right) {
      c.translate(256, 0);
      c.scale(-1, 1);
    }
    if (!wingOnly)
      for (const path of legPaths[motion]) {
        trace(path, "#050e22", 6);
        trace(path, "#52778f", 3);
        trace(path, "#9cefff", 1);
      }
    if (
      (wingOnly || part === "all") &&
      (motion === "FLY" || motion === "DART")
    ) {
      for (const [index, wing] of (motion === "FLY"
        ? mothWings
        : dragonWings
      ).entries()) {
        const shape = new Path2D(wing),
          fill = c.createLinearGradient(25, 45, 120, 145);
        fill.addColorStop(0, motion === "FLY" ? "#b77aff" : "#67eeefdc");
        fill.addColorStop(0.45, motion === "FLY" ? "#6353b5" : "#21758fca");
        fill.addColorStop(1, "#152941");
        c.strokeStyle = "#050d22";
        c.lineWidth = 6;
        c.stroke(shape);
        c.fillStyle = fill;
        c.fill(shape);
        c.strokeStyle = motion === "FLY" ? "#e4a1ff" : "#80fcff";
        c.lineWidth = 1.3;
        c.stroke(shape);
        c.save();
        c.clip(shape);
        if (motion === "FLY") {
          paint(
            index
              ? "M31 134L84 128 52 170 28 170Z"
              : "M19 23L83 36 47 69 18 56Z",
            "#e86cb4",
          );
          paint(
            index ? "M57 162L103 135 80 177Z" : "M28 43L101 87 72 90Z",
            "#76e9e2",
          );
          trace(
            index ? "M46 149Q69 137 109 136" : "M31 47Q62 72 112 106",
            "#e4eaffb3",
            2,
          );
        }
        for (let i = 0; i < 4; i++)
          trace(
            `M119 ${index ? 118 : 99}Q${57 + i * 12} ${index ? 121 : 54} ${26 + i * 19} ${index ? 144 : 45}`,
            "#c1f7ff65",
            1,
          );
        c.restore();
      }
    }
    c.restore();
  };
  if (part === "all" || part === "left") limb(false);
  if (part === "all" || part === "right") limb(true);
  if (part === "leftWing") limb(false, true);
  if (part === "rightWing") limb(true, true);
  if (part === "all" || part === "body") {
    const shell = new Path2D(neonBodies[motion]),
      fill = c.createLinearGradient(80, 70, 173, 190),
      enamel = c.createLinearGradient(89, 80, 161, 205);
    fill.addColorStop(0, "#59768f");
    fill.addColorStop(0.35, "#233a52");
    fill.addColorStop(0.7, "#0a162a");
    fill.addColorStop(1, "#364c68");
    enamel.addColorStop(0, "#b9faff");
    enamel.addColorStop(0.18, accent);
    enamel.addColorStop(
      0.55,
      motion === "WALK" || motion === "DRAG" ? "#167c79" : "#364e83",
    );
    enamel.addColorStop(1, "#13233c");
    c.strokeStyle = "#040b1b";
    c.lineWidth = 7;
    c.stroke(shell);
    c.fillStyle = fill;
    c.fill(shell);
    c.strokeStyle = "#95b7cc";
    c.lineWidth = 1.2;
    c.stroke(shell);
    c.save();
    c.clip(shell);
    for (const panel of armour[motion]) {
      paint(panel, enamel);
      trace(panel, "#0a172c", 2.5);
    }
    if (motion === "WALK" || motion === "SKITTER") {
      trace("M128 87V218", "#060f21", 4);
      trace("M102 98Q87 149 107 184", "#d2fff6a0", 3);
      trace("M151 110Q166 155 148 190", accent, 1.2);
      paint("M119 87L128 79 137 87 128 98Z", accent);
    } else if (motion === "DART") {
      for (let y = 143; y < 223; y += 16)
        trace(`M121 ${y}Q128 ${y + 4} 135 ${y}`, accent, 2.5);
      trace("M126 77V104", "#dcffff", 2);
    } else if (motion === "FLY") {
      trace("M124 86Q118 100 124 110", "#fff0fc", 2);
      trace("M119 153H137M122 178H134", accent, 2);
    } else if (motion === "HOP") {
      trace("M116 139L128 151 140 139M119 161L128 171 137 161", "#c4abff", 2);
    } else {
      for (let y = 85; y < 176; y += 35)
        trace(`M111 ${y}Q121 ${y - 4} 130 ${y - 2}`, "#e3ffedb3", 2.5);
    }
    const face = faces[motion];
    paint(face.head, "#14253e");
    trace(face.head, "#7197b1", 1.3);
    trace(face.eyes, "#030b19", 5);
    paint(face.eyes, accent);
    trace("M124 65H132", "#c8f8ff75", 1);
    c.restore();
    trace(face.antennae, "#050e22", 4);
    trace(face.antennae, "#95bbcf", 1.5);
  }
  plates.set(key, canvas);
  return canvas;
}
