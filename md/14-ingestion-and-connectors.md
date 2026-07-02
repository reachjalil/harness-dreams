# 14 · Ingestion & Connectors

*Status: 🟡 Draft*

How raw harness data on disk becomes normalized `Event`/`Session` records. A
**connector** is an adapter for one harness; the **ingestion pipeline** is shared.

## Design

```
 raw files ──► Connector.discover() ──► Connector.parse() ──► Normalizer ──► Store
 (per harness)   (find sessions)        (raw → typed rows)   (→ Event model)  (SQLite)
```

- Connectors are **read-only** and **incremental** (track a per-file cursor:
  byte offset / last line / mtime so re-ingest is cheap).
- Connectors map harness-specific shapes into the **shared Event taxonomy**
  ([12-data-model.md](12-data-model.md)). Downstream code never sees
  harness-specific formats.
- Ingestion is **idempotent**: re-running over the same files yields the same
  normalized rows (keyed by stable IDs).

## Connector interface (conceptual)

```ts
interface Connector {
  kind: HarnessKind;                 // "claude-code" | "codex" | "cursor"
  discover(): Promise<SessionRef[]>; // locate session files + projects
  parse(ref: SessionRef, cursor?: Cursor): AsyncIterable<RawEvent>;
  detectConfig(): Promise<ConfigArtifact[]>; // AGENTS.md, skills, mcp, settings, memory
}
```

The `Normalizer` turns `RawEvent` → canonical `Event` rows, computing token
fields, tool outcomes, and kind classification.

## Claude Code connector (MVP — grounded in real layout)

Verified on this machine. Claude Code stores everything under `~/.claude/`:

| Path | Contents | Used for |
|---|---|---|
| `~/.claude/projects/<encoded-cwd>/<session-uuid>.jsonl` | per-session transcript (JSONL) | Sessions + Events |
| `~/.claude/projects/<encoded-cwd>/memory/`, `MEMORY.md` | per-project memory | memory review (`09`) |
| `~/.claude/settings.json` | user settings | config audit |
| `~/.claude/skills/**` | installed skills | skill usage/optimization |
| `~/.claude/plugins/**` | plugins (incl. skills) | skill inventory |
| `~/.claude/telemetry/`, `stats-cache.json` | aggregate stats | cross-check vitals |
| `~/.claude/file-history/**` | edit history | accepted-change detection |
| `~/.claude/tasks/`, `~/.claude/plans/` | task/plan state | completion metrics |
| project `AGENTS.md` / `CLAUDE.md` | agent instructions | config optimization |

**Transcript schema (confirmed keys):**
- Event types: `user`, `assistant`, `queue-operation`, `attachment`,
  `last-prompt`, `ai-title`.
- Top-level: `type`, `timestamp`, `sessionId`, `parentUuid`, `uuid`, `promptId`,
  `message`, `permissionMode`, `promptSource`, `userType`, `entrypoint`, `cwd`,
  `version`, `gitBranch`, `requestId`, `toolUseResult`,
  `attributionMcpServer`, `attributionMcpTool`.
- `message.*`: `role`, `content`, `model`, `id`, `type`, `stop_reason`, `usage`,
  `diagnostics`.
- `message.usage.*`: `input_tokens`, `output_tokens`, `cache_read_input_tokens`,
  `cache_creation_input_tokens`, `service_tier`, `server_tool_use`, `speed`,
  `iterations`, `inference_geo`.

**Mapping (examples):**
- `type:"user"` → `user_prompt` (or `tool_result` when content is a tool result).
- `type:"assistant"` with tool_use content → `model_call` + `tool_call` events;
  carry `message.usage` onto the `model_call`.
- `attributionMcpServer`/`attributionMcpTool` present → tag event as `mcp_call`.
- `toolUseResult` → `tool_result` with `toolOutcome` derived from success/error.
- `permissionMode` changes → `mode_change`; denials → `permission_decision`.
- `ai-title` → session `title`; `cwd` → `Project`; `gitBranch` → session branch.

The `encoded-cwd` directory name (e.g.
`-Users-jalillaaraichi-applied-intelligence-hub`) decodes to the real project
path → `Project.path`.

## Codex connector (fast-follow)

Codex CLI keeps its own session history/logs. The connector mirrors the Claude
Code approach: discover session files, parse to `RawEvent`, map to the shared
taxonomy. Token/model fields map onto the same `Event` columns so all downstream
metrics and comparisons "just work." (Exact paths/format to be confirmed during
implementation — flagged in `24`.)

## Cursor connector (later)

Cursor stores chat/agent history in its app data. Same adapter pattern. Lower
priority than Codex; listed for completeness.

## Incremental ingestion & watching

- **Cursor file (offset) tracking** per transcript so we only parse new lines.
- **Watch mode**: optionally watch the harness directories (fs events) to keep
  the store warm, so a "run health review" is instant. MVP can simply scan-on-review.
- **Backfill**: on first run, ingest history (bounded by retention setting) to
  seed baselines.

## Robustness requirements

- **Partial/corrupt lines**: skip-and-log a bad JSONL line, never abort the
  session.
- **Format drift**: connectors are versioned; unknown fields are preserved in
  `raw` and ignored gracefully (harness versions change).
- **Large files**: stream, don't load whole transcripts into memory (some are
  thousands of lines).
- **No writes during ingest**: ingestion is strictly read-only; only the config
  optimizer writes, and only with consent.

## Privacy at ingestion

Ingestion derives metrics and **pointers**, not copies of secret-bearing bodies,
by default. Whether raw message text is retained locally (for evidence display
and chat) is a user setting. Nothing leaves the machine at ingestion time —
cloud calls happen only in Insight, on redacted excerpts, with opt-in. See
[20-privacy-and-security.md](20-privacy-and-security.md).
