import { useEffect, useRef, useState } from "react";

/**
 * Small animation helpers for the dashboard: count-up numbers, a mount flag to
 * trigger CSS transitions, and sparkline geometry — all honoring reduced motion.
 */

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = (): void =>
      setReduced(
        mq.matches || document.body.classList.contains("reduce-motion")
      );
    update();
    mq.addEventListener("change", update);
    const observer = new MutationObserver(update);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => {
      mq.removeEventListener("change", update);
      observer.disconnect();
    };
  }, []);
  return reduced;
}

/** Becomes true shortly after mount — flip CSS transition targets on it. */
export function useMounted(delayMs = 60): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setMounted(true), delayMs);
    return () => window.clearTimeout(id);
  }, [delayMs]);
  return mounted;
}

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

/** Animates 0 → target with requestAnimationFrame; jumps if reduced motion. */
export function useCountUp(target: number, durationMs = 900): number {
  const reduced = usePrefersReducedMotion();
  const [value, setValue] = useState(0);
  const frame = useRef(0);
  useEffect(() => {
    if (reduced) {
      setValue(target);
      return;
    }
    let start = 0;
    const step = (ts: number): void => {
      if (start === 0) start = ts;
      const t = Math.min(1, (ts - start) / durationMs);
      setValue(target * easeOutCubic(t));
      if (t < 1) frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame.current);
  }, [target, durationMs, reduced]);
  return value;
}

/** Strip currency/units and parse the leading number (for sparkline shapes). */
export function parseNum(s: string): number {
  const n = Number.parseFloat(s.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/** Build an SVG path for a sparkline normalized into a w×h box. */
export function sparklinePath(
  values: number[],
  w: number,
  h: number,
  pad = 3
): string {
  if (values.length === 0) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const stepX = values.length > 1 ? (w - pad * 2) / (values.length - 1) : 0;
  return values
    .map((v, i) => {
      const x = pad + i * stepX;
      const y = h - pad - ((v - min) / span) * (h - pad * 2);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}
