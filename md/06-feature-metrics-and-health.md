# 06 · Feature — Metrics & Health

*Status: 🟡 Draft*

This is the Apple-Health-like surface: the at-a-glance read on how your harness
is doing. The full metric definitions live in
[13-metrics-catalog.md](13-metrics-catalog.md); this doc covers how they're
*presented* and *summarized*.

## The Health-app analogy, made concrete

Apple Health works because it (a) reduces a flood of raw signal to a few legible
**summaries**, (b) shows **trends** not just snapshots, and (c) frames everything
relative to **you**. Harness Health mirrors this.

### Vitals (the rings)

Three headline "rings," each a composite score 0–100 with a clear direction:

| Ring | Measures | Up is good when… |
|---|---|---|
| **Efficiency** | tokens & cost per accepted unit of work | you deliver more per token/dollar |
| **Effectiveness** | code delivered, accept rate, low re-ask | the agent gets it right with less back-and-forth |
| **Alignment** | low correction/revert rate, guardrail hits, mistakes avoided | the agent does what you actually wanted |

Rings are **composites** of underlying metrics (defined in `13`), normalized to
the user's own rolling baseline so "closing the ring" means "better than your
recent self," not hitting an arbitrary global target.

> Design note: rings are a summary, not the truth. Tapping any ring drills into
> the real metrics with their formulas and source events. Never let the score
> obscure the number.

## Surfaces

1. **Menu-bar glance** — the three rings + one-line digest. Visible without
   opening a window.
2. **Report → Vitals tab** — rings expanded, with the top metrics, each showing
   value, Δ vs baseline, and a sparkline.
3. **Trends view** — pick any metric, see 7/30/90-day history, annotated with
   experiment start/stop markers and notable findings.
4. **Per-project / per-harness breakdowns** — same metrics sliced by repo, by
   harness, by model.

## Headline metrics (the ones most surfaced)

These are the metrics most likely to lead a report. Full list in `13`.

- **Tokens per accepted change** (efficiency core)
- **Cost ($) per day / per project**
- **Re-ask rate** — how often you re-prompted for the same goal
- **Correction/revert rate** — how often you undid or corrected the agent
- **Tool success rate** — successful vs failed/retried tool calls
- **Cache hit ratio** — `cache_read / (input + cache_read)` from usage data
- **Code delivered** — accepted diff lines / files changed
- **Model mix** — share of work by model, with per-model latency & cost
- **Skill efficiency** — outcome quality vs token cost per skill invocation

## Trends, baselines, deltas

- Every metric has a **rolling baseline** (e.g. trailing 14-day median).
- The report shows **Δ vs baseline** with significance hinting (don't shout
  about noise — see `16` on small-sample handling).
- Trends are annotated with **experiment markers** so the user can *see* the
  effect of an enabled experiment on the curve.

## Example narrative summaries (the "digest")

The review produces a 2–3 sentence plain-language digest from the vitals:

> "Solid day. Tokens-per-change dropped 12% vs your two-week median, mostly in
> `agent-fleet`. One soft spot: re-ask rate ticked up on UI work — there's an
> experiment below to test a fix."

This is the line shown in the menu-bar glance and at the top of the report.

## Anti-patterns to avoid

- **Vanity metrics.** "Total tokens" alone is meaningless without a
  denominator. Always pair volume with an efficiency ratio.
- **Global leaderboards.** We compare you to *you*, not to other users.
- **False precision.** Round sensibly; show confidence; don't imply 3 sig figs
  of meaning from 4 sessions.
- **Metric overload.** The glance shows 3 rings; the report leads with ~6
  metrics; everything else is one drill-down away.
