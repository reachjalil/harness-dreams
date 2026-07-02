/**
 * The single source of truth for "what should Home say and offer right now".
 * Pure logic only — copy lives in explainers.ts (MOMENT). Keeping this a plain
 * function makes the whole daily arc unit-testable and demo-overridable.
 */

import type { TimeOfDay } from "../shared/timeOfDay";
import type {
  HealthReviewPhase,
  HealthReport,
  ScheduleMode,
} from "../shared/types";

export type MomentKind =
  | "running"
  | "review"
  | "quick"
  | "full"
  | "rest"
  | "standby";

export type MomentCta = "full" | "quick" | "review";

export interface Moment {
  kind: MomentKind;
  ctaKind?: MomentCta;
}

/** Fresh sessions needed before we suggest a review. */
export const QUICK_REVIEW_THRESHOLD = 3;
export const FULL_REVIEW_THRESHOLD = 5;

export interface MomentInput {
  tod: TimeOfDay;
  phase: HealthReviewPhase;
  /** The latest unreviewed report, if one is waiting. */
  pending: HealthReport | null;
  /** Sessions accumulated since the last reviewed report. */
  activity: number;
  scheduleMode: ScheduleMode;
}

/** Pick the one thing Home should surface, first match wins. */
export function decideMoment(input: MomentInput): Moment {
  if (input.phase === "running") return { kind: "running" };
  if (input.pending) return { kind: "review", ctaKind: "review" };
  if (input.tod === "midday" && input.activity >= QUICK_REVIEW_THRESHOLD) {
    return { kind: "quick", ctaKind: "quick" };
  }
  if (input.tod === "evening" && input.activity >= FULL_REVIEW_THRESHOLD) {
    return { kind: "full", ctaKind: "full" };
  }
  if (input.tod === "night" && input.scheduleMode === "daily") {
    return { kind: "standby" };
  }
  return { kind: "rest" };
}
