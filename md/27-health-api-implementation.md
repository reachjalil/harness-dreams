# Retired Python API Archive

The former Python API service has been retired. The last tracked version is
preserved in the Git tag `archive/python-api` for archaeology and rollback
reference only.

There is no active local FastAPI process and no runtime service under
`apps/api`.

## Current Ownership

| Area | Current implementation |
|---|---|
| Local telemetry ingestion | `apps/desktop/src/main/telemetryConnectors.ts` |
| Normalized telemetry store | `apps/desktop/src/main/telemetryStore.ts` |
| Live telemetry analytics | `apps/desktop/src/main/telemetryAnalytics.ts` |
| Health review generation | `apps/desktop/src/main/healthReviewEngine.ts` |
| Optional CLI insight analysis | `apps/desktop/src/main/insightAnalysis.ts` |
| Review persistence and decisions | `apps/desktop/src/main/reports.ts` |
| App config persistence | `apps/desktop/src/main/store.ts` |
| Private device sync | `apps/desktop/src/main/deviceSync.ts` and `apps/desktop/src/main/cloudSync.ts` |
| Cloud signaling and snapshot backup | `apps/cloud/src/server` |
| Voice token minting | `apps/cloud/src/server/voice.ts` |

## Current Data Boundary

Harness Health is local-first. Raw transcripts and normalized telemetry stay on
the desktop unless the user explicitly enables a sync or backup feature.

The desktop app stores telemetry locally with PGlite. Cloudflare is used for
ephemeral device signaling, optional encrypted snapshot backup, and Worker-side
voice-token minting. It is not the source of truth for reviews.

## Local Development

Use the TypeScript packages instead of starting the retired API:

```bash
pnpm --filter @harness-health/desktop check
pnpm --filter @harness-health/desktop test
pnpm --filter @harness-health/cloud check
pnpm --filter @harness-health/cloud test
```

For Worker voice-token development, copy `apps/cloud/.dev.vars.example` to
`apps/cloud/.dev.vars` and fill in local-only secrets. The real `.dev.vars`
file is ignored and must not be committed.
