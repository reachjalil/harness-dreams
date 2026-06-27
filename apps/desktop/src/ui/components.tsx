import type { ReactElement, ReactNode } from "react";

import type { Metric, Ring } from "../shared/types";

/** The "Quiet Orbit" mark: a dusk crescent inside a tilted orbit with a teal moon. */
export function BrandMark({ size = 30 }: { size?: number }): ReactElement {
  return (
    <svg
      className="brandmark"
      width={size}
      height={size}
      viewBox="0 0 30 30"
      role="img"
      aria-label="Harness Dreams"
    >
      <ellipse
        cx="15"
        cy="15"
        rx="13.5"
        ry="5.4"
        fill="none"
        stroke="var(--accent-line)"
        strokeWidth="1.1"
        transform="rotate(-24 15 15)"
      />
      <path
        d="M19 6.6a8.6 8.6 0 1 0 0 16.8 7 7 0 0 1 0-16.8z"
        fill="var(--accent)"
      />
      <circle cx="27.5" cy="9.2" r="1.9" fill="var(--ring-effectiveness)" />
    </svg>
  );
}

// ── Layout / form atoms (shared with the SpeechGlow design system) ───────────

export function Section({
  title,
  hint,
  right,
  children,
}: {
  title: string;
  hint?: string;
  right?: ReactNode;
  children: ReactNode;
}): ReactElement {
  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2 className="card-title">{title}</h2>
          {hint ? <p className="card-hint">{hint}</p> : null}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

export interface Option<T extends string> {
  value: T;
  label: string;
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
  ariaLabel?: string;
}): ReactElement {
  return (
    <div className="seg" role="radiogroup" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          className={`seg-btn${value === option.value ? " active" : ""}`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
}): ReactElement {
  return (
    <label className={`toggle${disabled ? " disabled" : ""}`}>
      <span className="toggle-text">
        <span className="toggle-label">{label}</span>
        {hint ? <span className="toggle-hint">{hint}</span> : null}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        className={`switch${checked ? " on" : ""}`}
        onClick={() => onChange(!checked)}
      >
        <span className="knob" />
      </button>
    </label>
  );
}

export function Button({
  children,
  onClick,
  variant = "default",
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "default" | "ghost" | "accent" | "danger";
  disabled?: boolean;
}): ReactElement {
  return (
    <button
      type="button"
      className={`btn ${variant}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}): ReactElement {
  return (
    <div className="field">
      <div className="field-label">{label}</div>
      {children}
    </div>
  );
}

export function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "good" | "warn" | "danger" | "accent";
}): ReactElement {
  return <span className={`pill ${tone}`}>{children}</span>;
}

// ── Health-specific atoms ────────────────────────────────────────────────────

/** Apple-Activity-style concentric rings. Each ring fills to its score (0..100). */
export function Rings({ rings }: { rings: Ring[] }): ReactElement {
  const size = 132;
  const center = size / 2;
  const stroke = 12;
  const gap = 5;
  return (
    <svg
      className="rings"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label="Harness health rings"
    >
      {rings.map((ring, i) => {
        const radius = center - stroke / 2 - i * (stroke + gap);
        const score = Math.max(0, Math.min(100, ring.score));
        return (
          <g key={ring.key} transform={`rotate(-90 ${center} ${center})`}>
            <circle
              className="ring-track"
              cx={center}
              cy={center}
              r={radius}
              strokeWidth={stroke}
              fill="none"
            />
            <circle
              className={`ring-arc ${ring.key}`}
              cx={center}
              cy={center}
              r={radius}
              strokeWidth={stroke}
              fill="none"
              pathLength={100}
              strokeDasharray={`${score} 100`}
              strokeLinecap="round"
            />
          </g>
        );
      })}
    </svg>
  );
}

function deltaLabel(delta: number, unit = ""): string {
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta}${unit}`;
}

export function RingLegend({ rings }: { rings: Ring[] }): ReactElement {
  return (
    <div className="legend">
      {rings.map((ring) => (
        <div key={ring.key} className="legend-row">
          <span className={`legend-dot ${ring.key}`} />
          <div className="legend-main">
            <div className="legend-top">
              <span className="legend-label">{ring.label}</span>
              <span className="legend-score">{ring.score}</span>
            </div>
            <div className="legend-hint">{ring.hint}</div>
          </div>
          <span className={`legend-delta${ring.delta >= 0 ? " up" : " down"}`}>
            {deltaLabel(ring.delta)}
          </span>
        </div>
      ))}
    </div>
  );
}

const TREND_GLYPH = { up: "▲", down: "▼", flat: "→" } as const;

export function Stat({ metric }: { metric: Metric }): ReactElement {
  return (
    <div className="stat">
      <div className="stat-value">{metric.value}</div>
      <div className="stat-label">{metric.label}</div>
      <div className={`stat-delta${metric.good ? " good" : " warn"}`}>
        {TREND_GLYPH[metric.trend]} {deltaLabel(metric.delta, "%")}
      </div>
    </div>
  );
}
