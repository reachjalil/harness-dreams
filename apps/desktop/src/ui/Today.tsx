import { type ReactElement, useState } from "react";

import { demoActivityFor, timeOfDay } from "../shared/timeOfDay";
import type {
  ActionQueueEntry,
  DreamReport,
  Experiment,
  ExperimentVerdict,
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
  PageHeader,
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
import type { HarnessDreams } from "./useHarnessDreams";

function composite(report: DreamReport): number {
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

function ringScore(report: DreamReport, key: string): number {
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
  review: "cycle",
  nap: "play",
  sleep: "dream",
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
  onChange: HarnessDreams["setDemoTimeOfDay"];
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
            <Icon name={CTA_ICON[moment.ctaKind ?? "sleep"]} size={16} />
            {cta}
          </Button>
        </div>
      ) : null}
    </section>
  );
}

/**
 * Calm review interstitial — shown when a fresh cycle is waiting. Welcomes the
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
  report: DreamReport;
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
            <Icon name="cycle" size={16} />
            Review cycle
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

function reviewedReports(reports: DreamReport[]): DreamReport[] {
  return reports.filter(
    (candidate) => candidate.reviewStatus === "reviewed" || candidate.reviewedAt
  );
}

function latestExperiments(reports: DreamReport[]): LoopExperiment[] {
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

function loopImpact(reports: DreamReport[], report: DreamReport): LoopImpact {
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
  onOpenCycle,
}: {
  impact: LoopImpact;
  onOpenCycle: () => void;
}): ReactElement {
  const latest = impact.latestVerdict;
  return (
    <Section
      title="Self-improvement loop"
      hint="Accepted changes, applied guidance, and measured outcomes from reviewed cycles."
      right={
        <Button variant="ghost" onClick={onOpenCycle}>
          <Icon name="cycle" size={15} />
          Sleep Cycles
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

function EmptyDashboard({
  greeting,
  onRunSleepCycle,
}: {
  greeting: string;
  onRunSleepCycle: () => void;
}): ReactElement {
  return (
    <>
      <PageHeader
        eyebrow="Live health"
        title={greeting}
        subtitle="Run your first Sleep Cycle to fold today's work into a health report — then wake up to it tomorrow."
        primary={
          <Button variant="accent" onClick={onRunSleepCycle}>
            <Icon name="dream" size={16} />
            Run Sleep Cycle
          </Button>
        }
      />
      <p className="empty">
        No sessions captured yet. Start a Sleep Cycle from the sidebar or the
        Sleep Cycles page to fold the day's work into a health report.
      </p>
    </>
  );
}

export default function Today({
  hd,
  report,
  pendingCycle,
  onOpenGoals,
  onOpenCycle,
  onRunSleepCycle,
  onRunNap,
}: {
  hd: HarnessDreams;
  report: DreamReport | null;
  pendingCycle: DreamReport | null;
  onOpenGoals: () => void;
  onOpenCycle: () => void;
  onRunSleepCycle: () => void;
  onRunNap: () => void;
}): ReactElement {
  const { state, reports, config } = hd;
  // The welcome interstitial shows once per pending cycle; "Go to dashboard"
  // dismisses it for that cycle, and a freshly-arrived cycle brings it back.
  const [dismissedCycleId, setDismissedCycleId] = useState<string | null>(null);
  const pendingId = pendingCycle?.id ?? null;

  if (!state) return <p className="card-hint">Loading...</p>;

  const demoMode = config?.demoMode ?? false;
  const tod =
    demoMode && hd.demoTimeOfDay ? hd.demoTimeOfDay : timeOfDay(new Date());
  const name = config?.userName?.trim() || undefined;
  const greeting = `${GREETING[tod]}${name ? `, ${name}` : ""}`;

  if (!report) {
    return (
      <EmptyDashboard greeting={greeting} onRunSleepCycle={onRunSleepCycle} />
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
  const latestCycle = reports[0] ?? null;
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
  const lastDream =
    state.lastDreamAt != null ? formatTime(state.lastDreamAt) : "—";
  const phase = state.phase;
  const scoreSeries = recent.map((cycle) => composite(cycle));
  const trendLabels = recent.map((cycle) => shortDate(cycle.timestamp));
  const barGroups = [
    {
      id: "Efficiency",
      tone: "efficiency",
      values: recent.map((cycle) => ringScore(cycle, "efficiency")),
    },
    {
      id: "Effectiveness",
      tone: "effectiveness",
      values: recent.map((cycle) => ringScore(cycle, "effectiveness")),
    },
  ];

  // The one welcoming nudge: contextual by time of day + state.
  const activity = demoMode
    ? demoActivityFor(tod)
    : pendingCycle
      ? pendingCycle.sessions
      : 0;
  const moment = decideMoment({
    tod,
    phase,
    pending: pendingCycle,
    activity,
    scheduleMode: config?.schedule.mode ?? "nightly",
  });
  const momentCtx: MomentContext = {
    tod,
    name,
    count:
      moment.kind === "review"
        ? (pendingCycle?.findings.length ?? 0)
        : activity,
    projects: report.projects,
    score,
    scheduleTime: scheduleTimeLabel(config?.schedule.time),
    pendingIsNap: pendingCycle?.kind === "nap",
  };
  const copy = momentCopy(moment.kind, momentCtx);

  // A waiting cycle gets the calm welcome screen first: review now, or skip to
  // the dashboard. Once reviewed (no pending), the dashboard shows directly.
  if (moment.kind === "review" && pendingId !== dismissedCycleId) {
    return (
      <WelcomeReview
        greeting={greeting}
        copy={copy}
        report={report}
        onReview={onOpenCycle}
        onDashboard={() => setDismissedCycleId(pendingId)}
      />
    );
  }

  function act(): void {
    if (moment.ctaKind === "review") {
      onOpenCycle();
      return;
    }
    if (moment.ctaKind === "nap") {
      onRunNap();
      return;
    }
    onRunSleepCycle();
  }

  return (
    <>
      <PageHeader
        eyebrow="Live health"
        title={greeting}
        subtitle={LOOP_WHISPER}
        secondary={
          demoMode ? (
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
          )
        }
        primary={
          latestCycle ? (
            <Button variant="ghost" onClick={onOpenCycle}>
              <Icon name="cycle" size={16} />
              Open latest Sleep Cycle
            </Button>
          ) : undefined
        }
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
              sublabel="Latest reviewed Sleep Cycle"
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

          <LoopOutcome impact={impact} onOpenCycle={onOpenCycle} />

          <Section
            title="Accumulated progress"
            hint="Sleep Cycle history is summarized here; open Sleep Cycles for the source reports."
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
            hint="Goal and guidance changes that are still being measured by future Sleep Cycles."
            right={
              <Button variant="ghost" onClick={onOpenGoals}>
                <Icon name="improvements" size={15} />
                Goals
              </Button>
            }
          >
            {runningImprovements.length === 0 ? (
              <p className="muted">
                No active goals yet. Review a Sleep Cycle to accept or queue the
                next goal update.
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
              <Button variant="ghost" onClick={onOpenCycle}>
                <Icon name="cycle" size={15} />
                Sleep Cycle
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
              {report.harness} · last Sleep Cycle {lastDream}. Findings,
              evidence, and decisions stay inside the Sleep Cycle report.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
