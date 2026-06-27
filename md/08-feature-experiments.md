# 08 · Feature — Experiments

*Status: 🟡 Draft*

Experiments are the product's signature loop and its strongest moat. They turn
"here's a tip" into "here's a hypothesis we'll test on *your* real work and grade
next dream." This doc covers the **experience**; the mechanics (how an experiment
actually changes harness behavior, and how the effect is measured) are in
[16-experiments-engine.md](16-experiments-engine.md).

## The core idea

After reviewing a dream, the user is offered a small set of **experiments** —
concrete, testable changes to how they (or the harness) operate. The user
**enables** the ones they like. The change takes effect in subsequent sessions.
The **next dream** measures the effect and returns a verdict.

> Example: *"When building user interfaces, try **medium** thinking effort."*
> → enable → over the next few UI sessions, effort is nudged to medium →
> next dream: *"You used medium effort on 6 UI tasks. Result: 22% fewer
> follow-up prompts and similar accept rate — **keep it.**"* or
> *"…but you asked for more follow-ups — **medium may be too low here, revert.**"*

## Anatomy of an experiment

```
Experiment
├── title              # "Medium thinking effort for UI tasks"
├── hypothesis         # "Lower effort on UI work reduces cost without hurting quality"
├── scope              # task-type=UI, project(s)=*, harness=claude-code
├── intervention       # the concrete change (see enablement mechanisms in 16)
├── enablement         # how it's applied: agents-md | setting | hook | manual-nudge
├── successMetrics[]   # what we'll measure (re-ask rate, accept rate, tokens, satisfaction)
├── guardrails[]       # auto-stop conditions ("if correction rate +25%, flag")
├── duration           # N sessions or D days (whichever first)
├── status             # proposed | enabled | running | concluded | adopted | rejected
└── result             # filled by the grading dream: verdict + evidence + deltas
```

## Lifecycle

```
 proposed ─► enabled ─► running ─► concluded ─►  adopted   (make permanent)
     │                     │                  └► rejected  (revert / discard)
     └─ user declines      └─ guardrail trips → flagged early
```

- **Proposed**: surfaced at the end of a dream (≤2–3 per report).
- **Enabled**: user opts in; intervention becomes active.
- **Running**: in effect; the app tracks which sessions fall in/out of scope
  (the "treated" set).
- **Concluded**: enough data (duration reached) → the next/relevant dream grades
  it.
- **Adopted**: the change is made permanent (e.g. baked into AGENTS.md).
- **Rejected**: reverted cleanly; recorded so we don't re-propose it blindly.

## How experiments are graded

The grading dream compares **treated** vs **untreated** work (or pre/post) on the
experiment's success metrics, accounting for small samples, and produces a
plain-language verdict with the numbers behind it. It explicitly distinguishes:

- ✅ **Improved** — metrics moved the right way beyond noise.
- ➖ **No effect** — within noise; recommend dropping to reduce complexity.
- ⚠️ **Regressed** — metrics moved the wrong way (e.g. *more* follow-ups);
  recommend revert with the evidence.

The verdict is itself a **Finding** in the next report, with the usual
accept/reject (adopt/revert) actions. See
[16-experiments-engine.md](16-experiments-engine.md) for the statistics.

## Example experiment library (seed ideas)

These ship as templates the engine can instantiate against the user's data:

| Experiment | Hypothesis | Primary metric |
|---|---|---|
| Medium effort for UI tasks | lower effort is enough for UI, saves tokens | re-ask rate, tokens/change |
| Plan mode for multi-file edits | planning first reduces wrong-file mistakes | correction rate |
| Prefer Codex for quick refactors | Codex is faster for small mechanical edits | latency, accept rate |
| Add test-runner hint to AGENTS.md | the agent stops asking how to run tests | re-ask rate |
| Use `verify` skill before "done" | catches regressions, fewer reverts | revert rate |
| Tighten a verbose skill description | reduces mis-triggers and wasted tokens | skill-misfire rate |

## UX principles for experiments

- **One-click enable, one-click revert.** Low commitment or users won't try.
- **Always reversible.** Every intervention records how to undo it.
- **Visible in trends.** Experiment start/stop is marked on metric charts (`06`)
  so the user *sees* the effect.
- **Never silently change behavior.** Enabling is explicit; the user always
  knows which experiments are live (a "Lab" panel lists active experiments).
- **Small batch.** Don't run 10 experiments at once — confounds the measurement
  and overwhelms the user. Cap concurrent experiments (default 2–3).

## The "Lab" panel

A dedicated surface listing: active experiments (with progress: "4/5 sessions"),
concluded experiments awaiting a verdict, and an archive of past results
("medium effort for UI: adopted 3 weeks ago"). This is where the user manages
the portfolio of changes they're testing.
