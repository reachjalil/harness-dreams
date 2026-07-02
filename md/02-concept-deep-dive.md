# 02 · Concept Deep Dive

*Status: 🟡 Draft*

This document explains the central metaphor and the mental model behind the
product, and pins down how the metaphor maps to concrete mechanics. The metaphor
is a feature — it makes the product memorable and gives the daily ritual emotional
shape — but **clarity always wins over cuteness**.

## The idle → review → wake loop

```
   DAY                         NIGHT                        MORNING
 ┌───────────┐            ┌──────────────────┐          ┌───────────────┐
 │  Harness  │  emits     │   Health Review  │ produces │  Reflection   │
 │  is awake │ ─────────► │  (analysis runs  │ ───────► │  (you review, │
 │  (coding) │ telemetry  │  while you idle)│  report  │  accept,      │
 └───────────┘            └──────────────────┘          │  experiment)  │
       ▲                                                 └───────┬───────┘
       │                  applied changes + enabled experiments  │
       └─────────────────────────────────────────────────────────┘
                          the loop compounds, day over day
```

1. **Awake (day).** You use your harness normally. It writes a complete diary
   of every session to disk. Harness Health does *nothing* intrusive here — no
   mid-task interruptions, no latency tax.
2. **Asleep → Reviewing (night).** When the harness goes idle (or on a schedule,
   or on demand), a **Health Review** runs in the background. It replays the
   day, computes vitals, finds patterns, and drafts findings and experiments.
3. **Waking → Reflection (morning).** You open the menu-bar app to a **Review
   Report**. You skim vitals, accept/reject findings, and opt into experiments.
   Accepted changes and enabled experiments feed back into the harness's config
   and the next day's behavior.

The loop is the product. Everything else is in service of making one turn of
this loop feel valuable and trustworthy.

## Why "reviewing" instead of "live analysis"

Doing this work *during* a coding session would be exactly wrong:

- It would **add latency and token cost** to the task the user actually cares
  about.
- Reflection benefits from the **whole day's context**, not one session.
- The best insights are **cross-project and cross-session** — only visible in
  aggregate, after the fact.

Idle is when consolidation is cheap and safe. That's the whole point.

## Two kinds of reviewing (analysis modes)

The metaphor maps cleanly onto two complementary analysis passes (see
[15-review-engine.md](15-review-engine.md) for the engineering):

| Mode | Human analog | What it does |
|---|---|---|
| **Deterministic Vitals** | memory consolidation | Deterministic: compute vitals, dedupe, organize memory, roll up trends. Cheap, reliable, no LLM creativity needed. |
| **Insight** | creative recombination | LLM-driven: read transcripts, find cross-project patterns, spot mistakes, draft narrative findings and novel experiments. |

Deterministic Vitals makes the report *accurate*; Insight makes it *insightful*. A review runs
Deterministic Vitals first (facts), then Insight (interpretation grounded in those facts).

## The learning flywheel

```
        observe ──► measure ──► hypothesize ──► experiment ──► grade
          ▲                                                      │
          └──────────────────  apply what works  ◄──────────────┘
```

- **Observe**: ingest the day's sessions.
- **Measure**: compute vitals and compare to history.
- **Hypothesize**: generate findings and candidate experiments.
- **Experiment**: the user enables some; the harness behaves differently.
- **Grade**: the *next* review measures the experiment's effect and reports back.
- **Apply**: graduated experiments become permanent config changes.

This is what makes the product compound. A single report is a nice toy; the
flywheel is the moat.

## How "protect you from mistakes" works

A *mistake* is detectable in the transcript trail — e.g. you reverted the
agent's edit, corrected it, re-ran a failed command repeatedly, hit a guardrail,
or asked the same thing three different ways. Harness Health:

1. **Detects** the mistake pattern during Insight (e.g. "agent edited the wrong file
   twice in `project-x` before you redirected it").
2. **Generalizes** it ("this happens when the repo has two files named
   `index.ts` and no AGENTS.md pointer").
3. **Proposes a protection** — a config change, a memory note, or an experiment
   ("add a path hint to AGENTS.md", "enable plan mode for multi-file edits").
4. **Verifies** next review whether the mistake recurred.

Protections are always *proposed*, never silently applied. The user is the
safety valve. See [07-feature-findings-and-actions.md](07-feature-findings-and-actions.md).

## Cross-project intelligence

The single most differentiated capability: because Harness Health sees **all**
your projects, it can relate actions across unrelated codebases.

- "You solved a flaky-test pattern in `agent-fleet` last week; `applied-
  intelligence-hub` shows the same symptom today."
- "Your `zod-to-sql` work and your `sql-export` work both reinvented a schema
  walker — consider sharing it."
- "You use the `deep-research` skill efficiently in research repos but waste
  tokens invoking it in app repos."

No single session has this view. The review does.

## Metaphor guardrails

To keep the metaphor from becoming a liability:

- **Never hide information behind a cute label.** A "Insight insight" must still say
  exactly what it found and why, with evidence.
- **No fake anthropomorphism in data.** Vitals are real numbers with real
  formulas (see [13-metrics-catalog.md](13-metrics-catalog.md)), not vibes.
- **The user is awake and in charge.** "Reviewing" is the machine's job;
  judgment is the human's. Nothing is applied without consent.
- **Plain-language fallback everywhere.** Every review concept has a literal
  name: review = analysis run, vitals = metrics, reflection = review.

See [25-glossary.md](25-glossary.md) for the controlled vocabulary.
