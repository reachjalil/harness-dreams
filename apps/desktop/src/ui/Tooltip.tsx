import {
  type ReactElement,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import { Icon } from "./icons.js";

/**
 * A small, classy explainer tooltip. The bubble is portalled to <body> and
 * positioned with fixed coordinates so it never gets clipped by the app's
 * scroll wells — it prefers sitting above the trigger and flips below when
 * there isn't room. Reveals on hover and on keyboard focus; dismisses on
 * blur, Escape, scroll, or resize.
 */

type Placement = "top" | "bottom";

interface Coords {
  left: number;
  top: number;
  placement: Placement;
  /** Arrow offset from the bubble's left edge, in px. */
  arrow: number;
}

const SHOW_DELAY = 140;
const GAP = 9;
const MARGIN = 10;
const ARROW_INSET = 16;

function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(value, hi));
}

export function Tooltip({
  title,
  text,
  children,
  label,
  interactive = false,
  block = false,
  className,
}: {
  /** Bold lead-in, usually the term being defined. */
  title?: string | undefined;
  text: ReactNode;
  /** The trigger content (a label, chip, or glyph). */
  children: ReactNode;
  /** Accessible name for the trigger when its content is icon-only. */
  label?: string | undefined;
  /** Set when the child is itself focusable (e.g. a button): the wrapper drops
   *  its own tab stop and rides the child's focus, which still bubbles up. */
  interactive?: boolean;
  /** Render the wrapper as a full-width block (for block-level triggers). */
  block?: boolean;
  className?: string;
}): ReactElement {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<Coords | null>(null);
  const triggerRef = useRef<HTMLSpanElement | null>(null);
  const bubbleRef = useRef<HTMLDivElement | null>(null);
  const timer = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timer.current != null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const show = useCallback(() => {
    clearTimer();
    timer.current = window.setTimeout(() => setOpen(true), SHOW_DELAY);
  }, [clearTimer]);

  const hide = useCallback(() => {
    clearTimer();
    setOpen(false);
    setCoords(null);
  }, [clearTimer]);

  // Measure once the bubble is in the DOM, then place it before paint.
  useLayoutEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const bubble = bubbleRef.current;
    if (!trigger || !bubble) return;
    const t = trigger.getBoundingClientRect();
    const b = bubble.getBoundingClientRect();
    const vw = window.innerWidth;
    const fitsAbove = t.top - b.height - GAP >= MARGIN;
    const placement: Placement = fitsAbove ? "top" : "bottom";
    const top = fitsAbove ? t.top - b.height - GAP : t.bottom + GAP;
    const centerX = t.left + t.width / 2;
    const left = clamp(centerX - b.width / 2, MARGIN, vw - b.width - MARGIN);
    const arrow = clamp(centerX - left, ARROW_INSET, b.width - ARROW_INSET);
    setCoords({ left, top, placement, arrow });
  }, [open]);

  // Dismiss on anything that would leave the bubble stranded.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") hide();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
    };
  }, [open, hide]);

  useEffect(() => clearTimer, [clearTimer]);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: tooltip trigger needs mouse/focus events
    // biome-ignore lint/a11y/useAriaPropsSupportedByRole: aria-label on span is intentional for keyboard-accessible tooltip triggers
    <span
      ref={triggerRef}
      className={`tip-trigger${block ? " tip-block" : ""}${
        className ? ` ${className}` : ""
      }`}
      tabIndex={interactive ? undefined : 0}
      aria-label={interactive ? undefined : label}
      aria-describedby={open ? id : undefined}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {open
        ? createPortal(
            <div
              id={id}
              ref={bubbleRef}
              role="tooltip"
              className={`tip${coords ? " ready" : ""}${
                coords?.placement === "bottom" ? " below" : ""
              }`}
              style={
                coords
                  ? {
                      left: coords.left,
                      top: coords.top,
                      // Consumed by the arrow pseudo-element.
                      ["--tip-arrow" as string]: `${coords.arrow}px`,
                    }
                  : { left: -9999, top: -9999 }
              }
            >
              {title ? <span className="tip-title">{title}</span> : null}
              <span className="tip-text">{text}</span>
            </div>,
            document.body
          )
        : null}
    </span>
  );
}

/** Convenience trigger: a small "info" glyph that reveals an explainer. */
export function InfoTip({
  title,
  text,
  size = 13,
  className,
}: {
  title?: string | undefined;
  text: ReactNode;
  size?: number;
  className?: string;
}): ReactElement {
  return (
    <Tooltip
      title={title}
      text={text}
      label={title ? `About ${title}` : "More info"}
      className={`infotip${className ? ` ${className}` : ""}`}
    >
      <Icon name="about" size={size} className="infotip-icon" />
    </Tooltip>
  );
}
