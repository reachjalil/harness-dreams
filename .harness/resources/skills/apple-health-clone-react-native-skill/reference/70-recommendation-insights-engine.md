# 70 — Recommendation and Insights Engine

Apple Health-style recommendations are specific, contextual, and data-backed. They usually follow this pattern:

```text
Observe → Compare → Explain → Suggest → Deep-link
```

## Insight model

```ts
export interface Insight {
  id: string;
  metricId: string;
  type: 'trend' | 'anomaly' | 'milestone' | 'recommendation' | 'education';
  severity: 'positive' | 'neutral' | 'attention';
  title: string;
  body: string;
  evidence: InsightEvidence;
  suggestedAction?: SuggestedAction;
  createdAt: string;
}
```

## Recommendation template

```text
Title: Your walking average increased
Body: You averaged 6,400 steps over the last 7 days, up from 5,700 over the previous 28 days.
Action: View step trend
```

Better than:

```text
You should walk more.
```

## Insight types

### Trends

Compare:

- Last 7 days vs previous 28 days.
- Last 30 days vs previous 90 days.
- Last 90 days vs last 365 days when enough data exists.

### Anomalies

Detect unusual values:

- sudden drop in steps.
- unusually high resting heart rate.
- missed sleep logging.
- reduced workout frequency.

Use neutral language:

```text
Your sleep duration was lower than usual this week.
```

Avoid diagnostic language:

```text
You may have insomnia.
```

### Positive reinforcement

Highlight wins:

- consistency improved.
- daily average increased.
- fewer missed days.
- new personal record.

### Coaching

Keep recommendations achievable:

- “Add a 10-minute walk on two days this week.”
- “Try setting a 40-minute focus goal on weekdays.”
- “Log water with breakfast and lunch to close your hydration ring earlier.”

## Explainability

Every insight should expose evidence:

```ts
export interface InsightEvidence {
  currentWindow: { start: string; end: string; value: number; unit: string };
  baselineWindow?: { start: string; end: string; value: number; unit: string };
  delta?: number;
  deltaPercent?: number;
  sampleCount: number;
  confidence: 'low' | 'medium' | 'high';
}
```

## Safety language

- Do not diagnose.
- Do not create medical urgency unless backed by clinically validated rules and reviewed by professionals.
- For health-sensitive insights, say “consider discussing with a healthcare professional” only when appropriate and not alarmist.
- Make data provenance clear.

## Recommendation ranking

Rank cards by:

1. User favorites.
2. Recent significant change.
3. Confidence / data completeness.
4. Actionability.
5. Freshness.
6. User dismissals.

## Dismiss and feedback

Allow:

- Hide this insight.
- Not useful.
- Remind me later.
- Adjust goal.
- Manage data permissions.

## Agent prompt pattern

When asking an AI agent to generate a recommendation, provide structured data and constraints:

```text
Given metric: steps
Current 7-day average: 6420
Previous 28-day average: 5700
Sample count: 35 daily aggregates
User goal: 7000 steps/day
Tone: calm, non-medical, specific
Return: title, 1 sentence body, one action label
```

Never pass unnecessary raw health history to a model when an aggregate is sufficient.
