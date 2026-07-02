# 09 · Feature — Config Optimization & Memory

*Status: 🟡 Draft*

Harness Health doesn't just describe problems — it helps you fix the *durable*
sources of them: your harness configuration and its memory. This is where
findings and experiments turn into permanent improvements.

## The configuration surface

Modern harnesses expose a large, mostly-untuned config surface. Harness Health
reads it, correlates it with outcomes, and proposes edits (always as diffs).

| Artifact | Examples (Claude Code) | What we optimize |
|---|---|---|
| **Agent instructions** | `AGENTS.md`, `CLAUDE.md` (project + user) | clarity, missing hints, stale rules, path/test pointers |
| **Skills** | `~/.claude/skills/**`, plugin skills | descriptions that mis-trigger, unused skills, overlap |
| **MCP servers** | configured MCP servers + `attributionMcpServer` usage | unused servers, high-failure tools, missing capabilities |
| **Settings** | `settings.json`, permission modes, hooks | risky permissions, helpful hooks not enabled |
| **Memory** | per-project `memory/` + `MEMORY.md` index | stale facts, duplicates, missing facts that caused re-asks |

(See [14-ingestion-and-connectors.md](14-ingestion-and-connectors.md) for exactly
where these live and how they're read.)

## How optimization works

1. **Correlate.** During Insight, tie outcomes to config. "Projects with an AGENTS.md
   test hint have a 30% lower 'how do I run tests' re-ask rate." "The `deep-
   research` skill fires in app repos where it's rarely useful."
2. **Propose.** Generate a concrete edit as a **diff** against the real file,
   with a one-line rationale and the evidence behind it.
3. **Review.** The user sees the diff inline and approves, edits, or rejects.
4. **Apply.** On approval, write the change (with a backup/undo). Optionally
   stage it as an **experiment** first if the benefit is uncertain.
5. **Verify.** A later review checks whether the targeted metric moved.

## AGENTS.md / CLAUDE.md optimization (MVP lever)

The highest-leverage, lowest-risk surface — and the MVP's primary write target.

Examples of proposed edits:
- **Add a missing hint:** "Tests run with `pnpm test --filter <pkg>`" (because
  the agent asked or guessed wrong repeatedly).
- **Disambiguate paths:** "When editing `index.ts`, the API entry is
  `packages/core/src/index.ts`" (because the agent edited the wrong file).
- **Prune stale rules:** flag instructions that reference files/flags that no
  longer exist (verified against the repo).
- **Tighten tone/length:** an over-long AGENTS.md correlated with ignored
  instructions.

Every edit is a reviewable diff with a backup, and can be **A/B'd as an
experiment** (apply to some projects, compare) rather than blanket-applied.

## Skills & MCP optimization (fast-follow)

- **Unused skill/MCP detection:** "you haven't triggered `xlsx` in 60 days;
  archive it to reduce selection noise."
- **Misfire detection:** "the `pdf` skill triggered 4× where no PDF was
  involved — its description may be too broad." → propose a tighter description.
- **High-failure MCP tools:** using `attributionMcpServer`/`attributionMcpTool`
  + tool results, flag servers whose tools fail or time out often.
- **Capability gaps:** "you repeatedly hand-rolled HTTP calls an MCP server
  could handle — consider adding one."

## Memory review & consolidation

The harness's memory is itself data to be groomed. Each review can propose:
- **Add** a fact that would have prevented a re-ask ("record the deploy command
  for `waker`").
- **Consolidate** duplicates and merge near-identical notes.
- **Prune** stale/contradicted facts (verified against current repo state).
- **Re-index** `MEMORY.md` so recall stays sharp.

This mirrors how the real `consolidate-memory` skill works, but driven by
review-time evidence about which memories actually helped or were missing.

## Safety model (non-negotiable)

- **Diffs, not surprises.** Every write is previewed as a diff and confirmed.
- **Backups + one-click undo.** Every applied change is reversible; we keep a
  pre-change snapshot.
- **Never touch secrets.** `.env`, credentials, and ignored files are read-only
  context at most and never written or transmitted (see `20`).
- **Respect the harness's own conventions.** We write memory in the harness's
  expected format and location, never a parallel shadow store.

## Relationship to other features

- Findings (`07`) generate the *proposals*.
- Experiments (`08`) let uncertain config changes be *tested* before adoption.
- The chat assistant (`10`) lets the user *ask* "what in my config is hurting
  me?" and act on the answer.
