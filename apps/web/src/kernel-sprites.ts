import { drawKernelBug, drawKernelGround, kernelBodyScale } from "./kernel-art";
import type { kernelAppearance } from "./kernel-art";
import type { Roamer } from "./bug-swarm";

type Sheet = {
  count: number;
  columns: number;
  url: string | null;
  canvas: HTMLCanvasElement;
  image?: HTMLImageElement;
  className: string;
};
// The browser moves decoded pose sheets; no per-frame bitmap rotation or rescaling on the main canvas.
export function createKernelSprites() {
  const sheets = new Map<string, Sheet>();
  const styles = document.createElement("style");
  document.head.append(styles);
  const surfaces = new WeakMap<
    HTMLDivElement,
    { sheet?: string; position?: string; visible?: boolean; ring?: HTMLElement }
  >();
  let closed = false;
  return {
    draw(
      c: CanvasRenderingContext2D,
      a: Roamer,
      art: ReturnType<typeof kernelAppearance>,
      t: number,
      trail: { x: number; y: number }[],
      surface: HTMLDivElement | undefined,
      paint: boolean,
    ) {
      if (art.kind === 1) {
        if (paint) drawKernelBug(c, a, art, t, trail);
        return;
      }
      const moving = [2, 3, 7].includes(art.kind) ? true : a.moving,
        count =
          art.kind === 5 ||
          (!moving && art.kind !== 6) ||
          (art.kind === 6 && moving)
            ? 1
            : art.kind === 4
              ? 48
              : 32,
        key = `${art.kind}:${moving}`,
        tau = Math.PI * 2;
      let sheet = sheets.get(key);
      let state = surface ? surfaces.get(surface) : undefined;
      if (surface && !state) {
        state = {};
        surfaces.set(surface, state);
      }
      if (!sheet) {
        const columns = Math.min(count, 8),
          canvas = document.createElement("canvas");
        canvas.width = columns * 128;
        canvas.height = Math.ceil(count / columns) * 128;
        const ctx = canvas.getContext("2d")!;
        for (let i = 0; i < count; i++) {
          const phase = i / count,
            distance =
              art.kind === 4
                ? (phase * tau) / 10
                : art.kind === 7
                  ? (phase * 1.12 * kernelBodyScale) / 48
                  : (phase * tau) / 2.8,
            time =
              art.kind === 2
                ? (phase * tau) / 1.5
                : art.kind === 3
                  ? (phase * tau) / 4
                  : art.kind === 6
                    ? (phase * tau) / 2
                    : (phase * tau) / 25;
          ctx.setTransform(
            1,
            0,
            0,
            1,
            (i % columns) * 128,
            Math.floor(i / columns) * 128,
          );
          drawKernelBug(
            ctx,
            { ...a, x: 64, y: 64, heading: 0, distance, moving },
            { ...art, size: 1, tier: 0 },
            time,
            [],
            true,
          );
        }
        sheet = {
          count,
          columns,
          url: null,
          canvas,
          className: `kernel-skin-${art.kind}-${moving ? 1 : 0}`,
        };
        sheets.set(key, sheet);
        const target = sheet;
        canvas.toBlob((blob) => {
          if (!blob || closed) return;
          const reader = new FileReader();
          reader.onload = () => {
            if (closed) return;
            const image = new Image();
            target.image = image;
            image.onload = () => {
              if (!closed) {
                target.url = String(reader.result);
                styles.sheet!.insertRule(
                  `.${target.className}{background-image:url("${target.url}");background-size:${columns * 128}px ${Math.ceil(count / columns) * 128}px}`,
                );
                canvas.width = 0;
              }
            };
            image.src = String(reader.result);
          };
          reader.readAsDataURL(blob);
        }, "image/png");
      }
      if (!sheet.url || !surface) {
        if (surface && state!.visible !== false) {
          surface.style.visibility = "hidden";
          state!.visible = false;
        }
        if (paint) drawKernelBug(c, a, art, t, trail);
        return;
      }
      if (paint) drawKernelGround(c, a, art, t);
      if (!state!.visible) {
        surface.style.visibility = "visible";
        state!.visible = true;
      }
      const phase =
          art.kind === 4
            ? (a.distance * 10) / tau
            : art.kind === 7
              ? (a.distance * 48) / kernelBodyScale / 1.12
              : art.kind === 2
                ? (t * 1.5) / tau
                : art.kind === 3
                  ? (t * 4) / tau
                  : art.kind === 6
                    ? (t * 2) / tau
                    : (a.distance * 2.8) / tau,
        frame = Math.floor((((phase % 1) + 1) % 1) * count);
      if (state!.sheet !== sheet.className) {
        if (state!.sheet) surface.classList.remove(state!.sheet);
        surface.classList.add(sheet.className);
        state!.sheet = sheet.className;
      }
      const position = `${-(frame % sheet.columns) * 128}px ${-Math.floor(frame / sheet.columns) * 128}px`;
      if (state!.position !== position) {
        surface.style.backgroundPosition = position;
        state!.position = position;
      }
      if (art.kind === 7 || art.kind === 6) {
        let ring = state!.ring;
        if (!ring) {
          ring = document.createElement("i");
          ring.className = art.kind === 7 ? "kernel-restraint" : "kernel-iris";
          surface.append(ring);
          state!.ring = ring;
        }
        ring.style.transform = `rotate(${(t * (art.kind === 7 ? 0.7 : 0.6)).toFixed(4)}rad)`;
      }
    },
    count: () => [...sheets.values()].reduce((n, s) => n + s.count, 0),
    clear() {
      closed = true;
      for (const sheet of sheets.values()) {
        sheet.canvas.width = 0;
        if (sheet.image) sheet.image.onload = null;
      }
      sheets.clear();
      styles.remove();
    },
  };
}
