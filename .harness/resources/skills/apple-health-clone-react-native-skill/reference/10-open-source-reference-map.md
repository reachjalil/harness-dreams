# 10 — Open Source Reference Map

Use this as the source-of-truth for deciding which repo to inspect for each part of the build.

## Primary references

### 1. `kingstinct/react-native-healthkit`

**Use for:** modern HealthKit bridge.

Why it matters:

- TypeScript-first API.
- Promise-based calls.
- Nitro Modules architecture.
- Expo plugin support.
- Good fit for a new RN app where HealthKit is core.

Implementation guidance:

- Wrap it behind `HealthDataAdapter` immediately.
- Keep raw library types at the edge of the app.
- Normalize HealthKit quantities, categories, workouts, and correlations into project-owned domain models.
- Test exact versions of React Native, Expo, Nitro Modules, Xcode, iOS, and watchOS together.

### 2. `agencyenterprise/react-native-health`

**Use for:** established HealthKit surface and legacy compatibility.

Why it matters:

- Longstanding React Native HealthKit package.
- Many examples and issue discussions.
- Useful as a migration and edge-case reference.

Cautions:

- It has older bridge/callback patterns in places.
- Permission behavior must be handled carefully: users who deny access may need to change permissions in the Health app rather than seeing the same prompt again.
- Check New Architecture compatibility before choosing it for a greenfield app.

### 3. `watch-connectivity/react-native-watch-connectivity`

**Use for:** iPhone RN app ↔ native watchOS app communication.

Why it matters:

- Explicitly designed for React Native apps communicating with Apple Watch apps.
- Supports WatchConnectivity concepts like application context, messages, and transfers.

Hard rule:

- It does not let you write the watch app in React Native. The watch app is Swift/SwiftUI or Objective-C.

### 4. `skulptapp/skulpt`

**Use for:** full app architecture inspiration.

Why it matters:

- React Native + Expo.
- Local-first app structure.
- HealthKit and Health Connect references.
- Apple Watch and Live Activity support.
- Good source for how a modern app stitches together multiple health-adjacent features.

Caution:

- Treat it as an architecture reference, not a UI clone source.

### 5. `thecodehunter/react-native-activity-rings`

**Use for:** ring component API ideas.

Why it matters:

- Simple React Native activity ring component.
- Useful for props shape, theming, and quick prototypes.

Caution:

- It is not enough for a production Apple-style activity-ring engine because Apple-style rings need overflow laps, nuanced caps, multiple animation states, accessibility labels, history, and haptic/Watch behavior.

### 6. `FormidableLabs/victory-native-xl`

**Use for:** health charts.

Why it matters:

- High-performance React Native charting.
- Uses D3, Skia, and Reanimated.
- Suitable for Health-style trends, bars, lines, press states, and compact cards.

### 7. React Native Skia

**Use for:** custom rings and special visuals.

Why it matters:

- Custom arcs, rounded caps, gradients, masks, shaders, and performant rendering.
- Better fit than a generic progress component for rings that need Apple-like polish.

### 8. React Native Reanimated

**Use for:** motion system.

Why it matters:

- Ring interpolation.
- Rolling numbers.
- Card expansion.
- Gesture-linked chart scrubbing.
- Badge unlock animations.

Caution:

- Shared element transitions are still an area to test carefully before production use.

### 9. `matinzd/react-native-health-connect`

**Use for:** Android parity.

Why it matters:

- Health Connect is the Android ecosystem path for unified health and fitness data.
- Keeps your app architecture from being iOS-only.

### 10. `the-momentum/open-wearables`

**Use for:** future multi-provider sync.

Why it matters:

- Useful when your app needs Garmin, Fitbit, Oura, Withings, or other sources beyond phone-native stores.
- Inspires a normalized backend data model.

## Useful secondary references

### `Haider-Mukhtar/ReactNative-Apple-Health-IOS`

Use for Expo + TypeScript HealthKit onboarding with `react-native-health`.

### `RuochenLyu/apple-health-analyst`

Use for insight and report generation patterns over Apple Health exports/data.

### `Janjiran/react-native-workouts`

Use for a WorkoutKit spike. Treat as experimental until validated in your app versions.

### `msimms/OpenWorkoutTracker`

Use for native iOS/watchOS workout and SwiftUI watch architecture.

### `JanSzewczyk/workout-tracker`

Use for achievements, dashboards, progress pages, offline-first concepts, and gamification references.
