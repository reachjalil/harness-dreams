export type FindingType = "win" | "mistake" | "opportunity" | "risk";
export type RingKey = "efficiency" | "effectiveness" | "alignment";
export type Trend = "up" | "down" | "flat";
export type ExperimentStatus = "proposed" | "running" | "concluded";
export type ReviewState = "accepted" | "rejected" | "queued" | "snoozed";
export type HealthTab = "summary" | "browse" | "awards" | "sources";
export type HarnessProfileKey = "global" | "codex" | "claude";

export interface Pairing {
  cloudUserId: string;
  signalUrl: string;
  pairingId?: string;
  pairingSecret?: string;
  pairedDeviceSecret?: string;
  desktopDeviceId?: string;
  desktopDeviceName?: string;
  deviceId: string;
  deviceName: string;
  lastRevision: number;
  pendingDecisions: PendingDecision[];
  backupEnabled?: boolean;
  backupEpochId?: string;
  backupKey?: string;
}

export interface PendingDecision {
  reportId: string;
  findingId: string;
  state: ReviewState;
  updatedAt: number;
}

export interface Ring {
  key: RingKey;
  label: string;
  score: number;
  delta: number;
  hint: string;
}

export interface Metric {
  key: string;
  canonicalKey?: string;
  label: string;
  value: string;
  numericValue?: number;
  unit?: string;
  delta: number;
  trend: Trend;
  good: boolean;
  samples?: Array<{
    label: string;
    value: number;
    display?: string;
    sourceCount?: number;
  }>;
  sourceCount?: number;
  confidence?: "low" | "medium" | "high";
  provenance?: string;
  preview?: boolean;
}

export interface Finding {
  id: string;
  type: FindingType;
  title: string;
  summary: string;
  action: string;
  confidence: string;
  project: string;
}

export interface Experiment {
  id: string;
  title: string;
  metric: string;
  status: ExperimentStatus;
  progress?: number;
  progressLabel?: string;
  verdict?: "helped" | "no-change" | "worse";
}

export interface ProjectInsight {
  name: string;
  sources?: string[];
  sessions: number;
  turns: number;
  corrections: number;
  toolFailures: number;
  hedges: number;
  alignment: number;
  topics?: string[];
}

export interface ContextHealth {
  score: number;
  status: "clear" | "watch" | "overloaded";
  overloadedProjects: number;
  riskCount: number;
  chars: number;
  memoryFiles: number;
  skillCount: number;
  suggestions: string[];
}

export interface Report {
  id: string;
  timestamp: number;
  rangeLabel: string;
  sessions: number;
  projects: number;
  harness: string;
  digest: string;
  rings?: Ring[];
  metrics?: Metric[];
  findings?: Finding[];
  experiments?: Experiment[];
  reviewStatus?: "unreviewed" | "reviewed" | "expired";
  window?: {
    label: string;
    sessionsInWindow: number;
    turnsInWindow: number;
    basis: "since-last-review" | "last-24h";
  };
  contextHealth?: ContextHealth;
  projectInsights?: ProjectInsight[];
}

export interface Snapshot {
  userId: string;
  desktopDeviceId: string;
  desktopDeviceName: string;
  deviceId: string;
  revision: number;
  report: Report | null;
}

export interface HealthCategory {
  id: string;
  title: string;
  subtitle: string;
  metricKeys: string[];
  accent: string;
}

export interface HealthInsight {
  id: string;
  metricId: string;
  type: "trend" | "anomaly" | "milestone" | "recommendation" | "education";
  severity: "positive" | "neutral" | "attention";
  title: string;
  body: string;
  evidence: string;
  actionLabel: string;
}

export interface HealthHabit {
  id: string;
  title: string;
  category: "prompting" | "context" | "verification" | "privacy";
  summary: string;
  improves: RingKey;
  actionLabel: string;
}

export interface HealthAward {
  id: string;
  title: string;
  description: string;
  category:
    | "first"
    | "streak"
    | "perfect-week"
    | "milestone"
    | "record"
    | "monthly"
    | "special";
  progress: number;
  accent: string;
  earned: boolean;
}

export interface SourceStatus {
  id: string;
  title: string;
  status: string;
  detail: string;
}

export interface HarnessProfile {
  key: HarnessProfileKey;
  label: string;
  detail: string;
  status: string;
}

export interface HarnessHealthModel {
  report: Report;
  rings: Ring[];
  metrics: Metric[];
  findings: Finding[];
  experiments: Experiment[];
  projects: ProjectInsight[];
  score: number;
  scoreLabel: string;
  categories: HealthCategory[];
  insights: HealthInsight[];
  habits: HealthHabit[];
  awards: HealthAward[];
  sources: SourceStatus[];
  harnessProfiles: HarnessProfile[];
  activeHarness: HarnessProfile;
}
