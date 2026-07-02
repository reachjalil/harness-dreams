import Dexie, { Table } from 'dexie';
import type { DataSource, MetricDefinition, Sample } from './models';

export class HealthDexieDatabase extends Dexie {
  metrics!: Table<MetricDefinition, string>;
  samples!: Table<Sample, string>;
  sources!: Table<DataSource, string>;

  constructor() {
    super('health-pattern-dashboard');
    this.version(1).stores({
      metrics: 'id, category, sourceType',
      samples: 'id, metricId, sourceId, startAt, [metricId+startAt]',
      sources: 'id, kind, importedAt',
    });
  }
}

export const db = new HealthDexieDatabase();

export async function deleteSourceAndDerivedSamples(sourceId: string) {
  await db.transaction('rw', db.sources, db.samples, async () => {
    await db.samples.where('sourceId').equals(sourceId).delete();
    await db.sources.delete(sourceId);
  });
  // Derived trends/badges/insights should be invalidated and recomputed after this.
}
