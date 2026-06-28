# Harness Dreams Mobile

Expo SDK 54 companion app for iPhone/iPad.

## Why Expo

The app uses Expo's New Architecture path (`newArchEnabled: true`) and an SDK 54 dependency set that builds with the current Xcode 16.1 simulator toolchain. SDK 56 needs the full Xcode 26.x app, not only newer Command Line Tools.

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

The current checked-in iOS target omits the generated app icon asset catalog from the simulator build because Xcode 16.1 on this machine fails to spawn `AssetCatalogSimulatorAgent`. Re-add the app icon asset catalog after updating the full Xcode app to 26.x.

Use the Expo app on a physical device for QR scanning and local-network sync.
