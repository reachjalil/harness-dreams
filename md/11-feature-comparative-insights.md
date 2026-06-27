# 11 · Feature — Comparative Insights

*Status: 🟡 Draft (needs ≥2 connectors; fast-follow)*

The payoff of seeing **everything**: comparisons no single session or single
tool can make. Three axes of comparison.

## 1. Cross-harness (Claude Code vs Codex vs Cursor)

Once ≥2 harness connectors are active, Harness Dreams can route-advise:

> "You used Claude more than Codex this period. For quick refactors, Codex
> averaged 40% lower latency and similar accept rate — consider routing those to
> Codex."

Per **task archetype** (refactor, new feature, debugging, UI, research,
docs…), compare harnesses on latency, cost, accept rate, re-ask rate, and
correction rate. Output is a **routing recommendation**, ideally instantiated as
an experiment ("try Codex for refactors for a week").

Requires a **task-type classifier** (see [15-dream-engine.md](15-dream-engine.md))
so comparisons are apples-to-apples.

## 2. Cross-model (within a harness)

Most harnesses let you pick models / effort levels. Compare them on the same
task archetypes using your real work:

> "On UI tasks, high effort cost 2.3× the tokens of medium for no measurable
> accept-rate gain. Medium looks sufficient here."

This is the data that *generates* effort/model experiments (`08`) and grades
them. The `message.usage` and model fields in transcripts make this directly
measurable (see [13-metrics-catalog.md](13-metrics-catalog.md)).

## 3. Cross-project (pattern transfer)

The most novel axis: relate work across **unrelated repos**.

- **Duplicated solutions:** "A schema walker was reimplemented in `zod-to-sql`
  and `sql-export` — consider extracting a shared package."
- **Pattern transfer:** "The flaky-test fix that worked in `agent-fleet` applies
  to a failing pattern now appearing in `applied-intelligence-hub`."
- **Config divergence:** "Your best-performing repos all have an AGENTS.md test
  hint; three repos missing it have higher re-ask rates."
- **Habit detection:** "You consistently burn tokens re-explaining your stack at
  the start of sessions — a shared user-level instruction would fix this once."

Cross-project insight is what makes the dream more than the sum of its sessions.

## How comparisons stay honest

- **Normalize by task type & size**, never raw totals. Comparing a one-line tweak
  to a feature build is meaningless.
- **Control for confounds** where possible (project, time-of-day) and *say* when
  you can't.
- **Small-sample humility** (see `16`): "based on only 5 Codex sessions" is
  always stated.
- **Recommend, then test.** The output of a comparison is usually an experiment,
  not an instant verdict — so the recommendation gets validated on the user's
  own future work.

## Surfaces

- A **Compare** view in the report: pick an axis (harness / model / project) and
  a task archetype, see the head-to-head.
- Comparative findings flow into the normal findings list (`07`) with
  accept/experiment actions.
- The chat assistant (`10`) can run comparisons on demand.

## Dependencies

- ≥2 connectors for cross-harness (so post-MVP).
- The task-type classifier for fair archetype matching.
- Enough history for stable baselines.
