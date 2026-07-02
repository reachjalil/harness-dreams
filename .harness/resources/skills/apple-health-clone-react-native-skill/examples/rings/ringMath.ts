export interface RingGeometryInput {
  progress: number; // 1.0 = complete, can exceed 1.0
  startAngle?: number; // radians; default starts near top
  minVisibleProgress?: number;
}

export interface RingGeometryOutput {
  clampedProgress: number;
  completed: boolean;
  overflowLaps: number;
  remainder: number;
  startAngle: number;
  endAngle: number;
  sweepAngle: number;
}

const TAU = Math.PI * 2;

export function getRingGeometry(input: RingGeometryInput): RingGeometryOutput {
  const progress = Number.isFinite(input.progress) ? Math.max(0, input.progress) : 0;
  const startAngle = input.startAngle ?? -Math.PI / 2;
  const minVisibleProgress = input.minVisibleProgress ?? 0.006;
  const completed = progress >= 1;
  const overflowLaps = Math.max(0, Math.floor(progress));
  const remainder = progress % 1;

  const visibleProgress = progress > 0 && progress < minVisibleProgress
    ? minVisibleProgress
    : completed
      ? 1
      : progress;

  const sweepAngle = visibleProgress * TAU;
  const endAngle = startAngle + sweepAngle;

  return {
    clampedProgress: visibleProgress,
    completed,
    overflowLaps,
    remainder,
    startAngle,
    endAngle,
    sweepAngle,
  };
}

export function progressFromValue(value: number, goal: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(goal) || goal <= 0) return 0;
  return Math.max(0, value / goal);
}

export function ringAccessibilityLabel(label: string, value: number, goal: number, unit: string) {
  const pct = Math.round(progressFromValue(value, goal) * 100);
  return `${label}, ${value} of ${goal} ${unit}, ${pct} percent complete`;
}
