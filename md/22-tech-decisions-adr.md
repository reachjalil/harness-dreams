# 22 · Technology Decisions (ADRs)

*Status: 🟡 Draft — decisions proposed with rationale; revisit before building*

Lightweight Architecture Decision Records for the consequential calls. Each is a
recommendation with rationale and the main alternative, so they can be ratified
or overturned deliberately.

---

### ADR-001 — Desktop shell: Tauri v2 (recommended)

**Decision.** Build the menu-bar app with **Tauri v2** (Rust shell + web UI),
frontend in React/TypeScript.

**Why.**
- Tiny footprint vs Electron — critical for an always-running background
  menu-bar/health app.
- First-class tray/menu-bar, notifications, login-item, updater, single-instance.
- Keeps the **UI in TypeScript**, reusing the monorepo's packages and types.
- Good security defaults; small attack surface.

**Alternative — Electron (ADR-002 fallback).** More mature, pure-JS, larger
ecosystem, but heavy memory for a background app. Choose it if the team wants
zero Rust and maximum velocity over footprint.

**Alternative — native SwiftUI.** Most native feel, but splits the stack, loses
TS reuse of the engine, and slows iteration. Rejected for MVP.

**Consequence.** Adds Rust to the toolchain for the shell only; the engine stays
pure TS. Engine runs as a Node **sidecar** (ADR-005).

---

### ADR-002 — Fallback shell: Electron (documented, not chosen)

Kept as an explicit escape hatch. If Tauri's sidecar/Node story or any macOS
integration proves painful, switch `apps/desktop` to Electron. The `packages/*`
engine is unchanged either way — the shell is deliberately thin.

---

### ADR-003 — Local store: SQLite

**Decision.** Normalized data in a single local **SQLite** database in the app
support dir.

**Why.** Embedded, zero-config, great for event/time-range queries, easy backup
and purge, no server. Fits local-first (`20`).

**Alternative.** Flat JSON/Parquet files (simpler, worse querying) or DuckDB
(great analytics, heavier). SQLite is the pragmatic middle.

---

### ADR-004 — Analysis: cloud Claude API for Insight, deterministic Deterministic Vitals, local-only mode supported

**Decision.** Deterministic Vitals is deterministic (no LLM). Insight uses the **Claude API**
by default (opt-in, redacted), with a **local-only mode** (vitals-only now,
local model later).

**Why.** Quality of findings depends on a strong model; Deterministic Vitals guarantees a
useful report even offline; local-only respects privacy-max users (`20`).

**Model tiers.** Strong model (e.g. Opus-class) for findings/config/cross-project;
small/fast (e.g. Haiku-class) for classification/digest. Exact IDs + pricing from
the Claude API reference, not hardcoded (`13`, `24`).

**Alternative.** Local-model-only (privacy-max but weaker findings today) or
other providers (rejected — we optimize for our own harness ecosystem first).

---

### ADR-005 — Engine execution: Node sidecar

**Decision.** The TS engine runs as a **Node sidecar process** launched by the
shell, communicating over IPC.

**Why.** Reuses the exact `packages/*` engine; keeps heavy/async work off the UI
thread; same binary runs headless in `apps/cli` for CI.

**Alternative.** Port the engine to Rust (loses TS reuse, big cost) or run in the
webview (blocks UI, no fs ergonomics). Rejected.

---

### ADR-006 — Experiment enablement: instruction-injection + manual-nudge first

**Decision.** MVP enablement levers are **AGENTS.md/CLAUDE.md instruction
injection** (marked, reversible blocks) and **manual nudges**. Settings/hooks
come later.

**Why.** Text-only, fully reversible, no privileged execution — the safest way to
change behavior. See [16-experiments-engine.md](16-experiments-engine.md).

**Consequence.** Some experiments (e.g. effort level that can't be set
programmatically) run as manual nudges with compliance tracking until a
programmatic lever exists.

---

### ADR-007 — MVP harness: Claude Code only

**Decision.** Ship the **Claude Code** connector first; Codex/Cursor fast-follow.

**Why.** Richest, best-understood, locally-available data (verified layout in
`14`); it's the primary harness of the target user. Cross-harness insights (`11`)
need ≥2 connectors and are explicitly post-MVP.

---

### ADR-008 — Language/tooling: TypeScript on the existing monorepo

**Decision.** Engine and UI in **TypeScript**, reusing this repo's pnpm + Turbo +
Biome + Changesets + Vitest setup.

**Why.** Already in place; one language across engine, UI, and CLI; fast
iteration. Rust appears only in the Tauri shell (ADR-001).

---

### Decisions deferred (need a spike before committing)

- Local-model runtime for Insight (Ollama? which models are good enough?) — see `24`.
- Exact Codex/Cursor on-disk formats — confirm during connector work.
- Statistics library/approach for small-sample experiment grading (`16`).
- Updater mechanism specifics (Tauri updater vs Sparkle).
