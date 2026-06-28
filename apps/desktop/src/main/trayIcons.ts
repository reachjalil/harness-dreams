import { type NativeImage, nativeImage } from "electron";

/**
 * Menu-bar icons drawn programmatically (no binary assets) as macOS *template*
 * images: black with an alpha mask, so the system tints them for light/dark
 * menu bars. The mark follows the Harness Dreams logo: crescent, orbit, and
 * planet. The orbit/planet keep the tray item from reading like macOS Do Not
 * Disturb while preserving the app's sleep/dream metaphor.
 */

const DIM = 36; // 18pt @2x
const SCALE = 2;
const EDGE = 0.75; // anti-alias softness in px.
const SVG = DIM / 32;

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

function logoDisc(
  x: number,
  y: number,
  cx: number,
  cy: number,
  r: number
): number {
  return disc(x, y, cx * SVG, cy * SVG, r * SVG);
}

function logoEllipseStroke(
  x: number,
  y: number,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  rotationDeg: number,
  stroke: number
): number {
  const theta = (-rotationDeg * Math.PI) / 180;
  const dx = x - cx * SVG;
  const dy = y - cy * SVG;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  const ex = dx * cos - dy * sin;
  const ey = dx * sin + dy * cos;
  const norm = Math.sqrt(
    (ex / (rx * SVG)) * (ex / (rx * SVG)) +
      (ey / (ry * SVG)) * (ey / (ry * SVG))
  );
  const edgeDistance = Math.abs(norm - 1) * ry * SVG;
  return clamp01(((stroke * SVG) / 2 - edgeDistance) / EDGE + 0.5);
}

function angularDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 1;
  return Math.min(d, 1 - d);
}

function logoOrbit(
  x: number,
  y: number,
  progress = 1,
  cyclePhase: number | null = null
): number {
  const orbit = logoEllipseStroke(x, y, 16, 18.15, 12.3, 4.45, -20, 0.9);
  const orbitAlpha = 0.68;

  const theta = (20 * Math.PI) / 180;
  const dx = x - 16 * SVG;
  const dy = y - 18 * SVG;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  const ex = dx * cos - dy * sin;
  const ey = dx * sin + dy * cos;
  const angle = Math.atan2(ey / (4.6 * SVG), ex / (12.5 * SVG));
  const normalized = (angle + Math.PI) / (Math.PI * 2);
  const sweep = 0.18 + clamp01(progress) * 0.82;
  const base = normalized <= sweep ? orbitAlpha : orbitAlpha * 0.22;

  if (cyclePhase === null) return orbit * base;

  const highlight = clamp01(
    (0.11 - angularDistance(normalized, cyclePhase)) / 0.11
  );
  return orbit * Math.min(0.9, base + highlight * 0.34);
}

/** Logo crescent: the brand disc with the matching offset disc cut out. */
function logoCrescent(x: number, y: number): number {
  const main = logoDisc(x, y, 14.1, 16.1, 11.35);
  const cut = logoDisc(x, y, 21.1, 13.35, 9.95);
  return clamp01(main - cut);
}

function logoPlanet(x: number, y: number): number {
  return logoDisc(x, y, 27.2, 8.6, 1.75);
}

function logoMark(progress = 1, cyclePhase: number | null = null): AlphaFn {
  return (x, y) => {
    return Math.max(
      logoCrescent(x, y),
      logoOrbit(x, y, progress, cyclePhase),
      logoPlanet(x, y)
    );
  };
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
  resting: build(logoMark(), 0.52),
  dreaming: build(logoMark(), 1),
  ready: build(logoMark(), 1),
};

export function getTrayIcon(kind: TrayKind): NativeImage {
  return icons[kind];
}

// Pulse frames for the "dreaming" animation — the brand mark breathes in and out.
const DREAM_FRAMES: NativeImage[] = [1, 0.82, 0.6, 0.45, 0.6, 0.82].map((a) =>
  build(logoMark(), a)
);

export function getDreamingFrame(i: number): NativeImage {
  return DREAM_FRAMES[i % DREAM_FRAMES.length];
}

/**
 * The logo's orbit brightens as a dream progresses. Paused dims the whole mark.
 */
export function moonForProgress(
  progress: number,
  paused: boolean,
  cycleFrame = 0
): NativeImage {
  const phase = paused ? null : (cycleFrame % 24) / 24;
  return build(logoMark(progress, phase), paused ? 0.45 : 1);
}
