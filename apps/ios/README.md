# Harness Dreams Mobile

Native SwiftUI scaffold for the Harness Dreams companion surfaces:

- `Harness Dreams`: iPhone/iPad companion app for reviewing the latest cycle signal.
- `Harness Dreams Watch`: Apple Watch glance for the same redacted signal.
- `HarnessDreamsMobileCore`: shared Swift model that mirrors the desktop app's sync boundary.

The scaffold intentionally carries only cycle signal data: scores, metrics, findings, and goals. Code, transcripts, evidence files, and secrets stay on the Mac.

## Open in Xcode

```bash
open apps/ios/HarnessDreamsMobile.xcodeproj
```

Select the `Harness Dreams` or `Harness Dreams Watch` scheme and run on a simulator. The first version uses fixture data from `Shared/HarnessDreamsSignal.swift`; the sync button currently refreshes the local timestamp and marks the future integration point for CloudKit or WatchConnectivity.

## Verify the shared model

```bash
cd apps/ios
swift test
```

The package test checks that the preview payload remains limited to the mobile-safe cycle signal.
