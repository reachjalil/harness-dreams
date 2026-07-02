# Review API — Implementation Doc

> Scope: ingestion pipeline + review synthesis backend.
> Frontend (Next.js dashboard + voice) handled separately.

---

## Architecture

```
Local disk (never leaves the machine)
  ~/.claude/        ← Claude Code sessions + configs
  ~/.codex/         ← Codex sessions + configs
  ~/.local/share/opencode/  ← opencode SQLite DB
  ~/Library/.../Cursor/     ← Cursor SQLite DBs
  ~/.gemini/        ← Gemini CLI sessions
  ~/.review/exports/ ← Pi / manual drops
  ~/Developer/      ← git repos (agent configs, AGENTS.md, .mcp.json, etc.)
        │
        ▼
  Connectors        ← read-only parsers, one per source
        │
        ▼
  Pipeline          ← in-memory only: list[NormalizedSession] + list[AgentConfig]
        │                nothing written to disk or DB
        ▼
  Deterministic Analytics + optional AI summary
        │                raw content stays local and minimized
        ▼
  Local Health Store ← PGlite in the Mac app userData directory
        │
        ▼
  Private Sync      ← WebRTC device sync; encrypted Cloudflare fallback only when enabled
```

**Data privacy**: raw chat content, agent configs, and session metadata stay on the local machine. The durable product store is local-first. Cloudflare is used for ephemeral signaling and optional encrypted snapshot fallback, not as an analytics database.

---

## Core Tech Choices

| Choice | Why |
|---|---|
| **Python + FastAPI** | Pydantic AI is Python-only. TypeScript frontend calls it over HTTP. |
| **Pydantic AI** | `output_type=HealthLog` forces Gemini to return a valid typed struct or auto-retry. |
| **Gemini 2.5 Flash** | 1M token context — a full day of sessions fits in one call. Hackathon sponsor. |
| **PGlite** | Local persisted telemetry/report store without native Electron packaging risk. |
| **Cloudflare** | Ephemeral signaling and optional encrypted snapshot fallback only. |
| **Local-first** | All raw data and normalized analytics are owned by the Mac app. |

---

## Folder Structure

```
apps/api/
├── main.py                    # FastAPI app + routes
├── local_store.py             # local compatibility store; no cloud database
├── requirements.txt
├── .env / .env.example
├── test_ingest.py             # manual ingestion test
├── test_sources.py            # per-connector source test
│
├── connectors/                # read-only adapters, one per source
│   ├── claude_code.py         # ~/.claude/projects/*/[session].jsonl
│   ├── codex.py               # ~/.codex/sessions/ + archived_sessions/ (JSONL)
│   ├── opencode.py            # ~/.local/share/opencode/opencode.db (SQLite)
│   ├── cursor.py              # ~/Library/.../Cursor/.../state.vscdb (SQLite)
│   ├── gemini_cli.py          # ~/.gemini/tmp/*.json + sessions/
│   ├── pi.py                  # ~/.review/exports/pi/ (manual drop)
│   ├── generic_export.py      # ~/.review/exports/ (JSON / MD / TXT)
│   ├── git_commits.py         # GitHub Events API + compare API (private repos)
│   ├── agent_configs.py       # all agent harness files across all tools
│   └── notes.py               # ~/Developer/learnings/ docs (read at synthesis time)
│
├── ingestion/
│   ├── normalizer.py          # NormalizedSession + SessionMetadata + Turn
│   └── pipeline.py            # orchestrates connectors → in-memory IngestResult
│
└── synthesis/
    ├── schema.py              # HealthLog + all sub-models (Pydantic)
    ├── prompt.py              # SYNTHESIS_PROMPT
    └── agent.py               # Pydantic AI agent + tools
```

---

## Data Sources

### Session Connectors

| Source | Where it reads | Format |
|--------|---------------|--------|
| **Claude Code** | `~/.claude/projects/[encoded-path]/[uuid].jsonl` | JSONL events: `user`, `assistant`, `tool_use` |
| **Codex** | `~/.codex/sessions/` + `~/.codex/archived_sessions/` | JSONL: `response_item` + `event_msg` types |
| **opencode** | `~/.local/share/opencode/opencode.db` | SQLite: `session` + `message` + `part` tables; `data` column is JSON |
| **Cursor** | `~/Library/Application Support/Cursor/User/workspaceStorage/*/state.vscdb` | SQLite: `ItemTable` + `cursorDiskKV`; 3 chat blob shapes |
| **Gemini CLI** | `~/.gemini/tmp/*.json` + `~/.gemini/sessions/` | JSON: `conversationHistory` array |
| **Pi (pi.ai)** | `~/.review/exports/pi/` — manual drop | Official `conversations.json`, simple `{turns:[]}`, or `You:/Pi:` plain text |
| **Generic export** | `~/.review/exports/` | JSON `{turns:[]}` or plain MD/TXT |
| **Git commits** | GitHub Events API (`/users/{login}/events`) + compare API | PushEvents → compare `before...head` per push to get commits on all branches incl. private repos |

### Agent Config Connector

Reads harness files from all coding agents and project dirs. Used by synthesis to detect config↔prompt conflicts.

| File | Source tag | Where found |
|------|-----------|-------------|
| `CLAUDE.md` | `claude-code-global` / `claude-code-project` | `~/.claude/` + each project dir |
| `settings.json` / `settings.local.json` | `claude-code-settings` | `~/.claude/` |
| `skills/*.md` | `claude-code-skill` | `~/.claude/skills/` |
| `AGENTS.md` | `codex-project` / `opencode-project` | each project dir |
| `config.toml` | `codex-global` | `~/.codex/` |
| `rules/` | `codex-rule` | `~/.codex/rules/` |
| `.cursorrules` | `cursor-rules` | each project dir |
| `GEMINI.md` | `gemini-cli-project` | each project dir |
| `soul.md` / `SOUL.md` | `soul` | each project dir |
| `.mcp.json` / `mcp.json` / `mcp_config.json` | `mcp-config` | each project dir |

Project dirs are discovered via `~/.claude/projects/` (decoded paths) + git repos under `GIT_SCAN_DIRS`.

---

## NormalizedSession

Every connector maps to the same in-memory shape:

```python
NormalizedSession(
    session_id   = "claude-code:/Users/vela/Dev/project:abc-123",
    source       = "claude-code",   # or codex, opencode, cursor, gemini-cli, pi, export, git
    project_path = "/Users/vela/Dev/project",
    project_name = "project",
    date         = "2026-06-27",
    started_at   = datetime,
    ended_at     = datetime,
    raw_source_path = "~/.claude/projects/.../session.jsonl",
    turns        = [Turn(role, content, timestamp), ...],
    metadata     = SessionMetadata(
        total_turns=12, user_turns=6, assistant_turns=6,
        session_length_minutes=34.5,
        user_rephrases=2,        # rapid follow-up corrections
        agent_clarifications=1,  # "could you clarify..."
        agent_hedges=3,          # "I think", "I'm not sure"
        agent_contradictions=0,
    ),
)
```

**Nothing is persisted.** `IngestResult` holds sessions + configs in memory until synthesis consumes them.

---

## Local Health Store

The Mac app owns durable telemetry and health reports locally.

```
telemetry_events   normalized events and source pointers
telemetry_cursors  file path, size, mtime, line/byte offset
health_reports     generated review reports and accepted decisions
```

No raw transcript bodies are retained in the normalized store unless the user explicitly enables raw-text retention.

---

## HealthLog Schema

```python
HealthLog(
    date            = "2026-06-27",

    # What you were doing
    mind_map_nodes  = [MindMapNode(topic, weight, is_new), ...],
    mind_map_edges  = [("voice-eval", "multi-agent"), ...],

    # Your side of the session
    your_mood       = MoodSignal(label="deep-focus", summary=..., evidence=...),
    your_question   = ImplicitQuestion(question=..., evidence=...),

    # Agent side
    agent_mood      = MoodSignal(label="uncertain", summary=..., evidence=...),
    agent_question  = ImplicitQuestion(question=..., evidence=...),

    # Alignment
    alignment_score  = 0.62,           # 0–1
    alignment_label  = "friction",     # aligned | mild-friction | friction | misaligned
    friction_points  = [
        FrictionPoint(type="config-conflict", description=..., evidence=...),
        FrictionPoint(type="missing-skill",   description=..., evidence=...),
    ],
    recommendations = [
        Recommendation(target="claude-md", action="Add: when asked to explain...", reason=...),
    ],

    # History
    seven_day_pattern  = [DayPattern(date, alignment_score, alignment_label), ...],
    synthesis_context  = "2–3 paragraph summary used as voice session context",
)
```

Pydantic AI enforces every field. If Gemini returns `alignment_score: "high"`, it retries automatically.

---

## Synthesis Agent Tools

All data is passed in-memory at synthesis time; historical comparisons are read from the local health store.

| Tool | What it does |
|---|---|
| `get_sessions(date)` | Returns the in-memory `list[NormalizedSession]` for the target date |
| `get_agent_configs(date)` | Returns in-memory `list[AgentConfig]` (CLAUDE.md, AGENTS.md, MCP, skills, soul.md) |
| `get_past_health_logs()` | Reads local health reports for the last 7 days → builds `seven_day_pattern` |
| `save_health_log(log)` | Writes the completed `HealthLog` to the local health store |

---

## FastAPI Endpoints

```
POST /synthesize          run ingestion + synthesis for a date (default: today)
                          returns { job_id } — synthesis runs as background task

GET  /synthesize/{job_id} poll synthesis status

GET  /reviews              list all HealthLog dates + alignment scores
GET  /reviews/{date}       full HealthLog for YYYY-MM-DD

GET  /health              { local_store: bool, gemini: bool }
```

No `/sessions` endpoint — sessions are never stored.

---

## Environment Variables

```bash
# Required
GEMINI_API_KEY=...

# GitHub commits
GITHUB_TOKEN=...                        # needs repo scope for private repos
GITHUB_USERNAME=Bella3202019           # auto-detected from token if omitted
GITHUB_EMAILS=vela@qwestly.com,velapod@gmail.com  # comma-separated author emails

# Optional paths
NOTES_FOLDER=/Users/vela/Developer/learnings
EXPORT_FOLDER=~/.review/exports
PI_EXPORT_DIR=~/.review/exports/pi
GIT_SCAN_DIRS=~/Developer              # comma-separated, used for agent config discovery
```

---

## Build Status

### Done — Ingestion

```
[x] local store               PGlite-backed app store; no cloud database
[x] ingestion/normalizer.py   NormalizedSession + SessionMetadata + Turn
[x] ingestion/pipeline.py     in-memory IngestResult, no DB writes
[x] connectors/claude_code.py
[x] connectors/codex.py
[x] connectors/opencode.py    fixed: data column is JSON, role inside data
[x] connectors/cursor.py
[x] connectors/gemini_cli.py
[x] connectors/pi.py
[x] connectors/generic_export.py
[x] connectors/git_commits.py GitHub Events + compare API, multi-email, private repos
[x] connectors/agent_configs.py CLAUDE.md, AGENTS.md, MCP, skills, soul.md, .cursorrules
[x] connectors/notes.py       .md .txt .rst .pdf .docx .html (read at synthesis time)
[x] test_ingest.py            7-day in-memory ingestion test
[x] test_sources.py           per-connector test
```

### Next — Synthesis

```
[ ] synthesis/schema.py       HealthLog + all sub-models
[ ] synthesis/prompt.py       SYNTHESIS_PROMPT
[ ] synthesis/agent.py        Pydantic AI agent + 4 tools
[ ] main.py                   FastAPI: POST /synthesize, GET /reviews/{date}, GET /health
[ ] End-to-end test: ingest → synthesize → GET /reviews/today
```

---

## What the Frontend Team Gets

One endpoint: `GET /reviews/{date}` returns the full `HealthLog` JSON.

The voice session loads `HealthLog.synthesis_context` as the opening context for Gemini Live.
