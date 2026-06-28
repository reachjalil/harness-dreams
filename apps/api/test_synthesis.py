"""
End-to-end synthesis test. Run from apps/api/:
  python3 test_synthesis.py             # today
  python3 test_synthesis.py 2026-06-26  # specific date
"""
import asyncio
import sys
import json
from db import ensure_indexes
from ingestion.pipeline import ingest_all
from synthesis.agent import synthesize


async def main():
    date = sys.argv[1] if len(sys.argv) > 1 else None
    print(f"Ingesting for date={date or 'today'}...")

    await ensure_indexes()
    result = await ingest_all(date)
    summary = result.summary()
    print(f"  sessions={summary['total_sessions']}  configs={summary['total_configs']}  by_source={summary['by_source']}")

    if not result.sessions:
        print("No sessions found — nothing to synthesize.")
        return

    print("\nSynthesizing dream log...")
    dream = await synthesize(result, date)

    print(f"\n{'='*60}")
    print(f"Date:            {dream.date}")
    print(f"Alignment:       {dream.alignment_score:.2f} ({dream.alignment_label})")
    print(f"\nYour mood:       {dream.your_mood.label}")
    print(f"  {dream.your_mood.summary}")
    print(f"\nAgent mood:      {dream.agent_mood.label}")
    print(f"  {dream.agent_mood.summary}")
    print(f"\nYour question:   {dream.your_question.question}")
    print(f"Agent question:  {dream.agent_question.question}")
    print(f"\nTopics ({len(dream.mind_map_nodes)}):")
    for n in sorted(dream.mind_map_nodes, key=lambda x: -x.weight):
        new_tag = " [NEW]" if n.is_new else ""
        print(f"  {n.weight:.2f}  {n.topic}{new_tag}")
    if dream.friction_points:
        print(f"\nFriction ({len(dream.friction_points)}):")
        for f in dream.friction_points:
            print(f"  [{f.type}] {f.description}")
    if dream.recommendations:
        print(f"\nRecommendations:")
        for r in dream.recommendations:
            print(f"  → [{r.target}] {r.action}")
    print(f"\nSynthesis context:\n{dream.synthesis_context}")
    print(f"{'='*60}")
    print("\nSaved to MongoDB dream_logs.")


asyncio.run(main())
