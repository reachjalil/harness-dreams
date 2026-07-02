# Sources and Reference Rationale

Research date: 2026-06-28.

This file lists the online sources used to build the skill. The project should re-check these before major implementation work because React Native, Expo, Xcode, watchOS, and HealthKit libraries change quickly.

| Aspect | Source | Type | Why it matters | URL |
| --- | --- | --- | --- | --- |
| Apple HealthKit official data model | Apple Developer Documentation: HealthKit | official-docs | Defines HealthKit as the central health and fitness data repository on iPhone and Apple Watch, gated by user permission. | https://developer.apple.com/documentation/healthkit |
| HealthKit privacy | Apple Developer Documentation: Protecting user privacy | official-docs | Canonical source for explicit per-type authorization and privacy messaging. | https://developer.apple.com/documentation/healthkit/protecting-user-privacy |
| Apple Health UI information architecture | Apple Support: View your data in Health on iPhone | official-support | Documents Summary, Highlights, Trends, and drill-down behavior in the Health app. | https://support.apple.com/guide/iphone/view-your-health-data-iphe3d379c32/ios |
| Activity rings semantics | Apple Watch - Close Your Rings | official-product | Defines the public meaning of Move, Exercise, and Stand rings. | https://www.apple.com/watch/close-your-rings/ |
| Activity app behavior | Apple Support: Track daily activity with Apple Watch | official-support | Explains the daily ring habit model: sit less, move more, get exercise, close rings. | https://support.apple.com/guide/watch/track-daily-activity-apd3bf6d85a6/watchos |
| Apple Fitness app IA | Apple Support: View activity, workouts, trends, and awards in Fitness | official-support | Documents Summary, activity rings, trends, workouts, meditations, and awards structure. | https://support.apple.com/guide/iphone/view-activity-workouts-trends-awards-iph38f7f7ebe/ios |
| HealthKit HIG and Apple Health badge | Apple Human Interface Guidelines: HealthKit | official-design | Guidance for HealthKit-related UI, Apple Health icon usage, terminology, and privacy. | https://developer.apple.com/design/human-interface-guidelines/healthkit/ |
| Works with Apple Health badge | Apple Licensing and Trademarks: Works with Apple Health | official-legal-design | Rules for badge use, subordinate placement, social media restrictions, and terminology. | https://developer.apple.com/licensing-trademarks/works-with-apple-health/ |
| Apple visual language | Apple Human Interface Guidelines: Color | official-design | System colors adapt across appearance modes and accessibility settings. | https://developer.apple.com/design/human-interface-guidelines/color |
| Apple visual language | Apple Human Interface Guidelines: Typography | official-design | System type, legibility, hierarchy, and Dynamic Type guidance. | https://developer.apple.com/design/human-interface-guidelines/typography |
| Apple symbols | SF Symbols | official-design-tool | Native symbol system aligned with San Francisco; use through platform APIs, do not bundle Apple font files. | https://developer.apple.com/sf-symbols/ |
| Modern React Native HealthKit | kingstinct/react-native-healthkit | open-source-library | Modern, TypeScript-first HealthKit bindings with Promise API, Nitro Modules, hooks, and Expo plugin. | https://github.com/kingstinct/react-native-healthkit |
| Established React Native HealthKit | agencyenterprise/react-native-health | open-source-library | Established React Native HealthKit package with large community footprint and many examples; use as compatibility reference. | https://github.com/agencyenterprise/react-native-health |
| Expo HealthKit sample | Haider-Mukhtar/ReactNative-Apple-Health-IOS | open-source-sample-app | Expo + TypeScript sample using react-native-health for common metrics and hook-based data fetching. | https://github.com/Haider-Mukhtar/ReactNative-Apple-Health-IOS |
| Apple Watch bridge from React Native | watch-connectivity/react-native-watch-connectivity | open-source-library | Best reference for React Native iPhone app communicating with a native Swift/Objective-C Watch app via WatchConnectivity. | https://github.com/watch-connectivity/react-native-watch-connectivity |
| Apple Watch bridge alternative | CRIIPI11/rn-watch-connect | open-source-library | Modern alternative for communicating with paired Apple Watch, still assumes the watch app is Swift/SwiftUI. | https://github.com/CRIIPI11/rn-watch-connect |
| Native iOS/watchOS workout architecture | msimms/OpenWorkoutTracker | open-source-app | Native iOS/watchOS workout tracker; useful for watch-specific data flow, workout session architecture, and SwiftUI patterns. | https://github.com/msimms/OpenWorkoutTracker |
| Modern open-source RN health app | skulptapp/skulpt | open-source-app | Modern local-first workout tracker using React Native, Expo, SQLite, HealthKit, Health Connect, Apple Watch, and Live Activity support. | https://github.com/skulptapp/skulpt |
| Apple Health analytics / insights | RuochenLyu/apple-health-analyst | open-source-app | Privacy-first Apple Health analyzer emphasizing cross-metric insights, trends, reports, and agent-driven health analysis. | https://github.com/RuochenLyu/apple-health-analyst |
| WorkoutKit from React Native | Janjiran/react-native-workouts | open-source-library | Experimental Expo module for Apple WorkoutKit to create, preview, and sync workouts to Apple Watch/Fitness app. | https://github.com/Janjiran/react-native-workouts |
| Activity rings component reference | thecodehunter/react-native-activity-rings | open-source-ui-component | React Native activity ring component useful for API shape and theming ideas; not enough for full Apple-style >100% ring behavior. | https://github.com/thecodehunter/react-native-activity-rings |
| Charts for React Native health UI | FormidableLabs/victory-native-xl | open-source-library | High-performance React Native charting powered by D3, Skia, and Reanimated; strong fit for trends and health metric charts. | https://github.com/FormidableLabs/victory-native-xl |
| Custom rings and advanced visuals | Shopify React Native Skia | open-source-library-docs | 2D graphics primitives for custom arcs, gradients, shaders, chart overlays, and animated ring details. | https://shopify.github.io/react-native-skia/ |
| Animation system | React Native Reanimated | open-source-library-docs | Modern animation engine for RN; use for ring interpolation, number rolls, card expansion, and gesture-linked motion. | https://docs.swmansion.com/react-native-reanimated/ |
| React Native app navigation | Expo Router Native Tabs | official-docs | Native tab bars on Android and iOS; useful for iOS-feeling tab navigation while keeping RN app structure. | https://docs.expo.dev/router/advanced/native-tabs/ |
| Android parity | matinzd/react-native-health-connect | open-source-library | React Native wrapper around Android Health Connect, the Android equivalent integration path for health data. | https://github.com/matinzd/react-native-health-connect |
| Wearable backend normalization | the-momentum/open-wearables | open-source-platform | Self-hosted unified wearable API reference for normalizing multiple providers beyond HealthKit and Health Connect. | https://github.com/the-momentum/open-wearables |
| Achievement-style app UI | JanSzewczyk/workout-tracker | open-source-app | React Native/Expo workout app with dashboard, progress, achievements, offline/private positioning; useful for gamification UI. | https://github.com/JanSzewczyk/workout-tracker |

## Summary recommendations

- Use official Apple docs and Apple Support pages for product behavior, naming, privacy, and badge guidance.
- Use `@kingstinct/react-native-healthkit` as the default new-project HealthKit bridge.
- Keep `react-native-health` in the reference set for compatibility, examples, and migration edge cases.
- Use `watch-connectivity/react-native-watch-connectivity` or a similar WatchConnectivity wrapper for the iPhone RN side, but write watchOS UI in Swift/SwiftUI.
- Use `skulptapp/skulpt` as the most useful modern full-app architecture reference found during research.
- Use `react-native-activity-rings` as a study/prototype reference, not as the final production ring engine.
- Use React Native Skia and Reanimated for the custom ring experience.
- Use Victory Native XL for trend/detail charts.
- Use Health Connect adapter planning early if Android parity is likely.
