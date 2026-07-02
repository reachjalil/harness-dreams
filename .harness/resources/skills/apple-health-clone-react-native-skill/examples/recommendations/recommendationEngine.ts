import type { DailyFact } from '../data/healthModels';

export interface Insight {
  id: string;
  metricId: string;
  type: 'trend' | 'anomaly' | 'milestone' | 'recommendation' | 'education';
  severity: 'positive' | 'neutral' | 'attention';
  title: string;
  body: string;
  evidence: {
    currentWindow: { start: string; end: string; value: number; unit: string };
    baselineWindow?: { start: string; end: string; value: number; unit: string };
    delta?: number;
    deltaPercent?: number;
    sampleCount: number;
    confidence: 'low' | 'medium' | 'high';
  };
  suggestedAction?: { label: string; route: string };
  createdAt: string;
}

export function generateTrendInsight(params: {
  metricId: string;
  metricLabel: string;
  unit: string;
  facts: DailyFact[];
  currentDays?: number;
  baselineDays?: number;
  goal?: number;
  now?: Date;
}): Insight | null {
  const now = params.now ?? new Date();
  const currentDays = params.currentDays ?? 7;
  const baselineDays = params.baselineDays ?? 28;
  const sorted = params.facts
    .filter((f) => f.metricId === params.metricId)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (sorted.length < Math.min(5, currentDays)) return null;

  const current = lastNDays(sorted, currentDays);
  const baseline = previousNDays(sorted, currentDays, baselineDays);
  if (current.length < 3 || baseline.length < 7) return null;

  const currentAverage = average(current.map((f) => f.value));
  const baselineAverage = average(baseline.map((f) => f.value));
  if (!Number.isFinite(currentAverage) || !Number.isFinite(baselineAverage) || baselineAverage === 0) return null;

  const delta = currentAverage - baselineAverage;
  const deltaPercent = delta / baselineAverage;
  const absPct = Math.abs(deltaPercent);
  if (absPct < 0.08) return null;

  const direction = delta > 0 ? 'up' : 'down';
  const severity = delta > 0 ? 'positive' : 'attention';
  const roundedCurrent = niceNumber(currentAverage);
  const roundedBaseline = niceNumber(baselineAverage);
  const pct = Math.round(absPct * 100);

  return {
    id: `${params.metricId}-${currentDays}d-vs-${baselineDays}d-${new Date().toISOString()}`,
    metricId: params.metricId,
    type: 'trend',
    severity,
    title: `${params.metricLabel} is ${direction}`,
    body: `You averaged ${roundedCurrent} ${params.unit} over the last ${currentDays} days, ${pct}% ${direction} from your ${baselineDays}-day baseline of ${roundedBaseline}.`,
    evidence: {
      currentWindow: {
        start: current[0].date,
        end: current[current.length - 1].date,
        value: currentAverage,
        unit: params.unit,
      },
      baselineWindow: {
        start: baseline[0].date,
        end: baseline[baseline.length - 1].date,
        value: baselineAverage,
        unit: params.unit,
      },
      delta,
      deltaPercent,
      sampleCount: current.length + baseline.length,
      confidence: current.length >= currentDays && baseline.length >= baselineDays ? 'high' : 'medium',
    },
    suggestedAction: {
      label: `View ${params.metricLabel.toLowerCase()} trend`,
      route: `/metrics/${params.metricId}`,
    },
    createdAt: now.toISOString(),
  };
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function niceNumber(value: number) {
  if (Math.abs(value) >= 1000) return Math.round(value).toLocaleString();
  if (Math.abs(value) >= 10) return Math.round(value).toString();
  return value.toFixed(1);
}

function lastNDays(facts: DailyFact[], days: number) {
  return facts.slice(-days);
}

function previousNDays(facts: DailyFact[], currentDays: number, baselineDays: number) {
  return facts.slice(Math.max(0, facts.length - currentDays - baselineDays), Math.max(0, facts.length - currentDays));
}
