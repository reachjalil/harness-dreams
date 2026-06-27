# 18 · macOS App

*Status: 🟡 Draft*

The shell: a macOS **menu-bar (status-item) app** that hosts the UI and keeps the
scheduler alive. Technology rationale is in
[22-tech-decisions-adr.md](22-tech-decisions-adr.md) (recommended: **Tauri v2**;
Electron is the documented fallback).

## App archetype

A **background, menu-bar-first** app — not a dock app with a big window. It lives
in the top toolbar, runs quietly, and surfaces a panel on click. Closing the
panel doesn't quit it; the scheduler keeps running.

- `LSUIElement`-style agent (no dock icon by default; optional).
- Launch-at-login (opt-in).
- Lightweight when idle — it's a health app running in the background, so memory
  footprint matters (a key reason to favor Tauri over Electron).

## Surfaces

| Surface | Trigger | Contents |
|---|---|---|
| **Menu-bar icon** | always | state glyph (resting / dreaming / report-ready) |
| **Glance popover** | click icon | 3 rings + digest + "Dream now" + "Open report" |
| **Report window** | "Open report" | full Dream Report: vitals, trends, findings, experiments, memory |
| **Lab panel** | from report | active/concluded experiments (`08`) |
| **Settings** | menu | privacy, schedule, connectors, budgets, model |
| **Ask box / chat** | later (`10`) | grounded conversational queries |

## Menu-bar states

The icon communicates the loop at a glance:
- **Resting** — idle, nothing to show.
- **Dreaming** — a dream is running (subtle animation).
- **Report ready** — a fresh dream awaits reflection (badge/dot).
- **Attention** — a guardrail tripped or an experiment needs a verdict.

## Lifecycle & scheduling

- On launch: start the scheduler, run catch-up detection (missed nights), warm
  the store.
- Scheduler triggers per [05-feature-dream-sessions.md](05-feature-dream-sessions.md)
  (scheduled/idle/manual). For reliability across reboots/sleep, back the
  in-app scheduler with a `launchd` agent so a missed nightly dream runs on next
  wake.
- The engine runs as a **sidecar** (Node process / Rust-invoked) so heavy work
  never freezes the UI (`17`).

## OS integration

- **Notifications**: "Your dream is ready" each morning (respect Focus / Do Not
  Disturb; user-configurable; never spammy). A single morning nudge, not a
  stream.
- **Permissions**: needs read access to `~/.claude/**` (and later other harness
  dirs). Requested transparently with explanation on first run.
- **Login item**: opt-in launch-at-login.
- **File access**: full-disk-access may be required to read harness dirs;
  onboarding explains why and links to the setting.

## Packaging & distribution

- **Signed + notarized** `.app` (Developer ID) for Gatekeeper.
- Distribution: direct download (DMG) first; Homebrew cask later; Mac App Store
  is a poor fit (sandbox conflicts with reading `~/.claude/**` and writing config
  files).
- **Auto-update**: standard updater (e.g. Tauri updater / Sparkle-style) with
  signed updates.

## Onboarding (first run)

1. Welcome + the one-paragraph pitch.
2. Grant read access to harness data (explain why; show what we read).
3. Privacy choice: local-only vs. cloud REM (opt-in, with redaction explained —
   see `20`).
4. Optional: backfill history to seed baselines; schedule the nightly dream.
5. Offer an immediate "Dream now" so the user sees value in the first session.

## Accessibility & platform fit

- Native-feeling: respects light/dark mode, system accent, reduced-motion,
  Dynamic Type-equivalent scaling.
- Full keyboard navigation; VoiceOver labels on rings and findings.
- Menu-bar app conventions (no surprising window behavior).
