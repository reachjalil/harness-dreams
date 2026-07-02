# 17 · Architecture

*Status: 🟡 Draft*

System architecture and how components map onto this monorepo. The concrete
package list is in [21-monorepo-and-packages.md](21-monorepo-and-packages.md);
the big technology choices and their rationale are in
[22-tech-decisions-adr.md](22-tech-decisions-adr.md).

## High-level shape

A **local-first desktop application** with three runtime roles, all on the user's
machine, no server:

```
 ┌──────────────────────────────────────────────────────────────────┐
 │                        macOS machine (local)                       │
 │                                                                    │
 │  ┌────────────┐   triggers   ┌─────────────────────────────────┐  │
 │  │  Menu-bar  │ ───────────► │        Core (TS engine)         │  │
 │  │   App UI   │ ◄─────────── │  ingest · metrics · review ·     │  │
 │  │  (webview) │   reports    │  experiments · config · store   │  │
 │  └────────────┘              └───────────────┬─────────────────┘  │
 │        │                                     │                    │
 │        │ reads/writes (consent)              │ reads (read-only)  │
 │        ▼                                     ▼                    │
 │  ┌────────────┐                    ┌───────────────────────┐      │
 │  │  SQLite    │                    │  Harness data on disk │      │
 │  │  (norm.    │                    │  ~/.claude/** , etc.  │      │
 │  │   store)   │                    └───────────────────────┘      │
 │  └────────────┘                                                   │
 │        │ Insight only, redacted, opt-in                               │
 └────────┼───────────────────────────────────────────────────────-─┘
          ▼
   Claude API (cloud)  — the only outbound call, gated by privacy settings
```

## Runtime roles

1. **Menu-bar app (shell + UI).** The macOS tray app: status glance, report
   window, settings. Built with Tauri v2 (Rust shell) + a web UI (React/TS). See
   [18-macos-app.md](18-macos-app.md).
2. **Core engine (logic).** Pure-TypeScript packages doing ingestion, metrics,
   reviewing, experiments, config, and persistence. Runs in the app's
   Node/sidecar context and is reusable headless via the CLI.
3. **Scheduler/daemon.** Triggers reviews on schedule/idle even when the window is
   closed. Implemented as a background task within the app (kept alive as a
   menu-bar agent) and/or a `launchd` agent for reliability.

## Component responsibilities

| Component | Package (see `21`) | Responsibility |
|---|---|---|
| Connectors | `connectors` | discover + parse harness data (read-only) |
| Ingestion | `ingest` | normalize raw → `Event`/`Session`, incremental cursors |
| Metrics | `metrics` | compute vitals, baselines, deltas, classifiers |
| Review engine | `review-engine` | Deterministic Vitals + Insight + assemble → `HealthReport` |
| Experiments | `experiments` | enablement, attribution, grading |
| Config | `config` | read/diff/write AGENTS.md, skills, MCP, memory (consent) |
| LLM | `llm` | Claude API client, prompt library, redaction, budgets |
| Store | `store` | SQLite schema + repositories |
| Core | `core` | shared types/domain model/utilities |
| Desktop | `apps/desktop` | Tauri menu-bar app + UI |
| CLI | `apps/cli` | headless review runner (CI, automation, testing) |

## Key data flows

**Ingest → Review → Report**
1. Scheduler fires → Review job starts.
2. `ingest` pulls new events via `connectors` into `store` (incremental).
3. `review-engine` runs Deterministic Vitals (`metrics`) then Insight (`llm`, redacted).
4. Report persisted to `store`; UI notified; menu-bar state updated.

**Reflection → Action**
1. User accepts a finding / enables an experiment in the UI.
2. `config`/`experiments` apply the change (diff + backup + consent) to the real
   harness files.
3. Subsequent sessions are ingested; the next review grades the effect.

## Process & isolation

- **The engine never blocks the UI**: reviews run off the UI thread (sidecar
  process / worker). The UI subscribes to job state.
- **Read-only by default**: only `config`/`experiments` write, and only the
  harness's own files, only on consent, always with backups.
- **The only network egress** is the LLM client, gated by the privacy setting
  and redaction layer (`20`). Everything else is local.

## Why local-first (not a server)

- Data is sensitive (code + secrets) → keep it on the device (`20`).
- No accounts, no infra, no latency for the user.
- The Claude API call is the single, explicit, redacted exception — and can be
  swapped for a local model later.

Team/fleet features (`03`) would later add an *optional* sync layer; the data
model (`12`) is already shaped to allow it without a rewrite.
