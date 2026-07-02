export interface DailyFact {
  date: string;
  values: Record<string, number>;
}

export interface BadgeContext {
  facts: DailyFact[];
  today: string;
}

export interface BadgeEvaluation {
  unlocked: boolean;
  progress: number;
  progressMax: number;
  unlockedAt?: string;
  reason: string;
}

export interface BadgeRule {
  id: string;
  title: string;
  description: string;
  category: 'streak' | 'milestone' | 'record' | 'challenge' | 'consistency';
  evaluate(ctx: BadgeContext): BadgeEvaluation;
}

export function createStreakBadge(metricId: string, goal: number, days: number): BadgeRule {
  return {
    id: `streak:${metricId}:${goal}:${days}`,
    title: `${days}-day streak`,
    description: `Complete ${goal} ${metricId} for ${days} days in a row.`,
    category: 'streak',
    evaluate(ctx) {
      const sorted = [...ctx.facts].sort((a, b) => b.date.localeCompare(a.date));
      let streak = 0;
      let unlockedAt: string | undefined;
      for (const fact of sorted) {
        if ((fact.values[metricId] ?? 0) >= goal) {
          streak += 1;
          if (streak >= days) {
            unlockedAt = fact.date;
            break;
          }
        } else if (streak > 0) {
          break;
        }
      }
      return {
        unlocked: streak >= days,
        progress: Math.min(streak, days),
        progressMax: days,
        unlockedAt,
        reason: streak >= days ? `Completed ${days} days in a row.` : `${days - streak} more days needed.`,
      };
    },
  };
}

export function createPersonalRecordBadge(metricId: string, minValue: number): BadgeRule {
  return {
    id: `record:${metricId}:${minValue}`,
    title: 'Personal record',
    description: `Reach a new high for ${metricId}.`,
    category: 'record',
    evaluate(ctx) {
      const best = ctx.facts.reduce((acc, fact) => {
        const value = fact.values[metricId] ?? 0;
        return value > acc.value ? { value, date: fact.date } : acc;
      }, { value: 0, date: undefined as string | undefined });
      return {
        unlocked: best.value >= minValue,
        progress: Math.min(best.value, minValue),
        progressMax: minValue,
        unlockedAt: best.value >= minValue ? best.date : undefined,
        reason: best.value >= minValue ? `Best value is ${best.value}.` : `Best value is ${best.value}; target is ${minValue}.`,
      };
    },
  };
}
