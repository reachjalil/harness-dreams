# 08 · Feature — Suggested Improvements

*Status: 🟡 Draft*

Suggested improvements are the product's signature loop and its strongest moat.
They turn "here's a tip" into "here's a concrete change we'll reflect on using
*your* real work." This doc covers the **experience**; the mechanics (how a
tracked improvement changes harness behavior, and how the effect is measured)
are in
[16-experiments-engine.md](16-experiments-engine.md).

## The core idea

After reviewing a dream, the user is offered a small set of **suggested
improvements** — concrete, testable changes to how they (or the harness)
operate. The user **tracks** the ones they like. The change takes effect in
subsequent sessions. The **next dream** measures the effect and returns a
reflection.

> Example: *"When building user interfaces, try **medium** thinking effort."*
> → track → over the next few UI sessions, effort is nudged to medium →
> next dream: *"You used medium effort on 6 UI tasks. Result: 22% fewer
> follow-up prompts and similar accept rate — **keep it.**"* or
> *"…but you asked for more follow-ups — **medium may be too low here, revert.**"*

## Anatomy of a suggested improvement

```
SuggestedImprovement
├── title              # "Medium thinking effort for UI tasks"
├── hypothesis         # "Lower effort on UI work reduces cost without hurting quality"
├── agentBenefit       # how the harness/agent behavior should improve
├── userBenefit        # how the user's workflow should improve
├── reflection         # what the next report should keep checking
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
 suggested ─► tracked ─► measuring ─► concluded ─►  adopted   (make permanent)
     │                     │                  └► rejected  (revert / discard)
     └─ user declines      └─ guardrail trips → flagged early
```

- **Suggested**: surfaced at the end of a dream (≤2–3 per report).
- **Tracked**: user opts in; intervention becomes active.
- **Measuring**: in effect; the app tracks which sessions fall in/out of scope
  (the "treated" set).
- **Concluded**: enough data (duration reached) → the next/relevant dream grades
  it.
- **Adopted**: the change is made permanent (e.g. baked into AGENTS.md).
- **Rejected**: reverted cleanly; recorded so we don't re-propose it blindly.

## How suggested improvements are reflected on

The grading dream compares **treated** vs **untreated** work (or pre/post) on the
improvement's success metrics, accounting for small samples, and produces a
plain-language reflection with the numbers behind it. It explicitly
distinguishes:

- ✅ **Improved** — metrics moved the right way beyond noise.
- ➖ **No effect** — within noise; recommend dropping to reduce complexity.
- ⚠️ **Regressed** — metrics moved the wrong way (e.g. *more* follow-ups);
  recommend revert with the evidence.

The reflection is itself a **Finding** in the next report, with the usual
accept/reject (adopt/revert) actions. See
[16-experiments-engine.md](16-experiments-engine.md) for the statistics.

## Example improvement library (seed ideas)

These ship as templates the engine can instantiate against the user's data:

| Suggested improvement | Hypothesis | Primary metric |
|---|---|---|
| Medium effort for UI tasks | lower effort is enough for UI, saves tokens | re-ask rate, tokens/change |
| Plan mode for multi-file edits | planning first reduces wrong-file mistakes | correction rate |
| Prefer Codex for quick refactors | Codex is faster for small mechanical edits | latency, accept rate |
| Add test-runner hint to AGENTS.md | the agent stops asking how to run tests | re-ask rate |
| Use `verify` skill before "done" | catches regressions, fewer reverts | revert rate |
| Tighten a verbose skill description | reduces mis-triggers and wasted tokens | skill-misfire rate |

## UX principles for suggested improvements

- **One-click track, one-click revert.** Low commitment or users won't try.
- **Always reversible.** Every intervention records how to undo it.
- **Visible in trends.** Improvement start/stop is marked on metric charts (`06`)
  so the user *sees* the effect.
- **Never silently change behavior.** Tracking is explicit; the user always
  knows which improvements are live (an "Improvements" panel lists active ones).
- **Small batch.** Don't track 10 improvements at once — confounds the
  measurement and overwhelms the user. Cap concurrent improvements (default 2–3).

## The "Improvements" panel

A dedicated surface listing: active improvements (with progress: "4/5 sessions"),
concluded improvements awaiting a reflection, and an archive of past results
("medium effort for UI: adopted 3 weeks ago"). This is where the user manages
the portfolio of changes they're tracking.
