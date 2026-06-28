# Harness Dreams CLI

An interactive terminal agent for your Harness Dreams workflow. Chat with an AI assistant that can discover your coding sessions, run sleep cycle analysis, and apply improvement patches to your `AGENTS.md`, `CLAUDE.md`, and skill files.

## Requirements

- Node.js ≥ 22
- An [Anthropic API key](https://console.anthropic.com/settings/keys)
- `pnpm` (for the monorepo)

## Install

From the monorepo root:

```sh
pnpm install
```

## First run

On first launch the CLI runs a one-time setup wizard:

1. **API key** — paste your `sk-ant-…` key; it is verified with a live call and saved to `~/.harness-dreams/cli-config.json`
2. **Model** — choose between Opus 4.8, Sonnet 4.6, or Haiku 4.5

You can re-run setup any time with `/setup` inside the REPL.

## Usage

```sh
pnpm --filter @harness-dreams/cli dev
```

Or from the `apps/cli` directory:

```sh
pnpm dev
```

### Commands

| Shortcut   | What it does                                        |
| ---------- | --------------------------------------------------- |
| `/ingest`  | Discover all local Claude Code / Codex projects     |
| `/dream`   | Run a sleep cycle analysis on your projects         |
| `/suggest` | Show improvement suggestions from the last report   |
| `/setup`   | Update API key or model                             |
| `/quit`    | Exit                                                |

You can also type any natural-language message and the agent will decide which tools to call.

### Example session

```
Harness Dreams CLI v0.1.0
  Type your message to chat with the agent.
  Commands: /ingest, /dream, /suggest, /setup, /quit
────────────────────────────────────────────────────

you > /ingest

Projects discovered: 12 total, 12 enabled
  • harness-dreams  /Users/vela/Developer/harness-dreams
    sources: claude-code, codex
  • promptloop  /Users/vela/Developer/promptloop
    sources: claude-code
  …

you > /dream

Sleep Cycle complete — 47 sessions analyzed
  Last 24 hours of activity across 3 projects.

  Efficiency        82 +4
  Effectiveness     76 ±0
  Alignment         91 +2

  3 finding(s) available — ask for suggestions to review them.

you > /suggest

Suggestions (2 patchable):

  [0] Add commit message format rule
       Claude repeatedly asked about commit style before following conventions.
       → Add rule: Use conventional commits: <type>(<scope>): <subject>
       target: agentsmd · /Users/vela/Developer/harness-dreams/AGENTS.md

  [1] Scaffold deploy skill
       Deploy steps were re-explained in 4 sessions this week.
       → Scaffold skill: Deploy to production
       target: skill · /Users/vela/Developer/harness-dreams/.claude/skills/deploy.md

you > apply patch 0

  ────────────────────────────────────────────────────────────
  Patch preview: AGENTS.md · harness-dreams
  ────────────────────────────────────────────────────────────
  File: /Users/vela/Developer/harness-dreams/AGENTS.md

  Snippet:
  + <!-- harness-dreams:start -->
  + Use conventional commits: <type>(<scope>): <subject>
  + <!-- harness-dreams:end -->

  ────────────────────────────────────────────────────────────
  Apply this patch? [y/N] y

  ✓ Written to /Users/vela/Developer/harness-dreams/AGENTS.md
```

## Configuration

Config is stored at `~/.harness-dreams/cli-config.json`:

```json
{
  "apiKey": "sk-ant-...",
  "model": "claude-opus-4-8",
  "projects": [...],
  "lastDreamAt": 1751000000000
}
```

If `ANTHROPIC_API_KEY` is set in your environment, it takes precedence over the stored key and onboarding is skipped.
