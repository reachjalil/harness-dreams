# Dream Agent — Step 2: Synthesis

## What This Step Does

Synthesis is where raw ingestion data becomes insight. It runs after `ingest_all()` and produces
a `DreamLog` — the only document ever written to MongoDB. Everything else (sessions, configs,
chat content) stays local.

The core design principle: **this is a continuous learning loop, not a daily summary tool.**
Yesterday's DreamLog is the baseline the agent compares against today. Over time the agent tracks
whether friction is resolving, whether recommendations are being followed, and whether alignment
is improving or declining.

---

## Agent Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            IngestResult (in memory)                         │
│          sessions (claude-code, cursor, codex, opencode, git, ...)          │
│          configs  (CLAUDE.md, AGENTS.md, MCP, soul.md, skills, ...)         │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
                    ▼               ▼               ▼
             chat sessions     git commits     agent configs
             (user turns +    (what shipped   (CLAUDE.md,
              agent turns)     vs discussed)   MCP, skills)
                    │               │               │
                    └───────────────┴───────────────┘
                                    │
                        ┌───────────▼────────────┐
                        │     MongoDB lookup      │
                        │  yesterday's DreamLog   │◄── alignment_score
                        │  (full document)        │    friction_points
                        └───────────┬────────────┘    recommendations
                                    │                  model_usage
                                    │
                    ┌───────────────▼────────────────────┐
                    │          STAGE 1: Observer          │
                    │       model: gemini-2.5-flash       │
                    │       output: DayObservation        │
                    │                                     │
                    │  reads: sessions + configs +        │
                    │         yesterday's DreamLog        │
                    │                                     │
                    │  observes:                          │
                    │  • user prompt patterns (mood)      │
                    │  • agent response patterns (mood)   │
                    │  • topics worked on                 │
                    │  • key moments (specific quotes)    │
                    │  • commit vs session drift          │
                    │  • config changes from yesterday    │
                    │  • which recs were followed/ignored │
                    │  • model usage observed             │
                    └───────────────┬────────────────────┘
                                    │
                               DayObservation
                          (structured, ~20 fields,
                           mostly free-form text)
                                    │
                    ┌───────────────▼────────────────────┐
                    │       MongoDB lookup (again)        │
                    │   past 7 DreamLogs (lightweight)   │◄── date
                    │   for seven_day_pattern + trends   │    alignment_score
                    └───────────────┬────────────────────┘    alignment_label
                                    │
                    ┌───────────────▼────────────────────┐
                    │        STAGE 2: Synthesizer         │
                    │       model: gemini-2.5-flash       │
                    │       output: DreamLog (typed)      │
                    │                                     │
                    │  reads: DayObservation +            │
                    │         yesterday's recs +          │
                    │         past 7 day patterns         │
                    │                                     │
                    │  produces:                          │
                    │  • mind_map_nodes + edges           │
                    │  • your_mood / agent_mood           │
                    │  • your_question / agent_question   │
                    │  • alignment_score + label          │
                    │  • friction_points (typed)          │
                    │  • recommendations (concrete)       │
                    │  • config_diffs (delta layer)       │
                    │  • friction_deltas (resolved/new)   │
                    │  • model_usage                      │
                    │  • acted_on_recommendations         │
                    │  • seven_day_pattern                │
                    │  • synthesis_context (voice brief)  │
                    └───────────────┬────────────────────┘
                                    │
                                 DreamLog
                           (Pydantic validated,
                            auto-retry on schema fail)
                                    │
                    ┌───────────────▼────────────────────┐
                    │             MongoDB                 │
                    │   dream_logs.update_one(upsert)    │
                    │   unique index on date             │
                    └───────────────┬────────────────────┘
                                    │
                        ┌───────────┴──────────────┐
                        │                          │
                        ▼                          ▼
              GET /dreams/{date}          synthesis_context
              (FastAPI endpoint)       (loaded into voice session
                                        for morning briefing)
```

---

## The Continuous Learning Loop

```
Day 1                Day 2                Day 3
─────                ─────                ─────
observe          ┌── compare          ┌── compare
  sessions       │     sessions +     │     sessions +
  configs        │     Day 1 log      │     Day 2 log
  commits        │                    │
     │           │   friction         │   friction
     ▼           │   persisting? ─────┼── still there?
  DreamLog ──────┘   resolved?        │   escalating?
  saved to           new?             │
  MongoDB                │            │   recs followed?
                         ▼            │   configs updated?
                      DreamLog ───────┘
                      saved to
                      MongoDB
```

**What the loop tracks over time:**
- Friction points: how many days is the same pattern persisting?
- Recommendations: did you act on them? Did it help?
- Model usage: did you switch models? Did alignment improve after?
- Config evolution: how is your CLAUDE.md changing week over week?

---

## Neuroscience Foundation

The two-stage design is grounded in how human dreaming actually works — specifically the
distinction between NREM and REM sleep, and what each pass does to the day's memories.

### NREM sleep → Stage 1 (Observer)
During NREM, the hippocampus replays the day's events in compressed bursts to the neocortex.
This is brute-force consolidation: extract what happened, transfer it from short-term to
long-term storage. No synthesis yet. Just observation and extraction.

The Observer mirrors this: read everything, take exhaustive notes, extract emotionally charged
moments as `key_moments`. No schema pressure. No synthesis.

### REM sleep → Stage 2 (Synthesizer)
REM runs on acetylcholine instead of serotonin. The prefrontal cortex (logical filtering) goes
offline. The amygdala (emotional significance) stays on. This produces two things waking review
can't match:
1. **Cross-domain association**: weak links between unrelated memories become active that would
   be filtered awake — this is why the unexpected insight arrives in the morning.
2. **Emotional defusion**: the brain replays emotionally charged events and gradually strips the
   charge — dreams don't amplify friction, they metabolize it.

The Synthesizer mirrors this: weight topics by emotional signal intensity (not time spent),
find cross-day patterns, name friction neutrally. Open the morning briefing with the sharpest
non-obvious insight, close with one question — not an action list.

### Key research findings applied

| Finding | Applied in |
|---|---|
| Brain weights memories by emotional salience, not duration | Observer weights `key_moments` by rephrase count, rejections, hedge density — not turn count |
| REM finds cross-domain connections (emotional rhyming across unrelated topics) | Synthesizer explicitly looks for friction that rhymes emotionally across days/domains |
| Dreams defuse emotional charge — don't amplify it | synthesis_context tone: neutral coach, not postmortem |
| Morning hypnopompic window primes the day's cognitive frame | synthesis_context structure: sharpest insight first, one question last |
| Continuity hypothesis: dreams reflect unresolved waking concerns | Delta layer tracks recommendations that persist unacted-on across days |

Sources: Stickgold (memory consolidation), Walker (REM/NREM roles), Cartwright 2024 (emotional
defusion), Revonsuo (threat simulation), default mode network fMRI studies (REM brain imaging).

---

## Why Two Stages

| Concern | Single-shot | Two-stage |
|---|---|---|
| Schema pressure | Agent fills fields fast, skips deep reading | Observer reads freely (NREM-like), no schema constraint |
| Evidence quality | Generic observations | Observer extracts specific quotes as `key_moments` |
| Emotional weighting | Topics weighted by time spent | Topics weighted by emotional signal intensity |
| Cross-day patterns | Each day treated independently | Synthesizer connects today's friction to prior days |
| Delta analysis | Mixed with synthesis | Observer handles diff; Synthesizer only structures |
| Debuggability | Can't inspect intermediate reasoning | DayObservation is inspectable before Stage 2 runs |
| Retry granularity | Full retry if schema fails | Only Stage 2 retries on schema failure |

---

## Key Files

| File | Role |
|---|---|
| `synthesis/schema.py` | All Pydantic models: `DayObservation`, `DreamLog`, delta sub-models |
| `synthesis/prompt.py` | `OBSERVER_PROMPT` + `SYNTHESIZER_PROMPT` |
| `synthesis/agent.py` | Two-stage pipeline: `synthesize(result, date) → DreamLog` |
| `synthesis/__init__.py` | Package init |
| `main.py` | FastAPI: `POST /synthesize`, `GET /dreams/{date}`, `GET /health` |
| `test_synthesis.py` | End-to-end test: ingest → synthesize → print |

---

## DreamLog Schema (what gets saved to MongoDB)

```
DreamLog
├── date                        YYYY-MM-DD
│
├── Mind map
│   ├── mind_map_nodes[]        topic, weight, is_new
│   └── mind_map_edges[]        (topic_a, topic_b) pairs
│
├── Your side
│   ├── your_mood               label, summary, evidence
│   └── your_question           question, evidence
│
├── Agent side
│   ├── agent_mood              label, summary, evidence
│   └── agent_question          question, evidence
│
├── Alignment
│   ├── alignment_score         0.0–1.0
│   ├── alignment_label         aligned | mild-friction | friction | misaligned
│   ├── friction_points[]       type, description, evidence
│   └── recommendations[]       target, action, reason
│
├── Delta layer (vs yesterday)
│   ├── config_diffs[]          file, change_type, summary
│   ├── friction_deltas[]       description, status, days_persisting
│   ├── model_usage[]           source, model, session_count
│   └── acted_on_recommendations[]
│
└── Continuity
    ├── seven_day_pattern[]     date, alignment_score, alignment_label
    └── synthesis_context       2-3 paragraph voice briefing
```

---

## Running

```bash
# End-to-end test (ingest + synthesize for a specific date)
cd apps/api
python3 test_synthesis.py 2026-06-26

# Start the API
uvicorn main:app --reload --port 8000

# Trigger synthesis via API
curl -X POST http://localhost:8000/synthesize \
  -H "Content-Type: application/json" \
  -d '{"date": "2026-06-26"}'

# Poll job status
curl http://localhost:8000/synthesize/{job_id}

# Read the result
curl http://localhost:8000/dreams/2026-06-26
```

---

## synthesis_context Structure (Morning Briefing)

The voice briefing follows a neurologically-grounded structure based on the hypnopompic window —
the transition from sleep to waking when the brain is most receptive to framing.

```
Paragraph 1 — The sharpest non-obvious insight
  NOT: "Yesterday you worked on X."
  YES: "The prompt engineering vs. hardcoding tension escalated into an architectural rethink —
       following yesterday's recommendation made things worse before it made them better."

Paragraph 2 — What changed from the day before
  Delta in plain language: friction resolved, new friction, models switched,
  configs updated, recommendations followed or ignored.

Paragraph 3 — One question to carry into today
  NOT: an action list.
  YES: "Where does the line lie between LLM agency and explicit code-based control
       for deterministic workflows?"
```

The brain waking up encodes a single goal-frame. One question activates a search mode.
An action list activates nothing.

---

## Observed Results (Jun 22–26, 2026)

First 5-day run on real sessions:

| Date | Sessions | Alignment | Label | Your mood | Agent mood |
|---|---|---|---|---|---|
| Jun 22 | 14 | 0.65 | mild-friction | frustrated | iterating |
| Jun 23 | 8 | 0.60 | mild-friction | iterating | iterating |
| Jun 24 | 11 | 0.70 | mild-friction | iterating | iterating |
| Jun 25 | 4 | 0.75 | mild-friction | iterating | iterating |
| Jun 26 | 3 | 0.30 | misaligned | frustrated | uncertain |

**Pattern the loop detected:**
Alignment improved Jun 22→25 (0.65 → 0.75) as agent learned to plan before executing.
Then dropped sharply on Jun 26 (0.50 → 0.30 after prompt update) when the same architectural
tension peaked. The recommendation "provide a plan before executing" appeared verbatim on Jun 24,
25, and 26 — all marked "not acted on" by the delta layer.

**Cross-domain pattern (detected by updated prompts):**
The core recurring friction across all 5 days — LLM control vs. code-enforced determinism —
is emotionally the same tension even when manifesting in different subsystems (prompt engineering,
git workflow, HITL events, LinkedIn state sync). The updated Synthesizer correctly identified
this as one pattern, not five separate issues.

**Before vs after prompt update (Jun 26):**

| | Old prompts | Updated prompts |
|---|---|---|
| Alignment score | 0.50 (friction) | 0.30 (misaligned) — more accurate |
| Top topic | "Debugging onboarding flow" | "LLM's inherent biases overriding prompt instructions" |
| synthesis_context opens | Chronology summary | The cross-day architectural insight |
| Closes with | Action list | One question |

---

## What's Next (Step 3)

- Gemini Live integration: load `synthesis_context` into a voice session as the morning briefing
- Frontend dashboard: mind map visualization + 7-day alignment trend chart
- Scheduled synthesis: cron at 6am to auto-run overnight
