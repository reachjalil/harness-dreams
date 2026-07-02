# 05 — Research Method

Research date: 2026-06-28.

The reference pack was built by checking official Apple documentation, current React Native health integrations, Apple Watch connectivity libraries, open-source app examples, charting libraries, animation libraries, and Android parity options.

## Selection criteria

Each source was scored against:

- **Relevance** — Does it map directly to Apple Health, Apple Fitness, rings, badges, HealthKit, Watch, or RN implementation?
- **Modernity** — Does it support recent React Native, Expo, TypeScript, SwiftUI, HealthKit, or Health Connect patterns?
- **Implementation value** — Does it contain code, APIs, or architectural patterns that can be reused?
- **Maintainability** — Is it active, documented, or at least valuable as a focused reference?
- **Risk** — Does it have API limitations, stale dependencies, old architecture issues, or licensing/brand constraints?

## Result

There are few complete, modern, open-source React Native apps that literally clone Apple Health with rings, badges, recommendations, HealthKit, and Apple Watch. The better approach is to reference the best source for each subsystem and compose your own product-quality implementation.

## Source categories

1. **Official Apple sources** for HealthKit, Health app behavior, Apple Fitness/Activity behavior, visual design, typography, colors, SF Symbols, and legal badge guidance.
2. **React Native HealthKit libraries** for data access.
3. **React Native + WatchConnectivity libraries** for iPhone/watch communication.
4. **Open-source full apps** for local-first architecture, workout flows, achievements, and analytics.
5. **Visual libraries** for rings, charts, animations, and advanced graphics.
6. **Android parity libraries** for Health Connect.
7. **Backend/wearable normalization references** for later multi-provider expansion.

## What to avoid

- One-off clone repositories with no HealthKit integration, no maintenance, no TypeScript, or only screenshots.
- UI-only components that cannot represent overflow, accessibility, or large histories.
- Experimental React Native watchOS runtimes for production use.
- Copying Apple assets, badges, exact copy, or app screenshots.
