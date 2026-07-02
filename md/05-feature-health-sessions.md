# 05 · Feature — Health Reviews

*Status: 🟡 Draft*

The Health Review is the core unit of the product: one analysis run that turns a
window of harness activity into a **Health Report**. Everything else hangs off
this.

## Definition

A **Health Review** is a background job that:
1. Selects a **window** of activity (default: since the last review, typically
   "yesterday").
2. Ingests and normalizes the sessions in that window (see
   [14-ingestion-and-connectors.md](14-ingestion-and-connectors.md)).
3. Runs **Deterministic Vitals** (deterministic vitals + trends) then **Insight** (LLM
   findings + improvements) — see [15-review-engine.md](15-review-engine.md).
4. Persists a **Health Report** artifact and notifies the user.

## Triggers (how a review starts)

| Trigger | When | MVP |
|---|---|---|
| **Scheduled** | Nightly at a user-set time (default 3:00am) if there's new activity | ✅ |
| **Idle** | Harness has been idle ≥ N minutes and a day's worth of new activity exists | ✅ (simple version) |
| **On-demand** | User clicks "Run Health Review" in the menu bar | ✅ |
| **Catch-up** | App launch detects missed nights, offers to review over the gap | 🟡 |

Guardrails: never run two reviews concurrently; skip if no new sessions; cap
token spend per review (configurable budget, see
[15-review-engine.md](15-review-engine.md)).

## Lifecycle / states

```
 queued ─► ingesting ─► deep-idle ─► rem ─► drafting-report ─► ready
                │             │         │            │
                └─────────────┴─────────┴────────────┴──► failed (with reason)
```

- The menu-bar icon reflects state (resting / reviewing / report-ready).
- A review is **resumable**: if interrupted, it restarts from the last completed
  stage using cached intermediate results.
- Failures are first-class: a review can produce a *partial* report (e.g. vitals
  succeeded, Insight failed) and say so.

## The Health Report artifact

The output the user actually sees. Structure:

```
HealthReport
├── header        # date range, harnesses covered, # sessions, overall status
├── vitals        # the rings/headline metrics + deltas vs baseline
├── trends        # 7/30-day sparklines for key metrics
├── findings[]    # wins / mistakes / risks / opportunities, each with a suggested improvement
├── improvements  # tracked suggested improvements + results from prior tracked changes
├── memory        # proposed memory additions/edits/consolidations
└── digest        # 2-3 sentence plain-language summary ("the TL;DR")
```

See [06](06-feature-metrics-and-health.md), [07](07-feature-findings-and-actions.md),
and [08](08-feature-experiments.md) for each section's spec, and
[12-data-model.md](12-data-model.md) for the persisted schema.

## What makes a *good* review (quality bar)

- **Fast enough**: a nightly review over a normal day completes in minutes, not
  hours. On-demand "run health review" returns a usable report quickly (vitals first,
  findings stream in).
- **Grounded**: every finding links to specific sessions/events. No claim
  without a trace.
- **Bounded**: a hard cap on number of findings (e.g. top 3–5 by confidence ×
  impact) so the morning ritual stays ~90 seconds.
- **Comparative**: always framed against the user's own baseline, never absolute
  numbers in a vacuum.
- **Idempotent-ish**: re-running a review over the same window yields a
  consistent report (modulo LLM nondeterminism, which is bounded by structured
  outputs).

## On-demand vs. overnight

- **Overnight** reviews can be thorough (full Insight, cross-project pass, higher
  token budget) because nobody is waiting.
- **On-demand** reviews prioritize latency: compute vitals instantly
  (deterministic), then stream findings as Insight completes. The user sees value in
  seconds and richness in a minute.

## Open questions

- Window definition for irregular schedules (someone who codes at 2am) — see
  [24-risks-and-open-questions.md](24-risks-and-open-questions.md).
- Whether to review per-harness or unified across all harnesses (leaning:
  unified report, per-harness sections).
