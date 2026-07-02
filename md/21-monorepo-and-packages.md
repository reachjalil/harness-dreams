# 21 · Monorepo & Packages

*Status: 🟢 Current layout / 🟡 Future extraction candidates*

This repo is the Harness Health pnpm workspace. It is still checked out locally
as `harness-dreams` on some machines for historical reasons; that directory name
is not a product or package name and should not be renamed mid-flight. Runtime
packages, app names, docs, and user-facing copy use Harness Health.

## As-Built Layout

```text
harness-health/
├── packages/
│   └── core/                 # shared sync protocol, schemas, crypto helpers
├── apps/
│   ├── desktop/              # Electron menu-bar app + React UI
│   ├── cloud/                # Cloudflare Worker + Durable Objects sync backend
│   ├── mobile/               # React Native companion app
│   ├── site/                 # Astro marketing/docs site
│   └── ios/                  # native iOS/watchOS work-in-progress
├── md/                       # product and architecture docs
├── marketing/                # marketing source assets/copy
└── .harness/                 # source-owned agent configuration
```

All package names use the `@harness-health/*` scope. The only shared runtime
library today is `@harness-health/core`.

## Package Responsibilities

| Workspace | Responsibility |
|---|---|
| `packages/core` | Pairing-link schema, WebRTC signaling envelopes, snapshot-backup encryption, auth-token derivation, frame limits, ICE response schemas |
| `apps/desktop` | Electron main process, local telemetry ingestion, PGlite telemetry store, Health Review engine, report persistence, accepted guidance application, private device sync client, React UI |
| `apps/cloud` | Cloudflare Worker routes, SignalRoom Durable Object, SnapshotBackupRoom Durable Object, ICE/TURN config, voice-token minting |
| `apps/mobile` | Companion mobile/watch-facing UI and sync client |
| `apps/site` | Public site and docs pages |
| `apps/ios` | Native Apple-platform prototype/work-in-progress |

## Desktop Internal Modules

The desktop app currently keeps most domain logic local because no other app
imports it yet:

| Module | Current owner |
|---|---|
| `apps/desktop/src/main/healthReview/` | Health Review orchestration, rule generation, scoring helpers |
| `apps/desktop/src/main/telemetry*.ts` | Local telemetry discovery, ingestion, storage, analytics |
| `apps/desktop/src/main/agentConfig.ts` | Read/write AGENTS.md, CLAUDE.md, rules.md, and skills with managed blocks |
| `apps/desktop/src/main/reports.ts` | Report history, review decisions, remote decision merge |
| `apps/desktop/src/main/cloudSync.ts` | Private sync status, encrypted snapshot backup, backup key rotation |
| `apps/desktop/src/main/deviceSync.ts` | Local dev pairing endpoint and pairing payload creation |
| `apps/desktop/src/shared/healthLogAnalysis.ts` | Legacy health-log JSON adapter, desktop-local until another app imports it |
| `apps/desktop/src/main/insightAnalysis.ts` | Optional redacted CLI insight pass, main-process only |

## Why Only `core` Is Extracted Today

`packages/core` is extracted because it is genuinely shared by desktop, mobile,
and the Cloudflare Worker. It owns the protocol contract that must stay identical
across runtimes.

The Phase 5 extraction review checked `healthLogAnalysis.ts` and
`insightAnalysis.ts` for site/mobile consumers and found none. They stay
desktop-local until another app imports them. Extracting them now would add
package surface area without a real caller.

## Tooling Conventions

- `pnpm` workspaces and catalog versions live in `pnpm-workspace.yaml`.
- Turborepo runs workspace `check`, `test`, and `build` tasks.
- Biome owns format and lint.
- Vitest owns unit and Worker integration tests.
- Durable agent configuration is generated from `.harness`; edit source files
  there, then run `pnpm harness:validate`, `pnpm harness:preview`, and
  `pnpm harness:activate`.

## Current Verification Targets

```bash
pnpm lint
pnpm check
pnpm test
pnpm build
pnpm --filter @harness-health/cloud exec wrangler deploy --dry-run
```

Desktop-only development:

```bash
pnpm --filter @harness-health/desktop start
pnpm --filter @harness-health/desktop check
pnpm --filter @harness-health/desktop test
```

Cloud Worker development:

```bash
cp apps/cloud/.dev.vars.example apps/cloud/.dev.vars
pnpm --filter @harness-health/cloud dev
```

`apps/cloud/.dev.vars` is ignored and must stay local-only.

## Possible Future Extraction Appendix

Do not execute this split until there are real cross-app callers or a file has
become too costly to maintain in place. The old nine-package target is now a
future option, not the current plan:

- `store`: shared database schema/repositories if mobile or CLI needs local DB
  parity.
- `connectors`: harness adapters if a headless CLI or mobile import needs them.
- `ingest`: raw transcript to normalized event/session pipeline.
- `metrics`: reusable vitals, baselines, classifiers.
- `llm`: shared hosted/local insight runner clients and redaction.
- `review-engine`: shared deterministic review assembly.
- `experiments`: attribution and grading logic.
- `config`: shared AGENTS.md/CLAUDE.md/skills diff/apply helpers.
- `cli`: headless review runner if CI or automation needs it.
