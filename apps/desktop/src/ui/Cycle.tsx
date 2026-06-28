import { type ReactElement, useEffect, useMemo, useState } from "react";

import { DREAM_STAGES } from "../shared/stages";
import type {
  ActionCategory,
  ActionQueueEntry,
  ActionState,
  CycleReviewStatus,
  DreamReport,
  Finding,
  Metric,
  RuntimeState,
} from "../shared/types";
import {
  ActionQueueItem,
  AlignmentSides,
  alignmentSplit,
  Button,
  bandLabel,
  type Crumb,
  CycleProgress,
  categorize,
  FindingCard,
  FrictionChip,
  PageHeader,
  Pill,
  Section,
  StepRail,
  SummaryCard,
} from "./components";
import {
  CycleWindowBanner,
  MeasuredGoals,
  PatchPreview,
  ProjectBreakdown,
  RecommendationMap,
} from "./cycleDetail";
import { RING_TIP, TERM } from "./explainers";
import { Icon, type IconName } from "./icons";
import { InfoTip } from "./Tooltip";
import type { HarnessDreams } from "./useHarnessDreams";

// Local review state: one decision per finding. "open" means undecided.
type Decisions = Record<string, ActionState>;
type ReviewStep = "overview" | "findings" | "queue";

const QUEUE_ID = "__queue";

const CATEGORY_ICON: Record<ActionCategory, IconName> = {
  agentsmd: "agentsmd",
  claudemd: "claudemd",
  contextdoc: "contextdoc",
  prompthabit: "prompthabit",
  skill: "skill",
};

const CATEGORY_LABEL: Record<ActionCategory, string> = {
  agentsmd: "Harness memory",
  claudemd: "Claude memory",
  contextdoc: "Project context",
  prompthabit: "Prompt habit",
  skill: "Skill routing",
};

function decisionsFromReport(report: DreamReport | null): Decisions {
  return Object.fromEntries(
    (report?.reviewDecisions ?? []).map((entry) => [
      entry.findingId,
      entry.state,
    ])
  );
}

/** Breadcrumb trail for the review wizard — depth grows as you go deeper, and
 *  "Cycle" is clickable to jump back to the overview. */
function cycleCrumbs(
  report: DreamReport,
  step: "overview" | "findings" | "queue",
  toList: () => void,
  toOverview: () => void,
  queueCount: number
): Crumb[] {
  if (step === "overview") {
    return [
      { label: "Sleep Cycles", onClick: toList },
      { label: report.rangeLabel },
    ];
  }
  const label =
    step === "queue"
      ? `Goal decisions${queueCount > 0 ? ` · ${queueCount}` : ""}`
      : "Review suggested goals";
  return [
    { label: "Sleep Cycles", onClick: toList },
    { label: report.rangeLabel, onClick: toOverview },
    { label },
  ];
}

function composite(report: DreamReport): number {
  const sum = report.rings.reduce((acc, ring) => acc + ring.score, 0);
  return Math.round(sum / Math.max(1, report.rings.length));
}

function trendTone(delta: number): "positive" | "negative" | "neutral" {
  if (delta > 0) return "positive";
  if (delta < 0) return "negative";
  return "neutral";
}

function ringScore(report: DreamReport, key: string): number {
  return report.rings.find((r) => r.key === key)?.score ?? 0;
}

function longDate(ts: number): string {
  return new Date(ts).toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function listCycleStatus(
  report: DreamReport,
  isLatest: boolean
): CycleReviewStatus {
  if (report.reviewStatus === "reviewed" || report.reviewedAt) {
    return "reviewed";
  }
  if (isLatest && report.reviewStatus !== "expired") return "unreviewed";
  return "expired";
}

function statusTone(status: CycleReviewStatus): "neutral" | "good" | "warn" {
  if (status === "reviewed") return "good";
  if (status === "expired") return "neutral";
  return "warn";
}

function statusLabel(status: CycleReviewStatus): string {
  if (status === "unreviewed") return "Needs review";
  if (status === "expired") return "Expired";
  return "Reviewed";
}

function statusHelp(status: CycleReviewStatus): string {
  if (status === "unreviewed") return "Latest Sleep Cycle needs review";
  if (status === "expired") return "Expired by a newer Sleep Cycle";
  return "Reviewed by you";
}

function shortFinding(finding: Finding): string {
  return finding.title.length > 30
    ? `${finding.title.slice(0, 29)}…`
    : finding.title;
}

function fileName(file: string | undefined): string {
  if (!file) return "Transcript";
  const parts = file.split("/");
  return parts.at(-1) ?? file;
}

function decisionStats(
  report: DreamReport,
  decisions: Decisions
): {
  accepted: number;
  rejected: number;
  open: number;
  decided: number;
} {
  let accepted = 0;
  let rejected = 0;
  for (const finding of report.findings) {
    if (decisions[finding.id] === "accepted") accepted += 1;
    if (decisions[finding.id] === "rejected") rejected += 1;
  }
  const decided = accepted + rejected;
  return {
    accepted,
    rejected,
    decided,
    open: Math.max(0, report.findings.length - decided),
  };
}

function reviewMetrics(report: DreamReport): Metric[] {
  const preferred = ["reask", "tool_success", "context_load"];
  const picked = preferred
    .map((key) => report.metrics.find((metric) => metric.key === key))
    .filter((metric): metric is Metric => Boolean(metric));
  return picked.length > 0 ? picked : report.metrics.slice(0, 3);
}

function sourceLabel(source: string): string {
  if (source === "codex") return "Codex";
  if (source === "claude-code") return "Claude Code";
  if (source === "code") return "VS Code";
  return source;
}

function runnerLabel(runner: string | undefined): string {
  const provider = runner?.split(":")[0];
  if (provider === "codex") return "Codex CLI";
  if (provider === "claude-code") return "Claude Code CLI";
  return "CLI";
}

function provenanceSummary(report: DreamReport): {
  value: string;
  sublabel: string;
} {
  const provenance = report.provenance;
  if (!provenance) {
    return { value: "Unknown", sublabel: "No run provenance recorded" };
  }
  if (provenance.mode === "demo") {
    return { value: "Demo", sublabel: "Fixture data" };
  }
  const cli = provenance.cli;
  const sources = provenance.sources.map(sourceLabel);
  const harnesses = sources.length > 0 ? sources.join(" + ") : "No harness";
  const runner = runnerLabel(cli.runner);
  const cliLabel =
    cli.status === "executed"
      ? `Analyzed with ${runner}${cli.model ? ` · ${cli.model}` : ""}`
      : cli.status === "failed"
        ? `${runner} failed`
        : cli.status === "skipped"
          ? `${runner} skipped`
          : "Local scoring only";
  return {
    value: provenance.usedSampleData ? "Sample data" : harnesses,
    sublabel: cliLabel,
  };
}

function formatSchedule(time: string | undefined): string {
  if (!time) return "tonight";
  const [hourRaw, minute = "00"] = time.split(":");
  const hour = Number.parseInt(hourRaw ?? "0", 10);
  if (!Number.isFinite(hour)) return "tonight";
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${minute} ${period}`;
}

function CycleRow({
  report,
  selected,
  delta,
  status,
  onSelect,
}: {
  report: DreamReport;
  selected: boolean;
  delta: number | null;
  status: CycleReviewStatus;
  onSelect: (id: string) => void;
}): ReactElement {
  const split = alignmentSplit(report);
  return (
    <button
      type="button"
      className={`cycle-list-row ${status}${selected ? " selected" : ""}`}
      onClick={() => onSelect(report.id)}
    >
      <span className="cycle-list-date">
        <span className="cycle-list-main">{longDate(report.timestamp)}</span>
        <span className="cycle-list-sub">
          {report.sessions} sessions · {report.projects} projects
        </span>
      </span>
      <span className="cycle-list-score tnum">{composite(report)}</span>
      <span className="cycle-list-rings">
        {report.rings.map((ring) => (
          <span key={ring.key} className={`cycle-list-ring ${ring.key}`}>
            <span>{ring.label}</span>
            <b className="tnum">{ring.score}</b>
          </span>
        ))}
      </span>
      <span className={`align-band ${split.band}`}>
        {bandLabel(split.band)}
        {typeof delta === "number" ? ` ${delta >= 0 ? "+" : ""}${delta}` : ""}
      </span>
      <span className="cycle-list-status" title={statusHelp(status)}>
        <Pill tone={statusTone(status)}>{statusLabel(status)}</Pill>
      </span>
      <span className="cycle-list-action" aria-hidden="true">
        <Icon name="chevron" size={15} />
      </span>
    </button>
  );
}

function CycleIndex({
  hd,
  reports,
  selectedId,
  scheduleLabel,
  onSelectCycle,
  onRunSleepCycle,
}: {
  hd: HarnessDreams;
  reports: DreamReport[];
  selectedId: string | null;
  scheduleLabel: string;
  onSelectCycle: (id: string) => void;
  onRunSleepCycle: () => void;
}): ReactElement {
  const { state } = hd;
  const latestStatus = reports[0] ? listCycleStatus(reports[0], true) : null;
  const unreviewedCycle =
    latestStatus === "unreviewed" ? reports[0] : undefined;
  const visibleCount = Math.min(reports.length, 25);

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Sleep Cycles" }]}
        subtitle="A chronological list of Sleep Cycle reports. Open a row to review the actual Sleep Cycle summary, findings, and queue."
        primary={
          <Button
            variant="accent"
            onClick={() =>
              unreviewedCycle
                ? onSelectCycle(unreviewedCycle.id)
                : onRunSleepCycle()
            }
            disabled={state?.phase === "dreaming"}
          >
            <Icon name={unreviewedCycle ? "cycle" : "dream"} size={16} />
            {state?.phase === "dreaming"
              ? "Running…"
              : unreviewedCycle
                ? "Review Sleep Cycle"
                : "Run Sleep Cycle"}
          </Button>
        }
      />

      {reports.length === 0 ? (
        <CycleResting
          scheduleLabel={scheduleLabel}
          onDreamNow={onRunSleepCycle}
        />
      ) : (
        <div className="cycle-index">
          <div className="cycle-list-toolbar">
            <span>
              {reports.length} Sleep Cycle{reports.length === 1 ? "" : "s"}
              <InfoTip title="Sleep Cycle" text={TERM.sleepCycle} />
            </span>
            <span>Newest first</span>
          </div>
          <div className="cycle-list" role="list" aria-label="Sleep Cycles">
            {reports.map((report, i) => {
              const prior = reports[i + 1] ?? null;
              const delta = prior
                ? ringScore(report, "alignment") - ringScore(prior, "alignment")
                : null;
              return (
                <CycleRow
                  key={report.id}
                  report={report}
                  selected={report.id === selectedId}
                  delta={delta}
                  status={listCycleStatus(report, i === 0)}
                  onSelect={onSelectCycle}
                />
              );
            })}
          </div>
          <div className="cycle-list-footer">
            <span>
              Showing 1-{visibleCount} of {reports.length}
            </span>
            <span className="cycle-page-controls">
              <button type="button" aria-label="Previous page" disabled>
                <Icon name="chevron" size={14} />
              </button>
              <button type="button" aria-label="Next page" disabled>
                <Icon name="chevron" size={14} />
              </button>
            </span>
          </div>
        </div>
      )}
    </>
  );
}

// ── Running / resting states ─────────────────────────────────────────────────

const RUN_PASSES = [
  {
    start: 0,
    done: 0.14,
    label: "Observe",
    title: "Collect traces",
    text: "Session notes, Claude/Codex home context, project guidance, accepted goals, and tool outcomes are loaded into the run.",
  },
  {
    start: 0.14,
    done: 0.34,
    label: "Replay",
    title: "Rebuild decisions",
    text: "The engine replays where the harness followed intent, drifted, or needed repeated correction.",
  },
  {
    start: 0.34,
    done: 0.56,
    label: "Compare",
    title: "Measure against goals",
    text: "Current goals are compared with actual behavior so progress stays separate from raw cycle output.",
  },
  {
    start: 0.56,
    done: 0.78,
    label: "Learn",
    title: "Find recursive patterns",
    text: "Repeated friction is compressed into suggested goals that can be accepted or rejected during review.",
  },
  {
    start: 0.78,
    done: 1,
    label: "Assemble",
    title: "Prepare review",
    text: "The Sleep Cycle summary, findings, and goal decisions are packaged for the latest-cycle review.",
  },
] as const;

const RUN_LOGS = [
  { at: 0.02, label: "Opened recent session trace window" },
  { at: 0.1, label: "Scanned Claude/Codex home and project context" },
  { at: 0.14, label: "Replayed decision points across active projects" },
  { at: 0.28, label: "Grouped repeated corrections and re-asks" },
  { at: 0.42, label: "Compared accepted goals with observed behavior" },
  { at: 0.56, label: "Scored alignment, efficiency, and effectiveness rings" },
  { at: 0.7, label: "Separated dashboard progress from cycle evidence" },
  { at: 0.82, label: "Drafted suggested goals for review only" },
  { at: 0.92, label: "Marked older unreviewed cycles as expired" },
  { at: 0.98, label: "Preparing latest Sleep Cycle for review" },
] as const;

function runPassState(
  progress: number,
  pass: (typeof RUN_PASSES)[number]
): "pending" | "active" | "done" {
  if (progress >= pass.done) return "done";
  if (progress >= pass.start) return "active";
  return "pending";
}

function CycleRunning({
  state,
  actions,
}: {
  state: RuntimeState;
  actions: HarnessDreams["actions"];
}): ReactElement {
  const visibleLogs = RUN_LOGS.filter((log) => state.progress >= log.at);
  const pct = Math.round(state.progress * 100);

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Sleep Cycles" }, { label: "Running" }]}
        title="Running Sleep Cycle"
        subtitle="The dream engine is replaying work, measuring current goals, and preparing the latest Sleep Cycle review."
        secondary={<Pill tone="accent">{pct}%</Pill>}
        primary={
          <Button
            variant={state.paused ? "accent" : "ghost"}
            onClick={() =>
              state.paused
                ? void actions.resumeDream()
                : void actions.pauseDream()
            }
          >
            <Icon name={state.paused ? "play" : "pause"} size={16} />
            {state.paused ? "Resume Sleep Cycle" : "Pause Sleep Cycle"}
          </Button>
        }
      />

      <Section
        title="Recursive learning run"
        hint="This is execution, not review. Suggested goals appear only after the Sleep Cycle finishes."
      >
        <CycleProgress
          progress={state.progress}
          stage={state.stage}
          stages={DREAM_STAGES}
          paused={state.paused}
        />
      </Section>

      <div
        className="run-pass-grid"
        role="list"
        aria-label="Sleep Cycle run passes"
      >
        {RUN_PASSES.map((pass) => {
          const status = runPassState(state.progress, pass);
          return (
            <div
              key={pass.label}
              className={`run-pass ${status}`}
              role="listitem"
            >
              <span className="run-pass-label">{pass.label}</span>
              <h2>{pass.title}</h2>
              <p>{pass.text}</p>
            </div>
          );
        })}
      </div>

      <Section
        title="Live trace"
        hint="A compact trace of what the run has already processed."
      >
        <div className="run-log" aria-live="polite">
          {visibleLogs.length === 0 ? (
            <div className="run-log-row active">
              <span className="run-log-dot" />
              <span>Starting Sleep Cycle run...</span>
              <b>now</b>
            </div>
          ) : (
            visibleLogs.map((log, index) => {
              const active = index === visibleLogs.length - 1;
              return (
                <div
                  key={log.label}
                  className={`run-log-row${active ? " active" : ""}`}
                >
                  <span className="run-log-dot" />
                  <span>{log.label}</span>
                  <b>{Math.round(log.at * 100)}%</b>
                </div>
              );
            })
          )}
        </div>
      </Section>
    </>
  );
}

function CycleResting({
  scheduleLabel,
  onDreamNow,
}: {
  scheduleLabel: string;
  onDreamNow: () => void;
}): ReactElement {
  return (
    <Section
      title="No Sleep Cycle to review yet"
      hint="A Sleep Cycle replays a quiet work period, scores the day, and turns friction into actions you can accept."
    >
      <div className="empty">
        <p className="muted">
          Next Sleep Cycle is scheduled for {scheduleLabel}.
        </p>
        <div className="row">
          <Button variant="accent" onClick={onDreamNow}>
            <Icon name="play" size={16} />
            Start a Sleep Cycle now
          </Button>
        </div>
      </div>
    </Section>
  );
}

// ── Review wizard scaffolding ────────────────────────────────────────────────

function ReviewCompass({
  report,
  decisions,
  step,
  onOverview,
  onFindings,
  onQueue,
}: {
  report: DreamReport;
  decisions: Decisions;
  step: ReviewStep;
  onOverview: () => void;
  onFindings: () => void;
  onQueue: () => void;
}): ReactElement {
  const stats = decisionStats(report, decisions);
  const stageIndex = step === "overview" ? 0 : step === "findings" ? 1 : 2;
  const stages = [
    {
      key: "overview",
      label: "Readout",
      value: composite(report),
      caption: `${report.sessions} sessions`,
      icon: "cycle" as const,
      onClick: onOverview,
    },
    {
      key: "findings",
      label: "Decide",
      value: `${stats.decided}/${report.findings.length}`,
      caption: `${stats.open} open`,
      icon: "improvements" as const,
      onClick: onFindings,
    },
    {
      key: "queue",
      label: "Branch",
      value: stats.accepted,
      caption: "accepted",
      icon: "opensource" as const,
      onClick: onQueue,
    },
  ];

  return (
    <div
      className="review-compass"
      role="group"
      aria-label="Sleep Cycle review progress"
    >
      <div className="review-compass-line">
        <span
          style={{ width: `${((stageIndex + 1) / stages.length) * 100}%` }}
        />
      </div>
      {stages.map((stage, index) => {
        const state =
          index < stageIndex
            ? "done"
            : index === stageIndex
              ? "active"
              : "pending";
        return (
          <button
            key={stage.key}
            type="button"
            className={`review-compass-card ${state}`}
            onClick={stage.onClick}
          >
            <span className="review-compass-icon">
              <Icon name={stage.icon} size={16} />
            </span>
            <span className="review-compass-main">
              <span className="review-compass-label">{stage.label}</span>
              <b className="tnum">{stage.value}</b>
              <small>{stage.caption}</small>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function ReviewOutcomePanel({
  finding,
  category,
  state,
}: {
  finding: Finding;
  category: ActionCategory;
  state: ActionState;
}): ReactElement {
  const accepted = state === "accepted";
  const rejected = state === "rejected";
  const tone = accepted ? "accepted" : rejected ? "rejected" : "open";
  const status = accepted
    ? "Queued to apply"
    : rejected
      ? "Retired from this cycle"
      : "Ready for decision";
  const target = finding.patch?.label ?? CATEGORY_LABEL[category];
  return (
    <div className={`review-outcome ${tone}`}>
      <div className="review-outcome-head">
        <span className="review-outcome-icon">
          <Icon
            name={accepted ? "opensource" : rejected ? "reset" : "improvements"}
            size={16}
          />
        </span>
        <div>
          <div className="review-outcome-status">{status}</div>
          <p>
            {accepted
              ? "Mark reviewed applies this change using your Settings preference: GitHub PR branch or direct file edit."
              : rejected
                ? "This suggestion stays in the report, but no file change or tracked goal is created."
                : "Accepting prepares this recommendation to be applied after review."}
          </p>
        </div>
      </div>
      <div className="review-outcome-grid">
        <span>
          <b>Target</b>
          <small>{target}</small>
        </span>
        <span>
          <b>Project</b>
          <small>{finding.project}</small>
        </span>
        <span>
          <b>Evidence</b>
          <small>{fileName(finding.evidenceFile)}</small>
        </span>
      </div>
      {finding.configGap ? (
        <div className="review-config-gap">
          <b>Config gap</b>
          <span>{finding.configGap}</span>
        </div>
      ) : null}
    </div>
  );
}

function BranchPlan({
  report,
  decisions,
}: {
  report: DreamReport;
  decisions: Decisions;
}): ReactElement {
  const acceptedFindings = report.findings.filter(
    (finding) => decisions[finding.id] === "accepted"
  );
  const repos = new Set(
    acceptedFindings.map((finding) => finding.projectPath ?? finding.project)
  );
  return (
    <div className="branch-plan">
      <div className="branch-plan-summary">
        <span className="branch-plan-icon">
          <Icon name="opensource" size={18} />
        </span>
        <div>
          <b>
            {acceptedFindings.length} accepted change
            {acceptedFindings.length === 1 ? "" : "s"} across {repos.size} repo
            {repos.size === 1 ? "" : "s"}
          </b>
          <span>
            Git repos can create PR branches; direct mode and non-Git projects
            write the target file after review.
          </span>
        </div>
      </div>
      <div className="branch-plan-steps">
        <span>apply mode</span>
        <Icon name="chevron" size={14} />
        <span>file change</span>
        <Icon name="chevron" size={14} />
        <span>push branch when GitHub exists</span>
        <Icon name="chevron" size={14} />
        <span>PR link or direct edit</span>
      </div>
    </div>
  );
}

// ── Step 1 · Overview ────────────────────────────────────────────────────────

function ReportNarrative({ report }: { report: DreamReport }): ReactElement {
  const topFindings = report.findings.slice(0, 3);
  const friction = report.alignment?.friction.slice(0, 3) ?? [];
  const metrics = reviewMetrics(report);
  const emptyReason =
    report.provenance?.generator === "no-data"
      ? "No projects are selected, so the run has no local sessions to inspect."
      : report.sessions === 0
        ? "No matching local sessions were found in this Sleep Cycle window."
        : "No suggested goals were produced from this run.";

  return (
    <div className="report-grid">
      <div className="report-panel report-panel-wide">
        <span className="report-kicker">Cycle readout</span>
        <p className="report-digest">{report.digest}</p>
        <div className="report-tags">
          <span>{report.sessions} sessions</span>
          <span>{report.projects} projects</span>
          <span>{report.harness}</span>
        </div>
      </div>

      <div className="report-panel">
        <span className="report-kicker">Suggested goals prepared</span>
        {topFindings.length > 0 ? (
          <div className="report-list">
            {topFindings.map((finding) => {
              const category = categorize(finding);
              return (
                <div key={finding.id} className="report-list-item">
                  <Icon
                    name={CATEGORY_ICON[category]}
                    size={15}
                    className="report-list-icon"
                  />
                  <span>
                    <b>{finding.title}</b>
                    <small>{CATEGORY_LABEL[category]}</small>
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="muted">{emptyReason}</p>
        )}
      </div>

      <div className="report-panel">
        <span className="report-kicker">Friction evidence</span>
        {friction.length > 0 ? (
          <div className="report-list">
            {friction.map((point) => (
              <div key={point.findingId} className="report-list-item">
                <Icon name="cycle" size={15} className="report-list-icon" />
                <span>
                  <b>{point.example}</b>
                  <small>{point.type}</small>
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">
            No friction evidence was found for this cycle.
          </p>
        )}
      </div>

      <div className="report-panel">
        <span className="report-kicker">Measurement snapshot</span>
        <div className="report-metrics">
          {metrics.map((metric) => (
            <span key={metric.key}>
              <b>{metric.value}</b>
              <small>{metric.label}</small>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function ReviewOverview({ report }: { report: DreamReport }): ReactElement {
  const split = alignmentSplit(report);
  const alignmentRing = report.rings.find((ring) => ring.key === "alignment");
  const findingCount = report.findings.length;
  const provenance = provenanceSummary(report);
  const acceptedAppliedChanges =
    report.reviewDecisions?.filter(
      (entry) => entry.state === "accepted" && entry.reviewBranch
    ) ?? [];

  return (
    <div className="review-overview">
      {report.window ? <CycleWindowBanner info={report.window} /> : null}

      <div className="flat-strip">
        <SummaryCard
          eyebrow="Alignment"
          value={split.human === split.agent ? split.human : composite(report)}
          size="hero"
          trend={{
            delta: alignmentRing?.delta ?? 0,
            tone: trendTone(alignmentRing?.delta ?? 0),
          }}
          sublabel={`${bandLabel(split.band)} · ${report.sessions} sessions · ${report.projects} projects`}
          tip={`${RING_TIP.alignment.text} ${TERM.alignmentBand}`}
        />
        <SummaryCard
          eyebrow="Suggested goals"
          value={findingCount}
          sublabel="Each suggested goal becomes an accept / reject decision"
          tip={TERM.suggestedGoals}
        />
        <SummaryCard
          eyebrow="Friction points"
          value={report.alignment?.friction.length ?? 0}
          sublabel="Where your intent and the agent diverged"
          tip={TERM.frictionPoints}
        />
        <SummaryCard
          eyebrow="Run source"
          value={provenance.value}
          sublabel={provenance.sublabel}
        />
      </div>

      {report.experiments.some(
        (experiment) =>
          experiment.status === "running" || experiment.status === "concluded"
      ) ? (
        <Section
          title="Did your last changes help?"
          hint="Goals you accepted in earlier cycles, measured against this one."
        >
          <MeasuredGoals experiments={report.experiments} />
        </Section>
      ) : null}

      <ReportNarrative report={report} />

      {acceptedAppliedChanges.length > 0 ? (
        <Section
          title="Accepted changes"
          hint="Git repos use pushed review branches with PR links. Direct-mode and non-Git changes are written to the target file."
        >
          <div className="action-queue">
            {acceptedAppliedChanges.map((entry) => (
              <ActionQueueItem key={entry.findingId} item={entry} />
            ))}
          </div>
        </Section>
      ) : null}

      {findingCount > 0 ? (
        <Section
          title="Where recommendations land"
          hint="Every suggested goal maps to a concrete place: your AGENTS.md, a skill, project context, or a prompt habit."
        >
          <RecommendationMap findings={report.findings} />
        </Section>
      ) : null}

      {report.projectInsights && report.projectInsights.length > 0 ? (
        <Section
          title="Project breakdown"
          hint="Where the window's activity and friction actually came from."
        >
          <ProjectBreakdown insights={report.projectInsights} />
        </Section>
      ) : null}

      {report.alignment ? (
        <AlignmentSides
          human={report.alignment.human}
          agent={report.alignment.agent}
        />
      ) : null}
    </div>
  );
}

// ── Step 2 · Guided findings ─────────────────────────────────────────────────

function FrictionForFinding({
  report,
  findingId,
}: {
  report: DreamReport;
  findingId: string;
}): ReactElement | null {
  const point = report.alignment?.friction.find(
    (f) => f.findingId === findingId
  );
  if (!point) return null;
  return (
    <div className="row row-wrap">
      <FrictionChip point={point} />
    </div>
  );
}

function ReviewFindings({
  report,
  decisions,
  activeId,
  decisionCount,
  onSelect,
  onDecide,
  onBackToOverview,
  onDone,
}: {
  report: DreamReport;
  decisions: Decisions;
  activeId: string;
  decisionCount: number;
  onSelect: (id: string) => void;
  onDecide: (findingId: string, state: ActionState) => void;
  onBackToOverview: () => void;
  onDone: () => void;
}): ReactElement {
  const findings = report.findings;
  const steps = findings.map((finding) => ({
    id: finding.id,
    label: shortFinding(finding),
    state: decisions[finding.id] ?? "open",
  }));
  const index = findings.findIndex((finding) => finding.id === activeId);
  const finding = findings[index] ?? findings[0] ?? null;

  function step(delta: number): void {
    const next = index + delta;
    if (next < 0) return;
    if (next >= findings.length) {
      onDone();
      return;
    }
    onSelect(findings[next]?.id ?? activeId);
  }

  return (
    <Section
      title="Suggested goals"
      hint="Suggested goals live in the Sleep Cycle review. Accept the ones to carry forward, reject the rest."
      right={
        <Button variant="ghost" onClick={onBackToOverview}>
          <Icon name="chevron" size={16} />
          Overview
        </Button>
      }
    >
      <div className="review-layout">
        <StepRail
          steps={steps}
          activeId={activeId}
          queueCount={decisionCount}
          onSelect={onSelect}
        />

        <div className="review-panel" key={finding?.id ?? "none"}>
          {finding ? (
            <>
              <FindingCard
                finding={finding}
                category={categorize(finding)}
                state={decisions[finding.id] ?? "open"}
                onAccept={() => onDecide(finding.id, "accepted")}
                onReject={() => onDecide(finding.id, "rejected")}
              />
              <ReviewOutcomePanel
                finding={finding}
                category={categorize(finding)}
                state={decisions[finding.id] ?? "open"}
              />
              {finding.patch ? <PatchPreview patch={finding.patch} /> : null}
              <FrictionForFinding report={report} findingId={finding.id} />
              <div className="review-controls">
                <Button
                  variant="ghost"
                  disabled={index <= 0}
                  onClick={() => step(-1)}
                >
                  <Icon name="chevron" size={16} />
                  Previous
                </Button>
                <span className="spacer" />
                <span className="muted">
                  Suggested goal {index + 1} of {findings.length}
                </span>
                <Button variant="ghost" onClick={() => step(1)}>
                  {index >= findings.length - 1 ? "View decisions" : "Next"}
                  <Icon name="chevron" size={16} />
                </Button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </Section>
  );
}

// ── Step 3 · Goal decisions + what happens next ──────────────────────────────

function ReviewQueue({
  report,
  decisions,
  onUndo,
  onBackToFindings,
}: {
  report: DreamReport;
  decisions: Decisions;
  onUndo: (findingId: string) => void;
  onBackToFindings: () => void;
}): ReactElement {
  const entries: ActionQueueEntry[] = report.findings
    .filter((finding) => {
      const state = decisions[finding.id];
      return state === "accepted" || state === "rejected";
    })
    .map((finding) => ({
      findingId: finding.id,
      category: categorize(finding),
      action: finding.action,
      project: finding.project,
      state: decisions[finding.id] ?? "open",
      projectPath: finding.projectPath,
      patch: finding.patch,
    }));

  const accepted = entries.filter((e) => e.state === "accepted").length;
  const rejected = entries.filter((e) => e.state === "rejected").length;
  const open = report.findings.length - entries.length;

  // Group accepted goals by category for the "what happens next" map.
  const byCategory = entries
    .filter((e) => e.state === "accepted")
    .reduce<Record<string, number>>((acc, entry) => {
      acc[entry.category] = (acc[entry.category] ?? 0) + 1;
      return acc;
    }, {});

  const CATEGORY_NEXT: Record<ActionCategory, string> = {
    agentsmd:
      "Updates AGENTS.md directly or through a pushed GitHub PR branch.",
    claudemd:
      "Updates CLAUDE.md directly or through a pushed GitHub PR branch.",
    contextdoc: "Writes durable context future agents can cite.",
    prompthabit: "Captures the prompt checkpoint for future sessions.",
    skill:
      "Scaffolds or updates the skill directly or through a pushed GitHub PR branch.",
  };

  return (
    <Section
      title="Goal decisions"
      hint="The accepted goals move forward; rejected suggestions retire with this Sleep Cycle."
      right={
        <Button variant="ghost" onClick={onBackToFindings}>
          <Icon name="chevron" size={16} />
          Back to suggested goals
        </Button>
      }
    >
      <div className="grid grid-3">
        <SummaryCard
          eyebrow="Accepted"
          value={accepted}
          sublabel="Move into Goals"
          tip={TERM.accepted}
        />
        <SummaryCard
          eyebrow="Rejected"
          value={rejected}
          sublabel="Retired with this Sleep Cycle"
          tip={TERM.rejected}
        />
        <SummaryCard
          eyebrow="Open"
          value={open}
          sublabel="Not decided yet"
          tip={TERM.open}
        />
      </div>

      {accepted > 0 ? (
        <BranchPlan report={report} decisions={decisions} />
      ) : null}

      {entries.length === 0 ? (
        <div className="empty">
          <p className="muted">
            {report.findings.length === 0
              ? "No suggested goals were produced from this cycle."
              : "No decisions yet. Step through the suggested goals to accept or reject them."}
          </p>
          {report.findings.length > 0 ? (
            <div className="row">
              <Button variant="accent" onClick={onBackToFindings}>
                Review suggested goals
              </Button>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="action-queue">
          {entries.map((entry) => (
            <ActionQueueItem
              key={entry.findingId}
              item={entry}
              onUndo={() => onUndo(entry.findingId)}
            />
          ))}
        </div>
      )}

      {Object.keys(byCategory).length > 0 ? (
        <div className="col">
          <span className="section-title">What happens next</span>
          <div className="grid grid-2">
            {(Object.keys(byCategory) as ActionCategory[]).map((category) => (
              <div key={category} className="card">
                <div className="card-head">
                  <h2 className="card-title">
                    <Icon name={CATEGORY_ICON[category]} size={16} />
                    {byCategory[category]} action
                  </h2>
                </div>
                <p className="muted">{CATEGORY_NEXT[category]}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </Section>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function Cycle({
  hd,
  report,
  reports,
  selectedId,
  onSelectCycle,
  onBackToList,
  onOpenImprovements,
  onRunSleepCycle,
}: {
  hd: HarnessDreams;
  report: DreamReport | null;
  reports: DreamReport[];
  selectedId: string | null;
  onSelectCycle: (id: string) => void;
  onBackToList: () => void;
  onOpenImprovements: () => void;
  onRunSleepCycle: () => void;
}): ReactElement {
  const { state, actions } = hd;

  // Review wizard step: "__overview" → a finding id → "__queue".
  const [activeId, setActiveId] = useState<string>("__overview");
  const [decisions, setDecisions] = useState<Decisions>({});

  useEffect(() => {
    setActiveId("__overview");
    setDecisions(decisionsFromReport(report));
  }, [report]);

  const decisionCount = useMemo(
    () => Object.values(decisions).filter((s) => s !== "open").length,
    [decisions]
  );
  const acceptedGoalCount = useMemo(
    () => Object.values(decisions).filter((s) => s === "accepted").length,
    [decisions]
  );

  if (!state) return <p className="card-hint">Loading…</p>;

  const scheduleLabel =
    hd.config?.schedule.mode === "nightly"
      ? formatSchedule(hd.config.schedule.time)
      : "manual start";

  if (state.phase === "dreaming") {
    return (
      <div className="col">
        <CycleRunning state={state} actions={actions} />
      </div>
    );
  }

  if (!selectedId) {
    return (
      <div className="col">
        <CycleIndex
          hd={hd}
          reports={reports}
          selectedId={selectedId}
          scheduleLabel={scheduleLabel}
          onSelectCycle={onSelectCycle}
          onRunSleepCycle={onRunSleepCycle}
        />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="col">
        <CycleResting
          scheduleLabel={scheduleLabel}
          onDreamNow={onRunSleepCycle}
        />
      </div>
    );
  }

  function decide(findingId: string, next: ActionState): void {
    setDecisions((prev) => ({
      ...prev,
      [findingId]: prev[findingId] === next ? "open" : next,
    }));
  }

  function undo(findingId: string): void {
    setDecisions((prev) => ({ ...prev, [findingId]: "open" }));
  }

  const onQueue = activeId === QUEUE_ID;
  const onOverview = activeId === "__overview";
  const isLatest = report.id === reports[0]?.id;
  const status = listCycleStatus(report, isLatest);
  const hasFindings = report.findings.length > 0;

  // One step is on screen at a time so the page never grows into a long scroll.
  const step = !hasFindings
    ? "overview"
    : onOverview
      ? "overview"
      : onQueue
        ? "queue"
        : "findings";
  const canMarkReviewed = status === "unreviewed";

  return (
    <div className="col">
      <PageHeader
        crumbs={cycleCrumbs(
          report,
          step,
          onBackToList,
          () => setActiveId("__overview"),
          decisionCount
        )}
        title={report.rangeLabel}
        subtitle={
          onOverview ? `${statusLabel(status)} · ${report.digest}` : undefined
        }
        secondary={<Pill tone={statusTone(status)}>{statusLabel(status)}</Pill>}
        primary={
          onOverview ? (
            <>
              {canMarkReviewed ? (
                <Button
                  variant="ghost"
                  onClick={() =>
                    void actions.markReviewed(report.id, decisions)
                  }
                >
                  <Icon name="accept" size={16} />
                  Mark reviewed
                </Button>
              ) : null}
              {hasFindings ? (
                <Button
                  variant="accent"
                  onClick={() =>
                    setActiveId(report.findings[0]?.id ?? QUEUE_ID)
                  }
                >
                  <Icon name="cycle" size={16} />
                  Review {report.findings.length} suggested goals
                  <Icon name="chevron" size={16} />
                </Button>
              ) : (
                <Button variant="accent" onClick={onRunSleepCycle}>
                  <Icon name="dream" size={16} />
                  Run another cycle
                </Button>
              )}
            </>
          ) : canMarkReviewed ? (
            <Button
              variant="accent"
              onClick={() => void actions.markReviewed(report.id, decisions)}
            >
              <Icon name="accept" size={16} />
              Mark reviewed
            </Button>
          ) : undefined
        }
      />

      {hasFindings ? (
        <ReviewCompass
          report={report}
          decisions={decisions}
          step={step}
          onOverview={() => setActiveId("__overview")}
          onFindings={() => setActiveId(report.findings[0]?.id ?? QUEUE_ID)}
          onQueue={() => setActiveId(QUEUE_ID)}
        />
      ) : null}

      <div className="review-step" key={step}>
        {onOverview ? <ReviewOverview report={report} /> : null}

        {step === "findings" ? (
          <ReviewFindings
            report={report}
            decisions={decisions}
            activeId={activeId}
            decisionCount={decisionCount}
            onSelect={setActiveId}
            onDecide={decide}
            onBackToOverview={() => setActiveId("__overview")}
            onDone={() => setActiveId(QUEUE_ID)}
          />
        ) : null}

        {onQueue ? (
          <>
            <ReviewQueue
              report={report}
              decisions={decisions}
              onUndo={undo}
              onBackToFindings={() =>
                setActiveId(report.findings[0]?.id ?? "__overview")
              }
            />
            <Section
              title="Carry into Goals"
              hint="Accepted goals feed Goals so the next Sleep Cycle can measure whether they worked."
              right={
                <Button variant="accent" onClick={onOpenImprovements}>
                  <Icon name="improvements" size={16} />
                  Open Goals
                  <Icon name="chevron" size={16} />
                </Button>
              }
            >
              <p className="muted">
                {acceptedGoalCount > 0
                  ? `${acceptedGoalCount} goal${acceptedGoalCount === 1 ? "" : "s"} ready to track next Sleep Cycle.`
                  : "Accept a suggested goal to start tracking it."}
              </p>
            </Section>
          </>
        ) : null}
      </div>
    </div>
  );
}
