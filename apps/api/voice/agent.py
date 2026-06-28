"""
Dream voice agent — runs as a LiveKit Agents worker process.

Start with:
    cd apps/api && .venv/bin/python -m voice.agent dev

Requires livekit-server running locally:
    livekit-server --dev
"""
import os
from dotenv import load_dotenv
from livekit import agents
from livekit.agents import AgentServer, AgentSession, Agent
from livekit.plugins import google

load_dotenv()
os.environ.setdefault("GOOGLE_API_KEY", os.environ.get("GEMINI_API_KEY", ""))

LIVEKIT_URL = "ws://localhost:7880"
API_KEY = "devkey"
API_SECRET = "secret"

_INSTRUCTIONS = """\
You are Dream — a personal AI that has analyzed the collaboration between this \
builder and their coding agents (Claude Code, Codex, Cursor, opencode, Gemini CLI, Pi).

You help them reflect on their coding sessions, alignment patterns, friction points, \
and how to improve their collaboration with AI agents.

Voice rules:
- Keep responses short: 1-3 sentences unless the user asks for more detail.
- Speak naturally, no bullet points or markdown.
- Be direct and specific — name actual patterns you know about.
- Don't start with filler like "Sure!" or "Great question!".
"""


class DreamVoiceAgent(Agent):
    def __init__(self) -> None:
        super().__init__(instructions=_INSTRUCTIONS)


server = AgentServer()


@server.rtc_session(agent_name="dream-voice")
async def dream_voice(ctx: agents.JobContext):
    session = AgentSession(
        llm=google.realtime.RealtimeModel(
            voice="Puck",
            temperature=0.8,
            instructions=_INSTRUCTIONS,
        )
    )

    await session.start(room=ctx.room, agent=DreamVoiceAgent())

    await session.generate_reply(
        instructions="Greet the user in one short sentence. You're Dream, their personal AI."
    )


if __name__ == "__main__":
    os.environ.setdefault("LIVEKIT_URL", LIVEKIT_URL)
    os.environ.setdefault("LIVEKIT_API_KEY", API_KEY)
    os.environ.setdefault("LIVEKIT_API_SECRET", API_SECRET)
    agents.cli.run_app(server)
