# Apple Health Clone React Native Skill

This package is a research-backed skill for building **Apple Health / Apple Fitness-inspired iOS and Apple Watch experiences** with a React Native iPhone app and a native Swift/SwiftUI Apple Watch companion.

The package is intentionally framed as an **inspired design-system and architecture skill**, not a literal Apple clone. Use Apple's publicly documented design and product patterns as references, but do not copy Apple-owned assets, private UI artwork, exact marketing language, proprietary icons, or imply Apple affiliation.

## Install into a skills library

```bash
unzip apple-health-clone-react-native-skill.zip
cp -R apple-health-clone-react-native-skill .skills/
```

## What is inside

- `SKILL.md` — routing metadata, workflow, quality gates, and reference map.
- `reference/` — detailed implementation docs for HealthKit, rings, badges, recommendations, Watch, charts, design tokens, privacy, and roadmap.
- `examples/` — starter TypeScript/Swift patterns for rings, badge logic, recommendation logic, HealthKit adapters, WatchConnectivity, design tokens, and navigation.
- `research/source-catalog.json` — current source catalog with URLs and rationale.
- `research/repo-scorecard.csv` — curated repo comparison by aspect.
- `SOURCES.md` — human-readable source guide.
- `SKILL_REPORT.md` — packaging report and validation notes.

## Core architecture rule

Build the iPhone experience in React Native. Build the Apple Watch companion in Swift/SwiftUI and connect it to the iPhone app with WatchConnectivity. Do not plan on writing the watch app itself in React Native unless you are explicitly doing experimental research.

## Highest-value references

- Primary modern HealthKit bridge: `@kingstinct/react-native-healthkit`.
- Established HealthKit fallback/reference: `agencyenterprise/react-native-health`.
- Watch bridge: `watch-connectivity/react-native-watch-connectivity`.
- Full modern RN app reference: `skulptapp/skulpt`.
- Ring component reference: `thecodehunter/react-native-activity-rings`, but use a custom Skia renderer for production-quality overflow rings.
- Charts: `victory-native-xl` plus React Native Skia.
- Android parity: `matinzd/react-native-health-connect`.

## Read order

1. `reference/00-overview.md`
2. `reference/10-open-source-reference-map.md`
3. `reference/20-apple-health-information-architecture.md`
4. `reference/30-react-native-architecture.md`
5. `reference/40-healthkit-data-layer.md`
6. `reference/50-activity-rings-engine.md`
7. `reference/60-awards-badges-streaks.md`
8. `reference/70-recommendation-insights-engine.md`
9. `reference/80-apple-watch-companion-patterns.md`
10. `reference/90-charts-trends-visualization.md`
11. `reference/100-design-system-tokens.md`
12. `reference/110-privacy-compliance-brand.md`
13. `reference/120-implementation-roadmap.md`
14. `reference/130-testing-quality-checklist.md`
15. `reference/140-agent-prompts.md`
