"""
Reads agent configuration and harness files from all supported coding agents.
Used by the synthesis agent to detect config↔prompt misalignment.

Covered per agent:
  Claude Code  — CLAUDE.md (global + per-project), settings.json (incl. MCP servers),
                 skills/*.md, settings.local.json
  Cursor       — .cursorrules per project
  Codex        — AGENTS.md per project, config.toml, rules/
  opencode     — AGENTS.md per project
  Gemini CLI   — GEMINI.md per project, config

Common harness files searched in every project:
  AGENTS.md, CLAUDE.md, GEMINI.md, .cursorrules,
  soul.md, SOUL.md,
  .mcp.json, mcp.json, mcp_config.json
"""
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import AsyncIterator

_CLAUDE_DIR   = Path.home() / ".claude"
_CODEX_DIR    = Path.home() / ".codex"
_GEMINI_DIR   = Path.home() / ".gemini"

# All config file names to look for in every git repo / project dir
_PROJECT_CONFIG_FILES: list[tuple[str, str]] = [
    ("claude-code-project", "CLAUDE.md"),
    ("cursor-rules",        ".cursorrules"),
    ("codex-project",       "AGENTS.md"),
    ("gemini-cli-project",  "GEMINI.md"),
    ("soul",                "soul.md"),
    ("soul",                "SOUL.md"),
    ("mcp-config",          ".mcp.json"),
    ("mcp-config",          "mcp.json"),
    ("mcp-config",          "mcp_config.json"),
]


class AgentConfig:
    def __init__(self, source: str, path: str, content: str, date: str):
        self.source = source
        self.path = path
        self.content = content
        self.date = date
        self.snapshot_at = datetime.now(timezone.utc)

    def to_dict(self) -> dict:
        return {
            "source": self.source,
            "path": self.path,
            "content": self.content,
            "date": self.date,
            "snapshot_at": self.snapshot_at,
        }


def _read(path: Path, max_chars: int = 8000) -> str | None:
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
        return text[:max_chars] if len(text) > max_chars else text
    except Exception:
        return None


def _decode_project_path(encoded: str) -> Path:
    return Path("/" + encoded.lstrip("-").replace("-", "/"))


async def ingest(date: str) -> AsyncIterator[AgentConfig]:
    seen: set[str] = set()

    def _emit(source: str, path: Path, max_chars: int = 8000):
        if str(path) in seen or not path.exists():
            return None
        seen.add(str(path))
        content = _read(path, max_chars)
        if content:
            return AgentConfig(source=source, path=str(path), content=content, date=date)
        return None

    # ── Claude Code globals ──────────────────────────────────────────────────
    for source, fname in [
        ("claude-code-global",        "CLAUDE.md"),
        ("claude-code-settings",      "settings.json"),
        ("claude-code-settings-local","settings.local.json"),
    ]:
        cfg = _emit(source, _CLAUDE_DIR / fname)
        if cfg:
            yield cfg

    # Skills
    skills_dir = _CLAUDE_DIR / "skills"
    if skills_dir.exists():
        for f in skills_dir.rglob("*.md"):
            cfg = _emit("claude-code-skill", f, max_chars=3000)
            if cfg:
                yield cfg

    # ── Codex globals ────────────────────────────────────────────────────────
    cfg = _emit("codex-global", _CODEX_DIR / "config.toml")
    if cfg:
        yield cfg

    rules_dir = _CODEX_DIR / "rules"
    if rules_dir.exists():
        for f in rules_dir.rglob("*"):
            if f.is_file():
                cfg = _emit("codex-rule", f, max_chars=3000)
                if cfg:
                    yield cfg

    # ── Gemini CLI globals ───────────────────────────────────────────────────
    for fname in ("config", "config.json", "settings.json"):
        cfg = _emit("gemini-cli-global", _GEMINI_DIR / fname)
        if cfg:
            yield cfg

    # ── Per-project configs: scan via Claude Code's known projects ───────────
    projects_dir = _CLAUDE_DIR / "projects"
    if projects_dir.exists():
        for project_dir in projects_dir.iterdir():
            if not project_dir.is_dir():
                continue
            project_path = _decode_project_path(project_dir.name)
            if not project_path.exists():
                continue
            for source, fname in _PROJECT_CONFIG_FILES:
                cfg = _emit(source, project_path / fname)
                if cfg:
                    yield cfg

    # ── Scan GIT_SCAN_DIRS for repos not in ~/.claude/projects ──────────────
    scan_dirs = [
        Path(d.strip())
        for d in os.getenv("GIT_SCAN_DIRS", str(Path.home() / "Developer")).split(",")
        if d.strip()
    ]
    for base in scan_dirs:
        if not base.exists():
            continue
        for depth_glob in ("*", "*/*"):
            for repo_dir in base.glob(depth_glob):
                if not repo_dir.is_dir() or not (repo_dir / ".git").exists():
                    continue
                for source, fname in _PROJECT_CONFIG_FILES:
                    cfg = _emit(source, repo_dir / fname)
                    if cfg:
                        yield cfg
