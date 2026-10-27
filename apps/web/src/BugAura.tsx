import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  NormalBlending,
  CanvasTexture,
  SRGBColorSpace,
} from "three";
import type { Sprite } from "three";
import type { bugAppearance } from "./bug-art";

type Appearance = ReturnType<typeof bugAppearance>;
// At most twelve shared textures; each aura adds one draw and no extra lights.
const textures = new Map<string, CanvasTexture>();
function auraTexture(bug: Appearance) {
  const key = `${bug.region.id}:${bug.rank.tier}`;
  if (textures.has(key)) return textures.get(key)!;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const c = canvas.getContext("2d")!;
  c.translate(128, 128);
  const glow = c.createRadialGradient(0, 0, 24, 0, 0, 118);
  glow.addColorStop(0, `${bug.color}00`);
  glow.addColorStop(0.5, `${bug.color}38`);
  glow.addColorStop(1, `${bug.color}00`);
  c.fillStyle = glow;
  c.fillRect(-128, -128, 256, 256);
  c.strokeStyle = c.fillStyle = bug.color;
  c.shadowColor = bug.color;
  c.shadowBlur = 6;
  c.lineWidth = 2;
  for (let ring = 0; ring < bug.rank.tier; ring++) {
    c.globalAlpha = 0.55 - ring * 0.1;
    c.setLineDash(bug.region.id === "neon" ? [12, 9] : []);
    c.beginPath();
    c.arc(0, 0, 66 + ring * 14, 0, Math.PI * 2);
    c.stroke();
  }
  c.setLineDash([]);
  c.globalAlpha = 0.85;
  for (let i = 0; i < 6 + bug.rank.tier * 2; i++) {
    c.save();
    c.rotate((i * Math.PI * 2) / (6 + bug.rank.tier * 2));
    c.translate(0, -96);
    c.beginPath();
    if (bug.region.id === "neon") {
      c.moveTo(0, -10);
      c.lineTo(5, 0);
      c.lineTo(0, 10);
      c.lineTo(-5, 0);
      c.closePath();
    } else if (bug.region.id === "foundry") {
      c.moveTo(0, -16);
      c.quadraticCurveTo(12, 5, 0, 9);
      c.quadraticCurveTo(-8, 3, 0, -16);
    } else if (bug.region.id === "verdant") {
      c.moveTo(0, 10);
      c.lineTo(0, -1);
      c.lineTo(-8, -9);
      c.moveTo(0, -1);
      c.lineTo(8, -9);
      c.stroke();
      c.rect(-10, -12, 4, 4);
      c.rect(6, -12, 4, 4);
    } else {
      c.strokeStyle = i % 2 ? "#4be4f5" : "#c7ff78";
      c.lineWidth = 1.5;
      c.moveTo(-8, -10);
      c.lineTo(-8, 8);
      c.lineTo(2, 8);
      c.moveTo(8, 10);
      c.lineTo(8, -8);
      c.lineTo(-2, -8);
      c.stroke();
      c.fillStyle = "#e3f9dc";
      c.fillRect(-2, -2, 4, 4);
    }
    if (bug.region.id !== "cryo") c.fill();
    c.restore();
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  textures.set(key, texture);
  return texture;
}
if (import.meta.hot)
  import.meta.hot.dispose(() => {
    for (const texture of textures.values()) texture.dispose();
    textures.clear();
  });

export default function BugAura({
  bug,
  still,
}: {
  bug: Appearance;
  still: boolean;
}) {
  const texture = useMemo(
      () => auraTexture(bug),
      [bug.region.id, bug.rank.tier],
    ),
    ref = useRef<Sprite>(null),
    time = useRef(0);
  const size =
    (3.4 + bug.rank.tier * 0.3) *
    (bug.region.id !== "neon" ? Math.max(0.7, bug.size * 0.75) : 1);
  useFrame((_, delta) => {
    if (!ref.current) return;
    if (!still) time.current += Math.min(delta, 0.05);
    const pulse = still
      ? 1
      : 1 +
        Math.sin(
          time.current * (bug.region.id === "foundry" ? 3 : 1.2) + bug.seed,
        ) *
          0.045;
    ref.current.scale.set(size * pulse, size * pulse, 1);
    ref.current.material.rotation =
      time.current *
      (bug.region.id === "neon"
        ? 0.12
        : bug.region.id === "verdant"
          ? 0.04
          : -0.06);
  });
  return (
    <sprite
      ref={ref}
      position={[0, 0, -0.35]}
      scale={[size, size, 1]}
      raycast={() => {}}
    >
      <spriteMaterial
        map={texture}
        transparent
        opacity={0.65 + bug.rank.tier * 0.1}
        depthWrite={false}
        toneMapped={false}
        blending={bug.region.id === "cryo" ? NormalBlending : AdditiveBlending}
      />
    </sprite>
  );
}
