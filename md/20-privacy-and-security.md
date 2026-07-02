# 20 · Privacy & Security

*Status: 🟢 Principles / 🟢 Current mechanisms*

Harness Health reads sensitive developer data: coding-agent transcripts, file
paths, commands, project instructions, and sometimes secret-looking text. The
product remains local-first. Cloudflare sync is optional and designed so the
edge never needs raw report content.

## Principles

1. **Local-first by default.** Raw transcripts, normalized telemetry, reports,
   and review decisions live on the desktop unless the user enables sync/backup.
2. **No raw transcript cloud storage.** Cloudflare receives signaling envelopes
   and opaque encrypted backup packages, not raw local transcripts.
3. **Cloud insight is opt-in.** Optional CLI insight analysis receives a redacted
   local payload only when configured.
4. **Consent for writes.** Accepted guidance changes write managed blocks or
   review branches only after user review.
5. **Secrets stay local.** `.env`, ignored files, credentials, and detected
   secrets are excluded from cloud payloads and masked in sanitized reports.
6. **User can purge local state.** Config, reports, telemetry, and pairing state
   are local app data.

## Data Classification

| Data | Sensitivity | Handling |
|---|---|---|
| Raw transcripts (`~/.codex`, `~/.claude`, Cursor state) | High | Read locally; bodies are not uploaded; raw-text retention is configurable |
| Normalized telemetry | Medium | Stored in local PGlite; used for live vitals and reviews |
| Reports/findings/experiments | Medium | Stored locally; sanitized before sync/backup |
| Config/memory files | High | Read locally; writes use managed blocks, direct edit or review branch |
| Pairing secrets | Critical | Fragment-only in pairing links; hashed in config where needed |
| Backup keys | Critical | Generated/stored locally; rotated with retained local key records |
| Snapshot backups | Medium encrypted blob | Encrypted on desktop; Worker stores opaque ciphertext only |
| Worker secrets | Critical | LiveKit/TURN/etc. set through Wrangler/Cloudflare secrets |

## Desktop Security Boundary

- Electron renderer is sandboxed and context-isolated.
- Renderer talks to main through preload APIs and Zod-validated IPC.
- Main owns filesystem access, sync, and config writes.
- Electron fuses are enabled.
- Main-process logs go to `app.getPath("logs")`; they are local files, not
  remote telemetry.
- Transient file read failures during telemetry ingest are retried before being
  skipped/logged.
- React page error boundaries keep renderer failures contained to the affected
  page surface.

## Redaction For Cloud Sync And Backup

`apps/desktop/src/main/cloudRedaction.ts` sanitizes reports before companion
sync or backup packaging:

- local absolute paths are replaced with `[redacted path]`;
- secret-like tokens and `KEY`/`TOKEN`/`SECRET` assignments are replaced with
  `[redacted secret]`;
- code fences are replaced with `[redacted code block]`;
- transcript evidence and evidence file paths are replaced with a local-retained
  evidence marker;
- patch snippets, project paths, and review-branch worktree paths are removed
  from synced report data.

The sanitized report is what goes into WebRTC report snapshots and encrypted
snapshot backup payloads.

## Private Device Sync

SignalRoom is a Cloudflare Durable Object used as an ephemeral WebSocket relay:

- signaling envelopes are encrypted by the peers using the pairing secret;
- envelope freshness is checked with the shared replay window from
  `packages/core`;
- frame size is capped at 64KB;
- the pairing secret travels in the URL fragment, not the query string;
- the Worker is a relay, not the report source of truth.

Desktop and companion devices exchange report snapshots and review decisions
over WebRTC. Review decisions merge on desktop with newest-per-finding wins.

## Encrypted Snapshot Backup

SnapshotBackupRoom is a Cloudflare Durable Object used only when encrypted backup
is enabled:

- desktop derives the backup encryption key locally;
- package `keyId` supports backup-key rotation and retained old keys;
- the Worker authenticates with a backup-key-derived bearer hash;
- stored rows are opaque ciphertext packages with revision metadata;
- uploads retry with persisted backoff state on desktop;
- SnapshotBackupRoom keeps the newest 20 packages and uses alarms to clean
  expired packages;
- package size is capped at 2MB.

Disabling backup clears desktop backup key state and asks the Worker to delete
the user's backup packages when possible.

## ICE, TURN, And Voice

The Worker `/ice` route returns Google STUN by default and can append TURN
servers from `TURN_URL`, `TURN_USERNAME`, and `TURN_CREDENTIAL`. These values
are configuration secrets, not user report content.

LiveKit voice tokens are minted by `apps/cloud/src/server/voice.ts` when LiveKit
secrets are configured. The retired Python API no longer owns voice tokens.

## Optional CLI Insight

`apps/desktop/src/main/insightAnalysis.ts` can invoke a configured local CLI
runner with a redacted payload. It is off unless configured, bounded by timeout,
and treats transcripts as data. It does not execute commands from transcript
content.

## Threat Model

| Threat | Mitigation |
|---|---|
| Secret leakage to companion/cloud | report sanitizer, fragment-only pairing secrets, local backup keys |
| Replay or oversized signaling frames | shared replay window and 64KB frame cap |
| Backup package disclosure | desktop-side encryption, key rotation, opaque Worker storage |
| Unauthorized backup writes | backup-key-derived bearer token |
| Malicious config write | previewed accepted recommendations, managed blocks, direct/branch apply metadata, revert support |
| Renderer compromise | sandbox, context isolation, preload-only API, validated IPC |
| Local store theft | OS disk protection assumed; local purge remains available |

## What The User Controls

- Local-only use with no private sync/backup.
- Private device sync on/off.
- Encrypted backup on/off and backup-key rotation.
- Raw-text retention setting for telemetry.
- Accepted/rejected review decisions before any config write.
- App data reset/purge controls.
