# 40 — HealthKit Data Layer

HealthKit is the user-controlled health data store on iPhone and Apple Watch. Your app must ask for explicit permissions and should only ask for the data types it truly needs.

## Primary library choice

Prefer `@kingstinct/react-native-healthkit` for greenfield React Native apps because it is TypeScript-first, Promise-based, and oriented toward newer RN architecture through Nitro Modules.

Use `react-native-health` when:

- You inherit an app already using it.
- You need an example for a specific method.
- You need a lower-risk community-known package but can tolerate older patterns.

## Adapter interface

Create one interface and implement platform-specific adapters.

```ts
export interface HealthDataAdapter {
  isAvailable(): Promise<boolean>;
  requestAuthorization(request: HealthPermissionRequest): Promise<HealthPermissionResult>;
  readSamples(query: HealthSampleQuery): Promise<MetricSample[]>;
  observe(metricIds: string[], onChange: () => void): Promise<Unsubscribe>;
  writeSample?(sample: MetricSample): Promise<void>;
}
```

## Permission strategy

Bad pattern:

```text
Open app → ask for every permission immediately
```

Better pattern:

```text
Explain value → ask for smallest useful permission set → show partial UI → ask for more permissions at the moment they unlock a feature
```

Example:

- Summary ring app: ask for steps, active energy, workouts only when needed.
- Sleep app: ask for sleep analysis only after user opens sleep setup.
- Nutrition app: ask for dietary energy/macros only after user enables nutrition import.

## Permission copy pattern

Use this structure:

```text
Title: Connect Apple Health
Body: We use your step and workout data to calculate your daily progress ring and weekly trends. You can change access any time in the Health app.
Primary: Continue
Secondary: Not now
```

Never say the app needs “Apple Health data.” Say exactly what you read and why.

## Background delivery

For HealthKit-backed apps, background updates are possible but should be treated as opportunistic. Always refresh when the app becomes active.

Recommended strategy:

1. Register observers for important metric types.
2. On observer callback, enqueue a refresh job.
3. Re-query the affected date range.
4. Deduplicate samples by source/device/time/metadata.
5. Recompute daily facts, trends, rings, and awards.
6. Push compact updates to Watch.

## Deduplication

Apple Watch and iPhone can both produce samples. Avoid double counting.

Deduping inputs:

- sample UUID where available.
- source bundle identifier.
- device identifier.
- start/end time.
- quantity/unit.
- metadata sync identifiers.

Keep raw samples if legally/product-wise needed, but compute display values from normalized aggregates.

## Data provenance UI

Metric detail pages should include:

- Source apps/devices.
- Last updated time.
- Permission status.
- Manual edit/delete flow if your app writes data.
- Explanation of computed metrics.

## HealthKit write caution

Writing into HealthKit is higher trust than reading. Only write if:

- The user explicitly logged or created the data.
- You label the source clearly.
- You support delete/update flows.
- You do not write inferred or speculative values as factual samples.

## Cross-platform abstraction

Use one app domain model:

```text
HealthKit HKQuantitySample  → MetricSample
Health Connect StepsRecord  → MetricSample
Manual hydration entry      → MetricSample
Backend wearable sample     → MetricSample
```

This keeps your rings, badges, and recommendations platform-agnostic.
