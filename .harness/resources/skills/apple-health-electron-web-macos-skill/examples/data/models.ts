export interface MetricDefinition {
  id: string;
  sourceType: string;
  label: string;
  category: string;
  unit: string;
  valueKind: 'quantity' | 'category' | 'duration' | 'event';
  aggregation: 'sum' | 'avg' | 'min' | 'max' | 'latest' | 'count';
}

export interface Sample {
  id: string;
  metricId: string;
  value: number | string | boolean;
  unit?: string;
  startAt: string;
  endAt?: string;
  sourceId: string;
  metadata?: Record<string, unknown>;
}

export interface DataSource {
  id: string;
  kind: 'apple-health-export' | 'csv' | 'json' | 'manual' | 'api' | 'demo';
  label: string;
  importedAt: string;
  recordCount: number;
  localOnly: boolean;
}

export interface ImportJob {
  id: string;
  sourceId?: string;
  status: 'queued' | 'parsing' | 'normalizing' | 'saving' | 'complete' | 'failed' | 'cancelled';
  progress: number;
  message?: string;
  error?: string;
}
