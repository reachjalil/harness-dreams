# 13 · Metrics Catalog

*Status: 🟡 Draft*

The authoritative list of metrics, each with a definition, formula, source, and
interpretation. Presentation is covered in
[06-feature-metrics-and-health.md](06-feature-metrics-and-health.md). Every
metric here is computable from the normalized `Event`/`Session` model
([12-data-model.md](12-data-model.md)), which in turn derives from real harness
telemetry ([14-ingestion-and-connectors.md](14-ingestion-and-connectors.md)).

## Source signals (what we actually have)

From Claude Code transcripts (`message.usage` and event fields), confirmed on
disk:
- `input_tokens`, `output_tokens`, `cache_read_input_tokens`,
  `cache_creation_input_tokens`, `service_tier`, `speed`, `iterations`
- `model`, `cwd`, `gitBranch`, `permissionMode`, `entrypoint`, `version`
- tool calls + `toolUseResult`, `attributionMcpServer`, `attributionMcpTool`
- event types: `user`, `assistant`, `queue-operation`, `attachment`, `ai-title`
- adjacent data: `~/.claude/file-history/` (edits), `~/.claude/telemetry/`,
  `stats-cache.json`, `skills/`, `plans/`, `tasks/`

These are the raw inputs; metrics below are derived from them.

## Metric definitions

Legend — **Dir**: ↑ = higher is better, ↓ = lower is better, ~ = contextual.

### Efficiency family

| Key | Name | Formula | Dir | Notes |
|---|---|---|:--:|---|
| `tokens.total` | Total tokens | Σ(input+output+cache_create) | ~ | volume only; pair with a ratio |
| `tokens.per_change` | Tokens per accepted change | total_tokens ÷ accepted_changes | ↓ | core efficiency metric |
| `cost.total` | Cost ($) | Σ priced tokens by model & tier | ↓ | needs per-model pricing table |
| `cost.per_change` | Cost per accepted change | cost ÷ accepted_changes | ↓ | |
| `cache.hit_ratio` | Cache hit ratio | cache_read ÷ (input + cache_read) | ↑ | high = good prompt reuse |
| `tokens.output_share` | Output share | output ÷ total | ~ | very low may signal thrash |

### Effectiveness family

| Key | Name | Formula | Dir | Notes |
|---|---|---|:--:|---|
| `delivery.changes` | Accepted changes | count of accepted edits/diffs | ↑ | from `file-history` + acceptance |
| `delivery.loc` | Lines delivered | Σ accepted diff lines | ~ | size proxy; not a goal itself |
| `reask.rate` | Re-ask rate | repeated-goal prompts ÷ goals | ↓ | needs goal/turn segmentation |
| `accept.rate` | Suggestion accept rate | accepted ÷ proposed edits | ↑ | |
| `completion.rate` | Task completion rate | completed ÷ started tasks | ↑ | from `tasks/`/plan signals |
| `time.to_done` | Time to completion | endedAt − startedAt per task | ↓ | wall-clock per task archetype |

### Alignment family

| Key | Name | Formula | Dir | Notes |
|---|---|---|:--:|---|
| `correction.rate` | Correction rate | corrective prompts ÷ assistant turns | ↓ | user redirects the agent |
| `revert.rate` | Revert rate | reverted edits ÷ accepted edits | ↓ | undo after the fact |
| `guardrail.hits` | Guardrail hits | count of permission denials/blocks | ↓ | `permission_decision` events |
| `tool.success_rate` | Tool success rate | ok ÷ (ok+error+denied) | ↑ | from `toolUseResult` |
| `tool.retry_rate` | Tool retry rate | retried ÷ tool_calls | ↓ | same command repeated |
| `mistake.count` | Detected mistakes | Insight-classified mistake events | ↓ | also fuels findings |

### Usage-mix family

| Key | Name | Formula | Dir | Notes |
|---|---|---|:--:|---|
| `model.mix` | Model mix | tokens share per model | ~ | drives model experiments |
| `model.latency` | Per-model latency | mean `speed`/duration per model | ↓ | comparative |
| `harness.mix` | Harness mix | sessions share per harness | ~ | needs ≥2 connectors |
| `effort.mix` | Effort-level mix | share per thinking-effort level | ~ | drives effort experiments |
| `skill.usage` | Skill usage | invocations per skill | ~ | from `skill_invocation` |
| `skill.efficiency` | Skill efficiency | outcome-quality ÷ tokens per skill | ↑ | quality proxy needed |
| `mcp.usage` | MCP usage | calls per server/tool | ~ | from attribution fields |
| `mcp.failure_rate` | MCP failure rate | mcp errors ÷ mcp calls | ↓ | flags bad servers |

## Composite rings (presentation composites)

Each ring (see `06`) is a weighted, baseline-normalized blend:

- **Efficiency ring** ← `tokens.per_change`, `cost.per_change`, `cache.hit_ratio`
- **Effectiveness ring** ← `accept.rate`, `reask.rate`(inv), `completion.rate`
- **Alignment ring** ← `correction.rate`(inv), `revert.rate`(inv),
  `tool.success_rate`, `guardrail.hits`(inv)

Weights are configurable and start from sensible defaults; normalization is
against the user's trailing baseline so a "full ring" = "better than recent you."

## Derived concepts that need their own logic

Some metrics depend on classifiers/segmenters, not just sums. These are
engineering work, flagged here and specified in `15`:

- **"Accepted change"** — requires correlating proposed edits with what survived
  (via `file-history` / subsequent diffs / no revert).
- **"Goal / re-ask"** — requires segmenting a session into goals to detect when
  the user re-asked for the same thing.
- **"Mistake"** — requires Insight classification with evidence.
- **"Task archetype"** — UI / refactor / debug / feature / docs classifier, used
  for fair comparisons (`11`).
- **"Satisfaction proxy"** — derived from follow-up sentiment, acceptance, and
  absence of correction (explicitly a *proxy*, never claimed as ground truth).

## Baselines, deltas, significance

- **Baseline**: trailing-window median (default 14 days) per metric per scope.
- **Delta**: current vs baseline, shown with a significance hint that accounts
  for sample size (see [16-experiments-engine.md](16-experiments-engine.md) for
  the small-sample approach). Sub-threshold deltas are shown muted, not as
  alarms.
- **Annotation**: experiment start/stop and major config changes are overlaid on
  trend charts so movement is attributable.

## Pricing note

`cost.*` needs a per-model, per-tier price table. Model IDs are known
(`claude-opus-4-8`, `claude-sonnet-4-6`, `claude-haiku-4-5-*`, plus Codex/others);
the live price table should be sourced from the Claude API reference rather than
hardcoded guesses. Tracked as an open item in
[24-risks-and-open-questions.md](24-risks-and-open-questions.md).
