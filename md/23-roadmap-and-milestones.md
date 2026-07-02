# 23 · Roadmap & Milestones

*Status: 🟡 Draft*

Phased delivery from nothing to the full vision. Each phase has a goal, a scope,
and a **definition of done** (DoD). Phases are sequenced so each one is
independently useful and de-risks the next. Scope boundaries come from
[04-product-scope.md](04-product-scope.md).

## Phase 0 — Foundations & spikes

**Goal:** prove the riskiest assumptions before building UI.

- Stand up engine packages skeleton (`core`, `store`, `connectors`, `ingest`,
  `metrics`) per [21-monorepo-and-packages.md](21-monorepo-and-packages.md).
- Build the **Claude Code connector** + normalizer against real transcripts.
- Compute a handful of **Deterministic Vitals vitals** from real data (tokens, cost,
  re-ask proxy, tool success) via `apps/cli`.
- **Spike Insight**: feed redacted excerpts to the Claude API, get structured
  findings back; sanity-check quality and cost.
- **Spike experiments**: prototype instruction-injection + grading math on real
  data (`16`).

**DoD:** `harness-health review --since=yesterday` runs headless and prints real
vitals + a few real findings for the owner's machine. We believe (or disprove)
that findings are good enough to be worth shipping.

## Phase 1 — MVP (the morning ritual)

**Goal:** a single Power Builder on Claude Code/macOS opens a useful report each
morning. This is the [04](04-product-scope.md) MVP.

- **Engine:** Deterministic Vitals vitals + 7/30-day trends; Insight findings
  (wins/mistakes/opportunities) with evidence + accept/reject; experiments engine
  with the **AGENTS.md/manual-nudge** lever and next-review grading.
- **App:** Tauri menu-bar shell — glance (rings+digest), report window (vitals /
  findings / experiments), basic settings, **Run Health Review** + nightly schedule.
- **Persistence:** SQLite store; backups for any config write.
- **Privacy:** local-first; cloud Insight opt-in with redaction + preview;
  local-only mode produces vitals-only reports.

**DoD (= MVP DoD from `04`):** the owner runs it for two weeks, opens the report
most mornings, accepts findings, enables+grades ≥1 experiment end-to-end, and can
point to one measured vitals improvement.

## Phase 2 — Depth & trust

**Goal:** make findings and experiments genuinely trustworthy and richer.

- Better classifiers: accepted-change detection, goal/re-ask segmentation,
  task-type classifier.
- Experiment grading hardening (uncertainty intervals, guardrails, three-bucket
  verdicts — `16`).
- Config optimization beyond AGENTS.md: **skills + MCP** audits (`09`).
- Trends UX with experiment/config annotations (`19`).
- Memory review & consolidation proposals.

**DoD:** experiment verdicts are calibrated (no false certainty); config audits
produce accepted changes; users trust "accept" as the default action.

## Phase 3 — Breadth (multi-harness & comparison)

**Goal:** unlock the cross-cutting insights only possible with more data.

- **Codex connector** (then Cursor) mapped to the shared model (`14`).
- **Comparative insights** (`11`): cross-harness routing, cross-model effort,
  cross-project pattern transfer.
- Comparison surfaces + routing experiments.

**DoD:** the app can credibly say "use Codex for refactors / medium effort for
UI" with evidence, and instantiate it as an experiment.

## Phase 4 — Conversation & polish

**Goal:** make the data explorable and the product delightful.

- **Chat assistant** (`10`) grounded on the local store, able to explain,
  compare, and propose actions (with consent).
- Onboarding polish, notifications tuning, accessibility pass.
- Local-model Insight option for privacy-max users (`20`/`22`).

**DoD:** a user can ask "what should I change this week?" and get a grounded,
actionable answer; local-only users get LLM findings without cloud.

## Phase 5 — Beyond the individual (exploratory)

**Goal:** extend past the solo Power Builder when the single-user product is
proven.

- Optional team/fleet rollups and shared experiments (`03`); the data model
  (`12`) already leaves room.
- Cross-platform (Windows/Linux) shells.
- Plugin API for third-party harness connectors.

**DoD:** decided later, gated on MVP–Phase 4 success.

## Sequencing rationale

- **Engine before UI** (Phase 0) so we never build a beautiful shell over a
  weak core.
- **Single harness before many** (ADR-007) — depth first, breadth second.
- **One safe experiment lever before many** (ADR-006) — prove the loop with the
  lowest-risk mechanism.
- **Trust before breadth before conversation** — each phase makes the next more
  valuable.

## Cross-cutting, every phase

- Privacy/redaction stays correct as surfaces grow (`20`).
- Headless `apps/cli` keeps the engine CI-testable (`21`).
- Vitals/findings quality is continuously checked against the owner's real data.
