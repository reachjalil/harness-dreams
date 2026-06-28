# Harness Dreams Mobile

Expo SDK 56 companion app for iPhone/iPad.

## Why Expo

The app uses Expo's New Architecture path (`newArchEnabled: true`) and the SDK 56 dependency set. Build locally with Xcode 26.x and the iOS 26.5 simulator runtime installed.

## Pairing Flow

1. Start the desktop app.
2. Open Settings → Cloud Sync → Device management.
3. Add a device and scan the QR code with this Expo app.

The QR carries a desktop-signed JWT, a LAN sync URL, and a localhost dev URL for the iOS simulator. The device stores the token in SecureStore and uses it as a bearer token when reading the latest cycle signal from the desktop-owned sync endpoint.

In Expo development builds, Local Mac mode auto-pairs with the desktop app at `http://127.0.0.1:39391` when the desktop app is running. Physical devices should still use QR pairing over LAN.

## Run

```bash
pnpm --filter @harness-dreams/mobile start
pnpm --filter @harness-dreams/mobile ios
```

Use LAN mode on a physical device. Use Local Mac mode in the iOS simulator; in development this will auto-connect through `127.0.0.1`.
