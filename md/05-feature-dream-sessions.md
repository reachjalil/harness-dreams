# 05 · Feature — Dream Sessions

*Status: 🟡 Draft*

The Dream Session is the core unit of the product: one analysis run that turns a
window of harness activity into a **Dream Report**. Everything else hangs off
this.

## Definition

A **Dream Session** is a background job that:
1. Selects a **window** of activity (default: since the last dream, typically
   "yesterday").
2. Ingests and normalizes the sessions in that window (see
   [14-ingestion-and-connectors.md](14-ingestion-and-connectors.md)).
3. Runs **Deep Sleep** (deterministic vitals + trends) then **REM** (LLM
   findings + experiments) — see [15-dream-engine.md](15-dream-engine.md).
4. Persists a **Dream Report** artifact and notifies the user.

## Triggers (how a dream starts)

| Trigger | When | MVP |
|---|---|---|
| **Scheduled** | Nightly at a user-set time (default 3:00am) if there's new activity | ✅ |
| **Idle** | Harness has been idle ≥ N minutes and a day's worth of new activity exists | ✅ (simple version) |
| **On-demand** | User clicks "Dream now" in the menu bar | ✅ |
| **Catch-up** | App launch detects missed nights, offers to dream over the gap | 🟡 |

Guardrails: never run two dreams concurrently; skip if no new sessions; cap
token spend per dream (configurable budget, see
[15-dream-engine.md](15-dream-engine.md)).

## Lifecycle / states

```
 queued ─► ingesting ─► deep-sleep ─► rem ─► drafting-report ─► ready
                │             │         │            │
                └─────────────┴─────────┴────────────┴──► failed (with reason)
```

- The menu-bar icon reflects state (resting / dreaming / report-ready).
- A dream is **resumable**: if interrupted, it restarts from the last completed
  stage using cached intermediate results.
- Failures are first-class: a dream can produce a *partial* report (e.g. vitals
  succeeded, REM failed) and say so.

## The Dream Report artifact

The output the user actually sees. Structure:

```
DreamReport
├── header        # date range, harnesses covered, # sessions, overall status
├── vitals        # the rings/headline metrics + deltas vs baseline
├── trends        # 7/30-day sparklines for key metrics
├── findings[]    # wins / mistakes / risks / opportunities (with evidence)
├── experiments   # newly proposed + results of previously-running experiments
├── memory        # proposed memory additions/edits/consolidations
└── digest        # 2-3 sentence plain-language summary ("the TL;DR")
```

See [06](06-feature-metrics-and-health.md), [07](07-feature-findings-and-actions.md),
and [08](08-feature-experiments.md) for each section's spec, and
[12-data-model.md](12-data-model.md) for the persisted schema.

## What makes a *good* dream (quality bar)

- **Fast enough**: a nightly dream over a normal day completes in minutes, not
  hours. On-demand "dream now" returns a usable report quickly (vitals first,
  findings stream in).
- **Grounded**: every finding links to specific sessions/events. No claim
  without a trace.
- **Bounded**: a hard cap on number of findings (e.g. top 3–5 by confidence ×
  impact) so the morning ritual stays ~90 seconds.
- **Comparative**: always framed against the user's own baseline, never absolute
  numbers in a vacuum.
- **Idempotent-ish**: re-running a dream over the same window yields a
  consistent report (modulo LLM nondeterminism, which is bounded by structured
  outputs).

## On-demand vs. overnight

- **Overnight** dreams can be thorough (full REM, cross-project pass, higher
  token budget) because nobody is waiting.
- **On-demand** dreams prioritize latency: compute vitals instantly
  (deterministic), then stream findings as REM completes. The user sees value in
  seconds and richness in a minute.

## Open questions

- Window definition for irregular schedules (someone who codes at 2am) — see
  [24-risks-and-open-questions.md](24-risks-and-open-questions.md).
- Whether to dream per-harness or unified across all harnesses (leaning:
  unified report, per-harness sections).
