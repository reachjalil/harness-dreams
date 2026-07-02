export interface DateRange {
  start: string;
  end: string;
}

export interface MetricSeriesPoint {
  date: string;
  value: number;
}

export interface Insight {
  id: string;
  metricIds: string[];
  type: 'trend' | 'anomaly' | 'milestone' | 'consistency' | 'recommendation';
  severity: 'positive' | 'neutral' | 'warning';
  title: string;
  explanation: string;
  recommendation?: string;
  comparison: {
    currentWindow: DateRange;
    baselineWindow?: DateRange;
    delta?: number;
    deltaPercent?: number;
  };
  confidence: 'low' | 'medium' | 'high';
  sourceSampleCount: number;
  deepLink: string;
  createdAt: string;
}

function avg(points: MetricSeriesPoint[]) {
  if (points.length === 0) return 0;
  return points.reduce((sum, p) => sum + p.value, 0) / points.length;
}

export function createTrendInsight(input: {
  metricId: string;
  metricLabel: string;
  unit: string;
  current: MetricSeriesPoint[];
  baseline: MetricSeriesPoint[];
  currentWindow: DateRange;
  baselineWindow: DateRange;
  deepLink: string;
}): Insight | null {
  const sourceSampleCount = input.current.length + input.baseline.length;
  if (input.current.length < 3 || input.baseline.length < 7) return null;

  const currentAvg = avg(input.current);
  const baselineAvg = avg(input.baseline);
  if (baselineAvg === 0) return null;

  const delta = currentAvg - baselineAvg;
  const deltaPercent = (delta / baselineAvg) * 100;
  if (Math.abs(deltaPercent) < 10) return null;

  const direction = delta > 0 ? 'up' : 'down';
  const confidence = sourceSampleCount >= 21 ? 'high' : sourceSampleCount >= 12 ? 'medium' : 'low';

  return {
    id: `trend:${input.metricId}:${input.currentWindow.start}:${input.currentWindow.end}`,
    metricIds: [input.metricId],
    type: 'trend',
    severity: delta > 0 ? 'positive' : 'neutral',
    title: `${input.metricLabel} is ${direction} ${Math.abs(deltaPercent).toFixed(0)}%`,
    explanation: `Your average ${input.metricLabel.toLowerCase()} was ${currentAvg.toFixed(1)} ${input.unit}, compared with ${baselineAvg.toFixed(1)} ${input.unit} in the baseline window.`,
    recommendation: delta > 0 ? 'Review what helped and consider keeping the routine.' : 'Review the detail page for gaps or source changes.',
    comparison: {
      currentWindow: input.currentWindow,
      baselineWindow: input.baselineWindow,
      delta,
      deltaPercent,
    },
    confidence,
    sourceSampleCount,
    deepLink: input.deepLink,
    createdAt: new Date().toISOString(),
  };
}
