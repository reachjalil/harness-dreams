# Dream — Hackathon Proposal

> *You wake up. Open it. See how you and your agents were thinking yesterday — and how aligned you actually were.*

---

## The Problem

AI builders use 3+ coding agents every day — Claude Code, Cursor, Codex. Every session is a collaboration between two minds. But nobody measures how well that collaboration actually went.

You were scattered → your prompts were scattered → your agents guessed → you got output you didn't want → you blamed the agent.

Or: your CLAUDE.md says one thing, you asked for another, the agent tried to reconcile them silently, and the result was off. You didn't know why.

Or: you were deep in a systems architecture problem, but your agent's configured skills are all frontend. It helped you the wrong way for an hour.

These aren't model failures. They're alignment failures. And nothing surfaces them.

---

## The Product

**Dream** is a personal AI that watches both sides of your coding sessions — your thinking and your agents' thinking — synthesizes the alignment between them overnight, and every morning shows you where you collaborated and where you fought. Then you can talk to it.

A coding session is a collaboration. Dream measures how good that collaboration was.

---

## Who It's For

AI builders who use coding agents daily and want to get better at directing them — not just get faster output, but compound their ability to work with AI. The bottleneck isn't the model. It's the alignment between you and it.

---

## The Morning Dashboard

```
┌─────────────────────────────────────────────────────────────────────┐
│  DREAM  ·  June 27                                                  │
├─────────────────────────────┬───────────────────────────────────────┤
│                             │                                       │
│   MIND MAP                  │   ALIGNMENT SCORE                     │
│                             │                                       │
│   voice-eval ●──●           │        62%  Friction                  │
│              │              │   ████████████░░░░░░░░                │
│   multi-agent●              │                                       │
│              │              │   You and your agents were            │
│   api-design ●              │   pulling in different directions     │
│                             │   for most of the day.                │
│   (nodes by depth,          │                                       │
│    new vs recurring)        ├───────────────────────────────────────┤
│                             │                                       │
├──────────────┬──────────────┤   FRICTION POINTS                     │
│              │              │                                       │
│  YOUR SIDE   │  AGENT SIDE  │   ⚠ CLAUDE.md says "no comments"     │
│              │              │     but you kept asking agents to     │
│  Mood:       │  Mood:       │     explain code inline.              │
│  Deep Focus  │  Uncertain   │                                       │
│              │              │   ⚠ Your agents' skills are           │
│  Question:   │  Question:   │     frontend-heavy. Today was         │
│  "Can I make │  "What does  │     all systems architecture.         │
│  eval feed   │   this user  │                                       │
│  back into   │   actually   │   ⚠ You asked about async patterns    │
│  behavior?"  │   want?"     │     4 times — agents gave 4           │
│              │              │     different answers. No ground      │
│              │              │     truth in your setup.              │
│              │              │                                       │
├──────────────┴──────────────┴───────────────────────────────────────┤
│  RECOMMENDATIONS                                                    │
│                                                                     │
│  1. Add to CLAUDE.md: "When I ask you to explain, add inline        │
│     comments. Default to no comments otherwise."                    │
│  2. Add a systems/backend skill to your agent config.               │
│  3. Write a canonical async pattern doc — link it as context.       │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  7-DAY ALIGNMENT                                                    │
│  Mon  82% Collaborating   Thu  45% Fighting                         │
│  Tue  71% Collaborating   Fri  88% Collaborating ← peak            │
│  Wed  55% Friction        Sat  ──  Rest                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   🎙️  [Talk to Dream]   "Ask me anything about yesterday"          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Dashboard Sections — Why Each One

| Section | What it shows | How it's inferred |
|---|---|---|
| **Mind Map** | Cognitive territory covered — topics, depth, new vs recurring | MongoDB vector clustering of session content |
| **Alignment Score** | How well you and your agents collaborated: Collaborating / Friction / Fighting | Composite: rejection rate + clarification rate + instruction conflicts + tool mismatch |
| **Your Mood** | How you were thinking — Deep Focus / Scattered / Exploratory / Frustrated | Session length, context switches, prompt revision patterns |
| **Your Question** | The implicit question you were holding all day — the one you circled but never asked directly | Semantic similarity across prompts; the through-line Gemini surfaces |
| **Agent Mood** | How your agents were performing — Confident / Uncertain / Confused / Overloaded | Hedging language, clarification requests, retry rate, contradictions in responses |
| **Agent Question** | What your agents were implicitly trying to figure out | Pattern in agent responses: "What does this user actually want?" signals |
| **Friction Points** | Specific misalignments: CLAUDE.md conflicts, missing skills, wrong domain | Direct comparison of agent config vs. session content vs. what you asked |
| **Recommendations** | Concrete changes to make — CLAUDE.md edits, skills to add, context docs to write | Gemini synthesis: root cause → specific fix |
| **7-Day Alignment** | Collaboration trend across the week | Historical dream_log alignment scores |

**The alignment score is the core metric.** It tells you at a glance whether your agent sessions are compounding your ability or fighting it. Every other section explains why.

---

## The Voice Session

Click **Talk to Dream** and the dashboard becomes a conversation. Dream has the full synthesis loaded — your mood, your question, your agents' mood, their question, the friction points, the recommendations. You ask:

- *"Why was my alignment score so low on Wednesday?"*
- *"What should I change in my CLAUDE.md first?"*
- *"What's the one thing I can do today to collaborate better with my agents?"*

It answers from your real sessions — specific, grounded, actionable. The goal isn't reflection. It's leaving with a concrete change that makes tomorrow's sessions better.

---

## What Dream Watches

Dream ingests both sides of the collaboration:

**Your side:**
- Claude Code, Cursor, Codex session histories — your prompts, your follow-ups, your rejections
- Learnings folder — your explicit captures
- Git commits — what actually shipped

**Your agents' side:**
- Agent responses — hedging, clarifications, contradictions, confidence signals
- CLAUDE.md / .cursorrules / agent config files — how your agents were set up
- Tool calls made, retries, errors — where agents struggled mechanically
- Skills and instructions configured — what your agents thought their job was

All sources flow into MongoDB. Raw docs for synthesis. Vector embeddings for semantic clustering. The alignment analysis compares both sides directly.

---

## Technical Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  INGESTION  (runs throughout the day)                       │
│                                                             │
│  Claude Code ──┐                                            │
│  Cursor ───────┼──► Ingestion Script ──► MongoDB           │
│  Codex ────────┤         (Python)         ├── learnings     │
│  Learnings ────┤                          ├── sessions      │
│  Git commits ──┘                          └── embeddings    │
│                                               (vector idx)  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼  (2am cron)
┌─────────────────────────────────────────────────────────────┐
│  DREAM SYNTHESIS                                            │
│                                                             │
│  MongoDB vector search ──► Gemini 3.5 Flash                │
│  (retrieve today's         (extended thinking ON)           │
│   sessions + related        │                               │
│   historical context)       ▼                               │
│                          dream_log document                 │
│                          → mind_map nodes                   │
│                          → builder_ratio                    │
│                          → the_loop                         │
│                          → the_gap                          │
│                          → seven_day_pattern                │
│                    stored back in MongoDB                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼  (morning)
┌─────────────────────────────────────────────────────────────┐
│  MORNING EXPERIENCE                                         │
│                                                             │
│  Next.js Dashboard                                          │
│  → reads dream_log from MongoDB                             │
│  → renders mind map, metrics, pattern                       │
│                                                             │
│  [Talk to Dream] button                                     │
│  → LiveKit (audio pipeline)                                 │
│  → Gemini Live API (real-time voice)                        │
│  → dream_log injected as system context                     │
└─────────────────────────────────────────────────────────────┘
```

### Stack

| Layer | Technology | Why |
|---|---|---|
| **Agent framework** | Pydantic AI | Structured output validation, tool calling, MongoDB wiring, retries — all typed |
| **Synthesis model** | Gemini 2.5 Flash (via Pydantic AI) | 1M token context window; handles a full day of sessions in one call |
| **Storage** | MongoDB Atlas | Unified: vector embeddings + operational dream logs + raw session docs in one platform |
| **Vector search** | MongoDB Atlas Vector Search | Semantic clustering for mind map, finding related past learnings |
| **Voice** | Gemini Live API | Real-time low-latency voice for morning session — WebSocket, not a standard LLM call |
| **Audio pipeline** | LiveKit | WebRTC infrastructure connecting browser to Gemini Live API |
| **Frontend** | Next.js | Dashboard + voice session UI |
| **Backend** | Python (FastAPI) | Ingestion scripts, synthesis cron, Pydantic AI agent host |

**How Pydantic AI and Gemini divide the work:**

```
Synthesis pipeline  →  Pydantic AI agent  →  Gemini 2.5 Flash  →  MongoDB
Morning voice       →  Gemini Live API  ↔  LiveKit  ↔  Browser
```

Pydantic AI owns the overnight synthesis: it calls Gemini, validates the structured `DreamLog` output, retries on failure, and writes to MongoDB via tools. Gemini Live API owns the morning voice session — it's a WebSocket audio stream, outside Pydantic AI's scope.

### Pydantic AI Agent Structure

```python
from pydantic_ai import Agent, RunContext
from pydantic import BaseModel, Field
from dataclasses import dataclass
from motor.motor_asyncio import AsyncIOMotorClient
from typing import Literal

# --- Dependencies ---

@dataclass
class DreamDeps:
    mongo: AsyncIOMotorClient
    user_id: str
    date: str

# --- Output Schema ---

class MoodSignal(BaseModel):
    label: Literal["deep-focus", "scattered", "exploratory", "frustrated",
                   "confident", "uncertain", "confused", "overloaded"]
    summary: str
    signal: str

class ImplicitQuestion(BaseModel):
    question: str
    evidence: str

class MindMapNode(BaseModel):
    topic: str
    weight: float
    is_new: bool

class MindMap(BaseModel):
    nodes: list[MindMapNode]
    edges: list[tuple[str, str]]

class FrictionPoint(BaseModel):
    type: Literal["config-conflict", "missing-skill", "wrong-domain", "unclear-prompt"]
    description: str
    evidence: str

class Recommendation(BaseModel):
    target: Literal["claude-md", "agent-skill", "context-doc", "prompt-habit"]
    action: str
    reason: str

class DreamLog(BaseModel):
    mind_map: MindMap

    # your side
    your_mood: MoodSignal
    your_question: ImplicitQuestion

    # agent side
    agent_mood: MoodSignal
    agent_question: ImplicitQuestion

    # alignment
    alignment_score: float = Field(ge=0.0, le=1.0)
    alignment_label: Literal["collaborating", "friction", "fighting"]
    friction_points: list[FrictionPoint]
    recommendations: list[Recommendation]

    synthesis_context: str  # loaded into voice session

# --- Agent ---

dream_agent = Agent(
    'google-gla:gemini-2.5-flash',
    output_type=DreamLog,
    deps_type=DreamDeps,
    instructions=SYNTHESIS_PROMPT,
    retries=2,
)

# --- Tools ---

@dream_agent.tool
async def get_today_sessions(ctx: RunContext[DreamDeps]) -> list[dict]:
    """Fetch all coding agent sessions ingested today — both user prompts and agent responses."""
    return await ctx.deps.mongo.dream.sessions.find({
        "user_id": ctx.deps.user_id,
        "date": ctx.deps.date
    }).to_list(None)

@dream_agent.tool
async def get_agent_configs(ctx: RunContext[DreamDeps]) -> list[dict]:
    """Fetch current agent config files — CLAUDE.md, .cursorrules, skills."""
    return await ctx.deps.mongo.dream.agent_configs.find({
        "user_id": ctx.deps.user_id,
        "date": ctx.deps.date
    }).to_list(None)

@dream_agent.tool
async def search_past_sessions(ctx: RunContext[DreamDeps], topic: str) -> list[dict]:
    """Vector search historical sessions to determine if a topic is new."""
    return await ctx.deps.mongo.dream.sessions.aggregate([{
        "$vectorSearch": {
            "queryVector": await embed(topic),
            "path": "embedding",
            "numCandidates": 50,
            "limit": 5,
            "index": "learnings_vector_index"
        }
    }]).to_list(None)

@dream_agent.tool
async def save_dream_log(ctx: RunContext[DreamDeps], log: dict) -> str:
    """Save the completed dream_log to MongoDB."""
    await ctx.deps.mongo.dream.dream_logs.insert_one(log)
    return "saved"

# --- Run (nightly cron) ---

async def run_synthesis(user_id: str, date: str):
    deps = DreamDeps(mongo=AsyncIOMotorClient(MONGO_URI), user_id=user_id, date=date)
    result = await dream_agent.run("Synthesize today.", deps=deps)
    return result.output  # fully typed, validated DreamLog
```

### MongoDB Schema

```javascript
// sessions collection — raw daily inputs (both sides)
{
  _id: ObjectId,
  source: "claude-code" | "cursor" | "codex" | "learnings-folder" | "git",
  content: String,              // raw session text
  date: ISODate,
  embedding: [Float],           // 768-dim vector
  topics: [String],             // extracted topics

  // your side signals
  session_length: Number,       // minutes
  context_switches: Number,     // topic shifts
  prompt_revisions: Number,     // how often you rephrased the same ask
  rejection_signals: Number,    // "no", "that's wrong", "try again" count

  // agent side signals
  agent_clarifications: Number, // how often agent asked "what do you mean?"
  agent_hedges: Number,         // "I think", "you might want to", "I'm not sure"
  agent_contradictions: Number, // agent reversed itself in same session
  tool_retries: Number,         // agent retried a tool call
}

// agent_configs collection — snapshot of agent setup at time of session
{
  _id: ObjectId,
  date: ISODate,
  source: "claude-code" | "cursor" | "codex",
  config_content: String,       // full CLAUDE.md / .cursorrules content
  embedding: [Float],           // vectorized for comparison against sessions
  skills: [String],             // extracted skill/domain list
  instructions: [String],       // key directives extracted
}

// dream_logs collection — nightly synthesis
{
  _id: ObjectId,
  date: ISODate,

  mind_map: {
    nodes: [{ topic: String, weight: Float, is_new: Boolean }],
    edges: [{ from: String, to: String }]
  },

  // your side
  your_mood: {
    label: "deep-focus" | "scattered" | "exploratory" | "frustrated",
    summary: String,
    signal: String
  },
  your_question: {
    question: String,
    evidence: String
  },

  // agent side
  agent_mood: {
    label: "confident" | "uncertain" | "confused" | "overloaded",
    summary: String,
    signal: String
  },
  agent_question: {
    question: String,           // what agents were implicitly trying to figure out
    evidence: String
  },

  // alignment
  alignment_score: Float,       // 0.0–1.0 (Fighting → Collaborating)
  alignment_label: "collaborating" | "friction" | "fighting",
  friction_points: [{
    type: "config-conflict" | "missing-skill" | "wrong-domain" | "unclear-prompt",
    description: String,
    evidence: String
  }],
  recommendations: [{
    target: "claude-md" | "agent-skill" | "context-doc" | "prompt-habit",
    action: String,             // specific, actionable change
    reason: String
  }],

  seven_day_pattern: [{ date: ISODate, alignment_score: Float, label: String }],
  synthesis_context: String     // loaded into voice session
}
```

### Synthesis Prompt (Gemini 3.5 Flash)

```
You are Dream — a personal AI that analyzes the collaboration between 
a builder and their coding agents.

You have access to today's sessions — both sides:
USER SESSIONS (prompts, follow-ups, rejections): [SESSIONS]
AGENT CONFIGS (CLAUDE.md, .cursorrules, skills): [AGENT_CONFIGS]
HISTORICAL CONTEXT (past weeks): [HISTORICAL_CONTEXT]

Your job: surface how well the human and agents were aligned —
and what to change tomorrow to collaborate better.

Synthesize into a dream_log JSON with:

1. mind_map: cognitive territory covered. Nodes = topics, weight = depth,
   is_new = not in history. Edges = topics connected in same session.

2. your_mood: how the human was thinking.
   - "deep-focus": long sessions, few switches, one thread
   - "scattered": many short sessions, constant context switching
   - "exploratory": wide-ranging but intentional
   - "frustrated": repeated asks, backtracking, rejected outputs
   Include what signal revealed this.

3. your_question: the implicit question the human was holding all day.
   Not what they asked directly. The question underneath.
   Show where it surfaced across sessions.

4. agent_mood: how the agents were performing.
   - "confident": direct answers, right tools first time, no hedging
   - "uncertain": "I think", clarifying questions, offering options
   - "confused": contradicted itself, went off-track, user rejected output
   - "overloaded": lost context, repeated itself, missed earlier instructions
   Include what signal revealed this.

5. agent_question: what the agents were implicitly trying to figure out.
   The question underneath their responses — usually some version of 
   "what does this user actually want?" Show where it appeared.

6. alignment_score: 0.0–1.0. How well human and agents were aligned.
   Signals that lower the score:
   - human rephrased the same ask multiple times
   - agent asked clarifying questions human shouldn't have needed to answer
   - agent config instructions conflicted with what human asked
   - agent skills didn't match the problem domain
   - agent gave multiple contradictory answers to the same question

7. friction_points: specific misalignments found. For each one:
   - type: "config-conflict" | "missing-skill" | "wrong-domain" | "unclear-prompt"
   - description: what the conflict was
   - evidence: where in the sessions it appeared
   
   Look specifically for:
   - Places where CLAUDE.md/cursorrules directly contradict what the user asked
   - Skills configured for the agent that had no relevance to today's work
   - Problem domains the user worked in that the agent had no skills for
   - Prompts the user had to repeat or rephrase significantly

8. recommendations: specific, actionable changes. For each one:
   - target: "claude-md" | "agent-skill" | "context-doc" | "prompt-habit"  
   - action: the exact change to make (quote the CLAUDE.md line if relevant)
   - reason: what friction it resolves

9. synthesis_context: 2-3 paragraphs. The full picture of both sides —
   how the human was thinking, how the agents were operating, 
   where they aligned and where they fought, and what one change
   would most improve tomorrow's sessions.
   This loads into the morning voice session as context.

Be specific. Use real quotes from sessions and configs.
No encouragement. No generic advice. Name the actual conflict.
```

---

## Demo Flow (2 minutes)

**Setup:** pre-load the learnings folder + past sessions into MongoDB. Run synthesis. Have a dream log ready.

**Act 1 — The Data (20s)**
Show the ingestion: "Here's a week of my Claude Code sessions, my Cursor chats, my learnings folder." Just a file list. Make it feel real.

**Act 2 — The Dashboard (50s)**
Open Dream. Walk through the sections:
- Alignment score: *"62% — Friction. We were pulling in different directions."*
- Your mood vs agent mood: *"I was deep focus. My agents were uncertain — lots of clarifying questions."*
- Your question vs agent question: *"I was asking 'can I make eval feed back into behavior?' They were asking 'what does this user actually want?'"*
- Friction points: *"My CLAUDE.md says no comments, but I kept asking agents to explain code. Conflict on every session."*
- Recommendations: *"One line change to CLAUDE.md fixes the top friction point."*

**Act 3 — The Voice (40s)**
Click Talk to Dream. Ask live: *"What's the one change that would have made today a 90% alignment day?"*
Dream answers with the specific CLAUDE.md edit, grounded in the actual sessions.

**Act 4 — The Pitch (10s)**
*"A coding session is a collaboration. Dream measures how good that collaboration was — and tells you exactly what to change."*

---

## Build Order

| Priority | Task | Time |
|---|---|---|
| 1 | Pydantic AI agent + `DreamLog` schema + Gemini wired up | 2h |
| 2 | MongoDB schema + vector index + agent tools (`get_sessions`, `search_past`, `save_log`) | 2h |
| 3 | Ingestion script — learnings folder + git log → MongoDB | 2h |
| 4 | Dashboard UI — hardcoded `DreamLog` first, wire MongoDB second | 3h |
| 5 | Gemini Live API voice session — WebSocket server + dream context injected | 4h |
| 6 | LiveKit integration — browser audio ↔ Gemini Live API | 2h |
| 7 | Ingestion for Claude Code / Cursor / Codex chat history files | 2h |
| 8 | Polish + pre-load real demo data | 1h |

**Total: ~18h.** Build 1-4 first — that's the full demo. 5-6 is the wow moment. 7-8 if time allows.

**Start here:** get the Pydantic AI agent returning a valid `DreamLog` from your real learnings folder. Once that JSON is right, everything else is display and delivery.

---

## What Makes This Win

- **The alignment score is novel** — nobody measures human-agent collaboration quality. Judges haven't seen this framing.
- **Both sides of the session** — you're not just analyzing the user, you're analyzing the agents too. That's the unexpected depth.
- **Concrete output** — every morning you get specific CLAUDE.md edits, not vague insights. Judges can immediately imagine using this.
- **Personal data** — demo uses your real CLAUDE.md and real sessions. The friction points will be real. That lands.
- **Full stack** — MongoDB vectors + agent config storage + Gemini synthesis + Live API voice + LiveKit. Every sponsor tech used meaningfully.
- **Voice is the payoff** — dashboard explains, voice proves it. The live Q&A is the demo moment judges remember.
