# 01 · Vision & Strategy

*Status: 🟡 Draft*

## The problem

AI coding harnesses (Claude Code, Codex, Cursor) run all day and then forget.
Every session starts cold. The system accumulates an enormous, high-resolution
trail of what happened — every prompt, tool call, token, edit, correction,
retry, and model choice — and **none of it is ever reflected on**. The human
keeps making the same configuration mistakes, the harness keeps repeating the
same inefficiencies, and the rich signal sitting in `~/.claude/projects/**`
(and equivalents) is never turned into learning.

Today the only "feedback loop" is the human noticing, in the moment, that
something felt slow or wrong — and usually not even acting on it. There is:

- **No memory of yesterday.** Wins and mistakes evaporate at session end.
- **No cross-project view.** A pattern you solved in project A never helps
  project B.
- **No measurement.** Nobody can tell you whether your token usage is trending
  up or down, or whether a config change actually helped.
- **No experimentation.** "Should I use medium thinking effort for UI work?" is
  answerable from your own data — but nobody is asking or testing it.

> Your harness has been awake too long. It's time to idle on it.

## The insight

A coding harness produces a **complete, structured diary of its own behavior**
every single day. That diary is the perfect substrate for offline reflection —
the same way idle consolidates a human's day into memory and learning. The work
doesn't need to happen live (which would slow the agent down and cost tokens
mid-task). It should happen **overnight, in the background, while the harness
rests** — exactly when the machine and the human are both idle.

This is the obvious missing layer, and it unlocks a category: a **reflection and
optimization tier** that sits above the harness, watches everything, and
compounds learning over time.

## Vision

> **Harness Health is the health app for your AI coding harnesses.** It turns the
> exhaust of every agent session into measured, compounding improvement —
> reviewed by you each morning, applied with your consent, and graded by the next
> night's review.

Three-year vision: every serious harness user wakes up to a Health Report the way
they check their step count — and their harness measurably gets cheaper, faster,
and more aligned to how *they* work, month over month, without them having to
become a prompt engineer.

## Value proposition

| For the user | Harness Health delivers |
|---|---|
| "Is my setup getting better or worse?" | Trends on cost, tokens, code delivered, re-ask rate |
| "What did I do wrong yesterday?" | Mistake findings + protections so it doesn't recur |
| "How do I improve?" | Concrete, testable experiments tailored to *your* data |
| "Did that change actually help?" | Every experiment is measured and graded next review |
| "Which tool/model when?" | Comparative insights (Claude vs Codex, effort levels…) |
| "My config is a mess." | Guided tuning of AGENTS.md, skills, MCP servers, memory |

The core promise: **evidence-based self-improvement for the human+harness system,
with the human always in control.**

## Why now

- Harnesses now emit **rich, structured telemetry** locally (tokens, cache hits,
  model, MCP attribution, tool outcomes, git branch) — see
  [14-ingestion-and-connectors.md](14-ingestion-and-connectors.md).
- **Config surface exploded**: AGENTS.md/CLAUDE.md, skills, MCP servers, hooks,
  thinking-effort levels, model choice. Nobody tunes it deliberately.
- Models are now **good enough to analyze their own transcripts** and produce
  genuinely useful, specific findings — cheaply, overnight, in batch.
- Users run **many harnesses across many projects** and have zero cross-cutting
  view.

## Positioning

Harness Health is **not** an observability dashboard (Datadog for agents), a
prompt manager, or an eval harness — though it borrows from all three.

- vs. **observability tools**: those show you live charts; we *reflect* and
  *recommend* and *experiment*, asynchronously, in plain language.
- vs. **eval frameworks**: those test models on fixed benchmarks; we measure
  *your real work* and run *your personal experiments*.
- vs. **doing nothing** (the status quo): the realistic competitor. The bar is
  "worth opening every morning."

The defensible wedge: **the overnight reflection ritual + the personal
experiment loop**, both grounded in the user's own private data.

## What success looks like

- A user opens the Health Report most mornings (habit formed).
- Measured improvement in their own vitals over 30/60/90 days.
- Experiments are enabled, graded, and acted on — not just generated.
- Findings are trusted enough that "accept" is the common action.

See [04-product-scope.md](04-product-scope.md) for what we build first and
[24-risks-and-open-questions.md](24-risks-and-open-questions.md) for what could
break this thesis.
