"""
Dream chat agent — answers questions about your coding sessions and dream logs.

Backed by Gemini 2.5 Flash with three tools:
  get_dream_log        → fetch a specific day's DreamLog from MongoDB
  list_dream_logs      → last 7 days of alignment scores
  search_chat_history  → grep raw session files across all coding agents

Designed to be called via POST /chat (SSE streaming).
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import AsyncIterator

from dotenv import load_dotenv
from pydantic_ai import Agent, RunContext
from pydantic_ai.messages import ModelMessage, ModelRequest, ModelResponse, UserPromptPart, TextPart
from motor.motor_asyncio import AsyncIOMotorDatabase

from db import get_db
from chat.search import search_chat_history as _search

load_dotenv()
os.environ.setdefault("GOOGLE_API_KEY", os.environ.get("GEMINI_API_KEY", ""))

_SYSTEM_PROMPT = """\
You are Dream — a personal AI that has analyzed the collaboration between this \
builder and their coding agents (Claude Code, Codex, Cursor, opencode, Gemini CLI, Pi).

You have access to three tools. Use them — do not guess or refuse when a tool \
can answer the question.

TOOL RULES (mandatory):
1. search_chat_history — call this whenever the user uses any of these words: \
   "find", "search", "look up", "show me", "was there a session", "did I discuss", \
   "what did I say about", "where did we talk about". Do NOT answer these from memory.
2. get_dream_log — call this when they ask about a specific date ("June 26", \
   "yesterday", "last Tuesday") and want details beyond the loaded context.
3. list_dream_logs — call this immediately for ANY of these: trend questions \
   ("how was my week", "which day had the highest alignment"), improvement questions \
   ("how can I be better", "what should I change", "what can I improve", "advice", \
   "recommendations", "what patterns do you see"), or vague time references \
   ("past week", "this week", "lately", "recently", "last few days"). \
   NEVER ask the user to pick a date for these — fetch the data yourself and synthesize.

NEVER ask the user to clarify which date they want when:
- The question is about improvement, patterns, or trends.
- The user says "this week", "past week", "recently", or "last N days".
- The answer can be derived from list_dream_logs or the loaded synthesis_context.
Just call the tool and answer.

When you have tool results:
- Synthesize across all logs. Give concrete, actionable recommendations.
- Name specific friction patterns you saw, not generic advice.
- Quote specific dates and incidents to back up each recommendation.

When answering from the loaded synthesis_context:
- Be direct and specific. Name the actual friction points, sessions, projects.
- Don't hedge. Don't encourage. You watched the sessions — say what happened.
- Keep responses concise unless asked to elaborate.
"""


@dataclass
class ChatDeps:
    db: AsyncIOMotorDatabase
    synthesis_context: str


def _make_agent() -> Agent:
    return Agent(
        model="google:gemini-2.5-flash",
        output_type=str,
        deps_type=ChatDeps,
        system_prompt=_SYSTEM_PROMPT,
        retries=1,
    )


_agent = _make_agent()


def _resolve_date(raw: str) -> str:
    """
    Convert natural language date references to YYYY-MM-DD.
    Handles: 'yesterday', 'today', 'June 25', 'June 25th', '06-25', etc.
    Falls back to the raw string if unrecognised.
    """
    import re
    from datetime import date, timedelta

    raw = raw.strip().lower()
    today = date.today()

    if raw in ("today",):
        return today.isoformat()
    if raw in ("yesterday",):
        return (today - timedelta(days=1)).isoformat()

    # Already YYYY-MM-DD
    if re.match(r"^\d{4}-\d{2}-\d{2}$", raw):
        return raw

    # Month name patterns: "june 25", "june 25th", "jun 25"
    _MONTHS = {
        "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
        "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
        "january": 1, "february": 2, "march": 3, "april": 4, "june": 6,
        "july": 7, "august": 8, "september": 9, "october": 10,
        "november": 11, "december": 12,
    }
    m = re.match(r"([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s+(\d{4}))?", raw)
    if m:
        mon = _MONTHS.get(m.group(1))
        day = int(m.group(2))
        year = int(m.group(3)) if m.group(3) else today.year
        if mon:
            return f"{year}-{mon:02d}-{day:02d}"

    return raw


@_agent.tool
async def get_dream_log(ctx: RunContext[ChatDeps], date: str) -> dict:
    """
    Fetch the full DreamLog for a specific date.
    date can be YYYY-MM-DD, or natural language like 'yesterday', 'June 25', 'June 25th 2026'.
    Returns mood, alignment score, friction points, recommendations, and synthesis_context.
    """
    resolved = _resolve_date(date)
    doc = await ctx.deps.db.dream_logs.find_one({"date": resolved})
    if not doc:
        # Fuzzy fallback: find the nearest available date
        available = await ctx.deps.db.dream_logs.find(
            {}, {"date": 1}
        ).sort("date", -1).limit(14).to_list(14)
        dates = [d["date"] for d in available]
        return {
            "error": f"No dream log for {resolved}",
            "available_dates": dates,
        }
    doc.pop("_id", None)
    return doc


@_agent.tool
async def list_dream_logs(ctx: RunContext[ChatDeps]) -> list[dict]:
    """
    List the last 7 dream logs — date, alignment_score, alignment_label, your_mood, agent_mood.
    Use this to answer trend questions or "how was my week".
    """
    docs = await ctx.deps.db.dream_logs.find(
        {},
        {
            "date": 1,
            "alignment_score": 1,
            "alignment_label": 1,
            "your_mood": 1,
            "agent_mood": 1,
            "synthesis_context": 1,
        },
    ).sort("date", -1).limit(7).to_list(7)
    for d in docs:
        d.pop("_id", None)
    return docs


@_agent.tool
async def search_chat_history(
    ctx: RunContext[ChatDeps],
    query: str,
    sources: list[str] | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
) -> list[dict]:
    """
    Search raw chat history files across all coding agents for a keyword or phrase.
    sources: filter to specific agents — "claude-code", "codex", "cursor", "opencode", "gemini-cli", "pi"
    date_from / date_to: YYYY-MM-DD bounds (both optional)
    Returns up to 20 matches with excerpt + surrounding context turns.
    """
    return await _search(query, sources=sources, date_from=date_from, date_to=date_to)


# ── Message conversion ────────────────────────────────────────────────────────

def _to_history(messages: list[dict]) -> list[ModelMessage]:
    """Convert [{role, content}] frontend messages (all but last) to Pydantic AI history."""
    history: list[ModelMessage] = []
    for m in messages:
        if m["role"] == "user":
            history.append(ModelRequest(parts=[UserPromptPart(content=m["content"])]))
        else:
            history.append(ModelResponse(
                parts=[TextPart(content=m["content"])],
                timestamp=datetime.now(timezone.utc),
                model_name="google:gemini-2.5-flash",
            ))
    return history


# ── Public streaming interface ────────────────────────────────────────────────

async def stream_chat(
    messages: list[dict],
    context_date: str | None = None,
) -> AsyncIterator[str]:
    """
    Stream a chat response token by token.

    messages: full conversation [{role: "user"|"assistant", content: str}]
              The last message must be role="user" — that's the current turn.
    context_date: YYYY-MM-DD of the dream log to anchor context on.
                  Defaults to the most recent available log.

    Yields text delta strings. Caller wraps in SSE.
    """
    if not messages or messages[-1]["role"] != "user":
        raise ValueError("Last message must be role=user")

    db = get_db()

    # Load synthesis_context from the target date's dream log
    query_filter = {"date": context_date} if context_date else {}
    log_doc = await db.dream_logs.find_one(
        query_filter,
        {"synthesis_context": 1},
        sort=[("date", -1)],
    )
    synthesis_context = (
        log_doc.get("synthesis_context", "") if log_doc
        else "No dream log available yet."
    )

    deps = ChatDeps(db=db, synthesis_context=synthesis_context)

    # Prepend synthesis_context to the system as a user-visible preamble
    preamble = f"## Your Dream Context\n\n{synthesis_context}\n\n---\n\n"
    current_message = preamble + messages[-1]["content"] if not any(
        m["role"] == "assistant" for m in messages
    ) else messages[-1]["content"]

    history = _to_history(messages[:-1])

    async with _agent.run_stream(
        current_message,
        deps=deps,
        message_history=history,
    ) as result:
        async for delta in result.stream_text(delta=True):
            yield delta
