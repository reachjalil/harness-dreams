# 21 · Monorepo & Packages

*Status: 🟡 Draft*

How the product maps onto **this** repository, which is already a pnpm +
Turborepo + Biome + TypeScript monorepo (see the root `README.md`,
`pnpm-workspace.yaml`, `turbo.json`). The architecture is in
[17-architecture.md](17-architecture.md).

## Target layout

```
harness-health/
├── packages/
│   ├── core/            # shared types + domain model + utils  (exists; repurpose)
│   ├── store/           # SQLite schema + repositories
│   ├── connectors/      # harness adapters: claude-code, codex, cursor
│   ├── ingest/          # raw → normalized Event/Session pipeline
│   ├── metrics/         # vitals, baselines, deltas, classifiers
│   ├── llm/             # Claude API client, prompt library, redaction, budgets
│   ├── review-engine/    # Deterministic Vitals + Insight + assemble → HealthReport
│   ├── experiments/     # enablement, attribution, grading
│   └── config/          # read/diff/write AGENTS.md, skills, mcp, memory
├── apps/
│   ├── desktop/         # Tauri v2 menu-bar app + React/TS UI
│   └── cli/             # headless review runner (CI, automation, testing)
└── md/                  # this documentation set
```

All packages are `@harness-health/<name>` (matching the existing
`@harness-health/core`).

## Package responsibilities & dependencies

| Package | Depends on | Exposes |
|---|---|---|
| `core` | — | domain types, `Event`/`Session`/`Finding`/`Experiment` types, utils |
| `store` | `core` | SQLite migrations + typed repositories |
| `connectors` | `core` | `Connector` impls (claude-code first) |
| `ingest` | `core`, `connectors`, `store` | `ingest(window)` → normalized rows |
| `metrics` | `core`, `store` | `computeVitals(window, scope)`, classifiers |
| `llm` | `core` | Claude client, prompt templates, redaction, budget guard |
| `review-engine` | `core`, `store`, `metrics`, `llm` | `runHealthReview(window)` → `HealthReport` |
| `experiments` | `core`, `store`, `config`, `metrics` | enable/attribute/grade |
| `config` | `core`, `store` | read/diff/apply config + memory changes (consent) |
| `apps/desktop` | all packages | the app shell + UI |
| `apps/cli` | `review-engine`, `ingest`, `store`, `experiments` | `harness-health review` etc. |

Dependency direction stays acyclic: `core` at the bottom, `review-engine`
orchestrates, apps sit on top.

## Why this maps cleanly to the existing repo

- The repo already uses **pnpm workspaces + catalogs**, **Turborepo** tasks
  (`build`/`check`/`test`/`dev`), **Biome**, **Changesets**, and TS project
  references — exactly the toolchain this layout wants. New packages just follow
  the existing `packages/core` template (`package.json` with `@harness-health/`
  scope, `tsconfig.json` extending `tsconfig.base.json`, `src/`).
- The existing `core` package is the seed; the rest are added the same way.
- `apps/cli` lets the **entire engine run headless** — critical for testing the
  review pipeline in CI without the desktop shell (the existing CI workflow runs
  `lint`/`check`/`build`/`test` across the workspace).

## The Tauri app within the monorepo

`apps/desktop` is a Tauri v2 app:
- **Frontend**: React + TypeScript (Vite), consuming the TS packages directly —
  reuses the monorepo's types end-to-end.
- **Rust shell**: tray/menu-bar, windows, notifications, login-item, updater,
  file-access prompts.
- **Engine execution**: the TS engine runs as a **Node sidecar** invoked by the
  Rust shell (keeps heavy work off the UI). Alternatively, the engine compiles to
  a sidecar binary. (Decision detail in [22-tech-decisions-adr.md](22-tech-decisions-adr.md).)

> If the team prefers a pure-TS stack, the Electron fallback (ADR-002) keeps
> everything in TypeScript at the cost of footprint. Either way the
> `packages/*` engine is identical and unchanged.

## Tooling conventions (inherit from repo)

- **Catalogs** for shared dep versions (`zod`, `typescript`, `vitest`, etc.) in
  `pnpm-workspace.yaml`.
- **Turbo** task graph: `review-engine` `build` depends on `^build`, etc.
- **Biome** for lint/format (config already present).
- **Changesets** for versioning shared packages.
- **Vitest** for unit tests; fixture transcripts under each package's `src`.

## Build/run targets

- `pnpm dev` — run desktop app in dev (Tauri dev) + watch packages.
- `pnpm --filter @harness-health/cli dev -- review --since=yesterday` — headless
  review for testing.
- `pnpm test` — workspace tests (engine fixtures + redaction + metrics).
- `pnpm build` — build packages + desktop app bundle.
