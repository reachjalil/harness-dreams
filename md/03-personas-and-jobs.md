# 03 · Personas & Jobs-to-be-Done

*Status: 🟡 Draft*

## Primary persona — "The Power Builder"

A heavy individual user of one or more harnesses across **many projects**. Ships
code daily with Claude Code (and dabbles with Codex/Cursor). Technically fluent,
opinionated about tooling, cost-aware, and curious about whether their setup is
actually good. Runs 5–30 sessions a day across a dozen repos. This is the user
the MVP is built for — and matches the owner of this very machine (26 projects
in `~/.claude/projects`, multiple harnesses, active AGENTS.md/skills/MCP usage).

**Pains**
- "I have no idea if my setup is improving or regressing."
- "I keep hitting the same friction and never fix the root cause."
- "Config has sprawled — AGENTS.md, skills, MCP servers — and I don't tune it."
- "I burn tokens and don't know where."

**Gains sought**
- A trustworthy morning signal: better or worse, and why.
- Specific, low-effort improvements I can accept with one click.
- Proof that a change helped before I commit to it.

## Secondary persona — "The Optimizer"

Same as above but motivated primarily by **cost and efficiency**. Wants
token/$/latency dashboards, model-mix recommendations ("Codex is faster for X"),
and aggressive experiments. Treats Harness Health like a performance budget.

## Future persona — "The Team Lead" (post-MVP)

Owns a team's shared harness conventions. Wants **fleet-level** rollups, shared
experiments, and a way to propagate a winning AGENTS.md pattern across the team.
Explicitly **out of MVP scope** (see [04-product-scope.md](04-product-scope.md))
but shapes the data model so we don't paint ourselves into a corner.

## Jobs-to-be-Done

> When **I finish a day of agent-assisted coding**, I want **my harness to
> reflect on what happened**, so I can **wake up to a clear picture and concrete
> ways to improve — without doing the analysis myself.**

Supporting jobs:

| # | When… | I want… | So I can… |
|---|---|---|---|
| J1 | I start my morning | a quick health read on yesterday | know if I'm trending well |
| J2 | something felt off yesterday | the mistakes surfaced and explained | stop repeating them |
| J3 | I'm curious how to improve | tailored experiments to try | get better deliberately |
| J4 | I enabled an experiment | it measured and graded | trust the recommendation |
| J5 | my config feels messy | guided cleanup of AGENTS.md/skills/MCP | reduce friction |
| J6 | I use several tools | to know which is best for what | route work optimally |
| J7 | I want to dig in | to chat with my data | answer ad-hoc questions |

## User stories (MVP-relevant)

- As a Power Builder, I can **start a health review on demand** from the menu bar
  and get a report within minutes.
- As a Power Builder, I **wake up to an overnight review** without configuring
  anything beyond granting access once.
- As a Power Builder, I can **see yesterday's vitals vs. my baseline** at a
  glance.
- As a Power Builder, I can **read a finding, see its evidence, and accept or
  reject it.**
- As a Power Builder, I can **enable a suggested experiment** and have the next
  review grade it.
- As an Optimizer, I can **see my token/cost trend and model mix** over time.
- As a Power Builder, I can **chat with the report** to ask "why is my re-ask
  rate up this week?"

## A day in the life (narrative)

**11:40pm — Idle.** You close your laptop after a long day across three repos.
Harness Health notices the harness has gone idle. A subtle menu-bar animation
shows it's entering a review.

**Overnight — Reviewing.** Deterministic Vitals computes the day's vitals and rolls them
into your 30-day trend. Insight reads the day's transcripts: it notices you re-asked
the model to "actually run the tests" four times in `agent-fleet`, that your
token usage dropped 18% on days you used the `verify` skill, and that two repos
independently reimplemented a CSV parser. It drafts three findings and two
experiments. Everything is redacted and processed locally per your settings.

**8:15am — Reflection.** You open the menu bar to a Health Report. Headline: a
green "Efficiency" ring (tokens-per-accepted-change down 12% week-over-week). You
skim three findings:
- ✅ *Win:* "`verify` skill correlates with fewer re-asks — keep using it."
  → **Accept** (logs the win, reinforces in memory).
- ⚠️ *Mistake:* "4× re-ask to run tests in `agent-fleet`; likely missing a test
  hint in AGENTS.md." → **Accept protection** (adds a one-line AGENTS.md note,
  shown as a diff first).
- 💡 *Opportunity:* "CSV parser duplicated across two repos." → **Snooze.**

Then two experiments:
- 🧪 "Use **medium** thinking effort for UI tasks for the next 5 sessions." →
  **Enable.**
- 🧪 "Try **Codex** for quick refactors; we'll compare latency." → **Enable.**

You spend 90 seconds, close the panel, and start coding. Tomorrow's review will
tell you whether medium effort on UI made you ask for fewer follow-ups — or more.

This 90-second ritual is the product's heartbeat. Everything in these docs
serves making it valuable, fast, and trustworthy.
