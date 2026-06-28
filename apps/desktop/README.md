# @harness-dreams/desktop

Native macOS menu-bar app for Harness Dreams.

## Current status

The desktop app is not distributed as a signed macOS download yet. Sign-up,
early access invites, and the signed app build are coming soon.

Until then, run it locally from the repo:

```bash
git clone https://github.com/reachjalil/harness-dreams.git
cd harness-dreams
corepack enable
pnpm install
pnpm --filter @harness-dreams/desktop start
```

This starts the Electron app in development mode.

## MongoDB Atlas Cloud Sync

The desktop app can sync the Sleep Cycle signal to MongoDB Atlas so phone and
watch clients can read cycle history and write action choices back.

Configure it in `Settings -> Cloud Sync`, or launch with environment variables:

```bash
HARNESS_DREAMS_MONGODB_URI="mongodb+srv://..."
HARNESS_DREAMS_MONGODB_DB="harness_dreams"
HARNESS_DREAMS_CLOUD_USER_ID="your-shared-user-id"
pnpm --filter @harness-dreams/desktop start
```

Collections created by the desktop client:

- `sleep_cycles`: sanitized cycle snapshots with summaries, scores, metrics,
  findings, experiments, alignment detail, and review status.
- `sleep_cycle_decisions`: one document per `userId + reportId + findingId`.
  Phone/watch clients should upsert `{ state, updatedAt, sourceDeviceId }` here,
  with `updatedAt` as epoch milliseconds.
- `sync_devices`: last-seen metadata for desktop, phone, and watch clients.

Conflict resolution is intentionally simple: newest `updatedAt` wins per
finding. When the desktop pulls a newer accepted decision from phone/watch, it
applies the same accepted-recommendation path as a local desktop review.

Cloud Sync does not upload transcripts, code, local repo paths, evidence file
paths, patch snippets, or secrets.
