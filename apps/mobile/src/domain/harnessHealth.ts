import { colors, ringColor } from "../theme/tokens";
import type {
  Finding,
  HarnessHealthModel,
  HarnessProfile,
  HarnessProfileKey,
  HealthAward,
  HealthCategory,
  HealthHabit,
  HealthInsight,
  Metric,
  Pairing,
  ProjectInsight,
  Report,
  Ring,
  Snapshot,
} from "./types";

export const HARNESS_PROFILES: HarnessProfile[] = [
  {
    key: "global",
    label: "Global",
    detail: "All harnesses",
    status: "Combined",
  },
  {
    key: "codex",
    label: "Codex",
    detail: "Codex sessions",
    status: "Source",
  },
  {
    key: "claude",
    label: "Claude",
    detail: "Claude Code sessions",
    status: "Source",
  },
];

export function harnessProfileForKey(key: HarnessProfileKey): HarnessProfile {
  return (
    HARNESS_PROFILES.find((profile) => profile.key === key) ??
    HARNESS_PROFILES[0]
  );
}

function sumProjects(
  report: Report | null | undefined,
  field: "turns" | "corrections" | "toolFailures" | "hedges"
): number {
  return (report?.projectInsights ?? []).reduce(
    (sum, project) => sum + (project[field] ?? 0),
    0
  );
}

function parseMetricNumber(value: string): number | null {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  const compactMatch = normalized.match(/^(-?\d+(?:\.\d+)?)([km%])?/u);
  if (!compactMatch) return null;
  const base = Number(compactMatch[1]);
  if (!Number.isFinite(base)) return null;
  const suffix = compactMatch[2];
  if (suffix === "k") return base * 1000;
  if (suffix === "m") return base * 1_000_000;
  return base;
}

function canonicalMetricKey(metric: Metric): string {
  if (metric.canonicalKey) return metric.canonicalKey;
  if (metric.key === "tokens") return "tokens.total";
  if (metric.key === "tokens_per_change") return "tokens.per_change";
  if (metric.key === "tool_success") return "tool.success_rate";
  if (metric.key === "cache") return "cache.hit_ratio";
  if (metric.key === "sessions") return "sessions.active";
  if (metric.key === "reask") return "reask.rate";
  if (metric.key === "cost") return "cost.total";
  return metric.key;
}

function normalizeMetric(metric: Metric): Metric {
  const canonicalKey = canonicalMetricKey(metric);
  return {
    ...metric,
    key: canonicalKey,
    canonicalKey,
    numericValue: metric.numericValue ?? parseMetricNumber(metric.value) ?? 0,
  };
}

function estimateHarnessMetrics(report: Report | null): Metric[] {
  if (!report) return emptyHarnessMetrics();

  const toolFailures = sumProjects(report, "toolFailures");
  const redundancySignals =
    sumProjects(report, "corrections") +
    toolFailures +
    sumProjects(report, "hedges");
  const toolCalls = 0;
  const errorRate = 0;
  const tokens = 0;
  const timeMinutes = 0;
  const effectivenessRing = report.rings?.find(
    (ring) => ring.key === "effectiveness"
  );
  const effectivenessScore = effectivenessRing?.score ?? 0;
  const effectivenessDelta = effectivenessRing?.delta ?? 0;

  return [
    {
      key: "tokens.total",
      canonicalKey: "tokens.total",
      label: "Token Use",
      value:
        tokens >= 1000 ? `${Math.round(tokens / 1000)}K` : tokens.toString(),
      numericValue: tokens,
      unit: "tokens",
      delta: 0,
      trend: "flat",
      good: true,
      sourceCount: report?.window?.turnsInWindow ?? report?.sessions ?? 0,
      provenance: "Waiting for canonical model-call token rows.",
      samples: [],
      preview: true,
    },
    {
      key: "tools.calls",
      canonicalKey: "tools.calls",
      label: "Tool Use",
      value: toolCalls.toString(),
      numericValue: toolCalls,
      unit: "calls",
      delta: 0,
      trend: "flat",
      good: true,
      sourceCount: report?.window?.turnsInWindow ?? report?.sessions ?? 0,
      provenance: "Waiting for canonical tool-call rows.",
      samples: [],
      preview: true,
    },
    {
      key: "tools.error_rate",
      canonicalKey: "tools.error_rate",
      label: "Error Rate",
      value: `${errorRate}%`,
      numericValue: errorRate,
      unit: "%",
      delta: 0,
      trend: "flat",
      good: errorRate <= 8,
      sourceCount: toolFailures,
      provenance:
        "Waiting for canonical tool-result rows with a real denominator.",
      samples: [],
      preview: true,
    },
    {
      key: "redundancy.signals",
      canonicalKey: "redundancy.signals",
      label: "Redundancy",
      value: redundancySignals.toString(),
      numericValue: redundancySignals,
      unit: "signals",
      delta: 0,
      trend: "flat",
      good: redundancySignals === 0,
      sourceCount: report?.projectInsights?.length ?? 0,
      provenance:
        "Derived from corrections, failed tools, retry pressure, and repeated-work signals.",
      samples: [],
      preview: (report?.projectInsights?.length ?? 0) === 0,
    },
    {
      key: "effectiveness.score",
      canonicalKey: "effectiveness.score",
      label: "Effectiveness",
      value: `${effectivenessScore}`,
      numericValue: effectivenessScore,
      unit: "score",
      delta: effectivenessDelta,
      trend:
        effectivenessDelta > 0
          ? "up"
          : effectivenessDelta < 0
            ? "down"
            : "flat",
      good: true,
      sourceCount: report?.rings?.length ?? 0,
      provenance: "Derived from the current Harness Health ring score.",
      samples: [],
      preview: !effectivenessRing,
    },
    {
      key: "time.spent",
      canonicalKey: "time.spent",
      label: "Time Spent",
      value:
        timeMinutes >= 60
          ? `${Math.floor(timeMinutes / 60)}h ${timeMinutes % 60}m`
          : `${timeMinutes}m`,
      numericValue: timeMinutes,
      unit: "minutes",
      delta: 0,
      trend: "flat",
      good: true,
      sourceCount: report?.sessions ?? 0,
      provenance: "Waiting for active session event spacing.",
      samples: [],
      preview: true,
    },
    {
      key: "harness.mix",
      canonicalKey: "harness.mix",
      label: "Codex / Claude",
      value: "0/0",
      numericValue: 0,
      unit: "split",
      delta: 0,
      trend: "flat",
      good: true,
      sourceCount: report?.sessions ?? 0,
      provenance: "Derived from Codex and Claude source attribution.",
      samples: [],
      preview: true,
    },
  ];
}

function emptyHarnessMetrics(): Metric[] {
  return [
    {
      key: "tokens.total",
      canonicalKey: "tokens.total",
      label: "Token Use",
      value: "0",
      numericValue: 0,
      unit: "tokens",
      delta: 0,
      trend: "flat",
      good: true,
      sourceCount: 0,
      provenance: "No local model-call token rows have been received yet.",
      samples: [],
      preview: true,
    },
    {
      key: "tools.calls",
      canonicalKey: "tools.calls",
      label: "Tool Use",
      value: "0",
      numericValue: 0,
      unit: "calls",
      delta: 0,
      trend: "flat",
      good: true,
      sourceCount: 0,
      provenance: "No local tool-call rows have been received yet.",
      samples: [],
      preview: true,
    },
    {
      key: "tools.error_rate",
      canonicalKey: "tools.error_rate",
      label: "Error Rate",
      value: "0%",
      numericValue: 0,
      unit: "%",
      delta: 0,
      trend: "flat",
      good: true,
      sourceCount: 0,
      provenance: "No local tool-result rows have been received yet.",
      samples: [],
      preview: true,
    },
    {
      key: "redundancy.signals",
      canonicalKey: "redundancy.signals",
      label: "Redundancy",
      value: "0",
      numericValue: 0,
      unit: "signals",
      delta: 0,
      trend: "flat",
      good: true,
      sourceCount: 0,
      provenance:
        "No correction, retry, or repeated-work signals have been received yet.",
      samples: [],
      preview: true,
    },
    {
      key: "effectiveness.score",
      canonicalKey: "effectiveness.score",
      label: "Effectiveness",
      value: "0",
      numericValue: 0,
      unit: "score",
      delta: 0,
      trend: "flat",
      good: true,
      sourceCount: 0,
      provenance: "No Harness Health ring score has been received yet.",
      samples: [],
      preview: true,
    },
    {
      key: "time.spent",
      canonicalKey: "time.spent",
      label: "Time Spent",
      value: "0m",
      numericValue: 0,
      unit: "minutes",
      delta: 0,
      trend: "flat",
      good: true,
      sourceCount: 0,
      provenance: "No active session timing rows have been received yet.",
      samples: [],
      preview: true,
    },
    {
      key: "harness.mix",
      canonicalKey: "harness.mix",
      label: "Codex / Claude",
      value: "0/0",
      numericValue: 0,
      unit: "split",
      delta: 0,
      trend: "flat",
      good: true,
      sourceCount: 0,
      provenance:
        "No Codex or Claude source attribution has been received yet.",
      samples: [],
      preview: true,
    },
  ];
}

function metricByKey(metrics: Metric[], key: string): Metric | undefined {
  return metrics.find((metric) => canonicalMetricKey(metric) === key);
}

function metricFromToolSuccess(metric: Metric | undefined): Metric | null {
  if (!metric) return null;
  const success = Math.max(
    0,
    Math.min(100, metric.numericValue ?? parseMetricNumber(metric.value) ?? 0)
  );
  const errorRate = Math.round(100 - success);
  return {
    key: "tools.error_rate",
    canonicalKey: "tools.error_rate",
    label: "Error Rate",
    value: `${errorRate}%`,
    numericValue: errorRate,
    unit: "%",
    delta: -metric.delta,
    trend:
      metric.trend === "up" ? "down" : metric.trend === "down" ? "up" : "flat",
    good: errorRate <= 8,
    sourceCount: metric.sourceCount,
    confidence: metric.confidence,
    provenance: "Derived as the inverse of deterministic tool success rate.",
    samples: metric.samples?.map((sample) => ({
      ...sample,
      value: Math.max(0, 100 - sample.value),
      display: `${Math.max(0, Math.round(100 - sample.value))}%`,
    })),
  };
}

function buildFocusedMetrics(
  report: Report,
  reportMetrics: Metric[]
): Metric[] {
  const estimates = estimateHarnessMetrics(report);
  const toolSuccess = metricByKey(reportMetrics, "tool.success_rate");
  const derivedError = metricFromToolSuccess(toolSuccess);
  const slots: Array<[string, Metric | null | undefined]> = [
    ["tokens.total", metricByKey(reportMetrics, "tokens.total")],
    ["tools.calls", metricByKey(reportMetrics, "tools.calls")],
    [
      "tools.error_rate",
      metricByKey(reportMetrics, "tools.error_rate") ?? derivedError,
    ],
    ["redundancy.signals", metricByKey(reportMetrics, "redundancy.signals")],
    ["effectiveness.score", metricByKey(reportMetrics, "effectiveness.score")],
    ["time.spent", metricByKey(reportMetrics, "time.spent")],
    ["harness.mix", metricByKey(reportMetrics, "harness.mix")],
  ];

  return slots.map(([key, metric]) => metric ?? metricByKey(estimates, key)!);
}

export function localDashboardReport(snapshot: Snapshot | null): Report {
  const hasSyncedReport = Boolean(snapshot?.report);
  const metrics = estimateHarnessMetrics(snapshot?.report ?? null);
  return {
    id: "local-dev-dashboard",
    timestamp: Date.now(),
    rangeLabel: "Local dev",
    sessions: snapshot?.report?.sessions ?? 0,
    projects: snapshot?.report?.projects ?? 0,
    harness: hasSyncedReport ? "Private WebRTC" : "Waiting for telemetry",
    digest: hasSyncedReport
      ? "Harness Health is summarizing token load, tool behavior, error rate, and effectiveness from the latest desktop signal."
      : "No desktop telemetry has been received yet. The Summary will fill with token use, tool use, error rate, effectiveness, time, and Codex versus Claude mix after the Mac publishes real activity.",
    rings: [
      {
        key: "efficiency",
        label: "Efficiency",
        score: hasSyncedReport ? 92 : 0,
        delta: hasSyncedReport ? 4 : 0,
        hint: hasSyncedReport
          ? "The iPhone is paired and refreshing from the local desktop service."
          : "Waiting for token load, cache reuse, and repeated prompting patterns.",
      },
      {
        key: "effectiveness",
        label: "Effectiveness",
        score: hasSyncedReport ? 68 : 0,
        delta: 0,
        hint: "Verification quality, tool success, and useful completed work.",
      },
      {
        key: "alignment",
        label: "Alignment",
        score: hasSyncedReport ? 88 : 0,
        delta: hasSyncedReport ? 2 : 0,
        hint: hasSyncedReport
          ? "How well agent behavior matches your rules, config, and intent."
          : "Waiting for config and intent-alignment signals.",
      },
    ],
    metrics,
    findings: [
      {
        id: "focus-token-tools",
        type: "opportunity",
        title: hasSyncedReport
          ? "Watch token and tool pressure first"
          : "Waiting for harness telemetry",
        summary: hasSyncedReport
          ? "The latest signal is ready to review as token use, tool calls, error rate, effectiveness, and harness mix."
          : "Connect the Mac telemetry stream to populate real token, tool, error, and effectiveness values.",
        action: hasSyncedReport
          ? "Open Token Use or Error Rate before the next long session."
          : "Publish real Codex and Claude activity from the Mac app.",
        confidence: "dev",
        project: snapshot?.desktopDeviceName ?? "Harness Health Desktop",
      },
    ],
    experiments: [
      {
        id: "tool-error-review",
        title: "Tool and error review",
        metric:
          "Review failed tool calls and repeated retries before the next session.",
        status: "running",
        progress: 0,
        progressLabel: "Waiting for telemetry",
      },
    ],
    window: {
      label: "Waiting for desktop review",
      sessionsInWindow: snapshot?.report?.sessions ?? 0,
      turnsInWindow: snapshot?.report?.window?.turnsInWindow ?? 0,
      basis: "last-24h",
    },
    contextHealth: {
      score: hasSyncedReport ? 88 : 0,
      status: hasSyncedReport ? "clear" : "watch",
      overloadedProjects: 0,
      riskCount: 0,
      chars: 0,
      memoryFiles: 0,
      skillCount: 0,
      suggestions: [],
    },
    projectInsights: [
      {
        name: "Harness Health",
        sources: ["Local desktop"],
        sessions: snapshot?.report?.sessions ?? 0,
        turns: snapshot?.report?.window?.turnsInWindow ?? 0,
        corrections: 0,
        toolFailures: 0,
        hedges: 0,
        alignment: hasSyncedReport ? 88 : 0,
        topics: ["tokens", "tools", "errors", "codex", "claude"],
      },
    ],
  };
}

export function compositeScore(rings: Ring[]): number {
  if (rings.length === 0) return 0;
  return Math.round(
    rings.reduce((sum, ring) => sum + ring.score, 0) / rings.length
  );
}

export function formatReportTime(timestamp?: number): string {
  if (!timestamp) return "Not synced";
  return new Date(timestamp).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatSyncTime(): string {
  return new Date().toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function trendLabel(metric: Metric): string {
  if (metric.trend === "flat" || metric.delta === 0) return "Stable";
  const amount = `${Math.abs(metric.delta)}%`;
  if (metric.good)
    return metric.trend === "up" ? `${amount} better` : `${amount} lower`;
  return metric.trend === "up" ? `${amount} higher` : `${amount} lower`;
}

export function metricNumericValue(metric: Metric): number {
  return metric.numericValue ?? parseMetricNumber(metric.value) ?? 0;
}

export function metricChartValues(metric: Metric): number[] {
  if (metric.samples?.length) {
    return metric.samples.map((sample) => Math.max(0, sample.value));
  }
  const current = Math.max(0, metricNumericValue(metric));
  if (current === 0) return [0, 0, 0, 0, 0, 0, 0];
  if (metric.preview || metric.sourceCount === 0) {
    return [0, 0, 0, 0, 0, 0, 0];
  }
  return [0, 0, 0, 0, 0, 0, Math.round(current)];
}

export function metricHasActivity(metric: Metric): boolean {
  return metricChartValues(metric).some((value) => value > 0);
}

export function ringDescription(ring: Ring): string {
  if (ring.score === 0 && ring.delta === 0) return "No data yet";
  if (ring.delta === 0) return "Stable";
  return `${ring.delta > 0 ? "Up" : "Down"} ${Math.abs(ring.delta)} points`;
}

export function projectSubtitle(project: ProjectInsight): string {
  const topics = project.topics ?? [];
  const sources = project.sources ?? [];
  if (topics.length > 0) return topics.join(" - ");
  if (sources.length > 0) return sources.join(" - ");
  return "No project topics yet";
}

export function scoreLabel(score: number): string {
  if (score === 0) return "Waiting";
  if (score >= 85) return "Closed";
  if (score >= 70) return "Steady";
  if (score >= 55) return "Watch";
  return "Needs focus";
}

export function scoreColor(score: number): string {
  if (score === 0) return colors.accent;
  if (score >= 85) return colors.green;
  if (score >= 70) return colors.accent;
  if (score >= 55) return colors.yellow;
  return colors.red;
}

export function ringInitial(key: Ring["key"]): string {
  if (key === "effectiveness") return "E";
  if (key === "alignment") return "A";
  return "E1";
}

function buildCategories(report: Report): HealthCategory[] {
  return [
    {
      id: "tokens",
      title: "Tokens",
      subtitle: "Total tokens, cache pressure, and token load per change",
      metricKeys: ["tokens.total", "cache.hit_ratio", "tokens.per_change"],
      accent: colors.ringEfficiency,
    },
    {
      id: "tools",
      title: "Tools",
      subtitle: "Tool calls, tool success, failures, and retry pressure",
      metricKeys: ["tools.calls", "tool.success_rate", "tools.error_rate"],
      accent: colors.ringEffectiveness,
    },
    {
      id: "effectiveness",
      title: "Effectiveness",
      subtitle: "Verification quality, useful work, and correction signals",
      metricKeys: [
        "effectiveness.score",
        "redundancy.signals",
        "review",
        "findings",
      ],
      accent: colors.ringAlignment,
    },
    {
      id: "time",
      title: "Time",
      subtitle: "Time spent, active sessions, and review cadence",
      metricKeys: ["time.spent", "sessions.active", "sessions"],
      accent: colors.blue,
    },
    {
      id: "harnesses",
      title: "Harness Mix",
      subtitle: "Codex versus Claude usage by session, token, and outcome",
      metricKeys: ["harness.mix", "codex.share", "claude.share"],
      accent: colors.violet,
    },
    {
      id: "context",
      title: "Context",
      subtitle: report.contextHealth
        ? `${report.contextHealth.status} - ${report.contextHealth.riskCount} risks - ${report.contextHealth.skillCount} skills`
        : "Waiting for context signal",
      metricKeys: ["context", "skills", "memory"],
      accent: colors.yellow,
    },
  ];
}

function insightFromFinding(finding: Finding): HealthInsight {
  return {
    id: finding.id,
    metricId: finding.project,
    type: finding.type === "win" ? "milestone" : "recommendation",
    severity:
      finding.type === "risk" || finding.type === "mistake"
        ? "attention"
        : finding.type === "win"
          ? "positive"
          : "neutral",
    title: finding.title,
    body: finding.summary,
    evidence: `${finding.project} - ${finding.confidence} confidence`,
    actionLabel: finding.action,
  };
}

function buildInsights(report: Report): HealthInsight[] {
  const findings = report.findings ?? [];
  const generated = findings.map(insightFromFinding);
  const ringInsights = (report.rings ?? []).map((ring) => ({
    id: `ring-${ring.key}`,
    metricId: ring.key,
    type: "trend" as const,
    severity: ring.delta >= 0 ? ("positive" as const) : ("attention" as const),
    title: `${ring.label} ${ring.delta >= 0 ? "improved" : "needs attention"}`,
    body: ring.hint,
    evidence: ringDescription(ring),
    actionLabel: `Explore ${ring.label}`,
  }));
  return [...generated, ...ringInsights].slice(0, 8);
}

function buildHabits(report: Report): HealthHabit[] {
  const contextStatus = report.contextHealth?.status ?? "watch";
  return [
    {
      id: "define-done",
      title: "Define done before the harness starts",
      category: "prompting",
      summary:
        "Write the expected output, validation command, and stop condition before asking for implementation.",
      improves: "alignment",
      actionLabel: "Use as next prompt checklist",
    },
    {
      id: "route-context",
      title:
        contextStatus === "overloaded"
          ? "Route overloaded context"
          : "Keep context lean",
      category: "context",
      summary:
        "Move durable guidance into the right AGENTS.md, CLAUDE.md, or skill so sessions reuse stable context.",
      improves: "efficiency",
      actionLabel: "Review context health",
    },
    {
      id: "verify-close",
      title: "Close with verification evidence",
      category: "verification",
      summary:
        "Ask for the exact checks run, skipped checks, and residual risk before accepting a session as complete.",
      improves: "effectiveness",
      actionLabel: "Queue verification habit",
    },
    {
      id: "minimize-sensitive-data",
      title: "Minimize raw transcript exposure",
      category: "privacy",
      summary:
        "Use aggregate metrics and source pointers first; only opt into raw text when a task truly needs it.",
      improves: "alignment",
      actionLabel: "Open sources",
    },
  ];
}

function buildAwards(report: Report, rings: Ring[]): HealthAward[] {
  const goals = report.experiments ?? [];
  const closedRings = rings.filter((ring) => ring.score >= 100);
  return [
    ...rings.map((ring) => ({
      id: `ring-${ring.key}`,
      title: `${ring.label} Ring`,
      description:
        ring.score >= 100 ? "Closed in the latest review." : ring.hint,
      category: "record" as const,
      progress: Math.min(ring.score / 100, 1),
      accent: ringColor(ring.key),
      earned: ring.score >= 100,
    })),
    ...goals.map((goal) => ({
      id: goal.id,
      title: goal.title,
      description: goal.progressLabel ?? goal.metric,
      category:
        goal.status === "running" ? ("monthly" as const) : ("special" as const),
      progress: Math.min(Math.max(goal.progress ?? 0, 0), 1),
      accent: colors.yellow,
      earned: goal.status === "concluded" || (goal.progress ?? 0) >= 1,
    })),
    {
      id: "closed-rings",
      title: "Ring Day",
      description: `${closedRings.length} of ${rings.length} Harness rings closed.`,
      category: "perfect-week",
      progress: rings.length === 0 ? 0 : closedRings.length / rings.length,
      accent: colors.green,
      earned: rings.length > 0 && closedRings.length === rings.length,
    },
  ];
}

export function buildHarnessHealthModel(
  snapshot: Snapshot | null,
  pairing: Pairing | null,
  connectionStatus: string,
  lastSyncedAt: string,
  signalBaseUrl: string,
  harnessProfileKey: HarnessProfileKey = "global"
): HarnessHealthModel {
  const report = snapshot?.report ?? localDashboardReport(snapshot);
  const activeHarness = harnessProfileForKey(harnessProfileKey);
  const rings = report.rings ?? [];
  const reportMetrics = (report.metrics ?? []).map(normalizeMetric);
  const focusedMetrics = buildFocusedMetrics(report, reportMetrics);
  const metrics = [
    ...focusedMetrics,
    ...reportMetrics.filter(
      (metric) => !focusedMetrics.some((focused) => focused.key === metric.key)
    ),
  ];
  const findings = report.findings ?? [];
  const experiments = report.experiments ?? [];
  const projects = report.projectInsights ?? [];
  const score = compositeScore(rings);
  return {
    report,
    rings,
    metrics,
    findings,
    experiments,
    projects,
    score,
    scoreLabel: scoreLabel(score),
    categories: buildCategories(report),
    insights: buildInsights(report),
    habits: buildHabits(report),
    awards: buildAwards(report, rings),
    harnessProfiles: HARNESS_PROFILES,
    activeHarness,
    sources: [
      {
        id: "desktop",
        title:
          snapshot?.desktopDeviceName ??
          pairing?.desktopDeviceName ??
          "Harness Health Desktop",
        status: connectionStatus,
        detail:
          signalBaseUrl ||
          "Pair this iPhone to a desktop Harness Health source.",
      },
      {
        id: "backup",
        title: "Encrypted backup",
        status: pairing?.backupEnabled ? "Enabled" : "Off",
        detail: pairing?.backupEnabled
          ? "Latest report snapshots can be restored from encrypted fallback storage."
          : "No cloud snapshot fallback is enabled for this pairing.",
      },
      {
        id: "watch",
        title: "Apple Watch companion",
        status: lastSyncedAt
          ? `Updated ${lastSyncedAt}`
          : "Last known snapshot",
        detail:
          "Watch receives compact rings, next action, and challenge state.",
      },
      {
        id: "healthkit",
        title: "Health permissions",
        status: "Not requested",
        detail:
          "Harness metrics are app-created today. Future Health app imports should ask only for the metric being enabled.",
      },
    ],
  };
}
