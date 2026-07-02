# 17 · Architecture

*Status: 🟢 Current implementation*

Harness Health is a local-first Electron desktop app with optional private device
sync through Cloudflare Workers and Durable Objects. The concrete workspace
layout is in [21-monorepo-and-packages.md](21-monorepo-and-packages.md); privacy
boundaries are in [20-privacy-and-security.md](20-privacy-and-security.md).

## High-Level Shape

```text
macOS desktop
  ├─ Electron main process
  │   ├─ config store and report history
  │   ├─ telemetry connectors and PGlite telemetry store
  │   ├─ Health Review engine
  │   ├─ accepted guidance writes / review branches
  │   └─ private sync + encrypted snapshot backup client
  ├─ React renderer
  │   ├─ Today, Review, Browse, Goals, Config, Chat, Settings
  │   └─ context-isolated preload API with Zod-validated IPC
  └─ local files
      ├─ ~/.codex, ~/.claude, Cursor state
      └─ project AGENTS.md, CLAUDE.md, rules.md, skills

Cloudflare edge (optional)
  ├─ Worker HTTP routes
  ├─ SignalRoom Durable Object for WebRTC signaling
  ├─ SnapshotBackupRoom Durable Object for encrypted backup packages
  ├─ /ice route with STUN plus optional TURN env config
  └─ LiveKit voice-token route when configured
```

Raw transcripts and project files stay on the desktop. Cloudflare is not the
review source of truth; it relays signaling and stores opaque encrypted snapshot
packages only when sync/backup is enabled.

## Runtime Roles

| Runtime | Main responsibilities |
|---|---|
| Electron main | Owns local state, file access, telemetry ingestion, review generation, private sync, and IPC validation |
| React renderer | Presents the app UI and calls the preload API; no Node integration |
| `packages/core` | Shared pairing, signaling, ICE, and backup crypto contract |
| Cloudflare Worker | HTTP API surface for signaling, backup, ICE, and voice tokens |
| SignalRoom DO | Ephemeral WebSocket relay with frame-size and replay-window checks |
| SnapshotBackupRoom DO | Per-user encrypted snapshot package storage, keep-20 pruning, TTL/alarm cleanup |
| Mobile/watch clients | Pair through desktop-created links and sync sanitized report snapshots/decisions |

## Local Review Flow

1. Desktop telemetry service discovers supported local harness files.
2. `telemetryConnectors.ts` parses Codex/Claude-style JSONL into normalized
   events with cursors.
3. `telemetryStore.ts` stores normalized events locally in PGlite.
4. `telemetryAnalytics.ts` builds live vitals for the Today dashboard.
5. `healthReview/engine.ts` generates a `HealthReport` from local sessions,
   project config state, accepted goals, and optional redacted CLI insight.
6. `reports.ts` persists reports and review decisions.
7. Accepted recommendations write managed config blocks directly or through a
   reviewable Git worktree branch.

## Private Device Sync Flow

1. Desktop creates a pairing link with a pairing secret in the URL fragment.
2. SignalRoom relays encrypted WebRTC signaling between desktop and companion
   clients. Durable Object storage is not the conversation transcript.
3. Devices exchange sanitized report snapshots and review decisions over WebRTC.
4. Mobile/watch decisions merge on desktop with newest-per-finding wins.
5. If encrypted backup is enabled, desktop uploads an encrypted snapshot package
   to SnapshotBackupRoom as a fallback for reconnects or new devices.

## Encrypted Backup Flow

- Desktop derives the snapshot encryption key from the user backup key,
  `cloudUserId`, and backup epoch.
- Encrypted packages include a `keyId`; desktop retains old keys for rotation
  compatibility.
- The Worker stores only opaque package metadata and ciphertext.
- Backup upload retries use persisted backoff state so app restarts do not lose
  retry intent.
- SnapshotBackupRoom keeps the latest 20 packages and removes expired rows by
  alarm cleanup.

## Network Surfaces

| Surface | Enabled by | Content boundary |
|---|---|---|
| Optional CLI insight runner | User config | Redacted local payload sent to configured local CLI command |
| SignalRoom WebSocket | Private device sync | Encrypted signaling envelopes, bounded size, replay checked |
| SnapshotBackupRoom HTTP | Encrypted backup | Opaque encrypted snapshot packages and auth hash |
| `/ice` | Pairing/sync | STUN/TURN server config only |
| `/voice/token` | Voice chat config | LiveKit access token minted from Worker secrets |

## Isolation

- Electron uses context isolation, sandboxed renderer, preload-only API access,
  Zod-validated IPC, and Electron fuses.
- Renderer pages are wrapped in error boundaries so a page crash does not white
  out the app.
- Main-process logs are written to `app.getPath("logs")`; renderer console usage
  is not treated as product telemetry.
- Local file reads use narrow known paths and retry transient read failures.

## What Is Not Present

- No active `apps/api` Python/FastAPI service.
- No automatic Worker deploy on push; CI performs dry-run deploy only.
- No hosted product telemetry or content analytics SDK.
- No broad package split beyond `packages/core` until there are real cross-app
  consumers.
