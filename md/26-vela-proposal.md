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

---

---

# Implementation Plan — Ingestion → Dream Synthesis

> Scope: Python backend only. Frontend/dashboard handled separately.
> Timeline: 2–3 days.

---

## What We're Building

```
Connectors (read raw data)
    │
    ▼
Normalizer (unified session format)
    │
    ▼
MongoDB (sessions + agent_configs + learnings)
    │
    ▼
Pydantic AI Agent + Gemini 2.5 Flash (dream synthesis)
    │
    ▼
MongoDB dream_logs (read by frontend via FastAPI)
```

FastAPI serves both the ingestion triggers and the dream log results. The frontend calls it.

---

## Folder Structure

```
apps/api/
├── main.py                    # FastAPI app + routes
├── db.py                      # MongoDB client + collection helpers
├── requirements.txt
├── .env.example
│
├── connectors/
│   ├── __init__.py
│   ├── base.py                # Connector ABC
│   ├── claude_code.py         # ~/.claude/projects/ JSONL
│   ├── cursor.py              # Cursor state.vscdb (SQLite)
│   ├── opencode.py            # opencode.db (SQLite)
│   ├── learnings_folder.py    # markdown notes folder
│   ├── agent_configs.py       # CLAUDE.md + .cursorrules reader
│   └── generic_export.py      # ~/.dream/exports/ drop folder
│
├── ingestion/
│   ├── __init__.py
│   ├── normalizer.py          # raw → NormalizedSession
│   ├── pipeline.py            # orchestrates all connectors
│   └── embedder.py            # Gemini embeddings for vector search
│
└── synthesis/
    ├── __init__.py
    ├── schema.py              # Pydantic DreamLog + all sub-models
    ├── agent.py               # Pydantic AI agent definition + tools
    └── prompt.py              # SYNTHESIS_PROMPT constant
```

---

## Connector Source Map

| Source | Path | Format | Priority |
|--------|------|---------|----------|
| Claude Code | `~/.claude/projects/[encoded-cwd]/[session-uuid].jsonl` | JSONL (one event per line) | P1 — build first |
| Agent configs | `~/.claude/CLAUDE.md`, `[project]/CLAUDE.md`, `~/.claude/settings.json`, `~/.claude/skills/` | Markdown + JSON | P1 — needed for alignment |
| Learnings folder | `/Users/vela/Developer/learnings/**/*.md` + any configured notes path | Markdown | P1 — rich demo data |
| opencode | `~/Library/Application Support/opencode/opencode.db` | SQLite | P2 |
| Cursor | `~/Library/Application Support/Cursor/User/workspaceStorage/[id]/state.vscdb` | SQLite | P2 |
| Generic export | `~/.dream/exports/` | JSON or Markdown drop folder | P3 — fallback for Pi, ChatGPT, etc. |

---

## Normalized Session Format

Every connector outputs this shape. Downstream code (MongoDB, synthesis) only sees this.

```python
# ingestion/normalizer.py

from pydantic import BaseModel
from datetime import datetime
from typing import Literal

class Turn(BaseModel):
    role: Literal["user", "assistant"]
    content: str                    # text content only (strip tool call XML)
    timestamp: datetime
    has_tool_call: bool = False
    tool_names: list[str] = []      # which tools the agent called

class SessionMetadata(BaseModel):
    total_turns: int
    user_turns: int
    assistant_turns: int
    session_length_minutes: float
    context_switches: int           # topic shifts (computed post-normalization)
    user_rephrases: int             # user sent similar prompt within 3 turns
    agent_clarifications: int       # assistant asked "what do you mean?" / "could you clarify?"
    agent_hedges: int               # "I think", "I'm not sure", "you might want to"
    agent_contradictions: int       # assistant reversed its own answer in same session

class NormalizedSession(BaseModel):
    session_id: str                 # stable ID (source:project:uuid)
    source: Literal["claude-code", "cursor", "opencode", "notes", "export"]
    project_path: str               # decoded project directory
    project_name: str               # last segment of path
    date: str                       # YYYY-MM-DD
    started_at: datetime
    ended_at: datetime
    turns: list[Turn]
    metadata: SessionMetadata
    raw_source_path: str            # original file path (for debugging)
```

---

## MongoDB Schema

### `sessions` collection

```javascript
{
  _id: ObjectId,
  session_id: String,          // "claude-code:/Users/vela/Dev/learnings:abc123"
  source: String,              // "claude-code" | "cursor" | "opencode" | "notes" | "export"
  project_path: String,
  project_name: String,
  date: String,                // "2026-06-27"
  started_at: Date,
  ended_at: Date,
  turns: [{ role, content, timestamp, has_tool_call, tool_names }],
  metadata: { total_turns, session_length_minutes, context_switches,
               user_rephrases, agent_clarifications, agent_hedges,
               agent_contradictions },
  embedding: [Float],          // 768-dim from Gemini text-embedding-004
  topics: [String],            // extracted by Gemini at ingest time
  ingested_at: Date,
}
```

Index: `{ date: 1, source: 1 }`, `{ session_id: 1 }` (unique), vector index on `embedding`.

### `agent_configs` collection

```javascript
{
  _id: ObjectId,
  source: String,              // "claude-code-global" | "claude-code-project" | "cursor"
  path: String,                // file path
  date: String,                // date snapshot was taken
  content: String,             // raw file content
  instructions: [String],      // key directives extracted by Gemini
  skills: [String],            // skill/domain labels extracted
  embedding: [Float],
  snapshot_at: Date,
}
```

### `learnings` collection

```javascript
{
  _id: ObjectId,
  file_path: String,
  topic_folder: String,        // "llm" | "backend" | "auth" etc.
  filename: String,
  date_modified: Date,
  content: String,
  embedding: [Float],
  topics: [String],
  ingested_at: Date,
}
```

### `dream_logs` collection

```javascript
{
  _id: ObjectId,
  date: String,                // "2026-06-27"
  
  mind_map: {
    nodes: [{ topic, weight, is_new }],
    edges: [[String, String]]
  },

  your_mood: { label, summary, signal },
  your_question: { question, evidence },

  agent_mood: { label, summary, signal },
  agent_question: { question, evidence },

  alignment_score: Float,      // 0.0–1.0
  alignment_label: String,     // "collaborating" | "friction" | "fighting"

  friction_points: [{
    type: String,              // "config-conflict" | "missing-skill" | "wrong-domain" | "unclear-prompt"
    description: String,
    evidence: String,
  }],

  recommendations: [{
    target: String,            // "claude-md" | "agent-skill" | "context-doc" | "prompt-habit"
    action: String,
    reason: String,
  }],

  seven_day_pattern: [{ date, alignment_score, alignment_label }],
  synthesis_context: String,   // injected into voice session
  created_at: Date,
}
```

---

## Connector Implementation Details

### Claude Code (`connectors/claude_code.py`)

```
Discovery:
  base = Path("~/.claude/projects").expanduser()
  for encoded_dir in base.iterdir():
    project_path = encoded_dir.name.replace("-", "/").lstrip("/")
    for jsonl_file in encoded_dir.glob("*.jsonl"):
      yield SessionRef(project_path=project_path, file=jsonl_file)

Parsing (stream line by line, never load full file):
  Skip types: "permission-mode", "file-history-snapshot", "attachment"
  Keep types: "user", "assistant"
  
  user event → Turn(role="user", content=message.content[text], timestamp)
  assistant event → Turn(role="assistant", content=extract_text(message.content),
                         has_tool_call=any(c.type=="tool_use"),
                         tool_names=[c.name for c in content if tool_use])
  
  Session boundary: group by sessionId field
  Session date: first event's timestamp
```

### Agent Configs (`connectors/agent_configs.py`)

```
Files to read:
  ~/.claude/CLAUDE.md                        # global instructions
  ~/.claude/settings.json                    # permission mode, model prefs
  ~/.claude/skills/**/*.md                   # installed skills
  [each project cwd]/CLAUDE.md              # project-specific instructions
  [each project cwd]/.cursorrules           # Cursor rules
  
For each CLAUDE.md: read raw content → store as agent_config document
Extract instructions and skills via a lightweight Gemini call at ingest time.
```

### opencode (`connectors/opencode.py`)

```
DB path: ~/Library/Application Support/opencode/opencode.db
Schema (to be confirmed with sqlite3):
  sqlite3 ~/Library/Application\ Support/opencode/opencode.db .tables
  
Expected tables: sessions, messages (or similar)
Read with: sqlite3 connection, SELECT * FROM messages ORDER BY created_at
Map: message.role → Turn.role, message.content → Turn.content
```

### Cursor (`connectors/cursor.py`)

```
DB path: ~/Library/Application Support/Cursor/User/workspaceStorage/[id]/state.vscdb
Each workspace has its own SQLite db.
Discovery: glob all workspaceStorage/*/state.vscdb

Schema inspection needed: sqlite3 state.vscdb .tables
Cursor stores chat in an ItemTable with JSON values.
Key to look for: "aichat.workspaceState.chat" or similar JSON blob.
```

### Generic Export (`connectors/generic_export.py`)

```
Watch folder: ~/.dream/exports/
Supported formats:
  - *.md files → treat as a single-turn note
  - *.json files → expect { source, turns: [{role, content, timestamp}] }
  - *.txt files → treat as notes

This covers Pi, ChatGPT exports, any manual paste.
```

---

## FastAPI Endpoints

```python
# main.py

POST /ingest
  body: { date?: str, sources?: list[str] }  # defaults to today, all sources
  response: { job_id, status: "queued" }
  → runs pipeline.ingest_all(date) in background

GET /ingest/status/{job_id}
  response: { status, sources_done, sessions_found, errors }

POST /synthesize  
  body: { date?: str }                        # defaults to today
  response: { job_id, status: "queued" }
  → runs synthesis agent in background

GET /dreams
  response: [{ date, alignment_score, alignment_label, created_at }]

GET /dreams/{date}
  response: DreamLog (full document)

GET /sessions
  query: date?, source?, project?
  response: [NormalizedSession (without turns for list view)]

GET /sessions/{session_id}
  response: NormalizedSession (full with turns)

GET /health
  response: { status, mongodb: bool, gemini: bool }
```

---

## Pydantic AI Synthesis Agent

### Schema (`synthesis/schema.py`)

```python
from pydantic import BaseModel, Field
from typing import Literal

class MoodSignal(BaseModel):
    label: Literal["deep-focus", "scattered", "exploratory", "frustrated",
                   "confident", "uncertain", "confused", "overloaded"]
    summary: str
    signal: str                 # what in the data revealed this

class ImplicitQuestion(BaseModel):
    question: str
    evidence: str               # where in sessions it appeared

class MindMapNode(BaseModel):
    topic: str
    weight: float               # 0–1, relative depth of engagement
    is_new: bool                # not seen in historical sessions

class FrictionPoint(BaseModel):
    type: Literal["config-conflict", "missing-skill", "wrong-domain", "unclear-prompt"]
    description: str
    evidence: str

class Recommendation(BaseModel):
    target: Literal["claude-md", "agent-skill", "context-doc", "prompt-habit"]
    action: str
    reason: str

class DayPattern(BaseModel):
    date: str
    alignment_score: float
    alignment_label: str

class DreamLog(BaseModel):
    mind_map_nodes: list[MindMapNode]
    mind_map_edges: list[tuple[str, str]]

    your_mood: MoodSignal
    your_question: ImplicitQuestion

    agent_mood: MoodSignal
    agent_question: ImplicitQuestion

    alignment_score: float = Field(ge=0.0, le=1.0)
    alignment_label: Literal["collaborating", "friction", "fighting"]
    friction_points: list[FrictionPoint]
    recommendations: list[Recommendation]

    seven_day_pattern: list[DayPattern]
    synthesis_context: str      # 2–3 paragraphs, loaded into voice session
```

### Agent (`synthesis/agent.py`)

```python
from pydantic_ai import Agent, RunContext
from dataclasses import dataclass
from motor.motor_asyncio import AsyncIOMotorDatabase

@dataclass
class SynthesisDeps:
    db: AsyncIOMotorDatabase
    date: str

dream_agent = Agent(
    "google-gla:gemini-2.5-flash",
    output_type=DreamLog,
    deps_type=SynthesisDeps,
    instructions=SYNTHESIS_PROMPT,
    retries=2,
)

@dream_agent.tool
async def get_today_sessions(ctx: RunContext[SynthesisDeps]) -> list[dict]:
    """Fetch all normalized sessions from today across all sources."""
    docs = await ctx.deps.db.sessions.find({"date": ctx.deps.date}).to_list(None)
    # Return turns + metadata only, not embeddings
    return [{ "source": d["source"], "project": d["project_name"],
               "turns": d["turns"], "metadata": d["metadata"] } for d in docs]

@dream_agent.tool
async def get_agent_configs(ctx: RunContext[SynthesisDeps]) -> list[dict]:
    """Fetch all agent config files — CLAUDE.md, skills, settings."""
    docs = await ctx.deps.db.agent_configs.find({"date": ctx.deps.date}).to_list(None)
    return [{ "source": d["source"], "path": d["path"], "content": d["content"] } for d in docs]

@dream_agent.tool
async def search_past_sessions(ctx: RunContext[SynthesisDeps], topic: str) -> list[dict]:
    """Vector search past sessions to check if a topic is new."""
    # MongoDB Atlas vector search
    results = await ctx.deps.db.sessions.aggregate([{
        "$vectorSearch": {
            "index": "sessions_vector_index",
            "queryVector": await embed_text(topic),
            "path": "embedding",
            "numCandidates": 50,
            "limit": 5,
        }
    }]).to_list(None)
    return [{ "date": r["date"], "source": r["source"], "topics": r["topics"] } for r in results]

@dream_agent.tool
async def get_seven_day_pattern(ctx: RunContext[SynthesisDeps]) -> list[dict]:
    """Fetch alignment scores from the past 7 dream logs."""
    logs = await ctx.deps.db.dream_logs.find(
        {}, sort=[("date", -1)], limit=7
    ).to_list(None)
    return [{ "date": l["date"], "alignment_score": l["alignment_score"],
               "alignment_label": l["alignment_label"] } for l in logs]

@dream_agent.tool  
async def save_dream_log(ctx: RunContext[SynthesisDeps], log: dict) -> str:
    """Persist the completed dream log to MongoDB."""
    log["date"] = ctx.deps.date
    log["created_at"] = datetime.utcnow()
    await ctx.deps.db.dream_logs.replace_one(
        {"date": ctx.deps.date}, log, upsert=True
    )
    return "saved"
```

---

## Build Order (Day by Day)

### Day 1 — Ingestion Foundation

**Goal: MongoDB has real session data from Claude Code + CLAUDE.md + learnings.**

```
[ ] Set up apps/api/ — requirements.txt, .env, main.py skeleton
[ ] db.py — MongoDB Atlas connection, collection helpers, vector index
[ ] connectors/claude_code.py — JSONL parser + normalization
[ ] connectors/agent_configs.py — CLAUDE.md + settings.json reader
[ ] connectors/learnings_folder.py — markdown file reader
[ ] ingestion/normalizer.py — NormalizedSession + signal extraction
[ ] ingestion/pipeline.py — orchestrate all P1 connectors
[ ] POST /ingest + GET /ingest/status endpoints
[ ] Test: run ingestion on your real ~/.claude/projects/ data
[ ] Verify: sessions appear in MongoDB with correct shape
```

### Day 2 — Dream Synthesis

**Goal: POST /synthesize returns a valid DreamLog from real session data.**

```
[ ] synthesis/schema.py — full DreamLog Pydantic models
[ ] synthesis/prompt.py — SYNTHESIS_PROMPT (from proposal)
[ ] synthesis/agent.py — Pydantic AI agent + 5 tools
[ ] embedder.py — Gemini text-embedding-004 helper
[ ] MongoDB vector index — create on sessions.embedding
[ ] POST /synthesize + GET /dreams/{date} endpoints
[ ] Test: run synthesis on Day 1 data, check DreamLog shape
[ ] Iterate prompt until alignment_score + friction_points feel real
[ ] connectors/opencode.py — SQLite reader (opencode.db)
[ ] connectors/cursor.py — SQLite reader (state.vscdb)
```

### Day 3 — Polish + Demo Prep

**Goal: API is stable, demo data is pre-loaded, frontend team can integrate.**

```
[ ] connectors/generic_export.py — ~/.dream/exports/ drop folder
[ ] GET /sessions + GET /sessions/{id} endpoints
[ ] GET /health endpoint  
[ ] Pre-load your full learnings folder + recent Claude Code sessions
[ ] Run synthesis on demo data — iterate until DreamLog reads well
[ ] Write README for frontend team (endpoint contracts, DreamLog shape)
[ ] .env.example with all required keys
[ ] Test full pipeline end-to-end: ingest → synthesize → GET /dreams/today
```

---

## Environment Variables

```bash
# .env.example
MONGODB_URI=mongodb+srv://...
MONGODB_DB=dream

GEMINI_API_KEY=...

# Optional: notes folder (defaults to ~/Developer/learnings)
NOTES_FOLDER=/Users/vela/Developer/learnings

# Optional: generic export drop folder (defaults to ~/.dream/exports)
EXPORT_FOLDER=~/.dream/exports
```

---

## Open Questions Before Coding

1. **Cursor SQLite schema** — need to run `.tables` and inspect `state.vscdb` to confirm the chat history key
2. **opencode SQLite schema** — same: need `.tables` on `opencode.db`
3. **MongoDB Atlas cluster** — do you have connection string ready? Or use local MongoDB for day 1?
4. **Gemini API key** — needed for day 2 synthesis + embeddings
5. **Context window budget** — a full day of Claude Code sessions can be 5–10MB of JSONL. Will summarize turns > 500 tokens before synthesis rather than send raw text.

