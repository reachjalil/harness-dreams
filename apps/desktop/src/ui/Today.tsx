import { type ReactElement, type ReactNode, useState } from "react";

import { demoActivityFor, timeOfDay } from "../shared/timeOfDay";
import type {
  ActionQueueEntry,
  HealthReport,
  Experiment,
  ExperimentVerdict,
  LiveTelemetrySnapshot,
} from "../shared/types";
import { parseNum } from "./anim";
import {
  alignmentSplit,
  AreaChart,
  Button,
  bandLabel,
  Contributors,
  GroupedBars,
  MetricCell,
  type Option,
  Pill,
  RingChip,
  ScoreRing,
  Section,
  Segmented,
  SummaryCard,
} from "./components";
import {
  GREETING,
  LOOP_WHISPER,
  type MomentContext,
  momentCopy,
  RING_TIP,
  TERM,
} from "./explainers";
import { Icon, type IconName } from "./icons";
import { decideMoment, type Moment } from "./moment";
import type { HarnessHealth } from "./useHarnessHealth";

function composite(report: HealthReport): number {
  const sum = report.rings.reduce((acc, r) => acc + r.score, 0);
  return Math.round(sum / Math.max(1, report.rings.length));
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function dayLabel(ts: number): string {
  return new Date(ts).toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function shortDate(ts: number): string {
  return new Date(ts).toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
}

function scheduleTimeLabel(time: string | undefined): string {
  if (!time) return "3:00 AM";
  const [hourRaw, minute = "00"] = time.split(":");
  const hour = Number.parseInt(hourRaw ?? "0", 10);
  if (!Number.isFinite(hour)) return "3:00 AM";
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${minute} ${period}`;
}

function ringScore(report: HealthReport, key: string): number {
  return report.rings.find((r) => r.key === key)?.score ?? 0;
}

function trendTone(delta: number): "positive" | "negative" | "neutral" {
  if (delta > 0) return "positive";
  if (delta < 0) return "negative";
  return "neutral";
}

function signed(value: number): string {
  return `${value > 0 ? "+" : ""}${value}`;
}

function formatAgo(ts: number | null): string {
  if (!ts) return "No activity";
  const diff = Math.max(0, Date.now() - ts);
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function sourceTone(
  status: string
): "neutral" | "good" | "warn" | "danger" | "accent" {
  if (status === "watching") return "good";
  if (status === "scanning") return "accent";
  if (status === "error") return "danger";
  return "warn";
}

function insightTone(
  severity: LiveTelemetrySnapshot["insights"][number]["severity"]
): "neutral" | "good" | "warn" | "danger" {
  if (severity === "positive") return "good";
  if (severity === "warning") return "warn";
  return "neutral";
}

function metricByCanonical(
  snapshot: LiveTelemetrySnapshot,
  canonicalKey: string
) {
  return snapshot.metrics.find(
    (metric) => metric.canonicalKey === canonicalKey
  );
}

const LIVE_METRIC_ICONS: Record<string, IconName> = {
  "tokens.total": "depth",
  "cache.hit_ratio": "sync",
  "tool.success_rate": "accept",
  "sessions.active": "play",
};

function liveMetricIcon(metric: {
  canonicalKey?: string;
  key: string;
}): IconName {
  return LIVE_METRIC_ICONS[metric.canonicalKey ?? metric.key] ?? "dashboard";
}

const HEALTH_HABITS = [
  {
    id: "define-done",
    title: "Define done before tools run",
    metric: "Alignment",
    body: "State the expected output, validation command, and stop condition before a long agent session starts.",
    why: "This lowers re-asks and prevents the harness from optimizing the wrong task.",
  },
  {
    id: "keep-context-lean",
    title: "Keep context lean and routed",
    metric: "Efficiency",
    body: "Move durable rules into the right project file or skill, then prune repeated background text from prompts.",
    why: "Stable, smaller context improves cache reuse and makes model selection more predictable.",
  },
  {
    id: "verify-close",
    title: "Close with verification evidence",
    metric: "Effectiveness",
    body: "Ask the harness to end every implementation with the exact checks it ran and any untested area.",
    why: "Tool success and review quality improve when completion is tied to evidence, not confidence.",
  },
] as const;

function verdictTone(verdict?: ExperimentVerdict): "good" | "warn" | "danger" {
  if (verdict === "helped") return "good";
  if (verdict === "worse") return "danger";
  return "warn";
}

function parseAlignmentDelta(note?: string): number | null {
  if (!note) return null;
  const match = note.match(/\(([+-]?\d+)\)/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

// ── The welcoming layer — greeting nudge + demo time travel ───────────────────

const CTA_ICON: Record<string, IconName> = {
  review: "review",
  quick: "play",
  full: "healthReview",
};

const DEMO_TIME_OPTIONS: Option<string>[] = [
  { value: "live", label: "Live" },
  { value: "morning", label: "Morning" },
  { value: "midday", label: "Midday" },
  { value: "evening", label: "Evening" },
];

/** Demo-only control to walk the day: morning → midday → evening, or live clock. */
function DemoTimeSwitcher({
  value,
  onChange,
}: {
  value: string | null;
  onChange: HarnessHealth["setDemoTimeOfDay"];
}): ReactElement {
  return (
    <Segmented<string>
      value={value ?? "live"}
      options={DEMO_TIME_OPTIONS}
      ariaLabel="Demo time of day"
      onChange={(next) =>
        onChange(
          next === "live" ? null : (next as "morning" | "midday" | "evening")
        )
      }
    />
  );
}

/** A flat, body-integrated nudge — the one contextual thing to do right now. */
function DailyMoment({
  moment,
  eyebrow,
  title,
  subtitle,
  cta,
  progress,
  onAct,
}: {
  moment: Moment;
  eyebrow: string;
  title: string;
  subtitle: string;
  cta?: string;
  progress: number;
  onAct: () => void;
}): ReactElement {
  const running = moment.kind === "running";
  const calm = moment.kind === "rest" || moment.kind === "standby";
  return (
    <section className={`moment moment-${moment.kind}`}>
      <div className="moment-text">
        <span className="moment-eyebrow">{eyebrow}</span>
        <h2 className="moment-title">{title}</h2>
        <p className="moment-sub">{subtitle}</p>
        {running ? (
          <div className="moment-progress" aria-hidden="true">
            <div
              className="moment-progress-fill"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
        ) : null}
      </div>
      {!running && cta ? (
        <div className="moment-action">
          <Button variant={calm ? "ghost" : "accent"} onClick={onAct}>
            <Icon name={CTA_ICON[moment.ctaKind ?? "full"]} size={16} />
            {cta}
          </Button>
        </div>
      ) : null}
    </section>
  );
}

function LiveHealthSummary({
  snapshot,
  greeting = "Today",
  subtitle,
  actions,
  onRefresh,
}: {
  snapshot: LiveTelemetrySnapshot | null;
  greeting?: string;
  subtitle?: string;
  actions?: ReactNode;
  onRefresh: () => void;
}): ReactElement {
  if (!snapshot) {
    return (
      <section className="health-summary-shell">
        <div className="health-summary-head">
          <div>
            <span className="dash-eyebrow">Today</span>
            <h1>{greeting}</h1>
            <p>{subtitle ?? "Live telemetry is starting up."}</p>
          </div>
          <div className="health-summary-actions">
            {actions}
            <Button variant="ghost" onClick={onRefresh}>
              <Icon name="sync" size={15} />
              Refresh
            </Button>
          </div>
        </div>
        <p className="muted">Waiting for the first local telemetry snapshot.</p>
      </section>
    );
  }

  const tokens = metricByCanonical(snapshot, "tokens.total");
  const cache = metricByCanonical(snapshot, "cache.hit_ratio");
  const toolSuccess = metricByCanonical(snapshot, "tool.success_rate");
  const sessions = metricByCanonical(snapshot, "sessions.active");
  const metrics = [tokens, cache, toolSuccess, sessions].filter(
    (metric): metric is NonNullable<typeof metric> => metric != null
  );
  const healthScore =
    snapshot.rings.length === 0
      ? 0
      : Math.round(
          snapshot.rings.reduce((sum, ring) => sum + ring.score, 0) /
            snapshot.rings.length
        );
  const lastActivityAt =
    snapshot.sources.reduce<number | null>((latest, source) => {
      if (!source.lastActivityAt) return latest;
      return latest == null
        ? source.lastActivityAt
        : Math.max(latest, source.lastActivityAt);
    }, null) ?? snapshot.generatedAt;
  const activeSourceCount = snapshot.sources.filter(
    (source) => source.status === "watching" || source.status === "scanning"
  ).length;
  const totalEvents = snapshot.sources.reduce(
    (sum, source) => sum + source.events,
    0
  );
  const topInsight = snapshot.insights[0];
  const featuredProject = snapshot.activeProjects[0];
  const maxModelTokens = Math.max(
    1,
    ...snapshot.modelMix.map((model) => model.tokens)
  );
  const summarySubtitle =
    subtitle ??
    `${snapshot.window.label} · ${activeSourceCount}/${snapshot.sources.length} sources active`;

  return (
    <section className="health-summary-shell" aria-label="Today summary">
      <div className="health-summary-head">
        <div>
          <span className="dash-eyebrow">Today</span>
          <h1>{greeting}</h1>
          <p>{summarySubtitle}</p>
        </div>
        <div className="health-summary-actions">
          {actions}
          <Button variant="ghost" onClick={onRefresh}>
            <Icon name="sync" size={15} />
            Refresh
          </Button>
        </div>
      </div>
      <div className="live-summary health-summary">
        <div className="health-hero">
          <div className="health-hero-copy">
            <span className="dash-eyebrow">Harness Health</span>
            <h2>Live vitals for your agent work</h2>
            <p>
              Token load, model behavior, tool reliability, and context health
              update from local Codex and Claude activity.
            </p>
            <div className="health-status-row">
              <Pill tone={sourceTone(snapshot.status.state)}>
                {snapshot.status.state}
              </Pill>
              <span>{formatAgo(lastActivityAt)}</span>
              <span>{totalEvents.toLocaleString()} events</span>
            </div>
          </div>

          <div className="health-hero-ring">
            <ScoreRing rings={snapshot.rings} score={healthScore} />
          </div>

          <div className="health-highlight-card">
            <span className="dash-eyebrow">Highlight</span>
            {topInsight ? (
              <>
                <h3>{topInsight.title}</h3>
                <p>{topInsight.recommendation ?? topInsight.explanation}</p>
                <Pill tone={insightTone(topInsight.severity)}>
                  {topInsight.confidence} confidence
                </Pill>
              </>
            ) : featuredProject ? (
              <>
                <h3>{featuredProject.name}</h3>
                <p>
                  {featuredProject.sessions} sessions and{" "}
                  {featuredProject.tokens.toLocaleString()} tokens in this
                  window.
                </p>
                <Pill tone={featuredProject.toolFailures > 0 ? "warn" : "good"}>
                  {featuredProject.toolFailures} tool fails
                </Pill>
              </>
            ) : (
              <>
                <h3>Ready for live telemetry</h3>
                <p>
                  Keep Codex or Claude open and Harness Health will fill this
                  space as local activity arrives.
                </p>
                <Pill tone="accent">{snapshot.status.message}</Pill>
              </>
            )}
          </div>
        </div>

        <div
          className="health-ring-strip"
          role="group"
          aria-label="Health area rings"
        >
          {snapshot.rings.map((ring) => (
            <RingChip key={ring.key} ring={ring} />
          ))}
        </div>

        <div className="health-favorites">
          <div className="health-section-line">
            <div>
              <span className="dash-eyebrow">Favorites</span>
              <h3>Metrics you should check first</h3>
            </div>
            <span className="health-freshness">{snapshot.status.message}</span>
          </div>

          <div className="live-metrics health-metric-grid">
            {metrics.map((metric) => (
              <article key={metric.key} className="live-metric health-metric">
                <div className="health-metric-icon">
                  <Icon name={liveMetricIcon(metric)} size={17} />
                </div>
                <div className="live-metric-top">
                  <span>{metric.label}</span>
                  <Pill tone={metric.good ? "good" : "warn"}>
                    {metric.confidence ?? "low"}
                  </Pill>
                </div>
                <strong>{metric.value}</strong>
                <span className={metric.good ? "live-good" : "live-warn"}>
                  {signed(metric.delta)}% vs baseline
                </span>
                {metric.provenance ? (
                  <span className="health-metric-source">
                    {metric.provenance}
                  </span>
                ) : null}
              </article>
            ))}
          </div>
        </div>

        <div className="health-dashboard-grid">
          <div className="live-panel health-panel">
            <div className="live-panel-head">
              <span className="dash-eyebrow">Browse health areas</span>
              <Icon name="search" size={15} />
            </div>
            <div className="health-area-menu">
              {snapshot.rings.map((ring) => (
                <div key={ring.key} className={`health-area ${ring.key}`}>
                  <span className="health-area-dot" />
                  <div>
                    <h3>{ring.label}</h3>
                    <p>{ring.hint}</p>
                  </div>
                  <b className="tnum">{ring.score}</b>
                </div>
              ))}
              <div className="health-area context">
                <span className="health-area-dot" />
                <div>
                  <h3>Context</h3>
                  <p>
                    {snapshot.configArtifacts.length} config artifacts found
                  </p>
                </div>
                <b className="tnum">{snapshot.configArtifacts.length}</b>
              </div>
            </div>
          </div>

          <div className="live-panel health-panel">
            <div className="live-panel-head">
              <span className="dash-eyebrow">Model mix</span>
              <Icon name="depth" size={15} />
            </div>
            {snapshot.modelMix.length === 0 ? (
              <p className="muted">No model usage in the current window.</p>
            ) : (
              <div className="live-models">
                {snapshot.modelMix.slice(0, 5).map((model) => (
                  <div
                    key={`${model.source}:${model.model}`}
                    className="live-model"
                  >
                    <div className="live-model-row">
                      <span>{model.model}</span>
                      <b>{Math.round(model.share * 100)}%</b>
                    </div>
                    <div className="live-bar" aria-hidden="true">
                      <span
                        style={{
                          width: `${Math.max(
                            4,
                            Math.round((model.tokens / maxModelTokens) * 100)
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="live-panel health-panel">
            <div className="live-panel-head">
              <span className="dash-eyebrow">Sources</span>
              <Icon name="data" size={15} />
            </div>
            <div className="live-sources health-sources">
              {snapshot.sources.map((source) => (
                <article key={source.source} className="live-source">
                  <div>
                    <div className="live-source-title">
                      <Icon name="data" size={15} />
                      {source.label}
                    </div>
                    <span>{formatAgo(source.lastActivityAt)}</span>
                  </div>
                  <Pill tone={sourceTone(source.status)}>{source.status}</Pill>
                  <div className="live-source-counts">
                    <span>{source.files} files</span>
                    <span>{source.events} events</span>
                    <span>{source.sessions} sessions</span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>

        <div className="live-panel health-panel health-insight-panel">
          <div className="live-panel-head">
            <span className="dash-eyebrow">Recommendations</span>
            <Icon name="finding-opportunity" size={15} />
          </div>
          {snapshot.insights.length === 0 ? (
            <p className="muted">No deterministic insights in this window.</p>
          ) : (
            <div className="live-insights health-insights">
              {snapshot.insights.slice(0, 3).map((insight) => (
                <article key={insight.id} className="live-insight">
                  <Pill tone={insightTone(insight.severity)}>
                    {insight.confidence}
                  </Pill>
                  <div>
                    <h3>{insight.title}</h3>
                    <p>{insight.explanation}</p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function HealthHabitsEducation({
  snapshot,
}: {
  snapshot: LiveTelemetrySnapshot | null;
}): ReactElement {
  const topInsight = snapshot?.insights[0];
  return (
    <Section
      title="Healthy Harness Habits"
      hint="Short education tied to the same metrics Harness Health measures over time."
      right={
        topInsight ? (
          <Pill tone={insightTone(topInsight.severity)}>
            {topInsight.confidence} confidence
          </Pill>
        ) : undefined
      }
    >
      <div className="habit-education-grid">
        {HEALTH_HABITS.map((habit) => (
          <article key={habit.id} className="habit-card">
            <div className="habit-card-head">
              <span className="habit-icon">
                <Icon name="sparkle" size={16} />
              </span>
              <Pill tone="accent">{habit.metric}</Pill>
            </div>
            <h3>{habit.title}</h3>
            <p>{habit.body}</p>
            <div className="habit-why">{habit.why}</div>
          </article>
        ))}
      </div>
      {topInsight ? (
        <div className="habit-next">
          <div>
            <span className="dash-eyebrow">Current teaching moment</span>
            <h3>{topInsight.title}</h3>
            <p>{topInsight.recommendation ?? topInsight.explanation}</p>
          </div>
        </div>
      ) : null}
    </Section>
  );
}

/**
 * Calm review interstitial — shown when a fresh review is waiting. Welcomes the
 * user and offers the choice to review it now or jump straight to the dashboard.
 */
function WelcomeReview({
  greeting,
  copy,
  report,
  onReview,
  onDashboard,
}: {
  greeting: string;
  copy: { eyebrow: string; title: string; subtitle: string };
  report: HealthReport;
  onReview: () => void;
  onDashboard: () => void;
}): ReactElement {
  const score = composite(report);
  const split = alignmentSplit(report);
  return (
    <div className="welcome">
      <header>
        <h1 className="welcome-hello">{greeting}</h1>
        <p className="welcome-whisper">{LOOP_WHISPER}</p>
      </header>

      <section className="welcome-card">
        <span className="moment-eyebrow">{copy.eyebrow}</span>
        <h2 className="welcome-card-title">{copy.title}</h2>
        <p className="welcome-card-sub">{copy.subtitle}</p>
        <div className="welcome-actions">
          <Button variant="accent" onClick={onReview}>
            <Icon name="review" size={16} />
            Review
          </Button>
          <Button variant="ghost" onClick={onDashboard}>
            <Icon name="dashboard" size={16} />
            Go to dashboard
          </Button>
        </div>
      </section>

      <div className="welcome-hero">
        <ScoreRing rings={report.rings} score={score} />
        <div className="welcome-substats">
          {report.rings.map((ring) => (
            <div key={ring.key} className="welcome-substat">
              <span className={`welcome-dot ${ring.key}`} />
              <span>{ring.label}</span>
              <b className="tnum">{ring.score}</b>
            </div>
          ))}
        </div>
        <div className="welcome-meta">
          {dayLabel(report.timestamp)} · {report.sessions} sessions ·{" "}
          {bandLabel(split.band)}
        </div>
      </div>
    </div>
  );
}

// ── Self-improvement loop (the dashboard's recursive-progress section) ─────────

interface LoopExperiment {
  experiment: Experiment;
  reportId: string;
  timestamp: number;
  alignmentDelta: number | null;
}

interface LoopImpact {
  accepted: number;
  queued: number;
  applied: number;
  prLinks: number;
  applyErrors: number;
  concluded: number;
  helped: number;
  noChange: number;
  worse: number;
  averageDelta: number | null;
  bestDelta: number | null;
  guidanceCoverage: number | null;
  guidanceCovered: number;
  guidanceTotal: number;
  latestVerdict: LoopExperiment | null;
}

function reviewedReports(reports: HealthReport[]): HealthReport[] {
  return reports.filter(
    (candidate) => candidate.reviewStatus === "reviewed" || candidate.reviewedAt
  );
}

function latestExperiments(reports: HealthReport[]): LoopExperiment[] {
  const byId = new Map<string, LoopExperiment>();
  for (const report of reviewedReports(reports)) {
    for (const experiment of report.experiments) {
      if (byId.has(experiment.id)) continue;
      byId.set(experiment.id, {
        experiment,
        reportId: report.id,
        timestamp: report.timestamp,
        alignmentDelta: parseAlignmentDelta(experiment.verdictNote),
      });
    }
  }
  return [...byId.values()];
}

function loopImpact(reports: HealthReport[], report: HealthReport): LoopImpact {
  const reviewed = reviewedReports(reports);
  const decisions: ActionQueueEntry[] = reviewed.flatMap(
    (candidate) => candidate.reviewDecisions ?? []
  );
  const accepted = decisions.filter((entry) => entry.state === "accepted");
  const queued = decisions.filter((entry) => entry.state === "queued");
  const experiments = latestExperiments(reports);
  const concluded = experiments.filter(
    ({ experiment }) => experiment.status === "concluded"
  );
  const deltas = concluded
    .map((item) => item.alignmentDelta)
    .filter((value): value is number => value != null);
  const guidanceTotal = report.projectInsights?.length ?? 0;
  const guidanceCovered =
    report.projectInsights?.filter(
      (project) => project.contextHealth?.status !== "overloaded"
    ).length ?? 0;

  return {
    accepted: accepted.length,
    queued: queued.length,
    applied: accepted.filter(
      (entry) =>
        entry.reviewBranch?.branch || entry.reviewBranch?.appliedDirectly
    ).length,
    prLinks: accepted.filter((entry) => entry.reviewBranch?.prUrl).length,
    applyErrors: accepted.filter((entry) => entry.reviewBranch?.error).length,
    concluded: concluded.length,
    helped: concluded.filter(
      ({ experiment }) => experiment.verdict === "helped"
    ).length,
    noChange: concluded.filter(
      ({ experiment }) => experiment.verdict === "no-change"
    ).length,
    worse: concluded.filter(({ experiment }) => experiment.verdict === "worse")
      .length,
    averageDelta:
      deltas.length === 0
        ? null
        : Math.round(
            deltas.reduce((sum, value) => sum + value, 0) / deltas.length
          ),
    bestDelta: deltas.length === 0 ? null : Math.max(...deltas),
    guidanceCoverage:
      guidanceTotal === 0
        ? null
        : Math.round((guidanceCovered / guidanceTotal) * 100),
    guidanceCovered,
    guidanceTotal,
    latestVerdict:
      concluded.sort((a, b) => b.timestamp - a.timestamp)[0] ?? null,
  };
}

function LoopStat({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  detail: string;
  tone?: "neutral" | "good" | "warn" | "danger";
}): ReactElement {
  return (
    <div className={`loop-stat ${tone}`}>
      <span className="loop-stat-label">{label}</span>
      <strong>{value}</strong>
      <span className="loop-stat-detail">{detail}</span>
    </div>
  );
}

function LoopOutcome({
  impact,
  onOpenReview,
}: {
  impact: LoopImpact;
  onOpenReview: () => void;
}): ReactElement {
  const latest = impact.latestVerdict;
  return (
    <Section
      title="Self-improvement loop"
      hint="Accepted changes, applied guidance, and measured outcomes from reviewed reviews."
      right={
        <Button variant="ghost" onClick={onOpenReview}>
          <Icon name="review" size={15} />
          Reviews
        </Button>
      }
    >
      <div className="loop-impact-grid">
        <LoopStat
          label="Accepted"
          value={impact.accepted}
          detail={`${impact.queued} still queued`}
          tone={impact.accepted > 0 ? "good" : "neutral"}
        />
        <LoopStat
          label="Applied"
          value={impact.applied}
          detail={
            impact.applyErrors > 0
              ? `${impact.applyErrors} need a look`
              : `${impact.prLinks} PR links`
          }
          tone={
            impact.applyErrors > 0
              ? "warn"
              : impact.applied > 0
                ? "good"
                : "neutral"
          }
        />
        <LoopStat
          label="Verdicts"
          value={`${impact.helped}/${impact.concluded}`}
          detail={`${impact.noChange} no-change · ${impact.worse} worse`}
          tone={impact.helped > 0 ? "good" : "neutral"}
        />
        <LoopStat
          label="Alignment Δ"
          value={
            impact.averageDelta == null ? "—" : signed(impact.averageDelta)
          }
          detail={
            impact.bestDelta == null
              ? "Not measured yet"
              : `Best ${signed(impact.bestDelta)}`
          }
          tone={
            impact.averageDelta == null
              ? "neutral"
              : impact.averageDelta > 0
                ? "good"
                : impact.averageDelta < 0
                  ? "danger"
                  : "warn"
          }
        />
        <LoopStat
          label="Context"
          value={
            impact.guidanceCoverage == null
              ? "—"
              : `${impact.guidanceCoverage}%`
          }
          detail={
            impact.guidanceTotal === 0
              ? "No projects yet"
              : `${impact.guidanceCovered}/${impact.guidanceTotal} clear`
          }
          tone={
            impact.guidanceCoverage == null
              ? "neutral"
              : impact.guidanceCoverage >= 80
                ? "good"
                : "warn"
          }
        />
      </div>
      {latest ? (
        <div
          className={`loop-verdict ${latest.experiment.verdict ?? "no-change"}`}
        >
          <Pill tone={verdictTone(latest.experiment.verdict)}>
            {latest.experiment.verdict ?? "measured"}
          </Pill>
          <div className="loop-verdict-main">
            <span className="dash-eyebrow">Did your last changes help?</span>
            <h3>{latest.experiment.title}</h3>
            <p>{latest.experiment.verdictNote}</p>
          </div>
        </div>
      ) : (
        <p className="muted">No measured verdict yet.</p>
      )}
    </Section>
  );
}

export default function Today({
  hd,
  report,
  pendingReview,
  onOpenGoals,
  onOpenReview,
  onRunHealthReview,
  onRunQuickReview,
}: {
  hd: HarnessHealth;
  report: HealthReport | null;
  pendingReview: HealthReport | null;
  onOpenGoals: () => void;
  onOpenReview: () => void;
  onRunHealthReview: () => void;
  onRunQuickReview: () => void;
}): ReactElement {
  const { state, reports, config } = hd;
  // The welcome interstitial shows once per pending review; "Go to dashboard"
  // dismisses it for that review, and a freshly-arrived review brings it back.
  const [dismissedReportId, setDismissedReportId] = useState<string | null>(
    null
  );
  const pendingId = pendingReview?.id ?? null;

  if (!state) return <p className="card-hint">Loading...</p>;

  const demoMode = config?.demoMode ?? false;
  const tod =
    demoMode && hd.demoTimeOfDay ? hd.demoTimeOfDay : timeOfDay(new Date());
  const name = config?.userName?.trim() || undefined;
  const greeting = `${GREETING[tod]}${name ? `, ${name}` : ""}`;
  const refreshLive = (): void => {
    void hd.telemetry.refresh();
  };

  if (!report) {
    return (
      <>
        <LiveHealthSummary
          snapshot={hd.telemetrySnapshot}
          greeting={greeting}
          subtitle="Run your first Health Review to turn local harness activity into measurable habits and recommendations."
          actions={
            <Button variant="accent" onClick={onRunHealthReview}>
              <Icon name="healthReview" size={16} />
              Run Health Review
            </Button>
          }
          onRefresh={refreshLive}
        />
        <HealthHabitsEducation snapshot={hd.telemetrySnapshot} />
      </>
    );
  }

  const chronological = [...reports].reverse();
  const recent = chronological.slice(-8);
  const seriesFor = (key: string): number[] =>
    chronological.map((r) =>
      parseNum(r.metrics.find((m) => m.key === key)?.value ?? "0")
    );

  const score = composite(report);
  const split = alignmentSplit(report);
  const latestReport = reports[0] ?? null;
  const previousReviewed = reports.find(
    (candidate) =>
      candidate.id !== report.id && candidate.reviewStatus === "reviewed"
  );
  const alignmentScore = ringScore(report, "alignment");
  const scoreDelta = previousReviewed
    ? score - composite(previousReviewed)
    : null;
  const alignmentDelta = previousReviewed
    ? alignmentScore - ringScore(previousReviewed, "alignment")
    : null;
  const impact = loopImpact(reports, report);

  const overviewMetrics = report.metrics.slice(0, 4);
  const runningImprovements = report.experiments.filter(
    (experiment) => experiment.status === "running"
  );
  const lastReview =
    state.lastReviewAt != null ? formatTime(state.lastReviewAt) : "—";
  const phase = state.phase;
  const scoreSeries = recent.map((review) => composite(review));
  const trendLabels = recent.map((review) => shortDate(review.timestamp));
  const barGroups = [
    {
      id: "Efficiency",
      tone: "efficiency",
      values: recent.map((review) => ringScore(review, "efficiency")),
    },
    {
      id: "Effectiveness",
      tone: "effectiveness",
      values: recent.map((review) => ringScore(review, "effectiveness")),
    },
  ];

  // The one welcoming nudge: contextual by time of day + state.
  const activity = demoMode
    ? demoActivityFor(tod)
    : pendingReview
      ? pendingReview.sessions
      : 0;
  const moment = decideMoment({
    tod,
    phase,
    pending: pendingReview,
    activity,
    scheduleMode: config?.schedule.mode ?? "daily",
  });
  const momentCtx: MomentContext = {
    tod,
    name,
    count:
      moment.kind === "review"
        ? (pendingReview?.findings.length ?? 0)
        : activity,
    projects: report.projects,
    score,
    scheduleTime: scheduleTimeLabel(config?.schedule.time),
    pendingIsQuickReview: pendingReview?.kind === "quick",
  };
  const copy = momentCopy(moment.kind, momentCtx);

  // A waiting review gets the calm welcome screen first: review now, or skip to
  // the dashboard. Once reviewed (no pending), the dashboard shows directly.
  if (moment.kind === "review" && pendingId !== dismissedReportId) {
    return (
      <WelcomeReview
        greeting={greeting}
        copy={copy}
        report={report}
        onReview={onOpenReview}
        onDashboard={() => setDismissedReportId(pendingId)}
      />
    );
  }

  function act(): void {
    if (moment.ctaKind === "review") {
      onOpenReview();
      return;
    }
    if (moment.ctaKind === "quick") {
      onRunQuickReview();
      return;
    }
    onRunHealthReview();
  }

  return (
    <>
      <LiveHealthSummary
        snapshot={hd.telemetrySnapshot}
        greeting={greeting}
        subtitle={LOOP_WHISPER}
        actions={
          <>
            {demoMode ? (
              <DemoTimeSwitcher
                value={hd.demoTimeOfDay}
                onChange={hd.setDemoTimeOfDay}
              />
            ) : (
              <Pill
                tone={
                  split.band === "collaborating"
                    ? "good"
                    : split.band === "fighting"
                      ? "danger"
                      : "accent"
                }
              >
                {bandLabel(split.band)}
              </Pill>
            )}
            {latestReport ? (
              <Button variant="ghost" onClick={onOpenReview}>
                <Icon name="review" size={16} />
                Open latest review
              </Button>
            ) : null}
          </>
        }
        onRefresh={refreshLive}
      />

      <DailyMoment
        moment={moment}
        eyebrow={copy.eyebrow}
        title={copy.title}
        subtitle={
          moment.kind === "running" && state.stage ? state.stage : copy.subtitle
        }
        cta={copy.cta}
        progress={state.progress}
        onAct={act}
      />

      <HealthHabitsEducation snapshot={hd.telemetrySnapshot} />

      <div className="dash">
        <div className="dash-main">
          <div className="grid grid-3">
            <SummaryCard
              size="hero"
              eyebrow="Current score"
              value={score}
              trend={
                scoreDelta == null
                  ? undefined
                  : { delta: scoreDelta, tone: trendTone(scoreDelta) }
              }
              sublabel="Latest reviewed Health Review"
              tip={TERM.composite}
            />
            <SummaryCard
              eyebrow="Alignment"
              value={alignmentScore}
              trend={
                alignmentDelta == null
                  ? undefined
                  : { delta: alignmentDelta, tone: trendTone(alignmentDelta) }
              }
              sublabel={bandLabel(split.band)}
              tip={`${RING_TIP.alignment.text} ${TERM.alignmentBand}`}
            />
            <SummaryCard
              eyebrow="Goals"
              value={runningImprovements.length}
              sublabel="Currently being measured"
              tip={TERM.goals}
              action={
                <Button variant="ghost" onClick={onOpenGoals}>
                  <Icon name="improvements" size={15} />
                  Open Goals
                </Button>
              }
            />
          </div>

          <LoopOutcome impact={impact} onOpenReview={onOpenReview} />

          <Section
            title="Accumulated progress"
            hint="Review history is summarized here; open Reviews for the source reports."
          >
            <AreaChart
              values={scoreSeries}
              labels={trendLabels}
              tone="alignment"
            />
            <div className="history-bars">
              <span className="dash-eyebrow">Efficiency vs. effectiveness</span>
              <GroupedBars groups={barGroups} labels={trendLabels} />
            </div>
          </Section>

          <Section
            title="Active goals"
            hint="Goal and guidance changes that are still being measured by future reviews."
            right={
              <Button variant="ghost" onClick={onOpenGoals}>
                <Icon name="improvements" size={15} />
                Goals
              </Button>
            }
          >
            {runningImprovements.length === 0 ? (
              <p className="muted">
                No active goals yet. Review a Health Review to accept or queue
                the next goal update.
              </p>
            ) : (
              <div className="dashboard-improvements">
                {runningImprovements.map((improvement) => (
                  <article
                    key={improvement.id}
                    className="dashboard-improvement"
                  >
                    <div>
                      <h3>{improvement.title}</h3>
                      <p>{improvement.hypothesis}</p>
                    </div>
                    <span className="tnum">
                      {improvement.progressLabel ??
                        `${Math.round((improvement.progress ?? 0) * 100)}%`}
                    </span>
                  </article>
                ))}
              </div>
            )}
          </Section>

          <div className="overview-grid">
            {overviewMetrics.map((metric) => (
              <MetricCell
                key={metric.key}
                metric={metric}
                series={seriesFor(metric.key)}
              />
            ))}
          </div>
        </div>

        <aside className="dash-rail">
          <div className="dash-score">
            <div className="dash-score-head">
              <div>
                <div className="dash-score-date">
                  {dayLabel(report.timestamp)}
                </div>
                <div className="dash-score-meta">
                  {report.sessions} sessions · {report.projects} projects
                </div>
                {report.window ? (
                  <div className="dash-score-window">{report.window.label}</div>
                ) : null}
              </div>
              <Button variant="ghost" onClick={onOpenReview}>
                <Icon name="review" size={15} />
                Review
              </Button>
            </div>

            <div className="dash-ring">
              <ScoreRing rings={report.rings} score={score} />
            </div>

            <Contributors rings={report.rings} />

            <div className="dashboard-rings">
              {report.rings.map((ring) => (
                <RingChip key={ring.key} ring={ring} />
              ))}
            </div>

            <p className="dash-digest">
              {report.harness} · last review {lastReview}. Findings, evidence,
              and decisions stay inside the local report.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
