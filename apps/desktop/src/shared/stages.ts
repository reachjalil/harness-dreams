/**
 * Visible steps for a health review run. Shared so the simulation (main) and
 * the live process view (renderer) stay in lockstep.
 */

import type { HealthReviewKind } from "./types";

export interface HealthReviewStage {
  /** Progress threshold (0..1) at which this stage becomes active. */
  at: number;
  label: string;
}

export const HEALTH_REVIEW_STAGES: HealthReviewStage[] = [
  { at: 0.0, label: "Collecting session traces" },
  { at: 0.14, label: "Replaying decisions" },
  { at: 0.34, label: "Comparing goals to behavior" },
  { at: 0.56, label: "Finding repeated friction" },
  { at: 0.78, label: "Drafting suggested goals" },
  { at: 0.92, label: "Preparing health report" },
];

/** A quick review is shorter and lighter: just the top same-day signals. */
export const QUICK_REVIEW_STAGES: HealthReviewStage[] = [
  { at: 0.0, label: "Collecting this morning's traces" },
  { at: 0.4, label: "Scanning for quick wins" },
  { at: 0.75, label: "Preparing quick review" },
];

/** The stages for a given review kind. */
export function stagesFor(
  kind: HealthReviewKind = "full"
): HealthReviewStage[] {
  return kind === "quick" ? QUICK_REVIEW_STAGES : HEALTH_REVIEW_STAGES;
}

/** The stage that is active at a given progress value. */
export function stageForProgress(
  progress: number,
  kind: HealthReviewKind = "full"
): HealthReviewStage {
  const stages = stagesFor(kind);
  let current = stages[0];
  for (const stage of stages) {
    if (progress >= stage.at) current = stage;
  }
  return current;
}
