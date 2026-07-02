# Harness Health Mobile

Expo SDK 56 companion app for iPhone.

## Why Expo

The app uses Expo's New Architecture path (`newArchEnabled: true`) and the SDK 56 dependency set. Build locally with Xcode 26.x and the iOS 26.5 simulator runtime installed.

## Pairing Flow

1. Start the desktop app.
2. Open Settings → Private Device Sync.
3. Add a device and scan the QR code with this Expo app.

The QR carries the public signaling URL and pairing id in query parameters.
The pairing secret is carried in the deep-link fragment so it is never sent to
Cloudflare routes. The device completes encrypted signaling, stores the paired
device secret in SecureStore, then receives reports over a WebRTC data channel
from the Mac.

## Run

```bash
pnpm --filter @harness-health/mobile start
pnpm --filter @harness-health/mobile ios
```

Run a local signaling Worker with `pnpm --filter @harness-health/cloud run dev`,
or point desktop settings at a deployed Cloudflare Worker URL before pairing.
