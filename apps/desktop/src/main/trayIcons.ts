import { type NativeImage, nativeImage } from "electron";

/**
 * Menu-bar icons drawn programmatically (no binary assets) as macOS *template*
 * images: black with an alpha mask, so the system tints them for light/dark
 * menu bars. The mark is a crescent moon (the app sleeps while you do):
 *   resting  → dim crescent
 *   dreaming → bright crescent
 *   ready    → bright crescent + a badge dot (a dream awaits review)
 */

const DIM = 36; // 18pt @2x
const SCALE = 2;
const C = (DIM - 1) / 2;
const R = DIM * 0.4;
const EDGE = 0.75; // anti-alias softness in px

export type TrayKind = "resting" | "dreaming" | "ready";

type AlphaFn = (x: number, y: number) => number;

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function dist(x: number, y: number, cx: number, cy: number): number {
  const dx = x - cx;
  const dy = y - cy;
  return Math.sqrt(dx * dx + dy * dy);
}

function disc(x: number, y: number, cx: number, cy: number, r: number): number {
  return clamp01((r - dist(x, y, cx, cy)) / EDGE + 0.5);
}

/** A crescent: the main disc with a slightly offset disc bitten out of it. */
function crescent(x: number, y: number): number {
  const main = disc(x, y, C, C, R);
  const cut = disc(x, y, C + R * 0.52, C - R * 0.16, R * 0.9);
  return clamp01(main - cut);
}

/** Crescent plus a small badge dot in the upper-right. */
function crescentBadge(x: number, y: number): number {
  const dot = disc(x, y, C + R * 0.82, C - R * 0.82, R * 0.3);
  return Math.max(crescent(x, y), dot);
}

function build(fn: AlphaFn, alphaMul = 1): NativeImage {
  const buf = Buffer.alloc(DIM * DIM * 4);
  for (let y = 0; y < DIM; y++) {
    for (let x = 0; x < DIM; x++) {
      const alpha = clamp01(fn(x, y) * alphaMul);
      const i = (y * DIM + x) * 4;
      // BGRA; template images use the alpha channel as the mask.
      buf[i] = 0;
      buf[i + 1] = 0;
      buf[i + 2] = 0;
      buf[i + 3] = Math.round(alpha * 255);
    }
  }
  const img = nativeImage.createFromBitmap(buf, {
    width: DIM,
    height: DIM,
    scaleFactor: SCALE,
  });
  img.setTemplateImage(true);
  return img;
}

const icons: Record<TrayKind, NativeImage> = {
  resting: build(crescent, 0.5),
  dreaming: build(crescent, 1),
  ready: build(crescentBadge, 1),
};

export function getTrayIcon(kind: TrayKind): NativeImage {
  return icons[kind];
}

// Pulse frames for the "dreaming" animation — the crescent breathes in and out.
const DREAM_FRAMES: NativeImage[] = [1, 0.82, 0.6, 0.45, 0.6, 0.82].map((a) =>
  build(crescent, a)
);

export function getDreamingFrame(i: number): NativeImage {
  return DREAM_FRAMES[i % DREAM_FRAMES.length];
}

/**
 * A waxing moon whose lit area grows with dream progress (thin crescent → full
 * disc): the menu-bar icon literally fills as the session runs. Paused dims it.
 */
function moonAt(p: number): AlphaFn {
  const offset = R * (0.52 + 1.7 * clamp01(p));
  return (x, y) =>
    clamp01(
      disc(x, y, C, C, R) - disc(x, y, C + offset, C - R * 0.16, R * 0.9)
    );
}

export function moonForProgress(
  progress: number,
  paused: boolean
): NativeImage {
  return build(moonAt(progress), paused ? 0.45 : 1);
}
