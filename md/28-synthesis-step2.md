# Health Review Synthesis

> Current implementation note. The old Python API design is archived at
> `archive/python-api`; this document describes the active desktop and Worker
> implementation.

## What This Step Does

Synthesis turns local agent telemetry into a `HealthReport`: vitals, alignment,
findings, recommendations, and an optional morning briefing. The durable source
of truth is the Electron desktop app, not a separate API service.

The core design principle is still a continuous learning loop. Each review
compares the latest local sessions, config state, and accepted recommendations
against prior reviews so the app can tell whether friction is resolving,
persisting, or getting worse.

## Current Flow

```text
Local agent traces and project config
  ~/.claude, ~/.codex, Cursor state, project AGENTS.md, skills, rules
        |
        v
Desktop telemetry connectors
  apps/desktop/src/main/telemetryConnectors.ts
        |
        v
Local PGlite telemetry store
  apps/desktop/src/main/telemetryStore.ts
        |
        v
Health review engine
  apps/desktop/src/main/healthReview/engine.ts
        |
        +--> optional redacted CLI insight pass
        |    apps/desktop/src/main/insightAnalysis.ts
        |
        v
HealthReport
  persisted by apps/desktop/src/main/reports.ts
        |
        +--> desktop UI review detail
        +--> accepted guidance patches / review branches
        +--> optional private device sync and encrypted snapshot backup
        +--> Worker voice token for LiveKit sessions when configured
```

## Two Stages

### Stage 1: Observe

The desktop app ingests only local files and records normalized events, cursors,
source summaries, model usage, tool outcomes, and project pointers. Raw text
retention is disabled by default and controlled by desktop telemetry settings.

Key files:

| File | Role |
|---|---|
| `apps/desktop/src/main/telemetry.ts` | Starts scanning, watching, and snapshot refresh |
| `apps/desktop/src/main/telemetryConnectors.ts` | Reads supported local agent sources |
| `apps/desktop/src/main/telemetryStore.ts` | PGlite tables for events and cursors |
| `apps/desktop/src/main/telemetryAnalytics.ts` | Builds live metrics and insights |

### Stage 2: Review

The review engine turns observed sessions and config state into a report. It
detects repeated corrections, hedging, context drift, skill-routing gaps, model
usage, accepted recommendation progress, and project-level trends. When a CLI
insight runner is enabled, only a redacted payload is sent to the configured
local CLI command.

Key files:

| File | Role |
|---|---|
| `apps/desktop/src/main/healthReview/engine.ts` | Main report generator |
| `apps/desktop/src/main/insightAnalysis.ts` | Optional redacted CLI insight pass |
| `apps/desktop/src/main/reports.ts` | Report storage, decisions, and accepted guidance |
| `apps/desktop/src/main/recommendationBranches.ts` | Review branch creation for accepted guidance |
| `apps/desktop/src/shared/types.ts` | `HealthReport`, findings, metrics, sync, and review types |

## Data Boundary

Local review data remains in the desktop app by default:

- Normalized telemetry is stored in PGlite under the app userData directory.
- App config and reports are stored by the Electron main process.
- Cloudflare handles signaling and optional encrypted snapshot backup only when
  the user enables sync or backup.
- Voice token minting is a Worker route in `apps/cloud/src/server/voice.ts`.

## Running

Use package checks and tests for the active implementation:

```bash
pnpm --filter @harness-health/desktop check
pnpm --filter @harness-health/desktop test
pnpm --filter @harness-health/cloud check
pnpm --filter @harness-health/cloud test
```

For local Worker development:

```bash
cp apps/cloud/.dev.vars.example apps/cloud/.dev.vars
pnpm --filter @harness-health/cloud dev
```

`apps/cloud/.dev.vars` is local-only and ignored. Production secrets should be
set with Wrangler secrets or the Cloudflare dashboard.

## Review Briefing Shape

The morning briefing remains intentionally short:

1. The sharpest non-obvious pattern from the latest review window.
2. What changed compared with previous reviews.
3. One question to carry into the next work session.

The goal is not a generic summary. It is a small, testable frame for improving
the next agent collaboration loop.
