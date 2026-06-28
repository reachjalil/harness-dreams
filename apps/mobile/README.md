# Harness Dreams Mobile

Expo SDK 56 companion app for iPhone/iPad.

## Why Expo

The app uses Expo's New Architecture path (`newArchEnabled: true`) and the SDK 56 template dependency set. It pairs with the desktop app by scanning a QR code from Settings.

## Pairing Flow

1. Start the desktop app.
2. Open Settings → Cloud Sync → Device management.
3. Add a device and scan the QR code with this Expo app.

The QR carries a desktop-signed JWT and a local sync URL. The device stores the token in SecureStore and uses it as a bearer token when reading the latest cycle signal from the desktop-owned sync endpoint.

## Run

```bash
pnpm --filter @harness-dreams/mobile start
pnpm --filter @harness-dreams/mobile ios
```

Use the Expo app on a physical device for QR scanning and local-network sync.
