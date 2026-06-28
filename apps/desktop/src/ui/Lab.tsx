import type { ReactElement } from "react";

import type {
  DreamReport,
  Experiment,
  ExperimentStatus,
  GoalDisposition,
  Metric,
} from "../shared/types";
import { MetricCell, PageHeader, Pill, SummaryCard } from "./components";
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

/** Metrics worth surfacing as the things a Sleep Cycle keeps measuring. */
const TRACKED_KEYS = ["reask", "tokens_per_change", "tool_success", "cache"];

function composite(report: DreamReport): number {
  const sum = report.rings.reduce((acc, ring) => acc + ring.score, 0);
  return Math.round(sum / Math.max(1, report.rings.length));
}

function trackedMetrics(report: DreamReport): Metric[] {
  return TRACKED_KEYS.map((key) =>
    report.metrics.find((item) => item.key === key)
  ).filter((item): item is Metric => Boolean(item));
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
  onSetDisposition,
}: {
  goal: Experiment;
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
        Measures {goal.metric} · Next Sleep Cycle watches {goal.reflection}
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
  const metrics = trackedMetrics(report);
  const measuringCount = running.length;
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
            sublabel="Efficiency, effectiveness, and alignment combined."
            tip={TERM.composite}
          />
          <SummaryCard
            eyebrow="Measuring now"
            value={measuringCount}
            sublabel="Accepted goals currently in effect."
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
        hint="The numbers a Sleep Cycle keeps checking before it calls a goal real."
      >
        <div className="card goal-metrics-card">
          <div className="flat-strip flat-strip-divided flat-strip-4">
            {metrics.map((m) => (
              <MetricCell key={m.key} metric={m} />
            ))}
          </div>
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
            <GoalCard key={x.id} goal={x} onSetDisposition={setDisposition} />
          ))}
        </GoalGroup>
      ) : null}

      {ready.length > 0 ? (
        <GoalGroup
          title="Ready for your call"
          hint="These goals have enough evidence. Keep the ones worth making permanent; retire the rest."
        >
          {ready.map((x) => (
            <GoalCard key={x.id} goal={x} onSetDisposition={setDisposition} />
          ))}
        </GoalGroup>
      ) : null}

      {kept.length > 0 ? (
        <GoalGroup
          title="Kept"
          hint="Decisions you kept as useful guidance. Undo moves a goal back to your decision queue."
        >
          {kept.map((x) => (
            <GoalCard key={x.id} goal={x} onSetDisposition={setDisposition} />
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
