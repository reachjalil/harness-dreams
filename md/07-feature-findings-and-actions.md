# 07 · Feature — Findings & Actions

*Status: 🟡 Draft*

Vitals tell you *what* happened in numbers. **Findings** tell you *what it means*
and *what to do about it* — in plain language, with evidence, and with a single
clear action.

## What a finding is

A **Finding** is an LLM-generated (REM) insight grounded in specific events. Four
types:

| Type | Icon | Meaning | Example |
|---|---|---|---|
| **Win** | ✅ | Something worked; reinforce it | "Days using the `verify` skill had 18% fewer re-asks." |
| **Mistake** | ⚠️ | Something went wrong; protect against recurrence | "Agent edited the wrong `index.ts` twice before redirect." |
| **Risk** | 🛡️ | A latent hazard worth pre-empting | "No AGENTS.md in `waker`; high tool-failure rate there." |
| **Opportunity** | 💡 | A way to do better | "CSV parser duplicated across two repos." |

## Anatomy of a finding

```
Finding
├── type            # win | mistake | risk | opportunity
├── title           # one line, plain language
├── body            # 2-4 sentences: what, where, why it matters
├── confidence      # low | medium | high (REM must justify)
├── impact          # estimated size (tokens/$/time/quality)
├── evidence[]      # links to sessions, events, line ranges, diffs
├── scope           # which project(s)/harness(es)/model(s)
├── proposedAction  # the one recommended next step (see below)
└── state           # new | accepted | rejected | snoozed | applied
```

**Evidence is mandatory.** A finding with no traceable events is a bug, not a
finding. The UI lets the user expand evidence to see the actual session
moments (redacted per privacy settings).

## Actions on a finding

Each finding has **one primary action** plus secondary options:

| Action | Effect |
|---|---|
| **Accept** | Acknowledge; for wins, log + reinforce in memory; for others, proceed to the proposed action |
| **Accept protection** *(mistakes/risks)* | Apply the proposed config/memory change — **always shown as a diff first** |
| **Turn into experiment** | Convert an opportunity/recommendation into a tracked experiment (see `08`) |
| **Snooze** | Hide for N days; re-surface only if it recurs/worsens |
| **Reject** | Dismiss; record the rejection so future dreams learn not to resurface it |
| **Explain** | Open chat (`10`) scoped to this finding's evidence |

Rejections and snoozes are **signal**: the dream engine uses them to calibrate
(stop proposing things this user reliably dislikes).

## Proposed actions & "mistake protection"

The differentiator: a finding doesn't just describe a problem, it proposes a
*concrete, reviewable fix*. Proposed-action kinds:

- **Config change** — e.g. add a line to AGENTS.md, adjust a skill description,
  toggle a setting. Rendered as a **diff** the user approves.
- **Memory note** — e.g. record "in `agent-fleet`, tests run via `pnpm test
  --filter`." Written to the harness's memory on accept.
- **Experiment** — when the fix is uncertain, propose testing it rather than
  applying it (links to `08`).
- **Behavioral nudge** — advice with no automatic change ("consider plan mode
  for multi-file edits"), optionally reinforced via memory.

**Hard rule:** no proposed action is applied without an explicit, per-action
confirmation showing exactly what will change. See
[20-privacy-and-security.md](20-privacy-and-security.md) and
[09-feature-config-and-memory.md](09-feature-config-and-memory.md).

## How findings are generated (brief)

REM reads normalized events + vitals deltas and is prompted to produce
**structured** findings (JSON schema enforced) with mandatory evidence pointers
and self-assessed confidence. The engine then:
1. **Filters** low-confidence / low-impact findings.
2. **Dedupes** against recent reports and snoozed/rejected history.
3. **Ranks** by confidence × impact and caps the count (default ≤5).
4. **Attaches** a proposed action per finding.

Details in [15-dream-engine.md](15-dream-engine.md).

## Quality & trust guardrails

- **Calibrated confidence.** REM must label correlation as correlation. "Days
  with X had less Y" never silently becomes "X causes less Y."
- **No nagging.** Snooze/reject is respected. Recurrence is the only reason a
  dismissed finding returns.
- **Local provenance.** Evidence always points to real on-disk events the user
  can inspect.
- **Small-N humility.** Findings from a handful of sessions are explicitly
  marked low-confidence.
