# 10 · Feature — Chat Assistant

*Status: 🔴 Exploratory (fast-follow, not MVP)*

A conversational interface, grounded in the user's own harness data, for asking
ad-hoc questions and driving optimization through dialogue rather than clicking
through reports.

## Why it exists

Reports answer the questions *we* anticipated. Chat answers the ones we didn't:
- "Why did my token usage spike on Tuesday?"
- "Which project is costing me the most and why?"
- "Compare how I use Claude vs Codex for refactors."
- "Clean up my AGENTS.md across all projects."
- "What's the single highest-impact change I could make this week?"

It's also the natural home for **config optimization as conversation** ("review
my memory and tell me what's stale") and for **explaining findings** ("why do you
think the `verify` skill helped?").

## How it's grounded

The assistant is **retrieval-grounded on the local store**, not a generic chat:

- It has tools to query the normalized event store, vitals, findings,
  experiments, and config artifacts (see [12-data-model.md](12-data-model.md)).
- It cites the same evidence findings do — sessions, events, diffs.
- It can **propose actions** (config diffs, new experiments) inline, which the
  user approves with the same diff-and-confirm flow as everywhere else.
- It respects the same redaction/privacy boundary as REM (see `20`).

Conceptually: the chat assistant is REM-on-demand, scoped to a question, with the
ability to act (with consent).

## Capabilities

| Capability | Example | Acts? |
|---|---|---|
| **Explain** | "Why is my re-ask rate up?" | read-only |
| **Compare** | "Claude vs Codex latency for refactors" | read-only |
| **Diagnose** | "What's hurting my efficiency?" | read-only |
| **Optimize config** | "Tighten my `pdf` skill description" | proposes diff |
| **Design experiment** | "Set up a test for plan-mode on big edits" | proposes experiment |
| **Groom memory** | "What memory is stale in `agent-fleet`?" | proposes edits |

## Interaction surface

- Lives in a panel within the report window (and optionally a quick menu-bar
  "Ask" box).
- Threaded per topic; a chat can be **launched from a finding** ("Explain") with
  that finding's evidence pre-loaded as context.
- Every action it proposes uses the global confirm-with-diff rule — chat is not
  a backdoor around consent.

## Guardrails

- **Grounded or silent.** If the data doesn't support an answer, it says so
  rather than speculating.
- **No write without confirm.** Same as findings/experiments.
- **Cost-aware.** Chat uses the LLM budget; long explorations warn the user.
- **Private.** Same local-first / redaction rules as the dream engine.

## Why it's not in MVP

Chat raises the privacy and cost surface and is only as good as the underlying
data model and metrics. We want vitals, findings, and experiments solid first,
then layer chat on the *same* grounded store. See
[23-roadmap-and-milestones.md](23-roadmap-and-milestones.md).
