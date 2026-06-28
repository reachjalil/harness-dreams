import type { ReactElement } from "react";

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
  PageHeader,
  Pill,
  RingChip,
  ScoreRing,
  Section,
  SummaryCard,
} from "./components";
import { RING_TIP, TERM } from "./explainers";
import { Icon } from "./icons";
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

function plural(count: number, label: string): string {
  return `${count} ${label}${count === 1 ? "" : "s"}`;
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

interface LoopExperiment {
  experiment: Experiment;
  reportId: string;
  timestamp: number;
  alignmentDelta: number | null;
}

interface LoopImpact {
  accepted: number;
  queued: number;
  branches: number;
  prLinks: number;
  branchErrors: number;
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
    branches: accepted.filter((entry) => entry.reviewBranch?.branch).length,
    prLinks: accepted.filter((entry) => entry.reviewBranch?.prUrl).length,
    branchErrors: accepted.filter((entry) => entry.reviewBranch?.error).length,
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
      hint="Accepted changes, review branches, and measured outcomes from reviewed cycles."
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
          detail={`${plural(impact.queued, "queued")} still waiting`}
          tone={impact.accepted > 0 ? "good" : "neutral"}
        />
        <LoopStat
          label="Review branches"
          value={impact.branches}
          detail={
            impact.branchErrors > 0
              ? `${plural(impact.branchErrors, "branch")} needs attention`
              : `${plural(impact.prLinks, "PR link")} ready`
          }
          tone={
            impact.branchErrors > 0
              ? "warn"
              : impact.branches > 0
                ? "good"
                : "neutral"
          }
        />
        <LoopStat
          label="Verdicts"
          value={`${impact.helped}/${impact.concluded}`}
          detail={`${plural(impact.noChange, "no-change")} · ${plural(
            impact.worse,
            "worse"
          )}`}
          tone={impact.helped > 0 ? "good" : "neutral"}
        />
        <LoopStat
          label="Alignment delta"
          value={
            impact.averageDelta == null ? "—" : signed(impact.averageDelta)
          }
          detail={
            impact.bestDelta == null
              ? "No concluded measurement"
              : `Best measured ${signed(impact.bestDelta)}`
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
          label="Context health"
          value={
            impact.guidanceCoverage == null
              ? "—"
              : `${impact.guidanceCoverage}%`
          }
          detail={
            impact.guidanceTotal === 0
              ? "No projects in latest report"
              : `${impact.guidanceCovered}/${impact.guidanceTotal} projects clear`
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
  onRunSleepCycle,
}: {
  onRunSleepCycle: () => void;
}): ReactElement {
  return (
    <>
      <PageHeader
        eyebrow="Home"
        title="No Sleep Cycle yet"
        subtitle="Run an overnight Sleep Cycle to build your first alignment report."
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
}: {
  hd: HarnessDreams;
  report: DreamReport | null;
  pendingCycle: DreamReport | null;
  onOpenGoals: () => void;
  onOpenCycle: () => void;
  onRunSleepCycle: () => void;
}): ReactElement {
  const { state, reports } = hd;

  if (!state) return <p className="card-hint">Loading...</p>;

  if (!report) return <EmptyDashboard onRunSleepCycle={onRunSleepCycle} />;

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

  return (
    <>
      <PageHeader
        eyebrow="Live health"
        title="Home"
        subtitle={`Current state from latest reviewed Sleep Cycle · ${report.harness} · last Sleep Cycle ${lastDream}`}
        secondary={
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
        }
        primary={
          <>
            {latestCycle ? (
              <Button variant="ghost" onClick={onOpenCycle}>
                <Icon name="cycle" size={16} />
                Open latest Sleep Cycle
              </Button>
            ) : null}
            <Button
              variant="accent"
              onClick={() => (pendingCycle ? onOpenCycle() : onRunSleepCycle())}
              disabled={phase === "dreaming" && !pendingCycle}
            >
              <Icon name={pendingCycle ? "cycle" : "dream"} size={16} />
              {phase === "dreaming"
                ? "Running…"
                : pendingCycle
                  ? "Review Sleep Cycle"
                  : "Run Sleep Cycle"}
            </Button>
          </>
        }
      />

      {hd.config?.demoMode ? (
        <div className="demo-banner">
          <Icon name="cycle" size={16} />
          <span>
            Demo Mode is using fictional projects and persisted sample cycles.
            Running a Sleep Cycle simulates the next measurement pass.
          </span>
        </div>
      ) : null}

      {pendingCycle ? (
        <button type="button" className="dash-pending" onClick={onOpenCycle}>
          <span className="dash-pending-dot" />
          <span className="dash-pending-main">
            <b>A fresh Sleep Cycle is ready to review</b>
            <small>
              {pendingCycle.window?.label ?? pendingCycle.rangeLabel} ·{" "}
              {pendingCycle.findings.length} recommendation
              {pendingCycle.findings.length === 1 ? "" : "s"} waiting
            </small>
          </span>
          <Icon name="chevron" size={16} />
        </button>
      ) : null}

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
              Home reflects reviewed progress only. Findings, evidence, and
              action decisions stay inside the Sleep Cycle report.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
