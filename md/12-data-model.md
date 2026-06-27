# 12 · Data Model

*Status: 🟡 Draft*

The normalized domain model that everything else reads and writes. Designed to be
harness-agnostic (so Codex/Cursor slot in) and to leave room for future
team/fleet features without reshaping the core.

## Entity overview

```
Harness ──< Project ──< Session ──< Event
                            │
DreamSession ──< Finding    │   (a dream reads Sessions/Events in a window)
     │      └─< Experiment   │
     └─< VitalsSnapshot ─────┘
Experiment ──< ExperimentObservation
ConfigArtifact (AGENTS.md, skill, mcp, settings, memory)  ── proposed → ConfigChange
```

## Core entities

### Harness
A configured agent tool instance.
- `id`, `kind` (`claude-code` | `codex` | `cursor` | …), `displayName`
- `connectorVersion`, `rootPaths` (where its data lives)
- `firstSeenAt`, `lastSeenAt`

### Project
A codebase / working directory the harness operated in.
- `id`, `harnessId`, `path` (the real cwd), `slug` (encoded dir name)
- `gitRemote?`, `displayName`
- Derived from transcript `cwd` (e.g. `~/.claude/projects/<encoded-cwd>/`).

### Session
One agent session (one transcript file).
- `id` (the session UUID), `projectId`, `harnessId`
- `startedAt`, `endedAt`, `durationMs`
- `gitBranch?`, `entrypoint?`, `version` (harness version)
- `model(s)` used, rollups: `totalTokens`, `cost`, `eventCount`
- `title?` (from `ai-title` events)
- `source` = pointer to the raw transcript file + byte/line range

### Event
A normalized atomic occurrence within a session. The workhorse table.
- `id`, `sessionId`, `ts`, `seq`
- `kind` (see taxonomy below)
- `role?` (`user` | `assistant` | `system`)
- `model?`, `tokensIn?`, `tokensOut?`, `cacheReadTokens?`, `cacheCreateTokens?`
- `tool?` (tool name), `mcpServer?`, `mcpTool?`, `toolOutcome?` (`ok|error|denied`)
- `permissionMode?`, `latencyMs?`, `speed?`, `iterations?`
- `raw` (pointer to source line; never the inlined secret-bearing body unless
  the user allows full local retention)

**Event kind taxonomy** (normalized across harnesses):
`user_prompt`, `assistant_message`, `model_call`, `tool_call`, `tool_result`,
`file_edit`, `command_run`, `error`, `guardrail_hit`, `permission_decision`,
`skill_invocation`, `mcp_call`, `mode_change`, `title`, `meta`.

### DreamSession
One analysis run.
- `id`, `windowStart`, `windowEnd`, `triggeredBy` (`scheduled|idle|manual|catchup`)
- `status`, `stageTimings`, `tokenSpend`, `cost`
- `harnessIds[]`, `sessionIds[]` covered
- produces → `VitalsSnapshot`, `Finding[]`, `Experiment[]` (proposals), memory
  proposals, `digest`

### VitalsSnapshot
Computed metrics for a window (see [13-metrics-catalog.md](13-metrics-catalog.md)).
- `id`, `dreamSessionId`, `scope` (global | project | harness | model)
- `metrics{}` (metricKey → value), `baselines{}` (metricKey → baseline value)
- `deltas{}` (metricKey → Δ + significance hint)

### Finding
See [07-feature-findings-and-actions.md](07-feature-findings-and-actions.md).
- `id`, `dreamSessionId`, `type`, `title`, `body`, `confidence`, `impact`
- `evidence[]` (sessionId + event refs + optional diff), `scope`
- `proposedAction` (kind + payload), `state`, `stateChangedAt`

### Experiment
See [08-feature-experiments.md](08-feature-experiments.md) and
[16-experiments-engine.md](16-experiments-engine.md).
- `id`, `title`, `hypothesis`, `scope`, `intervention`, `enablement`
- `successMetrics[]`, `guardrails[]`, `duration`, `status`
- `enabledAt?`, `concludedAt?`, `result?`

### ExperimentObservation
Links a session to a running experiment as treated/untreated.
- `id`, `experimentId`, `sessionId`, `inScope` (bool), `arm` (`treated|control`)
- captured metric values for that session

### ConfigArtifact & ConfigChange
- **ConfigArtifact**: `id`, `harnessId`, `projectId?`, `kind`
  (`agents-md|claude-md|skill|mcp|settings|memory`), `path`, `hash`, `lastRead`
- **ConfigChange**: `id`, `artifactId`, `diff`, `rationale`, `sourceFindingId?`,
  `state` (`proposed|applied|reverted`), `backupRef`, `appliedAt?`

## Storage strategy

- **Raw transcripts**: read in place from the harness's own directories; never
  copied wholesale. We store **pointers** (file + line/byte range) + derived
  fields. This keeps us local-first and avoids duplicating secret-bearing data.
- **Normalized store**: local **SQLite** (one DB in the app's support dir) for
  `Event`, `Session`, `VitalsSnapshot`, `Finding`, `Experiment`, etc. Indexed by
  `(harness, project, ts)` and `(dreamSession)`.
- **Artifacts/diffs**: stored with backups for undo.
- **Retention**: configurable; raw stays where the harness put it, normalized
  store prunes on a user-set horizon.

See [17-architecture.md](17-architecture.md) for where the store lives and who
writes it, and [20-privacy-and-security.md](20-privacy-and-security.md) for what
is and isn't retained.

## Why this shape

- **Harness-agnostic core** (`Event`/`Session`) → new connectors only map *into*
  this model; nothing downstream changes.
- **Window-based dreams** read `Event` by time → trivial to re-run / re-scope.
- **Experiments reference sessions** → measurement is just a query over
  `ExperimentObservation`.
- **Config as first-class data** → optimization and verification close the loop.
- **Team-ready later**: add a `userId`/`workspaceId` column without reshaping.
