export type PlatformSource = 'healthkit' | 'health-connect' | 'manual' | 'backend' | 'computed';

export type MetricKind = 'quantity' | 'category' | 'workout' | 'event';

export interface MetricDefinition {
  id: string;
  kind: MetricKind;
  displayName: string;
  unit?: string;
  source: PlatformSource;
  sensitive: boolean;
  category?: string;
}

export interface MetricSample {
  id: string;
  metricId: string;
  value: number | string | boolean;
  unit?: string;
  startDate: string;
  endDate?: string;
  sourceId?: string;
  deviceId?: string;
  metadata?: Record<string, unknown>;
}

export interface DailyFact {
  metricId: string;
  date: string;
  value: number;
  unit: string;
  sampleCount: number;
  confidence: 'low' | 'medium' | 'high';
}

export interface GoalDefinition {
  id: string;
  metricId: string;
  label: string;
  target: number;
  unit: string;
  cadence: 'daily' | 'weekly' | 'monthly';
  schedule?: Record<string, number>;
}

export interface RingDefinition {
  id: string;
  goalId: string;
  label: string;
  colorToken: string;
  order: number;
  supportsOverflow: boolean;
}

export interface RingProgress {
  ringId: string;
  label: string;
  value: number;
  goal: number;
  unit: string;
  progress: number;
  completed: boolean;
  overflowLaps: number;
  remainder: number;
  colorToken: string;
}

export interface WatchDailySnapshot {
  schemaVersion: 1;
  generatedAt: string;
  date: string;
  rings: Array<{
    id: string;
    label: string;
    value: number;
    goal: number;
    unit: string;
    progress: number;
    colorHex: string;
  }>;
  nextAction?: {
    id: string;
    title: string;
    action: 'open-phone' | 'log-event' | 'start-workout' | 'adjust-goal';
  };
  latestAward?: {
    id: string;
    title: string;
    earnedAt: string;
  };
}
