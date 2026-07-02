"""
End-to-end synthesis test. Run from apps/api/:
  python3 test_synthesis.py             # today
  python3 test_synthesis.py 2026-06-26  # specific date
"""
import asyncio
import sys
import json
from ingestion.pipeline import ingest_all
from synthesis.agent import synthesize


async def main():
    date = sys.argv[1] if len(sys.argv) > 1 else None
    print(f"Ingesting for date={date or 'today'}...")

    result = await ingest_all(date)
    summary = result.summary()
    print(f"  sessions={summary['total_sessions']}  configs={summary['total_configs']}  by_source={summary['by_source']}")

    if not result.sessions:
        print("No sessions found — nothing to synthesize.")
        return

    print("\nSynthesizing health log...")
    health = await synthesize(result, date)

    print(f"\n{'='*60}")
    print(f"Date:            {health.date}")
    print(f"Alignment:       {health.alignment_score:.2f} ({health.alignment_label})")
    print(f"\nYour mood:       {health.your_mood.label}")
    print(f"  {health.your_mood.summary}")
    print(f"\nAgent mood:      {health.agent_mood.label}")
    print(f"  {health.agent_mood.summary}")
    print(f"\nYour question:   {health.your_question.question}")
    print(f"Agent question:  {health.agent_question.question}")
    print(f"\nTopics ({len(health.mind_map_nodes)}):")
    for n in sorted(health.mind_map_nodes, key=lambda x: -x.weight):
        new_tag = " [NEW]" if n.is_new else ""
        print(f"  {n.weight:.2f}  {n.topic}{new_tag}")
    if health.friction_points:
        print(f"\nFriction ({len(health.friction_points)}):")
        for f in health.friction_points:
            print(f"  [{f.type}] {f.description}")
    if health.recommendations:
        print(f"\nRecommendations:")
        for r in health.recommendations:
            print(f"  → [{r.target}] {r.action}")
    print(f"\nSynthesis context:\n{health.synthesis_context}")
    print(f"{'='*60}")
    print("\nSynthesis completed locally; persistence stays on the Mac.")


asyncio.run(main())
