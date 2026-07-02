import path from "node:path";

import type {
  ConfigArtifact,
  HarnessKind,
  IngestStatus,
  LiveInsight,
  LiveMetricDetail,
  LiveModelUsage,
  LiveProjectTelemetry,
  LiveTelemetrySnapshot,
  LiveTelemetrySource,
  LiveTrendPoint,
  Metric,
  MetricDefinition,
  MetricSample,
  NormalizedEvent,
  Ring,
} from "../shared/types";
import { configArtifactInsights } from "./harnessConfigScanner";

export type TelemetryRange = "24h" | "7d" | "30d" | "90d";

export interface TelemetryDetailInput {
  metricId: string;
  range?: TelemetryRange;
  filters?: {
    source?: HarnessKind;
    projectPath?: string;
    model?: string;
  };
}

export interface SnapshotInput {
  events: NormalizedEvent[];
  sources: LiveTelemetrySource[];
  configArtifacts: ConfigArtifact[];
  status: IngestStatus;
  now?: number;
}

interface WindowStats {
  start: number;
  end: number;
  events: number;
  sessions: number;
  userPrompts: number;
  assistantMessages: number;
  modelCalls: number;
  toolCalls: number;
  toolResults: number;
  toolFailures: number;
  tokensIn: number;
  tokensOut: number;
  cacheReadTokens: number;
  cacheCreateTokens: number;
  totalTokens: number;
  corrections: number;
}

interface MetricSpec {
  id: string;
  label: string;
  unit: string;
  value: (stats: WindowStats) => number;
}

const DAY = 24 * 60 * 60 * 1000;

export const METRIC_DEFINITIONS: MetricDefinition[] = [
  {
    id: "tokens.total",
    label: "Total tokens",
    category: "efficiency",
    unit: "tokens",
    valueKind: "quantity",
    aggregation: "sum",
    direction: "down",
    description:
      "Input, output, and cache-write tokens observed in model calls.",
  },
  {
    id: "tokens.per_change",
    label: "Tokens per prompt",
    category: "efficiency",
    unit: "tokens/prompt",
    valueKind: "quantity",
    aggregation: "avg",
    direction: "down",
    description: "Total model-call tokens divided by user prompt count.",
  },
  {
    id: "cache.hit_ratio",
    label: "Cache hit ratio",
    category: "efficiency",
    unit: "%",
    valueKind: "ratio",
    aggregation: "avg",
    direction: "up",
    description: "Share of reusable input served from cache-read tokens.",
  },
  {
    id: "tool.success_rate",
    label: "Tool success",
    category: "tools",
    unit: "%",
    valueKind: "ratio",
    aggregation: "avg",
    direction: "up",
    description:
      "Tool result success rate from deterministic tool-result rows.",
  },
  {
    id: "tools.calls",
    label: "Tool calls",
    category: "tools",
    unit: "calls",
    valueKind: "quantity",
    aggregation: "count",
    direction: "contextual",
    description: "Tool and MCP calls observed in the selected window.",
  },
  {
    id: "tools.error_rate",
    label: "Tool error rate",
    category: "tools",
    unit: "%",
    valueKind: "ratio",
    aggregation: "avg",
    direction: "down",
    description:
      "Failed or denied tool results divided by observed tool results.",
  },
  {
    id: "model.mix",
    label: "Model mix",
    category: "models",
    unit: "models",
    valueKind: "category",
    aggregation: "count",
    direction: "contextual",
    description: "Model usage distribution by token volume.",
  },
  {
    id: "sessions.active",
    label: "Active sessions",
    category: "effectiveness",
    unit: "sessions",
    valueKind: "quantity",
    aggregation: "count",
    direction: "contextual",
    description: "Distinct local Claude/Codex sessions in the selected window.",
  },
  {
    id: "config.artifacts",
    label: "Config artifacts",
    category: "config",
    unit: "files",
    valueKind: "quantity",
    aggregation: "count",
    direction: "contextual",
    description:
      "Non-secret guidance and configuration files found by scanner.",
  },
];

const METRIC_SPECS: Record<string, MetricSpec> = {
  "tokens.total": {
    id: "tokens.total",
    label: "Total tokens",
    unit: "tokens",
    value: (stats) => stats.totalTokens,
  },
  "tokens.per_change": {
    id: "tokens.per_change",
    label: "Tokens per prompt",
    unit: "tokens/prompt",
    value: (stats) =>
      stats.userPrompts === 0 ? 0 : stats.totalTokens / stats.userPrompts,
  },
  "cache.hit_ratio": {
    id: "cache.hit_ratio",
    label: "Cache hit ratio",
    unit: "%",
    value: (stats) => cacheRatio(stats) * 100,
  },
  "tool.success_rate": {
    id: "tool.success_rate",
    label: "Tool success",
    unit: "%",
    value: (stats) => toolSuccess(stats) * 100,
  },
  "tools.calls": {
    id: "tools.calls",
    label: "Tool calls",
    unit: "calls",
    value: (stats) => stats.toolCalls,
  },
  "tools.error_rate": {
    id: "tools.error_rate",
    label: "Tool error rate",
    unit: "%",
    value: (stats) => toolErrorRate(stats) * 100,
  },
  "sessions.active": {
    id: "sessions.active",
    label: "Active sessions",
    unit: "sessions",
    value: (stats) => stats.sessions,
  },
  corrections: {
    id: "corrections",
    label: "Re-ask proxy",
    unit: "events",
    value: (stats) => stats.corrections,
  },
};

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function pctDelta(current: number, baseline: number): number {
  if (baseline <= 0) return current > 0 ? 100 : 0;
  return Math.round(((current - baseline) / baseline) * 100);
}

function trend(delta: number): Metric["trend"] {
  if (delta > 3) return "up";
  if (delta < -3) return "down";
  return "flat";
}

function confidence(count: number): NonNullable<Metric["confidence"]> {
  if (count >= 30) return "high";
  if (count >= 8) return "medium";
  return "low";
}

function compact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return `${Math.round(value)}`;
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function windowStats(
  events: NormalizedEvent[],
  start: number,
  end: number
): WindowStats {
  const inWindow = events.filter(
    (event) => event.ts >= start && event.ts < end
  );
  const sessions = new Set<string>();
  let userPrompts = 0;
  let assistantMessages = 0;
  let modelCalls = 0;
  let toolCalls = 0;
  let toolResults = 0;
  let toolFailures = 0;
  let tokensIn = 0;
  let tokensOut = 0;
  let cacheReadTokens = 0;
  let cacheCreateTokens = 0;

  for (const event of inWindow) {
    sessions.add(`${event.source}:${event.sessionId}`);
    if (event.kind === "user_prompt") userPrompts += 1;
    if (event.kind === "assistant_message") assistantMessages += 1;
    if (event.kind === "model_call") {
      modelCalls += 1;
      tokensIn += event.tokensIn ?? 0;
      tokensOut += event.tokensOut ?? 0;
      cacheReadTokens += event.cacheReadTokens ?? 0;
      cacheCreateTokens += event.cacheCreateTokens ?? 0;
    }
    if (event.kind === "tool_call" || event.kind === "mcp_call") toolCalls += 1;
    if (event.kind === "tool_result") {
      toolResults += 1;
      if (event.toolOutcome === "error" || event.toolOutcome === "denied") {
        toolFailures += 1;
      }
    }
  }

  const totalTokens =
    tokensIn + tokensOut + cacheReadTokens + cacheCreateTokens;
  return {
    start,
    end,
    events: inWindow.length,
    sessions: sessions.size,
    userPrompts,
    assistantMessages,
    modelCalls,
    toolCalls,
    toolResults,
    toolFailures,
    tokensIn,
    tokensOut,
    cacheReadTokens,
    cacheCreateTokens,
    totalTokens,
    corrections: Math.max(0, userPrompts - sessions.size),
  };
}

function cacheRatio(stats: WindowStats): number {
  const denominator =
    stats.tokensIn + stats.cacheReadTokens + stats.cacheCreateTokens;
  return denominator === 0 ? 0 : stats.cacheReadTokens / denominator;
}

function toolSuccess(stats: WindowStats): number {
  if (stats.toolResults === 0) return stats.toolCalls === 0 ? 1 : 0.85;
  return (stats.toolResults - stats.toolFailures) / stats.toolResults;
}

function toolErrorRate(stats: WindowStats): number {
  const denominator = stats.toolResults || stats.toolCalls;
  return denominator === 0 ? 0 : stats.toolFailures / denominator;
}

function perPromptTokens(stats: WindowStats): number {
  return stats.userPrompts === 0 ? 0 : stats.totalTokens / stats.userPrompts;
}

function baselineDaily(
  stats: WindowStats,
  metric: (stats: WindowStats) => number
): number {
  const days = Math.max(1, (stats.end - stats.start) / DAY);
  return metric(stats) / days;
}

function ringScores(current: WindowStats, baseline: WindowStats): Ring[] {
  const currentPerPrompt = perPromptTokens(current);
  const baselinePerPrompt = perPromptTokens(baseline);
  const tokenScore =
    baselinePerPrompt > 0
      ? clamp(
          72 + ((baselinePerPrompt - currentPerPrompt) / baselinePerPrompt) * 38
        )
      : current.totalTokens > 0
        ? 70
        : 52;
  const cacheScore = clamp(50 + cacheRatio(current) * 70);
  const toolScore = clamp(toolSuccess(current) * 100);
  const correctionRate =
    current.userPrompts === 0 ? 0 : current.corrections / current.userPrompts;
  const baselineCorrectionRate =
    baseline.userPrompts === 0
      ? 0
      : baseline.corrections / baseline.userPrompts;
  const correctionScore = clamp(
    82 - correctionRate * 90 + (baselineCorrectionRate - correctionRate) * 60
  );
  const activityScore = clamp(current.sessions > 0 ? 78 : 48);

  const efficiency = Math.round(
    tokenScore * 0.55 + cacheScore * 0.25 + toolScore * 0.2
  );
  const effectiveness = Math.round(
    toolScore * 0.55 + correctionScore * 0.3 + activityScore * 0.15
  );
  const alignment = Math.round(
    correctionScore * 0.65 + activityScore * 0.2 + cacheScore * 0.15
  );
  const baselineRings =
    baseline.events === 0
      ? { efficiency, effectiveness, alignment }
      : {
          efficiency: Math.round(70 + cacheRatio(baseline) * 20),
          effectiveness: Math.round(toolSuccess(baseline) * 82),
          alignment: Math.round(82 - baselineCorrectionRate * 85),
        };

  return [
    {
      key: "efficiency",
      label: "Efficiency",
      score: clamp(efficiency),
      delta: Math.round(efficiency - baselineRings.efficiency),
      hint: `${compact(current.totalTokens)} tokens, ${percent(cacheRatio(current))} cache reuse`,
    },
    {
      key: "effectiveness",
      label: "Effectiveness",
      score: clamp(effectiveness),
      delta: Math.round(effectiveness - baselineRings.effectiveness),
      hint: `${percent(toolSuccess(current))} tool success across ${current.toolResults || current.toolCalls} tool events`,
    },
    {
      key: "alignment",
      label: "Alignment",
      score: clamp(alignment),
      delta: Math.round(alignment - baselineRings.alignment),
      hint: `${current.corrections} re-ask proxy events in ${current.sessions} sessions`,
    },
  ];
}

function metric(
  key: string,
  canonicalKey: string,
  label: string,
  value: string,
  current: number,
  baseline: number,
  goodWhenLower: boolean,
  sourceCount: number,
  provenance: string
): Metric {
  const delta = pctDelta(current, baseline);
  return {
    key,
    canonicalKey,
    label,
    value,
    numericValue: current,
    unit: metricUnit(canonicalKey),
    delta,
    trend: trend(delta),
    good: goodWhenLower ? delta <= 0 : delta >= 0,
    sourceCount,
    confidence: confidence(sourceCount),
    provenance,
  };
}

function metricUnit(canonicalKey: string): string {
  const spec = METRIC_SPECS[canonicalKey];
  if (spec) return spec.unit;
  if (canonicalKey.includes("rate") || canonicalKey.includes("ratio")) {
    return "%";
  }
  return "";
}

function buildMetrics(current: WindowStats, baseline: WindowStats): Metric[] {
  const baselineTokensDaily = baselineDaily(
    baseline,
    (stats) => stats.totalTokens
  );
  const currentPerPrompt = perPromptTokens(current);
  const baselinePerPrompt = perPromptTokens(baseline);
  return [
    metric(
      "tokens",
      "tokens.total",
      "Tokens",
      compact(current.totalTokens),
      current.totalTokens,
      baselineTokensDaily,
      true,
      current.modelCalls,
      "Claude/Codex usage rows; raw transcript text is not retained."
    ),
    metric(
      "tokens_per_change",
      "tokens.per_change",
      "Tok / prompt",
      compact(currentPerPrompt),
      currentPerPrompt,
      baselinePerPrompt,
      true,
      current.userPrompts,
      "Derived from model tokens divided by user prompts."
    ),
    metric(
      "cache",
      "cache.hit_ratio",
      "Cache",
      percent(cacheRatio(current)),
      cacheRatio(current) * 100,
      cacheRatio(baseline) * 100,
      false,
      current.modelCalls,
      "Cache-read tokens divided by reusable input token volume."
    ),
    metric(
      "tool_success",
      "tool.success_rate",
      "Tool success",
      percent(toolSuccess(current)),
      toolSuccess(current) * 100,
      toolSuccess(baseline) * 100,
      false,
      current.toolResults || current.toolCalls,
      "Tool-result rows with ok/error/denied attribution."
    ),
    metric(
      "tools_calls",
      "tools.calls",
      "Tool Use",
      compact(current.toolCalls),
      current.toolCalls,
      baselineDaily(baseline, (stats) => stats.toolCalls),
      false,
      current.toolCalls,
      "Tool and MCP call events observed in local telemetry."
    ),
    metric(
      "tools_error_rate",
      "tools.error_rate",
      "Error Rate",
      percent(toolErrorRate(current)),
      toolErrorRate(current) * 100,
      toolErrorRate(baseline) * 100,
      true,
      current.toolResults || current.toolCalls,
      "Failed or denied tool results divided by observed tool results."
    ),
    metric(
      "sessions",
      "sessions.active",
      "Sessions",
      compact(current.sessions),
      current.sessions,
      baselineDaily(baseline, (stats) => stats.sessions),
      false,
      current.events,
      "Distinct session ids seen in the current window."
    ),
    {
      key: "cost",
      canonicalKey: "cost.total",
      label: "Cost",
      value: "$0.00",
      delta: 0,
      trend: "flat",
      good: true,
      sourceCount: current.modelCalls,
      confidence: "low",
      provenance:
        "Provider price table is not configured yet; no stale prices are hardcoded.",
    },
  ];
}

function buildProjects(
  events: NormalizedEvent[],
  start: number,
  end: number
): LiveProjectTelemetry[] {
  const rows = new Map<string, LiveProjectTelemetry>();
  for (const event of events) {
    if (event.ts < start || event.ts >= end) continue;
    const existing = rows.get(event.projectPath) ?? {
      path: event.projectPath,
      name: event.projectName || path.basename(event.projectPath),
      sources: [],
      sessions: 0,
      events: 0,
      tokens: 0,
      corrections: 0,
      toolFailures: 0,
      lastActivityAt: null,
      contextScore: undefined,
    };
    if (!existing.sources.includes(event.source))
      existing.sources.push(event.source);
    existing.events += 1;
    existing.lastActivityAt = Math.max(existing.lastActivityAt ?? 0, event.ts);
    if (event.kind === "model_call") {
      existing.tokens +=
        (event.tokensIn ?? 0) +
        (event.tokensOut ?? 0) +
        (event.cacheReadTokens ?? 0) +
        (event.cacheCreateTokens ?? 0);
    }
    if (event.kind === "tool_result" && event.toolOutcome !== "ok") {
      existing.toolFailures += 1;
    }
    rows.set(event.projectPath, existing);
  }

  const sessionSets = new Map<string, Set<string>>();
  for (const event of events) {
    if (event.ts < start || event.ts >= end) continue;
    const set = sessionSets.get(event.projectPath) ?? new Set<string>();
    set.add(`${event.source}:${event.sessionId}`);
    sessionSets.set(event.projectPath, set);
  }

  for (const [projectPath, set] of sessionSets) {
    const row = rows.get(projectPath);
    if (row) {
      row.sessions = set.size;
      row.corrections = Math.max(0, row.events - row.sessions);
    }
  }

  return [...rows.values()]
    .sort((a, b) => (b.lastActivityAt ?? 0) - (a.lastActivityAt ?? 0))
    .slice(0, 8);
}

function buildModelMix(
  events: NormalizedEvent[],
  start: number,
  end: number
): LiveModelUsage[] {
  const byKey = new Map<string, LiveModelUsage>();
  let total = 0;
  for (const event of events) {
    if (event.ts < start || event.ts >= end || event.kind !== "model_call")
      continue;
    const model = event.model ?? "unknown";
    const tokens =
      (event.tokensIn ?? 0) +
      (event.tokensOut ?? 0) +
      (event.cacheReadTokens ?? 0) +
      (event.cacheCreateTokens ?? 0);
    total += tokens;
    const key = `${event.source}:${model}`;
    const existing =
      byKey.get(key) ??
      ({
        model,
        tokens: 0,
        sessions: 0,
        source: event.source,
        share: 0,
      } satisfies LiveModelUsage);
    existing.tokens += tokens;
    existing.sessions += 1;
    byKey.set(key, existing);
  }
  return [...byKey.values()]
    .map((item) => ({ ...item, share: total === 0 ? 0 : item.tokens / total }))
    .sort((a, b) => b.tokens - a.tokens)
    .slice(0, 8);
}

function buildTrends(events: NormalizedEvent[], now: number): LiveTrendPoint[] {
  const points: LiveTrendPoint[] = [];
  for (let i = 13; i >= 0; i -= 1) {
    const start = new Date(now - i * DAY);
    start.setHours(0, 0, 0, 0);
    const startMs = start.getTime();
    const endMs = startMs + DAY;
    const stats = windowStats(events, startMs, endMs);
    points.push({
      start: startMs,
      end: endMs,
      label: start.toLocaleDateString([], { month: "short", day: "numeric" }),
      tokens: stats.totalTokens,
      sessions: stats.sessions,
      corrections: stats.corrections,
      toolFailures: stats.toolFailures,
    });
  }
  return points;
}

function buildInsights(
  current: WindowStats,
  baseline: WindowStats,
  configArtifacts: ConfigArtifact[],
  now: number,
  sources: LiveTelemetrySource[]
): LiveInsight[] {
  const insights: LiveInsight[] = [];
  const currentWindow = { start: current.start, end: current.end };
  const baselineWindow = { start: baseline.start, end: baseline.end };
  const baselineTokenDaily = baselineDaily(
    baseline,
    (stats) => stats.totalTokens
  );

  if (current.events === 0) {
    insights.push({
      id: "telemetry-low-data",
      metricIds: ["sessions.active"],
      type: "consistency",
      severity: sources.some((source) => source.status === "watching")
        ? "neutral"
        : "warning",
      title: "Waiting for live harness activity",
      explanation:
        "The watcher is ready, but no normalized events landed in the current 24-hour window.",
      recommendation:
        "Use Claude Code or Codex normally; new transcript rows should appear within a few seconds.",
      comparison: { currentWindow, baselineWindow },
      confidence: "high",
      sourceSampleCount: sources.reduce((sum, source) => sum + source.files, 0),
      deepLink: "summary",
      createdAt: now,
    });
  }

  if (
    baselineTokenDaily > 0 &&
    current.totalTokens > baselineTokenDaily * 1.4
  ) {
    insights.push({
      id: "tokens-spike",
      metricIds: ["tokens.total", "tokens.per_change"],
      type: "anomaly",
      severity: "warning",
      title: "Token volume is above baseline",
      explanation: `The current 24-hour window is ${pctDelta(current.totalTokens, baselineTokenDaily)}% above the 14-day daily baseline.`,
      recommendation:
        "Check active projects for oversized context or repeated prompts before the next Health Review.",
      comparison: {
        currentWindow,
        baselineWindow,
        delta: current.totalTokens - baselineTokenDaily,
        deltaPercent: pctDelta(current.totalTokens, baselineTokenDaily),
      },
      confidence: confidence(current.modelCalls),
      sourceSampleCount: current.modelCalls,
      deepLink: "metric:tokens.total",
      createdAt: now,
    });
  }

  if (current.modelCalls >= 4 && cacheRatio(current) < 0.15) {
    insights.push({
      id: "cache-low",
      metricIds: ["cache.hit_ratio"],
      type: "recommendation",
      severity: "neutral",
      title: "Cache reuse is low",
      explanation: `Only ${percent(cacheRatio(current))} of reusable input volume is coming from cache-read tokens.`,
      recommendation:
        "Look for changing context, scattered memory, or prompt patterns that prevent stable reuse.",
      comparison: {
        currentWindow,
        baselineWindow,
        deltaPercent: pctDelta(cacheRatio(current), cacheRatio(baseline)),
      },
      confidence: confidence(current.modelCalls),
      sourceSampleCount: current.modelCalls,
      deepLink: "metric:cache.hit_ratio",
      createdAt: now,
    });
  }

  if (
    (current.toolResults || current.toolCalls) >= 5 &&
    toolSuccess(current) < 0.85
  ) {
    insights.push({
      id: "tool-success-low",
      metricIds: ["tool.success_rate"],
      type: "recommendation",
      severity: "warning",
      title: "Tool success needs attention",
      explanation: `${current.toolFailures} tool result${current.toolFailures === 1 ? "" : "s"} failed or were denied in the current window.`,
      recommendation:
        "Check MCP wrappers, permissions, and frequently failing commands before accepting new guidance.",
      comparison: {
        currentWindow,
        baselineWindow,
        deltaPercent: pctDelta(toolSuccess(current), toolSuccess(baseline)),
      },
      confidence: confidence(current.toolResults || current.toolCalls),
      sourceSampleCount: current.toolResults || current.toolCalls,
      deepLink: "metric:tool.success_rate",
      createdAt: now,
    });
  }

  return [...insights, ...configArtifactInsights(configArtifacts, now)].slice(
    0,
    8
  );
}

export function buildTelemetrySnapshot(
  input: SnapshotInput
): LiveTelemetrySnapshot {
  const now = input.now ?? Date.now();
  const currentStart = now - DAY;
  const baselineStart = now - 15 * DAY;
  const baselineEnd = now - DAY;
  const current = windowStats(input.events, currentStart, now);
  const baseline = windowStats(input.events, baselineStart, baselineEnd);

  return {
    generatedAt: now,
    window: { start: currentStart, end: now, label: "Last 24 hours" },
    baselineWindow: {
      start: baselineStart,
      end: baselineEnd,
      label: "Previous 14 days",
    },
    rings: ringScores(current, baseline),
    metrics: buildMetrics(current, baseline),
    insights: buildInsights(
      current,
      baseline,
      input.configArtifacts,
      now,
      input.sources
    ),
    sources: input.sources,
    activeProjects: buildProjects(input.events, currentStart, now),
    modelMix: buildModelMix(input.events, currentStart, now),
    trendSeries: buildTrends(input.events, now),
    configArtifacts: input.configArtifacts,
    status: input.status,
  };
}

function rangeMs(range: TelemetryRange): number {
  switch (range) {
    case "90d":
      return 90 * DAY;
    case "30d":
      return 30 * DAY;
    case "7d":
      return 7 * DAY;
    case "24h":
      return DAY;
  }
}

function sampleStep(range: TelemetryRange): number {
  return range === "24h" ? 60 * 60 * 1000 : DAY;
}

function sampleLabel(metricId: string): MetricSpec {
  return METRIC_SPECS[metricId] ?? METRIC_SPECS["tokens.total"];
}

export function buildMetricDetail(
  input: TelemetryDetailInput,
  events: NormalizedEvent[],
  sources: LiveTelemetrySource[],
  now = Date.now()
): LiveMetricDetail {
  const range = input.range ?? "24h";
  const spec = sampleLabel(input.metricId);
  const end = now;
  const start = now - rangeMs(range);
  const step = sampleStep(range);
  const samples: MetricSample[] = [];

  for (let bucketStart = start; bucketStart < end; bucketStart += step) {
    const bucketEnd = Math.min(bucketStart + step, end);
    const stats = windowStats(events, bucketStart, bucketEnd);
    samples.push({
      metricId: spec.id,
      value: spec.value(stats),
      unit: spec.unit,
      startAt: bucketStart,
      endAt: bucketEnd,
      sourceCount: stats.events,
    });
  }

  const currentStats = windowStats(events, start, end);
  const baselineStats = windowStats(events, start - rangeMs(range), start);
  return {
    metricId: spec.id,
    label: spec.label,
    unit: spec.unit,
    current: {
      metricId: spec.id,
      value: spec.value(currentStats),
      unit: spec.unit,
      startAt: start,
      endAt: end,
      sourceCount: currentStats.events,
    },
    baseline: {
      metricId: spec.id,
      value: spec.value(baselineStats),
      unit: spec.unit,
      startAt: start - rangeMs(range),
      endAt: start,
      sourceCount: baselineStats.events,
    },
    samples,
    sources,
    insights: [],
  };
}
