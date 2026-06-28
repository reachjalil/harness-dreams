# 15 · Dream Engine

*Status: 🟡 Draft*

The Dream Engine is the analysis pipeline that turns a window of normalized
events into a Dream Report. It runs two passes — **Deep Sleep** (deterministic)
and **REM** (LLM) — and is the most technically central component.

## Pipeline overview

```
 window selection
        │
        ▼
 ┌──────────────┐   facts    ┌───────────────┐ interpretation ┌──────────────┐
 │  DEEP SLEEP  │ ─────────► │      REM      │ ─────────────► │   ASSEMBLE   │
 │ (vitals,     │            │ (findings,    │                │ (rank, cap,  │
 │  trends,     │            │  improvements,│                │  digest,     │
 │  dedupe)     │            │  config recs) │                │  persist)    │
 └──────────────┘            └───────────────┘                └──────────────┘
```

## Stage 1 — Deep Sleep (deterministic)

No LLM. Pure computation, so it's fast, cheap, reproducible, and always
available even offline.

1. **Aggregate** events → `VitalsSnapshot` per scope (global/project/harness/
   model) using the formulas in [13-metrics-catalog.md](13-metrics-catalog.md).
2. **Baseline & delta**: compare to trailing-window baselines; tag significance.
3. **Segment**: derive goals/turns, detect re-asks, corrections, reverts, retries
   (the classifiers flagged in `13`).
4. **Detect accepted changes** by correlating proposed edits with `file-history`
   and survival (no later revert).
5. **Dedupe & roll up** trends; attach improvement markers.

Output: a complete, grounded facts package. If REM fails, the report still ships
with vitals + trends.

## Stage 2 — REM (LLM-driven)

Takes the facts package + curated, **redacted** event excerpts and produces
interpretation. Uses the Claude API (see model strategy below) with **structured
outputs** so results are typed, not free text.

REM sub-tasks (each a focused, schema-constrained call):
- **Finding generation** — wins/mistakes/risks/opportunities, each with
  mandatory evidence refs + self-assessed confidence (`07`).
- **Mistake classification** — label mistake events with cause hypotheses.
- **Config correlation** — tie outcomes to AGENTS.md/skill/MCP state → proposed
  edits (`09`).
- **Improvement ideation** — propose ≤2–3 testable improvements tied to
  findings (`08`).
- **Cross-project pass** — relate patterns across repos (`11`); overnight only
  (more expensive).
- **Digest** — the 2–3 sentence TL;DR.

### Grounding & anti-hallucination

- REM only sees **facts + cited excerpts**; it must reference event IDs that
  exist. Assembly **drops any finding whose evidence refs don't resolve.**
- Confidence is **required** and findings below threshold are filtered.
- Correlations are labeled as correlations in the prompt contract.
- Structured output schemas forbid vibes-only claims (every finding needs
  `evidence[]`).

## Stage 3 — Assemble

- **Rank** findings by `confidence × impact`; **cap** to the report budget
  (default ≤5 findings, ≤3 improvements).
- **Dedupe** against recent reports + the user's snooze/reject history (`07`).
- Build the `DreamReport` artifact and persist (`12`).
- Emit the notification / update menu-bar state.

## Model strategy

| Task | Suggested tier | Why |
|---|---|---|
| Pre-filtering, classification, segmentation help | small/fast (e.g. Haiku) | cheap, high-volume |
| Finding generation, config recs, cross-project | strong reasoning (e.g. Opus) | quality matters most here |
| Digest | small/fast | short, cheap |

Exact model IDs and pricing come from the Claude API reference, not hardcoded
guesses (see `13`/`24`). A **token budget per dream** is enforced; overnight
dreams get a larger budget than on-demand ones. Local-model execution (e.g.
Ollama) is a future privacy option (`20`).

## Scheduling & execution

- A background **scheduler** (`17`, `18`) triggers dreams (scheduled/idle/manual).
- Dreams run as a **resumable job** with per-stage checkpoints; interruption
  restarts from the last completed stage.
- **Concurrency**: one dream at a time; new triggers queue or coalesce.
- **Budget guard**: hard cap on token spend; degrade gracefully (skip the
  expensive cross-project pass before failing the whole dream).

## On-demand fast path

For "Dream now," return value progressively:
1. Deep Sleep vitals render immediately (deterministic, ~instant).
2. REM findings stream in as each schema-constrained call completes.
3. The report is "ready" once core findings land; cross-project can finish
   lazily.

## Determinism & testability

- Deep Sleep is fully unit-testable against fixture transcripts.
- REM is tested with **recorded fixtures** + schema validation + golden-ish
  assertions on structure (not exact wording).
- The whole engine runs **headless via the CLI** (`apps/cli`) for CI and
  reproducibility (see [21-monorepo-and-packages.md](21-monorepo-and-packages.md)).
