# Harness Dreams Watch

Native SwiftUI watchOS scaffold for the Harness Dreams companion surface:

- `Harness Dreams Watch`: Apple Watch glance for the redacted cycle signal.
- `HarnessDreamsMobileCore`: shared Swift model that mirrors the desktop app's sync boundary.

The iPhone/iPad companion now lives in `apps/mobile` as a modern Expo app. This Xcode project remains for watchOS, where Expo does not provide a direct app target.

## Open in Xcode

```bash
open apps/ios/HarnessDreamsMobile.xcodeproj
```

Select the `Harness Dreams Watch` scheme. In debug builds, the watch simulator auto-pairs with the desktop app at `http://127.0.0.1:39391` and reads the latest cycle signal from the desktop-owned sync endpoint. The fixture data in `Shared/HarnessDreamsSignal.swift` remains the offline fallback.

## Verify the shared model

```bash
cd apps/ios
swift test
```

The package test checks that the preview payload remains limited to the mobile-safe cycle signal.
