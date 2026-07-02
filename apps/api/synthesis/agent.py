"""
Two-stage synthesis pipeline:
  Stage 1 — Observer: reads raw sessions + configs + yesterday's HealthLog → DayObservation
  Stage 2 — Synthesizer: reads DayObservation + past 7 days → HealthLog
"""
import os
import json
from datetime import datetime, timezone

from pydantic_ai import Agent
from dotenv import load_dotenv

from ingestion.pipeline import IngestResult
from ingestion.normalizer import NormalizedSession
from connectors.agent_configs import AgentConfig
from synthesis.schema import DayObservation, HealthLog
from synthesis.prompt import OBSERVER_PROMPT, SYNTHESIZER_PROMPT

load_dotenv()


# ── Formatters ────────────────────────────────────────────────────────────────

def _format_session(s: NormalizedSession) -> str:
    lines = [
        f"[{s.source}] {s.project_name} — {s.date}",
        f"Duration: {s.metadata.session_length_minutes:.0f}min  "
        f"Turns: {s.metadata.total_turns}  "
        f"Rephrases: {s.metadata.user_rephrases}  "
        f"Hedges: {s.metadata.agent_hedges}  "
        f"Clarifications: {s.metadata.agent_clarifications}",
    ]
    for t in s.turns:
        prefix = "You" if t.role == "user" else "Agent"
        lines.append(f"{prefix}: {t.content[:400]}")
    return "\n".join(lines)


def _format_config(c: AgentConfig) -> str:
    return f"[{c.source}] {c.path}\n{c.content[:1000]}"


def _format_yesterday(doc: dict | None) -> str:
    if not doc:
        return "## Yesterday's HealthLog\n\nNo baseline — this is Day 1."
    lines = [
        f"## Yesterday's HealthLog ({doc.get('date', 'unknown')})",
        f"Alignment: {doc.get('alignment_score', '?')} ({doc.get('alignment_label', '?')})",
        f"Your mood: {doc.get('your_mood', {}).get('label', '?')}",
        f"Agent mood: {doc.get('agent_mood', {}).get('label', '?')}",
    ]
    fps = doc.get("friction_points", [])
    if fps:
        lines.append("Friction points:")
        for fp in fps:
            lines.append(f"  [{fp.get('type')}] {fp.get('description')}")
    recs = doc.get("recommendations", [])
    if recs:
        lines.append("Recommendations given:")
        for r in recs:
            lines.append(f"  → [{r.get('target')}] {r.get('action')}")
    acted = doc.get("acted_on_recommendations", [])
    if acted:
        lines.append("Acted on (from day before):")
        for a in acted:
            lines.append(f"  ✓ {a}")
    return "\n".join(lines)


# ── Context builders ──────────────────────────────────────────────────────────

def _build_observer_context(
    result: IngestResult,
    date: str,
    yesterday_doc: dict | None,
) -> str:
    sections = []

    day_sessions = [s for s in result.sessions if s.source != "git" and s.date == date]
    if day_sessions:
        text = "\n\n---\n\n".join(_format_session(s) for s in day_sessions)
        sections.append(f"## Chat Sessions\n\n{text}")

    git_sessions = [s for s in result.sessions if s.source == "git" and s.date == date]
    if git_sessions:
        text = "\n\n".join(_format_session(s) for s in git_sessions)
        sections.append(f"## Git Commits\n\n{text}")

    configs_text = "\n\n".join(_format_config(c) for c in result.configs[:20])
    if configs_text:
        sections.append(f"## Agent Configs\n\n{configs_text}")

    sections.append(_format_yesterday(yesterday_doc))

    return "\n\n".join(sections)


def _build_synthesizer_context(
    observation: DayObservation,
    yesterday_doc: dict | None,
    past_docs: list[dict],
    date: str,
) -> str:
    obs_json = observation.model_dump_json(indent=2)

    history_lines = []
    for d in past_docs:
        history_lines.append(
            f"{d['date']}: score={d.get('alignment_score', '?')} "
            f"label={d.get('alignment_label', '?')}"
        )

    yesterday_recs = []
    if yesterday_doc:
        yesterday_recs = [
            f"[{r.get('target')}] {r.get('action')}"
            for r in yesterday_doc.get("recommendations", [])
        ]

    parts = [
        f"Synthesize the HealthLog for {date}.",
        f"\n## DayObservation (from Observer agent)\n\n```json\n{obs_json}\n```",
    ]
    if yesterday_recs:
        parts.append("## Yesterday's Recommendations\n\n" + "\n".join(f"- {r}" for r in yesterday_recs))
    if history_lines:
        parts.append("## Past 7 Days\n\n" + "\n".join(history_lines))

    return "\n\n".join(parts)


# ── Main entry point ──────────────────────────────────────────────────────────

async def synthesize(result: IngestResult, date: str | None = None) -> HealthLog:
    target_date = date or datetime.now(timezone.utc).date().isoformat()
    yesterday_doc = None
    past_docs: list[dict] = []

    os.environ["GOOGLE_API_KEY"] = os.environ["GEMINI_API_KEY"]

    # ── Stage 1: Observer ─────────────────────────────────────────────────────
    print("  [Stage 1] Observer reading sessions + configs + yesterday's health...")
    observer = Agent(
        model="google:gemini-2.5-flash",
        output_type=DayObservation,
        system_prompt=OBSERVER_PROMPT,
        retries=2,
    )
    observer_context = _build_observer_context(result, target_date, yesterday_doc)
    obs_result = await observer.run(
        f"Observe and analyze {target_date}.\n\n{observer_context}"
    )
    observation = obs_result.output
    print(f"  [Stage 1] Done. Topics: {observation.topics_raw}")

    # ── Stage 2: Synthesizer ──────────────────────────────────────────────────
    print("  [Stage 2] Synthesizer producing HealthLog...")
    synthesizer = Agent(
        model="google:gemini-2.5-flash",
        output_type=HealthLog,
        system_prompt=SYNTHESIZER_PROMPT,
        retries=2,
    )
    synth_context = _build_synthesizer_context(observation, yesterday_doc, past_docs, target_date)
    health_result = await synthesizer.run(synth_context)
    health_log = health_result.output
    health_log.date = target_date
    print(f"  [Stage 2] Done. Alignment: {health_log.alignment_score:.2f} ({health_log.alignment_label})")

    return health_log
