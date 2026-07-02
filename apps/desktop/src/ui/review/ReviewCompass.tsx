import type { ReactElement } from "react";

import type { HealthReport } from "../../shared/types";
import { Icon } from "../icons";
import type { Decisions } from "./useReviewWizard";

type ReviewStep = "overview" | "findings" | "queue";

function composite(report: HealthReport): number {
  const sum = report.rings.reduce((acc, ring) => acc + ring.score, 0);
  return Math.round(sum / Math.max(1, report.rings.length));
}

function decisionStats(
  report: HealthReport,
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

export function ReviewCompass({
  report,
  decisions,
  step,
  onOverview,
  onFindings,
  onQueue,
}: {
  report: HealthReport;
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
      icon: "review" as const,
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
      aria-label="Health Review progress"
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
