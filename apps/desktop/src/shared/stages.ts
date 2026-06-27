/**
 * The visible steps of a dream run, mirroring the Dream Engine pipeline in the
 * spec (Deep Sleep → REM → Assemble). Shared so the simulation (main) and the
 * live process view (renderer) stay in lockstep.
 */

export interface DreamStage {
  /** Progress threshold (0..1) at which this stage becomes active. */
  at: number;
  label: string;
}

export const DREAM_STAGES: DreamStage[] = [
  { at: 0.0, label: "Waking the dream engine" },
  { at: 0.14, label: "Replaying the day's sessions" },
  { at: 0.34, label: "Computing vitals · deep sleep" },
  { at: 0.56, label: "Finding patterns · REM" },
  { at: 0.78, label: "Drafting findings & experiments" },
  { at: 0.92, label: "Assembling your report" },
];

/** The stage that is active at a given progress value. */
export function stageForProgress(progress: number): DreamStage {
  let current = DREAM_STAGES[0];
  for (const stage of DREAM_STAGES) {
    if (progress >= stage.at) current = stage;
  }
  return current;
}
