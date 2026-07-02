# 04 · Product Scope

*Status: 🟡 Draft*

This document draws the line between the full product vision and what we
actually build first. It is the contract the roadmap
([23-roadmap-and-milestones.md](23-roadmap-and-milestones.md)) delivers against.

## Product principles

These are the tie-breakers. When a decision is unclear, these decide.

1. **Local-first and private by default.** Your transcripts contain code and
   secrets. Processing happens on-device; any cloud LLM call is opt-in and
   redacted. See [20-privacy-and-security.md](20-privacy-and-security.md).
2. **Evidence over vibes.** Every vital has a formula; every finding cites the
   sessions and events it came from. No unfalsifiable claims.
3. **The human is always in control.** Nothing is applied to your config,
   memory, or harness without explicit consent and a visible diff.
4. **Non-intrusive.** Zero latency or token tax on live coding. Work happens at
   idle, in the background.
5. **Worth the 90 seconds.** The morning ritual must earn its place. Bias to a
   few high-confidence items over an exhausting wall of analysis.
6. **Compounding, not one-shot.** Features that build the flywheel (experiments,
   trends, memory) beat features that produce a pretty one-off report.
7. **Honest about uncertainty.** Low-confidence findings are labeled as such.
   Correlation is not dressed up as causation.

## In scope (the full product)

- Ingestion connectors for major harnesses (Claude Code, Codex, Cursor).
- Overnight + on-demand health reviews with a Health-app-style report.
- A vitals/metrics engine with trends and baselines.
- Findings (wins, mistakes, risks, opportunities) with accept/reject and
  evidence.
- Mistake-protection proposals (config/memory changes shown as diffs).
- A personal experiments engine: define → enable → measure → grade.
- Config optimization for AGENTS.md/CLAUDE.md, skills, and MCP servers.
- Memory review and consolidation.
- Comparative insights across harnesses, models, and projects.
- A conversational assistant grounded in your own data.
- A macOS menu-bar app + background scheduler.

## Out of scope (explicit non-goals)

- ❌ **Live/in-session intervention.** We never sit in the hot path of a coding
  session. (Reflection is offline by design.)
- ❌ **Being a harness.** We don't write your code or replace Claude Code/Codex.
  We observe and advise.
- ❌ **A generic observability/APM product.** No live dashboards-for-their-own-
  sake, no alerting infra.
- ❌ **Team/fleet features in MVP.** Multi-user, shared experiments, and
  org rollups come later (data model leaves room).
- ❌ **Cloud SaaS / accounts in MVP.** No server, no login. Local app only.
- ❌ **Windows/Linux in MVP.** macOS menu-bar app first.
- ❌ **Auto-applying changes without consent.** Ever.
- ❌ **Selling or transmitting user data.** Not a non-goal so much as a hard line.

## The MVP boundary

The MVP is the **smallest loop that is worth opening every morning** for a single
Power Builder using Claude Code on macOS.

**MVP includes:**
- Claude Code connector only (ingest `~/.claude/projects/**` + settings/skills).
- On-demand review + nightly scheduled review.
- Deterministic Deterministic Vitals vitals (tokens, cost, sessions, model mix, tool
  success, re-ask rate) with 7/30-day trends.
- Insight findings (wins/mistakes/opportunities) with evidence and accept/reject.
- The experiments engine for **one** enablement mechanism (AGENTS.md /
  instruction injection — the lowest-risk lever) with grading next review.
- Menu-bar app with: start review, view latest report, history, basic settings.
- Local SQLite storage; Claude API for Insight with redaction + explicit opt-in.

**MVP excludes (fast-follow):**
- Codex/Cursor connectors.
- Chat assistant.
- Config optimization beyond AGENTS.md (skills/MCP tuning).
- Comparative cross-harness insights (needs ≥2 connectors).
- Hooks/settings-based experiment enablement mechanisms.

See [23-roadmap-and-milestones.md](23-roadmap-and-milestones.md) for the phased
breakdown and definition of done per phase.

## Scope summary table

| Capability | MVP | Fast-follow | Later |
|---|:--:|:--:|:--:|
| Claude Code ingestion | ✅ | | |
| Codex / Cursor ingestion | | ✅ | |
| Vitals + trends | ✅ | | |
| Findings + accept/reject | ✅ | | |
| Mistake protections | ✅ | | |
| Experiments (AGENTS.md lever) | ✅ | | |
| Experiments (hooks/settings levers) | | ✅ | |
| Config tuning (skills/MCP) | | ✅ | |
| Comparative insights | | ✅ | |
| Chat assistant | | ✅ | |
| Menu-bar app + scheduler | ✅ | | |
| Team/fleet features | | | ✅ |
| Cross-platform (Win/Linux) | | | ✅ |

## Definition of "done" for MVP

A real user (the owner of this machine) runs Harness Health for two weeks and:
- opens the morning report on the majority of days,
- accepts at least some findings,
- enables and grades at least one experiment end-to-end,
- can point to one measured improvement in their vitals.
