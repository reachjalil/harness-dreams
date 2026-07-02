import type { ReactElement } from "react";

import type { ExperimentVerdict } from "../../shared/types";
import { Button, Pill, Section } from "../components";
import { Icon } from "../icons";
import type { LoopImpact } from "./useLoopImpact";

function signed(value: number): string {
  return `${value > 0 ? "+" : ""}${value}`;
}

function verdictTone(verdict?: ExperimentVerdict): "good" | "warn" | "danger" {
  if (verdict === "helped") return "good";
  if (verdict === "worse") return "danger";
  return "warn";
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

export function LoopOutcome({
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
