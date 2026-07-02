# @harness-health/desktop

Native macOS menu-bar app for Harness Health.

## Current status

The desktop app is not distributed as a signed macOS download yet. Sign-up,
early access invites, and the signed app build are coming soon.

Until then, run it locally from the repo:

```bash
git clone https://github.com/reachjalil/harness-health.git
cd harness-health
corepack enable
pnpm install
pnpm --filter @harness-health/desktop start
```

This starts the Electron app in development mode.

## Private Device Sync

The desktop app is the only durable source of truth for Health Review reports.
Companion devices use Cloudflare only as an ephemeral WebRTC signaling room;
reports and review decisions move directly over WebRTC data channels.

Configure it in `Settings -> Private Device Sync`, or launch with environment
variables:

```bash
HARNESS_HEALTH_CLOUD_API_BASE_URL="https://sync.example.com"
pnpm --filter @harness-health/desktop start
```

The desktop generates a local cloud user id and one-time QR pairing secret.
The QR query contains only public routing metadata; the pairing secret stays in
the deep-link fragment and is never sent to Cloudflare routes.

Conflict resolution is intentionally simple: newest `updatedAt` wins per
finding. When the Mac receives a newer accepted decision from phone/watch, it
applies the same accepted-recommendation path as a local desktop review and
fans out the latest snapshot to connected devices.

By default, no Harness Health data is stored on our servers. TURN may relay
encrypted WebRTC packets for connectivity, but it does not receive plaintext
reports. If encrypted fallback is enabled, Cloudflare stores only latest-snapshot
ciphertext that paired devices decrypt locally.
