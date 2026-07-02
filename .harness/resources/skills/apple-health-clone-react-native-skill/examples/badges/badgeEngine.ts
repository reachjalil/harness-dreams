import type { DailyFact } from '../data/healthModels';

export type BadgeCategory = 'first' | 'streak' | 'perfect-week' | 'milestone' | 'record' | 'monthly' | 'special';

export type BadgeRule =
  | { type: 'first-completion'; metricId: string; threshold: number }
  | { type: 'streak'; metricId: string; threshold: number; days: number }
  | { type: 'perfect-week'; metricId: string; threshold: number }
  | { type: 'milestone-total'; metricId: string; total: number }
  | { type: 'personal-record'; metricId: string };

export interface BadgeDefinition {
  id: string;
  title: string;
  description: string;
  category: BadgeCategory;
  iconToken: string;
  accentToken: string;
  rule: BadgeRule;
}

export interface EarnedBadge {
  badgeId: string;
  earnedAt: string;
  evidence: Record<string, unknown>;
}

export function evaluateBadges(
  badges: BadgeDefinition[],
  facts: DailyFact[],
  alreadyEarned: EarnedBadge[],
  now = new Date(),
): EarnedBadge[] {
  const earnedIds = new Set(alreadyEarned.map((b) => b.badgeId));
  const newBadges: EarnedBadge[] = [];

  for (const badge of badges) {
    if (earnedIds.has(badge.id) && badge.category !== 'record') continue;
    const result = evaluateRule(badge.rule, facts);
    if (result.earned) {
      newBadges.push({
        badgeId: badge.id,
        earnedAt: now.toISOString(),
        evidence: result.evidence,
      });
    }
  }

  return newBadges;
}

function evaluateRule(rule: BadgeRule, facts: DailyFact[]): { earned: boolean; evidence: Record<string, unknown> } {
  const metricFacts = facts
    .filter((f) => f.metricId === rule.metricId)
    .sort((a, b) => a.date.localeCompare(b.date));

  switch (rule.type) {
    case 'first-completion': {
      const fact = metricFacts.find((f) => f.value >= rule.threshold);
      return { earned: Boolean(fact), evidence: fact ? { date: fact.date, value: fact.value } : {} };
    }
    case 'streak': {
      let streak = 0;
      let best = 0;
      for (const fact of metricFacts) {
        if (fact.value >= rule.threshold) streak += 1;
        else streak = 0;
        best = Math.max(best, streak);
      }
      return { earned: best >= rule.days, evidence: { bestStreak: best, requiredDays: rule.days } };
    }
    case 'perfect-week': {
      const byWeek = new Map<string, DailyFact[]>();
      for (const fact of metricFacts) {
        const key = isoWeekKey(new Date(fact.date + 'T00:00:00'));
        byWeek.set(key, [...(byWeek.get(key) ?? []), fact]);
      }
      for (const [week, weekFacts] of byWeek) {
        const completedDays = weekFacts.filter((f) => f.value >= rule.threshold).length;
        if (completedDays >= 7) return { earned: true, evidence: { week, completedDays } };
      }
      return { earned: false, evidence: {} };
    }
    case 'milestone-total': {
      const total = metricFacts.reduce((sum, fact) => sum + fact.value, 0);
      return { earned: total >= rule.total, evidence: { total, requiredTotal: rule.total } };
    }
    case 'personal-record': {
      const best = metricFacts.reduce<DailyFact | undefined>((max, fact) => !max || fact.value > max.value ? fact : max, undefined);
      return { earned: Boolean(best), evidence: best ? { date: best.date, value: best.value } : {} };
    }
  }
}

function isoWeekKey(date: Date): string {
  const tmp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((tmp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${tmp.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}
