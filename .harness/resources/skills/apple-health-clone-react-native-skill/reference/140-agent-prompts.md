# 140 — Agent Prompts

Use these prompts with an implementation agent after loading this skill.

## Prompt: create app architecture

```text
Using apple-health-clone-react-native-skill, design the architecture for a React Native iOS app with a SwiftUI Apple Watch companion. The app tracks [DOMAIN]. It needs rings for [RINGS], badges for [BADGES], and recommendations for [RECOMMENDATIONS]. Use HealthKit only for [DATA TYPES]. Produce folders, data contracts, libraries, and milestones.
```

## Prompt: design rings

```text
Using reference/50-activity-rings-engine.md, create a generic ring system for [DOMAIN]. It must support overflow above 100%, reduced motion, VoiceOver labels, dark mode, and Watch-sized rendering. Include TypeScript types and a Skia component skeleton.
```

## Prompt: HealthKit adapter

```text
Using reference/40-healthkit-data-layer.md, implement a HealthDataAdapter for @kingstinct/react-native-healthkit. Required metrics: [METRICS]. Include permission request flow, sample normalization, background refresh strategy, and deduplication notes.
```

## Prompt: badges

```text
Using reference/60-awards-badges-streaks.md, create a data-driven badge engine for [DOMAIN]. Include first-time, streak, perfect-week, milestone, record, and monthly challenge badges. Rules must be replayable from daily facts.
```

## Prompt: recommendations

```text
Using reference/70-recommendation-insights-engine.md, generate explainable recommendation cards from these aggregates: [AGGREGATES]. Avoid medical or diagnostic language. Each card needs title, body, evidence, confidence, and action.
```

## Prompt: Watch companion

```text
Using reference/80-apple-watch-companion-patterns.md, design the SwiftUI Apple Watch companion for [DOMAIN]. Include WatchDailySnapshot, WCSession sync channels, screens, offline behavior, and action reconciliation.
```

## Prompt: clone safety review

```text
Review this design for Apple brand and privacy risk using reference/110-privacy-compliance-brand.md. Identify copied assets, problematic terminology, weak permission rationale, privacy risks, and App Review concerns. Return a prioritized fix list.
```

## Prompt: implementation roadmap

```text
Using reference/120-implementation-roadmap.md, turn this concept into a 10-phase implementation plan with deliverables, exit gates, and test coverage. The team uses Expo, TypeScript, SwiftUI watchOS, and HealthKit.
```
