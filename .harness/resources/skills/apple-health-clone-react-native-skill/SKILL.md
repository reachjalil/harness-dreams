---
name: apple-health-clone-react-native-skill
description: Use when building Apple Health/Fitness-inspired iOS and Apple Watch dashboards in React Native. Do NOT use to copy Apple assets or imply Apple affiliation.
---

# Apple Health Clone React Native Skill

## When to Use

Use this skill when the user wants to build a polished health, fitness, habit, productivity, learning, recovery, or quantified-self app that follows the **patterns** of Apple Health, Apple Fitness, and Activity Rings.

Use it for:

- React Native iOS apps that read from or write to HealthKit.
- Apple Watch companion apps that synchronize daily progress, goals, and workouts.
- Ring-based dashboards for arbitrary use cases, not only Move/Exercise/Stand.
- Badge, award, streak, milestone, and challenge systems.
- Health-style trends, highlights, recommendations, and metric detail pages.
- Android parity planning through Health Connect.

Do **not** use this skill to:

- Copy Apple-owned artwork, Health icons, badges, app screenshots, layouts pixel-for-pixel, or proprietary animations.
- Claim Apple endorsement or affiliation.
- Store, transmit, or analyze health data without explicit user consent and data minimization.
- Build medical diagnosis features without clinical, regulatory, privacy, and legal review.
- Treat React Native as the watchOS app runtime for production. The watch app should normally be native Swift/SwiftUI.

## Inputs

Collect as many of these as possible:

- Target use case: fitness, sleep, wellness, learning, productivity, nutrition, hydration, recovery, therapy, coaching, or another domain.
- Platforms: iPhone only, iPhone + Apple Watch, iOS + Android parity, widgets, Live Activities, complications.
- Data sources: HealthKit, app-created data, wearable APIs, Health Connect, manual logs, backend sync.
- Metrics: daily goals, interval samples, category samples, workouts, nutrition, sleep, mood, habits.
- Branding constraints: Apple-like, brand-forward, dark mode, accessibility level, localization.
- Privacy constraints: on-device only, cloud sync, HIPAA/GDPR/clinical review, user export/delete.

## Outputs

Produce concrete implementation guidance:

- Architecture recommendation with iPhone RN, native Watch, HealthKit adapter, sync model, and storage.
- Reference map: best repo/source per subsystem.
- Screen breakdown: Summary, Browse, metric detail, trends, awards, settings, permission flow, watch screens.
- Component plan: rings, cards, charts, badges, timelines, recommendation cards, empty states.
- Data contracts: metric, sample, goal, ring, badge, trend, insight, recommendation.
- Implementation roadmap with milestones and quality gates.
- Safety/privacy checklist and Apple brand compliance notes.

## Workflow

1. **Map the use case to health primitives.** Convert domain goals into `Metric`, `Sample`, `Goal`, `Ring`, `Badge`, `Trend`, and `Recommendation` primitives. Avoid hardcoding Move/Exercise/Stand unless the product is literally a fitness app.

2. **Pick the platform architecture.** Use React Native for the iPhone app. Use Swift/SwiftUI for Apple Watch. Use WatchConnectivity for phone-watch state transfer. Use native widgets and Live Activities only for glanceable, time-sensitive data.

3. **Select HealthKit strategy.** Prefer `@kingstinct/react-native-healthkit` for modern TypeScript/Nitro/Expo workflows. Use `react-native-health` as an established fallback or migration reference. Abstract both behind a project-owned `HealthDataAdapter`.

4. **Design the UI system.** Follow Apple platform conventions: semantic color tokens, Dynamic Type, dark mode, large-number hierarchy, cards, concise labels, accessible tap targets, and progressive disclosure. Do not copy Apple artwork.

5. **Build the ring engine.** Implement generic rings from `goal`, `progress`, `unit`, `color`, `schedule`, and `history`. Support overflow beyond 100%, rounded caps, staged animation, reduced motion, and text alternatives.

6. **Build badge and challenge logic.** Store achievements as rules over normalized daily facts. Support first-time badges, streaks, perfect weeks, monthly challenges, personal records, and special events.

7. **Build recommendations.** Use an observe → compare → explain → suggest → deep-link pattern. Prefer transparent, verifiable insights over vague wellness advice.

8. **Implement detail pages and charts.** Use summary cards for overview and drill down into daily, weekly, monthly, and yearly history. Use Victory Native XL for common charts and Skia for custom ring/chip visuals.

9. **Harden privacy and sync.** Request the minimum HealthKit permissions, explain value before authorization, handle partial grants, deduplicate iPhone/watch samples, and keep sensitive data on-device unless cloud sync is clearly consented.

10. **Validate on devices.** Test on a real iPhone and Apple Watch for HealthKit permissions, background delivery, WatchConnectivity reachability, dark mode, large text, reduced motion, and offline behavior.

## Quality Checklist

- The design is Apple-platform-native in feel but does not copy Apple-owned assets.
- `SKILL.md` has frontmatter, `Use when`, and `Do NOT use` routing language.
- Every external repo has a stated purpose, confidence level, and caution.
- The watchOS path is native Swift/SwiftUI, not React Native-only.
- HealthKit and Health Connect sit behind adapters rather than leaking library APIs everywhere.
- Ring logic supports arbitrary domains and overflow progress above 100%.
- Badges are rule-driven and replayable from history.
- Recommendations are explainable and traceable to data.
- Permission requests are granular and preceded by user-facing rationale.
- The app works in dark mode, Dynamic Type, Reduced Motion, VoiceOver, and offline mode.

## References

Read the reference pack in this order:

- `reference/00-overview.md`
- `reference/05-research-method.md`
- `reference/10-open-source-reference-map.md`
- `reference/20-apple-health-information-architecture.md`
- `reference/30-react-native-architecture.md`
- `reference/40-healthkit-data-layer.md`
- `reference/50-activity-rings-engine.md`
- `reference/60-awards-badges-streaks.md`
- `reference/70-recommendation-insights-engine.md`
- `reference/80-apple-watch-companion-patterns.md`
- `reference/90-charts-trends-visualization.md`
- `reference/100-design-system-tokens.md`
- `reference/110-privacy-compliance-brand.md`
- `reference/120-implementation-roadmap.md`
- `reference/130-testing-quality-checklist.md`
- `reference/140-agent-prompts.md`

Source catalog:

- `SOURCES.md`
- `research/source-catalog.json`
- `research/repo-scorecard.csv`
