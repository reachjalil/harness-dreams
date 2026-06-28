/**
 * The visible steps of a dream run, mirroring the Dream Engine pipeline in the
 * spec (Deep Sleep → REM → Assemble). Shared so the simulation (main) and the
 * live process view (renderer) stay in lockstep.
 */

import type { CycleKind } from "./types";

export interface DreamStage {
  /** Progress threshold (0..1) at which this stage becomes active. */
  at: number;
  label: string;
}

export const DREAM_STAGES: DreamStage[] = [
  { at: 0.0, label: "Collecting session traces" },
  { at: 0.14, label: "Replaying decisions" },
  { at: 0.34, label: "Comparing goals to behavior" },
  { at: 0.56, label: "Finding repeated friction" },
  { at: 0.78, label: "Drafting suggested goals" },
  { at: 0.92, label: "Preparing Sleep Cycle review" },
];

/** A nap is shorter and lighter — Deep Sleep only, a handful of quick steps. */
export const NAP_STAGES: DreamStage[] = [
  { at: 0.0, label: "Collecting this morning's traces" },
  { at: 0.4, label: "Scanning for quick wins" },
  { at: 0.75, label: "Preparing nap review" },
];

/** The stages for a given cycle kind. */
export function stagesFor(kind: CycleKind = "sleep"): DreamStage[] {
  return kind === "nap" ? NAP_STAGES : DREAM_STAGES;
}

/** The stage that is active at a given progress value. */
export function stageForProgress(
  progress: number,
  kind: CycleKind = "sleep"
): DreamStage {
  const stages = stagesFor(kind);
  let current = stages[0];
  for (const stage of stages) {
    if (progress >= stage.at) current = stage;
  }
  return current;
}
