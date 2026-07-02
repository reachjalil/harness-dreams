# 30 — React Native Architecture

## Recommended stack

For a new app:

```text
Expo + React Native
  ├─ Expo Router for navigation
  ├─ Development build / EAS for native HealthKit capabilities
  ├─ @kingstinct/react-native-healthkit for iOS HealthKit
  ├─ react-native-health-connect for Android parity
  ├─ SQLite/WatermelonDB/Drizzle/local DB for samples + derived facts
  ├─ Zustand/Jotai/Redux Toolkit for UI state
  ├─ React Query/TanStack Query for async data orchestration
  ├─ React Native Skia for rings/custom visuals
  ├─ Victory Native XL for charts
  ├─ Reanimated for motion
  └─ native Swift/SwiftUI Watch target
```

## Layering

Use clear boundaries:

```text
app/
  screens/           # Summary, Browse, Awards, Settings, Detail
  components/        # Rings, Cards, Charts, Badges, Permission UI
  features/
    rings/
    awards/
    recommendations/
    healthkit/
    watch/
    trends/
  domain/            # Metric, Sample, Goal, Badge, Trend models
  adapters/
    healthkit/
    healthConnect/
    watchConnectivity/
  storage/
  theme/
```

## Domain models

Create project-owned models before wiring libraries:

```ts
export type MetricKind = 'quantity' | 'category' | 'workout' | 'event';

export interface MetricDefinition {
  id: string;
  kind: MetricKind;
  displayName: string;
  unit?: string;
  source: 'healthkit' | 'health-connect' | 'manual' | 'backend' | 'computed';
  sensitive: boolean;
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
```

## Navigation shell

Use iOS-native-feeling navigation:

- Native stack for push transitions.
- Large titles on top-level screens.
- Native tabs where available and stable for your Expo SDK.
- Modal sheets for permissions, goal editing, and badge detail.
- Avoid custom tab bars unless native tabs cannot support the product.

## State model

Separate:

- `Raw samples` — HealthKit/Health Connect/manual imports.
- `Daily facts` — normalized facts by day and metric.
- `Goals` — target and schedule.
- `Derived progress` — percent, delta, streak, comparison.
- `Insights` — explainable generated cards.
- `UI state` — selected time range, expanded sections, hidden cards.

## Data flow

```text
HealthKit / Health Connect / Manual log
  ↓
Adapter-specific read/query
  ↓
Normalize into MetricSample
  ↓
Persist/cache locally
  ↓
Derive DailyFact and Trend
  ↓
Render Summary / Detail / Rings / Awards
  ↓
Sync compact state to Watch
```

## Versioning strategy

Store app-owned data contracts with version numbers:

```ts
export interface LocalSnapshotV1 {
  schemaVersion: 1;
  generatedAt: string;
  metrics: MetricDefinition[];
  samples: MetricSample[];
  goals: GoalDefinition[];
}
```

## Why adapters matter

Do not scatter HealthKit API calls across components. A future switch from `react-native-health` to `@kingstinct/react-native-healthkit`, or the addition of Health Connect, should not rewrite UI screens.
