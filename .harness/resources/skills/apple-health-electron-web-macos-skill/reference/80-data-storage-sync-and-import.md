# Data Storage, Sync, and Import

Health-style desktop/web apps are data apps first. Storage and import architecture must be chosen before UI polish.

## Data source options

| Source | Desktop/web approach | Notes |
| --- | --- | --- |
| Apple Health export XML | User exports from Health app and imports ZIP/XML | Good for local-first desktop analysis |
| CSV/JSON from mobile app | Import or sync through backend | Easier than XML; define schema |
| Mobile HealthKit bridge | iOS app reads HealthKit and syncs to backend/local network | Requires iOS app and explicit HealthKit permissions |
| Wearable API | OAuth/server sync | Store tokens securely; follow provider policy |
| Manual logs | Web/Electron forms | Good fallback for non-health domains |
| Synthetic/demo data | Bundled local JSON | Use for onboarding and QA only |

## Apple Health export workflow

Desktop import flow:

1. User chooses `export.zip`, `export.xml`, CSV, or JSON.
2. App shows privacy notice: data stays local unless user enables sync.
3. Import worker validates file type and size.
4. Parser streams/chunks records.
5. Normalizer maps records to `Sample` and `MetricDefinition`.
6. App stores source provenance.
7. Summary refreshes and displays import result.
8. User can delete import source and all derived samples.

## Domain data contracts

```ts
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
```

## Storage options

### Dexie / IndexedDB

Best for:

- shared browser/Electron renderer storage;
- offline-first state;
- moderate sample volume;
- quick prototyping;
- PWA compatibility.

Caution:

- chunk large imports;
- avoid blocking main thread;
- use versioned migrations;
- back up/export before destructive migrations.

### PGlite

Best for:

- SQL-like local analytics;
- browser/Electron parity;
- larger normalized datasets;
- teams comfortable with relational queries.

Caution:

- validate bundle/startup costs;
- persistence behavior differs by runtime;
- use workers where possible.

### SQLite / better-sqlite3

Best for:

- Electron-only heavy local desktop analytics;
- large import files;
- reporting and joins.

Caution:

- native modules complicate packaging;
- avoid synchronous DB work on UI/main process;
- use worker/utility process;
- validate arm64/x64 builds.

### TanStack Query persistence

Best for:

- caching remote/source API data;
- offline retry and paused mutations;
- sync status UI.

Caution:

- query cache is not the canonical local health record store;
- don't store sensitive secrets in query cache.

## Secure storage

Use Electron safeStorage for secrets/tokens, not bulk health samples.

Good uses:

- OAuth refresh tokens;
- sync endpoint secrets;
- encrypted local database key if you implement one carefully.

Bad uses:

- entire health dataset;
- large import files;
- chart cache.

## Sync model

Recommended sync states:

```ts
export type SyncState =
  | 'local-only'
  | 'not-configured'
  | 'syncing'
  | 'synced'
  | 'paused-offline'
  | 'conflict'
  | 'error';
```

Every screen should expose source/provenance for sensitive metrics.

## Import performance

- Parse large XML files in a worker/utility process.
- Batch writes in chunks.
- Show progress and cancellation.
- Store source hash to detect duplicate imports.
- Normalize units at import time.
- Keep raw import optional and deletable.

## Data deletion

Privacy-friendly deletion must include:

- delete a source import;
- delete all samples from a source;
- clear derived trends/insights/badges and recompute;
- export user data;
- local database reset;
- cloud delete request if sync is enabled.
