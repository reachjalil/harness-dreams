/**
 * The single source of truth for "what should Home say and offer right now".
 * Pure logic only — copy lives in explainers.ts (MOMENT). Keeping this a plain
 * function makes the whole daily arc unit-testable and demo-overridable.
 */

import type { TimeOfDay } from "../shared/timeOfDay";
import type { DreamPhase, DreamReport, ScheduleMode } from "../shared/types";

export type MomentKind =
  | "running"
  | "review"
  | "nap"
  | "sleep"
  | "rest"
  | "standby";

export type MomentCta = "sleep" | "nap" | "review";

export interface Moment {
  kind: MomentKind;
  ctaKind?: MomentCta;
}

/** Fresh sessions needed before we suggest a cycle. */
export const NAP_THRESHOLD = 3;
export const SLEEP_THRESHOLD = 5;

export interface MomentInput {
  tod: TimeOfDay;
  phase: DreamPhase;
  /** The latest unreviewed cycle, if one is waiting. */
  pending: DreamReport | null;
  /** Sessions accumulated since the last reviewed cycle. */
  activity: number;
  scheduleMode: ScheduleMode;
}

/** Pick the one thing Home should surface, first match wins. */
export function decideMoment(input: MomentInput): Moment {
  if (input.phase === "dreaming") return { kind: "running" };
  if (input.pending) return { kind: "review", ctaKind: "review" };
  if (input.tod === "midday" && input.activity >= NAP_THRESHOLD) {
    return { kind: "nap", ctaKind: "nap" };
  }
  if (input.tod === "evening" && input.activity >= SLEEP_THRESHOLD) {
    return { kind: "sleep", ctaKind: "sleep" };
  }
  if (input.tod === "night" && input.scheduleMode === "nightly") {
    return { kind: "standby" };
  }
  return { kind: "rest" };
}
