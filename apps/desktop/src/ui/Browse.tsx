import { type ReactElement, useMemo, useState } from "react";

import type {
  HarnessKind,
  HealthReport,
  LiveTelemetrySnapshot,
  Metric,
} from "../shared/types";
import {
  MetricCell,
  PageHeader,
  Pill,
  Section,
  type Option,
  Segmented,
} from "./components";
import type { HarnessHealth } from "./useHarnessHealth";

type BrowseCategory =
  | "all"
  | "efficiency"
  | "effectiveness"
  | "alignment"
  | "tools"
  | "models"
  | "context";

const CATEGORY_OPTIONS: Option<BrowseCategory>[] = [
  { value: "all", label: "All" },
  { value: "efficiency", label: "Efficiency" },
  { value: "effectiveness", label: "Effectiveness" },
  { value: "alignment", label: "Alignment" },
  { value: "tools", label: "Tools" },
  { value: "models", label: "Models" },
  { value: "context", label: "Context" },
];

const CATEGORY_COPY: Record<
  BrowseCategory,
  { title: string; body: string; source: HarnessKind | "all" }
> = {
  all: {
    title: "All Metrics",
    body: "A complete local library of normalized harness health metrics.",
    source: "all",
  },
  efficiency: {
    title: "Efficiency",
    body: "Token pressure, cache reuse, session volume, and cost-sensitive behavior.",
    source: "codex",
  },
  effectiveness: {
    title: "Effectiveness",
    body: "Tool success, useful completion, verification quality, and correction pressure.",
    source: "claude-code",
  },
  alignment: {
    title: "Alignment",
    body: "How well the harness follows your rules, intent, config, and healthy work habits.",
    source: "all",
  },
  tools: {
    title: "Tools",
    body: "Tool calls, failures, retries, MCP attribution, and permission loops.",
    source: "all",
  },
  models: {
    title: "Models",
    body: "Model mix, token distribution, sessions by source, and routing habits.",
    source: "all",
  },
  context: {
    title: "Context",
    body: "Project instructions, skills, memory, config drift, and source hygiene.",
    source: "all",
  },
};

function metricCategory(metric: Metric): BrowseCategory {
  const key =
    `${metric.canonicalKey ?? metric.key} ${metric.label}`.toLowerCase();
  if (key.includes("tool") || key.includes("mcp")) return "tools";
  if (key.includes("model") || key.includes("cache")) return "models";
  if (
    key.includes("context") ||
    key.includes("config") ||
    key.includes("skill")
  )
    return "context";
  if (key.includes("align") || key.includes("ask")) return "alignment";
  if (
    key.includes("effective") ||
    key.includes("success") ||
    key.includes("error")
  )
    return "effectiveness";
  return "efficiency";
}

function sourceLabel(source: HarnessKind | "all"): string {
  if (source === "claude-code") return "Claude";
  if (source === "codex") return "Codex";
  if (source === "cursor") return "Cursor";
  if (source === "code") return "Code";
  return "All sources";
}

function metricSeries(
  metric: Metric,
  snapshot: LiveTelemetrySnapshot | null
): number[] {
  if (!snapshot || snapshot.trendSeries.length === 0) {
    const base = Math.max(12, 46 + metric.delta);
    return [base - 10, base + 4, base - 2, base + 11, base + 8, base + 16];
  }
  const key = metric.canonicalKey ?? metric.key;
  if (key.includes("session")) {
    return snapshot.trendSeries.map((point) => point.sessions);
  }
  if (key.includes("tool") || key.includes("error")) {
    return snapshot.trendSeries.map((point) => point.toolFailures + 1);
  }
  if (key.includes("correction") || key.includes("align")) {
    return snapshot.trendSeries.map((point) => point.corrections + 1);
  }
  return snapshot.trendSeries.map((point) => Math.max(1, point.tokens / 1000));
}

function metricProvenance(metric: Metric): string {
  if (metric.provenance) return metric.provenance;
  if (metric.sourceCount)
    return `${metric.sourceCount} local telemetry samples`;
  return "Derived from sanitized local harness events";
}

function fallbackMetrics(report: HealthReport | null): Metric[] {
  if (report?.metrics && report.metrics.length > 0) return report.metrics;
  return [
    {
      key: "tokens.total",
      canonicalKey: "tokens.total",
      label: "Token Use",
      value: "18.4K",
      delta: 12,
      trend: "up",
      good: false,
      confidence: "medium",
      provenance: "Preview token usage from deterministic sample rows.",
    },
    {
      key: "tool.success_rate",
      canonicalKey: "tool.success_rate",
      label: "Tool Success",
      value: "92%",
      delta: 5,
      trend: "up",
      good: true,
      confidence: "medium",
      provenance: "Preview tool-result outcome ratio.",
    },
    {
      key: "model.mix",
      canonicalKey: "model.mix",
      label: "Model Mix",
      value: "64/36",
      delta: 2,
      trend: "flat",
      good: true,
      confidence: "low",
      provenance: "Preview Codex and Claude attribution.",
    },
  ];
}

export default function Browse({
  hd,
  report,
}: {
  hd: HarnessHealth;
  report: HealthReport | null;
}): ReactElement {
  const [category, setCategory] = useState<BrowseCategory>("all");
  const [query, setQuery] = useState("");
  const snapshot = hd.telemetrySnapshot;
  const metrics = snapshot?.metrics.length
    ? snapshot.metrics
    : fallbackMetrics(report);
  const visibleMetrics = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return metrics.filter((metric) => {
      const categoryMatch =
        category === "all" || metricCategory(metric) === category;
      const queryMatch =
        !normalized ||
        `${metric.label} ${metric.key} ${metric.canonicalKey ?? ""}`
          .toLowerCase()
          .includes(normalized);
      return categoryMatch && queryMatch;
    });
  }, [category, metrics, query]);
  const selectedCopy = CATEGORY_COPY[category];
  const sourceCounts = snapshot?.sources ?? [];

  return (
    <div className="browse-page">
      <PageHeader
        eyebrow="Browse"
        title="Metric Library"
        subtitle="Search every Harness Health metric, then inspect trend, source, and provenance from the same surface."
        primary={
          <input
            className="browse-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search metrics"
            aria-label="Search metrics"
          />
        }
      />

      <div className="browse-category-strip">
        {CATEGORY_OPTIONS.map((option) => {
          const active = option.value === category;
          const count =
            option.value === "all"
              ? metrics.length
              : metrics.filter(
                  (metric) => metricCategory(metric) === option.value
                ).length;
          return (
            <button
              key={option.value}
              type="button"
              className={`browse-category${active ? " active" : ""}`}
              onClick={() => setCategory(option.value)}
              aria-pressed={active}
            >
              <span>{option.label}</span>
              <b className="tnum">{count}</b>
            </button>
          );
        })}
      </div>

      <Section
        title={selectedCopy.title}
        hint={selectedCopy.body}
        right={<Pill tone="accent">{sourceLabel(selectedCopy.source)}</Pill>}
      >
        <Segmented<BrowseCategory>
          value={category}
          options={CATEGORY_OPTIONS}
          ariaLabel="Metric category"
          onChange={setCategory}
        />
        <div className="browse-metric-grid">
          {visibleMetrics.map((metric) => (
            <button
              key={metric.key}
              type="button"
              className="browse-metric-card"
              aria-label={`${metric.label}: ${metric.value}. ${metricProvenance(
                metric
              )}`}
            >
              <MetricCell
                metric={metric}
                series={metricSeries(metric, snapshot)}
              />
              <span className="browse-metric-foot">
                <span>{metricProvenance(metric)}</span>
                <span className="tnum">{metric.confidence ?? "medium"}</span>
              </span>
            </button>
          ))}
        </div>
      </Section>

      <div className="browse-bottom-grid">
        <Section title="Sources" hint="Local connectors feeding this library.">
          <div className="browse-source-list">
            {sourceCounts.length > 0 ? (
              sourceCounts.map((source) => (
                <div key={source.source} className="browse-source-row">
                  <span>
                    <b>{source.label}</b>
                    <em>{source.message ?? `${source.files} files watched`}</em>
                  </span>
                  <Pill tone={source.status === "watching" ? "good" : "warn"}>
                    {source.status}
                  </Pill>
                </div>
              ))
            ) : (
              <p className="card-hint">
                Start realtime ingestion to replace preview rows with live
                Claude and Codex source status.
              </p>
            )}
          </div>
        </Section>

        <Section
          title="Data Quality"
          hint="Health-style confidence and provenance."
        >
          <div className="browse-quality-list">
            <div>
              <b className="tnum">{visibleMetrics.length}</b>
              <span>visible metrics</span>
            </div>
            <div>
              <b className="tnum">
                {
                  visibleMetrics.filter(
                    (metric) => metric.confidence === "high"
                  ).length
                }
              </b>
              <span>high confidence</span>
            </div>
            <div>
              <b className="tnum">
                {snapshot?.configArtifacts.length ??
                  report?.contextHealth?.skillCount ??
                  0}
              </b>
              <span>config artifacts</span>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}
