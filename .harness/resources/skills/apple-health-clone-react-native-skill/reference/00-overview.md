# 00 — Overview

This skill turns Apple Health, Apple Fitness, and Activity Rings into a reusable product pattern for React Native teams.

The goal is not a literal clone. The goal is to understand the **interaction model**:

1. A calm daily summary.
2. A small number of user-chosen favorite metrics.
3. Rings or goal cards that communicate progress instantly.
4. Highlights that surface relevant recent changes.
5. Trends that compare recent behavior against a longer baseline.
6. Detail pages that let users drill into days, weeks, months, and years.
7. Achievements that reward consistency without hiding the underlying data.
8. Apple Watch screens that are extremely focused and glanceable.
9. Privacy-first permission UX.

## Core recommendation

Use this architecture:

```text
React Native iPhone app
  ├─ Expo or bare RN shell
  ├─ HealthKit adapter
  ├─ local database/cache
  ├─ rings, cards, charts, awards, recommendations
  └─ WatchConnectivity bridge

Native Swift/SwiftUI Apple Watch app
  ├─ daily rings
  ├─ current goal/workout state
  ├─ compact history
  ├─ haptics
  └─ WCSession sync

Optional Android app
  └─ Health Connect adapter behind the same data contracts
```

## Why not full React Native on Apple Watch?

The strongest practical pattern in 2026 remains: write the watchOS app in Swift/SwiftUI and communicate with React Native on iPhone. Some experimental watchOS React Native projects exist, but the stable production path is a native Watch app plus WatchConnectivity.

## Best reference per subsystem

| Subsystem | Primary reference | Use it for | Caution |
| --- | --- | --- | --- |
| HealthKit RN bridge | `@kingstinct/react-native-healthkit` | Modern TypeScript, Nitro Modules, Expo plugin | Test RN/Nitro version compatibility |
| HealthKit established package | `react-native-health` | Legacy code, permission caveats, broad method examples | Older callback/bridge patterns and open issues |
| Watch bridge | `react-native-watch-connectivity` | RN iPhone ↔ Swift watch messages/context | Does not write watch app in RN |
| Full app architecture | `skulptapp/skulpt` | RN, Expo, local-first, HealthKit, Health Connect, Apple Watch, Live Activity | Validate exact implementation before copying patterns |
| Rings UI reference | `react-native-activity-rings` | Props, theming, visual baseline | Does not fully support Apple-style >100% overflow behavior |
| Custom rings | React Native Skia | Smooth arcs, gradients, caps, overflow, shaders | Requires graphics/math ownership |
| Charts | Victory Native XL | D3 + Skia + Reanimated charts for trends | Needs careful layout/performance testing |
| Android parity | `react-native-health-connect` | Android Health Connect adapter | Play declaration and Android version caveats |

## Skill design principles

- Build a reusable **pattern**, not a one-off health app.
- Model everything as metrics, samples, goals, rings, awards, trends, and recommendations.
- Keep HealthKit/Health Connect behind adapters.
- Keep Apple Watch native.
- Treat privacy as a product feature, not a settings page.
- Separate Apple-inspired layout from Apple-owned brand assets.
