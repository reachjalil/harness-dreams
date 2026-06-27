/**
 * Shared domain types for Harness Dreams.
 *
 * Vocabulary mirrors the product spec in `md/`: a harness "sleeps", a Dream
 * Session produces a Dream Report (vitals + findings + experiments), and the
 * user "reflects" each morning. This build is mock-data only — no real
 * ingestion or LLM yet.
 */

/** Where the overnight reflection currently is. Drives the menu-bar icon. */
export type DreamPhase = "resting" | "dreaming" | "ready";

/** Local-first by default; cloud analysis is an explicit opt-in. */
export type PrivacyMode = "local" | "cloud";

/** How deep the (future) REM analysis pass goes. */
export type AnalysisDepth = "light" | "standard" | "deep";

/** When dreams run. */
export type ScheduleMode = "nightly" | "manual";

/** Persisted, user-facing configuration. */
export interface AppConfig {
  onboarded: boolean;
  privacyMode: PrivacyMode;
  schedule: {
    mode: ScheduleMode;
    /** 24h "HH:MM" — when the nightly dream runs. */
    time: string;
  };
  notifications: boolean;
  analysisDepth: AnalysisDepth;
  launchAtLogin: boolean;
  /** Which harnesses we (will) ingest. Claude Code ships first. */
  connectors: {
    claudeCode: boolean;
    codex: boolean;
    cursor: boolean;
  };
}

/** Live, non-persisted runtime state broadcast to the UI. */
export interface RuntimeState {
  phase: DreamPhase;
  /** 0..1 while phase === "dreaming". */
  progress: number;
  /** Epoch ms of the last completed dream, or null. */
  lastDreamAt: number | null;
  /** True when a fresh dream hasn't been opened yet (drives the badge). */
  hasUnreviewed: boolean;
}

// ── Dream Report (mock) ──────────────────────────────────────────────────────

export type RingKey = "efficiency" | "effectiveness" | "alignment";

/** One of the three Apple-Health-style headline scores (0..100). */
export interface Ring {
  key: RingKey;
  label: string;
  score: number;
  /** Change vs the user's rolling baseline, in points. */
  delta: number;
  hint: string;
}

export type Trend = "up" | "down" | "flat";

/** A headline vital shown in the metrics strip. */
export interface Metric {
  key: string;
  label: string;
  value: string;
  /** Percent change vs baseline. */
  delta: number;
  trend: Trend;
  /** Whether the trend direction is good (green) or not (amber). */
  good: boolean;
}

export type FindingType = "win" | "mistake" | "opportunity" | "risk";
export type Confidence = "low" | "medium" | "high";

export interface Finding {
  id: string;
  type: FindingType;
  title: string;
  body: string;
  confidence: Confidence;
  project: string;
  /** One-line pointer to the evidence (mock). */
  evidence: string;
  /** The single recommended next step. */
  action: string;
}

export type ExperimentStatus = "proposed" | "running" | "concluded";
export type ExperimentVerdict = "improved" | "inconclusive" | "regressed";

export interface Experiment {
  id: string;
  title: string;
  hypothesis: string;
  metric: string;
  status: ExperimentStatus;
  /** 0..1 for running experiments ("4/5 sessions"). */
  progress?: number;
  progressLabel?: string;
  verdict?: ExperimentVerdict;
  verdictNote?: string;
}

/** The artifact a Dream Session produces — styled like the Apple Health app. */
export interface DreamReport {
  id: string;
  /** Human label, e.g. "Last night · Jun 26". */
  rangeLabel: string;
  sessions: number;
  projects: number;
  harness: string;
  digest: string;
  rings: Ring[];
  metrics: Metric[];
  findings: Finding[];
  experiments: Experiment[];
}
