# 16 · Experiments Engine

*Status: 🔴 Exploratory (the hard, novel part)*

The product feature is in [08-feature-experiments.md](08-feature-experiments.md).
This doc covers the two genuinely hard engineering problems: **how an experiment
actually changes harness behavior** (enablement) and **how we measure its effect
honestly** (attribution + statistics).

## Problem 1 — Enablement: how do we change behavior?

An experiment is only real if it can actually alter what the harness does. The
levers, from lowest to highest risk:

| Mechanism | How | Risk | MVP? |
|---|---|---|:--:|
| **Instruction injection** | Add/modify a scoped block in `AGENTS.md`/`CLAUDE.md` (project or user level) | low — text only, reversible | ✅ |
| **Memory note** | Write a fact/preference to the harness's memory | low | ✅ |
| **Settings change** | Toggle a documented setting (e.g. default mode) | medium — depends on setting | 🟡 |
| **Hook** | Install a harness hook that nudges behavior at an event | medium–high — executes | 🟡 |
| **Manual nudge** | Tell the *user* to do X (e.g. "pick medium effort") and just track compliance | none — no auto-change | ✅ |

**MVP stance:** support **instruction injection** + **manual nudge**. These are
text-only, fully reversible, and require no privileged execution. Effort/model
experiments that can't be set programmatically fall back to *manual nudge*: the
app reminds the user and measures whether they complied and what resulted.

**Scoping an intervention.** An experiment targets a slice: project(s),
task-type, harness, file globs. Instruction injection writes a clearly-marked,
revertible block, e.g.:

```md
<!-- harness-dreams:experiment:exp_8f3a START -->
For UI tasks (components, styling, layout), prefer medium thinking effort
unless the task is architecturally complex.
<!-- harness-dreams:experiment:exp_8f3a END -->
```

Marked blocks make the change **auditable** and **cleanly removable** on
conclude/revert. Backups are kept regardless.

## Problem 2 — Attribution: which work was "treated"?

To measure an effect we must label each subsequent session/task as **treated**
(intervention in scope) or **control** (out of scope), recorded as
`ExperimentObservation` rows ([12-data-model.md](12-data-model.md)).

Two designs, used per experiment:

1. **Pre/Post** (simplest): compare the metric before vs after `enabledAt` within
   the experiment's scope. Confounded by time trends — use when a clean control
   isn't available.
2. **Treated/Control by scope** (better): the intervention applies only to a
   slice (e.g. UI tasks); non-UI tasks act as a concurrent control for
   general drift. Requires the **task-type classifier**.

We always record *why* a session was counted treated/control so the grading is
explainable.

## Problem 3 — Measurement: is the effect real?

Personal experiments have **tiny samples** (5–20 sessions), so naive p-values
mislead. Approach:

- **Effect size first.** Report the magnitude ("−22% follow-ups") and the sample
  ("over 6 UI sessions"), not just a verdict.
- **Uncertainty intervals.** Use simple, robust intervals (e.g. bootstrap or
  Bayesian credible intervals) suited to small N, and *show* them.
- **Three-bucket verdict** instead of binary significance:
  - ✅ **Improved** — effect direction right and beyond plausible noise.
  - ➖ **Inconclusive** — within noise / too few samples (say "need more data,
    keep running or drop").
  - ⚠️ **Regressed** — effect direction wrong.
- **Guardrail metrics.** Even if the primary metric improves, check secondary
  metrics didn't regress (e.g. tokens down *but* correction rate up).
- **Pre-registration.** Success metrics + duration are fixed at enable-time so we
  don't cherry-pick after seeing the data.

> Honesty rule: most personal experiments will be **inconclusive**, and saying so
> is a feature. Manufacturing false certainty would destroy trust — the whole
> value prop is evidence-based.

## Grading flow

```
 experiment running ──(duration reached or enough obs)──► grade in next dream
   │                                                          │
   │   compute treated vs control deltas on successMetrics    │
   │   + guardrail check + uncertainty interval               ▼
   └─────────────────────────────────────────────► verdict Finding (adopt/revert)
```

The verdict appears as a Finding (`07`) with **Adopt** (make permanent — e.g.
keep the AGENTS.md block, remove the experiment markers) or **Revert** (strip the
block) actions.

## Lifecycle hooks & cleanup

- On **adopt**: convert the marked experiment block into a permanent instruction
  (drop the markers), archive the experiment with its result.
- On **revert**: remove the marked block, restore backup, archive as rejected.
- On **guardrail trip** mid-run: flag early in the next dream, recommend stopping.
- **Concurrency cap**: ≤2–3 active experiments to keep attribution clean and the
  user un-overwhelmed.

## Templates → instances

The seed library (`08`) defines **templates** (hypothesis + metric + enablement
shape). The engine **instantiates** a template against the user's data when the
data supports the hypothesis (e.g. only propose the "test-runner hint" experiment
for repos where re-asks about running tests actually occurred). This keeps
proposals personal and earned, not generic tips.

## Why this is exploratory

Honest small-sample measurement and safe behavior-change are genuinely hard and
worth prototyping early against real data. Expect to iterate on the statistics
and on which enablement levers are reliable. This is the riskiest, most
differentiating component — see [24-risks-and-open-questions.md](24-risks-and-open-questions.md).
