# 120 — Implementation Roadmap

## Phase 0 — Product mapping

Deliverables:

- Use case definition.
- Metric taxonomy.
- Permission list.
- Ring definitions.
- Badge categories.
- Recommendation examples.
- Privacy model.

Exit gate:

- Every screen maps to a data primitive.
- No Apple-owned assets are required.

## Phase 1 — App shell and design tokens

Build:

- Expo/RN app shell.
- Native stack and tabs.
- Design tokens.
- Card components.
- Dark mode.
- Dynamic Type testing.

Exit gate:

- Static Summary, Browse, Awards, Settings, and Detail screens render from mock data.

## Phase 2 — Ring engine

Build:

- Ring math.
- Skia renderer.
- Generic ring model.
- Overflow support.
- Reduced Motion fallback.
- VoiceOver labels.

Exit gate:

- Same ring component works for fitness, learning, and productivity examples.

## Phase 3 — Local data model

Build:

- Metric definitions.
- Sample storage.
- Daily aggregation.
- Goal storage.
- Snapshot generation.

Exit gate:

- Mock and manual data produce real summary, trends, rings, and badges.

## Phase 4 — HealthKit integration

Build:

- HealthDataAdapter.
- Permission explainer.
- Authorization flow.
- Read queries.
- Observers/background refresh.
- Deduplication.

Exit gate:

- Real HealthKit data populates Summary and Detail pages on a physical device.

## Phase 5 — Charts and trends

Build:

- Detail charts.
- Trend cards.
- Baseline comparisons.
- Chart accessibility summaries.

Exit gate:

- Users can understand the main trend without reading the chart axis.

## Phase 6 — Awards and recommendations

Build:

- Rule engine.
- Earned badge storage.
- Challenge generator.
- Insight engine.
- Dismiss/feedback.

Exit gate:

- Badge and recommendation outputs are replayable from data history.

## Phase 7 — Apple Watch companion

Build:

- SwiftUI Watch app.
- Rings glance.
- Goal detail.
- Log action.
- WatchConnectivity bridge.
- Offline last-known snapshot.

Exit gate:

- Watch displays current daily snapshot and sends actions back to phone.

## Phase 8 — Optional widgets / Live Activities

Build only when product value is clear:

- Lock Screen widget for current progress.
- Home Screen widget for rings/streak.
- Live Activity for an active session/workout/focus block.

Exit gate:

- Widget data is privacy-safe and useful without opening the app.

## Phase 9 — Android parity

Build:

- Health Connect adapter.
- Android permission flow.
- Platform capability matrix.
- Shared domain model.

Exit gate:

- Core rings and charts work from HealthKit, Health Connect, and manual data.

## Phase 10 — Release hardening

Build/test:

- App review notes.
- Privacy policy.
- Data export/delete.
- Accessibility pass.
- Real device sync tests.
- Background refresh tests.
- Watch battery sanity.
- Crash and analytics redaction.

Exit gate:

- No health data appears in logs, crash breadcrumbs, or analytics payloads.
