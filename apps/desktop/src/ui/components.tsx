import { Fragment, type ReactElement, type ReactNode } from "react";

import logoUrl from "../assets/logo.png";
import type { DreamStage } from "../shared/stages";
import type {
  ActionCategory,
  ActionQueueEntry,
  ActionState,
  AlignmentBand,
  AlignmentSide,
  DreamPhase,
  DreamReport,
  Finding,
  FrictionPoint,
  Metric,
  Ring,
} from "../shared/types";
import { sparklinePath, useCountUp, useMounted } from "./anim";
import {
  CATEGORY_TIP,
  CONFIDENCE_TIP,
  FRICTION_TIP,
  METRIC_TIP,
  RING_TIP,
} from "./explainers";
import { Icon } from "./icons";
import { InfoTip, Tooltip } from "./Tooltip";

/** Workspace tabs; mirrors App.tsx. */
export type Tab = "today" | "cycle" | "lab" | "config" | "chat" | "settings";

/** The "Quiet Orbit" logo, in a light squircle chip so it reads on the dark UI. */
export function BrandMark({ size = 30 }: { size?: number }): ReactElement {
  return (
    <span className="brandmark" style={{ width: size, height: size }}>
      <img src={logoUrl} alt="Harness Dreams" />
    </span>
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
              <span className="legend-label">
                {ring.label}
                <InfoTip
                  title={RING_TIP[ring.key].title}
                  text={RING_TIP[ring.key].text}
                />
              </span>
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

/**
 * The hero score ring (Oura-style): three Apple-Activity arcs that sweep in on
 * mount, with the composite "dream score" counting up in the center.
 */
export function ScoreRing({
  rings,
  score,
}: {
  rings: Ring[];
  score: number;
}): ReactElement {
  const size = 188;
  const center = size / 2;
  const stroke = 13;
  const gap = 6;
  const mounted = useMounted();
  const display = Math.round(useCountUp(score));
  return (
    <div className="scorering">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={`Dream score ${score} of 100`}
      >
        {rings.map((ring, i) => {
          const radius = center - stroke / 2 - i * (stroke + gap);
          const s = Math.max(0, Math.min(100, ring.score));
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
                strokeLinecap="round"
                pathLength={100}
                strokeDasharray="100"
                strokeDashoffset={mounted ? 100 - s : 100}
              />
            </g>
          );
        })}
      </svg>
      <div className="scorering-center">
        <div className="scorering-num">{display}</div>
        <div className="scorering-label">Dream score</div>
      </div>
    </div>
  );
}

/** Apple-Health-style contributor rows — animated level bar per ring. */
export function Contributors({ rings }: { rings: Ring[] }): ReactElement {
  const mounted = useMounted();
  return (
    <div className="contribs">
      {rings.map((ring) => (
        <div key={ring.key} className="contrib">
          <div className="contrib-top">
            <span className="contrib-label">
              {ring.label}
              <InfoTip
                title={RING_TIP[ring.key].title}
                text={RING_TIP[ring.key].text}
              />
            </span>
            <span className="contrib-score">{ring.score}</span>
          </div>
          <div className="contrib-track">
            <div
              className={`contrib-bar ${ring.key}`}
              style={{ width: mounted ? `${ring.score}%` : "0%" }}
            />
          </div>
          <div className="contrib-foot">
            <span className="contrib-hint">{ring.hint}</span>
            <span
              className={`contrib-delta${ring.delta >= 0 ? " up" : " down"}`}
            >
              {deltaLabel(ring.delta)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function Sparkline({
  values,
  tone = "accent",
}: {
  values: number[];
  tone?: "good" | "warn" | "accent";
}): ReactElement {
  const mounted = useMounted();
  const w = 132;
  const h = 36;
  return (
    <svg
      className="spark"
      width="100%"
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        className={`spark-line ${tone}`}
        d={sparklinePath(values, w, h)}
        fill="none"
        pathLength={100}
        strokeDasharray="100"
        strokeDashoffset={mounted ? 0 : 100}
      />
    </svg>
  );
}

/** A vital: big value, delta, and a sparkline of recent sessions. */
export function VitalCard({
  metric,
  series,
}: {
  metric: Metric;
  series: number[];
}): ReactElement {
  return (
    <div className="vital">
      <div className="vital-top">
        <span className="vital-label">
          {metric.label}
          {METRIC_TIP[metric.key] ? (
            <InfoTip title={metric.label} text={METRIC_TIP[metric.key]} />
          ) : null}
        </span>
        <span className={`vital-delta${metric.good ? " good" : " warn"}`}>
          {TREND_GLYPH[metric.trend]} {deltaLabel(metric.delta, "%")}
        </span>
      </div>
      <div className="vital-value">{metric.value}</div>
      <Sparkline values={series} tone={metric.good ? "good" : "warn"} />
    </div>
  );
}

// ── Derivation helpers (so old reports without `alignment` still render) ──────

const BAND_LABEL: Record<AlignmentBand, string> = {
  collaborating: "Collaborating",
  friction: "Friction",
  fighting: "Fighting",
};

const CATEGORY_LABEL: Record<ActionCategory, string> = {
  agentsmd: "AGENTS.md update",
  claudemd: "CLAUDE.md update",
  contextdoc: "Context doc",
  prompthabit: "Prompt habit",
  skill: "Skill / routing",
};

const FRICTION_LABEL: Record<string, string> = {
  "config-conflict": "Config conflict",
  "missing-skill": "Missing skill",
  "wrong-domain": "Wrong domain",
  "unclear-prompt": "Unclear prompt",
};

const FINDING_LABEL: Record<string, string> = {
  win: "Win",
  mistake: "Mistake",
  opportunity: "Opportunity",
  risk: "Risk",
};

/** Map an alignment score to its band (≥80 / 45–79 / <45). */
export function band(score: number): AlignmentBand {
  if (score >= 80) return "collaborating";
  if (score >= 45) return "friction";
  return "fighting";
}

export function bandLabel(b: AlignmentBand): string {
  return BAND_LABEL[b];
}

/** Keyword map from a finding's action/improvement to an action category. */
export function categorize(finding: Finding): ActionCategory {
  if (finding.category) return finding.category;
  const text = `${finding.action} ${finding.improvement}`.toLowerCase();
  if (text.includes("claude.md")) return "claudemd";
  if (text.includes("agents.md") || text.includes("memory")) return "agentsmd";
  if (
    text.includes("skill") ||
    text.includes("codex") ||
    text.includes("route") ||
    text.includes("helper") ||
    text.includes("snippet")
  )
    return "skill";
  if (
    text.includes("before") ||
    text.includes("first prompt") ||
    text.includes("snapshot") ||
    text.includes("plan")
  )
    return "prompthabit";
  if (
    text.includes("doc") ||
    text.includes("canonical") ||
    text.includes("context")
  )
    return "contextdoc";
  return "contextdoc";
}

/** Derive the human/agent split (0..100) from a report. */
export function alignmentSplit(report: DreamReport): {
  human: number;
  agent: number;
  band: AlignmentBand;
} {
  const ring = report.rings.find((r) => r.key === "alignment");
  const score = report.alignment?.score ?? ring?.score ?? 0;
  // Skew the split toward the human side a touch, clamped to a believable band.
  const skew = Math.round((ring?.delta ?? 0) / 2);
  const human = Math.max(0, Math.min(100, score + Math.abs(skew)));
  const agent = Math.max(0, Math.min(100, score - Math.abs(skew)));
  return { human, agent, band: report.alignment?.band ?? band(score) };
}

// ── App shell ────────────────────────────────────────────────────────────────

function NavGlyph({ tab }: { tab: Tab }): ReactElement {
  // Simple, flat stroke glyphs — one per tab.
  const paths: Record<Tab, ReactNode> = {
    today: <path d="M3 9.5 10 4l7 5.5V16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5Z" />,
    cycle: (
      <>
        <path d="M13.6 3.4a6.7 6.7 0 1 0 3 9.4A5.6 5.6 0 0 1 7.2 6.9a5.6 5.6 0 0 1 6.4-3.5Z" />
        <path d="M16 3v3M14.5 4.5h3" strokeLinecap="round" />
      </>
    ),
    lab: (
      <>
        <circle cx="10" cy="10" r="6.5" />
        <circle cx="10" cy="10" r="2" />
        <path d="M10 1.8v2.4M10 15.8v2.4M1.8 10h2.4M15.8 10h2.4" />
      </>
    ),
    config: (
      <>
        <path d="M5 3.5h7l3 3V16a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" />
        <path d="M12 3.5V7h3M7 10h6M7 13h6" strokeLinecap="round" />
      </>
    ),
    chat: (
      <>
        <path d="M3 4.5h14a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H6l-4 3V5.5a1 1 0 0 1 1-1Z" />
      </>
    ),
    settings: (
      <>
        <path d="M4 6h12M4 14h12" strokeLinecap="round" />
        <circle cx="8" cy="6" r="2" />
        <circle cx="12" cy="14" r="2" />
      </>
    ),
  };
  return (
    <svg
      className="side-nav-icon"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      {paths[tab]}
    </svg>
  );
}

export function NavItem({
  icon,
  label,
  active,
  badge,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  active: boolean;
  badge?: number;
  onClick: () => void;
}): ReactElement {
  return (
    <button
      type="button"
      className={`side-nav-item${active ? " active" : ""}`}
      aria-current={active ? "page" : undefined}
      onClick={onClick}
    >
      {icon}
      <span className="side-nav-label">{label}</span>
      {badge ? <span className="side-nav-badge">{badge}</span> : null}
    </button>
  );
}

const PHASE_LABEL: Record<DreamPhase, string> = {
  resting: "Resting",
  dreaming: "Running",
  ready: "Ready",
};

/**
 * The always-present Cloud Sync call-to-action, pinned to the bottom-left of
 * the app shell. Opens the setup dialog; never changes any setting on its own.
 */
export function CloudSyncCTA({
  onClick,
}: {
  onClick: () => void;
}): ReactElement {
  return (
    <button type="button" className="cloud-cta" onClick={onClick}>
      <span className="cloud-cta-icon">
        <Icon name="cloudsync" size={15} />
      </span>
      <span className="cloud-cta-title">Set up Cloud Sync</span>
      <span className="cloud-cta-arrow" aria-hidden="true">
        ›
      </span>
    </button>
  );
}

export function Sidebar({
  active,
  onNavigate,
  alignment,
  band: bandValue,
  phase,
  lastDreamAt,
  unreviewed,
  onUpgrade,
}: {
  active: Tab;
  onNavigate: (tab: Tab) => void;
  alignment: number;
  band: AlignmentBand;
  phase: DreamPhase;
  lastDreamAt: number | null;
  unreviewed: number;
  onUpgrade: () => void;
}): ReactElement {
  const tabs: { tab: Tab; label: string }[] = [
    { tab: "today", label: "Home" },
    { tab: "cycle", label: "Sleep Cycles" },
    { tab: "lab", label: "Goals" },
    { tab: "config", label: "Config Updates" },
    { tab: "chat", label: "Chat" },
    { tab: "settings", label: "Settings" },
  ];
  const lastLabel = lastDreamAt
    ? new Date(lastDreamAt).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      })
    : "—";
  return (
    <aside className="sidebar">
      <div className="side-brand">
        <BrandMark size={26} />
        <span className="side-brand-text">
          <span className="side-brand-name">Harness Dreams</span>
          <span className="side-brand-sub">Local · Claude Code</span>
        </span>
      </div>
      <nav className="side-nav">
        {tabs.map(({ tab, label }) => (
          <NavItem
            key={tab}
            icon={<NavGlyph tab={tab} />}
            label={label}
            active={active === tab}
            badge={tab === "cycle" && unreviewed > 0 ? unreviewed : undefined}
            onClick={() => onNavigate(tab)}
          />
        ))}
      </nav>
      <div className="side-foot">
        <div className="side-align">
          <div className="side-align-top">
            <span className="side-align-eyebrow">
              Alignment
              <InfoTip
                title={RING_TIP.alignment.title}
                text={RING_TIP.alignment.text}
              />
            </span>
            <span className="side-align-num tnum">{alignment}</span>
          </div>
          <div className={`side-align-band ${bandValue}`}>
            {BAND_LABEL[bandValue]}
          </div>
        </div>
        <div className="side-status">
          <span className={`dot ${phase}`} />
          <span>{PHASE_LABEL[phase]}</span>
          <span className="side-status-sub">{lastLabel}</span>
        </div>
        <CloudSyncCTA onClick={onUpgrade} />
      </div>
    </aside>
  );
}

export type Crumb = { label: string; onClick?: () => void };

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  crumbs,
  primary,
  secondary,
}: {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  /** When provided, a breadcrumb replaces the eyebrow + title (e.g. wizards). */
  crumbs?: Crumb[];
  primary?: ReactNode;
  secondary?: ReactNode;
}): ReactElement {
  return (
    <header className="page-head">
      <div className="page-head-main">
        {crumbs ? (
          <>
            <nav
              className={`page-crumbs${crumbs.length > 1 ? " nested" : ""}`}
              aria-label="Breadcrumb"
            >
              {crumbs.map((crumb, i) => {
                const isLast = i === crumbs.length - 1;
                return (
                  <Fragment key={crumb.label}>
                    {i > 0 ? (
                      <span className="page-crumb-sep" aria-hidden="true">
                        ›
                      </span>
                    ) : null}
                    {crumb.onClick && !isLast ? (
                      <button
                        type="button"
                        className="page-crumb"
                        onClick={crumb.onClick}
                      >
                        {crumb.label}
                      </button>
                    ) : (
                      <span
                        className="page-crumb is-current"
                        aria-current={isLast ? "page" : undefined}
                      >
                        {crumb.label}
                      </span>
                    )}
                  </Fragment>
                );
              })}
            </nav>
            {title ? <h1 className="page-title">{title}</h1> : null}
          </>
        ) : (
          <>
            {eyebrow ? <div className="page-eyebrow">{eyebrow}</div> : null}
            {title ? <h1 className="page-title">{title}</h1> : null}
          </>
        )}
        {subtitle ? <p className="page-sub">{subtitle}</p> : null}
      </div>
      {primary || secondary ? (
        <div className="page-actions">
          {secondary}
          {primary}
        </div>
      ) : null}
    </header>
  );
}

// ── Health / metric atoms ────────────────────────────────────────────────────

const TREND_ARROW = { positive: "↑", negative: "↓", neutral: "→" } as const;

export function SummaryCard({
  eyebrow,
  value,
  trend,
  sublabel,
  action,
  tip,
  size = "default",
}: {
  eyebrow: string;
  value: string | number;
  trend?: { delta: number; tone: "positive" | "negative" | "neutral" };
  sublabel?: string;
  action?: ReactNode;
  /** Optional one-line explainer, revealed from an info glyph by the eyebrow. */
  tip?: ReactNode;
  size?: "hero" | "default";
}): ReactElement {
  const numeric = typeof value === "number" ? value : 0;
  const counted = Math.round(useCountUp(numeric));
  const display = typeof value === "number" ? counted : value;
  return (
    <div className={`summary-card${size === "hero" ? " hero" : ""}`}>
      <div className="summary-eyebrow">
        {eyebrow}
        {tip ? <InfoTip title={eyebrow} text={tip} /> : null}
      </div>
      <div className="summary-value tnum">{display}</div>
      {trend ? (
        <div className={`summary-trend ${trend.tone}`}>
          <span>{TREND_ARROW[trend.tone]}</span>
          <span>
            {trend.delta > 0 ? "+" : ""}
            {trend.delta}
          </span>
        </div>
      ) : null}
      {sublabel ? <div className="summary-sub">{sublabel}</div> : null}
      {action ? <div className="summary-action">{action}</div> : null}
    </div>
  );
}

export function MetricCell({
  metric,
  series,
}: {
  metric: Metric;
  series?: number[];
}): ReactElement {
  const arrow =
    metric.trend === "up" ? "↑" : metric.trend === "down" ? "↓" : "→";
  return (
    <div className="metric-cell">
      <div className="metric-top">
        <span className="metric-label">
          {metric.label}
          {METRIC_TIP[metric.key] ? (
            <InfoTip title={metric.label} text={METRIC_TIP[metric.key]} />
          ) : null}
        </span>
        <span className={`metric-delta${metric.good ? " good" : " warn"}`}>
          {arrow} {metric.delta > 0 ? "+" : ""}
          {metric.delta}%
        </span>
      </div>
      <div className="metric-value tnum">{metric.value}</div>
      {series && series.length > 1 ? (
        <Sparkline values={series} tone={metric.good ? "good" : "warn"} />
      ) : null}
    </div>
  );
}

/** Slim ring row: label + score + delta + a tiny single arc. */
export function RingChip({ ring }: { ring: Ring }): ReactElement {
  const mounted = useMounted();
  const size = 40;
  const center = size / 2;
  const stroke = 5;
  const radius = center - stroke / 2;
  const s = Math.max(0, Math.min(100, ring.score));
  return (
    <div className="ring-chip">
      <svg
        className="ring-chip-arc"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden="true"
      >
        <g transform={`rotate(-90 ${center} ${center})`}>
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
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray="100"
            strokeDashoffset={mounted ? 100 - s : 100}
          />
        </g>
      </svg>
      <div className="ring-chip-main">
        <span className="ring-chip-label">
          {ring.label}
          <InfoTip
            title={RING_TIP[ring.key].title}
            text={RING_TIP[ring.key].text}
          />
        </span>
        <span className="ring-chip-score tnum">{ring.score}</span>
      </div>
      <span className={`ring-chip-delta${ring.delta >= 0 ? " up" : " down"}`}>
        {deltaLabel(ring.delta)}
      </span>
    </div>
  );
}

// ── Alignment (the spine) ────────────────────────────────────────────────────

export function AlignmentBar({
  human,
  agent,
  band: bandValue,
}: {
  human: number;
  agent: number;
  band: AlignmentBand;
}): ReactElement {
  const mounted = useMounted();
  return (
    <div className="align-bar">
      <div className="align-bar-track">
        <div
          className="align-human"
          style={{ width: mounted ? `${human / 2}%` : "0%" }}
        />
        <div className="align-mid" style={{ left: "50%" }} />
        <div
          className="align-agent"
          style={{ width: mounted ? `${agent / 2}%` : "0%" }}
        />
      </div>
      <div className="align-bar-foot">
        <span className="you tnum">You {human}</span>
        <span className={`align-band ${bandValue}`}>
          {BAND_LABEL[bandValue]}
        </span>
        <span className="agent tnum">Agent {agent}</span>
      </div>
    </div>
  );
}

function Side({
  who,
  side,
}: {
  who: "human" | "agent";
  side: AlignmentSide;
}): ReactElement {
  return (
    <div className={`align-side ${who}`}>
      <span className="align-side-eyebrow">
        {who === "human" ? "Your side" : "Agent side"}
      </span>
      <span className="align-mood">{side.mood}</span>
      <span className="align-question">“{side.question}”</span>
      <div className="align-signals">
        {side.signals.map((sig) => (
          <span key={sig} className="align-signal">
            {sig}
          </span>
        ))}
      </div>
    </div>
  );
}

export function AlignmentSides({
  human,
  agent,
}: {
  human: AlignmentSide;
  agent: AlignmentSide;
}): ReactElement {
  return (
    <div className="align-sides">
      <Side who="human" side={human} />
      <Side who="agent" side={agent} />
    </div>
  );
}

export function FrictionChip({
  point,
  onOpen,
}: {
  point: FrictionPoint;
  onOpen?: (findingId: string) => void;
}): ReactElement {
  return (
    <Tooltip
      interactive
      block
      title={FRICTION_LABEL[point.type] ?? point.type}
      text={FRICTION_TIP[point.type]}
    >
      <button
        type="button"
        className="friction-chip"
        onClick={() => onOpen?.(point.findingId)}
      >
        <span className="friction-type">
          {FRICTION_LABEL[point.type] ?? point.type}
        </span>
        <span className="friction-example">{point.example}</span>
        <span className="friction-chip-arrow">›</span>
      </button>
    </Tooltip>
  );
}

// ── Findings & actions ───────────────────────────────────────────────────────

export function CategoryChip({
  category,
}: {
  category: ActionCategory;
}): ReactElement {
  return (
    <Tooltip
      title={CATEGORY_LABEL[category]}
      text={CATEGORY_TIP[category]}
      className="tip-inline"
    >
      <span className={`category-chip ${category}`}>
        {CATEGORY_LABEL[category]}
      </span>
    </Tooltip>
  );
}

function shortArtifact(file: string): string {
  const parts = file.split(/[\\/]/).filter(Boolean);
  return parts.slice(-2).join("/") || file;
}

export function FindingCard({
  finding,
  category,
  state = "open",
  onAccept,
  onReject,
  onSnooze,
  onQueue,
  compact = false,
}: {
  finding: Finding;
  category: ActionCategory;
  state?: ActionState;
  onAccept?: () => void;
  onReject?: () => void;
  onSnooze?: () => void;
  onQueue?: () => void;
  compact?: boolean;
}): ReactElement {
  return (
    <article className={`finding${compact ? " compact" : ""}`}>
      <div className="finding-kicker">
        <span className={`finding-type ${finding.type}`}>
          <span className="finding-type-dot" />
          {FINDING_LABEL[finding.type] ?? finding.type}
        </span>
        <span className="finding-project">{finding.project}</span>
        <span className="finding-project">
          {finding.patch ? "Config edit request" : "Measured goal"}
        </span>
        <Tooltip
          title={`${finding.confidence} confidence`}
          text={CONFIDENCE_TIP[finding.confidence]}
          className="tip-inline tip-push"
        >
          <span className="finding-conf">{finding.confidence} confidence</span>
        </Tooltip>
      </div>
      <h3 className="finding-name">{finding.title}</h3>
      {!compact ? <p className="finding-body">{finding.body}</p> : null}
      <span className="finding-evidence">{finding.evidence}</span>
      {!compact &&
      (finding.configGap || finding.evidenceFile || finding.patch) ? (
        <div className="finding-grounding">
          {finding.configGap ? (
            <div className="finding-grounding-item">
              <span>Config gap</span>
              <p>{finding.configGap}</p>
            </div>
          ) : null}
          {finding.evidenceFile ? (
            <div className="finding-grounding-item">
              <span>Evidence file</span>
              <p>{shortArtifact(finding.evidenceFile)}</p>
            </div>
          ) : null}
          {finding.patch ? (
            <div className="finding-grounding-item">
              <span>Applies as</span>
              <p>{finding.patch.label}</p>
            </div>
          ) : null}
        </div>
      ) : null}
      {!compact ? (
        <div className="finding-benefits">
          <div>
            <div className="finding-benefit-eyebrow">Why you</div>
            <p className="finding-benefit-text">{finding.userBenefit}</p>
          </div>
          <div>
            <div className="finding-benefit-eyebrow">Why agent</div>
            <p className="finding-benefit-text">{finding.agentBenefit}</p>
          </div>
        </div>
      ) : null}
      <div className="finding-action">
        <div className="finding-action-main">
          <div className="finding-action-eyebrow">Recommended action</div>
          <p className="finding-action-text">{finding.action}</p>
        </div>
        <CategoryChip category={category} />
      </div>
      {!compact ? (
        <p className="finding-watch">
          Next Sleep Cycle watches: {finding.reflection}
        </p>
      ) : null}
      {onAccept || onReject || onSnooze || onQueue ? (
        <div className="finding-controls">
          {onReject ? (
            <Button variant="ghost" onClick={onReject}>
              {state === "rejected" ? "Rejected" : "Reject"}
            </Button>
          ) : null}
          {onSnooze ? (
            <Button variant="ghost" onClick={onSnooze}>
              {state === "snoozed" ? "Snoozed" : "Snooze"}
            </Button>
          ) : null}
          {onQueue ? (
            <Button onClick={onQueue}>
              {state === "queued" ? "Queued" : "Queue"}
            </Button>
          ) : null}
          <span className="spacer" />
          {onAccept ? (
            <Button variant="accent" onClick={onAccept}>
              {state === "accepted" ? "Accepted" : "Accept goal"}
            </Button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

/**
 * Compact, fully-clickable finding tile for the dashboard grid. Shows just the
 * signal — type, confidence, title, evidence, and the recommended action — and
 * routes the whole card to the Sleep Cycle review on click.
 */
export function FindingTile({
  finding,
  onOpen,
}: {
  finding: Finding;
  onOpen?: () => void;
}): ReactElement {
  return (
    <button type="button" className="finding-tile" onClick={onOpen}>
      <div className="finding-tile-top">
        <span className={`finding-type ${finding.type}`}>
          <span className="finding-type-dot" />
          {FINDING_LABEL[finding.type] ?? finding.type}
        </span>
        <span className={`finding-tile-conf ${finding.confidence}`}>
          {finding.confidence}
        </span>
      </div>
      <h3 className="finding-tile-title">{finding.title}</h3>
      <span className="finding-evidence">{finding.evidence}</span>
      {finding.configGap ? (
        <span className="finding-tile-gap">{finding.configGap}</span>
      ) : null}
      <div className="finding-tile-foot">
        <span className="finding-tile-action">{finding.action}</span>
        <span className="finding-tile-arrow">›</span>
      </div>
    </button>
  );
}

// ── Cycle wizard ─────────────────────────────────────────────────────────────

export function CycleProgress({
  progress,
  stage,
  stages,
  paused,
}: {
  progress: number;
  stage: string | null;
  stages: DreamStage[];
  paused: boolean;
}): ReactElement {
  const pct = Math.round(progress * 100);
  return (
    <div className="cycle-progress">
      <div className="cycle-progress-head">
        <span className="cycle-stage-now">
          {paused ? "Paused" : (stage ?? "Preparing Sleep Cycle")}
        </span>
        <span className="cycle-pct tnum">{pct}%</span>
      </div>
      <div className="cycle-bar">
        <div
          className={`cycle-bar-fill${paused ? " paused" : ""}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="cycle-stages">
        {stages.map((st) => {
          const cls =
            progress >= st.at + 0.0001 && stage !== st.label
              ? "done"
              : stage === st.label
                ? "active"
                : "pending";
          return (
            <div key={st.label} className={`cycle-stage ${cls}`}>
              <span className="cycle-stage-dot" />
              <span>{st.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function StepRail({
  steps,
  activeId,
  queueCount,
  onSelect,
}: {
  steps: { id: string; label: string; state: ActionState }[];
  activeId: string;
  queueCount: number;
  onSelect: (id: string) => void;
}): ReactElement {
  return (
    <nav className="step-rail">
      {steps.map((step) => (
        <button
          key={step.id}
          type="button"
          className={`step-rail-item ${step.state}${activeId === step.id ? " active" : ""}`}
          onClick={() => onSelect(step.id)}
        >
          <span className="step-rail-icon" />
          <span className="step-rail-label">{step.label}</span>
        </button>
      ))}
      <button
        type="button"
        className={`step-rail-item step-rail-queue${activeId === "__queue" ? " active" : ""}`}
        onClick={() => onSelect("__queue")}
      >
        <span className="step-rail-icon" />
        <span className="step-rail-label">Goal decisions</span>
        <span className="step-rail-count tnum">{queueCount}</span>
      </button>
    </nav>
  );
}

export function ActionQueueItem({
  item,
  onApply,
  onUndo,
}: {
  item: ActionQueueEntry;
  onApply?: () => void;
  onUndo?: () => void;
}): ReactElement {
  const applyResult = item.reviewBranch;
  const direct = applyResult?.mode === "direct" || applyResult?.appliedDirectly;
  return (
    <div className={`queue-item ${item.state}`}>
      <span className="queue-item-rail" />
      <div className="queue-item-main">
        <div className="queue-item-action">{item.action}</div>
        <div className="queue-item-meta">
          <span>{CATEGORY_LABEL[item.category]}</span>
          <span>·</span>
          <span>{item.project}</span>
        </div>
        {applyResult ? (
          <div className="queue-branch">
            {direct ? (
              <span>
                {applyResult.appliedDirectly
                  ? `Edited ${applyResult.changedFiles?.join(", ") || "target file"}`
                  : applyResult.error}
              </span>
            ) : applyResult.branch ? (
              <span className="tnum">{applyResult.branch}</span>
            ) : null}
            {!direct && applyResult.pushed && applyResult.prUrl ? (
              <a href={applyResult.prUrl}>Create PR</a>
            ) : null}
            {!direct && !applyResult.pushed && applyResult.error ? (
              <span>{applyResult.error}</span>
            ) : null}
          </div>
        ) : null}
      </div>
      {onApply ? (
        <Button variant="ghost" onClick={onApply}>
          Apply
        </Button>
      ) : null}
      {onUndo ? (
        <Button variant="ghost" onClick={onUndo}>
          Undo
        </Button>
      ) : null}
    </div>
  );
}

// ── History & settings ───────────────────────────────────────────────────────

/** A single-metric area chart with a gradient fill and clickable points. */
export function AreaChart({
  values,
  labels,
  activeIndex,
  onPick,
  tone = "alignment",
}: {
  values: number[];
  labels: string[];
  activeIndex?: number;
  onPick?: (index: number) => void;
  tone?: string;
}): ReactElement {
  const mounted = useMounted();
  const w = 680;
  const h = 156;
  const padX = 18;
  const padY = 22;
  const lo = Math.min(...values, 100);
  const hi = Math.max(...values, 0);
  const min = Math.max(0, lo - 8);
  const max = Math.min(100, hi + 8);
  const span = max - min || 1;
  const n = values.length;
  const stepX = n > 1 ? (w - padX * 2) / (n - 1) : 0;
  const xy = (i: number, v: number): [number, number] => [
    padX + i * stepX,
    h - padY - ((v - min) / span) * (h - padY * 2),
  ];
  const pts = values.map((v, i) => xy(i, v));
  const line = pts
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(" ");
  const first = pts[0] ?? [padX, h - padY];
  const last = pts[pts.length - 1] ?? [w - padX, h - padY];
  const area = `${line} L${last[0].toFixed(1)} ${h - padY} L${first[0].toFixed(1)} ${h - padY} Z`;
  const gid = `area-grad-${tone}`;
  return (
    <svg
      className="area-chart"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="Sleep Cycle trend"
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" className={`area-grad-from ${tone}`} />
          <stop offset="100%" className={`area-grad-to ${tone}`} />
        </linearGradient>
      </defs>
      <path
        className="area-fill"
        d={area}
        fill={`url(#${gid})`}
        style={{ opacity: mounted ? 1 : 0 }}
      />
      <path
        className={`area-line ${tone}`}
        d={line}
        fill="none"
        pathLength={100}
        strokeDasharray="100"
        strokeDashoffset={mounted ? 0 : 100}
      />
      {pts.map(([x, y], i) => (
        <g
          key={labels[i] ?? `pt-${i}`}
          role="button"
          tabIndex={onPick ? 0 : undefined}
          aria-label={`${labels[i] ?? "Sleep Cycle"} · ${values[i]}`}
          onClick={() => onPick?.(i)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") onPick?.(i);
          }}
        >
          <circle
            className={`area-dot ${tone}${activeIndex === i ? " active" : ""}`}
            cx={x}
            cy={y}
            r={activeIndex === i ? 5 : 3.5}
          />
        </g>
      ))}
    </svg>
  );
}

/** Grouped vertical bars — one cluster per cycle, one bar per metric. */
export function GroupedBars({
  groups,
  labels,
}: {
  groups: { id: string; tone: string; values: number[] }[];
  labels: string[];
}): ReactElement {
  const mounted = useMounted();
  const max = Math.max(...groups.flatMap((g) => g.values), 1);
  return (
    <div className="gbars">
      <div className="gbars-plot">
        {labels.map((label, i) => {
          const values = groups.map((g) => g.values[i] ?? 0);
          return (
            <div className="gbars-col" key={`${label}-${values.join("-")}`}>
              <div className="gbars-bars">
                {groups.map((g) => (
                  <span
                    key={g.id}
                    className={`gbar ${g.tone}`}
                    style={{
                      height: mounted ? `${(g.values[i] / max) * 100}%` : "0%",
                    }}
                  />
                ))}
              </div>
              <span className="gbars-label">{label}</span>
            </div>
          );
        })}
      </div>
      <div className="gbars-legend">
        {groups.map((g) => (
          <span key={g.id} className="gbars-key">
            <span className={`gbars-dot ${g.tone}`} />
            {g.id}
          </span>
        ))}
      </div>
    </div>
  );
}

export function TrendChart({
  series,
  labels,
  activeIndex,
  onPick,
}: {
  series: { id: string; values: number[]; tone: string }[];
  labels: string[];
  activeIndex?: number;
  onPick?: (index: number) => void;
}): ReactElement {
  const mounted = useMounted();
  const w = 640;
  const h = 180;
  const padX = 16;
  const padY = 18;
  const all = series.flatMap((s) => s.values);
  const min = Math.min(...all, 0);
  const max = Math.max(...all, 100);
  const span = max - min || 1;
  const n = labels.length;
  const stepX = n > 1 ? (w - padX * 2) / (n - 1) : 0;
  const xy = (i: number, v: number): [number, number] => [
    padX + i * stepX,
    h - padY - ((v - min) / span) * (h - padY * 2),
  ];
  // The first series is the primary (alignment) line; its dots are the picker.
  const primary = series[0];
  return (
    <svg
      className="trend-chart"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="Sleep Cycle trend"
    >
      {series.map((s) => {
        const d = s.values
          .map((v, i) => {
            const [x, y] = xy(i, v);
            return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
          })
          .join(" ");
        return (
          <path
            key={s.id}
            className={`trend-line ${s.tone}`}
            d={d}
            pathLength={100}
            strokeDasharray="100"
            strokeDashoffset={mounted ? 0 : 100}
          />
        );
      })}
      {primary?.values.map((v, i) => {
        const [x, y] = xy(i, v);
        const b = band(v);
        const key = labels[i] ?? `${primary.id}-pt`;
        return (
          <g
            key={key}
            role="button"
            tabIndex={onPick ? 0 : undefined}
            aria-label={`${labels[i] ?? "Sleep Cycle"} · ${v}`}
            onClick={() => onPick?.(i)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") onPick?.(i);
            }}
          >
            <circle
              className={`trend-dot ${b}${activeIndex === i ? " active" : ""}`}
              cx={x}
              cy={y}
              r={activeIndex === i ? 5 : 3.5}
            />
          </g>
        );
      })}
    </svg>
  );
}

export function HistoryRow({
  report,
  selected,
  delta,
  onSelect,
}: {
  report: DreamReport;
  selected: boolean;
  delta?: number | null;
  onSelect: (id: string) => void;
}): ReactElement {
  const split = alignmentSplit(report);
  const date = new Date(report.timestamp).toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  return (
    <button
      type="button"
      className={`history-row${selected ? " selected" : ""}`}
      onClick={() => onSelect(report.id)}
    >
      <span className="history-row-rail" />
      <div className="history-date">
        <div className="history-date-main">{date}</div>
        <div className="history-date-sub">{report.sessions} sessions</div>
      </div>
      <div className="history-rings">
        {report.rings.map((ring) => (
          <div key={ring.key} className="history-ring">
            <span className="history-ring-label">{ring.label}</span>
            <span className="history-ring-score tnum">{ring.score}</span>
          </div>
        ))}
      </div>
      <div className="history-align">
        <span className={`align-band ${split.band}`}>
          {BAND_LABEL[split.band]}
          {typeof delta === "number" ? ` ${delta >= 0 ? "+" : ""}${delta}` : ""}
        </span>
      </div>
    </button>
  );
}

function compareRow(
  label: string,
  current: number,
  previous: number,
  goodWhenUp: boolean
): ReactElement {
  const delta = current - previous;
  const tone = delta === 0 ? "flat" : delta > 0 === goodWhenUp ? "good" : "bad";
  return (
    <div className="compare-row" key={label}>
      <span className="compare-label">{label}</span>
      <span className="compare-value tnum">{current}</span>
      <span className={`compare-delta ${tone}`}>
        {delta > 0 ? "+" : ""}
        {delta}
      </span>
    </div>
  );
}

export function CompareStrip({
  current,
  previous,
}: {
  current: DreamReport;
  previous: DreamReport | null;
}): ReactElement {
  if (!previous) {
    return (
      <div className="compare-empty">
        First Sleep Cycle — no comparison yet.
      </div>
    );
  }
  const ringScore = (r: DreamReport, key: string): number =>
    r.rings.find((x) => x.key === key)?.score ?? 0;
  const reask = (r: DreamReport): number => {
    const raw = r.metrics.find((m) => m.key === "reask")?.value ?? "0";
    return Number.parseInt(raw, 10) || 0;
  };
  return (
    <div className="compare-strip">
      {compareRow(
        "Alignment",
        ringScore(current, "alignment"),
        ringScore(previous, "alignment"),
        true
      )}
      {compareRow(
        "Efficiency",
        ringScore(current, "efficiency"),
        ringScore(previous, "efficiency"),
        true
      )}
      {compareRow("Re-ask %", reask(current), reask(previous), false)}
      {compareRow(
        "Findings",
        current.findings.length,
        previous.findings.length,
        false
      )}
    </div>
  );
}

export function SettingsGroup({
  title,
  icon,
  danger,
  tip,
  children,
}: {
  title: string;
  icon?: ReactNode;
  danger?: boolean;
  /** Optional one-line explainer of what this section governs. */
  tip?: ReactNode;
  children: ReactNode;
}): ReactElement {
  return (
    <section className={`settings-group${danger ? " danger" : ""}`}>
      <h2 className="settings-group-title">
        {icon ? <span className="settings-group-icon">{icon}</span> : null}
        {title}
        {tip ? <InfoTip title={title} text={tip} /> : null}
      </h2>
      <div className="settings-group-body">{children}</div>
    </section>
  );
}

export function StatusChip({
  label,
  on,
}: {
  label: string;
  on: boolean;
}): ReactElement {
  return <span className={`status-chip${on ? " on" : ""}`}>{label}</span>;
}
