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

You have already synthesized the day's sessions into a DreamLog — a structured \
picture of mood, alignment, friction, and recommendations. That synthesis_context \
is loaded as your baseline understanding.

When the user asks questions:
- Answer from your synthesized knowledge first.
- Use get_dream_log or list_dream_logs when they ask about a specific date or trends.
- Use search_chat_history when they want to dig into a specific conversation, \
  topic, or moment — "what did I say about X", "find the session where we discussed Y".
- Be specific and grounded. Quote from sessions and logs when it adds clarity.
- Don't hedge or encourage. Be direct — you watched the sessions, you know what happened.
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


@_agent.tool
async def get_dream_log(ctx: RunContext[ChatDeps], date: str) -> dict:
    """
    Fetch the full DreamLog for a specific date (YYYY-MM-DD).
    Returns mood, alignment score, friction points, recommendations, and synthesis_context.
    """
    doc = await ctx.deps.db.dream_logs.find_one({"date": date})
    if not doc:
        return {"error": f"No dream log found for {date}"}
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
