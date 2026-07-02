import { useMemo } from 'react';
import { progressFromValue } from './ringMath';
import type { DailyFact, GoalDefinition, RingDefinition, RingProgress } from '../data/healthModels';

export function useRingProgress(
  rings: RingDefinition[],
  goals: GoalDefinition[],
  facts: DailyFact[],
): RingProgress[] {
  return useMemo(() => {
    const goalById = new Map(goals.map((goal) => [goal.id, goal]));
    const factByMetric = new Map(facts.map((fact) => [fact.metricId, fact]));

    return [...rings]
      .sort((a, b) => a.order - b.order)
      .map((ring) => {
        const goal = goalById.get(ring.goalId);
        if (!goal) {
          return {
            ringId: ring.id,
            label: ring.label,
            value: 0,
            goal: 1,
            unit: '',
            progress: 0,
            completed: false,
            overflowLaps: 0,
            remainder: 0,
            colorToken: ring.colorToken,
          };
        }

        const fact = factByMetric.get(goal.metricId);
        const value = fact?.value ?? 0;
        const progress = progressFromValue(value, goal.target);

        return {
          ringId: ring.id,
          label: ring.label,
          value,
          goal: goal.target,
          unit: goal.unit,
          progress,
          completed: progress >= 1,
          overflowLaps: Math.max(0, Math.floor(progress)),
          remainder: progress % 1,
          colorToken: ring.colorToken,
        };
      });
  }, [rings, goals, facts]);
}
