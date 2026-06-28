import type { ReactElement } from "react";

import type {
  DreamReport,
  Experiment,
  ExperimentStatus,
  Metric,
} from "../shared/types";
import {
  MetricCell,
  PageHeader,
  Pill,
  Section,
  SummaryCard,
} from "./components";

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

/** One measured goal: hypothesis, progress, dual benefit, next watch. */
function MeasuringCard({
  improvement,
}: {
  improvement: Experiment;
}): ReactElement {
  const pct = Math.round((improvement.progress ?? 0) * 100);
  const tone = STATUS_TONE[improvement.status];
  const label = STATUS_LABEL[improvement.status];
  return (
    <article className="card improvement-card">
      <div className="card-head">
        <h3 className="card-title">{improvement.title}</h3>
        <Pill tone={tone}>{label}</Pill>
      </div>
      <p className="card-hint">{improvement.hypothesis}</p>

      {improvement.status === "running" ? (
        <div className="improvement-progress">
          <div className="cycle-bar">
            <div className="cycle-bar-fill" style={{ width: `${pct}%` }} />
          </div>
          <span className="muted tnum">
            {improvement.progressLabel ?? `${pct}% complete`}
          </span>
        </div>
      ) : null}

      <div className="finding-benefits">
        <div>
          <div className="finding-benefit-eyebrow">Why you</div>
          <p className="finding-benefit-text">{improvement.userBenefit}</p>
        </div>
        <div>
          <div className="finding-benefit-eyebrow">Why agent</div>
          <p className="finding-benefit-text">{improvement.agentBenefit}</p>
        </div>
      </div>

      <div className="finding-action">
        <div className="finding-action-main">
          <div className="finding-action-eyebrow">Measures</div>
          <p className="finding-action-text">{improvement.metric}</p>
        </div>
      </div>

      <p className="finding-watch">
        Next Sleep Cycle watches: {improvement.reflection}
      </p>
    </article>
  );
}

export default function Lab({
  report,
}: {
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
  const running = currentGoals.filter((x) => x.status === "running");
  const concluded = currentGoals.filter((x) => x.status === "concluded");
  const metrics = trackedMetrics(report);
  const measuringCount = running.length;
  const alignmentRing = report.rings.find((ring) => ring.key === "alignment");

  return (
    <div className="scroll-inner">
      <PageHeader
        eyebrow="Goals"
        title="Current goals"
        subtitle="Goals you accepted during Sleep Cycle review, plus the measurements that show whether they are working."
      />

      <div className="grid grid-3">
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
        />
        <SummaryCard
          eyebrow="Being measured"
          value={measuringCount}
          sublabel="Accepted goals currently in effect."
        />
        <SummaryCard
          eyebrow="Concluded"
          value={concluded.length}
          sublabel="Goals with enough evidence to retire or keep."
        />
      </div>

      <Section
        title="Now measuring"
        hint="The numbers a Sleep Cycle keeps checking before it calls a goal real."
      >
        <div className="grid grid-auto">
          {metrics.map((m) => (
            <MetricCell key={m.key} metric={m} />
          ))}
        </div>
      </Section>

      <Section
        title="Current goals"
        hint="Only accepted goals live here. New goals are accepted during Sleep Cycle review."
      >
        {currentGoals.length === 0 ? (
          <p className="empty">
            No current goals yet. Review a Sleep Cycle and accept a suggested
            goal to start tracking it.
          </p>
        ) : (
          <div className="grid grid-2">
            {currentGoals.map((x) => (
              <MeasuringCard key={x.id} improvement={x} />
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
