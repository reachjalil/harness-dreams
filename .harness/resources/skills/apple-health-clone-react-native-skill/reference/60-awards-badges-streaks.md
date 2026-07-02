# 60 — Awards, Badges, and Streaks

Apple-style awards are not just decorative. They create a loop:

```text
goal → effort → completion → recognition → history → next challenge
```

Build badges as data-driven rules, not hardcoded UI.

## Badge model

```ts
export interface BadgeDefinition {
  id: string;
  title: string;
  description: string;
  category: 'first' | 'streak' | 'perfect-week' | 'milestone' | 'record' | 'monthly' | 'special';
  iconToken: string;
  accentToken: string;
  rule: BadgeRule;
}

export interface EarnedBadge {
  badgeId: string;
  earnedAt: string;
  periodStart?: string;
  periodEnd?: string;
  evidence: Record<string, unknown>;
}
```

## Badge categories

### First-time badges

- First ring closed.
- First workout logged.
- First sleep goal reached.
- First week of data.

### Streak badges

- 3-day streak.
- 7-day streak.
- 30-day streak.
- Longest streak.

### Perfect week badges

- Closed a specific ring every day of a week.
- Completed all rings every day of a week.
- Logged required metric every day.

### Milestone badges

- 10 workouts.
- 100 km walked.
- 1,000 minutes focused.
- 50 meditation sessions.

### Personal record badges

- Highest daily steps.
- Longest workout.
- Most focused minutes.
- Best sleep consistency.

### Monthly challenges

Generated challenge based on recent user behavior:

```text
Baseline: last 28 days average
Challenge: achievable stretch target
Rule: complete N days over target within month
```

## Badge engine pattern

1. Normalize daily facts.
2. Evaluate badge rules after each refresh.
3. Store earned badges idempotently.
4. Trigger unlock UI only once.
5. Allow badge history to be recomputed from source data.

## Visual pattern

Badge card:

```text
badge visual
badge title
short achievement copy
date earned
progress if not earned
```

Badge detail:

```text
large badge visual
rule explanation
current progress
historical evidence
related metric
```

## Award animation

Keep it tasteful:

- Badge scale from 0.92 to 1.0.
- Soft glow or particle burst.
- Haptic on Watch/iPhone where appropriate.
- Respect Reduce Motion.

## Challenge generation

Avoid punitive goals. Use adaptive targets:

```ts
nextGoal = clamp(
  roundToNiceNumber(recentAverage * 1.08),
  minimumSafeGoal,
  recentBest * 0.95
);
```

## Anti-patterns

- Punishing rest days.
- Breaking streaks during illness/travel without pause controls.
- Awarding badges for data the app cannot verify.
- Using health-sensitive achievements in public/social contexts without consent.
- Generating impossible monthly goals.
