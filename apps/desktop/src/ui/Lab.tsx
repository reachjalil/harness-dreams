import type { ReactElement } from "react";

import type {
  DreamReport,
  Experiment,
  ExperimentStatus,
  GoalDisposition,
  ProjectInsight,
} from "../shared/types";
import { PageHeader, Pill, SummaryCard } from "./components";
import { TERM } from "./explainers";
import type { HarnessDreams } from "./useHarnessDreams";

const STATUS_TONE: Record<ExperimentStatus, "neutral" | "accent" | "good"> = {
  proposed: "neutral",
  running: "accent",
  concluded: "good",
};

const STATUS_LABEL: Record<ExperimentStatus, string> = {
  proposed: "Draft",
  running: "Measuring",
  concluded: "Concluded",
};

const VERDICT_LABEL = {
  helped: "Helped",
  "no-change": "No change",
  worse: "Worse",
} as const;

const VERDICT_TONE = {
  helped: "good",
  "no-change": "warn",
  worse: "danger",
} as const;

function composite(report: DreamReport): number {
  const sum = report.rings.reduce((acc, ring) => acc + ring.score, 0);
  return Math.round(sum / Math.max(1, report.rings.length));
}

function fmtSigned(value: number, unit = ""): string {
  if (value === 0) return `0${unit}`;
  return `${value > 0 ? "+" : ""}${value}${unit}`;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(
    values.reduce((sum, value) => sum + value, 0) / values.length
  );
}

function insightForGoal(
  report: DreamReport,
  goal: Experiment
): ProjectInsight | null {
  return (
    report.projectInsights?.find(
      (project) => project.path === goal.projectPath
    ) ?? null
  );
}

function uniqueTargetInsights(
  report: DreamReport,
  goals: Experiment[]
): ProjectInsight[] {
  const byPath = new Map<string, ProjectInsight>();
  for (const goal of goals) {
    const insight = insightForGoal(report, goal);
    if (insight) byPath.set(insight.path, insight);
  }
  return [...byPath.values()];
}

function goalMeasurementText(report: DreamReport, goal: Experiment): string {
  const insight = insightForGoal(report, goal);
  if (!insight) {
    return "Latest window: no activity found for this goal's target project yet.";
  }
  const pieces = [`${insight.sessions} sessions`, `${insight.turns} turns`];
  if (goal.baseline) {
    pieces.push(
      `alignment ${goal.baseline.alignment} -> ${insight.alignment}`,
      `corrections ${goal.baseline.corrections} -> ${insight.corrections}`
    );
  }
  if (goal.baseline?.contextScore != null && insight.contextHealth) {
    pieces.push(
      `context ${goal.baseline.contextScore} -> ${insight.contextHealth.score}`
    );
  }
  return `Latest window: ${pieces.join(" · ")}`;
}

interface GoalSignal {
  key: string;
  label: string;
  value: string;
  detail: string;
  delta?: string;
  good: boolean;
}

function goalSignals(report: DreamReport, goals: Experiment[]): GoalSignal[] {
  if (goals.length === 0) return [];
  const targetInsights = uniqueTargetInsights(report, goals);
  const activeTargets = targetInsights.filter(
    (insight) => insight.sessions > 0
  );
  const sessions = targetInsights.reduce(
    (sum, insight) => sum + insight.sessions,
    0
  );
  const turns = targetInsights.reduce((sum, insight) => sum + insight.turns, 0);
  const withBaseline = goals
    .map((goal) => ({ goal, insight: insightForGoal(report, goal) }))
    .filter((item): item is { goal: Experiment; insight: ProjectInsight } =>
      Boolean(item.insight && item.goal.baseline)
    );
  const alignmentDelta = average(
    withBaseline.map(
      (item) => item.insight.alignment - item.goal.baseline!.alignment
    )
  );
  const baselineAlignment = average(
    withBaseline.map((item) => item.goal.baseline!.alignment)
  );
  const currentAlignment = average(
    withBaseline.map((item) => item.insight.alignment)
  );
  const currentCorrections = withBaseline.reduce(
    (sum, item) => sum + item.insight.corrections,
    0
  );
  const baselineCorrections = withBaseline.reduce(
    (sum, item) => sum + item.goal.baseline!.corrections,
    0
  );
  const contextPairs = withBaseline.filter(
    (item) =>
      item.goal.baseline?.contextScore != null && item.insight.contextHealth
  );
  const currentContext = average(
    contextPairs.map((item) => item.insight.contextHealth?.score ?? 0)
  );
  const baselineContext = average(
    contextPairs.map((item) => item.goal.baseline!.contextScore ?? 0)
  );
  const contextDelta =
    currentContext != null && baselineContext != null
      ? currentContext - baselineContext
      : null;

  return [
    {
      key: "activity",
      label: "Target activity",
      value: `${activeTargets.length}/${targetInsights.length || goals.length}`,
      detail:
        sessions > 0
          ? `${sessions} sessions · ${turns} turns in this Sleep Cycle window`
          : "Waiting for new sessions in the goal's project",
      good: activeTargets.length > 0,
    },
    {
      key: "alignment",
      label: "Alignment change",
      value: alignmentDelta == null ? "Waiting" : fmtSigned(alignmentDelta),
      delta:
        alignmentDelta == null ? undefined : `${fmtSigned(alignmentDelta)} pts`,
      detail:
        baselineAlignment != null && currentAlignment != null
          ? `Current ${currentAlignment} vs accepted baseline ${baselineAlignment}`
          : "Baseline appears after a goal is accepted",
      good: alignmentDelta == null || alignmentDelta >= 0,
    },
    {
      key: "corrections",
      label: "Corrections change",
      value:
        withBaseline.length === 0
          ? "Waiting"
          : fmtSigned(currentCorrections - baselineCorrections),
      delta:
        withBaseline.length === 0
          ? undefined
          : `${fmtSigned(currentCorrections - baselineCorrections)}`,
      detail:
        withBaseline.length > 0
          ? `Current ${currentCorrections} vs accepted baseline ${baselineCorrections}`
          : "Baseline appears after a goal is accepted",
      good: currentCorrections <= baselineCorrections,
    },
    {
      key: "context",
      label: "Context score",
      value: currentContext == null ? "Not tracked" : `${currentContext}`,
      delta:
        contextDelta == null ? undefined : `${fmtSigned(contextDelta)} pts`,
      detail:
        currentContext != null && baselineContext != null
          ? `Current ${currentContext} vs accepted baseline ${baselineContext}`
          : "No context baseline for these goals",
      good: contextDelta == null || contextDelta >= 0,
    },
  ];
}

function GoalSignalCell({ signal }: { signal: GoalSignal }): ReactElement {
  return (
    <div className="metric-cell goal-signal-cell">
      <div className="metric-top">
        <span className="metric-label">{signal.label}</span>
        {signal.delta ? (
          <span className={`metric-delta${signal.good ? " good" : " warn"}`}>
            {signal.delta}
          </span>
        ) : null}
      </div>
      <div className="metric-value tnum">{signal.value}</div>
      <div className="metric-detail">{signal.detail}</div>
    </div>
  );
}

function GoalGroup({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: ReactElement | ReactElement[];
}): ReactElement {
  return (
    <section className="goal-group">
      <div className="goal-group-head">
        <h2 className="section-title">{title}</h2>
        <p className="card-hint">{hint}</p>
      </div>
      <div className="goal-stack">{children}</div>
    </section>
  );
}

function GoalPill({ goal }: { goal: Experiment }): ReactElement {
  if (goal.disposition === "kept") return <Pill tone="good">Kept</Pill>;
  if (goal.disposition === "retired")
    return <Pill tone="neutral">Retired</Pill>;
  if (goal.status === "concluded" && goal.verdict) {
    return (
      <Pill tone={VERDICT_TONE[goal.verdict]}>
        {VERDICT_LABEL[goal.verdict]}
      </Pill>
    );
  }
  return (
    <Pill tone={STATUS_TONE[goal.status]}>{STATUS_LABEL[goal.status]}</Pill>
  );
}

function ProgressOrVerdict({ goal }: { goal: Experiment }): ReactElement {
  if (goal.status === "running") {
    const pct = Math.round((goal.progress ?? 0) * 100);
    return (
      <div className="improvement-progress">
        <div className="cycle-bar">
          <div className="cycle-bar-fill" style={{ width: `${pct}%` }} />
        </div>
        <span className="muted tnum">
          {goal.progressLabel ?? `${pct}% complete`}
        </span>
      </div>
    );
  }

  return (
    <p
      className={`goal-verdict${goal.verdict ? ` ${VERDICT_TONE[goal.verdict]}` : ""}`}
    >
      {goal.verdictNote ?? goal.progressLabel ?? "Enough evidence to decide."}
    </p>
  );
}

function GoalActions({
  goal,
  onSetDisposition,
}: {
  goal: Experiment;
  onSetDisposition: (
    experimentId: string,
    disposition: GoalDisposition | null
  ) => void;
}): ReactElement {
  if (goal.disposition === "kept") {
    return (
      <button
        type="button"
        className="btn ghost"
        onClick={() => onSetDisposition(goal.id, null)}
      >
        Undo
      </button>
    );
  }

  if (goal.disposition === "retired") {
    return (
      <button
        type="button"
        className="btn ghost"
        onClick={() => onSetDisposition(goal.id, null)}
      >
        Restore
      </button>
    );
  }

  if (goal.status === "running") {
    return (
      <button
        type="button"
        className="btn ghost"
        onClick={() => onSetDisposition(goal.id, "retired")}
      >
        Stop measuring
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        className="btn danger"
        onClick={() => onSetDisposition(goal.id, "retired")}
      >
        Retire
      </button>
      <button
        type="button"
        className="btn accent"
        onClick={() => onSetDisposition(goal.id, "kept")}
      >
        Keep
      </button>
    </>
  );
}

/** One measured goal: hypothesis, progress, dual benefit, next watch. */
function GoalCard({
  goal,
  report,
  onSetDisposition,
}: {
  goal: Experiment;
  report: DreamReport;
  onSetDisposition: (
    experimentId: string,
    disposition: GoalDisposition | null
  ) => void;
}): ReactElement {
  return (
    <article
      className={`card goal-card${goal.disposition ? ` ${goal.disposition}` : ""}`}
    >
      <div className="goal-card-head">
        <h3 className="card-title">{goal.title}</h3>
        <GoalPill goal={goal} />
      </div>
      <p className="card-hint">{goal.hypothesis}</p>

      <ProgressOrVerdict goal={goal} />

      <div className="finding-benefits">
        <div>
          <div className="finding-benefit-eyebrow">Why you</div>
          <p className="finding-benefit-text">{goal.userBenefit}</p>
        </div>
        <div>
          <div className="finding-benefit-eyebrow">Why agent</div>
          <p className="finding-benefit-text">{goal.agentBenefit}</p>
        </div>
      </div>

      <p className="finding-watch">
        {goalMeasurementText(report, goal)}
        <br />
        Measures {goal.metric} · Watches {goal.reflection}
      </p>

      <div className="finding-controls goal-controls">
        <span className="spacer" />
        <GoalActions goal={goal} onSetDisposition={onSetDisposition} />
      </div>
    </article>
  );
}

export default function Lab({
  hd,
  report,
}: {
  hd: HarnessDreams;
  report: DreamReport | null;
}): ReactElement {
  if (!report) {
    return (
      <div className="scroll-inner">
        <p className="card-hint">Loading...</p>
      </div>
    );
  }

  const currentGoals = report.experiments.filter(
    (x) => x.status === "running" || x.status === "concluded"
  );
  const running = currentGoals.filter(
    (x) => x.status === "running" && !x.disposition
  );
  const ready = currentGoals.filter(
    (x) => x.status === "concluded" && !x.disposition
  );
  const kept = currentGoals.filter((x) => x.disposition === "kept");
  const retired = currentGoals.filter((x) => x.disposition === "retired");
  const concluded = currentGoals.filter((x) => x.status === "concluded");
  const signals = goalSignals(report, running);
  const measuringCount = running.length;
  const targetInsights = uniqueTargetInsights(report, running);
  const activeTargets = targetInsights.filter(
    (insight) => insight.sessions > 0
  );
  const alignmentRing = report.rings.find((ring) => ring.key === "alignment");
  const setDisposition = (
    experimentId: string,
    disposition: GoalDisposition | null
  ): void => {
    void hd.actions.setGoalDisposition(report.id, experimentId, disposition);
  };

  return (
    <div className="scroll-inner">
      <PageHeader
        eyebrow="Goals"
        title="Current goals"
        subtitle="Goals you accepted during Sleep Cycle review, plus the measurements that show whether they are working."
      />

      <div className="card goal-summary-card">
        <div className="flat-strip flat-strip-divided">
          <SummaryCard
            size="hero"
            eyebrow="Composite score"
            value={composite(report)}
            trend={
              alignmentRing
                ? {
                    delta: alignmentRing.delta,
                    tone:
                      alignmentRing.delta > 0
                        ? "positive"
                        : alignmentRing.delta < 0
                          ? "negative"
                          : "neutral",
                  }
                : undefined
            }
            sublabel="Latest Sleep Cycle score across efficiency, effectiveness, and alignment."
            tip={TERM.composite}
          />
          <SummaryCard
            eyebrow="Measuring now"
            value={measuringCount}
            sublabel={
              measuringCount > 0
                ? `${activeTargets.length}/${Math.max(1, targetInsights.length || measuringCount)} target projects had activity.`
                : "No accepted goals are currently collecting signal."
            }
            tip={TERM.beingMeasured}
          />
          <SummaryCard
            eyebrow="Concluded / kept"
            value={`${concluded.length} / ${kept.length}`}
            sublabel="Goals with enough evidence, and the ones you kept."
            tip={TERM.concluded}
          />
        </div>
      </div>

      <GoalGroup
        title="Now measuring"
        hint="Latest Sleep Cycle data compared with the snapshot taken when each goal was accepted."
      >
        <div className="card goal-metrics-card">
          {signals.length > 0 ? (
            <div className="flat-strip flat-strip-divided flat-strip-4">
              {signals.map((signal) => (
                <GoalSignalCell key={signal.key} signal={signal} />
              ))}
            </div>
          ) : (
            <p className="empty">
              No goals are actively measuring. Accept a suggested goal during
              Sleep Cycle review to start comparing future project activity
              against its baseline.
            </p>
          )}
        </div>
      </GoalGroup>

      {currentGoals.length === 0 ? (
        <GoalGroup
          title="Current goals"
          hint="Only accepted goals live here. New goals are accepted during Sleep Cycle review."
        >
          <div className="card">
            <p className="empty">
              No current goals yet. Review a Sleep Cycle and accept a suggested
              goal to start tracking it.
            </p>
          </div>
        </GoalGroup>
      ) : null}

      {running.length > 0 ? (
        <GoalGroup
          title="Measuring now"
          hint="Accepted goals still collecting signal. Stop measuring if the goal is no longer useful."
        >
          {running.map((x) => (
            <GoalCard
              key={x.id}
              goal={x}
              report={report}
              onSetDisposition={setDisposition}
            />
          ))}
        </GoalGroup>
      ) : null}

      {ready.length > 0 ? (
        <GoalGroup
          title="Ready for your call"
          hint="These goals have enough evidence. Keep the ones worth making permanent; retire the rest."
        >
          {ready.map((x) => (
            <GoalCard
              key={x.id}
              goal={x}
              report={report}
              onSetDisposition={setDisposition}
            />
          ))}
        </GoalGroup>
      ) : null}

      {kept.length > 0 ? (
        <GoalGroup
          title="Kept"
          hint="Decisions you kept as useful guidance. Undo moves a goal back to your decision queue."
        >
          {kept.map((x) => (
            <GoalCard
              key={x.id}
              goal={x}
              report={report}
              onSetDisposition={setDisposition}
            />
          ))}
        </GoalGroup>
      ) : null}

      {retired.length > 0 ? (
        <section className="goal-group">
          <details className="retired-goals">
            <summary>
              <span>{retired.length} retired · Show</span>
              <span className="card-hint">
                Restore brings a goal back to its prior state.
              </span>
            </summary>
            <div className="goal-stack">
              {retired.map((x) => (
                <GoalCard
                  key={x.id}
                  goal={x}
                  report={report}
                  onSetDisposition={setDisposition}
                />
              ))}
            </div>
          </details>
        </section>
      ) : null}
    </div>
  );
}
