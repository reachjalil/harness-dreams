/**
 * Shared domain types for Harness Dreams.
 *
 * Vocabulary mirrors the product spec in `md/`: a harness "sleeps", a Dream
 * Session produces a Dream Report (vitals + findings + suggested improvements), and the
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
  /** Replay the welcome/setup flow on every app launch (until turned off). */
  showOnboardingOnLaunch: boolean;
  privacyMode: PrivacyMode;
  schedule: {
    mode: ScheduleMode;
    /** 24h "HH:MM" — when the nightly dream runs. */
    time: string;
  };
  notifications: boolean;
  analysisDepth: AnalysisDepth;
  launchAtLogin: boolean;
  /** Honor the OS reduced-motion preference, or force it on. */
  reduceMotion: boolean;
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
  /** Current dream stage label while dreaming, else null. */
  stage: string | null;
  /** True when a running dream is paused. */
  paused: boolean;
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
  /** Plain-language improvement suggested by the finding. */
  improvement: string;
  /** How the harness/agent behavior should improve. */
  agentBenefit: string;
  /** How the user's workflow should improve. */
  userBenefit: string;
  /** What the next report should keep checking. */
  reflection: string;
  confidence: Confidence;
  project: string;
  /** One-line pointer to the evidence (mock). */
  evidence: string;
  /** The single recommended next step. */
  action: string;
  /** Optional action category hint; the UI derives one when absent. */
  category?: ActionCategory;
  /** Optional friction classification; only meaningful for mistake/risk. */
  frictionType?: FrictionType;
}

// ── Human ↔ Agent alignment (additive; UI derives fallbacks when absent) ──────

/** Where a cycle sits on the collaboration spectrum. */
export type AlignmentBand = "collaborating" | "friction" | "fighting";

/** Where a recommended action should land. */
export type ActionCategory =
  | "agentsmd" // "AGENTS.md update"
  | "contextdoc" // "Context doc"
  | "prompthabit" // "Prompt habit"
  | "skill"; // "Skill / routing"

/** A user's decision on a finding's recommended action. */
export type ActionState =
  | "open"
  | "accepted"
  | "rejected"
  | "snoozed"
  | "queued";

/** The kind of friction a finding surfaced between human and agent. */
export type FrictionType =
  | "config-conflict"
  | "missing-skill"
  | "wrong-domain"
  | "unclear-prompt";

/** A single point of friction, linked 1:1 to the finding that explains it. */
export interface FrictionPoint {
  type: FrictionType;
  /** One-line, drawn from a finding's evidence. */
  example: string;
  /** Links to the Finding this friction explains. */
  findingId: string;
}

/** One half of the alignment picture — the human's or the agent's. */
export interface AlignmentSide {
  /** human: deep-focus|exploratory|scattered|frustrated.
   *  agent: confident|uncertain|confused|overloaded. */
  mood: string;
  /** The implicit question held all day. */
  question: string;
  /** Evidence chips. */
  signals: string[];
}

/** The full alignment detail for a cycle; mirrors the `alignment` ring. */
export interface AlignmentDetail {
  /** 0..100; mirrors the `alignment` ring score. */
  score: number;
  band: AlignmentBand;
  human: AlignmentSide;
  agent: AlignmentSide;
  friction: FrictionPoint[];
}

/** A finding's recommended action after a Sleep Cycle review decision. */
export interface ActionQueueEntry {
  findingId: string;
  category: ActionCategory;
  /** The recommended step (finding.action). */
  action: string;
  project: string;
  /** accepted | rejected | queued | snoozed (open entries are not summarized). */
  state: ActionState;
}

/** User-facing lifecycle for a cycle report. */
export type CycleReviewStatus = "unreviewed" | "reviewed" | "expired";

export type ExperimentStatus = "proposed" | "running" | "concluded";
export type ExperimentVerdict = "improved" | "inconclusive" | "regressed";

export interface Experiment {
  id: string;
  title: string;
  hypothesis: string;
  agentBenefit: string;
  userBenefit: string;
  reflection: string;
  metric: string;
  status: ExperimentStatus;
  /** 0..1 for tracked improvements ("4/5 sessions"). */
  progress?: number;
  progressLabel?: string;
  verdict?: ExperimentVerdict;
  verdictNote?: string;
}

/** The artifact a Dream Session produces — styled like the Apple Health app. */
export interface DreamReport {
  id: string;
  /** Epoch ms the dream completed — used for ordering and history labels. */
  timestamp: number;
  /** Review lifecycle. Starting a newer cycle expires older unreviewed cycles. */
  reviewStatus?: CycleReviewStatus;
  /** Epoch ms when the user marked the cycle reviewed. */
  reviewedAt?: number;
  /** Human label, e.g. "Last night · Jun 26". */
  rangeLabel: string;
  sessions: number;
  projects: number;
  harness: string;
  digest: string;
  rings: Ring[];
  metrics: Metric[];
  findings: Finding[];
  /** Tracked suggested improvements; stored as experiments for measurement. */
  experiments: Experiment[];
  /** Human ↔ Agent alignment detail; optional — UI derives a fallback if absent. */
  alignment?: AlignmentDetail;
}
